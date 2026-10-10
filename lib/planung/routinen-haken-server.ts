// ─── MAKE OS — Routinen abhaken: EINE Schreibstelle (Server, 10.10., Routinen 2) ─────────────────────────────────────────────
// Vorher schrieben drei Stellen den `health-log` je für sich (Oberfläche per PUT des ganzen Logs, PATCH einer Routine, ZOE `hake_routine`).
// Mit Zählern („5 von 8 Gläsern“) und „mehrmals täglich“ gehören zwei Bestände zusammen: der Zähler (`routinen-person--<person>`) und der
// Haken im `health-log`, der steht, sobald das Tagesziel erreicht ist. Beide schreibt nur `routineHaken` — in EINER Sperre (Zähler außen,
// Log innen, lib/store/local-db.ts `updateJsonAsync`). Eine Routine mit Tagesziel 1 schreibt wie bisher nur den Log.
// Wer welche Routine abhaken darf: eigene und gemeinsame im Umfang der Person (`routinenSichtbarFuer`) — nie die einer anderen Person.
// Die Einwilligung (a) prüfen die Aufrufer (Route `gesundheitSchreibSperre`, Werkzeug `gesundheitStandFuer`), wie bisher.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import type { Routine, RoutinenDatei } from './typen';
import { tagesZielVon } from './rhythmus';
import { routinenSichtbarFuer } from './bereich-sicht-server';
import { personStandSaeubern, routinenPersonName, zaehlerNeu, type HakenOp, type RoutinenPersonStand } from './routinen-person';
import type { ZaehlerLog } from './routinen';

export type HealthLog = Record<string, string[]>;

export type HakenErgebnis =
  | { ok: true; tag: string; erledigt: string[]; ist: number; ziel: number; routine: Pick<Routine, 'id' | 'label'> | null }
  | { ok: false; status: 400 | 404; fehler: string };

/** Die Routine, die `person` abhaken darf (eigene + gemeinsame im Umfang), oder null. */
export async function routineFuerPerson(person: string, routineId: string): Promise<Routine | null> {
  const f = await loadJson<RoutinenDatei>('routinen');
  const alle = Array.isArray(f?.routinen) ? f!.routinen : [];
  return (await routinenSichtbarFuer(alle.filter(r => r.id === routineId), person))[0] ?? null;
}

/** Den Haken im Log setzen oder lösen — die bisherige Regel (eine Kennung je Tag, leere Tage fallen weg). */
function logSetzen(log: HealthLog | null, tag: string, id: string, an: boolean): HealthLog {
  const l = log ?? {};
  const liste = new Set(l[tag] ?? []);
  if (an) liste.add(id); else liste.delete(id);
  const neu = { ...l };
  if (liste.size) neu[tag] = [...liste]; else delete neu[tag];
  return neu;
}

/**
 * Eine Routine an einem Tag abhaken bzw. zählen. `fremdeKennungOk`: eine Kennung, die (noch) keine Routine ist, darf wie bisher als
 * einfacher Haken in den Log (Ergänzungen & Trinken nutzen den PATCH mit eigenen Kennungen) — nur für an/aus.
 */
export async function routineHaken(person: string, routineId: string, op: HakenOp, tag: string, o: { fremdeKennungOk?: boolean } = {}): Promise<HakenErgebnis> {
  const r = await routineFuerPerson(person, routineId);
  if (!r && !(o.fremdeKennungOk && (op.art === 'an' || op.art === 'aus'))) return { ok: false, status: 404, fehler: 'Diese Routine gibt es für dich nicht. Nichts gespeichert.' };
  const ziel = r ? tagesZielVon(r) : 1;
  const logName = speicherFuer('health-log', person);
  if (ziel === 1) {
    const an = op.art === 'an' || op.art === 'plus' || (op.art === 'setzen' && op.n > 0);
    const log = await updateJson<HealthLog>(logName, cur => logSetzen(cur, tag, routineId, an));
    const erledigt = log[tag] ?? [];
    return { ok: true, tag, erledigt, ist: erledigt.includes(routineId) ? 1 : 0, ziel, routine: r ? { id: r.id, label: r.label } : null };
  }
  let ist = 0;
  let erledigt: string[] = [];
  await updateJsonAsync<RoutinenPersonStand>(routinenPersonName(person), async cur => {
    const s = personStandSaeubern(cur);
    const vorher = s.zaehler?.[tag]?.[routineId];
    // Ohne Zählerstand: ein schon gesetzter Haken (alter Weg) zählt als volles Tagesziel.
    const alt = typeof vorher === 'number' ? vorher : ((await loadJson<HealthLog>(logName))?.[tag] ?? []).includes(routineId) ? ziel : 0;
    ist = zaehlerNeu(alt, op, ziel);
    const log = await updateJson<HealthLog>(logName, l => logSetzen(l, tag, routineId, ist >= ziel));
    erledigt = log[tag] ?? [];
    const tagZ = { ...(s.zaehler?.[tag] ?? {}) };
    if (ist > 0) tagZ[routineId] = ist; else delete tagZ[routineId];
    const zaehler: ZaehlerLog = { ...(s.zaehler ?? {}) };
    if (Object.keys(tagZ).length) zaehler[tag] = tagZ; else delete zaehler[tag];
    const { zaehler: _z, ...rest } = s;
    return { ...rest, ...(Object.keys(zaehler).length ? { zaehler } : {}) };
  });
  return { ok: true, tag, erledigt, ist, ziel, routine: { id: r!.id, label: r!.label } };
}

/** Die Zähler einer Person (nur lesen) — für GET /api/state/health und die Ansichten. */
export async function zaehlerVon(person: string): Promise<ZaehlerLog> {
  return personStandSaeubern(await loadJson<unknown>(routinenPersonName(person))).zaehler ?? {};
}

/** Der ganze eigene Stand (Einstellung „aufs Handy“ u. a.) — nur lesen. */
export async function personStandVon(person: string): Promise<RoutinenPersonStand> {
  return personStandSaeubern(await loadJson<unknown>(routinenPersonName(person)));
}

/** Einstellung „Erinnerungen auch aufs Handy“ — nur die Person selbst. */
export async function handySetzen(person: string, an: boolean): Promise<RoutinenPersonStand> {
  return updateJson<RoutinenPersonStand>(routinenPersonName(person), cur => {
    const { handy: _h, ...rest } = personStandSaeubern(cur);
    return { ...rest, ...(an ? { handy: true } : {}) };
  });
}
