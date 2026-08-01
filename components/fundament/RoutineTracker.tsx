'use client';

import { useState } from 'react';
import { HABITS, MORNING_ROUTINE, EVENING_ROUTINE, type Habit, type ChecklistStep } from '@/lib/make-one/fundament-data';

const DAYS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
const TODAY_IDX = 2; // Mi 29.07.

function countDone(week: (boolean | null)[]) {
  return week.filter(d => d === true).length;
}

function HabitRow({ habit }: { habit: Habit }) {
  const [week, setWeek] = useState(habit.week);
  const done = countDone(week);
  const onTarget = done >= habit.targetPerWeek;

  const toggleToday = () => {
    setWeek(w => w.map((d, i) => (i === TODAY_IDX ? (d === true ? false : true) : d)));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #141414' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 8.5, color: habit.accent, letterSpacing: '0.1em', marginBottom: 3 }}>
          {habit.short}
        </div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{habit.label}</div>
      </div>

      {/* Week dots */}
      <div style={{ display: 'flex', gap: 4 }}>
        {week.map((d, i) => {
          const isToday = i === TODAY_IDX;
          const bg = d === true ? habit.accent : d === false ? '#1a1a1a' : 'transparent';
          const border = d === null ? '1px dashed #2a2a2a' : isToday ? `1px solid ${habit.accent}` : '1px solid #1e1e1e';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div
                onClick={isToday ? toggleToday : undefined}
                title={isToday ? 'Heute abhaken' : undefined}
                style={{ width: 18, height: 18, background: bg, border, cursor: isToday ? 'pointer' : 'default' }}
              />
              <span style={{ fontFamily: 'var(--mono-font)', fontSize: 7, color: isToday ? habit.accent : '#444' }}>{DAYS[i]}</span>
            </div>
          );
        })}
      </div>

      {/* Adherence */}
      <div style={{ width: 54, textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 15, color: onTarget ? habit.accent : '#fff', fontWeight: 600 }}>
          {done}<span style={{ color: '#555', fontSize: 11 }}>/{habit.targetPerWeek}</span>
        </div>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 7.5, color: onTarget ? '#00ff66' : '#666', letterSpacing: '0.06em' }}>
          {onTarget ? '✓ ZIEL' : 'WOCHE'}
        </div>
      </div>
    </div>
  );
}

function Checklist({ title, steps, accent }: { title: string; steps: ChecklistStep[]; accent: string }) {
  const [items, setItems] = useState(steps);
  const doneCount = items.filter(i => i.done).length;
  const totalMin = items.reduce((s, i) => s + i.minutes, 0);

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: accent, letterSpacing: '0.1em' }}>{title}</span>
        <span style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#666' }}>{doneCount}/{items.length} · {totalMin}min</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(step => (
          <div
            key={step.id}
            onClick={() => setItems(prev => prev.map(p => (p.id === step.id ? { ...p, done: !p.done } : p)))}
            className="interactive-element"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#0a0a0a', border: '1px solid #161616', cursor: 'pointer' }}
          >
            <div style={{ width: 12, height: 12, border: `1px solid ${step.done ? accent : '#333'}`, background: step.done ? accent : 'transparent', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: step.done ? '#666' : '#ddd', textDecoration: step.done ? 'line-through' : 'none', flex: 1 }}>{step.label}</span>
            <span style={{ fontFamily: 'var(--mono-font)', fontSize: 8.5, color: '#555' }}>{step.minutes}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoutineTracker() {
  return (
    <div className="os-card" style={{ padding: 16 }}>
      <div style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#777', letterSpacing: '0.14em', marginBottom: 10 }}>
        ROUTINEN // DIESE WOCHE — KW 31
      </div>

      {HABITS.map(h => <HabitRow key={h.id} habit={h} />)}

      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <Checklist title="MORGEN" steps={MORNING_ROUTINE} accent="#ffaa00" />
        <Checklist title="ABEND" steps={EVENING_ROUTINE} accent="#a78bfa" />
      </div>
    </div>
  );
}
