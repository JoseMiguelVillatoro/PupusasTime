-- ════════════════════════════════════════════════════════════════════
-- Pupusas Time · Etapa 2c: cuentas compartidas y pedidos por teléfono
--
-- Correr DESPUÉS de 20261016000000_pupuseada_compartida.sql.
-- Pegá TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez sin romper nada.
--
-- Cambios:
--   1. Cada persona tiene un "teléfono a cargo" (managed_by): el suyo, o el
--      de quien pide por ella. Así cualquiera puede pedir por su grupo
--      ("yo y mi amiga") y la cuenta se puede dividir por teléfono.
--   2. La forma de pagar, los precios y la propina viven en la mesa. Solo el
--      anfitrión los cambia y todos ven el mismo resultado.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Teléfono a cargo de cada persona ─────────────────────────────

alter table public.participants
  add column if not exists managed_by uuid references auth.users (id) on delete set null;

-- Filas existentes: la persona misma, o el anfitrión si no tiene teléfono.
update public.participants pa
set managed_by = coalesce(pa.uid, p.host_uid)
from public.pupuseadas p
where p.id = pa.pupuseada_id and pa.managed_by is null;

-- Toda fila nueva queda a cargo de quien la crea. La columna no está en los
-- permisos de inserción, así que nadie puede asignársela a otro teléfono.
alter table public.participants alter column managed_by set default auth.uid();

create index if not exists participants_managed_by_idx on public.participants (managed_by);

-- Cualquier miembro puede agregar a alguien que pide desde su teléfono,
-- mientras la mesa esté abierta. El anfitrión, siempre.
drop policy if exists "anfitrion agrega sin telefono" on public.participants;
drop policy if exists "agregar a quien pide conmigo" on public.participants;
create policy "agregar a quien pide conmigo" on public.participants
  for insert to authenticated
  with check (
    uid is null
    and managed_by = (select auth.uid())
    and (
      public.is_host(pupuseada_id)
      or (public.is_member(pupuseada_id) and public.is_ordering(pupuseada_id))
    )
  );

-- Cada teléfono edita a las personas a su cargo mientras la mesa esté
-- abierta; el anfitrión puede editar a cualquiera en cualquier momento.
drop policy if exists "editar mi pedido" on public.participants;
create policy "editar mi pedido" on public.participants
  for update to authenticated
  using (
    public.is_host(pupuseada_id)
    or (managed_by = (select auth.uid()) and public.is_ordering(pupuseada_id))
  )
  with check (
    public.is_host(pupuseada_id)
    or (managed_by = (select auth.uid()) and public.is_ordering(pupuseada_id))
  );

drop policy if exists "salir o quitar" on public.participants;
create policy "salir o quitar" on public.participants
  for delete to authenticated
  using (
    public.is_host(pupuseada_id)
    or uid = (select auth.uid())
    or (managed_by = (select auth.uid()) and uid is null and public.is_ordering(pupuseada_id))
  );

-- ── 2. Cuentas en la mesa ───────────────────────────────────────────

alter table public.pupuseadas
  add column if not exists billing jsonb
    check (billing is null or jsonb_typeof(billing) = 'object'),
  add column if not exists payment jsonb
    check (payment is null or jsonb_typeof(payment) = 'object');

-- La política "anfitrion actualiza su mesa" ya limita los cambios al
-- anfitrión; aquí solo se habilitan las columnas nuevas.
grant update (status, restaurant, billing, payment) on public.pupuseadas to authenticated;
