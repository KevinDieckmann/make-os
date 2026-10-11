'use client';

// ─── Unternehmen › Risiken als Matrix (11.10.) ───────────────────────────────────────────────────────────────────────────────────────
// Wie wahrscheinlich (oben = fast sicher) × wie schwer (rechts = bestandsgefährdend). Jedes bewertete Risiko ist ein nummerierter Punkt in seinem Feld; das
// Feld trägt die Farbe, die die Bewertung ergibt. Die Legende darunter nennt die Nummern — sie ist auch das, was man antippt (≥ 44 px). Gerechnet in
// lib/gesellschaften/schild/matrix.ts (Nummern nach Schwere), hier nur gezeichnet.

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leerzustand, Knopf, useHandy } from '../../ui';
import { WEG } from '@/lib/wege';
import { risikoMatrix, EINTRITT_KLAR, WIRKUNG_KLAR, type MatrixPunkt } from '@/lib/gesellschaften/schild/matrix';
import type { RisikoAmpel, RisikoZeile } from '@/lib/gesellschaften/schild/risiken';
import type { Stufe } from '@/lib/gesellschaften/schild/typen';
import { WasSeheIch, beschriftung, klein } from './teile';

const FELD: Record<RisikoAmpel, string> = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung, gruen: LEUCHT.gut, offen: C.inkDim };
const STUFEN = [1, 2, 3, 4, 5] as Stufe[];

export function RisikoMatrixKarte({ je, onWahl, alle }: { je: readonly { gesellschaftId: string; gesellschaft: string; risiken: readonly RisikoZeile[] }[]; onWahl?: (p: MatrixPunkt) => void; alle?: boolean }) {
  const schmal = useHandy();
  const m = risikoMatrix(je);
  if (!m.punkte.length) {
    const erfasst = je.some(g => g.risiken.length);
    return (
      <Karte>
        <Ueberschrift erklaerung="unternehmen.blick.matrix">Risiko-Matrix</Ueberschrift>
        <Leerzustand symbol={<ShieldAlert size={22} />} titel={erfasst ? 'Noch kein Risiko bewertet' : 'Noch kein Risiko erfasst'} aktion={je.length === 1 ? <Knopf leise href={WEG.schild('risiken', je[0].gesellschaftId)}>Risiken öffnen</Knopf> : undefined}>
          {erfasst ? 'Bewerte je Risiko, wie wahrscheinlich es ist und wie schwer es wiegt — dann steht es hier als Punkt.' : 'Übernimm den Startkatalog (17 typische Risiken) und bewerte sie — dann füllt sich das Bild.'}
        </Leerzustand>
      </Karte>
    );
  }
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.blick.matrix">Risiko-Matrix</Ueberschrift>
      <div role="img" aria-label={`Risiko-Matrix: ${m.punkte.length} bewertete Risiken, ${m.punkte.filter(p => p.ampel === 'rot').length} rot`} style={{ display: 'grid', gridTemplateColumns: `${schmal ? 26 : 104}px repeat(5, minmax(0, 1fr))`, gap: 4 }}>
        {([5, 4, 3, 2, 1] as Stufe[]).map(e => (
          <div key={e} style={{ display: 'contents' }}>
            <span style={{ ...beschriftung, alignSelf: 'center', textAlign: 'right', paddingRight: 4 }}>{schmal ? e : EINTRITT_KLAR[e]}</span>
            {STUFEN.map(w => {
              const z = m.zellen.find(x => x.eintritt === e && x.wirkung === w)!;
              return (
                <span key={w} title={z.punkte.map(p => `${p.nr}. ${p.titel}`).join(' · ') || undefined}
                  style={{ minHeight: 46, borderRadius: 8, display: 'flex', flexWrap: 'wrap', gap: 3, alignContent: 'center', justifyContent: 'center', padding: 3, border: `1px solid ${RAND.haar}`, background: `${FELD[z.ampel]}${z.punkte.length ? '2E' : '10'}` }}>
                  {z.punkte.map(p => (
                    <span key={p.risikoId} style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: TYP.mikro, fontWeight: 700, color: C.grund, background: FELD[p.ampel] }}>{p.nr}</span>
                  ))}
                </span>
              );
            })}
          </div>
        ))}
        <span />
        {STUFEN.map(w => <span key={w} style={{ ...beschriftung, textAlign: 'center', paddingTop: 4, overflowWrap: 'anywhere' }}>{schmal ? w : WIRKUNG_KLAR[w]}</span>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...klein, marginTop: 4 }}>
        <span>↑ wie wahrscheinlich</span><span>wie schwer →</span>
      </div>
      {schmal && <div style={{ ...klein, marginTop: 4 }}>Wahrscheinlich: 1 selten … 5 fast sicher · Schwer: 1 gering … 5 bestandsgefährdend.</div>}
      <div style={{ display: 'grid', marginTop: 10 }}>
        {m.punkte.map(p => {
          const inhalt = (
            <>
              <span style={{ width: 24, height: 24, borderRadius: 12, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontSize: TYP.mikro, fontWeight: 700, color: C.grund, background: FELD[p.ampel] }}>{p.nr}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, lineHeight: 1.45, overflowWrap: 'anywhere', color: C.ink }}>{p.titel}{alle ? <span style={{ color: C.inkDim }}> · {p.gesellschaft}</span> : null}</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, whiteSpace: 'nowrap' }}>{EINTRITT_KLAR[p.eintritt]} · {WIRKUNG_KLAR[p.wirkung]}</span>
            </>
          );
          const stil = { display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, padding: '4px 2px', borderTop: `1px solid ${RAND.haar}`, textDecoration: 'none', textAlign: 'left' as const, width: '100%' };
          return onWahl
            ? <button key={p.risikoId} type="button" className="fassbar" onClick={() => onWahl(p)} style={{ ...stil, background: 'transparent', border: 'none', borderTop: `1px solid ${RAND.haar}`, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>{inhalt}</button>
            : <Link key={p.risikoId} href={WEG.schild('risiken', p.gesellschaftId)} className="fassbar" style={stil}>{inhalt}</Link>;
        })}
      </div>
      {m.unbewertet > 0 && <div style={{ ...klein, marginTop: 6 }}>{m.unbewertet} Risiko{m.unbewertet === 1 ? '' : 's'} noch ohne Bewertung — {m.unbewertet === 1 ? 'es fehlt' : 'sie fehlen'} im Bild.</div>}
      <WasSeheIch>Jeder Punkt ist ein Risiko: je weiter oben, desto wahrscheinlicher; je weiter rechts, desto schwerer. Rote Felder brauchen eine Maßnahme, grüne könnt ihr beobachten. Die Nummer 1 wiegt am schwersten.</WasSeheIch>
      <div style={{ ...klein, marginTop: 4, color: C.inkLeise }}>Skala der Recherche (Annahme): rot ab 15 Punkten (Eintritt × Wirkung) oder bei „bestandsgefährdend“, gelb 8–14.</div>
    </Karte>
  );
}
