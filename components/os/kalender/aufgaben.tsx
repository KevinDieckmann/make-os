'use client';

// ─── Kalender — Aufgaben abhaken, einplanen, „Ohne Termin“ (30.09., Paket K3) ─
// Wiederverwendbar (auch für den Modus „Aufgaben“ im Kalender und die Aufgaben-Seite, K5):
//   aufgabeImKalenderAbhaken(handlung, t)       Haken über den Aufgaben-Schreibweg (Serien, Follow-up-Abgleich) — mit
//                                              Rückfrage bei offenen Unteraufgaben und „Rückgängig“ (HandlungProvider).
//   aufgabeEinplanen(handlung, t, tag, zeit)    Deadline/Uhrzeit setzen (`einplanenTeil`: Start wandert mit), „Rückgängig“.
//   useAufgabenImKalender()                     beides nach Kennung + Öffnen (`WEG.aufgabe`).
//   OhneTerminListe                             offene Aufgaben ohne Deadline, zum Ziehen ins Raster.
//   aufgabeZiehStart / aufgabeAusZiehen          Ziehen (HTML5) — Typ AUFGABE_ZIEH_TYP, damit Termine und Aufgaben sich nie vermischen.
// Regeln rein in lib/kalender/aufgaben.ts. Ohne HandlungProvider fallen die Handlungen auf die direkten Aktionen zurück.

import { useCallback, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { prioFarbe, LEUCHT, HakenZiel } from '../ui';
import { useTasks } from '@/context/TasksContext';
import { useHandlung, type Handlungen } from '../aufgaben/Handlung';
import { einplanenTeil } from '@/lib/kalender/aufgaben';
import { WEG } from '@/lib/wege';
import { ART_FARBE } from '@/types/planer';
import type { Task } from '@/types/tasks';

/** Datentyp beim Ziehen einer Aufgabe (Termine ziehen über Zeiger, nie über diesen Typ). */
export const AUFGABE_ZIEH_TYP = 'application/x-make-aufgabe';

/** Ziehen beginnen (auf einem `draggable`-Element). */
export function aufgabeZiehStart(e: DragEvent, id: string): void {
  try { e.dataTransfer.setData(AUFGABE_ZIEH_TYP, id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch { /* alter Browser */ }
}
/** Zieht gerade eine Aufgabe? (für `onDragOver` — der Inhalt ist dort noch nicht lesbar) */
export const ziehtAufgabe = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes(AUFGABE_ZIEH_TYP);
/** Die gezogene Aufgabe beim Ablegen. */
export function aufgabeAusZiehen(e: DragEvent): string | null {
  try { return e.dataTransfer.getData(AUFGABE_ZIEH_TYP) || null; } catch { return null; }
}

/** Abhaken aus dem Kalender — über die Handlung (Rückfrage bei offenen Unteraufgaben, „Rückgängig“). */
export function aufgabeImKalenderAbhaken(handlung: Handlungen, t: Task): void {
  handlung.erledigen(t);
}

/** Einplanen/Verschieben: Deadline auf `tag`, Uhrzeit `zeit` (null = ohne Uhrzeit). Liefert false, wenn sich nichts ändert. */
export function aufgabeEinplanen(handlung: Handlungen, t: Task, tag: string, zeit: string | null): boolean {
  const teil = einplanenTeil(t, tag, zeit);
  if (!teil) return false;
  const text = `${!t.dueDate ? 'eingeplant' : 'verschoben'}: ${tag.slice(8, 10)}.${tag.slice(5, 7)}.${zeit ? ` ${zeit}` : ''}`;
  handlung.verschieben(t, teil, text);
  return true;
}

/** Die Aufgaben-Handlungen des Kalenders nach Kennung. */
export function useAufgabenImKalender() {
  const { state, dispatch } = useTasks();
  const handlung = useHandlung(dispatch, state.statusEigen);
  const router = useRouter();
  const finde = useCallback((id: string) => state.tasks.find(t => t.id === id), [state.tasks]);
  return {
    abhaken: useCallback((id: string) => { const t = finde(id); if (t) aufgabeImKalenderAbhaken(handlung, t); }, [finde, handlung]),
    einplanen: useCallback((id: string, tag: string, zeit: string | null) => { const t = finde(id); return t ? aufgabeEinplanen(handlung, t, tag, zeit) : false; }, [finde, handlung]),
    oeffnen: useCallback((id: string) => router.push(WEG.aufgabe(id)), [router]),
  };
}

/** Offene Aufgaben ohne Deadline — ziehen ins Raster plant sie ein, Haken erledigt, Klick öffnet. */
export function OhneTerminListe({ aufgaben, onOeffnen, onAbhaken, leer = 'Alle offenen Aufgaben haben eine Deadline.' }: {
  aufgaben: readonly Task[]; onOeffnen: (id: string) => void; onAbhaken: (id: string) => void; leer?: string;
}) {
  if (!aufgaben.length) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{leer}</div>;
  return (
    <div role="list" aria-label="Aufgaben ohne Termin" style={{ display: 'grid', gap: 3, maxHeight: 280, overflowY: 'auto' }}>
      {aufgaben.map(t => (
        <div key={t.id} role="listitem" draggable onDragStart={e => aufgabeZiehStart(e, t.id)} title={`${t.title} — ins Raster ziehen zum Einplanen`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 8, background: `${ART_FARBE.aufgabe}12`, border: `1px solid ${ART_FARBE.aufgabe}33`, cursor: 'grab', fontFamily: SCHRIFT.text, minWidth: 0 }}>
          <HakenZiel an={false} onChange={() => onAbhaken(t.id)} farbe={prioFarbe(t.priority)} label={t.title} />
          <button type="button" onClick={() => onOeffnen(t.id)} className="fassbar"
            style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, color: C.ink, fontSize: TYP.bedien, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: SCHRIFT.text }}>
            {t.parentId ? <span aria-label="Unteraufgabe" style={{ color: C.inkLeise }}>↳ </span> : null}{t.priority === 'critical' ? <span style={{ color: LEUCHT.kritisch }}>‼ </span> : null}{t.title}
          </button>
          <span aria-hidden style={{ color: C.inkLeise, fontSize: TYP.bedien }}>⋮⋮</span>
        </div>
      ))}
    </div>
  );
}
