import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyQuota, formulaQuota, QuotaError, SERVER_TIME } from '../src/lib/quota.ts';
import { DEFAULT_PLANS, describeLimit, effectivePlanId, limitNotice, normalizePlans, periodKey, WINDOW_MS, type ToolLimit } from '../src/lib/plans.ts';
import { formulaLocked, plain } from '../server/formula-public.ts';

const recorder = (fail = false) => {
  const writes: Record<string, unknown>[] = [];
  return { writes, write: async (fields: Record<string, unknown>) => { if (fail) throw new Error('permission-denied'); writes.push(fields); } };
};
const ts = (ms: number) => ({ toMillis: () => ms });
const BRT = -180;
const free = (limit: ToolLimit) => ({ planName: 'Grátis', limit });
const ONE_PER_DAY: ToolLimit = { mode: 'limited', amount: 1, period: 'day' };
const FIFTEEN_MIN: ToolLimit = { mode: 'limited', amount: 15, period: 'day' };
const UNLIMITED: ToolLimit = { mode: 'unlimited', amount: 0, period: 'day' };

test('periods follow the account time zone, like the rules', () => {
  const lateNight = Date.UTC(2026, 9, 4, 2, 30); // 23:30 on Oct 3 in Brasília
  assert.equal(periodKey(lateNight, BRT, 'day'), 20261003);
  assert.equal(periodKey(lateNight, 0, 'day'), 20261004);
  assert.equal(periodKey(lateNight, BRT, 'month'), 202610);
  // Monday 2026-10-05 starts a new week; Sunday 2026-10-04 is still the old one.
  assert.equal(periodKey(Date.UTC(2026, 9, 4, 12), 0, 'week') + 1, periodKey(Date.UTC(2026, 9, 5, 12), 0, 'week'));
});

test('limited plans: uses per period, recorded with the server clock', async () => {
  const now = Date.UTC(2026, 9, 3, 15);
  const fresh = dailyQuota('invoice', 'free', undefined, undefined, free(ONE_PER_DAY), now);
  assert.equal(fresh.remaining, 1);
  assert.equal(fresh.reached, false);

  // Yesterday's count no longer blocks (the bug that kept "limite atingido" on forever).
  const yesterday = dailyQuota('invoice', 'free', { tz: BRT, invoiceAt: ts(now - 86400e3), invoiceCount: 1 }, undefined, free(ONE_PER_DAY), now);
  assert.equal(yesterday.reached, false);

  const { writes, write } = recorder();
  await dailyQuota('pdf', 'free', { tz: BRT }, write, free(ONE_PER_DAY), now).consume();
  assert.deepEqual(writes, [{ tz: BRT, pdfAt: SERVER_TIME, pdfCount: 1 }]);

  const used = dailyQuota('pdf', 'free', { tz: BRT, pdfAt: ts(now - 3600e3), pdfCount: 1 }, write, free(ONE_PER_DAY), now);
  assert.equal(used.reached, true);
  await assert.rejects(used.consume(), QuotaError);

  // Three per week: the second use of the week is still allowed.
  const weekly = dailyQuota('invoice', 'free', { tz: 0, invoiceAt: ts(now - 86400e3), invoiceCount: 1 }, write, free({ mode: 'limited', amount: 3, period: 'week' }), now);
  assert.equal(weekly.remaining, 2);
  await weekly.consume();
  assert.equal((writes.at(-1) as Record<string, unknown>).invoiceCount, 2);

  // Not included in the plan.
  const off = dailyQuota('pdf', 'free', undefined, write, free({ mode: 'off', amount: 0, period: 'day' }), now);
  assert.equal(off.blocked, true);
  assert.equal(off.reached, true);

  // When the rules refuse the write, the file is not handed over.
  await assert.rejects(dailyQuota('invoice', 'free', { tz: BRT }, recorder(true).write, free(ONE_PER_DAY), now).consume(), QuotaError);
});

test('admin and unlimited plans are never limited or counted', async () => {
  const { writes, write } = recorder();
  const now = Date.now();
  const cases = [['admin', ONE_PER_DAY], ['premium', UNLIMITED]] as const;
  for (const [access, limit] of cases) {
    const q = dailyQuota('invoice', access, { tz: 0, invoiceAt: ts(now), invoiceCount: 1 }, write, free(limit));
    assert.equal(q.reached, false);
    await q.consume();
    const f = formulaQuota(access, { formulaStart: ts(now), formulaUsed: 900, formulaExhaustedAt: ts(now) }, write, free(limit));
    assert.equal(f.lockedUntil, null);
    assert.equal(f.remainingSeconds, Infinity);
    await f.save(10);
  }
  assert.equal(writes.length, 0);
});

test('Fórmula Fácil: minutes per window, then locked for one window', async () => {
  const now = Date.UTC(2026, 9, 3, 12);
  const day = WINDOW_MS.day;
  assert.equal(formulaQuota('free', undefined, undefined, free(FIFTEEN_MIN), now).remainingSeconds, 900);
  assert.equal(formulaQuota('free', { formulaStart: ts(now - 3600e3), formulaUsed: 600 }, undefined, free(FIFTEEN_MIN), now).remainingSeconds, 300);

  const exhaustedAt = now - 2 * 3600e3;
  const locked = formulaQuota('free', { formulaStart: ts(now - 3 * 3600e3), formulaUsed: 900, formulaExhaustedAt: ts(exhaustedAt) }, undefined, free(FIFTEEN_MIN), now);
  assert.equal(locked.remainingSeconds, 0);
  assert.equal(locked.lockedUntil, exhaustedAt + day);
  // The server refuses the page for the same state.
  assert.equal(formulaLocked({ access: 'free', formula: { start: now - 3 * 3600e3, used: 900, exhaustedAt, limit: FIFTEEN_MIN } }, now), true);
  assert.equal(formulaLocked({ access: 'premium' }, now), false);
  assert.equal(formulaLocked({ access: 'free', formula: { start: now - 3600e3, used: 600, exhaustedAt: null, limit: FIFTEEN_MIN } }, now), false);
  assert.equal(formulaLocked({ access: 'free', formula: { start: null, used: 0, exhaustedAt: null, limit: { mode: 'off', amount: 0, period: 'day' } } }, now), true);
  // 60 minutes per week: 15 used is fine, and the lock lasts a week.
  const weekly: ToolLimit = { mode: 'limited', amount: 60, period: 'week' };
  assert.equal(formulaLocked({ access: 'free', formula: { start: now - 3 * day, used: 900, exhaustedAt: null, limit: weekly } }, now), false);
  assert.equal(formulaLocked({ access: 'free', formula: { start: now - 3 * day, used: 3600, exhaustedAt: now - 3 * day, limit: weekly } }, now), true);

  assert.equal(formulaQuota('free', { formulaStart: ts(now - 30 * 3600e3), formulaUsed: 900, formulaExhaustedAt: ts(now - day - 1) }, undefined, free(FIFTEEN_MIN), now).remainingSeconds, 900);
  assert.equal(formulaQuota('free', { formulaStart: ts(now - day - 1), formulaUsed: 500 }, undefined, free(FIFTEEN_MIN), now).remainingSeconds, 900);

  const { writes, write } = recorder();
  await formulaQuota('free', { tz: BRT }, write, free(FIFTEEN_MIN), now).save(940);
  assert.deepEqual(writes[0], { tz: BRT, formulaStart: SERVER_TIME, formulaTick: SERVER_TIME, formulaUsed: 900, formulaExhaustedAt: SERVER_TIME });
  // Saving less than what was already used never gives time back, and an open window keeps its start.
  await formulaQuota('free', { tz: BRT, formulaStart: ts(now), formulaUsed: 300 }, write, free(FIFTEEN_MIN), now).save(100);
  assert.deepEqual(writes[1], { tz: BRT, formulaTick: SERVER_TIME, formulaUsed: 300, formulaExhaustedAt: null });
});

test('plans from the admin panel: defaults, new plans, expiry and readable text', () => {
  const config = normalizePlans({ plans: { free: { limits: { invoice: { mode: 'limited', amount: 2, period: 'week' } } }, pro: { name: { pt: 'Pro' }, limits: { pdf: { mode: 'limited', amount: 10, period: 'month' } } } } });
  assert.deepEqual(config.plans.free.limits.invoice, { mode: 'limited', amount: 2, period: 'week' });
  assert.deepEqual(config.plans.free.limits.formula, DEFAULT_PLANS.plans.free.limits.formula);
  assert.equal(config.plans.pro.name.en, 'Pro');
  assert.equal(effectivePlanId({ type: 'monthly', plan: 'pro', expiryDate: null }, config), 'pro');
  assert.equal(effectivePlanId({ type: 'monthly', plan: 'pro', expiryDate: Date.now() - 1 }, config), 'free');
  assert.equal(effectivePlanId({ type: 'monthly' }, config), 'premium');
  assert.equal(effectivePlanId({ type: 'monthly', plan: 'deleted' }, config), 'free');
  assert.equal(describeLimit('invoice', config.plans.free.limits.invoice, 'pt'), '2 faturas por semana');
  assert.equal(describeLimit('formula', FIFTEEN_MIN, 'pt'), '15 minutos de Fórmula Fácil por dia');
  assert.equal(describeLimit('jobs', { mode: 'limited', amount: 1, period: 'day' }, 'pt'), '1 trabalho/empresa');
  assert.equal(describeLimit('pdf', UNLIMITED, 'en'), 'PDF Studio: unlimited');
  assert.match(limitNotice('pdf', { mode: 'off', amount: 0, period: 'day' }, 'Grátis', 'pt').title, /Não incluído/);
  assert.deepEqual(plain({ mapValue: { fields: { a: { integerValue: '2' }, b: { booleanValue: true } } } }), { a: 2, b: true });
});
