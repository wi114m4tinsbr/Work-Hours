import { useEffect, useState } from 'react';

/**
 * Short two-note chime for new support messages, made with the Web Audio API (no audio file to
 * download). Muting is per device and shared by every open tab.
 */
const KEY = 'shift-sound-muted';
const EVENT = 'shift-sound-muted-change';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

// Browsers only allow sound after the person has interacted with the page once.
if (typeof window !== 'undefined') {
  const unlock = () => { audio()?.resume().catch(() => {}); };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

export function isSoundMuted(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setSoundMuted(muted: boolean) {
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* private mode: keeps working for this page */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: muted }));
}

export function useSoundMuted(): [boolean, (muted: boolean) => void] {
  const [muted, setMuted] = useState(isSoundMuted);
  useEffect(() => {
    const sync = () => setMuted(isSoundMuted());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return [muted, setSoundMuted];
}

export function playChime() {
  if (isSoundMuted()) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  [[880, 0], [1318.5, 0.12]].forEach(([freq, delay]) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.45);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.5);
  });
}
