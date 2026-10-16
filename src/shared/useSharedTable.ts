import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExtraItem, PupusaItem } from '@/data/pupusa';
import type { Action, PupuseadaState } from '@/state/pupuseada';
import type { AccountGroup, BillingMethod } from '@/data/pupusa';
import type { PaymentDraft } from '@/state/pupuseada';
import { backend, SharedError, type OrderPatch, type TableSnapshot, type TableStatus } from './index';

const POLL_MS = 20_000;
const RETRY_MS = 5_000;

function message(e: unknown, fallback: string): string {
  return e instanceof SharedError ? e.message : fallback;
}

/**
 * Conecta la pupuseada con la mesa compartida: escucha los cambios de los
 * demás teléfonos y guarda los propios. Si se cae la señal, lo pendiente se
 * reintenta solo y mientras tanto se sigue mostrando lo que ya se pidió.
 */
export function useSharedTable(state: PupuseadaState, dispatch: (a: Action) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const pending = useRef(new Map<string, OrderPatch>());
  const tableId = state.shared?.pupuseadaId ?? null;

  /** Lo pendiente de guardar se superpone a lo que llega del servidor. */
  const withPending = useCallback((snap: TableSnapshot): TableSnapshot => {
    if (pending.current.size === 0) return snap;
    return {
      ...snap,
      participants: snap.participants.map((p) => {
        const patch = pending.current.get(p.id);
        return patch ? { ...p, ...patch } : p;
      }),
    };
  }, []);

  const flush = useCallback(async () => {
    for (const [participantId, patch] of [...pending.current]) {
      try {
        await backend.saveOrder(participantId, patch);
        if (pending.current.get(participantId) === patch) pending.current.delete(participantId);
        setOffline(false);
      } catch (e) {
        if (e instanceof SharedError && !/conexión/i.test(e.message)) {
          // Rechazo de permisos (p. ej. la mesa cerró): no tiene sentido reintentar.
          pending.current.delete(participantId);
          setError(e.message);
        } else {
          setOffline(true);
        }
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!tableId) return;
    try {
      const snap = await backend.loadTable(tableId);
      dispatch({ type: 'SHARED_SYNC', snapshot: withPending(snap) });
      setOffline(false);
    } catch (e) {
      if (e instanceof SharedError && !/conexión/i.test(e.message)) setError(e.message);
      else setOffline(true);
    }
    if (pending.current.size > 0) void flush();
  }, [tableId, dispatch, withPending, flush]);

  // Escuchar la mesa mientras estemos en una.
  useEffect(() => {
    if (!tableId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 150);
    };
    const unsubscribe = backend.subscribe(tableId, debounced);
    const poll = setInterval(debounced, POLL_MS);
    const retry = setInterval(() => pending.current.size > 0 && void flush(), RETRY_MS);
    const onVisible = () => document.visibilityState === 'visible' && debounced();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', debounced);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      clearInterval(retry);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', debounced);
    };
  }, [tableId, refresh, flush]);

  const run = useCallback(async <T,>(fallback: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(message(e, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const enter = useCallback(
    async (seatPromise: () => Promise<{ pupuseadaId: string; participantId: string; code: string }>) => {
      const myUid = await backend.ensureUser();
      const seat = await seatPromise();
      const snapshot = await backend.loadTable(seat.pupuseadaId);
      dispatch({ type: 'SHARED_ENTER', seat, myUid, snapshot });
    },
    [dispatch]
  );

  return {
    busy,
    error,
    offline,
    clearError: () => setError(null),

    share: (hostName: string) =>
      run('No pudimos crear la mesa. Probá de nuevo.', () =>
        enter(() =>
          backend.createTable(
            hostName,
            state.restaurant ? { name: state.restaurant.name, placeId: state.restaurant.placeId } : null
          )
        )
      ),

    join: (code: string, name: string) =>
      run('No pudimos unirte a la mesa. Probá de nuevo.', () => enter(() => backend.joinTable(code, name))),

    /** Guarda el pedido de una persona (la propia, o cualquiera si sos anfitrión). */
    saveOrder: (personId: string, items: PupusaItem[], extras: ExtraItem[]) => {
      pending.current.set(personId, { items, extras, done: true });
      void flush();
    },

    addOffline: (name: string) =>
      run('No pudimos agregar a esa persona.', async () => {
        if (!tableId) return;
        await backend.addOffline(tableId, name);
        await refresh();
      }),

    remove: (personId: string) =>
      run('No pudimos quitar a esa persona.', async () => {
        await backend.removeParticipant(personId);
        pending.current.delete(personId);
        await refresh();
      }),

    setStatus: (status: TableStatus) =>
      run('No pudimos cambiar el estado de la mesa.', async () => {
        if (!tableId) return;
        await backend.setStatus(tableId, status);
        await refresh();
      }),

    /** Anfitrión: publica la forma de pagar, los precios y la propina para toda la mesa. */
    publishAccounts: (billing: BillingMethod, groups: AccountGroup[], payment: PaymentDraft) =>
      run('No pudimos compartir las cuentas con la mesa.', async () => {
        if (!tableId) return;
        await backend.setAccounts(
          tableId,
          { method: billing, groups },
          {
            priceInputs: payment.priceInputs,
            uniformPrice: payment.uniformPrice,
            uniformInput: payment.uniformInput,
            hasTip: payment.hasTip,
            tipInput: payment.tipInput,
            published: true,
          }
        );
      }),

    refresh,
  };
}

export type SharedTable = ReturnType<typeof useSharedTable>;
