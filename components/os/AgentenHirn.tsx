'use client';

// ─── MAKE OS — Das pulsierende Hirn ─────────────────────────────────────────
// Kevins Bild: die Agenten als lebendiges Hirn sehen. JARVIS sitzt in der
// Mitte, die Live-Agenten kreisen darum — wer in der letzten Stunde gelaufen
// ist, leuchtet und pulsiert kräftig; wer heute lief, glimmt; der Rest ruht.
// Datenbasis: echtes Agenten-Gedächtnis (agent-log), kein Show-Effekt ohne
// Substanz. Klick auf einen Knoten öffnet den Agenten.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';

interface Lauf { agent: string; title: string; ts: string }

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

export function AgentenHirn() {
  const [laeufe, setLaeufe] = useState<Lauf[]>([]);
  useEffect(() => {
    fetch('/api/state/agent-log?limit=50').then(r => r.json()).then(d => setLaeufe(Array.isArray(d.entries) ? d.entries : [])).catch(() => {});
  }, []);

  const jetzt = Date.now();
  const letzterVon = (id: string) => laeufe.find(l => l.agent === id || l.agent.startsWith(`${id}-`));
  const aktivitaet = (id: string): 'heiss' | 'warm' | 'ruht' => {
    const l = letzterVon(id);
    if (!l) return 'ruht';
    const alterMin = (jetzt - new Date(l.ts).getTime()) / 60000;
    if (alterMin <= 60) return 'heiss';
    if (alterMin <= 24 * 60) return 'warm';
    return 'ruht';
  };

  const n = LIVE_AGENTS.length;
  const cx = 260, cy = 190, R = 140;
  const pos = (i: number) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };

  const heissN = LIVE_AGENTS.filter(a => aktivitaet(a.id) === 'heiss').length;
  const letzter = laeufe[0];

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={lbl}>Das Hirn</span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: heissN ? T.accent : T.muted }}>{n} Agenten live · {heissN} gerade aktiv</span>
        {letzter && (
          <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>
            zuletzt: <span style={{ color: T.inkDim }}>{letzter.agent}</span> · {letzter.title.slice(0, 44)}{letzter.title.length > 44 ? '…' : ''}
          </span>
        )}
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 auto' }}>
        <svg viewBox="0 0 520 380" style={{ width: '100%', display: 'block' }}>
          {/* Synapsen: Zentrum → Agent (aktive leuchten) */}
          {LIVE_AGENTS.map((a, i) => {
            const p = pos(i);
            const akt = aktivitaet(a.id);
            return (
              <line key={a.id} x1={cx} y1={cy} x2={p.x} y2={p.y}
                stroke={akt === 'heiss' ? T.accent : akt === 'warm' ? `${T.accent}55` : 'rgba(150,168,162,.14)'}
                strokeWidth={akt === 'heiss' ? 1.4 : 1} />
            );
          })}
          {/* Zentrum: JARVIS */}
          <circle cx={cx} cy={cy} r="34" fill="rgba(33,181,170,.10)" stroke={T.accent} strokeWidth="1.4" />
          <circle className="jarvis-orb-kern" cx={cx} cy={cy} r="12" fill={T.accent} style={{ transformOrigin: `${cx}px ${cy}px` }} />
          <text x={cx} y={cy + 52} textAnchor="middle" fill={T.accent} fontFamily={T.mono} fontSize="10" letterSpacing="2">JARVIS</text>
        </svg>

        {/* Agenten-Knoten als klickbare Overlays (HTML über dem SVG) */}
        {LIVE_AGENTS.map((a, i) => {
          const p = pos(i);
          const akt = aktivitaet(a.id);
          const farbe = akt === 'heiss' ? T.accent : akt === 'warm' ? T.accentInk : T.muted;
          return (
            <Link key={a.id} href={a.href} title={`${a.name} — ${a.role}`}
              style={{ position: 'absolute', left: `${(p.x / 520) * 100}%`, top: `${(p.y / 380) * 100}%`, transform: 'translate(-50%, -50%)', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span className={akt === 'heiss' ? 'jarvis-orb-kern' : undefined}
                style={{ width: akt === 'heiss' ? 16 : 12, height: akt === 'heiss' ? 16 : 12, borderRadius: '50%', background: farbe, boxShadow: akt !== 'ruht' ? `0 0 ${akt === 'heiss' ? 14 : 8}px ${farbe}` : 'none', display: 'inline-block' }} />
              <span style={{ fontFamily: T.mono, fontSize: 9, color: akt === 'ruht' ? T.muted : T.inkDim, whiteSpace: 'nowrap', background: 'rgba(11,14,16,.72)', borderRadius: 4, padding: '1px 5px' }}>{a.name.replace('-Agent', '')}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, textAlign: 'center' }}>
        <span style={{ color: T.accent }}>●</span> letzte Stunde · <span style={{ color: T.accentInk }}>●</span> heute · <span>●</span> ruht — Klick öffnet den Agenten
      </div>
    </div>
  );
}
