import { useState } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Theme } from '@/hooks/useTheme';
import { CODE_PATTERN, normalizeCode } from '@/shared/backend';
import { rememberName, rememberedName } from '@/lib/myName';

interface Props {
  initialCode?: string;
  busy: boolean;
  error: string | null;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function JoinScreen({ initialCode, busy, error, onJoin, onBack, theme, onToggleTheme }: Props) {
  const [code, setCode] = useState(() => normalizeCode(initialCode ?? ''));
  const [name, setName] = useState(rememberedName);
  const validCode = CODE_PATTERN.test(code);
  const canJoin = validCode && name.trim().length > 0 && !busy;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <form
        className="flex-1 px-5 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canJoin) return;
          rememberName(name);
          onJoin(code, name.trim());
        }}
      >
        <div>
          <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">Unirme a una mesa</h2>
          <p className="text-charcoal-700 dark:text-cream-200">Pedile el código a quien abrió la pupuseada.</p>
        </div>

        <div>
          <label htmlFor="join-code" className="block text-sm font-bold text-charcoal-800 dark:text-cream-100 mb-2">
            Código de la mesa
          </label>
          <input
            id="join-code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 5))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="K7Q2X"
            className="w-full px-4 py-4 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-900 dark:text-cream-50 placeholder:text-charcoal-700/40 dark:placeholder:text-cream-200/30 focus:outline-none focus:border-terracotta-400 font-display text-3xl font-bold tracking-[0.3em] text-center uppercase"
          />
        </div>

        <div>
          <label htmlFor="join-name" className="block text-sm font-bold text-charcoal-800 dark:text-cream-100 mb-2">
            Tu nombre
          </label>
          <input
            id="join-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Como te conocen en la mesa"
            className="w-full px-4 py-3.5 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-400"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4 text-sm font-semibold text-red-700 dark:text-red-200">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!canJoin}>
          {busy ? 'Entrando…' : 'Unirme'}
        </Button>
      </form>
    </div>
  );
}
