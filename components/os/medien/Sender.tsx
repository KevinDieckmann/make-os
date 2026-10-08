'use client';

// ─── Fotos & Videos — Sender im /os-Rahmen (09.10., Paket 5) ─────────────────────────────────────────────────────────────
// Wie der Netzwerken-Sender: sendet liegengebliebene Stücke von JEDER /os-Seite aus — beim Öffnen, wenn das Netz wiederkommt, wenn die Seite
// wieder sichtbar wird und alle 30 Sekunden. Ohne Medien auf dem Gerät tut er nichts (keine Anfrage). Während gesendet wird, hält ein
// Wake Lock den Bildschirm an (iOS hält Uploads im Hintergrund an — Hinweis „App offen lassen“ in der Warteschlange).

import { useEffect } from 'react';
import { geteilteMedienSchlange } from '@/lib/medien/warteschlange';

async function ichErmitteln(): Promise<string | null> {
  try {
    const r = await fetch('/api/konto/ich', { cache: 'no-store' });
    const d = await r.json().catch(() => null) as { ich?: { speicher?: string } } | null;
    return r.ok && typeof d?.ich?.speicher === 'string' ? d.ich.speicher : null;
  } catch { return null; }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

export function MedienSender() {
  useEffect(() => {
    const q = geteilteMedienSchlange();
    let lebt = true;
    let wach: WakeLockSentinelLike | null = null;
    const senden = async () => {
      try {
        const l = await q.alle();
        if (!lebt || !l.some(x => x.status === 'wartet')) return;
        q.person ??= await ichErmitteln();
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } };
        if (document.visibilityState === 'visible' && nav.wakeLock) wach = await nav.wakeLock.request('screen').catch(() => null);
        await q.senden();
      } catch { /* der nächste Takt versucht es wieder */ }
      finally { if (wach) { await wach.release().catch(() => {}); wach = null; } }
    };
    void senden();
    const sichtbar = () => { if (document.visibilityState === 'visible') void senden(); };
    const netz = () => void senden();
    window.addEventListener('online', netz);
    document.addEventListener('visibilitychange', sichtbar);
    window.addEventListener('make-medien-neu', netz);
    const uhr = window.setInterval(() => void senden(), 30_000);
    return () => { lebt = false; window.removeEventListener('online', netz); document.removeEventListener('visibilitychange', sichtbar); window.removeEventListener('make-medien-neu', netz); window.clearInterval(uhr); };
  }, []);
  return null;
}
