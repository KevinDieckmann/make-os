'use client';

// ─── Unternehmen › Gesellschafter — die Cap-Table (04.10.) ─────────────────────────────────────────────────────
// Klare Liste mit Nennbetrag und Anteil (Prozent aus den Nennbeträgen, größter Rest → Summe genau 100 %), ein schlichter
// Balken darüber, Summenprüfung gegen das gezeichnete Stammkapital. Neu eintragen = zwei Klicks, wenn das Stammkapital
// steht: wer (z. B. eine eigene Gesellschaft) wählen → „Eintragen“ (Nennbetrag ist mit dem freien Rest vorbelegt).
// Archiv = ausgeschieden (zählt nicht mehr), Löschen = Papierkorb 30 Tage — Baustein ZeileAktionen, Rückgängig 10 s.

import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT, TIEF } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Hinweis, Leer, Pillen, Punkt, Schalter, ZeileAktionen, useRueckgaengig, useRueckfrage, feld as feldStil } from '../ui';
import { anteile, centAus, EINLAGEN, type Bezug, type Einlage, type Gesellschafter } from '@/lib/gesellschaften/modell';
import { BezugWahl, Felder, Feldzeile, bezugName, centEingabe, centText, klein, tagText, type GAnzeige, type RegisterDaten, type useSchreiber } from './teile';

type Schreibe = ReturnType<typeof useSchreiber>['schreibe'];
/** Farben der Anteile (Zustandsfarben ausgenommen) — nur Token. */
const ANTEIL_FARBEN = [LEUCHT.planung, LEUCHT.business, LEUCHT.agenten, LEUCHT.geld, LEUCHT.beziehung, LEUCHT.schlaf];
const prozentText = (p: number) => `${p.toLocaleString('de-DE', { minimumFractionDigits: p % 1 ? 2 : 0, maximumFractionDigits: 2 })} %`;

export function GesellschafterReiter({ g, daten, schreibe }: { g: GAnzeige; daten: RegisterDaten; schreibe: Schreibe }) {
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const [form, setForm] = useState<Gesellschafter | 'neu' | null>(null);
  const a = anteile(g);
  const name = (b: Bezug) => bezugName(b, daten.namen);
  const alle = g.gesellschafter ?? [];
  const ausgeschieden = alle.filter(x => !x.geloeschtAm && x.ausgeschiedenAm);
  const korb = alle.filter(x => x.geloeschtAm);
  const rest = g.stammkapitalCent !== undefined ? Math.max(0, g.stammkapitalCent - a.summeCent) : undefined;

  const aktion = async (x: Gesellschafter, was: 'archivieren' | 'zurueckholen' | 'loeschen' | 'wiederherstellen' | 'endgueltig') => (await schreibe({ liste: 'gesellschafter', eintragId: x.id, aktion: was })).ok;
  const archivieren = async (x: Gesellschafter) => { if (await aktion(x, 'archivieren')) melden(`„${name(x.wer)}“ als ausgeschieden markiert`, () => void aktion(x, 'zurueckholen')); };
  const loeschen = async (x: Gesellschafter) => { if (await aktion(x, 'loeschen')) melden(`„${name(x.wer)}“ im Papierkorb`, () => void aktion(x, 'wiederherstellen')); };

  return (
    <>
      <Karte>
        <Ueberschrift rechts={!form && <Knopf leise onClick={() => setForm('neu')}>+ Gesellschafter</Knopf>}>Cap-Table</Ueberschrift>
        {a.zeilen.length > 0 && a.summeCent > 0 && (
          <div role="img" aria-label={`Anteile: ${a.zeilen.map(z => `${name(z.g.wer)} ${prozentText(z.prozent)}`).join(', ')}`} style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,.06)', marginBottom: 12 }}>
            {a.zeilen.map((z, i) => <span key={z.g.id} style={{ width: `${z.prozent}%`, background: TIEF.fuellung(ANTEIL_FARBEN[i % ANTEIL_FARBEN.length]), borderRight: i < a.zeilen.length - 1 ? `2px solid ${C.flaeche}` : undefined }} />)}
          </div>
        )}
        {!a.zeilen.length ? (
          <Leer aktion={!form ? <Knopf leise onClick={() => setForm('neu')}>Gesellschafter eintragen</Knopf> : undefined}>Noch keine Gesellschafter — wer hält die Anteile?</Leer>
        ) : (
          <Liste>
            {a.zeilen.map((z, i) => {
              const x = z.g;
              const unter = [centText(x.nennbetragCent), EINLAGEN.find(e => e.id === x.einlage)?.label + (x.einlage === 'teil' && x.eingezahltCent !== undefined ? ` (${centText(x.eingezahltCent)})` : '') + (x.einlageAm ? ` am ${tagText(x.einlageAm)}` : ''), x.ohneStimmrecht ? 'ohne Stimmrecht' : 'Stimmrecht', x.klauseln ? 'Klauseln' : undefined].filter(Boolean).join(' · ');
              return (
                <ZeileAktionen key={x.id} titel={name(x.wer)} onArchivieren={() => archivieren(x)} onLoeschen={() => loeschen(x)}>
                  <Zeile links={<Punkt farbe={ANTEIL_FARBEN[i % ANTEIL_FARBEN.length]} />} titel={name(x.wer)} unter={unter} onClick={() => setForm(x)}
                    rechts={<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: TYP.body }}>{prozentText(z.prozent)}</span>} />
                </ZeileAktionen>
              );
            })}
            <Zeile titel="Summe" unter={g.stammkapitalCent !== undefined ? `Stammkapital ${centText(g.stammkapitalCent)}` : 'Stammkapital noch nicht im Steckbrief'}
              rechts={<span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: TYP.body }}>{centText(a.summeCent)} · {prozentText(a.summeProzent)}</span>} />
          </Liste>
        )}
        {a.passtZumStammkapital === true && <div style={{ marginTop: 10 }}><Hinweis art="gut">Die Nennbeträge ergeben genau das Stammkapital.</Hinweis></div>}
        {a.hinweis && <div style={{ marginTop: 10 }}><Hinweis art="achtung">{a.hinweis}</Hinweis></div>}
      </Karte>
      {form && <GesellschafterForm key={form === 'neu' ? 'neu' : form.id} g={g} daten={daten} alt={form === 'neu' ? undefined : form} rest={rest} schreibe={schreibe} fertig={() => setForm(null)} />}
      {ausgeschieden.length > 0 && (
        <Karte flach>
          <Ueberschrift>Ausgeschieden</Ueberschrift>
          <Liste>
            {ausgeschieden.map(x => (
              <ZeileAktionen key={x.id} titel={name(x.wer)} archiviert onArchivieren={() => void aktion(x, 'zurueckholen')} onLoeschen={() => loeschen(x)}>
                <Zeile titel={name(x.wer)} unter={`${centText(x.nennbetragCent)} · ausgeschieden am ${tagText(x.ausgeschiedenAm)}`} />
              </ZeileAktionen>
            ))}
          </Liste>
        </Karte>
      )}
      {korb.length > 0 && <Papierkorb eintraege={korb.map(x => ({ id: x.id, titel: name(x.wer), geloeschtAm: x.geloeschtAm! }))} wiederherstellen={id => { const x = korb.find(y => y.id === id)!; void aktion(x, 'wiederherstellen'); }}
        endgueltig={id => { const x = korb.find(y => y.id === id)!; fragen({ titel: `„${name(x.wer)}“ endgültig löschen?`, text: 'Der Eintrag verschwindet aus der Cap-Table-Historie. Das lässt sich nicht rückgängig machen.', wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => aktion(x, 'endgueltig') }] }); }} />}
      {dialog}
      {hinweis}
    </>
  );
}

/** Papierkorb einer Liste (Gesellschafter, Beteiligungen, Verträge): Wiederherstellen oder — mit Rückfrage — endgültig. */
export function Papierkorb({ eintraege, wiederherstellen, endgueltig }: { eintraege: { id: string; titel: string; geloeschtAm: string }[]; wiederherstellen: (id: string) => void; endgueltig: (id: string) => void }) {
  return (
    <Karte flach>
      <Ueberschrift>Papierkorb</Ueberschrift>
      <div style={{ ...klein, marginBottom: 6 }}>Bleibt 30 Tage wiederherstellbar, danach räumt der Morgenlauf auf.</div>
      <Liste>
        {eintraege.map(e => (
          <Zeile key={e.id} titel={e.titel} unter={`gelöscht am ${tagText(e.geloeschtAm.slice(0, 10))}`}
            rechts={<span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}><Knopf leise onClick={() => wiederherstellen(e.id)}>Wiederherstellen</Knopf><Knopf leise onClick={() => endgueltig(e.id)}>Endgültig löschen</Knopf></span>} />
        ))}
      </Liste>
    </Karte>
  );
}

function GesellschafterForm({ g, daten, alt, rest, schreibe, fertig }: { g: GAnzeige; daten: RegisterDaten; alt?: Gesellschafter; rest?: number; schreibe: Schreibe; fertig: () => void }) {
  const [wer, setWer] = useState<Bezug | null>(alt?.wer ?? null);
  const [nennbetrag, setNennbetrag] = useState(alt ? centEingabe(alt.nennbetragCent) : rest ? centEingabe(rest) : '');
  const [einlage, setEinlage] = useState<Einlage>(alt?.einlage ?? 'nein');
  const [eingezahlt, setEingezahlt] = useState(centEingabe(alt?.eingezahltCent));
  const [einlageAm, setEinlageAm] = useState(alt?.einlageAm ?? '');
  const [eingetretenAm, setEingetretenAm] = useState(alt?.eingetretenAm ?? '');
  const [stimmrecht, setStimmrecht] = useState(!alt?.ohneStimmrecht);
  const [klauseln, setKlauseln] = useState(alt?.klauseln ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const betrag = centAus(nennbetrag);
  const speichern = async () => {
    setFehler(null);
    if (!wer) { setFehler('Bitte zuerst wählen, wer den Anteil hält.'); return; }
    const eintrag = { wer, nennbetragCent: nennbetrag, einlage, eingezahltCent: einlage === 'teil' ? eingezahlt : null, einlageAm: einlageAm || null, eingetretenAm: eingetretenAm || null, ohneStimmrecht: !stimmrecht, klauseln };
    const r = await schreibe({ liste: 'gesellschafter', eintrag, ...(alt ? { eintragId: alt.id } : {}) });
    if (r.ok) fertig(); else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  return (
    <Karte>
      <Ueberschrift>{alt ? 'Gesellschafter ändern' : 'Gesellschafter eintragen'}</Ueberschrift>
      <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 14 }}>
        <Feldzeile label="Wer hält den Anteil?"><BezugWahl daten={daten} wert={wer} ohne={[g.id]} onWahl={b => setWer(b)} /></Feldzeile>
        <Felder>
          <Feldzeile label="Nennbetrag (€)" fehler={betrag === 'fehler' ? 'Betrag nicht lesbar (z. B. 25.000).' : undefined}>
            <input value={nennbetrag} onChange={e => setNennbetrag(e.target.value)} inputMode="decimal" aria-label="Nennbetrag in Euro" placeholder="z. B. 25.000" style={feldStil} />
          </Feldzeile>
          <Feldzeile label="Eingetreten am"><input type="date" value={eingetretenAm} onChange={e => setEingetretenAm(e.target.value)} aria-label="Eingetreten am" style={feldStil} /></Feldzeile>
          {einlage !== 'nein' && <Feldzeile label="Einlage geleistet am"><input type="date" value={einlageAm} onChange={e => setEinlageAm(e.target.value)} aria-label="Einlage geleistet am" style={feldStil} /></Feldzeile>}
          {einlage === 'teil' && <Feldzeile label="Davon eingezahlt (€)"><input value={eingezahlt} onChange={e => setEingezahlt(e.target.value)} inputMode="decimal" aria-label="Eingezahlt in Euro" style={feldStil} /></Feldzeile>}
        </Felder>
        <Feldzeile label="Einlage"><Pillen liste={EINLAGEN.map(e => ({ id: e.id, label: e.label }))} aktiv={einlage} onWahl={setEinlage} /></Feldzeile>
        <Schalter an={stimmrecht} onChange={setStimmrecht}>Mit Stimmrecht</Schalter>
        <Feldzeile label="Klauseln (Vesting, Vorkaufsrecht, Drag-/Tag-along …)"><textarea value={klauseln} onChange={e => setKlauseln(e.target.value)} aria-label="Klauseln" rows={3} placeholder="frei, z. B. Vesting 4 Jahre, Cliff 12 Monate" style={{ ...feldStil, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>
        {rest !== undefined && !alt && <div style={klein}>Noch frei: {centText(rest)} vom Stammkapital.</div>}
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf typ="submit" aus={!wer || betrag === undefined || betrag === 'fehler'}>{alt ? 'Speichern' : 'Eintragen'}</Knopf>
          <Knopf leise onClick={fertig}>Abbrechen</Knopf>
        </div>
      </form>
    </Karte>
  );
}

