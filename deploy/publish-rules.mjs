// Publishes firestore.rules to the named Firestore database through the Firebase Rules API.
// Only needs the "Firebase Rules Admin" role on the service account (no Service Usage permission).
// Usage: GOOGLE_APPLICATION_CREDENTIALS=key.json node deploy/publish-rules.mjs
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PROJECT = 'gen-lang-client-0275590292';
const DATABASE = 'ai-studio-df43dc48-1bac-453f-8185-49b595d5483a';
const RULES = new URL('../firestore.rules', import.meta.url);

const key = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600,
  })}`;
  const signature = createSign('RSA-SHA256').update(body).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${body}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Login with the service account failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

const token = await accessToken();
const api = async (method, path, payload) => {
  const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: payload && JSON.stringify(payload),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : {} };
};

const project = `projects/${PROJECT}`;
const ruleset = await api('POST', `${project}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: readFileSync(RULES, 'utf8') }] },
});
if (!ruleset.ok) {
  console.error(`::error::Rules were rejected (${ruleset.status}): ${JSON.stringify(ruleset.json.error ?? ruleset.json)}`);
  process.exit(1);
}
const releaseName = `${project}/releases/cloud.firestore/${DATABASE}`;
const release = { name: releaseName, rulesetName: ruleset.json.name };
let result = await api('PATCH', releaseName, { release });
if (result.status === 404) result = await api('POST', `${project}/releases`, release);
if (!result.ok) {
  console.error(`::error::Could not publish the rules (${result.status}): ${JSON.stringify(result.json.error ?? result.json)}`);
  process.exit(1);
}
console.log(`Published ${ruleset.json.name} to database ${DATABASE}.`);
