// ─── CRM — Veranstaltungsmarke (27.09., rein) ───────────────────────────────
// Kevin: „Unter den Events heißt unsere Marke Make.One — unter der Marke laufen
// die Events.“ Eine Stelle statt Streuung: Kopf des Events-Reiters, Formular,
// ICS-Export und Nachfass-Text lesen die Marke von hier. Eigenes Modul ohne
// Abhängigkeiten, damit events.ts und eventplanung.ts sie beide nutzen können,
// ohne sich gegenseitig zu laden.

import type { Event } from './typen';

/** Unsere Veranstaltungsmarke. */
export const MARKE_EVENTS = 'Make.One';
/** Höchstlänge einer Marke im Bestand (Säuberung in lib/crm/speicher.ts). */
export const MARKE_MAX = 40;
/** Die Marke eines Events: gesetzt, sonst Make.One — abgeleitet, nie in den Bestand zurückgeschrieben. */
export const markeVon = (e: Pick<Event, 'marke'>): string => e.marke?.trim() || MARKE_EVENTS;
/** Wie ein Event nach außen heißt: „Make.One · Stammtisch Maschinenbau“ — für Nachfass-Texte und Export. */
export const eventName = (e: Pick<Event, 'titel' | 'marke'>): string => `${markeVon(e)} · ${e.titel}`;
