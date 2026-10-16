import { Button } from '@/components/Button';
import { PupusaIcon } from '@/components/PupusaIcon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Theme } from '@/hooks/useTheme';

interface Props {
  onStart: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function HomeScreen({ onStart, theme, onToggleTheme }: Props) {
  return (
    <div className="min-h-screen flex flex-col px-6 py-10 relative overflow-hidden">
      {/* theme toggle */}
      <div className="flex justify-end mb-2">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* floating decorative pupusas */}
        <div className="absolute top-20 left-6 opacity-20 dark:opacity-10 animate-wiggle">
          <PupusaIcon type="fq" className="w-16 h-16" />
        </div>
        <div className="absolute top-32 right-8 opacity-20 dark:opacity-10 animate-wiggle" style={{ animationDelay: '0.3s' }}>
          <PupusaIcon type="ql" className="w-12 h-12" />
        </div>
        <div className="absolute bottom-32 left-10 opacity-15 dark:opacity-8 animate-wiggle" style={{ animationDelay: '0.5s' }}>
          <PupusaIcon type="revuelta" className="w-14 h-14" />
        </div>

        <div className="flex flex-col items-center text-center max-w-sm animate-slideUp">
          <div className="mb-6">
            <img
              src="/logo.png"
              alt="Pupusas Time"
              className="w-52 h-52 object-contain"
            />
          </div>

          <h1 className="font-display font-bold text-charcoal-900 dark:text-cream-50 text-4xl tracking-tight leading-none">
            PUPUSAS TIME
          </h1>
          <span className="text-5xl mt-2">🫓</span>

          <h2 className="font-display text-2xl text-charcoal-800 dark:text-cream-100 mt-8 mb-3">
            ¿Vamos por pupusas?
          </h2>
          <p className="text-charcoal-700 dark:text-cream-200 text-lg leading-relaxed mb-10">
            Cada quien pide. Nosotros hacemos las cuentas.
          </p>

          <Button onClick={onStart}>Empezar pupuseada</Button>

          <p className="text-sm text-charcoal-700/60 dark:text-cream-200/50 mt-6">
            Sin cuentas. Sin login. Solo pupusas.
          </p>
        </div>
      </div>
    </div>
  );
}
