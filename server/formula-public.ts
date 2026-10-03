import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  FIREBASE_PROJECT_ID,
  FORMULA_OWNER_EMAIL,
  USER_COOKIE,
  clearedSessionCookie,
  readCookie,
  sessionCookie,
  verifyUserToken,
  type UserSession,
} from './formula-auth.js';
import { FORMULA_CSP, FORMULA_PERMISSIONS, PRIVATE_HEADERS, notFound } from './formula-handler.js';
import { WINDOW_MS, effectivePlanId, normalizePlans, type ToolLimit } from '../src/lib/plans.js';

// Same named database as firebase-applet-config.json.
const FIRESTORE_DATABASE = 'ai-studio-df43dc48-1bac-453f-8185-49b595d5483a';

export type PublicAccess = 'admin' | 'premium' | 'free' | 'blocked';

export interface AccountState {
  access: PublicAccess;
  /** Limited plans only: the plan's Fórmula Fácil limit and the window stored in quota/{email}. */
  formula?: { start: number | null; used: number; exhaustedAt: number | null; limit?: ToolLimit };
}

export interface PublicDeps {
  verify: (token: string | undefined) => Promise<UserSession | null>;
  /** Reads the account with the user's own token, so the Firestore rules still apply. */
  loadAccount: (session: UserSession, token: string) => Promise<AccountState | null>;
  loadHtml: () => Promise<Uint8Array | null>;
}

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
};

/** Firestore REST value to plain JSON (timestamps become milliseconds). */
export function plain(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return Date.parse(value.timestampValue!);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue?.fields ?? {}).map(([k, v]) => [k, plain(v)]));
  if ('arrayValue' in value) return (value.arrayValue?.values ?? []).map(plain);
  return null;
}

const ms = (value?: FirestoreValue) => (value?.timestampValue ? Date.parse(value.timestampValue) : null);
const num = (value?: FirestoreValue) => Number(value?.integerValue ?? value?.doubleValue ?? 0) || 0;

async function readDocument(path: string, token: string): Promise<Record<string, FirestoreValue> | null | undefined> {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE}/documents/${path}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  if (!response.ok) return undefined;
  const data = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  return data.fields ?? {};
}

async function loadAccountFromFirestore(session: UserSession, token: string): Promise<AccountState | null> {
  if (session.email === FORMULA_OWNER_EMAIL && session.provider === 'google.com') return { access: 'admin' };
  const email = session.email.toLowerCase();
  const [user, quota, plans] = await Promise.all([
    readDocument(`users/${encodeURIComponent(session.uid)}`, token),
    readDocument(`quota/${encodeURIComponent(email)}`, token),
    readDocument('settings/plans', token),
  ]);
  if (user === undefined || quota === undefined || plans === undefined) return null;

  const status = user?.status?.stringValue;
  if (status === 'blocked' || status === 'banned') return { access: 'blocked' };

  // Same plan rule as the app and firestore.rules, with the limits the owner set in the admin panel.
  const config = normalizePlans(plans ? { plans: plain(plans.plans) } : null);
  const subscription = plain(user?.subscription) as { type?: unknown; plan?: unknown; expiryDate?: number } | undefined;
  const limit = config.plans[effectivePlanId(subscription, config)].limits.formula;
  if (limit.mode === 'unlimited') return { access: 'premium' };

  return {
    access: 'free',
    formula: { start: ms(quota?.formulaStart), used: num(quota?.formulaUsed), exhaustedAt: ms(quota?.formulaExhaustedAt), limit },
  };
}

async function loadBundledHtml(): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(join(process.cwd(), 'server/assets/formula-facil.html')));
  } catch {
    return null;
  }
}

const defaultDeps: PublicDeps = {
  verify: (token) => verifyUserToken(token),
  loadAccount: loadAccountFromFirestore,
  loadHtml: loadBundledHtml,
};

/** Same rule as the app and the Firestore rules: locked for one window once the minutes run out. */
export function formulaLocked(state: AccountState, now = Date.now()): boolean {
  if (state.access !== 'free' || !state.formula) return false;
  const { start, used, exhaustedAt } = state.formula;
  const limit = state.formula.limit ?? { mode: 'limited', amount: 15, period: 'day' };
  if (limit.mode === 'unlimited') return false;
  if (limit.mode === 'off' || limit.amount <= 0) return true;
  const span = WINDOW_MS[limit.period];
  if (exhaustedAt !== null) return now < exhaustedAt + span;
  return start !== null && now < start + span && used >= limit.amount * 60;
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function text(status: number, body: string): Response {
  return new Response(body, { status, headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** POST: store any verified user's token in an HttpOnly cookie. DELETE: clear it. */
export async function handleUserSession(request: Request, deps: PublicDeps = defaultDeps): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return notFound();
  if (request.method === 'DELETE') return json(200, { ok: true }, { 'Set-Cookie': clearedSessionCookie(USER_COOKIE) });
  if (request.method !== 'POST') return notFound();

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  const session = await deps.verify(token);
  if (!session) return json(401, { ok: false }, { 'Set-Cookie': clearedSessionCookie(USER_COOKIE) });
  const maxAge = session.expiresAt - Math.floor(Date.now() / 1000);
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(token!, maxAge, USER_COOKIE) });
}

/**
 * GET/HEAD: the common Fórmula Fácil, only for signed-in accounts that still have time today.
 * The file is no longer public, so opening it directly does not skip the limit.
 */
export async function handlePublicPage(request: Request, deps: PublicDeps = defaultDeps): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();

  const token = readCookie(request.headers.get('cookie'), USER_COOKIE);
  const session = token ? await deps.verify(token) : null;
  if (!session) {
    const response = text(401, 'Entre na sua conta para usar a Fórmula Fácil.');
    if (token) response.headers.set('Set-Cookie', clearedSessionCookie(USER_COOKIE));
    return response;
  }

  let state: AccountState | null = null;
  try {
    state = await deps.loadAccount(session, token!);
  } catch {
    state = null;
  }
  if (!state) return text(503, 'Não foi possível verificar o seu plano agora. Tente de novo.');
  if (state.access === 'blocked') return text(403, 'Conta bloqueada.');
  if (formulaLocked(state)) return text(429, 'Limite diário atingido · plano grátis.');

  const html = await deps.loadHtml();
  if (!html) return text(503, 'Fórmula Fácil indisponível.');

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': FORMULA_CSP,
      'Permissions-Policy': FORMULA_PERMISSIONS,
      'Content-Length': String(html.byteLength),
      Vary: 'Cookie',
    },
  });
}
