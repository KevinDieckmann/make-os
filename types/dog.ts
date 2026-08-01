import type { ID, Owner, Timestamps } from './common';

export interface Walk extends Timestamps {
  id: ID;
  walkedBy: Owner;
  date: string;
  durationMinutes: number;
  distanceKm?: number;
  notes?: string;
}

export interface FeedingLog extends Timestamps {
  id: ID;
  date: string;
  mealTime: 'morning' | 'evening';
  fedBy: Owner;
  gramsServed: number;
  notes?: string;
}

export interface VetAppointment extends Timestamps {
  id: ID;
  date: string;
  reason: string;
  vet?: string;
  notes?: string;
  completed: boolean;
  nextAppointmentDate?: string;
}

export interface FoodStock extends Timestamps {
  id: ID;
  productName: string;
  quantityGrams: number;
  lowThresholdGrams: number;
  purchaseDate: string;
  notes?: string;
}

export interface DogState {
  walks: Walk[];
  feedingLogs: FeedingLog[];
  vetAppointments: VetAppointment[];
  foodStock: FoodStock[];
  dogName: string;
  dogBreed?: string;
  dogBirthDate?: string;
}
