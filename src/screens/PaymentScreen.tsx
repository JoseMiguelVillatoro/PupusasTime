import { useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PupusaIcon } from '@/components/PupusaIcon';
import { Check, Copy, ChevronLeft, User } from 'lucide-react';
import {
  PersonOrder,
  PlaceRestaurant,
  AccountGroup,
  MASA_LABEL,
  PUPUSA_BY_ID,
} from '@/data/pupusa';
import {
  consolidateOrders,
  generatePaymentText,
  calculatePayment,
  formatCurrency,
  PaymentResult,
} from '@/data/consolidation';
import { Theme } from '@/hooks/useTheme';

interface Props {
  restaurant: PlaceRestaurant | null;
  orders: PersonOrder[];
  groups: AccountGroup[];
  people: string[];
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  priceInputs: Record<string, string>;
  setPriceInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paymentStep: 'intro' | 'price' | 'tip' | 'result';
  setPaymentStep: React.Dispatch<React.SetStateAction<'intro' | 'price' | 'tip' | 'result'>>;
  hasTip: boolean | null;
  setHasTip: React.Dispatch<React.SetStateAction<boolean | null>>;
  tipInput: string;
  setTipInput: React.Dispatch<React.SetStateAction<string>>;
  paymentResult: PaymentResult | null;
  setPaymentResult: React.Dispatch<React.SetStateAction<PaymentResult | null>>;
}

export function PaymentScreen({
  restaurant,
  orders,
  groups,
  people,
  theme,
  onToggleTheme,
  onBack,
  priceInputs,
  setPriceInputs,
  paymentStep,
  setPaymentStep,
  hasTip,
  setHasTip,
  tipInput,
  setTipInput,
  paymentResult,
  setPaymentResult,
}: Props) {
  const [copied, setCopied] = useState(false);
  const consolidated = consolidateOrders(orders);

  const orderedTypes = Array.from(
    new Map(
      [...consolidated.maiz, ...consolidated.arroz].map((e) => [e.pupusaTypeId, PUPUSA_BY_ID[e.pupusaTypeId]])
    ).values()
  );

  const priceByType: Record<string, number> = {};
  for (const [id, val] of Object.entries(priceInputs)) {
    const n = parseFloat(val);
    if (!isNaN(n) && n >= 0) priceByType[id] = n;
  }
  const allPricesValid = orderedTypes.every((t) => priceByType[t.id] !== undefined && priceByType[t.id] > 0);
  const tipPercent = hasTip ? (parseFloat(tipInput) || 0) : 0;

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

  const currentCopyText = paymentResult
    ? generatePaymentText(restaurant?.name || null, paymentResult)
    : '';

  const handleCopy = async () => {
    if (!currentCopyText) return;
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
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />} />

      <div className="px-5 pt-4 pb-2 animate-slideUp">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-3 active:scale-95 transition-transform no-tap-highlight"
        >
          <ChevronLeft className="w-4 h-4" /> Volver al resumen
        </button>
      </div>

      <div className="flex-1 px-5 pt-2 space-y-6 overflow-y-auto pb-40">
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
                  className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 p-3.5 transition-colors focus-within:border-terracotta-300"
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
                      className="w-full pl-9 pr-4 py-3 rounded-xl bg-white dark:bg-night-200 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 font-bold text-base text-right tabular-nums focus:outline-none focus:border-terracotta-300 transition-colors"
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
            {paymentResult.accounts.map((a) => (
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

      {paymentStep === 'result' && paymentResult && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100 space-y-2">
          <Button onClick={handleCopy}>
            {copied ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-5 h-5" strokeWidth={3} /> ¡Copiado!
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Copy className="w-5 h-5" /> Copiar pago
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
