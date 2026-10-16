import { describe, expect, it } from 'vitest';
import { reducer, initialState, canEdit, isHost, phoneOwnership, type Action, type PupuseadaState } from '../pupuseada';
import { accountsFor } from '@/data/consolidation';
import type { TableSnapshot } from '@/shared/backend';
import type { PupusaItem } from '@/data/pupusa';

const run = (actions: Action[], from: PupuseadaState = initialState(0, 'test')) => actions.reduce(reducer, from);
const items = (n: number): PupusaItem[] => [{ id: 'i', pupusaTypeId: 'fq', masa: 'maiz', quantity: n }];

describe('flujo de la pupuseada', () => {
  it('restaurante opcional → personas → pedido de cada quien → resumen final', () => {
    let s = run([{ type: 'START' }, { type: 'RESTAURANT_DONE' }]);
    expect(s.screen).toBe('mode');
    s = reducer(s, { type: 'GO', screen: 'people' });
    expect(s.restaurant).toBeNull();

    s = reducer(s, { type: 'SET_PEOPLE', people: [{ name: 'Ana' }, { name: ' Beto ' }] });
    expect(s.people.map((p) => p.name)).toEqual(['Ana', 'Beto']);
    expect(s.screen).toBe('order');
    expect(s.currentPersonId).toBe(s.people[0].id);

    s = run([{ type: 'SAVE_ORDER', items: items(3), extras: [] }, { type: 'NEXT_PERSON' }], s);
    expect(s.currentPersonId).toBe(s.people[1].id);
    s = run([{ type: 'SAVE_ORDER', items: items(2), extras: [] }, { type: 'NEXT_PERSON' }], s);
    expect(s.screen).toBe('final');
  });

  it('cada persona tiene un UUID distinto y estable', () => {
    const s = run([{ type: 'START' }, { type: 'SET_PEOPLE', people: [{ name: 'Ana' }, { name: 'Ana' }] }]);
    expect(new Set(s.people.map((p) => p.id)).size).toBe(2);
  });

  it('editar personas desde el final conserva lo pedido y lleva a pedir a quien llegó tarde', () => {
    let s = run([
      { type: 'START' },
      { type: 'SET_PEOPLE', people: [{ name: 'Ana' }, { name: 'Beto' }] },
      { type: 'SAVE_ORDER', items: items(3), extras: [] },
      { type: 'NEXT_PERSON' },
      { type: 'SAVE_ORDER', items: items(2), extras: [] },
      { type: 'NEXT_PERSON' },
      { type: 'EDIT_PEOPLE' },
    ]);
    const [ana, beto] = s.people;
    // Se quita a Ana (no la última) y llega Caro.
    s = reducer(s, { type: 'SET_PEOPLE', people: [{ id: beto.id, name: 'Beto' }, { name: 'Caro' }] });
    expect(s.people.map((p) => p.name)).toEqual(['Beto', 'Caro']);
    expect(s.people[0].items[0].quantity).toBe(2);
    expect(s.people.some((p) => p.id === ana.id)).toBe(false);
    expect(s.screen).toBe('order');
    expect(s.currentPersonId).toBe(s.people[1].id);

    s = run([{ type: 'SAVE_ORDER', items: items(1), extras: [] }, { type: 'NEXT_PERSON' }], s);
    expect(s.screen).toBe('final');
    expect(s.returnToFinal).toBe(false);
  });

  it('editar una persona desde el final vuelve al final', () => {
    let s = run([
      { type: 'START' },
      { type: 'SET_PEOPLE', people: [{ name: 'Ana' }, { name: 'Beto' }] },
      { type: 'SAVE_ORDER', items: items(3), extras: [] },
      { type: 'NEXT_PERSON' },
      { type: 'SAVE_ORDER', items: items(2), extras: [] },
      { type: 'NEXT_PERSON' },
    ]);
    s = reducer(s, { type: 'EDIT_PERSON', personId: s.people[0].id });
    expect(s.screen).toBe('order');
    s = run([{ type: 'SAVE_ORDER', items: items(5), extras: [] }, { type: 'NEXT_PERSON' }], s);
    expect(s.screen).toBe('final');
    expect(s.people[0].items[0].quantity).toBe(5);
  });

  it('quitar a alguien lo saca de los grupos de cuentas', () => {
    let s = run([{ type: 'START' }, { type: 'SET_PEOPLE', people: [{ name: 'Ana' }, { name: 'Beto' }] }]);
    const [ana, beto] = s.people;
    s = reducer(s, { type: 'SET_BILLING', billing: 'groups', groups: [{ id: 'g', name: 'Todos', personIds: [ana.id, beto.id] }] });
    s = run([{ type: 'EDIT_PEOPLE' }, { type: 'SET_PEOPLE', people: [{ id: beto.id, name: 'Beto' }] }], s);
    expect(s.groups[0].personIds).toEqual([beto.id]);
  });

  it('la forma de pagar se elige después del pedido', () => {
    let s = run([
      { type: 'START' },
      { type: 'SET_PEOPLE', people: [{ name: 'Ana' }] },
      { type: 'SAVE_ORDER', items: items(1), extras: [] },
      { type: 'NEXT_PERSON' },
    ]);
    expect(s.billing).toBeNull();
    s = run([{ type: 'OPEN_BILLING' }, { type: 'SET_BILLING', billing: 'single', groups: [] }], s);
    expect(s.screen).toBe('payment');
    expect(s.billing).toBe('single');
  });

  it('una lista de nombres vacía no borra a nadie', () => {
    const s = run([{ type: 'START' }, { type: 'SET_PEOPLE', people: [{ name: 'Ana' }] }]);
    expect(reducer(s, { type: 'SET_PEOPLE', people: [{ name: '  ' }] })).toBe(s);
  });
});

describe('mesa compartida', () => {
  const host = 'uid-ana';
  const guest = 'uid-beto';
  const snap = (over: Partial<TableSnapshot> = {}): TableSnapshot => ({
    id: 'mesa-1',
    code: 'K7Q2X',
    hostUid: host,
    status: 'ordering',
    restaurant: { name: 'El Comal', placeId: 'manual:el-comal' },
    billing: null,
    payment: null,
    participants: [
      { id: 'p-ana', uid: host, managedBy: host, name: 'Ana', items: [], extras: [], done: false, createdAt: '1' },
      { id: 'p-beto', uid: guest, managedBy: guest, name: 'Beto', items: items(2), extras: [], done: true, createdAt: '2' },
    ],
    ...over,
  });
  const enter = (myUid: string, me: string) =>
    reducer(initialState(0, 't'), {
      type: 'SHARED_ENTER',
      seat: { pupuseadaId: 'mesa-1', participantId: me, code: 'K7Q2X' },
      myUid,
      snapshot: snap(),
    });

  it('al entrar trae a la gente y la pupusería de la mesa', () => {
    const s = enter(guest, 'p-beto');
    expect(s.screen).toBe('lobby');
    expect(s.people.map((p) => p.name)).toEqual(['Ana', 'Beto']);
    expect(s.people[1].items[0].quantity).toBe(2);
    expect(s.restaurant?.name).toBe('El Comal');
    expect(isHost(s)).toBe(false);
  });

  it('el invitado solo puede editar lo suyo, y nada si la mesa cerró', () => {
    let s = enter(guest, 'p-beto');
    expect(canEdit(s, 'p-beto')).toBe(true);
    expect(canEdit(s, 'p-ana')).toBe(false);
    expect(reducer(s, { type: 'OPEN_ORDER_FOR', personId: 'p-ana' })).toBe(s);
    s = reducer(s, { type: 'SHARED_SYNC', snapshot: snap({ status: 'locked' }) });
    expect(canEdit(s, 'p-beto')).toBe(false);
  });

  it('el anfitrión puede editar a cualquiera, incluso con la mesa cerrada', () => {
    let s = enter(host, 'p-ana');
    s = reducer(s, { type: 'SHARED_SYNC', snapshot: snap({ status: 'locked' }) });
    expect(isHost(s)).toBe(true);
    expect(canEdit(s, 'p-beto')).toBe(true);
  });

  it('guardar mi pedido vuelve a la mesa y me marca como listo', () => {
    let s = enter(guest, 'p-beto');
    s = reducer(s, { type: 'OPEN_ORDER_FOR', personId: 'p-beto' });
    expect(s.screen).toBe('order');
    s = reducer(s, { type: 'SAVE_ORDER', items: items(4), extras: [] });
    expect(s.screen).toBe('personSummary');
    expect(s.shared?.meta['p-beto'].done).toBe(true);
    s = reducer(s, { type: 'NEXT_PERSON' });
    expect(s.screen).toBe('lobby');
  });

  it('cascada: cada teléfono pide por su gente uno tras otro y vuelve a la mesa', () => {
    // Ana todavía no pidió: al abrir la mesa le toca armar su gente.
    let s = enter(host, 'p-ana');
    expect(s.screen).toBe('people');
    const withFriend = snap({
      participants: [
        ...snap().participants,
        { id: 'p-amiga', uid: null, managedBy: host, name: 'Amiga', items: [], extras: [], done: false, createdAt: '3' },
        { id: 'p-prima', uid: null, managedBy: guest, name: 'Prima', items: [], extras: [], done: false, createdAt: '4' },
      ],
    });
    s = run([{ type: 'SHARED_SYNC', snapshot: withFriend }, { type: 'START_MY_ORDERS' }], s);
    expect(s.queue).toEqual(['p-ana', 'p-amiga']); // no incluye a la gente de Beto
    expect(s.currentPersonId).toBe('p-ana');

    s = run([{ type: 'SAVE_ORDER', items: items(2), extras: [] }, { type: 'NEXT_PERSON' }], s);
    expect(s.screen).toBe('order');
    expect(s.currentPersonId).toBe('p-amiga');
    s = reducer(s, { type: 'ORDER_BACK' });
    expect(s.screen).toBe('personSummary');
    expect(s.currentPersonId).toBe('p-ana');
    s = run([{ type: 'NEXT_PERSON' }, { type: 'SAVE_ORDER', items: items(1), extras: [] }, { type: 'NEXT_PERSON' }], s);
    expect(s.screen).toBe('lobby');
    expect(s.queue).toBeUndefined();

    // Ya pidieron todos los míos: la cascada vuelve a recorrerlos para cambiar algo.
    s = reducer(s, { type: 'START_MY_ORDERS' });
    expect(s.queue).toEqual(['p-ana', 'p-amiga']);
  });

  it('quien vuelve a entrar y ya pidió va directo a la mesa', () => {
    expect(enter(guest, 'p-beto').screen).toBe('lobby');
  });

  it('si quitan a quien estaba editando, vuelve a la mesa', () => {
    let s = enter(host, 'p-ana');
    s = reducer(s, { type: 'OPEN_ORDER_FOR', personId: 'p-beto' });
    s = reducer(s, { type: 'SHARED_SYNC', snapshot: snap({ participants: snap().participants.slice(0, 1) }) });
    expect(s.screen).toBe('lobby');
    expect(s.currentPersonId).toBeNull();
  });

  it('ignora cambios de otra mesa', () => {
    const s = enter(guest, 'p-beto');
    expect(reducer(s, { type: 'SHARED_SYNC', snapshot: snap({ id: 'otra' }) })).toBe(s);
  });
});

describe('cuentas por teléfono y cuentas compartidas', () => {
  const host = 'uid-javier';
  const primo = 'uid-primo';
  const p = (id: string, name: string, uid: string | null, managedBy: string, n: number) => ({
    id, uid, managedBy, name, items: items(n), extras: [], done: true, createdAt: id,
  });
  const snapshot = (over: Partial<TableSnapshot> = {}): TableSnapshot => ({
    id: 'mesa',
    code: 'ABCDE',
    hostUid: host,
    status: 'locked',
    restaurant: null,
    billing: null,
    payment: null,
    participants: [
      p('1', 'Javier', host, host, 2),
      p('2', 'Amiga', null, host, 1),
      p('3', 'Primo', primo, primo, 3),
      p('4', 'Prima', null, primo, 2),
      p('5', 'Tío', null, primo, 1),
    ],
    ...over,
  });
  const enter = (myUid: string, me: string, snap = snapshot()) =>
    reducer(initialState(0, 't'), {
      type: 'SHARED_ENTER',
      seat: { pupuseadaId: 'mesa', participantId: me, code: 'ABCDE' },
      myUid,
      snapshot: snap,
    });

  it('arma una cuenta por teléfono con su gente: 2 y 3 personas', () => {
    const s = enter(host, '1');
    const groups = accountsFor('byPhone', s.people, [], phoneOwnership(s));
    expect(groups.map((g) => [g.name, g.personIds.length])).toEqual([
      ['Cuenta de Javier', 2],
      ['Cuenta de Primo', 3],
    ]);
  });

  it('el primo puede pedir por los suyos pero no por la amiga de Javier', () => {
    const s = enter(primo, '3', snapshot({ status: 'ordering' }));
    expect(canEdit(s, '4')).toBe(true);
    expect(canEdit(s, '2')).toBe(false);
  });

  it('el invitado ve las cuentas que publicó el anfitrión, no las propias', () => {
    const published = snapshot({
      billing: { method: 'byPhone', groups: [] },
      payment: { priceInputs: {}, uniformPrice: true, uniformInput: '0.75', hasTip: false, tipInput: '', published: true },
    });
    let s = enter(primo, '3', snapshot());
    s = reducer(s, { type: 'UPDATE_PAYMENT', patch: { uniformPrice: true, uniformInput: '0.10' } });
    s = reducer(s, { type: 'SHARED_SYNC', snapshot: published });
    expect(s.billing).toBe('byPhone');
    expect(s.payment.uniformInput).toBe('0.75');
    expect(s.payment.step).toBe('result');
    expect(s.shared?.accountsPublished).toBe(true);
  });

  it('el anfitrión no pierde lo que está escribiendo cuando llega una sincronización', () => {
    let s = enter(host, '1');
    s = reducer(s, { type: 'SET_BILLING', billing: 'byPhone', groups: [] });
    s = reducer(s, { type: 'UPDATE_PAYMENT', patch: { uniformInput: '0.80' } });
    s = reducer(s, {
      type: 'SHARED_SYNC',
      snapshot: snapshot({ billing: { method: 'single', groups: [] }, payment: { priceInputs: {}, uniformPrice: true, uniformInput: '0.75', hasTip: false, tipInput: '', published: true } }),
    });
    expect(s.billing).toBe('byPhone');
    expect(s.payment.uniformInput).toBe('0.80');
  });
});
