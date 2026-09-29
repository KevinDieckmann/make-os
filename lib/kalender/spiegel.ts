// ─── Kalender — Spiegel von Modul-Terminen (rein, getestet, 29.09., Paket K5) ─
// Datenregel KALENDER_VERBINDUNGEN.md 4b + doppelte Wahrheit 5: Das MODUL führt Datum und Titel (Make.One-Event,
// Familien-Date, Paar-Gespräch); der iCloud-Termin ist ein abgeleiteter SPIEGEL mit ECHTER UID. Jede Änderung im Modul
// zieht ihn nach (Zeit, Titel, Ort), Absage löscht ihn — immer über lib/kalender/termin-server.ts (iCloud →
// kalender-bezug → Änderungsprotokoll). Hier nur: was der Spiegel sein SOLL und was sich am Ist unterscheidet.
//
//   Event      Titel · Ort als Ort-Feld · Tag + Uhrzeit · drei Stunden (TERMIN_DAUER_MIN) · Kalender „Gemeinsam“ ·
//              Bezug `eventId` (kalender-bezug). Ohne Uhrzeit kein Termin; „abgesagt“ → weg.
//   Date       ganztägig am Tag · „Date: <Titel>“ · Gemeinsam. „abgesagt“ → weg; „stattgefunden“ bleibt stehen.
//   Gespräch   Tag + Uhrzeit/Dauer aus den Einstellungen · „Paar-Gespräch“ · Gemeinsam. „ausgefallen“ → weg.
// Feste UID je Eintrag (`spiegelUid`) — ein abgebrochener Vorgang legt nie doppelt an (icloud.ts `anlegen`).
// Alte Events tragen eine erfundene Kennung (`mac-…`, Verbindungskarte Befund 4): `istScheinUid` — sie wird beim
// Nachziehen durch die echte UID ersetzt, wenn der Termin eindeutig (Tag + Titel) im Kalender steht.

import { wandAus, tagPlus } from './zeit';

export const EVENT_DAUER_MIN = 180;
export type SpiegelArt = 'event' | 'date' | 'gespraech';

export interface SollTermin { titel: string; start: string; ende: string; ganztags: boolean; ort?: string }
/** soll = so soll er aussehen · weg = löschen (abgesagt) · bleibt = nicht anfassen · keiner = es gibt (noch) keinen. */
export type Soll = { art: 'soll'; t: SollTermin } | { art: 'weg' } | { art: 'bleibt' } | { art: 'keiner'; grund: string };

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const UHR = /^(\d{1,2}):(\d{2})$/;
const minuten = (hhmm: string | undefined): number | null => { const m = UHR.exec(hhmm ?? ''); if (!m) return null; const h = Number(m[1]), mi = Number(m[2]); return h > 23 || mi > 59 ? null : h * 60 + mi; };

/** Feste, echte UID eines Spiegels (für iCloud gültig: Buchstaben, Ziffern, . _ -). */
export function spiegelUid(art: SpiegelArt, id: string): string {
  return `makeos-${art}-${id.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 100)}`;
}
/** Erfundene Kennung aus der Zeit vor K5 (`neueKennung('mac')`) — kein echter Termin dahinter. */
export const istScheinUid = (uid: string | undefined | null): boolean => !!uid && /^mac-/.test(uid);

export function eventSoll(e: { titel: string; datum: string; uhrzeit?: string; ort?: string; status: string }): Soll {
  if (e.status === 'abgesagt') return { art: 'weg' };
  const m = minuten(e.uhrzeit);
  if (!TAG.test(e.datum) || m === null) return { art: 'keiner', grund: 'Uhrzeit setzen (Überblick), dann lässt sich der Termin anlegen.' };
  const titel = e.titel.trim().slice(0, 120) || 'Event';
  return { art: 'soll', t: { titel, start: wandAus(e.datum, m), ende: wandAus(e.datum, m + EVENT_DAUER_MIN), ganztags: false, ...(e.ort?.trim() ? { ort: e.ort.trim().slice(0, 300) } : {}) } };
}

export function dateSoll(d: { titel: string; datum: string; status: string }): Soll {
  if (d.status === 'abgesagt') return { art: 'weg' };
  if (d.status !== 'geplant') return { art: 'bleibt' };
  if (!TAG.test(d.datum)) return { art: 'keiner', grund: 'Datum fehlt.' };
  return { art: 'soll', t: { titel: `Date: ${d.titel.trim().slice(0, 110)}`, start: `${d.datum}T00:00:00`, ende: `${tagPlus(d.datum, 1)}T00:00:00`, ganztags: true } };
}

export function gespraechSoll(datum: string, e: { uhrzeit: string; dauerMin: number }, status?: string): Soll {
  if (status === 'ausgefallen') return { art: 'weg' };
  if (status === 'gehalten') return { art: 'bleibt' };
  const m = minuten(e.uhrzeit);
  if (!TAG.test(datum) || m === null) return { art: 'keiner', grund: 'Uhrzeit des Paar-Gesprächs fehlt (Einstellungen).' };
  const dauer = Math.max(15, Math.min(240, Math.round(e.dauerMin) || 45));
  return { art: 'soll', t: { titel: 'Paar-Gespräch', start: wandAus(datum, m), ende: wandAus(datum, m + dauer), ganztags: false } };
}

/** Was am Ist-Termin geändert werden muss (nur Zeit, Titel, Ort) — null = passt. */
export function spiegelAbweichung(ist: { titel: string; start: string; ende: string; ganztags: boolean; ort?: string }, soll: SollTermin): { titel?: string; start?: string; ende?: string; ort?: string | null } | null {
  const a: { titel?: string; start?: string; ende?: string; ort?: string | null } = {};
  if (ist.ganztags !== soll.ganztags) return null; // ganztägig ↔ mit Uhrzeit kann MAKE OS nicht umstellen — in Apple ändern
  if (ist.start !== soll.start || ist.ende !== soll.ende) { a.start = soll.start; a.ende = soll.ende; }
  if (ist.titel !== soll.titel) a.titel = soll.titel;
  if ((ist.ort ?? '') !== (soll.ort ?? '')) a.ort = soll.ort ?? null;
  return Object.keys(a).length ? a : null;
}

const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
/** Ein alter Event-Termin ohne echte UID: genau EIN Termin an diesem Tag mit dem Titel (auch „Titel · Ort“)? */
export function scheinAufloesen<T extends { uid: string; titel: string; start: string }>(termine: readonly T[], e: { titel: string; datum: string }): T | null {
  const titel = norm(e.titel);
  if (!titel) return null;
  const treffer = termine.filter(t => t.start.slice(0, 10) === e.datum && (norm(t.titel) === titel || norm(t.titel).startsWith(`${titel} ·`)));
  return treffer.length === 1 ? treffer[0] : null;
}

/**
 * Paar-Gespräche: die gemerkten Termine (Datum → UID) gegen den Rhythmus. Ein zukünftiger Eintrag, dessen Datum nicht
 * mehr das nächste Gespräch ist (Wochentag in den Einstellungen geändert) und zu dem es kein Gespräch gibt, zieht auf
 * das neue Datum um — solange dort noch keiner steht.
 */
export function gespraecheUmziehen(termine: Record<string, string>, naechstes: string, heute: string, gespraechsTage: ReadonlySet<string>): { von: string; nach: string } | null {
  if (termine[naechstes]) return null;
  const kandidat = Object.keys(termine).filter(d => d >= heute && d !== naechstes && !gespraechsTage.has(d)).sort()[0];
  return kandidat ? { von: kandidat, nach: naechstes } : null;
}
