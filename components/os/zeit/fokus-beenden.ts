'use client';

// ─── Zeit & Fokus — einen laufenden Fokus beenden (10.10.: EINE Stelle für den Knopf im Kopf und die Fokus-Seite) ────────────────
// Erst der fertige Block, dann den laufenden löschen (29.09.) — scheitert das Speichern, läuft der Zähler weiter, statt dass die Fokus-Zeit
// still verloren geht. Inhaltlich abgelehnt (400): fragen statt endlos weiterzählen; sonst (Netz, 5xx, Sitzung) weiterlaufen lassen.

import { fokusMerken, type LaufenderFokus } from '@/lib/zeitmessung/fokus-laufend';
import type { Bestaetigung } from '../ui';

/** Zeit-Ereignis: ein Fokus-Block ist gespeichert (Zeit je Einheit/Mandat, Fokus-Seite laden dann neu). */
export const ZEIT_EREIGNIS = 'make-zeit-geaendert';

/** Beendet den laufenden Fokus — `true`, wenn er beendet ist (gespeichert oder bewusst verworfen). */
export async function fokusBeenden(l: LaufenderFokus, bestaetigen: (b: Bestaetigung) => Promise<boolean>): Promise<boolean> {
  let status = 0, grund = '';
  try {
    const r = await fetch('/api/state/zeit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'fokus', von: l.von, bis: new Date().toISOString(), schluessel: l.schluessel, label: l.label, aufgabeId: l.aufgabeId, einheit: l.einheit, mandatId: l.mandatId, terminUid: l.terminUid }) });
    status = r.status;
    if (!r.ok) grund = String(((await r.json().catch(() => ({}))) as { error?: string }).error ?? '');
  } catch { status = 0; }
  if (status < 200 || status >= 300) {
    if (status === 400 && (await bestaetigen({ titel: 'Zähler trotzdem beenden?', text: `Fokus-Block abgelehnt${grund ? `: ${grund}` : ''}.\n\nDiese Zeit wird nicht gezählt.`, ja: 'Beenden', gefahr: true }))) { fokusMerken(null); return true; }
    if (status !== 400) window.alert('Fokus-Zeit nicht gespeichert (keine Verbindung oder Server nicht erreichbar). Der Zähler läuft weiter — bitte gleich noch einmal beenden.');
    return false;
  }
  fokusMerken(null);
  window.dispatchEvent(new Event(ZEIT_EREIGNIS));
  return true;
}

/** „1:05:09“ bzw. „5:09“ — die laufende Uhr. */
export const uhr = (sek: number) => {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
