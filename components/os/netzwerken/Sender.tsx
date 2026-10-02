'use client';

// ─── Netzwerken — Sender im /os-Rahmen (03.10.) ──────────────────────────────
// Die Offline-Warteschlange (IndexedDB) wurde bisher nur gesendet, solange die Netzwerken-Seite offen war: wer unterwegs ohne Netz erfasst
// und danach MAKE OS auf einer anderen Seite öffnet, sah nichts und sendete nichts. Dieser Baustein läuft auf JEDER /os-Seite
// (app/os/layout.tsx, neben dem Pop-up) und arbeitet die Warteschlange ab: beim Öffnen, wenn das Netz wiederkommt (`online`), wenn
// die Seite wieder sichtbar wird und alle 30 Sekunden. Er schreibt außerdem den Zähler („n warten“) für die Handy-Leiste.
// Ohne Erfassungen auf dem Gerät tut er nichts — keine Anfrage, kein Takt-Verkehr.

import { useEffect } from 'react';
import { geteilteWarteschlange, wartendFuer, offenFuer, type WarteEintrag } from '@/lib/netzwerken/warteschlange';
import { wartezahlSetzen } from '@/lib/netzwerken/zaehler';

/**
 * Wer ist angemeldet? Immer ZUERST den Server fragen (am Gerät kann seit dem letzten Mal jemand anderes angemeldet sein — der Merker der
 * Netzwerken-Seite wäre dann falsch); der Merker dient nur als Rückfall ohne Netz.
 */
export const KONTEXT_MERKER = 'make-os-netzwerken-kontext';
async function ichErmitteln(): Promise<string | null> {
  try {
    const r = await fetch('/api/netzwerken', { cache: 'no-store' });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok && typeof d.ich === 'string') {
      try { window.localStorage.setItem(KONTEXT_MERKER, JSON.stringify({ ich: d.ich, personen: d.personen ?? [] })); } catch { /* ohne Speicher */ }
      return d.ich;
    }
    if (r.status === 403 || r.status === 401) return null; // kein Zugang: dann auch kein Merker
  } catch { /* kein Netz — der Merker */ }
  try {
    const m = JSON.parse(window.localStorage.getItem(KONTEXT_MERKER) ?? 'null') as { ich?: string } | null;
    if (m?.ich) return m.ich;
  } catch { /* ohne Speicher */ }
  return null;
}

/** Zähler aus der Liste — für die Person, der die Erfassungen gehören. */
const zaehlen = (l: readonly WarteEintrag[], ich: string | null) => ({ wartend: wartendFuer(l, ich), fehler: offenFuer(l, ich) - wartendFuer(l, ich) });

export function NetzwerkenSender() {
  useEffect(() => {
    const q = geteilteWarteschlange();
    let lebt = true;
    let ich: string | null = null;
    const aktualisieren = async () => {
      try {
        const l = await q.alle();
        if (!lebt) return;
        if (l.length && !ich) { ich = await ichErmitteln(); q.person = ich; }
        wartezahlSetzen(zaehlen(l, ich));
      } catch { /* IndexedDB nicht lesbar — dann auch kein Zähler */ }
    };
    const senden = async () => {
      try {
        const l = await q.alle();
        if (!lebt || !l.some(x => x.status === 'wartet')) { await aktualisieren(); return; }
        if (!ich) { ich = await ichErmitteln(); q.person = ich; }
        await q.senden();
      } catch { /* der nächste Takt versucht es wieder */ }
      await aktualisieren();
    };
    const weg = q.beiAenderung(() => { void aktualisieren(); });
    const los = () => { if (document.visibilityState === 'visible') void senden(); };
    void senden();
    window.addEventListener('online', los);
    document.addEventListener('visibilitychange', los);
    const takt = setInterval(() => { void senden(); }, 30_000);
    return () => { lebt = false; weg(); window.removeEventListener('online', los); document.removeEventListener('visibilitychange', los); clearInterval(takt); };
  }, []);
  return null;
}
