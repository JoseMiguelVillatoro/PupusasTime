import type {
  AccountGroup,
  BillingMethod,
  ExtraItem,
  PersonOrder,
  PlaceRestaurant,
  PupusaItem,
} from '@/data/pupusa';
import { pruneGroups } from '@/data/consolidation';
import type { Seat, TableSnapshot, TableStatus } from '@/shared/backend';

/**
 * Todo el estado de una pupuseada vive aquí y cambia solo a través del reducer.
 * En la etapa 2 este mismo reducer se alimentará también de eventos en tiempo real.
 */

export type Screen =
  | 'home'
  | 'restaurant'
  | 'people'
  | 'order'
  | 'personSummary'
  | 'final'
  | 'billing'
  | 'payment'
  | 'join'
  | 'lobby';

export type PaymentStep = 'price' | 'tip' | 'result';

export interface PaymentDraft {
  step: PaymentStep;
  /** Precio por especialidad tal como se escribió ("0.75"). */
  priceInputs: Record<string, string>;
  uniformPrice: boolean;
  uniformInput: string;
  hasTip: boolean | null;
  tipInput: string;
}

/** Datos de la mesa compartida cuando la pupuseada se pide desde varios teléfonos. */
export interface SharedInfo {
  pupuseadaId: string;
  code: string;
  myParticipantId: string;
  myUid: string;
  hostUid: string;
  status: TableStatus;
  /** Por participante: su teléfono (null = sin teléfono) y si ya terminó de pedir. */
  meta: Record<string, { uid: string | null; done: boolean }>;
}

export interface PupuseadaState {
  v: 1;
  id: string;
  startedAt: number;
  screen: Screen;
  restaurant: PlaceRestaurant | null;
  /** Personas en orden de pedido; cada una con su UUID. */
  people: PersonOrder[];
  currentPersonId: string | null;
  /** Si la edición empezó desde el resumen final, al terminar se vuelve ahí. */
  returnToFinal: boolean;
  billing: BillingMethod | null;
  groups: AccountGroup[];
  payment: PaymentDraft;
  /** null = un solo teléfono. Puede faltar en estados guardados por versiones anteriores. */
  shared?: SharedInfo | null;
  /** Código que llegó por link (?mesa=…), para prellenar la pantalla de unirse. */
  pendingCode?: string;
}

export interface PersonDraft {
  id?: string;
  name: string;
}

export type Action =
  | { type: 'START' }
  | { type: 'GO'; screen: Screen }
  | { type: 'SET_RESTAURANT'; restaurant: PlaceRestaurant | null }
  | { type: 'RESTAURANT_DONE' }
  | { type: 'SET_PEOPLE'; people: PersonDraft[] }
  | { type: 'SAVE_ORDER'; items: PupusaItem[]; extras: ExtraItem[] }
  | { type: 'EDIT_CURRENT' }
  | { type: 'NEXT_PERSON' }
  | { type: 'ORDER_BACK' }
  | { type: 'EDIT_PERSON'; personId: string }
  | { type: 'EDIT_PEOPLE' }
  | { type: 'OPEN_BILLING' }
  | { type: 'SET_BILLING'; billing: BillingMethod; groups: AccountGroup[] }
  | { type: 'UPDATE_PAYMENT'; patch: Partial<PaymentDraft> }
  | { type: 'RESET' }
  | { type: 'OPEN_JOIN'; code?: string }
  | { type: 'SHARED_ENTER'; seat: Seat; myUid: string; snapshot: TableSnapshot }
  | { type: 'SHARED_SYNC'; snapshot: TableSnapshot }
  | { type: 'OPEN_ORDER_FOR'; personId: string };

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Respaldo para navegadores viejos: suficiente para IDs locales.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const emptyPayment = (): PaymentDraft => ({
  step: 'price',
  priceInputs: {},
  uniformPrice: false,
  uniformInput: '',
  hasTip: null,
  tipInput: '',
});

export function initialState(now = Date.now(), id = newId()): PupuseadaState {
  return {
    v: 1,
    id,
    startedAt: now,
    screen: 'home',
    restaurant: null,
    people: [],
    currentPersonId: null,
    returnToFinal: false,
    billing: null,
    groups: [],
    payment: emptyPayment(),
    shared: null,
  };
}

export const isShared = (s: PupuseadaState): s is PupuseadaState & { shared: SharedInfo } => Boolean(s.shared);

export const isHost = (s: PupuseadaState) => Boolean(s.shared && s.shared.hostUid === s.shared.myUid);

/** Mientras la mesa está abierta, cada quien edita lo suyo; el anfitrión puede editar a cualquiera siempre. */
export function canEdit(s: PupuseadaState, personId: string): boolean {
  if (!s.shared) return true;
  if (isHost(s)) return true;
  return personId === s.shared.myParticipantId && s.shared.status === 'ordering';
}

function applySnapshot(state: PupuseadaState, shared: SharedInfo, snapshot: TableSnapshot): PupuseadaState {
  const people: PersonOrder[] = snapshot.participants.map((p) => ({
    id: p.id,
    name: p.name,
    items: p.items,
    extras: p.extras,
  }));
  const meta = Object.fromEntries(snapshot.participants.map((p) => [p.id, { uid: p.uid, done: p.done }]));
  const stillThere = state.currentPersonId && people.some((p) => p.id === state.currentPersonId);
  const editingGone = !stillThere && (state.screen === 'order' || state.screen === 'personSummary');
  return {
    ...state,
    people,
    groups: pruneGroups(state.groups, people),
    restaurant: snapshot.restaurant
      ? { id: snapshot.restaurant.placeId, placeId: snapshot.restaurant.placeId, name: snapshot.restaurant.name, address: '' }
      : state.restaurant,
    shared: { ...shared, status: snapshot.status, hostUid: snapshot.hostUid, meta },
    currentPersonId: stillThere ? state.currentPersonId : null,
    screen: editingGone ? 'lobby' : state.screen,
  };
}

export function hasOrders(s: PupuseadaState): boolean {
  return s.people.some((p) => p.items.length > 0 || (p.extras?.length ?? 0) > 0);
}

const isEmptyOrder = (p: PersonOrder) => p.items.length === 0 && (p.extras?.length ?? 0) === 0;

function indexOfCurrent(s: PupuseadaState): number {
  return s.people.findIndex((p) => p.id === s.currentPersonId);
}

export function reducer(state: PupuseadaState, action: Action): PupuseadaState {
  switch (action.type) {
    case 'START':
      return { ...initialState(), screen: 'restaurant' };

    case 'GO':
      return { ...state, screen: action.screen };

    case 'SET_RESTAURANT':
      return { ...state, restaurant: action.restaurant };

    case 'RESTAURANT_DONE':
      return { ...state, screen: state.returnToFinal ? 'final' : 'people', returnToFinal: false };

    case 'SET_PEOPLE': {
      // Conserva lo que cada quien ya pidió (por ID) y descarta a quien se quitó.
      const byId = new Map(state.people.map((p) => [p.id, p]));
      const people: PersonOrder[] = action.people
        .map((d) => ({ ...d, name: d.name.trim() }))
        .filter((d) => d.name.length > 0)
        .map((d) => {
          const prev = d.id ? byId.get(d.id) : undefined;
          return prev ? { ...prev, name: d.name } : { id: d.id ?? newId(), name: d.name, items: [], extras: [] };
        });
      if (people.length === 0) return state;

      const groups = pruneGroups(state.groups, people);
      const firstPending = people.find(isEmptyOrder);
      const goToFinal = state.returnToFinal && !firstPending;
      return {
        ...state,
        people,
        groups,
        payment: { ...state.payment, step: 'price' },
        currentPersonId: goToFinal ? null : (firstPending ?? people[0]).id,
        screen: goToFinal ? 'final' : 'order',
        returnToFinal: goToFinal ? false : state.returnToFinal,
      };
    }

    case 'SAVE_ORDER': {
      if (!state.currentPersonId) return state;
      const people = state.people.map((p) =>
        p.id === state.currentPersonId ? { ...p, items: action.items, extras: action.extras } : p
      );
      if (state.shared) {
        const meta = { ...state.shared.meta, [state.currentPersonId]: { ...state.shared.meta[state.currentPersonId], done: true } };
        return {
          ...state,
          people,
          shared: { ...state.shared, meta },
          currentPersonId: null,
          returnToFinal: false,
          screen: state.returnToFinal ? 'final' : 'lobby',
        };
      }
      return { ...state, people, screen: 'personSummary' };
    }

    case 'EDIT_CURRENT':
      return { ...state, screen: 'order' };

    case 'NEXT_PERSON': {
      if (state.returnToFinal) {
        // Si quedan personas sin pedido (agregadas al editar), seguimos con ellas.
        const pending = state.people.find(isEmptyOrder);
        if (pending) return { ...state, currentPersonId: pending.id, screen: 'order' };
        return { ...state, screen: 'final', currentPersonId: null, returnToFinal: false };
      }
      const i = indexOfCurrent(state);
      const next = state.people[i + 1];
      if (!next) return { ...state, screen: 'final', currentPersonId: null };
      return { ...state, currentPersonId: next.id, screen: 'order' };
    }

    case 'ORDER_BACK': {
      if (state.shared) {
        return { ...state, screen: state.returnToFinal ? 'final' : 'lobby', currentPersonId: null, returnToFinal: false };
      }
      if (state.returnToFinal) return { ...state, screen: 'final', currentPersonId: null, returnToFinal: false };
      const i = indexOfCurrent(state);
      if (i <= 0) return { ...state, screen: 'people' };
      return { ...state, currentPersonId: state.people[i - 1].id, screen: 'personSummary' };
    }

    case 'EDIT_PERSON':
      if (!state.people.some((p) => p.id === action.personId)) return state;
      if (!canEdit(state, action.personId)) return state;
      return { ...state, currentPersonId: action.personId, screen: 'order', returnToFinal: true };

    case 'EDIT_PEOPLE':
      if (state.shared) return { ...state, screen: 'lobby', returnToFinal: false };
      return { ...state, screen: 'people', returnToFinal: true };

    case 'OPEN_BILLING':
      return { ...state, screen: 'billing' };

    case 'SET_BILLING':
      return {
        ...state,
        billing: action.billing,
        groups: action.billing === 'groups' ? pruneGroups(action.groups, state.people) : [],
        payment: { ...state.payment, step: 'price' },
        screen: 'payment',
      };

    case 'UPDATE_PAYMENT':
      return { ...state, payment: { ...state.payment, ...action.patch } };

    case 'RESET':
      return initialState();

    case 'OPEN_JOIN':
      return { ...initialState(), screen: 'join', pendingCode: action.code };

    case 'SHARED_ENTER': {
      const base: PupuseadaState = {
        ...state,
        screen: 'lobby',
        people: [],
        groups: [],
        billing: null,
        currentPersonId: null,
        returnToFinal: false,
        pendingCode: undefined,
      };
      const shared: SharedInfo = {
        pupuseadaId: action.seat.pupuseadaId,
        code: action.seat.code,
        myParticipantId: action.seat.participantId,
        myUid: action.myUid,
        hostUid: action.snapshot.hostUid,
        status: action.snapshot.status,
        meta: {},
      };
      return applySnapshot(base, shared, action.snapshot);
    }

    case 'SHARED_SYNC':
      if (!state.shared || action.snapshot.id !== state.shared.pupuseadaId) return state;
      return applySnapshot(state, state.shared, action.snapshot);

    case 'OPEN_ORDER_FOR':
      if (!state.people.some((p) => p.id === action.personId) || !canEdit(state, action.personId)) return state;
      return { ...state, currentPersonId: action.personId, screen: 'order', returnToFinal: false };

    default:
      return state;
  }
}
