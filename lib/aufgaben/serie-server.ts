// ─── MAKE OS — Serien im Morgenlauf (Server, Paket C3, 28.09. spät) ─────────
// Schritt „Aufgaben-Serien“ in /api/tagesstart: fällige wiederkehrende Listen anlegen und Serien-Aufgaben nachholen
// (Regeln rein in lib/aufgaben/serie.ts `serienLauf`). Ohne Netz; liest erst ohne Sperre und schreibt nur, wenn
// etwas fällig ist — dann in EINER Sperre auf „tasks“, mit Übernahme des Altbestands, Verlauf „angelegt“ durch den
// Systemlauf und Änderungsprotokoll ohne Werte ({ art: 'system' }).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, listenDiff, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import type { TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { AUFGABEN_SPEICHER, orgZuordnung } from './speicher';
import { serienLauf } from './serie';
import { berlinerTag } from './wiederholung';
import { verlaufAnhaengen } from './verlauf';
import { AUFGABEN_GRENZEN } from './saeubern';

export interface SerienLaufBericht { listen: number; aufgaben: number; hinweise: string[] }

const alsStand = (roh: TasksState | null | undefined): TasksState => (roh && Array.isArray(roh.tasks) ? roh : { projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], ...(roh ?? {}), tasks: [] });

/** Fällige Serien anlegen. `jetzt` bestimmt den Berliner Tag. Wirft nie wegen „nichts zu tun“. */
export async function aufgabenSerienNachziehen(jetzt = new Date()): Promise<SerienLaufBericht> {
  const heute = berlinerTag(jetzt);
  const jetztIso = jetzt.toISOString();
  const orgs = await orgZuordnung();
  // Vorab ohne Sperre: ist überhaupt etwas fällig? Sonst wird nichts geschrieben.
  const roh = await loadJson<TasksState>(AUFGABEN_SPEICHER);
  if (!roh || !serienLauf(uebernehmen(alsStand(roh), orgs).state, heute, jetztIso).geaendert) return { listen: 0, aufgaben: 0, hinweise: [] };

  let bericht: SerienLaufBericht = { listen: 0, aufgaben: 0, hinweise: [] };
  const stand: { vorher?: TasksState; nachher?: TasksState } = {};
  await updateJson<TasksState>(AUFGABEN_SPEICHER, aktuell => {
    const basis = uebernehmen(alsStand(aktuell), orgs).state;
    const r = serienLauf(basis, heute, jetztIso);
    if (!r.geaendert) return aktuell ?? basis;
    // Nie abschneiden, ablehnen: über der Grenze nichts anlegen (Hinweis statt still kürzen).
    if (r.state.tasks.length > AUFGABEN_GRENZEN.aufgaben || (r.state.listen ?? []).length > AUFGABEN_GRENZEN.listen) {
      bericht = { listen: 0, aufgaben: 0, hinweise: [`Nichts angelegt: die Grenze von ${AUFGABEN_GRENZEN.aufgaben} Aufgaben bzw. ${AUFGABEN_GRENZEN.listen} Listen wäre überschritten.`] };
      return aktuell ?? basis;
    }
    const neu = new Set(r.neueAufgaben.map(t => t.id));
    const tasks = r.state.tasks.map(t => (neu.has(t.id) ? { ...t, verlauf: verlaufAnhaengen(undefined, [{ am: jetztIso, von: 'system', durch: 'system', was: 'angelegt' }]) } : t));
    stand.vorher = basis;
    stand.nachher = uebernehmen({ ...r.state, tasks }, orgs).state;
    bericht = { listen: r.neueListen.length, aufgaben: r.neueAufgaben.length, hinweise: r.hinweise };
    return stand.nachher;
  });
  if (stand.vorher && stand.nachher) {
    const v = stand.vorher, n = stand.nachher;
    const aenderungen: Aenderung[] = [...listenDiff(v.listen ?? [], n.listen ?? [], 'listen'), ...listenDiff(v.tasks, n.tasks, 'tasks')];
    await protokolliere(AUFGABEN_SPEICHER, aenderungen, { art: 'system' });
  }
  return bericht;
}
