import type { ID, Owner, Timestamps } from './common';

export type Aisle =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'frozen'
  | 'bakery'
  | 'pantry'
  | 'beverages'
  | 'household'
  | 'personal-care'
  | 'other';

export interface GroceryItem extends Timestamps {
  id: ID;
  name: string;
  aisle: Aisle;
  quantity?: string;
  checked: boolean;
  addedBy: Owner;
  notes?: string;
  recurring: boolean;
}

export interface ShoppingList extends Timestamps {
  id: ID;
  name: string;
  store?: string;
  items: GroceryItem[];
  completedAt?: string;
}

export interface GroceriesState {
  activeList: ShoppingList | null;
  history: ShoppingList[];
}
