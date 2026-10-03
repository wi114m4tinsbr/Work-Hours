import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Clock3, Crown, Infinity as InfinityIcon, Lock, X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Access } from '../lib/quota';
import { reachedLabel, type ToolLimit } from '../lib/plans';

type Lang = 'pt' | 'en' | 'es';

const C = {
  pt: { admin: 'Admin · ilimitado', unlimited: 'ilimitado', plan: 'plano', off: 'Não incluído', ok: 'Entendi' },
  en: { admin: 'Admin · unlimited', unlimited: 'unlimited', plan: 'plan', off: 'Not included', ok: 'Got it' },
  es: { admin: 'Admin · ilimitado', unlimited: 'ilimitado', plan: 'plan', off: 'No incluido', ok: 'Entendido' },
};

/**
 * One allowance pill for every tool: unlimited for the owner and unlimited plans, green with what
 * is left on limited plans, red once the allowance for the period is used up or not included.
 */
export function UsageBadge({ quota, language, available, progress, className, testId = 'usage-badge' }: {
  quota: { access: Access; planName: string; limit: ToolLimit; reached: boolean; blocked: boolean };
  language: Lang;
  /** What is still available, e.g. "1 fatura disponível hoje" or "12:30 restantes hoje". */
  available: string;
  /** Share of the allowance already used, 0 to 1 (limited plans only). */
  progress?: number;
  className?: string;
  testId?: string;
}) {
  const t = C[language] || C.pt;
  const { access, planName, limit, reached, blocked } = quota;
  const unlimited = access === 'admin' || limit.mode === 'unlimited';
  const tone = unlimited ? 'unlimited' : reached || blocked ? 'limit' : 'ok';
  const label = access === 'admin' ? t.admin
    : unlimited ? `${planName} · ${t.unlimited}`
    : blocked ? `${t.off} · ${t.plan} ${planName}`
    : reached ? `${reachedLabel[language][limit.period]} · ${t.plan} ${planName}`
    : `${planName} · ${available}`;
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
      <span>{label}</span>
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
