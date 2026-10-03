import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyQuota, formulaQuota, FORMULA_FREE_SECONDS, FORMULA_LOCK_MS, localDay } from '../src/lib/quota.ts';

const recorder = () => {
  const writes: Record<string, unknown>[] = [];
  return { writes, write: async (fields: Record<string, unknown>) => { writes.push(fields); } };
};

test('free plan: one invoice or PDF per local day, counted on use', async () => {
  const today = localDay(new Date(2026, 9, 3, 23, 30));
  const fresh = dailyQuota('invoice', 'free', undefined, undefined, today);
  assert.equal(fresh.remaining, 1);
  assert.equal(fresh.reached, false);

  // Yesterday's count no longer blocks (the bug that kept "limite atingido" on forever).
  const yesterday = dailyQuota('invoice', 'free', { lastInvoiceDate: '2026-10-02', dailyInvoiceCount: 5 }, undefined, today);
  assert.equal(yesterday.reached, false);

  const { writes, write } = recorder();
  await dailyQuota('pdf', 'free', undefined, write, today).consume();
  assert.deepEqual(writes, [{ 'usage.lastPdfDate': today, 'usage.dailyPdfCount': 1 }]);

  const used = dailyQuota('pdf', 'free', { lastPdfDate: today, dailyPdfCount: 1 }, write, today);
  assert.equal(used.reached, true);
  assert.equal(used.remaining, 0);
  // Invoices and PDFs are separate allowances.
  assert.equal(dailyQuota('invoice', 'free', { lastPdfDate: today, dailyPdfCount: 1 }, write, today).reached, false);
});

test('admin and Premium are never limited or counted', async () => {
  const { writes, write } = recorder();
  for (const access of ['admin', 'premium'] as const) {
    const q = dailyQuota('invoice', access, { lastInvoiceDate: localDay(), dailyInvoiceCount: 9 }, write);
    assert.equal(q.reached, false);
    await q.consume();
    const f = formulaQuota(access, { formulaSecondsUsed: FORMULA_FREE_SECONDS, formulaExhaustedAt: Date.now() }, write);
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

  const partial = formulaQuota('free', { formulaWindowStart: now - 3600e3, formulaSecondsUsed: 600 }, undefined, now);
  assert.equal(partial.remainingSeconds, 300);

  const exhaustedAt = now - 2 * 3600e3;
  const locked = formulaQuota('free', { formulaWindowStart: now - 3 * 3600e3, formulaSecondsUsed: 900, formulaExhaustedAt: exhaustedAt }, undefined, now);
  assert.equal(locked.remainingSeconds, 0);
  assert.equal(locked.lockedUntil, exhaustedAt + FORMULA_LOCK_MS);

  const after = formulaQuota('free', { formulaWindowStart: now - 30 * 3600e3, formulaSecondsUsed: 900, formulaExhaustedAt: now - FORMULA_LOCK_MS - 1 }, undefined, now);
  assert.equal(after.lockedUntil, null);
  assert.equal(after.remainingSeconds, 15 * 60);

  // An unfinished window also starts over after 24 hours.
  const stale = formulaQuota('free', { formulaWindowStart: now - FORMULA_LOCK_MS - 1, formulaSecondsUsed: 500 }, undefined, now);
  assert.equal(stale.remainingSeconds, 15 * 60);

  const { writes, write } = recorder();
  await formulaQuota('free', undefined, write, now).save(FORMULA_FREE_SECONDS + 40);
  assert.equal(writes[0]['usage.formulaSecondsUsed'], FORMULA_FREE_SECONDS);
  assert.equal(typeof writes[0]['usage.formulaExhaustedAt'], 'number');
  // Saving less than what was already used never gives time back.
  await formulaQuota('free', { formulaWindowStart: now, formulaSecondsUsed: 300 }, write, now).save(100);
  assert.equal(writes[1]['usage.formulaSecondsUsed'], 300);
});
