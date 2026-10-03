import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { FORMULA_OWNER_EMAIL } from '../server/formula-auth';
import { canReply, DEFAULT_PREFS, eventAllowed, ownerSession, preferences, SETTINGS_PATH, validId, notice } from '../server/support-telegram-policy';
import { receiveUpdate, supportTelegram, validWebhook, deliverEvent } from '../server/support-telegram';
const settings = { ...DEFAULT_PREFS, enabled: true, replies: true, ownerUid: 'owner', chatId: 123, fromId: 123, enabledAt: 1000, linkedAt: 10 };
const ticket = { uid: 'user', status: 'accepted', assignedTo: FORMULA_OWNER_EMAIL, assignedUid: 'owner', assignedName: 'Owner', subject: 'Help', name: 'Visitor' };
const session = { uid: 'owner', email: FORMULA_OWNER_EMAIL, provider: 'google.com', expiresAt: 9999999 };
function memory(initial: Record<string, any>) {
  const data = new Map(Object.entries(initial));
  const doc = (path: string): any => ({ path, get: async () => ({ exists: data.has(path), data: () => data.get(path) }), set: async (value: any, options?: any) => data.set(path, options?.merge ? { ...data.get(path), ...value } : value), collection: (name: string) => ({ doc: (id: string) => doc(`${path}/${name}/${id}`) }) });
  const db: any = { doc, batch: () => { const staged: any[] = []; return { set: (ref: any, value: any, options: any) => staged.push([ref, value, options]), commit: async () => { for (const [ref, value, options] of staged) await ref.set(value, options); } }; }, runTransaction: async (fn: any) => {
    const staged = new Map(data);
    const tx = { get: async (ref: any) => ({ exists: staged.has(ref.path), data: () => staged.get(ref.path) }), set: (ref: any, val: any) => { assert.ok(!Object.values(val).some((v: any) => v?.constructor?.name === 'DeleteTransform'), 'Firestore delete transforms require update or merged set'); staged.set(ref.path, val); }, update: (ref: any, val: any) => staged.set(ref.path, { ...staged.get(ref.path), ...val }), create: (ref: any, val: any) => { assert.ok(!staged.has(ref.path)); staged.set(ref.path, val); } };
    const result = await fn(tx); data.clear(); staged.forEach((v,k) => data.set(k,v)); return result;
  } };
  return { db, data };
}
function incoming(id = 1, text = 'Answer', fromId = 123, reply = 50) { return { update_id: id, message: { text, chat: { id: fromId, type: 'private' }, from: { id: fromId, is_bot: false }, reply_to_message: { message_id: reply } } }; }
const fixtures = (overrides: any = {}) => memory({ [SETTINGS_PATH]: { ...settings, ...overrides }, 'tickets/a': { ...ticket }, 'supportTelegramMessages/123_50': { ticketId: 'a', linkedAt: 10 } });
test('preferences do not accept truthy strings; only exact owner Google session manages bot', () => {
  assert.equal(preferences({ enabled: 'yes' }).enabled, false);
  assert.equal(ownerSession(session), true);
  assert.equal(ownerSession({ ...session, email: 'other@gmail.com' }), false);
  assert.equal(ownerSession({ ...session, provider: 'password' }), false);
  assert.equal(validId('../private'), false);
});
test('no history flood; disabled/closed/staff-assigned messages cannot be sent', () => {
  assert.equal(eventAllowed('opened', settings, ticket, 1200, 2000), true);
  assert.equal(eventAllowed('opened', settings, ticket, 500, 2000), false);
  assert.equal(eventAllowed('opened', settings, ticket, 1200, 900000), false);
  assert.equal(eventAllowed('messages', settings, { ...ticket, status: 'closed' }, 1200, 2000), false);
  assert.equal(eventAllowed('messages', settings, { ...ticket, assignedTo: 'staff@gmail.com' }, 1200, 2000), false);
  assert.equal(eventAllowed('messages', { ...settings, enabled: false }, ticket, 1200, 2000), false);
  assert.equal(eventAllowed('accepted', settings, { ...ticket, assignedTo: 'staff@gmail.com' }, 1200, 2000), true);
});
test('webhook secret is required and Unicode input does not crash comparison', () => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  assert.equal(validWebhook(null), false);
  assert.equal(validWebhook('é'.repeat(64)), false);
  assert.equal(validWebhook(createHmac('sha256','test-token').update('shift-hours-webhook-v1').digest('hex')), true);
});
test('unauthenticated configuration and forged webhook fail closed', async () => {
  const a = await supportTelegram(new Request('https://shifthours.com/api/support-telegram'));
  assert.equal(a.status,404);
  process.env.VERCEL_ENV = 'production';
  const b = await supportTelegram(new Request('https://shifthours.com/api/support-telegram?action=webhook', { method: 'POST', body: '{}' }));
  assert.equal(b.status,404);
  assert.equal(b.headers.get('cache-control'),'private, no-store');
});
test('Telegram replies route through exact message mapping and repeated updates write once', async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, result: { message_id: 99 } });
  try {
    const { db, data } = fixtures();
    await receiveUpdate(db, incoming()); await receiveUpdate(db, incoming());
    assert.equal(data.get('tickets/a/messages/telegram_1').text,'Answer');
    assert.equal(data.get('tickets/a').userUnread,true);
    assert.equal([...data.keys()].filter(k=>k.includes('/messages/')).length,1);
  } finally { globalThis.fetch = fetchBefore; }
});
test('closed, disabled, reassigned, foreign chat and previous link cannot write replies', async () => {
  const fetchBefore = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, result: {} });
  try {
    for (const change of ['closed','disabled','replies','reassigned','foreign','relinked','unknown','long']) {
      const {db,data}=fixtures();
      if(change==='closed') data.set('tickets/a',{...ticket,status:'closed'});
      if(change==='disabled') data.set(SETTINGS_PATH,{...settings,enabled:false});
      if(change==='replies') data.set(SETTINGS_PATH,{...settings,replies:false});
      if(change==='reassigned') data.set('tickets/a',{...ticket,assignedTo:'other@gmail.com'});
      if(change==='relinked') data.set(SETTINGS_PATH,{...settings,linkedAt:11});
      await receiveUpdate(db,incoming(1,change==='long'?'x'.repeat(4001):'Answer',change==='foreign'?456:123,change==='unknown'?51:50));
      assert.equal(data.has('tickets/a/messages/telegram_1'),false,change);
    }
  } finally { globalThis.fetch=fetchBefore; }
});
test('pairing nonce expires; group cannot pair; valid private nonce pairs with notifications off', async () => {
  const nonce='a'.repeat(48); const pairHash=createHash('sha256').update(nonce).digest('hex');
  const fetchBefore=globalThis.fetch; globalThis.fetch=async()=>Response.json({ok:true,result:{}});
  try {
    const {db,data}=fixtures({pairHash,pairExpires:Date.now()-1});
    await receiveUpdate(db,incoming(1,`/start ${nonce}`,456));
    assert.equal(data.get(SETTINGS_PATH).chatId,123);
    data.set(SETTINGS_PATH,{...settings,pairHash,pairExpires:Date.now()+60000});
    const group=incoming(2,`/start ${nonce}`,456);group.message.chat.type='group';
    await receiveUpdate(db,group);assert.equal(data.get(SETTINGS_PATH).chatId,123);
    await receiveUpdate(db,incoming(3,`/start ${nonce}`,456));
    assert.equal(data.get(SETTINGS_PATH).chatId,456);
    assert.equal(data.get(SETTINGS_PATH).enabled,false);
    assert.equal(data.get(SETTINGS_PATH).replies,false);
  } finally {globalThis.fetch=fetchBefore;}
});
test('/stop blocks replies and phone alerts together', async () => {
  const fetchBefore=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,result:{}});
  try { const {db,data}=fixtures();await receiveUpdate(db,incoming(1,'/stop')); assert.equal(data.get(SETTINGS_PATH).enabled,false);assert.equal(canReply(data.get(SETTINGS_PATH),ticket,123,123),false); } finally {globalThis.fetch=fetchBefore;}
});
test('notice length stays within Telegram limit and all site languages work',()=>{
  for(const language of ['pt','en','es'] as const) assert.ok(notice('messages',ticket,{text:'x'.repeat(4000)},language).length<4096);
});

 test('outgoing alerts verify author, deduplicate persisted events and map Telegram reply IDs', async () => {
  const fetchBefore=globalThis.fetch;let sends=0;
  globalThis.fetch=async()=>{sends++;return Response.json({ok:true,result:{message_id:51}});};
  try {
    const {db,data}=fixtures();const now=Date.now();
    data.set(SETTINGS_PATH,{...settings,enabledAt:now-10000});
    data.set('tickets/a',{...ticket,createdAt:{toMillis:()=>now-1000}});
    const body={kind:'opened',ticketId:'a'};
    const forbidden=await deliverEvent(db,{...session,uid:'intruder'},body);
    assert.equal(forbidden.status,403);assert.equal(sends,0);
    await deliverEvent(db,{...session,uid:'user'},body);
    await deliverEvent(db,{...session,uid:'user'},body);
    assert.equal(sends,1);assert.equal(data.get('supportTelegramMessages/123_51').ticketId,'a');
  }finally{globalThis.fetch=fetchBefore;}
 });
 test('ambiguous Telegram timeout is recorded without duplicating the alert on retry', async () => {
  const fetchBefore=globalThis.fetch;let sends=0;
  globalThis.fetch=async()=>{sends++;throw new Error('network');};
  try{
    const {db,data}=fixtures();const now=Date.now();
    data.set(SETTINGS_PATH,{...settings,enabledAt:now-10000});
    data.set('tickets/a',{...ticket,createdAt:{toMillis:()=>now-1000}});
    await deliverEvent(db,{...session,uid:'user'},{kind:'opened',ticketId:'a'});
    await deliverEvent(db,{...session,uid:'user'},{kind:'opened',ticketId:'a'});
    assert.equal(sends,1);assert.equal(data.get(SETTINGS_PATH).deliveryProblem,true);
  }finally{globalThis.fetch=fetchBefore;}
 });

test('notice labels and escapes user text without interpreting tags, including long Unicode messages', () => {
  const result = notice('messages', { ...ticket, name: 'Carla & <b>user</b>', subject: '<a href="bad">test</a>' }, { text: '<b>hello</b> & goodbye\nsecond line' }, 'pt');
  assert.ok(result.includes('<b>Enviada por:</b> Carla &amp; &lt;b&gt;user&lt;/b&gt;'));
  assert.ok(result.includes('<blockquote>&lt;b&gt;hello&lt;/b&gt; &amp; goodbye\nsecond line</blockquote>'));
  assert.ok(!result.includes('<a href="bad">'));
  const long = notice('messages', ticket, { text: '&'.repeat(2599) + '😀'.repeat(2000) }, 'pt');
  const visible = long.replace(/<[^>]*>/g, '').replace(/&amp;/g,'&');
  assert.ok(visible.length < 4096);
  assert.ok(!/[\uD800-\uDBFF]…/.test(long));
  assert.ok(long.includes('leia o conteúdo completo'));
});
