// ─── Zeit & Fokus — Speicher je Person ──────────────────────────────────────
// Bestand `zeit` (Kevin) bzw. `zeit--<person>` (alle anderen), über local-db.
//
// Die Anwesenheits-Pings kommen alle 30 s je offenem Fenster. Damit daraus nicht
// alle 30 s eine Schreibung wird, sammelt ein kleiner Puffer im Prozess und
// schreibt erst nach PUFFER_MS oder beim Wechsel des Bereichs (Datenarchitektur
// 26.09.: Leerlauf-Schreibungen vermeiden). Geht der Prozess dazwischen aus,
// fehlen höchstens zwei Minuten — für eine Zeitstatistik verschmerzbar.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer, type Person } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import { LEER_ZEIT, verbuchen, fokusVerbuchen, blockZuordnen, blockUmbuchen, aufraeumen, bild, type ZeitDatei, type ZeitBild, type BlockZuordnung } from './modell';
import { aufgabeKurz, type AufgabeKurz } from './einheiten';
import type { TasksState } from '@/types/tasks';

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

/**
 * Stand der bewussten Blöcke (Prozess-Zähler, 27.09. spät): `zeit` ist Memo-Rauschen (lib/store/memo.ts), eine Schreibung
 * macht also nichts ungültig. Wer über Blöcke rechnet (Zeit je Einheit), nimmt diesen Stand in den Memo-Schlüssel.
 */
let bloeckeStand = 0;
export const zeitBloeckeStand = (): number => bloeckeStand;

/** Ein bewusster Fokus-Block ist zu Ende. Die Zuordnung muss gesäubert sein (`zuordnungSaeubern`). */
export async function fokusAbschliessen(person: Person, block: { von: string; bis: string; schluessel: string; label: string } & BlockZuordnung): Promise<ZeitDatei> {
  const d = await updateJson<ZeitDatei>(speicherFuer(NAME, person), current => aufraeumen(fokusVerbuchen(current ?? LEER_ZEIT, block), localDay()));
  bloeckeStand++;
  return d;
}

/** Nachträglich zuordnen — nur im eigenen Bestand. `null`, wenn es den Block nicht gibt. */
const hatBlock = (d: ZeitDatei, von: string) => Object.values(d.tage).some(t => (t.bloecke ?? []).some(b => b.von === von));

export async function fokusZuordnen(person: Person, von: string, zuordnung: (schluessel: string) => BlockZuordnung): Promise<ZeitDatei | null> {
  // Erst lesen: gibt es den Block nicht, wird nichts geschrieben (auch kein leerer Bestand angelegt).
  if (!hatBlock(await ladeZeit(person), von)) return null;
  let gefunden = false;
  const d = await updateJson<ZeitDatei>(speicherFuer(NAME, person), current => {
    const alt = current ?? LEER_ZEIT;
    const block = Object.values(alt.tage).flatMap(t => t.bloecke ?? []).find(b => b.von === von);
    if (!block) return alt;
    const r = blockZuordnen(alt, von, zuordnung(block.schluessel));
    gefunden = r.gefunden;
    return r.datei;
  });
  if (gefunden) bloeckeStand++;
  return gefunden ? d : null;
}

/** Einen eigenen Block in einen anderen Space umbuchen. `null`, wenn es den Block nicht gibt. */
export async function fokusUmbuchen(person: Person, von: string, ziel: 'privat' | 'business'): Promise<ZeitDatei | null> {
  if (!hatBlock(await ladeZeit(person), von)) return null;
  let gefunden = false;
  const d = await updateJson<ZeitDatei>(speicherFuer(NAME, person), current => {
    const r = blockUmbuchen(current ?? LEER_ZEIT, von, ziel);
    gefunden = r.gefunden;
    return r.datei;
  });
  if (gefunden) bloeckeStand++;
  return gefunden ? d : null;
}

/** Die Aufgaben als Kurzform (Space und Einheit wie im Aufgaben-Schreibweg, Orte aus `ordnung`). */
export async function aufgabenKurz(): Promise<AufgabeKurz[]> {
  const state = await loadJson<TasksState>('tasks');
  const ordnung = await loadJson<{ orgs?: Record<string, string> }>('ordnung');
  const orgs = ordnung?.orgs && typeof ordnung.orgs === 'object' ? ordnung.orgs : {};
  return (state?.tasks ?? []).map(t => aufgabeKurz(t, orgs));
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
