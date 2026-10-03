// ─── Gelöschte Events merken (Server, 03.10., Praxis-Prüfung M2) ──────────────────────────────────
// Eine Erfassung, die unterwegs ohne Netz entstand, bringt ihr Event als `eventNeu` mit — der Server legt es an, wenn es dort noch nicht
// existiert. Wurde das Event inzwischen BEWUSST gelöscht, darf es dadurch nicht wiederauferstehen: jede Löschung (egal auf welchem Weg, `crmSchreiben`)
// trägt die Kennung hier ein, für 90 Tage; `eventNeu` wird für eine solche Kennung nicht mehr verwendet (404 mit `eventFehler`,
// die Warteschlange bietet „Anderes Event wählen“). Kennung + Tag — keine Personendaten, kein Titel. Sich selbst aufräumend (jede Schreibung
// wirft Einträge über 90 Tage weg).

import { loadJson, updateJson } from '@/lib/store/local-db';

export const EVENTS_GELOESCHT = 'events-geloescht';
/** Wie lange eine gelöschte Kennung gemerkt wird. */
export const EVENTS_GELOESCHT_TAGE = 90;
const MAX = 2000;

export interface GeloeschtesEvent { id: string; am: string }
interface Datei { eintraege: GeloeschtesEvent[] }

const tag = (d: Date) => d.toISOString().slice(0, 10);
const grenze = (jetzt: Date) => tag(new Date(jetzt.getTime() - EVENTS_GELOESCHT_TAGE * 864e5));
const liste = (v: unknown): GeloeschtesEvent[] => (v && typeof v === 'object' && Array.isArray((v as Datei).eintraege) ? (v as Datei).eintraege : [])
  .filter((x): x is GeloeschtesEvent => !!x && typeof x.id === 'string' && typeof x.am === 'string');

/** Diese Event-Kennungen wurden gelöscht — merken (idempotent, räumt Einträge über 90 Tage weg). */
export async function eventsAlsGeloeschtMerken(ids: readonly string[], jetzt: Date = new Date()): Promise<void> {
  if (!ids.length) return;
  const g = grenze(jetzt), heute = tag(jetzt);
  await updateJson<Datei>(EVENTS_GELOESCHT, cur => {
    const behalten = liste(cur).filter(x => x.am >= g && !ids.includes(x.id));
    return { eintraege: [...behalten, ...ids.map(id => ({ id, am: heute }))].slice(-MAX) };
  });
}

/** Wurde dieses Event in den letzten 90 Tagen bewusst gelöscht? */
export async function warEventGeloescht(id: string, jetzt: Date = new Date()): Promise<boolean> {
  const g = grenze(jetzt);
  return liste(await loadJson<Datei>(EVENTS_GELOESCHT)).some(x => x.id === id && x.am >= g);
}
