'use client';

import { motion } from 'framer-motion';
import { CalendarDays, Clock, ArrowRight, Wifi, WifiOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { BentoCard } from './BentoCard';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useCalendar } from '@/context/CalendarContext';
import { EVENT_CATEGORY_CONFIG } from '@/lib/constants';
import { usePrivacy } from '@/context/PrivacyContext';
import { parseISO, format, isSameDay, addDays, isAfter, isBefore } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function CalendarGlanceCard() {
  const events = useCalendarEvents();
  const { syncStatus } = useCalendar();
  const { privacyMode } = usePrivacy();
  const now = new Date();
  const sevenDays = addDays(now, 7);

  const upcoming = events
    .filter(e => {
      const s = parseISO(e.startDate);
      return isAfter(s, now) && isBefore(s, sevenDays) && e.category !== 'task-deadline';
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 6);

  return (
    <BentoCard className="col-span-1 row-span-1" glowColor="violet">
      <div className="p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-semibold text-white/50 tracking-tight">Nächste 7 Tage</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync status indicator */}
            {syncStatus === 'loading' && (
              <Loader2 className="h-2.5 w-2.5 text-zinc-600 animate-spin" />
            )}
            {syncStatus === 'ok' && (
              <div className="flex items-center gap-1" title="Live — Apple Kalender">
                <Wifi className="h-2.5 w-2.5 text-emerald-500" />
                <span className="text-[8.5px] text-emerald-600 font-medium">Live</span>
              </div>
            )}
            {syncStatus === 'error' && (
              <div title="Mock-Daten — kein Kalender-Zugriff">
                <WifiOff className="h-2.5 w-2.5 text-zinc-700" />
              </div>
            )}
            <Link
              href="/calendar/week"
              className="text-[10px] text-white/25 hover:text-violet-400 transition-colors flex items-center gap-0.5"
            >
              Alle <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>

        {/* Event list */}
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {upcoming.length === 0 ? (
            <p className="text-xs text-white/20 py-4 text-center">Nichts geplant</p>
          ) : (
            upcoming.map((e, i) => {
              const cfg = EVENT_CATEGORY_CONFIG[e.category];
              const isToday = isSameDay(parseISO(e.startDate), now);
              const isSensitive = e.category === 'holding' || e.category === 'private-kevin';
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 group"
                >
                  {/* Category stripe */}
                  <div
                    className="h-4 w-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  {/* Date */}
                  <span className="text-[10px] text-white/25 w-12 shrink-0 font-mono">
                    {isToday
                      ? 'Heute'
                      : format(parseISO(e.startDate), 'E d.', { locale: de })}
                  </span>
                  {/* Title */}
                  <span className={cn(
                    'text-[11px] text-white/65 truncate flex-1 transition-all duration-300',
                    privacyMode && isSensitive ? 'privacy-blur' : ''
                  )}>
                    {e.title}
                  </span>
                  {/* Time */}
                  {!e.allDay && (
                    <span className="text-[9.5px] text-white/20 shrink-0 font-mono">
                      {format(parseISO(e.startDate), 'HH:mm')}
                    </span>
                  )}
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer: current time */}
        <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-1.5">
          <Clock className="h-2.5 w-2.5 text-white/20" />
          <span className="text-[9.5px] text-white/20 font-mono">
            {format(now, 'EEE, d. MMM — HH:mm', { locale: de })}
          </span>
        </div>
      </div>
    </BentoCard>
  );
}
