import { describe, expect, it } from 'vitest';
import {
  accountsFor,
  calculatePayment,
  consolidateExtras,
  consolidateOrders,
  distributeProportionally,
  formatCurrency,
  generateOrderText,
  generateShareText,
  groupPersonNames,
  parseMoney,
  pruneGroups,
  whatsappShareUrl,
} from '../consolidation';
import type { AccountGroup, PersonOrder, PupusaTypeId, MasaType, ExtraItem } from '../pupusa';

const order = (
  id: string,
  items: Array<[PupusaTypeId, MasaType, number]>,
  extras: Array<[string, number, number]> = []
): PersonOrder => ({
  id,
  name: id,
  items: items.map(([pupusaTypeId, masa, quantity], i) => ({ id: `${id}-${i}`, pupusaTypeId, masa, quantity })),
  extras: extras.map(([label, priceCents, quantity], i): ExtraItem => ({ id: `${id}-x${i}`, label, priceCents, quantity })),
});

const orders = [
  order('Ana', [['fq', 'maiz', 3]]),
  order('Beto', [['fq', 'maiz', 2]]),
  order('Caro', [['revuelta', 'arroz', 4]]),
];
const splitGroups = accountsFor('split', orders, []);
const prices = { fq: 75, revuelta: 90 };

describe('consolidateOrders', () => {
  it('agrupa por masa y tipo, e ignora cantidades <= 0', () => {
    const c = consolidateOrders([...orders, order('Dani', [['fq', 'maiz', 0]])]);
    expect(c.total).toBe(9);
    expect(c.maiz).toEqual([{ pupusaTypeId: 'fq', code: 'F/Q', name: 'Frijol con Queso', quantity: 5 }]);
    expect(c.arroz[0].quantity).toBe(4);
  });
});

describe('consolidateExtras', () => {
  it('junta por nombre sin importar mayúsculas ni tildes', () => {
    const x = consolidateExtras([
      order('Ana', [], [['Horchata', 100, 1]]),
      order('Beto', [], [['horchata ', 100, 2], ['Café', 75, 1]]),
      order('Caro', [], [['cafe', 75, 1]]),
    ]);
    expect(x).toEqual([
      { label: 'Horchata', quantity: 3, cents: 300 },
      { label: 'Café', quantity: 2, cents: 150 },
    ]);
  });
});

describe('parseMoney', () => {
  it('acepta formatos comunes y rechaza basura', () => {
    expect(parseMoney('0.75')).toBe(75);
    expect(parseMoney('0,75')).toBe(75);
    expect(parseMoney('$1')).toBe(100);
    expect(parseMoney(' 1.5 ')).toBe(150);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('')).toBeNull();
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
    const r = calculatePayment(orders, splitGroups, prices, 10);
    expect(r.accounts.map((a) => a.subtotal)).toEqual([225, 150, 360]);
    expect(r.generalTip).toBe(74);
    expect(r.accounts.map((a) => a.tip)).toEqual([23, 15, 36]);
    expect(r.accounts.reduce((s, a) => s + a.total, 0)).toBe(r.generalTotal);
    expect(r.generalTotal).toBe(809);
  });

  it('incluye bebidas y extras en el subtotal y en la base de la propina', () => {
    const withDrinks = [
      order('Ana', [['fq', 'maiz', 4]], [['Horchata', 100, 1]]),
      order('Beto', [['fq', 'maiz', 4]]),
      order('Caro', [['fq', 'maiz', 5]], [['Café', 75, 1]]),
    ];
    const r = calculatePayment(withDrinks, accountsFor('split', withDrinks, []), { fq: 75 }, 10);
    expect(r.accounts.map((a) => a.extrasSubtotal)).toEqual([100, 0, 75]);
    expect(r.accounts.map((a) => a.subtotal)).toEqual([400, 300, 450]);
    expect(r.generalSubtotal).toBe(1150);
    expect(r.generalTip).toBe(115);
    expect(r.generalTotal).toBe(1265);
    expect(r.accounts.reduce((s, a) => s + a.total, 0)).toBe(1265);
  });

  it('no arrastra errores de float (0.35 × 3)', () => {
    const one = [order('Ana', [['queso', 'maiz', 3]])];
    const r = calculatePayment(one, accountsFor('single', one, []), { queso: 35 }, 0);
    expect(r.generalSubtotal).toBe(105);
    expect(formatCurrency(r.generalTotal)).toBe('$1.05');
  });

  it('sin propina o con propina inválida, la propina es 0', () => {
    expect(calculatePayment(orders, splitGroups, prices, 0).generalTip).toBe(0);
    expect(calculatePayment(orders, splitGroups, prices, NaN).generalTip).toBe(0);
  });

  it('cuenta única suma todo', () => {
    const r = calculatePayment(orders, accountsFor('single', orders, []), prices, 10);
    expect(r.accounts[0].subtotal).toBe(735);
    expect(r.accounts[0].tip).toBe(74);
  });
});

describe('identificación de personas por ID', () => {
  it('los nombres nunca se confunden con IDs', () => {
    const people = [order('p1', []), order('Beto', [])];
    const g: AccountGroup = { id: 'g', name: 'G', personIds: ['p1'] };
    expect(groupPersonNames(g, people)).toEqual(['p1']);
  });

  it('pruneGroups quita personas que ya no están', () => {
    const g: AccountGroup[] = [{ id: 'g', name: 'G', personIds: ['Ana', 'Caro', 'Zoe'] }];
    expect(pruneGroups(g, orders)[0].personIds).toEqual(['Ana', 'Caro']);
  });
});

describe('textos para compartir', () => {
  it('el pedido para la mesera incluye pupusas y bebidas', () => {
    const people = [order('Ana', [['fq', 'maiz', 3]], [['Horchata', 100, 2]]), ...orders.slice(1)];
    const text = generateOrderText('Pupusería X', consolidateOrders(people), people);
    expect(text).toContain('📍 Pupusería X');
    expect(text).toContain('5 F/Q');
    expect(text).toContain('TOTAL: 9 PUPUSAS');
    expect(text).toContain('2 Horchata');
  });

  it('el mensaje de WhatsApp lista cuánto paga cada cuenta', () => {
    const r = calculatePayment(orders, splitGroups, prices, 10);
    const text = generateShareText('El Comal', r);
    expect(text).toContain('Ana: $2.48');
    expect(text).toContain('Total de la mesa: $8.09 (propina 10% incluida)');
    expect(whatsappShareUrl(text)).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});
