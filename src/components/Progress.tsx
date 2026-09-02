import { ReactNode } from 'react';

interface Props {
  step: number;
  total: number;
  label?: string;
}

export function ProgressBar({ step, total, label }: Props) {
  const pct = total > 0 ? (step / total) * 100 : 0;
  return (
    <div className="px-5 pt-4">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-charcoal-700 dark:text-cream-200">
            {label}
          </span>
          <span className="text-sm font-bold text-terracotta-500 tabular-nums">
            {step} de {total}
          </span>
        </div>
      )}
      <div className="h-2 rounded-full bg-cream-200 dark:bg-night-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-terracotta-400 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LiveTotal({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 bg-cream-50 dark:bg-night-300 border-y border-cream-200 dark:border-night-100">
      <span className="text-2xl">🫓</span>
      <span className="font-bold text-charcoal-800 dark:text-cream-100">{children}</span>
    </div>
  );
}
