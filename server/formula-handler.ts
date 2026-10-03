import {
  FORMULA_COOKIE,
  clearedSessionCookie,
  readCookie,
  sessionCookie,
  verifyOwnerToken,
  type OwnerSession,
} from './formula-auth.js';

// The assistant runs fully in the browser and talks straight to Gemini with inline code.
export const FORMULA_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://generativelanguage.googleapis.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export const FORMULA_PERMISSIONS = 'microphone=(self), display-capture=(self), clipboard-write=(self)';

export const PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export interface FormulaDeps {
  verify: (token: string | undefined) => Promise<OwnerSession | null>;
  loadAdminHtml: () => Promise<Uint8Array | null>;
}

export const ADMIN_BLOB_PATH = process.env.FORMULA_ADMIN_BLOB_PATH || 'formula-facil-admin.html';

async function loadFromPrivateBlob(): Promise<Uint8Array | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return null;
  const { get } = await import('@vercel/blob');
  const result = await get(ADMIN_BLOB_PATH, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}

const defaultDeps: FormulaDeps = {
  verify: (token) => verifyOwnerToken(token),
  loadAdminHtml: loadFromPrivateBlob,
};

export function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

/** POST: store a verified owner token in an HttpOnly cookie. DELETE: clear it. */
export async function handleSession(request: Request, deps: FormulaDeps = defaultDeps): Promise<Response> {
  if (!sameOrigin(request)) return notFound();
  if (request.method === 'DELETE') {
    return json(200, { ok: true }, { 'Set-Cookie': clearedSessionCookie() });
  }
  if (request.method !== 'POST') return notFound();

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  const session = await deps.verify(token);
  if (!session) return json(404, { ok: false }, { 'Set-Cookie': clearedSessionCookie() });

  const maxAge = session.expiresAt - Math.floor(Date.now() / 1000);
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(token!, maxAge) });
}

/** GET/HEAD /admin/formula-facil: the private HTML only after server-side validation. */
export async function handleAdminPage(request: Request, deps: FormulaDeps = defaultDeps): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();

  const token = readCookie(request.headers.get('cookie'), FORMULA_COOKIE);
  if (!token) {
    // Not signed in on the server yet: the app signs the owner in and comes back here.
    return new Response(null, {
      status: 302,
      headers: { ...PRIVATE_HEADERS, Location: '/?abrir=formula-admin' },
    });
  }

  const session = await deps.verify(token);
  if (!session) {
    const response = notFound();
    response.headers.set('Set-Cookie', clearedSessionCookie());
    return response;
  }

  let html: Uint8Array | null = null;
  try {
    html = await deps.loadAdminHtml();
  } catch {
    html = null;
  }
  if (!html) {
    return new Response('Fórmula Fácil (admin) ainda não foi enviada ao armazenamento privado.', {
      status: 503,
      headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

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
