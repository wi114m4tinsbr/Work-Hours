import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyQuota, dayOf, formulaQuota, FORMULA_FREE_SECONDS, FORMULA_LOCK_MS, QuotaError, SERVER_TIME } from '../src/lib/quota.ts';
import { formulaLocked } from '../server/formula-public.ts';

const recorder = (fail = false) => {
  const writes: Record<string, unknown>[] = [];
  return { writes, write: async (fields: Record<string, unknown>) => { if (fail) throw new Error('permission-denied'); writes.push(fields); } };
};
const ts = (ms: number) => ({ toMillis: () => ms });
const BRT = -180;

test('day boundaries follow the account time zone, like the rules', () => {
  const lateNight = Date.UTC(2026, 9, 4, 2, 30); // 23:30 on Oct 3 in Brasília
  assert.equal(dayOf(lateNight, BRT), 20261003);
  assert.equal(dayOf(lateNight, 0), 20261004);
});

test('free plan: one invoice or PDF per day, recorded with the server clock', async () => {
  const now = Date.UTC(2026, 9, 3, 15);
  const fresh = dailyQuota('invoice', 'free', undefined, undefined, now);
  assert.equal(fresh.remaining, 1);
  assert.equal(fresh.reached, false);

  // Yesterday's count no longer blocks (the bug that kept "limite atingido" on forever).
  const yesterday = dailyQuota('invoice', 'free', { tz: BRT, invoiceAt: ts(now - 86400e3), invoiceCount: 1 }, undefined, now);
  assert.equal(yesterday.reached, false);

  const { writes, write } = recorder();
  await dailyQuota('pdf', 'free', { tz: BRT }, write, now).consume();
  assert.deepEqual(writes, [{ tz: BRT, pdfAt: SERVER_TIME, pdfCount: 1 }]);

  const used = dailyQuota('pdf', 'free', { tz: BRT, pdfAt: ts(now - 3600e3), pdfCount: 1 }, write, now);
  assert.equal(used.reached, true);
  await assert.rejects(used.consume(), QuotaError);
  // Invoices and PDFs are separate allowances.
  assert.equal(dailyQuota('invoice', 'free', { tz: BRT, pdfAt: ts(now), pdfCount: 1 }, write, now).reached, false);

  // When the rules refuse the write, the file is not handed over.
  await assert.rejects(dailyQuota('invoice', 'free', { tz: BRT }, recorder(true).write, now).consume(), QuotaError);
});

test('admin and Premium are never limited or counted', async () => {
  const { writes, write } = recorder();
  const now = Date.now();
  for (const access of ['admin', 'premium'] as const) {
    const q = dailyQuota('invoice', access, { tz: 0, invoiceAt: ts(now), invoiceCount: 1 }, write);
    assert.equal(q.reached, false);
    await q.consume();
    const f = formulaQuota(access, { formulaStart: ts(now), formulaUsed: FORMULA_FREE_SECONDS, formulaExhaustedAt: ts(now) }, write);
    assert.equal(f.lockedUntil, null);
    assert.equal(f.remainingSeconds, Infinity);
    await f.save(10);
  }
  assert.equal(writes.length, 0);
});

test('Fórmula Fácil: 15 free minutes, then locked for 24 hours', async () => {
  const now = Date.UTC(2026, 9, 3, 12);
  const fresh = formulaQuota('free', undefined, undefined, now);
  assert.equal(fresh.remainingSeconds, 15 * 60);
  assert.equal(fresh.lockedUntil, null);

  const partial = formulaQuota('free', { formulaStart: ts(now - 3600e3), formulaUsed: 600 }, undefined, now);
  assert.equal(partial.remainingSeconds, 300);

  const exhaustedAt = now - 2 * 3600e3;
  const lockedDoc = { formulaStart: ts(now - 3 * 3600e3), formulaUsed: 900, formulaExhaustedAt: ts(exhaustedAt) };
  const locked = formulaQuota('free', lockedDoc, undefined, now);
  assert.equal(locked.remainingSeconds, 0);
  assert.equal(locked.lockedUntil, exhaustedAt + FORMULA_LOCK_MS);
  // The server refuses the page for the same state.
  assert.equal(formulaLocked({ access: 'free', formula: { start: now - 3 * 3600e3, used: 900, exhaustedAt } }, now), true);
  assert.equal(formulaLocked({ access: 'premium' }, now), false);
  assert.equal(formulaLocked({ access: 'free', formula: { start: now - 3600e3, used: 600, exhaustedAt: null } }, now), false);

  const after = formulaQuota('free', { formulaStart: ts(now - 30 * 3600e3), formulaUsed: 900, formulaExhaustedAt: ts(now - FORMULA_LOCK_MS - 1) }, undefined, now);
  assert.equal(after.lockedUntil, null);
  assert.equal(after.remainingSeconds, 15 * 60);

  // An unfinished window also starts over after 24 hours.
  const stale = formulaQuota('free', { formulaStart: ts(now - FORMULA_LOCK_MS - 1), formulaUsed: 500 }, undefined, now);
  assert.equal(stale.remainingSeconds, 15 * 60);

  const { writes, write } = recorder();
  await formulaQuota('free', { tz: BRT }, write, now).save(FORMULA_FREE_SECONDS + 40);
  assert.deepEqual(writes[0], { tz: BRT, formulaStart: SERVER_TIME, formulaTick: SERVER_TIME, formulaUsed: FORMULA_FREE_SECONDS, formulaExhaustedAt: SERVER_TIME });
  // Saving less than what was already used never gives time back, and an open window keeps its start.
  await formulaQuota('free', { tz: BRT, formulaStart: ts(now), formulaUsed: 300 }, write, now).save(100);
  assert.deepEqual(writes[1], { tz: BRT, formulaTick: SERVER_TIME, formulaUsed: 300, formulaExhaustedAt: null });
});
