import { useState } from 'react';
import { Check, Copy, Lock, LogOut, MessageCircle, Pencil, Plus, Unlock, WifiOff, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { TopBar } from '@/components/TopBar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { QrCode } from '@/components/QrCode';
import { Theme } from '@/hooks/useTheme';
import type { PersonOrder } from '@/data/pupusa';
import { consolidateOrders, extrasCount, personTotal, whatsappShareUrl } from '@/data/consolidation';
import type { SharedInfo } from '@/state/pupuseada';
import { shareUrl } from '@/shared/backend';
import { copyText } from '@/lib/clipboard';

interface Props {
  shared: SharedInfo;
  people: PersonOrder[];
  restaurantName: string | null;
  isHost: boolean;
  busy: boolean;
  error: string | null;
  offline: boolean;
  onOrderFor: (personId: string) => void;
  onAddOffline: (name: string) => void;
  onRemove: (personId: string) => void;
  onLock: () => void;
  onReopen: () => void;
  onViewOrder: () => void;
  onLeave: () => void;
  onDismissError: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function LobbyScreen({
  shared,
  people,
  restaurantName,
  isHost,
  busy,
  error,
  offline,
  onOrderFor,
  onAddOffline,
  onRemove,
  onLock,
  onReopen,
  onViewOrder,
  onLeave,
  onDismissError,
  theme,
  onToggleTheme,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [offlineName, setOfflineName] = useState('');
  const [addingOffline, setAddingOffline] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const open = shared.status === 'ordering';
  const link = shareUrl(shared.code);
  const total = consolidateOrders(people).total;
  const drinks = people.reduce((s, p) => s + extrasCount(p), 0);
  const readyCount = people.filter((p) => shared.meta[p.id]?.done).length;
  const me = people.find((p) => p.id === shared.myParticipantId);
  const hostPerson = people.find((p) => shared.meta[p.id]?.uid === shared.hostUid);

  const invite = `🫓 ¡Vamos por pupusas${restaurantName ? ` a ${restaurantName}` : ''}! Pedí desde tu teléfono: ${link} (código ${shared.code})`;

  const handleCopy = async () => {
    await copyText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar right={<ThemeToggle theme={theme} onToggle={onToggleTheme} />} />

      <div className="px-5 pb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-700 dark:text-cream-200">Pupuseada en vivo</p>
          <h2 className="font-display text-2xl font-bold text-charcoal-900 dark:text-cream-50 truncate">{restaurantName ?? 'Nuestra mesa'}</h2>
        </div>
        {offline ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-terracotta-50 dark:bg-terracotta-700/30 text-terracotta-700 dark:text-terracotta-100 text-xs font-bold shrink-0" role="status">
            <WifiOff className="w-3.5 h-3.5" /> Sin señal
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-olive-100 dark:bg-olive-600/25 text-olive-600 dark:text-olive-200 text-xs font-bold shrink-0" role="status">
            <span className="w-2 h-2 rounded-full bg-olive-500" /> En vivo
          </span>
        )}
      </div>

      <div className="flex-1 px-5 pt-3 space-y-5 overflow-y-auto pb-48">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 p-4">
            <p className="flex-1 text-sm font-semibold text-red-700 dark:text-red-200">{error}</p>
            <button onClick={onDismissError} aria-label="Cerrar aviso" className="w-8 h-8 -m-1 flex items-center justify-center text-red-700 dark:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Código e invitación */}
        <section className="p-4 rounded-3xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 flex gap-4 items-center">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-charcoal-700 dark:text-cream-200">Código de la mesa</p>
            <p className="font-display text-4xl font-bold tracking-[0.15em] text-terracotta-600 dark:text-terracotta-300" aria-label={`Código ${shared.code.split('').join(' ')}`}>
              {shared.code}
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
          <QrCode value={link} label={`Código QR para unirse a la mesa ${shared.code}`} />
        </section>

        {!open && (
          <div className="rounded-2xl bg-cream-200 dark:bg-night-100 p-4 flex items-center gap-3" role="status">
            <Lock className="w-5 h-5 text-charcoal-800 dark:text-cream-100 shrink-0" />
            <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-100">
              {isHost ? 'Cerraste el pedido. Ya no se pueden hacer cambios desde otros teléfonos.' : `${hostPerson?.name ?? 'El anfitrión'} cerró el pedido.`}
            </p>
          </div>
        )}

        {/* Personas */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-xl font-bold text-charcoal-900 dark:text-cream-50">En la mesa</h3>
            <span className="text-sm font-bold text-charcoal-700 dark:text-cream-200">
              {readyCount} de {people.length} {people.length === 1 ? 'listo' : 'listos'}
            </span>
          </div>
          <ul className="space-y-2">
            {people.map((p) => {
              const meta = shared.meta[p.id];
              const isMe = p.id === shared.myParticipantId;
              const noPhone = meta?.uid === null;
              const isTheHost = meta?.uid === shared.hostUid;
              const done = Boolean(meta?.done);
              const n = personTotal(p);
              const x = extrasCount(p);
              const mineToOrder = meta?.managedBy === shared.myUid;
              const canOrder = isHost || (mineToOrder && open);
              const manager = noPhone ? people.find((x) => shared.meta[x.id]?.uid && shared.meta[x.id]?.uid === meta?.managedBy) : undefined;
              const detail = [
                isTheHost ? 'Anfitrión' : null,
                noPhone ? (manager ? `Pide con ${manager.id === shared.myParticipantId ? 'vos' : manager.name}` : 'Sin teléfono') : null,
                done ? plural(n, 'pupusa', 'pupusas') + (x > 0 ? ` · ${plural(x, 'extra', 'extras')}` : '') : 'Todavía no pidió',
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl border ${
                    isMe ? 'bg-white dark:bg-night-200 border-terracotta-300 dark:border-terracotta-500/50' : 'bg-cream-50 dark:bg-night-300 border-cream-200 dark:border-night-100'
                  } ${noPhone ? 'border-dashed' : ''}`}
                >
                  <span className="w-10 h-10 rounded-full bg-olive-100 dark:bg-olive-600/30 text-olive-600 dark:text-olive-200 flex items-center justify-center font-bold shrink-0" aria-hidden="true">
                    {p.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-charcoal-900 dark:text-cream-50 truncate">
                      {p.name}
                      {isMe && <span className="font-semibold text-terracotta-600 dark:text-terracotta-300"> · vos</span>}
                    </p>
                    <p className="text-sm text-charcoal-700 dark:text-cream-200 truncate">{detail}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      done ? 'bg-olive-100 dark:bg-olive-600/25 text-olive-600 dark:text-olive-200' : 'bg-cream-200 dark:bg-night-100 text-charcoal-700 dark:text-cream-200'
                    }`}
                  >
                    {done ? 'Listo' : 'Pendiente'}
                  </span>
                  {canOrder && !isMe && (
                    <button
                      onClick={() => onOrderFor(p.id)}
                      className="w-11 h-11 -mr-1 rounded-full flex items-center justify-center text-charcoal-700 dark:text-cream-200 hover:bg-cream-200 dark:hover:bg-night-100 no-tap-highlight shrink-0"
                      aria-label={`Pedir por ${p.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {(isHost ? !isTheHost : noPhone && mineToOrder && open) && (
                    <button
                      onClick={() => onRemove(p.id)}
                      disabled={busy}
                      className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-charcoal-700 dark:text-cream-200 hover:bg-cream-200 dark:hover:bg-night-100 disabled:opacity-40 no-tap-highlight shrink-0"
                      aria-label={`Quitar a ${p.name} de la mesa`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {(isHost || open) && (
            <div className="mt-3">
              {addingOffline ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!offlineName.trim()) return;
                    onAddOffline(offlineName.trim());
                    setOfflineName('');
                    setAddingOffline(false);
                  }}
                >
                  <label htmlFor="offline-name" className="sr-only">
                    Nombre de quien pide con vos
                  </label>
                  <input
                    id="offline-name"
                    autoFocus
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                    maxLength={40}
                    placeholder="Nombre"
                    className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-cream-50 dark:bg-night-300 border border-cream-200 dark:border-night-100 text-charcoal-800 dark:text-cream-100 placeholder:text-charcoal-700/50 focus:outline-none focus:border-terracotta-400"
                  />
                  <button type="submit" disabled={!offlineName.trim() || busy} className="px-4 rounded-2xl bg-terracotta-500 text-white font-bold disabled:opacity-40 no-tap-highlight">
                    Agregar
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddingOffline(true)}
                  className="w-full flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-dashed border-terracotta-300 dark:border-terracotta-600/50 text-terracotta-700 dark:text-terracotta-200 font-bold no-tap-highlight"
                >
                  <Plus className="w-4 h-4" /> Agregar a alguien que pide con vos
                </button>
              )}
            </div>
          )}
        </section>

        {/* Total en vivo */}
        <section className="rounded-2xl bg-terracotta-50 dark:bg-terracotta-700/20 border-2 border-terracotta-200 dark:border-terracotta-600/30 p-4 flex items-center gap-4" aria-live="polite">
          <span className="font-display text-4xl font-bold text-terracotta-600 dark:text-terracotta-300 tabular-nums">{total}</span>
          <div>
            <p className="font-bold text-charcoal-900 dark:text-cream-50">{total === 1 ? 'pupusa hasta ahora' : 'pupusas hasta ahora'}</p>
            {drinks > 0 && <p className="text-sm text-charcoal-700 dark:text-cream-200">{plural(drinks, 'bebida o extra', 'bebidas y extras')}</p>}
          </div>
        </section>

        {/* Host: reabrir; todos: salir */}
        <section className="space-y-2 pt-2">
          {isHost && !open && (
            <Button variant="ghost" onClick={onReopen} disabled={busy}>
              <span className="inline-flex items-center gap-2">
                <Unlock className="w-4 h-4" /> Reabrir el pedido
              </span>
            </Button>
          )}
          {confirmLeave ? (
            <div className="rounded-2xl border-2 border-cream-300 dark:border-night-50 p-4 space-y-3" role="alertdialog" aria-labelledby="leave-title">
              <p id="leave-title" className="font-bold text-charcoal-900 dark:text-cream-50">¿Salir de esta mesa?</p>
              <p className="text-sm text-charcoal-700 dark:text-cream-200">
                {isHost
                  ? 'La mesa sigue abierta para los demás. Podés volver a entrar con el código.'
                  : 'Tu pedido se queda en la mesa. Podés volver a entrar con el código.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setConfirmLeave(false)} className="!py-3 !text-base">
                  Cancelar
                </Button>
                <Button onClick={onLeave} className="!py-3 !text-base">
                  Salir
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
              <span className="inline-flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Salir de la mesa
              </span>
            </Button>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-cream-100/95 dark:bg-night-400/95 backdrop-blur-md px-5 py-4 safe-bottom border-t border-cream-200 dark:border-night-100 space-y-2 z-10">
        {me && open && (
          <Button variant={isHost ? 'secondary' : 'primary'} onClick={() => onOrderFor(me.id)}>
            {shared.meta[me.id]?.done ? 'Cambiar mi pedido' : 'Hacer mi pedido'}
          </Button>
        )}
        {isHost && open && (
          <Button onClick={onLock} disabled={busy || total === 0}>
            Cerrar pedido y armar la orden
          </Button>
        )}
        {!open && <Button onClick={onViewOrder}>Ver la orden</Button>}
      </div>
    </div>
  );
}
