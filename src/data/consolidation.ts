import {
  MasaType,
  PupusaTypeId,
  PUPUSA_BY_ID,
  MASA_LABEL,
  MASA_EMOJI,
  PersonOrder,
  AccountGroup,
  BillingMethod,
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

/** Montos en centavos enteros: nunca hacemos aritmética de dinero en float. */
export type Cents = number;

export function toCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}

/** Convierte lo que alguien escribió ("0.75", "0,75", "$1") a centavos, o null si no es un monto. */
export function parseMoney(input: string): Cents | null {
  const cleaned = input.replace(/[$\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return toCents(Number(cleaned));
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

export interface ConsolidatedExtra {
  label: string;
  quantity: number;
  cents: Cents;
}

/**
 * Junta bebidas y extras por nombre (sin distinguir mayúsculas ni tildes) para
 * dictarle a la mesera "2 horchatas" aunque cada quien las haya escrito distinto.
 */
export function consolidateExtras(orders: PersonOrder[]): ConsolidatedExtra[] {
  const byKey = new Map<string, ConsolidatedExtra>();
  for (const person of orders) {
    for (const x of person.extras ?? []) {
      if (x.quantity <= 0) continue;
      const key = normalizeLabel(x.label);
      const prev = byKey.get(key);
      if (prev) {
        prev.quantity += x.quantity;
        prev.cents += x.quantity * x.priceCents;
      } else {
        byKey.set(key, { label: x.label.trim(), quantity: x.quantity, cents: x.quantity * x.priceCents });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.quantity - a.quantity);
}

function normalizeLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function extrasCount(order: PersonOrder): number {
  return (order.extras ?? []).reduce((s, x) => s + (x.quantity > 0 ? x.quantity : 0), 0);
}

export function groupOrders(g: AccountGroup, orders: PersonOrder[]): PersonOrder[] {
  const ids = new Set(g.personIds);
  return orders.filter((o) => ids.has(o.id));
}

export function groupPersonNames(g: AccountGroup, orders: PersonOrder[]): string[] {
  return groupOrders(g, orders).map((o) => o.name);
}

/** Quita de los grupos a personas que ya no están en la pupuseada. */
export function pruneGroups(groups: AccountGroup[], orders: PersonOrder[]): AccountGroup[] {
  const ids = new Set(orders.map((o) => o.id));
  return groups.map((g) => ({ ...g, personIds: g.personIds.filter((pid) => ids.has(pid)) }));
}

/**
 * Para dividir por teléfono: qué teléfono pide por cada persona y cómo se
 * llama la cuenta de ese teléfono ("Cuenta de Javier").
 */
export interface PhoneOwnership {
  phoneOf: Record<string, string>;
  phoneName: Record<string, string>;
}

/** Las cuentas según el método elegido: una sola, una por persona, por teléfono o los grupos armados. */
export function accountsFor(
  billing: BillingMethod,
  orders: PersonOrder[],
  groups: AccountGroup[],
  phones?: PhoneOwnership
): AccountGroup[] {
  if (billing === 'byPhone' && phones) {
    const byPhone = new Map<string, AccountGroup>();
    for (const o of orders) {
      const phone = phones.phoneOf[o.id] ?? `solo-${o.id}`;
      const g = byPhone.get(phone) ?? {
        id: `phone-${phone}`,
        name: phones.phoneName[phone] ? `Cuenta de ${phones.phoneName[phone]}` : o.name,
        personIds: [],
      };
      g.personIds.push(o.id);
      byPhone.set(phone, g);
    }
    return [...byPhone.values()];
  }
  if (billing === 'byPhone') {
    return orders.map((o) => ({ id: `person-${o.id}`, name: o.name, personIds: [o.id] }));
  }
  if (billing === 'single') {
    return [{ id: 'single-account', name: 'Cuenta única', personIds: orders.map((o) => o.id) }];
  }
  if (billing === 'split') {
    return orders.map((o) => ({ id: `person-${o.id}`, name: o.name, personIds: [o.id] }));
  }
  return groups;
}

export function personTotal(order: PersonOrder): number {
  return order.items.reduce((sum, i) => sum + (i.quantity > 0 ? i.quantity : 0), 0);
}

export function generateOrderText(
  restaurantName: string | null,
  consolidated: ConsolidatedOrder,
  people: PersonOrder[]
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

  const extras = consolidateExtras(people);
  if (extras.length > 0) {
    lines.push('');
    lines.push('🥤 BEBIDAS Y EXTRAS');
    for (const x of extras) {
      lines.push(`${x.quantity} ${x.label}`);
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
  extras: ConsolidatedExtra[];
  pupusasSubtotal: Cents;
  extrasSubtotal: Cents;
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

/**
 * Calcula cuánto paga cada cuenta. `priceCentsByType` son los precios por
 * especialidad en centavos; las bebidas y extras ya traen su precio. La propina
 * se calcula sobre todo el consumo y se reparte proporcional a cada cuenta.
 */
export function calculatePayment(
  orders: PersonOrder[],
  groups: AccountGroup[],
  priceCentsByType: Record<string, Cents>,
  tipPercent: number
): PaymentResult {
  const accounts: AccountBreakdown[] = groups.map((g) => {
    const members = groupOrders(g, orders);
    const gc = consolidateOrders(members);
    const extras = consolidateExtras(members);
    const pupusasSubtotal = entriesCents([...gc.maiz, ...gc.arroz], priceCentsByType);
    const extrasSubtotal = extras.reduce((s, x) => s + x.cents, 0);
    const subtotal = pupusasSubtotal + extrasSubtotal;
    return {
      groupId: g.id,
      groupName: g.name,
      personNames: members.map((m) => m.name),
      totalPupusas: gc.total,
      maiz: gc.maiz,
      arroz: gc.arroz,
      extras,
      pupusasSubtotal,
      extrasSubtotal,
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

/** Desglose completo, para copiar. */
export function generatePaymentText(restaurantName: string | null, payment: PaymentResult): string {
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
      lines.push('');
      lines.push(`🌽 Maíz · ${maizTotal}`);
      for (const e of a.maiz) {
        lines.push(`${e.code} × ${e.quantity} = ${formatCurrency(lineCents(e, payment.priceCentsByType))}`);
      }
      lines.push(`Total Maíz: ${formatCurrency(entriesCents(a.maiz, payment.priceCentsByType))}`);
    }
    if (a.arroz.length > 0) {
      const arrozTotal = a.arroz.reduce((s, e) => s + e.quantity, 0);
      lines.push('');
      lines.push(`🍚 Arroz · ${arrozTotal}`);
      for (const e of a.arroz) {
        lines.push(`${e.code} × ${e.quantity} = ${formatCurrency(lineCents(e, payment.priceCentsByType))}`);
      }
      lines.push(`Total Arroz: ${formatCurrency(entriesCents(a.arroz, payment.priceCentsByType))}`);
    }
    if (a.extras.length > 0) {
      lines.push('');
      lines.push('🥤 Bebidas y extras');
      for (const x of a.extras) {
        lines.push(`${x.label} × ${x.quantity} = ${formatCurrency(x.cents)}`);
      }
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

/** Mensaje corto para WhatsApp: cuánto paga cada cuenta y el total. */
export function generateShareText(restaurantName: string | null, payment: PaymentResult): string {
  const lines: string[] = [restaurantName ? `🫓 Pupuseada en ${restaurantName}` : '🫓 Pupuseada'];
  lines.push('');
  for (const a of payment.accounts) {
    lines.push(`${a.groupName}: ${formatCurrency(a.total)}`);
  }
  lines.push('');
  const tipNote = payment.generalTip > 0 ? ` (propina ${payment.tipPercent}% incluida)` : '';
  lines.push(`Total de la mesa: ${formatCurrency(payment.generalTotal)}${tipNote}`);
  lines.push('');
  lines.push('Cuentas hechas con Pupusas Time');
  return lines.join('\n');
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
