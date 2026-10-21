// ─── Prozesse — Entwurf und veröffentlichte Versionen (Etappe B1, 21.10.; ANALYSE_100.md Punkt 43) ────────────────────────────────────────────────
// Live läuft nur bewusst Veröffentlichtes (n8n 2.0, Zapier, Activepieces): die Fläche ist der ENTWURF (gespeichert mit Stand/409, läuft nie);
// „Veröffentlichen“ mit Name und Notiz legt eine unveränderliche Version an (Nummer +1); Versionen kann man ansehen, vergleichen und als Entwurf übernehmen.
// Neue Fälle laufen auf der jüngsten Version, laufende bleiben auf ihrer (Punkt 44, Motor). Rein und client-sicher; Tests: tests/prozesse-versionen.test.ts.

import { PROZESS_GRENZEN, PROZESS_TEXT, type ProzessDefinition, type ProzessEintrag, type ProzessForm, type ProzessKnoten, type ProzessVersion } from './definition';

type K = ProzessKnoten<ProzessForm>;
export type VersionErgebnis = { ok: true; eintrag: ProzessEintrag; version?: ProzessVersion } | { ok: false; status: 400 | 404 | 409 | 413; fehler: string };

/** Stabile Textform (Schlüssel sortiert) — für „unverändert?“ ohne Server-Fingerabdruck. */
function stabil(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
/** Inhalt einer Definition ohne Verwaltungsfelder (Fassung, Zeitstempel, wer) — für den Vergleich „hat sich etwas geändert?“. */
const inhalt = (d: ProzessDefinition) => { const { fassung: _f, geaendert: _g, geaendertVon: _v, ...rest } = d; return stabil(rest); };
/** Hat der Entwurf etwas, das die jüngste Version nicht hat? */
export const entwurfGeaendert = (e: Pick<ProzessEintrag, 'entwurf' | 'versionen'>): boolean => {
  const v = e.versionen.at(-1);
  return !v || inhalt(e.entwurf) !== inhalt(v.definition);
};
/** Die jüngste Version (oder null). */
export const juengsteVersion = (e: Pick<ProzessEintrag, 'versionen'>): ProzessVersion | null => e.versionen.at(-1) ?? null;
/** Eine Version kurz (Liste ohne Definition). */
export const versionKurz = (v: ProzessVersion) => ({ nr: v.nr, name: v.name, ...(v.notiz ? { notiz: v.notiz } : {}), am: v.am, von: v.von });

/**
 * Veröffentlichen (rein): eine neue, unveränderliche Version aus dem Entwurf — mit Name (Pflicht) und Notiz. Unverändert seit der letzten Version → 409;
 * über der Grenze → 413 (nie eine alte still entfernt). Die Prüfung (Befunde ohne `offen`/`fehler`) macht der Aufrufer vorher.
 */
export function veroeffentlichen(e: ProzessEintrag, a: { name: unknown; notiz?: unknown; von: string; jetzt: string }): VersionErgebnis {
  const name = typeof a.name === 'string' ? a.name.trim() : '';
  if (!name) return { ok: false, status: 400, fehler: 'Die Version braucht einen Namen.' };
  if (name.length > PROZESS_TEXT.versionName) return { ok: false, status: 413, fehler: `Name der Version höchstens ${PROZESS_TEXT.versionName} Zeichen.` };
  const notiz = typeof a.notiz === 'string' && a.notiz.trim() ? a.notiz.trim() : undefined;
  if (notiz && notiz.length > PROZESS_TEXT.notiz) return { ok: false, status: 413, fehler: `Notiz höchstens ${PROZESS_TEXT.notiz} Zeichen.` };
  if (!entwurfGeaendert(e)) return { ok: false, status: 409, fehler: `Seit Version ${e.versionen.at(-1)!.nr} hat sich nichts geändert.` };
  if (e.versionen.length >= PROZESS_GRENZEN.versionenJeProzess) return { ok: false, status: 413, fehler: `Höchstens ${PROZESS_GRENZEN.versionenJeProzess} Versionen je Prozess — nichts gespeichert.` };
  const nr = (e.versionen.at(-1)?.nr ?? 0) + 1;
  const definition: ProzessDefinition = JSON.parse(JSON.stringify({ ...e.entwurf, fassung: nr, geaendert: a.jetzt, geaendertVon: a.von }));
  const version: ProzessVersion = { nr, name, ...(notiz ? { notiz } : {}), am: a.jetzt, von: a.von, definition };
  return { ok: true, version, eintrag: { ...e, versionen: [...e.versionen, version], entwurf: { ...e.entwurf, fassung: nr + 1 } } };
}

/** Eine Version als Entwurf übernehmen (rein) — der Entwurf wird ersetzt (die Werkstatt fragt vorher), die Versionen bleiben. */
export function versionAlsEntwurf(e: ProzessEintrag, nr: unknown, a: { von: string; jetzt: string }): VersionErgebnis {
  const v = e.versionen.find(x => x.nr === nr);
  if (!v) return { ok: false, status: 404, fehler: 'Diese Version gibt es nicht.' };
  const entwurf: ProzessDefinition = JSON.parse(JSON.stringify({ ...v.definition, fassung: (e.versionen.at(-1)?.nr ?? 0) + 1, geaendert: a.jetzt, geaendertVon: a.von }));
  return { ok: true, eintrag: { ...e, entwurf, entwurfAm: a.jetzt, entwurfVon: a.von } };
}

// ── Vergleich ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Vergleich {
  /** Geänderte Felder des Steckbriefs (Name, Bereich, Fall, Eigner …). */
  steckbrief: string[];
  knoten: { neu: { id: string; titel: string }[]; weg: { id: string; titel: string }[]; geaendert: { id: string; titel: string; felder: string[] }[] };
  zettel: { neu: number; weg: number; geaendert: number };
}
const STECKBRIEF = ['titel', 'beschreibung', 'bereich', 'fallArt', 'eigner', 'laeuftAls', 'startKriterium', 'endKriterium', 'schnittstelle'] as const;
/** Felder eines Knotens, die nur Lage sind (zählen im Vergleich als „verschoben“, nicht als Inhalt). */
const NUR_LAGE = new Set(['pos', 'pfeilText', 'rang']);

/** Zwei Definitionen vergleichen (rein): Steckbrief-Felder, Knoten neu/weg/geändert (mit Feldnamen, nie Werte), Zettel. */
export function versionenVergleichen(a: ProzessDefinition, b: ProzessDefinition): Vergleich {
  const steckbrief = STECKBRIEF.filter(f => stabil(a[f]) !== stabil(b[f]));
  const alt = new Map<string, K>(a.knoten.map(k => [k.id, k]));
  const neu = new Map<string, K>(b.knoten.map(k => [k.id, k]));
  const knoten: Vergleich['knoten'] = { neu: [], weg: [], geaendert: [] };
  for (const [id, k] of neu) if (!alt.has(id)) knoten.neu.push({ id, titel: k.titel });
  for (const [id, k] of alt) if (!neu.has(id)) knoten.weg.push({ id, titel: k.titel });
  for (const [id, k] of neu) {
    const o = alt.get(id);
    if (!o) continue;
    const felder = Array.from(new Set([...Object.keys(o), ...Object.keys(k)])).filter(f => stabil((o as unknown as Record<string, unknown>)[f]) !== stabil((k as unknown as Record<string, unknown>)[f]));
    if (felder.length) knoten.geaendert.push({ id, titel: k.titel, felder: felder.map(f => (NUR_LAGE.has(f) ? `${f} (Lage)` : f)).sort() });
  }
  const za = new Map((a.zettel ?? []).map(z => [z.id, stabil(z)])), zb = new Map((b.zettel ?? []).map(z => [z.id, stabil(z)]));
  const zettel = {
    neu: [...zb.keys()].filter(x => !za.has(x)).length,
    weg: [...za.keys()].filter(x => !zb.has(x)).length,
    geaendert: [...zb.entries()].filter(([x, s]) => za.has(x) && za.get(x) !== s).length,
  };
  return { steckbrief: [...steckbrief], knoten, zettel };
}
