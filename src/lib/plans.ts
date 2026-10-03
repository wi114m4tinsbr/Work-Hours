/**
 * Plans and tool limits, edited by the owner in the admin panel (Firestore `settings/plans`)
 * and read live by the app, the server and the Firestore rules. No Firebase import here so
 * the server and the tests can use it too.
 */
export type Lang = 'pt' | 'en' | 'es';
export type Text = Record<Lang, string>;
export type ToolId = 'invoice' | 'pdf' | 'formula' | 'jobs';
export type Period = 'day' | 'week' | 'month';
export type LimitMode = 'unlimited' | 'limited' | 'off';

export interface ToolLimit {
  mode: LimitMode;
  amount: number;
  period: Period;
}

export interface Plan {
  name: Text;
  description: Text;
  price: Text;
  /** Shown in the Upgrade window. */
  visible: boolean;
  /** Highlighted card in the Upgrade window. */
  highlight: boolean;
  order: number;
  limits: Record<ToolId, ToolLimit>;
}

export interface PlansConfig {
  plans: Record<string, Plan>;
}

/**
 * Every tool the site has. A new tool only needs an entry here: it then shows up in the admin
 * panel, the Upgrade window and the usage badges with its own limits per plan.
 *  - count: uses per period (counted on download or share)
 *  - minutes: minutes of use per period
 *  - total: how many can exist at once (no period)
 */
export const TOOLS: Record<ToolId, { metric: 'count' | 'minutes' | 'total'; name: Text; one: Text; many: Text; how: Text }> = {
  jobs: {
    metric: 'total',
    name: { pt: 'Trabalhos/empresas', en: 'Jobs/companies', es: 'Trabajos/empresas' },
    one: { pt: 'trabalho/empresa', en: 'job/company', es: 'trabajo/empresa' },
    many: { pt: 'trabalhos/empresas', en: 'jobs/companies', es: 'trabajos/empresas' },
    how: { pt: 'cadastrados ao mesmo tempo', en: 'at the same time', es: 'al mismo tiempo' },
  },
  invoice: {
    metric: 'count',
    name: { pt: 'Faturas', en: 'Invoices', es: 'Facturas' },
    one: { pt: 'fatura', en: 'invoice', es: 'factura' },
    many: { pt: 'faturas', en: 'invoices', es: 'facturas' },
    how: { pt: 'conta ao baixar ou compartilhar', en: 'counted on download or share', es: 'cuenta al descargar o compartir' },
  },
  pdf: {
    metric: 'count',
    name: { pt: 'PDF Studio', en: 'PDF Studio', es: 'PDF Studio' },
    one: { pt: 'arquivo PDF', en: 'PDF file', es: 'archivo PDF' },
    many: { pt: 'arquivos PDF', en: 'PDF files', es: 'archivos PDF' },
    how: { pt: 'conta ao baixar', en: 'counted on download', es: 'cuenta al descargar' },
  },
  formula: {
    metric: 'minutes',
    name: { pt: 'Fórmula Fácil', en: 'Fórmula Fácil', es: 'Fórmula Fácil' },
    one: { pt: 'minuto de Fórmula Fácil', en: 'minute of Fórmula Fácil', es: 'minuto de Fórmula Fácil' },
    many: { pt: 'minutos de Fórmula Fácil', en: 'minutes of Fórmula Fácil', es: 'minutos de Fórmula Fácil' },
    how: { pt: 'tempo com a ferramenta aberta', en: 'time with the tool open', es: 'tiempo con la herramienta abierta' },
  },
};

export const TOOL_IDS = Object.keys(TOOLS) as ToolId[];

const UNLIMITED: ToolLimit = { mode: 'unlimited', amount: 0, period: 'day' };

/** Same values the Firestore rules fall back to when the owner has not saved any plan yet. */
export const DEFAULT_PLANS: PlansConfig = {
  plans: {
    free: {
      name: { pt: 'Grátis', en: 'Free', es: 'Gratis' },
      description: { pt: 'Para começar.', en: 'To get started.', es: 'Para empezar.' },
      price: { pt: '€0', en: '€0', es: '€0' },
      visible: true,
      highlight: false,
      order: 0,
      limits: {
        jobs: { mode: 'limited', amount: 1, period: 'day' },
        invoice: { mode: 'limited', amount: 1, period: 'day' },
        pdf: { mode: 'limited', amount: 1, period: 'day' },
        formula: { mode: 'limited', amount: 15, period: 'day' },
      },
    },
    premium: {
      name: { pt: 'Premium', en: 'Premium', es: 'Premium' },
      description: { pt: 'Tudo ilimitado.', en: 'Everything unlimited.', es: 'Todo ilimitado.' },
      price: { pt: 'Em breve', en: 'Coming soon', es: 'Próximamente' },
      visible: true,
      highlight: true,
      order: 1,
      limits: { jobs: UNLIMITED, invoice: UNLIMITED, pdf: UNLIMITED, formula: UNLIMITED },
    },
  },
};

const PERIODS: Period[] = ['day', 'week', 'month'];
const MODES: LimitMode[] = ['unlimited', 'limited', 'off'];

const text = (value: unknown, fallback: Text): Text => {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Text>;
  const pt = typeof v.pt === 'string' ? v.pt : fallback.pt;
  return { pt, en: typeof v.en === 'string' && v.en ? v.en : pt || fallback.en, es: typeof v.es === 'string' && v.es ? v.es : pt || fallback.es };
};

function limit(value: unknown, fallback: ToolLimit): ToolLimit {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<ToolLimit>;
  return {
    mode: MODES.includes(v.mode as LimitMode) ? (v.mode as LimitMode) : fallback.mode,
    amount: typeof v.amount === 'number' && Number.isFinite(v.amount) && v.amount >= 0 ? Math.floor(v.amount) : fallback.amount,
    period: PERIODS.includes(v.period as Period) ? (v.period as Period) : fallback.period,
  };
}

/** Fills anything missing (new tools, new plans, old data) so the rest of the app never guesses. */
export function normalizePlans(raw: unknown): PlansConfig {
  const source = (raw && typeof raw === 'object' && (raw as PlansConfig).plans && typeof (raw as PlansConfig).plans === 'object')
    ? (raw as PlansConfig).plans : {};
  const plans: Record<string, Plan> = {};
  const ids = new Set([...Object.keys(DEFAULT_PLANS.plans), ...Object.keys(source)]);
  for (const id of ids) {
    const base = DEFAULT_PLANS.plans[id] ?? { ...DEFAULT_PLANS.plans.premium, visible: false, highlight: false, order: 10 };
    const p = (source[id] ?? {}) as Partial<Plan>;
    const limits = {} as Record<ToolId, ToolLimit>;
    for (const tool of TOOL_IDS) limits[tool] = limit(p.limits?.[tool], base.limits[tool]);
    plans[id] = {
      name: text(p.name, base.name),
      description: text(p.description, base.description),
      price: text(p.price, base.price),
      visible: typeof p.visible === 'boolean' ? p.visible : base.visible,
      highlight: typeof p.highlight === 'boolean' ? p.highlight : base.highlight,
      order: typeof p.order === 'number' ? p.order : base.order,
      limits,
    };
  }
  return { plans };
}

export const sortedPlans = (config: PlansConfig) =>
  Object.entries(config.plans).sort(([a, x], [b, y]) => x.order - y.order || a.localeCompare(b));

type TimestampLike = { toMillis: () => number } | number | null | undefined;
const millis = (v: TimestampLike) => (typeof v === 'number' ? v : v && typeof v.toMillis === 'function' ? v.toMillis() : null);

/** Which plan an account is on: a paid plan while it has not expired, otherwise Grátis. Same rule as firestore.rules. */
export function effectivePlanId(subscription: { type?: unknown; plan?: unknown; expiryDate?: TimestampLike } | undefined, config: PlansConfig, now = Date.now()): string {
  if (subscription?.type !== 'monthly') return 'free';
  const expiry = millis(subscription.expiryDate);
  if (expiry !== null && expiry <= now) return 'free';
  const id = typeof subscription.plan === 'string' && subscription.plan ? subscription.plan : 'premium';
  return config.plans[id] ? id : 'free';
}

/** Calendar period key in the account's time zone, the same way the Firestore rules compute it. */
export function periodKey(ms: number, tz: number, period: Period): number {
  const local = ms + tz * 60000;
  const d = new Date(local);
  if (period === 'month') return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
  // Weeks start on Monday (1970-01-01 was a Thursday).
  if (period === 'week') return Math.floor((local + 3 * 86400000) / 604800000);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export const WINDOW_MS: Record<Period, number> = { day: 86400000, week: 7 * 86400000, month: 30 * 86400000 };

const PER: Record<Lang, Record<Period, string>> = {
  pt: { day: 'por dia', week: 'por semana', month: 'por mês' },
  en: { day: 'per day', week: 'per week', month: 'per month' },
  es: { day: 'por día', week: 'por semana', month: 'por mes' },
};
const NOW: Record<Lang, Record<Period, string>> = {
  pt: { day: 'hoje', week: 'esta semana', month: 'este mês' },
  en: { day: 'today', week: 'this week', month: 'this month' },
  es: { day: 'hoy', week: 'esta semana', month: 'este mes' },
};
const WORDS = {
  pt: { unlimited: 'ilimitado', off: 'Não incluído', available: (n: number) => (n === 1 ? 'disponível' : 'disponíveis') },
  en: { unlimited: 'unlimited', off: 'Not included', available: () => 'available' },
  es: { unlimited: 'ilimitado', off: 'No incluido', available: (n: number) => (n === 1 ? 'disponible' : 'disponibles') },
};

/** One line for the Upgrade window, e.g. "1 fatura por dia" or "Fórmula Fácil: ilimitado". */
export function describeLimit(tool: ToolId, value: ToolLimit, lang: Lang): string {
  const info = TOOLS[tool];
  if (value.mode === 'unlimited') return `${info.name[lang]}: ${WORDS[lang].unlimited}`;
  if (value.mode === 'off' || value.amount <= 0) return `${info.name[lang]}: ${WORDS[lang].off.toLowerCase()}`;
  const unit = value.amount === 1 ? info.one[lang] : info.many[lang];
  return info.metric === 'total' ? `${value.amount} ${unit}` : `${value.amount} ${unit} ${PER[lang][value.period]}`;
}

/** What is still available, for the green usage badge, e.g. "2 faturas disponíveis esta semana". */
export function availableText(tool: ToolId, remaining: number, value: ToolLimit, lang: Lang): string {
  const info = TOOLS[tool];
  if (info.metric === 'minutes') return `${NOW[lang][value.period]}`;
  const unit = remaining === 1 ? info.one[lang] : info.many[lang];
  return `${remaining} ${unit} ${WORDS[lang].available(remaining)} ${NOW[lang][value.period]}`;
}

export const reachedLabel: Record<Lang, Record<Period, string>> = {
  pt: { day: 'Limite diário atingido', week: 'Limite semanal atingido', month: 'Limite mensal atingido' },
  en: { day: 'Daily limit reached', week: 'Weekly limit reached', month: 'Monthly limit reached' },
  es: { day: 'Límite diario alcanzado', week: 'Límite semanal alcanzado', month: 'Límite mensual alcanzado' },
};

const NEXT: Record<Lang, Record<Period, string>> = {
  pt: { day: 'amanhã', week: 'na próxima semana', month: 'no próximo mês' },
  en: { day: 'tomorrow', week: 'next week', month: 'next month' },
  es: { day: 'mañana', week: 'la próxima semana', month: 'el próximo mes' },
};

/** Title and message of the notice shown when a limited plan runs out or does not include a tool. */
export function limitNotice(tool: ToolId, value: ToolLimit, planName: string, lang: Lang): { title: string; message: string } {
  const name = TOOLS[tool].name[lang];
  if (value.mode === 'off' || value.amount <= 0) {
    return {
      pt: { title: 'Não incluído no seu plano', message: `${name} não faz parte do plano ${planName}. Clique em Upgrade para ver os planos.` },
      en: { title: 'Not included in your plan', message: `${name} is not part of the ${planName} plan. Click Upgrade to see the plans.` },
      es: { title: 'No incluido en tu plan', message: `${name} no forma parte del plan ${planName}. Haz clic en Upgrade para ver los planes.` },
    }[lang];
  }
  const rule = describeLimit(tool, value, lang);
  return {
    pt: { title: reachedLabel.pt[value.period], message: `O plano ${planName} inclui ${rule} (${TOOLS[tool].how.pt}). Libera de novo ${NEXT.pt[value.period]}, ou na hora com um plano maior.` },
    en: { title: reachedLabel.en[value.period], message: `The ${planName} plan includes ${rule} (${TOOLS[tool].how.en}). It opens again ${NEXT.en[value.period]}, or right away with a bigger plan.` },
    es: { title: reachedLabel.es[value.period], message: `El plan ${planName} incluye ${rule} (${TOOLS[tool].how.es}). Vuelve ${NEXT.es[value.period]}, o al instante con un plan mayor.` },
  }[lang];
}
