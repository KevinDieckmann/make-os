// ─── Kalender — Verfügbarkeit laden (Server, 29.09., K1) ────────────────────
// `verfuegbarkeitFuer(person, von, bis)`: die EINE Lesefunktion für „wann ist jemand da?“
// — freie-Zeit-Suche und Buchungsseite (K4), Heute, Glocke, ZOE (K6). Rechnung rein in
// lib/kalender/verfuegbarkeit-regeln.ts (Abwesend, Arbeitsort, Wochenvorlage, Feiertage NRW).
// Termine aus iCloud (frischer Stand, sonst der letzte), Bezüge/Sicherung aus `kalender-bezug`,
// Wochenvorlage aus `routinen.bloecke`. Nur lesen. Ohne iCloud und ohne Google: der zuletzt vom Mac gelieferte Stand (`calendar-cache`,
// Nachprüfung 18.10., N7 — dieselbe Quelle, die GET /api/kalender dann zeigt; vorher war die Terminliste leer, „zählt als belegt“ wirkte nicht
// und die Kick-off-Vorschläge trafen belegte Zeiten). Nie beide Quellen zugleich: mit iCloud/Google zählt allein deren Stand.
// Seit 18.10.: die EIGENEN iCloud-Verbindungen der Personen (lib/kalender/icloud-person.ts) zählen auch ohne Haushalts-iCloud/Google — mit
// iCloud/Google stehen sie schon im Stand (`ladeStand` → `persoenlicheUeberlagerung`), ohne kommen sie zum Mac-Stand dazu (`eigeneVerbindungen`).
// Sie gehören genau ihrer Person (`werFuerTermin`) und bleiben privat: nur „belegt“, nie ein Titel. Nie doppelt: was im Haushalts-Stand steht
// (dieselbe UID), zählt nur dort — dieselbe Regel wie `ladeStand`; Kopien aus der Überlagerung im Zwischenspeicher zählen nicht als Mac-Stand.
// Seit 08.10. (Lücke 7): dazu die Business-freien Zeiten der Person (lib/arbeitsrahmen/server.ts) — sie nehmen Arbeitszeit
// weg (Kapazität), belegen in der freien-Zeit-Suche und auf Buchungsseiten (`belegungenAus`) und machen `istFrei` falsch.

import { loadJson } from '@/lib/store/local-db';
import { verbunden, frischerStand, ladeStandIcloud, termineImZeitraum, CACHE } from './icloud';
import { macTermine, type MacEv } from './termine-lesen';
import { googleKalenderNamen } from './google/namen';
import { ladeBezuege } from './bezug-server';
import { mitBezug } from './bezug';
import { ladeEinstellungen, werFuerTermin } from './einstellungen';
import type { Termin } from './ics';
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
  // iCloud und/oder die verbundenen Google-Kalender (03.10.) — beide liegen im selben Stand (samt den eigenen Verbindungen je Person). Sonst der
  // Mac-Stand (EINE Abbildung `macTermine`) und dazu die eigenen Verbindungen je Person (18.10.).
  let termine: Termin[];
  if (verbunden() || Object.keys(await googleKalenderNamen()).length) termine = termineImZeitraum(await frischerStand(), von, bis);
  else {
    const mac = ((await loadJson<{ events?: MacEv[] }>(CACHE).catch(() => null))?.events ?? []).filter(e => !e.persoenlich);
    const eigene = await eigeneVerbindungen(mac, von, bis);
    termine = [...macTermine(mac, von, bis), ...eigene, ...await weitereKonten(mac, eigene, von, bis)];
  }
  return verfuegbarkeitAus({
    person, von, bis,
    // R-K2 #69: Schalter „zählt als belegt“ je Kalender — ein nicht zugeordneter Kalender betrifft niemanden. Eigene Verbindung: ihre Person.
    termine: termine.map(t => ({ ...mitBezug(t, bezuege), wer: werFuerTermin(einst, t) })),
    bloecke: Array.isArray(routinen?.bloecke) ? routinen!.bloecke : [],
    // Ohne Business-freie Zeit kein Feld — die Rechnung bleibt dann bit-gleich.
    ...(businessFrei.length ? { businessFrei } : {}),
  });
}

/**
 * Ohne Haushalts-iCloud und ohne Google (18.10.): die Termine aus den EIGENEN iCloud-Verbindungen der Personen — dieselbe Überlagerung wie
 * `ladeStand` (nur gezeigte Kalender, ohne Objekte, deren UID im Haushalts-iCloud-Stand steht), dazu ohne alles, was der Mac-Stand schon
 * trägt (`uid`, sonst `id`). Termine tragen `persoenlich` (Person) — nur „belegt“. Ohne Verbindung: nichts (bit-gleich wie vorher).
 */
async function eigeneVerbindungen(mac: readonly MacEv[], von: string, bis: string): Promise<Termin[]> {
  try {
    const { persoenlicheUeberlagerung } = await import('./icloud-person');
    const p = await persoenlicheUeberlagerung(await ladeStandIcloud());
    if (!p.kalender.length) return [];
    const imMacStand = new Set(mac.map(e => e.uid ?? e.id).filter((u): u is string => !!u));
    return termineImZeitraum({ kalender: p.kalender, objekte: p.objekte }, von, bis).filter(t => !imMacStand.has(t.uid));
  } catch (e) {
    console.warn(`[kalender] eigene iCloud-Verbindungen für die Verfügbarkeit nicht lesbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return [];
  }
}

/**
 * Ohne Haushalts-iCloud und ohne Google (30.10.): die Termine der WEITEREN Google-Konten der Personen (lib/kalender/google/zusatz.ts) — sonst
 * stehen sie schon im Stand (`ladeStand` → `mitZusatz`). Nur „belegt“ ihrer Person (`persoenlich`); nichts doppelt, was der Mac-Stand oder die
 * eigenen iCloud-Verbindungen schon tragen. Ohne weitere Konten: nichts (bit-gleich wie vorher).
 */
async function weitereKonten(mac: readonly MacEv[], eigene: readonly Termin[], von: string, bis: string): Promise<Termin[]> {
  try {
    const { personenMitZusatz } = await import('@/lib/google/zusatz');
    const { alleSpeicher } = await import('@/lib/zugang/konten');
    const personen = await personenMitZusatz(await alleSpeicher());
    if (!personen.length) return [];
    const { zusatzUeberlagerung } = await import('./google/zusatz');
    const vorhanden = new Set<string>([...mac.map(e => e.uid ?? e.id).filter((u): u is string => !!u), ...eigene.map(t => t.uid)]);
    const z = await zusatzUeberlagerung(personen, vorhanden, new Set());
    return z.kalender.length ? termineImZeitraum({ kalender: z.kalender, objekte: z.objekte }, von, bis) : [];
  } catch (e) {
    console.warn(`[kalender] weitere Google-Konten für die Verfügbarkeit nicht lesbar: ${e instanceof Error ? e.message.slice(0, 120) : 'Fehler'}`);
    return [];
  }
}
