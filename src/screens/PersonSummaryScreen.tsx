import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProgressBar, LiveTotal } from '@/components/Progress';
import { PupusaIcon } from '@/components/PupusaIcon';
import { PersonOrder, MASA_LABEL, MASA_EMOJI, PUPUSA_BY_ID } from '@/data/pupusa';
import { personTotal, consolidateOrders } from '@/data/consolidation';
import { Theme } from '@/hooks/useTheme';

interface Props {
  personIndex: number;
  totalPeople: number;
  personOrder: PersonOrder;
  allOrders: PersonOrder[];
  onEdit: () => void;
  onContinue: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function PersonSummaryScreen({
  personIndex,
  totalPeople,
  personOrder,
  allOrders,
  onEdit,
  onContinue,
  theme,
  onToggleTheme,
}: Props) {
  const myTotal = personTotal(personOrder);
  const grandTotal = consolidateOrders(allOrders).total;
  const isLast = personIndex + 1 >= totalPeople;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <ProgressBar step={personIndex + 1} total={totalPeople} label="Personas" />

      <div className="px-5 pt-4 pb-2">
        <p className="text-charcoal-700 dark:text-cream-200 font-semibold text-sm">Resumen de</p>
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50">{personOrder.name}</h2>
      </div>

      <LiveTotal>{grandTotal} pupusas en la pupuseada</LiveTotal>

      <div className="flex-1 px-5 pt-4 space-y-3 overflow-y-auto pb-40">
        {personOrder.items.length === 0 && (
          <p className="text-center text-charcoal-700/60 dark:text-cream-200/50 py-10">
            {personOrder.name} no pidió pupusas todavía
          </p>
        )}

        {personOrder.items.map((item, idx) => {
          const type = PUPUSA_BY_ID[item.pupusaTypeId];
          return (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 animate-slideUp"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <PupusaIcon type={item.pupusaTypeId} className="w-12 h-12 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-charcoal-900 dark:text-cream-50">{type.code}</p>
                <p className="text-sm text-charcoal-700/70 dark:text-cream-200/70">
                  {MASA_EMOJI[item.masa]} {MASA_LABEL[item.masa]}
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-terracotta-500 tabular-nums">
                  {item.quantity}
                </span>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between p-4 mt-2">
          <span className="font-bold text-charcoal-900 dark:text-cream-50">Total de {personOrder.name}</span>
          <span className="text-2xl font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums">
            {myTotal} 🫓
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100 space-y-2">
        <Button variant="secondary" onClick={onEdit}>
          Editar pedido
        </Button>
        <Button onClick={onContinue}>
          {isLast ? 'Ver orden final' : 'Siguiente persona'}
        </Button>
      </div>
    </div>
  );
}
