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
  const anonymous = await handleAdminPage(page(), deps(ADMIN_HTML, state));
  assert.equal(anonymous.status, 200);
  assert.deepEqual(new Uint8Array(await anonymous.arrayBuffer()), ADMIN_HTML);
  assert.equal(anonymous.headers.get('cache-control'), 'private, no-store');

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
