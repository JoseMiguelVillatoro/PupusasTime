import { useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PupusaIcon } from '@/components/PupusaIcon';
import { Check, Copy, RotateCcw, ChevronDown, ChevronLeft, User, Calculator } from 'lucide-react';
import {
  PersonOrder,
  PlaceRestaurant,
  BillingMethod,
  AccountGroup,
  MASA_LABEL,
  MASA_EMOJI,
  PUPUSA_BY_ID,
} from '@/data/pupusa';
import {
  consolidateOrders,
  generateOrderText,
  generatePaymentText,
  personTotal,
  calculatePayment,
  formatCurrency,
  ConsolidatedEntry,
  ConsolidatedOrder,
  PaymentResult,
} from '@/data/consolidation';
import { Theme } from '@/hooks/useTheme';

interface Props {
  restaurant: PlaceRestaurant | null;
  billing: BillingMethod;
  orders: PersonOrder[];
  groups: AccountGroup[];
  people: string[];
  onEdit: () => void;
  onRestart: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function FinalSummaryScreen({
  restaurant,
  billing,
  orders,
  groups,
  people,
  onEdit,
  onRestart,
  theme,
  onToggleTheme,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const consolidated = consolidateOrders(orders);
  const orderText = generateOrderText(restaurant?.name || null, consolidated, orders, groups, people);

  // Unique pupusa types in the current order (deduplicated by type id)
  const orderedTypes = Array.from(
    new Map(
      [...consolidated.maiz, ...consolidated.arroz].map((e) => [e.pupusaTypeId, PUPUSA_BY_ID[e.pupusaTypeId]])
    ).values()
  );

  // Payment calculator state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'intro' | 'price' | 'tip' | 'result'>('intro');
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [hasTip, setHasTip] = useState<boolean | null>(null);
  const [tipInput, setTipInput] = useState('');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const priceByType: Record<string, number> = {};
  for (const [id, val] of Object.entries(priceInputs)) {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) priceByType[id] = n;
  }
  const allPricesValid = orderedTypes.every((t) => priceByType[t.id] !== undefined && priceByType[t.id] > 0);
  const tipPercent = hasTip ? (parseFloat(tipInput) || 0) : 0;

  const startPayment = () => {
    setShowPayment(true);
    setPaymentStep('price');
  };

  const handlePriceContinue = () => {
    setPaymentStep('tip');
  };

  const handleTipContinue = () => {
    if (groups.length > 0) {
      const result = calculatePayment(orders, groups, people, priceByType, tipPercent);
      setPaymentResult(result);
      setPaymentStep('result');
    }
  };

  const backToSummary = () => {
    setShowPayment(false);
    setPaymentStep('intro');
    setPaymentResult(null);
  };

  const currentCopyText = paymentResult
    ? generatePaymentText(restaurant?.name || null, paymentResult)
    : orderText;

  const groupOrders = (g: AccountGroup): PersonOrder[] =>
    g.personIds
      .map((pid) => {
        const idx = people.indexOf(pid) >= 0 ? people.indexOf(pid) : parseInt(pid.slice(1));
        return orders[idx];
      })
      .filter((o): o is PersonOrder => Boolean(o));

  const groupConsolidated = (g: AccountGroup): ConsolidatedOrder =>
    consolidateOrders(groupOrders(g));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCopyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = currentCopyText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onEdit} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />

      <div className="px-5 pt-4 pb-2 text-center animate-slideUp">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50">
          ¡Pupuseada lista! 🫓
        </h2>
        {restaurant && (
          <p className="text-charcoal-700 dark:text-cream-200 mt-1 flex items-center justify-center gap-1 text-sm">
            📍 {restaurant.name}
          </p>
        )}
      </div>

      <div className="px-5 mt-4">
        <div className="flex items-center justify-center gap-3 py-6 rounded-3xl bg-terracotta-50 dark:bg-terracotta-700/25 border-2 border-terracotta-200 dark:border-terracotta-600/30">
          <PupusaIcon type="fq" className="w-14 h-14" />
          <span className="text-5xl font-extrabold text-terracotta-500 tabular-nums">
            {consolidated.total}
          </span>
          <span className="text-xl font-bold text-charcoal-800 dark:text-cream-100">pupusas</span>
        </div>
      </div>

      <div className="flex-1 px-5 pt-6 space-y-6 overflow-y-auto pb-40">
        {/* Consolidated order */}
        <div>
          <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50 mb-3">
            Orden consolidada
          </h3>

          {consolidated.maiz.length > 0 && (
            <div className="mb-4">
              <p className="font-bold text-charcoal-800 dark:text-cream-100 mb-2 flex items-center gap-1">
                🌽 {MASA_LABEL.maiz}
              </p>
              <div className="space-y-2">
                {consolidated.maiz.map((e: ConsolidatedEntry) => (
                  <div
                    key={e.pupusaTypeId}
                    className="flex items-center justify-between p-3 rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100"
                  >
                    <span className="font-semibold text-charcoal-800 dark:text-cream-100">{e.code}</span>
                    <span className="font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums">
                      {e.quantity} ×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {consolidated.arroz.length > 0 && (
            <div>
              <p className="font-bold text-charcoal-800 dark:text-cream-100 mb-2 flex items-center gap-1">
                🍚 {MASA_LABEL.arroz}
              </p>
              <div className="space-y-2">
                {consolidated.arroz.map((e: ConsolidatedEntry) => (
                  <div
                    key={e.pupusaTypeId}
                    className="flex items-center justify-between p-3 rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100"
                  >
                    <span className="font-semibold text-charcoal-800 dark:text-cream-100">{e.code}</span>
                    <span className="font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums">
                      {e.quantity} ×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Per person with expandable details */}
        <div>
          <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">Por persona</h3>
          {billing === 'split' && (
            <p className="text-sm text-charcoal-700/70 dark:text-cream-200/60 mb-3">Cada quien paga lo suyo</p>
          )}
          {billing === 'single' && (
            <p className="text-sm text-charcoal-700/70 dark:text-cream-200/60 mb-3">Todo en una sola cuenta</p>
          )}
          {billing === 'groups' && (
            <p className="text-sm text-charcoal-700/70 dark:text-cream-200/60 mb-3">
              {people.length} personas · {groups.length} cuentas
            </p>
          )}
          <div className="space-y-2">
            {orders.map((order, idx) => {
              const isOpen = expanded.has(order.id);
              const total = personTotal(order);
              return (
                <div
                  key={order.id}
                  className="rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 overflow-hidden animate-slideUp"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className="w-full flex items-center gap-3 p-3 no-tap-highlight active:bg-cream-100 dark:active:bg-night-200 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <span className="flex-1 text-left font-semibold text-charcoal-800 dark:text-cream-100">{order.name}</span>
                    <span className="font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums">
                      {total} 🫓
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-charcoal-700/50 dark:text-cream-200/50 transition-transform shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 space-y-1.5 animate-fadeIn">
                      {order.items.length === 0 ? (
                        <p className="text-sm text-charcoal-700/60 dark:text-cream-200/50 py-2 pl-12">
                          Sin pupusas
                        </p>
                      ) : (
                        order.items.map((item, i) => {
                          const type = PUPUSA_BY_ID[item.pupusaTypeId];
                          return (
                            <div
                              key={`${item.id}-${i}`}
                              className="flex items-center justify-between pl-12 pr-2 py-1.5 text-sm"
                            >
                              <span className="text-charcoal-700 dark:text-cream-200">
                                {item.quantity} × {type.code} — {MASA_EMOJI[item.masa]} {MASA_LABEL[item.masa]}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Groups breakdown */}
        {billing === 'groups' && groups.length > 0 && (
          <div>
            <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50 mb-3">
              Cuentas
            </h3>
            <div className="space-y-3">
              {groups.map((g, gi) => {
                const gc = groupConsolidated(g);
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 p-4 animate-slideUp"
                    style={{ animationDelay: `${gi * 50}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-charcoal-900 dark:text-cream-50">{g.name}</p>
                      <span className="text-xs font-bold text-charcoal-700/60 dark:text-cream-200/50 bg-cream-200 dark:bg-night-100 px-2 py-1 rounded-full">
                        {g.personIds.length} {g.personIds.length === 1 ? 'persona' : 'personas'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {g.personIds.map((pid) => {
                        const idx = people.indexOf(pid) >= 0 ? people.indexOf(pid) : parseInt(pid.slice(1));
                        const name = people[idx] || `Persona ${idx + 1}`;
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-olive-100 dark:bg-olive-600/25 text-olive-600 dark:text-olive-200 text-sm font-semibold"
                          >
                            <User className="w-3 h-3" />
                            {name}
                          </span>
                        );
                      })}
                    </div>
                    {gc.total > 0 && (
                      <>
                        <div className="flex items-center gap-1.5 mb-2 text-sm font-bold text-charcoal-800 dark:text-cream-100">
                          <PupusaIcon type="fq" className="w-5 h-5" />
                          {gc.total} pupusas
                        </div>
                        {gc.maiz.length > 0 && (
                          <div className="mb-2">
                            <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-1">
                              🌽 {MASA_LABEL.maiz} · {gc.maiz.reduce((s, e) => s + e.quantity, 0)}
                            </p>
                            <div className="space-y-1 pl-1">
                              {gc.maiz.map((e: ConsolidatedEntry) => (
                                <div key={e.pupusaTypeId} className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                                  <span>{e.code}</span>
                                  <span className="font-bold tabular-nums">× {e.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {gc.arroz.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-1">
                              🍚 {MASA_LABEL.arroz} · {gc.arroz.reduce((s, e) => s + e.quantity, 0)}
                            </p>
                            <div className="space-y-1 pl-1">
                              {gc.arroz.map((e: ConsolidatedEntry) => (
                                <div key={e.pupusaTypeId} className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                                  <span>{e.code}</span>
                                  <span className="font-bold tabular-nums">× {e.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview of copy text */}
        <div>
          <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50 mb-3">
            Texto para copiar
          </h3>
          <pre className="whitespace-pre-wrap font-sans text-sm text-charcoal-800 dark:text-cream-100 bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 rounded-2xl p-4 leading-relaxed">
{currentCopyText}
          </pre>
        </div>

        {/* Payment calculator */}
        {!showPayment ? (
          <div className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border-2 border-terracotta-200 dark:border-terracotta-600/30 p-5 text-center animate-slideUp">
            <Calculator className="w-8 h-8 text-terracotta-400 mx-auto mb-3" />
            <p className="font-display text-lg font-bold text-charcoal-900 dark:text-cream-50 mb-1">
              ¿Quieres que te ayudemos a pagar? 💰
            </p>
            <p className="text-sm text-charcoal-700 dark:text-cream-200 mb-4">
              Calcula cuánto corresponde pagar a cada cuenta.
            </p>
            <Button onClick={startPayment} variant="secondary">
              Sí, calcular la cuenta →
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 p-5 animate-slideUp">
            {/* Back button */}
            <button
              onClick={backToSummary}
              className="flex items-center gap-1 text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-4 active:scale-95 transition-transform no-tap-highlight"
            >
              <ChevronLeft className="w-4 h-4" /> Volver al resumen
            </button>

            {/* Price step */}
            {paymentStep === 'price' && (
              <div className="animate-fadeIn">
                <p className="font-display text-lg font-bold text-charcoal-900 dark:text-cream-50 mb-1">
                  ¿Cuánto cuesta cada tipo de pupusa?
                </p>
                <p className="text-xs text-charcoal-700/70 dark:text-cream-200/60 mb-4">
                  Maíz y Arroz tienen el mismo precio para cada especialidad.
                </p>
                <div className="space-y-2.5 mb-5">
                  {orderedTypes.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-2xl bg-white dark:bg-night-200 border border-cream-200 dark:border-night-100 p-3.5 transition-colors focus-within:border-terracotta-300"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-bold text-charcoal-900 dark:text-cream-50 text-sm">{t.code}</span>
                          <span className="text-charcoal-700 dark:text-cream-200 text-sm ml-1">— {t.name}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-charcoal-700/50 dark:text-cream-200/50 uppercase tracking-wide">
                          Precio por pupusa
                        </span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-700 dark:text-cream-200 font-bold text-base">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={priceInputs[t.id] || ''}
                          onChange={(e) => setPriceInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-9 pr-4 py-3 rounded-xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 font-bold text-base text-right tabular-nums focus:outline-none focus:border-terracotta-300 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={handlePriceContinue} disabled={!allPricesValid}>
                  Continuar →
                </Button>
              </div>
            )}

            {/* Tip step */}
            {paymentStep === 'tip' && (
              <div className="animate-fadeIn">
                <p className="font-display text-lg font-bold text-charcoal-900 dark:text-cream-50 mb-3">
                  ¿Hay propina?
                </p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setHasTip(false)}
                    className={`py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 no-tap-highlight ${
                      hasTip === false
                        ? 'bg-terracotta-400 text-white shadow-pop'
                        : 'bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100'
                    }`}
                  >
                    No
                  </button>
                  <button
                    onClick={() => setHasTip(true)}
                    className={`py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 no-tap-highlight ${
                      hasTip === true
                        ? 'bg-terracotta-400 text-white shadow-pop'
                        : 'bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100'
                    }`}
                  >
                    Sí
                  </button>
                </div>
                {hasTip && (
                  <div className="animate-fadeIn mb-4">
                    <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-2">
                      ¿Cuánto es la propina?
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        min="0"
                        value={tipInput}
                        onChange={(e) => setTipInput(e.target.value)}
                        placeholder="10"
                        className="w-full pl-4 pr-10 py-4 rounded-2xl bg-white dark:bg-night-200 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 font-bold text-lg text-right tabular-nums focus:outline-none focus:border-terracotta-300 transition-colors"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal-700 dark:text-cream-200 font-bold text-lg">%</span>
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleTipContinue}
                  disabled={hasTip === null || (hasTip && tipPercent <= 0)}
                >
                  Calcular →
                </Button>
              </div>
            )}

            {/* Result step */}
            {paymentStep === 'result' && paymentResult && (
              <div className="animate-fadeIn">
                {paymentResult.accounts.map((a, ai) => (
                  <div
                    key={a.groupId}
                    className="mb-4 pb-4 border-b border-cream-200 dark:border-night-100 last:border-0 last:pb-0 last:mb-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-charcoal-900 dark:text-cream-50">{a.groupName}</p>
                      <span className="text-xs font-bold text-charcoal-700/60 dark:text-cream-200/50 bg-cream-200 dark:bg-night-100 px-2 py-1 rounded-full">
                        {a.personNames.length} {a.personNames.length === 1 ? 'persona' : 'personas'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {a.personNames.map((name, ni) => (
                        <span
                          key={ni}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-olive-100 dark:bg-olive-600/25 text-olive-600 dark:text-olive-200 text-sm font-semibold"
                        >
                          <User className="w-3 h-3" />
                          {name}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mb-3 text-sm font-bold text-charcoal-800 dark:text-cream-100">
                      <PupusaIcon type="fq" className="w-5 h-5" />
                      {a.totalPupusas} pupusas
                    </div>
                    {a.maiz.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-1">
                          🌽 {MASA_LABEL.maiz} · {a.maiz.reduce((s, e) => s + e.quantity, 0)}
                        </p>
                        <div className="space-y-1 pl-1">
                          {a.maiz.map((e) => (
                            <div key={e.pupusaTypeId} className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                              <span>{e.code} × {e.quantity}</span>
                              <span className="font-bold tabular-nums">{formatCurrency(e.quantity * (paymentResult.priceByType[e.pupusaTypeId] || 0))}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-sm font-bold text-charcoal-800 dark:text-cream-100 pt-1">
                            <span>Total Maíz</span>
                            <span className="tabular-nums">{formatCurrency(a.maiz.reduce((s, e) => s + e.quantity * (paymentResult.priceByType[e.pupusaTypeId] || 0), 0))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {a.arroz.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-1">
                          🍚 {MASA_LABEL.arroz} · {a.arroz.reduce((s, e) => s + e.quantity, 0)}
                        </p>
                        <div className="space-y-1 pl-1">
                          {a.arroz.map((e) => (
                            <div key={e.pupusaTypeId} className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                              <span>{e.code} × {e.quantity}</span>
                              <span className="font-bold tabular-nums">{formatCurrency(e.quantity * (paymentResult.priceByType[e.pupusaTypeId] || 0))}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-sm font-bold text-charcoal-800 dark:text-cream-100 pt-1">
                            <span>Total Arroz</span>
                            <span className="tabular-nums">{formatCurrency(a.arroz.reduce((s, e) => s + e.quantity * (paymentResult.priceByType[e.pupusaTypeId] || 0), 0))}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-cream-200 dark:border-night-100 space-y-1.5">
                      <div className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                        <span>Subtotal de la cuenta</span>
                        <span className="font-bold tabular-nums">{formatCurrency(a.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                        <span>Propina</span>
                        <span className="font-bold tabular-nums">{formatCurrency(a.tip)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 pt-2 border-t border-cream-200 dark:border-night-100">
                        <span className="text-base font-extrabold text-charcoal-900 dark:text-cream-50">TOTAL DE LA CUENTA</span>
                        <span className="text-xl font-extrabold text-terracotta-500 tabular-nums">{formatCurrency(a.total)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* General summary */}
                <div className="mt-5 rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border-2 border-terracotta-200 dark:border-terracotta-600/30 p-4">
                  <p className="font-display text-lg font-bold text-charcoal-900 dark:text-cream-50 mb-3">
                    Resumen de pago
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                      <span>Subtotal</span>
                      <span className="font-bold tabular-nums">{formatCurrency(paymentResult.generalSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-charcoal-700 dark:text-cream-200">
                      <span>Propina{tipPercent > 0 ? ` (${tipPercent}%)` : ''}</span>
                      <span className="font-bold tabular-nums">{formatCurrency(paymentResult.generalTip)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t-2 border-terracotta-300 dark:border-terracotta-600/40 flex items-center justify-between">
                    <span className="text-lg font-extrabold text-charcoal-900 dark:text-cream-50">TOTAL</span>
                    <span className="text-2xl font-extrabold text-terracotta-500 tabular-nums">{formatCurrency(paymentResult.generalTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100 space-y-2">
        <Button onClick={handleCopy}>
          {copied ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-5 h-5" strokeWidth={3} /> ¡Copiado!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Copy className="w-5 h-5" /> Copiar orden
            </span>
          )}
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          <span className="flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Nueva pupuseada
          </span>
        </Button>
      </div>
    </div>
  );
}
