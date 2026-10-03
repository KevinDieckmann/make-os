// ─── CRM — Veranstaltungsmarke (27.09., rein) ───────────────────────────────
// Kevin: „Unter den Events heißt unsere Marke Make.One — unter der Marke laufen
// die Events.“ Eine Stelle statt Streuung: Kopf des Events-Reiters, Formular,
// ICS-Export und Nachfass-Text lesen die Marke von hier. Eigenes Modul ohne
// Abhängigkeiten, damit events.ts und eventplanung.ts sie beide nutzen können,
// ohne sich gegenseitig zu laden.

import type { Event, Teilnahme } from './typen';

/** Unsere Veranstaltungsmarke. */
export const MARKE_EVENTS = 'Make.One';
/** Höchstlänge einer Marke im Bestand (Säuberung in lib/crm/speicher.ts). */
export const MARKE_MAX = 40;
/** Die Marke eines Events: gesetzt, sonst Make.One — abgeleitet, nie in den Bestand zurückgeschrieben. */
export const markeVon = (e: Pick<Event, 'marke'>): string => e.marke?.trim() || MARKE_EVENTS;
/**
 * Wie ein Event nach außen heißt: „Make.One · Stammtisch Maschinenbau“ — für Nachfass-Texte, Export, Herkunft und ZOE.
 * Läuft es in einer Reihe (03.10., z. B. Fokus Innovation), steht die Reihe vor dem Titel: „Make.One · Fokus Innovation · Dinner“;
 * nennt der Titel sie schon („Fokus Innovation Hamburg“), nicht doppelt: „Make.One · Fokus Innovation Hamburg“.
 * Ein besuchtes Event (Netzwerken, fremde Veranstaltung) trägt nicht unsere Marke — es heißt, wie es heißt (der Titel).
 */
export const eventName = (e: Pick<Event, 'titel' | 'marke' | 'reihe'>): string => (istNetzwerkenEvent(e) ? e.titel : `${markeVon(e)} · ${titelMitReihe(e)}`);

/** DER Nachfass-Text zu einem Event (Follow-up-Ebene, Heute, Netzwerken, Teilnahme-Brücke): „Nachfassen nach „Make.One · …““. */
export const nachfassText = (e: Pick<Event, 'titel' | 'marke' | 'reihe'>): string => `Nachfassen nach „${eventName(e)}“`;
/** DER Text der Aktivität nach dem Nachfassen: „Nachgefasst nach „…“ — Gespräch“. */
export const nachgefasstText = (e: Pick<Event, 'titel' | 'marke' | 'reihe'>, ergebnis?: string | null): string => `Nachgefasst nach „${eventName(e)}“${ergebnis ? ` — ${ergebnis}` : ''}`;

// ── Reihen unter Make.One (03.10.) ───────────────────────────────────────────
// Kevin: „Fokus Innovation = Event-Reihe unter Make.One“ — das Leit-Format der Innovations-Abende (Berlin, Hamburg, Bielefeld,
// Köln, München). Make.One bleibt die Marke (`marke`), die Art des Abends bleibt `format` (Stammtisch, Dinner, Workshop …);
// die Reihe ist das dritte, optionale Merkmal (`Event.reihe`, Kennung aus dieser Werteliste). Ein Event ohne Reihe ist ein
// gewöhnlicher Make.One-Abend — der Altbestand liest ohne Migration. Besuchte Events (Netzwerken) haben nie eine Reihe.

/** Eine Reihe: feste Kennung (gespeichert) und ihr Name (angezeigt). */
export interface EventReihe { id: string; name: string }
/** Die Werteliste der Reihen — neue Reihe = neue Zeile hier (Kennung nie ändern, sie steht im Bestand). */
export const EVENT_REIHEN: readonly EventReihe[] = [{ id: 'fokus-innovation', name: 'Fokus Innovation' }];
/** Höchstlänge einer Reihen-Kennung im Bestand. */
export const REIHE_MAX = 40;
/** Pillen-Kennung für „Events ohne Reihe“ im Filter und in der Übersicht (keine gültige Reihen-Kennung, kollidiert also nie). */
export const OHNE_REIHE = '-';
/** Eine gültige Reihen-Kennung (klein, Ziffern, Bindestriche) — sonst undefined. Unbekannte, aber gültige Kennungen bleiben (Rückweg). */
export const reiheKennung = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length <= REIHE_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? v : undefined;
/** Der Name einer Reihe; eine unbekannte Kennung (z. B. aus einem neueren Stand) steht für sich selbst. */
export const reiheName = (id: string): string => EVENT_REIHEN.find(r => r.id === id)?.name ?? id;
/** Die Reihe eines Events — nur bei eigenen Abenden (Make.One), nie bei besuchten Events. */
export function reiheVon(e: Pick<Event, 'reihe' | 'marke'>): EventReihe | undefined {
  if (istNetzwerkenEvent(e)) return undefined;
  const id = reiheKennung(e.reihe);
  return id ? { id, name: reiheName(id) } : undefined;
}
/** Titel mit Reihe davor („Fokus Innovation · Dinner“) — steht die Reihe schon im Titel, bleibt er, wie er ist. */
export function titelMitReihe(e: Pick<Event, 'titel' | 'marke' | 'reihe'>): string {
  const r = reiheVon(e);
  return r && !e.titel.toLocaleLowerCase('de').includes(r.name.toLocaleLowerCase('de')) ? `${r.name} · ${e.titel}` : e.titel;
}

/**
 * Titel-Vorschlag für ein neues Event (Praxis-Fund 04.10.): mit Reihe und Vorlage „Fokus Innovation · Dinner“ (statt nur
 * „Dinner“), nur Reihe „Fokus Innovation“, nur Vorlage ihr Name, sonst „Neues Event“. Steht die Reihe im Titel, schreibt
 * `eventName` sie nicht doppelt.
 */
export function eventTitelVorschlag(reihe: string | undefined, vorlage: string | undefined): string {
  const r = reihe ? reiheName(reihe) : '';
  return [r, vorlage ?? ''].filter(Boolean).join(' · ') || 'Neues Event';
}

/**
 * Zählt diese Teilnahme als Anmeldung zu einem EIGENEN Event — die Marketing-Herkunft „event“ (lib/crm/scoring.ts
 * `marketingHerkunft`)? Zugesagt oder da, bei einem Make.One-Abend, nicht persönlich/telefonisch eingeladen (das ist
 * Direktansprache). EINE Regel für Scoring, Qualifizierung und die Kennzahlen je Reihe (lib/crm/reihen.ts).
 */
export function alsMarketingAnmeldung(t: Pick<Teilnahme, 'status' | 'einladungsweg'>, e: Pick<Event, 'marke'>): boolean {
  if (t.status !== 'zugesagt' && t.status !== 'da') return false;
  if (istNetzwerkenEvent(e)) return false;
  return t.einladungsweg !== 'persoenlich' && t.einladungsweg !== 'telefon';
}

/**
 * Kennzeichen eines Events, das über „Netzwerken“ unterwegs angelegt wurde (fremde Veranstaltung, nicht unsere Marke — 03.10.).
 * Solche Events zählen NICHT in Erscheinensquote, Folgegespräche je Event und Gästemischung (Kevin: getrennt ausweisen).
 */
export const NETZWERKEN_MARKE = 'Netzwerken';
export const istNetzwerkenEvent = (e: Pick<Event, 'marke'>): boolean => e.marke?.trim() === NETZWERKEN_MARKE;
