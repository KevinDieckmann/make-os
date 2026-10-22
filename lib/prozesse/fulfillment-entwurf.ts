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
import { mitWerkstattMarke } from '@/lib/fulfillment/prozesse/werkstatt-marke';
import { tagVon } from '@/lib/zeit';

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

export type EntwurfErgebnis = AnwendenErgebnis<VorlagenDatei> & { befunde?: Befund[]; paketGeaendert?: true; fassung?: number };
const nein = (status: 400 | 403 | 404 | 409 | 413, fehler: string, x: { befunde?: Befund[]; konflikte?: { id: string; stand: string }[]; paketGeaendert?: true } = {}): EntwurfErgebnis => ({ ok: false, status, fehler, ...x });

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
  // E4 (22.10., F4): mit dem ersten Entwurf gehört das Paket der Werkstatt — Marke `werkstatt:<paket>` (der alte Editor zeigt es dann nur noch an).
  const marken = entwuerfe[x.paket.id] ? mitWerkstattMarke(d.marken, x.paket.id, tagVon(k.jetzt)) : d.marken;
  return { ok: true, datei: Object.keys(entwuerfe).length ? { ...rest, marken, entwuerfe } : { ...rest, marken }, geaendert: [x.paket.id] };
}

/** Die Marke mit Name und Notiz einer veröffentlichten Fassung (der Fulfillment-Bestand kennt keine Versionen — die Notiz steht in `marken`). */
export const fassungNotizMarke = (paketId: string, fassung: number): string => `fassung-notiz:${paketId}:${fassung}`;
const NAME_MAX = 80, NOTIZ_MAX = 500;

/**
 * Den Entwurf veröffentlichen (rein, E3): er wird die NEUE Fassung des Pakets (Fassung + 1) — über dieselbe Prüfung wie beim Speichern (Fulfillment-Modus, Verlust-
 * Wächter, Struktur). Stand des Entwurfs veraltet → 409; wurde das Paket seit Beginn des Entwurfs anders gespeichert (z. B. im alten Editor) → 409 `paketGeaendert`
 * — nur mit `trotzdem: true` ersetzt der Entwurf es (die Werkstatt fragt ausdrücklich). Laufende Fälle ändern sich NICHT: jeder Kunde übernimmt per Klick
 * (`vorlageUebernehmen`, F2). Name und Notiz → Marke `fassung-notiz:<paket>:<n>`.
 */
export function paketVeroeffentlichen(d: VorlagenDatei, eingabe: unknown, k: EntwurfKontext): EntwurfErgebnis {
  const e = (eingabe && typeof eingabe === 'object' ? eingabe : {}) as { paketId?: unknown; stand?: unknown; name?: unknown; notiz?: unknown; trotzdem?: unknown };
  if (typeof e.paketId !== 'string') return nein(400, 'Welches Paket?');
  const x = paketEntwurfVon(d, e.paketId);
  if (!x) return nein(404, 'Dieses Paket gibt es nicht (mehr).');
  if (!x.entwurf) return nein(409, 'Es gibt keinen Entwurf zum Veröffentlichen.');
  const aktuell = k.standVon(x.entwurf.vorlage);
  if (e.stand !== aktuell) return nein(409, 'Der Entwurf wurde inzwischen geändert — bitte neu laden.', { konflikte: [{ id: x.paket.id, stand: aktuell }] });
  if (k.standVon(x.paket) !== x.entwurf.basisStand && e.trotzdem !== true) {
    return nein(409, 'Das Paket wurde seit Beginn dieses Entwurfs anders gespeichert — beim Veröffentlichen ersetzt der Entwurf diese Änderungen.', { paketGeaendert: true });
  }
  const name = typeof e.name === 'string' ? e.name.trim() : '', notiz = typeof e.notiz === 'string' ? e.notiz.trim() : '';
  if (name.length > NAME_MAX) return nein(413, `Name: höchstens ${NAME_MAX} Zeichen.`);
  if (notiz.length > NOTIZ_MAX) return nein(413, `Notiz: höchstens ${NOTIZ_MAX} Zeichen.`);
  const r = paketAusDefinition(x.entwurf.vorlage as ProzessDefinition);
  if (!r.ok) return nein(400, r.befunde[0]?.text ?? 'Das Paket trägt etwas, das der Fall nicht ausführt.', { befunde: r.befunde });
  try { vorlageStrukturPruefen(r.vorlage, d); } catch (f) { return nein(400, f instanceof Error ? f.message : 'Die Struktur ist nicht gültig.'); }
  if (gleicheFassung(r.vorlage, x.paket)) return nein(409, 'Der Entwurf ist gleich dem Paket — es gibt nichts zu veröffentlichen.');
  const fassung = x.paket.fassung + 1;
  const neu: ProzessVorlage = { ...r.vorlage, fassung, geaendert: k.jetzt, geaendertVon: k.person };
  const { [x.paket.id]: _weg, ...uebrig } = d.entwuerfe ?? {};
  const { entwuerfe: _alt, ...rest } = d;
  const mitNotiz = name || notiz ? { ...d.marken, [fassungNotizMarke(x.paket.id, fassung)]: [name, notiz].filter(Boolean).join(' — ') } : d.marken;
  const marken = mitWerkstattMarke(mitNotiz, x.paket.id, tagVon(k.jetzt));
  return {
    ok: true, fassung, geaendert: [x.paket.id],
    datei: { ...rest, prozesse: d.prozesse.map(p => (p.id === x.paket.id ? neu : p)), marken, ...(Object.keys(uebrig).length ? { entwuerfe: uebrig } : {}) },
  };
}

/** Den Entwurf verwerfen (rein) — das Paket bleibt, wie es ist. Ohne Entwurf: nichts geändert. */
export function paketEntwurfVerwerfen(d: VorlagenDatei, paketId: unknown): EntwurfErgebnis {
  if (typeof paketId !== 'string' || !d.entwuerfe?.[paketId]) return { ok: true, datei: d, geaendert: [] };
  const { [paketId]: _weg, ...uebrig } = d.entwuerfe;
  const { entwuerfe: _alt, ...rest } = d;
  return { ok: true, datei: Object.keys(uebrig).length ? { ...rest, entwuerfe: uebrig } : rest, geaendert: [paketId] };
}
