import type { CalendarEvent } from '@/types/calendar';

const now = new Date().toISOString();

// Date helper relative to today
const today = new Date();
function dateAt(dayOffset: number, hour = 9, minute = 0): string {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function dateStr(dayOffset: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().split('T')[0] + 'T00:00:00.000Z';
}

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  // JOINT
  {
    id: 'cal-1',
    title: 'Sunday Dinner Date',
    description: 'Gemeinsames Kochen und Zeit zu zweit.',
    category: 'joint',
    owner: 'both',
    startDate: dateAt(0 - today.getDay() + 7, 19, 0),
    endDate: dateAt(0 - today.getDay() + 7, 21, 30),
    allDay: false,
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [0] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-2',
    title: 'MAKE Wochenplanung',
    description: 'Tasks reviewen, Prioritäten setzen, nächste Woche planen.',
    category: 'joint',
    owner: 'both',
    startDate: dateAt(1, 8, 0),
    endDate: dateAt(1, 8, 45),
    allDay: false,
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-3',
    title: 'Date Night — Restaurantbesuch',
    description: 'Neues Restaurant in der Innenstadt ausprobieren.',
    category: 'joint',
    owner: 'both',
    startDate: dateAt(4, 19, 30),
    endDate: dateAt(4, 22, 0),
    allDay: false,
    location: 'Restaurant Mitte, Berlin',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-4',
    title: 'Kurzurlaub Hamburg',
    description: 'Wochenende in Hamburg — Alster, Essen, Entspannen.',
    category: 'joint',
    owner: 'both',
    startDate: dateStr(12),
    endDate: dateStr(14),
    allDay: true,
    createdAt: now,
    updatedAt: now,
  },

  // PRIVATE MALIN
  {
    id: 'cal-5',
    title: 'Longrun 18 km',
    description: 'Marathon-Training Woche 3 — Tempo-Lauf.',
    category: 'private-malin',
    owner: 'malin',
    startDate: dateAt(2, 7, 0),
    endDate: dateAt(2, 9, 0),
    allDay: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-6',
    title: 'Yoga Klasse',
    category: 'private-malin',
    owner: 'malin',
    startDate: dateAt(3, 18, 0),
    endDate: dateAt(3, 19, 15),
    allDay: false,
    location: 'Yoga Studio Kreuzberg',
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [3] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-7',
    title: 'Friseurtermin',
    category: 'private-malin',
    owner: 'malin',
    startDate: dateAt(8, 11, 0),
    endDate: dateAt(8, 12, 30),
    allDay: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-8',
    title: 'Freundinnen-Brunch',
    category: 'private-malin',
    owner: 'malin',
    startDate: dateAt(9, 10, 30),
    endDate: dateAt(9, 13, 0),
    allDay: false,
    location: 'Café Josefine',
    createdAt: now,
    updatedAt: now,
  },

  // PRIVATE KEVIN
  {
    id: 'cal-9',
    title: 'Strategie-Call mit Frank & Björn',
    description: 'CapOS Strategie, Gründungen, Finanzen — monatlicher Check-in.',
    category: 'private-kevin',
    owner: 'kevin',
    startDate: dateAt(1, 10, 0),
    endDate: dateAt(1, 11, 30),
    allDay: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-10',
    title: 'Mentoring Call mit Danilo',
    category: 'private-kevin',
    owner: 'kevin',
    startDate: dateAt(3, 15, 0),
    endDate: dateAt(3, 16, 0),
    allDay: false,
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [4] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-11',
    title: 'Steuerberater Gespräch',
    category: 'private-kevin',
    owner: 'kevin',
    startDate: dateAt(5, 14, 0),
    endDate: dateAt(5, 15, 0),
    allDay: false,
    createdAt: now,
    updatedAt: now,
  },

  // HOLDING / BUSINESS
  {
    id: 'cal-12',
    title: 'Monday Check-In',
    description: 'Wöchentliches Team-Meeting: Kevin, Frank, Jan, Katharina.',
    category: 'holding',
    owner: 'kevin',
    startDate: dateAt(1, 9, 0),
    endDate: dateAt(1, 9, 45),
    allDay: false,
    recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1] },
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-13',
    title: 'CapOS Demo Vorbereitung',
    description: 'Pitch-Deck finalisieren, Demo-Flow testen.',
    category: 'holding',
    owner: 'kevin',
    startDate: dateAt(6, 13, 0),
    endDate: dateAt(6, 17, 0),
    allDay: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-14',
    title: 'KEMARIS Connect Event',
    description: 'Networking Event — ca. 30 Teilnehmer, Venue: Betahaus Berlin.',
    category: 'holding',
    owner: 'both',
    startDate: dateAt(18, 18, 0),
    endDate: dateAt(18, 21, 0),
    allDay: false,
    location: 'Betahaus Berlin, Prinzessinnenstraße 19',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'cal-15',
    title: 'Notartermin KD Management UG',
    description: 'Gründung KD Management UG beim Notar abschließen.',
    category: 'holding',
    owner: 'kevin',
    startDate: dateAt(7, 10, 0),
    endDate: dateAt(7, 11, 0),
    allDay: false,
    createdAt: now,
    updatedAt: now,
  },
];
