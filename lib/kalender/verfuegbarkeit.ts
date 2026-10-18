// ─── Kalender — Verfügbarkeit laden (Server, 29.09., K1) ────────────────────
// `verfuegbarkeitFuer(person, von, bis)`: die EINE Lesefunktion für „wann ist jemand da?“
// — freie-Zeit-Suche und Buchungsseite (K4), Heute, Glocke, ZOE (K6). Rechnung rein in
// lib/kalender/verfuegbarkeit-regeln.ts (Abwesend, Arbeitsort, Wochenvorlage, Feiertage NRW).
// Termine aus iCloud (frischer Stand, sonst der letzte), Bezüge/Sicherung aus `kalender-bezug`,
// Wochenvorlage aus `routinen.bloecke`. Nur lesen. Ohne iCloud und ohne Google: der zuletzt vom Mac gelieferte Stand (`calendar-cache`,
// Nachprüfung 18.10., N7 — dieselbe Quelle, die GET /api/kalender dann zeigt; vorher war die Terminliste leer, „zählt als belegt“ wirkte nicht
// und die Kick-off-Vorschläge trafen belegte Zeiten). Nie beide Quellen zugleich: mit iCloud/Google zählt allein deren Stand.
// Seit 08.10. (Lücke 7): dazu die Business-freien Zeiten der Person (lib/arbeitsrahmen/server.ts) — sie nehmen Arbeitszeit
// weg (Kapazität), belegen in der freien-Zeit-Suche und auf Buchungsseiten (`belegungenAus`) und machen `istFrei` falsch.

import { loadJson } from '@/lib/store/local-db';
import { verbunden, frischerStand, termineImZeitraum, CACHE } from './icloud';
import { macTermine, type MacEv } from './termine-lesen';
import { googleKalenderNamen } from './google/namen';
import { ladeBezuege } from './bezug-server';
import { mitBezug } from './bezug';
import { ladeEinstellungen, werFuerBelegung } from './einstellungen';
import { verfuegbarkeitAus, type Verfuegbarkeit } from './verfuegbarkeit-regeln';
import type { RoutinenDatei } from '@/lib/planung/typen';
import { businessFreiFensterFuer } from '@/lib/arbeitsrahmen/server';

export type { Verfuegbarkeit, TagVerfuegbarkeit, Belegt, Zeitraum } from './verfuegbarkeit-regeln';
export { istFrei, betrifft } from './verfuegbarkeit-regeln';

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

/** Verfügbarkeit einer Person (Speichername) in [von, bis) — Berliner Tage, höchstens 400 Tage. */
export async function verfuegbarkeitFuer(person: string, von: string, bis: string): Promise<Verfuegbarkeit> {
  if (!PERSON.test(person) || !TAG.test(von) || !TAG.test(bis) || bis <= von) throw new Error('verfuegbarkeitFuer: Person oder Zeitraum ungültig.');
  const [einst, bezuege, routinen, businessFrei] = await Promise.all([ladeEinstellungen(), ladeBezuege(), loadJson<RoutinenDatei>('routinen').catch(() => null), businessFreiFensterFuer(person, von, bis).catch(() => [])]);
  // iCloud und/oder die verbundenen Google-Kalender (03.10.) — beide liegen im selben Stand. Sonst der Mac-Stand (EINE Abbildung `macTermine`).
  const termine = verbunden() || Object.keys(await googleKalenderNamen()).length
    ? termineImZeitraum(await frischerStand(), von, bis)
    : macTermine((await loadJson<{ events?: MacEv[] }>(CACHE).catch(() => null))?.events, von, bis);
  return verfuegbarkeitAus({
    person, von, bis,
    // R-K2 #69: Schalter „zählt als belegt“ je Kalender — ein nicht zugeordneter Kalender betrifft niemanden.
    termine: termine.map(t => ({ ...mitBezug(t, bezuege), wer: werFuerBelegung(einst, t.kalender) })),
    bloecke: Array.isArray(routinen?.bloecke) ? routinen!.bloecke : [],
    // Ohne Business-freie Zeit kein Feld — die Rechnung bleibt dann bit-gleich.
    ...(businessFrei.length ? { businessFrei } : {}),
  });
}
