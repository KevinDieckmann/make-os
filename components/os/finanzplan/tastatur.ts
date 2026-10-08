// ─── Finanzplanung — welche Blatt-Tabelle die Tastatur bekommt (08.10. abends) ───────────────────────────────────────
// Seit dem Zusammenlegen der Blätter (Fragebogen Teil 3, Frage 10) stehen auf einer Seite mehrere Blatt-Tabellen — auf „Gesellschaften“
// bis zu drei (MAKE, Töpfe, KD Ventures). Jede hört auf `keydown` am Fenster und merkt sich ihre Auswahl. Ohne diese Regel wirkte jede Taste in
// ALLEN Tabellen mit Auswahl: Entf setzte in beiden einen Handwert zurück, eine Ziffer öffnete zwei Eingabefelder — das eine verlor den Fokus
// und schrieb die Ziffer still als Handwert in den Plan. Die Regel steht an EINER Stelle (rein, ohne React, getestet in
// tests/finanzplan-tastatur.test.ts):
// 1. Höchstens EINE Tabelle ist aktiv. Aktiv wird eine Tabelle, sobald man in sie klickt, tippt oder hineinfokussiert (`blattAktivieren`);
//    alle anderen verlieren dabei ihre Auswahl (`abwaehlen`). Ein offenes Eingabefeld wird NICHT verworfen — es übernimmt beim Verlassen
//    (onBlur) wie bisher.
// 2. Eine Taste gilt nur für eine Tabelle mit Auswahl, ohne offenes Feld, Menü oder Notiz und ohne Cmd/Strg/Alt — und nur, wenn der Fokus in
//    DIESER Tabelle liegt oder nirgends (die Seite selbst, z. B. nach Enter im Feld): dann nur für die aktive. Fokus in einem Eingabefeld, auf
//    einem Knopf/Link oder in einer anderen Tabelle: nie (Knöpfe behalten ihr eigenes Enter).
// 3. Welche Taste was tut, entscheidet `blattTaste` (Pfeile bewegen, Enter bearbeitet, Entf setzt auf die Formel zurück, Esc wählt ab,
//    Ziffer beginnt eine Eingabe).

type Abwaehlen = () => void;
const angemeldet = new Map<string, Abwaehlen>();
let aktiv: string | null = null;

/** Tabelle anmelden (beim Einbau). Gibt das Abmelden zurück (beim Ausbau) — eine ausgebaute aktive Tabelle hinterlässt keine aktive. */
export function blattAnmelden(id: string, abwaehlen: Abwaehlen): () => void {
  angemeldet.set(id, abwaehlen);
  return () => {
    if (angemeldet.get(id) === abwaehlen) angemeldet.delete(id);
    if (aktiv === id) aktiv = null;
  };
}

/** Diese Tabelle wird aktiv; alle anderen verlieren ihre Auswahl. */
export function blattAktivieren(id: string): void {
  if (aktiv === id) return;
  aktiv = id;
  for (const [andere, abwaehlen] of Array.from(angemeldet)) if (andere !== id) abwaehlen();
}

/** Die aktive Tabelle (oder keine). */
export const aktivesBlatt = (): string | null => aktiv;

/** Wo der Fokus beim Tastendruck liegt — aus Sicht EINER Tabelle. */
export type TastenOrt = 'eigenes' | 'seite' | 'bedienelement' | 'anderswo';
/** Bedienelemente mit eigener Tastatur — dort gehört die Taste dem Element, nie dem Blatt. */
const BEDIEN = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A']);

/**
 * Ort des Tastendrucks. `ziel` = Ziel des Ereignisses (fokussiertes Element); `seite` = der Fokus liegt auf keinem Element (body/html);
 * `inWurzel` = das Ziel liegt in dieser Tabelle.
 */
export function tastenOrt(ziel: { tagName?: string; isContentEditable?: boolean } | null, o: { seite: boolean; inWurzel: boolean }): TastenOrt {
  if (!ziel || o.seite) return 'seite';
  if ((ziel.tagName && BEDIEN.has(ziel.tagName.toUpperCase())) || ziel.isContentEditable) return 'bedienelement';
  return o.inWurzel ? 'eigenes' : 'anderswo';
}

/** Gilt dieser Tastendruck für diese Tabelle? (Regel 2) */
export function tasteGilt(o: { ort: TastenOrt; aktiv: boolean; gewaehlt: boolean; offen: boolean; modifier: boolean }): boolean {
  if (!o.gewaehlt || o.offen || o.modifier) return false;
  return o.ort === 'eigenes' || (o.ort === 'seite' && o.aktiv);
}

export type BlattAktion =
  | { art: 'gehe'; e: string; m: number }
  | { art: 'bearbeiten'; start?: string }
  | { art: 'zuruecksetzen' }
  | { art: 'abwaehlen' };

/** Was eine Taste auf der gewählten Zelle tut (Regel 3) — null: nichts (Taste bleibt beim Browser). */
export function blattTaste(taste: string, sel: { e: string; m: number }, planMonate: readonly number[], editZeilen: readonly string[]): BlattAktion | null {
  const mi = planMonate.indexOf(sel.m), zi = editZeilen.indexOf(sel.e);
  if (taste === 'ArrowRight') return mi + 1 < planMonate.length ? { art: 'gehe', e: sel.e, m: planMonate[mi + 1] } : null;
  if (taste === 'ArrowLeft') return mi > 0 ? { art: 'gehe', e: sel.e, m: planMonate[mi - 1] } : null;
  if (taste === 'ArrowDown') return zi + 1 < editZeilen.length ? { art: 'gehe', e: editZeilen[zi + 1], m: sel.m } : null;
  if (taste === 'ArrowUp') return zi > 0 ? { art: 'gehe', e: editZeilen[zi - 1], m: sel.m } : null;
  if (taste === 'Enter') return { art: 'bearbeiten' };
  if (taste === 'Backspace' || taste === 'Delete') return { art: 'zuruecksetzen' };
  if (taste === 'Escape') return { art: 'abwaehlen' };
  if (/^[0-9,.\-]$/.test(taste)) return { art: 'bearbeiten', start: taste };
  return null;
}
