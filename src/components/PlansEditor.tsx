import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Plus, RotateCcw, Save, Star, Trash2 } from 'lucide-react';
import { logAdmin } from '../lib/adminLog';
import { auth, db } from '../firebase';
import { cn } from '../lib/utils';
import {
  TOOLS, TOOL_IDS, describeLimit, normalizePlans, sortedPlans,
  type Lang, type LimitMode, type Period, type Plan, type PlansConfig, type Text, type ToolId,
} from '../lib/plans';
import { PlanCards } from './PlansModal';

const C = {
  pt: {
    intro: 'Escolha um plano, ajuste o que cada ferramenta permite e clique em Salvar. Vale na hora para todos os usuários e para a janela de Upgrade.',
    newPlan: 'Novo plano', newName: 'Novo plano', save: 'Salvar alterações', saving: 'Salvando…', saved: 'Salvo e aplicado para todos.', failed: 'Não foi possível salvar.', discard: 'Desfazer',
    unsaved: 'Alterações não salvas', name: 'Nome', price: 'Preço exibido', description: 'Descrição', show: 'Mostrar no Upgrade', hidden: 'Oculto no Upgrade',
    highlight: 'Destacar', order: 'Posição', remove: 'Excluir plano', removeConfirm: 'Excluir este plano? Quem estiver nele passa a usar o plano Grátis.',
    tools: 'Ferramentas e limites', preview: 'Como os usuários veem no Upgrade', fixed: 'O plano Grátis é o plano de quem não tem outro e não pode ser excluído.',
    modes: { unlimited: 'Ilimitado', limited: 'Limitado', off: 'Não incluído' } as Record<LimitMode, string>,
    periods: { day: 'por dia', week: 'por semana', month: 'por mês' } as Record<Period, string>,
    units: { count: 'usos', minutes: 'minutos', total: 'no máximo' },
    langs: { pt: 'Português', en: 'English', es: 'Español' } as Record<Lang, string>,
    newTool: 'Ferramentas novas aparecem aqui sozinhas quando são adicionadas ao site.',
  },
  en: {
    intro: 'Pick a plan, set what each tool allows and click Save. It applies right away for every user and in the Upgrade window.',
    newPlan: 'New plan', newName: 'New plan', save: 'Save changes', saving: 'Saving…', saved: 'Saved and applied for everyone.', failed: 'Could not save.', discard: 'Undo',
    unsaved: 'Unsaved changes', name: 'Name', price: 'Displayed price', description: 'Description', show: 'Shown in Upgrade', hidden: 'Hidden in Upgrade',
    highlight: 'Highlight', order: 'Position', remove: 'Delete plan', removeConfirm: 'Delete this plan? Anyone on it moves to the Free plan.',
    tools: 'Tools and limits', preview: 'What users see in Upgrade', fixed: 'The Free plan is the plan for anyone without another one and cannot be deleted.',
    modes: { unlimited: 'Unlimited', limited: 'Limited', off: 'Not included' } as Record<LimitMode, string>,
    periods: { day: 'per day', week: 'per week', month: 'per month' } as Record<Period, string>,
    units: { count: 'uses', minutes: 'minutes', total: 'at most' },
    langs: { pt: 'Português', en: 'English', es: 'Español' } as Record<Lang, string>,
    newTool: 'New tools show up here on their own when they are added to the site.',
  },
  es: {
    intro: 'Elige un plan, ajusta lo que permite cada herramienta y haz clic en Guardar. Se aplica al instante para todos y en la ventana de Upgrade.',
    newPlan: 'Nuevo plan', newName: 'Nuevo plan', save: 'Guardar cambios', saving: 'Guardando…', saved: 'Guardado y aplicado para todos.', failed: 'No se pudo guardar.', discard: 'Deshacer',
    unsaved: 'Cambios sin guardar', name: 'Nombre', price: 'Precio mostrado', description: 'Descripción', show: 'Visible en Upgrade', hidden: 'Oculto en Upgrade',
    highlight: 'Destacar', order: 'Posición', remove: 'Eliminar plan', removeConfirm: '¿Eliminar este plan? Quien esté en él pasa al plan Gratis.',
    tools: 'Herramientas y límites', preview: 'Lo que ven los usuarios en Upgrade', fixed: 'El plan Gratis es el plan de quien no tiene otro y no se puede eliminar.',
    modes: { unlimited: 'Ilimitado', limited: 'Limitado', off: 'No incluido' } as Record<LimitMode, string>,
    periods: { day: 'por día', week: 'por semana', month: 'por mes' } as Record<Period, string>,
    units: { count: 'usos', minutes: 'minutos', total: 'como máximo' },
    langs: { pt: 'Português', en: 'English', es: 'Español' } as Record<Lang, string>,
    newTool: 'Las herramientas nuevas aparecen aquí solas cuando se añaden al sitio.',
  },
};

const LANGS: Lang[] = ['pt', 'en', 'es'];
const PROTECTED = ['free', 'premium'];

const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'plano';

/** Admin editor for plans and tool limits (Firestore settings/plans). */
export function PlansEditor({ language }: { language: Lang }) {
  const t = C[language] || C.pt;
  const [saved, setSaved] = useState<PlansConfig>(() => normalizePlans(null));
  const [draft, setDraft] = useState<PlansConfig | null>(null);
  const [selected, setSelected] = useState('free');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  useEffect(() => onSnapshot(doc(db, 'settings', 'plans'), (snap) => setSaved(normalizePlans(snap.exists() ? snap.data() : null))), []);

  const config = draft ?? saved;
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const ordered = useMemo(() => sortedPlans(config), [config]);
  const planId = config.plans[selected] ? selected : 'free';
  const plan = config.plans[planId];

  const change = (update: (next: PlansConfig) => void) => {
    const next: PlansConfig = JSON.parse(JSON.stringify(config));
    update(next);
    setDraft(next);
    setStatus('idle');
  };
  const setPlan = (patch: Partial<Plan>) => change((next) => { next.plans[planId] = { ...next.plans[planId], ...patch }; });
  const setText = (field: 'name' | 'price' | 'description', lang: Lang, value: string) =>
    change((next) => { next.plans[planId][field] = { ...next.plans[planId][field], [lang]: value } as Text; });
  const setLimit = (tool: ToolId, patch: Partial<Plan['limits'][ToolId]>) =>
    change((next) => { next.plans[planId].limits[tool] = { ...next.plans[planId].limits[tool], ...patch }; });

  const addPlan = () => {
    let id = slug(t.newName);
    for (let n = 2; config.plans[id]; n++) id = `${slug(t.newName)}-${n}`;
    const base = config.plans[planId];
    change((next) => {
      next.plans[id] = {
        ...JSON.parse(JSON.stringify(base)),
        name: { pt: C.pt.newName, en: C.en.newName, es: C.es.newName },
        description: { pt: '', en: '', es: '' },
        visible: false, highlight: false,
        order: Math.max(...Object.values(next.plans).map((p) => p.order)) + 1,
      };
    });
    setSelected(id);
  };
  const removePlan = () => {
    if (PROTECTED.includes(planId) || !window.confirm(t.removeConfirm)) return;
    change((next) => { delete next.plans[planId]; });
    setSelected('free');
  };
  const move = (direction: -1 | 1) => {
    const index = ordered.findIndex(([id]) => id === planId);
    const other = ordered[index + direction];
    if (!other) return;
    change((next) => {
      ordered.forEach(([id], i) => { next.plans[id].order = i; });
      next.plans[planId].order = index + direction;
      next.plans[other[0]].order = index;
    });
  };

  const save = async () => {
    if (!draft) return;
    setStatus('saving');
    try {
      const clean = normalizePlans(draft);
      await setDoc(doc(db, 'settings', 'plans'), { plans: clean.plans, updatedAt: Timestamp.now(), updatedBy: auth.currentUser?.email || '' });
      const summary = sortedPlans(clean).map(([, p]) => `${p.name.pt}: ${TOOL_IDS.map((tool) => describeLimit(tool, p.limits[tool], 'pt')).join(', ')}`).join(' | ');
      await logAdmin('plansSaved', {}, summary).catch(() => {});
      setDraft(null);
      setStatus('saved');
    } catch (error) {
      console.error(error);
      setStatus('failed');
    }
  };

  const input = 'w-full h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 px-3 text-sm text-stone-900 dark:text-white';
  const card = 'rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-bg-card-dark p-5';
  const chip = 'inline-flex items-center gap-1.5 h-9 rounded-xl px-3 text-sm font-bold border border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-200 hover:bg-primary-light dark:hover:bg-white/10';

  return (
    <div className="space-y-4" data-testid="plans-editor">
      <div className={cn(card, 'sticky top-[7.5rem] z-20 flex flex-wrap items-center gap-3')}>
        <p className="text-sm text-stone-500 dark:text-stone-400 flex-1 min-w-[16rem]">{t.intro}</p>
        {dirty && <span className="text-xs font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">{t.unsaved}</span>}
        {status === 'saved' && !dirty && <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{t.saved}</span>}
        {status === 'failed' && <span className="text-sm font-semibold text-red-600 dark:text-red-400">{t.failed}</span>}
        <button type="button" onClick={() => { setDraft(null); setStatus('idle'); }} disabled={!dirty} className={cn(chip, !dirty && 'opacity-40')}><RotateCcw size={14} />{t.discard}</button>
        <button type="button" onClick={save} disabled={!dirty || status === 'saving'} data-testid="plans-save"
          className={cn('inline-flex items-center gap-1.5 h-9 rounded-xl px-4 text-sm font-black bg-primary text-white hover:bg-primary-hover dark:bg-white dark:text-stone-900', (!dirty || status === 'saving') && 'opacity-40')}>
          <Save size={15} />{status === 'saving' ? t.saving : t.save}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {ordered.map(([id, p]) => (
          <button key={id} type="button" role="tab" aria-selected={id === planId} onClick={() => setSelected(id)} data-testid={`plan-tab-${id}`}
            className={cn('inline-flex items-center gap-1.5 h-9 rounded-xl px-3 text-sm font-bold border',
              id === planId ? 'bg-primary text-white border-primary dark:bg-white/15 dark:border-white/20' : 'border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-200 hover:bg-primary-light dark:hover:bg-white/10')}>
            {!p.visible && <EyeOff size={13} className="opacity-70" />}{p.name[language]}
          </button>
        ))}
        <button type="button" onClick={addPlan} className={chip} data-testid="plan-add"><Plus size={14} />{t.newPlan}</button>
      </div>

      <section className={card}>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['name', 'price', 'description'] as const).map((field) => (
            <div key={field} className="space-y-1.5">
              <p className="text-xs font-black uppercase tracking-wider text-stone-400">{t[field]}</p>
              {LANGS.map((lang) => (
                <label key={lang} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-[10px] font-black uppercase text-stone-400">{lang}</span>
                  <input value={plan[field][lang]} onChange={(e) => setText(field, lang, e.target.value.slice(0, field === 'description' ? 120 : 40))}
                    aria-label={`${t[field]} · ${t.langs[lang]}`} placeholder={t.langs[lang]} className={input} data-testid={`plan-${field}-${lang}`} />
                </label>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPlan({ visible: !plan.visible })} className={chip}>{plan.visible ? <Eye size={14} /> : <EyeOff size={14} />}{plan.visible ? t.show : t.hidden}</button>
          <button type="button" onClick={() => setPlan({ highlight: !plan.highlight })} className={cn(chip, plan.highlight && 'border-primary text-primary dark:border-white dark:text-white')}><Star size={14} />{t.highlight}</button>
          <span className="text-xs font-semibold text-stone-400 ml-2">{t.order}</span>
          <button type="button" onClick={() => move(-1)} className={chip} aria-label="←"><ArrowLeft size={14} /></button>
          <button type="button" onClick={() => move(1)} className={chip} aria-label="→"><ArrowRight size={14} /></button>
          <span className="flex-1" />
          {PROTECTED.includes(planId)
            ? planId === 'free' && <span className="text-xs text-stone-400">{t.fixed}</span>
            : <button type="button" onClick={removePlan} className={cn(chip, 'text-red-600 dark:text-red-400 border-red-200 dark:border-red-900')}><Trash2 size={14} />{t.remove}</button>}
        </div>
      </section>

      <section className={card}>
        <h3 className="text-base font-black text-stone-900 dark:text-white">{t.tools}</h3>
        <p className="text-xs text-stone-400 mb-4">{t.newTool}</p>
        <div className="divide-y divide-stone-100 dark:divide-white/5">
          {TOOL_IDS.map((tool) => {
            const info = TOOLS[tool];
            const value = plan.limits[tool];
            return (
              <div key={tool} className="py-3 grid gap-3 lg:grid-cols-[14rem_1fr] items-center" data-testid={`limit-${tool}`}>
                <div>
                  <p className="font-black text-stone-900 dark:text-white">{info.name[language]}</p>
                  <p className="text-xs text-stone-400">{info.how[language]}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl border border-stone-200 dark:border-white/10 overflow-hidden">
                    {(['unlimited', 'limited', 'off'] as LimitMode[]).map((mode) => (
                      <button key={mode} type="button" onClick={() => setLimit(tool, { mode, amount: mode === 'limited' && value.amount <= 0 ? 1 : value.amount })}
                        aria-pressed={value.mode === mode} data-testid={`limit-${tool}-${mode}`}
                        className={cn('h-9 px-3 text-xs font-bold', value.mode === mode ? 'bg-primary text-white dark:bg-white dark:text-stone-900' : 'text-stone-600 dark:text-stone-300 hover:bg-primary-light dark:hover:bg-white/10')}>
                        {t.modes[mode]}
                      </button>
                    ))}
                  </div>
                  {value.mode === 'limited' && (
                    <>
                      <input type="number" min={1} max={100000} value={value.amount} data-testid={`limit-${tool}-amount`}
                        onChange={(e) => setLimit(tool, { amount: Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 1))) })}
                        aria-label={t.units[info.metric]} className={cn(input, 'w-24')} />
                      <span className="text-sm text-stone-500 dark:text-stone-400">{info.metric === 'minutes' ? t.units.minutes : info.many[language]}</span>
                      {info.metric !== 'total' && (
                        <select value={value.period} onChange={(e) => setLimit(tool, { period: e.target.value as Period })} data-testid={`limit-${tool}-period`}
                          className="h-9 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-2 text-sm text-stone-800 dark:text-stone-100">
                          {(['day', 'week', 'month'] as Period[]).map((p) => <option key={p} value={p}>{t.periods[p]}</option>)}
                        </select>
                      )}
                    </>
                  )}
                  <span className="text-sm font-semibold text-stone-700 dark:text-stone-200 lg:ml-auto">→ {describeLimit(tool, value, language)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={card}>
        <h3 className="text-base font-black text-stone-900 dark:text-white mb-4">{t.preview}</h3>
        <PlanCards config={config} language={language} compact />
      </section>
    </div>
  );
}

