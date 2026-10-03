'use client';
// ─── Eigene Status je Space (28.09. abends) ─────────────────────────────────
// Fest: Offen · In Arbeit · Wartend · Erledigt. Dazu je Space eigene (z. B. „Beim Steuerbüro“) mit Name, Farbe und
// Grundstatus — der Grundstatus sagt allen anderen Seiten, was er bedeutet (erledigt zählt als erledigt).

import { useState, type Dispatch } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, SymbolKnopf, feld, Punkt } from '../ui';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { GRUNDSTATUS, statusListe } from '@/lib/aufgaben/struktur';
import type { TasksState, TaskStatus } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { neueKennung } from './hilfe';

const FARBEN = ['#A99BF5', '#4FC3F7', '#FFC93C', '#FF9F43', '#FF7EB6', '#3DE28B', '#6E7A7D'];
const BASIS: WahlEintrag<TaskStatus>[] = GRUNDSTATUS.map(g => ({ id: g.basis, label: `bedeutet ${g.label}`, punkt: g.farbe }));

export function StatusVerwalten({ state, dispatch, spaceId, spaceLabel, i = 2 }: { state: TasksState; dispatch: Dispatch<AufgabenAktion>; spaceId: string; spaceLabel: string; i?: number }) {
  const [name, setName] = useState('');
  const [farbe, setFarbe] = useState(FARBEN[0]);
  const [basis, setBasis] = useState<TaskStatus>('in-progress');
  const eigene = (state.statusEigen ?? []).filter(s => s.spaceId === spaceId);
  const alle = statusListe(spaceId, state.statusEigen ?? []);
  const anlegen = () => {
    const label = name.replace(/\s+/g, ' ').trim().slice(0, 30);
    if (!label) return;
    dispatch({ type: 'ADD_STATUS', payload: { id: neueKennung('st'), spaceId, label, farbe, basis, sortOrder: eigene.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1 } });
    setName('');
  };
  return (
    <Karte i={i}>
      <Ueberschrift rechts={spaceLabel}>Status</Ueberschrift>
      <div style={{ display: 'grid', gap: 2, marginBottom: 12 }}>
        {alle.map(s => {
          const e = eigene.find(x => x.id === s.id);
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 34, paddingLeft: e ? 14 : 0 }}>
              {e ? (
                <button onClick={() => dispatch({ type: 'UPDATE_STATUS', payload: { id: e.id, farbe: FARBEN[(FARBEN.indexOf(e.farbe) + 1) % FARBEN.length] } })} aria-label="Farbe wechseln" title="Farbe wechseln" className="fassbar"
                  style={{ width: 14, height: 14, borderRadius: '50%', background: e.farbe, border: 'none', cursor: 'pointer', flex: '0 0 auto' }} />
              ) : <Punkt farbe={s.farbe} />}
              <span style={{ fontSize: TYP.bedien, color: e ? C.ink : C.inkDim, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              {e ? <>
                <Wahl klein label="Grundstatus" liste={BASIS} wert={e.basis === 'backlog' ? 'todo' : e.basis} onWahl={b => dispatch({ type: 'UPDATE_STATUS', payload: { id: e.id, basis: b } })} />
                <SymbolKnopf onClick={() => { if (window.confirm(`Status „${e.label}“ entfernen? Aufgaben behalten ihren Grundstatus.`)) dispatch({ type: 'DELETE_STATUS', payload: { id: e.id } }); }} ariaLabel={`${e.label} entfernen`} gefahr>×</SymbolKnopf>
              </> : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>fest</span>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }} placeholder="Neuer Status, z. B. Beim Steuerbüro" aria-label="Neuer Status" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', gap: 5 }}>
            {FARBEN.map(f => <button key={f} onClick={() => setFarbe(f)} aria-label={`Farbe ${f}`} className="fassbar" style={{ width: 20, height: 20, borderRadius: '50%', background: f, cursor: 'pointer', border: farbe === f ? `2px solid ${C.ink}` : '2px solid transparent' }} />)}
          </span>
          <Wahl klein label="Grundstatus" liste={BASIS} wert={basis} onWahl={setBasis} />
          <span style={{ marginLeft: 'auto' }}><Knopf onClick={anlegen} aus={!name.trim()}>Status anlegen</Knopf></span>
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, fontFamily: SCHRIFT.text, lineHeight: 1.5 }}>Der Grundstatus sagt allen anderen Seiten, was der Status bedeutet — „Abgelegt“ mit Grundstatus Erledigt zählt überall als erledigt.</div>
      </div>
    </Karte>
  );
}
