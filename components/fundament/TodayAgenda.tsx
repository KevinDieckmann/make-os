'use client';

import { localDay } from '@/lib/zeit';
import { useState, useEffect } from 'react';

interface AgendaEvent {
  id: string;
  title: string;
  start: string;   // local ISO
  end: string;
  sourceLabel: string;
  color: string;
  isTeams?: boolean;
}

const CAT_STYLE: Record<string, { label: string; color: string }> = {
  holding:        { label: 'HOLDING',  color: '#f59e0b' },
  'private-kevin':{ label: 'PRIVAT',   color: '#60a5fa' },
  'private-malin':{ label: 'MALIN',    color: '#f472b6' },
  joint:          { label: 'JOINT',    color: '#a78bfa' },
};

function hhmm(iso: string) {
  const d = new Date(iso.length <= 16 ? iso + ':00' : iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dayKey(iso: string) { return iso.slice(0, 10); }
function inFocus(iso: string) { const h = new Date(iso.length <= 16 ? iso + ':00' : iso).getHours(); return h >= 9 && h < 17; }

export function TodayAgenda() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'partial'>('loading');
  const [label, setLabel] = useState('HEUTE');

  useEffect(() => {
    let alive = true;

    // Pick "today" (or next day with events) from a pool and render it.
    const render = (pool: AgendaEvent[]) => {
      if (!alive) return;
      const todayStr = localDay();
      let key = todayStr;
      let todays = pool.filter(e => dayKey(e.start) === key);
      if (todays.length === 0) {
        const future = pool.filter(e => dayKey(e.start) >= todayStr).sort((a, b) => a.start.localeCompare(b.start));
        if (future.length) {
          key = dayKey(future[0].start);
          todays = pool.filter(e => dayKey(e.start) === key);
          const d = new Date(key + 'T12:00:00');
          setLabel(d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase());
        }
      }
      setEvents([...todays].sort((a, b) => a.start.localeCompare(b.start)));
    };

    (async () => {
      const pool: AgendaEvent[] = [];

      // 1) KEMARIS (M365) — sofort rendern
      try {
        const r = await fetch('/api/kemaris-calendar');
        const data = await r.json();
        for (const e of data.events ?? []) {
          pool.push({ id: e.id, title: e.title, start: e.start, end: e.end, sourceLabel: 'KEMARIS', color: '#00d4ff', isTeams: e.isTeams });
        }
      } catch { /* ignore */ }
      render(pool);
      setStatus('partial');

      // 2) Apple (Holding + Privat + Joint) — kurzer Timeout, dann mergen wenn da
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 9000);
        const r = await fetch('/api/apple-calendar', { signal: ctrl.signal });
        clearTimeout(to);
        if (r.ok) {
          const arr = await r.json();
          if (alive && Array.isArray(arr)) {
            for (const e of arr) {
              const s = CAT_STYLE[e.category] ?? { label: 'KALENDER', color: '#888' };
              pool.push({ id: e.id, title: e.title, start: e.startDate, end: e.endDate, sourceLabel: s.label, color: s.color });
            }
            render(pool);
            setStatus('ok');
          }
        }
      } catch { /* Apple offline — KEMARIS bleibt sichtbar */ }
    })();

    return () => { alive = false; };
  }, []);

  return (
    <div className="os-card" style={{ padding: 16, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#777', letterSpacing: '0.14em' }}>
          AGENDA // {label}
        </div>
        <span style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: status === 'ok' ? '#00ff66' : '#ff8800', letterSpacing: '0.06em' }}>
          {status === 'loading' ? 'LÄDT…' : status === 'ok' ? '● KEMARIS + APPLE' : '● KEMARIS (Apple offline)'}
        </span>
      </div>

      {status !== 'loading' && events.length === 0 && (
        <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#555', padding: '20px 0', textAlign: 'center' }}>Kein Termin.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map(e => {
          const focus = inFocus(e.start);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'stretch', gap: 10, background: '#0a0a0a', border: '1px solid #161616', borderLeft: `2px solid ${e.color}`, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: '#ccc', minWidth: 40 }}>
                {hhmm(e.start)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.title}{e.isTeams && <span style={{ color: '#5b5fc7', fontSize: 11 }}> · Teams</span>}
                </div>
                <div style={{ fontFamily: 'var(--mono-font)', fontSize: 11, color: e.color, letterSpacing: '0.08em', marginTop: 2 }}>
                  {e.sourceLabel}{focus && <span style={{ color: '#ff8800' }}> · ⚠ FOKUSZEIT</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
