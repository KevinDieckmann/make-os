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

/** Die Stichwort-Regeln für Gesundheitstermine (Reha/Physio/Rücken, Arzt/Behandlung/Praxis). */
const GESUNDHEIT: readonly RegExp[] = [STICHWORT.rehabilitation, STICHWORT.behandlung].filter(Boolean).map(s => s.muster);

/** Ist das ein Gesundheitstermin (Titel, Ort oder Notiz)? */
export function istGesundheitsTermin(t: { titel?: string; ort?: string; notiz?: string }): boolean {
  const text = [t.titel, t.ort, t.notiz].filter(Boolean).join(' ');
  return !!text && GESUNDHEIT.some(m => m.test(text));
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
