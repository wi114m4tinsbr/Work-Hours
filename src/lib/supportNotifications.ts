import { auth } from '../firebase';
export async function notificationRequest(action: string, body?: unknown) {
  const user = auth.currentUser;
  if (!user) throw new Error('signed_out');
  const response = await fetch(`/api/support-telegram?action=${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error('notification_unavailable');
  return response.json();
}
/** The saved conversation is never rolled back because an optional phone alert fails. */
export async function notifySupport(kind: 'opened' | 'accepted' | 'messages', ticketId: string, messageId?: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await notificationRequest('event', { kind, ticketId, ...(messageId ? { messageId } : {}) }); return; }
    catch { if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1))); }
  }
}
