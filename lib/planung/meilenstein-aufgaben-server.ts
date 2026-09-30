// ─── MAKE OS — Meilenstein ↔ Aufgaben: Server-Wege (30.09.) ─────────────────
// Regeln rein in lib/planung/meilenstein-aufgaben.ts. Hier nur das Schreiben:
//   · `meilensteinStrukturSichern(ids)` — Projekt „Meilensteine“ + Liste je Meilenstein im Aufgaben-Bestand (über den
//     EINEN Schreibweg `aufgabenAendern`, als Systemlauf, idempotent). Läuft im Schreibweg des Meilensteins
//     (/api/state/meilensteine PATCH/PUT, Kaskade in /api/state/ziele) — damit bekommt JEDER Meilenstein seine Liste,
//     egal wer ihn anlegt (Planung, Zeitstrahl-Schnellanlage, Kaskade) — und noch einmal „lazy“ beim Öffnen des Details.
//   · `meilensteinListenArchivieren(ids)` — gelöschter Meilenstein: Liste von Hand archiviert, Aufgaben bleiben.
//   · `fortschrittNachziehen()` — gespeicherten `fortschritt` der Meilensteine mit Aufgaben (und danach der Ziele mit
//     Meilensteinen) auf den errechneten Wert setzen; schreibt nur, wenn sich etwas ändert. Eingehängt nach jedem
//     Aufgaben-Schreiben (lib/aufgaben/speicher.ts), sobald eine Meilenstein-Liste berührt ist.
// Fehler hier brechen nie den auslösenden Schreibweg (der ist schon geschehen) — sie landen im Log (nur Kennungen).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import type { Meilenstein, ZieleDatei } from './typen';
import { ZIEL_HORIZONTE } from './typen';
import type { Task, TasksState } from '@/types/tasks';
import {
  strukturFuer, listeArchivieren, fortschrittAnwenden, zieleFortschrittAnwenden, istMeilensteinListe,
} from './meilenstein-aufgaben';

const MS = 'meilensteine';
const ZIELE = 'ziele';

async function meilensteineLaden(): Promise<Meilenstein[]> {
  const f = await loadJson<{ meilensteine?: Meilenstein[] }>(MS);
  return Array.isArray(f?.meilensteine) ? f!.meilensteine : [];
}

/** Liste(n) im Aufgaben-Bestand sichern — `ids` = die Meilensteine (null = alle). Liefert, wie viele Zeilen geschrieben wurden. */
export async function meilensteinStrukturSichern(ids: readonly string[] | null, o: { person?: string | null } = {}): Promise<number> {
  try {
    const alle = await meilensteineLaden();
    const ms = ids ? alle.filter(m => ids.includes(m.id)) : alle;
    if (!ms.length) return 0;
    const { aufgabenAendern, keineOps, teilOp } = await import('@/lib/aufgaben/speicher');
    const r = await aufgabenAendern(stand => {
      const ops = keineOps();
      const s = strukturFuer(ms, stand);
      for (const p of s.projekte) ops.projects.push({ op: 'upsert', eintrag: p });
      for (const l of s.listen) {
        const da = (stand.listen ?? []).some(x => x.id === l.id);
        ops.listen.push({ op: 'upsert', eintrag: l, ...(da ? { felder: { gesetzt: Object.keys(l), leer: l.archiviert ? [] : ['archiviert'] } } : {}) });
      }
      const nachId = new Map(stand.tasks.map(t => [t.id, t]));
      for (const u of s.umzug) { const t = nachId.get(u.id); if (t) ops.tasks.push(teilOp(u.id, t, u.felder as Partial<Record<keyof Task, unknown>>)); }
      return ops;
    }, { person: o.person || 'system', wer: { art: 'system', ...(o.person ? { person: o.person } : {}) }, system: true, massenAenderung: true });
    if (!r.ok) console.warn(`[meilensteine] Liste nicht gesichert (${r.status}): ${(r.fehler ?? '').slice(0, 120)}`);
    return r.zeilen.length;
  } catch (e) {
    console.error('[meilensteine] Liste nicht gesichert —', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Gelöschte Meilensteine: ihre Listen von Hand archivieren (die Aufgaben bleiben, Rückgängig = Meilenstein wieder anlegen). */
export async function meilensteinListenArchivieren(ids: readonly string[], o: { person?: string | null } = {}): Promise<void> {
  if (!ids.length) return;
  try {
    const { aufgabenAendern, keineOps } = await import('@/lib/aufgaben/speicher');
    await aufgabenAendern(stand => {
      const ops = keineOps();
      for (const id of ids) { const l = listeArchivieren(id, stand); if (l) ops.listen.push({ op: 'upsert', eintrag: l, felder: { gesetzt: ['archiviert'], leer: [] } }); }
      return ops;
    }, { person: o.person || 'system', wer: { art: 'system', ...(o.person ? { person: o.person } : {}) }, system: true, massenAenderung: true });
  } catch (e) {
    console.error('[meilensteine] Liste nicht archiviert —', e instanceof Error ? e.message : e);
  }
}

/**
 * Fortschritt der Meilensteine aus den Aufgaben nachziehen, danach die Ziele aus den Meilensteinen. `state` = der eben
 * geschriebene Aufgaben-Stand (sonst wird er geladen). Schreibt nur bei einer echten Änderung.
 */
export async function fortschrittNachziehen(state?: TasksState | null, wer: Wer = { art: 'system' }): Promise<{ meilensteine: number; ziele: number }> {
  try {
    const tasks = state ?? (await (await import('@/lib/aufgaben/speicher')).ladeAufgaben());
    const vorab = fortschrittAnwenden(await meilensteineLaden(), tasks);
    let ms = vorab.liste;
    let n = 0;
    if (vorab.geaendert.length) {
      const next = await updateJson<{ meilensteine?: Meilenstein[] } & Record<string, unknown>>(MS, cur => {
        const l = Array.isArray(cur?.meilensteine) ? cur!.meilensteine : [];
        const r = fortschrittAnwenden(l, tasks);
        n = r.geaendert.length;
        return { ...(cur ?? {}), meilensteine: r.liste };
      });
      ms = Array.isArray(next.meilensteine) ? next.meilensteine : ms;
      if (n) await protokolliere(MS, vorab.geaendert.map(id => ({ op: 'geaendert' as const, id, felder: ['fortschritt'] })), wer);
    }
    return { meilensteine: n, ziele: await zieleNachziehen(ms) };
  } catch (e) {
    console.error('[meilensteine] Fortschritt nicht nachgezogen —', e instanceof Error ? e.message : e);
    return { meilensteine: 0, ziele: 0 };
  }
}

/** Ziele (geteilter Bestand) mit Meilensteinen tragen den Mittelwert — nur schreiben, wenn sich etwas ändert. */
export async function zieleNachziehen(ms?: readonly Meilenstein[]): Promise<number> {
  const liste = ms ?? await meilensteineLaden();
  const f = await loadJson<ZieleDatei>(ZIELE);
  if (!f) return 0;
  const aendert = ZIEL_HORIZONTE.some(h => Array.isArray(f[h]) && zieleFortschrittAnwenden(f[h], liste).geaendert > 0);
  if (!aendert) return 0;
  let n = 0;
  await updateJson<ZieleDatei>(ZIELE, cur => {
    if (!cur) return cur as unknown as ZieleDatei;
    const aus = { ...cur };
    for (const h of ZIEL_HORIZONTE) {
      if (!Array.isArray(cur[h])) continue;
      const r = zieleFortschrittAnwenden(cur[h], liste);
      n += r.geaendert;
      aus[h] = r.liste;
    }
    return aus;
  });
  return n;
}

/** Hat ein Aufgaben-Schreiben eine Meilenstein-Liste berührt? (Status, Liste, Eltern, Papierkorb, Archiv.) */
export function meilensteinBeruehrt(vorher: TasksState, nachher: TasksState): boolean {
  const alt = new Map(vorher.tasks.map(t => [t.id, t]));
  const kern = (t: Task | undefined) => (t ? `${t.listeId ?? ''}|${t.status}|${t.parentId ?? ''}|${t.geloeschtAm ?? ''}|${t.archiviertAm ?? ''}` : '');
  const gesehen = new Set<string>();
  for (const t of nachher.tasks) {
    gesehen.add(t.id);
    const a = alt.get(t.id);
    if ((istMeilensteinListe(t.listeId) || istMeilensteinListe(a?.listeId)) && kern(a) !== kern(t)) return true;
  }
  for (const t of vorher.tasks) if (!gesehen.has(t.id) && istMeilensteinListe(t.listeId)) return true;
  return false;
}

/** Nach jedem Aufgaben-Schreiben (lib/aufgaben/speicher.ts): Fortschritt nachziehen, wenn eine Meilenstein-Liste berührt ist. */
export async function nachAufgabenSchreiben(vorher: TasksState, nachher: TasksState, person: string): Promise<void> {
  if (!meilensteinBeruehrt(vorher, nachher)) return;
  await fortschrittNachziehen(nachher, person && person !== 'system' ? { art: 'person', person } : { art: 'system' });
}
