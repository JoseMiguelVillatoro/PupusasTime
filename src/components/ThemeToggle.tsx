import { Sun, Moon } from 'lucide-react';
import { Theme } from '@/hooks/useTheme';

interface Props {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cream-200 dark:bg-night-100 text-charcoal-700 dark:text-cream-100 text-sm font-semibold transition-all active:scale-95 hover:bg-cream-300 dark:hover:bg-night-50 no-tap-highlight"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden xs:inline">Claro</span>
        </>
      ) : (
        <>
          <Moon className="w-4 h-4" strokeWidth={2.5} />
          <span className="hidden xs:inline">Oscuro</span>
        </>
      )}
    </button>
  );
}
