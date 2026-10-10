'use client';

// ─── Unternehmen › Struktur & Cap-Table als Bild (10.10.) ────────────────────────────────────────────────────────────
// Organigramm (Gesellschafter oben, eigene Gesellschaften darunter, fremde Beteiligungen unten) als ruhiges SVG im Design-Standard; am
// Handy dieselbe Struktur als Liste (Baum). Je Gesellschaft die Cap-Table mit Anteilen UND Stimmrechten, die durchgerechneten Beteiligungen
// (Hinweis wirtschaftlich Berechtigte > 25 % — Transparenzregister) und die Historie. Lage rechnet lib/gesellschaften/schild/struktur.ts;
// hier wird nur gezeichnet. Quelle sind die Gesellschafter-Einträge des Registers (nichts doppelt gespeichert).

import Link from 'next/link';
import { Network } from 'lucide-react';
import { FARBE as C, TYP, RAND, SCHRIFT, LEUCHT, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leerzustand, Hinweis, useHandy } from '../../ui';
import { WEG } from '@/lib/wege';
import { strukturBaum, type StrukturKnoten } from '@/lib/gesellschaften/modell';
import { capTable, durchgerechnet, strukturHistorie, organigramm, ORG_MASS } from '@/lib/gesellschaften/schild/struktur';
import { bezugName, centText, type GAnzeige, type RegisterDaten } from '../teile';
import { StatusPille } from '../UnternehmenView';
import type { SEintrag } from './daten';
import { GesellschaftWahl, SchildFuss, datum, klein } from './teile';

const prozent = (p: number) => `${p.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;

export function Struktur({ daten, schild, gewaehlt, waehle, oeffne }: { daten: RegisterDaten; schild: SEintrag[]; gewaehlt?: string; waehle: (id: string) => void; oeffne: (id: string) => void }) {
  const handy = useHandy();
  const name = (b: Parameters<typeof bezugName>[0]) => bezugName(b, daten.namen);
  const aktiv = daten.gesellschaften.filter(g => !g.geloeschtAm);
  const bild = organigramm(aktiv, name);
  const hatBeziehung = bild.kanten.length > 0;
  const g = aktiv.find(x => x.id === gewaehlt) ?? aktiv.find(x => (x.gesellschafter ?? []).some(y => !y.geloeschtAm)) ?? aktiv[0];
  return (
    <>
      <Karte>
        <Ueberschrift>Wer hält wen</Ueberschrift>
        {!hatBeziehung ? <Leerzustand symbol={<Network size={22} />} titel="Noch keine Beteiligungen">Trage bei einer Gesellschaft unter „Gesellschafter“ ein, wer sie hält — dann steht hier das Bild.</Leerzustand>
          : handy ? <Baum daten={daten} oeffne={oeffne} /> : <Bild bild={bild} oeffne={oeffne} />}
        <div style={{ ...klein, marginTop: 10 }}>Abgeleitet aus den Gesellschafter-Einträgen. Linien: Kapitalanteil, in Klammern abweichende Stimmrechte; gestrichelt: Beteiligung an einer fremden Firma.</div>
      </Karte>
      {g && <CapTableKarte g={g} daten={daten} schild={schild.find(x => x.id === g.id)} waehle={waehle} />}
    </>
  );
}

function Bild({ bild, oeffne }: { bild: ReturnType<typeof organigramm>; oeffne: (id: string) => void }) {
  const M = ORG_MASS;
  const nach = new Map(bild.knoten.map(k => [k.schluessel, k]));
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg role="img" aria-label="Organigramm der Gesellschaften" viewBox={`0 0 ${bild.breite} ${bild.hoehe}`} width={bild.breite} height={bild.hoehe} style={{ display: 'block', maxWidth: '100%', height: 'auto', fontFamily: SCHRIFT.text }}>
        {bild.kanten.map((k, i) => {
          const a = nach.get(k.von), b = nach.get(k.zu);
          if (!a || !b) return null;
          const x1 = a.x + M.breite / 2, y1 = a.y + M.hoehe, x2 = b.x + M.breite / 2, y2 = b.y;
          const my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <path d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`} fill="none" stroke={RAND.stark} strokeWidth={1.4} strokeDasharray={k.fremd ? '5 4' : undefined} />
              <text x={(x1 + x2) / 2} y={my - 4} textAnchor="middle" fontSize={12} fill={C.inkDim}>{k.anteil ? prozent(k.anteil) : ''}{k.stimmen !== undefined ? ` (${prozent(k.stimmen)} Stimmen)` : ''}</text>
            </g>
          );
        })}
        {bild.knoten.map(k => {
          const farbe = k.eigen ? LEUCHT.business : k.art === 'fremd' ? C.inkLeise : C.inkDim;
          const klick = k.eigen ? () => oeffne(k.id) : undefined;
          const label = k.label.length > 26 ? `${k.label.slice(0, 25)}…` : k.label;
          return (
            <g key={k.schluessel} onClick={klick} style={{ cursor: klick ? 'pointer' : 'default' }} role={klick ? 'link' : undefined} aria-label={k.label}>
              <rect x={k.x} y={k.y} width={M.breite} height={M.hoehe} rx={12} fill={k.eigen ? TIEF.flaeche(farbe) : 'rgba(255,255,255,.03)'} stroke={k.eigen ? TIEF.rand(farbe) : RAND.flaeche} strokeDasharray={k.art === 'fremd' ? '5 4' : undefined} />
              <text x={k.x + 12} y={k.y + 24} fontSize={14} fontWeight={600} fill={C.ink}>{label}</text>
              <text x={k.x + 12} y={k.y + 43} fontSize={12} fill={C.inkDim}>{k.eigen ? 'eigene Gesellschaft' : k.art === 'person' ? 'Person' : k.art === 'kontakt' ? 'Kontakt' : k.art === 'fremd' ? 'fremde Beteiligung' : k.art === 'firma' ? 'Firma' : 'Gesellschaft'}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Handy: dieselbe Struktur als Liste (Baum „wer hält wen“). */
function Baum({ daten, oeffne }: { daten: RegisterDaten; oeffne: (id: string) => void }) {
  return <ul role="tree" aria-label="Beteiligungsstruktur" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>{strukturBaum(daten.gesellschaften).map(k => <Knoten key={k.id} k={k} daten={daten} oeffne={oeffne} tiefe={0} />)}</ul>;
}

function Knoten({ k, daten, oeffne, tiefe }: { k: StrukturKnoten; daten: RegisterDaten; oeffne: (id: string) => void; tiefe: number }) {
  const linie = tiefe ? { borderLeft: `1px solid ${RAND.stark}`, marginLeft: 10, paddingLeft: 14 } : {};
  return (
    <li role="treeitem" aria-selected={false} style={{ ...linie, display: 'grid', gap: 6 }}>
      <button type="button" onClick={() => oeffne(k.id)} className="fassbar" style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, padding: '6px 10px', borderRadius: 12, border: `1px solid ${RAND.flaeche}`, background: 'rgba(255,255,255,.03)', color: C.ink, cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text }}>
        {k.prozent !== undefined && <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums', minWidth: 64 }}>{prozent(k.prozent)}</span>}
        <span style={{ fontSize: TYP.body, fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{k.name}{k.schonGezeigt ? ' (siehe oben)' : ''}</span>
        <StatusPille s={k.status} />
      </button>
      {(k.kinder.length > 0 || k.fremde.length > 0) && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {k.kinder.map(x => <Knoten key={`${k.id}-${x.id}`} k={x} daten={daten} oeffne={oeffne} tiefe={tiefe + 1} />)}
          {k.fremde.map(f => (
            <li key={`${k.id}-f-${f.firmaId}`} role="treeitem" aria-selected={false} style={{ borderLeft: `1px solid ${RAND.stark}`, marginLeft: 10, paddingLeft: 14 }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 40, padding: '6px 10px', fontSize: TYP.bedien, color: C.inkDim, fontStyle: 'italic' }}>
                {f.anteilProzent !== undefined && <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 64 }}>{prozent(f.anteilProzent)}</span>}
                <Link href={WEG.firma(f.firmaId)} style={{ color: 'inherit' }}>{bezugName({ art: 'firma', id: f.firmaId }, daten.namen)}</Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function CapTableKarte({ g, daten, schild, waehle }: { g: GAnzeige; daten: RegisterDaten; schild?: SEintrag; waehle: (id: string) => void }) {
  const name = (b: Parameters<typeof bezugName>[0]) => bezugName(b, daten.namen);
  const ct = capTable(g);
  const durch = durchgerechnet(g.id, daten.gesellschaften);
  const historie = strukturHistorie(g, schild, name);
  const mitKette = durch.some(d => d.ueber.length > 0);
  const auswahl = daten.gesellschaften.filter(x => !x.geloeschtAm && (x.gesellschafter ?? []).some(y => !y.geloeschtAm)).map(x => ({ id: x.id, name: x.name }));
  return (
    <Karte>
      <Ueberschrift>Cap-Table</Ueberschrift>
      <GesellschaftWahl liste={auswahl} aktiv={g.id} onWahl={waehle} />
      {!ct.zeilen.length ? <span style={klein}>Für {g.name} sind keine Gesellschafter eingetragen. <Link href={WEG.unternehmen(g.id, 'gesellschafter')} style={{ color: C.ink }}>Gesellschafter eintragen ›</Link></span> : (
        <>
          <div role="table" aria-label={`Cap-Table ${g.name}`} style={{ display: 'grid', gap: 2 }}>
            <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(64px, 1fr))', gap: 8, fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, padding: '0 2px' }}>
              <span role="columnheader">Gesellschafter</span><span role="columnheader">Nennbetrag</span><span role="columnheader">Anteil</span><span role="columnheader">Stimmen</span>
            </div>
            {ct.zeilen.map(z => (
              <div key={`${z.wer.art}:${z.wer.id}`} role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(64px, 1fr))', gap: 8, alignItems: 'center', minHeight: 44, padding: '4px 2px', borderTop: `1px solid ${RAND.flaeche}`, fontSize: TYP.bedien, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>
                <span role="cell" style={{ overflowWrap: 'anywhere' }}>{name(z.wer)}{z.ohneStimmrecht ? <span style={{ color: C.inkDim }}> · ohne Stimmrecht</span> : null}</span>
                <span role="cell">{centText(z.nennbetragCent)}</span>
                <span role="cell">{prozent(z.anteil)}</span>
                <span role="cell">{prozent(z.stimmen)}</span>
              </div>
            ))}
          </div>
          {ct.hinweis && <div style={{ marginTop: 8 }}><Hinweis art="achtung">{ct.hinweis}</Hinweis></div>}
        </>
      )}
      {mitKette && (
        <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
          <strong style={{ fontSize: TYP.bedien }}>Durchgerechnet (über eigene Gesellschaften)</strong>
          <Liste>{durch.map(d => <Zeile key={`${d.wer.art}:${d.wer.id}`} titel={name(d.wer)} unter={d.ueber.length ? `über ${d.ueber.map(id => daten.gesellschaften.find(x => x.id === id)?.name ?? 'Gesellschaft').join(' → ')}` : 'direkt'} rechts={<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: d.wirtschaftlichBerechtigt ? LEUCHT.achtung : C.ink }}>{prozent(d.prozent)}</span>} />)}</Liste>
        </div>
      )}
      {durch.some(d => d.wirtschaftlichBerechtigt) && <div style={{ ...klein, marginTop: 6 }}>Mehr als 25 % (gelb): wirtschaftlich Berechtigte nach § 3 GwG — Angaben im Transparenzregister prüfen (Kontrolle über Stimmrechte o. Ä. ist hier nicht abgebildet).</div>}
      {historie.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: TYP.bedien }}>Historie</strong>
          {historie.map((h, i) => <span key={`${h.tag}-${i}`} style={klein}>{datum(h.tag)} · {h.text}</span>)}
        </div>
      )}
      <SchildFuss>Stimmrechte: 1 € Nennbetrag = 1 Stimme (§ 47 Abs. 2 GmbHG), stimmrechtslose Anteile zählen nicht — abweichende Satzungsregeln sind nicht abgebildet.</SchildFuss>
    </Karte>
  );
}
