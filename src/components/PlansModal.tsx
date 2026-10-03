import { AnimatePresence, motion } from 'motion/react';
import { Check, Crown, Minus, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { TOOL_IDS, describeLimit, sortedPlans, type Lang, type PlansConfig } from '../lib/plans';

const C = {
  pt: { kicker: 'Shift Hours Premium', title: 'Faça mais com o Shift Hours', intro: 'Compare o seu plano com os outros planos.', current: 'Atual', soon: 'Em breve', note: 'Nenhuma cobrança será feita nesta etapa.', upgrade: 'Upgrade' },
  en: { kicker: 'Shift Hours Premium', title: 'Do more with Shift Hours', intro: 'Compare your plan with the other plans.', current: 'Current', soon: 'Coming soon', note: 'No charge is made at this stage.', upgrade: 'Upgrade' },
  es: { kicker: 'Shift Hours Premium', title: 'Haz más con Shift Hours', intro: 'Compara tu plan con los otros planes.', current: 'Actual', soon: 'Próximamente', note: 'No se hará ningún cobro en esta etapa.', upgrade: 'Upgrade' },
};

/** Plan cards built from the plans in the admin panel, so any change shows up here right away. */
export function PlanCards({ config, currentPlanId, language, compact = false }: {
  config: PlansConfig; currentPlanId?: string; language: Lang; compact?: boolean;
}) {
  const t = C[language] || C.pt;
  const plans = sortedPlans(config).filter(([id, plan]) => plan.visible || id === currentPlanId);
  return (
    <div className={cn('grid gap-4', plans.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')} data-testid="plan-cards">
      {plans.map(([id, plan]) => {
        const current = id === currentPlanId;
        return (
          <div key={id} data-plan={id}
            className={cn('rounded-2xl p-4 relative flex flex-col', plan.highlight ? 'border-2 border-primary shadow-lg shadow-primary/10 dark:border-white/60' : 'border border-stone-200 dark:border-white/10')}>
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-black uppercase tracking-wider', id === 'free' ? 'text-emerald-600 dark:text-emerald-300' : 'text-primary dark:text-white')}>{plan.name[language]}</span>
              {current && <span className="text-[9px] font-black uppercase tracking-wider rounded-md px-1.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">{t.current}</span>}
            </div>
            <div className={cn('mt-2 font-black text-stone-900 dark:text-white', compact ? 'text-xl' : 'text-2xl')}>{plan.price[language]}</div>
            {plan.description[language] && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{plan.description[language]}</p>}
            <ul className="mt-4 space-y-2.5 text-sm text-stone-600 dark:text-stone-300">
              {TOOL_IDS.map((tool) => {
                const limit = plan.limits[tool];
                const off = limit.mode === 'off' || (limit.mode === 'limited' && limit.amount <= 0);
                return (
                  <li key={tool} className={cn('flex gap-2', off && 'text-stone-400 dark:text-stone-500')}>
                    {off ? <Minus size={16} className="shrink-0 mt-0.5" /> : <Check size={16} className={cn('shrink-0 mt-0.5', id === 'free' ? 'text-emerald-500' : 'text-primary dark:text-white')} />}
                    {describeLimit(tool, limit, language)}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function PlansModal({ open, onClose, config, currentPlanId, language }: {
  open: boolean; onClose: () => void; config: PlansConfig; currentPlanId: string; language: Lang;
}) {
  const t = C[language] || C.pt;
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()} data-testid="plans-modal"
            className="w-full max-w-3xl my-auto rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-primary dark:text-white font-black text-xs uppercase tracking-wider mb-2"><Crown size={15} /> {t.kicker}</div>
                <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">{t.title}</h2>
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-300">{t.intro}</p>
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-xl text-stone-500 dark:text-stone-300 hover:bg-primary hover:text-white"><X size={19} /></button>
            </div>
            <div className="p-5 sm:p-6">
              <PlanCards config={config} currentPlanId={currentPlanId} language={language} />
            </div>
            <div className="px-5 sm:px-6 pb-6">
              <button type="button" disabled className="w-full rounded-xl bg-primary text-white px-4 py-3 font-black disabled:opacity-60 disabled:cursor-not-allowed">{t.upgrade} · {t.soon}</button>
              <p className="text-center mt-3 text-xs text-stone-400 dark:text-stone-500">{t.note}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
