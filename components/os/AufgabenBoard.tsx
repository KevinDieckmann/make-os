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
// 24.09.: auf das lebendige Muster umgezogen — rahmenlose Spalten, Karten mit
// Prio-Punkt, Bahnen als Segmente. Ziehen und Ablegen unverändert.

import { useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { ORG, ORGS } from '@/lib/make-one/organisation-data';
import { Faelligkeit } from './Faelligkeit';
import { BlockiertChip } from './Abhaengigkeit';
import { Segmente, Punkt, Leer, prioFarbe, LEUCHT } from './schlank';
import type { Task, TaskStatus } from '@/types/tasks';

const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise };

/** Von links nach rechts — der Weg, den eine Aufgabe nimmt. */
const SPALTEN: { id: TaskStatus; titel: string; satz: string }[] = [
  { id: 'backlog', titel: 'Gesammelt', satz: 'Steht an, aber nicht jetzt' },
  { id: 'todo', titel: 'Zu tun', satz: 'Diese Woche eingeplant' },
  { id: 'in-progress', titel: 'In Arbeit', satz: 'Läuft gerade' },
  { id: 'blocked', titel: 'Blockiert', satz: 'Wartet auf etwas' },
  { id: 'done', titel: 'Erledigt', satz: 'Weg' },
];
const SPALTE_FARBE: Partial<Record<TaskStatus, string>> = { done: LEUCHT.gut, blocked: LEUCHT.achtung, 'in-progress': LEUCHT.puls };

const PERSON: Record<string, string> = { kevin: 'Kevin', malin: 'Malin', both: 'Beide' };
const PERSON_ZYKLUS = ['kevin', 'both', 'malin'] as const;
// Personenfarben sind keine Zustandsfarben — Kevin Türkis, Malin Rosé, Beide Violett.
// (Dieselbe Zuordnung steht in AufgabenView.tsx.)
const PERSON_FARBE: Record<string, string> = { kevin: C.aktiv, malin: LEUCHT.beziehung, both: LEUCHT.agenten };

type Bahnen = 'keine' | 'person' | 'firma';
const BAHN_WAHL: { id: Bahnen; label: string }[] = [{ id: 'person', label: 'Nach Person' }, { id: 'firma', label: 'Nach Firma' }, { id: 'keine', label: 'Ohne' }];

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
        : [{ id: 'alle', titel: '', satz: '', farbe: C.inkLeise, tasks }];

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={mikro}>Bahnen</span>
        <Segmente liste={BAHN_WAHL} aktiv={bahnen} onWahl={setBahnen} />
        <span style={{ fontSize: 12, color: C.inkLeise, marginLeft: 'auto' }}>
          Karte greifen und in die Spalte ziehen — in einer Bahn abgelegt, wechselt auch {bahnen === 'firma' ? 'die Firma' : 'die Person'}.
        </span>
      </div>

      {sichtbar.map(g => (
        <section key={g.id} style={{ marginBottom: bahnen === 'keine' ? 0 : 22 }}>
          {bahnen !== 'keine' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 8px', paddingLeft: 2 }}>
              <Punkt farbe={g.farbe} />
              <span style={{ fontSize: TYP.body, fontWeight: 700, color: C.ink }}>{g.titel}</span>
              <span style={{ fontSize: 12, color: C.inkLeise }}>{g.satz}</span>
              <span style={{ fontFamily: SCHRIFT.display, fontSize: 12, fontWeight: 700, color: g.tasks.length ? C.inkDim : C.inkLeise, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{g.tasks.length || '—'}</span>
            </div>
          )}

          {/* Fünf Spalten; auf dem Handy scrollt das Kanban seitwärts. */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SPALTEN.length}, minmax(180px, 1fr))`, gap: 9, overflowX: 'auto', paddingBottom: 4 }}>
            {SPALTEN.map(sp => {
              const drin = g.tasks.filter(t => (t.status ?? 'todo') === sp.id);
              const zielHier = ueber === `${g.id}|${sp.id}`;
              const farbe = SPALTE_FARBE[sp.id];
              return (
                <div
                  key={sp.id}
                  onDragOver={e => { e.preventDefault(); setUeber(`${g.id}|${sp.id}`); }}
                  onDragLeave={() => setUeber(u => (u === `${g.id}|${sp.id}` ? null : u))}
                  onDrop={() => ablegen(sp.id, g.id)}
                  style={{
                    background: zielHier ? C.aktivSanft : 'rgba(255,255,255,.04)',
                    borderRadius: 14, padding: '10px 9px 11px', minHeight: 92,
                    boxShadow: zielHier ? `inset 0 0 0 1px ${C.aktiv}66, 0 0 24px -8px ${C.aktiv}88` : undefined,
                    transition: 'background .15s ease, box-shadow .15s ease',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
                    <span style={{ ...mikro, display: 'inline-flex', alignItems: 'center', gap: 6, color: farbe ?? C.inkLeise }}>
                      {farbe && <Punkt farbe={farbe} groesse={6} />}{sp.titel}
                    </span>
                    <span style={{ fontFamily: SCHRIFT.display, fontSize: 12, fontWeight: 700, color: drin.length ? C.inkDim : C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{drin.length || '—'}</span>
                  </div>

                  {drin.length === 0 && (
                    <div style={{ fontSize: 11, color: C.inkLeise, opacity: 0.7, lineHeight: 1.4, padding: '4px 2px' }}>{sp.satz}</div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {drin.map(t => (
                      <Kanbankarte
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
        <Leer>Keine Aufgaben in dieser Auswahl — oben die Filter weiter aufmachen.</Leer>
      )}
    </div>
  );
}

function Kanbankarte({ t, alleTasks, heute, org, greift, anfassen, loslassen, patchTask }: {
  t: Task; alleTasks: Task[]; heute: string; org: string; greift: boolean;
  anfassen: () => void; loslassen: () => void;
  patchTask: (id: string, p: Record<string, unknown>) => void;
}) {
  const o = ORG[org];
  const spaet = !!t.dueDate && t.dueDate < heute && t.status !== 'done';
  const person = PERSON_FARBE[t.assignee ?? 'kevin'];
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
        background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '9px 10px', cursor: 'grab',
        opacity: greift ? 0.4 : 1,
        boxShadow: spaet ? `0 0 18px -6px ${LEUCHT.kritisch}88` : 'inset 0 1px 0 rgba(255,255,255,.04)',
        transition: 'opacity .15s ease, box-shadow .2s ease',
      }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 7 }}>
        <span style={{ marginTop: 5, display: 'inline-flex' }}><Punkt farbe={prioFarbe(t.priority)} groesse={7} /></span>
        <div style={{
          fontSize: TYP.bedien, fontWeight: 500, color: C.ink, lineHeight: 1.4, minWidth: 0,
          textDecoration: t.status === 'done' ? 'line-through' : 'none',
          opacity: t.status === 'done' ? 0.6 : 1,
        }}>{t.title}</div>
      </div>

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Person: ein Klick reicht ihn weiter — Kevin → Beide → Malin */}
        <button
          onClick={() => patchTask(t.id, { assignee: naechstePerson() })}
          title="Weiterreichen: Kevin → Beide → Malin"
          className="fassbar"
          style={{
            fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 9px', borderRadius: 999,
            border: 'none', background: `${person}22`, color: person, letterSpacing: '.02em',
          }}>{PERSON[t.assignee ?? 'kevin']}</button>

        <Faelligkeit klein wert={t.dueDate} setzen={d => patchTask(t.id, { dueDate: d })} />
        <BlockiertChip klein t={t} alle={alleTasks} />

        {o && <span style={{ fontFamily: SCHRIFT.text, fontSize: 11, fontWeight: 600, color: o.farbe, opacity: 0.9, marginLeft: 'auto' }}>{o.kurz}</span>}
      </div>
    </div>
  );
}
