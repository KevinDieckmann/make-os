// ─── MAKE OS — Serien im Morgenlauf (Server, Paket C3, 28.09. spät) ─────────
// Schritt „Aufgaben-Serien“ in /api/tagesstart: fällige wiederkehrende Listen anlegen und Serien-Aufgaben nachholen
// (Regeln rein in lib/aufgaben/serie.ts `serienLauf`). Ohne Netz; liest erst ohne Sperre und schreibt nur, wenn
// etwas fällig ist — dann in EINER Sperre auf „tasks“, mit Übernahme des Altbestands, Verlauf „angelegt“ durch den
// Systemlauf und Änderungsprotokoll ohne Werte ({ art: 'system' }).

import { loadJson } from '@/lib/store/local-db';
import { protokolliere, listenDiff, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import type { TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { AUFGABEN_SPEICHER, orgZuordnung, papierkorbDateienEntfernen } from './speicher';
import { haushaltsSpeicher } from './sicht';
import { aufgabenSchreiben } from './umbau';
import { papierkorbAbgelaufen, endgueltigEntfernen } from './papierkorb';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
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
  const personen = await haushaltsSpeicher();
  // Vorab ohne Sperre: ist überhaupt etwas fällig? Sonst wird nichts geschrieben.
  const roh = await loadJson<TasksState>(AUFGABEN_SPEICHER);
  if (!roh || !serienLauf(uebernehmen(alsStand(roh), orgs, personen).state, heute, jetztIso).geaendert) return { listen: 0, aufgaben: 0, hinweise: [] };

  let bericht: SerienLaufBericht = { listen: 0, aufgaben: 0, hinweise: [] };
  const stand: { vorher?: TasksState; nachher?: TasksState } = {};
  // Über `aufgabenSchreiben` (29.09., A9): vor dem ersten übernommenen Schreiben eine Archiv-Kopie, danach der Merker.
  await aufgabenSchreiben(aktuell => {
    if (!aktuell) return aktuell;
    const basis = uebernehmen(alsStand(aktuell), orgs, personen).state;
    const r = serienLauf(basis, heute, jetztIso);
    if (!r.geaendert) return aktuell;
    // Nie abschneiden, ablehnen: über der Grenze nichts anlegen (Hinweis statt still kürzen).
    if (r.state.tasks.length > AUFGABEN_GRENZEN.aufgaben || (r.state.listen ?? []).length > AUFGABEN_GRENZEN.listen) {
      bericht = { listen: 0, aufgaben: 0, hinweise: [`Nichts angelegt: die Grenze von ${AUFGABEN_GRENZEN.aufgaben} Aufgaben bzw. ${AUFGABEN_GRENZEN.listen} Listen wäre überschritten.`] };
      return aktuell;
    }
    const neu = new Set(r.neueAufgaben.map(t => t.id));
    const tasks = r.state.tasks.map(t => (neu.has(t.id) ? { ...t, verlauf: verlaufAnhaengen(undefined, [{ am: jetztIso, von: 'system', durch: 'system', was: 'angelegt' }]) } : t));
    stand.vorher = basis;
    stand.nachher = uebernehmen({ ...r.state, tasks }, orgs, personen).state;
    bericht = { listen: r.neueListen.length, aufgaben: r.neueAufgaben.length, hinweise: r.hinweise };
    return stand.nachher;
  }, jetztIso);
  if (stand.vorher && stand.nachher) {
    const v = stand.vorher, n = stand.nachher;
    const aenderungen: Aenderung[] = [...listenDiff(v.listen ?? [], n.listen ?? [], 'listen'), ...listenDiff(v.tasks, n.tasks, 'tasks')];
    await protokolliere(AUFGABEN_SPEICHER, aenderungen, { art: 'system' });
  }
  return bericht;
}

export interface PapierkorbBericht { projekte: number; aufgaben: number; dateien: number }

/**
 * Morgenlauf, Schritt „Aufgaben-Papierkorb“ (29.09., A7): Einträge, die länger als 30 Tage im Papierkorb liegen, endgültig
 * entfernen (samt Kette), danach ihre Dateien. Liest erst ohne Sperre; schreibt nur, wenn etwas fällig ist. Protokoll „System“.
 */
export async function papierkorbAufraeumen(jetzt = new Date()): Promise<PapierkorbBericht> {
  const iso = jetzt.toISOString();
  const roh = await loadJson<TasksState>(AUFGABEN_SPEICHER);
  if (!roh || !papierkorbAbgelaufen(alsStand(roh), iso).length) return { projekte: 0, aufgaben: 0, dateien: 0 };
  const orgs = await orgZuordnung();
  const personen = await haushaltsSpeicher();
  const entfernt = { aufgaben: [] as string[], projekte: [] as string[] };
  const stand: { vorher?: TasksState; nachher?: TasksState } = {};
  await aufgabenSchreiben(aktuell => {
    if (!aktuell) return aktuell;
    entfernt.aufgaben.length = 0; entfernt.projekte.length = 0;
    const basis = uebernehmen(alsStand(aktuell), orgs, personen).state;
    const faellig = papierkorbAbgelaufen(basis, iso);
    if (!faellig.length) return aktuell;
    let s = basis;
    for (const f of faellig) { const r = endgueltigEntfernen(s, f.art, f.id); s = r.state; entfernt.aufgaben.push(...r.aufgaben); entfernt.projekte.push(...r.projekte); }
    stand.vorher = basis; stand.nachher = s;
    return s;
  }, iso);
  if (!stand.vorher || !stand.nachher) return { projekte: 0, aufgaben: 0, dateien: 0 };
  const v = stand.vorher, n = stand.nachher;
  await protokolliere(AUFGABEN_SPEICHER, [...listenDiff(v.projects, n.projects, 'projects'), ...listenDiff(v.tasks, n.tasks, 'tasks'), ...listenDiff(v.listen ?? [], n.listen ?? [], 'listen')], { art: 'system' });
  const dateien = await papierkorbDateienEntfernen(await karteiHaushalt(), 'system', entfernt);
  return { projekte: entfernt.projekte.length, aufgaben: entfernt.aufgaben.length, dateien };
}
