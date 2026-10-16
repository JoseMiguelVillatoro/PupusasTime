import type { PlaceRestaurant } from '@/data/pupusa';
import { calculatePayment, accountsFor, parseMoney, type Cents } from '@/data/consolidation';
import { hasOrders, type PupuseadaState } from './pupuseada';

/**
 * Guardado local en el teléfono. Todo va envuelto en try/catch: en modo
 * privado o con el almacenamiento lleno, la app sigue funcionando sin guardar.
 */

const CURRENT_KEY = 'pupusastime:current:v1';
const HISTORY_KEY = 'pupusastime:history:v1';
const PRICES_KEY = 'pupusastime:prices:v1';
const HISTORY_LIMIT = 100;

/**
 * Con el backend simulado, cada pestaña hace de un teléfono distinto, así que
 * la pupuseada en curso se guarda por pestaña. En producción es localStorage.
 */
function storeFor(key: string): Storage {
  return key === CURRENT_KEY && import.meta.env.VITE_SHARED_BACKEND === 'memory' ? sessionStorage : localStorage;
}

function read<T>(key: string): T | null {
  try {
    const raw = storeFor(key).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    storeFor(key).setItem(key, JSON.stringify(value));
  } catch {
    // Sin espacio o sin permiso: seguimos sin guardar.
  }
}

function remove(key: string): void {
  try {
    storeFor(key).removeItem(key);
  } catch {
    // ignorado
  }
}

// ── Pupuseada en curso ─────────────────────────────────────────────

export function loadCurrent(): PupuseadaState | null {
  const s = read<PupuseadaState>(CURRENT_KEY);
  if (!s || s.v !== 1 || !Array.isArray(s.people)) return null;
  return s;
}

export function saveCurrent(state: PupuseadaState): void {
  if (state.screen === 'home' && state.people.length === 0) {
    remove(CURRENT_KEY);
    return;
  }
  write(CURRENT_KEY, state);
}

// ── Historial (base para las estadísticas de la etapa 3) ───────────

export interface HistoryEntry {
  v: 1;
  id: string;
  startedAt: number;
  finishedAt: number;
  restaurant: { name: string; placeId: string } | null;
  people: PupuseadaState['people'];
  billing: PupuseadaState['billing'];
  groups: PupuseadaState['groups'];
  priceCentsByType: Record<string, Cents>;
  tipPercent: number;
  totalCents: number | null;
}

export function loadHistory(): HistoryEntry[] {
  const h = read<HistoryEntry[]>(HISTORY_KEY);
  return Array.isArray(h) ? h : [];
}

export function priceCentsFromDraft(state: PupuseadaState): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  const { priceInputs, uniformPrice, uniformInput } = state.payment;
  const typeIds = new Set(state.people.flatMap((p) => p.items.map((i) => i.pupusaTypeId)));
  for (const id of typeIds) {
    const raw = uniformPrice ? uniformInput : priceInputs[id] ?? '';
    const cents = parseMoney(raw);
    if (cents !== null) out[id] = cents;
  }
  return out;
}

/** Guarda la pupuseada terminada en el historial. Ignora las que no tienen pedidos. */
export function archive(state: PupuseadaState, now = Date.now()): HistoryEntry | null {
  if (!hasOrders(state)) return null;
  const priceCentsByType = priceCentsFromDraft(state);
  const tipPercent = state.payment.hasTip ? Number(state.payment.tipInput) || 0 : 0;
  const pricedAll = state.people
    .flatMap((p) => p.items)
    .every((i) => priceCentsByType[i.pupusaTypeId] !== undefined);
  const totalCents =
    pricedAll && state.billing
      ? calculatePayment(state.people, accountsFor(state.billing, state.people, state.groups), priceCentsByType, tipPercent)
          .generalTotal
      : null;

  const entry: HistoryEntry = {
    v: 1,
    id: state.id,
    startedAt: state.startedAt,
    finishedAt: now,
    restaurant: state.restaurant ? { name: state.restaurant.name, placeId: state.restaurant.placeId } : null,
    people: state.people,
    billing: state.billing,
    groups: state.groups,
    priceCentsByType,
    tipPercent,
    totalCents,
  };
  const history = loadHistory().filter((h) => h.id !== entry.id);
  write(HISTORY_KEY, [entry, ...history].slice(0, HISTORY_LIMIT));
  return entry;
}

// ── Precios recordados por pupusería ──────────────────────────────

export interface SavedPrices {
  priceInputs: Record<string, string>;
  uniformPrice: boolean;
  uniformInput: string;
  updatedAt: number;
}

export function restaurantKey(r: PlaceRestaurant | null): string | null {
  return r ? r.placeId : null;
}

export function loadPrices(r: PlaceRestaurant | null): SavedPrices | null {
  const key = restaurantKey(r);
  if (!key) return null;
  const all = read<Record<string, SavedPrices>>(PRICES_KEY) ?? {};
  return all[key] ?? null;
}

export function savePrices(r: PlaceRestaurant | null, prices: Omit<SavedPrices, 'updatedAt'>, now = Date.now()): void {
  const key = restaurantKey(r);
  if (!key) return;
  const all = read<Record<string, SavedPrices>>(PRICES_KEY) ?? {};
  all[key] = { ...prices, updatedAt: now };
  write(PRICES_KEY, all);
}
