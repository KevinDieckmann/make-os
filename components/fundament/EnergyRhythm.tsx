'use client';

import { useState, useEffect } from 'react';
import { ENERGY_WINDOWS, type EnergyWindow } from '@/lib/make-one/fundament-data';

const KIND_COLOR: Record<EnergyWindow['kind'], string> = {
  available: '#00aaff',
  focus:     '#00ff66',
  reset:     '#555555',
};

const DAY_START = 6;
const DAY_END = 23;
const SPAN = DAY_END - DAY_START;

export function EnergyRhythm() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hourNow = now ? now.getHours() + now.getMinutes() / 60 : DAY_START;
  const clamped = Math.min(DAY_END, Math.max(DAY_START, hourNow));
  const nowPct = ((clamped - DAY_START) / SPAN) * 100;

  const current = ENERGY_WINDOWS.find(w => hourNow >= w.from && hourNow < w.to);

  return (
    <div className="os-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 9, color: '#777', letterSpacing: '0.14em' }}>
          ENERGIE_RHYTHMUS // TAGESFENSTER
        </div>
        {current && (
          <div style={{ fontFamily: 'var(--mono-font)', fontSize: 10, color: KIND_COLOR[current.kind], letterSpacing: '0.08em' }}>
            JETZT: {current.label.toUpperCase()}
          </div>
        )}
      </div>

      {/* Bar */}
      <div style={{ position: 'relative', height: 44, display: 'flex', border: '1px solid #1e1e1e' }}>
        {ENERGY_WINDOWS.map((w, i) => {
          const widthPct = ((w.to - w.from) / SPAN) * 100;
          const color = KIND_COLOR[w.kind];
          const isFocus = w.kind === 'focus';
          return (
            <div
              key={i}
              title={`${w.label} · ${w.from}:00–${w.to}:00 — ${w.note}`}
              style={{
                width: `${widthPct}%`,
                borderRight: i < ENERGY_WINDOWS.length - 1 ? '1px solid #1e1e1e' : 'none',
                background: isFocus ? 'rgba(0,255,102,0.10)' : 'transparent',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: isFocus ? 1 : 0.5 }} />
              <span style={{
                fontFamily: 'var(--mono-font)', fontSize: 8.5, letterSpacing: '0.06em',
                color: isFocus ? '#00ff66' : '#888', textAlign: 'center', padding: '0 4px', lineHeight: 1.2,
              }}>
                {isFocus ? '🔒 FOKUS' : w.label}
              </span>
            </div>
          );
        })}

        {/* Now marker */}
        {now && (
          <div style={{ position: 'absolute', top: -4, bottom: -4, left: `${nowPct}%`, width: 2, background: '#ff4444', boxShadow: '0 0 6px rgba(255,68,68,0.8)' }}>
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--mono-font)', fontSize: 8, color: '#ff4444', whiteSpace: 'nowrap' }}>
              {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
            </div>
          </div>
        )}
      </div>

      {/* Hour ticks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--mono-font)', fontSize: 8, color: '#555' }}>
        {[6, 9, 12, 15, 17, 19, 23].map(h => <span key={h}>{h}:00</span>)}
      </div>

      {current && (
        <div style={{ marginTop: 12, fontFamily: 'var(--mono-font)', fontSize: 10, color: '#999', letterSpacing: '0.03em', lineHeight: 1.5 }}>
          {current.note}
        </div>
      )}
    </div>
  );
}
