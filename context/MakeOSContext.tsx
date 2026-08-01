'use client';

import { createContext, useContext, useState, useCallback, useEffect, useReducer, type ReactNode } from 'react';
import {
  type EbaState,
  type EbaInteraction,
  type InteractionCategory,
  EBA_CONSTANTS,
  computeEbaStep,
} from '@/types/make-os';

// ─── EBA REDUCER ──────────────────────────────────────────────────────────

function createInteraction(
  category: InteractionCategory,
  initiatedBy: 'Malin' | 'Kevin' | 'Both',
  description?: string,
): EbaInteraction {
  const multiplier = EBA_CONSTANTS.MULTIPLIERS[category];
  const baseWeight = EBA_CONSTANTS.BASE_WEIGHTS[category];
  const isPositive = !category.startsWith('NEGATIVE');
  const netValue = isPositive ? baseWeight * multiplier : -(baseWeight * multiplier);
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category,
    baseWeight,
    multiplier,
    netValue,
    description,
    initiatedBy,
  };
}

type EbaAction =
  | { type: 'ADD_INTERACTION'; category: InteractionCategory; by: 'Malin' | 'Kevin' | 'Both'; description?: string }
  | { type: 'APPLY_DECAY' }
  | { type: 'RESET' };

const EBA_INITIAL: EbaState = {
  currentScore: 74,
  dailyDrift: EBA_CONSTANTS.LAMBDA,
  netTransferToday: 12,
  interactionHistory: [
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      category: 'POSITIVE_PARTING',
      baseWeight: 4,
      multiplier: 0.8,
      netValue: 3.2,
      description: 'Intentionaler Abschied 07:30',
      initiatedBy: 'Both',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      category: 'POSITIVE_APPRECIATION',
      baseWeight: 8,
      multiplier: 1.0,
      netValue: 8,
      description: 'Spezifische Wertschätzung',
      initiatedBy: 'Kevin',
    },
  ],
  lastCalculatedAt: new Date().toISOString(),
  streakDays: 4,
};

function ebaReducer(state: EbaState, action: EbaAction): EbaState {
  switch (action.type) {
    case 'ADD_INTERACTION': {
      const interaction = createInteraction(action.category, action.by, action.description);
      const newScore = computeEbaStep(state.currentScore, interaction.netValue);
      return {
        ...state,
        currentScore: newScore,
        netTransferToday: state.netTransferToday + interaction.netValue,
        interactionHistory: [interaction, ...state.interactionHistory].slice(0, 50),
        lastCalculatedAt: new Date().toISOString(),
      };
    }
    case 'APPLY_DECAY':
      return {
        ...state,
        currentScore: Math.max(0, Math.min(100, state.currentScore * (1 - state.dailyDrift))),
        netTransferToday: 0,
        lastCalculatedAt: new Date().toISOString(),
      };
    case 'RESET':
      return EBA_INITIAL;
    default:
      return state;
  }
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────

interface MakeOSContextValue {
  // Command Palette
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;

  // Privacy / Holding blur
  holdingBlur: boolean;
  toggleHoldingBlur: () => void;

  // Reunion decompression overlay
  reunionActive: boolean;
  activateReunion: () => void;
  deactivateReunion: () => void;

  // EBA Engine
  eba: EbaState;
  addEbaInteraction: (category: InteractionCategory, by: 'Malin' | 'Kevin' | 'Both', desc?: string) => void;

  // Active habit modal
  activeHabit: 'parting' | 'appreciation' | 'reset' | null;
  openHabit: (h: 'parting' | 'appreciation' | 'reset') => void;
  closeHabit: () => void;

  // Phase override for testing
  phaseOverride: 1 | 2 | 3 | null;
  setPhaseOverride: (p: 1 | 2 | 3 | null) => void;
}

const MakeOSContext = createContext<MakeOSContextValue | null>(null);

export function MakeOSProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen]     = useState(false);
  const [holdingBlur, setHoldingBlur]     = useState(false);
  const [reunionActive, setReunionActive] = useState(false);
  const [activeHabit, setActiveHabit]     = useState<'parting' | 'appreciation' | 'reset' | null>(null);
  const [phaseOverride, setPhaseOverride] = useState<1 | 2 | 3 | null>(null);
  const [eba, dispatch]                   = useReducer(ebaReducer, EBA_INITIAL);

  const openPalette  = useCallback(() => setPaletteOpen(true),  []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const toggleHoldingBlur = useCallback(() => setHoldingBlur(v => !v), []);

  const activateReunion   = useCallback(() => setReunionActive(true),  []);
  const deactivateReunion = useCallback(() => setReunionActive(false), []);

  const openHabit  = useCallback((h: 'parting' | 'appreciation' | 'reset') => setActiveHabit(h), []);
  const closeHabit = useCallback(() => setActiveHabit(null), []);

  const addEbaInteraction = useCallback(
    (category: InteractionCategory, by: 'Malin' | 'Kevin' | 'Both', desc?: string) =>
      dispatch({ type: 'ADD_INTERACTION', category, by, description: desc }),
    [],
  );

  // Cmd+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setActiveHabit(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <MakeOSContext.Provider value={{
      paletteOpen, openPalette, closePalette,
      holdingBlur, toggleHoldingBlur,
      reunionActive, activateReunion, deactivateReunion,
      eba, addEbaInteraction,
      activeHabit, openHabit, closeHabit,
      phaseOverride, setPhaseOverride,
    }}>
      {children}
    </MakeOSContext.Provider>
  );
}

export function useMakeOS(): MakeOSContextValue {
  const ctx = useContext(MakeOSContext);
  if (!ctx) throw new Error('useMakeOS must be inside MakeOSProvider');
  return ctx;
}
