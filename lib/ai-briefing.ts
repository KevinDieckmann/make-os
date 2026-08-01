import type { CalendarEvent } from '@/types/calendar';
import type { Task } from '@/types/tasks';
import { parseISO, format, isSameDay, isPast, isAfter } from 'date-fns';

export interface BriefingData {
  greeting: string;
  headline: string;
  bullets: string[];
  mood: 'positive' | 'neutral' | 'focused' | 'alert';
}

export function generateBriefing(
  events: CalendarEvent[],
  tasks: Task[],
  now: Date = new Date()
): BriefingData {
  const hour = now.getHours();
  const greeting =
    hour < 6  ? 'Gute Nacht' :
    hour < 12 ? 'Guten Morgen' :
    hour < 17 ? 'Guten Tag' :
    hour < 21 ? 'Guten Abend' :
    'Gute Nacht';

  const today = new Date(now);
  const todayEvents = events.filter(e => isSameDay(parseISO(e.startDate), today));
  const dateNight = todayEvents.find(e =>
    e.category === 'joint' && (e.title.toLowerCase().includes('date') || e.title.toLowerCase().includes('abend'))
  );
  const upcomingToday = todayEvents
    .filter(e => !e.allDay && isAfter(parseISO(e.startDate), now))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const overdue = tasks.filter(t =>
    t.dueDate && t.status !== 'done' && isPast(parseISO(t.dueDate)) && isSameDay(parseISO(t.dueDate), now) === false
  );
  const blocked = tasks.filter(t => t.status === 'blocked');
  const inProgress = tasks.filter(t => t.status === 'in-progress');
  const dueToday = tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), today) && t.status !== 'done');

  const bullets: string[] = [];

  if (inProgress.length > 0) {
    const top = inProgress[0];
    bullets.push(`Aktiv: „${top.title}" — ${top.assignee === 'malin' ? 'Malin' : top.assignee === 'kevin' ? 'Kevin' : 'Beide'}s Fokus`);
  }
  if (dueToday.length > 0) {
    bullets.push(`${dueToday.length} Task${dueToday.length > 1 ? 's' : ''} heute fällig`);
  }
  if (upcomingToday.length > 0) {
    const next = upcomingToday[0];
    bullets.push(`Nächster Termin: ${next.title} um ${format(parseISO(next.startDate), 'HH:mm')}`);
  }
  if (dateNight) {
    bullets.push(`Date Night ab ${format(parseISO(dateNight.startDate), 'HH:mm')} — Business-Talk tabu 🚫`);
  }
  if (overdue.length > 0) {
    bullets.push(`${overdue.length} überfällige${overdue.length === 1 ? 'r Task' : ' Tasks'} — Attention needed`);
  }
  if (blocked.length > 0) {
    bullets.push(`${blocked.length} ${blocked.length === 1 ? 'Task blockiert' : 'Tasks blockiert'} — Blocker auflösen`);
  }

  let headline = '';
  let mood: BriefingData['mood'] = 'neutral';

  if (dateNight) {
    headline = `Kevin & Malin, heute Abend gehört euch — ${format(parseISO(dateNight.startDate), 'HH:mm')} Uhr Date Night.`;
    mood = 'positive';
  } else if (overdue.length > 2) {
    headline = `Mehrere Deadlines stehen aus. Heute Priorität setzen und drei kritische Tasks schließen.`;
    mood = 'alert';
  } else if (inProgress.length > 0) {
    const top = inProgress[0];
    headline = `Heute liegt der Fokus auf „${top.title}". ${dueToday.length > 0 ? `${dueToday.length} weitere Task${dueToday.length > 1 ? 's' : ''} fällig.` : 'Ein klarer Tag vor euch.'}`;
    mood = 'focused';
  } else {
    headline = `${todayEvents.length > 0 ? `${todayEvents.length} Termine heute` : 'Ruhiger Tag'}${dueToday.length > 0 ? `, ${dueToday.length} Task${dueToday.length > 1 ? 's' : ''} fällig` : ''}. Stay focused.`;
    mood = 'neutral';
  }

  return { greeting, headline, bullets, mood };
}
