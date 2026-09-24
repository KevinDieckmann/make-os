'use client';

// ─── CRM · Lage — Kennzahlen mit Ampel und was jetzt zu tun ist ────────────
// Wie die Übersicht in KEMARIS Operations: aus dem Bestand gerechnet, grau
// solange nichts gemessen ist, jeder Befund führt direkt in den Bereich.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT } from '../schlank';
import type { Kpi } from '@/lib/crm/kennzahlen';
import type { Befund } from '@/lib/crm/befunde';
import { Befunde } from './Stammdaten';

const F = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise } as const;

export function Lage({ zuBereich, takt }: { zuBereich: (b: string, a?: string) => void; takt: number }) {
  const [d, setD] = useState<{ kennzahlen: Kpi[]; befunde: Befund[] } | null>(null);
  const [alle, setAlle] = useState(false);
  useEffect(() => { fetch('/api/crm/stammdaten', { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}); }, [takt]);
  if (!d) return null;
  return (
    <Karte i={0}>
      <Ueberschrift rechts={<span style={{ fontSize: 12, color: C.inkLeise }}>grau = noch nichts gemessen</span>}>Lage</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
        {d.kennzahlen.map(k => (
          <div key={k.id} title={`${k.quelle} · Ziel ${k.ziel}`} style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.03)', borderLeft: `3px solid ${F[k.ampel]}` }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.ampel === 'grau' ? C.inkDim : C.ink, fontVariantNumeric: 'tabular-nums' }}>{k.anzeige}</div>
            <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2, lineHeight: 1.35 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 2 }}>Ziel {k.ziel}</div>
          </div>
        ))}
      </div>
      {d.befunde.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600, marginBottom: 4 }}>Was jetzt zu tun ist</div>
          <Befunde liste={alle ? d.befunde : d.befunde.slice(0, 4)} zuBereich={zuBereich} />
          {d.befunde.length > 4 && <button onClick={() => setAlle(!alle)} style={{ marginTop: 6, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{alle ? 'weniger' : `alle ${d.befunde.length}`}</button>}
        </div>
      )}
    </Karte>
  );
}
