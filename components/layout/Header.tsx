'use client';

import { usePathname } from 'next/navigation';
import { useMakeOS } from '@/context/MakeOSContext';
import { getCurrentPhase, type CircadianPhase } from '@/types/make-os';
import { useState, useEffect } from 'react';

const PHASE_LABELS: Record<CircadianPhase, string> = {
  PHASE_1_FOCUS:      'PHASE_1 // FOKUS',
  PHASE_2_CONNECTION: 'PHASE_2 // VERBINDUNG',
  PHASE_3_RESET:      'PHASE_3 // RESET',
};

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'SYS.DASHBOARD',
  tasks:     'SYS.PROJEKTE',
  calendar:  'SYS.KALENDER',
  wellness:  'SYS.WELLNESS',
  dog:       'SYS.LUNA',
  groceries: 'SYS.EINKAUF',
  routines:  'SYS.ROUTINEN',
};

export function Header() {
  const pathname = usePathname();
  const { holdingBlur, toggleHoldingBlur, phaseOverride } = useMakeOS();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const phase: CircadianPhase = phaseOverride
    ? (['PHASE_1_FOCUS', 'PHASE_2_CONNECTION', 'PHASE_3_RESET'][phaseOverride - 1] as CircadianPhase)
    : getCurrentPhase();

  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  const pageLabel = PAGE_LABELS[segment] ?? segment.toUpperCase();

  const hh = now ? String(now.getHours()).padStart(2, '0') : '--';
  const mm = now ? String(now.getMinutes()).padStart(2, '0') : '--';
  const ss = now ? String(now.getSeconds()).padStart(2, '0') : '--';

  const phaseColor: Record<CircadianPhase, string> = {
    PHASE_1_FOCUS:      '#00ff66',
    PHASE_2_CONNECTION: '#00aaff',
    PHASE_3_RESET:      '#888888',
  };

  return (
    <header style={{
      height: 52,
      borderBottom: '1px solid #1e1e1e',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 16,
      background: '#000000',
      flexShrink: 0,
      fontFamily: 'var(--mono-font)',
    }}>
      {/* Page */}
      <span style={{ fontSize: 11, color: '#aaaaaa', letterSpacing: '0.1em' }}>{pageLabel}</span>

      <span style={{ color: '#333' }}>|</span>

      {/* Phase indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 5, height: 5, background: phaseColor[phase] }} />
        <span style={{ fontSize: 10, color: phaseColor[phase], letterSpacing: '0.1em' }}>
          {PHASE_LABELS[phase]}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Clock */}
      <span style={{ fontSize: 11, color: '#888', letterSpacing: '0.12em' }}>
        {hh}:{mm}:{ss}
      </span>

      <span style={{ color: '#333' }}>|</span>

      {/* Holding Privacy Toggle */}
      <button
        onClick={toggleHoldingBlur}
        className="interactive-element"
        style={{
          padding: '4px 10px',
          background: holdingBlur ? 'rgba(255,136,0,0.08)' : 'transparent',
          border: `1px solid ${holdingBlur ? '#ff8800' : '#2a2a2a'}`,
          color: holdingBlur ? '#ff8800' : '#777',
          fontSize: 10,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          fontFamily: 'var(--mono-font)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ fontSize: 8 }}>{holdingBlur ? '●' : '○'}</span>
        HOLDING {holdingBlur ? 'VERBORGEN' : 'SICHTBAR'}
      </button>
    </header>
  );
}
