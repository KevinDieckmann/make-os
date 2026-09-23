'use client';

import { useState, useEffect } from 'react';
import { useMakeOS } from '@/context/MakeOSContext';
import { getCurrentPhase, type CircadianPhase } from '@/types/make-os';

const DISPATCHES: Record<CircadianPhase, { title: string; directive: string; sub: string; warning?: string }> = {
  PHASE_1_FOCUS: {
    title:     '[ PHASE_1 — EXECUTIVE_FOKUS ]',
    directive: 'Cortisol-Peak aktiv. Deep-Work-Fenster offen. Keine synchronen Unterbrechungen.',
    sub:       'Jetzt: Single-Task-Execution. Meeting-Blöcke erst ab 10:00 Uhr.',
    warning:   '⚠ SOZIALE MEDIA GESPERRT — DOPAMIN-SCHUTZFENSTER AKTIV',
  },
  PHASE_2_CONNECTION: {
    title:     '[ PHASE_2 — ANALOG_RECONNECT ]',
    directive: 'Serotonin-Plateau. Kommunikations- und Kooperationsfenster aktiv.',
    sub:       'Jetzt: Gemeinsame Planung, Kreativ-Sessions, Partnergespräche priorisieren.',
    warning:   '⚠ ACHTUNG — BILDSCHIRMZEIT REDUZIEREN. ANALOG-KONTAKT PRIORISIEREN.',
  },
  PHASE_3_RESET: {
    title:     '[ PHASE_3 — MELATONIN_ONSET ]',
    directive: 'Melatonin-Anstieg. Dekompressions-Protokoll einleiten.',
    sub:       'Jetzt: Abschalten. Kein blaulichtstarkes Display nach 21:00 Uhr.',
  },
};

const PHASE_COLOR: Record<CircadianPhase, string> = {
  PHASE_1_FOCUS:      '#00ff66',
  PHASE_2_CONNECTION: '#00aaff',
  PHASE_3_RESET:      '#888888',
};

export function SystemDispatch() {
  const { phaseOverride } = useMakeOS();
  const [phase, setPhase] = useState<CircadianPhase>('PHASE_1_FOCUS');
  const [now, setNow]     = useState(new Date());
  const [tick, setTick]   = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setTick(v => v + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (phaseOverride) {
      const phases: CircadianPhase[] = ['PHASE_1_FOCUS', 'PHASE_2_CONNECTION', 'PHASE_3_RESET'];
      setPhase(phases[phaseOverride - 1]);
    } else {
      setPhase(getCurrentPhase());
    }
  }, [phaseOverride, tick]);

  const dispatch = DISPATCHES[phase];
  const accent   = PHASE_COLOR[phase];

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="os-card accent-bar" style={{ padding: 16, position: 'relative' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{
            fontFamily: 'var(--mono-font)',
            fontSize: 11,
            color: '#777',
            letterSpacing: '0.14em',
            marginBottom: 6,
          }}>
            SYSTEM_DISPATCH // {dateStr.toUpperCase()} // {hh}:{mm}
          </div>
          <div style={{
            fontFamily: 'var(--mono-font)',
            fontSize: 13,
            color: accent,
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}>
            {dispatch.title}
          </div>
        </div>

        {/* Phase badge */}
        <div style={{
          border: `1px solid ${accent}`,
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{ width: 4, height: 4, background: accent }} />
          <span style={{
            fontFamily: 'var(--mono-font)',
            fontSize: 11,
            color: accent,
            letterSpacing: '0.12em',
          }}>
            {phase.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Main directive */}
      <div style={{
        background: '#050505',
        border: '1px solid #1a1a1a',
        padding: '12px 14px',
        marginBottom: 10,
      }}>
        <div style={{
          fontFamily: 'var(--mono-font)',
          fontSize: 11,
          color: '#777',
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}>
          DIREKTIVE:
        </div>
        <p style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
          fontSize: 14,
          color: '#ffffff',
          lineHeight: 1.6,
          margin: 0,
        }}>
          {dispatch.directive}
        </p>
        <p style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
          fontSize: 12,
          color: '#888888',
          lineHeight: 1.5,
          margin: '8px 0 0',
        }}>
          {dispatch.sub}
        </p>
      </div>

      {/* Warning */}
      {dispatch.warning && (
        <div style={{
          border: `1px solid ${phase === 'PHASE_1_FOCUS' ? '#00ff6633' : '#00aaff33'}`,
          padding: '8px 12px',
          background: phase === 'PHASE_1_FOCUS' ? 'rgba(0,255,102,0.04)' : 'rgba(0,170,255,0.04)',
        }}>
          <span style={{
            fontFamily: 'var(--mono-font)',
            fontSize: 11,
            color: phase === 'PHASE_1_FOCUS' ? '#00ff66' : '#00aaff',
            letterSpacing: '0.08em',
          }}>
            {dispatch.warning}
          </span>
        </div>
      )}

      {/* Quick stats row */}
      <div style={{ display: 'flex', gap: 1, marginTop: 10 }}>
        {[
          { label: 'FOKUS-TASKS', value: '5' },
          { label: 'BLOCKIERT',   value: '1', color: '#ff8800' },
          { label: 'EVENTS HEUTE', value: '4' },
          { label: 'EBA-SCORE',   value: '74%' },
        ].map(stat => (
          <div key={stat.label} style={{
            flex: 1,
            background: '#050505',
            border: '1px solid #1a1a1a',
            padding: '8px 10px',
          }}>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#777', letterSpacing: '0.1em', marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: 'var(--mono-font)', fontSize: 16, color: stat.color ?? '#ffffff', letterSpacing: '-0.02em' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
