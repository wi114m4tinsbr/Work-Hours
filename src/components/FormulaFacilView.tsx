import { useEffect, useRef, useState } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { ToolIdentity } from './ToolIdentity';
import { UsageBadge, QuotaNotice } from './UsageBadge';
import { cn } from '../lib/utils';
import { FORMULA_ADMIN_FRAME, FORMULA_PUBLIC_FRAME } from '../lib/formulaSession';
import { formatClock, formatWait, type TimeQuota } from '../lib/quota';

const C = {
  pt: {
    back: 'Voltar', show: 'Mostrar na página inicial', on: 'Visível para todos', off: 'Oculta', fail: 'Não foi possível salvar.', wait: 'Preparando o acesso…',
    left: 'restantes hoje', loginTitle: 'Entre para usar a Fórmula Fácil', loginBody: 'No plano grátis você tem 15 minutos por dia. No Premium o uso é ilimitado.', login: 'Entrar com Google',
    warnTitle: 'Seu tempo está acabando', warnBody: (m: string) => `Restam ${m} de uso grátis da Fórmula Fácil hoje.`,
    lockTitle: 'Limite diário atingido', lockBody: (w: string) => `Seus 15 minutos grátis de hoje acabaram. A Fórmula Fácil libera de novo em ${w}, ou na hora com o Premium.`,
    unlocked: 'Seu tempo foi renovado.', reload: 'Abrir de novo',
  },
  en: {
    back: 'Back', show: 'Show on home page', on: 'Visible to everyone', off: 'Hidden', fail: 'Could not save.', wait: 'Preparing access…',
    left: 'left today', loginTitle: 'Sign in to use Fórmula Fácil', loginBody: 'The free plan includes 15 minutes per day. Premium is unlimited.', login: 'Sign in with Google',
    warnTitle: 'Your time is running out', warnBody: (m: string) => `${m} of free Fórmula Fácil time left today.`,
    lockTitle: 'Daily limit reached', lockBody: (w: string) => `Your 15 free minutes for today are used up. Fórmula Fácil opens again in ${w}, or right away with Premium.`,
    unlocked: 'Your time has been renewed.', reload: 'Open again',
  },
  es: {
    back: 'Volver', show: 'Mostrar en la página de inicio', on: 'Visible para todos', off: 'Oculta', fail: 'No se pudo guardar.', wait: 'Preparando el acceso…',
    left: 'restantes hoy', loginTitle: 'Inicia sesión para usar Fórmula Fácil', loginBody: 'El plan gratis incluye 15 minutos por día. Premium es ilimitado.', login: 'Entrar con Google',
    warnTitle: 'Se te acaba el tiempo', warnBody: (m: string) => `Quedan ${m} de uso gratis de Fórmula Fácil hoy.`,
    lockTitle: 'Límite diario alcanzado', lockBody: (w: string) => `Se acabaron tus 15 minutos gratis de hoy. Fórmula Fácil vuelve a abrir en ${w}, o al instante con Premium.`,
    unlocked: 'Tu tiempo se renovó.', reload: 'Abrir de nuevo',
  },
};

const SAVE_EVERY_SECONDS = 15;
const WARN_AT = [300, 60];

/**
 * Shift Hours frame around the standalone Fórmula Fácil pages. The tool HTML is loaded
 * untouched in a full-height iframe; only the bar with Voltar comes from the site.
 */
export function FormulaFacilView({ variant, language, onBack, inApp, ready = true, publicSwitch, quota, onLogin }: {
  variant: 'public' | 'admin';
  language: 'pt' | 'en' | 'es';
  onBack: () => void;
  /** Inside the signed-in app the site header (4rem) sits above this bar. */
  inApp: boolean;
  /** The admin frame waits until the owner's server session is in place. */
  ready?: boolean;
  /** Owner only: switch that opens the admin version to every visitor from the home page. */
  publicSwitch?: { enabled: boolean; onChange: (enabled: boolean) => Promise<void> };
  /** Public version for signed-in users: 15 minutes a day on the free plan. */
  quota?: TimeQuota;
  /** Public version without login: ask the visitor to sign in first. */
  onLogin?: () => void;
}) {
  const t = C[language] || C.pt;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const title = variant === 'admin' ? 'Fórmula Fácil Admin' : 'Fórmula Fácil';

  const timed = !!quota && quota.access === 'free';
  const quotaRef = useRef(quota);
  quotaRef.current = quota;
  const usedRef = useRef(quota?.usedSeconds ?? 0);
  const savedRef = useRef(usedRef.current);
  const warnedRef = useRef(new Set<number>());
  const [used, setUsed] = useState(usedRef.current);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<'warn' | 'lock' | null>(null);

  // Another tab may have used time too: never count backwards.
  useEffect(() => {
    if (quota && quota.usedSeconds > usedRef.current) {
      usedRef.current = quota.usedSeconds;
      setUsed(quota.usedSeconds);
    }
  }, [quota?.usedSeconds]);

  const lockedUntil = quota?.lockedUntil ?? (timed && used >= (quota?.limitSeconds ?? Infinity) ? now + 24 * 3600 * 1000 : null);
  const locked = timed && (lockedUntil !== null && now < lockedUntil);
  const lockExpired = timed && quota?.lockedUntil != null && now >= quota.lockedUntil;
  const remaining = timed ? Math.max(0, quota!.limitSeconds - used) : Infinity;

  const persist = () => {
    const q = quotaRef.current;
    if (!q || q.access !== 'free' || usedRef.current === savedRef.current) return;
    savedRef.current = usedRef.current;
    q.save(usedRef.current).catch(() => { savedRef.current = -1; });
  };

  useEffect(() => {
    if (!timed) return;
    const tick = window.setInterval(() => {
      setNow(Date.now());
      const q = quotaRef.current;
      if (!q || q.lockedUntil || document.visibilityState !== 'visible') return;
      if (usedRef.current >= q.limitSeconds) return;
      usedRef.current += 1;
      setUsed(usedRef.current);
      const left = q.limitSeconds - usedRef.current;
      if (WARN_AT.includes(left) && !warnedRef.current.has(left)) {
        warnedRef.current.add(left);
        setNotice('warn');
      }
      if (left <= 0) {
        setNotice('lock');
        persist();
      } else if (usedRef.current - Math.max(0, savedRef.current) >= SAVE_EVERY_SECONDS) {
        persist();
      }
    }, 1000);
    const flush = () => persist();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
      persist();
    };
  }, [timed]);

  const toggle = async () => {
    if (!publicSwitch || saving) return;
    setSaving(true);
    setError(false);
    try {
      await publicSwitch.onChange(!publicSwitch.enabled);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const showFrame = ready && !onLogin && !locked && !lockExpired;

  return (
    <div className={cn('flex flex-col w-full', inApp ? 'h-[calc(100dvh-4rem)]' : 'h-[100dvh]')} data-testid="formula-view">
      <div className="shrink-0 bg-white/95 dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 shadow-sm">
        <div className="h-12 w-full max-w-7xl mx-auto flex items-center gap-3 px-4">
          <ToolIdentity title={title} language={language} backLabel={t.back} onBack={onBack} />
          {quota && (
            <UsageBadge
              access={quota.access}
              language={language}
              reached={locked || lockExpired}
              available={`${formatClock(remaining)} ${t.left}`}
              progress={timed ? used / quota.limitSeconds : undefined}
              className="ml-auto h-8"
              testId="formula-usage"
            />
          )}
          {publicSwitch && (
            <div className="ml-auto flex items-center gap-2 min-w-0">
              {error && <span className="hidden sm:inline text-xs font-semibold text-red-500">{t.fail}</span>}
              <span className="hidden md:inline text-xs font-semibold text-stone-500 dark:text-stone-300 whitespace-nowrap">{t.show}</span>
              <button
                type="button"
                role="switch"
                aria-checked={publicSwitch.enabled}
                aria-label={t.show}
                disabled={saving}
                onClick={toggle}
                data-testid="formula-public-switch"
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  publicSwitch.enabled ? 'bg-primary' : 'bg-stone-300 dark:bg-white/20',
                  saving && 'opacity-60'
                )}
              >
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', publicSwitch.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
              <span className="text-[11px] font-black uppercase tracking-wide text-primary whitespace-nowrap">{publicSwitch.enabled ? t.on : t.off}</span>
            </div>
          )}
        </div>
      </div>
      {showFrame ? (
        <iframe
          title={title}
          src={variant === 'admin' ? FORMULA_ADMIN_FRAME : FORMULA_PUBLIC_FRAME}
          allow="microphone; display-capture; clipboard-write"
          className="flex-1 w-full border-0 bg-white"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          {onLogin ? (
            <div className="max-w-sm text-center" data-testid="formula-login">
              <h2 className="text-xl font-black text-stone-900 dark:text-white">{t.loginTitle}</h2>
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-300">{t.loginBody}</p>
              <button type="button" onClick={onLogin} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white px-5 py-3 font-black"><LogIn size={18} />{t.login}</button>
            </div>
          ) : locked ? (
            <div className="max-w-sm text-center" data-testid="formula-locked">
              <span className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 flex items-center justify-center"><Lock size={22} /></span>
              <h2 className="text-xl font-black text-stone-900 dark:text-white">{t.lockTitle}</h2>
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-300">{t.lockBody(formatWait((lockedUntil ?? now) - now, language))}</p>
            </div>
          ) : lockExpired ? (
            <div className="max-w-sm text-center">
              <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">{t.unlocked}</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-primary text-white px-5 py-2.5 font-black">{t.reload}</button>
            </div>
          ) : (
            <span className="text-sm font-semibold text-stone-400">{t.wait}</span>
          )}
        </div>
      )}
      <QuotaNotice
        open={notice !== null}
        language={language}
        tone={notice === 'lock' ? 'limit' : 'warn'}
        onClose={() => setNotice(null)}
        title={notice === 'lock' ? t.lockTitle : t.warnTitle}
        message={notice === 'lock' ? t.lockBody(formatWait((lockedUntil ?? now + 86400000) - now, language)) : t.warnBody(formatClock(remaining))}
      />
    </div>
  );
}
