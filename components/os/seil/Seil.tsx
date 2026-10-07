'use client';

// ─── Seil — die Karte (07.10., LICHTFAEDEN.md › Seil) ──────────────────────────────────────────────────────────────────────
// Kevin (07.10.): „Die einzelnen Strahle sind nicht wirklich sichtbar. Am Ende müssen sie irgendwo alle ineinander greifen, wie ein
// Kabel oder ein Seil. Erst dann kommt Fokus und Momentum.“ EINE Komponente für das Planungsjahr (`ebene="jahr"`: Ziele, Meilensteine,
// Unterziele, Projekte) und den Aufgaben-Zeitstrahl (`ebene="aufgaben"`: Projekte und Meilenstein-Listen mit ihren Karten):
//   Kopf      Titel, optional ein Umschalter (z. B. Seil · Alle Stränge)
//   Zeitraum  Planungsjahr: das Fenster der Planung (Blättern, Heute); Aufgaben: 8 Wochen · 3 Monate · 6 Monate
//   Fokus     Ziel antippen → nur seine Stränge; kritischer Pfad und Engpass als Satz
//   Bühne     Rechner: SeilBand (Leinwand + Knöpfe); Handy: SeilHandy (ohne Querlauf)
//   Legende   was gefüllt/Kontur/gestrichelt/◎/○/€ bedeutet — und das Text-Äquivalent für Vorleser
// Daten: GET /api/seil (Bereich und „nur ich“ serverseitig). Rechnen nur in lib/lichtfaeden/seil*.ts.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, LEUCHT, LICHT_GLAS, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { STRAHL_RAEUME, type StrahlRaum } from '@/lib/planung/zeitstrahl';
import { seilTagPlus } from '@/lib/lichtfaeden/seil';
import { Karte, Segmente, Knopf, Hinweis, Leerzustand, Ueberschrift, useHandy } from '../ui';
import type { StrahlFenster } from '../planung/useStrahlFenster';
import { SeilBand } from './SeilBand';
import { SeilHandy } from './SeilHandy';
import { useSeil, type SeilBereichWahl, type SeilEbene } from './useSeil';

type AufgabenRaum = '8w' | '3m' | '6m';
const AUFGABEN_RAEUME: { id: AufgabenRaum; label: string; tage: number }[] = [
  { id: '8w', label: '8 Wochen', tage: 56 }, { id: '3m', label: '3 Monate', tage: 91 }, { id: '6m', label: '6 Monate', tage: 182 },
];
/** Vor HEUTE bleibt ein Stück Vergangenheit sichtbar (was gerade erledigt wurde, füllt die Stränge). */
const ZURUECK_TAGE = 14;

export interface SeilProps {
  ebene: SeilEbene;
  bereich: SeilBereichWahl;
  /** Planungsjahr: das geteilte Fenster der Planung (Blättern, Heute). */
  fenster?: StrahlFenster;
  titel?: string;
  /** Rechts in der Überschrift (z. B. der Umschalter Seil · Alle Stränge). */
  kopfRechts?: ReactNode;
  /** Rechts neben dem Zeitraum (z. B. „+ Meilenstein“). */
  aktion?: ReactNode;
  /** Fokus beim Öffnen (Kennung eines Ziels). */
  fokusStart?: string | null;
  /** Ändert er sich (z. B. Aufgaben abgehakt), lädt das Seil nach — die Stränge füllen sich sichtbar. */
  schluessel?: string | number;
  i?: number;
}

export function Seil({ ebene, bereich, fenster, titel = 'Ziele als Seil', kopfRechts, aktion, fokusStart = null, schluessel, i = 0 }: SeilProps) {
  const heuteLokal = localDay();
  const [raum, setRaum] = useState<AufgabenRaum>('3m');
  const eigen = useMemo(() => { const r = AUFGABEN_RAEUME.find(x => x.id === raum)!; return { von: seilTagPlus(heuteLokal, -ZURUECK_TAGE), bis: seilTagPlus(heuteLokal, r.tage - ZURUECK_TAGE) }; }, [raum, heuteLokal]);
  const von = fenster ? fenster.fenster.von : eigen.von;
  const bis = fenster ? fenster.fenster.bis : eigen.bis;
  const { daten, laedt, fehler, neu } = useSeil({ ebene, bereich, von, bis, schluessel });
  const [fokus, setFokus] = useState<string | null>(fokusStart);
  useEffect(() => { setFokus(fokusStart); }, [fokusStart]);
  const handy = useHandy();
  const a = daten?.ansicht ?? null;
  const heute = a?.heute ?? heuteLokal;
  // Ein Fokus auf ein Ziel, das es in dieser Sicht nicht (mehr) gibt, löst sich.
  useEffect(() => { if (a && fokus && !a.seile.some(s => s.zielId === fokus)) setFokus(null); }, [a, fokus]);
  const fokusSeil = a && fokus ? a.seile.find(s => s.zielId === fokus) ?? null : null;
  const leer = !!a && !a.seile.length && !a.ohneZiel.length;

  return (
    <Karte i={i} className="seil-karte" style={{ background: LICHT_GLAS.karte }} ariaLabel={titel}>
      <Ueberschrift rechts={kopfRechts}>{titel}</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {fenster
            ? <Segmente liste={STRAHL_RAEUME.map(r => ({ id: r.id, label: r.label }))} aktiv={fenster.raum} onWahl={(r: StrahlRaum) => fenster.setRaum(r)} />
            : <Segmente liste={AUFGABEN_RAEUME.map(r => ({ id: r.id, label: r.label }))} aktiv={raum} onWahl={setRaum} />}
          <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
            {fenster ? fenster.fenster.label : `${von.slice(8, 10)}.${von.slice(5, 7)}. – ${bis.slice(8, 10)}.${bis.slice(5, 7)}.${bis.slice(0, 4)}`}
          </span>
          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto' }}>
            {fenster && <Knopf leise aus={fenster.heuteSichtbar} onClick={fenster.zuHeute}>Heute</Knopf>}
            {aktion}
          </span>
        </div>

        {fehler && <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={neu}>Noch einmal versuchen</Knopf>}>{fehler}</Hinweis>}

        {fokusSeil && (
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', padding: '10px 12px', borderRadius: 12, border: `1px solid ${fokusSeil.farbe}55`, background: `${fokusSeil.farbe}12` }}>
            <div style={{ flex: '1 1 260px', minWidth: 0, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>
              <b style={{ color: fokusSeil.farbe }}>Fokus: {fokusSeil.titel}</b>
              {' — '}{fokusSeil.fertig} von {fokusSeil.straenge.length} {fokusSeil.straenge.length === 1 ? 'Strang' : 'Strängen'} fertig, Momentum {Math.round(fokusSeil.momentum * 100)} %.
              {fokusSeil.pfadText
                ? <div style={{ color: LEUCHT.achtung }}>Kritischer Pfad: {fokusSeil.pfadText}</div>
                : <div style={{ color: C.inkDim }}>Keine Kette offener Abhängigkeiten — die Stränge können parallel laufen.</div>}
              {fokusSeil.engpass && <div style={{ color: C.inkDim }}>Engpass: „{fokusSeil.engpass.titel}“ — {fokusSeil.engpass.wartende} warten darauf.</div>}
            </div>
            <Knopf leise onClick={() => setFokus(null)}>Fokus lösen</Knopf>
          </div>
        )}

        {a && !leer && (handy
          ? <SeilHandy ansicht={a} fokus={fokus} onFokus={setFokus} />
          : <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }} aria-busy={laedt}>
              {fenster && <Pfeil richtung={-1} onBlaettern={fenster.blaettern} />}
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <SeilBand ansicht={a} heute={heute} fokus={fokus} onFokus={setFokus} onBlaettern={fenster?.blaettern} onBreite={fenster?.setBreite}
                  label={`${titel}: ${a.seile.length} ${a.seile.length === 1 ? 'Ziel' : 'Ziele'}${a.ohneZiel.length ? `, ${a.ohneZiel.length} ohne Ziel` : ''}`} />
              </div>
              {fenster && <Pfeil richtung={1} onBlaettern={fenster.blaettern} />}
            </div>)}
        {!a && !fehler && <div style={{ height: 240, borderRadius: 16, background: 'rgba(255,255,255,.02)' }} aria-busy="true" aria-label="Seil laden" />}
        {leer && !laedt && (
          <Leerzustand symbol="◎" titel="Noch läuft nichts zusammen">
            {ebene === 'jahr'
              ? 'Im Zeitraum hat kein Ziel Meilensteine oder Karten. Lege Meilensteine an oder verbinde Aufgaben und Projekte mit „zahlt ein auf …“ — dann laufen sie hier als Stränge zum Ziel.'
              : 'Im Zeitraum sind keine Aufgaben terminiert. Gib Aufgaben ein Datum und verbinde Projekte mit einem Ziel („zahlt ein auf …“).'}
          </Leerzustand>
        )}

        {a && !leer && <Legende />}
        {a && <p className="nur-vorleser" aria-live="polite">{a.text}</p>}
      </div>
    </Karte>
  );
}

/** Was die Zeichen bedeuten — ruhig, eine Zeile (bricht am Handy um). */
function Legende() {
  const z = (inhalt: ReactNode, text: string) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{inhalt}<span>{text}</span></span>;
  const roehre = (voll: boolean, gestrichelt = false) => <span aria-hidden="true" style={{ width: 22, height: 6, borderRadius: 3, border: `1px ${gestrichelt ? 'dashed' : 'solid'} ${C.inkDim}`, background: voll ? C.inkDim : 'transparent' }} />;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: TYP.bedien, color: C.inkDim }}>
      {z(roehre(true), 'erledigt')}
      {z(roehre(false), 'offen')}
      {z(roehre(false, true), 'wartet (blockiert)')}
      {z(<span aria-hidden="true" style={{ color: LEUCHT.achtung }}>⤳</span>, 'wartet auf …')}
      {z(<span aria-hidden="true">◎</span>, 'Ziel — dort verdrillen die Stränge zum Seil')}
      {z(<span aria-hidden="true">○</span>, 'Termin')}
      {z(<span aria-hidden="true">€</span>, 'Deal')}
    </div>
  );
}

/** Blättern um einen Monat (Umschalt: ein Quartal) — nur am Rechner; am Handy wischt man. */
function Pfeil({ richtung, onBlaettern }: { richtung: -1 | 1; onBlaettern: (n: number) => void }) {
  return (
    <span className="ui-nur-breit" style={{ alignSelf: 'center', flex: '0 0 auto' }}>
      <button type="button" onClick={e => onBlaettern(richtung * (e.shiftKey ? 3 : 1))} className="fassbar"
        aria-label={richtung < 0 ? 'Einen Monat zurück (Umschalt: ein Quartal)' : 'Einen Monat vor (Umschalt: ein Quartal)'}
        style={{ width: 32, height: 44, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.05)', color: C.inkDim, fontSize: 18, cursor: 'pointer', margin: richtung < 0 ? '0 8px 0 -6px' : '0 -6px 0 8px' }}>{richtung < 0 ? '‹' : '›'}</button>
    </span>
  );
}
