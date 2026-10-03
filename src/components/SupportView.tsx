import { useEffect, useState, type FormEvent } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ArrowLeft, Plus } from 'lucide-react';
import type { User } from 'firebase/auth';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { ToolIdentity } from './ToolIdentity';
import { StatusPill, TICKET_TEXT, TicketChat, TypeIcon, toTicket, type Ticket } from './TicketChat';

type Lang = 'pt' | 'en' | 'es';

const C = {
  pt: {
    title: 'Dúvidas e sugestões', back: 'Voltar', intro: 'Mande sua dúvida ou ideia para a equipe. Quando alguém aceitar, vocês conversam aqui, ao vivo se os dois estiverem online.',
    new: 'Nova ocorrência', mine: 'Minhas ocorrências', empty: 'Você ainda não abriu nenhuma ocorrência.', type: 'Tipo', subject: 'Assunto',
    subjectHint: 'Ex.: Como compartilho uma fatura?', message: 'Mensagem', messageHint: 'Conte com detalhes para a equipe entender.',
    submit: 'Enviar', cancel: 'Cancelar', failed: 'Não foi possível enviar. Tente de novo.', list: 'Voltar à lista', pick: 'Escolha uma ocorrência para ver a conversa.',
    closeConfirm: 'Fechar esta ocorrência? A conversa continua disponível para consulta.',
  },
  en: {
    title: 'Questions and suggestions', back: 'Back', intro: 'Send your question or idea to the team. Once someone accepts it, you talk here, live when you are both online.',
    new: 'New ticket', mine: 'My tickets', empty: 'You have not opened any ticket yet.', type: 'Type', subject: 'Subject',
    subjectHint: 'E.g. How do I share an invoice?', message: 'Message', messageHint: 'Give details so the team understands.',
    submit: 'Send', cancel: 'Cancel', failed: 'Could not send. Try again.', list: 'Back to the list', pick: 'Pick a ticket to see the conversation.',
    closeConfirm: 'Close this ticket? The conversation stays available to read.',
  },
  es: {
    title: 'Dudas y sugerencias', back: 'Volver', intro: 'Envía tu duda o idea al equipo. Cuando alguien la acepte, conversan aquí, en vivo si los dos están conectados.',
    new: 'Nueva incidencia', mine: 'Mis incidencias', empty: 'Aún no abriste ninguna incidencia.', type: 'Tipo', subject: 'Asunto',
    subjectHint: 'Ej.: ¿Cómo comparto una factura?', message: 'Mensaje', messageHint: 'Cuenta los detalles para que el equipo entienda.',
    submit: 'Enviar', cancel: 'Cancelar', failed: 'No se pudo enviar. Inténtalo de nuevo.', list: 'Volver a la lista', pick: 'Elige una incidencia para ver la conversación.',
    closeConfirm: '¿Cerrar esta incidencia? La conversación sigue disponible para consulta.',
  },
};

/** The signed-in user's own tickets, a form to open a new one and the chat of the selected one. */
export function SupportView({ user, language, onBack }: { user: User; language: Lang; onBack: () => void }) {
  const t = C[language] || C.pt;
  const tt = TICKET_TEXT[language] || TICKET_TEXT.pt;
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-BR';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<Ticket['type']>('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, 'tickets'), where('uid', '==', user.uid)), (snap) => {
    const list = snap.docs.map((d) => toTicket(d.id, d.data({ serverTimestamps: 'estimate' })));
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    setTickets(list);
  }, (error) => console.error(error)), [user.uid]);

  useEffect(() => { if (!tickets.length && !selected) setCreating(true); }, [tickets.length, selected]);

  const ticket = tickets.find((x) => x.id === selected) || null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const s = subject.trim().slice(0, 120);
    const m = message.trim().slice(0, 4000);
    if (!s || !m || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const name = (user.displayName || user.email || '').slice(0, 100);
      const ref = await addDoc(collection(db, 'tickets'), {
        uid: user.uid, email: (user.email || '').toLowerCase(), name, type, subject: s, status: 'open',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessageAt: serverTimestamp(),
        lastMessageBy: 'user', userUnread: false, staffUnread: true,
      });
      await addDoc(collection(db, 'tickets', ref.id, 'messages'), { by: 'user', uid: user.uid, name, text: m, at: serverTimestamp() });
      setSubject('');
      setMessage('');
      setCreating(false);
      setSelected(ref.id);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const close = async (target: Ticket) => {
    if (!window.confirm(t.closeConfirm)) return;
    await updateDoc(doc(db, 'tickets', target.id), { status: 'closed', closedAt: serverTimestamp(), closedBy: 'user', updatedAt: serverTimestamp() });
  };

  const field = 'w-full rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 py-2.5 text-sm text-stone-900 dark:text-white';
  const showDetail = creating || !!ticket;

  return (
    <div className="w-full" data-testid="support-view">
      <div className="bg-white/95 dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 shadow-sm">
        <div className="h-12 w-full max-w-7xl mx-auto flex items-center gap-3 px-4">
          <ToolIdentity title={t.title} language={language} backLabel={t.back} onBack={onBack} />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-5 max-w-2xl">{t.intro}</p>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className={cn('rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-3 h-fit', showDetail && 'hidden lg:block')}>
            <button type="button" onClick={() => { setCreating(true); setSelected(null); }} data-testid="support-new"
              className="w-full h-10 rounded-xl inline-flex items-center justify-center gap-1.5 text-sm font-black bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-stone-900">
              <Plus size={16} />{t.new}
            </button>
            <p className="text-xs font-black uppercase tracking-wider text-stone-400 mt-4 mb-2 px-1">{t.mine}</p>
            {tickets.length === 0 ? <p className="text-sm text-stone-500 px-1 py-2">{t.empty}</p> : (
              <ul className="space-y-1.5" data-testid="support-list">
                {tickets.map((x) => (
                  <li key={x.id}>
                    <button type="button" onClick={() => { setSelected(x.id); setCreating(false); }}
                      className={cn('w-full text-left rounded-xl p-2.5 flex gap-2.5 hover:bg-primary-light dark:hover:bg-white/10', selected === x.id && 'bg-primary-light dark:bg-white/10')}>
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-200 flex items-center justify-center"><TypeIcon type={x.type} size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-stone-900 dark:text-white truncate">{x.subject}</span>
                          {x.userUnread && <span className="w-2 h-2 shrink-0 rounded-full bg-red-500" data-testid="support-unread" />}
                        </span>
                        <span className="flex items-center gap-2 mt-1">
                          <StatusPill status={x.status} language={language} />
                          {x.updatedAt && <span className="text-[11px] text-stone-400">{new Date(x.updatedAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section className={cn('rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 sm:p-5 min-h-[28rem]', !showDetail && 'hidden lg:block')}>
            {showDetail && tickets.length > 0 && (
              <button type="button" onClick={() => { setSelected(null); setCreating(false); }} className="lg:hidden mb-3 inline-flex items-center gap-1 text-xs font-bold text-stone-500">
                <ArrowLeft size={14} />{t.list}
              </button>
            )}
            {creating ? (
              <form onSubmit={submit} className="space-y-4 max-w-xl" data-testid="support-form">
                <h2 className="text-lg font-black text-stone-900 dark:text-white">{t.new}</h2>
                <div>
                  <p className="text-xs font-bold text-stone-500 mb-1.5">{t.type}</p>
                  <div className="inline-flex rounded-xl border border-stone-200 dark:border-white/10 p-1 gap-1">
                    {(['question', 'suggestion'] as const).map((k) => (
                      <button key={k} type="button" onClick={() => setType(k)} data-testid={`support-type-${k}`}
                        className={cn('h-8 px-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-bold',
                          type === k ? 'bg-primary text-white dark:bg-white dark:text-stone-900' : 'text-stone-600 dark:text-stone-300 hover:bg-primary-light dark:hover:bg-white/10')}>
                        <TypeIcon type={k} size={14} />{tt[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-bold text-stone-500">{t.subject}</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required placeholder={t.subjectHint} data-testid="support-subject" className={cn(field, 'mt-1.5')} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-stone-500">{t.message}</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} required rows={6} placeholder={t.messageHint} data-testid="support-message" className={cn(field, 'mt-1.5 resize-y')} />
                </label>
                {failed && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t.failed}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || !subject.trim() || !message.trim()} data-testid="support-submit"
                    className="h-10 rounded-xl px-5 text-sm font-black bg-primary text-white hover:bg-primary-hover disabled:opacity-50 dark:bg-white dark:text-stone-900">{t.submit}</button>
                  {tickets.length > 0 && (
                    <button type="button" onClick={() => setCreating(false)} className="h-10 rounded-xl px-4 text-sm font-bold border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300">{t.cancel}</button>
                  )}
                </div>
              </form>
            ) : ticket ? (
              <div key={ticket.id} className="h-full"><TicketChat ticket={ticket} side="user" language={language} canWrite onClose={() => close(ticket)} /></div>
            ) : (
              <p className="text-sm text-stone-500 py-10 text-center">{t.pick}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
