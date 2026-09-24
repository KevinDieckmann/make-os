'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type ProjectTask, type SubTask } from '@/types/make-os';

// ─── DEMO DATA ─────────────────────────────────────────────────────────────

const INITIAL_TASKS: ProjectTask[] = [
  // PHASE 1 — Executive Focus
  {
    id: 'T-001',
    title: 'CapOS Backend-Architektur reviewen',
    project: 'POINCAP',
    assignedTo: 'Kevin',
    priority: 'CRITICAL',
    status: 'IN_ARBEIT',
    hubermanPhase: 1,
    dueDate: '2026-06-25',
    subtasks: [
      { id: 'S-001a', title: 'API-Routen dokumentieren', completed: true },
      { id: 'S-001b', title: 'Datenbankschema validieren', completed: false },
      { id: 'S-001c', title: 'Performance-Tests definieren', completed: false },
    ],
  },
  {
    id: 'T-002',
    title: 'KD Management UG — Notartermin vorbereiten',
    project: 'Holding',
    assignedTo: 'Kevin',
    priority: 'HIGH',
    status: 'OFFEN',
    hubermanPhase: 1,
    dueDate: '2026-06-25',
    subtasks: [
      { id: 'S-002a', title: 'Gesellschaftsvertrag prüfen', completed: true },
      { id: 'S-002b', title: 'Personalausweis bereithalten', completed: false },
    ],
  },
  {
    id: 'T-003',
    title: 'Investorendeck Q3 aktualisieren',
    project: 'Holding',
    assignedTo: 'Kevin',
    priority: 'HIGH',
    status: 'BLOCKIERT',
    hubermanPhase: 1,
    blockedByTaskId: 'T-004',
    dueDate: '2026-06-28',
    subtasks: [],
  },
  {
    id: 'T-004',
    title: 'Jahresabschluss-Unterlagen zusammenstellen',
    project: 'Holding',
    assignedTo: 'Both',
    priority: 'CRITICAL',
    status: 'IN_ARBEIT',
    hubermanPhase: 1,
    subtasks: [
      { id: 'S-004a', title: 'BWA von Steuerberater anfordern', completed: false },
      { id: 'S-004b', title: 'Kontoauszüge digitalisieren', completed: false },
    ],
  },
  // PHASE 2 — Creative Cooperation
  {
    id: 'T-005',
    title: 'KEMARIS Connect Event-Konzept entwickeln',
    project: 'Connect',
    assignedTo: 'Malin',
    priority: 'MEDIUM',
    status: 'IN_ARBEIT',
    hubermanPhase: 2,
    dueDate: '2026-07-01',
    subtasks: [
      { id: 'S-005a', title: 'Location-Optionen recherchieren', completed: true },
      { id: 'S-005b', title: 'Speaker-Liste erstellen', completed: false },
    ],
  },
  {
    id: 'T-006',
    title: 'make OS Dashboard — Feedback einarbeiten',
    project: 'make OS',
    assignedTo: 'Both',
    priority: 'MEDIUM',
    status: 'OFFEN',
    hubermanPhase: 2,
    subtasks: [],
  },
  {
    id: 'T-007',
    title: 'Wochenziele für KW27 gemeinsam definieren',
    project: 'Private',
    assignedTo: 'Both',
    priority: 'LOW',
    status: 'OFFEN',
    hubermanPhase: 2,
    subtasks: [],
  },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OFFEN:    '#555555',
  IN_ARBEIT: '#00aaff',
  BLOCKIERT: '#ff8800',
  ERLEDIGT:  '#00ff66',
};

const PRIO_COLORS: Record<string, string> = {
  CRITICAL: '#ff4444',
  HIGH:     '#ff8800',
  MEDIUM:   '#ffffff',
  LOW:      '#555555',
};

const ASSIGNEE_COLORS: Record<string, string> = {
  Malin: '#ec4899',
  Kevin: '#3b82f6',
  Both:  '#8b5cf6',
};

const PROJECT_LABELS: Record<string, string> = {
  Holding:  'HOLDING',
  Private:  'PRIVAT',
  'make OS': 'MAKE OS',
  CapOS:    'CAPOS',
  Connect:  'CONNECT',
};

// ─── SUBTASK ROW ───────────────────────────────────────────────────────────

function SubtaskRow({ sub, onToggle }: { sub: SubTask; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="interactive-element"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0 4px 16px',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 8, height: 8, border: `1px solid ${sub.completed ? '#00ff66' : '#555'}`,
        background: sub.completed ? '#00ff66' : 'transparent',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {sub.completed && <span style={{ color: '#000', fontSize: 11, fontWeight: 900 }}>✓</span>}
      </div>
      <span style={{
        fontFamily: 'var(--mono-font)',
        fontSize: 11,
        color: sub.completed ? '#555' : '#aaaaaa',
        textDecoration: sub.completed ? 'line-through' : 'none',
        letterSpacing: '0.02em',
      }}>
        {sub.title}
      </span>
    </div>
  );
}

// ─── TASK ROW ─────────────────────────────────────────────────────────────

function TaskRow({ task, blocker, onToggleSubtask }: {
  task: ProjectTask;
  blocker?: ProjectTask;
  onToggleSubtask: (taskId: string, subId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubtasks = task.subtasks.length > 0;
  const completedCount = task.subtasks.filter(s => s.completed).length;

  return (
    <div style={{ borderBottom: '1px solid #111' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '9px 0' }}>

        {/* Toggle / ID */}
        <div
          onClick={() => hasSubtasks && setExpanded(v => !v)}
          style={{
            width: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: hasSubtasks ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', letterSpacing: '0.06em' }}>
            {task.id}
          </span>
          {hasSubtasks && (
            <span style={{ fontSize: 11, color: '#777', transform: expanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 120ms' }}>
              ▶
            </span>
          )}
        </div>

        {/* Status dot */}
        <div style={{ width: 8, height: 8, background: STATUS_COLORS[task.status], flexShrink: 0, marginRight: 10 }} />

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
              fontSize: 13,
              color: task.status === 'ERLEDIGT' ? '#444' : '#ffffff',
              textDecoration: task.status === 'ERLEDIGT' ? 'line-through' : 'none',
              fontWeight: 500,
            }}>
              {task.title}
            </span>

            {/* Blocked indicator */}
            {task.blockedByTaskId && blocker && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 11 }}>🔒</span>
                <span style={{
                  fontFamily: 'var(--mono-font)',
                  fontSize: 11,
                  color: '#ff8800',
                  border: '1px solid #ff880044',
                  padding: '1px 5px',
                  letterSpacing: '0.08em',
                }}>
                  BLOCKIERT DURCH ID: {task.blockedByTaskId}
                </span>
              </div>
            )}
          </div>

          {/* Sub-info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#777', letterSpacing: '0.08em' }}>
              {PROJECT_LABELS[task.project]}
            </span>
            {task.dueDate && (
              <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', letterSpacing: '0.06em' }}>
                DUE {task.dueDate}
              </span>
            )}
            {hasSubtasks && (
              <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', letterSpacing: '0.06em' }}>
                {completedCount}/{task.subtasks.length} SUBS
              </span>
            )}
          </div>
        </div>

        {/* Right meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}>
          <span style={{
            fontFamily: 'var(--mono-font)',
            fontSize: 11,
            color: PRIO_COLORS[task.priority],
            letterSpacing: '0.08em',
            border: `1px solid ${PRIO_COLORS[task.priority]}44`,
            padding: '1px 5px',
          }}>
            {task.priority}
          </span>
          <div style={{
            width: 16, height: 16,
            background: ASSIGNEE_COLORS[task.assignedTo] + '22',
            border: `1px solid ${ASSIGNEE_COLORS[task.assignedTo]}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: ASSIGNEE_COLORS[task.assignedTo], fontWeight: 700, fontFamily: 'var(--mono-font)' }}>
              {task.assignedTo === 'Both' ? 'MK' : task.assignedTo[0]}
            </span>
          </div>
        </div>
      </div>

      {/* Subtasks (animated) */}
      <AnimatePresence initial={false}>
        {expanded && task.subtasks.length > 0 && (
          <motion.div
            key="subs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ background: '#050505', borderTop: '1px solid #111', paddingBottom: 6 }}>
              {task.subtasks.map(sub => (
                <SubtaskRow
                  key={sub.id}
                  sub={sub}
                  onToggle={() => onToggleSubtask(task.id, sub.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

export function TaskManager() {
  const [tasks, setTasks] = useState<ProjectTask[]>(INITIAL_TASKS);
  const [filter, setFilter] = useState<'ALL' | 'Malin' | 'Kevin' | 'Both'>('ALL');

  function toggleSubtask(taskId: string, subId: string) {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) }
        : t,
    ));
  }

  function getBlocker(task: ProjectTask): ProjectTask | undefined {
    if (!task.blockedByTaskId) return undefined;
    return tasks.find(t => t.id === task.blockedByTaskId);
  }

  const phase1 = tasks.filter(t => t.hubermanPhase === 1 && (filter === 'ALL' || t.assignedTo === filter || t.assignedTo === 'Both'));
  const phase2 = tasks.filter(t => t.hubermanPhase === 2 && (filter === 'ALL' || t.assignedTo === filter || t.assignedTo === 'Both'));

  return (
    <div className="os-card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid #1e1e1e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.12em' }}>
            SYS.TASKS
          </span>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', border: '1px solid #00ff6633', padding: '1px 6px' }}>
            {tasks.filter(t => t.status !== 'ERLEDIGT').length} OFFEN
          </span>
          {tasks.filter(t => t.status === 'BLOCKIERT').length > 0 && (
            <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ff8800', border: '1px solid #ff880033', padding: '1px 6px' }}>
              {tasks.filter(t => t.status === 'BLOCKIERT').length} BLOCKIERT
            </span>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 1 }}>
          {(['ALL', 'Malin', 'Kevin', 'Both'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="interactive-element"
              style={{
                padding: '3px 8px',
                fontFamily: 'var(--mono-font)',
                fontSize: 11,
                letterSpacing: '0.08em',
                background: filter === f ? '#1e1e1e' : 'transparent',
                border: `1px solid ${filter === f ? '#2a2a2a' : '#1e1e1e'}`,
                color: filter === f ? '#ffffff' : '#888',
                cursor: 'pointer',
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Phase 1 Block */}
      <div style={{ padding: '10px 14px 0' }}>
        <div className="phase-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, background: '#00ff66' }} />
          // PHASE_1: EXEKUTIVER_FOKUS (HIGH DOPAMINE) — {phase1.length} TASKS
        </div>
        {phase1.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            blocker={getBlocker(task)}
            onToggleSubtask={toggleSubtask}
          />
        ))}
        {phase1.length === 0 && (
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', padding: '12px 0', letterSpacing: '0.06em' }}>
            KEINE PHASE_1 TASKS
          </div>
        )}
      </div>

      {/* Phase 2 Block */}
      <div style={{ padding: '12px 14px 0' }}>
        <div className="phase-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, background: '#00aaff' }} />
          // PHASE_2: KREATIVE_KOOPERATION (SEROTONIN) — {phase2.length} TASKS
        </div>
        {phase2.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            blocker={getBlocker(task)}
            onToggleSubtask={toggleSubtask}
          />
        ))}
        {phase2.length === 0 && (
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', padding: '12px 0', letterSpacing: '0.06em' }}>
            KEINE PHASE_2 TASKS
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />
    </div>
  );
}
