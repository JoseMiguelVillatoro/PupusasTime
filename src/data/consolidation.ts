import {
  MasaType,
  PupusaTypeId,
  PUPUSA_BY_ID,
  MASA_LABEL,
  MASA_EMOJI,
  PersonOrder,
  AccountGroup,
} from './pupusa';

export interface ConsolidatedEntry {
  pupusaTypeId: PupusaTypeId;
  code: string;
  name: string;
  quantity: number;
}

export interface ConsolidatedOrder {
  maiz: ConsolidatedEntry[];
  arroz: ConsolidatedEntry[];
  total: number;
}

export function consolidateOrders(orders: PersonOrder[]): ConsolidatedOrder {
  const buckets: Record<MasaType, Partial<Record<PupusaTypeId, number>>> = {
    maiz: {},
    arroz: {},
  };
  let total = 0;

  for (const person of orders) {
    for (const item of person.items) {
      if (item.quantity <= 0) continue;
      buckets[item.masa][item.pupusaTypeId] =
        (buckets[item.masa][item.pupusaTypeId] || 0) + item.quantity;
      total += item.quantity;
    }
  }

  const buildEntries = (bucket: Partial<Record<PupusaTypeId, number>>): ConsolidatedEntry[] =>
    Object.entries(bucket)
      .map(([typeId, quantity]) => {
        const t = PUPUSA_BY_ID[typeId as PupusaTypeId];
        return {
          pupusaTypeId: t.id,
          code: t.code,
          name: t.name,
          quantity,
        };
      })
      .sort((a, b) => b.quantity - a.quantity);

  return {
    maiz: buildEntries(buckets.maiz),
    arroz: buildEntries(buckets.arroz),
    total,
  };
}

/**
 * Las personas se identifican por posición (`p0`, `p1`, …). Antes también se
 * buscaba por nombre, lo que rompía si alguien se llamaba literalmente "p1".
 */
export function personIdFor(index: number): string {
  return `p${index}`;
}

export function resolvePersonIndex(personId: string): number {
  const m = /^p(\d+)$/.exec(personId);
  return m ? Number(m[1]) : -1;
}

export function groupOrders(g: AccountGroup, orders: PersonOrder[]): PersonOrder[] {
  return g.personIds
    .map((pid) => orders[resolvePersonIndex(pid)])
    .filter((o): o is PersonOrder => Boolean(o));
}

export function groupPersonNames(g: AccountGroup, peopleNames: string[]): string[] {
  return g.personIds
    .map(resolvePersonIndex)
    .filter((idx) => idx >= 0 && idx < peopleNames.length)
    .map((idx) => peopleNames[idx] || `Persona ${idx + 1}`);
}

/** Quita de los grupos a personas que ya no existen (p. ej. si bajaron el número de personas). */
export function pruneGroups(groups: AccountGroup[], peopleCount: number): AccountGroup[] {
  return groups.map((g) => ({
    ...g,
    personIds: g.personIds.filter((pid) => {
      const idx = resolvePersonIndex(pid);
      return idx >= 0 && idx < peopleCount;
    }),
  }));
}

export function personTotal(order: PersonOrder): number {
  return order.items.reduce((sum, i) => sum + (i.quantity > 0 ? i.quantity : 0), 0);
}

export function generateOrderText(
  restaurantName: string | null,
  consolidated: ConsolidatedOrder,
  people: PersonOrder[],
  groups?: AccountGroup[],
  peopleNames?: string[]
): string {
  const lines: string[] = ['🫓 PUPUSAS'];

  if (restaurantName) {
    lines.push(`📍 ${restaurantName}`);
    lines.push('');
  }

  if (consolidated.maiz.length > 0) {
    lines.push('🌽 MAÍZ');
    for (const e of consolidated.maiz) {
      lines.push(`${e.quantity} ${e.code}`);
    }
  }

  if (consolidated.arroz.length > 0) {
    lines.push('');
    lines.push('🍚 ARROZ');
    for (const e of consolidated.arroz) {
      lines.push(`${e.quantity} ${e.code}`);
    }
  }

  lines.push('');
  lines.push(`TOTAL: ${consolidated.total} PUPUSAS`);

  if (groups && groups.length > 0) {
    lines.push('');
    lines.push('═════════════════');
    lines.push('CUENTAS');
    for (const g of groups) {
      const gc = consolidateOrders(groupOrders(g, people));
      const names = groupPersonNames(g, peopleNames ?? people.map((p) => p.name));

      lines.push('');
      lines.push(`CUENTA: ${g.name}`);
      lines.push(`Personas: ${names.join(', ')}`);
      lines.push(`Total: ${gc.total} pupusas`);

      if (gc.maiz.length > 0) {
        const maizTotal = gc.maiz.reduce((s, e) => s + e.quantity, 0);
        lines.push(`MAÍZ · ${maizTotal}`);
        for (const e of gc.maiz) {
          lines.push(`${e.code} × ${e.quantity}`);
        }
      }
      if (gc.arroz.length > 0) {
        const arrozTotal = gc.arroz.reduce((s, e) => s + e.quantity, 0);
        lines.push(`ARROZ · ${arrozTotal}`);
        for (const e of gc.arroz) {
          lines.push(`${e.code} × ${e.quantity}`);
        }
      }
    }
  }

  return lines.join('\n');
}

export { MASA_LABEL, MASA_EMOJI };

/** Montos en centavos enteros: nunca hacemos aritmética de dinero en float. */
export type Cents = number;

export function toCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

export interface AccountBreakdown {
  groupId: string;
  groupName: string;
  personNames: string[];
  totalPupusas: number;
  maiz: ConsolidatedEntry[];
  arroz: ConsolidatedEntry[];
  subtotal: Cents;
  tip: Cents;
  total: Cents;
}

export interface PaymentResult {
  accounts: AccountBreakdown[];
  generalSubtotal: Cents;
  generalTip: Cents;
  generalTotal: Cents;
  priceCentsByType: Record<string, Cents>;
  tipPercent: number;
}

export function lineCents(e: ConsolidatedEntry, priceCentsByType: Record<string, Cents>): Cents {
  return e.quantity * (priceCentsByType[e.pupusaTypeId] || 0);
}

export function entriesCents(entries: ConsolidatedEntry[], priceCentsByType: Record<string, Cents>): Cents {
  return entries.reduce((s, e) => s + lineCents(e, priceCentsByType), 0);
}

/**
 * Reparte `total` centavos entre cuentas en proporción a `weights`, usando el
 * método del mayor residuo: la suma siempre cuadra exacto y nadie absorbe más
 * de 1¢ de diferencia por redondeo.
 */
export function distributeProportionally(total: Cents, weights: Cents[]): Cents[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || weightSum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (w * total) / weightSum);
  const shares = exact.map(Math.floor);
  let leftover = total - shares.reduce((s, x) => s + x, 0);

  const byRemainder = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; leftover > 0; k++, leftover--) {
    shares[byRemainder[k % byRemainder.length].i] += 1;
  }
  return shares;
}

export function calculatePayment(
  orders: PersonOrder[],
  groups: AccountGroup[],
  peopleNames: string[],
  priceByType: Record<string, number>,
  tipPercent: number
): PaymentResult {
  const priceCentsByType: Record<string, Cents> = {};
  for (const [id, dollars] of Object.entries(priceByType)) {
    priceCentsByType[id] = toCents(dollars);
  }

  const accounts: AccountBreakdown[] = groups.map((g) => {
    const gc = consolidateOrders(groupOrders(g, orders));
    const subtotal = entriesCents([...gc.maiz, ...gc.arroz], priceCentsByType);
    return {
      groupId: g.id,
      groupName: g.name,
      personNames: groupPersonNames(g, peopleNames),
      totalPupusas: gc.total,
      maiz: gc.maiz,
      arroz: gc.arroz,
      subtotal,
      tip: 0,
      total: subtotal,
    };
  });

  const generalSubtotal = accounts.reduce((s, a) => s + a.subtotal, 0);
  const safeTipPercent = Number.isFinite(tipPercent) && tipPercent > 0 ? tipPercent : 0;
  const generalTip = Math.round((generalSubtotal * safeTipPercent) / 100);

  const tips = distributeProportionally(generalTip, accounts.map((a) => a.subtotal));
  accounts.forEach((a, i) => {
    a.tip = tips[i];
    a.total = a.subtotal + a.tip;
  });

  return {
    accounts,
    generalSubtotal,
    generalTip,
    generalTotal: generalSubtotal + generalTip,
    priceCentsByType,
    tipPercent: safeTipPercent,
  };
}

export function formatCurrency(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function generatePaymentText(
  restaurantName: string | null,
  payment: PaymentResult
): string {
  const lines: string[] = ['🫓 PUPUSAS TIME'];

  if (restaurantName) {
    lines.push(`📍 ${restaurantName}`);
  }

  for (const a of payment.accounts) {
    lines.push('');
    lines.push(`Cuenta ${a.groupName}`);
    lines.push(`${a.personNames.length} ${a.personNames.length === 1 ? 'persona' : 'personas'}: ${a.personNames.join(', ')}`);
    lines.push(`${a.totalPupusas} pupusas`);

    if (a.maiz.length > 0) {
      const maizTotal = a.maiz.reduce((s, e) => s + e.quantity, 0);
      const maizCost = entriesCents(a.maiz, payment.priceCentsByType);
      lines.push('');
      lines.push(`🌽 Maíz · ${maizTotal}`);
      for (const e of a.maiz) {
        lines.push(`${e.code} × ${e.quantity} = ${formatCurrency(lineCents(e, payment.priceCentsByType))}`);
      }
      lines.push(`Total Maíz: ${formatCurrency(maizCost)}`);
    }
    if (a.arroz.length > 0) {
      const arrozTotal = a.arroz.reduce((s, e) => s + e.quantity, 0);
      const arrozCost = entriesCents(a.arroz, payment.priceCentsByType);
      lines.push('');
      lines.push(`🍚 Arroz · ${arrozTotal}`);
      for (const e of a.arroz) {
        lines.push(`${e.code} × ${e.quantity} = ${formatCurrency(lineCents(e, payment.priceCentsByType))}`);
      }
      lines.push(`Total Arroz: ${formatCurrency(arrozCost)}`);
    }

    lines.push('');
    lines.push(`Subtotal: ${formatCurrency(a.subtotal)}`);
    lines.push(`Propina: ${formatCurrency(a.tip)}`);
    lines.push(`TOTAL: ${formatCurrency(a.total)}`);
  }

  lines.push('');
  lines.push('RESUMEN GENERAL');
  lines.push(`Subtotal: ${formatCurrency(payment.generalSubtotal)}`);
  lines.push(`Propina: ${formatCurrency(payment.generalTip)}`);
  lines.push(`TOTAL: ${formatCurrency(payment.generalTotal)}`);

  return lines.join('\n');
}
