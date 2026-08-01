'use client';

import { motion } from 'framer-motion';
import { BentoCard } from './BentoCard';
import { useTasks } from '@/context/TasksContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { isSameDay, parseISO, isAfter, addDays } from 'date-fns';
import { CheckCircle2, Clock, AlertTriangle, CalendarClock } from 'lucide-react';

interface StatPillProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  accent: string;
  delay?: number;
}

function StatPill({ icon, value, label, accent, delay = 0 }: StatPillProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col items-center gap-1 p-2 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="h-5 w-5 flex items-center justify-center rounded-md"
           style={{ background: `${accent}15`, color: accent }}>
        {icon}
      </div>
      <span className="text-sm font-bold text-white/85 leading-none">{value}</span>
      <span className="text-[9px] text-white/25 text-center leading-tight">{label}</span>
    </motion.div>
  );
}

export function QuickStatsCard() {
  const { state } = useTasks();
  const events = useCalendarEvents();
  const now = new Date();

  const doneToday = state.tasks.filter(t =>
    t.completedAt && isSameDay(parseISO(t.completedAt), now)
  ).length;

  const inProgress = state.tasks.filter(t => t.status === 'in-progress').length;
  const blocked = state.tasks.filter(t => t.status === 'blocked').length;

  const todayEvents = events.filter(e =>
    isSameDay(parseISO(e.startDate), now)
  ).length;

  const upcomingCount = events.filter(e => {
    const s = parseISO(e.startDate);
    return isAfter(s, now) && !isAfter(s, addDays(now, 7));
  }).length;

  return (
    <BentoCard className="col-span-1 row-span-1" glowColor="none">
      <div className="p-4 h-full flex flex-col">
        <span className="text-[11px] font-semibold text-white/30 tracking-tight mb-3">Heute im Überblick</span>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <StatPill icon={<CheckCircle2 className="h-2.5 w-2.5" />} value={doneToday} label="Erledigt" accent="#10b981" delay={0.05} />
          <StatPill icon={<Clock className="h-2.5 w-2.5" />} value={inProgress} label="In Arbeit" accent="#8b5cf6" delay={0.1} />
          <StatPill icon={<AlertTriangle className="h-2.5 w-2.5" />} value={blocked} label="Blockiert" accent="#f59e0b" delay={0.15} />
          <StatPill icon={<CalendarClock className="h-2.5 w-2.5" />} value={todayEvents + upcomingCount} label="Events" accent="#60a5fa" delay={0.2} />
        </div>
      </div>
    </BentoCard>
  );
}
