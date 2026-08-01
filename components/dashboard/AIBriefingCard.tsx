'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { BentoCard } from './BentoCard';
import { useTasks } from '@/context/TasksContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { usePrivacy } from '@/context/PrivacyContext';
import { generateBriefing } from '@/lib/ai-briefing';
import { cn } from '@/lib/utils';

export function AIBriefingCard() {
  const { state: taskState } = useTasks();
  const events = useCalendarEvents();
  const { privacyMode } = usePrivacy();

  const briefing = useMemo(() => generateBriefing(events, taskState.tasks, new Date()), [events, taskState.tasks]);

  const moodColors = {
    positive: { accent: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)' },
    neutral:  { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.04)', border: 'rgba(139,92,246,0.12)' },
    focused:  { accent: '#3b82f6', bg: 'rgba(59,130,246,0.05)', border: 'rgba(59,130,246,0.15)' },
    alert:    { accent: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.18)' },
  };
  const colors = moodColors[briefing.mood];

  return (
    <BentoCard className="col-span-2 row-span-1" glowColor={briefing.mood === 'positive' ? 'emerald' : 'violet'}>
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none rounded-[16px]"
           style={{ background: `radial-gradient(ellipse at 0% 0%, ${colors.bg} 0%, transparent 60%)` }} />

      <div className="p-5 h-full flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md flex items-center justify-center"
                 style={{ background: `${colors.accent}22`, border: `1px solid ${colors.accent}33` }}>
              <Sparkles className="h-3 w-3" style={{ color: colors.accent }} />
            </div>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-white/30">Daily Briefing</span>
          </div>
          <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: colors.accent }} />
        </div>

        {/* Greeting */}
        <div>
          <p className="text-xs text-white/35 font-medium mb-1">{briefing.greeting}, Kevin & Malin</p>
          <p className={cn(
            'text-base font-medium leading-snug tracking-tight transition-all duration-300',
            privacyMode ? 'privacy-blur' : 'text-white/85'
          )}>
            {briefing.headline}
          </p>
        </div>

        {/* Bullets */}
        {briefing.bullets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {briefing.bullets.map((b, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-300',
                  privacyMode ? 'privacy-blur' : ''
                )}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                {b}
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </BentoCard>
  );
}
