import { useState, useMemo } from 'react';
import { Search, X, Plus, Minus } from 'lucide-react';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProgressBar, LiveTotal } from '@/components/Progress';
import { PupusaIcon } from '@/components/PupusaIcon';
import {
  PUPUSA_TYPES,
  PUPUSA_BY_ID,
  PupusaItem,
  MasaType,
  PersonOrder,
  ExtraItem,
  MASA_EMOJI,
} from '@/data/pupusa';
import { consolidateOrders, formatCurrency, parseMoney } from '@/data/consolidation';
import { newId } from '@/state/pupuseada';
import { Theme } from '@/hooks/useTheme';
import type { PupusaType } from '@/data/pupusa';

const POPULAR_PUPUSA_IDS = ['revuelta', 'fq', 'queso', 'ql', 'chicharron'] as const;

interface Props {
  personIndex: number;
  totalPeople: number;
  person: PersonOrder;
  allOrders: PersonOrder[];
  editingFromFinal: boolean;
  onBack: () => void;
  onComplete: (items: PupusaItem[], extras: ExtraItem[]) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const QUICK_EXTRAS = ['Horchata', 'Café', 'Chocolate', 'Gaseosa', 'Agua'];

interface DraftRow {
  pupusaTypeId: string;
  maiz: number;
  arroz: number;
}

function itemsToDraft(items: PupusaItem[]): DraftRow[] {
  return PUPUSA_TYPES.map((t) => {
    const maizItem = items.find((i) => i.pupusaTypeId === t.id && i.masa === 'maiz');
    const arrozItem = items.find((i) => i.pupusaTypeId === t.id && i.masa === 'arroz');
    return {
      pupusaTypeId: t.id,
      maiz: maizItem?.quantity || 0,
      arroz: arrozItem?.quantity || 0,
    };
  });
}

function draftToItems(draft: DraftRow[]): PupusaItem[] {
  const items: PupusaItem[] = [];
  draft.forEach((row, idx) => {
    if (row.maiz > 0) {
      items.push({
        id: `item-${idx}-maiz`,
        pupusaTypeId: row.pupusaTypeId as PupusaItem['pupusaTypeId'],
        masa: 'maiz',
        quantity: row.maiz,
      });
    }
    if (row.arroz > 0) {
      items.push({
        id: `item-${idx}-arroz`,
        pupusaTypeId: row.pupusaTypeId as PupusaItem['pupusaTypeId'],
        masa: 'arroz',
        quantity: row.arroz,
      });
    }
  });
  return items;
}

export function OrderScreen({
  personIndex,
  totalPeople,
  person,
  allOrders,
  editingFromFinal,
  onBack,
  onComplete,
  theme,
  onToggleTheme,
}: Props) {
  const personName = person.name;
  const [draft, setDraft] = useState<DraftRow[]>(() => itemsToDraft(person.items));
  const [extras, setExtras] = useState<ExtraItem[]>(() => person.extras ?? []);
  const [extraLabel, setExtraLabel] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [query, setQuery] = useState('');

  const extraPriceCents = parseMoney(extraPrice);
  const canAddExtra = extraLabel.trim().length > 0 && extraPriceCents !== null && extraPriceCents > 0;

  const addExtra = () => {
    if (!canAddExtra || extraPriceCents === null) return;
    const label = extraLabel.trim();
    setExtras((prev) => {
      const same = prev.find((x) => x.label.toLowerCase() === label.toLowerCase() && x.priceCents === extraPriceCents);
      if (same) return prev.map((x) => (x === same ? { ...x, quantity: x.quantity + 1 } : x));
      return [...prev, { id: newId(), label, priceCents: extraPriceCents, quantity: 1 }];
    });
    setExtraLabel('');
    setExtraPrice('');
  };

  const setExtraQty = (id: string, delta: number) =>
    setExtras((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, quantity: x.quantity + delta } : x))
        .filter((x) => x.quantity > 0)
    );

  const extrasTotal = extras.reduce((s, x) => s + x.quantity, 0);

  const setQty = (typeId: string, masa: MasaType, delta: number) => {
    setDraft((prev) =>
      prev.map((row) =>
        row.pupusaTypeId === typeId
          ? { ...row, [masa]: Math.max(0, row[masa] + delta) }
          : row
      )
    );
  };

  const myTotal = draft.reduce((sum, r) => sum + r.maiz + r.arroz, 0);

  const otherOrders = allOrders.filter((o) => o.id !== person.id);
  const myItems = draftToItems(draft);
  const myOrder: PersonOrder = { id: person.id, name: personName, items: myItems };
  const grandTotal = consolidateOrders([...otherOrders, myOrder]).total;

  // Search filtering — accent-insensitive, matches name, code, or description
  const searchResults = useMemo(() => {
    const q = normalize(query);
    if (!q) return null;
    return PUPUSA_TYPES.filter(
      (t) =>
        normalize(t.name).includes(q) ||
        normalize(t.code).includes(q) ||
        normalize(t.description).includes(q)
    );
  }, [query]);

  // What to show in the main list:
  // - When searching: show search results
  // - When not searching: always show the 5 popular ones, plus any other active items
  const visibleTypes: PupusaType[] = useMemo(() => {
    if (searchResults) return searchResults;
    const popular = POPULAR_PUPUSA_IDS.map((id) => PUPUSA_BY_ID[id]);
    const activeNonPopular = draft
      .filter((r) => (r.maiz > 0 || r.arroz > 0) && !POPULAR_PUPUSA_IDS.includes(r.pupusaTypeId as typeof POPULAR_PUPUSA_IDS[number]))
      .map((r) => PUPUSA_BY_ID[r.pupusaTypeId as keyof typeof PUPUSA_BY_ID]);
    return [...popular, ...activeNonPopular];
  }, [searchResults, draft]);

  // "Tu pedido" — items currently selected
  const mySelectedItems = useMemo(() => {
    return draft
      .map((row) => {
        const type = PUPUSA_BY_ID[row.pupusaTypeId as keyof typeof PUPUSA_BY_ID];
        const items: { typeId: string; code: string; name: string; masa: MasaType; quantity: number }[] = [];
        if (row.maiz > 0) items.push({ typeId: row.pupusaTypeId, code: type.code, name: type.name, masa: 'maiz', quantity: row.maiz });
        if (row.arroz > 0) items.push({ typeId: row.pupusaTypeId, code: type.code, name: type.name, masa: 'arroz', quantity: row.arroz });
        return items;
      })
      .flat();
  }, [draft]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <ProgressBar step={personIndex + 1} total={totalPeople} label="Personas" />

      <div className="px-5 pt-4 pb-2">
        <p className="text-charcoal-700 dark:text-cream-200 font-semibold text-sm">Le toca a</p>
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50">{personName}</h2>
        <p className="text-charcoal-700 dark:text-cream-200 mt-1 mb-3">¿Qué vas a pedir?</p>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-700/50 dark:text-cream-200/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o abreviatura"
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/40 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 focus:bg-white dark:focus:bg-night-200 transition-colors text-base"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-cream-200 dark:bg-night-100 flex items-center justify-center text-charcoal-700 dark:text-cream-200 active:scale-90 transition-transform no-tap-highlight"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Tu pedido — fixed-height compact bar with horizontal scroll */}
      <div className="px-5 pb-2">
        <div className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border border-terracotta-200 dark:border-terracotta-600/30 p-3 h-[3.75rem] flex items-center gap-2 overflow-hidden">
          <span className="text-sm font-bold text-terracotta-600 dark:text-terracotta-200 flex items-center gap-1 shrink-0">
            🫓 {myTotal > 0 ? `Tu pedido · ${myTotal}` : 'Tu pedido'}
            {extrasTotal > 0 && ` + ${extrasTotal} ${extrasTotal === 1 ? 'extra' : 'extras'}`}
          </span>
          {mySelectedItems.length > 0 && (
            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0">
              {mySelectedItems.map((item, idx) => (
                <span
                  key={`${item.typeId}-${item.masa}-${idx}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-night-200 border border-terracotta-200 dark:border-terracotta-600/30 text-sm font-semibold text-charcoal-800 dark:text-cream-100 whitespace-nowrap shrink-0"
                >
                  {MASA_EMOJI[item.masa]} {item.code} ×{item.quantity}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <LiveTotal>{grandTotal} pupusas en la pupuseada</LiveTotal>

      {/* Section label */}
      {!searchResults && (
        <p className="px-5 pt-4 text-sm font-semibold text-charcoal-700 dark:text-cream-200">
          {myTotal > 0 ? 'Tu pedido' : 'Las más pedidas'}
        </p>
      )}

      <div className="flex-1 px-5 pt-3 space-y-3 overflow-y-auto pb-40">
        {visibleTypes.map((type) => {
          const row = draft.find((r) => r.pupusaTypeId === type.id)!;
          const active = row.maiz > 0 || row.arroz > 0;
          return (
            <div
              key={type.id}
              className={`p-4 rounded-2xl border-2 transition-all ${
                active
                  ? 'border-terracotta-300 dark:border-terracotta-500/50 bg-terracotta-50/50 dark:bg-terracotta-700/15'
                  : 'border-cream-200 dark:border-night-100 bg-cream-50 dark:bg-night-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <PupusaIcon type={type.id} className="w-11 h-11 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-charcoal-900 dark:text-cream-50 leading-tight">
                    {type.code}
                  </p>
                  {type.name !== type.code && (
                    <p className="text-xs text-charcoal-700 dark:text-cream-200 truncate">{type.name}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['maiz', 'arroz'] as const).map((masa) => {
                  const qty = row[masa];
                  const label = masa === 'maiz' ? 'Maíz' : 'Arroz';
                  return (
                    <div
                      key={masa}
                      className={`min-w-0 flex items-center justify-between rounded-xl pl-3 pr-1.5 py-1.5 ${
                        qty > 0 ? 'bg-white dark:bg-night-200 ring-1 ring-terracotta-300 dark:ring-terracotta-500/50' : 'bg-cream-100 dark:bg-night-200'
                      }`}
                    >
                      <span className="text-sm font-bold text-charcoal-800 dark:text-cream-100">{label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setQty(type.id, masa, -1)}
                          disabled={qty <= 0}
                          className="w-9 h-9 rounded-full bg-cream-50 dark:bg-night-100 border border-cream-300 dark:border-night-50 flex items-center justify-center text-charcoal-800 dark:text-cream-100 active:scale-90 transition-transform disabled:opacity-40 no-tap-highlight"
                          aria-label={`Quitar una ${type.name} de ${label.toLowerCase()}`}
                        >
                          <Minus className="w-4 h-4" strokeWidth={3} />
                        </button>
                        <span
                          key={qty}
                          className="w-5 text-center font-extrabold tabular-nums animate-pop text-charcoal-900 dark:text-cream-50"
                          aria-live="polite"
                        >
                          {qty}
                        </span>
                        <button
                          onClick={() => setQty(type.id, masa, 1)}
                          className="w-9 h-9 rounded-full bg-terracotta-500 text-white flex items-center justify-center active:scale-90 transition-transform hover:bg-terracotta-600 no-tap-highlight"
                          aria-label={`Agregar una ${type.name} de ${label.toLowerCase()}`}
                        >
                          <Plus className="w-4 h-4" strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {visibleTypes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-charcoal-700 dark:text-cream-200 font-semibold">No encontramos esa pupusa</p>
            <p className="text-charcoal-700/60 dark:text-cream-200/50 text-sm mt-1">Probá con otro nombre o abreviatura</p>
          </div>
        )}

        {!searchResults && (
          <section aria-labelledby="extras-title" className="pt-4">
            <h3 id="extras-title" className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">
              Bebidas y extras
            </h3>
            <p className="text-sm text-charcoal-700 dark:text-cream-200 mb-3">Para que el total cuadre con la cuenta de la mesera.</p>

            {extras.length > 0 && (
              <div className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 divide-y divide-cream-200 dark:divide-night-100 mb-3">
                {extras.map((x) => (
                  <div key={x.id} className="flex items-center gap-2 pl-4 pr-2 py-2">
                    <span className="flex-1 min-w-0 font-bold text-charcoal-900 dark:text-cream-50 truncate">{x.label}</span>
                    <span className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 tabular-nums">{formatCurrency(x.priceCents)}</span>
                    <button
                      onClick={() => setExtraQty(x.id, -1)}
                      className="w-9 h-9 rounded-full bg-cream-100 dark:bg-night-100 border border-cream-300 dark:border-night-50 flex items-center justify-center text-charcoal-800 dark:text-cream-100 active:scale-90 transition-transform no-tap-highlight"
                      aria-label={`Quitar un ${x.label}`}
                    >
                      <Minus className="w-4 h-4" strokeWidth={3} />
                    </button>
                    <span className="w-5 text-center font-extrabold tabular-nums text-charcoal-900 dark:text-cream-50">{x.quantity}</span>
                    <button
                      onClick={() => setExtraQty(x.id, 1)}
                      className="w-9 h-9 rounded-full bg-terracotta-500 text-white flex items-center justify-center active:scale-90 transition-transform hover:bg-terracotta-600 no-tap-highlight"
                      aria-label={`Agregar un ${x.label}`}
                    >
                      <Plus className="w-4 h-4" strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_EXTRAS.map((label) => (
                <button
                  key={label}
                  onClick={() => setExtraLabel(label)}
                  className={`px-3 py-2 rounded-full text-sm font-bold transition-colors no-tap-highlight ${
                    extraLabel === label
                      ? 'bg-terracotta-500 text-white'
                      : 'bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100 hover:bg-cream-300 dark:hover:bg-night-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addExtra();
              }}
            >
              <label className="sr-only" htmlFor="extra-label">Bebida o extra</label>
              <input
                id="extra-label"
                value={extraLabel}
                onChange={(e) => setExtraLabel(e.target.value)}
                placeholder="Otra bebida o extra"
                maxLength={40}
                className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 transition-colors text-sm"
              />
              <label className="sr-only" htmlFor="extra-price">Precio</label>
              <div className="relative w-24 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-700 dark:text-cream-200 font-bold text-sm">$</span>
                <input
                  id="extra-price"
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-3 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 transition-colors text-sm text-right tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={!canAddExtra}
                className="w-12 rounded-2xl bg-terracotta-500 text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 no-tap-highlight shrink-0"
                aria-label="Agregar bebida o extra"
              >
                <Plus className="w-5 h-5" strokeWidth={3} />
              </button>
            </form>
          </section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-charcoal-900 dark:text-cream-50">
            {personName}: <span className="text-terracotta-600 dark:text-terracotta-300">{myTotal} {myTotal === 1 ? 'pupusa' : 'pupusas'}</span>
            {extrasTotal > 0 && <span className="text-charcoal-700 dark:text-cream-200 font-semibold"> · {extrasTotal} {extrasTotal === 1 ? 'extra' : 'extras'}</span>}
          </span>
        </div>
        <Button onClick={() => onComplete(myItems, extras)} disabled={myTotal === 0 && extrasTotal === 0}>
          {editingFromFinal ? 'Guardar pedido' : personIndex + 1 < totalPeople ? 'Continuar' : 'Finalizar pedido'}
        </Button>
      </div>
    </div>
  );
}
