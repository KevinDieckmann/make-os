import type { DogState } from '@/types/dog';

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];

export const MOCK_DOG: DogState = {
  dogName: 'Luna',
  dogBreed: 'Labrador Mix',
  dogBirthDate: '2022-03-15',
  walks: [
    { id: 'w-1', walkedBy: 'malin', date: `${today}T07:30:00Z`, durationMinutes: 30, distanceKm: 2.1, createdAt: now, updatedAt: now },
    { id: 'w-2', walkedBy: 'kevin', date: `${today}T17:00:00Z`, durationMinutes: 45, distanceKm: 3.2, createdAt: now, updatedAt: now },
  ],
  feedingLogs: [
    { id: 'f-1', date: today, mealTime: 'morning', fedBy: 'malin', gramsServed: 180, createdAt: now, updatedAt: now },
  ],
  vetAppointments: [
    { id: 'vet-1', date: '2026-07-15', reason: 'Jährliche Impfung & Check-up', vet: 'Dr. Müller', completed: false, createdAt: now, updatedAt: now },
  ],
  foodStock: [
    { id: 'fs-1', productName: 'Royal Canin Labrador Adult', quantityGrams: 4200, lowThresholdGrams: 1000, purchaseDate: '2026-06-10', createdAt: now, updatedAt: now },
  ],
};
