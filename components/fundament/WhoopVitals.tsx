'use client';

import { WHOOP_METRICS, WHOOP_SNAPSHOT } from '@/lib/make-one/fundament-data';

export function WhoopVitals() {
  const { connected, values, lastSync } = WHOOP_SNAPSHOT;

  return (
    <div className="os-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#777', letterSpacing: '0.14em' }}>
          WHOOP // KÖRPER & ENERGIE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: connected ? '#00ff66' : '#ff8800' }} />
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: connected ? '#00ff66' : '#ff8800', letterSpacing: '0.08em' }}>
            {connected ? `LIVE · ${lastSync ?? ''}` : 'NICHT VERBUNDEN'}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {WHOOP_METRICS.map(m => {
          const v = values[m.key];
          const hasVal = connected && v != null;
          return (
            <div key={m.key} style={{ background: '#0a0a0a', border: '1px solid #161616', borderLeft: `2px solid ${m.accent}`, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: m.accent, letterSpacing: '0.08em', marginBottom: 8 }}>
                {m.label.toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 24, color: hasVal ? '#fff' : '#333', fontWeight: 600 }}>
                  {hasVal ? v : '––'}
                </span>
                <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555' }}>{m.unit}</span>
              </div>
              <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#666', letterSpacing: '0.02em', lineHeight: 1.3 }}>
                Ziel: {m.target}
              </div>
            </div>
          );
        })}
      </div>

      {!connected && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,136,0,0.06)', border: '1px solid rgba(255,136,0,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ffb060', letterSpacing: '0.02em', lineHeight: 1.4 }}>
            Whoop-App unter developer.whoop.com anlegen → Client ID/Secret in .env → einmal einloggen, dann fließen Recovery, Schlaf, HRV & Strain automatisch.
          </span>
          <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ff8800', border: '1px solid rgba(255,136,0,0.4)', padding: '5px 10px', whiteSpace: 'nowrap' }}>
            WHOOP VERBINDEN
          </span>
        </div>
      )}
    </div>
  );
}
