'use client';

// ─── Prozesse · Werkstatt — ein Paket des Fulfillments ansehen (22.10., Etappe 1 „Öffnen & Rundweg“; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──────────
// Entscheidung 22.10. (Weg A): Die Werkstatt wird DER Editor für die Pakete des Fulfillments; ausgeführt wird weiter im Fall. Etappe 1 öffnet ein Paket hier auf derselben
// Fläche wie jeden Werkstatt-Prozess (./WerkstattFlaeche.tsx) — NUR ansehen: Bahnen Kunde/Team, Abstimmungspunkte als Raute am Ende der Phase, rechts die Felder des
// gewählten Schritts (Form, Frist, Zuständig, „Kunde sieht es“, Bausteine mit der Kunden-Regel). Gerechnet wird nichts hier (lib/prozesse/fulfillment-modus.ts
// `paketAnsicht`, lib/prozesse/werkstatt-lage.ts); die Daten kommen aus GET /api/prozesse/werkstatt?paket= (das Paket aus `fulfillment--<h>`, keine Kopie).
// Bearbeiten bleibt bis Etappe 2 im vorhandenen Editor des Fulfillments („Im Fulfillment-Editor bearbeiten ›“).

import { useMemo, useRef, useState } from 'react';
import { Grid3x3, Maximize2, Minus, Plus } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Chip, Hinweis, Knopf, SymbolKnopf } from '../ui';
import { paketAnsicht, paketKnotenZeilen, paketUnterzeile, werText } from '@/lib/prozesse/fulfillment-modus';
import { werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import { alleSchritte, phasen } from '@/lib/prozesse/fluss';
import { nachbar, type TastenAktion } from '@/lib/prozesse/werkstatt-tastatur';
import { WerkstattFlaeche, type FlaecheSteuerung } from './WerkstattFlaeche';
import { usePaket } from './werkstatt-daten';

const leer = () => undefined;

export function PaketWerkstatt({ paketId, schmal }: { paketId: string; /** Am Handy (bzw. schmal): die Fläche ohne Seitenfeld daneben. */ schmal: boolean }) {
  const { daten, fehler } = usePaket(paketId);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [rahmenWahl, setRahmenWahl] = useState<string | null>(null);
  const [raster, setRaster] = useState(true);
  const [ansage, setAnsage] = useState('');
  const flaeche = useRef<FlaecheSteuerung>(null);

  const ansicht = useMemo(() => (daten ? paketAnsicht(daten.paket, daten.bibliothek) : null), [daten]);
  // Die Bahn „Mensch“ heißt im Paket „Team“: die zuständige Person des Mandats (wer das ist, steht am Mandat, nie im Paket).
  const lage = useMemo(() => {
    if (!ansicht) return null;
    const l = werkstattLage(ansicht.definition);
    return { ...l, bahnen: l.bahnen.map(b => (b.schluessel === 'mensch' ? { ...b, titel: 'Team' } : b)) };
  }, [ansicht]);
  const befundJe = useMemo(() => new Map((daten?.befunde ?? []).filter(b => b.knotenId && b.stufe !== 'hinweis').map(b => [b.knotenId!, b.stufe as 'fehler' | 'offen'] as const)), [daten]);
  const ohne = useMemo(() => new Set<string>(), []);

  if (fehler && !daten) return <Hinweis art="achtung" titel="Das Paket ließ sich nicht laden">{fehler}</Hinweis>;
  if (!daten || !ansicht || !lage) return <p style={{ ...MIKRO, textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: TYP.bedien }}>Lädt …</p>;

  const d = ansicht.definition;
  const p = daten.paket;
  const schritte = alleSchritte(d).filter(x => !ansicht.abstimmungen[x.schritt.id]).length;
  const bestaetigungen = Object.keys(ansicht.abstimmungen).length;
  const gewaehlt = auswahl.length === 1 ? ansicht.info[auswahl[0]] : undefined;
  const rahmen = rahmenWahl ? p.knoten.find(k => k.id === rahmenWahl) : undefined;
  const fehlerBefunde = daten.befunde.filter(b => b.stufe === 'fehler');

  const taste = (a: TastenAktion): boolean => {
    if (a.art === 'abbrechen') { if (auswahl.length || rahmenWahl) { setAuswahl([]); setRahmenWahl(null); return true; } return false; }
    if (a.art !== 'waehlen') return false;
    const eine = auswahl.length === 1 ? auswahl[0] : undefined;
    if (!eine) { const erst = alleSchritte(d)[0]?.schritt.id; if (erst) { setAuswahl([erst]); flaeche.current?.zeige(erst); } return true; }
    const boxen = [...lage.knoten.values()].filter(k => !k.zu && k.id !== eine).map(k => ({ id: k.id, x: k.x, y: k.y, b: k.b, h: k.h }));
    const lk = lage.knoten.get(eine);
    const n = lk ? nachbar(lk, boxen, a.richtung) : null;
    if (n) { setAuswahl([n]); flaeche.current?.zeige(n); setAnsage(`„${d.knoten.find(k => k.id === n)?.titel ?? ''}“ gewählt.`); }
    return true;
  };

  return (
    <div className="pw-werkstatt">
      <div className="pw-kopf">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Chip farbe={C.inkDim}>{`Paket des Fulfillments · Fassung ${p.fassung}`}</Chip>
          {p.zusatz && <Chip farbe={C.inkDim}>Zusatzmodul</Chip>}
          {daten.laufende > 0 && <Chip farbe={C.aktiv}>{daten.laufende === 1 ? '1 laufender Kunde' : `${daten.laufende} laufende Kunden`}</Chip>}
          {daten.produkte.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{`für ${daten.produkte.map(x => x.name).join(', ')}`}</span>}
        </div>
        <div className="pw-werkzeuge" role="toolbar" aria-label="Paket ansehen">
          <SymbolKnopf ariaLabel="Raster an/aus" gedrueckt={raster} onClick={() => setRaster(r => !r)}><Grid3x3 size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Verkleinern" onClick={() => flaeche.current?.zoomen(0.8)}><Minus size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Vergrößern" onClick={() => flaeche.current?.zoomen(1.25)}><Plus size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Alles zeigen" onClick={() => flaeche.current?.allesZeigen()}><Maximize2 size={16} /></SymbolKnopf>
          {!schmal && <Knopf leise href={daten.editor} titel="Bis zur nächsten Etappe wird ein Paket im Editor des Fulfillments bearbeitet">Im Fulfillment-Editor bearbeiten ›</Knopf>}
        </div>
      </div>
      {fehlerBefunde.length > 0 && (
        <Hinweis art="achtung" titel="Das Paket trägt etwas, das der Fall nicht ausführt">
          {fehlerBefunde.slice(0, 5).map((b, i) => <span key={i} style={{ display: 'block' }}>{b.text}</span>)}
        </Hinweis>
      )}
      <div className={`pw-raster${schmal ? ' pw-raster-schmal' : ''}`}>
        <div className="pw-flaeche-rahmen">
          <WerkstattFlaeche ref={flaeche} d={d} lage={lage} szene={`${p.id}:${p.fassung}`} auswahl={auswahl} kanteWahl={null} rahmenWahl={rahmenWahl} andockWahl={null}
            probe={null} befundJe={befundJe} unterzeile={k => paketUnterzeile(ansicht.info[k.id])} mitSchloss={ohne} nurLesen raster={raster} handy={schmal}
            label={`Paket „${p.titel}“: ${schritte} Schritte in ${phasen(d).length} Phasen, ${bestaetigungen} Bestätigungen. Nur ansehen — Pfeile wählen einen Schritt.`}
            onAuswahl={ids => { setRahmenWahl(null); setAuswahl(ids.slice(-1)); }}
            onKante={leer} onRahmen={id => { setRahmenWahl(id); setAuswahl([]); }} onUnter={id => setAuswahl([id])}
            onZiehen={leer} onVerbinden={leer} onAnhaengen={leer} onZuklappen={leer} onTaste={taste} />
        </div>
        {!schmal && (
          <aside className="pw-panel" aria-label="Felder des Pakets">
            {gewaehlt ? (
              <>
                <b style={{ fontSize: TYP.body, color: C.ink }}>{gewaehlt.titel}</b>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', margin: 0, fontSize: TYP.bedien }}>
                  {paketKnotenZeilen(gewaehlt).map((z, i) => <span key={i} style={{ display: 'contents' }}><dt style={{ color: C.inkDim }}>{z.name}</dt><dd style={{ margin: 0, color: C.ink }}>{z.wert}</dd></span>)}
                </dl>
                {gewaehlt.bausteine.length > 0 && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span style={{ ...MIKRO }}>Bausteine</span>
                    {gewaehlt.bausteine.map((b, i) => (
                      <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.ink }}>
                        <span>{b.titel}</span>
                        {b.kundeFrei === false && <span title={b.grund}><Chip farbe={C.inkDim}>nicht für Kunden</Chip></span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : rahmen ? (
              <>
                <b style={{ fontSize: TYP.body, color: C.ink }}>{rahmen.titel}</b>
                <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>
                  {`${alleSchritte(d).filter(x => x.phase.id === rahmen.id && !ansicht.abstimmungen[x.schritt.id]).length} Schritte · Kunde sieht die Phase: ${rahmen.kundeSichtbar ? 'ja' : 'nein'}`}
                </p>
                {ansicht.info[`ab~${rahmen.id}`]?.wer && <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>{`${ansicht.info[`ab~${rahmen.id}`]!.titel} — ${werText(ansicht.info[`ab~${rahmen.id}`]!.wer!)}`}</p>}
              </>
            ) : (
              <>
                <b style={{ fontSize: TYP.body, color: C.ink }}>{p.titel}</b>
                <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>{`${phasen(d).length} Phasen · ${schritte} Schritte · ${bestaetigungen} Bestätigungen`}</p>
                <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim }}>Ausgeführt wird im Fall des Kunden. Bahn „Kunde“: der Kunde ist dran · „Team“: die zuständige Person des Mandats. Ein Klick auf einen Schritt zeigt seine Felder.</p>
              </>
            )}
          </aside>
        )}
      </div>
      <div aria-live="polite" className="pz-nur-vorlesen">{ansage}</div>
    </div>
  );
}
