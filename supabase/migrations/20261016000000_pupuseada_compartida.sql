-- ════════════════════════════════════════════════════════════════════
-- Pupusas Time · Etapa 2: pupuseada compartida entre varios teléfonos
--
-- Cómo se usa: pegá TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Modelo:
--   pupuseadas   una mesa, con su código corto (K7Q2X) y su anfitrión.
--   participants una fila por persona. Cada quien edita SOLO su fila, así
--                que dos teléfonos nunca pisan el pedido del otro.
--
-- Seguridad:
--   · Cada teléfono entra como usuario anónimo de Supabase (sin cuenta).
--   · Nadie puede listar pupuseadas: solo se entra con el código, por RPC.
--   · Solo los miembros de una mesa ven esa mesa.
--   · El anfitrión puede agregar a alguien sin teléfono y cerrar el pedido.
-- ════════════════════════════════════════════════════════════════════

-- ── Tablas ──────────────────────────────────────────────────────────

create table if not exists public.pupuseadas (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z2-9]{5}$'),
  host_uid    uuid not null references auth.users (id) on delete cascade,
  restaurant  jsonb check (restaurant is null or jsonb_typeof(restaurant) = 'object'),
  status      text not null default 'ordering' check (status in ('ordering', 'locked', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Ventana para unirse con el código. Los datos se borran 7 días después.
  expires_at  timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.participants (
  id            uuid primary key default gen_random_uuid(),
  pupuseada_id  uuid not null references public.pupuseadas (id) on delete cascade,
  -- null = persona sin teléfono, agregada por el anfitrión.
  uid           uuid references auth.users (id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  items         jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 60),
  extras        jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(extras) = 'array' and jsonb_array_length(extras) <= 30),
  done          boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (pupuseada_id, uid)
);

create index if not exists participants_pupuseada_idx on public.participants (pupuseada_id);
create index if not exists pupuseadas_expires_idx on public.pupuseadas (expires_at);

-- ── updated_at automático ───────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pupuseadas_touch on public.pupuseadas;
create trigger pupuseadas_touch before update on public.pupuseadas
  for each row execute function public.touch_updated_at();

drop trigger if exists participants_touch on public.participants;
create trigger participants_touch before update on public.participants
  for each row execute function public.touch_updated_at();

-- ── Límite de personas por mesa ─────────────────────────────────────

create or replace function public.enforce_participant_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.participants where pupuseada_id = new.pupuseada_id) >= 40 then
    raise exception 'La mesa ya tiene el máximo de 40 personas' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists participants_limit on public.participants;
create trigger participants_limit before insert on public.participants
  for each row execute function public.enforce_participant_limit();

-- ── Ayudantes para los permisos ─────────────────────────────────────
-- security definer: consultan las tablas sin pasar por RLS, para no caer
-- en recursión al usarse dentro de las mismas políticas.

create or replace function public.is_member(p_pupuseada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pupuseadas p
    where p.id = p_pupuseada and p.host_uid = (select auth.uid())
  ) or exists (
    select 1 from public.participants pa
    where pa.pupuseada_id = p_pupuseada and pa.uid = (select auth.uid())
  );
$$;

create or replace function public.is_host(p_pupuseada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pupuseadas p
    where p.id = p_pupuseada and p.host_uid = (select auth.uid())
  );
$$;

create or replace function public.is_ordering(p_pupuseada uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pupuseadas p
    where p.id = p_pupuseada and p.status = 'ordering'
  );
$$;

-- ── Row Level Security ──────────────────────────────────────────────

alter table public.pupuseadas enable row level security;
alter table public.participants enable row level security;

drop policy if exists "miembros ven su mesa" on public.pupuseadas;
create policy "miembros ven su mesa" on public.pupuseadas
  for select to authenticated
  using (public.is_member(id));

drop policy if exists "anfitrion actualiza su mesa" on public.pupuseadas;
create policy "anfitrion actualiza su mesa" on public.pupuseadas
  for update to authenticated
  using (host_uid = (select auth.uid()))
  with check (host_uid = (select auth.uid()));

drop policy if exists "anfitrion borra su mesa" on public.pupuseadas;
create policy "anfitrion borra su mesa" on public.pupuseadas
  for delete to authenticated
  using (host_uid = (select auth.uid()));

drop policy if exists "miembros ven a la mesa" on public.participants;
create policy "miembros ven a la mesa" on public.participants
  for select to authenticated
  using (public.is_member(pupuseada_id));

-- El anfitrión agrega a alguien sin teléfono (uid null). Unirse con
-- teléfono propio va por la función join_pupuseada.
drop policy if exists "anfitrion agrega sin telefono" on public.participants;
create policy "anfitrion agrega sin telefono" on public.participants
  for insert to authenticated
  with check (uid is null and public.is_host(pupuseada_id));

-- Cada quien edita su pedido mientras la mesa esté abierta; el anfitrión
-- puede editar a cualquiera en cualquier momento.
drop policy if exists "editar mi pedido" on public.participants;
create policy "editar mi pedido" on public.participants
  for update to authenticated
  using (
    public.is_host(pupuseada_id)
    or (uid = (select auth.uid()) and public.is_ordering(pupuseada_id))
  )
  with check (
    public.is_host(pupuseada_id)
    or (uid = (select auth.uid()) and public.is_ordering(pupuseada_id))
  );

drop policy if exists "salir o quitar" on public.participants;
create policy "salir o quitar" on public.participants
  for delete to authenticated
  using (public.is_host(pupuseada_id) or uid = (select auth.uid()));

-- ── Permisos por columna ────────────────────────────────────────────
-- Aunque RLS deje editar una fila, solo se pueden tocar estas columnas:
-- nadie puede cambiarse de mesa, cambiar de dueño ni alargar la expiración.

revoke all on public.pupuseadas, public.participants from anon, authenticated;
grant select, delete on public.pupuseadas to authenticated;
grant update (status, restaurant) on public.pupuseadas to authenticated;
grant select, delete on public.participants to authenticated;
grant insert (pupuseada_id, name, items, extras) on public.participants to authenticated;
grant update (name, items, extras, done) on public.participants to authenticated;

-- ── Crear una mesa ──────────────────────────────────────────────────

create or replace function public.create_pupuseada(p_host_name text, p_restaurant jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sin 0/O, 1/I/L
  v_code text;
  v_pupuseada uuid;
  v_participant uuid;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '28000';
  end if;

  -- Freno simple contra abuso: máximo 20 mesas por hora por teléfono.
  select count(*) into v_recent from public.pupuseadas
  where host_uid = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Demasiadas mesas nuevas; esperá un rato' using errcode = 'P0001';
  end if;

  for attempt in 1..10 loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into public.pupuseadas (code, host_uid, restaurant)
      values (v_code, v_uid, p_restaurant)
      returning id into v_pupuseada;
      exit;
    exception when unique_violation then
      v_pupuseada := null;
    end;
  end loop;

  if v_pupuseada is null then
    raise exception 'No se pudo generar un código, probá de nuevo' using errcode = 'P0001';
  end if;

  insert into public.participants (pupuseada_id, uid, name)
  values (v_pupuseada, v_uid, btrim(p_host_name))
  returning id into v_participant;

  return jsonb_build_object('pupuseada_id', v_pupuseada, 'participant_id', v_participant, 'code', v_code);
end;
$$;

-- ── Unirse con el código ────────────────────────────────────────────

create or replace function public.join_pupuseada(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pupuseada public.pupuseadas%rowtype;
  v_participant uuid;
begin
  if v_uid is null then
    raise exception 'Hace falta iniciar sesión' using errcode = '28000';
  end if;

  select * into v_pupuseada from public.pupuseadas
  where code = upper(btrim(p_code)) and expires_at > now();

  -- Un solo mensaje para "no existe" y "expiró": no le confirma a nadie
  -- qué códigos son válidos.
  if not found then
    raise exception 'No encontramos esa mesa. Revisá el código.' using errcode = 'P0002';
  end if;

  -- Si este teléfono ya estaba en la mesa, lo devolvemos a su lugar.
  select id into v_participant from public.participants
  where pupuseada_id = v_pupuseada.id and uid = v_uid;
  if found then
    return jsonb_build_object('pupuseada_id', v_pupuseada.id, 'participant_id', v_participant, 'code', v_pupuseada.code);
  end if;

  if v_pupuseada.status <> 'ordering' then
    raise exception 'Esta mesa ya cerró el pedido' using errcode = 'P0001';
  end if;

  insert into public.participants (pupuseada_id, uid, name)
  values (v_pupuseada.id, v_uid, btrim(p_name))
  returning id into v_participant;

  return jsonb_build_object('pupuseada_id', v_pupuseada.id, 'participant_id', v_participant, 'code', v_pupuseada.code);
end;
$$;

revoke all on function public.create_pupuseada(text, jsonb) from public, anon;
revoke all on function public.join_pupuseada(text, text) from public, anon;
grant execute on function public.create_pupuseada(text, jsonb) to authenticated;
grant execute on function public.join_pupuseada(text, text) to authenticated;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_host(uuid) from public, anon;
revoke all on function public.is_ordering(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_host(uuid) to authenticated;
grant execute on function public.is_ordering(uuid) to authenticated;

-- ── Tiempo real ─────────────────────────────────────────────────────
-- Los cambios llegan a cada teléfono respetando los mismos permisos (RLS).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pupuseadas'
  ) then
    alter publication supabase_realtime add table public.pupuseadas;
  end if;
end;
$$;

-- ── Limpieza: borrar mesas de hace más de 7 días ────────────────────

create or replace function public.delete_old_pupuseadas()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.pupuseadas where expires_at < now() - interval '7 days' returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function public.delete_old_pupuseadas() from public, anon, authenticated;

-- Programa la limpieza diaria si pg_cron está disponible. Si no, el resto
-- del script funciona igual y la limpieza se puede activar después desde
-- Database → Extensions → pg_cron.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'pupusastime-limpieza';
  perform cron.schedule('pupusastime-limpieza', '15 9 * * *', 'select public.delete_old_pupuseadas()');
exception when others then
  raise notice 'pg_cron no disponible (%); la limpieza diaria queda pendiente', sqlerrm;
end;
$$;
