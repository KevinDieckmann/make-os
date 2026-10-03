'use client';

// ─── Lichtfäden — Engstellen als Liste unter dem Band ──────────────────────
// Je Engstelle ein Satz („KW 44: 3 Ziele · 9 Fristen · 4 Termine“) und die schwersten Stränge dahinter als Links.
// Der KW-Knopf im Band klappt die passende Zeile auf (`offen`). Ruhig: Bedeutung „achtung“, keine Alarmfarbe.

import Link from 'next/link';
import { FARBE as C, LEUCHT, SCHRIFT, TYP, RAND } from '@/lib/make-one/design';
import { QUELLEN } from '@/lib/lichtfaeden/modell';
import type { Engstelle } from '@/lib/lichtfaeden/fokus';

const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

export function Engstellen({ liste, offen, onOffen }: { liste: readonly Engstelle[]; offen: string | null; onOffen: (woche: string | null) => void }) {
  if (!liste.length) return null;
  return (
    <div role="list" aria-label="Engstellen" style={{ display: 'grid', gap: 6 }}>
      {liste.map(e => {
        const auf = offen === e.woche;
        return (
          <div key={e.woche} role="listitem" id={`engstelle-${e.woche}`} style={{ borderRadius: 14, border: `1px solid ${auf ? `${LEUCHT.achtung}55` : RAND.flaeche}`, background: auf ? `${LEUCHT.achtung}0F` : 'rgba(255,255,255,.025)' }}>
            <button type="button" className="fassbar" aria-expanded={auf} onClick={() => onOffen(auf ? null : e.woche)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '0 12px', border: 'none', background: 'transparent', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: LEUCHT.achtung, boxShadow: `0 0 8px ${LEUCHT.achtung}99`, flex: '0 0 auto' }} />
              <span style={{ flex: 1, minWidth: 0 }}>{e.text}</span>
              <span aria-hidden="true" style={{ color: C.inkLeise, transform: auf ? 'rotate(90deg)' : undefined, transition: 'transform .15s ease' }}>›</span>
            </button>
            {auf && (
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px' }}>
                {e.top.map(s => {
                  const zeile = (
                    <>
                      <span aria-hidden="true" style={{ color: C.inkDim, width: 16, textAlign: 'center', flex: '0 0 auto' }}>{QUELLEN[s.quelle].symbol}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.titel}</span>
                      <span style={{ color: s.ueberfaellig ? LEUCHT.kritisch : C.inkLeise, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{s.ueberfaellig ? `überfällig · ${tagKurz(s.tag)}` : tagKurz(s.tag)}</span>
                    </>
                  );
                  const stil = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 6px', borderRadius: 10, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textDecoration: 'none' } as const;
                  return <li key={s.id}>{s.link ? <Link href={s.link} style={stil} aria-label={`${QUELLEN[s.quelle].name}: ${s.titel}`}>{zeile}</Link> : <span style={stil}>{zeile}</span>}</li>;
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
