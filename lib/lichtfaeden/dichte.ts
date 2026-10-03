// ─── Lichtfäden — wie dicht ist eine Woche? (03.10.2026, rein) ──────────────
// Der Zeitstrahl der Jahresplanung zeigt je Ziel ein Bündel Lichtfäden. Wie weit ein Bündel in einer Woche auffächert
// und wie hell es dort leuchtet, kommt aus ECHTEN Daten — nie geraten, nie zufällig:
//
//   Gewicht je Woche (DICHTE_GEWICHT), dem Bündel seines Ziels zugeordnet:
//     · offener Meilenstein, fällig in der Woche ............ 3   (erledigter: 1 — leise Spur)
//     · Ziel mit Frist (ohne eigenen Kaskaden-Meilenstein) .. 3
//     · offene Aufgabe mit Fälligkeit ........................ 1   (dringend/hoch: 1,5)
//     · Termin (optional) .................................... 0,5
//   Zuordnung: Meilenstein → `zielVonMeilenstein` (Ziel-Bezug, sonst Kaskade); Aufgabe → über die Liste ihres
//   Meilensteins (`meilensteinListeId`, EINE Quelle wie überall); alles ohne Ziel und Termine → Bündel „ohne Ziel“.
//   Dann je Bündel Gauß-geglättet (σ = 2 Wochen, gerechnet mit 7 Wochen Rand, damit die Ränder des Fensters stimmen)
//   und weich gesättigt (geglättetes Gewicht 0,6 → halbe Dichte; ein einzelner offener Meilenstein ≈ 0,5): eine Frist
//   leuchtet, zehn sprengen das Band nicht.
//
// Deterministisch: gleiche Daten = gleiche Zahlen (und mit der Saat aus der Ziel-Kennung dasselbe Bild).
// Tests: tests/lichtfaeden.test.ts.

import { gauss, saettigen } from './band';
import { zielVonMeilenstein, meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';
import type { SpaceId } from '@/lib/make-one/space-regeln';

export const DICHTE_GEWICHT = {
  meilensteinOffen: 3,
  meilensteinErledigt: 1,
  zielFrist: 3,
  aufgabe: 1,
  aufgabeDringend: 1.5,
  termin: 0.5,
} as const;
/** Glättung in Wochen. */
export const DICHTE_SIGMA = 2;
/** Geglättetes Gewicht, bei dem ein Bündel halb aufgefächert ist. */
export const DICHTE_HALB = 0.6;
/** Höchstens so viele Ziel-Bündel — der Rest fließt ins Bündel „ohne Ziel“ (dann „Weitere & ohne Ziel“). */
export const MAX_ZIEL_BUENDEL = 6;
/** Kennung des Bündels ohne Ziel. */
export const OHNE_ZIEL = 'ohne';

const RAND = Math.ceil(DICHTE_SIGMA * 3) + 1;
const TAG = /^\d{4}-\d{2}-\d{2}$/;

export type DichteZiel = Pick<Ziel, 'id' | 'titel'> & Partial<Pick<Ziel, 'rang' | 'space' | 'termin' | 'erledigt'>>;
export type DichteMeilenstein = Pick<Meilenstein, 'id' | 'faellig' | 'erledigt'> & Partial<Pick<Meilenstein, 'zielId' | 'abgeleitetVon'>>;
export interface DichteAufgabe { dueDate?: string; status: string; priority?: string; listeId?: string }
export interface DichteTermin { datum: string; gewicht?: number }

export interface FadenBuendelDaten {
  /** Ziel-Kennung oder OHNE_ZIEL. */
  id: string;
  zielId: string | null;
  titel: string;
  space?: SpaceId;
  /** Gewicht je Woche (ungeglättet) — für Text und Nachvollzug. */
  roh: number[];
  /** Dichte je Woche 0 … 1 (geglättet, gesättigt) — treibt Spreizung und Leuchten. */
  dichte: number[];
  /** Summe der Gewichte im Fenster. */
  summe: number;
}
export interface FaedenDichte {
  /** Montag jeder Woche im Fenster (YYYY-MM-DD). */
  wochen: string[];
  buendel: FadenBuendelDaten[];
  /** Summe aller Gewichte je Woche. */
  gesamt: number[];
}

const tagMs = (t: string) => Date.parse(`${t}T00:00:00Z`);
const tagAus = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Montag der Woche eines Tages. */
export function montag(tag: string): string {
  const ms = tagMs(tag);
  const wt = (new Date(ms).getUTCDay() + 6) % 7;
  return tagAus(ms - wt * 864e5);
}

/**
 * Dichte je Woche und Ziel im Zeitraum (siehe Kopf). `ziele` = die Ziele, die als Bündel erscheinen (Reihenfolge nach
 * Rang, dann Titel); Meilensteine/Aufgaben anderer Ziele landen im Bündel „ohne Ziel“.
 */
export function faedenDichte(
  ziele: readonly DichteZiel[],
  meilensteine: readonly DichteMeilenstein[],
  aufgaben: readonly DichteAufgabe[],
  termine: readonly DichteTermin[] | undefined,
  zeitraum: { von: string; bis: string },
): FaedenDichte {
  const wochen: string[] = [];
  if (!TAG.test(zeitraum.von) || !TAG.test(zeitraum.bis) || zeitraum.bis < zeitraum.von) return { wochen, buendel: [], gesamt: [] };
  const m0 = montag(zeitraum.von);
  for (let ms = tagMs(m0), i = 0; tagAus(ms) <= zeitraum.bis && i < 600; ms += 7 * 864e5, i++) wochen.push(tagAus(ms));
  const n = wochen.length, laenge = n + 2 * RAND;
  const basis = tagMs(m0) - RAND * 7 * 864e5;
  const index = (tag: string | undefined): number => {
    if (!tag || !TAG.test(tag)) return -1;
    const i = Math.floor((tagMs(tag) - basis) / (7 * 864e5));
    return i >= 0 && i < laenge ? i : -1;
  };

  // Bündel: Ziele nach Rang, dann Titel (stabil); über MAX hinaus → „ohne Ziel“.
  const sortiert = [...ziele].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.titel.localeCompare(b.titel, 'de') || a.id.localeCompare(b.id));
  const eigene = sortiert.slice(0, MAX_ZIEL_BUENDEL);
  const ueberzaehlig = sortiert.length > MAX_ZIEL_BUENDEL;
  const roh = new Map<string, number[]>();
  for (const z of eigene) roh.set(z.id, new Array<number>(laenge).fill(0));
  roh.set(OHNE_ZIEL, new Array<number>(laenge).fill(0));
  const buendelVon = (zielId: string | undefined): string => (zielId && roh.has(zielId) ? zielId : OHNE_ZIEL);
  const add = (b: string, i: number, g: number) => { if (i >= 0) roh.get(b)![i] += g; };

  const msNachListe = new Map<string, DichteMeilenstein>();
  const mitKaskade = new Set<string>();
  for (const m of meilensteine) {
    msNachListe.set(meilensteinListeId(m.id), m);
    if (m.abgeleitetVon) mitKaskade.add(m.abgeleitetVon);
    add(buendelVon(zielVonMeilenstein(m)), index(m.faellig), m.erledigt ? DICHTE_GEWICHT.meilensteinErledigt : DICHTE_GEWICHT.meilensteinOffen);
  }
  for (const z of ziele) {
    if (z.erledigt || !z.termin || mitKaskade.has(z.id)) continue;
    add(buendelVon(z.id), index(z.termin), DICHTE_GEWICHT.zielFrist);
  }
  for (const a of aufgaben) {
    if (a.status === 'done' || a.status === 'cancelled') continue;
    const m = a.listeId ? msNachListe.get(a.listeId) : undefined;
    const g = a.priority === 'critical' || a.priority === 'high' ? DICHTE_GEWICHT.aufgabeDringend : DICHTE_GEWICHT.aufgabe;
    add(m ? buendelVon(zielVonMeilenstein(m)) : OHNE_ZIEL, index(a.dueDate), g);
  }
  for (const t of termine ?? []) add(OHNE_ZIEL, index(t.datum), t.gewicht ?? DICHTE_GEWICHT.termin);

  const schneiden = (w: number[]) => w.slice(RAND, RAND + n);
  const daten = (id: string, zielId: string | null, titel: string, space?: SpaceId): FadenBuendelDaten => {
    const r = roh.get(id)!;
    const geglaettet = gauss(r, DICHTE_SIGMA);
    const rohIn = schneiden(r);
    return { id, zielId, titel, ...(space ? { space } : {}), roh: rohIn, dichte: schneiden(geglaettet).map(v => saettigen(v, DICHTE_HALB)), summe: rohIn.reduce((s, v) => s + v, 0) };
  };
  const buendel = eigene.map(z => daten(z.id, z.id, z.titel, z.space));
  const ohne = daten(OHNE_ZIEL, null, ueberzaehlig ? 'Weitere & ohne Ziel' : 'Ohne Ziel');
  if (ohne.summe > 0 || !buendel.length) buendel.push(ohne);
  const gesamt = wochen.map((_, i) => buendel.reduce((s, b) => s + b.roh[i], 0));
  return { wochen, buendel, gesamt };
}

const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

/** Das Textäquivalent fürs Band (Screenreader): je Bündel, wann es am dichtesten ist. */
export function lichtText(d: FaedenDichte): string {
  if (!d.buendel.length) return 'Lichtfäden: keine Ziele und nichts Terminiertes im Zeitraum.';
  const teile = d.buendel.map(b => {
    const name = b.zielId ? `Ziel „${b.titel}“` : b.titel;
    if (!(b.summe > 0)) return `${name}: ruhig, nichts terminiert`;
    let best = 0;
    b.dichte.forEach((v, i) => { if (v > b.dichte[best]) best = i; });
    return `${name}: am dichtesten in der Woche ab ${kurz(d.wochen[best])}`;
  });
  return `Lichtfäden, je Ziel ein Bündel — breit und hell, wo Meilensteine und Aufgaben fällig sind. ${teile.join('. ')}.`;
}
