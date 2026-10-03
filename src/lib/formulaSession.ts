import type { User } from 'firebase/auth';

export const FORMULA_OWNER_EMAIL = 'martinswilliam2004@gmail.com';
export const FORMULA_ADMIN_PATH = '/admin/formula-facil';
export const FORMULA_PUBLIC_PATH = '/formula-facil';
// The raw tool pages shown inside the Shift Hours frame.
export const FORMULA_PUBLIC_FRAME = '/formula-facil.html';
export const FORMULA_ADMIN_FRAME = '/api/formula-admin';

export const isFormulaOwner = (user: User | null) =>
  !!user && user.email === FORMULA_OWNER_EMAIL && user.emailVerified &&
  user.providerData.some((provider) => provider.providerId === 'google.com');

/**
 * Keeps the server cookie for the private Fórmula Fácil page in step with Firebase:
 * the owner's fresh ID token is handed to the server, everyone else clears it.
 * The server validates the token again; this is only the hand-off.
 */
const MARK_KEY = 'shift-hours-formula-session';

const readMark = () => { try { return localStorage.getItem(MARK_KEY) === '1'; } catch { return false; } };
const writeMark = (on: boolean) => { try { on ? localStorage.setItem(MARK_KEY, '1') : localStorage.removeItem(MARK_KEY); } catch { /* storage blocked */ } };

export async function syncFormulaSession(user: User | null): Promise<boolean> {
  try {
    if (!isFormulaOwner(user)) {
      // Only visitors who once held the owner cookie need a server round trip.
      if (readMark()) {
        await fetch('/api/formula-session', { method: 'DELETE', credentials: 'same-origin' });
        writeMark(false);
      }
      return false;
    }
    const token = await user!.getIdToken();
    const response = await fetch('/api/formula-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` },
    });
    writeMark(response.ok);
    return response.ok;
  } catch {
    return false;
  }
}

/** Logout always clears the server cookie, even if the local marker was lost. */
export async function clearFormulaSession(): Promise<void> {
  writeMark(false);
  try {
    await fetch('/api/formula-session', { method: 'DELETE', credentials: 'same-origin' });
  } catch { /* offline: the cookie still expires with the token */ }
}

/** Whether the owner opened the admin version to every visitor. Off when unknown. */
export async function fetchFormulaPublic(): Promise<boolean> {
  try {
    const response = await fetch('/api/formula-visibility', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.public === true;
  } catch {
    return false;
  }
}

export async function setFormulaPublic(user: User, enabled: boolean): Promise<boolean> {
  const token = await user.getIdToken();
  const response = await fetch('/api/formula-visibility', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public: enabled }),
  });
  if (!response.ok) throw new Error(`visibility ${response.status}`);
  return (await response.json()).public === true;
}
