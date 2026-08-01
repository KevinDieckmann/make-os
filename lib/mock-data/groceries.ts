import type { GroceriesState } from '@/types/groceries';

const now = new Date().toISOString();

export const MOCK_GROCERIES: GroceriesState = {
  activeList: {
    id: 'list-1',
    name: 'Wocheneinkauf KW 26',
    store: 'REWE',
    items: [
      { id: 'gi-1', name: 'Avocados', aisle: 'produce', quantity: '3 Stück', checked: false, addedBy: 'malin', recurring: false, createdAt: now, updatedAt: now },
      { id: 'gi-2', name: 'Spinat', aisle: 'produce', quantity: '200g', checked: true, addedBy: 'malin', recurring: true, createdAt: now, updatedAt: now },
      { id: 'gi-3', name: 'Griechischer Joghurt', aisle: 'dairy', quantity: '500g', checked: false, addedBy: 'both', recurring: true, createdAt: now, updatedAt: now },
      { id: 'gi-4', name: 'Hühnerbrust', aisle: 'meat', quantity: '600g', checked: false, addedBy: 'kevin', recurring: false, createdAt: now, updatedAt: now },
      { id: 'gi-5', name: 'Hafer-Milch', aisle: 'beverages', quantity: '2x 1L', checked: false, addedBy: 'malin', recurring: true, createdAt: now, updatedAt: now },
      { id: 'gi-6', name: 'Vollkornbrot', aisle: 'bakery', quantity: '1 Brot', checked: false, addedBy: 'both', recurring: true, createdAt: now, updatedAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  },
  history: [],
};
