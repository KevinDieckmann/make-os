'use client';

// ─── MAKE OS — Zahlen · Privat (Haushaltsfinanzen) ──────────────────────────
// Malins Finanz-Cockpit „MAKE.ORGA“, aufgegangen in MAKE OS (24.09.): ihr
// Datenmodell, ihre Fachlogik, ihre Kennzahlen — im Design von MAKE OS.
// Reihenfolge der Reiter nach Nutzen, wie sie es vorgeschlagen hat.
// Nur für Personen, denen der Inhaber einen Haushalt zugeordnet hat.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { katNamen } from '@/lib/finanzen/haushalt/einordnung';
import { heuteBerlin, tageZwischen, datumDe } from '@/lib/finanzen/haushalt/monat';
import { Karte, Leer, Knopf, Segmente, LEUCHT } from '../schlank';
import { useHaushalt, Meldungen } from './gemeinsam';
import { Uebersicht } from './Uebersicht';
import { Buchungen } from './Buchungen';
import { Einnahmen } from './Einnahmen';
import { Analyse } from './Analyse';
import { Fixkosten } from './Fixkosten';
import { IstSoll } from './IstSoll';
import { Schulden } from './Schulden';
import { ImportDialog } from './Import';

type Reiter = 'uebersicht' | 'buchungen' | 'einnahmen' | 'analyse' | 'fixkosten' | 'plan' | 'schulden';
const REITER: { id: Reiter; label: string }[] = [
  { id: 'uebersicht', label: 'Übersicht' }, { id: 'buchungen', label: 'Buchungen' }, { id: 'einnahmen', label: 'Einnahmen' },
  { id: 'analyse', label: 'Analyse' }, { id: 'fixkosten', label: 'Fixkosten & Budget' }, { id: 'plan', label: 'Ist gegen Soll' }, { id: 'schulden', label: 'Schulden & Rechnungen' },
];

export function HaushaltView({ reiter, onReiter }: { reiter: string | null; onReiter: (r: string) => void }) {
  const { daten: h, kein, laden, patch, aktion, melde, meldungen, weg } = useHaushalt();
  const [importAuf, setImportAuf] = useState(false);
  const katName = useMemo(() => (h ? katNamen(h.stamm) : () => ''), [h]);
  const aktiv = (REITER.find(r => r.id === reiter)?.id ?? 'uebersicht') as Reiter;

  if (kein) return <Karte i={1}><Leer>{kein}</Leer></Karte>;
  if (!h) return <Karte i={1}><Leer>Lade eure Finanzen …</Leer></Karte>;

  const juengste = h.buchungen.reduce((m, b) => (b.datum > m ? b.datum : m), '');
  const alt = juengste ? tageZwischen(juengste, heuteBerlin()) : null;
  const leer = !h.buchungen.length && !h.stamm.konten.length;

  return (
    <>
      <div className="os-auf" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}><Segmente liste={REITER} aktiv={aktiv} onWahl={onReiter} /></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: C.inkLeise }}>
          {juengste && <span style={{ color: alt !== null && alt > 40 ? LEUCHT.achtung : C.inkLeise }}>Letzte Buchung {datumDe(juengste)}</span>}
          <a href="/api/haushalt/sicherung" style={{ color: C.inkDim, textDecoration: 'none' }} title="Alle Haushaltsdaten als JSON — im Format von Malins Sicherung">Sicherung ↓</a>
          {!leer && <Knopf farbe={LEUCHT.geld} onClick={() => setImportAuf(true)}>Kontoauszug einlesen</Knopf>}
        </div>
      </div>
      {leer ? (
        <Karte i={1}><Leer>Noch keine Daten in diesem Haushalt. Der Umzug aus Malins Cockpit füllt ihn — bis dahin bleibt er leer.</Leer></Karte>
      ) : (
        <>
          {aktiv === 'uebersicht' && <Uebersicht h={h} katName={katName} />}
          {aktiv === 'buchungen' && <Buchungen h={h} katName={katName} patch={patch} aktion={aktion} melde={melde} laden={laden} onImport={() => setImportAuf(true)} />}
          {aktiv === 'einnahmen' && <Einnahmen h={h} katName={katName} patch={patch} aktion={aktion} melde={melde} laden={laden} />}
          {aktiv === 'analyse' && <Analyse h={h} katName={katName} />}
          {aktiv === 'fixkosten' && <Fixkosten h={h} katName={katName} patch={patch} aktion={aktion} melde={melde} laden={laden} />}
          {aktiv === 'plan' && <IstSoll h={h} katName={katName} patch={patch} melde={melde} />}
          {aktiv === 'schulden' && <Schulden h={h} patch={patch} melde={melde} />}
        </>
      )}
      {importAuf && <ImportDialog h={h} aktion={aktion} laden={laden} melde={melde} onZu={() => setImportAuf(false)} />}
      <Meldungen liste={meldungen} weg={weg} />
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, textAlign: 'center', marginTop: 4 }}>Privat · nur für euren Haushalt sichtbar</div>
    </>
  );
}
