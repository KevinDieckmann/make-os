// ─── Agenten-Seite: Seitenfelder ein- und ausklappen (09.10., Aufräumen nach dem Muster der Claude-App) ───────────────────
// Auftrag 09.10.: „Es reicht, wenn wir links und rechts beides zuklappen können, damit der Chat größer und übersichtlicher wird.“
// Rein (getestet in tests/agenten-aufraeumen.test.ts): wo ein Feld steht (NEBEN dem Gespräch oder als SCHUBLADE darüber), welche Taste
// klappt und was je Browser gemerkt wird. Die Seite (AgentenSeite.tsx) hält nur den Zustand und ruft diese Regeln.
//   • links  = die Liste (ZOE, Heads, Threads)      — ⌘B bzw. Strg+B
//   • rechts = der Hintergrund (Wartet · Läuft · …) — ⌘. bzw. Strg+.
// Tasten nur, wenn kein Eingabefeld den Fokus hat (sonst gehört die Taste dem Feld). Tasten- und Merker-Regeln seit 09.10. gemeinsam in
// lib/make-one/klappen.ts (auch der Kalender klappt seine linke Spalte mit ⌘B — eine andere Seite, nie gleichzeitig offen); geprüft 09.10.:
// Schnellsuche ⌘K, Finanzplan ⌘Z, Kalender/Inbox sonst ohne Modifier; die Leiste der App klappt nur per Knopf.

import { DREI_SPALTEN_AB, ZWEI_SPALTEN_AB } from './masse';
import { KLAPP_TASTE_TEXT, klappMerkerLesen, klappMerkerSchreiben, type KlappSeite } from '@/lib/make-one/klappen';

export { imEingabefeld, klappTaste } from '@/lib/make-one/klappen';

export type Seitenfeld = KlappSeite;
/** Neben dem Gespräch (eigene Spalte, gemerkt) oder als Schublade darüber (nur für den Moment, startet zu). */
export type FeldArt = 'neben' | 'schublade';

/** Merker je Browser: „auf“ / „zu“. Ohne Eintrag ist das Feld offen (Vorgabe). */
export const MERKER: Readonly<Record<Seitenfeld, string>> = { links: 'make-agenten-links', rechts: 'make-agenten-rechts' };

/** Die Tasten als Text für Tooltips und Ansagen. */
export const TASTE_TEXT: Readonly<Record<Seitenfeld, string>> = KLAPP_TASTE_TEXT;

/** Liest den Merker — leerer Speicher, privates Fenster oder gesperrter Speicher → Vorgabe (offen). */
export function merkerLesen(feld: Seitenfeld, speicher?: Pick<Storage, 'getItem'> | null): boolean {
  return klappMerkerLesen(MERKER[feld], speicher);
}

/** Schreibt den Merker; scheitert der Speicher, bleibt es beim Zustand auf dem Bildschirm. */
export function merkerSchreiben(feld: Seitenfeld, offen: boolean, speicher?: Pick<Storage, 'setItem'> | null): void {
  klappMerkerSchreiben(MERKER[feld], offen, speicher);
}

/**
 * Wie die Seite steht — aus dem GEMESSENEN Platz der Fläche (die Leiste der App nimmt mit, eingeklappt weniger). Ohne Messung (erstes
 * Zeichnen) gilt die Fensterbreite: breit = drei Spalten.
 *   ≥ DREI_SPALTEN_AB → breit: Liste und Hintergrund neben dem Gespräch;
 *   ≥ ZWEI_SPALTEN_AB → mittel: Liste daneben, Hintergrund als Schublade;
 *   sonst             → mittel: beide als Schublade (Tablet hochkant).
 */
export function lageAus(platz: number | null, breitNachFenster: boolean): { form: 'breit' | 'mittel'; links: FeldArt; rechts: FeldArt } {
  if (platz == null) return breitNachFenster ? { form: 'breit', links: 'neben', rechts: 'neben' } : { form: 'mittel', links: 'neben', rechts: 'schublade' };
  if (platz >= DREI_SPALTEN_AB) return { form: 'breit', links: 'neben', rechts: 'neben' };
  if (platz >= ZWEI_SPALTEN_AB) return { form: 'mittel', links: 'neben', rechts: 'schublade' };
  return { form: 'mittel', links: 'schublade', rechts: 'schublade' };
}
