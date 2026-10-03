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

// Same named database as firebase-applet-config.json.
const FIRESTORE_DATABASE = 'ai-studio-df43dc48-1bac-453f-8185-49b595d5483a';
const LOCK_MS = 24 * 60 * 60 * 1000;
const FREE_SECONDS = 15 * 60;

export type PublicAccess = 'admin' | 'premium' | 'free' | 'blocked';

export interface AccountState {
  access: PublicAccess;
  /** Free accounts only: the Fórmula Fácil window, as stored in quota/{email}. */
  formula?: { start: number | null; used: number; exhaustedAt: number | null };
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
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

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
  const [user, quota] = await Promise.all([
    readDocument(`users/${encodeURIComponent(session.uid)}`, token),
    readDocument(`quota/${encodeURIComponent(email)}`, token),
  ]);
  if (user === undefined || quota === undefined) return null;

  const status = user?.status?.stringValue;
  if (status === 'blocked' || status === 'banned') return { access: 'blocked' };

  const subscription = user?.subscription?.mapValue?.fields;
  const expiry = ms(subscription?.expiryDate);
  if (subscription?.type?.stringValue === 'monthly' && (expiry === null || expiry > Date.now())) return { access: 'premium' };

  return {
    access: 'free',
    formula: { start: ms(quota?.formulaStart), used: num(quota?.formulaUsed), exhaustedAt: ms(quota?.formulaExhaustedAt) },
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

/** Same rule as the app and the Firestore rules: locked for 24 h once the 15 minutes run out. */
export function formulaLocked(state: AccountState, now = Date.now()): boolean {
  if (state.access !== 'free' || !state.formula) return false;
  const { start, used, exhaustedAt } = state.formula;
  if (exhaustedAt !== null) return now < exhaustedAt + LOCK_MS;
  return start !== null && now < start + LOCK_MS && used >= FREE_SECONDS;
}

/** Signed-in, active account whose Fórmula Fácil time is not used up (Premium and the owner always). */
export async function visitorAllowed(request: Request, deps: PublicDeps = defaultDeps): Promise<boolean> {
  const token = readCookie(request.headers.get('cookie'), USER_COOKIE);
  const session = token ? await deps.verify(token) : null;
  if (!session) return false;
  try {
    const state = await deps.loadAccount(session, token!);
    return !!state && state.access !== 'blocked' && !formulaLocked(state);
  } catch {
    return false;
  }
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
