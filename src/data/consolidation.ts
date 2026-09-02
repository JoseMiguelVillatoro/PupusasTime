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
      const gOrders: PersonOrder[] = [];
      for (const pid of g.personIds) {
        const idx = peopleNames && peopleNames.indexOf(pid) >= 0
          ? peopleNames.indexOf(pid)
          : parseInt(pid.slice(1));
        const o = people[idx];
        if (o) gOrders.push(o);
      }
      const gc = consolidateOrders(gOrders);
      const names = g.personIds.map((pid) => {
        const idx = peopleNames && peopleNames.indexOf(pid) >= 0
          ? peopleNames.indexOf(pid)
          : parseInt(pid.slice(1));
        return (peopleNames && peopleNames[idx]) || `Persona ${idx + 1}`;
      });

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

export interface AccountBreakdown {
  groupId: string;
  groupName: string;
  personNames: string[];
  totalPupusas: number;
  maiz: ConsolidatedEntry[];
  arroz: ConsolidatedEntry[];
  subtotal: number;
  tip: number;
  total: number;
}

export interface PaymentResult {
  accounts: AccountBreakdown[];
  generalSubtotal: number;
  generalTip: number;
  generalTotal: number;
  priceByType: Record<string, number>;
  tipPercent: number;
}

export function calculatePayment(
  orders: PersonOrder[],
  groups: AccountGroup[],
  peopleNames: string[],
  priceByType: Record<string, number>,
  tipPercent: number
): PaymentResult {
  const lineCost = (e: ConsolidatedEntry) => e.quantity * (priceByType[e.pupusaTypeId] || 0);
  const accounts: AccountBreakdown[] = groups.map((g) => {
    const gOrders: PersonOrder[] = [];
    for (const pid of g.personIds) {
      const idx = peopleNames.indexOf(pid) >= 0 ? peopleNames.indexOf(pid) : parseInt(pid.slice(1));
      const o = orders[idx];
      if (o) gOrders.push(o);
    }
    const gc = consolidateOrders(gOrders);
    const subtotal = [...gc.maiz, ...gc.arroz].reduce((s, e) => s + lineCost(e), 0);
    const names = g.personIds.map((pid) => {
      const idx = peopleNames.indexOf(pid) >= 0 ? peopleNames.indexOf(pid) : parseInt(pid.slice(1));
      return peopleNames[idx] || `Persona ${idx + 1}`;
    });
    return {
      groupId: g.id,
      groupName: g.name,
      personNames: names,
      totalPupusas: gc.total,
      maiz: gc.maiz,
      arroz: gc.arroz,
      subtotal,
      tip: 0,
      total: subtotal,
    };
  });

  const generalSubtotal = accounts.reduce((s, a) => s + a.subtotal, 0);
  const generalTip = Math.round(generalSubtotal * tipPercent) / 100;

  // Distribute tip proportionally, rounding to cents
  let tipRemaining = generalTip;
  accounts.forEach((a, i) => {
    if (i === accounts.length - 1) {
      a.tip = tipRemaining;
    } else {
      const t = Math.round((a.subtotal / generalSubtotal) * generalTip);
      a.tip = t;
      tipRemaining -= t;
    }
    a.total = a.subtotal + a.tip;
  });

  const generalTotal = generalSubtotal + generalTip;

  return { accounts, generalSubtotal, generalTip, generalTotal, priceByType, tipPercent };
}

export function formatCurrency(amount: number): string {
  return '$' + amount.toFixed(2);
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
      const maizCost = a.maiz.reduce((s, e) => s + e.quantity * (payment.priceByType[e.pupusaTypeId] || 0), 0);
      lines.push('');
      lines.push(`🌽 Maíz · ${maizTotal}`);
      for (const e of a.maiz) {
        lines.push(`${e.code} × ${e.quantity} = ${formatCurrency(e.quantity * (payment.priceByType[e.pupusaTypeId] || 0))}`);
      }
      lines.push(`Total Maíz: ${formatCurrency(maizCost)}`);
    }
    if (a.arroz.length > 0) {
      const arrozTotal = a.arroz.reduce((s, e) => s + e.quantity, 0);
      const arrozCost = a.arroz.reduce((s, e) => s + e.quantity * (payment.priceByType[e.pupusaTypeId] || 0), 0);
      lines.push('');
      lines.push(`🍚 Arroz · ${arrozTotal}`);
      for (const e of a.arroz) {
        lines.push(`${e.code} × ${e.quantity} = ${formatCurrency(e.quantity * (payment.priceByType[e.pupusaTypeId] || 0))}`);
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
