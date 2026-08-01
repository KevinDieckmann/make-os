export type ID = string;
export type Owner = 'malin' | 'kevin' | 'both';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Tag {
  id: ID;
  label: string;
  color: string;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}
