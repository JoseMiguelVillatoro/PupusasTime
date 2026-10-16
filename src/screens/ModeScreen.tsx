import { useState } from 'react';
import { Smartphone, Users } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { rememberName, rememberedName } from '@/lib/myName';
import { Theme } from '@/hooks/useTheme';

interface Props {
  onBack: () => void;
  /** Todos piden desde este teléfono, pasándolo de persona en persona. */
  onSolo: () => void;
  /** Abrir una mesa con código para que cada quien pida desde su teléfono. */
  onShare: (myName: string) => void;
  busy: boolean;
  error: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}

export function ModeScreen({ onBack, onSolo, onShare, busy, error, theme, onToggleTheme }: Props) {
  const [sharing, setSharing] = useState(false);
  const [name, setName] = useState(rememberedName);

  const card =
    'w-full text-left p-5 rounded-3xl border-2 transition-all active:scale-[0.99] no-tap-highlight';

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <div className="px-5 pb-10">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">¿Cómo van a pedir?</h2>
        <p className="text-charcoal-700 dark:text-cream-200 mb-6">Elegí una. Al final las cuentas salen igual.</p>

        <div className="space-y-4">
          <button
            onClick={onSolo}
            className={`${card} bg-cream-50 dark:bg-night-300 border-cream-200 dark:border-night-100 hover:border-terracotta-300`}
          >
            <span className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-terracotta-100 dark:bg-terracotta-700/30 text-terracotta-600 dark:text-terracotta-200 flex items-center justify-center shrink-0">
                <Smartphone className="w-6 h-6" />
              </span>
              <span>
                <span className="block font-bold text-lg text-charcoal-900 dark:text-cream-50">Todo desde este cel</span>
                <span className="block text-sm text-charcoal-700 dark:text-cream-200">
                  Pasás el cel de persona en persona y cada quien elige lo suyo.
                </span>
              </span>
            </span>
          </button>

          <div
            className={`${card} ${
              sharing
                ? 'bg-olive-100/60 dark:bg-olive-600/15 border-olive-400 dark:border-olive-500/60'
                : 'bg-cream-50 dark:bg-night-300 border-cream-200 dark:border-night-100'
            }`}
          >
            <button onClick={() => setSharing(true)} className="w-full text-left no-tap-highlight" aria-expanded={sharing}>
              <span className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </span>
                <span>
                  <span className="block font-bold text-lg text-charcoal-900 dark:text-cream-50">Cada quien desde su cel</span>
                  <span className="block text-sm text-charcoal-700 dark:text-cream-200">
                    Compartís un código o QR. Cada cel pide lo suyo y lo de su gente; vos ves todo en vivo.
                  </span>
                </span>
              </span>
            </button>

            {sharing && (
              <form
                className="mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim() || busy) return;
                  rememberName(name);
                  onShare(name.trim());
                }}
              >
                <label htmlFor="host-name" className="block text-sm font-semibold text-charcoal-800 dark:text-cream-100 mb-2">
                  Tu nombre
                </label>
                <div className="flex gap-2">
                  <input
                    id="host-name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    placeholder="¿Cómo te llamás?"
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white dark:bg-night-200 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 focus:outline-none focus:border-terracotta-400"
                  />
                  <button
                    type="submit"
                    disabled={!name.trim() || busy}
                    className="px-4 rounded-xl bg-olive-600 text-white font-bold disabled:opacity-40 no-tap-highlight shrink-0"
                  >
                    {busy ? 'Abriendo…' : 'Abrir mesa'}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="mt-2 text-sm font-semibold text-red-700 dark:text-red-200">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
