'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Calendar, MessageSquare, FileText,
  Paperclip, Users, RefreshCw,
} from 'lucide-react';
import { BentoCard } from './BentoCard';
import { cn } from '@/lib/utils';
import {
  format, parseISO, isToday, isTomorrow, differenceInDays,
} from 'date-fns';
import { de } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MsEmail {
  id: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  preview: string;
  receivedAt: string;
  isRead: boolean;
  hasAttachment: boolean;
  importance: string;
  category: string;
}

interface MsCalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location?: string | null;
  attendees: string[];
  hasMsTeams: boolean;
}

interface MsTeamsMsg {
  id: string;
  from: string;
  preview: string;
  sentAt: string;
  chatType: string;
}

interface MsDoc {
  id: string;
  name: string;
  webUrl: string;
  modifiedAt: string;
  folder: string;
  preview: string;
}

interface MsData {
  emails: MsEmail[];
  calendar: MsCalEvent[];
  teams: MsTeamsMsg[];
  documents: MsDoc[];
  lastUpdated: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const SENDER_PALETTE: Record<string, string> = {
  'Frank Mathick':          '#60a5fa',
  'Danilo Schmidt':         '#a78bfa',
  'Jan Kronenberger':       '#f472b6',
  'Katharina Heinschke':    '#ec4899',
  'Arndt Kempen':           '#f59e0b',
  'Alexander Groß-Ophoff':  '#10b981',
  'Fireflies.ai':           '#6366f1',
  'Galerie Mond Fine Arts': '#d97706',
};

function senderColor(name: string): string {
  return SENDER_PALETTE[name] ?? '#94a3b8';
}

function relativeTime(iso: string): string {
  const d = parseISO(iso);
  const diff = differenceInDays(new Date(), d);
  if (isToday(d))      return `Heute ${format(d, 'HH:mm')}`;
  if (diff <= 1)       return `Gestern ${format(d, 'HH:mm')}`;
  if (diff < 7)        return format(d, 'EEE HH:mm', { locale: de });
  return format(d, 'd. MMM', { locale: de });
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = 'mails' | 'termine' | 'teams' | 'dokumente';

const TABS: {
  id: TabId;
  label: string;
  Icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'mails',     label: 'Mails',      Icon: Mail },
  { id: 'termine',   label: 'Termine',    Icon: Calendar },
  { id: 'teams',     label: 'Teams',      Icon: MessageSquare },
  { id: 'dokumente', label: 'Dokumente',  Icon: FileText },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function IntelligenceFeedCard() {
  const [tab, setTab]       = useState<TabId>('mails');
  const [data, setData]     = useState<MsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/microsoft')
      .then(r => r.json())
      .then((d: MsData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const unread   = data?.emails.filter(e => !e.isRead).length ?? 0;
  const upcoming = (data?.calendar ?? []).filter(e => parseISO(e.start) > new Date());

  function tabCount(id: TabId): number {
    if (id === 'mails')     return unread;
    if (id === 'termine')   return upcoming.length;
    if (id === 'dokumente') return data?.documents.length ?? 0;
    return 0;
  }

  return (
    <BentoCard glowColor="blue">
      <div className="p-4 h-full flex flex-col min-h-[340px]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Microsoft logo */}
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 22 22" fill="none">
              <rect x="1"  y="1"  width="9" height="9" fill="#f25022" rx="0.5"/>
              <rect x="12" y="1"  width="9" height="9" fill="#7fba00" rx="0.5"/>
              <rect x="1"  y="12" width="9" height="9" fill="#00a4ef" rx="0.5"/>
              <rect x="12" y="12" width="9" height="9" fill="#ffb900" rx="0.5"/>
            </svg>
            <span className="text-[11px] font-semibold text-white/50 tracking-tight">
              Microsoft 365
            </span>
            {unread > 0 && (
              <span className="text-[8.5px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 px-1.5 py-0.5 rounded-full leading-none">
                {unread} neu
              </span>
            )}
          </div>
          {data && (
            <span className="text-[9px] text-white/20 font-mono">
              Sync {format(parseISO(data.lastUpdated), 'HH:mm')}
            </span>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0.5 mb-3 border-b border-white/[0.06] pb-2">
          {TABS.map(({ id, label, Icon }) => {
            const count  = tabCount(id);
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                  active
                    ? 'bg-white/[0.08] text-white/80'
                    : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]',
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {label}
                {count > 0 && (
                  <span className={cn(
                    'text-[8px] font-bold px-1 py-0.5 rounded-full leading-none',
                    active ? 'bg-white/10 text-white/60' : 'bg-white/[0.06] text-white/30',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {loading && (
            <div className="flex items-center justify-center h-24">
              <RefreshCw className="h-4 w-4 text-white/15 animate-spin" />
            </div>
          )}

          {!loading && data && (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="space-y-0.5"
              >

                {/* ──── MAILS ──── */}
                {tab === 'mails' && data.emails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-default"
                  >
                    {/* Avatar */}
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold"
                      style={{
                        backgroundColor: senderColor(email.senderName) + '28',
                        color: senderColor(email.senderName),
                      }}
                    >
                      {initials(email.senderName)}
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn(
                          'text-[10px] truncate leading-none',
                          email.isRead ? 'text-white/40 font-normal' : 'text-white/80 font-semibold',
                        )}>
                          {email.senderName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {email.hasAttachment && (
                            <Paperclip className="h-2 w-2 text-white/20" />
                          )}
                          <span className="text-[8px] text-white/20 font-mono">
                            {relativeTime(email.receivedAt)}
                          </span>
                          {!email.isRead && (
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                          )}
                        </div>
                      </div>
                      <p className={cn(
                        'text-[9.5px] truncate leading-tight mt-0.5',
                        email.isRead ? 'text-white/30' : 'text-white/55',
                      )}>
                        {email.subject}
                      </p>
                      <p className="text-[8.5px] text-white/18 truncate mt-0.5 leading-tight">
                        {email.preview}
                      </p>
                    </div>
                  </div>
                ))}

                {/* ──── TERMINE ──── */}
                {tab === 'termine' && upcoming.slice(0, 14).map((ev) => {
                  const start      = parseISO(ev.start);
                  const end        = parseISO(ev.end);
                  const evToday    = isToday(start);
                  const evTomorrow = isTomorrow(start);

                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                    >
                      {/* Date chip */}
                      <div className={cn(
                        'h-8 w-8 rounded-md flex flex-col items-center justify-center shrink-0 border',
                        evToday
                          ? 'bg-amber-500/20 border-amber-500/40'
                          : 'bg-white/[0.04] border-white/[0.07]',
                      )}>
                        <span className={cn(
                          'text-[7px] font-semibold uppercase leading-none',
                          evToday ? 'text-amber-400' : 'text-white/25',
                        )}>
                          {evToday
                            ? 'Heute'
                            : evTomorrow
                              ? 'Mo'
                              : format(start, 'EEE', { locale: de })}
                        </span>
                        <span className={cn(
                          'text-[11px] font-bold leading-none mt-0.5',
                          evToday ? 'text-amber-300' : 'text-white/50',
                        )}>
                          {format(start, 'd')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] text-white/65 font-medium truncate">
                            {ev.title}
                          </p>
                          {ev.hasMsTeams && (
                            <span className="text-[7px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded leading-none shrink-0">
                              Teams
                            </span>
                          )}
                        </div>
                        {!ev.isAllDay && (
                          <p className="text-[8.5px] text-white/30 font-mono">
                            {format(start, 'HH:mm')}
                            {' – '}
                            {format(end, 'HH:mm')}
                          </p>
                        )}
                        {ev.attendees.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Users className="h-2 w-2 text-white/15 shrink-0" />
                            <span className="text-[8px] text-white/25 truncate">
                              {ev.attendees.slice(0, 2).join(', ')}
                              {ev.attendees.length > 2 && ` +${ev.attendees.length - 2}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* ──── TEAMS ──── */}
                {tab === 'teams' && data.teams.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 text-[8px] font-bold"
                      style={{ backgroundColor: '#60a5fa28', color: '#60a5fa' }}
                    >
                      {initials(msg.from)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/60 font-medium truncate">
                          {msg.from}
                        </span>
                        <span className="text-[8px] text-white/20 font-mono shrink-0 ml-1">
                          {relativeTime(msg.sentAt)}
                        </span>
                      </div>
                      <p className="text-[9px] text-white/30 mt-0.5 line-clamp-2 leading-tight">
                        {msg.preview}
                      </p>
                    </div>
                  </div>
                ))}

                {/* ──── DOKUMENTE ──── */}
                {tab === 'dokumente' && data.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="h-6 w-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-3 w-3 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[10px] text-white/60 font-medium truncate">
                          {doc.name}
                        </p>
                        <span className="text-[8px] text-white/20 font-mono shrink-0">
                          {format(parseISO(doc.modifiedAt), 'd. MMM', { locale: de })}
                        </span>
                      </div>
                      <p className="text-[8.5px] text-white/25 truncate leading-tight">
                        {doc.folder}
                      </p>
                      <p className="text-[8px] text-white/18 truncate leading-tight mt-0.5">
                        {doc.preview}
                      </p>
                    </div>
                  </div>
                ))}

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
