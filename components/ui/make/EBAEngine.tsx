'use client';

import { useMakeOS } from '@/context/MakeOSContext';
import { EBA_CONSTANTS, type InteractionCategory } from '@/types/make-os';

const QUICK_ACTIONS: { label: string; category: InteractionCategory; color: string }[] = [
  { label: '+WERTSCHÄTZUNG',  category: 'POSITIVE_APPRECIATION',   color: '#00ff66' },
  { label: '+ANKUNFT',        category: 'POSITIVE_REUNION',         color: '#00ff66' },
  { label: '+ABSCHIED',       category: 'POSITIVE_PARTING',         color: '#00ff66' },
  { label: '−ABWEISUNG',      category: 'NEGATIVE_TURNING_AWAY',    color: '#ff4444' },
  { label: '−KRITIK',         category: 'NEGATIVE_VERBAL_CRITICISM', color: '#ff8800' },
];

function scoreColor(score: number): string {
  if (score >= EBA_CONSTANTS.THRESHOLD_HEALTHY) return '#00ff66';
  if (score >= EBA_CONSTANTS.THRESHOLD_WARNING)  return '#ff8800';
  return '#ff4444';
}

function scoreLabel(score: number): string {
  if (score >= EBA_CONSTANTS.THRESHOLD_HEALTHY) return 'STABIL';
  if (score >= EBA_CONSTANTS.THRESHOLD_WARNING)  return 'RÜCKGANG';
  return 'KRITISCH';
}

export function EBAEngine() {
  const { eba, addEbaInteraction } = useMakeOS();

  const color  = scoreColor(eba.currentScore);
  const label  = scoreLabel(eba.currentScore);
  const recent = eba.interactionHistory.slice(0, 5);

  const decayedScore = eba.currentScore * (1 - EBA_CONSTANTS.LAMBDA);

  return (
    <div className="os-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', letterSpacing: '0.12em', marginBottom: 4 }}>
            EBA ENGINE // GOTTMAN_DYNAMIC_SYSTEM
          </div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 22, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {Math.round(eba.currentScore)}
            <span style={{ fontSize: 11, color: '#888', marginLeft: 3 }}>/100</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--mono-font)',
            fontSize: 11,
            color,
            border: `1px solid ${color}44`,
            padding: '2px 8px',
            letterSpacing: '0.1em',
            marginBottom: 6,
          }}>
            {label}
          </div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#777', letterSpacing: '0.08em' }}>
            STREAK {eba.streakDays}T
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${eba.currentScore}%`, background: color }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ff4444', letterSpacing: '0.08em' }}>KRITISCH 20</span>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ff8800', letterSpacing: '0.08em' }}>WARNUNG 40</span>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#00ff66', letterSpacing: '0.08em' }}>STABIL 60</span>
        </div>
      </div>

      {/* Formula */}
      <div style={{ background: '#050505', border: '1px solid #1e1e1e', padding: '8px 10px' }}>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.1em', marginBottom: 6 }}>
          // SYSTEMFORMEL
        </div>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#888', letterSpacing: '0.04em', lineHeight: 1.8 }}>
          E_t = max(0, min(100,<br />
          {'  '}E_{'{'}{`t-1`}{'}'} × (1 − λ) + ΔE_t))<br />
          <br />
          λ = {EBA_CONSTANTS.LAMBDA} &nbsp;│&nbsp;
          E_{'{'}{`t-1`}{'}'} = {Math.round(eba.currentScore)}<br />
          ΔE_heute = <span style={{ color: eba.netTransferToday >= 0 ? '#00ff66' : '#ff4444' }}>
            {eba.netTransferToday >= 0 ? '+' : ''}{eba.netTransferToday.toFixed(1)}
          </span><br />
          E_morgen ≈ <span style={{ color: scoreColor(decayedScore) }}>{Math.round(decayedScore)}</span> (ohne Input)
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.12em', marginBottom: 6 }}>
          // INTERAKTION ERFASSEN
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.category}
              onClick={() => addEbaInteraction(a.category, 'Kevin')}
              className="interactive-element"
              style={{
                padding: '6px 8px',
                background: 'transparent',
                border: `1px solid #1e1e1e`,
                color: a.color,
                fontFamily: 'var(--mono-font)',
                fontSize: 11,
                letterSpacing: '0.08em',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ color: '#666', fontSize: 11 }}>
                ×{EBA_CONSTANTS.MULTIPLIERS[a.category]}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent history */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', letterSpacing: '0.12em', marginBottom: 6 }}>
            // LETZTE INTERAKTIONEN
          </div>
          {recent.map(item => {
            const isPositive = item.netValue >= 0;
            return (
              <div key={item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
                borderBottom: '1px solid #111',
              }}>
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#888', letterSpacing: '0.04em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.description ?? item.category}
                </span>
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: isPositive ? '#00ff66' : '#ff4444', marginLeft: 6, flexShrink: 0 }}>
                  {isPositive ? '+' : ''}{item.netValue.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
