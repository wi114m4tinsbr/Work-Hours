import { useState } from 'react';
import { ToolIdentity } from './ToolIdentity';
import { cn } from '../lib/utils';
import { FORMULA_ADMIN_FRAME, FORMULA_PUBLIC_FRAME } from '../lib/formulaSession';

const C = {
  pt: { back: 'Voltar', show: 'Mostrar na página inicial', on: 'Visível para todos', off: 'Oculta', fail: 'Não foi possível salvar.', wait: 'Preparando o acesso…' },
  en: { back: 'Back', show: 'Show on home page', on: 'Visible to everyone', off: 'Hidden', fail: 'Could not save.', wait: 'Preparing access…' },
  es: { back: 'Volver', show: 'Mostrar en la página de inicio', on: 'Visible para todos', off: 'Oculta', fail: 'No se pudo guardar.', wait: 'Preparando el acceso…' },
};

/**
 * Shift Hours frame around the standalone Fórmula Fácil pages. The tool HTML is loaded
 * untouched in a full-height iframe; only the bar with Voltar comes from the site.
 */
export function FormulaFacilView({ variant, language, onBack, inApp, ready = true, publicSwitch }: {
  variant: 'public' | 'admin';
  language: 'pt' | 'en' | 'es';
  onBack: () => void;
  /** Inside the signed-in app the site header (4rem) sits above this bar. */
  inApp: boolean;
  /** The admin frame waits until the owner's server session is in place. */
  ready?: boolean;
  /** Owner only: switch that opens the admin version to every visitor from the home page. */
  publicSwitch?: { enabled: boolean; onChange: (enabled: boolean) => Promise<void> };
}) {
  const t = C[language] || C.pt;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const title = variant === 'admin' ? 'Fórmula Fácil Admin' : 'Fórmula Fácil';

  const toggle = async () => {
    if (!publicSwitch || saving) return;
    setSaving(true);
    setError(false);
    try {
      await publicSwitch.onChange(!publicSwitch.enabled);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('flex flex-col w-full', inApp ? 'h-[calc(100dvh-4rem)]' : 'h-[100dvh]')} data-testid="formula-view">
      <div className="shrink-0 bg-white/95 dark:bg-bg-card-dark border-b border-stone-200 dark:border-white/10 shadow-sm">
        <div className="h-12 w-full max-w-7xl mx-auto flex items-center gap-3 px-4">
          <ToolIdentity title={title} language={language} backLabel={t.back} onBack={onBack} />
          {publicSwitch && (
            <div className="ml-auto flex items-center gap-2 min-w-0">
              {error && <span className="hidden sm:inline text-xs font-semibold text-red-500">{t.fail}</span>}
              <span className="hidden md:inline text-xs font-semibold text-stone-500 dark:text-stone-300 whitespace-nowrap">{t.show}</span>
              <button
                type="button"
                role="switch"
                aria-checked={publicSwitch.enabled}
                aria-label={t.show}
                disabled={saving}
                onClick={toggle}
                data-testid="formula-public-switch"
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  publicSwitch.enabled ? 'bg-primary' : 'bg-stone-300 dark:bg-white/20',
                  saving && 'opacity-60'
                )}
              >
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', publicSwitch.enabled ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
              <span className="text-[11px] font-black uppercase tracking-wide text-primary whitespace-nowrap">{publicSwitch.enabled ? t.on : t.off}</span>
            </div>
          )}
        </div>
      </div>
      {ready ? (
        <iframe
          title={title}
          src={variant === 'admin' ? FORMULA_ADMIN_FRAME : FORMULA_PUBLIC_FRAME}
          allow="microphone; display-capture; clipboard-write"
          className="flex-1 w-full border-0 bg-white"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm font-semibold text-stone-400">{t.wait}</div>
      )}
    </div>
  );
}
