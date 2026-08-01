'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, Lock, Target, CheckCircle2, Circle, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Prioritaet = 'Hoch' | 'Medium' | 'Niedrig';
type Status = 'Backlog' | 'In Arbeit' | 'Blockiert' | 'Erledigt';
type Assignee = 'Malin' | 'Kevin' | 'Beide';
type Projekt = 'Holding Alpha' | 'Privat' | 'make OS' | 'CapOS';
type Tab = 'Alle' | 'Malin' | 'Kevin' | 'Holding';

interface Subtask {
  id: string;
  titel: string;
  erledigt: boolean;
}

interface Task {
  id: string;
  titel: string;
  projekt: Projekt;
  zugewiesenZu: Assignee;
  prioritaet: Prioritaet;
  status: Status;
  subtasks: Subtask[];
  abhaengigVon: string | null;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_TASKS: Task[] = [
  {
    id: 't1',
    titel: 'Wireframes für alle Hauptseiten finalisieren',
    projekt: 'make OS',
    zugewiesenZu: 'Malin',
    prioritaet: 'Hoch',
    status: 'In Arbeit',
    subtasks: [
      { id: 't1-s1', titel: 'Dashboard Mockup', erledigt: true },
      { id: 't1-s2', titel: 'Mobile Ansicht', erledigt: true },
      { id: 't1-s3', titel: 'Feedback einarbeiten', erledigt: false },
    ],
    abhaengigVon: null,
  },
  {
    id: 't2',
    titel: 'Investorendeck Q3 aktualisieren',
    projekt: 'Holding Alpha',
    zugewiesenZu: 'Kevin',
    prioritaet: 'Hoch',
    status: 'Blockiert',
    subtasks: [
      { id: 't2-s1', titel: 'Zahlen Q2 eintragen', erledigt: false },
      { id: 't2-s2', titel: 'Design anpassen', erledigt: false },
      { id: 't2-s3', titel: 'An Björn versenden', erledigt: false },
    ],
    abhaengigVon: 't3',
  },
  {
    id: 't3',
    titel: 'Jahresabschluss-Unterlagen zusammenstellen',
    projekt: 'Holding Alpha',
    zugewiesenZu: 'Kevin',
    prioritaet: 'Medium',
    status: 'In Arbeit',
    subtasks: [
      { id: 't3-s1', titel: 'Belege digitalisieren', erledigt: true },
      { id: 't3-s2', titel: 'Steuerberater kontaktieren', erledigt: true },
      { id: 't3-s3', titel: 'Dokumente ans Finanzamt', erledigt: false },
    ],
    abhaengigVon: null,
  },
  {
    id: 't4',
    titel: 'Longrun-Plan für August erstellen',
    projekt: 'Privat',
    zugewiesenZu: 'Malin',
    prioritaet: 'Niedrig',
    status: 'Backlog',
    subtasks: [
      { id: 't4-s1', titel: 'Strecke festlegen', erledigt: false },
      { id: 't4-s2', titel: 'Trainingsplan anpassen', erledigt: false },
    ],
    abhaengigVon: null,
  },
  {
    id: 't5',
    titel: 'CapOS Benutzeroberfläche reviewen',
    projekt: 'CapOS',
    zugewiesenZu: 'Beide',
    prioritaet: 'Hoch',
    status: 'In Arbeit',
    subtasks: [
      { id: 't5-s1', titel: 'Login-Flow testen', erledigt: true },
      { id: 't5-s2', titel: 'Dashboard Feedback geben', erledigt: false },
      { id: 't5-s3', titel: 'Bug-Report erstellen', erledigt: false },
      { id: 't5-s4', titel: 'Alex briefen', erledigt: false },
    ],
    abhaengigVon: null,
  },
  {
    id: 't6',
    titel: 'Gesellschaftervertrag KD Management prüfen',
    projekt: 'Holding Alpha',
    zugewiesenZu: 'Kevin',
    prioritaet: 'Hoch',
    status: 'Erledigt',
    subtasks: [
      { id: 't6-s1', titel: 'Anwalt kontaktieren', erledigt: true },
      { id: 't6-s2', titel: 'Änderungen einarbeiten', erledigt: true },
    ],
    abhaengigVon: null,
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const TABS: Tab[] = ['Alle', 'Malin', 'Kevin', 'Holding'];

const PRIO: Record<Prioritaet, { color: string }> = {
  Hoch:    { color: '#f43f5e' },
  Medium:  { color: '#f59e0b' },
  Niedrig: { color: '#52525b' },
};

const STATUS: Record<Status, { color: string }> = {
  'Backlog':   { color: '#52525b' },
  'In Arbeit': { color: '#8b5cf6' },
  'Blockiert': { color: '#f59e0b' },
  'Erledigt':  { color: '#10b981' },
};

const PROJEKT: Record<Projekt, { color: string; bg: string }> = {
  'Holding Alpha': { color: '#f59e0b', bg: 'rgba(245,158,11,0.09)'  },
  'make OS':       { color: '#8b5cf6', bg: 'rgba(139,92,246,0.09)'  },
  'Privat':        { color: '#f472b6', bg: 'rgba(244,114,182,0.09)' },
  'CapOS':         { color: '#10b981', bg: 'rgba(16,185,129,0.09)'  },
};

const OWNER: Record<Assignee, { color: string; bg: string; initials: string }> = {
  Malin: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', initials: 'M'  },
  Kevin: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  initials: 'K'  },
  Beide: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', initials: 'MK' },
};

const SORT_STATUS: Record<Status, number>   = { 'Blockiert': 0, 'In Arbeit': 1, 'Backlog': 2, 'Erledigt': 3 };
const SORT_PRIO: Record<Prioritaet, number> = { 'Hoch': 0, 'Medium': 1, 'Niedrig': 2 };

// ─── Component ────────────────────────────────────────────────────────────────

export function FocusTasksCard() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [aktiveTab, setAktiveTab] = useState<Tab>('Alle');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['t1']));

  // Filtered + sorted tasks
  const gefilterteTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (aktiveTab === 'Malin')   return t.zugewiesenZu === 'Malin'  || t.zugewiesenZu === 'Beide';
        if (aktiveTab === 'Kevin')   return t.zugewiesenZu === 'Kevin'  || t.zugewiesenZu === 'Beide';
        if (aktiveTab === 'Holding') return t.projekt === 'Holding Alpha';
        return true;
      })
      .sort((a, b) => {
        const sd = SORT_STATUS[a.status] - SORT_STATUS[b.status];
        return sd !== 0 ? sd : SORT_PRIO[a.prioritaet] - SORT_PRIO[b.prioritaet];
      });
  }, [tasks, aktiveTab]);

  // Per-project subtask progress
  const projektFortschritt = useMemo(() => {
    const acc: Record<string, { gesamt: number; erledigt: number; color: string }> = {};
    tasks.forEach(t => {
      if (!acc[t.projekt]) acc[t.projekt] = { gesamt: 0, erledigt: 0, color: PROJEKT[t.projekt].color };
      t.subtasks.forEach(s => {
        acc[t.projekt].gesamt++;
        if (s.erledigt) acc[t.projekt].erledigt++;
      });
    });
    return acc;
  }, [tasks]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id !== taskId ? t : {
          ...t,
          subtasks: t.subtasks.map(s =>
            s.id === subtaskId ? { ...s, erledigt: !s.erledigt } : s
          ),
        }
      )
    );
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col overflow-hidden"
      style={{ minHeight: 420 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg flex items-center justify-center"
               style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Target className="h-3 w-3 text-violet-400" />
          </div>
          <span className="text-[12.5px] font-semibold text-zinc-200 tracking-tight">Fokus Tasks</span>
          <span className="text-[10px] text-zinc-600 tabular-nums">
            {gefilterteTasks.filter(t => t.status !== 'Erledigt').length} offen
          </span>
        </div>
        {/* Tab Bar */}
        <div className="flex items-center gap-0.5 bg-zinc-900/80 rounded-lg p-0.5 border border-zinc-800/60">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setAktiveTab(tab)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-150',
                aktiveTab === tab
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Project Progress Bars ── */}
      <div className="px-4 pb-3 flex gap-4 shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <TrendingUp className="h-2.5 w-2.5 text-zinc-600" />
          <span className="text-[9px] text-zinc-600 uppercase tracking-wider">Projekte</span>
        </div>
        <div className="flex gap-3 flex-1 min-w-0">
          {Object.entries(projektFortschritt).map(([name, data]) => {
            const pct = data.gesamt > 0 ? Math.round((data.erledigt / data.gesamt) * 100) : 0;
            return (
              <div key={name} className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-zinc-600 truncate">{name}</span>
                  <span className="text-[9px] font-semibold tabular-nums ml-1 shrink-0"
                        style={{ color: data.color }}>{pct}%</span>
                </div>
                <div className="h-[2px] bg-zinc-800/80 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.15 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: data.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-zinc-800/50 mx-4 shrink-0" />

      {/* ── Task List ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {gefilterteTasks.map((task, i) => {
            const isExpanded = expandedIds.has(task.id);
            const blockedBy = task.abhaengigVon ? tasks.find(t => t.id === task.abhaengigVon) : null;
            const isActuallyBlocked = blockedBy && blockedBy.status !== 'Erledigt';
            const done  = task.subtasks.filter(s => s.erledigt).length;
            const total = task.subtasks.length;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
                layout="position"
                className={cn(
                  'rounded-xl border overflow-hidden',
                  task.status === 'Erledigt'
                    ? 'border-zinc-800/30 bg-zinc-900/20'
                    : task.status === 'Blockiert'
                    ? 'border-amber-500/12 bg-amber-500/[0.02]'
                    : 'border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700/60 transition-colors duration-150'
                )}
              >
                {/* Main row */}
                <button
                  onClick={() => toggleExpanded(task.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                >
                  {/* Priority dot */}
                  <div
                    className="h-[6px] w-[6px] rounded-full shrink-0"
                    style={{ backgroundColor: PRIO[task.prioritaet].color, boxShadow: `0 0 4px ${PRIO[task.prioritaet].color}60` }}
                  />

                  {/* Title + subtask count */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[11.5px] font-medium leading-snug',
                      task.status === 'Erledigt' ? 'line-through text-zinc-600' : 'text-zinc-300 truncate'
                    )}>
                      {task.titel}
                    </p>
                    {total > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-10 h-[2px] bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(done / total) * 100}%`, backgroundColor: STATUS[task.status].color }}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-600 tabular-nums">{done}/{total}</span>
                      </div>
                    )}
                  </div>

                  {/* Right badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[9px] font-medium px-1.5 py-0.5 rounded-md leading-none"
                      style={{ background: PROJEKT[task.projekt].bg, color: PROJEKT[task.projekt].color }}
                    >
                      {task.projekt}
                    </span>
                    <div
                      className="h-[18px] w-[18px] rounded-full flex items-center justify-center text-[7px] font-bold shrink-0"
                      style={{ background: OWNER[task.zugewiesenZu].bg, color: OWNER[task.zugewiesenZu].color }}
                    >
                      {OWNER[task.zugewiesenZu].initials}
                    </div>
                    <span
                      className="text-[9px] font-medium px-1.5 py-0.5 rounded-md leading-none whitespace-nowrap"
                      style={{ background: `${STATUS[task.status].color}14`, color: STATUS[task.status].color }}
                    >
                      {task.status}
                    </span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChevronDown className="h-3 w-3 text-zinc-700" />
                    </motion.div>
                  </div>
                </button>

                {/* Dependency indicator */}
                {isActuallyBlocked && (
                  <div className="flex items-center gap-1.5 px-3 pb-2 -mt-0.5">
                    <Lock className="h-2.5 w-2.5 text-amber-500/70 shrink-0" />
                    <span className="text-[9.5px] text-amber-500/60 truncate">
                      {`Blockiert durch: „${blockedBy!.titel.length > 38 ? blockedBy!.titel.substring(0, 38) + '…' : blockedBy!.titel}“`}
                    </span>
                  </div>
                )}

                {/* Expandable subtasks */}
                <AnimatePresence>
                  {isExpanded && total > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-zinc-800/40 px-3 pt-2 pb-2.5 space-y-0.5">
                        {task.subtasks.map((sub, si) => (
                          <motion.button
                            key={sub.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: si * 0.04 }}
                            onClick={e => { e.stopPropagation(); toggleSubtask(task.id, sub.id); }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-2 w-full py-[5px] px-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                          >
                            <AnimatePresence mode="wait">
                              {sub.erledigt ? (
                                <motion.div
                                  key="done"
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="open"
                                  initial={{ scale: 0.6, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0.6, opacity: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <Circle className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-500 shrink-0 transition-colors" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <span className={cn(
                              'text-[11px] text-left transition-all duration-200',
                              sub.erledigt
                                ? 'line-through text-zinc-600'
                                : 'text-zinc-400 group-hover:text-zinc-300'
                            )}>
                              {sub.titel}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {gefilterteTasks.length === 0 && (
          <div className="flex items-center justify-center py-10">
            <p className="text-[11px] text-zinc-700">Keine Tasks für diesen Filter</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
