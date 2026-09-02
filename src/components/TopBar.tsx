import { ChevronLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  onBack?: () => void;
  right?: ReactNode;
}

export function TopBar({ onBack, right }: Props) {
  return (
    <div className="sticky top-0 z-20 bg-cream-100/85 dark:bg-night-400/85 backdrop-blur-md px-5 pt-5 pb-3">
      <div className="flex items-center justify-between min-h-[2.5rem]">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-charcoal-700 dark:text-cream-200 font-semibold text-sm -ml-1 active:scale-95 transition-transform no-tap-highlight"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            Atrás
          </button>
        ) : (
          <span />
        )}
        {right}
      </div>
    </div>
  );
}
