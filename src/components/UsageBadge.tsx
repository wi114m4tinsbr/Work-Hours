import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Clock3, Crown, Infinity as InfinityIcon, Lock, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Access } from '../lib/quota';

type Lang = 'pt' | 'en' | 'es';

const C = {
  pt: { admin: 'Admin · ilimitado', premium: 'Premium · ilimitado', free: 'Grátis', reached: 'Limite diário atingido', plan: 'plano grátis', ok: 'Entendi' },
  en: { admin: 'Admin · unlimited', premium: 'Premium · unlimited', free: 'Free', reached: 'Daily limit reached', plan: 'free plan', ok: 'Got it' },
  es: { admin: 'Admin · ilimitado', premium: 'Premium · ilimitado', free: 'Gratis', reached: 'Límite diario alcanzado', plan: 'plan gratis', ok: 'Entendido' },
};

/**
 * One allowance pill for every tool: unlimited for the owner and Premium, green with what is
 * left for free accounts, red once the daily allowance is used up.
 */
export function UsageBadge({ access, language, available, reached, progress, className, testId = 'usage-badge' }: {
  access: Access;
  language: Lang;
  /** What a free account still has, e.g. "1 fatura disponível hoje" or "12:30 restantes hoje". */
  available: string;
  reached: boolean;
  /** Share of the allowance already used, 0 to 1 (free accounts only). */
  progress?: number;
  className?: string;
  testId?: string;
}) {
  const t = C[language] || C.pt;
  const unlimited = access !== 'free';
  const tone = unlimited ? 'unlimited' : reached ? 'limit' : 'ok';
  return (
    <div
      data-testid={testId}
      data-state={tone}
      role="status"
      className={cn(
        'relative inline-flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-lg border px-3 text-xs font-bold whitespace-nowrap',
        tone === 'unlimited' && 'bg-primary-light text-primary border-primary/20 dark:bg-white/10 dark:text-white dark:border-white/15',
        tone === 'ok' && 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        tone === 'limit' && 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800',
        className,
      )}
    >
      {tone === 'unlimited' ? (access === 'admin' ? <InfinityIcon size={14} /> : <Crown size={14} />) : tone === 'ok' ? <CheckCircle2 size={14} /> : <Lock size={14} />}
      <span>
        {tone === 'unlimited' ? (access === 'admin' ? t.admin : t.premium) : tone === 'ok' ? `${t.free} · ${available}` : `${t.reached} · ${t.plan}`}
      </span>
      {tone !== 'unlimited' && progress !== undefined && (
        <span aria-hidden="true" className="absolute left-0 bottom-0 h-[3px] bg-current opacity-40 transition-all" style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
      )}
    </div>
  );
}

/** Notification explaining why a tool is limited, with the time it opens again when known. */
export function QuotaNotice({ open, title, message, language, onClose, tone = 'limit' }: {
  open: boolean;
  title: string;
  message: string;
  language: Lang;
  onClose: () => void;
  tone?: 'limit' | 'warn';
}) {
  const t = C[language] || C.pt;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          role="alert"
          data-testid="quota-notice"
          className="fixed left-1/2 top-20 z-[130] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-stone-900 shadow-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <span className={cn('w-9 h-9 shrink-0 rounded-xl flex items-center justify-center',
              tone === 'limit' ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300')}>
              {tone === 'limit' ? <Lock size={17} /> : <Clock3 size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-stone-900 dark:text-white text-sm">{title}</p>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{message}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={t.ok} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white"><X size={16} /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
