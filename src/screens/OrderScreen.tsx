import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

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
  MASA_LABEL,
  MASA_EMOJI,
} from '@/data/pupusa';
import { personTotal, consolidateOrders } from '@/data/consolidation';
import { Theme } from '@/hooks/useTheme';
import type { PupusaType } from '@/data/pupusa';

const POPULAR_PUPUSA_IDS = ['revuelta', 'fq', 'queso', 'ql', 'chicharron'] as const;

interface Props {
  personIndex: number;
  totalPeople: number;
  personName: string;
  initialItems: PupusaItem[];
  allOrders: PersonOrder[];
  onBack: () => void;
  onComplete: (items: PupusaItem[]) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

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
  personName,
  initialItems,
  allOrders,
  onBack,
  onComplete,
  theme,
  onToggleTheme,
}: Props) {
  const [draft, setDraft] = useState<DraftRow[]>(() => itemsToDraft(initialItems));
  const [query, setQuery] = useState('');

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

  const completedOrders = allOrders.filter((_, i) => i < personIndex);
  const myItems = draftToItems(draft);
  const myOrder: PersonOrder = { id: 'preview', name: personName, items: myItems };
  const grandTotal = consolidateOrders([...completedOrders, myOrder]).total;

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
        <p className="text-charcoal-700 dark:text-cream-200 font-semibold text-sm">Ahora pide</p>
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50">{personName}</h2>
        <p className="text-charcoal-700 dark:text-cream-200 mt-1 mb-3">¿Qué quieres?</p>

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
                  <p className="text-xs text-charcoal-700/70 dark:text-cream-200/60 truncate">{type.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Maíz control */}
                <div className="flex-1 min-w-0 flex items-center justify-between bg-cream-100 dark:bg-night-200 rounded-xl px-2 py-2">
                  <span className="text-sm font-semibold text-charcoal-800 dark:text-cream-100 flex items-center gap-1 shrink-0">
                    🌽 <span className="hidden xs:inline sm:inline">Maíz</span>
                  </span>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button
                      onClick={() => setQty(type.id, 'maiz', -1)}
                      disabled={row.maiz <= 0}
                      className="w-8 h-8 rounded-full bg-cream-200 dark:bg-night-100 flex items-center justify-center text-charcoal-800 dark:text-cream-100 font-bold active:scale-90 transition-transform disabled:opacity-30 no-tap-highlight"
                    >
                      −
                    </button>
                    <span
                      key={row.maiz}
                      className="w-5 text-center font-extrabold tabular-nums animate-pop text-charcoal-900 dark:text-cream-50"
                    >
                      {row.maiz}
                    </span>
                    <button
                      onClick={() => setQty(type.id, 'maiz', 1)}
                      className="w-8 h-8 rounded-full bg-terracotta-400 text-white flex items-center justify-center font-bold active:scale-90 transition-transform hover:bg-terracotta-500 no-tap-highlight"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Arroz control */}
                <div className="flex-1 min-w-0 flex items-center justify-between bg-cream-100 dark:bg-night-200 rounded-xl px-2 py-2">
                  <span className="text-sm font-semibold text-charcoal-800 dark:text-cream-100 flex items-center gap-1 shrink-0">
                    🍚 <span className="hidden xs:inline sm:inline">Arroz</span>
                  </span>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <button
                      onClick={() => setQty(type.id, 'arroz', -1)}
                      disabled={row.arroz <= 0}
                      className="w-8 h-8 rounded-full bg-cream-200 dark:bg-night-100 flex items-center justify-center text-charcoal-800 dark:text-cream-100 font-bold active:scale-90 transition-transform disabled:opacity-30 no-tap-highlight"
                    >
                      −
                    </button>
                    <span
                      key={row.arroz}
                      className="w-5 text-center font-extrabold tabular-nums animate-pop text-charcoal-900 dark:text-cream-50"
                    >
                      {row.arroz}
                    </span>
                    <button
                      onClick={() => setQty(type.id, 'arroz', 1)}
                      className="w-8 h-8 rounded-full bg-terracotta-400 text-white flex items-center justify-center font-bold active:scale-90 transition-transform hover:bg-terracotta-500 no-tap-highlight"
                    >
                      +
                    </button>
                  </div>
                </div>
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
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-charcoal-900 dark:text-cream-50">
            {personName}: <span className="text-terracotta-500">{myTotal} pupusas</span>
          </span>
        </div>
        <Button onClick={() => onComplete(myItems)} disabled={myTotal === 0}>
          {personIndex + 1 < totalPeople ? 'Continuar' : 'Finalizar pedido'}
        </Button>
      </div>
    </div>
  );
}
