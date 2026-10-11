// ─── Fulfillment · Prozesse — Takt: Rituale und Mitschriften (C1, 10.10.; FULFILLMENT_KONZEPT.md 5.1) ──────────────────────────────
// Rituale sind Vorlagen der Bibliothek (Kick-off einmal 90 Min., Wochen-Check 15 Min., Steering monatlich, Quartals-Review; das Huddle
// täglich MIT Zahlenrunde ist eine Instanz-Vorlage). „Termine anlegen“ öffnet den VORHANDENEN Anlege-Dialog des Kalenders, vorbelegt mit
// Titel, Dauer, Bezug `mandatId` und Gästen aus der Stakeholder-Karte — es gibt keinen neuen Schreibweg in den Kalender; Gäste nur über die
// vorhandene Rückfrage. Der Fall merkt sich danach die Termin-Kennung (`ritual-merken`).
// Mitschrift im 4-Zeilen-Standard (Entscheidung 22:30): Anlass · Ergebnis · nächster Schritt · Frist — kein Freitext über Personen. Daraus per Klick
// ein Eintrag im Entscheidungs-Log oder eine Aufgabe (`/api/tasks/create` mit `bezug.mandatId`). Rein und client-sicher.

import type { Mitschrift, RitualVorlage, Rhythmus } from '../typen';
import type { Vorgabe } from '@/lib/kalender/formular';
import type { GastWahl } from '@/lib/kalender/gaeste';
import { tagPlus } from '@/lib/kalender/zeit';

/** Text je Rhythmus — EINE Tabelle für intern (Takt) und Kunden-Sicht (C2). */
export const RHYTHMUS_TEXT: Record<Rhythmus, string> = {
  einmal: 'einmalig', taeglich: 'täglich', werktags: 'werktags (Mo–Fr)', woche: 'wöchentlich', 'zwei-wochen': 'alle zwei Wochen', monat: 'monatlich', quartal: 'quartalsweise',
};
export const TEILNEHMENDE_TEXT: Record<RitualVorlage['teilnehmende'][number], string> = { intern: 'wir', entscheider: 'Entscheider', tagesverantwortlich: 'Tagesverantwortliche', team: 'Team des Kunden' };

const plus = (hhmm: string, min: number) => { const [h, m] = hhmm.split(':').map(Number); const g = Math.min(23 * 60 + 59, h * 60 + m + min); return `${String(Math.floor(g / 60)).padStart(2, '0')}:${String(g % 60).padStart(2, '0')}`; };

/** Der nächste Werktag ab morgen (Sa/So übersprungen). */
export function naechsterWerktag(heute: string): string {
  let t = tagPlus(heute, 1);
  for (let i = 0; i < 3; i++) { const [j, m, d] = t.split('-').map(Number); const w = new Date(Date.UTC(j, m - 1, d)).getUTCDay(); if (w !== 0 && w !== 6) break; t = tagPlus(t, 1); }
  return t;
}

/**
 * Vorbelegung des Kalender-Dialogs für ein Ritual: Titel „<Ritual> · <Kunde>“, nächster Werktag 10 Uhr, Dauer aus der Vorlage, Bezug zum
 * Mandat (und zur Firma), Gäste aus der Stakeholder-Karte (nur mit Adresse — eingeladen wird erst nach der Rückfrage im Dialog).
 * Die Wiederholung wählt die Person im Dialog (Hinweis `wiederholung`).
 */
export function ritualVorgabe(r: Pick<RitualVorlage, 'titel' | 'dauerMin' | 'rhythmus'>, e: { mandatId: string; firmaId?: string; kunde: string; heute: string; gaeste: GastWahl[] }): { vorgabe: Vorgabe; wiederholung: string | null } {
  const tag = naechsterWerktag(e.heute);
  const von = '10:00';
  return {
    vorgabe: {
      tag, von, bis: plus(von, Math.max(15, r.dauerMin || 30)), art: 'termin', titel: `${r.titel} · ${e.kunde}`.slice(0, 120),
      crm: { mandatId: e.mandatId, ...(e.firmaId ? { firmaId: e.firmaId } : {}) }, gaeste: e.gaeste,
    },
    wiederholung: r.rhythmus === 'einmal' ? null : RHYTHMUS_TEXT[r.rhythmus],
  };
}

/** Eine Mitschrift als Aufgabe (`POST /api/tasks/create`): der nächste Schritt ist der Titel, Anlass/Ergebnis die Beschreibung. */
export function mitschriftAlsAufgabe(m: Pick<Mitschrift, 'anlass' | 'ergebnis' | 'naechster' | 'frist'>, mandatId: string): Record<string, unknown> {
  return {
    title: m.naechster.slice(0, 300), description: `Anlass: ${m.anlass}\nErgebnis: ${m.ergebnis}`.slice(0, 4000),
    ...(m.frist ? { dueDate: m.frist } : {}), priority: 'medium', bezug: { mandatId },
  };
}

/** Eine Mitschrift als Eintrag im Entscheidungs-Log (Fall-Op `entscheidung`). */
export function mitschriftAlsEntscheidung(m: Pick<Mitschrift, 'anlass' | 'ergebnis' | 'naechster' | 'frist'>): Record<string, unknown> {
  return {
    titel: m.ergebnis.slice(0, 120), inhalt: `Anlass: ${m.anlass}\nNächster Schritt: ${m.naechster}`.slice(0, 1000), status: 'entschieden', wer: 'beide', geteilt: false,
    ...(m.frist ? { frist: m.frist } : {}),
  };
}

/** Der nächste Ritual-Termin eines Falls aus `kalender-bezug` (Tage der Termine mit seinen Kennungen) — ab heute, sonst undefined. */
export function naechsterTermin(terminTage: readonly { uid: string; tag: string }[], uids: readonly string[], heute: string): string | undefined {
  const s = new Set(uids);
  return terminTage.filter(t => s.has(t.uid) && t.tag >= heute).map(t => t.tag).sort()[0];
}
