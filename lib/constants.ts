import type { Owner } from '@/types/common';
import type { EventCategory } from '@/types/calendar';
import type { ProjectCategory } from '@/types/tasks';
import type { Priority } from '@/types/common';

export const OWNER_CONFIG: Record<Owner, { label: string; initials: string; color: string; bg: string }> = {
  malin: { label: 'Malin', initials: 'M', color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
  kevin: { label: 'Kevin', initials: 'K', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  both: { label: 'Both', initials: 'MK', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
};

export const EVENT_CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; bg: string }> = {
  'private-malin': { label: 'Private Malin', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
  'private-kevin': { label: 'Private Kevin', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  joint: { label: 'Joint', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  holding: { label: 'Business', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'task-deadline': { label: 'Task Deadline', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

export const PROJECT_CATEGORY_CONFIG: Record<ProjectCategory, { label: string; color: string }> = {
  'personal-malin': { label: 'Personal · Malin', color: '#f472b6' },
  'personal-kevin': { label: 'Personal · Kevin', color: '#60a5fa' },
  joint: { label: 'Joint', color: '#a78bfa' },
  business: { label: 'Business', color: '#f59e0b' },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#6b7280' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#f97316' },
  critical: { label: 'Critical', color: '#ef4444' },
};

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/tasks', label: 'Projects', icon: 'FolderKanban' },
  { href: '/calendar', label: 'Calendar', icon: 'CalendarDays' },
  { href: '/wellness', label: 'Fundament', icon: 'Activity' },
  { href: '/dog', label: 'Dog', icon: 'PawPrint' },
  { href: '/groceries', label: 'Groceries', icon: 'ShoppingCart' },
  { href: '/routines', label: 'Routines', icon: 'CheckSquare' },
] as const;
