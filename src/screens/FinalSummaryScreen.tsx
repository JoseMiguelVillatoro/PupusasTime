import { useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PupusaIcon } from '@/components/PupusaIcon';
import { Check, Copy, RotateCcw, ChevronDown, User, Calculator, Pencil, Users, MapPin } from 'lucide-react';
import { PersonOrder, PlaceRestaurant, MASA_LABEL, PUPUSA_BY_ID } from '@/data/pupusa';
import {
  consolidateOrders,
  consolidateExtras,
  extrasCount,
  formatCurrency,
  generateOrderText,
  personTotal,
  ConsolidatedEntry,
} from '@/data/consolidation';
import { copyText } from '@/lib/clipboard';
import { Theme } from '@/hooks/useTheme';

interface Props {
  restaurant: PlaceRestaurant | null;
  orders: PersonOrder[];
  onEditPerson: (personId: string) => void;
  onEditPeople: () => void;
  onOpenPayment: () => void;
  /** Mesa compartida, teléfono invitado: las cuentas las hace el anfitrión. */
  guestAccounts?: { hostName: string; published: boolean };
  onFinish: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function EntryList({ title, entries }: { title: string; entries: ConsolidatedEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="font-bold text-charcoal-800 dark:text-cream-100 mb-2">{title}</p>
      <div className="space-y-2">
        {entries.map((e) => (
          <div
            key={e.pupusaTypeId}
            className="flex items-center justify-between p-3 rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100"
          >
            <span className="font-semibold text-charcoal-800 dark:text-cream-100">
              {e.code}
              {e.code !== e.name && <span className="font-normal text-charcoal-700 dark:text-cream-200"> · {e.name}</span>}
            </span>
            <span className="font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums">{e.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinalSummaryScreen({
  restaurant,
  orders,
  onEditPerson,
  onEditPeople,
  onOpenPayment,
  guestAccounts,
  onFinish,
  theme,
  onToggleTheme,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const consolidated = consolidateOrders(orders);
  const extras = consolidateExtras(orders);
  const orderText = generateOrderText(restaurant?.name || null, consolidated, orders);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async () => {
    await copyText(orderText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />

      <div className="px-5 pt-2 pb-2 text-center animate-slideUp">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50">¡Pupuseada lista! 🫓</h2>
        {restaurant && (
          <p className="text-charcoal-700 dark:text-cream-200 mt-1 flex items-center justify-center gap-1 text-sm">
            <MapPin className="w-4 h-4" /> {restaurant.name}
          </p>
        )}
      </div>

      <div className="px-5 mt-4">
        <div className="flex items-center justify-center gap-3 py-6 rounded-3xl bg-terracotta-50 dark:bg-terracotta-700/25 border-2 border-terracotta-200 dark:border-terracotta-600/30">
          <PupusaIcon type="fq" className="w-14 h-14" />
          <span className="text-5xl font-extrabold text-terracotta-600 dark:text-terracotta-300 tabular-nums">{consolidated.total}</span>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-charcoal-800 dark:text-cream-100">pupusas</span>
            {extras.length > 0 && (
              <span className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">
                {(() => {
                  const n = extras.reduce((s, x) => s + x.quantity, 0);
                  return `+ ${n} ${n === 1 ? 'bebida o extra' : 'bebidas y extras'}`;
                })()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pt-6 space-y-6 overflow-y-auto pb-44">
        {/* Orden para la mesera */}
        <section className="space-y-4">
          <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50">Orden para la mesera</h3>
          <EntryList title={`🌽 ${MASA_LABEL.maiz}`} entries={consolidated.maiz} />
          <EntryList title={`🍚 ${MASA_LABEL.arroz}`} entries={consolidated.arroz} />
          {extras.length > 0 && (
            <div>
              <p className="font-bold text-charcoal-800 dark:text-cream-100 mb-2">🥤 Bebidas y extras</p>
              <div className="space-y-2">
                {extras.map((x) => (
                  <div
                    key={x.label}
                    className="flex items-center justify-between p-3 rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100"
                  >
                    <span className="font-semibold text-charcoal-800 dark:text-cream-100">{x.label}</span>
                    <span className="font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums">{x.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Por persona */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50">Por persona</h3>
            <button
              onClick={onEditPeople}
              className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm font-bold text-terracotta-600 dark:text-terracotta-300 hover:bg-terracotta-50 dark:hover:bg-terracotta-700/20 no-tap-highlight"
            >
              <Users className="w-4 h-4" /> Agregar o quitar
            </button>
          </div>
          <div className="space-y-2">
            {orders.map((order, idx) => {
              const isOpen = expanded.has(order.id);
              const total = personTotal(order);
              const nExtras = extrasCount(order);
              return (
                <div
                  key={order.id}
                  className="rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 overflow-hidden animate-slideUp"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      aria-expanded={isOpen}
                      className="flex-1 min-w-0 flex items-center gap-3 p-3 no-tap-highlight active:bg-cream-100 dark:active:bg-night-200 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="flex-1 min-w-0 text-left font-semibold text-charcoal-800 dark:text-cream-100 truncate">{order.name}</span>
                      <span className="text-sm font-bold text-charcoal-900 dark:text-cream-50 tabular-nums shrink-0">
                        {total} {total === 1 ? 'pupusa' : 'pupusas'}
                        {nExtras > 0 && <span className="font-semibold text-charcoal-700 dark:text-cream-200"> · {nExtras} extra{nExtras === 1 ? '' : 's'}</span>}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-charcoal-700 dark:text-cream-200 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => onEditPerson(order.id)}
                      className="w-11 h-11 mr-1 rounded-full flex items-center justify-center text-charcoal-700 dark:text-cream-200 hover:bg-cream-200 dark:hover:bg-night-100 no-tap-highlight shrink-0"
                      aria-label={`Editar el pedido de ${order.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 space-y-1.5 animate-fadeIn">
                      {order.items.length === 0 && nExtras === 0 && (
                        <p className="text-sm text-charcoal-700 dark:text-cream-200 py-2 pl-12">Sin pedido</p>
                      )}
                      {order.items.map((item) => (
                        <p key={item.id} className="pl-12 pr-2 py-1 text-sm text-charcoal-700 dark:text-cream-200">
                          {item.quantity} × {PUPUSA_BY_ID[item.pupusaTypeId].code} — {MASA_LABEL[item.masa]}
                        </p>
                      ))}
                      {(order.extras ?? []).map((x) => (
                        <p key={x.id} className="pl-12 pr-2 py-1 text-sm text-charcoal-700 dark:text-cream-200">
                          {x.quantity} × {x.label} — {formatCurrency(x.priceCents)} c/u
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Texto para copiar */}
        <section>
          <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50 mb-3">Texto para copiar</h3>
          <pre className="whitespace-pre-wrap font-sans text-sm text-charcoal-800 dark:text-cream-100 bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 rounded-2xl p-4 leading-relaxed">
{orderText}
          </pre>
        </section>

        {/* Cuentas */}
        <section className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border-2 border-terracotta-200 dark:border-terracotta-600/30 p-5 text-center">
          <Calculator className="w-8 h-8 text-terracotta-500 mx-auto mb-3" />
          {guestAccounts ? (
            <>
              <p className="font-display text-lg font-bold text-charcoal-900 dark:text-cream-50 mb-1">
                {guestAccounts.published ? '¡Ya están las cuentas!' : 'Las cuentas las hace ' + guestAccounts.hostName}
              </p>
              <p className="text-sm text-charcoal-700 dark:text-cream-200 mb-4">
                {guestAccounts.published
                  ? 'Mirá cuánto te toca. Todos en la mesa ven lo mismo.'
                  : 'Cuando ponga los precios, te aparece aquí cuánto te toca.'}
              </p>
              <Button variant="secondary" onClick={onOpenPayment} disabled={!guestAccounts.published}>
                {guestAccounts.published ? 'Ver cuánto me toca →' : 'Esperando las cuentas…'}
              </Button>
            </>
          ) : (
            <>
              <p className="font-display text-lg font-bold text-charcoal-900 dark:text-cream-50 mb-1">¿Hacemos las cuentas?</p>
              <p className="text-sm text-charcoal-700 dark:text-cream-200 mb-4">
                Elegí cómo van a pagar y calculamos cuánto le toca a cada quien, propina incluida.
              </p>
              <Button variant="secondary" onClick={onOpenPayment}>
                Sí, hacer las cuentas →
              </Button>
            </>
          )}
        </section>

        {/* Nueva pupuseada, con confirmación */}
        <section className="pt-2">
          {confirmingFinish ? (
            <div className="rounded-2xl border-2 border-cream-300 dark:border-night-50 p-4 space-y-3 animate-fadeIn" role="alertdialog" aria-labelledby="finish-title">
              <p id="finish-title" className="font-bold text-charcoal-900 dark:text-cream-50">¿Terminamos esta pupuseada?</p>
              <p className="text-sm text-charcoal-700 dark:text-cream-200">
                Se guarda en tu historial en este teléfono y empezás una nueva desde cero.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirmingFinish(false)} className="!py-3 !text-base">
                  Cancelar
                </Button>
                <Button onClick={onFinish} className="!py-3 !text-base">
                  Sí, terminar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmingFinish(true)}>
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Terminar y empezar otra
              </span>
            </Button>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100 z-10">
        <Button onClick={handleCopy}>
          <span className="flex items-center justify-center gap-2">
            {copied ? (
              <>
                <Check className="w-5 h-5" /> ¡Copiado!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" /> Copiar orden
              </>
            )}
          </span>
        </Button>
      </div>
    </div>
  );
}
