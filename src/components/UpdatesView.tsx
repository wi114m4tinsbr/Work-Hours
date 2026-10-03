import { Bug, Minus, Sparkles, TrendingUp } from 'lucide-react';
import { ToolIdentity } from './ToolIdentity';
import { cn } from '../lib/utils';
import { UPDATES, type UpdateKind } from '../data/updates';

type Lang = 'pt' | 'en' | 'es';

const C = {
  pt: { title: 'Atualizações', back: 'Voltar', intro: 'Novidades, melhorias e correções do Shift Hours.', kinds: { new: 'Novo', improved: 'Melhoria', fixed: 'Correção', removed: 'Removido' } },
  en: { title: 'Updates', back: 'Back', intro: 'Shift Hours news, improvements and fixes.', kinds: { new: 'New', improved: 'Improved', fixed: 'Fixed', removed: 'Removed' } },
  es: { title: 'Novedades', back: 'Volver', intro: 'Novedades, mejoras y correcciones de Shift Hours.', kinds: { new: 'Nuevo', improved: 'Mejora', fixed: 'Corrección', removed: 'Eliminado' } },
};

const KIND_STYLE: Record<UpdateKind, { icon: typeof Sparkles; className: string }> = {
  new: { icon: Sparkles, className: 'bg-primary-light text-primary dark:bg-white/10 dark:text-white' },
  improved: { icon: TrendingUp, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  fixed: { icon: Bug, className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  removed: { icon: Minus, className: 'bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300' },
};

/** Public changelog for signed-in users, grouped by day, newest first. */
export function UpdatesView({ language, onBack }: { language: Lang; onBack: () => void }) {
  const t = C[language] || C.pt;
  const locale = language === 'en' ? 'en-GB' : language === 'es' ? 'es-ES' : 'pt-BR';
  const days = [...new Set(UPDATES.map((u) => u.date))];
  const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="w-full" data-testid="updates-view">
      <div className="bg-white/95 dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 shadow-sm">
        <div className="h-12 w-full max-w-7xl mx-auto flex items-center gap-3 px-4">
          <ToolIdentity title={t.title} language={language} backLabel={t.back} onBack={onBack} />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">{t.intro}</p>
        <ol className="space-y-8">
          {days.map((day) => (
            <li key={day}>
              <h2 className="text-xs font-black uppercase tracking-wider text-stone-400 mb-3">{fmt(day)}</h2>
              <ul className="space-y-3">
                {UPDATES.filter((u) => u.date === day).map((u) => {
                  const text = u[language] || u.pt;
                  const style = KIND_STYLE[u.kind];
                  const Icon = style.icon;
                  return (
                    <li key={text.title} className="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-4 flex gap-3">
                      <span className={cn('w-9 h-9 shrink-0 rounded-xl flex items-center justify-center', style.className)}><Icon size={16} /></span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-stone-900 dark:text-white">{text.title}</h3>
                          <span className={cn('text-[10px] font-black uppercase tracking-wide rounded-md px-1.5 py-0.5', style.className)}>{t.kinds[u.kind]}</span>
                        </div>
                        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{text.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
