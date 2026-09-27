// ─── Zeit & Fokus — Speicher je Person ──────────────────────────────────────
// Bestand `zeit` (Kevin) bzw. `zeit--<person>` (alle anderen), über local-db.
//
// Die Anwesenheits-Pings kommen alle 30 s je offenem Fenster. Damit daraus nicht
// alle 30 s eine Schreibung wird, sammelt ein kleiner Puffer im Prozess und
// schreibt erst nach PUFFER_MS oder beim Wechsel des Bereichs (Datenarchitektur
// 26.09.: Leerlauf-Schreibungen vermeiden). Geht der Prozess dazwischen aus,
// fehlen höchstens zwei Minuten — für eine Zeitstatistik verschmerzbar.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer, type Person } from '@/lib/jarvis/raum';
import { localDay } from '@/lib/zeit';
import { LEER_ZEIT, verbuchen, fokusVerbuchen, aufraeumen, bild, type ZeitDatei, type ZeitBild } from './modell';

const NAME = 'zeit';
export const PUFFER_MS = 120_000;

interface Puffer { seit: number; pings: { at: string; schluessel: string }[] }
const puffer = new Map<Person, Puffer>();

export async function ladeZeit(person: Person): Promise<ZeitDatei> {
  return (await loadJson<ZeitDatei>(speicherFuer(NAME, person))) ?? LEER_ZEIT;
}

async function schreibe(person: Person, pings: { at: string; schluessel: string }[]): Promise<void> {
  if (!pings.length) return;
  await updateJson<ZeitDatei>(speicherFuer(NAME, person), current => {
    let d = current ?? LEER_ZEIT;
    for (const p of pings) d = verbuchen(d, p.at, p.schluessel);
    return aufraeumen(d, localDay());
  });
}

/** Ein Ping aus der Anwesenheit: puffern, und nur ab und zu wirklich schreiben. */
export async function verbucheAnwesenheit(person: Person, at: string, schluessel: string): Promise<void> {
  const p = puffer.get(person) ?? { seit: Date.now(), pings: [] };
  const letzter = p.pings[p.pings.length - 1];
  p.pings.push({ at, schluessel });
  puffer.set(person, p);
  const wechsel = letzter && letzter.schluessel !== schluessel;
  const tagWechsel = letzter && localDay(new Date(letzter.at)) !== localDay(new Date(at));
  if (!wechsel && !tagWechsel && Date.now() - p.seit < PUFFER_MS) return;
  puffer.set(person, { seit: Date.now(), pings: [] });
  await schreibe(person, p.pings);
}

/** Alles Gepufferte sofort schreiben (vor einem Bild, damit der Kopf den aktuellen Stand zeigt). */
export async function pufferLeeren(person: Person): Promise<void> {
  const p = puffer.get(person);
  if (!p?.pings.length) return;
  // Der letzte Ping bleibt als Anker im Puffer, sonst ginge die nächste Differenz verloren.
  const anker = p.pings[p.pings.length - 1];
  puffer.set(person, { seit: Date.now(), pings: [anker] });
  await schreibe(person, p.pings);
}

/** Ein bewusster Fokus-Block ist zu Ende. */
export async function fokusAbschliessen(person: Person, block: { von: string; bis: string; schluessel: string; label: string }): Promise<ZeitDatei> {
  return updateJson<ZeitDatei>(speicherFuer(NAME, person), current => aufraeumen(fokusVerbuchen(current ?? LEER_ZEIT, block), localDay()));
}

/**
 * Das Bild für Kopf und Indizes — OHNE zu schreiben (27.09., Tempo-Prüfung): der Puffer wird nur im Speicher auf den
 * Bestand gelegt. Vorher schrieb jeder Aufruf den Puffer weg, und weil das Bild im Lesepfad von /api/business, /api/privat
 * und dem Score steht, machte jeder Seitenaufruf den Zwischenspeicher aller Indizes ungültig.
 */
export async function zeitBildFuer(person: Person, heute = localDay()): Promise<ZeitBild> {
  let d = await ladeZeit(person);
  for (const p of puffer.get(person)?.pings ?? []) d = verbuchen(d, p.at, p.schluessel);
  return bild(d, heute);
}
