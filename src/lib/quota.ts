import { periodKey, WINDOW_MS, type ToolLimit } from './plans';
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


/** Milliseconds from a Firestore Timestamp, a number or nothing. */
export function toMs(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') return (value as { toMillis: () => number }).toMillis();
  return null;
}

/** Minutes east of UTC on this device; fixed on the account at its first use. */
export const deviceTz = () => -new Date().getTimezoneOffset();

const tzOf = (doc: QuotaDoc) => (typeof doc?.tz === 'number' ? doc.tz : deviceTz());

export interface Allowance {
  /** Plan name shown on the badge, e.g. "Grátis" or "Premium". */
  planName: string;
  limit: ToolLimit;
}

const UNLIMITED_ALLOWANCE: Allowance = { planName: '', limit: { mode: 'unlimited', amount: 0, period: 'day' } };

export interface DailyQuota {
  access: Access;
  planName: string;
  limit: ToolLimit;
  /** Uses allowed per period (Infinity when unlimited, 0 when not included). */
  allowed: number;
  used: number;
  remaining: number;
  reached: boolean;
  /** The plan does not include this tool at all. */
  blocked: boolean;
  /** Counts one use before the file is handed over; throws when the allowance is gone. */
  consume: () => Promise<void>;
}

const DAILY_FIELDS = {
  invoice: { at: 'invoiceAt', count: 'invoiceCount' },
  pdf: { at: 'pdfAt', count: 'pdfCount' },
} as const;

export class QuotaError extends Error {
  constructor() { super('Limit reached'); this.name = 'QuotaError'; }
}

export function dailyQuota(kind: keyof typeof DAILY_FIELDS, access: Access, doc: QuotaDoc, write: UsageWriter | undefined, allowance: Allowance = UNLIMITED_ALLOWANCE, now = Date.now()): DailyQuota {
  const fields = DAILY_FIELDS[kind];
  const tz = tzOf(doc);
  const { limit } = allowance;
  const unlimited = access === 'admin' || limit.mode === 'unlimited';
  const blocked = !unlimited && (limit.mode === 'off' || limit.amount <= 0);
  const allowed = unlimited ? Infinity : blocked ? 0 : limit.amount;
  const at = toMs(doc?.[fields.at]);
  const samePeriod = at !== null && periodKey(at, tz, limit.period) === periodKey(now, tz, limit.period);
  const used = samePeriod && typeof doc?.[fields.count] === 'number' ? (doc[fields.count] as number) : 0;
  const remaining = unlimited ? Infinity : Math.max(0, allowed - used);
  return {
    access,
    planName: allowance.planName,
    limit,
    allowed,
    used,
    remaining,
    reached: !unlimited && remaining <= 0,
    blocked,
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

export interface TimeQuota {
  access: Access;
  planName: string;
  limit: ToolLimit;
  limitSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  /** When the time ran out, the tool stays closed until this moment. */
  lockedUntil: number | null;
  /** The plan does not include this tool at all. */
  blocked: boolean;
  /** Saves the seconds used so far in this window; marks the end when nothing is left. */
  save: (usedSeconds: number) => Promise<void>;
}

/**
 * Fórmula Fácil: minutes per window (a day, a week or 30 days, from the first use). When the
 * minutes run out the tool locks for one window length from that moment.
 */
export function formulaQuota(access: Access, doc: QuotaDoc, write: UsageWriter | undefined, allowance: Allowance = UNLIMITED_ALLOWANCE, now = Date.now()): TimeQuota {
  const { limit } = allowance;
  const unlimited = access === 'admin' || limit.mode === 'unlimited';
  const blocked = !unlimited && (limit.mode === 'off' || limit.amount <= 0);
  const limitSeconds = unlimited ? Infinity : blocked ? 0 : limit.amount * 60;
  const windowMs = WINDOW_MS[limit.period];
  const tz = tzOf(doc);
  const start = toMs(doc?.formulaStart);
  const exhaustedAt = toMs(doc?.formulaExhaustedAt);
  const storedUsed = typeof doc?.formulaUsed === 'number' ? doc.formulaUsed : 0;

  const expired = start === null || (exhaustedAt !== null ? now >= exhaustedAt + windowMs : now >= start + windowMs);
  const usedSeconds = expired ? 0 : Math.min(limitSeconds, storedUsed);
  const lockedUntil = !unlimited && !blocked && !expired && (exhaustedAt !== null || usedSeconds >= limitSeconds)
    ? (exhaustedAt ?? now) + windowMs : null;
  const remainingSeconds = unlimited ? Infinity : lockedUntil || blocked ? 0 : limitSeconds - usedSeconds;

  return {
    access,
    planName: allowance.planName,
    limit,
    limitSeconds,
    usedSeconds,
    remainingSeconds,
    lockedUntil,
    blocked,
    save: async (nextUsed: number) => {
      if (unlimited || blocked || !write || lockedUntil) return;
      const total = Math.min(limitSeconds, Math.max(usedSeconds, Math.round(nextUsed)));
      await write({
        tz,
        ...(expired ? { formulaStart: SERVER_TIME } : {}),
        formulaTick: SERVER_TIME,
        formulaUsed: total,
        formulaExhaustedAt: total >= limitSeconds ? SERVER_TIME : null,
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
