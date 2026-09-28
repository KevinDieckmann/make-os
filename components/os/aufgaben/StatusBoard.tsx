'use client';
// ─── Aufgaben-Board nach Status (28.09. abends) ─────────────────────────────
// Spalten = Status des Space (fest + eigene, in ihrer Reihenfolge); Karten zieht man dazwischen — das setzt Status
// und Grundstatus (statusTeil). Nur Aufgaben (Unteraufgaben zählen als Fortschritt auf der Karte). Das alte Board mit
// Bahnen nach Person/Firma und Zeitstrahl liegt weiter unter /os/aufgaben/board.

import { useState, type Dispatch } from 'react';
import { MessageSquare, ListChecks } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Punkt, prioFarbe, LEUCHT } from '../schlank';
import { statusListe, statusVon, statusTeil, fortschritt } from '@/lib/aufgaben/struktur';
import type { Task, TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { projektTitel, ownerLabel, type Person } from './hilfe';

export function StatusBoard({ state, dispatch, spaceId, aufgaben, personen, heute, offenId, onOeffnen }: {
  state: TasksState; dispatch: Dispatch<AufgabenAktion>; spaceId: string; aufgaben: Task[]; personen: readonly Person[]; heute: string; offenId: string | null; onOeffnen: (id: string) => void;
}) {
  const eigene = state.statusEigen ?? [];
  const spalten = statusListe(spaceId, eigene);
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const oben = aufgaben.filter(t => !t.parentId);
  const ablegen = (statusId: string) => {
    const t = zieht ? state.tasks.find(x => x.id === zieht) : undefined;
    setZieht(null); setUeber(null);
    if (!t || statusVon(t, eigene).id === statusId) return;
    dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...statusTeil(t, statusId, eigene) } });
  };
  return (
    <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(250px, 1fr)', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x proximity' }}>
      {spalten.map(s => {
        const karten = oben.filter(t => statusVon(t, eigene).id === s.id).sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
        return (
          <section key={s.id} aria-label={s.label} onDragOver={e => { e.preventDefault(); setUeber(s.id); }} onDragLeave={() => setUeber(u => (u === s.id ? null : u))} onDrop={() => ablegen(s.id)}
            style={{ scrollSnapAlign: 'start', background: ueber === s.id ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)', borderRadius: 14, padding: 10, minHeight: 220, transition: 'background .15s ease', border: `1px solid ${ueber === s.id ? `${s.farbe}66` : 'rgba(255,255,255,.04)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 4px 10px', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim, fontFamily: SCHRIFT.text }}>
              <Punkt farbe={s.farbe} /> {s.label}<span style={{ marginLeft: 'auto', color: C.inkLeise, fontWeight: 600 }}>{karten.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {karten.map(t => {
                const u = state.tasks.filter(x => x.parentId === t.id);
                const f = fortschritt(u);
                return (
                  <div key={t.id} draggable onDragStart={() => setZieht(t.id)} onDragEnd={() => { setZieht(null); setUeber(null); }} onClick={() => onOeffnen(t.id)} className="fassbar"
                    style={{ background: offenId === t.id ? 'rgba(255,255,255,.08)' : C.flaeche, borderRadius: 12, padding: '10px 12px', cursor: 'grab', border: `1px solid ${offenId === t.id ? `${C.aktiv}55` : 'rgba(255,255,255,.05)'}`, opacity: zieht === t.id ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ marginTop: 6 }}><Punkt farbe={prioFarbe(t.priority)} groesse={7} /></span>
                      <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: t.status === 'done' ? C.inkLeise : C.ink, lineHeight: 1.35, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, fontSize: 12, color: C.inkLeise }}>
                      <span>{projektTitel(state, t.projectId)}</span>
                      <span>{ownerLabel(t.assignee, personen)}</span>
                      {f.gesamt > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><ListChecks size={12} />{f.fertig}/{f.gesamt}</span>}
                      {!!t.kommentare?.length && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageSquare size={12} />{t.kommentare.length}</span>}
                      {t.dueDate && <span style={{ color: t.dueDate < heute && t.status !== 'done' ? LEUCHT.kritisch : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span>}
                    </div>
                  </div>
                );
              })}
              {!karten.length && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '8px 4px' }}>hierher ziehen</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
