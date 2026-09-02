import { useState, useMemo } from 'react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Minus, Plus } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';

interface Props {
  onBack: () => void;
  onContinue: (people: string[]) => void;
  initialPeople: string[];
  theme: Theme;
  onToggleTheme: () => void;
}

export function PeopleScreen({ onBack, onContinue, initialPeople, theme, onToggleTheme }: Props) {
  const [count, setCount] = useState(initialPeople.length || 2);
  const [names, setNames] = useState<string[]>(() => {
    const base = initialPeople.length ? initialPeople : ['', ''];
    return [...base];
  });

  const syncedNames = useMemo(() => {
    const arr = [...names];
    while (arr.length < count) arr.push('');
    arr.length = count;
    return arr;
  }, [names, count]);

  const updateName = (i: number, v: string) => {
    const next = [...syncedNames];
    next[i] = v;
    setNames(next);
  };

  const handleCount = (next: number) => {
    setCount(Math.max(1, next));
  };

  const canContinue = syncedNames.every((n) => n.trim().length > 0);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onBack={onBack} right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />
      <div className="px-5 pb-2">
        <h2 className="font-display text-3xl font-bold text-charcoal-900 dark:text-cream-50 mb-1">
          ¿Quiénes somos?
        </h2>
        <p className="text-charcoal-700 dark:text-cream-200 mb-6">¿Cuántas personas?</p>

        <div className="flex items-center justify-center gap-8 mb-8">
          <button
            onClick={() => handleCount(count - 1)}
            disabled={count <= 1}
            className="w-14 h-14 rounded-full bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 hover:bg-cream-300 dark:hover:bg-night-50 no-tap-highlight"
            aria-label="Menos personas"
          >
            <Minus className="w-6 h-6" strokeWidth={3} />
          </button>
          <span
            key={count}
            className="text-5xl font-extrabold text-charcoal-900 dark:text-cream-50 tabular-nums animate-pop w-12 text-center"
          >
            {count}
          </span>
          <button
            onClick={() => handleCount(count + 1)}
            className="w-14 h-14 rounded-full bg-terracotta-400 text-white flex items-center justify-center shadow-soft transition-all active:scale-90 hover:bg-terracotta-500 no-tap-highlight"
            aria-label="Más personas"
          >
            <Plus className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>

        <p className="text-sm font-semibold text-charcoal-700 dark:text-cream-200 mb-3">Nombres</p>
      </div>

      <div className="flex-1 px-5 space-y-3 overflow-y-auto pb-4">
        {syncedNames.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-3 animate-slideUp"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="w-9 h-9 rounded-full bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center font-bold text-sm shrink-0">
              {i + 1}
            </div>
            <input
              value={name}
              onChange={(e) => updateName(i, e.target.value)}
              placeholder={`Persona ${i + 1}`}
              className="flex-1 px-4 py-3.5 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/40 dark:placeholder:text-cream-200/40 focus:outline-none focus:border-terracotta-300 focus:bg-white dark:focus:bg-night-200 transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 bg-cream-100/90 dark:bg-night-400/90 backdrop-blur-md px-5 py-4 safe-bottom">
        <Button onClick={() => onContinue(syncedNames.map((n) => n.trim()))} disabled={!canContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
