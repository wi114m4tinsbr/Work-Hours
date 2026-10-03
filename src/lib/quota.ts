
/** Who is using a tool: the owner and Premium are unlimited, free accounts get daily allowances. */
export type Access = 'admin' | 'premium' | 'free';

export type Usage = Record<string, unknown> | undefined;

/** Writes dotted `usage.*` fields to the signed-in user's document. */
export type UsageWriter = (fields: Record<string, unknown>) => Promise<void>;

/** Calendar day in the user's own time zone, so "today" resets at their midnight. */
export function localDay(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface DailyQuota {
  access: Access;
  limit: number;
  used: number;
  remaining: number;
  reached: boolean;
  /** Counts one use; only free accounts are counted. */
  consume: () => Promise<void>;
}

const DAILY_FIELDS = {
  invoice: { date: 'lastInvoiceDate', count: 'dailyInvoiceCount' },
  pdf: { date: 'lastPdfDate', count: 'dailyPdfCount' },
} as const;

export const FREE_DAILY_LIMIT = 1;

export function dailyQuota(kind: keyof typeof DAILY_FIELDS, access: Access, usage: Usage, write: UsageWriter | undefined, today = localDay()): DailyQuota {
  const fields = DAILY_FIELDS[kind];
  const sameDay = usage?.[fields.date] === today;
  const used = sameDay && typeof usage?.[fields.count] === 'number' ? (usage[fields.count] as number) : 0;
  const limit = FREE_DAILY_LIMIT;
  const unlimited = access !== 'free';
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return {
    access,
    limit,
    used,
    remaining,
    reached: !unlimited && remaining <= 0,
    consume: async () => {
      if (unlimited || !write) return;
      await write({
        [`usage.${fields.date}`]: today,
        [`usage.${fields.count}`]: used + 1,
      });
    },
  };
}

export const FORMULA_FREE_SECONDS = 15 * 60;
export const FORMULA_LOCK_MS = 24 * 60 * 60 * 1000;

export interface TimeQuota {
  access: Access;
  limitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  /** When the time ran out, the tool stays closed until this moment. */
  lockedUntil: number | null;
  /** Saves the seconds used so far in this window; marks the end when nothing is left. */
  save: (usedSeconds: number) => Promise<void>;
}

/**
 * Fórmula Fácil for free accounts: 15 minutes per 24-hour window. When the minutes run out
 * the tool locks for 24 hours from that moment; an unfinished window also resets after 24 hours.
 */
export function formulaQuota(access: Access, usage: Usage, write: UsageWriter | undefined, now = Date.now()): TimeQuota {
  const unlimited = access !== 'free';
  let windowStart = typeof usage?.formulaWindowStart === 'number' ? usage.formulaWindowStart : null;
  let used = typeof usage?.formulaSecondsUsed === 'number' ? usage.formulaSecondsUsed : 0;
  let exhaustedAt = typeof usage?.formulaExhaustedAt === 'number' ? usage.formulaExhaustedAt : null;

  if (exhaustedAt !== null && now >= exhaustedAt + FORMULA_LOCK_MS) { windowStart = null; used = 0; exhaustedAt = null; }
  if (exhaustedAt === null && windowStart !== null && now >= windowStart + FORMULA_LOCK_MS) { windowStart = null; used = 0; }

  const usedSeconds = Math.min(FORMULA_FREE_SECONDS, used);
  const lockedUntil = !unlimited && exhaustedAt !== null ? exhaustedAt + FORMULA_LOCK_MS : null;
  const remainingSeconds = unlimited ? Infinity : lockedUntil ? 0 : FORMULA_FREE_SECONDS - usedSeconds;

  return {
    access,
    limitSeconds: FORMULA_FREE_SECONDS,
    usedSeconds,
    remainingSeconds,
    lockedUntil,
    save: async (nextUsed: number) => {
      if (unlimited || !write) return;
      const total = Math.min(FORMULA_FREE_SECONDS, Math.max(usedSeconds, Math.round(nextUsed)));
      const at = Date.now();
      await write({
        'usage.formulaWindowStart': windowStart ?? at,
        'usage.formulaSecondsUsed': total,
        'usage.formulaExhaustedAt': total >= FORMULA_FREE_SECONDS ? (exhaustedAt ?? at) : null,
      });
    },
  };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatWait(ms: number, lang: 'pt' | 'en' | 'es'): string {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (lang === 'en') return h ? `${h}h ${m}min` : `${m} min`;
  return h ? `${h}h ${m}min` : `${m} min`;
}
