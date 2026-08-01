import type { RoutinesState } from '@/types/routines';

const now = new Date().toISOString();

export const MOCK_ROUTINES: RoutinesState = {
  routines: [
    {
      id: 'r-1',
      owner: 'both',
      name: 'Morning Routine',
      time: 'morning',
      active: true,
      items: [
        { id: 'ci-1', routineId: 'r-1', title: 'Wasser trinken (500ml)', sortOrder: 0, durationMinutes: 1, createdAt: now, updatedAt: now },
        { id: 'ci-2', routineId: 'r-1', title: 'Kurzes Journal (5 min)', sortOrder: 1, durationMinutes: 5, createdAt: now, updatedAt: now },
        { id: 'ci-3', routineId: 'r-1', title: 'Sport / Bewegung', sortOrder: 2, durationMinutes: 30, createdAt: now, updatedAt: now },
        { id: 'ci-4', routineId: 'r-1', title: 'Frühstück', sortOrder: 3, durationMinutes: 15, createdAt: now, updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'r-2',
      owner: 'both',
      name: 'Evening Routine',
      time: 'evening',
      active: true,
      items: [
        { id: 'ci-5', routineId: 'r-2', title: 'Tages-Review (5 min)', sortOrder: 0, durationMinutes: 5, createdAt: now, updatedAt: now },
        { id: 'ci-6', routineId: 'r-2', title: 'Morgen vorbereiten', sortOrder: 1, durationMinutes: 10, createdAt: now, updatedAt: now },
        { id: 'ci-7', routineId: 'r-2', title: 'Lesen (30 min)', sortOrder: 2, durationMinutes: 30, createdAt: now, updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ],
  entries: [],
  habits: [
    { id: 'h-1', owner: 'malin', name: 'Laufen', targetDaysPerWeek: 4, color: '#f472b6', entries: [], active: true, createdAt: now, updatedAt: now },
    { id: 'h-2', owner: 'kevin', name: 'Kraft-Training', targetDaysPerWeek: 3, color: '#60a5fa', entries: [], active: true, createdAt: now, updatedAt: now },
    { id: 'h-3', owner: 'both', name: 'Journaling', targetDaysPerWeek: 7, color: '#a78bfa', entries: [], active: true, createdAt: now, updatedAt: now },
  ],
};
