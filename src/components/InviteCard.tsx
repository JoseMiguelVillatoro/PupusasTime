import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { QrCode } from '@/components/QrCode';
import { whatsappShareUrl } from '@/data/consolidation';
import { shareUrl } from '@/shared/backend';
import { copyText } from '@/lib/clipboard';

interface Props {
  code: string;
  restaurantName: string | null;
  /** Texto corto arriba del código. */
  title?: string;
}

/** Código, QR y botones para invitar a la mesa. */
export function InviteCard({ code, restaurantName, title = 'Código de la mesa' }: Props) {
  const [copied, setCopied] = useState(false);
  const link = shareUrl(code);
  const invite = `🫓 ¡Vamos por pupusas${restaurantName ? ` a ${restaurantName}` : ''}! Pedí desde tu teléfono: ${link} (código ${code})`;

  const handleCopy = async () => {
    await copyText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="p-4 rounded-3xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 flex gap-4 items-center">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-charcoal-700 dark:text-cream-200">{title}</p>
        <p
          className="font-display text-4xl font-bold tracking-[0.15em] text-terracotta-600 dark:text-terracotta-300"
          aria-label={`Código ${code.split('').join(' ')}`}
        >
          {code}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <a
            href={whatsappShareUrl(invite)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-olive-600 text-white text-sm font-bold hover:bg-olive-500 no-tap-highlight"
          >
            <MessageCircle className="w-4 h-4" /> Invitar
          </a>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-cream-200 dark:bg-night-100 text-charcoal-800 dark:text-cream-100 text-sm font-bold no-tap-highlight"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
      </div>
      <QrCode value={link} label={`Código QR para unirse a la mesa ${code}`} />
    </section>
  );
}
