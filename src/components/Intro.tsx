import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Cloud, Languages, Loader2, LogIn, Moon, MousePointerClick, ShieldCheck, Sparkles, Sun, Smartphone } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Language } from '../lib/i18n';
import { cn } from '../lib/utils';
import { CATALOG, isNewTool, toolText } from '../lib/toolCatalog';
import { normalizePlans, type PlansConfig } from '../lib/plans';
import { PlanCards } from './PlansModal';

interface IntroProps {
  onLogin: () => void;
  /** Shown only after the owner opens the admin Fórmula Fácil to everyone. */
  onOpenFormulaAdmin?: () => void;
  appName: string;
  footerText: string;
  t: any;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  loginLoading?: boolean;
  loginError?: string | null;
}

const C = {
  pt: {
    newTool: 'Novo', heroA: 'Suas ferramentas de trabalho,', heroB: 'num só lugar.',
    sub: 'Registre horas, crie faturas, edite PDFs e monte fórmulas de Excel com IA. Tudo no navegador, no celular ou no computador, sem instalar nada.',
    login: 'Começar grátis com Google', entering: 'Entrando…', seeTools: 'Ver ferramentas', signIn: 'Entrar',
    trust: ['Grátis para começar', 'Sem instalar nada', 'Salvo na nuvem'],
    toolsTitle: 'Ferramentas', toolsSub: 'Cada ferramenta resolve uma tarefa do dia a dia. Novas chegam com frequência.', use: 'Usar grátis',
    howTitle: 'Como funciona',
    how: [
      { title: 'Entre com Google', body: 'Um clique, sem senha nova para lembrar.' },
      { title: 'Escolha a ferramenta', body: 'Todas ficam na página inicial, com dicas para começar.' },
      { title: 'Pronto, está salvo', body: 'Seus dados ficam na nuvem e aparecem em qualquer aparelho.' },
    ],
    plansTitle: 'Planos', plansSub: 'Comece grátis e mude de plano quando precisar de mais.',
    ctaTitle: 'Pronto para ganhar tempo?', ctaSub: 'Crie sua conta em segundos com o Google.',
    formula: 'Fórmula Fácil: Excel com IA', mock: 'O que vamos fazer hoje?', theme: 'Mudar tema', language: 'Idioma',
  },
  en: {
    newTool: 'New', heroA: 'Your work tools,', heroB: 'all in one place.',
    sub: 'Log hours, create invoices, edit PDFs and build Excel formulas with AI. All in the browser, on phone or computer, nothing to install.',
    login: 'Start free with Google', entering: 'Signing in…', seeTools: 'See tools', signIn: 'Sign in',
    trust: ['Free to start', 'Nothing to install', 'Saved in the cloud'],
    toolsTitle: 'Tools', toolsSub: 'Each tool solves an everyday task. New ones arrive often.', use: 'Use for free',
    howTitle: 'How it works',
    how: [
      { title: 'Sign in with Google', body: 'One click, no new password to remember.' },
      { title: 'Pick a tool', body: 'They all live on the home page, with tips to get started.' },
      { title: "Done, it's saved", body: 'Your data stays in the cloud and shows up on any device.' },
    ],
    plansTitle: 'Plans', plansSub: 'Start free and change plans when you need more.',
    ctaTitle: 'Ready to save time?', ctaSub: 'Create your account in seconds with Google.',
    formula: 'Fórmula Fácil: Excel with AI', mock: 'What are we doing today?', theme: 'Change theme', language: 'Language',
  },
  es: {
    newTool: 'Nuevo', heroA: 'Tus herramientas de trabajo,', heroB: 'en un solo lugar.',
    sub: 'Registra horas, crea facturas, edita PDFs y arma fórmulas de Excel con IA. Todo en el navegador, en el móvil o el ordenador, sin instalar nada.',
    login: 'Empieza gratis con Google', entering: 'Entrando…', seeTools: 'Ver herramientas', signIn: 'Entrar',
    trust: ['Gratis para empezar', 'Sin instalar nada', 'Guardado en la nube'],
    toolsTitle: 'Herramientas', toolsSub: 'Cada herramienta resuelve una tarea del día a día. Llegan nuevas a menudo.', use: 'Usar gratis',
    howTitle: 'Cómo funciona',
    how: [
      { title: 'Entra con Google', body: 'Un clic, sin contraseña nueva que recordar.' },
      { title: 'Elige la herramienta', body: 'Todas están en la página de inicio, con consejos para empezar.' },
      { title: 'Listo, está guardado', body: 'Tus datos quedan en la nube y aparecen en cualquier dispositivo.' },
    ],
    plansTitle: 'Planes', plansSub: 'Empieza gratis y cambia de plan cuando necesites más.',
    ctaTitle: '¿Listo para ganar tiempo?', ctaSub: 'Crea tu cuenta en segundos con Google.',
    formula: 'Fórmula Fácil: Excel con IA', mock: '¿Qué hacemos hoy?', theme: 'Cambiar tema', language: 'Idioma',
  },
};

const HOW_ICONS = [MousePointerClick, Sparkles, Cloud];
const TRUST_ICONS = [CheckCircle2, Smartphone, ShieldCheck];

/**
 * Public home page. The tool list, the "new" badge and the plans all come from live data
 * (toolCatalog.ts and settings/plans), so new tools and plan changes appear here on their own.
 * No photos or videos: icons and CSS only, to stay light on any connection.
 */
export function Intro({ onLogin, onOpenFormulaAdmin, appName, footerText, lang, onLanguageChange, isDarkMode, onThemeToggle, loginLoading = false, loginError = null }: IntroProps) {
  const t = C[lang] || C.pt;
  const tools = CATALOG.filter((tool) => !tool.helper);
  const newest = tools.find((tool) => isNewTool(tool));
  const [plans, setPlans] = useState<PlansConfig | null>(null);
  const [spot, setSpot] = useState(0);

  useEffect(() => onSnapshot(doc(db, 'settings', 'plans'), (snap) => setPlans(normalizePlans(snap.exists() ? snap.data() : null)), () => setPlans(normalizePlans(null))), []);
  // The mock window highlights one tool after another.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setSpot((i) => (i + 1) % tools.length), 2600);
    return () => window.clearInterval(timer);
  }, [tools.length]);

  const login = (
    <button type="button" disabled={loginLoading} onClick={(e) => { e.preventDefault(); onLogin(); }} data-testid="intro-login"
      className={cn('group inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-primary px-7 py-4 text-base font-black text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-hover hover:-translate-y-0.5 active:translate-y-0 dark:bg-white dark:text-stone-900 dark:shadow-none',
        loginLoading && 'opacity-70 cursor-not-allowed')}>
      {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />}
      {loginLoading ? t.entering : t.login}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 dark:bg-bg-dark dark:text-white" data-testid="intro">
      <header className="sticky top-0 z-40 border-b border-black/5 dark:border-white/5 bg-white/85 dark:bg-bg-dark/85 backdrop-blur">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center gap-2">
          <a href="/" className="brand-trigger flex items-center gap-2.5 shrink-0 mr-auto rounded-lg" aria-label={appName}>
            <span className="brand-mark relative w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm" aria-hidden="true">
              <span className="brand-glow absolute inset-0 rounded-2xl pointer-events-none" />
              <span className="brand-clock-face relative z-10 w-6 h-6 rounded-full border-[1.7px] border-white/95">
                <span className="brand-hour-hand absolute left-1/2 top-1/2 w-[1.7px] h-[6px] bg-white rounded-full origin-bottom" />
                <span className="brand-minute-hand absolute left-1/2 top-1/2 w-[1.5px] h-[8px] bg-white rounded-full origin-bottom" />
                <span className="brand-clock-pin absolute left-1/2 top-1/2 w-[3px] h-[3px] bg-white rounded-full" />
              </span>
            </span>
            <span className="brand-wordmark hidden min-[380px]:flex items-baseline whitespace-nowrap font-black text-lg sm:text-xl tracking-[-0.04em]">
              <span className="text-stone-900 dark:text-white">Shift</span><span className="ml-1 text-primary dark:text-stone-300">Hours</span>
            </span>
          </a>
          <label className="relative inline-flex items-center h-10 rounded-full text-stone-500 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10" title={t.language}>
            <Languages className="w-4 h-4 absolute left-2.5 pointer-events-none" />
            <select value={lang} onChange={(e) => onLanguageChange(e.target.value as Language)} aria-label={t.language} data-testid="intro-lang"
              className="appearance-none bg-transparent h-10 pl-8 pr-2.5 text-xs font-black uppercase cursor-pointer outline-none">
              {(['pt', 'en', 'es'] as Language[]).map((l) => <option key={l} value={l} className="text-stone-900">{l.toUpperCase()}</option>)}
            </select>
          </label>
          <button type="button" onClick={onThemeToggle} aria-label={t.theme} title={t.theme}
            className="w-10 h-10 inline-flex items-center justify-center rounded-full text-stone-500 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10">
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onLogin} disabled={loginLoading}
            className="h-10 px-4 rounded-full text-sm font-black bg-stone-900 text-white dark:bg-white dark:text-stone-900 hover:opacity-90">{t.signIn}</button>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_0%,var(--primary-color-light),transparent)] dark:bg-[radial-gradient(60%_50%_at_80%_0%,rgba(255,255,255,0.06),transparent)]" />
          <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-16 sm:pt-20 lg:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            <div className="text-center lg:text-left">
              {newest && (
                <a href="#ferramentas" className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 mb-6" data-testid="intro-new">
                  <Sparkles className="w-3.5 h-3.5" />{t.newTool}: {toolText(newest.name, lang)}<ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.02]">
                {t.heroA} <span className="text-primary dark:text-stone-300">{t.heroB}</span>
              </h1>
              <p className="mt-5 text-base sm:text-lg text-stone-600 dark:text-stone-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">{t.sub}</p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                {login}
                <a href="#ferramentas" className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl border border-stone-200 dark:border-white/15 px-6 py-4 text-sm font-black hover:bg-white dark:hover:bg-white/5">
                  {t.seeTools}<ArrowRight className="w-4 h-4" />
                </a>
              </div>
              {onOpenFormulaAdmin && (
                <a href="/admin/formula-facil" data-testid="intro-formula-admin"
                  onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpenFormulaAdmin(); }}
                  className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-stone-200 dark:border-white/15 bg-white dark:bg-white/5 px-5 py-3 text-sm font-black hover:border-primary/40">
                  {(() => { const Icon = CATALOG.find((x) => x.id === 'formula')!.icon; return <Icon className="w-4 h-4 text-primary dark:text-white" />; })()}{t.formula}
                </a>
              )}
              {loginError && <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{loginError}</p>}
              <ul className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
                {t.trust.map((item, i) => { const Icon = TRUST_ICONS[i]; return <li key={item} className="inline-flex items-center gap-1.5"><Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />{item}</li>; })}
              </ul>
            </div>

            <div aria-hidden="true" className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark shadow-2xl shadow-stone-300/40 dark:shadow-black/40 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 h-9 border-b border-stone-100 dark:border-white/5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-300" /><span className="w-2.5 h-2.5 rounded-full bg-amber-300" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-lg font-black">{t.mock}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {tools.map((tool, i) => (
                      <div key={tool.id} className={cn('rounded-2xl border p-3 transition-all duration-500',
                        i === spot % tools.length ? 'border-primary/40 bg-primary-light dark:border-white/30 dark:bg-white/10 -translate-y-0.5 shadow-md' : 'border-stone-100 dark:border-white/5')}>
                        <span className="w-9 h-9 rounded-xl bg-primary text-white dark:bg-white dark:text-stone-900 flex items-center justify-center"><tool.icon className="w-4 h-4" /></span>
                        <p className="mt-2 text-sm font-black leading-tight">{toolText(tool.name, lang)}</p>
                        <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400 leading-snug line-clamp-2">{toolText(tool.tagline, lang)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ferramentas" className="scroll-mt-20 max-w-6xl mx-auto px-4 py-16">
          <div className="max-w-2xl mb-8">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{t.toolsTitle}</h2>
            <p className="mt-2 text-stone-600 dark:text-stone-400">{t.toolsSub}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2" data-testid="intro-tools">
            {tools.map((tool) => (
              <article key={tool.id} className="rounded-3xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-6 flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-primary text-white dark:bg-white dark:text-stone-900 flex items-center justify-center shrink-0"><tool.icon className="w-5 h-5" /></span>
                  <h3 className="text-xl font-black">{toolText(tool.name, lang)}</h3>
                  {isNewTool(tool) && <span className="rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-2 py-0.5 text-[10px] font-black uppercase">{t.newTool}</span>}
                </div>
                <p className="mt-4 text-sm text-stone-600 dark:text-stone-300 leading-relaxed flex-1">{toolText(tool.description, lang)}</p>
                <p className="mt-4 rounded-2xl bg-stone-50 dark:bg-white/5 px-4 py-3 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">{toolText(tool.tips[tool.tips.length - 1], lang)}</p>
                <button type="button" onClick={onLogin} className="mt-5 self-start inline-flex items-center gap-1.5 text-sm font-black text-primary dark:text-white hover:gap-2.5 transition-all">
                  {t.use}<ArrowRight className="w-4 h-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-stone-200 dark:border-white/5 bg-white dark:bg-bg-card-dark/40">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <h2 className="text-3xl font-black tracking-tight mb-8">{t.howTitle}</h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {t.how.map((step, i) => { const Icon = HOW_ICONS[i]; return (
                <li key={step.title} className="rounded-3xl border border-stone-200 dark:border-white/10 p-6">
                  <span className="inline-flex items-center gap-2 text-xs font-black text-stone-400"><span className="w-7 h-7 rounded-full bg-primary-light dark:bg-white/10 text-primary dark:text-white inline-flex items-center justify-center">{i + 1}</span><Icon className="w-4 h-4" /></span>
                  <h3 className="mt-3 text-lg font-black">{step.title}</h3>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{step.body}</p>
                </li>
              ); })}
            </ol>
          </div>
        </section>

        <section id="planos" className="max-w-6xl mx-auto px-4 py-16">
          <div className="max-w-2xl mb-8">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{t.plansTitle}</h2>
            <p className="mt-2 text-stone-600 dark:text-stone-400">{t.plansSub}</p>
          </div>
          {plans ? <PlanCards config={plans} language={lang} /> : <div className="h-48 rounded-3xl bg-stone-100 dark:bg-white/5 animate-pulse" />}
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="rounded-3xl bg-primary text-white dark:bg-white/[0.06] dark:border dark:border-white/10 px-6 py-12 sm:px-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{t.ctaTitle}</h2>
            <p className="mt-2 text-white/75">{t.ctaSub}</p>
            <button type="button" disabled={loginLoading} onClick={onLogin}
              className="mt-7 inline-flex items-center justify-center gap-3 rounded-2xl bg-white text-stone-900 px-7 py-4 font-black hover:-translate-y-0.5 transition-transform">
              <LogIn className="w-5 h-5" />{t.login}
            </button>
          </div>
        </section>
      </main>

      <footer className="py-10 text-center text-[10px] font-black uppercase tracking-[0.4em] text-stone-400 select-none">
        {footerText.replace(/WORKHOURS/gi, 'SHIFTHOURS')}
      </footer>
    </div>
  );
}
