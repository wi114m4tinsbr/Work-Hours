import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { ArrowLeft, Hand, Inbox, Trash2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import { logAdmin } from '../lib/adminLog';
import { SoundToggle } from './SoundToggle';
import { StatusPill, TicketChat, TypeIcon, toTicket, type Ticket } from './TicketChat';

type Lang = 'pt' | 'en' | 'es';
type Filter = 'open' | 'mine' | 'accepted' | 'closed' | 'all';

const C = {
  pt: {
    filters: { open: 'Novas', mine: 'Minhas', accepted: 'Em atendimento', closed: 'Fechadas', all: 'Todas' },
    empty: 'Nenhuma ocorrência aqui.', pick: 'Escolha uma ocorrência para ver a conversa.', accept: 'Aceitar e responder',
    acceptHint: 'Ao aceitar, você vira o responsável e a conversa abre para os dois.', otherStaff: 'Em atendimento por', readOnly: 'Só quem aceitou responde. Você pode acompanhar.',
    remove: 'Apagar', removeConfirm: 'Apagar esta ocorrência e toda a conversa? Não dá para desfazer.', list: 'Voltar à lista', failed: 'Não foi possível concluir.',
    closeConfirm: 'Fechar esta ocorrência? Ela continua disponível para consulta.',
  },
  en: {
    filters: { open: 'New', mine: 'Mine', accepted: 'In progress', closed: 'Closed', all: 'All' },
    empty: 'No tickets here.', pick: 'Pick a ticket to see the conversation.', accept: 'Accept and reply',
    acceptHint: 'When you accept, you become responsible and the conversation opens for both.', otherStaff: 'Handled by', readOnly: 'Only whoever accepted replies. You can follow along.',
    remove: 'Delete', removeConfirm: 'Delete this ticket and the whole conversation? This cannot be undone.', list: 'Back to the list', failed: 'Could not complete.',
    closeConfirm: 'Close this ticket? It stays available to read.',
  },
  es: {
    filters: { open: 'Nuevas', mine: 'Mías', accepted: 'En atención', closed: 'Cerradas', all: 'Todas' },
    empty: 'No hay incidencias aquí.', pick: 'Elige una incidencia para ver la conversación.', accept: 'Aceptar y responder',
    acceptHint: 'Al aceptar, pasas a ser el responsable y la conversación se abre para los dos.', otherStaff: 'Atendida por', readOnly: 'Solo quien aceptó responde. Puedes seguirla.',
    remove: 'Borrar', removeConfirm: '¿Borrar esta incidencia y toda la conversación? No se puede deshacer.', list: 'Volver a la lista', failed: 'No se pudo completar.',
    closeConfirm: '¿Cerrar esta incidencia? Sigue disponible para consulta.',
  },
};

/** Panel tab for staff with the tickets power: new tickets, accept, chat, close; only the owner deletes. */
export function SupportAdmin({ language, locale, isOwner }: { language: Lang; locale: string; isOwner: boolean }) {
  const t = C[language] || C.pt;
  const me = (auth.currentUser?.email || '').toLowerCase();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => onSnapshot(collection(db, 'tickets'), (snap) => {
    const list = snap.docs.map((d) => toTicket(d.id, d.data({ serverTimestamps: 'estimate' })));
    list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    setTickets(list);
  }, (error) => { console.error(error); setTickets([]); }), []);

  const all = tickets ?? [];
  const match = (x: Ticket, f: Filter) => f === 'all' || (f === 'mine' ? x.assignedTo === me && x.status !== 'closed' : x.status === f);
  const shown = useMemo(() => all.filter((x) => match(x, filter)), [tickets, filter]);
  const ticket = all.find((x) => x.id === selected) || null;
  const canAnswer = !!ticket && (ticket.assignedTo === me || isOwner);

  const run = async (work: () => Promise<unknown>) => {
    setFailed(false);
    try { await work(); } catch (error) { console.error(error); setFailed(true); }
  };
  const accept = (x: Ticket) => run(async () => {
    const user = auth.currentUser!;
    await updateDoc(doc(db, 'tickets', x.id), {
      status: 'accepted', assignedTo: me, assignedName: (user.displayName || me).slice(0, 100), assignedUid: user.uid,
      acceptedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    setFilter('mine');
    await logAdmin('ticketAccept', { uid: x.uid, email: x.email }, x.subject).catch(() => {});
  });
  const close = (x: Ticket) => run(async () => {
    if (!window.confirm(t.closeConfirm)) return;
    await updateDoc(doc(db, 'tickets', x.id), { status: 'closed', closedAt: serverTimestamp(), closedBy: me, updatedAt: serverTimestamp() });
    await logAdmin('ticketClose', { uid: x.uid, email: x.email }, x.subject).catch(() => {});
  });
  const remove = (x: Ticket) => run(async () => {
    if (!window.confirm(t.removeConfirm)) return;
    const messages = await getDocs(collection(db, 'tickets', x.id, 'messages'));
    for (let i = 0; i < messages.docs.length; i += 400) {
      const batch = writeBatch(db);
      messages.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'tickets', x.id));
    setSelected(null);
    await logAdmin('ticketDelete', { uid: x.uid, email: x.email }, x.subject).catch(() => {});
  });

  const count = (f: Filter) => all.filter((x) => match(x, f)).length;
  // Red counts show what needs attention: new tickets, and my tickets with a reply I have not read.
  const urgent = (f: Filter) => f === 'open' ? count('open') : f === 'mine' ? all.filter((x) => match(x, 'mine') && x.staffUnread).length : 0;
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (picked || !tickets) return;
    setPicked(true);
    if (!urgent('open') && urgent('mine')) setFilter('mine');
  }, [tickets]);

  return (
    <div className="space-y-4" data-testid="support-admin">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(t.filters) as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setSelected(null); }} data-testid={`support-filter-${f}`}
            className={cn('h-8 px-3 rounded-lg text-sm font-bold inline-flex items-center gap-1.5',
              filter === f ? 'bg-primary text-white dark:bg-white/15' : 'border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300 hover:bg-primary-light dark:hover:bg-white/10')}>
            {t.filters[f]}
            {urgent(f) > 0
              ? <span data-testid={`support-urgent-${f}`} className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black leading-5 text-center tabular-nums">{urgent(f)}</span>
              : <span className="text-[11px] opacity-70 tabular-nums">{count(f)}</span>}
          </button>
        ))}
        <SoundToggle language={language} className="ml-auto" />
      </div>
      {failed && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{t.failed}</p>}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <aside className={cn('rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-2 h-fit', ticket && 'hidden lg:block')}>
          {shown.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-400 font-semibold"><Inbox className="mx-auto mb-2" size={22} />{t.empty}</div>
          ) : (
            <ul className="space-y-1" data-testid="support-admin-list">
              {shown.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setSelected(x.id)}
                    className={cn('w-full text-left rounded-xl p-2.5 flex gap-2.5 hover:bg-primary-light dark:hover:bg-white/10', selected === x.id && 'bg-primary-light dark:bg-white/10')}>
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-200 flex items-center justify-center"><TypeIcon type={x.type} size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-stone-900 dark:text-white truncate">{x.subject}</span>
                        {x.staffUnread && x.status !== 'closed' && <span className="w-2 h-2 shrink-0 rounded-full bg-red-500" />}
                      </span>
                      <span className="block text-xs text-stone-500 truncate">{x.name || x.email} · {x.email}</span>
                      <span className="flex flex-wrap items-center gap-2 mt-1">
                        <StatusPill status={x.status} language={language} />
                        {x.assignedName && x.status !== 'open' && <span className="text-[11px] text-stone-400 truncate">{x.assignedName}</span>}
                        {x.updatedAt && <span className="text-[11px] text-stone-400">{new Date(x.updatedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className={cn('rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 sm:p-5 min-h-[28rem]', !ticket && 'hidden lg:block')}>
          {ticket ? (
            <>
              <button type="button" onClick={() => setSelected(null)} className="lg:hidden mb-3 inline-flex items-center gap-1 text-xs font-bold text-stone-500"><ArrowLeft size={14} />{t.list}</button>
              {ticket.status === 'open' && (
                <div className="mb-3 rounded-xl bg-primary-light dark:bg-white/5 p-3 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-stone-600 dark:text-stone-300 flex-1 min-w-[12rem]">{t.acceptHint}</p>
                  <button type="button" onClick={() => accept(ticket)} data-testid="ticket-accept"
                    className="h-9 rounded-xl px-4 inline-flex items-center gap-1.5 text-sm font-black bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-stone-900"><Hand size={15} />{t.accept}</button>
                </div>
              )}
              {ticket.status === 'accepted' && !canAnswer && <p className="mb-3 text-xs text-stone-500">{t.otherStaff} {ticket.assignedName || ticket.assignedTo}. {t.readOnly}</p>}
              <div key={ticket.id} className="h-full"><TicketChat ticket={ticket} side="staff" language={language} canWrite={ticket.status === 'accepted' && canAnswer}
                onClose={ticket.status === 'accepted' && canAnswer ? () => close(ticket) : undefined}
                extraActions={isOwner ? (
                  <button type="button" onClick={() => remove(ticket)} data-testid="ticket-delete" title={t.remove}
                    className="h-8 rounded-lg px-2.5 inline-flex items-center gap-1 text-xs font-bold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={13} />{t.remove}</button>
                ) : null} /></div>
            </>
          ) : <p className="text-sm text-stone-500 py-10 text-center">{tickets ? t.pick : '…'}</p>}
        </section>
      </div>
    </div>
  );
}
