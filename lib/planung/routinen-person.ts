// ─── MAKE OS — Routinen 2: was je Person an Routinen hängt (rein, 10.10.) ─────────────────────────────────────────────────────
// Rückmeldung aus dem Onboarding (10.10.): Zähler („8 Gläser“), mehrmals täglich, Erinnerungen. Die Routinen selbst sind geteilt
// (`routinen`); was EINER Person gehört, liegt in IHREM Bestand `routinen-person--<person>` (immer mit Suffix):
//   zaehler   Tag → Routine → wie oft (nur Routinen mit Tagesziel ≥ 2). Der Haken im `health-log` bleibt die Wahrheit für
//             „erledigt“: er steht, sobald das Tagesziel erreicht ist — alle bisherigen Leser (Quote, Index, Gesundheit) zählen so
//             weiter richtig, ohne den Zähler zu kennen.
//   handy     Erinnerungen auch aufs Handy (Einstellung der Person, Vorgabe aus) — neutral, ohne Namen der Routine.
//   erinnert  Riegel der Handy-Erinnerungen (Tag → `routine@HH:MM`), nur die letzten Tage.
//   bloecke   Kalender-Blöcke, die MAKE OS für Routinen dieser Person angelegt hat (UID → Routine + Tag) — zum Nachziehen/Entfernen.
// Art. 9: Zähler von Gesundheits-Routinen sind Gesundheitsdaten (Register wie `health-log`). Tests: tests/routinen-2-haken.test.ts.

import type { ZaehlerLog } from './routinen';

export const ROUTINEN_PERSON_BASIS = 'routinen-person';
const PERSON_OK = /^[a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const KENNUNG = /^[A-Za-z0-9_-]{1,60}$/;
const UID = /^[A-Za-z0-9._@-]{1,200}$/;

/** Bestandsname je Person — immer mit Suffix (auch beim Erstkonto). */
export function routinenPersonName(person: string): string {
  if (!PERSON_OK.test(person)) throw new Error('[routinen-person] Person ungültig');
  return `${ROUTINEN_PERSON_BASIS}--${person}`;
}

export interface RoutinenPersonStand {
  zaehler?: ZaehlerLog;
  handy?: boolean;
  erinnert?: Record<string, string[]>;
  bloecke?: Record<string, { r: string; tag: string }>;
}

/** Höchster Zählerstand je Tag (wer mehr will, bekommt 400). */
export const ZAEHLER_MAX = 99;

/** Was von der Platte kommt, tolerant lesen — Unbrauchbares fällt weg, nie der ganze Bestand. */
export function personStandSaeubern(roh: unknown): RoutinenPersonStand {
  const o = (roh && typeof roh === 'object' && !Array.isArray(roh) ? roh : {}) as Record<string, unknown>;
  const aus: RoutinenPersonStand = {};
  if (o.zaehler && typeof o.zaehler === 'object') {
    const z: ZaehlerLog = {};
    for (const [tag, je] of Object.entries(o.zaehler as Record<string, unknown>)) {
      if (!TAG.test(tag) || !je || typeof je !== 'object') continue;
      const tagZ: Record<string, number> = {};
      for (const [id, n] of Object.entries(je as Record<string, unknown>)) if (KENNUNG.test(id) && Number.isInteger(n) && (n as number) > 0 && (n as number) <= ZAEHLER_MAX) tagZ[id] = n as number;
      if (Object.keys(tagZ).length) z[tag] = tagZ;
    }
    if (Object.keys(z).length) aus.zaehler = z;
  }
  if (o.handy === true) aus.handy = true;
  if (o.erinnert && typeof o.erinnert === 'object') {
    const e: Record<string, string[]> = {};
    for (const [tag, l] of Object.entries(o.erinnert as Record<string, unknown>)) if (TAG.test(tag) && Array.isArray(l)) e[tag] = l.filter((x): x is string => typeof x === 'string' && x.length <= 80);
    if (Object.keys(e).length) aus.erinnert = e;
  }
  if (o.bloecke && typeof o.bloecke === 'object') {
    const b: Record<string, { r: string; tag: string }> = {};
    for (const [uid, v] of Object.entries(o.bloecke as Record<string, unknown>)) {
      const x = v as { r?: unknown; tag?: unknown };
      if (UID.test(uid) && x && typeof x.r === 'string' && KENNUNG.test(x.r) && typeof x.tag === 'string' && TAG.test(x.tag)) b[uid] = { r: x.r, tag: x.tag };
    }
    if (Object.keys(b).length) aus.bloecke = b;
  }
  return aus;
}

/** Ein Haken an einer Routine: an/aus (einfacher Haken bzw. Tagesziel voll/leer), plus/minus (Zähler), setzen (Zähler auf n). */
export type HakenOp = { art: 'an' } | { art: 'aus' } | { art: 'plus'; n?: number } | { art: 'minus'; n?: number } | { art: 'setzen'; n: number };

/** Der neue Zählerstand — 0 … ZAEHLER_MAX. `an` füllt bis zum Tagesziel auf (mehr bleibt stehen), `aus` leert. */
export function zaehlerNeu(alt: number, op: HakenOp, ziel: number): number {
  const n = (x: number | undefined) => (Number.isInteger(x) && (x as number) > 0 ? (x as number) : 1);
  switch (op.art) {
    case 'an': return Math.max(alt, ziel);
    case 'aus': return 0;
    case 'plus': return Math.min(ZAEHLER_MAX, alt + n(op.n));
    case 'minus': return Math.max(0, alt - n(op.n));
    case 'setzen': return Math.max(0, Math.min(ZAEHLER_MAX, Math.trunc(op.n)));
  }
}

/** Eingabe aus einer Anfrage lesen (Route, Werkzeug): `erledigt` (bisher) oder `zaehler` ('plus' | 'minus' | Zahl). null = unbrauchbar. */
export function hakenOpAus(b: { erledigt?: unknown; zaehler?: unknown; anzahl?: unknown }): HakenOp | null {
  const anzahl = b.anzahl === undefined ? undefined : Number(b.anzahl);
  if (anzahl !== undefined && (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > ZAEHLER_MAX)) return null;
  if (b.zaehler === 'plus') return { art: 'plus', ...(anzahl ? { n: anzahl } : {}) };
  if (b.zaehler === 'minus') return { art: 'minus', ...(anzahl ? { n: anzahl } : {}) };
  if (typeof b.zaehler === 'number') return Number.isInteger(b.zaehler) && b.zaehler >= 0 && b.zaehler <= ZAEHLER_MAX ? { art: 'setzen', n: b.zaehler } : null;
  if (b.zaehler !== undefined) return null;
  if (typeof b.erledigt === 'boolean') return { art: b.erledigt ? 'an' : 'aus' };
  return null;
}

/** Tage, die der Riegel der Erinnerungen behält (heute + die Tage davor) — nur ein technischer Riegel. */
export const RIEGEL_TAGE = 3;

/** Riegel aufräumen: nur die letzten Tage behalten (die Erinnerung gilt je Tag). */
export function riegelAufraeumen(e: Record<string, string[]> | undefined, heute: string, tagMinus: (tag: string, n: number) => string): Record<string, string[]> | undefined {
  if (!e) return e;
  const grenze = tagMinus(heute, RIEGEL_TAGE - 1);
  const raus = Object.fromEntries(Object.entries(e).filter(([t]) => t >= grenze));
  return Object.keys(raus).length ? raus : undefined;
}
