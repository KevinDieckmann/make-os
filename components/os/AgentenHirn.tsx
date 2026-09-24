'use client';

// ─── MAKE OS — Das pulsierende Hirn ─────────────────────────────────────────
// Kevins Bild: die Agenten als lebendiges Hirn sehen. JARVIS sitzt in der
// Mitte, die Live-Agenten kreisen darum — wer in der letzten Stunde gelaufen
// ist, leuchtet und pulsiert kräftig; wer heute lief, glimmt; der Rest ruht.
// Datenbasis: echtes Agenten-Gedächtnis (agent-log), kein Show-Effekt ohne
// Substanz. Klick auf einen Knoten öffnet den Agenten.
//
// 24.09.: auf das lebendige Bild angeglichen — Agentenlila (LEUCHT.agenten)
// statt Türkis, Labels in der Text-Schrift, kein eigener Kasten mehr (die
// Karte drumherum stellt die AgentenView). Animation und Daten unverändert.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT, Ueberschrift } from './schlank';
import { LIVE_AGENTS } from '@/lib/make-one/agents-data';

interface Lauf { agent: string; title: string; ts: string }

const A = LEUCHT.agenten;
/** Drei Stufen: heiß leuchtet voll, warm glimmt, ruhend bleibt leise. */
const WARM = `${A}99`;
const HAAR = 'rgba(255,255,255,.07)';

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
    // Auf drei Stellen runden: Server und Browser rechnen Sinus und Cosinus
    // an der letzten Nachkommastelle minimal verschieden (86.53875158910776
    // gegen …775), und React meldet das als Hydrations-Abweichung. Für ein
    // Bild in Pixeln ist die Stelle ohnehin bedeutungslos.
    const rund = (z: number) => Math.round(z * 1000) / 1000;
    return { x: rund(cx + R * Math.cos(a)), y: rund(cy + R * Math.sin(a)) };
  };

  const heissN = LIVE_AGENTS.filter(a => aktivitaet(a.id) === 'heiss').length;
  const letzter = laeufe[0];

  return (
    <div style={{ fontFamily: SCHRIFT.text, color: C.ink }}>
      <Ueberschrift farbe={heissN ? A : undefined} rechts={letzter && (
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          zuletzt: <span style={{ color: C.inkDim, fontWeight: 600 }}>{letzter.agent}</span> · {letzter.title.slice(0, 44)}{letzter.title.length > 44 ? '…' : ''}
        </span>
      )}>
        Das Hirn
        <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, color: heissN ? A : C.inkLeise }}>{n} Agenten live · {heissN} gerade aktiv</span>
      </Ueberschrift>

      <div style={{ position: 'relative', width: '100%', maxWidth: 520, margin: '0 auto' }}>
        <svg viewBox="0 0 520 380" style={{ width: '100%', display: 'block' }}>
          {/* Synapsen: Zentrum → Agent (aktive leuchten) */}
          {LIVE_AGENTS.map((a, i) => {
            const p = pos(i);
            const akt = aktivitaet(a.id);
            return (
              <line key={a.id} x1={cx} y1={cy} x2={p.x} y2={p.y}
                stroke={akt === 'heiss' ? A : akt === 'warm' ? `${A}55` : HAAR}
                strokeWidth={akt === 'heiss' ? 1.4 : 1} />
            );
          })}
          {/* Zentrum: JARVIS */}
          <circle cx={cx} cy={cy} r="34" fill={`${A}1A`} stroke={A} strokeWidth="1.4" />
          <circle className="jarvis-orb-kern" cx={cx} cy={cy} r="12" fill={A} style={{ transformOrigin: `${cx}px ${cy}px`, filter: `drop-shadow(0 0 8px ${A})` }} />
          <text x={cx} y={cy + 52} textAnchor="middle" fill={A} fontFamily={SCHRIFT.text} fontSize="11" fontWeight="700" letterSpacing="2">JARVIS</text>
        </svg>

        {/* Agenten-Knoten als klickbare Overlays (HTML über dem SVG) */}
        {LIVE_AGENTS.map((a, i) => {
          const p = pos(i);
          const akt = aktivitaet(a.id);
          const farbe = akt === 'heiss' ? A : akt === 'warm' ? WARM : C.inkLeise;
          return (
            <Link key={a.id} href={a.href} title={`${a.name} — ${a.role}`}
              style={{ position: 'absolute', left: `${(p.x / 520) * 100}%`, top: `${(p.y / 380) * 100}%`, transform: 'translate(-50%, -50%)', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span className={akt === 'heiss' ? 'jarvis-orb-kern' : undefined}
                style={{ width: akt === 'heiss' ? 16 : 12, height: akt === 'heiss' ? 16 : 12, borderRadius: '50%', background: farbe, boxShadow: akt !== 'ruht' ? `0 0 ${akt === 'heiss' ? 14 : 8}px ${farbe}` : 'none', display: 'inline-block' }} />
              <span style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 600, color: akt === 'ruht' ? C.inkLeise : C.inkDim, whiteSpace: 'nowrap', background: 'rgba(11,14,16,.75)', borderRadius: 999, padding: '2px 8px' }}>{a.name.replace('-Agent', '')}</span>
            </Link>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: C.inkLeise, textAlign: 'center' }}>
        <span style={{ color: A, textShadow: `0 0 8px ${A}` }}>●</span> letzte Stunde · <span style={{ color: WARM }}>●</span> heute · <span>●</span> ruht — Klick öffnet den Agenten
      </div>
    </div>
  );
}
