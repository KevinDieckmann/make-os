'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Owner } from '@/types/common';

interface AppContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  activeOwnerFilter: Owner | 'all';
  setActiveOwnerFilter: (v: Owner | 'all') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeOwnerFilter, setActiveOwnerFilter] = useState<Owner | 'all'>('all');

  return (
    <AppContext.Provider value={{ sidebarCollapsed, setSidebarCollapsed, activeOwnerFilter, setActiveOwnerFilter }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContextProvider');
  return ctx;
}
