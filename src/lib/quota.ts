
/** Who is using a tool: the owner and Premium are unlimited, free accounts get daily allowances. */
export type Access = 'admin' | 'premium' | 'free';

/**
 * The free-plan allowance document, `quota/{email}` in Firestore. The security rules check
 * every change against the server clock, so counts can only go up and only reset on time.
 */
export type QuotaDoc = Record<string, unknown> | undefined;

/** Placeholder for the server clock; the writer turns it into Firestore's serverTimestamp(). */
export const SERVER_TIME = '__server_time__';

/** Merges fields into the user's quota document. Rejects when the rules refuse the change. */
export type UsageWriter = (fields: Record<string, unknown>) => Promise<void>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds from a Firestore Timestamp, a number or nothing. */
export function toMs(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
  return null;
}

/** Minutes east of UTC on this device; fixed on the account at its first use. */
export const deviceTz = () => -new Date().getTimezoneOffset();

const tzOf = (doc: QuotaDoc) => (typeof doc?.tz === 'number' ? doc.tz : deviceTz());

/** Calendar day (yyyymmdd) in the account's time zone, the same way the rules compute it. */
export function dayOf(ms: number, tz: number): number {
  const d = new Date(ms + tz * 60000);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export interface DailyQuota {
  access: Access;
  limit: number;
  used: number;
  remaining: number;
  reached: boolean;
  /** Counts one use before the file is handed over; throws when the allowance is gone. */
  consume: () => Promise<void>;
}

const DAILY_FIELDS = {
  invoice: { at: 'invoiceAt', count: 'invoiceCount' },
  pdf: { at: 'pdfAt', count: 'pdfCount' },
} as const;

export const FREE_DAILY_LIMIT = 1;

export class QuotaError extends Error {
  constructor() { super('Daily limit reached'); this.name = 'QuotaError'; }
}

export function dailyQuota(kind: keyof typeof DAILY_FIELDS, access: Access, doc: QuotaDoc, write: UsageWriter | undefined, now = Date.now()): DailyQuota {
  const fields = DAILY_FIELDS[kind];
  const tz = tzOf(doc);
  const at = toMs(doc?.[fields.at]);
  const sameDay = at !== null && dayOf(at, tz) === dayOf(now, tz);
  const used = sameDay && typeof doc?.[fields.count] === 'number' ? (doc[fields.count] as number) : 0;
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
      if (unlimited) return;
      if (remaining <= 0 || !write) throw new QuotaError();
      try {
        await write({ tz, [fields.at]: SERVER_TIME, [fields.count]: used + 1 });
      } catch {
        throw new QuotaError();
      }
    },
  };
}

export const FORMULA_FREE_SECONDS = 15 * 60;
export const FORMULA_LOCK_MS = DAY_MS;

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
export function formulaQuota(access: Access, doc: QuotaDoc, write: UsageWriter | undefined, now = Date.now()): TimeQuota {
  const unlimited = access !== 'free';
  const tz = tzOf(doc);
  const start = toMs(doc?.formulaStart);
  const exhaustedAt = toMs(doc?.formulaExhaustedAt);
  const storedUsed = typeof doc?.formulaUsed === 'number' ? doc.formulaUsed : 0;

  const expired = start === null || (exhaustedAt !== null ? now >= exhaustedAt + FORMULA_LOCK_MS : now >= start + FORMULA_LOCK_MS);
  const usedSeconds = expired ? 0 : Math.min(FORMULA_FREE_SECONDS, storedUsed);
  const lockedUntil = !unlimited && !expired && exhaustedAt !== null ? exhaustedAt + FORMULA_LOCK_MS : null;
  const remainingSeconds = unlimited ? Infinity : lockedUntil ? 0 : FORMULA_FREE_SECONDS - usedSeconds;

  return {
    access,
    limitSeconds: FORMULA_FREE_SECONDS,
    usedSeconds,
    remainingSeconds,
    lockedUntil,
    save: async (nextUsed: number) => {
      if (unlimited || !write || lockedUntil) return;
      const total = Math.min(FORMULA_FREE_SECONDS, Math.max(usedSeconds, Math.round(nextUsed)));
      await write({
        tz,
        ...(expired ? { formulaStart: SERVER_TIME } : {}),
        formulaTick: SERVER_TIME,
        formulaUsed: total,
        formulaExhaustedAt: total >= FORMULA_FREE_SECONDS ? SERVER_TIME : null,
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
