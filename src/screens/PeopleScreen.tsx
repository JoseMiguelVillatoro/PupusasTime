import { useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Minus, Plus, X, Smartphone } from 'lucide-react';
import { rememberName, rememberedName } from '@/lib/myName';
import { Theme } from '@/hooks/useTheme';
import type { PersonDraft } from '@/state/pupuseada';

interface Row {
  key: string;
  id?: string;
  name: string;
  hasOrder: boolean;
}

interface Props {
  onBack: () => void;
  onContinue: (people: PersonDraft[]) => void;
  initialPeople: { id: string; name: string; hasOrder: boolean }[];
  /** true cuando se llega desde el resumen final para agregar o quitar gente. */
  editing: boolean;
  /** Abrir una mesa para que cada quien pida desde su teléfono. */
  onShare?: (hostName: string) => void;
  shareBusy?: boolean;
  shareError?: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}

let rowCounter = 0;
const newRow = (): Row => ({ key: `row-${++rowCounter}`, name: '', hasOrder: false });

export function PeopleScreen({
  onBack,
  onContinue,
  initialPeople,
  editing,
  onShare,
  shareBusy = false,
  shareError = null,
  theme,
  onToggleTheme,
}: Props) {
  const [hostName, setHostName] = useState(rememberedName);
  const [rows, setRows] = useState<Row[]>(() =>
    initialPeople.length
      ? initialPeople.map((p) => ({ key: p.id, id: p.id, name: p.name, hasOrder: p.hasOrder }))
      : [newRow(), newRow()]
  );

  const updateName = (key: string, name: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, name } : r)));

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (row: Row) => {
    if (rows.length <= 1) return;
    if (row.hasOrder && !window.confirm(`${row.name || 'Esta persona'} ya pidió. ¿La quitamos de la pupuseada?`)) return;
    setRows((prev) => prev.filter((r) => r.key !== row.key));
  };

  const removeLast = () => {
    const last = rows[rows.length - 1];
    if (last) removeRow(last);
  };

  const canContinue = rows.length > 0 && rows.every((r) => r.name.trim().length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <div className="px-5 pb-2">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">
          {editing ? 'Ajustá la mesa' : '¿Quiénes somos?'}
        </h2>
        <p className="text-charcoal-700 dark:text-cream-200 mb-6">
          {editing ? 'Agregá a quien llegó tarde o quitá a quien se fue.' : '¿Cuántas personas?'}
        </p>

        {onShare && !editing && (
          <form
            className="mb-6 p-4 rounded-2xl bg-olive-100/60 dark:bg-olive-600/15 border border-olive-200 dark:border-olive-600/30"
            onSubmit={(e) => {
              e.preventDefault();
              if (!hostName.trim() || shareBusy) return;
              rememberName(hostName);
              onShare(hostName.trim());
            }}
          >
            <p className="flex items-center gap-2 font-bold text-charcoal-900 dark:text-cream-50">
              <Smartphone className="w-4 h-4" /> Que cada quien pida desde su teléfono
            </p>
            <p className="text-sm text-charcoal-700 dark:text-cream-200 mt-1 mb-3">
              Abrís la mesa, compartís el código y cada quien elige lo suyo. Ves todo en vivo.
            </p>
            <div className="flex gap-2">
              <label htmlFor="host-name" className="sr-only">Tu nombre</label>
              <input
                id="host-name"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                maxLength={40}
                placeholder="Tu nombre"
                className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white dark:bg-night-200 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 focus:outline-none focus:border-terracotta-400"
              />
              <button
                type="submit"
                disabled={!hostName.trim() || shareBusy}
                className="px-4 rounded-xl bg-olive-600 text-white font-bold disabled:opacity-40 no-tap-highlight shrink-0"
              >
                {shareBusy ? 'Abriendo…' : 'Abrir mesa'}
              </button>
            </div>
            {shareError && (
              <p role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-200">{shareError}</p>
            )}
          </form>
        )}

        {onShare && !editing && (
          <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-3">O pidan todos desde este teléfono:</p>
        )}

        <div className="flex items-center justify-center gap-8 mb-8">
          <button
            onClick={removeLast}
            disabled={rows.length <= 1}
            className="w-14 h-14 rounded-full bg-cream-200 dark:bg-night-100 border border-cream-300 dark:border-night-50 text-charcoal-800 dark:text-cream-100 flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 hover:bg-cream-300 dark:hover:bg-night-50 no-tap-highlight"
            aria-label="Menos personas"
          >
            <Minus className="w-6 h-6" strokeWidth={3} />
          </button>
          <span
            key={rows.length}
            className="text-5xl font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums animate-pop w-12 text-center"
            aria-live="polite"
          >
            {rows.length}
          </span>
          <button
            onClick={addRow}
            className="w-14 h-14 rounded-full bg-terracotta-500 text-white flex items-center justify-center shadow-soft transition-all active:scale-90 hover:bg-terracotta-600 no-tap-highlight"
            aria-label="Más personas"
          >
            <Plus className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>

        <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-3">Nombres</p>
      </div>

      <div className="flex-1 px-5 space-y-3 overflow-y-auto pb-32">
        {rows.map((row, i) => (
          <div key={row.key} className="flex items-center gap-3 animate-slideUp" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="w-9 h-9 rounded-full bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center font-bold text-sm shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 relative">
              <input
                value={row.name}
                onChange={(e) => updateName(row.key, e.target.value)}
                placeholder={`Persona ${i + 1}`}
                aria-label={`Nombre de la persona ${i + 1}`}
                className="w-full px-4 py-3.5 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 focus:bg-white dark:focus:bg-night-200 transition-colors"
              />
              {row.hasOrder && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-olive-600 dark:text-olive-200 bg-olive-100 dark:bg-olive-600/25 px-2 py-0.5 rounded-full">
                  Ya pidió
                </span>
              )}
            </div>
            <button
              onClick={() => removeRow(row)}
              disabled={rows.length <= 1}
              className="w-11 h-11 rounded-full text-charcoal-700 dark:text-cream-200 hover:bg-cream-200 dark:hover:bg-night-100 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 no-tap-highlight shrink-0"
              aria-label={`Quitar a ${row.name || `persona ${i + 1}`}`}
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100">
        <Button onClick={() => onContinue(rows.map((r) => ({ id: r.id, name: r.name })))} disabled={!canContinue}>
          {editing ? 'Guardar cambios' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
}
