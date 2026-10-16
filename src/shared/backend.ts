import type { AccountGroup, BillingMethod, ExtraItem, PupusaItem } from '@/data/pupusa';

/**
 * La mesa compartida vista desde la app. Hay dos implementaciones con esta
 * misma forma: Supabase (la real) y una simulada en el navegador, que se usa
 * en desarrollo y en las pruebas para simular varios teléfonos.
 */

export type TableStatus = 'ordering' | 'locked' | 'closed';

export interface SharedParticipant {
  id: string;
  /** null = persona sin teléfono propio. */
  uid: string | null;
  /** Teléfono que pide por esta persona: el suyo, o el de quien la agregó. */
  managedBy: string | null;
  name: string;
  items: PupusaItem[];
  extras: ExtraItem[];
  done: boolean;
  createdAt: string;
}

export interface SharedRestaurant {
  name: string;
  placeId: string;
}

/** Cómo se divide la cuenta. Lo decide el anfitrión y lo ven todos. */
export interface SharedBilling {
  method: BillingMethod;
  groups: AccountGroup[];
}

/** Precios y propina que puso el anfitrión. `published` = ya calculó y todos ven el resultado. */
export interface SharedPayment {
  priceInputs: Record<string, string>;
  uniformPrice: boolean;
  uniformInput: string;
  hasTip: boolean | null;
  tipInput: string;
  published: boolean;
}

export interface TableSnapshot {
  id: string;
  code: string;
  hostUid: string;
  status: TableStatus;
  restaurant: SharedRestaurant | null;
  billing: SharedBilling | null;
  payment: SharedPayment | null;
  participants: SharedParticipant[];
}

export interface Seat {
  pupuseadaId: string;
  participantId: string;
  code: string;
}

export interface OrderPatch {
  name?: string;
  items?: PupusaItem[];
  extras?: ExtraItem[];
  done?: boolean;
}

export interface SharedBackend {
  /** Inicia (o retoma) la sesión anónima de este teléfono y devuelve su ID. */
  ensureUser(): Promise<string>;
  createTable(hostName: string, restaurant: SharedRestaurant | null): Promise<Seat>;
  joinTable(code: string, name: string): Promise<Seat>;
  loadTable(pupuseadaId: string): Promise<TableSnapshot>;
  saveOrder(participantId: string, patch: OrderPatch): Promise<void>;
  /** Agrega a alguien sin teléfono, a cargo del teléfono que lo agrega. */
  addOffline(pupuseadaId: string, name: string): Promise<string>;
  removeParticipant(participantId: string): Promise<void>;
  setStatus(pupuseadaId: string, status: TableStatus): Promise<void>;
  /** Solo el anfitrión: guarda la forma de pagar y los precios para todos. */
  setAccounts(pupuseadaId: string, billing: SharedBilling, payment: SharedPayment): Promise<void>;
  /** Avisa cuando algo cambió en la mesa. Devuelve la función para dejar de escuchar. */
  subscribe(pupuseadaId: string, onChange: () => void): () => void;
}

/** Error con un mensaje que se le puede mostrar a la persona. */
export class SharedError extends Error {}

/** Normaliza lo que alguien escribe o escanea: mayúsculas, sin espacios ni guiones. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const CODE_PATTERN = /^[A-Z2-9]{5}$/;

export function shareUrl(code: string, origin = window.location.origin): string {
  return `${origin}/?mesa=${code}`;
}
