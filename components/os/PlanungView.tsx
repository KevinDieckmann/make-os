'use client';

import Link from 'next/link';
import { localDay } from '@/lib/zeit';
import { useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import type { Priority, Task } from '@/types';
import { Rich } from './Rich';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const PRIO: Record<Priority, string> = { critical: T.crit, high: T.amber, medium: T.accent, low: T.muted };

function iso(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return localDay(d);
}

export function PlanungView() {
  const { state, dispatch } = useTasks();
  const [plan, setPlan] = useState<string>('');
  const [planning, setPlanning] = useState(false);

  const today = iso(0), weekEnd = iso(7);
  const projName = (id: string) => state.projects.find(p => p.id === id)?.title ?? '—';

  const groups = useMemo(() => {
    const open = state.tasks.filter(t => t.status !== 'done');
    const rank: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sort = (a: Task, b: Task) => (rank[a.priority] - rank[b.priority]) || a.title.localeCompare(b.title);
    return {
      heute: open.filter(t => t.dueDate && t.dueDate <= today).sort(sort),
      woche: open.filter(t => t.dueDate && t.dueDate > today && t.dueDate <= weekEnd).sort(sort),
      offen: open.filter(t => !t.dueDate || t.dueDate > weekEnd).sort(sort),
    };
  }, [state.tasks, today, weekEnd]);

  async function makePlan() {
    setPlanning(true); setPlan('');
    const open = state.tasks.filter(t => t.status !== 'done');
    const list = open.map(t => `- ${t.title} · Prio ${t.priority}${t.dueDate ? ` · fällig ${t.dueDate}` : ''} · ${projName(t.projectId)} · ${t.assignee}`).join('\n');
    const message = [
      'Erstelle mir einen realistischen, priorisierten **Tagesplan für heute**.',
      'Regeln: Fokuszeit 09–17 schützen; das Wichtigste zuerst; sei realistisch (nicht alles an einem Tag).',
      'Struktur bitte so: **Morgens**, **Mittags**, **Nachmittags** als Blöcke mit je 1–3 konkreten Punkten,',
      'danach **Delegation** (was an Malin/Frank/Alex geht) und **Heute bewusst NICHT** (was warten kann). Kurz und konkret.',
      '',
      'Meine offenen Aufgaben:',
      list || '(keine)',
    ].join('\n');
    try {
      const r = await fetch('/api/kimmi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, noTools: true }) });
      const d = await r.json();
      setPlan(d.reply ?? 'Kein Plan erhalten.');
    } catch { setPlan('Ich konnte den Plan gerade nicht erstellen — versuch es nochmal.'); }
    finally { setPlanning(false); }
  }

  const taskRow = (t: Task, i: number) => (
    <div key={t.id} style={{ display: 'flex', gap: 12, padding: '11px 0', alignItems: 'flex-start', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
      <button onClick={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} aria-label="Erledigen"
        style={{ width: 18, height: 18, borderRadius: 6, flex: '0 0 auto', marginTop: 1, cursor: 'pointer', border: `1.6px solid ${T.muted}`, background: 'transparent' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.35 }}>{t.title}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, textTransform: 'uppercase', color: PRIO[t.priority], border: `1px solid ${PRIO[t.priority]}44`, borderRadius: 5, padding: '1px 6px' }}>{t.priority}</span>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{projName(t.projectId)}</span>
          {t.dueDate && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.amber }}>fällig {t.dueDate.slice(8, 10)}.{t.dueDate.slice(5, 7)}.</span>}
        </div>
      </div>
    </div>
  );

  const col = (title: string, items: Task[], hint: string) => (
    <div style={{ ...panel, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={lbl}>{title}</div>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{items.length}</span>
      </div>
      {items.length === 0 ? <div style={{ fontSize: 12.5, color: T.muted }}>{hint}</div> : items.map(taskRow)}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 48px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <Seitenkopf
          rubrik={<>Planung · deinen Tag & deine Woche steuern</>}
          titel={<>Planungsmodus</>}
        />

        {/* MAKE-Tagesplan */}
        <section style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: plan || planning ? 14 : 0 }}>
            <div>
              <div style={{ ...lbl }}><span style={{ color: T.accent }}>MAKE</span> · Tagesplan</div>
              <div style={{ fontSize: 13, color: T.inkDim, marginTop: 6 }}>Lass MAKE aus deinen offenen Aufgaben einen realistischen, priorisierten Tag bauen — inkl. Delegation.</div>
            </div>
            <button onClick={makePlan} disabled={planning}
              style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, border: `1px solid ${T.accent}`, background: planning ? T.panel2 : T.accent, color: planning ? T.muted : T.void, cursor: planning ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {planning ? 'MAKE plant …' : plan ? '↻ Neu planen' : 'Tag planen'}
            </button>
          </div>
          {plan && <div style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 12, padding: '16px 18px' }}><Rich text={plan} /></div>}
        </section>

        {/* Aufgaben nach Zeithorizont */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          {col('Heute · überfällig', groups.heute, 'Nichts fällig — sauber. 🎯')}
          {col('Diese Woche', groups.woche, 'Keine Aufgaben mit Datum diese Woche.')}
          {col('Offen · ohne Datum', groups.offen, 'Backlog leer.')}
        </div>
      </div>
    </div>
  );
}
