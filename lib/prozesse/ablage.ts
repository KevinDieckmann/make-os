// ─── Prozesse · Werkstatt — Kopieren und Einfügen zwischen Prozessen (22.10., „Werkstatt bau-fertig“ Punkt 13) ──────────────────────────────────────────────
// ⌘C in der Werkstatt legt die gewählten Schritte (mit ihren Verbindungen, lib/prozesse/werkstatt-aktionen.ts `kopieren`) auch in den Browser-Speicher — so lassen
// sie sich in einem ANDEREN Prozess einfügen (⌘V). Was dort liegt, läuft immer durch `ohnePersonen` (lib/prozesse/kopie.ts — dieselbe Regel wie „Als Vorlage
// speichern“): Personen in Masken → „Zuständig im Fall“, Konten leer, eigene Postfächer → Postfach des Laufs, Zettel ohne Verfasser. Beim Lesen wird jeder Knoten
// und Zettel noch einmal gesäubert (lib/prozesse/bestand.ts `knotenAus`) — der Browser-Speicher ist fremder Boden. Nie im Bestand, nie auf dem Server.
// Rein und client-sicher; Tests: tests/prozesse-werkstatt-ablage.test.ts.

import { knotenAus } from './bestand';
import { ohnePersonen } from './kopie';
import { PROZESS_GRENZEN, PROZESS_TEXT, ZETTEL_FARBEN, type NotizZettel, type ProzessDefinition, type ProzessForm, type ProzessKnoten } from './definition';
import type { Ablage } from './werkstatt-aktionen';

type K = ProzessKnoten<ProzessForm>;
export const ABLAGE_MERKER = 'make-werkstatt-ablage';
/** Wie alt eine Ablage höchstens sein darf (danach gilt sie als leer). */
export const ABLAGE_STUNDEN = 24;

export interface AblageImSpeicher { v: 1; am: string; quelle: string; ablage: Ablage; hinweise: string[] }

/** Eine Ablage für den Browser-Speicher (rein): ohne Personen (dieselbe Regel wie eigene Vorlagen), mit Herkunft und Zeit. */
export function ablageFuerSpeicher(a: Ablage, o: { quelle: string; jetzt: string }): AblageImSpeicher {
  const d = { id: o.quelle, art: 'paket', titel: '', knoten: a.knoten, ...(a.zettel.length ? { zettel: a.zettel } : {}), uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: '', geaendertVon: '' } as ProzessDefinition;
  const r = ohnePersonen(d);
  return { v: 1, am: o.jetzt, quelle: o.quelle, ablage: { knoten: r.definition.knoten as K[], zettel: r.definition.zettel ?? [] }, hinweise: r.hinweise };
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;
const zettelAus = (v: unknown): NotizZettel | null => {
  const o = v && typeof v === 'object' ? v as Record<string, unknown> : null;
  const p = o?.pos && typeof o.pos === 'object' ? o.pos as Record<string, unknown> : null;
  if (!o || typeof o.id !== 'string' || !ID.test(o.id) || typeof o.text !== 'string' || o.text.length > PROZESS_TEXT.zettel || !p || typeof p.x !== 'number' || typeof p.y !== 'number') return null;
  const farbe = (ZETTEL_FARBEN as readonly unknown[]).includes(o.farbe) ? o.farbe as NotizZettel['farbe'] : undefined;
  return { id: o.id, text: o.text, pos: { x: Math.round(p.x), y: Math.round(p.y), ...(typeof p.b === 'number' && p.b >= 160 && p.b <= 40_000 ? { b: p.b } : {}), ...(typeof p.h === 'number' && p.h >= 160 && p.h <= 40_000 ? { h: p.h } : {}) }, ...(farbe ? { farbe } : {}) };
};

/**
 * Den Browser-Speicher lesen (rein, robust): unlesbar, zu alt bzw. zu groß → null. Knoten durch den Säuberer des Bestands, Zettel ohne Verfasser, Schlösser und
 * Auslöser fallen weg (die Regel setzt Schlösser neu, ein Auslöser gehört an den Anfang) — und noch einmal `ohnePersonen`.
 */
export function ablageAus(roh: string | null, jetzt: string): AblageImSpeicher | null {
  if (!roh) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(roh) as Record<string, unknown>; } catch { return null; }
  if (!o || o.v !== 1 || typeof o.am !== 'string' || typeof o.quelle !== 'string') return null;
  const alter = Date.parse(jetzt) - Date.parse(o.am);
  if (!Number.isFinite(alter) || alter < 0 || alter > ABLAGE_STUNDEN * 3_600_000) return null;
  const a = o.ablage && typeof o.ablage === 'object' ? o.ablage as Record<string, unknown> : null;
  const kn = Array.isArray(a?.knoten) ? a!.knoten : [];
  const zt = Array.isArray(a?.zettel) ? a!.zettel : [];
  if (kn.length > PROZESS_GRENZEN.knotenJeProzess || zt.length > PROZESS_GRENZEN.zettel) return null;
  const knoten = kn.map(x => (x && typeof x === 'object' ? knotenAus(x as Record<string, unknown>) : null)).filter((k): k is K => !!k && !k.schloss && k.form !== 'ausloeser');
  const zettel = zt.map(zettelAus).filter((z): z is NotizZettel => !!z);
  if (!knoten.length && !zettel.length) return null;
  return ablageFuerSpeicher({ knoten, zettel }, { quelle: o.quelle, jetzt: o.am });
}
