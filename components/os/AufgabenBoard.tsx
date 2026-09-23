'use client';

// ─── MAKE OS — Aufgaben-Board ───────────────────────────────────────────────
// Kevins Ansage: „Ich möchte mit Malin das Taskmanagement durchgehen, die
// Aufgaben von links nach rechts verteilen, Deadlines setzen — und sehen, was
// zu KEMARIS, KD Ventures oder der Selbständigkeit gehört."
//
// Deshalb: fünf Spalten von links nach rechts, Karten zieht man dazwischen.
// Bahnen wahlweise nach Person (wer macht es) oder nach Firma (wo gehört es
// hin) — das sind die beiden Fragen, um die es in so einer Runde geht.
//
// Alles, was die Karte zeigt, ist auch auf der Karte änderbar. Beim Durchgehen
// zu zweit will man nicht für jede Änderung eine Zeile aufklappen.

import { useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { ORG, ORGS } from '@/lib/make-one/organisation-data';
import { Faelligkeit } from './Faelligkeit';
import { BlockiertChip } from './Abhaengigkeit';
import type { Priority } from '@/types/common';
import type { Task, TaskStatus } from '@/types/tasks';

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

/** Von links nach rechts — der Weg, den eine Aufgabe nimmt. */
const SPALTEN: { id: TaskStatus; titel: string; satz: string }[] = [
  { id: 'backlog', titel: 'Gesammelt', satz: 'Steht an, aber nicht jetzt' },
  { id: 'todo', titel: 'Zu tun', satz: 'Diese Woche eingeplant' },
  { id: 'in-progress', titel: 'In Arbeit', satz: 'Läuft gerade' },
  { id: 'blocked', titel: 'Blockiert', satz: 'Wartet auf etwas' },
  { id: 'done', titel: 'Erledigt', satz: 'Weg' },
];

const PRIO_FARBE: Record<Priority, string> = { critical: T.crit, high: T.amber, medium: T.accent, low: T.muted };
const PERSON: Record<string, string> = { kevin: 'Kevin', malin: 'Malin', both: 'Beide' };
const PERSON_ZYKLUS = ['kevin', 'both', 'malin'] as const;
const PERSON_FARBE: Record<string, string> = { kevin: T.accentInk, malin: T.amber, both: T.accent };

type Bahnen = 'keine' | 'person' | 'firma';

export function AufgabenBoard({ tasks, heute, orgVon, patchTask, setOrg }: {
  tasks: Task[];
  heute: string;
  orgVon: (t: Task) => string;
  patchTask: (id: string, p: Record<string, unknown>) => void;
  setOrg: (id: string, org: string) => void;
}) {
  const [bahnen, setBahnen] = useState<Bahnen>('person');
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);

  const gruppen: { id: string; titel: string; satz: string; farbe: string; tasks: Task[] }[] =
    bahnen === 'person'
      ? PERSON_ZYKLUS.map(p => ({
        id: p, titel: PERSON[p], farbe: PERSON_FARBE[p],
        satz: p === 'kevin' ? 'Was nur er machen kann' : p === 'malin' ? 'Bei ihr besser aufgehoben' : 'Braucht euch zusammen',
        tasks: tasks.filter(t => t.assignee === p),
      }))
      : bahnen === 'firma'
        ? ORGS.map(o => ({
          id: o.id, titel: o.label, satz: o.satz, farbe: o.farbe,
          tasks: tasks.filter(t => orgVon(t) === o.id),
        }))
        : [{ id: 'alle', titel: '', satz: '', farbe: T.line, tasks }];

  const sichtbar = gruppen.filter(g => g.tasks.length > 0 || bahnen === 'person');

  /** Ablegen: Spalte immer, Bahn nur wenn sie etwas bedeutet. */
  function ablegen(status: TaskStatus, gruppeId: string) {
    if (!zieht) return;
    const p: Record<string, unknown> = { status };
    // In die Erledigt-Spalte gezogen heißt erledigt — mit Zeitstempel, damit
    // die Auswertung stimmt.
    if (status === 'done') p.completedAt = new Date().toISOString();
    patchTask(zieht, p);
    if (bahnen === 'person' && PERSON[gruppeId]) patchTask(zieht, { assignee: gruppeId });
    if (bahnen === 'firma' && ORG[gruppeId]) setOrg(zieht, gruppeId);
    setZieht(null);
    setUeber(null);
  }

  return (
    <div>
      {/* Bahnen umschalten — die zwei Fragen einer Verteil-Runde */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={lbl}>Bahnen</span>
        {([['person', 'Nach Person'], ['firma', 'Nach Firma'], ['keine', 'Ohne']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setBahnen(k)}
            style={{
              fontFamily: T.sans, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '5px 12px', borderRadius: 8,
              border: `1px solid ${bahnen === k ? T.lineHot : T.line}`,
              background: bahnen === k ? T.accentSoft : 'transparent',
              color: bahnen === k ? T.accentInk : T.inkDim,
            }}>{label}</button>
        ))}
        <span style={{ fontSize: 12, color: T.muted, marginLeft: 'auto' }}>
          Karte greifen und in die Spalte ziehen — in einer Bahn abgelegt, wechselt auch {bahnen === 'firma' ? 'die Firma' : 'die Person'}.
        </span>
      </div>

      {sichtbar.map(g => (
        <section key={g.id} style={{ marginBottom: bahnen === 'keine' ? 0 : 20 }}>
          {bahnen !== 'keine' && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, margin: '0 0 7px', paddingLeft: 2 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: g.farbe, flex: '0 0 auto' }} />
              <span style={{ fontSize: 14.5, fontWeight: 700, color: T.ink }}>{g.titel}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{g.satz}</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{g.tasks.length}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SPALTEN.length}, minmax(180px, 1fr))`, gap: 9, overflowX: 'auto' }}>
            {SPALTEN.map(sp => {
              const drin = g.tasks.filter(t => (t.status ?? 'todo') === sp.id);
              const zielHier = ueber === `${g.id}|${sp.id}`;
              return (
                <div
                  key={sp.id}
                  onDragOver={e => { e.preventDefault(); setUeber(`${g.id}|${sp.id}`); }}
                  onDragLeave={() => setUeber(u => (u === `${g.id}|${sp.id}` ? null : u))}
                  onDrop={() => ablegen(sp.id, g.id)}
                  style={{
                    background: zielHier ? T.accentSoft : T.panel,
                    border: `1px solid ${zielHier ? T.lineHot : T.line}`,
                    borderRadius: 12, padding: '9px 9px 11px', minHeight: 92,
                    transition: 'background .12s, border-color .12s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 7 }}>
                    <span style={{ ...lbl, fontSize: 11, color: sp.id === 'done' ? T.accent : sp.id === 'blocked' ? T.crit : T.muted }}>{sp.titel}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{drin.length}</span>
                  </div>

                  {drin.length === 0 && (
                    <div style={{ fontSize: 11, color: T.muted, opacity: 0.6, lineHeight: 1.4, padding: '4px 2px' }}>{sp.satz}</div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {drin.map(t => (
                      <Karte
                        key={t.id} t={t} alleTasks={tasks} heute={heute} org={orgVon(t)}
                        greift={zieht === t.id}
                        anfassen={() => setZieht(t.id)}
                        loslassen={() => setZieht(null)}
                        patchTask={patchTask}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!tasks.length && (
        <div style={{ background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: '20px', fontSize: 13, color: T.muted, textAlign: 'center' }}>
          Keine Aufgaben in dieser Auswahl — oben die Filter weiter aufmachen.
        </div>
      )}
    </div>
  );
}

function Karte({ t, alleTasks, heute, org, greift, anfassen, loslassen, patchTask }: {
  t: Task; alleTasks: Task[]; heute: string; org: string; greift: boolean;
  anfassen: () => void; loslassen: () => void;
  patchTask: (id: string, p: Record<string, unknown>) => void;
}) {
  const o = ORG[org];
  const spaet = !!t.dueDate && t.dueDate < heute && t.status !== 'done';
  const naechstePerson = () => {
    const i = PERSON_ZYKLUS.indexOf((t.assignee ?? 'kevin') as typeof PERSON_ZYKLUS[number]);
    return PERSON_ZYKLUS[(i + 1) % PERSON_ZYKLUS.length];
  };

  return (
    <div
      draggable
      onDragStart={anfassen}
      onDragEnd={loslassen}
      style={{
        background: T.panel2, border: `1px solid ${spaet ? `${T.crit}55` : T.lineSoft}`,
        borderLeft: `3px solid ${PRIO_FARBE[t.priority]}`,
        borderRadius: 9, padding: '8px 9px', cursor: 'grab',
        opacity: greift ? 0.4 : 1,
      }}>
      <div style={{
        fontSize: 12.5, color: T.ink, lineHeight: 1.4, marginBottom: 6,
        textDecoration: t.status === 'done' ? 'line-through' : 'none',
        opacity: t.status === 'done' ? 0.6 : 1,
      }}>{t.title}</div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Person: ein Klick reicht ihn weiter — Kevin → Beide → Malin */}
        <button
          onClick={() => patchTask(t.id, { assignee: naechstePerson() })}
          title="Weiterreichen: Kevin → Beide → Malin"
          style={{
            fontFamily: T.mono, fontSize: 11, cursor: 'pointer', padding: '2px 7px', borderRadius: 6,
            border: `1px solid ${PERSON_FARBE[t.assignee ?? 'kevin']}55`,
            background: `${PERSON_FARBE[t.assignee ?? 'kevin']}14`,
            color: PERSON_FARBE[t.assignee ?? 'kevin'],
          }}>{PERSON[t.assignee ?? 'kevin']}</button>

        <Faelligkeit klein wert={t.dueDate} setzen={d => patchTask(t.id, { dueDate: d })} />
        <BlockiertChip klein t={t} alle={alleTasks} />

        {o && <span style={{ fontFamily: T.mono, fontSize: 11, color: o.farbe, opacity: 0.85, marginLeft: 'auto' }}>{o.kurz}</span>}
      </div>
    </div>
  );
}
