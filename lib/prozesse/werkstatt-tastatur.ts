// ─── Prozesse · Werkstatt — mit der Tastatur bauen (Etappe B2, 21.10.; ANALYSE_100.md Punkte 16, 17) ──────────────────────────────────────────────────
// Der schnellste Weg zu einem Ablauf (Whimsical, bpmn.io): Alt+Pfeil legt einen verbundenen Schritt derselben Form in diese Richtung an, Tab am Knoten öffnet
// die Formauswahl, Pfeile wählen den Nachbarn, ⇧+Pfeile schieben, ⌘Z/⌘⇧Z, ⌘C/⌘V/⌘D, Entf, F2 benennt, Enter öffnet das große Fenster. Hier steht rein:
//   · `tasteZuAktion` — welche Taste was tut (eine Liste, auch für die Hilfe: `WERKSTATT_KUERZEL`);
//   · `nachbar` — der nächste Knoten in einer Richtung (Pfeile);
//   · `altPfeil` — was Alt+Pfeil anlegt: rechts = dahinter (an einer Entscheidung „ja“), links = davor, unten = der Abzweig (nein · abgelaufen) bzw. dahinter in
//     der Bahn darunter, oben = dahinter in der Bahn darüber. Dieselbe Form wie der Knoten (Baustein mit den Vorgaben seiner Maske).
// Die Ansagen sind deutsch (Vorleser, `aria-live`). Rein und client-sicher; Tests: tests/prozesse-werkstatt-aktionen.test.ts.

import type { ProzessForm, ProzessKnoten } from './definition';
import type { Ausgang } from './fluss';
import type { Box, BahnSchluessel } from './werkstatt-lage';

type K = ProzessKnoten<ProzessForm>;
export type Richtung = 'rechts' | 'links' | 'unten' | 'oben';

export type TastenAktion =
  | { art: 'anlegen'; richtung: Richtung }
  | { art: 'formauswahl' }
  | { art: 'waehlen'; richtung: Richtung }
  | { art: 'schieben'; dx: number; dy: number }
  | { art: 'loeschen' } | { art: 'rueckgaengig' } | { art: 'wiederholen' }
  | { art: 'kopieren' } | { art: 'einfuegen' } | { art: 'duplizieren' } | { art: 'alles-waehlen' }
  | { art: 'benennen' } | { art: 'abbrechen' } | { art: 'ordnen' } | { art: 'hilfe' }
  // Werkstatt bau-fertig (22.10.): Enter öffnet das große Einstellungsfenster (F2 benennt direkt auf der Fläche), Zoom mit + − 0, Karte (Minimap) mit M.
  | { art: 'oeffnen' } | { art: 'zoom'; wie: 'groesser' | 'kleiner' | 'alles' } | { art: 'karte' };

/** Die Kürzel der Werkstatt (Hilfe-Fenster und Titel der Knöpfe). */
export const WERKSTATT_KUERZEL: readonly { taste: string; was: string }[] = [
  { taste: 'Alt + Pfeil', was: 'Verbundenen Schritt derselben Form in diese Richtung anlegen' },
  { taste: 'Tab', was: 'Formauswahl am gewählten Knoten (anhängen)' },
  { taste: 'Pfeile', was: 'Nachbarn wählen' },
  { taste: '⇧ + Pfeile', was: 'Gewählte verschieben' },
  { taste: 'Doppelklick · F2', was: 'Namen direkt auf der Fläche ändern' },
  { taste: 'Enter · zweiter Doppelklick', was: 'Großes Einstellungsfenster (Eingabe · Maske · Ausgabe)' },
  { taste: 'Entf', was: 'Löschen (das Freigabe-Schloss bleibt)' },
  { taste: '⌘ / Strg + Z · ⇧ + Z', was: 'Rückgängig · Wiederholen' },
  { taste: '⌘ / Strg + C · V · D', was: 'Kopieren · Einfügen · Duplizieren (mit Verbindungen)' },
  { taste: '⌘ / Strg + A', was: 'Alles wählen' },
  { taste: '⇧ + O', was: 'Ordnen' },
  { taste: '+ · − · 0', was: 'Vergrößern · Verkleinern · Alles zeigen' },
  { taste: 'M', was: 'Karte (Minimap) an/aus' },
  { taste: 'Esc', was: 'Auswahl aufheben, Fenster schließen' },
  { taste: '?', was: 'Diese Übersicht' },
];

const RICHTUNG: Readonly<Record<string, Richtung>> = { ArrowRight: 'rechts', ArrowLeft: 'links', ArrowDown: 'unten', ArrowUp: 'oben' };

/** Welche Taste was tut (rein). `befehl` = ⌘ am Mac, sonst Strg. Tasten in Eingabefeldern prüft der Aufrufer vorher. */
export function tasteZuAktion(e: { key: string; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }, mac = true): TastenAktion | null {
  const befehl = mac ? !!e.metaKey : !!e.ctrlKey;
  const r = RICHTUNG[e.key];
  if (r && e.altKey && !befehl) return { art: 'anlegen', richtung: r };
  if (r && e.shiftKey && !befehl) { const s = 20; return { art: 'schieben', dx: r === 'rechts' ? s : r === 'links' ? -s : 0, dy: r === 'unten' ? s : r === 'oben' ? -s : 0 }; }
  if (r && !befehl) return { art: 'waehlen', richtung: r };
  if (e.key === 'Tab' && !befehl && !e.altKey) return { art: 'formauswahl' };
  if (befehl) {
    const k = e.key.toLowerCase();
    if (k === 'z') return e.shiftKey ? { art: 'wiederholen' } : { art: 'rueckgaengig' };
    if (k === 'y') return { art: 'wiederholen' };
    if (k === 'c') return { art: 'kopieren' };
    if (k === 'v') return { art: 'einfuegen' };
    if (k === 'd') return { art: 'duplizieren' };
    if (k === 'a') return { art: 'alles-waehlen' };
    return null;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') return { art: 'loeschen' };
  if (e.key === 'F2') return { art: 'benennen' };
  if (e.key === 'Enter') return { art: 'oeffnen' };
  if (e.altKey) return null;
  if (e.key === '+' || e.key === '=') return { art: 'zoom', wie: 'groesser' };
  if (e.key === '-' || e.key === '_') return { art: 'zoom', wie: 'kleiner' };
  if (e.key === '0') return { art: 'zoom', wie: 'alles' };
  if (e.key === 'm' || e.key === 'M') return { art: 'karte' };
  if (e.key === 'Escape') return { art: 'abbrechen' };
  if (e.key === 'O' && e.shiftKey) return { art: 'ordnen' };
  if (e.key === '?') return { art: 'hilfe' };
  return null;
}

/** Der nächste Knoten in einer Richtung (rein): im Halbraum der Richtung, gewichtet nach Abstand und Abweichung von der Achse. */
export function nachbar(von: Box, andere: readonly (Box & { id: string })[], r: Richtung): string | null {
  const cx = von.x + von.b / 2, cy = von.y + von.h / 2;
  let best: { id: string; w: number } | null = null;
  for (const a of andere) {
    const ax = a.x + a.b / 2, ay = a.y + a.h / 2;
    const dx = ax - cx, dy = ay - cy;
    const vorn = r === 'rechts' ? dx : r === 'links' ? -dx : r === 'unten' ? dy : -dy;
    const quer = r === 'rechts' || r === 'links' ? Math.abs(dy) : Math.abs(dx);
    if (vorn <= 4) continue;
    const w = vorn + quer * 2;
    if (!best || w < best.w) best = { id: a.id, w };
  }
  return best?.id ?? null;
}

/** Was Alt+Pfeil an einem Knoten anlegt (rein): an welchem Ausgang bzw. davor, und in welche Bahn (null = dieselbe). */
export function altPfeil(k: Pick<K, 'form' | 'zweige'>, r: Richtung, bahnen: { darunter?: BahnSchluessel; darueber?: BahnSchluessel }): { ausgang?: Ausgang; vor?: true; bahn?: BahnSchluessel } | null {
  const f = k.form ?? 'schritt';
  if (f === 'ende' && r !== 'links') return null;
  if (r === 'links') return f === 'ausloeser' ? null : { vor: true };
  if (r === 'rechts') return { ausgang: f === 'entscheidung' ? 'ja' : 'weiter' };
  if (r === 'unten') {
    if (f === 'entscheidung' || f === 'freigabe') return k.zweige?.nein ? null : { ausgang: 'nein' };
    if (f === 'warten') return k.zweige?.abgelaufen ? null : { ausgang: 'abgelaufen' };
    return { ausgang: 'weiter', ...(bahnen.darunter ? { bahn: bahnen.darunter } : {}) };
  }
  return { ausgang: f === 'entscheidung' ? 'ja' : 'weiter', ...(bahnen.darueber ? { bahn: bahnen.darueber } : {}) };
}
