// ─── MAKE OS — Ziel-Farben: EINE Stelle, serverseitig (Review 03.10.) ───────
// Die Farbregel `zielFarben` (lib/lichtfaeden/modell.ts) zählt die Wurzel-Ziele je Space in Rang-Reihenfolge durch — ihr
// Ergebnis hängt also von der EINGABEMENGE ab. Vorher fütterten Lichtfäden (gemeinsame + eigene Ziele aller Personen),
// Ziel-Chips der Aufgaben (nur gemeinsame, ohne `abgeleitetVon`) und der Ziel-Bezug der Seiten (nur Jahresziele) sie mit
// verschiedenen Mengen → dasselbe Ziel trug verschiedene Farben. Jetzt: EINE feste Menge — alle Ziele aller Horizonte
// des Haushalts (der gemeinsame Bestand `ziele` + `ziele-eigen--<person>` je Person) —, hier gerechnet und als Feld
// `farbe` ausgeliefert: GET /api/state/ziele (jede Zeile) und die Lichtfäden-Knoten. Clients rechnen nie selbst.
// Gemerkt (lib/store/memo.ts): jede Schreibung in einen Bestand macht es ungültig, sonst 60 s.

import { loadJson } from '@/lib/store/local-db';
import { merken } from '@/lib/store/memo';
import { speicherFuer } from '@/lib/zoe/raum';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';
import { BEIDE, OHNE_FARBE, zielFarben } from '@/lib/lichtfaeden/modell';
import { ZIEL_HORIZONTE, type Ziel, type ZielHorizont, type ZieleDatei } from './typen';

/** Ein Ziel des Haushalts mit Herkunft und Farbe. `person` = BEIDE (gemeinsamer Bestand) oder der Speichername. */
export interface HaushaltsZiel extends Ziel { person: string; horizont: ZielHorizont; farbe: string }

const sicher = async <T>(p: () => Promise<T>, sonst: T): Promise<T> => { try { return await p(); } catch { return sonst; } };

/** Alle Ziele aller Horizonte des Haushalts — die feste Eingabemenge der Farbregel. */
async function zieleLaden(): Promise<Omit<HaushaltsZiel, 'farbe'>[]> {
  const h = await sicher(() => haushaltDesInhabers(), null);
  const personen = h ? await sicher(() => kontenDesHaushalts(h), []) : [];
  const [gemeinsam, eigene] = await Promise.all([
    sicher(() => loadJson<ZieleDatei>('ziele'), null),
    Promise.all(personen.map(k => sicher(() => loadJson<ZieleDatei>(speicherFuer('ziele-eigen', k.speicher)), null).then(d => ({ person: k.speicher, d })))),
  ]);
  const aus: Omit<HaushaltsZiel, 'farbe'>[] = [];
  const dazu = (d: ZieleDatei | null, person: string) => {
    for (const horizont of ZIEL_HORIZONTE) for (const z of Array.isArray(d?.[horizont]) ? d![horizont] : []) if (z && typeof z.id === 'string') aus.push({ ...z, person, horizont });
  };
  dazu(gemeinsam, BEIDE);
  for (const e of eigene) dazu(e.d, e.person);
  return aus;
}

/** Alle Ziele des Haushalts mit ihrer Farbe (gemerkt). */
export function haushaltsZiele(): Promise<HaushaltsZiel[]> {
  return merken('ziele-haushalt-farben', 60_000, async () => {
    const ziele = await zieleLaden();
    const farben = zielFarben(ziele);
    return ziele.map(z => ({ ...z, farbe: farben.get(z.id) ?? OHNE_FARBE }));
  });
}

/** Kennung → Farbe für alle Ziele des Haushalts. */
export async function zielFarbenDesHaushalts(): Promise<ReadonlyMap<string, string>> {
  return new Map((await haushaltsZiele()).map(z => [z.id, z.farbe]));
}

/** Jede Zeile einer Ziele-Datei mit ihrer Farbe (für Antworten — `farbe` wird nie gespeichert, `sauberZiel` lässt es fallen). */
export function mitFarbe<T extends { id: string }>(liste: readonly T[], farben: ReadonlyMap<string, string>): (T & { farbe: string })[] {
  return liste.map(z => ({ ...z, farbe: farben.get(z.id) ?? OHNE_FARBE }));
}
