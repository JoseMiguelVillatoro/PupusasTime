import { describe, expect, it } from 'vitest';
import {
  calculatePayment,
  consolidateOrders,
  distributeProportionally,
  formatCurrency,
  generateOrderText,
  groupPersonNames,
  pruneGroups,
  resolvePersonIndex,
} from '../consolidation';
import type { AccountGroup, PersonOrder, PupusaTypeId, MasaType } from '../pupusa';

const order = (
  name: string,
  items: Array<[PupusaTypeId, MasaType, number]>
): PersonOrder => ({
  id: name,
  name,
  items: items.map(([pupusaTypeId, masa, quantity], i) => ({
    id: `${name}-${i}`,
    pupusaTypeId,
    masa,
    quantity,
  })),
});

const people = ['Ana', 'Beto', 'Caro'];
const orders = [
  order('Ana', [['fq', 'maiz', 3]]),
  order('Beto', [['fq', 'maiz', 2]]),
  order('Caro', [['revuelta', 'arroz', 4]]),
];
const splitGroups: AccountGroup[] = people.map((n, i) => ({ id: `g${i}`, name: n, personIds: [`p${i}`] }));

describe('consolidateOrders', () => {
  it('agrupa por masa y tipo, e ignora cantidades <= 0', () => {
    const c = consolidateOrders([...orders, order('Dani', [['fq', 'maiz', 0]])]);
    expect(c.total).toBe(9);
    expect(c.maiz).toEqual([{ pupusaTypeId: 'fq', code: 'F/Q', name: 'Frijol con Queso', quantity: 5 }]);
    expect(c.arroz[0].quantity).toBe(4);
  });
});

describe('distributeProportionally', () => {
  it('siempre suma exactamente el total', () => {
    for (const [total, weights] of [
      [100, [1, 1, 1]],
      [68, [225, 150, 300]],
      [1, [5, 5]],
      [997, [333, 333, 334]],
    ] as Array<[number, number[]]>) {
      const shares = distributeProportionally(total, weights);
      expect(shares.reduce((s, x) => s + x, 0)).toBe(total);
      shares.forEach((x) => expect(Number.isInteger(x)).toBe(true));
    }
  });

  it('nadie se aleja más de 1¢ de su parte exacta', () => {
    const weights = [225, 150, 300];
    const shares = distributeProportionally(68, weights);
    shares.forEach((x, i) => expect(Math.abs(x - (weights[i] * 68) / 675)).toBeLessThan(1));
  });

  it('devuelve ceros si no hay nada que repartir', () => {
    expect(distributeProportionally(0, [1, 2])).toEqual([0, 0]);
    expect(distributeProportionally(50, [0, 0])).toEqual([0, 0]);
  });
});

describe('calculatePayment', () => {
  it('reparte la propina proporcionalmente (regresión: antes la pagaba solo el último)', () => {
    const r = calculatePayment(orders, splitGroups, people, { fq: 0.75, revuelta: 0.9 }, 10);
    // Ana 3×0.75=2.25, Beto 2×0.75=1.50, Caro 4×0.90=3.60 → 7.35, propina 10% = 0.74
    expect(r.accounts.map((a) => a.subtotal)).toEqual([225, 150, 360]);
    expect(r.generalTip).toBe(74);
    expect(r.accounts.map((a) => a.tip)).toEqual([23, 15, 36]);
    expect(r.accounts.every((a) => a.tip > 0)).toBe(true);
    expect(r.accounts.reduce((s, a) => s + a.total, 0)).toBe(r.generalTotal);
    expect(r.generalTotal).toBe(809);
  });

  it('no arrastra errores de float (0.35 × 3)', () => {
    const r = calculatePayment([order('Ana', [['queso', 'maiz', 3]])], [splitGroups[0]], people, { queso: 0.35 }, 0);
    expect(r.generalSubtotal).toBe(105);
    expect(formatCurrency(r.generalTotal)).toBe('$1.05');
  });

  it('sin propina o con propina inválida, la propina es 0', () => {
    expect(calculatePayment(orders, splitGroups, people, { fq: 1, revuelta: 1 }, 0).generalTip).toBe(0);
    expect(calculatePayment(orders, splitGroups, people, { fq: 1, revuelta: 1 }, NaN).generalTip).toBe(0);
  });

  it('cuenta única suma todo', () => {
    const single: AccountGroup[] = [{ id: 's', name: 'Cuenta única', personIds: ['p0', 'p1', 'p2'] }];
    const r = calculatePayment(orders, single, people, { fq: 0.75, revuelta: 0.9 }, 10);
    expect(r.accounts[0].subtotal).toBe(735);
    expect(r.accounts[0].tip).toBe(74);
  });
});

describe('identificación de personas', () => {
  it('no se confunde con nombres que parecen ids', () => {
    const names = ['p1', 'Beto'];
    const g: AccountGroup = { id: 'g', name: 'G', personIds: ['p0'] };
    expect(groupPersonNames(g, names)).toEqual(['p1']);
    expect(resolvePersonIndex('Ana')).toBe(-1);
  });

  it('pruneGroups quita personas que ya no existen', () => {
    const g: AccountGroup[] = [{ id: 'g', name: 'G', personIds: ['p0', 'p2', 'p3'] }];
    expect(pruneGroups(g, 2)[0].personIds).toEqual(['p0']);
  });
});

describe('generateOrderText', () => {
  it('incluye totales y el desglose por cuenta', () => {
    const c = consolidateOrders(orders);
    const text = generateOrderText('Pupusería X', c, orders, splitGroups, people);
    expect(text).toContain('📍 Pupusería X');
    expect(text).toContain('5 F/Q');
    expect(text).toContain('TOTAL: 9 PUPUSAS');
    expect(text).toContain('CUENTA: Caro');
    expect(text).not.toContain('Persona ');
  });
});
