import { useEffect, useState, type FormEvent } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { Check, UserPlus, UserMinus } from 'lucide-react';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import { logAdmin } from '../lib/adminLog';
import { OWNER_EMAIL } from '../lib/subscription';
import { POWERS, type Power, type Powers } from '../lib/staff';

type Lang = 'pt' | 'en' | 'es';

interface Member { email: string; permissions: Powers; addedAt: number | null }

const C = {
  pt: {
    intro: 'Adicione pessoas da equipe pelo Gmail e escolha o que cada uma pode fazer. A pessoa vê o painel no próximo acesso com esse Gmail.',
    email: 'Gmail da pessoa', add: 'Adicionar', invalid: 'Digite um Gmail válido.', owner: 'Você já tem todos os poderes.', exists: 'Essa pessoa já está na equipe.',
    empty: 'Ainda não há ninguém na equipe.', remove: 'Remover da equipe', removeConfirm: 'Remover {email} da equipe? Ela perde todos os poderes na hora.',
    since: 'Desde', failed: 'Não foi possível salvar.', none: 'Sem poderes: a pessoa não vê o painel.',
  },
  en: {
    intro: 'Add team members by Gmail and choose what each one can do. They see the panel next time they sign in with that Gmail.',
    email: "Person's Gmail", add: 'Add', invalid: 'Enter a valid Gmail.', owner: 'You already have every power.', exists: 'This person is already on the team.',
    empty: 'Nobody on the team yet.', remove: 'Remove from team', removeConfirm: 'Remove {email} from the team? They lose every power right away.',
    since: 'Since', failed: 'Could not save.', none: 'No powers: this person does not see the panel.',
  },
  es: {
    intro: 'Agrega personas del equipo por Gmail y elige qué puede hacer cada una. Verán el panel la próxima vez que entren con ese Gmail.',
    email: 'Gmail de la persona', add: 'Agregar', invalid: 'Escribe un Gmail válido.', owner: 'Ya tienes todos los poderes.', exists: 'Esa persona ya está en el equipo.',
    empty: 'Aún no hay nadie en el equipo.', remove: 'Quitar del equipo', removeConfirm: '¿Quitar a {email} del equipo? Pierde todos los poderes al instante.',
    since: 'Desde', failed: 'No se pudo guardar.', none: 'Sin poderes: esta persona no ve el panel.',
  },
};

const millis = (v: unknown) => (v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis: () => number }).toMillis() : null);

/** Owner-only tab: staff by Gmail (Firestore staff/{email}) and the powers each one has. */
export function StaffAdmin({ language, locale }: { language: Lang; locale: string }) {
  const t = C[language] || C.pt;
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(collection(db, 'staff'), (snap) => {
    setMembers(snap.docs.map((d) => ({ email: d.id, permissions: (d.data().permissions || {}) as Powers, addedAt: millis(d.data().addedAt) }))
      .sort((a, b) => a.email.localeCompare(b.email)));
  }, () => setError(t.failed)), []);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError(t.invalid);
    if (value === OWNER_EMAIL) return setError(t.owner);
    if (members.some((m) => m.email === value)) return setError(t.exists);
    try {
      await setDoc(doc(db, 'staff', value), {
        email: value, permissions: { tickets: true }, addedBy: (auth.currentUser?.email || '').toLowerCase(), addedAt: Timestamp.now(),
      });
      await logAdmin('staffAdd', { email: value }).catch(() => {});
      setEmail('');
    } catch (e) {
      console.error(e);
      setError(t.failed);
    }
  };

  const toggle = async (member: Member, power: Power) => {
    const next = !member.permissions[power];
    setError('');
    try {
      await updateDoc(doc(db, 'staff', member.email), { [`permissions.${power}`]: next });
      const label = POWERS.find((p) => p.id === power)!.label.pt;
      await logAdmin('staffUpdate', { email: member.email }, `${next ? '+' : '−'} ${label}`).catch(() => {});
    } catch (e) {
      console.error(e);
      setError(t.failed);
    }
  };

  const remove = async (member: Member) => {
    if (!window.confirm(t.removeConfirm.replace('{email}', member.email))) return;
    try {
      await deleteDoc(doc(db, 'staff', member.email));
      await logAdmin('staffRemove', { email: member.email }).catch(() => {});
    } catch (e) {
      console.error(e);
      setError(t.failed);
    }
  };

  return (
    <div className="max-w-4xl space-y-4" data-testid="staff-admin">
      <p className="text-sm text-stone-500 dark:text-stone-400">{t.intro}</p>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t.email} aria-label={t.email} data-testid="staff-email"
          className="flex-1 min-w-[14rem] h-10 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 text-sm text-stone-900 dark:text-white" />
        <button type="submit" data-testid="staff-add" className="h-10 rounded-xl px-4 inline-flex items-center gap-1.5 text-sm font-black bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-stone-900">
          <UserPlus size={15} />{t.add}
        </button>
      </form>
      {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-200 dark:border-white/10 p-8 text-center text-sm text-stone-400 font-semibold">{t.empty}</p>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const any = POWERS.some((p) => m.permissions[p.id]);
            return (
              <li key={m.email} className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4" data-testid={`staff-${m.email}`}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-stone-900 dark:text-white truncate">{m.email}</p>
                    <p className="text-xs text-stone-400">{any ? (m.addedAt ? `${t.since} ${new Date(m.addedAt).toLocaleDateString(locale)}` : '') : t.none}</p>
                  </div>
                  <button type="button" onClick={() => remove(m)} className="h-8 rounded-lg px-2.5 inline-flex items-center gap-1 text-xs font-bold border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <UserMinus size={13} />{t.remove}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {POWERS.map((p) => {
                    const on = !!m.permissions[p.id];
                    return (
                      <button key={p.id} type="button" role="switch" aria-checked={on} onClick={() => toggle(m, p.id)} data-testid={`power-${m.email}-${p.id}`}
                        className={cn('text-left rounded-xl border p-3 flex gap-2.5 transition-colors',
                          on ? 'border-primary bg-primary-light dark:border-white/30 dark:bg-white/10' : 'border-stone-200 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-white/5')}>
                        <span className={cn('mt-0.5 w-5 h-5 shrink-0 rounded-md flex items-center justify-center border',
                          on ? 'bg-primary border-primary text-white dark:bg-white dark:border-white dark:text-stone-900' : 'border-stone-300 dark:border-white/20')}>{on && <Check size={13} />}</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-stone-900 dark:text-white">{p.label[language]}</span>
                          <span className="block text-xs text-stone-500 dark:text-stone-400">{p.hint[language]}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
