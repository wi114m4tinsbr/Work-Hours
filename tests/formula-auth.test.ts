import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTPayload } from 'jose';
import { FIREBASE_PROJECT_ID, FORMULA_COOKIE, FORMULA_OWNER_EMAIL, verifyOwnerToken } from '../server/formula-auth.ts';
import { handleAdminPage, handleSession, handleVisibility, type FormulaDeps } from '../server/formula-handler.ts';

const ORIGIN = 'https://work-hours.example';
const ADMIN_HTML = new TextEncoder().encode('<!doctype html><title>admin</title><script>const CHAVE_FIXA = "";</script>');

const trusted = await generateKeyPair('RS256');
const stranger = await generateKeyPair('RS256');
const trustedJwk = { ...(await exportJWK(trusted.publicKey)), kid: 'trusted', alg: 'RS256' };
const keys = createLocalJWKSet({ keys: [trustedJwk] });

async function token(overrides: JWTPayload = {}, options: { key?: CryptoKey; kid?: string; exp?: number; project?: string } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const project = options.project ?? FIREBASE_PROJECT_ID;
  return new SignJWT({
    email: FORMULA_OWNER_EMAIL,
    email_verified: true,
    auth_time: now - 60,
    firebase: { sign_in_provider: 'google.com' },
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: options.kid ?? 'trusted' })
    .setIssuer(`https://securetoken.google.com/${project}`)
    .setAudience(project)
    .setSubject('owner-uid')
    .setIssuedAt(now - 60)
    .setExpirationTime(options.exp ?? now + 3600)
    .sign(options.key ?? trusted.privateKey);
}

const deps = (html: Uint8Array | null = ADMIN_HTML, state = { public: false }): FormulaDeps => ({
  verify: (value) => verifyOwnerToken(value, keys),
  loadAdminHtml: async () => html,
  isPublic: async () => state.public,
  setPublic: async (enabled) => { state.public = enabled; },
});

const page = (cookie?: string, method = 'GET') =>
  new Request(`${ORIGIN}/admin/formula-facil`, { method, headers: cookie ? { cookie: `${FORMULA_COOKIE}=${cookie}` } : {} });

test('accepts only the owner signed in with Google on the right project', async () => {
  assert.ok(await verifyOwnerToken(await token(), keys));
  const rejected = {
    'other email': await token({ email: 'someone@gmail.com' }),
    'similar email': await token({ email: 'MartinsWilliam2004@gmail.com' }),
    'unverified email': await token({ email_verified: false }),
    'password provider': await token({ firebase: { sign_in_provider: 'password' } }),
    'expired': await token({}, { exp: Math.floor(Date.now() / 1000) - 10 }),
    'other project': await token({}, { project: 'another-project' }),
    'forged signature': await token({}, { key: stranger.privateKey }),
    'unknown key id': await token({}, { kid: 'nope' }),
  };
  for (const [label, value] of Object.entries(rejected)) {
    assert.equal(await verifyOwnerToken(value, keys), null, label);
  }
  assert.equal(await verifyOwnerToken('not-a-jwt', keys), null);
  assert.equal(await verifyOwnerToken(undefined, keys), null);
  const unsigned = (await token()).split('.').slice(0, 2).join('.') + '.';
  assert.equal(await verifyOwnerToken(unsigned, keys), null);
});

test('visitor without login never receives the admin HTML while it is switched off', async () => {
  const response = await handleAdminPage(page(), deps());
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.doesNotMatch(await response.text(), /CHAVE_FIXA/);
});

test('only the owner switches the admin version on for everyone, and it starts off', async () => {
  const state = { public: false };
  const post = async (body: unknown, bearer?: string, origin = ORIGIN) =>
    handleVisibility(new Request(`${ORIGIN}/api/formula-visibility`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    }), deps(ADMIN_HTML, state));
  const read = async () => (await handleVisibility(new Request(`${ORIGIN}/api/formula-visibility`), deps(ADMIN_HTML, state))).json();

  assert.deepEqual(await read(), { public: false });
  assert.equal((await post({ public: true })).status, 404, 'no login');
  assert.equal((await post({ public: true }, await token({ email: 'someone@gmail.com' }))).status, 404, 'other account');
  assert.equal((await post({ public: true }, await token({}, { key: stranger.privateKey }))).status, 404, 'forged');
  assert.equal((await post({ public: true }, await token(), 'https://evil.example')).status, 404, 'cross site');
  assert.equal((await post({ public: 'yes' }, await token())).status, 400);
  assert.equal(state.public, false);

  assert.equal((await post({ public: true }, await token())).status, 200);
  assert.deepEqual(await read(), { public: true });
  // Switched on: anyone, without login and without limit.
  const visitor = await handleAdminPage(page(), deps(ADMIN_HTML, state));
  assert.equal(visitor.status, 200);
  assert.deepEqual(new Uint8Array(await visitor.arrayBuffer()), ADMIN_HTML);
  assert.equal(visitor.headers.get('cache-control'), 'private, no-store');

  assert.equal((await post({ public: false }, await token())).status, 200);
  assert.equal((await handleAdminPage(page(), deps(ADMIN_HTML, state))).status, 404);
});

test('another account, fake or expired cookie gets 404 and the cookie is cleared', async () => {
  for (const cookie of [
    await token({ email: 'someone@gmail.com' }),
    await token({}, { exp: Math.floor(Date.now() / 1000) - 10 }),
    await token({}, { key: stranger.privateKey }),
    'garbage',
  ]) {
    const response = await handleAdminPage(page(cookie), deps());
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/);
    assert.doesNotMatch(await response.text(), /CHAVE_FIXA/);
  }
});

test('owner receives the exact private bytes with private headers', async () => {
  const response = await handleAdminPage(page(await token()), deps());
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), ADMIN_HTML);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  const csp = response.headers.get('content-security-policy') ?? '';
  for (const directive of [
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://generativelanguage.googleapis.com",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
  ]) assert.ok(csp.includes(directive), directive);
  const permissions = response.headers.get('permissions-policy') ?? '';
  for (const feature of ['microphone=(self)', 'display-capture=(self)', 'clipboard-write=(self)']) assert.ok(permissions.includes(feature));

  const head = await handleAdminPage(page(await token(), 'HEAD'), deps());
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('owner without storage configured gets 503, not a public fallback', async () => {
  const response = await handleAdminPage(page(await token()), deps(null));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('session endpoint sets and clears an HttpOnly cookie for the owner only', async () => {
  const post = (bearer: string, origin = ORIGIN) =>
    new Request(`${ORIGIN}/api/formula-session`, { method: 'POST', headers: { origin, authorization: `Bearer ${bearer}` } });

  const owner = await handleSession(post(await token()), deps());
  assert.equal(owner.status, 200);
  const cookie = owner.headers.get('set-cookie') ?? '';
  assert.match(cookie, new RegExp(`^${FORMULA_COOKIE}=`));
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag), flag);
  assert.ok(!cookie.includes('Domain='));

  const other = await handleSession(post(await token({ email: 'someone@gmail.com' })), deps());
  assert.equal(other.status, 404);
  assert.match(other.headers.get('set-cookie') ?? '', /Max-Age=0/);

  const crossSite = await handleSession(post(await token(), 'https://evil.example'), deps());
  assert.equal(crossSite.status, 404);
  assert.equal(crossSite.headers.get('set-cookie'), null);

  const logout = await handleSession(new Request(`${ORIGIN}/api/formula-session`, { method: 'DELETE', headers: { origin: ORIGIN } }), deps());
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') ?? '', /Max-Age=0/);
  // After logout the browser drops the cookie, so the next visit is unauthenticated.
  assert.equal((await handleAdminPage(page(), deps())).status, 404);
});

test('admin HTML is never shipped with the public site', () => {
  assert.equal(existsSync('public/formula-facil-admin.html'), false);
  const scan = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? scan(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
  // dist also carries the Firebase web config, whose key is public by design, so only public/ is scanned for keys.
  for (const file of scan('public')) {
    assert.ok(!/formula-facil-admin/i.test(file), file);
    if (/\.(html|js)$/.test(file)) assert.doesNotMatch(readFileSync(file, 'latin1'), /AIza[0-9A-Za-z_-]{30,}/, `${file} has a Google key`);
  }
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const direct = vercel.rewrites.find((rule: { source: string }) => rule.source === '/formula-facil-admin(.*)');
  assert.equal(direct.destination, '/api/not-found');
  assert.ok(existsSync('api/formula-admin.ts'));
});

test('common Fórmula Fácil is served only to signed-in accounts with time left', async () => {
  const { handlePublicPage, handleUserSession } = await import('../server/formula-public.ts');
  const { USER_COOKIE, verifyUserToken } = await import('../server/formula-auth.ts');
  const html = new TextEncoder().encode('<!doctype html><title>formula</title>');
  const now = Date.now();
  let state: import('../server/formula-public.ts').AccountState | null = { access: 'free', formula: { start: now - 600e3, used: 300, exhaustedAt: null } };
  const publicDeps = {
    verify: (value: string | undefined) => verifyUserToken(value, keys),
    loadAccount: async () => state,
    loadHtml: async () => html,
  };
  const visit = (cookie?: string) =>
    handlePublicPage(new Request(`${ORIGIN}/api/formula-public`, { headers: cookie ? { cookie: `${USER_COOKIE}=${cookie}` } : {} }), publicDeps);
  const user = await token({ email: 'someone@gmail.com' });

  assert.equal((await visit()).status, 401);
  assert.equal((await visit(await token({ email: 'someone@gmail.com' }, { key: stranger.privateKey }))).status, 401);
  assert.equal((await visit(await token({ email: 'someone@gmail.com', email_verified: false }))).status, 401);

  const ok = await visit(user);
  assert.equal(ok.status, 200);
  assert.deepEqual(new Uint8Array(await ok.arrayBuffer()), html);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');

  state = { access: 'free', formula: { start: now - 3600e3, used: 900, exhaustedAt: now - 60e3 } };
  assert.equal((await visit(user)).status, 429);
  state = { access: 'premium' };
  assert.equal((await visit(user)).status, 200);
  state = { access: 'blocked' };
  assert.equal((await visit(user)).status, 403);
  state = null;
  assert.equal((await visit(user)).status, 503);

  const login = await handleUserSession(new Request(`${ORIGIN}/api/user-session`, { method: 'POST', headers: { origin: ORIGIN, authorization: `Bearer ${user}` } }), publicDeps);
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie') ?? '', /^__Host-shift-user=.+HttpOnly; Secure; SameSite=Strict$/);
  const crossSite = await handleUserSession(new Request(`${ORIGIN}/api/user-session`, { method: 'POST', headers: { origin: 'https://evil.example', authorization: `Bearer ${user}` } }), publicDeps);
  assert.equal(crossSite.status, 404);

  // The raw file is no longer a public static file.
  assert.equal(existsSync('public/formula-facil.html'), false);
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.equal(vercel.rewrites.find((rule: { source: string }) => rule.source === '/formula-facil.html').destination, '/api/not-found');
});

test('project report and prompt are for the owner only and end with the latest pushes', async () => {
  const { handleAdminReport, buildPrompt } = await import('../server/admin-report.ts');
  const commits = [{ sha: 'abc1234', at: '2026-10-03T08:21:11Z', author: 'Claude', message: 'Latest change' }];
  const reportDeps = {
    verify: (value: string | undefined) => verifyOwnerToken(value, keys),
    loadMilestones: async () => [{ at: '2026-03-17T05:01:20Z', kind: 'new', title: 'Início', details: '' }],
    loadPrompt: async () => '# Contexto',
    loadCommits: async () => commits,
    branch: () => 'feature/free-plan-job-limit',
  };
  const ask = (bearer?: string) => handleAdminReport(new Request(`${ORIGIN}/api/admin-report`, { headers: bearer ? { authorization: `Bearer ${bearer}` } : {} }), reportDeps);
  assert.equal((await ask()).status, 404);
  assert.equal((await ask(await token({ email: 'someone@gmail.com' }))).status, 404);
  const ok = await ask(await token());
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'private, no-store');
  const body = await ok.json();
  assert.equal(body.milestones.length, 1);
  assert.equal(body.commits[0].sha, 'abc1234');
  assert.match(body.prompt, /^# Contexto[\s\S]*abc1234 · Latest change/);
  assert.match(buildPrompt('# X', 'main', null), /Não foi possível/);

  // The real files exist, parse, and carry no keys.
  const report = JSON.parse(readFileSync('server/assets/project-report.json', 'utf8'));
  assert.ok(report.milestones.length > 10);
  for (const file of ['server/assets/project-report.json', 'server/assets/project-prompt.md', 'src/data/updates.ts']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /AIza[0-9A-Za-z_-]{30,}|CHAVE_FIXA\s*=|ghp_|sk-/, file);
  }
});
