import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { verifyUserToken, FORMULA_OWNER_EMAIL, type UserSession } from './formula-auth';
import { supportDb } from './support-admin-db';
import { BOT_NAME, DEFAULT_PREFS, SETTINGS_PATH, preferences, ownerSession, validId, ms, canReply, eventAllowed, notice, botReply } from './support-telegram-policy';

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const secret = () => createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN || '').update('shift-hours-webhook-v1').digest('hex');
export function validWebhook(value: string | null) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !value) return false;
  const expected = secret();
  const supplied = Buffer.from(value);
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}
async function telegram(method: string, data: object = {}) {
  // Never log fetch errors: their URL contains the bot credential.
  try {
    const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(8000),
    });
    const result = await r.json();
    if (!r.ok || !result.ok) throw new Error('telegram_unavailable');
    return result.result;
  } catch { throw new Error('telegram_unavailable'); }
}
const send = (chatId: number, text: string) => telegram('sendMessage', { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
const privateRef = (db: Firestore) => db.doc(SETTINGS_PATH);
async function limited(db: Firestore, key: string, delay: number) {
  const ref = db.doc(`supportLimits/${digest(key)}`);
  return db.runTransaction(async tx => {
    const prev = await tx.get(ref); const now = Date.now();
    if (now - (prev.data()?.at || 0) < delay) return false;
    tx.set(ref, { at: now }); return true;
  });
}
async function status(db: Firestore) {
  const s = (await privateRef(db).get()).data() || {};
  return { ...preferences(s), connected: !!s.chatId, webhookReady: !!s.webhookReady, lastDelivery: s.lastDelivery || null, deliveryProblem: s.deliveryProblem || false };
}
export async function deliverEvent(db: Firestore, session: UserSession, body: any) {
  const kind = body.kind;
  if (!['opened', 'accepted', 'messages'].includes(kind) || !validId(body.ticketId) || (kind === 'messages' && !validId(body.messageId))) return json({ error: 'invalid_event' }, 400);
  const ticketRef = db.doc(`tickets/${body.ticketId}`);
  const ticket = (await ticketRef.get()).data();
  if (!ticket) return json({ ok: true });
  let message: any = null; let at = ms(ticket.createdAt);
  if (kind === 'accepted') {
    if (session.uid !== ticket.assignedUid || session.email !== ticket.assignedTo) return json({ error: 'forbidden' }, 403);
    const staff = (await db.doc(`staff/${session.email}`).get()).data();
    if (!ownerSession(session) && staff?.permissions?.tickets !== true) return json({ error: 'forbidden' }, 403);
    at = ms(ticket.acceptedAt);
  } else {
    if (ticket.uid !== session.uid) return json({ error: 'forbidden' }, 403);
    if (kind === 'messages') {
      message = (await ticketRef.collection('messages').doc(body.messageId).get()).data();
      if (!message || message.by !== 'user' || message.uid !== session.uid) return json({ error: 'forbidden' }, 403);
      at = ms(message.at);
    }
  }
  const settingsRef = privateRef(db);
  const settings = (await settingsRef.get()).data();
  if (!eventAllowed(kind, settings, ticket, at, Date.now())) return json({ ok: true });
  const delivery = db.doc(`supportDeliveries/${digest(`${kind}:${body.ticketId}:${kind === 'messages' ? body.messageId : at}`)}`);
  const claimed = await db.runTransaction(async tx => {
    const old = await tx.get(delivery);
    const current = (await tx.get(settingsRef)).data();
    const currentTicket = (await tx.get(ticketRef)).data();
    if (old.exists || !eventAllowed(kind, current, currentTicket, at, Date.now())) return null;
    // One bot chat: apply a shared pace instead of relying on each caller independently.
    if (Date.now() - (current?.lastAttempt || 0) < 1200) return 'busy';
    tx.set(delivery, { state: 'sending', at: Date.now(), ticketId: body.ticketId });
    tx.update(settingsRef, { lastAttempt: Date.now() });
    return current;
  });
  if (claimed === 'busy') return json({ error: 'retry' }, 503);
  if (!claimed) return json({ ok: true });
  try {
    const sent = await send(claimed.chatId, notice(kind, ticket, message, preferences(claimed).language));
    const batch = db.batch();
    batch.set(delivery, { state: 'sent', at: Date.now() }, { merge: true });
    batch.set(db.doc(`supportTelegramMessages/${claimed.chatId}_${sent.message_id}`), { ticketId: body.ticketId, linkedAt: claimed.linkedAt });
    batch.set(settingsRef, { lastDelivery: Date.now(), deliveryProblem: false }, { merge: true });
    await batch.commit();
  } catch {
    // Telegram offers no idempotency key. An ambiguous timeout must not resend the user's text.
    await delivery.set({ state: 'unconfirmed', at: Date.now() }, { merge: true });
    await settingsRef.set({ deliveryProblem: true }, { merge: true });
  }
  return json({ ok: true });
}

export async function receiveUpdate(db: Firestore, update: any) {
  if (!Number.isSafeInteger(update?.update_id)) return;
  const m = update.message;
  if (!m || m.chat?.type !== 'private' || !Number.isSafeInteger(m.chat.id) || !Number.isSafeInteger(m.from?.id) || m.from.is_bot || m.chat.id !== m.from.id) return;
  const settingsRef = privateRef(db);
  const updateRef = db.doc(`supportTelegramUpdates/${update.update_id}`);
  const text = typeof m.text === 'string' ? m.text.trim() : '';
  const match = /^\/start ([a-f0-9]{48})$/.exec(text);
  if (match) {
    const result = await db.runTransaction(async tx => {
      const old = await tx.get(updateRef); const settings = (await tx.get(settingsRef)).data();
      if (old.exists || !settings || settings.pairHash !== digest(match[1]) || settings.pairExpires < Date.now()) return false;
      tx.update(settingsRef, { ...settings, chatId: m.chat.id, fromId: m.from.id, linkedAt: Date.now(), pairHash: FieldValue.delete(), pairExpires: FieldValue.delete(), enabled: false, replies: false });
      tx.set(updateRef, { at: Date.now(), outcome: 'paired' });
      return preferences(settings).language;
    });
    if (result) await send(m.chat.id, botReply('paired', result)).catch(() => {});
    return;
  }
  const result = await db.runTransaction(async tx => {
    const old = await tx.get(updateRef); const s = (await tx.get(settingsRef)).data();
    if (old.exists || !s || s.chatId !== m.chat.id || s.fromId !== m.from.id) return '';
    if (text === '/stop') {
      tx.update(settingsRef, { enabled: false, replies: false });
      tx.set(updateRef, { at: Date.now(), outcome: 'stopped' });
      return botReply('stopped', s.language);
    }
    const replyId = m.reply_to_message?.message_id;
    const mapping = Number.isSafeInteger(replyId) ? (await tx.get(db.doc(`supportTelegramMessages/${m.chat.id}_${replyId}`))).data() : null;
    if (!mapping || mapping.linkedAt !== s.linkedAt || !validId(mapping.ticketId) || !text || text.length > 4000 || text.startsWith('/')) {
      tx.set(updateRef, { at: Date.now(), outcome: 'ignored' });
      return botReply('help', s.language);
    }
    const ticketRef = db.doc(`tickets/${mapping.ticketId}`);
    const ticket = (await tx.get(ticketRef)).data();
    if (!canReply(s, ticket, m.chat.id, m.from.id)) {
      tx.set(updateRef, { at: Date.now(), outcome: 'blocked' });
      return botReply('blocked', s.language);
    }
    // Reading ticket + settings in this transaction prevents close/disable races.
    tx.create(ticketRef.collection('messages').doc(`telegram_${update.update_id}`), { by: 'staff', uid: s.ownerUid, name: String(ticket?.assignedName || 'Shift Hours').slice(0, 100), text, at: FieldValue.serverTimestamp() });
    tx.update(ticketRef, { lastMessageAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastMessageBy: 'staff', userUnread: true });
    tx.set(updateRef, { at: Date.now(), outcome: 'delivered' });
    return botReply('sent', s.language);
  });
  if (result) await send(m.chat.id, result).catch(() => {});
}

export async function supportTelegram(request: Request) {
  const action = new URL(request.url).searchParams.get('action') || 'status';
  const production = process.env.VERCEL_ENV === 'production';
  if (action === 'webhook') {
    if (!production || request.method !== 'POST' || !validWebhook(request.headers.get('x-telegram-bot-api-secret-token'))) return json({ error: 'not_found' }, 404);
    try {
      const raw = await request.text(); if (raw.length > 32_000) return json({ error: 'too_large' }, 413);
      await receiveUpdate(supportDb(), JSON.parse(raw)); return json({ ok: true });
    } catch { return json({ error: 'temporarily_unavailable' }, 503); }
  }
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  const session = await verifyUserToken(bearer);
  if (!session || (action !== 'event' && !ownerSession(session))) return json({ error: 'not_found' }, 404);
  const configured = !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.FIREBASE_SERVICE_ACCOUNT;
  if (action === 'status' && request.method === 'GET') {
    if (!production || !configured) return json({ ...DEFAULT_PREFS, production, tokenReady: !!process.env.TELEGRAM_BOT_TOKEN, databaseReady: !!process.env.FIREBASE_SERVICE_ACCOUNT, connected: false });
    try { return json({ ...await status(supportDb()), production: true, tokenReady: true, databaseReady: true }); }
    catch { return json({ error: 'database_configuration' }, 503); }
  }
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  if (!production || !configured) return action === 'event' ? json({ ok: true }) : json({ error: 'configuration_required' }, 503);
  try {
    const raw = await request.text(); if (raw.length > 8192) return json({ error: 'too_large' }, 413);
    const body = JSON.parse(raw || '{}'); const db = supportDb(); const ref = privateRef(db);
    if (action === 'event') return await deliverEvent(db, session, body);
    if (action === 'save') {
      await db.runTransaction(async tx => {
        const old = (await tx.get(ref)).data() || {};
        const prefs = preferences(body);
        if (prefs.enabled && (!old.chatId || !old.webhookReady)) throw new Error('not_connected');
        tx.set(ref, { ...prefs, ownerUid: session.uid, enabledAt: prefs.enabled && !old.enabled ? Date.now() : old.enabledAt || Date.now() }, { merge: true });
      });
    } else if (action === 'pair') {
      if (!await limited(db, 'pair', 10_000)) return json({ error: 'wait' }, 429);
      const bot = await telegram('getMe'); if (bot.username !== BOT_NAME) return json({ error: 'wrong_bot' }, 409);
      await telegram('setWebhook', { url: 'https://shifthours.com/api/support-telegram?action=webhook', secret_token: secret(), allowed_updates: ['message'], max_connections: 1 });
      const nonce = randomBytes(24).toString('hex');
      // Pause delivery during re-linking; old Telegram messages cannot target the new connection.
      await ref.set({ ...DEFAULT_PREFS, chatId: FieldValue.delete(), fromId: FieldValue.delete(), linkedAt: FieldValue.delete(), ownerUid: session.uid, pairHash: digest(nonce), pairExpires: Date.now() + 600_000, webhookReady: true }, { merge: true });
      return json({ url: `https://t.me/${BOT_NAME}?start=${nonce}` });
    } else if (action === 'disconnect') {
      await ref.set({ ...DEFAULT_PREFS, chatId: FieldValue.delete(), fromId: FieldValue.delete(), pairHash: FieldValue.delete(), pairExpires: FieldValue.delete(), linkedAt: FieldValue.delete() }, { merge: true });
    } else if (action === 'test') {
      const s = (await ref.get()).data();
      if (!s?.chatId || !s.enabled) return json({ error: 'not_connected' }, 409);
      if (!await limited(db, 'test', 10_000)) return json({ error: 'wait' }, 429);
      await send(s.chatId, botReply('test', s.language));
    } else return json({ error: 'not_found' }, 404);
    return json(await status(db));
  } catch { return json({ error: 'configuration_or_delivery' }, 503); }
}
