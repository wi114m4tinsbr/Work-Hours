import { FORMULA_OWNER_EMAIL, type UserSession } from './formula-auth.js';
export const BOT_NAME = 'ShiftHoursAvisoBot';
export const SETTINGS_PATH = 'supportPrivate/telegram';
export type Preferences = { enabled: boolean; opened: boolean; accepted: boolean; messages: boolean; replies: boolean; language: 'pt' | 'en' | 'es' };
export const DEFAULT_PREFS: Preferences = { enabled: false, opened: true, accepted: true, messages: true, replies: false, language: 'pt' };
export function preferences(value: any): Preferences {
  const result = { ...DEFAULT_PREFS };
  for (const key of ['enabled', 'opened', 'accepted', 'messages', 'replies'] as const) if (typeof value?.[key] === 'boolean') result[key] = value[key];
  if (['pt', 'en', 'es'].includes(value?.language)) result.language = value.language;
  return result;
}
export const ownerSession = (s: UserSession | null) => !!s && s.email === FORMULA_OWNER_EMAIL && s.provider === 'google.com';
export const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
export const ms = (value: any): number => typeof value?.toMillis === 'function' ? value.toMillis() : 0;
export function canReply(settings: any, ticket: any, chatId: number, fromId: number) {
  return !!settings?.enabled && !!settings.replies && settings.chatId === chatId && settings.fromId === fromId &&
    !!settings.ownerUid && ticket?.status === 'accepted' && ticket.assignedTo === FORMULA_OWNER_EMAIL && ticket.assignedUid === settings.ownerUid;
}
export function eventAllowed(kind: string, settings: any, ticket: any, eventAt: number, now: number) {
  return settings?.enabled === true && typeof settings.chatId === 'number' && settings[kind] === true &&
    ticket?.status !== 'closed' && eventAt >= (settings.enabledAt || now) && eventAt <= now + 5000 && now - eventAt < 600_000 &&
    (kind !== 'messages' || (ticket.status === 'accepted' && ticket.assignedTo === FORMULA_OWNER_EMAIL && ticket.assignedUid === settings.ownerUid));
}
export function notice(kind: string, t: any, message: any, language: Preferences['language']) {
  const labels = { pt: ['Nova ocorrência', 'Ocorrência aceita', 'Nova mensagem', 'Aceita por', 'Responda a esta mensagem para responder no site, se essa opção estiver ligada.'], en: ['New ticket', 'Ticket accepted', 'New message', 'Accepted by', 'Reply to this message to answer on the website, if this option is enabled.'], es: ['Nueva incidencia', 'Incidencia aceptada', 'Nuevo mensaje', 'Aceptada por', 'Responde a este mensaje para contestar en el sitio, si la opción está activada.'] }[language];
  const clean = (s: unknown, n: number) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n);
  return [labels[kind === 'opened' ? 0 : kind === 'accepted' ? 1 : 2], clean(t.subject, 120), clean(t.name || t.email, 100), kind === 'accepted' ? `${labels[3]}: ${clean(t.assignedName, 100)}` : '', kind === 'messages' ? clean(message?.text, 2600) : '', kind === 'messages' || (kind === 'accepted' && t.assignedTo === FORMULA_OWNER_EMAIL) ? labels[4] : '', 'https://shifthours.com/'].filter(Boolean).join('\n\n');
}

export function botReply(key: 'paired' | 'stopped' | 'help' | 'blocked' | 'sent' | 'test', language: string = 'pt') {
  const text = {
    pt: { paired: 'Shift Hours: Telegram conectado. Ative os avisos no painel Admin → Notificações. /stop desliga avisos e respostas.', stopped: 'Avisos e respostas desligados. Para reativar, use Admin → Notificações no site.', help: 'Use Responder em um aviso da ocorrência e envie apenas texto (até 4.000 caracteres). Para ligar ou desligar, abra Admin → Notificações.', blocked: 'Resposta não enviada: a opção está desligada, a ocorrência foi encerrada ou não está atribuída a você.', sent: 'Resposta enviada à conversa no site.', test: 'Shift Hours: teste de notificações. O Telegram está conectado.' },
    en: { paired: 'Shift Hours: Telegram connected. Enable alerts in Admin → Notifications. /stop disables alerts and replies.', stopped: 'Alerts and replies disabled. To enable them, use Admin → Notifications on the website.', help: 'Use Reply on a ticket alert and send text only (up to 4,000 characters). Open Admin → Notifications to enable or disable.', blocked: 'Reply not sent: replies are disabled, the ticket is closed or it is not assigned to you.', sent: 'Reply sent to the website conversation.', test: 'Shift Hours: notification test. Telegram is connected.' },
    es: { paired: 'Shift Hours: Telegram conectado. Activa los avisos en Admin → Notificaciones. /stop desactiva avisos y respuestas.', stopped: 'Avisos y respuestas desactivados. Para reactivarlos, usa Admin → Notificaciones en el sitio.', help: 'Usa Responder en un aviso y envía solo texto (hasta 4.000 caracteres). Abre Admin → Notificaciones para activar o desactivar.', blocked: 'Respuesta no enviada: la opción está desactivada, la incidencia está cerrada o no está asignada a ti.', sent: 'Respuesta enviada a la conversación del sitio.', test: 'Shift Hours: prueba de notificaciones. Telegram está conectado.' },
  };
  return (text[language as keyof typeof text] || text.pt)[key];
}
