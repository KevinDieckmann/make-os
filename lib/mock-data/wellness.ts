import type { WellnessState } from '@/types/wellness';

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

export const MOCK_WELLNESS: WellnessState = {
  sportLogs: [
    { id: 'sl-1', owner: 'malin', type: 'running', date: today, durationMinutes: 45, distanceKm: 8.2, createdAt: now, updatedAt: now },
    { id: 'sl-2', owner: 'kevin', type: 'strength', date: today, durationMinutes: 60, createdAt: now, updatedAt: now },
  ],
  journalEntries: [
    { id: 'je-1', owner: 'malin', date: today, mood: 4, content: 'Produktiver Tag, Training gut gelaufen.', gratitude: ['Gesundheit', 'Kevin', 'Sonnenschein'], createdAt: now, updatedAt: now },
    { id: 'je-2', owner: 'kevin', date: today, mood: 3, content: 'Viel zu tun, aber Fokus gehalten.', createdAt: now, updatedAt: now },
  ],
  dateNights: [
    { id: 'dn-1', date: '2026-06-28', title: 'Restaurantbesuch Mitte', location: 'Restaurant Mitte', completed: false, createdAt: now, updatedAt: now },
    { id: 'dn-2', date: '2026-07-05', title: 'Heimkino-Abend', completed: false, createdAt: now, updatedAt: now },
  ],
  bucketList: [
    { id: 'bl-1', owner: 'both', title: 'Japan Reise', category: 'Travel', completed: false, createdAt: now, updatedAt: now },
    { id: 'bl-2', owner: 'both', title: 'Kochkurs Pasta', category: 'Food', completed: false, createdAt: now, updatedAt: now },
    { id: 'bl-3', owner: 'malin', title: 'Halbmarathon finishen', category: 'Sport', completed: true, completedDate: '2025-04-13', createdAt: now, updatedAt: now },
  ],
};
