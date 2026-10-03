import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Only this exact Google account may receive the private Fórmula Fácil page.
export const FORMULA_OWNER_EMAIL = 'martinswilliam2004@gmail.com';
export const FORMULA_COOKIE = '__Host-shift-formula';
// Same project as firebase-applet-config.json; tokens from any other project are rejected.
export const FIREBASE_PROJECT_ID = 'gen-lang-client-0275590292';

const FIREBASE_JWKS_URL = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
const remoteKeys = createRemoteJWKSet(FIREBASE_JWKS_URL);

export interface OwnerSession {
  email: string;
  expiresAt: number;
}

/**
 * Validates a Firebase ID token and accepts it only for the owner signed in with Google.
 * Returns null for anything else (bad signature, expired, other project, other account).
 */
export async function verifyOwnerToken(
  token: string | undefined,
  keys: JWTVerifyGetKey = remoteKeys,
  projectId: string = FIREBASE_PROJECT_ID,
): Promise<OwnerSession | null> {
  if (!token || token.length > 8192) return null;
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
    });
    const now = Math.floor(Date.now() / 1000);
    const firebase = payload.firebase as { sign_in_provider?: unknown } | undefined;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    if (typeof payload.auth_time !== 'number' || payload.auth_time > now + 60) return null;
    if (payload.email !== FORMULA_OWNER_EMAIL) return null;
    if (payload.email_verified !== true) return null;
    if (firebase?.sign_in_provider !== 'google.com') return null;
    return { email: payload.email, expiresAt: payload.exp as number };
  } catch {
    return null;
  }
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `${FORMULA_COOKIE}=${token}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearedSessionCookie(): string {
  return `${FORMULA_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
