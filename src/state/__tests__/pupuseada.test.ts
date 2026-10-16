import { describe, expect, it } from 'vitest';
import { reducer, initialState, canEdit, isHost, type Action, type PupuseadaState } from '../pupuseada';
import type { TableSnapshot } from '@/shared/backend';
import type { PupusaItem } from '@/data/pupusa';

const run = (actions: Action[], from: PupuseadaState = initialState(0, 'test')) => actions.reduce(reducer, from);
const items = (n: number): PupusaItem[] => [{ id: 'i', pupusaTypeId: 'fq', masa: 'maiz', quantity: n }];

describe('flujo de la pupuseada', () => {
  it('restaurante opcional → personas → pedido de cada quien → resumen final', () => {
    let s = run([{ type: 'START' }, { type: 'RESTAURANT_DONE' }]);
    expect(s.screen).toBe('people');
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
    participants: [
      { id: 'p-ana', uid: host, name: 'Ana', items: [], extras: [], done: false, createdAt: '1' },
      { id: 'p-beto', uid: guest, name: 'Beto', items: items(2), extras: [], done: true, createdAt: '2' },
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
    expect(s.screen).toBe('lobby');
    expect(s.shared?.meta['p-beto'].done).toBe(true);
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
