import assert from 'node:assert/strict';
const { GET, POST } = await import('../.server-check/api/support-telegram.js');
const response = await GET(new Request('https://shifthours.com/api/support-telegram'));
assert.equal(response.status, 404);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
const webhook = await POST(new Request('https://shifthours.com/api/support-telegram?action=webhook', { method: 'POST', body: '{}' }));
assert.equal(webhook.status, 404);
console.log('Compiled Telegram API starts and rejects unauthenticated requests.');
