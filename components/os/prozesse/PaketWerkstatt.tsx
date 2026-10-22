'use client';

// ─── Prozesse · Werkstatt — ein Paket des Fulfillments ansehen und bearbeiten (22.10., Fulfillment in die Werkstatt E1/E2; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──
// Entscheidung 22.10. (Weg A): Die Werkstatt ist DER Editor der Pakete; ausgeführt wird weiter im Fall. Das Paket steht auf derselben Fläche wie jeder Werkstatt-Prozess
// (./WerkstattFlaeche.tsx): Bahnen Kunde/Team, Bestätigungen als Raute am Ende der Phase, rechts das Seitenfeld (./PaketPanel.tsx). Gerechnet wird nichts hier
// (lib/prozesse/fulfillment-modus.ts `paketAnsicht`, lib/prozesse/fulfillment-bearbeiten.ts — die Regeln des Fulfillment-Editors, lib/prozesse/werkstatt-lage.ts).
// E2: Volle Mitglieder bearbeiten einen ENTWURF (im Bestand `fulfillment--<h>`, nie eine Kopie): jede Änderung wird nach einer kurzen Pause gespeichert
// (POST /api/prozesse/werkstatt `paket-entwurf`, Stand/409 — „Deine Fassung“ bleibt stehen), Rückgängig/Wiederholen in der Sitzung, „Entwurf verwerfen“.
// Laufende Kunden sehen einen Entwurf nie (Veröffentlichen + Übernehmen je Kunde: E3). Am Handy nur ansehen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid3x3, Maximize2, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Chip, Hinweis, Knopf, SymbolKnopf, eingabe as eingabeStil } from '../ui';
import { neueKennung } from '@/lib/kennung';
import { abstimmungsKnoten, paketAnsicht, paketUnterzeile } from '@/lib/prozesse/fulfillment-modus';
import { paketBearbeiten, type EditorOp } from '@/lib/prozesse/fulfillment-bearbeiten';
import { werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import { alleSchritte, phasen } from '@/lib/prozesse/fluss';
import { nachbar, type TastenAktion } from '@/lib/prozesse/werkstatt-tastatur';
import type { ProzessVorlage } from '@/lib/prozesse/definition';
import { WerkstattFlaeche, type FlaecheSteuerung } from './WerkstattFlaeche';
import { PaketPanel, type PanelAuswahl, type PanelPhase } from './PaketPanel';
import { PaketKunden } from './PaketKunden';
import { PaketBegleitung } from './PaketBegleitung';
import { MobilMaske, MobilSchrittListe } from './MobilBearbeiten';
import { MOBIL_OPS, paketMobilFelder, paketMobilOps } from '@/lib/prozesse/mobil-felder';
import { usePaket, werkstattSenden, type PaketAntwort } from './werkstatt-daten';

const leer = () => undefined;
type Speicher = { art: 'gespeichert' | 'ausstehend' | 'speichert' | 'fehler' | 'konflikt' | 'offline'; text?: string };
const SPEICHER_TEXT: Record<Speicher['art'], string> = { gespeichert: 'Entwurf gespeichert', ausstehend: 'Änderung …', speichert: 'Speichert …', fehler: 'Nicht gespeichert', konflikt: 'Andere Fassung', offline: 'Keine Verbindung' };

export function PaketWerkstatt({ paketId, schmal }: { paketId: string; /** Am Handy (bzw. schmal): nur ansehen, die Fläche ohne Seitenfeld daneben. */ schmal: boolean }) {
  const { daten: geladen, fehler, laden } = usePaket(paketId);
  const [daten, setDaten] = useState<PaketAntwort | null>(null);
  const [fassung, setFassung] = useState<ProzessVorlage | null>(null);
  const [zurueck, setZurueck] = useState<ProzessVorlage[]>([]);
  const [vor, setVor] = useState<ProzessVorlage[]>([]);
  const [speicher, setSpeicher] = useState<Speicher>({ art: 'gespeichert' });
  const [konflikt, setKonflikt] = useState<PaketAntwort | null>(null);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [rahmenWahl, setRahmenWahl] = useState<string | null>(null);
  const [raster, setRaster] = useState(true);
  const [ansage, setAnsage] = useState('');
  // E3: Veröffentlichen mit Name und Notiz; `geaendert` = das Paket wurde seit Beginn des Entwurfs anders gespeichert (ausdrücklich „trotzdem“).
  const [veroeff, setVeroeff] = useState<{ name: string; notiz: string; geaendert?: boolean; fehler?: string } | null>(null);
  const flaeche = useRef<FlaecheSteuerung>(null);
  const stand = useRef('');
  const aenderung = useRef(0), gesichert = useRef(0);
  const fassungRef = useRef<ProzessVorlage | null>(null);
  fassungRef.current = fassung;

  // Laden: die Fassung, an der die Werkstatt arbeitet (Entwurf, sonst das Paket), und ihr Stand.
  useEffect(() => {
    if (!geladen || daten) return;
    setDaten(geladen);
    setFassung(geladen.entwurf?.vorlage ?? geladen.paket);
    stand.current = geladen.arbeitsStand;
  }, [geladen, daten]);

  const bearbeiten = !!daten?.bearbeiten && !schmal;
  // E6 (22.10., Entscheidung „Am Handy Texte & Fristen ändern“): am Handy nur Texte, Fristen und Zuständige — über denselben Entwurf; Bauen bleibt am Rechner.
  const mobilDarf = !!daten?.bearbeiten && schmal;
  const [mobilWahl, setMobilWahl] = useState<string | null>(null);
  const bibliothek = useMemo(() => daten?.bibliothekAlle ?? daten?.bibliothek ?? [], [daten]);
  const ansicht = useMemo(() => (fassung ? paketAnsicht(fassung, bibliothek) : null), [fassung, bibliothek]);
  // Die Bahn „Mensch“ heißt im Paket „Team“: die zuständige Person des Mandats (wer das ist, steht am Mandat, nie im Paket).
  const lage = useMemo(() => {
    if (!ansicht) return null;
    const l = werkstattLage(ansicht.definition);
    return { ...l, bahnen: l.bahnen.map(b => (b.schluessel === 'mensch' ? { ...b, titel: 'Team' } : b)) };
  }, [ansicht]);
  const befundJe = useMemo(() => new Map((daten?.befunde ?? []).filter(b => b.knotenId && b.stufe !== 'hinweis').map(b => [b.knotenId!, b.stufe as 'fehler' | 'offen'] as const)), [daten]);
  const ohne = useMemo(() => new Set<string>(), []);

  // ── Speichern: EIN Weg, nacheinander; die Antwort ersetzt die Fassung nur, wenn seitdem nichts dazukam ──
  const sichern = useCallback(async (): Promise<boolean> => {
    const f = fassungRef.current;
    if (!f || aenderung.current === gesichert.current) return true;
    const nr = aenderung.current;
    setSpeicher({ art: 'speichert' });
    const r = await werkstattSenden(() => ({ aktion: 'paket-entwurf', paketId, stand: stand.current, vorlage: f }));
    const j = r.j as (Partial<PaketAntwort> & { ok?: boolean; fehler?: string; aktuell?: PaketAntwort }) | null;
    if (r.status === 200 && j?.ok && j.arbeitsStand) {
      stand.current = j.arbeitsStand;
      gesichert.current = nr;
      setDaten(d => (d ? { ...d, ...(j as PaketAntwort), bibliothekAlle: d.bibliothekAlle } : d));
      setSpeicher({ art: aenderung.current === nr ? 'gespeichert' : 'ausstehend' });
      return true;
    }
    if (r.status === 409 && j?.aktuell) { setKonflikt(j.aktuell); setSpeicher({ art: 'konflikt' }); return false; }
    if (r.status === 0 || r.status >= 500) { setSpeicher({ art: 'offline', text: 'Keine Verbindung — die Fassung bleibt hier und wird erneut gesendet.' }); return false; }
    setSpeicher({ art: 'fehler', text: String(j?.fehler ?? 'Nicht gespeichert.') });
    return false;
  }, [paketId]);
  useEffect(() => {
    if (speicher.art !== 'ausstehend' && speicher.art !== 'offline') return;
    const t = window.setTimeout(() => { void sichern(); }, speicher.art === 'offline' ? 5000 : 800);
    return () => window.clearTimeout(t);
  }, [speicher, fassung, sichern]);
  useEffect(() => {
    if (speicher.art === 'gespeichert') return;
    const vorher = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', vorher);
    return () => window.removeEventListener('beforeunload', vorher);
  }, [speicher]);

  const uebernehmen = useCallback((neu: ProzessVorlage, alt: ProzessVorlage) => {
    setZurueck(z => [...z.slice(-49), alt]); setVor([]);
    setFassung(neu); fassungRef.current = neu;
    aenderung.current++;
    setSpeicher(s => (s.art === 'konflikt' ? s : { art: 'ausstehend' }));
  }, []);
  const onOps = useCallback((ops: EditorOp[], mobil = false) => {
    const f = fassungRef.current;
    // Am Rechner jede Op des Editors; am Handy nur die Felder der Maske (Schritt/Phase — nie anlegen, verschieben, löschen).
    if (!f || !(mobil ? mobilDarf && ops.every(o => MOBIL_OPS.includes(o.op)) : bearbeiten)) return;
    const r = paketBearbeiten(f, bibliothek, ops, { person: 'werkstatt', jetzt: new Date().toISOString(), neueId: p => neueKennung(p) });
    if (!r.ok) { setAnsage(r.fehler); setSpeicher({ art: 'fehler', text: r.fehler }); return; }
    uebernehmen(r.vorlage, f);
    // Ein gelöschter Knoten ist nicht mehr wählbar.
    setAuswahl(a => a.filter(id => r.vorlage.knoten.some(k => k.id === id) || id.startsWith('ab~')));
  }, [bearbeiten, mobilDarf, bibliothek, uebernehmen]);
  const rueckgaengig = () => { const f = fassungRef.current; const a = zurueck.at(-1); if (!f || !a) return; setZurueck(z => z.slice(0, -1)); setVor(v => [...v, f]); setFassung(a); fassungRef.current = a; aenderung.current++; setSpeicher({ art: 'ausstehend' }); };
  const wiederholen = () => { const f = fassungRef.current; const a = vor.at(-1); if (!f || !a) return; setVor(v => v.slice(0, -1)); setZurueck(z => [...z, f]); setFassung(a); fassungRef.current = a; aenderung.current++; setSpeicher({ art: 'ausstehend' }); };
  const verwerfen = async () => {
    const r = await werkstattSenden(() => ({ aktion: 'paket-verwerfen', paketId }));
    const j = r.j as (PaketAntwort & { ok?: boolean; fehler?: string }) | null;
    if (r.status !== 200 || !j?.ok) { setSpeicher({ art: 'fehler', text: String(j?.fehler ?? 'Nicht verworfen.') }); return; }
    // Rückgängig holt den verworfenen Entwurf zurück (er wird dann wieder gespeichert).
    const f = fassungRef.current;
    setDaten(d => (d ? { ...d, ...j, bibliothekAlle: d.bibliothekAlle } : d)); setFassung(j.paket); fassungRef.current = j.paket; stand.current = j.arbeitsStand;
    if (f) setZurueck(z => [...z.slice(-49), f]);
    setVor([]); aenderung.current = gesichert.current; setSpeicher({ art: 'gespeichert' });
  };
  const andereUebernehmen = () => {
    if (!konflikt) return;
    const f = fassungRef.current;
    setDaten(d => (d ? { ...d, ...konflikt, bibliothekAlle: d.bibliothekAlle } : d));
    if (f) setZurueck(z => [...z, f]);
    setFassung(konflikt.entwurf?.vorlage ?? konflikt.paket); stand.current = konflikt.arbeitsStand;
    aenderung.current = gesichert.current; setKonflikt(null); setSpeicher({ art: 'gespeichert' });
  };
  const neuLaden = async () => {
    const j = await laden();
    if (j) setDaten(d => (d ? { ...d, ...j } : j));
  };
  const veroeffentlichen = async (trotzdem = false) => {
    if (!veroeff) return;
    if (aenderung.current !== gesichert.current && !(await sichern())) { setVeroeff(v => (v ? { ...v, fehler: 'Erst muss der Entwurf gespeichert sein.' } : v)); return; }
    const r = await werkstattSenden(() => ({ aktion: 'paket-veroeffentlichen', paketId, stand: stand.current, name: veroeff.name, notiz: veroeff.notiz, ...(trotzdem ? { trotzdem: true } : {}) }));
    const j = r.j as (PaketAntwort & { ok?: boolean; fehler?: string; paketGeaendert?: boolean; veroeffentlicht?: number }) | null;
    if (r.status === 409 && j?.paketGeaendert) { setVeroeff(v => (v ? { ...v, geaendert: true, fehler: undefined } : v)); return; }
    if (r.status !== 200 || !j?.ok) { setVeroeff(v => (v ? { ...v, fehler: String(j?.fehler ?? 'Nicht veröffentlicht.') } : v)); return; }
    setDaten(d => (d ? { ...d, ...j, bibliothekAlle: d.bibliothekAlle } : d)); setFassung(j.paket); fassungRef.current = j.paket; stand.current = j.arbeitsStand;
    setZurueck([]); setVor([]); aenderung.current = gesichert.current; setSpeicher({ art: 'gespeichert' }); setVeroeff(null);
    setAnsage(`Fassung ${j.veroeffentlicht ?? j.paket.fassung} veröffentlicht.`);
  };
  const meineSpeichern = () => { if (!konflikt) return; stand.current = konflikt.arbeitsStand; setKonflikt(null); aenderung.current++; setSpeicher({ art: 'ausstehend' }); };

  if (fehler && !daten) return <Hinweis art="achtung" titel="Das Paket ließ sich nicht laden" aktion={<Knopf leise onClick={() => void laden()}>Erneut laden</Knopf>}>{fehler}</Hinweis>;
  if (!daten || !fassung || !ansicht || !lage) return <p style={{ ...MIKRO, textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: TYP.bedien }}>Lädt …</p>;

  const d = ansicht.definition;
  const schritte = alleSchritte(d).filter(x => !ansicht.abstimmungen[x.schritt.id]).length;
  const bestaetigungen = Object.keys(ansicht.abstimmungen).length;
  const istEntwurf = !!daten.entwurf || speicher.art !== 'gespeichert';
  const fehlerBefunde = daten.befunde.filter(b => b.stufe === 'fehler');

  // Seitenfeld: ein Schritt, eine Phase (Rahmen oder ihre Bestätigung), sonst die Übersicht.
  const phaseVon = (pid: string): PanelPhase | null => {
    const k = fassung.knoten.find(x => x.id === pid);
    if (!k) return null;
    const ab = ansicht.info[abstimmungsKnoten(pid)];
    const fg = k.freigabe ? fassung.freigaben.find(f => f.id === k.freigabe) : undefined;
    return {
      art: 'phase', id: pid, titel: k.titel, kundeSichtbar: k.kundeSichtbar === true,
      schritte: alleSchritte(d).filter(x => x.phase.id === pid && !ansicht.abstimmungen[x.schritt.id]).length,
      ...(ab && fg ? { abstimmung: { titel: fg.titel, wer: fg.wer, anzeige: ab.titel } } : {}),
    };
  };
  const gewaehlt = auswahl.length === 1 ? auswahl[0] : undefined;
  const panel: PanelAuswahl | PanelPhase | null = gewaehlt?.startsWith('ab~') ? phaseVon(gewaehlt.slice(3))
    : gewaehlt && ansicht.info[gewaehlt] ? { art: 'schritt', info: ansicht.info[gewaehlt], phaseId: alleSchritte(d).find(x => x.schritt.id === gewaehlt)?.phase.id ?? '' }
      : rahmenWahl ? phaseVon(rahmenWahl) : null;

  const taste = (a: TastenAktion): boolean => {
    if (a.art === 'abbrechen') { if (auswahl.length || rahmenWahl) { setAuswahl([]); setRahmenWahl(null); return true; } return false; }
    if (bearbeiten && a.art === 'rueckgaengig') { rueckgaengig(); return true; }
    if (bearbeiten && a.art === 'wiederholen') { wiederholen(); return true; }
    if (bearbeiten && a.art === 'loeschen' && gewaehlt && !gewaehlt.startsWith('ab~')) { onOps([{ op: 'weg', id: gewaehlt }]); return true; }
    if (a.art !== 'waehlen') return false;
    if (!gewaehlt) { const erst = alleSchritte(d)[0]?.schritt.id; if (erst) { setAuswahl([erst]); flaeche.current?.zeige(erst); } return true; }
    const boxen = [...lage.knoten.values()].filter(k => !k.zu && k.id !== gewaehlt).map(k => ({ id: k.id, x: k.x, y: k.y, b: k.b, h: k.h }));
    const lk = lage.knoten.get(gewaehlt);
    const n = lk ? nachbar(lk, boxen, a.richtung) : null;
    if (n) { setAuswahl([n]); flaeche.current?.zeige(n); setAnsage(`„${d.knoten.find(k => k.id === n)?.titel ?? ''}“ gewählt.`); }
    return true;
  };

  const spFarbe = speicher.art === 'fehler' || speicher.art === 'konflikt' ? C.achtung : speicher.art === 'gespeichert' ? C.inkDim : C.aktiv;
  return (
    <div className="pw-werkstatt">
      <div className="pw-kopf">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Chip farbe={C.inkDim}>{`Paket des Fulfillments · Fassung ${daten.paket.fassung}`}</Chip>
          {istEntwurf && <Chip farbe={C.aktiv}>Entwurf · nicht veröffentlicht</Chip>}
          {fassung.zusatz && <Chip farbe={C.inkDim}>Zusatzmodul</Chip>}
          {daten.laufende > 0 && <Chip farbe={C.aktiv}>{daten.laufende === 1 ? '1 laufender Kunde' : `${daten.laufende} laufende Kunden`}</Chip>}
          {daten.produkte.length > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{`für ${daten.produkte.map(x => x.name).join(', ')}`}</span>}
          {(bearbeiten || mobilDarf) && <span role="status" style={{ fontSize: TYP.bedien, color: spFarbe }}>{daten.entwurf || speicher.art !== 'gespeichert' ? SPEICHER_TEXT[speicher.art] : 'Änderungen werden als Entwurf gespeichert'}</span>}
        </div>
        <div className="pw-werkzeuge" role="toolbar" aria-label={bearbeiten ? 'Paket bearbeiten' : 'Paket ansehen'}>
          {bearbeiten && <SymbolKnopf ariaLabel="Rückgängig (⌘Z)" aus={!zurueck.length} onClick={rueckgaengig}><Undo2 size={16} /></SymbolKnopf>}
          {bearbeiten && <SymbolKnopf ariaLabel="Wiederholen (⌘⇧Z)" aus={!vor.length} onClick={wiederholen}><Redo2 size={16} /></SymbolKnopf>}
          <SymbolKnopf ariaLabel="Raster an/aus" gedrueckt={raster} onClick={() => setRaster(r => !r)}><Grid3x3 size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Verkleinern" onClick={() => flaeche.current?.zoomen(0.8)}><Minus size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Vergrößern" onClick={() => flaeche.current?.zoomen(1.25)}><Plus size={16} /></SymbolKnopf>
          <SymbolKnopf ariaLabel="Alles zeigen" onClick={() => flaeche.current?.allesZeigen()}><Maximize2 size={16} /></SymbolKnopf>
          {(bearbeiten || mobilDarf) && daten.entwurf && <Knopf leise onClick={verwerfen} titel="Den Entwurf löschen — das Paket bleibt, wie es ist">Entwurf verwerfen</Knopf>}
          {(bearbeiten || mobilDarf) && istEntwurf && !veroeff && <Knopf onClick={() => setVeroeff({ name: '', notiz: '' })} titel="Der Entwurf wird die neue Fassung des Pakets — laufende Kunden übernehmen je Kunde per Klick">Veröffentlichen</Knopf>}
          {!bearbeiten && !schmal && <Knopf leise href={daten.editor} titel="Ohne Recht zum Bearbeiten: der Editor des Fulfillments zeigt dasselbe Paket">Im Fulfillment-Editor ansehen ›</Knopf>}
        </div>
      </div>
      {konflikt && (
        <Hinweis art="achtung" titel="Inzwischen hat jemand anders an diesem Paket gearbeitet" aktion={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}><Knopf onClick={meineSpeichern}>Meine Fassung speichern</Knopf><Knopf leise onClick={andereUebernehmen}>Andere Fassung übernehmen</Knopf></span>}>
          Deine Fassung ist nicht verloren — sie steht hier auf der Fläche. Speichern überschreibt die andere; Übernehmen holt die andere (Rückgängig holt deine zurück).
        </Hinweis>
      )}
      {veroeff && (
        <Hinweis art={veroeff.geaendert ? 'achtung' : 'info'} titel={veroeff.geaendert ? 'Das Paket wurde seit Beginn dieses Entwurfs anders gespeichert' : `Als Fassung ${daten.paket.fassung + 1} veröffentlichen`}
          aktion={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}>
            {veroeff.geaendert ? <Knopf onClick={() => veroeffentlichen(true)}>Trotzdem veröffentlichen</Knopf> : <Knopf onClick={() => veroeffentlichen()}>Veröffentlichen</Knopf>}
            <Knopf leise onClick={() => setVeroeff(null)}>Abbrechen</Knopf>
          </span>}>
          {veroeff.geaendert
            ? 'Veröffentlichen ersetzt die Änderungen, die seitdem im Paket gespeichert wurden (z. B. im alten Editor). Prüfe sie vorher im Fulfillment-Editor.'
            : 'Neue Fälle starten danach mit dieser Fassung. Laufende Kunden bleiben, wie sie sind — die Änderung übernehmt ihr je Kunde.'}
          <span style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <input aria-label="Name der Fassung" placeholder="Name (optional)" value={veroeff.name} maxLength={80} onChange={e => setVeroeff(v => (v ? { ...v, name: e.target.value } : v))} style={eingabeStil} />
            <input aria-label="Notiz zur Fassung" placeholder="Was hat sich geändert? (optional)" value={veroeff.notiz} maxLength={500} onChange={e => setVeroeff(v => (v ? { ...v, notiz: e.target.value } : v))} style={eingabeStil} />
          </span>
          {veroeff.fehler && <span style={{ display: 'block', color: C.kritisch, marginTop: 6 }}>{veroeff.fehler}</span>}
        </Hinweis>
      )}
      <PaketKunden kunden={daten.kunden ?? []} paketId={paketId} fassung={daten.paket.fassung} darf={bearbeiten} onNeu={neuLaden} />
      {daten.entwurf?.paketGeaendert && <Hinweis art="info" titel="Das Paket wurde seit Beginn dieses Entwurfs geändert">Beim Veröffentlichen wird verglichen — nichts geht still verloren.</Hinweis>}
      {(speicher.art === 'fehler' || speicher.art === 'offline') && speicher.text && <Hinweis art={speicher.art === 'fehler' ? 'kritisch' : 'achtung'}>{speicher.text}</Hinweis>}
      {fehlerBefunde.length > 0 && (
        <Hinweis art="achtung" titel="Das Paket trägt etwas, das der Fall nicht ausführt">
          {fehlerBefunde.slice(0, 5).map((b, i) => <span key={i} style={{ display: 'block' }}>{b.text}</span>)}
        </Hinweis>
      )}
      {schmal && (
        <MobilSchrittListe darf={mobilDarf} onBearbeiten={setMobilWahl}
          phasen={phasen(d).map(p => ({
            id: p.id, titel: p.titel, bearbeitbar: true,
            schritte: alleSchritte(d).filter(x => x.phase.id === p.id && !ansicht.abstimmungen[x.schritt.id]).map(x => ({ id: x.schritt.id, titel: x.schritt.titel, unter: paketUnterzeile(ansicht.info[x.schritt.id]) || undefined })),
          }))} />
      )}
      <div className={`pw-raster${schmal ? ' pw-raster-schmal' : ''}`}>
        <div className="pw-flaeche-rahmen">
          <WerkstattFlaeche ref={flaeche} d={d} lage={lage} szene={`${daten.paket.id}:${daten.paket.fassung}`} auswahl={auswahl} kanteWahl={null} rahmenWahl={rahmenWahl} andockWahl={null}
            probe={null} befundJe={befundJe} unterzeile={k => paketUnterzeile(ansicht.info[k.id])} mitSchloss={ohne} nurLesen raster={raster} handy={schmal}
            label={`Paket „${fassung.titel}“: ${schritte} Schritte in ${phasen(d).length} Phasen, ${bestaetigungen} Bestätigungen. Pfeile wählen einen Schritt${bearbeiten ? ', Entf löscht, ⌘Z macht rückgängig' : ''}.`}
            onAuswahl={ids => { setRahmenWahl(null); setAuswahl(ids.slice(-1)); }}
            onKante={leer} onRahmen={id => { setRahmenWahl(id); setAuswahl([]); }} onUnter={id => setAuswahl([id])}
            onZiehen={leer} onVerbinden={leer} onAnhaengen={leer} onZuklappen={leer} onTaste={taste} />
        </div>
        {!schmal && (
          <aside className="pw-panel" aria-label="Felder des Pakets">
            <PaketPanel fassung={fassung} bibliothek={bibliothek} bearbeiten={bearbeiten} neueId={() => neueKennung('fk')} auswahl={panel} onOps={onOps}
              uebersicht={{ phasen: phasen(d).length, schritte, bestaetigungen }} />
          </aside>
        )}
      </div>
      {mobilWahl && (() => {
        const k = fassung.knoten.find(x => x.id === mobilWahl);
        if (!k) return null;
        const art = phasen(d).some(p => p.id === mobilWahl) ? 'phase' as const : 'schritt' as const;
        return <MobilMaske titel={art === 'phase' ? `Phase „${k.titel}“` : `„${k.titel}“`} felder={paketMobilFelder(k, art)} onZu={() => setMobilWahl(null)}
          onSpeichern={w => { const ops = paketMobilOps(k.id, art, w); if (ops.length) onOps(ops, true); setMobilWahl(null); }} />;
      })()}
      {/* B3 (22.10.): die Begleit-Prozesse am Paket — angedockt über die Bedingungen ihres Auslösers; „+ Begleit-Prozess“ am gewählten Schritt bzw. der Phase. */}
      <PaketBegleitung paketId={paketId} begleitung={daten.begleitung ?? []} titelVon={id => fassung.knoten.find(k => k.id === id)?.titel ?? null}
        onZeigen={id => { if (phasen(d).some(p => p.id === id)) { setRahmenWahl(id); setAuswahl([]); } else { setRahmenWahl(null); setAuswahl([id]); } flaeche.current?.zeige(id); }}
        ziel={gewaehlt?.startsWith('ab~') ? gewaehlt.slice(3) : gewaehlt ?? rahmenWahl} darf={!schmal && !!daten.rechte?.entwurf} />
      <div aria-live="polite" className="pz-nur-vorlesen">{ansage}</div>
    </div>
  );
}
