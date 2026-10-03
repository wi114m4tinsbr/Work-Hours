import { useEffect, useState } from 'react';
import { Check, Copy, Download, GitCommitHorizontal, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../lib/utils';

type Lang = 'pt' | 'en' | 'es';

interface Milestone { at: string; kind: string; title: string; details: string }
interface Commit { sha: string; at: string; author: string; message: string }
interface Report { branch: string; milestones: Milestone[]; commits: Commit[]; commitsAvailable: boolean; prompt: string }

const C = {
  pt: {
    promptTitle: 'Prompt de contexto', promptHint: 'Texto completo para colar em qualquer lugar e continuar o projeto: objetivo, regras, o que foi feito, onde paramos e os últimos envios ao GitHub.',
    copy: 'Copiar prompt', copied: 'Copiado', download: 'Baixar .md', show: 'Ver texto', hide: 'Esconder texto',
    milestones: 'Marcos do projeto', commits: 'Todos os envios ao GitHub', branch: 'Branch', refresh: 'Atualizar',
    loading: 'Carregando relatório…', failed: 'Não foi possível carregar o relatório.', noCommits: 'O GitHub não respondeu agora. Os marcos continuam abaixo.',
    kinds: { new: 'Novo', improved: 'Melhoria', fixed: 'Correção', removed: 'Removido' } as Record<string, string>,
  },
  en: {
    promptTitle: 'Context prompt', promptHint: 'Full text to paste anywhere and carry on with the project: goal, rules, what was done, where we stopped and the latest GitHub pushes.',
    copy: 'Copy prompt', copied: 'Copied', download: 'Download .md', show: 'Show text', hide: 'Hide text',
    milestones: 'Project milestones', commits: 'Every push to GitHub', branch: 'Branch', refresh: 'Refresh',
    loading: 'Loading report…', failed: 'Could not load the report.', noCommits: 'GitHub did not answer right now. Milestones are still below.',
    kinds: { new: 'New', improved: 'Improved', fixed: 'Fixed', removed: 'Removed' } as Record<string, string>,
  },
  es: {
    promptTitle: 'Prompt de contexto', promptHint: 'Texto completo para pegar en cualquier lugar y continuar el proyecto: objetivo, reglas, lo hecho, dónde paramos y los últimos envíos a GitHub.',
    copy: 'Copiar prompt', copied: 'Copiado', download: 'Descargar .md', show: 'Ver texto', hide: 'Ocultar texto',
    milestones: 'Hitos del proyecto', commits: 'Todos los envíos a GitHub', branch: 'Rama', refresh: 'Actualizar',
    loading: 'Cargando informe…', failed: 'No se pudo cargar el informe.', noCommits: 'GitHub no respondió ahora. Los hitos siguen abajo.',
    kinds: { new: 'Nuevo', improved: 'Mejora', fixed: 'Corrección', removed: 'Eliminado' } as Record<string, string>,
  },
};

const KIND_DOT: Record<string, string> = {
  new: 'bg-primary dark:bg-white',
  improved: 'bg-emerald-500',
  fixed: 'bg-amber-500',
  removed: 'bg-stone-400',
};

/** Owner-only project report: milestones, every GitHub push (live) and the copy-and-paste context prompt. */
export function ProjectReport({ language, locale }: { language: Lang; locale: string }) {
  const t = C[language] || C.pt;
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showCommits, setShowCommits] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin-report', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      setReport(await response.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.prompt);
    } catch {
      setShowPrompt(true);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => {
    if (!report) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report.prompt], { type: 'text/markdown;charset=utf-8' }));
    a.download = 'shift-hours-contexto.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!report) {
    return <div className="text-sm font-semibold text-stone-400">{error ? t.failed : t.loading}</div>;
  }

  const milestones = [...report.milestones].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const card = 'rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5';
  const button = 'inline-flex items-center gap-1.5 h-9 rounded-xl px-3 text-sm font-bold border border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-200 hover:bg-primary-light dark:hover:bg-white/10';

  return (
    <div className="space-y-4" data-testid="project-report">
      <section className={card}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-stone-900 dark:text-white">{t.promptTitle}</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t.promptHint}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} data-testid="copy-prompt" className="inline-flex items-center gap-1.5 h-9 rounded-xl px-3 text-sm font-black bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-stone-900">
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t.copied : t.copy}
            </button>
            <button type="button" onClick={download} className={button}><Download size={15} />{t.download}</button>
            <button type="button" onClick={() => setShowPrompt((v) => !v)} className={button}>{showPrompt ? t.hide : t.show}</button>
          </div>
        </div>
        {showPrompt && (
          <textarea readOnly value={report.prompt} onFocus={(e) => e.currentTarget.select()} aria-label={t.promptTitle}
            className="mt-4 w-full h-80 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-3 font-mono text-xs text-stone-800 dark:text-stone-200" />
        )}
      </section>

      <section className={card}>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-base font-black text-stone-900 dark:text-white flex-1">{t.milestones}</h3>
          <button type="button" onClick={load} disabled={loading} className={cn(button, loading && 'opacity-60')}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{t.refresh}</button>
        </div>
        <ol className="relative border-l border-stone-200 dark:border-white/10 ml-1.5 space-y-5">
          {milestones.map((m) => (
            <li key={`${m.at}-${m.title}`} className="pl-5 relative">
              <span className={cn('absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full', KIND_DOT[m.kind] || KIND_DOT.new)} />
              <p className="text-xs font-semibold text-stone-400 tabular-nums">{fmt(m.at)} · {t.kinds[m.kind] || m.kind}</p>
              <p className="font-black text-stone-900 dark:text-white">{m.title}</p>
              {m.details && <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{m.details}</p>}
            </li>
          ))}
        </ol>
      </section>

      <section className={card}>
        <button type="button" onClick={() => setShowCommits((v) => !v)} className="w-full flex items-center gap-2 text-left" aria-expanded={showCommits}>
          <GitCommitHorizontal size={16} className="text-stone-400" />
          <h3 className="text-base font-black text-stone-900 dark:text-white flex-1">{t.commits} ({report.commits.length})</h3>
          <span className="text-xs font-semibold text-stone-400">{t.branch}: {report.branch}</span>
        </button>
        {!report.commitsAvailable && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{t.noCommits}</p>}
        {showCommits && (
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-white/5" data-testid="report-commits">
            {report.commits.map((c) => (
              <li key={c.sha} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                <span className="text-xs text-stone-400 tabular-nums w-36 shrink-0">{fmt(c.at)}</span>
                <a href={`https://github.com/wi114m4tinsbr/Work-Hours/commit/${c.sha}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary dark:text-white hover:underline">{c.sha}</a>
                <span className="min-w-0 flex-1 text-stone-800 dark:text-stone-200">{c.message}</span>
                <span className="text-xs text-stone-400">{c.author}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
