'use client';

import { motion } from 'framer-motion';
import { Heart, Flame, CalendarHeart } from 'lucide-react';
import { BentoCard } from './BentoCard';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { parseISO, isBefore, isAfter, differenceInDays, format } from 'date-fns';
import { usePrivacy } from '@/context/PrivacyContext';
import { cn } from '@/lib/utils';

export function RelationshipBatteryCard() {
  const events = useCalendarEvents();
  const { privacyMode } = usePrivacy();
  const now = new Date();

  const dateNightEvents = events.filter(e =>
    e.title.toLowerCase().includes('date') ||
    e.title.toLowerCase().includes('dinner') ||
    e.category === 'joint'
  );

  const lastDateNight = dateNightEvents
    .filter(e => isBefore(parseISO(e.startDate), now))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

  const nextDateNight = dateNightEvents
    .filter(e => isAfter(parseISO(e.startDate), now))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const daysSinceLast = lastDateNight
    ? differenceInDays(now, parseISO(lastDateNight.startDate))
    : 14;

  const streak = Math.max(0, 7 - daysSinceLast);
  const batteryLevel = Math.max(5, Math.min(100, 100 - daysSinceLast * 10));

  const batteryColor = batteryLevel > 60 ? '#10b981' : batteryLevel > 30 ? '#f59e0b' : '#ef4444';

  return (
    <BentoCard className="col-span-1 row-span-1" glowColor="pink">
      {/* Pink ambient glow */}
      <div className="absolute inset-0 pointer-events-none rounded-[16px]"
           style={{ background: 'radial-gradient(ellipse at 100% 100%, rgba(236,72,153,0.06) 0%, transparent 60%)' }} />

      <div className="p-4 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-3">
          <Heart className="h-3.5 w-3.5 text-pink-400" />
          <span className="text-[11px] font-semibold text-white/50 tracking-tight">Connection Oasis</span>
        </div>

        {/* Battery visualization */}
        <div className="flex items-center gap-3 mb-3">
          {/* Battery shape */}
          <div className="relative flex items-center">
            <div className="h-8 w-14 rounded-md border border-white/[0.12] bg-white/[0.02] overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${batteryLevel}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{ backgroundColor: batteryColor, opacity: 0.85 }}
              />
            </div>
            <div className="h-2.5 w-0.5 rounded-r-sm ml-px"
                 style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </div>

          <div>
            <p className="text-lg font-bold text-white/90 leading-none">{batteryLevel}%</p>
            <p className="text-[10px] text-white/25 mt-0.5">Connection Level</p>
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-1.5 mb-3">
          <Flame className="h-3 w-3 text-orange-400" />
          <span className="text-[11px] text-white/40">
            {streak > 0 ? `${streak} Tage Streak` : 'Kein aktiver Streak'}
          </span>
        </div>

        {/* Next date night */}
        {nextDateNight && (
          <div className={cn(
            'mt-auto flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-300',
            'bg-pink-500/[0.06] border border-pink-500/10',
            privacyMode ? 'privacy-blur' : ''
          )}>
            <CalendarHeart className="h-3 w-3 text-pink-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 leading-none mb-0.5">Nächste Quality Time</p>
              <p className="text-[11px] text-pink-300/80 truncate font-medium">
                {nextDateNight.title} · {format(parseISO(nextDateNight.startDate), 'E d. MMM')}
              </p>
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  );
}
