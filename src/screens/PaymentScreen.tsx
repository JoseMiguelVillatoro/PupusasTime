import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Check, Copy, ChevronDown, MessageCircle, Pencil } from 'lucide-react';
import { PersonOrder, PlaceRestaurant, AccountGroup, BillingMethod, MASA_LABEL, PUPUSA_BY_ID, PupusaType } from '@/data/pupusa';
import {
  accountsFor,
  calculatePayment,
  consolidateExtras,
  consolidateOrders,
  formatCurrency,
  generatePaymentText,
  generateShareText,
  lineCents,
  parseMoney,
  whatsappShareUrl,
  type AccountBreakdown,
  type Cents,
} from '@/data/consolidation';
import type { PaymentDraft } from '@/state/pupuseada';
import { loadPrices, savePrices } from '@/state/storage';
import { copyText } from '@/lib/clipboard';
import { Theme } from '@/hooks/useTheme';

interface Props {
  restaurant: PlaceRestaurant | null;
  billing: BillingMethod;
  orders: PersonOrder[];
  groups: AccountGroup[];
  draft: PaymentDraft;
  onChange: (patch: Partial<PaymentDraft>) => void;
  onBack: () => void;
  onBackToSummary: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const TIP_PRESETS = ['10', '15'];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const inputClass =
  'w-full py-3 rounded-xl bg-white dark:bg-night-200 border border-cream-300 dark:border-night-100 text-charcoal-800 dark:text-cream-100 font-bold text-base text-right tabular-nums focus:outline-none focus:border-terracotta-400 transition-colors';

function MoneyInput({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-700 dark:text-cream-200 font-bold">$</span>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className={`${inputClass} pl-9 pr-4`}
      />
    </div>
  );
}

function AccountDetail({ a, prices }: { a: AccountBreakdown; prices: Record<string, Cents> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left no-tap-highlight"
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold text-charcoal-900 dark:text-cream-50 truncate">{a.groupName}</p>
          <p className="text-sm text-charcoal-700 dark:text-cream-200 truncate">
            {a.personNames.length > 1 ? `${a.personNames.join(', ')} · ` : ''}
            {a.totalPupusas} {a.totalPupusas === 1 ? 'pupusa' : 'pupusas'}
            {a.extras.length > 0 && ` · ${plural(a.extras.reduce((s, x) => s + x.quantity, 0), 'extra', 'extras')}`}
          </p>
        </div>
        <span className="font-display text-2xl font-bold text-terracotta-600 dark:text-terracotta-300 tabular-nums">
          {formatCurrency(a.total)}
        </span>
        <ChevronDown className={`w-5 h-5 text-charcoal-700 dark:text-cream-200 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-1.5 text-sm text-charcoal-700 dark:text-cream-200 animate-fadeIn">
          {[...a.maiz.map((e) => ({ e, masa: MASA_LABEL.maiz })), ...a.arroz.map((e) => ({ e, masa: MASA_LABEL.arroz }))].map(({ e, masa }) => (
            <div key={`${masa}-${e.pupusaTypeId}`} className="flex justify-between">
              <span>
                {e.quantity} × {e.code} · {masa}
              </span>
              <span className="tabular-nums">{formatCurrency(lineCents(e, prices))}</span>
            </div>
          ))}
          {a.extras.map((x) => (
            <div key={x.label} className="flex justify-between">
              <span>
                {x.quantity} × {x.label}
              </span>
              <span className="tabular-nums">{formatCurrency(x.cents)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-cream-200 dark:border-night-100">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(a.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Propina</span>
            <span className="tabular-nums">{formatCurrency(a.tip)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PaymentScreen({
  restaurant,
  billing,
  orders,
  groups,
  draft,
  onChange,
  onBack,
  onBackToSummary,
  theme,
  onToggleTheme,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [usedSaved, setUsedSaved] = useState(false);

  const consolidated = consolidateOrders(orders);
  const extras = consolidateExtras(orders);
  const extrasCents = extras.reduce((s, x) => s + x.cents, 0);
  const accounts = useMemo(() => accountsFor(billing, orders, groups), [billing, orders, groups]);

  const orderedTypes: PupusaType[] = Array.from(
    new Map([...consolidated.maiz, ...consolidated.arroz].map((e) => [e.pupusaTypeId, PUPUSA_BY_ID[e.pupusaTypeId]])).values()
  );

  // Precios recordados de la última vez en esta pupusería.
  useEffect(() => {
    const nothingTyped = Object.keys(draft.priceInputs).length === 0 && !draft.uniformInput;
    if (!nothingTyped) return;
    const saved = loadPrices(restaurant);
    if (!saved) return;
    onChange({ priceInputs: saved.priceInputs, uniformPrice: saved.uniformPrice, uniformInput: saved.uniformInput });
    setUsedSaved(true);
    // Solo al entrar a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const priceCentsByType: Record<string, Cents> = {};
  for (const t of orderedTypes) {
    const cents = parseMoney(draft.uniformPrice ? draft.uniformInput : draft.priceInputs[t.id] ?? '');
    if (cents !== null) priceCentsByType[t.id] = cents;
  }
  const allPricesValid = orderedTypes.every((t) => (priceCentsByType[t.id] ?? 0) > 0);
  const tipPercent = draft.hasTip ? Number(draft.tipInput.replace(',', '.')) || 0 : 0;
  const tipValid = draft.hasTip === false || (draft.hasTip === true && tipPercent > 0 && tipPercent <= 100);

  const result = draft.step === 'result' ? calculatePayment(orders, accounts, priceCentsByType, tipPercent) : null;

  const goToResult = () => {
    savePrices(restaurant, {
      priceInputs: draft.priceInputs,
      uniformPrice: draft.uniformPrice,
      uniformInput: draft.uniformInput,
    });
    onChange({ step: 'result' });
  };

  const restaurantName = restaurant?.name ?? null;
  const shareText = result ? generateShareText(restaurantName, result) : '';
  const detailText = result ? generatePaymentText(restaurantName, result) : '';

  const handleCopy = async () => {
    await copyText(detailText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const backAction = draft.step === 'price' ? onBack : () => onChange({ step: draft.step === 'result' ? 'tip' : 'price' });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={backAction} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />

      <div className="flex-1 px-5 pt-2 space-y-6 overflow-y-auto pb-40">
        {/* Paso 1: precios */}
        {draft.step === 'price' && (
          <div className="animate-fadeIn">
            <h2 className="font-display text-2xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">¿Cuánto cuesta cada pupusa?</h2>
            <p className="text-sm text-charcoal-700 dark:text-cream-200 mb-4">Maíz y arroz llevan el mismo precio.</p>

            {usedSaved && (
              <p className="mb-4 px-3 py-2 rounded-xl bg-olive-100 dark:bg-olive-600/25 text-olive-600 dark:text-olive-200 text-sm font-semibold">
                Pusimos los precios de la última vez{restaurantName ? ` en ${restaurantName}` : ''}. Revisalos por si cambiaron.
              </p>
            )}

            <label className="flex items-center justify-between gap-3 mb-4 p-4 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 cursor-pointer">
              <span>
                <span className="block font-bold text-charcoal-900 dark:text-cream-50">Mismo precio para todas</span>
                <span className="block text-sm text-charcoal-700 dark:text-cream-200">Lo más común en las pupuserías</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={draft.uniformPrice}
                onChange={(e) => onChange({ uniformPrice: e.target.checked })}
                className="w-6 h-6 accent-terracotta-500 shrink-0"
              />
            </label>

            {draft.uniformPrice ? (
              <div className="mb-5 p-4 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100">
                <p className="text-sm font-bold text-charcoal-800 dark:text-cream-100 mb-2">Precio por pupusa</p>
                <MoneyInput id="uniform-price" label="Precio por pupusa" value={draft.uniformInput} onChange={(v) => onChange({ uniformInput: v })} />
              </div>
            ) : (
              <div className="space-y-2.5 mb-5">
                {orderedTypes.map((t) => (
                  <div key={t.id} className="rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 p-3.5">
                    <p className="text-sm mb-2">
                      <span className="font-bold text-charcoal-900 dark:text-cream-50">{t.code}</span>
                      {t.code !== t.name && <span className="text-charcoal-700 dark:text-cream-200"> · {t.name}</span>}
                    </p>
                    <MoneyInput
                      id={`price-${t.id}`}
                      label={`Precio de ${t.name}`}
                      value={draft.priceInputs[t.id] ?? ''}
                      onChange={(v) => onChange({ priceInputs: { ...draft.priceInputs, [t.id]: v } })}
                    />
                  </div>
                ))}
              </div>
            )}

            {extras.length > 0 && (
              <p className="mb-5 text-sm text-charcoal-700 dark:text-cream-200">
                Las bebidas y extras ya tienen su precio: {formatCurrency(extrasCents)} en total.
              </p>
            )}

            <Button onClick={() => onChange({ step: 'tip' })} disabled={!allPricesValid}>
              Continuar →
            </Button>
          </div>
        )}

        {/* Paso 2: propina */}
        {draft.step === 'tip' && (
          <div className="animate-fadeIn">
            <h2 className="font-display text-2xl font-bold text-charcoal-900 dark:text-cream-50 mb-3">¿Dejamos propina?</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { v: false, label: 'No' },
                { v: true, label: 'Sí' },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => onChange({ hasTip: o.v, tipInput: o.v && !draft.tipInput ? '10' : draft.tipInput })}
                  aria-pressed={draft.hasTip === o.v}
                  className={`py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 no-tap-highlight ${
                    draft.hasTip === o.v ? 'bg-terracotta-500 text-white shadow-pop' : 'bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {draft.hasTip && (
              <div className="animate-fadeIn mb-4">
                <div className="flex gap-2 mb-3">
                  {TIP_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => onChange({ tipInput: p })}
                      aria-pressed={draft.tipInput === p}
                      className={`flex-1 min-h-[44px] rounded-xl font-bold no-tap-highlight ${
                        draft.tipInput === p ? 'bg-terracotta-100 dark:bg-terracotta-700/40 text-terracotta-700 dark:text-terracotta-100 ring-2 ring-terracotta-400' : 'bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <label htmlFor="tip" className="block text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-2">
                  Otro porcentaje
                </label>
                <div className="relative">
                  <input
                    id="tip"
                    inputMode="decimal"
                    value={draft.tipInput}
                    onChange={(e) => onChange({ tipInput: e.target.value })}
                    placeholder="10"
                    className={`${inputClass} pl-4 pr-10 py-4 text-lg`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-charcoal-700 dark:text-cream-200 font-bold text-lg">%</span>
                </div>
              </div>
            )}
            <Button onClick={goToResult} disabled={!tipValid}>
              Calcular →
            </Button>
          </div>
        )}

        {/* Paso 3: resultado */}
        {draft.step === 'result' && result && (
          <div className="animate-fadeIn space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-charcoal-900 dark:text-cream-50">¿Cuánto paga cada quien?</h2>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => onChange({ step: 'price' })}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-white dark:bg-night-300 border border-cream-200 dark:border-night-100 text-sm font-bold text-charcoal-800 dark:text-cream-100 no-tap-highlight"
                >
                  {draft.uniformPrice ? `${formatCurrency(priceCentsByType[orderedTypes[0]?.id] ?? 0)} todas` : 'Precios por especialidad'}
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChange({ step: 'tip' })}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-white dark:bg-night-300 border border-cream-200 dark:border-night-100 text-sm font-bold text-charcoal-800 dark:text-cream-100 no-tap-highlight"
                >
                  {result.generalTip > 0 ? `Propina ${result.tipPercent}%` : 'Sin propina'}
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {result.accounts.map((a) => (
                <AccountDetail key={a.groupId} a={a} prices={result.priceCentsByType} />
              ))}
            </div>

            <div className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border-2 border-terracotta-200 dark:border-terracotta-600/30 p-5 space-y-1.5">
              <div className="flex justify-between text-sm text-charcoal-800 dark:text-cream-100">
                <span>
                  {plural(consolidated.total, 'pupusa', 'pupusas')}{extras.length > 0 ? ` y ${plural(extras.reduce((s, x) => s + x.quantity, 0), 'extra', 'extras')}` : ''}
                </span>
                <span className="font-bold tabular-nums">{formatCurrency(result.generalSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-charcoal-800 dark:text-cream-100">
                <span>Propina{result.tipPercent > 0 ? ` ${result.tipPercent}%` : ''}</span>
                <span className="font-bold tabular-nums">{formatCurrency(result.generalTip)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-terracotta-200 dark:border-terracotta-600/30">
                <span className="font-bold text-charcoal-900 dark:text-cream-50">Total de la mesa</span>
                <span className="font-display text-3xl font-bold text-terracotta-600 dark:text-terracotta-300 tabular-nums">
                  {formatCurrency(result.generalTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <a
                href={whatsappShareUrl(shareText)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-bold py-4 text-lg bg-olive-600 text-white hover:bg-olive-500 active:scale-[0.98] transition-all no-tap-highlight"
              >
                <MessageCircle className="w-5 h-5" /> Compartir por WhatsApp
              </a>
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="secondary" onClick={handleCopy} className="!py-3 !text-base">
                  <span className="inline-flex items-center gap-2">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '¡Copiado!' : 'Copiar desglose'}
                  </span>
                </Button>
                <Button variant="secondary" onClick={onBackToSummary} className="!py-3 !text-base">
                  Volver al pedido
                </Button>
              </div>
            </div>

            <p className="text-xs text-charcoal-700 dark:text-cream-200 text-center">
              Los totales se calculan en centavos exactos; la propina se reparte según lo que consumió cada cuenta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
