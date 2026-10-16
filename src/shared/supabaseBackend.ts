import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SharedError,
  type OrderPatch,
  type Seat,
  type SharedBackend,
  type SharedParticipant,
  type SharedBilling,
  type SharedPayment,
  type SharedRestaurant,
  type TableSnapshot,
  type TableStatus,
} from './backend';

// La URL y la llave publicable van en el navegador de todos modos: no son
// secretas. Se pueden sobreescribir con variables de entorno de Vite.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zqhszgrkuixxhssteczg.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_fyRY1F__I87EoEestLDm6Q_H_dnKAVe';

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pupusastime:auth' },
    });
  }
  return client;
}

interface ParticipantRow {
  id: string;
  uid: string | null;
  managed_by: string | null;
  name: string;
  items: SharedParticipant['items'];
  extras: SharedParticipant['extras'];
  done: boolean;
  created_at: string;
}

const toParticipant = (r: ParticipantRow): SharedParticipant => ({
  id: r.id,
  uid: r.uid,
  managedBy: r.managed_by,
  name: r.name,
  items: Array.isArray(r.items) ? r.items : [],
  extras: Array.isArray(r.extras) ? r.extras : [],
  done: r.done,
  createdAt: r.created_at,
});

/** Convierte errores de red y de Postgres en mensajes para la persona. */
function friendly(error: { message?: string; code?: string } | null, fallback: string): SharedError {
  if (!error) return new SharedError(fallback);
  // Los mensajes que levantan nuestras funciones SQL ya están en español.
  if (error.code === 'P0001' || error.code === 'P0002') return new SharedError(error.message ?? fallback);
  if (/fetch|network|Failed/i.test(error.message ?? '')) return new SharedError('Sin conexión. Revisá tu internet y probá de nuevo.');
  return new SharedError(fallback);
}

export const supabaseBackend: SharedBackend = {
  async ensureUser() {
    const { data } = await sb().auth.getSession();
    if (data.session?.user) return data.session.user.id;
    const { data: signed, error } = await sb().auth.signInAnonymously();
    if (error || !signed.user) throw friendly(error, 'No pudimos conectar este teléfono. Probá de nuevo.');
    return signed.user.id;
  },

  async createTable(hostName, restaurant) {
    await this.ensureUser();
    const { data, error } = await sb().rpc('create_pupuseada', { p_host_name: hostName, p_restaurant: restaurant });
    if (error || !data) throw friendly(error, 'No pudimos crear la mesa. Probá de nuevo.');
    return { pupuseadaId: data.pupuseada_id, participantId: data.participant_id, code: data.code } satisfies Seat;
  },

  async joinTable(code, name) {
    await this.ensureUser();
    const { data, error } = await sb().rpc('join_pupuseada', { p_code: code, p_name: name });
    if (error || !data) throw friendly(error, 'No pudimos unirte a la mesa. Probá de nuevo.');
    return { pupuseadaId: data.pupuseada_id, participantId: data.participant_id, code: data.code } satisfies Seat;
  },

  async loadTable(pupuseadaId) {
    const [table, people] = await Promise.all([
      sb().from('pupuseadas').select('id, code, host_uid, status, restaurant, billing, payment').eq('id', pupuseadaId).maybeSingle(),
      sb()
        .from('participants')
        .select('id, uid, managed_by, name, items, extras, done, created_at')
        .eq('pupuseada_id', pupuseadaId)
        .order('created_at', { ascending: true }),
    ]);
    if (table.error || people.error) throw friendly(table.error ?? people.error, 'No pudimos cargar la mesa.');
    if (!table.data) throw new SharedError('Esta mesa ya no existe o no tenés acceso.');
    return {
      id: table.data.id,
      code: table.data.code,
      hostUid: table.data.host_uid,
      status: table.data.status as TableStatus,
      restaurant: (table.data.restaurant as SharedRestaurant | null) ?? null,
      billing: (table.data.billing as SharedBilling | null) ?? null,
      payment: (table.data.payment as SharedPayment | null) ?? null,
      participants: (people.data as ParticipantRow[]).map(toParticipant),
    } satisfies TableSnapshot;
  },

  async saveOrder(participantId, patch: OrderPatch) {
    const { error, count } = await sb()
      .from('participants')
      .update(patch, { count: 'exact' })
      .eq('id', participantId);
    if (error) throw friendly(error, 'No se pudo guardar tu pedido. Probá de nuevo.');
    if (count === 0) throw new SharedError('El pedido ya está cerrado: pedile al anfitrión que lo cambie.');
  },

  async addOffline(pupuseadaId, name) {
    const { data, error } = await sb()
      .from('participants')
      .insert({ pupuseada_id: pupuseadaId, name })
      .select('id')
      .single();
    if (error || !data) throw friendly(error, 'No pudimos agregar a esa persona.');
    return data.id as string;
  },

  async removeParticipant(participantId) {
    const { error } = await sb().from('participants').delete().eq('id', participantId);
    if (error) throw friendly(error, 'No pudimos quitar a esa persona.');
  },

  async setStatus(pupuseadaId, status) {
    const { error } = await sb().from('pupuseadas').update({ status }).eq('id', pupuseadaId);
    if (error) throw friendly(error, 'No pudimos cambiar el estado de la mesa.');
  },

  async setAccounts(pupuseadaId, billing, payment) {
    const { error, count } = await sb()
      .from('pupuseadas')
      .update({ billing, payment }, { count: 'exact' })
      .eq('id', pupuseadaId);
    if (error) throw friendly(error, 'No pudimos guardar las cuentas para la mesa.');
    if (count === 0) throw new SharedError('Solo el anfitrión puede hacer las cuentas de la mesa.');
  },

  subscribe(pupuseadaId, onChange) {
    const channel = sb()
      .channel(`mesa-${pupuseadaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `pupuseada_id=eq.${pupuseadaId}` },
        onChange
      )
      // Los DELETE no admiten filtro: llegan todos los visibles y recargamos.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'participants' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pupuseadas', filter: `id=eq.${pupuseadaId}` }, onChange)
      .subscribe((status) => {
        // Al (re)conectar recargamos por si algo cambió mientras no había señal.
        if (status === 'SUBSCRIBED') onChange();
      });
    return () => {
      void sb().removeChannel(channel);
    };
  },
};
