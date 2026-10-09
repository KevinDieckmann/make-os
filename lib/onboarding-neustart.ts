// ─── MAKE OS — Einrichtung im Neustart: die Marke lesen (Server, 09.10.) ───────────────────────────────────────────────────────────────
// Kevin 09.10.: „Wir fangen bei 0 an … Wir sind ein komplett ‚neuer‘ Kunde und wollen als Paar geonboardet werden.“ Der Neustart-Umzug (eigenes
// Skript eines anderen Pakets) legt im Datenordner die Marke `system/neustart.json` ab — Klartext wie die übrigen Dateien unter `system/`, nur
// Datum und Zähler, nie Inhalte. Trägt die Instanz sie (oder ist sie ausdrücklich so eingestellt: `MAKE_OS_EINRICHTUNG=neustart`), gilt in der
// Einrichtung der Neustart-Ablauf (lib/make-one/onboarding-data.ts `fassungFuer`) und es gibt keinen Altbestand. Ohne Marke: alles wie bisher.
//
// Vertrag mit dem Umzug — tolerant gelesen: die Datei GIBT es (dann Neustart, auch wenn sie unlesbar ist); optional ein Tag (`am`, `datum`,
// `tag`, `zeit` …, JJJJ-MM-TT am Anfang) und Zähler (`zaehler` | `zahlen` | `anzahl` | `uebernommen`: Name → Zahl ≥ 0). Andere Felder werden
// nie gelesen. Lesen schreibt nie.

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner } from '@/lib/store/local-db';

/** Pfad der Marke relativ zum Datenordner. */
export const NEUSTART_MARKE = path.join('system', 'neustart.json');

export interface NeustartMarke {
  /** Tag des Neustarts (JJJJ-MM-TT) oder null, wenn die Marke keinen trägt. */
  am: string | null;
  /** Was der Umzug übernommen hat — nur Zähler (Name → Anzahl), höchstens sechs. */
  zaehler: Record<string, number>;
}

const TAG_FELDER = ['am', 'datum', 'tag', 'zeit', 'neustartAm', 'erstellt', 'angelegt'] as const;
const ZAEHLER_FELDER = ['zaehler', 'zahlen', 'anzahl', 'uebernommen'] as const;
const NAME = /^[a-z][a-z0-9-]{0,30}$/i;
const objekt = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null);

/** Die Marke aus dem Rohtext (rein): unlesbar → Neustart ohne Angaben; nur Tag und Zähler werden übernommen. */
export function neustartAusText(roh: string): NeustartMarke {
  let j: Record<string, unknown> | null = null;
  try { j = objekt(JSON.parse(roh)); } catch { /* unlesbar — die Marke gilt trotzdem */ }
  if (!j) return { am: null, zaehler: {} };
  const tag = TAG_FELDER.map(k => j![k]).find((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
  const z = ZAEHLER_FELDER.map(k => objekt(j![k])).find(Boolean) ?? {};
  const zaehler = Object.fromEntries(Object.entries(z).filter(([k, v]) => NAME.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0).slice(0, 6).map(([k, v]) => [k, Math.round(v as number)]));
  return { am: tag ? tag.slice(0, 10) : null, zaehler };
}

/** Trägt die Instanz die Marke des Neustarts (bzw. die Einstellung)? null = nein. Lesen schreibt nie. */
export async function neustartMarke(): Promise<NeustartMarke | null> {
  try {
    return neustartAusText(await fs.readFile(path.join(datenOrdner(), NEUSTART_MARKE), 'utf8'));
  } catch (e) {
    const fehlt = (e as NodeJS.ErrnoException)?.code === 'ENOENT';
    if (!fehlt) return { am: null, zaehler: {} }; // da, aber nicht lesbar — die Marke gilt
    return process.env.MAKE_OS_EINRICHTUNG === 'neustart' ? { am: null, zaehler: {} } : null;
  }
}

const NAMEN: Readonly<Record<string, [string, string]>> = {
  konten: ['Konto', 'Konten'], kontakte: ['Kontakt', 'Kontakte'], firmen: ['Firma', 'Firmen'], aufgaben: ['Aufgabe', 'Aufgaben'],
  projekte: ['Projekt', 'Projekte'], deals: ['Deal', 'Deals'], mandate: ['Mandat', 'Mandate'], produkte: ['Produkt', 'Produkte'],
  angebote: ['Angebot', 'Angebote'], events: ['Event', 'Events'], dateien: ['Datei', 'Dateien'], bestaende: ['Bestand', 'Bestände'],
};
const tagText = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** Der Satz für die Einrichtung (rein): „Neustart vom 09.10.2026 · 412 Kontakte · 87 Aufgaben übernommen“ — nur Tag und Zähler. */
export function neustartSatz(m: NeustartMarke): string {
  const teile = Object.entries(m.zaehler).map(([k, v]) => { const n = NAMEN[k.toLowerCase()]; return `${v} ${n ? (v === 1 ? n[0] : n[1]) : k}`; });
  const kopf = m.am ? `Neustart vom ${tagText(m.am)}` : 'Neustart';
  return teile.length ? `${kopf} · ${teile.join(' · ')} übernommen` : kopf;
}
