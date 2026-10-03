import { Bell, BellOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSoundMuted } from '../lib/notifySound';

type Lang = 'pt' | 'en' | 'es';

const C = {
  pt: { on: 'Som ligado', off: 'Som desligado', hintOn: 'Clique para silenciar o som de novas mensagens', hintOff: 'Clique para ligar o som de novas mensagens' },
  en: { on: 'Sound on', off: 'Sound off', hintOn: 'Click to mute the new message sound', hintOff: 'Click to turn the new message sound on' },
  es: { on: 'Sonido activado', off: 'Sonido silenciado', hintOn: 'Haz clic para silenciar el sonido de mensajes nuevos', hintOff: 'Haz clic para activar el sonido de mensajes nuevos' },
};

/** Mute or unmute the new-message chime on this device. */
export function SoundToggle({ language, className }: { language: Lang; className?: string }) {
  const t = C[language] || C.pt;
  const [muted, setMuted] = useSoundMuted();
  return (
    <button type="button" onClick={() => setMuted(!muted)} aria-pressed={!muted} title={muted ? t.hintOff : t.hintOn} data-testid="sound-toggle" data-muted={muted ? '1' : '0'}
      className={cn('h-8 rounded-lg px-2.5 inline-flex items-center gap-1.5 text-xs font-bold border transition-colors',
        muted ? 'border-stone-200 dark:border-white/10 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
          : 'border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300 hover:bg-primary-light dark:hover:bg-white/10', className)}>
      {muted ? <BellOff size={14} /> : <Bell size={14} />}<span className="hidden sm:inline">{muted ? t.off : t.on}</span>
    </button>
  );
}
