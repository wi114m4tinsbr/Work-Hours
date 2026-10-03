import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { CheckCircle2, Lightbulb, Lock, MessageCircleQuestion, Send } from 'lucide-react';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import { isOnline } from '../lib/staff';

type Lang = 'pt' | 'en' | 'es';

export interface Ticket {
  id: string;
  uid: string;
  email: string;
  name: string;
  type: 'question' | 'suggestion';
  subject: string;
  status: 'open' | 'accepted' | 'closed';
  assignedTo?: string;
  assignedName?: string;
  assignedUid?: string;
  createdAt: number | null;
  updatedAt: number | null;
  closedAt?: number | null;
  userUnread?: boolean;
  staffUnread?: boolean;
}

interface Message { id: string; by: 'user' | 'staff'; uid: string; name: string; text: string; at: number | null }

const millis = (v: unknown) => (v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

export function toTicket(id: string, d: Record<string, unknown>): Ticket {
  return {
    id, uid: String(d.uid ?? ''), email: String(d.email ?? ''), name: String(d.name ?? ''),
    type: d.type === 'suggestion' ? 'suggestion' : 'question', subject: String(d.subject ?? ''),
    status: d.status === 'accepted' || d.status === 'closed' ? d.status : 'open',
    assignedTo: typeof d.assignedTo === 'string' ? d.assignedTo : undefined,
    assignedName: typeof d.assignedName === 'string' ? d.assignedName : undefined,
    assignedUid: typeof d.assignedUid === 'string' ? d.assignedUid : undefined,
    createdAt: millis(d.createdAt), updatedAt: millis(d.updatedAt), closedAt: millis(d.closedAt),
    userUnread: d.userUnread === true, staffUnread: d.staffUnread === true,
  };
}

export const TICKET_TEXT = {
  pt: {
    question: 'Dúvida', suggestion: 'Sugestão', open: 'Aguardando atendimento', accepted: 'Em atendimento', closed: 'Fechada',
    live: 'Ao vivo', offline: 'Offline', offlineHint: 'A outra pessoa não está online agora. A mensagem fica salva nesta ocorrência.',
    waitingHint: 'Sua mensagem foi registrada. Assim que alguém da equipe aceitar, a conversa continua aqui.',
    closedHint: 'Esta ocorrência foi fechada. A conversa continua disponível para consulta.',
    write: 'Escreva uma mensagem…', send: 'Enviar', you: 'Você', team: 'Equipe Shift Hours', by: 'Atendido por', close: 'Fechar ocorrência',
    sendFailed: 'Não foi possível enviar.',
  },
  en: {
    question: 'Question', suggestion: 'Suggestion', open: 'Waiting for the team', accepted: 'In progress', closed: 'Closed',
    live: 'Live', offline: 'Offline', offlineHint: 'The other person is not online now. Your message stays saved in this ticket.',
    waitingHint: 'Your message was recorded. As soon as someone from the team accepts it, the conversation continues here.',
    closedHint: 'This ticket is closed. The conversation stays available to read.',
    write: 'Write a message…', send: 'Send', you: 'You', team: 'Shift Hours team', by: 'Handled by', close: 'Close ticket',
    sendFailed: 'Could not send.',
  },
  es: {
    question: 'Duda', suggestion: 'Sugerencia', open: 'Esperando atención', accepted: 'En atención', closed: 'Cerrada',
    live: 'En vivo', offline: 'Desconectado', offlineHint: 'La otra persona no está conectada ahora. El mensaje queda guardado en esta incidencia.',
    waitingHint: 'Tu mensaje quedó registrado. Cuando alguien del equipo lo acepte, la conversación sigue aquí.',
    closedHint: 'Esta incidencia está cerrada. La conversación sigue disponible para consulta.',
    write: 'Escribe un mensaje…', send: 'Enviar', you: 'Tú', team: 'Equipo Shift Hours', by: 'Atendido por', close: 'Cerrar incidencia',
    sendFailed: 'No se pudo enviar.',
  },
};

export function TypeIcon({ type, size = 16 }: { type: Ticket['type']; size?: number }) {
  return type === 'suggestion' ? <Lightbulb size={size} /> : <MessageCircleQuestion size={size} />;
}

export function StatusPill({ status, language }: { status: Ticket['status']; language: Lang }) {
  const t = TICKET_TEXT[language] || TICKET_TEXT.pt;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black whitespace-nowrap',
      status === 'open' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
      status === 'accepted' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      status === 'closed' && 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300')}>
      {status === 'closed' ? <Lock size={11} /> : status === 'accepted' ? <CheckCircle2 size={11} /> : null}{t[status]}
    </span>
  );
}

/**
 * Conversation of one ticket, in real time for both sides. "Ao vivo" shows when the other side
 * has the site open right now; otherwise messages simply stay in the ticket.
 */
export function TicketChat({ ticket, side, language, canWrite, onClose, extraActions }: {
  ticket: Ticket;
  side: 'user' | 'staff';
  language: Lang;
  canWrite: boolean;
  onClose?: () => Promise<void>;
  extraActions?: ReactNode;
}) {
  const t = TICKET_TEXT[language] || TICKET_TEXT.pt;
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-BR';
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [otherSeen, setOtherSeen] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => onSnapshot(query(collection(db, 'tickets', ticket.id, 'messages'), orderBy('at', 'asc')), (snap) => {
    setMessages(snap.docs.map((d) => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, by: data.by === 'staff' ? 'staff' : 'user', uid: String(data.uid ?? ''), name: String(data.name ?? ''), text: String(data.text ?? ''), at: millis(data.at) };
    }));
  }, () => {}), [ticket.id]);

  // Reading clears this side's unread mark.
  useEffect(() => {
    const field = side === 'user' ? 'userUnread' : 'staffUnread';
    const unread = side === 'user' ? ticket.userUnread : ticket.staffUnread;
    const mine = side === 'user' || ticket.assignedTo === auth.currentUser?.email?.toLowerCase();
    if (unread && mine && ticket.status !== 'closed') updateDoc(doc(db, 'tickets', ticket.id), { [field]: false }).catch(() => {});
  }, [ticket.id, ticket.userUnread, ticket.staffUnread, ticket.status, side, messages.length]);

  const otherUid = side === 'user' ? ticket.assignedUid : ticket.uid;
  useEffect(() => {
    setOtherSeen(null);
    if (!otherUid) return;
    return onSnapshot(doc(db, 'presence', otherUid), (snap) => setOtherSeen(millis(snap.data({ serverTimestamps: 'estimate' })?.at)), () => {});
  }, [otherUid]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [messages.length]);

  const live = ticket.status === 'accepted' && isOnline(otherSeen, now);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = text.trim().slice(0, 4000);
    const me = auth.currentUser;
    if (!body || !me || sending) return;
    setSending(true);
    setFailed(false);
    try {
      const name = (me.displayName || me.email || '').slice(0, 100);
      await addDoc(collection(db, 'tickets', ticket.id, 'messages'), { by: side, uid: me.uid, name, text: body, at: serverTimestamp() });
      await updateDoc(doc(db, 'tickets', ticket.id), {
        lastMessageAt: serverTimestamp(), lastMessageBy: side, updatedAt: serverTimestamp(),
        ...(side === 'user' ? { staffUnread: true } : { userUnread: true }),
      });
      setText('');
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const hint = ticket.status === 'closed' ? t.closedHint : ticket.status === 'open' ? (side === 'user' ? t.waitingHint : '') : live ? '' : t.offlineHint;

  return (
    <div className="flex flex-col h-full min-h-[24rem]" data-testid="ticket-chat">
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-stone-100 dark:border-white/10">
        <span className="w-8 h-8 rounded-xl bg-primary-light dark:bg-white/10 text-primary dark:text-white flex items-center justify-center"><TypeIcon type={ticket.type} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-stone-900 dark:text-white truncate">{ticket.subject}</p>
          <p className="text-xs text-stone-400 truncate">
            {t[ticket.type]}{side === 'staff' ? ` · ${ticket.name || ticket.email} · ${ticket.email}` : ''}
            {ticket.assignedName ? ` · ${t.by} ${ticket.assignedName}` : ''}
          </p>
        </div>
        <StatusPill status={ticket.status} language={language} />
        {ticket.status === 'accepted' && (
          <span data-testid="chat-presence" data-live={live ? '1' : '0'} className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-black',
            live ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-stone-300')}>
            <span className={cn('w-1.5 h-1.5 rounded-full', live ? 'bg-white animate-pulse' : 'bg-stone-400')} />{live ? t.live : t.offline}
          </span>
        )}
        {extraActions}
        {onClose && ticket.status !== 'closed' && (
          <button type="button" onClick={onClose} className="h-8 rounded-lg px-2.5 text-xs font-bold border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300 hover:bg-primary-light dark:hover:bg-white/10">{t.close}</button>
        )}
      </div>
      <div ref={list} className="flex-1 overflow-y-auto py-4 space-y-3" aria-live="polite">
        {messages.map((m) => {
          const mine = m.uid === auth.currentUser?.uid;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words',
                mine ? 'bg-primary text-white rounded-br-md dark:bg-white dark:text-stone-900' : 'bg-stone-100 text-stone-800 rounded-bl-md dark:bg-white/10 dark:text-stone-100')}>
                <p className={cn('text-[10px] font-black uppercase tracking-wide mb-0.5', mine ? 'opacity-70' : 'text-stone-400')}>
                  {mine ? t.you : m.by === 'staff' ? (side === 'user' ? t.team : m.name) : m.name}
                  {m.at ? ` · ${new Date(m.at).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      {hint && <p className="text-xs text-stone-500 dark:text-stone-400 pb-2">{hint}</p>}
      {canWrite && ticket.status !== 'closed' && (
        <form onSubmit={send} className="flex items-end gap-2 pt-2 border-t border-stone-100 dark:border-white/10">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder={t.write} aria-label={t.write} data-testid="chat-input"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
            className="flex-1 resize-none rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2 text-sm text-stone-900 dark:text-white" />
          <button type="submit" disabled={sending || !text.trim()} data-testid="chat-send"
            className="h-10 rounded-xl px-4 inline-flex items-center gap-1.5 text-sm font-black bg-primary text-white hover:bg-primary-hover disabled:opacity-50 dark:bg-white dark:text-stone-900"><Send size={15} />{t.send}</button>
        </form>
      )}
      {failed && <p className="text-xs font-semibold text-red-600 dark:text-red-400 pt-1">{t.sendFailed}</p>}
    </div>
  );
}
