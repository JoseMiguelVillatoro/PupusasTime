import type { SharedBackend } from './backend';

/**
 * Backend activo. En producción siempre es Supabase. En desarrollo se puede
 * usar el simulado con VITE_SHARED_BACKEND=memory (dos pestañas = dos teléfonos).
 *
 * Se carga recién cuando alguien abre o se une a una mesa: así quien usa la app
 * en un solo teléfono no descarga la librería de Supabase.
 */
let loaded: Promise<SharedBackend> | null = null;
function load(): Promise<SharedBackend> {
  if (!loaded) {
    loaded =
      import.meta.env.VITE_SHARED_BACKEND === 'memory'
        ? import('./memoryBackend').then((m) => m.memoryBackend)
        : import('./supabaseBackend').then((m) => m.supabaseBackend);
  }
  return loaded;
}

export const backend: SharedBackend = {
  ensureUser: () => load().then((b) => b.ensureUser()),
  createTable: (...a) => load().then((b) => b.createTable(...a)),
  joinTable: (...a) => load().then((b) => b.joinTable(...a)),
  loadTable: (...a) => load().then((b) => b.loadTable(...a)),
  saveOrder: (...a) => load().then((b) => b.saveOrder(...a)),
  addOffline: (...a) => load().then((b) => b.addOffline(...a)),
  removeParticipant: (...a) => load().then((b) => b.removeParticipant(...a)),
  setStatus: (...a) => load().then((b) => b.setStatus(...a)),
  subscribe(pupuseadaId, onChange) {
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    void load().then((b) => {
      if (!cancelled) unsubscribe = b.subscribe(pupuseadaId, onChange);
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },
};

export * from './backend';
