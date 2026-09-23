'use client';

// ─── MAKE OS — Aufgaben ─────────────────────────────────────────────────────
// Die Liste, mit der man arbeitet: eine Zeile zum Anlegen (mit Kürzeln), dann
// Überfällig · Heute · Diese Woche · Später · Ohne Datum. Haken, fertig.
// Board, Zeitstrahl und Filter des alten Baus liegen unter /os/aufgaben/board.

import Link from 'next/link';
import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { parseSchnell } from '@/lib/make-one/schnell-anlegen';
import { localDay, tagePlus } from '@/lib/zeit';
import type { Task } from '@/types/tasks';
import { Seite, Ueberschrift, Liste, Zeile, Leer, Haken, Punkt, feld, prioFarbe } from './schlank';

const WER: Record<string, string> = { kevin: 'K', malin: 'M', both: 'K+M' };

export function AufgabenSchlank() {
  const heute = localDay();
  const { state, dispatch } = useTasks();
  const [neu, setNeu] = useState('');
  const [zeigeErledigt, setZeigeErledigt] = useState(false);

  const anlegen = () => {
    const roh = neu.trim();
    if (!roh) return;
    const p = parseSchnell(roh, state.projects);
    if (!p.title) return;
    dispatch({ type: 'ADD_TASK', payload: {
      projectId: p.projectId ?? state.projects[0]?.id ?? '', title: p.title, description: '', status: 'todo',
      priority: p.priority, assignee: p.assignee === 'both' ? 'both' : p.assignee, tags: [], subTasks: [], dependencies: [], sortOrder: 0,
      ...(p.dueDate ? { dueDate: p.dueDate } : {}),
    } });
    setNeu('');
  };

  const offen = state.tasks.filter(t => t.status !== 'done');
  const erledigt = state.tasks.filter(t => t.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 20);
  const wochenEnde = tagePlus(heute, 7);
  const gruppen: { titel: string; liste: Task[] }[] = [
    { titel: 'Überfällig', liste: offen.filter(t => t.dueDate && t.dueDate < heute) },
    { titel: 'Heute', liste: offen.filter(t => t.dueDate === heute) },
    { titel: 'Diese Woche', liste: offen.filter(t => t.dueDate && t.dueDate > heute && t.dueDate <= wochenEnde) },
    { titel: 'Später', liste: offen.filter(t => t.dueDate && t.dueDate > wochenEnde) },
    { titel: 'Ohne Datum', liste: offen.filter(t => !t.dueDate) },
  ].map(g => ({ ...g, liste: g.liste.sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || (a.priority === 'critical' ? -1 : 1)) }));
  const projekt = (id: string) => state.projects.find(p => p.id === id)?.title ?? '';
  const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '');

  return (
    <Seite titel="Aufgaben" rechts={<Link href="/os/aufgaben/board" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Board &amp; Zeitstrahl ›</Link>}>
      <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
        placeholder="Neue Aufgabe … (!! kritisch · heute / mo–so / 24.09. · #projekt · @malin)" style={{ ...feld, fontSize: TYP.body, marginBottom: 6 }} />

      {offen.length === 0 && <Leer>Keine offenen Aufgaben. Eine Zeile oben, Enter — oder Jarvis sagen.</Leer>}
      {gruppen.filter(g => g.liste.length).map(g => (
        <div key={g.titel}>
          <Ueberschrift rechts={`${g.liste.length}`}>{g.titel}</Ueberschrift>
          <Liste>
            {g.liste.map(t => (
              <Zeile key={t.id}
                links={<Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />}
                titel={t.title}
                unter={[projekt(t.projectId), t.assignee !== 'kevin' ? WER[t.assignee] : ''].filter(Boolean).join(' · ')}
                rechts={<span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {t.dueDate && <span style={{ fontFamily: SCHRIFT.display, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: t.dueDate < heute ? C.kritisch : C.inkLeise }}>{datum(t.dueDate)}</span>}
                  <Punkt farbe={prioFarbe(t.priority)} />
                </span>} />
            ))}
          </Liste>
        </div>
      ))}

      {erledigt.length > 0 && (
        <>
          <Ueberschrift rechts={<button onClick={() => setZeigeErledigt(z => !z)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: 0 }}>{zeigeErledigt ? 'ausblenden' : `${erledigt.length} anzeigen`}</button>}>Erledigt</Ueberschrift>
          {zeigeErledigt && (
            <Liste>
              {erledigt.map(t => (
                <Zeile key={t.id} links={<Haken an onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} />}
                  titel={<span style={{ color: C.inkLeise, textDecoration: 'line-through' }}>{t.title}</span>} unter={projekt(t.projectId)} />
              ))}
            </Liste>
          )}
        </>
      )}
    </Seite>
  );
}
