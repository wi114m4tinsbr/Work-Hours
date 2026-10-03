import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  collection, deleteDoc, doc, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, Timestamp,
  updateDoc, where, addDoc, writeBatch, type DocumentData,
} from 'firebase/firestore';
import {
  Activity, BarChart3, Ban, Crown, Download, Lock, LogIn, Search, Settings, ShieldCheck, Trash2, Unlock, UserPlus, Users, X,
  ArrowDownRight, ArrowUpRight, Copy, ScrollText, LifeBuoy, UserCog,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { logAdmin } from '../lib/adminLog';
import { cn } from '../lib/utils';
import { ToolIdentity } from './ToolIdentity';
import { AppSettingsForm } from './AdminSettings';
import { ProjectReport } from './ProjectReport';
import { SupportNotifications } from './SupportNotifications';
import { SupportAdmin } from './SupportAdmin';
import { StaffAdmin } from './StaffAdmin';
import type { Powers } from '../lib/staff';
import { PlansEditor } from './PlansEditor';
import { normalizePlans, sortedPlans, type PlansConfig } from '../lib/plans';
import { accountStatus, isPremium, OWNER_EMAIL, type AccountStatus, type Subscription } from '../lib/subscription';

type Lang = 'pt' | 'en' | 'es';
type Section = 'notifications' | 'overview' | 'users' | 'support' | 'plans' | 'activity' | 'staff' | 'report' | 'settings';
type Range = 'day' | 'week' | 'month' | 'year';
type PlanFilter = 'all' | 'free' | 'premium' | 'expired';
type StatusFilter = 'all' | AccountStatus;
type SortKey = 'newest' | 'oldest' | 'lastLogin' | 'name';

interface UserRow {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  language: string;
  createdAt: number | null;
  lastLoginAt: number | null;
  loginCount: number;
  subscription: Subscription | undefined;
  premium: boolean;
  expired: boolean;
  status: AccountStatus;
  statusReason: string;
}

interface LogRow {
  id: string;
  action: string;
  targetEmail: string;
  details: string;
  by: string;
  at: number | null;
}

const DAY = 86_400_000;

const C = {
  pt: {
    title: 'Painel Admin', back: 'Voltar',
    sections: { notifications: 'Notificações', overview: 'Visão geral', users: 'Usuários', support: 'Suporte', staff: 'Staff', plans: 'Planos e ferramentas', activity: 'Atividade', report: 'Relatório', settings: 'Configurações' },
    total: 'Total de contas', today: 'Novas hoje', week: 'Últimos 7 dias', month: 'Últimos 30 dias', year: 'Últimos 12 meses',
    active: 'Ativos (7 dias)', premium: 'Premium', restricted: 'Bloqueados / banidos', logins: 'Acessos totais',
    vsPrev: 'vs período anterior', ofTotal: 'do total',
    growth: 'Crescimento de contas', newAccounts: 'Novas contas', cumulative: 'Total acumulado',
    ranges: { day: 'Dia', week: 'Semana', month: 'Mês', year: 'Ano' },
    showTable: 'Ver como tabela', period: 'Período',
    plans: 'Planos', free: 'Grátis', expired: 'Premium vencido', usage: 'Uso da plataforma',
    jobs: 'Trabalhos', sessions: 'Registros de horas', invoices: 'Faturas',
    search: 'Buscar por nome ou e-mail', allPlans: 'Todos os planos', allStatus: 'Todos os status',
    statuses: { active: 'Ativo', blocked: 'Bloqueado', banned: 'Banido' },
    sort: { newest: 'Mais recentes', oldest: 'Mais antigos', lastLogin: 'Último acesso', name: 'Nome' },
    exportCsv: 'Exportar CSV', user: 'Usuário', plan: 'Plano', status: 'Status', created: 'Criado em', lastLogin: 'Último acesso', loginCount: 'Acessos',
    none: 'Nenhum usuário encontrado.', page: 'Página', of: 'de', prev: 'Anterior', next: 'Próxima', results: 'usuários',
    until: 'até', noExpiry: 'sem validade', never: 'nunca',
    details: 'Detalhes', uid: 'ID', language: 'Idioma', copy: 'Copiar',
    formulaTitle: 'Fórmula Fácil Admin na página inicial', formulaHint: 'Quando ligado, todos os visitantes veem o botão na página inicial e usam a versão admin sem login e sem limite.', formulaOn: 'Ligado', formulaOff: 'Desligado', resetQuota: 'Zerar limites de hoje', resetHint: 'Libera de novo a fatura, o PDF e os 15 minutos da Fórmula Fácil desta conta.',
    planSection: 'Plano', grant: 'Dar plano', extend: 'Renovar plano', revoke: 'Voltar para grátis', duration: 'Duração',
    durations: { 7: '7 dias', 30: '30 dias', 90: '90 dias', 365: '1 ano', 0: 'Sem validade' } as Record<number, string>,
    access: 'Acesso', reason: 'Motivo (opcional, o usuário vê)', block: 'Bloquear', unblock: 'Desbloquear', ban: 'Banir', unban: 'Remover banimento',
    blockHint: 'Bloqueado: o usuário entra, mas não consegue usar nada. Banido: o mesmo, marcado como definitivo.',
    danger: 'Zona de perigo', remove: 'Excluir dados do usuário',
    removeHint: 'Apaga perfil, trabalhos, registros e faturas. Se a pessoa entrar de novo, começa do zero; para impedir, use Banir.',
    typeEmail: 'Digite o e-mail para confirmar', confirm: 'Confirmar', cancel: 'Cancelar', owner: 'Esta é a conta do administrador.',
    saved: 'Salvo.', failed: 'Não foi possível salvar. Confira se as regras novas do Firebase foram publicadas.',
    logEmpty: 'Nenhuma ação registrada ainda.', when: 'Quando', action: 'Ação', target: 'Usuário',
    actions: { grant: 'Deu Premium', revoke: 'Voltou para grátis', block: 'Bloqueou', unblock: 'Desbloqueou', ban: 'Baniu', unban: 'Removeu banimento', remove: 'Excluiu dados', plansSaved: 'Alterou planos e limites', resetQuota: 'Zerou limites', formulaOn: 'Ligou Fórmula Fácil Admin na página inicial', formulaOff: 'Desligou Fórmula Fácil Admin na página inicial', ticketAccept: 'Aceitou ocorrência', ticketClose: 'Fechou ocorrência', ticketDelete: 'Apagou ocorrência', staffAdd: 'Adicionou à staff', staffUpdate: 'Mudou poderes da staff', staffRemove: 'Removeu da staff' } as Record<string, string>,
    loadError: 'Não foi possível ler os usuários. Publique as regras novas do Firebase (passo a passo na conversa).',
    loading: 'Carregando dados…',
  },
  en: {
    title: 'Admin panel', back: 'Back',
    sections: { notifications: 'Notifications', overview: 'Overview', users: 'Users', support: 'Support', staff: 'Staff', plans: 'Plans and tools', activity: 'Activity', report: 'Report', settings: 'Settings' },
    total: 'Total accounts', today: 'New today', week: 'Last 7 days', month: 'Last 30 days', year: 'Last 12 months',
    active: 'Active (7 days)', premium: 'Premium', restricted: 'Blocked / banned', logins: 'Total sign-ins',
    vsPrev: 'vs previous period', ofTotal: 'of total',
    growth: 'Account growth', newAccounts: 'New accounts', cumulative: 'Running total',
    ranges: { day: 'Day', week: 'Week', month: 'Month', year: 'Year' },
    showTable: 'Show as table', period: 'Period',
    plans: 'Plans', free: 'Free', expired: 'Expired Premium', usage: 'Platform usage',
    jobs: 'Jobs', sessions: 'Time entries', invoices: 'Invoices',
    search: 'Search name or email', allPlans: 'All plans', allStatus: 'All statuses',
    statuses: { active: 'Active', blocked: 'Blocked', banned: 'Banned' },
    sort: { newest: 'Newest', oldest: 'Oldest', lastLogin: 'Last sign-in', name: 'Name' },
    exportCsv: 'Export CSV', user: 'User', plan: 'Plan', status: 'Status', created: 'Created', lastLogin: 'Last sign-in', loginCount: 'Sign-ins',
    none: 'No users found.', page: 'Page', of: 'of', prev: 'Previous', next: 'Next', results: 'users',
    until: 'until', noExpiry: 'no expiry', never: 'never',
    details: 'Details', uid: 'ID', language: 'Language', copy: 'Copy',
    formulaTitle: 'Fórmula Fácil Admin on the home page', formulaHint: 'When on, every visitor sees the button on the home page and uses the admin version without login and without limits.', formulaOn: 'On', formulaOff: 'Off', resetQuota: 'Reset today\'s limits', resetHint: 'Gives this account its invoice, PDF and 15 Fórmula Fácil minutes again.',
    planSection: 'Plan', grant: 'Give plan', extend: 'Renew plan', revoke: 'Back to free', duration: 'Duration',
    durations: { 7: '7 days', 30: '30 days', 90: '90 days', 365: '1 year', 0: 'No expiry' } as Record<number, string>,
    access: 'Access', reason: 'Reason (optional, shown to the user)', block: 'Block', unblock: 'Unblock', ban: 'Ban', unban: 'Lift ban',
    blockHint: 'Blocked: the user can sign in but cannot use anything. Banned: the same, marked as permanent.',
    danger: 'Danger zone', remove: 'Delete user data',
    removeHint: 'Deletes profile, jobs, entries and invoices. If they sign in again they start from zero; to prevent that, ban them.',
    typeEmail: 'Type the email to confirm', confirm: 'Confirm', cancel: 'Cancel', owner: 'This is the administrator account.',
    saved: 'Saved.', failed: 'Could not save. Check that the new Firebase rules were published.',
    logEmpty: 'No actions recorded yet.', when: 'When', action: 'Action', target: 'User',
    actions: { grant: 'Gave Premium', revoke: 'Back to free', block: 'Blocked', unblock: 'Unblocked', ban: 'Banned', unban: 'Lifted ban', remove: 'Deleted data', plansSaved: 'Changed plans and limits', resetQuota: 'Reset limits', formulaOn: 'Turned on Fórmula Fácil Admin on the home page', formulaOff: 'Turned off Fórmula Fácil Admin on the home page', ticketAccept: 'Accepted ticket', ticketClose: 'Closed ticket', ticketDelete: 'Deleted ticket', staffAdd: 'Added to staff', staffUpdate: 'Changed staff powers', staffRemove: 'Removed from staff' } as Record<string, string>,
    loadError: 'Could not read users. Publish the new Firebase rules (steps in the conversation).',
    loading: 'Loading data…',
  },
  es: {
    title: 'Panel de administración', back: 'Volver',
    sections: { notifications: 'Notificaciones', overview: 'Resumen', users: 'Usuarios', support: 'Soporte', staff: 'Staff', plans: 'Planes y herramientas', activity: 'Actividad', report: 'Informe', settings: 'Configuración' },
    total: 'Total de cuentas', today: 'Nuevas hoy', week: 'Últimos 7 días', month: 'Últimos 30 días', year: 'Últimos 12 meses',
    active: 'Activos (7 días)', premium: 'Premium', restricted: 'Bloqueados / baneados', logins: 'Accesos totales',
    vsPrev: 'vs período anterior', ofTotal: 'del total',
    growth: 'Crecimiento de cuentas', newAccounts: 'Cuentas nuevas', cumulative: 'Total acumulado',
    ranges: { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' },
    showTable: 'Ver como tabla', period: 'Período',
    plans: 'Planes', free: 'Gratis', expired: 'Premium vencido', usage: 'Uso de la plataforma',
    jobs: 'Trabajos', sessions: 'Registros de horas', invoices: 'Facturas',
    search: 'Buscar por nombre o correo', allPlans: 'Todos los planes', allStatus: 'Todos los estados',
    statuses: { active: 'Activo', blocked: 'Bloqueado', banned: 'Baneado' },
    sort: { newest: 'Más recientes', oldest: 'Más antiguos', lastLogin: 'Último acceso', name: 'Nombre' },
    exportCsv: 'Exportar CSV', user: 'Usuario', plan: 'Plan', status: 'Estado', created: 'Creado', lastLogin: 'Último acceso', loginCount: 'Accesos',
    none: 'No se encontraron usuarios.', page: 'Página', of: 'de', prev: 'Anterior', next: 'Siguiente', results: 'usuarios',
    until: 'hasta', noExpiry: 'sin vencimiento', never: 'nunca',
    details: 'Detalles', uid: 'ID', language: 'Idioma', copy: 'Copiar',
    formulaTitle: 'Fórmula Fácil Admin en la página de inicio', formulaHint: 'Cuando está activado, todos los visitantes ven el botón en la página de inicio y usan la versión admin sin login y sin límite.', formulaOn: 'Activado', formulaOff: 'Desactivado', resetQuota: 'Reiniciar límites de hoy', resetHint: 'Vuelve a liberar la factura, el PDF y los 15 minutos de Fórmula Fácil de esta cuenta.',
    planSection: 'Plan', grant: 'Dar plan', extend: 'Renovar plan', revoke: 'Volver a gratis', duration: 'Duración',
    durations: { 7: '7 días', 30: '30 días', 90: '90 días', 365: '1 año', 0: 'Sin vencimiento' } as Record<number, string>,
    access: 'Acceso', reason: 'Motivo (opcional, lo ve el usuario)', block: 'Bloquear', unblock: 'Desbloquear', ban: 'Banear', unban: 'Quitar baneo',
    blockHint: 'Bloqueado: el usuario entra pero no puede usar nada. Baneado: lo mismo, marcado como definitivo.',
    danger: 'Zona de peligro', remove: 'Eliminar datos del usuario',
    removeHint: 'Borra perfil, trabajos, registros y facturas. Si vuelve a entrar empieza de cero; para impedirlo, banéalo.',
    typeEmail: 'Escribe el correo para confirmar', confirm: 'Confirmar', cancel: 'Cancelar', owner: 'Esta es la cuenta del administrador.',
    saved: 'Guardado.', failed: 'No se pudo guardar. Revisa que las reglas nuevas de Firebase estén publicadas.',
    logEmpty: 'Aún no hay acciones registradas.', when: 'Cuándo', action: 'Acción', target: 'Usuario',
    actions: { grant: 'Dio Premium', revoke: 'Volvió a gratis', block: 'Bloqueó', unblock: 'Desbloqueó', ban: 'Baneó', unban: 'Quitó baneo', remove: 'Eliminó datos', plansSaved: 'Cambió planes y límites', resetQuota: 'Reinició límites', formulaOn: 'Activó Fórmula Fácil Admin en el inicio', formulaOff: 'Desactivó Fórmula Fácil Admin en el inicio', ticketAccept: 'Aceptó incidencia', ticketClose: 'Cerró incidencia', ticketDelete: 'Borró incidencia', staffAdd: 'Agregó a la staff', staffUpdate: 'Cambió poderes de la staff', staffRemove: 'Quitó de la staff' } as Record<string, string>,
    loadError: 'No se pudieron leer los usuarios. Publica las reglas nuevas de Firebase (pasos en la conversación).',
    loading: 'Cargando datos…',
  },
};

type Dict = typeof C.pt;

const millis = (value: unknown): number | null =>
  value && typeof (value as { toMillis?: unknown }).toMillis === 'function' ? (value as { toMillis: () => number }).toMillis() : null;

function toRow(uid: string, data: DocumentData): UserRow {
  const subscription = data.subscription as Subscription | undefined;
  const premium = isPremium(subscription);
  const name = String(data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ') || '').trim();
  return {
    uid,
    email: String(data.email || ''),
    name,
    photoURL: String(data.photoURL || ''),
    language: String(data.language || ''),
    createdAt: millis(data.createdAt),
    lastLoginAt: millis(data.lastLoginAt),
    loginCount: typeof data.loginCount === 'number' ? data.loginCount : 0,
    subscription,
    premium,
    expired: subscription?.type === 'monthly' && !premium,
    status: accountStatus(data),
    statusReason: typeof data.statusReason === 'string' ? data.statusReason : '',
  };
}

const startOfDay = (time: number) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = (time: number) => { const d = new Date(startOfDay(time)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const startOfMonth = (time: number) => { const d = new Date(time); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const startOfYear = (time: number) => new Date(new Date(time).getFullYear(), 0, 1).getTime();

interface Bucket { start: number; label: string; added: number; total: number }

/** New accounts per day/week/month/year plus the running total at the end of each bucket. */
export function growthBuckets(createdTimes: number[], range: Range, now: number, locale: string): Bucket[] {
  const starts: number[] = [];
  if (range === 'day') for (let i = 29; i >= 0; i--) starts.push(startOfDay(now - i * DAY));
  if (range === 'week') for (let i = 11; i >= 0; i--) starts.push(startOfWeek(now - i * 7 * DAY));
  if (range === 'month') {
    const d = new Date(now);
    for (let i = 11; i >= 0; i--) starts.push(new Date(d.getFullYear(), d.getMonth() - i, 1).getTime());
  }
  if (range === 'year') {
    const first = createdTimes.length ? new Date(Math.min(...createdTimes)).getFullYear() : new Date(now).getFullYear();
    const last = new Date(now).getFullYear();
    for (let y = Math.max(first, last - 9); y <= last; y++) starts.push(new Date(y, 0, 1).getTime());
  }
  const label = (time: number) => {
    const d = new Date(time);
    if (range === 'day' || range === 'week') return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
    if (range === 'month') return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
    return String(d.getFullYear());
  };
  return starts.map((start, index) => {
    const end = starts[index + 1] ?? Infinity;
    return {
      start,
      label: label(start),
      added: createdTimes.filter((t) => t >= start && t < end).length,
      total: createdTimes.filter((t) => t < Math.min(end, now + 1)).length,
    };
  });
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function Card({ icon, label, value, sub, delta, t }: { icon: ReactNode; label: string; value: string | number; sub?: string; delta?: number | null; t: Dict }) {
  return (
    <div className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-400">
        <span className="w-7 h-7 rounded-lg bg-primary-light dark:bg-white/10 text-primary dark:text-white flex items-center justify-center shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="text-2xl font-black text-stone-900 dark:text-white tabular-nums">{value}</div>
      {delta !== undefined && (
        <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1">
          {delta === null ? <span className="text-stone-400">—</span> : (
            <span className={cn('inline-flex items-center gap-0.5 font-black', delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-stone-500')}>
              {delta > 0 ? <ArrowUpRight size={12} /> : delta < 0 ? <ArrowDownRight size={12} /> : null}{delta > 0 ? '+' : ''}{delta}%
            </span>
          )}
          <span>{t.vsPrev}</span>
        </div>
      )}
      {sub && <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">{sub}</div>}
    </div>
  );
}

/** Single-series bar chart with a hover readout; the totals chart reuses it as a line. */
function MiniChart({ buckets, field, kind, title, t }: { buckets: Bucket[]; field: 'added' | 'total'; kind: 'bar' | 'line'; title: string; t: Dict }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640, height = 180, padL = 32, padB = 22, padT = 10;
  const max = Math.max(1, ...buckets.map((b) => b[field]));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const step = (width - padL) / Math.max(1, buckets.length);
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / niceMax);
  const active = hover ?? buckets.length - 1;
  const labelEvery = Math.ceil(buckets.length / 8);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h4 className="text-sm font-black text-stone-800 dark:text-stone-100">{title}</h4>
        {buckets[active] && (
          <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {buckets[active].label}: <b className="text-stone-900 dark:text-white">{buckets[active][field]}</b>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={title} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={width} y1={y(niceMax * f)} y2={y(niceMax * f)} className="stroke-stone-200 dark:stroke-white/10" strokeWidth={1} />
            <text x={padL - 6} y={y(niceMax * f) + 3} textAnchor="end" className="fill-stone-400 text-[10px]">{Math.round(niceMax * f)}</text>
          </g>
        ))}
        {kind === 'bar' && buckets.map((b, i) => {
          const barW = Math.max(2, step - 2);
          const h = height - padB - y(b[field]);
          return (
            <rect key={b.start} x={padL + i * step + 1} y={y(b[field])} width={barW} height={Math.max(0, h)} rx={Math.min(4, barW / 2)}
              className={cn('fill-primary dark:fill-[color-mix(in_srgb,var(--primary-color)_55%,white)] transition-opacity', hover !== null && hover !== i && 'opacity-40')} />
          );
        })}
        {kind === 'line' && (
          <polyline fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-primary dark:stroke-[color-mix(in_srgb,var(--primary-color)_55%,white)]"
            points={buckets.map((b, i) => `${padL + i * step + step / 2},${y(b[field])}`).join(' ')} />
        )}
        {kind === 'line' && hover !== null && buckets[hover] && (
          <circle cx={padL + hover * step + step / 2} cy={y(buckets[hover][field])} r={4} className="fill-primary dark:fill-[color-mix(in_srgb,var(--primary-color)_55%,white)] stroke-white dark:stroke-stone-900" strokeWidth={2} />
        )}
        {buckets.map((b, i) => (
          <g key={`hit-${b.start}`}>
            <rect x={padL + i * step} y={0} width={step} height={height} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <title>{`${b.label}: ${b[field]}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={padL + i * step + step / 2} y={height - 6} textAnchor="middle" className="fill-stone-400 text-[10px]">{b.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

const paidPlanName = (row: UserRow, plans: PlansConfig, lang: Lang) => {
  const id = (row.subscription as { plan?: string } | undefined)?.plan || 'premium';
  return plans.plans[id]?.name[lang] ?? plans.plans.premium.name[lang];
};

function PlanBadge({ row, t, locale, plans, lang }: { row: UserRow; t: Dict; locale: string; plans: PlansConfig; lang: Lang }) {
  const expiry = millis(row.subscription?.expiryDate);
  if (row.premium) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-light dark:bg-white/10 text-primary dark:text-white px-2 py-0.5 text-[11px] font-black whitespace-nowrap">
        <Crown size={11} /> {paidPlanName(row, plans, lang)}{expiry ? ` · ${t.until} ${new Date(expiry).toLocaleDateString(locale)}` : ''}
      </span>
    );
  }
  if (row.expired) return <span className="rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-black whitespace-nowrap">{t.expired}</span>;
  return <span className="rounded-full bg-stone-100 dark:bg-white/10 text-stone-600 dark:text-stone-300 px-2 py-0.5 text-[11px] font-black">{t.free}</span>;
}

function StatusBadge({ status, t }: { status: AccountStatus; t: Dict }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black whitespace-nowrap',
      status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
        : status === 'blocked' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
        : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300')}>
      {status === 'active' ? <ShieldCheck size={11} /> : status === 'blocked' ? <Lock size={11} /> : <Ban size={11} />}
      {t.statuses[status]}
    </span>
  );
}

function Avatar({ row }: { row: UserRow }) {
  const initials = (row.name || row.email).slice(0, 2).toUpperCase();
  return row.photoURL
    ? <img src={row.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shrink-0" />
    : <span className="w-8 h-8 rounded-full bg-primary-light dark:bg-white/10 text-primary text-[11px] font-black flex items-center justify-center shrink-0">{initials}</span>;
}

/** A destructive or account-changing button asks once more before acting. */
function ConfirmButton({ label, icon, onConfirm, t, tone = 'default', disabled }: {
  label: string; icon: ReactNode; onConfirm: () => Promise<void>; t: Dict; tone?: 'default' | 'warn' | 'danger'; disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition-colors disabled:opacity-50';
  const toneClass = tone === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : tone === 'warn' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary hover:bg-primary-hover text-white dark:bg-white/15 dark:hover:bg-white/25';
  if (!asking) return <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={cn(base, toneClass)}>{icon}{label}</button>;
  return (
    <span className="inline-flex gap-1.5">
      <button type="button" disabled={busy} className={cn(base, toneClass)} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setAsking(false); } }}>{t.confirm}: {label}</button>
      <button type="button" disabled={busy} className={cn(base, 'border border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-300')} onClick={() => setAsking(false)}>{t.cancel}</button>
    </span>
  );
}

export function AdminDashboard({ language, onBack, settings, t: appT, formulaPublic, powers, isOwner, supportWaiting, focus, onFocused }: {
  language: Lang;
  /** What this person may see and do; the owner has every power. firestore.rules enforces the same. */
  powers: Powers;
  isOwner: boolean;
  /** New tickets and unanswered replies on tickets this person accepted. */
  supportWaiting?: { open: number; mine: number };
  /** Opens a tab straight away, e.g. Suporte when the shield shows pending tickets. */
  focus?: 'support' | null;
  onFocused?: () => void;
  /** Owner switch: shows the admin Fórmula Fácil on the home page for every visitor. */
  formulaPublic?: { enabled: boolean; onChange: (enabled: boolean) => Promise<void> };
  onBack: () => void;
  settings: { appName: string; primaryColor: string; footerText: string };
  t: any;
}) {
  const t = C[language] || C.pt;
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-BR';
  const allowed: Record<Section, boolean> = {
    overview: !!powers.users_view, users: !!powers.users_view, support: !!powers.tickets, plans: !!powers.plans,
    notifications: isOwner, activity: !!powers.activity, staff: isOwner, report: isOwner, settings: isOwner,
  };
  const [sectionChoice, setSection] = useState<Section>('overview');
  useEffect(() => {
    if (focus && allowed[focus]) { setSection(focus); onFocused?.(); }
  }, [focus]);
  const section = allowed[sectionChoice] ? sectionChoice : (Object.keys(allowed) as Section[]).find((id) => allowed[id]) ?? 'support';
  const [plans, setPlans] = useState<PlansConfig>(() => normalizePlans(null));
  useEffect(() => onSnapshot(doc(db, 'settings', 'plans'), (snap) => setPlans(normalizePlans(snap.exists() ? snap.data() : null)), () => {}), []);
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [totalLogins, setTotalLogins] = useState(0);
  const [platform, setPlatform] = useState<{ jobs: number | null; sessions: number | null; invoices: number | null }>({ jobs: null, sessions: null, invoices: null });
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [range, setRange] = useState<Range>('day');
  const [showTable, setShowTable] = useState(false);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const now = Date.now();

  useEffect(() => {
    if (!powers.users_view) { setUsers([]); return; }
    const unsubUsers = onSnapshot(collection(db, 'users'),
      (snap) => { setUsers(snap.docs.map((d) => toRow(d.id, d.data()))); setLoadError(false); },
      () => setLoadError(true));
    const unsubStats = onSnapshot(doc(db, 'stats', 'global'), (snap) => setTotalLogins(snap.data()?.totalLogins || 0), () => {});
    Promise.all(['jobs', 'sessions', 'invoices'].map((name) =>
      getCountFromServer(collection(db, name)).then((r) => r.data().count).catch(() => null)))
      .then(([jobs, sessions, invoices]) => setPlatform({ jobs, sessions, invoices }));
    return () => { unsubUsers(); unsubStats(); };
  }, [powers.users_view]);

  useEffect(() => {
    if (!powers.activity) return;
    return onSnapshot(query(collection(db, 'adminLog'), orderBy('at', 'desc'), limit(200)),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, action: d.data().action, targetEmail: d.data().targetEmail || '', details: d.data().details || '', by: d.data().by || '', at: millis(d.data().at) }))),
      () => {});
  }, [powers.activity]);

  const list = users ?? [];
  const created = useMemo(() => list.map((u) => u.createdAt).filter((v): v is number => v !== null), [users]);
  const countBetween = (from: number, to: number) => created.filter((c) => c >= from && c < to).length;
  const today0 = startOfDay(now);
  const kpi = {
    today: countBetween(today0, now + 1), yesterday: countBetween(today0 - DAY, today0),
    week: countBetween(now - 7 * DAY, now + 1), prevWeek: countBetween(now - 14 * DAY, now - 7 * DAY),
    month: countBetween(now - 30 * DAY, now + 1), prevMonth: countBetween(now - 60 * DAY, now - 30 * DAY),
    year: countBetween(now - 365 * DAY, now + 1), prevYear: countBetween(now - 730 * DAY, now - 365 * DAY),
    active: list.filter((u) => u.lastLoginAt && u.lastLoginAt >= now - 7 * DAY).length,
    premium: list.filter((u) => u.premium).length,
    expired: list.filter((u) => u.expired).length,
    restricted: list.filter((u) => u.status !== 'active').length,
  };
  const buckets = useMemo(() => growthBuckets(created, range, now, locale), [created, range, locale]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = list.filter((u) =>
      (!term || u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term)) &&
      (planFilter === 'all' || (planFilter === 'premium' ? u.premium : planFilter === 'expired' ? u.expired : !u.premium && !u.expired)) &&
      (statusFilter === 'all' || u.status === statusFilter));
    const by: Record<SortKey, (a: UserRow, b: UserRow) => number> = {
      newest: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
      oldest: (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
      lastLogin: (a, b) => (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0),
      name: (a, b) => (a.name || a.email).localeCompare(b.name || b.email, locale),
    };
    return rows.sort(by[sort]);
  }, [users, search, planFilter, statusFilter, sort, locale]);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);
  useEffect(() => setPage(0), [search, planFilter, statusFilter, sort]);

  const fmtDate = (time: number | null) => time ? new Date(time).toLocaleDateString(locale) : '—';
  const fmtDateTime = (time: number | null) => time ? new Date(time).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : t.never;

  const exportCsv = () => {
    const header = ['name', 'email', 'plan', 'premium_until', 'status', 'created', 'last_login', 'logins', 'uid'];
    const lines = filtered.map((u) => [
      u.name, u.email, u.premium ? 'premium' : u.expired ? 'expired' : 'free',
      millis(u.subscription?.expiryDate) ? new Date(millis(u.subscription?.expiryDate)!).toISOString().slice(0, 10) : '',
      u.status, u.createdAt ? new Date(u.createdAt).toISOString() : '', u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : '', u.loginCount, u.uid,
    ].map(csvEscape).join(','));
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shift-hours-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const selectedRow = list.find((u) => u.uid === selected) || null;

  const tabs: { id: Section; icon: ReactNode }[] = [
    { id: 'overview', icon: <BarChart3 size={15} /> },
    { id: 'users', icon: <Users size={15} /> },
    { id: 'notifications', icon: <Activity size={15} /> },
    { id: 'support', icon: <LifeBuoy size={15} /> },
    { id: 'plans', icon: <Crown size={15} /> },
    { id: 'activity', icon: <Activity size={15} /> },
    { id: 'staff', icon: <UserCog size={15} /> },
    { id: 'report', icon: <ScrollText size={15} /> },
    { id: 'settings', icon: <Settings size={15} /> },
  ].filter((tab) => allowed[tab.id as Section]) as { id: Section; icon: ReactNode }[];

  return (
    <div className="w-full" data-testid="admin-dashboard">
      <div className="sticky top-16 z-30 bg-white/95 dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 shadow-sm">
        <div className="min-h-12 w-full max-w-7xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-1.5">
          <ToolIdentity title={t.title} language={language} backLabel={t.back} onBack={onBack} />
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label={t.title}>
            {tabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setSection(tab.id)} aria-current={section === tab.id ? 'page' : undefined}
                className={cn('inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-bold whitespace-nowrap transition-colors',
                  section === tab.id ? 'bg-primary text-white dark:bg-white/15' : 'text-stone-600 dark:text-stone-300 hover:bg-primary-light dark:hover:bg-white/10')}>
                {tab.icon}{t.sections[tab.id]}
                {tab.id === 'support' && supportWaiting && supportWaiting.open + supportWaiting.mine > 0 && (
                  <span data-testid="support-tab-badge" className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black leading-5 text-center">{supportWaiting.open + supportWaiting.mine}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 pb-16 space-y-5">
        {loadError && <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-amber-800 dark:text-amber-200 p-4 text-sm font-semibold">{t.loadError}</div>}
        {!users && !loadError && (section === 'overview' || section === 'users') && <div className="text-sm text-stone-400 font-semibold">{t.loading}</div>}

        {section === 'overview' && users && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card icon={<Users size={15} />} label={t.total} value={list.length} sub={`+${kpi.year} · ${t.year.toLowerCase()}`} t={t} />
              <Card icon={<UserPlus size={15} />} label={t.today} value={kpi.today} delta={change(kpi.today, kpi.yesterday)} t={t} />
              <Card icon={<UserPlus size={15} />} label={t.week} value={kpi.week} delta={change(kpi.week, kpi.prevWeek)} t={t} />
              <Card icon={<UserPlus size={15} />} label={t.month} value={kpi.month} delta={change(kpi.month, kpi.prevMonth)} t={t} />
              <Card icon={<Activity size={15} />} label={t.active} value={kpi.active} sub={list.length ? `${Math.round((kpi.active / list.length) * 100)}% ${t.ofTotal}` : undefined} t={t} />
              <Card icon={<Crown size={15} />} label={t.premium} value={kpi.premium} sub={list.length ? `${Math.round((kpi.premium / list.length) * 100)}% ${t.ofTotal}` : undefined} t={t} />
              <Card icon={<Lock size={15} />} label={t.restricted} value={kpi.restricted} t={t} />
              <Card icon={<LogIn size={15} />} label={t.logins} value={totalLogins} t={t} />
            </div>

            <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-stone-900 dark:text-white">{t.growth}</h3>
                <div className="inline-flex rounded-xl border border-stone-200 dark:border-white/10 p-0.5" role="group">
                  {(['day', 'week', 'month', 'year'] as Range[]).map((r) => (
                    <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                      className={cn('px-3 h-8 rounded-lg text-xs font-black', range === r ? 'bg-primary text-white dark:bg-white/15' : 'text-stone-500 dark:text-stone-300 hover:text-primary')}>
                      {t.ranges[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <MiniChart buckets={buckets} field="added" kind="bar" title={t.newAccounts} t={t} />
                <MiniChart buckets={buckets} field="total" kind="line" title={t.cumulative} t={t} />
              </div>
              <button type="button" onClick={() => setShowTable(!showTable)} className="text-xs font-black text-primary dark:text-stone-200">{t.showTable}</button>
              {showTable && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-stone-500"><th className="py-1 pr-4">{t.period}</th><th className="py-1 pr-4">{t.newAccounts}</th><th className="py-1">{t.cumulative}</th></tr></thead>
                    <tbody>{buckets.map((b) => <tr key={b.start} className="border-t border-stone-100 dark:border-white/5 text-stone-700 dark:text-stone-200 tabular-nums"><td className="py-1 pr-4">{b.label}</td><td className="py-1 pr-4">{b.added}</td><td className="py-1">{b.total}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid md:grid-cols-2 gap-4">
              <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 sm:p-5">
                <h3 className="text-base font-black text-stone-900 dark:text-white mb-3">{t.plans}</h3>
                {[
                  { label: t.free, value: list.length - kpi.premium - kpi.expired, cls: 'bg-stone-400' },
                  { label: 'Premium', value: kpi.premium, cls: 'bg-primary dark:bg-[color-mix(in_srgb,var(--primary-color)_55%,white)]' },
                  { label: t.expired, value: kpi.expired, cls: 'bg-amber-500' },
                ].map((p) => (
                  <div key={p.label} className="mb-3">
                    <div className="flex justify-between text-sm font-semibold text-stone-700 dark:text-stone-200"><span>{p.label}</span><span className="tabular-nums">{p.value}</span></div>
                    <div className="h-2 mt-1 rounded-full bg-stone-100 dark:bg-white/10 overflow-hidden"><div className={cn('h-full rounded-full', p.cls)} style={{ width: `${list.length ? (p.value / list.length) * 100 : 0}%` }} /></div>
                  </div>
                ))}
              </section>
              <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 sm:p-5">
                <h3 className="text-base font-black text-stone-900 dark:text-white mb-3">{t.usage}</h3>
                {[{ label: t.jobs, value: platform.jobs }, { label: t.sessions, value: platform.sessions }, { label: t.invoices, value: platform.invoices }].map((p) => (
                  <div key={p.label} className="flex items-center justify-between py-2 border-b last:border-0 border-stone-100 dark:border-white/5 text-sm">
                    <span className="font-semibold text-stone-600 dark:text-stone-300">{p.label}</span>
                    <span className="font-black text-stone-900 dark:text-white tabular-nums">{p.value ?? '—'}</span>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {section === 'users' && users && (
          <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark">
            <div className="p-3 sm:p-4 flex flex-wrap gap-2 items-center border-b border-stone-100 dark:border-white/5">
              <label className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 text-sm text-stone-900 dark:text-white" />
              </label>
              <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as PlanFilter)} aria-label={t.plan} className="h-10 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-2 text-sm text-stone-800 dark:text-stone-100">
                <option value="all">{t.allPlans}</option><option value="free">{t.free}</option><option value="premium">Premium</option><option value="expired">{t.expired}</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label={t.status} className="h-10 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-2 text-sm text-stone-800 dark:text-stone-100">
                <option value="all">{t.allStatus}</option>{(['active', 'blocked', 'banned'] as AccountStatus[]).map((s) => <option key={s} value={s}>{t.statuses[s]}</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="sort" className="h-10 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-2 text-sm text-stone-800 dark:text-stone-100">
                {(Object.keys(t.sort) as SortKey[]).map((k) => <option key={k} value={k}>{t.sort[k]}</option>)}
              </select>
              <button type="button" onClick={exportCsv} className="h-10 inline-flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-white/10 px-3 text-sm font-bold text-stone-700 dark:text-stone-200 hover:border-primary/40 hover:text-primary">
                <Download size={15} />{t.exportCsv}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="admin-users-table">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-stone-400">
                    <th className="px-4 py-2 font-black">{t.user}</th><th className="px-3 py-2 font-black">{t.plan}</th><th className="px-3 py-2 font-black">{t.status}</th>
                    <th className="px-3 py-2 font-black hidden md:table-cell">{t.created}</th><th className="px-3 py-2 font-black hidden md:table-cell">{t.lastLogin}</th><th className="px-3 py-2 font-black hidden lg:table-cell text-right">{t.loginCount}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((u) => (
                    <tr key={u.uid} onClick={() => setSelected(u.uid)} className="border-t border-stone-100 dark:border-white/5 cursor-pointer hover:bg-primary-light/60 dark:hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar row={u} />
                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 dark:text-white truncate max-w-[220px]">{u.name || '—'}</div>
                            <div className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[220px]">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><PlanBadge row={u} t={t} locale={locale} plans={plans} lang={language} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={u.status} t={t} /></td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-stone-600 dark:text-stone-300 tabular-nums">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-stone-600 dark:text-stone-300 tabular-nums">{fmtDateTime(u.lastLoginAt)}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-right text-stone-600 dark:text-stone-300 tabular-nums">{u.loginCount}</td>
                    </tr>
                  ))}
                  {pageRows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400 font-semibold">{t.none}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-stone-100 dark:border-white/5 text-xs text-stone-500 dark:text-stone-400">
              <span>{filtered.length} {t.results}</span>
              <span className="flex items-center gap-2">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-white/10 font-bold disabled:opacity-40">{t.prev}</button>
                {t.page} {page + 1} {t.of} {pages}
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-white/10 font-bold disabled:opacity-40">{t.next}</button>
              </span>
            </div>
          </section>
        )}

        {section === 'activity' && (
          <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-stone-400"><th className="px-4 py-2 font-black">{t.when}</th><th className="px-3 py-2 font-black">{t.action}</th><th className="px-3 py-2 font-black">{t.target}</th><th className="px-3 py-2 font-black">{t.details}</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t border-stone-100 dark:border-white/5 text-stone-700 dark:text-stone-200">
                    <td className="px-4 py-2 tabular-nums whitespace-nowrap">{fmtDateTime(l.at)}</td>
                    <td className="px-3 py-2 font-bold">{t.actions[l.action] || l.action}</td>
                    <td className="px-3 py-2">{l.targetEmail}</td>
                    <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{l.details}{l.by && l.by !== OWNER_EMAIL && <span className="block text-[11px] text-stone-400">{l.by}</span>}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400 font-semibold">{t.logEmpty}</td></tr>}
              </tbody>
            </table>
          </section>
        )}

        {section === 'support' && <SupportAdmin language={language} locale={locale} isOwner={isOwner} />}

        {section === 'notifications' && <SupportNotifications language={language} />}

        {section === 'staff' && <StaffAdmin language={language} locale={locale} />}

        {section === 'report' && <ProjectReport language={language} locale={locale} />}

        {section === 'plans' && <PlansEditor language={language} />}

        {section === 'settings' && (
          <div className="max-w-xl space-y-4">
            {formulaPublic && <FormulaSwitch t={t} value={formulaPublic} />}
            <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5">
              <AppSettingsForm currentSettings={settings} t={appT} />
            </section>
          </div>
        )}
      </div>

      {selectedRow && <UserDrawer row={selectedRow} canManage={!!powers.users_manage} isOwner={isOwner} t={t} locale={locale} plans={plans} lang={language} onClose={() => setSelected(null)} fmtDate={fmtDate} fmtDateTime={fmtDateTime} />}
    </div>
  );
}

function FormulaSwitch({ t, value }: { t: Dict; value: { enabled: boolean; onChange: (enabled: boolean) => Promise<void> } }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const toggle = async () => {
    if (saving) return;
    const next = !value.enabled;
    setSaving(true);
    setFailed(false);
    try {
      await value.onChange(next);
      await logAdmin(next ? 'formulaOn' : 'formulaOff').catch(() => {});
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5 flex items-start gap-4" data-testid="admin-formula-switch">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-black text-stone-900 dark:text-white">{t.formulaTitle}</h3>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t.formulaHint}</p>
        {failed && <p className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">{t.failed}</p>}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          aria-label={t.formulaTitle}
          disabled={saving}
          onClick={toggle}
          className={cn(
            'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            value.enabled ? 'bg-primary dark:bg-emerald-500' : 'bg-stone-300 dark:bg-white/20',
            saving && 'opacity-60',
          )}
        >
          <span className={cn('inline-block h-6 w-6 rounded-full bg-white shadow transition-transform', value.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
        <span className="text-[11px] font-black uppercase tracking-wide text-stone-500 dark:text-stone-300">{value.enabled ? t.formulaOn : t.formulaOff}</span>
      </div>
    </section>
  );
}

async function logAction(action: string, row: UserRow, details: string) {
  await logAdmin(action, { uid: row.uid, email: row.email }, details);
}

function UserDrawer({ row, canManage, isOwner, t, locale, plans, lang, onClose, fmtDate, fmtDateTime }: {
  row: UserRow; canManage: boolean; isOwner: boolean; t: Dict; locale: string; plans: PlansConfig; lang: Lang; onClose: () => void;
  fmtDate: (v: number | null) => string; fmtDateTime: (v: number | null) => string;
}) {
  const [days, setDays] = useState(30);
  const paidPlans = sortedPlans(plans).filter(([id]) => id !== 'free');
  const currentPaid = (row.subscription as { plan?: string } | undefined)?.plan || 'premium';
  const [planChoice, setPlanChoice] = useState(plans.plans[currentPaid] ? currentPaid : paidPlans[0]?.[0] ?? 'premium');
  const [reason, setReason] = useState(row.statusReason);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [usage, setUsage] = useState<{ jobs: number | null; sessions: number | null; invoices: number | null }>({ jobs: null, sessions: null, invoices: null });
  const isOwnerRow = row.email.toLowerCase() === OWNER_EMAIL;
  const expiry = millis(row.subscription?.expiryDate);

  useEffect(() => {
    setReason(row.statusReason);
    Promise.all(['jobs', 'sessions', 'invoices'].map((name) =>
      getCountFromServer(query(collection(db, name), where('userId', '==', row.uid))).then((r) => r.data().count).catch(() => null)))
      .then(([jobs, sessions, invoices]) => setUsage({ jobs, sessions, invoices }));
  }, [row.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (work: () => Promise<void>) => {
    setMessage(null);
    try { await work(); setMessage({ ok: true, text: t.saved }); } catch (error) { console.error(error); setMessage({ ok: false, text: t.failed }); }
  };
  const ref = doc(db, 'users', row.uid);

  const grant = () => run(async () => {
    // Renewing adds to the time left instead of restarting from today.
    const samePlan = row.premium && planChoice === currentPaid;
    const from = samePlan && expiry ? expiry : Date.now();
    const expiryDate = days ? Timestamp.fromMillis(from + days * DAY) : null;
    await updateDoc(ref, { subscription: { type: 'monthly', plan: planChoice, expiryDate, grantedBy: 'admin', grantedAt: Timestamp.now() } });
    const name = plans.plans[planChoice]?.name[lang] ?? planChoice;
    await logAction('grant', row, `${name} · ${days ? `${t.durations[days]} · ${t.until} ${new Date(expiryDate!.toMillis()).toLocaleDateString(locale)}` : t.durations[0]}`);
  });
  const revoke = () => run(async () => {
    await updateDoc(ref, { subscription: { type: 'free', expiryDate: null } });
    await logAction('revoke', row, '');
  });
  const setStatus = (status: AccountStatus, action: string) => run(async () => {
    await updateDoc(ref, { status, statusReason: status === 'active' ? '' : reason.trim().slice(0, 200), statusUpdatedAt: Timestamp.now() });
    await logAction(action, row, status === 'active' ? '' : reason.trim());
  });
  const resetQuota = () => run(async () => {
    await deleteDoc(doc(db, 'quota', row.email.toLowerCase()));
    await logAction('resetQuota', row, '');
  });
  const remove = () => run(async () => {
    for (const name of ['jobs', 'sessions', 'invoices']) {
      const snap = await getDocs(query(collection(db, name), where('userId', '==', row.uid)));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(ref);
    await logAction('remove', row, '');
    onClose();
  });

  const block = (title: string, children: ReactNode) => (
    <section className="rounded-2xl border border-stone-200 dark:border-white/10 p-4 space-y-3">
      <h4 className="text-xs font-black uppercase tracking-wider text-stone-400">{title}</h4>
      {children}
    </section>
  );

  return (
    <div className="fixed inset-0 z-[120] flex justify-end" role="dialog" aria-modal="true" aria-label={row.email}>
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full overflow-y-auto bg-white dark:bg-stone-900 shadow-2xl p-5 space-y-4" data-testid="admin-user-drawer">
        <div className="flex items-start gap-3">
          <Avatar row={row} />
          <div className="min-w-0 flex-1">
            <div className="font-black text-stone-900 dark:text-white truncate">{row.name || '—'}</div>
            <div className="text-sm text-stone-500 dark:text-stone-400 truncate">{row.email}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5"><PlanBadge row={row} t={t} locale={locale} plans={plans} lang={lang} /><StatusBadge status={row.status} t={t} /></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-stone-500 hover:bg-primary hover:text-white" aria-label={t.cancel}><X size={18} /></button>
        </div>

        {message && <div className={cn('rounded-xl px-3 py-2 text-sm font-semibold', message.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300')}>{message.text}</div>}

        {block(t.details, (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-stone-500">{t.created}</dt><dd className="text-stone-900 dark:text-white tabular-nums">{fmtDate(row.createdAt)}</dd>
            <dt className="text-stone-500">{t.lastLogin}</dt><dd className="text-stone-900 dark:text-white tabular-nums">{fmtDateTime(row.lastLoginAt)}</dd>
            <dt className="text-stone-500">{t.loginCount}</dt><dd className="text-stone-900 dark:text-white tabular-nums">{row.loginCount}</dd>
            <dt className="text-stone-500">{t.language}</dt><dd className="text-stone-900 dark:text-white uppercase">{row.language || '—'}</dd>
            <dt className="text-stone-500">{t.jobs}</dt><dd className="text-stone-900 dark:text-white tabular-nums">{usage.jobs ?? '—'}</dd>
            <dt className="text-stone-500">{t.sessions}</dt><dd className="text-stone-900 dark:text-white tabular-nums">{usage.sessions ?? '—'}</dd>
            <dt className="text-stone-500">{t.invoices}</dt><dd className="text-stone-900 dark:text-white tabular-nums">{usage.invoices ?? '—'}</dd>
            <dt className="text-stone-500">{t.uid}</dt>
            <dd className="text-stone-900 dark:text-white flex items-center gap-1 min-w-0">
              <span className="truncate font-mono text-xs">{row.uid}</span>
              <button type="button" title={t.copy} onClick={() => navigator.clipboard?.writeText(row.uid)} className="p-1 text-stone-400 hover:text-primary"><Copy size={13} /></button>
            </dd>
          </dl>
        ))}

        {isOwnerRow ? (
          <p className="text-sm font-semibold text-stone-500">{t.owner}</p>
        ) : !canManage ? null : (
          <>
            {block(t.planSection, (
              <>
                <div className="text-sm text-stone-600 dark:text-stone-300">
                  {row.premium ? `${paidPlanName(row, plans, lang)} · ${expiry ? `${t.until} ${new Date(expiry).toLocaleDateString(locale)}` : t.noExpiry}` : row.expired ? t.expired : t.free}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={planChoice} onChange={(e) => setPlanChoice(e.target.value)} aria-label={t.planSection} data-testid="grant-plan" className="h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-2 text-sm text-stone-800 dark:text-stone-100">
                    {paidPlans.map(([id, p]) => <option key={id} value={id}>{p.name[lang]}</option>)}
                  </select>
                  <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label={t.duration} className="h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-2 text-sm text-stone-800 dark:text-stone-100">
                    {[7, 30, 90, 365, 0].map((d) => <option key={d} value={d}>{t.durations[d]}</option>)}
                  </select>
                  <ConfirmButton label={row.premium && planChoice === currentPaid ? t.extend : t.grant} icon={<Crown size={14} />} onConfirm={grant} t={t} />
                  {(row.premium || row.expired) && <ConfirmButton label={t.revoke} icon={<X size={14} />} onConfirm={revoke} t={t} tone="warn" />}
                </div>
              </>
            ))}

            {block(t.access, (
              <>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t.blockHint}</p>
                {row.status === 'active' && (
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={t.reason} aria-label={t.reason}
                    className="w-full h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 text-sm text-stone-900 dark:text-white" />
                )}
                <div className="flex flex-wrap gap-2">
                  {row.status === 'active' && <ConfirmButton label={t.block} icon={<Lock size={14} />} onConfirm={() => setStatus('blocked', 'block')} t={t} tone="warn" />}
                  {row.status === 'active' && <ConfirmButton label={t.ban} icon={<Ban size={14} />} onConfirm={() => setStatus('banned', 'ban')} t={t} tone="danger" />}
                  {row.status === 'blocked' && <ConfirmButton label={t.unblock} icon={<Unlock size={14} />} onConfirm={() => setStatus('active', 'unblock')} t={t} />}
                  {row.status === 'blocked' && <ConfirmButton label={t.ban} icon={<Ban size={14} />} onConfirm={() => setStatus('banned', 'ban')} t={t} tone="danger" />}
                  {row.status === 'banned' && <ConfirmButton label={t.unban} icon={<Unlock size={14} />} onConfirm={() => setStatus('active', 'unban')} t={t} />}
                </div>
                {row.status !== 'active' && row.statusReason && <p className="text-xs text-stone-500">{row.statusReason}</p>}
              </>
            ))}

            {block(t.resetQuota, (
              <>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t.resetHint}</p>
                <ConfirmButton label={t.resetQuota} icon={<Unlock size={14} />} onConfirm={resetQuota} t={t} />
              </>
            ))}

            {isOwner && block(t.danger, (
              <>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t.removeHint}</p>
                <input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={t.typeEmail} aria-label={t.typeEmail}
                  className="w-full h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 text-sm text-stone-900 dark:text-white" />
                <ConfirmButton label={t.remove} icon={<Trash2 size={14} />} onConfirm={remove} t={t} tone="danger" disabled={confirmEmail.trim().toLowerCase() !== row.email.toLowerCase()} />
              </>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
