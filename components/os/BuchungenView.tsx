'use client';

// ─── MAKE OS — Buchungen ────────────────────────────────────────────────────
// Was auf den Konten wirklich passiert ist. Filtern nach Monat und Kategorie,
// damit man Fragen beantworten kann wie „wofür ging im Juli das Geld drauf".
// 24.09.: auf das lebendige Muster umgezogen (Karten, Leuchtfarben, Listen).
// 08.10. (Aufräumen Etappe 2): keine eigene Seite mehr — Reiter „Buchungen“ unter Finanzen › Business (nur die Gesellschaften) bzw.
// unter Finanzen › Privat › Konten & Buchungen (die Privat-Einheiten, z. B. die Selbstständigkeit). /os/finanzen/buchungen leitet weiter.
// 02.11. (Buchhaltung, Kevin: „die komplette Buchhaltung sauber machen“): die Arbeitsliste — sortierbar, seitenweise (nie still gekürzt),
// Filter Gesellschaft · Konto · Monat/Zeitraum · Kategorie · „nicht zugeordnet“ · Suche, je Buchung Kategorie/Notiz/Rechnung/Mandat/Gesellschaft
// (PATCH mit Stand, 409 → aktuelle Fassung), Mehrfachauswahl für die Kategorie, „Zu prüfen“, Monatssummen, Regeln, Vorschläge, Paket, Export.
// Der Server filtert nach der Sicht des Bereichs (`?sicht=`) — Business bekommt nie eine private Buchung. Regeln rein in lib/finanzen/buchhaltung.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Zahl, Fortschritt, feld, auswahl, LEUCHT, Raster, Wahl, Segmente, Hinweis } from './ui';
import { KERN_EINHEITEN, istBusinessGesellschaft, gehoertZuPrivat } from '@/lib/einheiten';
import { WEG } from '@/lib/wege';
import { useBetreiber } from './useInhaber';
import { filtern, mitGegenbuchung, monatssummen, offenGruende, seiteVon, summen, OFFEN_TEXT, ZUORDNEN_TEXT, type BhBuchung, type OffenGrund } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import { zuPruefen } from '@/lib/finanzen/buchhaltung/pruefung';
import { zahlungVorschlaege } from '@/lib/finanzen/buchhaltung/zahlung-rechnung';
import type { TeilFelder } from '@/lib/finanzen/buchhaltung/teil';
import { buchungenLaden, lageLaden, mandateLaden, rechnungenLaden, teilSchicken, type Lage, type MandatWahl, type RechnungZeile } from './buchhaltung/daten';
import { BuchungBearbeiten } from './buchhaltung/BuchungBearbeiten';
import { Pruefen } from './buchhaltung/Pruefen';
import { RegelLernen, Werkzeuge } from './buchhaltung/Werkzeuge';

const geld: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 88 };
const tag: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, width: 64, flex: '0 0 auto' };

/**
 * Kevins Ansage: „Privat bleibt immer privat, die beiden Firmen kann man auch
 * mal zusammenfassen." Deshalb gibt es beides — die Firmen einzeln UND als eine
 * Auswahl „Geschäftlich".
 */
// Seit 28.09. die eine Einheitenliste (lib/einheiten.ts); seit 05.10. Geschäftlich = die Business-Gesellschaften (die Selbstständigkeit gehört zu Privat, eigene Pille bleibt).
type Ort = { id: string; label: string; trifft: (o?: string) => boolean };
const ORTE: Record<'business' | 'privat', Ort[]> = {
  business: [
    { id: 'geschaeft', label: 'Alle Gesellschaften', trifft: o => istBusinessGesellschaft(o) },
    ...KERN_EINHEITEN.filter(e => istBusinessGesellschaft(e.id)).map(e => ({ id: e.id, label: e.label, trifft: (o?: string) => o === e.id })),
  ],
  privat: [
    { id: 'alle', label: 'Alles', trifft: o => !o || gehoertZuPrivat(o) },
    ...KERN_EINHEITEN.filter(e => gehoertZuPrivat(e.id)).map(e => ({ id: e.id, label: e.label, trifft: (o?: string) => o === e.id })),
    { id: 'privat', label: 'Privat', trifft: o => !o || o === 'privat' },
  ],
};
/** Wohin eine Buchung dieses Bereichs umgehängt werden darf (Gesellschaft-Feld). */
const ZIEL_ORTE: Record<'business' | 'privat', string[]> = {
  business: KERN_EINHEITEN.filter(e => istBusinessGesellschaft(e.id)).map(e => e.id),
  privat: [...KERN_EINHEITEN.filter(e => gehoertZuPrivat(e.id)).map(e => e.id), 'privat'],
};

type Ansicht = 'liste' | 'pruefen' | 'monate';
/** Letzter Kalendertag eines Monats (YYYY-MM → YYYY-MM-DD). */
const monatsEnde = (m: string) => { const [j, mo] = m.split('-').map(Number); return `${m}-${String(new Date(Date.UTC(j, mo, 0)).getUTCDate()).padStart(2, '0')}`; };
type OffenWahl = '' | 'alle' | OffenGrund;

/** `bereich`: Business = nur die Gesellschaften, Privat = die Privat-Einheiten (und alte private Buchungen ohne Ort). */
export function BuchungenView({ bereich = 'business' }: { bereich?: 'business' | 'privat' } = {}) {
  const orte = ORTE[bereich];
  // „Altbestand des Finanz-Dashboards“ nur in der Betreiber-Instanz (17.10., Abnahme 3 · C4) — eine Kunden-Instanz hat keinen.
  const betreiber = useBetreiber() === true;
  const [roh, setRoh] = useState<BhBuchung[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [lage, setLage] = useState<Lage | null>(null);
  const [rechnungen, setRechnungen] = useState<RechnungZeile[]>([]);
  const [mandate, setMandate] = useState<MandatWahl[]>([]);
  const [ansicht, setAnsicht] = useState<Ansicht>('liste');
  const [monat, setMonat] = useState<string>('alle');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [kategorie, setKategorie] = useState<string>('alle');
  const [konto, setKonto] = useState('');
  const [offen, setOffen] = useState<OffenWahl>('');
  const [suche, setSuche] = useState('');
  const [ort, setOrt] = useState(orte[0].id);
  const [richtung, setRichtung] = useState<'auf' | 'ab'>('ab');
  const [seite, setSeite] = useState(1);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [sammelKat, setSammelKat] = useState('');
  const [bearbeiten, setBearbeiten] = useState<string | null>(null);
  const [lernen, setLernen] = useState<BhBuchung | null>(null);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  // Nur die Buchungen dieses Bereichs — Business sieht nie eine private (Kevin 08.10.: Business nie Privat; der Server filtert schon).
  const alle = useMemo(() => roh.filter(b => orte[0].trifft(b.ort)), [roh, orte]);

  const neuLaden = useCallback(async (satz?: string) => {
    const [b, l, r] = await Promise.all([buchungenLaden(bereich), lageLaden(bereich), rechnungenLaden(bereich)]);
    if (b) setRoh(b); else setFehler('Buchungen konnten nicht geladen werden — bitte neu laden.');
    setLage(l); setRechnungen(r); setGeladen(true);
    if (satz) setMeldung(satz);
  }, [bereich]);

  useEffect(() => {
    // Filter aus dem Link (?monat=YYYY-MM&kat=…&q=…&ort=kdc) — z. B. von einer Rechnung oder Kachel (26.09.).
    const u = new URLSearchParams(window.location.search);
    if (u.get('monat')) setMonat(u.get('monat')!);
    if (u.get('kat')) setKategorie(u.get('kat')!);
    if (u.get('q')) setSuche(u.get('q')!);
    if (u.get('ort') && orte.some(o => o.id === u.get('ort'))) setOrt(u.get('ort')!);
    if (u.get('pruefen') === '1') setAnsicht('pruefen');
    void neuLaden();
    void mandateLaden().then(setMandate);
  }, [orte, neuLaden]);

  // Geänderte Zeilen (mit neuem Stand) in den Bestand legen.
  const zeilenEin = useCallback((zeilen: BhBuchung[]) => {
    if (!zeilen.length) return;
    const neu = new Map(zeilen.map(z => [z.id, z]));
    setRoh(prev => prev.map(b => neu.get(b.id) ?? b));
  }, []);

  const teil = useCallback(async (ops: { b: BhBuchung; felder: TeilFelder }[]): Promise<boolean> => {
    if (!ops.length) return true;
    setFehler(''); setMeldung('');
    const r = await teilSchicken(bereich, ops.map(o => ({ id: o.b.id, stand: o.b.stand, felder: o.felder })));
    zeilenEin(r.zeilen);
    if (!r.ok) { setFehler(r.fehler); return false; }
    setMeldung(`${r.anzahl} ${r.anzahl === 1 ? 'Buchung' : 'Buchungen'} gespeichert.`);
    void lageLaden(bereich).then(l => { if (l) setLage(l); });
    return true;
  }, [bereich, zeilenEin]);

  const gegen = useMemo(() => mitGegenbuchung(alle), [alle]);
  const konten = useMemo(() => Array.from(new Set(alle.map(b => b.konto).filter((k): k is string => !!k))).sort(), [alle]);
  const monate = useMemo(() => Array.from(new Set(alle.map(b => b.datum.slice(0, 7)))).sort().reverse(), [alle]);
  const kategorien = useMemo(() => {
    const s = new Set<string>(lage?.kategorien ?? []);
    for (const b of alle) if (b.kategorie) s.add(b.kategorie);
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'de'));
  }, [alle, lage]);

  const ortFilter = orte.find(o => o.id === ort) ?? orte[0];
  const imOrt = useMemo(() => alle.filter(b => ortFilter.trifft(b.ort)), [alle, ortFilter]);
  const sichtbar = useMemo(() => filtern(imOrt, {
    ...(konto ? { konto } : {}), ...(monat !== 'alle' ? { monat } : {}), ...(von ? { von } : {}), ...(bis ? { bis } : {}),
    ...(kategorie !== 'alle' ? { kategorie } : {}), ...(offen ? { offen } : {}), ...(suche.trim() ? { suche: suche.trim() } : {}), richtung,
  }, gegen), [imOrt, konto, monat, von, bis, kategorie, offen, suche, richtung, gegen]);
  useEffect(() => { setSeite(1); setGewaehlt(new Set()); }, [ort, konto, monat, von, bis, kategorie, offen, suche, richtung]);

  const blatt = seiteVon(sichtbar, seite);
  const { einCent, ausCent } = summen(sichtbar);
  const saldo = (einCent - ausCent) / 100;
  const pruefAnzahl = useMemo(() => imOrt.filter(zuPruefen).length, [imOrt]);
  const offenAnzahl = useMemo(() => imOrt.filter(b => offenGruende(b, gegen).length).length, [imOrt, gegen]);
  const zahlungen = useMemo(() => zahlungVorschlaege(imOrt, rechnungen), [imOrt, rechnungen]);
  const rechnungTitel = useCallback((id: string) => { const r = rechnungen.find(x => x.id === id); return r ? [r.nummer, r.kunde].filter(Boolean).join(' · ') || 'Rechnung' : 'Rechnung'; }, [rechnungen]);
  const filterAusgabe = { orte: ortFilter.id === orte[0].id ? [] : [ortFilter.id], ...(von ? { von } : monat !== 'alle' ? { von: `${monat}-01` } : {}), ...(bis ? { bis } : monat !== 'alle' ? { bis: monatsEnde(monat) } : {}) };

  const nachKategorie = useMemo(() => {
    const m = new Map<string, number>();
    sichtbar.filter(b => b.betrag < 0).forEach(b => m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + Math.abs(b.betrag)));
    return Array.from(m.entries()).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s);
  }, [sichtbar]);

  const monatLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  const hat = sichtbar.length > 0;
  const alleAufSeite = blatt.zeilen.length > 0 && blatt.zeilen.every(b => gewaehlt.has(b.id));
  const umschalten = (id: string) => setGewaehlt(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <Segmente<Ansicht> liste={[
        { id: 'liste', label: 'Liste' },
        { id: 'pruefen', label: `Zu prüfen${pruefAnzahl ? ` (${pruefAnzahl})` : ''}` },
        { id: 'monate', label: 'Monatssummen' },
      ]} aktiv={ansicht} onWahl={setAnsicht} />

      {meldung && <Hinweis art="gut" rolle="status" aktion={<Knopf leise onClick={() => setMeldung('')}>OK</Knopf>}>{meldung}</Hinweis>}
      {fehler && <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => setFehler('')}>OK</Knopf>}>{fehler}</Hinweis>}
      {lernen && lage && <RegelLernen bereich={bereich} b={lernen} lage={lage} orte={ZIEL_ORTE[bereich]} onLage={setLage}
        onZeilen={(z, s) => { zeilenEin(z); setMeldung(s); }} onZu={() => setLernen(null)} />}

      {/* Filter */}
      <Karte i={0} ton={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld}>Saldo der Auswahl</Ueberschrift>
        <Zahl gross wert={hat ? `${saldo >= 0 ? '+' : ''}${eur(saldo)}` : undefined} farbe={saldo >= 0 ? LEUCHT.gut : LEUCHT.kritisch} label={hat ? `aus ${sichtbar.length} ${sichtbar.length === 1 ? 'Buchung' : 'Buchungen'}` : 'keine Buchung in dieser Auswahl'} />
        <div style={{ marginTop: 14 }}><Raster min={150}>
          <Zahl wert={hat ? `+${eur(einCent / 100)}` : undefined} farbe={LEUCHT.gut} label="reingekommen" />
          <Zahl wert={hat ? `−${eur(ausCent / 100)}` : undefined} farbe={LEUCHT.achtung} label="rausgegangen" />
          <Zahl wert={offenAnzahl ? `${offenAnzahl}` : undefined} farbe={LEUCHT.achtung} label="nicht zugeordnet" />
        </Raster></div>

        {/* Wo die Buchung hingehört — Privat getrennt, Firmen einzeln oder zusammen */}
        <div className="ui-pillen ui-pillen-einzeilig" style={{ marginTop: 18 }}>
          {orte.map(o => {
            const n = alle.filter(b => o.trifft(b.ort)).length;
            return <span key={o.id} style={!n && o.id !== orte[0].id ? { opacity: .5 } : undefined}><Wahl klein an={ort === o.id} onClick={() => setOrt(o.id)}>{o.label} <span style={{ opacity: .7, fontVariantNumeric: 'tabular-nums' }}>{n}</span></Wahl></span>;
          })}
        </div>
        <div className="ui-pillen ui-pillen-einzeilig" style={{ marginTop: 8 }}>
          <Wahl klein an={monat === 'alle'} onClick={() => setMonat('alle')}>alle Monate</Wahl>
          {monate.map(m => <Wahl key={m} klein an={monat === m} onClick={() => setMonat(m)}>{monatLabel(m)}</Wahl>)}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Buchungen durchsuchen …" aria-label="Buchungen durchsuchen" type="search" style={{ ...feld, flex: '1 1 220px' }} />
          <select value={kategorie} onChange={e => setKategorie(e.target.value)} aria-label="Kategorie" style={{ ...auswahl, flex: '0 1 200px' }}>
            <option value="alle">alle Kategorien</option>
            {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={offen} onChange={e => setOffen(e.target.value as OffenWahl)} aria-label="Zuordnung" style={{ ...auswahl, flex: '0 1 220px' }}>
            <option value="">zugeordnet und offen</option>
            <option value="alle">nicht zugeordnet (alle)</option>
            {(Object.keys(OFFEN_TEXT) as OffenGrund[]).map(g => <option key={g} value={g}>{OFFEN_TEXT[g]}</option>)}
          </select>
          {konten.length > 1 && <select value={konto} onChange={e => setKonto(e.target.value)} aria-label="Konto" style={{ ...auswahl, flex: '0 1 200px' }}>
            <option value="">alle Konten</option>
            {konten.map(k => <option key={k} value={k}>{k}</option>)}
          </select>}
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkLeise }}>von
            <input type="date" value={von} onChange={e => setVon(e.target.value)} aria-label="Zeitraum von" style={feld} />
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkLeise }}>bis
            <input type="date" value={bis} onChange={e => setBis(e.target.value)} aria-label="Zeitraum bis" style={feld} />
          </label>
        </div>
      </Karte>

      {ansicht === 'pruefen' && <Pruefen alle={imOrt} onTeil={teil} onAendern={b => { setAnsicht('liste'); setBearbeiten(b.id); setSuche(b.wer); }} />}

      {ansicht === 'monate' && <MonatsSummen liste={sichtbar} monatLabel={monatLabel} />}

      {ansicht === 'liste' && <>
        {/* Wohin es ging */}
        {!!nachKategorie.length && (
          <Karte i={1}>
            <Ueberschrift farbe={LEUCHT.achtung} rechts={kategorie !== 'alle' ? <Knopf leise onClick={() => setKategorie('alle')}>✕ Filter lösen</Knopf> : 'Klick filtert die Liste'}>Wohin es ging</Ueberschrift>
            <div style={{ display: 'grid', gap: 9 }}>
              {(() => {
                const max = Math.max(...nachKategorie.map(x => x.s), 1);
                return nachKategorie.slice(0, 12).map(x => {
                  const an = kategorie === x.k;
                  return (
                    <div key={x.k} onClick={() => setKategorie(an ? 'alle' : x.k)} className="fassbar"
                      style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,165px) 1fr 84px', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: kategorie === 'alle' || an ? 1 : 0.4 }}>
                      <span style={{ fontSize: TYP.bedien, color: an ? C.ink : C.inkDim, fontWeight: an ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.k}</span>
                      <Fortschritt anteil={x.s / max} farbe={an ? LEUCHT.geld : LEUCHT.achtung} />
                      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, textAlign: 'right' }}>{eur(x.s)}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </Karte>
        )}

        {/* Die Liste */}
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.puls} rechts={<Knopf leise onClick={() => setRichtung(r => (r === 'ab' ? 'auf' : 'ab'))}>{richtung === 'ab' ? 'Neueste zuerst ↓' : 'Älteste zuerst ↑'}</Knopf>}>
            {hat ? `Buchungen ${blatt.von}–${blatt.bis} von ${blatt.gesamt}` : 'Buchungen'}
          </Ueberschrift>
          {!!blatt.zeilen.length && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, minHeight: 44 }}>
                <input type="checkbox" checked={alleAufSeite} onChange={() => setGewaehlt(prev => { const n = new Set(prev); for (const b of blatt.zeilen) { if (alleAufSeite) n.delete(b.id); else n.add(b.id); } return n; })} />
                alle auf dieser Seite
              </label>
              {!!gewaehlt.size && <>
                <select value={sammelKat} onChange={e => setSammelKat(e.target.value)} aria-label="Kategorie für die Auswahl" style={{ ...auswahl, flex: '0 1 220px' }}>
                  <option value="">Kategorie wählen …</option>
                  {kategorien.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <Knopf aus={!sammelKat} onClick={async () => {
                  const ops = alle.filter(b => gewaehlt.has(b.id) && b.kategorie !== sammelKat).map(b => ({ b, felder: { kategorie: sammelKat } as TeilFelder }));
                  if (await teil(ops)) { setGewaehlt(new Set()); setSammelKat(''); }
                }}>{`Für ${gewaehlt.size} setzen`}</Knopf>
                <Knopf leise onClick={() => setGewaehlt(new Set())}>Auswahl leeren</Knopf>
              </>}
            </div>
          )}
          <Liste>
            {!geladen && <Leer>lädt …</Leer>}
            {geladen && !sichtbar.length && <Leer>{alle.length ? 'Kein Treffer in dieser Auswahl.' : 'Noch keine Buchungen übernommen.'}</Leer>}
            {blatt.zeilen.map(b => {
              const gruende = offenGruende(b, gegen);
              const offenHier = bearbeiten === b.id;
              return (
                <div key={b.id}>
                  <Zeile aktiv={offenHier} onClick={() => setBearbeiten(offenHier ? null : b.id)}
                    links={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={gewaehlt.has(b.id)} onClick={e => e.stopPropagation()} onChange={() => umschalten(b.id)} aria-label={`Buchung ${b.wer} vom ${b.datum} wählen`} />
                      <span style={tag}>{b.datum.slice(8)}.{b.datum.slice(5, 7)}.{b.datum.slice(2, 4)}</span>
                    </span>}
                    titel={b.wer} unter={[b.zweck, b.notiz].filter(Boolean).join(' · ') || undefined}
                    rechts={<>
                      {gruende.map(g => <Chip key={g} farbe={LEUCHT.achtung}>{OFFEN_TEXT[g]}</Chip>)}
                      {b.zuordnen && <Chip farbe={LEUCHT.achtung}>{ZUORDNEN_TEXT[b.zuordnen].split(' — ')[0]}</Chip>}
                      {b.rechnungId && <span onClick={e => e.stopPropagation()}><Link href={WEG.rechnung(b.rechnungId)} style={{ textDecoration: 'none' }}><Chip farbe={LEUCHT.gut}>Rechnung ›</Chip></Link></span>}
                      <Chip farbe={C.inkDim}>{b.kategorie || 'ohne Kategorie'}</Chip>
                      <span style={{ ...geld, color: b.betrag > 0 ? LEUCHT.gut : C.ink }}>{b.betrag > 0 ? '+' : '−'}{eur(Math.abs(b.betrag))}</span>
                    </>} />
                  {offenHier && lage && <BuchungBearbeiten b={b} kategorien={kategorien} orte={ZIEL_ORTE[bereich]} rechnungen={rechnungen} mandate={mandate} gegen={gegen}
                    onSpeichern={f => teil([{ b, felder: f }])} onRegel={async x => { setLernen(x); }} onZu={() => setBearbeiten(null)} />}
                </div>
              );
            })}
          </Liste>
          {blatt.seiten > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
              <Knopf leise aus={blatt.seite <= 1} onClick={() => setSeite(blatt.seite - 1)}>‹ Zurück</Knopf>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{`Seite ${blatt.seite} von ${blatt.seiten}`}</span>
              <Knopf leise aus={blatt.seite >= blatt.seiten} onClick={() => setSeite(blatt.seite + 1)}>Weiter ›</Knopf>
            </div>
          )}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 14, lineHeight: 1.6 }}>
            Buchungen kommen aus dem Beleg-Werkzeug (ZOE), aus bezahlten <Link href={WEG.rechnungen()} style={{ color: C.inkDim }}>Rechnungen</Link>{betreiber ? ' und aus dem Altbestand des Finanz-Dashboards.' : ' und aus euren Importen.'}
          </div>
        </Karte>

        {lage && <Werkzeuge bereich={bereich} lage={lage} alle={imOrt} zahlungen={zahlungen} rechnungTitel={rechnungTitel} filter={filterAusgabe}
          onLage={setLage} onZeilen={(z, s) => { zeilenEin(z); setMeldung(s); }} onTeil={teil} onNeuLaden={neuLaden} />}
      </>}
    </>
  );
}

/** Monatssummen je Kategorie (nur Anzeige, Ist aus den Buchungen der Auswahl). */
function MonatsSummen({ liste, monatLabel }: { liste: readonly BhBuchung[]; monatLabel: (m: string) => string }) {
  const { monate, zeilen } = monatssummen(liste);
  if (!zeilen.length) return <Karte i={1}><Leer symbol="∑">Keine Buchung in dieser Auswahl.</Leer></Karte>;
  const zelle: CSSProperties = { padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.linie}` };
  const zahl = (c: number) => (c ? `${c > 0 ? '+' : '−'}${eur(Math.abs(c) / 100)}` : '');
  return (
    <Karte i={1}>
      <Ueberschrift rechts="nur Anzeige">Monatssummen je Kategorie</Ueberschrift>
      <div className="ui-tabelle" tabIndex={0} role="region" aria-label="Monatssummen, Monate als Spalten — seitwärts wischbar" style={{ overflow: 'auto', maxHeight: '72vh' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: TYP.bedien, minWidth: '100%' }}>
          <thead><tr>
            <th style={{ ...zelle, textAlign: 'left', position: 'sticky', left: 0, background: C.flaeche }}>Kategorie</th>
            {monate.map(m => <th key={m} style={zelle}>{monatLabel(m)}</th>)}
            <th style={zelle}>Summe</th>
          </tr></thead>
          <tbody>
            {zeilen.map(z => (
              <tr key={z.kategorie}>
                <td style={{ ...zelle, textAlign: 'left', position: 'sticky', left: 0, background: C.flaeche, color: C.ink }}>{z.kategorie}</td>
                {monate.map(m => <td key={m} style={{ ...zelle, color: (z.je[m] ?? 0) > 0 ? LEUCHT.gut : C.inkDim }}>{zahl(z.je[m] ?? 0)}</td>)}
                <td style={{ ...zelle, fontWeight: 700, color: z.gesamt > 0 ? LEUCHT.gut : C.ink }}>{zahl(z.gesamt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Karte>
  );
}
