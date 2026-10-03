import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Crown, Lightbulb, Megaphone, Plus, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Job } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { CATALOG, isNewTool, toolText, type CatalogTool, type ToolTab } from '../lib/toolCatalog';
import { UPDATES } from '../data/updates';
import type { Access } from '../lib/quota';
import type { ToolLimit } from '../lib/plans';
import { UsageBadge } from './UsageBadge';
import { JobIcon } from './Dashboard';

type Lang = 'pt' | 'en' | 'es';

export interface HomeBadge {
  quota: { access: Access; planName: string; limit: ToolLimit; reached: boolean; blocked: boolean };
  available: string;
  reachedText?: string;
}

const C = {
  pt: {
    morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite', ask: 'O que vamos fazer hoje?',
    search: 'Buscar ferramenta…', tools: 'Suas ferramentas', open: 'Abrir', isNew: 'Novo', none: 'Nenhuma ferramenta com esse nome.',
    recent: 'Continue de onde parou', allJobs: 'Ver todos', noJobs: 'Cadastre seu primeiro trabalho para registrar horas e ver quanto vai receber.',
    addJob: 'Cadastrar trabalho', perHour: '/hora', tip: 'Dica rápida', prev: 'Dica anterior', next: 'Próxima dica',
    news: 'Novidades', allNews: 'Ver todas', plan: 'Seu plano', upgrade: 'Ver planos', help: 'Precisa de ajuda ou tem uma ideia?',
    adminFormula: 'Fórmula Fácil Admin', adminFormulaHint: 'Versão completa liberada na página inicial.',
  },
  en: {
    morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', ask: 'What are we doing today?',
    search: 'Search tools…', tools: 'Your tools', open: 'Open', isNew: 'New', none: 'No tool with that name.',
    recent: 'Pick up where you left off', allJobs: 'See all', noJobs: 'Add your first job to log hours and see what you will earn.',
    addJob: 'Add job', perHour: '/hour', tip: 'Quick tip', prev: 'Previous tip', next: 'Next tip',
    news: "What's new", allNews: 'See all', plan: 'Your plan', upgrade: 'See plans', help: 'Need help or have an idea?',
    adminFormula: 'Fórmula Fácil Admin', adminFormulaHint: 'Full version opened on the home page.',
  },
  es: {
    morning: 'Buenos días', afternoon: 'Buenas tardes', evening: 'Buenas noches', ask: '¿Qué hacemos hoy?',
    search: 'Buscar herramienta…', tools: 'Tus herramientas', open: 'Abrir', isNew: 'Nuevo', none: 'Ninguna herramienta con ese nombre.',
    recent: 'Sigue donde lo dejaste', allJobs: 'Ver todos', noJobs: 'Registra tu primer trabajo para anotar horas y ver cuánto vas a cobrar.',
    addJob: 'Registrar trabajo', perHour: '/hora', tip: 'Consejo rápido', prev: 'Consejo anterior', next: 'Siguiente consejo',
    news: 'Novedades', allNews: 'Ver todas', plan: 'Tu plan', upgrade: 'Ver planes', help: '¿Necesitas ayuda o tienes una idea?',
    adminFormula: 'Fórmula Fácil Admin', adminFormulaHint: 'Versión completa abierta en el inicio.',
  },
};

const JOBS_WORD = { pt: 'trabalhos', en: 'jobs', es: 'trabajos' };
const JOBS_FULL = { pt: 'Limite de trabalhos atingido', en: 'Job limit reached', es: 'Límite de trabajos alcanzado' };

const greeting = (t: typeof C.pt, hour: number) => (hour >= 5 && hour < 12 ? t.morning : hour >= 12 && hour < 18 ? t.afternoon : t.evening);
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Home after login: a hub of every tool in the catalog with what is left on the plan, recent
 * jobs, rotating tips and the latest updates. New catalog entries appear here on their own.
 */
export function HomeView({ userId, firstName, language, badges, jobsAllowance, planName, onOpen, onOpenJob, onUpgrade, onOpenUpdates, onOpenFormulaAdmin }: {
  userId: string;
  firstName: string;
  language: Lang;
  badges: Partial<Record<ToolTab, HomeBadge>>;
  /** Jobs are a total, not a daily count, so the badge is worked out from the jobs listed here. */
  jobsAllowance: { access: Access; planName: string; limit: ToolLimit };
  planName: string;
  onOpen: (tab: ToolTab) => void;
  onOpenJob: (jobId: string) => void;
  onUpgrade?: () => void;
  onOpenUpdates: () => void;
  onOpenFormulaAdmin?: () => void;
}) {
  const t = C[language] || C.pt;
  const [term, setTerm] = useState('');
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, 'jobs'), where('userId', '==', userId)), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Job);
    list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    setJobs(list);
  }, () => setJobs([])), [userId]);

  const main = CATALOG.filter((tool) => !tool.helper);
  const helpers = CATALOG.filter((tool) => tool.helper);
  const shown = useMemo(() => {
    const q = normalize(term.trim());
    if (!q) return main;
    return CATALOG.filter((tool) => normalize(`${toolText(tool.name, language)} ${toolText(tool.tagline, language)}`).includes(q));
  }, [term, language]);

  const tips = useMemo(() => CATALOG.flatMap((tool) => tool.tips.map((tip) => ({ tool, tip }))), []);
  // Starts on a different tip each day so returning users see something new.
  useEffect(() => setTipIndex(Math.floor(Date.now() / 86_400_000) % tips.length), [tips.length]);
  useEffect(() => {
    if (paused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setTipIndex((i) => (i + 1) % tips.length), 9000);
    return () => window.clearInterval(timer);
  }, [paused, tips.length]);
  const current = tips[tipIndex % tips.length];

  const allBadges = { ...badges };
  if (jobs) {
    const { access, limit } = jobsAllowance;
    const unlimited = access === 'admin' || limit.mode === 'unlimited';
    const blocked = !unlimited && (limit.mode === 'off' || limit.amount <= 0);
    allBadges.hours = {
      quota: { ...jobsAllowance, reached: !unlimited && !blocked && jobs.length >= limit.amount, blocked },
      available: `${jobs.length}/${limit.amount} ${JOBS_WORD[language]}`,
      reachedText: JOBS_FULL[language],
    };
  }

  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-BR';
  const news = UPDATES.slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-8" data-testid="home-view">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 dark:border-white/10 bg-gradient-to-br from-primary-light via-white to-white dark:from-white/[0.07] dark:via-bg-card-dark dark:to-bg-card-dark p-5 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 dark:bg-white/5 blur-2xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end gap-5 lg:gap-8">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary dark:text-stone-300">{greeting(t, new Date().getHours())}{firstName ? `, ${firstName}` : ''}</p>
            <h1 className="mt-1 text-2xl sm:text-4xl font-black tracking-tight text-stone-900 dark:text-white">{t.ask}</h1>
            <label className="mt-5 flex items-center gap-2 h-12 max-w-xl rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 shadow-sm focus-within:ring-2 focus-within:ring-primary/30">
              <Search size={18} className="text-stone-400 shrink-0" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t.search} aria-label={t.search} data-testid="home-search"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm sm:text-base text-stone-900 dark:text-white placeholder:text-stone-400" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-white/10 border border-stone-200 dark:border-white/10 px-3 h-8 text-xs font-bold text-stone-600 dark:text-stone-200">
              <Crown size={13} className="text-amber-500" />{t.plan}: {planName}
            </span>
            {onUpgrade && (
              <button type="button" onClick={onUpgrade} className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-black text-primary dark:text-white hover:bg-white/70 dark:hover:bg-white/10">
                {t.upgrade}<ArrowRight size={13} />
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="home-tools">
        <h2 id="home-tools" className="text-xs font-black uppercase tracking-wider text-stone-400 mb-3">{t.tools}</h2>
        {shown.length === 0 ? <p className="text-sm text-stone-500 py-6">{t.none}</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="home-tools">
            {shown.map((tool) => <ToolCard key={tool.id} tool={tool} language={language} badge={allBadges[tool.id]} t={t} onOpen={() => onOpen(tool.id)} />)}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="self-start rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5" aria-labelledby="home-recent">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="home-recent" className="font-black text-stone-900 dark:text-white">{t.recent}</h2>
            {!!jobs?.length && <button type="button" onClick={() => onOpen('hours')} className="text-xs font-bold text-primary dark:text-stone-300 hover:underline">{t.allJobs}</button>}
          </div>
          {jobs === null ? <div className="h-24 rounded-2xl bg-stone-100 dark:bg-white/5 animate-pulse" /> : jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 dark:border-white/10 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1 text-sm text-stone-500 dark:text-stone-400">{t.noJobs}</p>
              <button type="button" onClick={() => onOpen('hours')} className="h-10 shrink-0 rounded-xl px-4 inline-flex items-center justify-center gap-1.5 text-sm font-black bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-stone-900">
                <Plus size={15} />{t.addJob}
              </button>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="home-recent">
              {jobs.slice(0, 4).map((job) => (
                <li key={job.id}>
                  <button type="button" onClick={() => onOpenJob(job.id)} className="group w-full text-left rounded-2xl border border-stone-100 dark:border-white/5 hover:border-primary/30 hover:bg-primary-light/60 dark:hover:bg-white/5 p-3 flex items-center gap-3 transition-colors">
                    <span className="w-11 h-11 shrink-0 rounded-2xl overflow-hidden bg-primary-light dark:bg-white/10 text-primary dark:text-white flex items-center justify-center"><JobIcon job={job} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-stone-900 dark:text-white truncate">{job.name}</span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">{formatCurrency(job.hourlyRate, job.currency)}{t.perHour}</span>
                    </span>
                    <ChevronRight size={16} className="text-stone-300 group-hover:text-primary shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-3xl bg-primary dark:bg-white/[0.06] text-white p-5 dark:border dark:border-white/10" aria-labelledby="home-tip"
            onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 id="home-tip" className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300"><Lightbulb size={14} />{t.tip}</h2>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={t.prev} onClick={() => setTipIndex((i) => (i - 1 + tips.length) % tips.length)} className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white"><ChevronLeft size={16} /></button>
                <span className="text-[11px] tabular-nums text-white/50">{(tipIndex % tips.length) + 1}/{tips.length}</span>
                <button type="button" aria-label={t.next} onClick={() => setTipIndex((i) => (i + 1) % tips.length)} className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white" data-testid="home-tip-next"><ChevronRight size={16} /></button>
              </div>
            </div>
            <p className="text-sm sm:text-base leading-relaxed min-h-[4.5rem]" aria-live="polite" data-testid="home-tip">{toolText(current.tip, language)}</p>
            <button type="button" onClick={() => onOpen(current.tool.id)} className="mt-3 inline-flex items-center gap-1.5 h-9 rounded-xl px-3 text-xs font-black bg-white text-stone-900 hover:bg-amber-200">
              <current.tool.icon size={14} />{t.open} {toolText(current.tool.name, language)}
            </button>
          </section>

          <section className="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5" aria-labelledby="home-news">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="home-news" className="inline-flex items-center gap-1.5 font-black text-stone-900 dark:text-white"><Megaphone size={15} />{t.news}</h2>
              <button type="button" onClick={onOpenUpdates} className="text-xs font-bold text-primary dark:text-stone-300 hover:underline">{t.allNews}</button>
            </div>
            <ul className="space-y-2.5">
              {news.map((u) => (
                <li key={u.pt.title} className="text-sm">
                  <span className="font-bold text-stone-800 dark:text-stone-100">{(u[language] || u.pt).title}</span>
                  <span className="block text-xs text-stone-400">{new Date(`${u.date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="flex flex-col sm:flex-row gap-3">
        {helpers.map((tool) => (
          <button key={tool.id} type="button" onClick={() => onOpen(tool.id)} data-testid={`home-helper-${tool.id}`}
            className="flex-1 rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 flex items-center gap-3 text-left hover:border-primary/30 hover:bg-primary-light/50 dark:hover:bg-white/5">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-primary-light dark:bg-white/10 text-primary dark:text-white flex items-center justify-center"><tool.icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-stone-500 dark:text-stone-400">{t.help}</span>
              <span className="block font-black text-stone-900 dark:text-white">{toolText(tool.name, language)}</span>
            </span>
            <ArrowRight size={16} className="text-stone-300 shrink-0" />
          </button>
        ))}
        {onOpenFormulaAdmin && (
          <button type="button" onClick={onOpenFormulaAdmin} data-testid="home-formula-admin"
            className="flex-1 rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 flex items-center gap-3 text-left hover:border-primary/30 hover:bg-primary-light/50 dark:hover:bg-white/5">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center"><ShieldCheck size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-stone-500 dark:text-stone-400">{t.adminFormulaHint}</span>
              <span className="block font-black text-stone-900 dark:text-white">{t.adminFormula}</span>
            </span>
            <ArrowRight size={16} className="text-stone-300 shrink-0" />
          </button>
        )}
      </section>
    </div>
  );
}

function ToolCard({ tool, language, badge, t, onOpen }: { key?: string; tool: CatalogTool; language: Lang; badge?: HomeBadge; t: typeof C.pt; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-testid={`home-tool-${tool.id}`}
      className="group relative min-w-0 text-left rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5 flex flex-col gap-3 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      <div className="flex items-start justify-between gap-2">
        <span className="w-12 h-12 rounded-2xl bg-primary text-white dark:bg-white dark:text-stone-900 flex items-center justify-center shadow-sm transition-transform group-hover:scale-105"><tool.icon size={22} /></span>
        <span className="flex items-center gap-1.5">
          {isNewTool(tool) && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"><Sparkles size={10} />{t.isNew}</span>}
          <span className="w-8 h-8 shrink-0 rounded-full inline-flex items-center justify-center text-stone-300 group-hover:text-primary group-hover:bg-primary-light dark:group-hover:bg-white/10 dark:group-hover:text-white transition-colors"><ArrowRight size={16} /></span>
        </span>
      </div>
      <div className="flex-1">
        <h3 className="font-black text-stone-900 dark:text-white">{toolText(tool.name, language)}</h3>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400 leading-snug">{toolText(tool.tagline, language)}</p>
      </div>
      {badge && (
        <UsageBadge quota={badge.quota} language={language} available={badge.available} reachedText={badge.reachedText} testId={`home-badge-${tool.id}`}
          className="self-start h-auto min-h-7 max-w-full shrink py-1 px-2 text-[11px] whitespace-normal leading-tight" />
      )}
    </button>
  );
}
