'use client';

// ─── Die Kennzahlen einer Säule — Gemessenes zuerst, Messlücken eingeklappt (11.10.) ─────────────────────────────────────────
// Kevin 11.10.: „So ist es sehr unübersichtlich.“ Im Cockpit standen je Säule bis zu 13 Kacheln, die meisten mit „—“. Jetzt: die gemessenen
// Kennzahlen als Kacheln (nach Gruppe, wie bisher), darunter EINE leise Zeile „n Kennzahlen noch ohne Daten — Namen …“, die die übrigen Kacheln
// aufklappt (jede mit ihrem Weg „… pflegen ›“). Nichts fällt weg, nichts wird anders gerechnet — eine Stelle für Business-, Privat-,
// Gesundheits-Index und den Traktions-Index (IndexAnsicht, BusinessCockpit).

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { KennzahlKachel } from '../business/teile';
import type { KennzahlStand } from '@/lib/kennzahlen/kern';

const RASTER = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 } as const;

/** Die Namen der Messlücken in einer Zeile (höchstens drei, dann „+ n“). */
export function lueckenText(offen: readonly Pick<KennzahlStand, 'label'>[]): string {
  if (!offen.length) return '';
  const namen = offen.slice(0, 3).map(k => k.label).join(' · ');
  return offen.length > 3 ? `${namen} + ${offen.length - 3}` : namen;
}

export function SaeuleKacheln({ kennzahlen, onOeffnen, offenStart = false }: {
  kennzahlen: readonly KennzahlStand[];
  onOeffnen: (id: string) => void;
  /** Messlücken gleich aufgeklappt zeigen (z. B. wenn ein Link auf eine von ihnen zeigt). */
  offenStart?: boolean;
}) {
  const [luecken, setLuecken] = useState(offenStart);
  const gemessen = kennzahlen.filter(k => k.gemessen);
  const offen = kennzahlen.filter(k => !k.gemessen);
  const gruppen = Array.from(new Set(gemessen.map(k => k.gruppe)));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {gruppen.map(g => (
        <div key={g} style={{ display: 'grid', gap: 8 }}>
          {gruppen.length > 1 && <span style={{ fontSize: TYP.mikro, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>{g}</span>}
          <div style={RASTER}>
            {gemessen.filter(k => k.gruppe === g).map(k => <KennzahlKachel key={k.id} k={k} onOeffnen={() => onOeffnen(k.id)} />)}
          </div>
        </div>
      ))}
      {offen.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <button type="button" onClick={() => setLuecken(!luecken)} aria-expanded={luecken} className="fassbar"
            style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 2px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, minWidth: 0 }}>
            <ChevronDown size={16} aria-hidden style={{ flex: '0 0 auto', color: C.inkLeise, transform: luecken ? 'rotate(180deg)' : undefined, transition: 'transform .2s ease' }} />
            <span style={{ fontWeight: 600, color: C.ink, whiteSpace: 'nowrap' }}>{offen.length} {offen.length === 1 ? 'Kennzahl' : 'Kennzahlen'} noch ohne Daten</span>
            {!luecken && <span style={{ color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>— {lueckenText(offen)}</span>}
            {luecken && <span style={{ color: C.inkLeise }}>— je Kachel steht, wie ihr die Lücke schließt</span>}
          </button>
          {luecken && <div style={RASTER}>{offen.map(k => <KennzahlKachel key={k.id} k={k} onOeffnen={() => onOeffnen(k.id)} />)}</div>}
        </div>
      )}
    </div>
  );
}
