// ─── Kalender — was ZOE von einem Termin sieht (rein, getestet, 29.09., Paket R-Z #K4) ──
// ZOE bekam den ganzen Kalender-Spiegel für jede Person („Kalender ist gemeinsam“, lib/brain.ts). Fragte Malin, gingen
// Kevins private Titel — auch Arzt und Reha (Art. 9 DSGVO) — an den KI-Anbieter, umgekehrt genauso.
//
// Die Regel ist DIESELBE wie in der Kalender-Sicht (GET /api/kalender): `maskieren` aus lib/kalender/bezug.ts —
// private Termine der ANDEREN Person nur als „Belegt“ (Zeit ja, kein Titel, Ort, Notiz, Bezug). Für ZOE kommt eine
// Verschärfung dazu, weil der Text an einen Drittdienst geht: Gesundheitstermine (Arzt, Reha, Behandlung) der anderen
// Person gelten auch ohne „privat“ als privat. Erkannt mit den Stichwort-Regeln des Systems (lib/make-one/stichworte-data.ts,
// „Rehabilitation“ und „Behandlung“) — keine eigene Wortliste, keine zweite Maskierlogik.
// Wem ein Termin gehört, sagt `eigentuemer` (wer ihn angelegt hat, sonst der Kalender). Gemeinsame Kalender ohne
// Anleger haben keinen Eigentümer und bleiben sichtbar (wie in der Kalender-Sicht).

import { maskieren, eigentuemer, type TerminMitBezug } from './bezug';
import { STICHWORT } from '@/lib/make-one/stichworte-data';
import { terminMarke } from './buchung';

/** Anfang der Marke, die die Buchungsseite in die Notiz ihres Termins schreibt (lib/kalender/buchung.ts `terminMarke`). */
const BUCHUNG_MARKE = terminMarke('').trim();

/** Die Stichwort-Regeln für Gesundheitstermine (Reha/Physio/Rücken, Arzt/Behandlung/Praxis). */
const GESUNDHEIT: readonly RegExp[] = [STICHWORT.rehabilitation, STICHWORT.behandlung].filter(Boolean).map(s => s.muster);

/** Ist das ein Gesundheitstermin (Titel, Ort oder Notiz)? */
export function istGesundheitsTermin(t: { titel?: string; ort?: string; notiz?: string }): boolean {
  const text = [t.titel, t.ort, t.notiz].filter(Boolean).join(' ');
  return !!text && GESUNDHEIT.some(m => m.test(text));
}

// ── Fremd oder eigen? (29.09., Nachtrag #K1) ────────────────────────────────
// Nur Text Dritter macht ein Gespräch „fremd gelesen“ — Titel, die Kevin oder Malin selbst angelegt haben, nicht (sonst
// liefe im Alltag jedes Werkzeug über den Stapel). Genutzt werden nur Merkmale, die der Termin schon hat:
//   · `mitTeilnehmern` (ATTENDEE im VEVENT): Einladung bzw. Termin mit Gästen — ein Organisator von außen steht immer
//     mit Teilnehmern im Objekt; ein eigener Termin mit Gästen enthält deren Antworten/Namen.
//   · Herkunft des Kalenders: nicht schreibbar (Abo, fremd geteilt) oder kein Kalender des Haushalts (Einstellungen
//     `kalender.kevin/malin/beide` bzw. der Name nennt Kevin/Malin — `wemGehoert`).
//   · Buchungsseite: die Marke `terminMarke` in der Notiz (Titel und Notiz tragen Gastangaben).
//   · Quelle: nur der iCloud-Stand kennt Teilnehmer und Rechte. Die Mac-Lieferung (Altweg, importierter Spiegel) und
//     der KEMARIS-Snapshot (M365, Arbeitspostfach voller Einladungen, ohne Organisator-Angabe) gelten als fremd.
// „Belegt“ (maskiert) ist unser eigener Text und nie fremd. Feiertage und Geburtstage (Familie, eigene Kartei) sind eigen.

/** Die Herkunft, gegen die ein Termin geprüft wird. `haushalt`/`nurLesen`: Kalendernamen, klein geschrieben. */
export interface TerminHerkunft {
  quelle: 'icloud' | 'mac' | 'leer' | 'kemaris';
  haushalt: ReadonlySet<string>;
  nurLesen: ReadonlySet<string>;
}

/** Stammt der Text dieses Termins (möglicherweise) von Dritten? Rein. */
export function terminFremd(t: Pick<TerminMitBezug, 'kalender' | 'mitTeilnehmern' | 'notiz'>, h: TerminHerkunft): boolean {
  if (h.quelle !== 'icloud') return true;
  if (t.mitTeilnehmern) return true;
  if ((t.notiz ?? '').includes(BUCHUNG_MARKE)) return true;
  const name = t.kalender.trim().toLowerCase();
  return h.nurLesen.has(name) || !h.haushalt.has(name);
}

/**
 * Ein Termin, wie ZOE ihn für `betrachter` sehen darf: privat der anderen Person → „Belegt“ (`maskieren`), Gesundheit
 * der anderen Person ebenso. Die eigenen Termine und gemeinsame ohne Eigentümer bleiben, wie sie sind.
 */
export function fuerZoe<T extends TerminMitBezug & { wer?: string }>(t: T, betrachter: string): T {
  const e = eigentuemer(t);
  const gesundheitFremd = !!e && e !== betrachter && t.sichtbarkeit !== 'privat' && istGesundheitsTermin(t);
  return maskieren(gesundheitFremd ? { ...t, sichtbarkeit: 'privat' as const } : t, betrachter);
}
