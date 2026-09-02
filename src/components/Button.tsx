import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
}: Props) {
  const base =
    'w-full rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 no-tap-highlight';
  const variants = {
    primary: 'bg-terracotta-400 text-white shadow-pop hover:bg-terracotta-500 py-4 text-lg',
    secondary:
      'bg-cream-200 text-charcoal-800 dark:bg-night-100 dark:text-cream-100 hover:bg-cream-300 dark:hover:bg-night-50 py-4 text-lg',
    ghost:
      'bg-transparent text-charcoal-700 dark:text-cream-200 hover:bg-cream-200 dark:hover:bg-night-100 py-3 text-base',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
