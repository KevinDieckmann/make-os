'use client';

import { EnergyRhythm } from './EnergyRhythm';
import { WhoopVitals } from './WhoopVitals';
import { RoutineTracker } from './RoutineTracker';
import { TodayAgenda } from './TodayAgenda';
import { HABITS } from '@/lib/make-one/fundament-data';

function ScoreChip({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', borderTop: `2px solid ${accent}`, padding: '10px 14px', flex: 1 }}>
      <div style={{ fontFamily: 'var(--mono-font)', fontSize: 8, color: '#777', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono-font)', fontSize: 20, color: accent, fontWeight: 600, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--mono-font)', fontSize: 8.5, color: '#666', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

export function FundamentCockpit() {
  // Fundament-Score = erfüllte Routine-Slots dieser Woche / Zielsumme
  const totalTarget = HABITS.reduce((s, h) => s + h.targetPerWeek, 0);
  const totalDone = HABITS.reduce((s, h) => s + h.week.filter(d => d === true).length, 0);
  const pct = Math.round((totalDone / totalTarget) * 100);
  const onTargetHabits = HABITS.filter(h => h.week.filter(d => d === true).length >= h.targetPerWeek).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#00ff66', letterSpacing: '0.16em', marginBottom: 4 }}>
          MAKE.ONE // FUNDAMENT
        </div>
        <div style={{ fontSize: 20, color: '#fff', fontWeight: 600, letterSpacing: '-0.01em' }}>
          Gesundheit &amp; Energie — dein Fundament
        </div>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 10, color: '#666', marginTop: 4, letterSpacing: '0.02em' }}>
          „Erst Fundament, dann Firma steuern." — Whoop-Daten bleiben hier, nie in Business-Briefings.
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 10 }}>
        <ScoreChip label="FUNDAMENT-SCORE" value={`${pct}%`} sub={`${totalDone}/${totalTarget} Routine-Slots · KW 31`} accent={pct >= 70 ? '#00ff66' : pct >= 40 ? '#ffaa00' : '#ff4444'} />
        <ScoreChip label="ROUTINEN AUF ZIEL" value={`${onTargetHabits}/${HABITS.length}`} sub="Kraft · Journal · Morgen · Abend" accent="#00aaff" />
        <ScoreChip label="KRAFT-TRAINING" value={`${HABITS[0].week.filter(d => d === true).length}/3`} sub="Ziel 3×/Woche (Gesundheit_Brain)" accent="#00ff66" />
        <ScoreChip label="WHOOP" value="––" sub="API-Anbindung ausstehend" accent="#ff8800" />
      </div>

      {/* Energy rhythm — full width */}
      <EnergyRhythm />

      {/* Whoop vitals — full width */}
      <WhoopVitals />

      {/* Routines + Agenda */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 10, alignItems: 'start' }}>
        <RoutineTracker />
        <TodayAgenda />
      </div>
    </div>
  );
}
