'use client';

// ─── Finanzen › Business › Rechnungen & Zahlungen · die Arbeitsfläche (31.10.) ───
// Kevin 31.10.: „Rechnungen & Zahlungen“ bekommt die Aufteilung wie Inbox/Kontakte/Firmen (DESIGN_STANDARD.md › Arbeitsfläche). Vorher hingen unter der
// Rechnungsliste Finanzmeeting, Jahresziel, Cash/Konten und Planposten, die Rechnung öffnete als Fenster. Jetzt:
//   · Kopf in EINER Zeile: „Rechnungen“ · offen/überfällig · ⋯ (Mahnstufen, Rechnungen vorbereiten) · „+ Rechnung schreiben“; daneben der Head of Finance.
//   · Suche + „Filter ▾“ (Status, Gesellschaft, Zuordnung) in EINER Zeile; davor der Umschalter Rechnungen · Zahlungen (Zahlungs-Prioritäten, `?z=`).
//   · Liste links (nach Zustand als Abschnitte), rechts die gewählte Rechnung (Editor bzw. Ansicht — senden, mahnen, stornieren wie bisher), ohne Auswahl
//     die Summen. Schmal: Liste ODER Rechnung mit „‹ Zurück“, Handy Seitenfluss.
// Adressen bleiben: `?re=`/`?r=` öffnen die Rechnung rechts, `?z=` die Zahlungen (WEG.rechnung, WEG.rechnungSchreiben, WEG.zahlung, WEG.rechnungen).
// Finanzmeeting, Jahresziel und Produkte stehen im Cockpit, Planposten und Merkposten unter Liquidität (FinanzplanungView `teil`).

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { euroCent } from '@/lib/crm/angebote';
import { RECHNUNGS_FILTER, rechnungsZustand, type RechnungsZustand } from '@/lib/finanzen/rechnung/uebersicht';
import { Arbeitsflaeche, FilterKnopf, FilterGruppe, ListenAbschnitt, Knopf, Hinweis, Leer, Liste, Pillen, Segmente, feld, useArbeitsflaeche } from '../ui';
import { FinanzplanungView } from '../FinanzplanungView';
import { RechnungEditor } from './Editor';
import {
  useRechnungenUebersicht, RechnungsSummen, MahnZeilen, RechnungZeile, RechnungenLeer, RechnungsEinstellungen, MahnTageFeld, rechnungTitel, gesKurz,
  ZUSTAND_FARBE, RECHNUNG_FEHLT, type RechnungenUebersicht,
} from './RechnungenKarte';
import type { RechnungMitFassung } from './daten';

type Ansicht = 'rechnungen' | 'zahlungen';
/** Abschnitte der Liste in der Reihenfolge der Übersicht (Überfälliges zuerst). */
const ABSCHNITTE: { id: string; titel: string; zustaende: RechnungsZustand[] }[] = [
  { id: 'ueberfaellig', titel: 'Überfällig', zustaende: ['ueberfaellig'] },
  { id: 'entwurf', titel: 'Entwürfe', zustaende: ['entwurf'] },
  { id: 'offen', titel: 'Offen', zustaende: ['offen'] },
  { id: 'bezahlt', titel: 'Bezahlt', zustaende: ['bezahlt'] },
  { id: 'storniert', titel: 'Storniert', zustaende: ['storniert', 'storno'] },
];
const STATUS = RECHNUNGS_FILTER.filter(f => f.id !== 'ohne-zuordnung');
/** Ab dieser Breite der Fläche stehen Liste und Rechnung nebeneinander — der Editor (Positionen, Vorschau im Layout des PDFs) braucht Platz. */
const ZWEI_AB_RECHNUNG = 920;

export function RechnungenFlaeche({ zahlungen, neben }: { /** Zahlungs-Prioritäten (gemeinsamer Finanz-Bestand) — nur mit Haushaltszugang. */ zahlungen: boolean; neben?: ReactNode }) {
  const u = useRechnungenUebersicht('business');
  const q = useSearchParams();
  const zielZ = q.get('z');
  const offenAdresse = q.get('re') ?? q.get('r');
  const [ansicht, setAnsicht] = useState<Ansicht>(zielZ && zahlungen ? 'zahlungen' : 'rechnungen');
  // Ein Link mit `?z=` (Zahlung) bzw. `?re=`/`?r=` (Rechnung) wählt den passenden Teil — auch, wenn nur die Adresse wechselt.
  useEffect(() => { if (zielZ && zahlungen) setAnsicht('zahlungen'); }, [zielZ, zahlungen]);
  useEffect(() => { if (offenAdresse) setAnsicht('rechnungen'); }, [offenAdresse]);

  const { daten, stand, summen, offenId, offen, meldung, setMeldung, liste, gezeigt, firmenInListe, filter, filterAuf, suche, sucheAuf, ges, setGes, ohneZuordnung, setOhneZuordnung, setAlle, neu } = u;
  if (daten.gesperrt) return null;
  const zahl = ansicht === 'rechnungen';

  const filterZahl = (filter !== 'alle' ? 1 : 0) + (ges ? 1 : 0) + (ohneZuordnung || filter === 'ohne-zuordnung' ? 1 : 0);
  const filterWeg = () => { filterAuf('alle'); setGes(null); setOhneZuordnung(false); };
  const chipWeg = (text: string, weg: () => void) => <button type="button" className="af-chip-weg fassbar" onClick={weg} title="Filter aufheben">{text} <span aria-hidden>✕</span></button>;
  const statusLabel = STATUS.find(f => f.id === filter)?.label;

  const umschalter = zahlungen
    ? <Segmente<Ansicht> liste={[{ id: 'rechnungen', label: 'Rechnungen' }, { id: 'zahlungen', label: 'Zahlungen' }]} aktiv={ansicht} onWahl={setAnsicht} />
    : null;
  const leiste = zahl ? (
    <>
      {umschalter}
      <input value={suche} onChange={e => sucheAuf(e.target.value)} placeholder="Suchen: Kunde, Nummer …" aria-label="Rechnungen durchsuchen: Kunde, Firma, Person, Nummer, Titel" type="search" className="af-suche" style={{ ...feld, padding: '9px 13px', fontSize: TYP.bedien, minHeight: 40 }} />
      <FilterKnopf aktiv={filterZahl} onZuruecksetzen={filterWeg}>
        <FilterGruppe titel="Status"><Pillen liste={STATUS} aktiv={filter === 'ohne-zuordnung' ? 'alle' : filter} onWahl={filterAuf} /></FilterGruppe>
        {firmenInListe.length > 1 && (
          <FilterGruppe titel="Gesellschaft">
            <Pillen<string> liste={[{ id: '', label: 'Alle Gesellschaften' }, ...firmenInListe.map(id => ({ id, label: gesKurz(id) }))]} aktiv={ges ?? ''} onWahl={id => { setGes(id || null); setAlle(false); }} />
          </FilterGruppe>
        )}
        <FilterGruppe titel="Zuordnung">
          <Pillen<'alle' | 'ohne'> liste={[{ id: 'alle', label: 'Alle' }, { id: 'ohne', label: 'Ohne Zuordnung' }]} aktiv={ohneZuordnung || filter === 'ohne-zuordnung' ? 'ohne' : 'alle'}
            onWahl={id => { setOhneZuordnung(id === 'ohne'); if (filter === 'ohne-zuordnung') filterAuf('alle'); setAlle(false); }} />
        </FilterGruppe>
      </FilterKnopf>
      {filter !== 'alle' && filter !== 'ohne-zuordnung' && chipWeg(statusLabel ?? 'Status', () => filterAuf('alle'))}
      {ges && chipWeg(gesKurz(ges), () => setGes(null))}
      {(ohneZuordnung || filter === 'ohne-zuordnung') && chipWeg('Ohne Zuordnung', () => { setOhneZuordnung(false); if (filter === 'ohne-zuordnung') filterAuf('alle'); })}
    </>
  ) : umschalter;

  const hinweise = (meldung || daten.fehler || u.tageOffen) ? (
    <>
      {meldung && <Hinweis art="achtung" rolle="status" aktion={<Knopf leise onClick={() => setMeldung(null)}>ok</Knopf>}>{meldung}</Hinweis>}
      {daten.fehler && <Hinweis art="kritisch" rolle="alert">{daten.fehler}</Hinweis>}
      {u.tageOffen && <Hinweis art="info">Mahnstufen in Tagen nach Fälligkeit: <MahnTageFeld tage={u.tage} setTage={u.setTage} speichern={u.tageSpeichern} abbrechen={() => u.setTageOffen(false)} /></Hinweis>}
    </>
  ) : undefined;

  const voll = stand?.sicht === 'privat';
  const mehr = stand && voll ? (
    <>
      <Knopf leise onClick={u.tageBearbeiten}>Mahnstufen ändern</Knopf>
      {typeof stand.vorbereiten === 'boolean' && <Knopf leise onClick={() => u.vorbereitenUmschalten(!stand.vorbereiten)}>{stand.vorbereiten ? 'Rechnungen vorbereiten ausschalten' : 'Rechnungen vorbereiten einschalten'}</Knopf>}
    </>
  ) : undefined;

  const zaehler = !stand ? undefined : (
    <span>
      {summen.offen ? <><b style={{ color: C.ink, fontWeight: 600 }}>{`${summen.offen} offen`}</b> · {euroCent(summen.offenCent)}</> : 'Nichts offen'}
      {summen.ueberfaellig ? <> · <span style={{ color: LEUCHT.kritisch }}>{`${summen.ueberfaellig} überfällig`}</span></> : null}
      {summen.entwuerfe ? ` · ${summen.entwuerfe} ${summen.entwuerfe === 1 ? 'Entwurf' : 'Entwürfe'}` : ''}
    </span>
  );

  // Die Liste: fällige Mahnstufen oben, dann die Rechnungen nach Zustand — jede Gruppe ein Abschnitt EINER Liste.
  const rechnungsListe = (
    <div style={{ paddingBottom: 12 }}>
      {!stand ? <Leer>lade …</Leer> : <>
        {stand.mahnvorschlaege.length > 0 && (
          <ListenAbschnitt id="mahnung" titel="Mahnstufe dran · nur Vorschlag" farbe={LEUCHT.achtung} rechts={String(stand.mahnvorschlaege.length)}>
            <MahnZeilen u={u} />
          </ListenAbschnitt>
        )}
        {ABSCHNITTE.map(a => {
          const zeilen = gezeigt.filter(r => a.zustaende.includes(rechnungsZustand(r, u.heute)));
          if (!zeilen.length) return null;
          const gesamt = liste.filter(r => a.zustaende.includes(rechnungsZustand(r, u.heute))).length;
          return (
            <ListenAbschnitt key={a.id} id={a.id} titel={a.titel} farbe={ZUSTAND_FARBE[a.zustaende[0]]} rechts={String(gesamt)}>
              <Liste>{zeilen.map(r => <RechnungZeile key={r.id} u={u} r={r} kompakt />)}</Liste>
            </ListenAbschnitt>
          );
        })}
        {!gezeigt.length && <div style={{ paddingTop: 12 }}><RechnungenLeer u={u} /></div>}
        {liste.length > gezeigt.length && <div style={{ marginTop: 8 }}><Knopf leise onClick={() => setAlle(true)}>{`Weitere ${liste.length - gezeigt.length} zeigen`}</Knopf></div>}
      </>}
    </div>
  );

  // Rechts ohne Auswahl: die Summen (jede filtert die Liste) und die Stellschrauben; in EINER Spalte nur die Summen über der Liste.
  const summenSeite = (zwei: boolean) => !stand ? null : (
    <div style={{ display: 'grid', gap: 12, paddingBottom: zwei ? 12 : 4 }}>
      <RechnungsSummen u={u} min={zwei ? 170 : 140} />
      {zwei && <RechnungsEinstellungen u={u} mitKnoepfen={false} />}
    </div>
  );

  const detail = !zahl || !offenId ? null
    : offen ? <RechnungDetail u={u} r={offen} />
    : stand && !stand.ort ? <div style={{ display: 'grid', gap: 12 }}><DetailKopf titel="Rechnung" onZu={u.schliessen} /><Hinweis art="info">{RECHNUNG_FEHLT}</Hinweis></div>
    : null;

  return (
    <Arbeitsflaeche titel="Rechnungen" label="Rechnungen & Zahlungen" zweiAb={ZWEI_AB_RECHNUNG}
      zaehler={zaehler} neben={neben} mehr={mehr}
      haupt={<Knopf haupt onClick={neu}>+ Rechnung schreiben</Knopf>}
      leiste={leiste} hinweise={hinweise}
      liste={zahl ? rechnungsListe : <FinanzplanungView teil="zahlungen" />}
      detail={detail} detailKennung={offenId}
      leer={zahl ? (st => summenSeite(st.zwei)) : undefined} leerOben={zahl} />
  );
}

/** Kopf über der Rechnung rechts: „‹ Zurück“ nur in EINER Spalte, sonst „Schließen“. */
function DetailKopf({ titel, onZu }: { titel: ReactNode; onZu: () => void }) {
  const f = useArbeitsflaeche();
  const nebeneinander = !!f?.zwei;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
      {!nebeneinander && <Knopf leise onClick={onZu}>‹ Zurück</Knopf>}
      <div style={{ fontFamily: SCHRIFT.display, fontSize: 18, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0 }}>{titel}</div>
      {nebeneinander && <Knopf leise onClick={onZu} ariaLabel="Rechnung schließen">Schließen</Knopf>}
    </div>
  );
}

/** Die gewählte Rechnung rechts — derselbe Editor wie im Fenster (Entwurf bearbeiten, gestellte ansehen, senden, mahnen, stornieren). */
function RechnungDetail({ u, r }: { u: RechnungenUebersicht; r: RechnungMitFassung }) {
  return (
    <div style={{ display: 'grid', gap: 12, paddingBottom: 16, minWidth: 0 }} data-rechnung="detail">
      <DetailKopf titel={rechnungTitel(r)} onZu={u.schliessen} />
      <RechnungEditor key={r.id} start={r} daten={u.daten} onZu={u.schliessen} onOeffnen={u.oeffnen} />
    </div>
  );
}
