// ─── Kalender — Verfügbarkeit laden (Server, 29.09., K1) ────────────────────
// `verfuegbarkeitFuer(person, von, bis)`: die EINE Lesefunktion für „wann ist jemand da?“
// — freie-Zeit-Suche und Buchungsseite (K4), Heute, Glocke, ZOE (K6). Rechnung rein in
// lib/kalender/verfuegbarkeit-regeln.ts (Abwesend, Arbeitsort, Wochenvorlage, Feiertage NRW).
// Termine aus iCloud (frischer Stand, sonst der letzte), Bezüge/Sicherung aus `kalender-bezug`,
// Wochenvorlage aus `routinen.bloecke`. Nur lesen. Ohne iCloud: nur Vorlage + Feiertage.

import { loadJson } from '@/lib/store/local-db';
import { verbunden, frischerStand, termineImZeitraum } from './icloud';
import { ladeBezuege } from './bezug-server';
import { mitBezug } from './bezug';
import { ladeEinstellungen, wemGehoert } from './einstellungen';
import { verfuegbarkeitAus, type Verfuegbarkeit } from './verfuegbarkeit-regeln';
import type { RoutinenDatei } from '@/lib/planung/typen';

export type { Verfuegbarkeit, TagVerfuegbarkeit, Belegt, Zeitraum } from './verfuegbarkeit-regeln';
export { istFrei, betrifft } from './verfuegbarkeit-regeln';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

/** Verfügbarkeit einer Person (Speichername) in [von, bis) — Berliner Tage, höchstens 400 Tage. */
export async function verfuegbarkeitFuer(person: string, von: string, bis: string): Promise<Verfuegbarkeit> {
  if (!PERSON.test(person) || !TAG.test(von) || !TAG.test(bis) || bis <= von) throw new Error('verfuegbarkeitFuer: Person oder Zeitraum ungültig.');
  const [einst, bezuege, routinen] = await Promise.all([ladeEinstellungen(), ladeBezuege(), loadJson<RoutinenDatei>('routinen').catch(() => null)]);
  const termine = verbunden() ? termineImZeitraum(await frischerStand(), von, bis) : [];
  return verfuegbarkeitAus({
    person, von, bis,
    termine: termine.map(t => ({ ...mitBezug(t, bezuege), wer: wemGehoert(einst, t.kalender) })),
    bloecke: Array.isArray(routinen?.bloecke) ? routinen!.bloecke : [],
  });
}
