import {
  SharedError,
  normalizeCode,
  type OrderPatch,
  type SharedBackend,
  type SharedParticipant,
  type TableSnapshot,
} from './backend';

/**
 * Backend simulado para desarrollo y pruebas: guarda las mesas en
 * localStorage y avisa a las otras pestañas con BroadcastChannel, así dos
 * pestañas del mismo navegador se comportan como dos teléfonos. Copia las
 * reglas de permisos de la base de datos real para que la UI se pruebe igual.
 */

interface Db {
  tables: Record<string, Omit<TableSnapshot, 'participants'> & { createdAt: number }>;
  participants: Record<string, SharedParticipant & { pupuseadaId: string }>;
}

const DB_KEY = 'pupusastime:fake-db';
const UID_KEY = 'pupusastime:fake-uid';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pupusastime-fake') : null;
const listeners = new Set<() => void>();

const read = (): Db => {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) ?? '') as Db;
  } catch {
    return { tables: {}, participants: {} };
  }
};

const write = (db: Db) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  channel?.postMessage('changed');
  listeners.forEach((l) => l());
};

channel?.addEventListener('message', () => listeners.forEach((l) => l()));

const id = () => crypto.randomUUID();
const delay = () => new Promise((r) => setTimeout(r, 30));

/** Cada pestaña es un "teléfono" distinto. */
function uid(): string {
  let u = sessionStorage.getItem(UID_KEY);
  if (!u) {
    u = id();
    sessionStorage.setItem(UID_KEY, u);
  }
  return u;
}

function isMember(db: Db, tableId: string, u: string) {
  const t = db.tables[tableId];
  return Boolean(t) && (t.hostUid === u || Object.values(db.participants).some((p) => p.pupuseadaId === tableId && p.uid === u));
}

function seatFor(db: Db, tableId: string, participantId: string) {
  return { pupuseadaId: tableId, participantId, code: db.tables[tableId].code };
}

export const memoryBackend: SharedBackend = {
  async ensureUser() {
    return uid();
  },

  async createTable(hostName, restaurant) {
    await delay();
    const db = read();
    let code = '';
    do {
      code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    } while (Object.values(db.tables).some((t) => t.code === code));
    const tableId = id();
    db.tables[tableId] = { id: tableId, code, hostUid: uid(), status: 'ordering', restaurant, createdAt: Date.now() };
    const pid = id();
    db.participants[pid] = {
      id: pid, pupuseadaId: tableId, uid: uid(), name: hostName.trim(), items: [], extras: [], done: false,
      createdAt: new Date().toISOString(),
    };
    write(db);
    return seatFor(db, tableId, pid);
  },

  async joinTable(rawCode, name) {
    await delay();
    const db = read();
    const table = Object.values(db.tables).find((t) => t.code === normalizeCode(rawCode));
    if (!table) throw new SharedError('No encontramos esa mesa. Revisá el código.');
    const mine = Object.values(db.participants).find((p) => p.pupuseadaId === table.id && p.uid === uid());
    if (mine) return seatFor(db, table.id, mine.id);
    if (table.status !== 'ordering') throw new SharedError('Esta mesa ya cerró el pedido');
    const pid = id();
    db.participants[pid] = {
      id: pid, pupuseadaId: table.id, uid: uid(), name: name.trim(), items: [], extras: [], done: false,
      createdAt: new Date().toISOString(),
    };
    write(db);
    return seatFor(db, table.id, pid);
  },

  async loadTable(tableId) {
    await delay();
    const db = read();
    const t = db.tables[tableId];
    if (!t || !isMember(db, tableId, uid())) throw new SharedError('Esta mesa ya no existe o no tenés acceso.');
    const participants = Object.values(db.participants)
      .filter((p) => p.pupuseadaId === tableId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((p) => ({ id: p.id, uid: p.uid, name: p.name, items: p.items, extras: p.extras, done: p.done, createdAt: p.createdAt }));
    return { id: t.id, code: t.code, hostUid: t.hostUid, status: t.status, restaurant: t.restaurant, participants };
  },

  async saveOrder(participantId, patch: OrderPatch) {
    await delay();
    const db = read();
    const p = db.participants[participantId];
    if (!p) throw new SharedError('No se pudo guardar tu pedido. Probá de nuevo.');
    const t = db.tables[p.pupuseadaId];
    const allowed = t.hostUid === uid() || (p.uid === uid() && t.status === 'ordering');
    if (!allowed) throw new SharedError('El pedido ya está cerrado: pedile al anfitrión que lo cambie.');
    db.participants[participantId] = { ...p, ...patch };
    write(db);
  },

  async addOffline(tableId, name) {
    await delay();
    const db = read();
    if (db.tables[tableId]?.hostUid !== uid()) throw new SharedError('No pudimos agregar a esa persona.');
    const pid = id();
    db.participants[pid] = {
      id: pid, pupuseadaId: tableId, uid: null, name: name.trim(), items: [], extras: [], done: false,
      createdAt: new Date().toISOString(),
    };
    write(db);
    return pid;
  },

  async removeParticipant(participantId) {
    await delay();
    const db = read();
    const p = db.participants[participantId];
    if (!p) return;
    if (db.tables[p.pupuseadaId]?.hostUid !== uid() && p.uid !== uid()) throw new SharedError('No pudimos quitar a esa persona.');
    delete db.participants[participantId];
    write(db);
  },

  async setStatus(tableId, status) {
    await delay();
    const db = read();
    if (db.tables[tableId]?.hostUid !== uid()) throw new SharedError('No pudimos cambiar el estado de la mesa.');
    db.tables[tableId].status = status;
    write(db);
  },

  subscribe(_tableId, onChange) {
    listeners.add(onChange);
    queueMicrotask(onChange);
    return () => listeners.delete(onChange);
  },
};
