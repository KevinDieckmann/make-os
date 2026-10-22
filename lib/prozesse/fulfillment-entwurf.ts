// ─── Prozesse × Fulfillment — der Entwurf eines Pakets in der Werkstatt (22.10., Fulfillment in die Werkstatt E2/E3; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──
// Weg A (Entscheidung 22.10.): die Werkstatt ist der Editor der Pakete, ausgeführt wird weiter im Fall; EINE Wahrheit bleibt `fulfillment--<h>`. Der Entwurf liegt dort
// im optionalen Feld `entwuerfe[<paket>]` (lib/fulfillment/typen.ts `PaketEntwurf`) — nie eine Kopie in `prozesse--<h>`. Rein, EINE Stelle für:
//   · `paketEntwurfVon`        die Fassung, an der die Werkstatt arbeitet (Entwurf, sonst das Paket) und ihr Stand
//   · `paketEntwurfAnwenden`   einen Entwurf speichern — Stand/409, Fulfillment-Modus + Verlust-Wächter (`paketAusDefinition`), Struktur nach der Regel des Fulfillments
//                              (`vorlageStrukturPruefen`); gleich dem Paket → kein Entwurf; unverändert → nichts geschrieben
//   · `paketEntwurfVerwerfen`  den Entwurf löschen (das Paket bleibt, wie es ist)
// Die Bearbeitung selbst (Schritt anlegen, Bausteine, Bestätigung, Zweige …) rechnet die Werkstatt im Browser mit den Regeln des Fulfillment-Editors
// (lib/fulfillment/prozesse/editor.ts `editorAnwenden`) — dieselben Strukturregeln, nichts nachgebaut. Laufende Fälle sehen einen Entwurf nie.

import type { AnwendenErgebnis, PaketEntwurf, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';
import type { Befund, ProzessDefinition } from './definition';
import { definitionAus } from './bestand';
import { paketAusDefinition } from './fulfillment-modus';
import { vorlageStrukturPruefen } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';

export interface EntwurfKontext { person: string; jetzt: string; standVon: (x: object) => string }

/** Die Fassung, an der die Werkstatt arbeitet: der Entwurf, sonst das Paket (null = kein Paket). */
export function paketEntwurfVon(d: Pick<VorlagenDatei, 'prozesse' | 'entwuerfe'>, paketId: string): { vorlage: ProzessVorlage; entwurf: PaketEntwurf | null; paket: ProzessVorlage } | null {
  const paket = d.prozesse.find(p => p.id === paketId && p.art === 'paket');
  if (!paket) return null;
  const e = d.entwuerfe?.[paketId] ?? null;
  return { vorlage: e?.vorlage ?? paket, entwurf: e, paket };
}

/** Zwei Fassungen inhaltlich gleich (ohne Zeitstempel, Person und Fassungsnummer)? */
export function gleicheFassung(a: ProzessVorlage, b: ProzessVorlage): boolean {
  const ohne = ({ geaendert: _g, geaendertVon: _v, fassung: _f, ...r }: ProzessVorlage) => r;
  return JSON.stringify(ohne(a)) === JSON.stringify(ohne(b));
}

export type EntwurfErgebnis = AnwendenErgebnis<VorlagenDatei> & { befunde?: Befund[] };
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string, x: { befunde?: Befund[]; konflikte?: { id: string; stand: string }[] } = {}): EntwurfErgebnis => ({ ok: false, status, fehler, ...x });

/**
 * Einen Entwurf speichern (rein, alles oder nichts). `eingabe` = `{ paketId, stand, vorlage }` — `stand` = Stand der Fassung, die die Werkstatt geladen hat (Entwurf bzw.
 * Paket; veraltet → 409 mit dem aktuellen Stand), `vorlage` = die ganze Fassung aus dem Browser (roh). Unterwegs: der Säuberer der Werkstatt (verliert nichts),
 * Fulfillment-Modus und Verlust-Wächter, die Struktur nach der Regel des Fulfillments. Kennung, Art und Fassungsnummer kommen nie aus dem Browser.
 */
export function paketEntwurfAnwenden(d: VorlagenDatei, eingabe: unknown, k: EntwurfKontext): EntwurfErgebnis {
  const e = (eingabe && typeof eingabe === 'object' ? eingabe : {}) as { paketId?: unknown; stand?: unknown; vorlage?: unknown };
  if (typeof e.paketId !== 'string') return nein(400, 'Welches Paket?');
  const x = paketEntwurfVon(d, e.paketId);
  if (!x) return nein(404, 'Dieses Paket gibt es nicht (mehr).');
  const aktuell = k.standVon(x.vorlage);
  if (e.stand !== aktuell) return nein(409, 'Inzwischen hat jemand anders an diesem Paket gearbeitet — deine Fassung bleibt hier.', { konflikte: [{ id: x.paket.id, stand: aktuell }] });
  if (!e.vorlage || typeof e.vorlage !== 'object' || Array.isArray(e.vorlage)) return nein(400, 'Die Fassung fehlt.');
  const roh = { ...(e.vorlage as Record<string, unknown>), id: x.paket.id, art: 'paket', fassung: x.paket.fassung, geaendert: x.paket.geaendert, geaendertVon: x.paket.geaendertVon };
  const def = definitionAus(roh) as ProzessDefinition | null;
  if (!def) return nein(400, 'Die Fassung ist unlesbar (Titel fehlt).');
  const r = paketAusDefinition(def);
  if (!r.ok) return nein(400, r.befunde[0]?.text ?? 'Das Paket trägt etwas, das der Fall nicht ausführt.', { befunde: r.befunde });
  try { vorlageStrukturPruefen(r.vorlage, d); } catch (f) { return nein(400, f instanceof Error ? f.message : 'Die Struktur ist nicht gültig.'); }
  const entwuerfe = { ...(d.entwuerfe ?? {}) };
  if (gleicheFassung(r.vorlage, x.paket)) delete entwuerfe[x.paket.id];
  else if (x.entwurf && gleicheFassung(r.vorlage, x.entwurf.vorlage)) return { ok: true, datei: d, geaendert: [] };
  else {
    entwuerfe[x.paket.id] = {
      vorlage: { ...r.vorlage, fassung: x.paket.fassung, geaendert: k.jetzt, geaendertVon: k.person },
      basisFassung: x.entwurf?.basisFassung ?? x.paket.fassung, basisStand: x.entwurf?.basisStand ?? k.standVon(x.paket), am: k.jetzt, von: k.person,
    };
  }
  const { entwuerfe: _alt, ...rest } = d;
  return { ok: true, datei: Object.keys(entwuerfe).length ? { ...rest, entwuerfe } : rest, geaendert: [x.paket.id] };
}

/** Den Entwurf verwerfen (rein) — das Paket bleibt, wie es ist. Ohne Entwurf: nichts geändert. */
export function paketEntwurfVerwerfen(d: VorlagenDatei, paketId: unknown): EntwurfErgebnis {
  if (typeof paketId !== 'string' || !d.entwuerfe?.[paketId]) return { ok: true, datei: d, geaendert: [] };
  const { [paketId]: _weg, ...uebrig } = d.entwuerfe;
  const { entwuerfe: _alt, ...rest } = d;
  return { ok: true, datei: Object.keys(uebrig).length ? { ...rest, entwuerfe: uebrig } : rest, geaendert: [paketId] };
}
