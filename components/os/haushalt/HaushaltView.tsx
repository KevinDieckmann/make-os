'use client';

// ─── MAKE OS — Finanzen · Privat (Haushaltsfinanzen) ────────────────────────
// Malins Finanz-Cockpit „MAKE.ORGA“, aufgegangen in MAKE OS (24.09.): ihr
// Datenmodell, ihre Fachlogik, ihre Kennzahlen — im Design von MAKE OS.
// Reihenfolge der Reiter nach Nutzen, wie sie es vorgeschlagen hat.
// Nur für Personen, denen der Inhaber einen Haushalt zugeordnet hat.
// 08.10. (Aufräumen Etappe 2): keine eigene Reiterleiste mehr — die Übersicht ist Finanzen › Privat › Überblick, die übrigen
// Reiter sind Ebene 2 unter „Konten & Buchungen“ (lib/finanzen/navigation.ts, Pillen in FinanzenView).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP, RAND } from '@/lib/make-one/design';
import { katNamen } from '@/lib/finanzen/haushalt/einordnung';
import { heuteBerlin, tageZwischen, datumDe } from '@/lib/finanzen/haushalt/monat';
import { Karte, Leer, Knopf, LEUCHT, FlussKarte } from '../ui';
import { HAUSHALT_UNTER } from '@/lib/finanzen/navigation';
import { useHaushalt, Meldungen } from './gemeinsam';
import { Uebersicht } from './Uebersicht';
import { Buchungen } from './Buchungen';
import { Einnahmen } from './Einnahmen';
import { Analyse } from './Analyse';
import { Fixkosten } from './Fixkosten';
import { IstSoll } from './IstSoll';
import { Schulden } from './Schulden';
import { ImportDialog } from './Import';
import { UmzugDialog } from './Umzug';
import { PrueflisteDialog } from './Pruefliste';
import { KategorienDialog } from './Kategorien';
import { StammdatenDialog } from './Stammdaten';
import { PrivatIndex } from '../privat/PrivatIndex';
import { KontenKarte } from '../konten/KontenKarte';

type Reiter = 'uebersicht' | typeof HAUSHALT_UNTER[number]['id'];

/** `ansicht`: Überblick (Privat-Index, Für dich, Übersicht) oder Konten & Buchungen (`reiter` = Ebene 2, Werkzeuge oben). */
export function HaushaltView({ ansicht, reiter }: { ansicht: 'uebersicht' | 'konten'; reiter: string | null }) {
  const { daten: h, kein, laden, patch, patchMitFehler, aktion, melde, meldungen, weg } = useHaushalt();
  const [importAuf, setImportAuf] = useState(false);
  const [umzugAuf, setUmzugAuf] = useState(false);
  const [pruefAuf, setPruefAuf] = useState(false);
  const [pruefAnzahl, setPruefAnzahl] = useState(0);
  const [katAuf, setKatAuf] = useState(false);
  const [stammAuf, setStammAuf] = useState(false);
  useEffect(() => { fetch('/api/haushalt/pruefliste').then(r => r.json()).then(d => setPruefAnzahl(d.ok ? d.posten.length : 0)).catch(() => {}); }, [h]);
  const katName = useMemo(() => (h ? katNamen(h.stamm) : () => ''), [h]);
  const aktiv: Reiter = ansicht === 'uebersicht' ? 'uebersicht' : HAUSHALT_UNTER.find(r => r.id === reiter)?.id ?? 'buchungen';

  if (kein) return <Karte i={1}><Leer>{kein}</Leer></Karte>;
  if (!h) return <Karte i={1}><Leer>Lade eure Finanzen …</Leer></Karte>;

  const juengste = h.buchungen.reduce((m, b) => (b.datum > m ? b.datum : m), '');
  const alt = juengste ? tageZwischen(juengste, heuteBerlin()) : null;
  const leer = !h.buchungen.length && !h.stamm.konten.length;

  return (
    <>
      {/* Stand und Werkzeuge nur unter Konten & Buchungen — am Handy brechen sie um, nichts schiebt die Seite breiter. */}
      {ansicht === 'konten' && <div className="os-auf" style={{ display: 'flex', gap: '8px 12px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', minWidth: 0, fontSize: TYP.bedien, color: C.inkDim }}>
        {juengste && <span style={{ color: alt !== null && alt > 40 ? LEUCHT.achtung : C.inkDim }}>Letzte Buchung {datumDe(juengste)}</span>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0, marginLeft: 'auto' }}>
          {pruefAnzahl > 0 && <Knopf leise farbe={LEUCHT.achtung} onClick={() => setPruefAuf(true)} titel="Private Einträge, die noch in den Business-Speichern stehen">Aufräumen ({pruefAnzahl})</Knopf>}
          <Knopf leise onClick={() => setStammAuf(true)} titel="Konten, Kategorien und Regeln anlegen, ändern, löschen">Konten &amp; Kategorien</Knopf>
          <Knopf leise onClick={() => setUmzugAuf(true)} titel="Probelauf und Übernahme aus Malins Supabase">{h.meta.umzug ? `Aus Malins Cockpit (${datumDe(h.meta.umzug.zeit.slice(0, 10))})` : 'Aus Malins Cockpit'}</Knopf>
          <a href="/api/haushalt/sicherung" className="ui-knopf fassbar" style={{ border: `1px solid ${RAND.stark}`, background: 'rgba(255,255,255,.05)', color: C.ink }} title="Alle Haushaltsdaten als JSON — im Format von Malins Sicherung">Sicherung ↓</a>
          {!leer && <Knopf farbe={LEUCHT.geld} onClick={() => setImportAuf(true)}>Kontoauszug einlesen</Knopf>}
        </div>
      </div>}
      {/* Konten-Register (08.10., R4 „Haushalt führt das Ist“): eure Konten mit Stand und Datum — die Finanzplanung liest daraus. */}
      {ansicht === 'konten' && aktiv === 'buchungen' && <KontenKarte bereich="privat" i={1} />}
      {leer ? (
        <Karte i={1} akzent={LEUCHT.geld}>
          <Leer>Noch keine Daten in diesem Haushalt. Der Umzug aus Malins Cockpit füllt ihn: erst ein Probelauf mit Abgleich, dann die Übernahme.</Leer>
          <Knopf farbe={LEUCHT.geld} onClick={() => setUmzugAuf(true)}>Umzug aus Malins Cockpit</Knopf>
        </Karte>
      ) : (
        <>
          {/* Privat-Index (25.09.): oben auf der Übersicht — dieselbe Logik wie der Business-Index. */}
          {aktiv === 'uebersicht' && <PrivatIndex stand={h} />}
          {/* Überblick „Für dich“ (04.10. abends): Ist der letzten 3 Monate → heute → Prognose aus echten Daten; serverseitig gefiltert (FlussKarte, /api/fluss). */}
          {aktiv === 'uebersicht' && <FlussKarte bereich="finanzen-privat" farbe={LEUCHT.geld} i={1} />}
          {aktiv === 'uebersicht' && <Uebersicht h={h} katName={katName} />}
          {aktiv === 'buchungen' && <Buchungen h={h} katName={katName} patch={patch} aktion={aktion} melde={melde} laden={laden} onImport={() => setImportAuf(true)} />}
          {aktiv === 'einnahmen' && <Einnahmen h={h} katName={katName} patch={patch} aktion={aktion} melde={melde} laden={laden} />}
          {aktiv === 'analyse' && <Analyse h={h} katName={katName} />}
          {aktiv === 'fixkosten' && <Fixkosten h={h} katName={katName} patch={patch} aktion={aktion} melde={melde} laden={laden} />}
          {aktiv === 'plan' && <IstSoll h={h} katName={katName} patch={patch} melde={melde} />}
          {aktiv === 'schulden' && <Schulden h={h} patch={patch} patchMitFehler={patchMitFehler} melde={melde} />}
        </>
      )}
      {katAuf && <KategorienDialog aktion={aktion} laden={laden} melde={melde} onZu={() => setKatAuf(false)} />}
      {stammAuf && <StammdatenDialog h={h} katName={katName} patch={patch} onZusammenlegen={() => { setStammAuf(false); setKatAuf(true); }} onZu={() => setStammAuf(false)} />}
      {pruefAuf && <PrueflisteDialog onZu={() => setPruefAuf(false)} laden={laden} melde={melde} />}
      {umzugAuf && <UmzugDialog onZu={() => setUmzugAuf(false)} laden={laden} melde={melde} />}
      {importAuf && <ImportDialog h={h} aktion={aktion} laden={laden} melde={melde} onZu={() => setImportAuf(false)} />}
      <Meldungen liste={meldungen} weg={weg} />
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, textAlign: 'center', marginTop: 4 }}>Privat · nur für euren Haushalt sichtbar</div>
    </>
  );
}
