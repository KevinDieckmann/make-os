'use client';

// ─── Unternehmen › Lebenslauf der Gesellschaft (11.10.) ──────────────────────────────────────────────────────────────────────────────
// Ein senkrechter Zeitstrahl nach Jahren: Gründung, Eintragung, Beschlüsse, neue Fassungen (Gegenstand, Satzung, Kapital, Sitz, Geschäftsführung, Firma),
// Gesellschafter, Organe, Beteiligungen, Ereignisse — neueste oben. Jede Art hat ein eigenes Zeichen (nicht nur Farbe). Gerechnet in
// lib/gesellschaften/lebenslauf.ts aus dem Register (eine Quelle) — hier nur gezeichnet. Am Handy dieselbe Liste (senkrecht passt immer).

import Link from 'next/link';
import { useState } from 'react';
import { Building2, FileText, Flag, Gavel, Landmark, Network, ScrollText, UserCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { FARBE as C, TYP, RAND, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Leerzustand } from '../../ui';
import { WEG } from '@/lib/wege';
import { lebenslauf, lebenslaufJahre, type LebenslaufArt } from '@/lib/gesellschaften/lebenslauf';
import type { SchildGesellschaft } from '@/lib/gesellschaften/schild/typen';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { bezugName, type GAnzeige } from '../teile';
import { WasSeheIch, klein } from './teile';

const ZEICHEN: Record<LebenslaufArt, ReactNode> = {
  gruendung: <Flag size={14} />, register: <Landmark size={14} />, beschluss: <Gavel size={14} />, fassung: <ScrollText size={14} />,
  gesellschafter: <Users size={14} />, organ: <UserCheck size={14} />, beteiligung: <Network size={14} />, ereignis: <FileText size={14} />,
};

export function LebenslaufKarte({ g, schild, namen, heute, max = 12 }: { g: GAnzeige; schild?: SchildGesellschaft | null; namen: Record<string, string>; heute: string; max?: number }) {
  const [alle, setAlle] = useState(false);
  const l = lebenslauf(g, schild, b => bezugName(b, namen), heute);
  const zeigen = alle ? l : l.slice(0, max);
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.blick.lebenslauf" rechts={<Knopf leise href={WEG.beschluss(g.id)}>Beschluss-Buch ›</Knopf>}>Lebenslauf der Gesellschaft</Ueberschrift>
      {!l.length ? (
        <Leerzustand symbol={<Building2 size={22} />} titel="Noch keine Geschichte erfasst" aktion={<Knopf leise href={WEG.unternehmen(g.id)}>Steckbrief öffnen</Knopf>}>Trage Gründung und Eintragung im Steckbrief ein, Beschlüsse im Beschluss-Buch — dann entsteht hier der Lebenslauf.</Leerzustand>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
          {lebenslaufJahre(zeigen).map(j => (
            <li key={j.jahr} style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: TYP.bedien, fontWeight: 700, color: C.ink, padding: '8px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{j.jahr}</span>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: `2px solid ${RAND.stark}`, marginLeft: 13, display: 'grid' }}>
                {j.eintraege.map(e => {
                  const inhalt = (
                    <>
                      <span aria-hidden style={{ marginLeft: -14, width: 26, height: 26, borderRadius: 13, flex: '0 0 auto', display: 'grid', placeItems: 'center', color: e.art === 'beschluss' ? C.aktiv : C.inkDim, background: e.art === 'beschluss' ? TIEF.flaeche(C.aktiv) : C.flaeche, border: `1px ${e.kommt ? 'dashed' : 'solid'} ${RAND.stark}` }}>{ZEICHEN[e.art]}</span>
                      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1 }}>
                        <span style={{ fontSize: TYP.bedien, lineHeight: 1.45, color: C.ink, overflowWrap: 'anywhere' }}>{e.titel}{e.kommt ? <span style={{ color: C.inkDim }}> · kommt</span> : null}</span>
                        <span style={{ ...klein, overflowWrap: 'anywhere' }}>{tagText(e.tag)}{e.unter ? ` · ${e.unter}` : ''}</span>
                      </span>
                    </>
                  );
                  const stil = { display: 'flex', gap: 12, alignItems: 'center', minHeight: 44, padding: '4px 0', color: C.ink, textDecoration: 'none' };
                  return <li key={e.id}>{e.weg ? <Link href={e.weg} className="fassbar" style={stil}>{inhalt}</Link> : <div style={stil}>{inhalt}</div>}</li>;
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}
      {l.length > max && <div style={{ marginTop: 8 }}><Knopf leise onClick={() => setAlle(x => !x)}>{alle ? 'Weniger zeigen' : `Alle ${l.length} Einträge zeigen`}</Knopf></div>}
      <WasSeheIch>Die Geschichte der Gesellschaft auf einer Linie, das Neueste oben: Beschlüsse, neue Fassungen von Satzung und Gegenstand, Kapital, Wechsel in Geschäftsführung und Gesellschafterkreis. Ein gestrichelter Kreis ist beschlossen, gilt aber erst später.</WasSeheIch>
    </Karte>
  );
}
