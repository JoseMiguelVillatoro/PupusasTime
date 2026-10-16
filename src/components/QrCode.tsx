import { useEffect, useState } from 'react';

interface Props {
  value: string;
  label: string;
  className?: string;
}

/** Código QR generado en el teléfono, sin servicios externos. */
export function QrCode({ value, label, className = 'w-28 h-28' }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // La librería se carga solo cuando hay un QR que mostrar.
    import('qrcode')
      .then((m) => m.default.toDataURL(value, { margin: 1, width: 320, color: { dark: '#2A2520', light: '#FFFFFF' } }))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null));
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className={`rounded-2xl bg-white p-1.5 border border-cream-200 dark:border-night-100 shrink-0 ${className}`}>
      {src ? <img src={src} alt={label} className="w-full h-full" /> : <div className="w-full h-full animate-pulse bg-cream-100 rounded-xl" />}
    </div>
  );
}
