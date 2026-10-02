'use client';

// ─── Finanzplanung jetzt — das Business-Blatt je Gesellschaft ────────────────
// Kevin 02.10.: „Businessplanung fertig“ — je Gesellschaft (Namen aus lib/einheiten.ts) ein vollständiges Blatt:
// Kacheln (Umsatz, Kosten, Ergebnis vor und nach Steuern, Break-even, Runway) · Produkte (Preis, Anzahl, Start, Laufzeit —
// frei anlegbar, Vorlagen ohne Preis) · Kosten (Personal, Software, Miete, Raten, Sonstiges) · das Blatt je Monat
// (Zelle anklicken → ändern) · „Welche Steuern gelten?“ · die Annahmen dieser Gesellschaft.
// Gerechnet wird im Rechenkern; die Blatt-Kennzahlen kommen aus lib/finanzen/geschaeft.ts. Steuern: Hinweis, keine Steuerberatung.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT } from '../schlank';
import { finanzOrtName, type Gesellschaftskennung } from '@/lib/einheiten';
import { monatLabel, neueKennung, prozent } from '@/lib/finanzen/plan/hilfen';
import { wert } from '@/lib/finanzen/rechenkern';
import {
  KOSTENART_LABEL, RHYTHMUS_LABEL, STEUER_HINWEIS, betragImMonat, neuerBaustein, type Baustein, type KostenArt, type Rhythmus,
} from '@/lib/finanzen/szenarien';
import {
  BEISPIEL_PRODUKTE, KOSTENARTEN_BLATT, bausteineVon, geschaeftsblatt, kdcImKern, kostenFaktor, neuesProdukt, summe12,
} from '@/lib/finanzen/geschaeft';
import { steuerAnteile, profilVon, rechtsformVon, zeigeSteuer } from '@/lib/finanzen/steuern';
import { usePlan } from './daten';
import { useArbeitsplan } from './arbeitsplan';
import { Geld, Kachel, Kacheln, Etikett, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Hinweis, Schalter, Nichts, personName } from './teile';
import { Blatt, type BlattZeile, type DatenZeile } from './Blatt';
import { ZeileDialog, neueZeileOp } from './ZeileDialog';
import { SteuerKarte } from './Steuern';
import { FeldK, AnnahmenKarte } from './Annahmen';

const RHYTHMEN = (Object.keys(RHYTHMUS_LABEL) as Rhythmus[]).map(id => ({ id, label: RHYTHMUS_LABEL[id] }));
const KOSTEN_NEU: KostenArt[] = ['stelle', 'tool', 'miete', 'sonstiges'];

/** Eine Zeile Produkt (Umsatz) oder Kosten — alle Felder frei, Enter speichert, Tab geht weiter. */
function BausteinZeile({ b, ps }: { b: Baustein; ps: { id: string } }) {
  const { d, aendere, aw } = usePlan();
  const m0 = aw.m0;
  const umsatz = b.art === 'umsatz';
  const p = (f: string) => `/planszenarien/id=${ps.id}/bausteine/id=${b.id}/${f}`;
  const n = `${umsatz ? 'Produkt' : 'Kosten'} ${b.name}`;
  const setze = (f: string, alt: unknown, neu: unknown, feld: string) => void aendere([{ pfad: p(f), alt, ...(neu === undefined ? {} : { neu }) }], `${n} · ${feld}`);
  let summe = 0; for (let m = m0; m < m0 + 12 && m <= d.monate.length; m++) summe += betragImMonat(b, m);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)', opacity: b.an ? 1 : 0.5 }}>
      <FeldK label="an"><Schalter an={b.an} onChange={v => setze('an', b.an, v, v ? 'an' : 'aus')} /></FeldK>
      <FeldK label={umsatz ? 'Produkt' : KOSTENART_LABEL[b.kostenArt ?? 'sonstiges']} breit={170}><TextFeld wert={b.name} onFertig={t => setze('name', b.name, t.trim() || b.name, 'Name')} titel="Name" platzhalter={umsatz ? 'Was wird verkauft?' : 'Wofür?'} /></FeldK>
      {umsatz && <FeldK label="Kunde / Segment" breit={140}><TextFeld wert={b.kunde ?? ''} onFertig={t => setze('kunde', b.kunde, t.trim() || undefined, 'Kunde')} titel="Kunde oder Segment" platzhalter="optional" /></FeldK>}
      <FeldK label={umsatz ? 'Preis netto €' : b.kostenArt === 'stelle' ? 'Brutto € je Monat' : 'Betrag €'}><ZahlFeld wert={b.preis} dezimal={0} breite={92} titel={umsatz ? 'Preis netto' : b.kostenArt === 'stelle' ? 'Brutto je Monat (Arbeitgeberanteil kommt dazu)' : 'Betrag'} onFertig={v => setze('preis', b.preis, v ?? 0, 'Preis')} /></FeldK>
      <FeldK label="Anzahl"><ZahlFeld wert={b.menge} dezimal={0} breite={62} titel="Anzahl" onFertig={v => setze('menge', b.menge, v ?? 1, 'Anzahl')} /></FeldK>
      <FeldK label="Rhythmus"><Auswahl wert={b.rhythmus} onWahl={v => setze('rhythmus', b.rhythmus, v, 'Rhythmus')} optionen={RHYTHMEN} titel="Rhythmus" /></FeldK>
      <FeldK label="Start"><MonatWahl wert={b.start} onWahl={m => setze('start', b.start, m, 'Start')} monate={d.monate} /></FeldK>
      {b.rhythmus === 'einmalig' && <FeldK label="Laufzeit"><span style={{ padding: '8px 2px', fontSize: TYP.bedien, color: C.inkLeise, width: 72, display: 'inline-block' }}>einmalig</span></FeldK>}
      {b.rhythmus !== 'einmalig' && <FeldK label="Laufzeit (Monate)"><ZahlFeld wert={b.laufzeit ?? null} leer platzhalter="offen" dezimal={0} breite={72} titel="Laufzeit in Monaten, leer = offen" onFertig={v => setze('laufzeit', b.laufzeit, v && v > 0 ? Math.round(v) : undefined, 'Laufzeit')} /></FeldK>}
      <FeldK label="nächste 12 M"><span style={{ padding: '8px 2px', fontSize: TYP.bedien }}><Geld v={umsatz ? summe : -summe * kostenFaktor(b, d.annahmen.agAnteil)} farbe={C.inkDim} /> €</span></FeldK>
      <KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: `/planszenarien/id=${ps.id}/bausteine/id=${b.id}`, alt: b.name }], `${n} entfernt`)} titel="Entfernen">−</KnopfKlein>
      {b.ueber && Object.keys(b.ueber).length > 0 && (
        <span style={{ flex: '1 1 100%', fontSize: 12, color: LEUCHT.achtung }}>
          {Object.keys(b.ueber).length} Monat{Object.keys(b.ueber).length === 1 ? '' : 'e'} im Blatt von Hand überschrieben ·{' '}
          <button type="button" onClick={() => setze('ueber', b.ueber, undefined, 'Überschreibungen zurückgesetzt')} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', font: 'inherit', padding: 0 }}>alle zurücksetzen</button>
        </span>
      )}
    </div>
  );
}

/** Produkte und Kosten einer Gesellschaft — Eingabe direkt im Blatt-Umfeld, Speichern in den Arbeitsplan. */
function BausteinKarten({ ort }: { ort: Gesellschaftskennung }) {
  const { aw } = usePlan();
  const { ps, schreibe } = useArbeitsplan();
  const m0 = aw.m0;
  const umsatz = bausteineVon(ps, ort, 'umsatz');
  const kosten = KOSTENARTEN_BLATT.flatMap(a => bausteineVon(ps, ort, 'kosten').filter(b => (b.kostenArt ?? 'sonstiges') === a));
  const dazu = (b: Baustein, feld: string) => void schreibe(id => [{ pfad: `/planszenarien/id=${id}/bausteine/-`, neu: b }], feld);
  const anz = (a: 'umsatz' | 'kosten') => (a === 'umsatz' ? umsatz : kosten).length;
  return (
    <>
      <Karte i={1}>
        <Ueberschrift rechts={<KnopfKlein onClick={() => dazu(neuesProdukt(neueKennung('b'), ort, { start: m0 }), 'Produkt angelegt')}>+ Produkt</KnopfKlein>}>Produkte und Umsatz — {finanzOrtName(ort)}</Ueberschrift>
        {umsatz.length ? umsatz.map(b => <BausteinZeile key={b.id} b={b} ps={ps!} />) : (
          <Nichts>Noch kein Produkt. „+ Produkt“ legt ein leeres an — Name, Preis, Anzahl, Start und Laufzeit stellst du direkt ein. Oder mit einer Vorlage beginnen:</Nichts>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <span style={{ ...MIKRO, marginRight: 4 }}>Vorlagen (ohne Preis)</span>
          {BEISPIEL_PRODUKTE.map(v => (
            <button key={v.name} type="button" onClick={() => dazu(neuesProdukt(neueKennung('b'), ort, { name: v.name, rhythmus: v.rhythmus, laufzeit: v.laufzeit, start: m0 }), `Produkt ${v.name} angelegt`)} className="fassbar"
              style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: C.ink }}>+ {v.name}</button>
          ))}
        </div>
        <Hinweis>
          {ps ? <>Gespeichert im Arbeitsplan „{ps.name}“. </> : <>Es gibt noch keinen Arbeitsplan — das erste Produkt legt ihn an (Basis: aktiver Treiber). </>}
          Ein Produkt ohne Preis bringt keinen Umsatz. Produkte aus dem CRM-Katalog und Ist-Basis aus Mandaten: Planen › Szenarien bauen. Im Blatt unten lässt sich jeder Monat überschreiben.
          {anz('umsatz') > 0 && ' Zahlungsziel je Produkt: Planen › Szenarien bauen.'}
        </Hinweis>
      </Karte>
      <Karte i={2}>
        <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>{KOSTEN_NEU.map(k => <KnopfKlein key={k} farbe={C.inkDim} onClick={() => dazu(neuerBaustein(neueKennung('b'), { art: 'kosten', kostenArt: k, einheit: ort, name: KOSTENART_LABEL[k], start: m0 }), `${KOSTENART_LABEL[k]} angelegt`)}>+ {KOSTENART_LABEL[k]}</KnopfKlein>)}</span>}>Kosten — Personal, Software, Miete</Ueberschrift>
        {kosten.length ? kosten.map(b => <BausteinZeile key={b.id} b={b} ps={ps!} />) : <Nichts>Keine zusätzlichen Kosten. Stellen rechnen mit Arbeitgeberanteil; fixe Kosten stehen unter „Sachkosten“ im Blatt, hier kommen Stellen, Software, Miete und Sonstiges mit Start und Laufzeit dazu.</Nichts>}
      </Karte>
    </>
  );
}

const runwayText = (r: number | null, N: number, m0: number) => (r == null ? `über ${N - m0 + 1} Monate` : r === 0 ? 'jetzt unter null' : `${r} Monat${r === 1 ? '' : 'e'}`);

/** Das Business-Blatt einer Gesellschaft. */
export function Geschaeft({ ort }: { ort: Gesellschaftskennung }) {
  const ctx = usePlan();
  const { d, dd, ug, ps, aw, aendere, params, sz } = ctx;
  const N = d.monate.length, m0 = aw.m0;
  const U = (m: number) => ug[m - 1];
  const satz = dd.annahmen.steuerUG;
  const gb = useMemo(() => geschaeftsblatt(dd, ort, ug, ps, satz, m0), [dd, ort, ug, ps, satz, m0]);
  const [dialog, setDialog] = useState<string | null>(null);
  const profil = profilVon(d, ort), rf = rechtsformVon(d, ort);
  const steuerOffen = params.get('steuern') === '1';
  const label = finanzOrtName(ort);

  const zelleVon = (b: Baustein, faktor = 1): DatenZeile['zelle'] => ({
    id: `b:${b.id}`,
    ueber: m => b.ueber?.[`m${m}`] !== undefined,
    setze: (m, v) => {
      if (!ps) return;
      void aendere([{ pfad: `/planszenarien/id=${ps.id}/bausteine/id=${b.id}/ueber/m${m}`, alt: b.ueber?.[`m${m}`], ...(v === null ? {} : { neu: v / faktor }) }], `${b.name} · ${monatLabel(d, m)}`);
    },
  });
  const prodZeilen = (): DatenZeile[] => gb.produkte.map(({ b, werte }): DatenZeile => ({ name: b.kunde ? `${b.name} · ${b.kunde}` : b.name, get: m => werte[m - 1], ind: true, zelle: zelleVon(b) }));
  const kostenZeilen = (arten: KostenArt[], mitAG = true): DatenZeile[] => gb.kosten.filter(k => arten.includes(k.b.kostenArt ?? 'sonstiges'))
    .map(({ b, werte }): DatenZeile => ({ name: `${KOSTENART_LABEL[b.kostenArt ?? 'sonstiges']} · ${b.name}${b.kostenArt === 'stelle' && mitAG ? ' (inkl. Arbeitgeberanteil)' : ''}`, get: m => werte[m - 1], ind: true, aus: true, zelle: zelleVon(b, mitAG ? kostenFaktor(b, d.annahmen.agAnteil) : 1) }));
  const steuerLeer: [string, string] = ['weitere Steuerzeile', 'weitere Steuerzeilen'];

  const zeilen: BlattZeile[] = [];
  if (ort === 'ug') {
    const sachSumme = (m: number) => d.sachkosten.reduce((s, z) => s + wert(z, m, d.plan), 0);
    const kdc = kdcImKern(ps, N);
    const anteile = steuerAnteile(profil);
    const einzeln = !!profil.einzeln && rf === 'kapital';
    const ertragAn = zeigeSteuer(d, 'ug', 'kst') || zeigeSteuer(d, 'ug', 'est');
    const ustAn = zeigeSteuer(d, 'ug', 'ust');
    zeilen.push(
      { grp: 'Umsatz netto', leerName: ['weitere Umsatzzeile', 'weitere Umsatzzeilen'] },
      { name: 'Ankermandat', edit: 'ug.ob', get: m => U(m).ob, ind: true, optional: true }, { name: 'Retainer', edit: 'ug.retainer', get: m => U(m).retainer, ind: true, optional: true },
      { name: 'Provision', edit: 'ug.astarna', get: m => U(m).astarna, ind: true, optional: true }, { name: 'Events', edit: 'ug.events', get: m => U(m).events, ind: true, optional: true },
      ...prodZeilen(),
      { name: `${finanzOrtName('kdc')} (Kern rechnet hier mit)`, get: m => kdc.umsatz[m - 1], ind: true, optional: true },
      { name: 'Umsatz', sum: true, get: m => U(m).umsatz },
      { grp: 'Kosten', leerName: ['weitere Kostenzeile', 'weitere Kostenzeilen'] },
      { name: `${personName('kevin')} brutto`, edit: 'ug.kevin', get: m => U(m).kevinBrutto, ind: true, aus: true, optional: true }, { name: `${personName('malin')} brutto`, edit: 'ug.malin', get: m => U(m).malinBrutto, ind: true, aus: true, optional: true },
      { name: 'Unterstützung', edit: 'ug.unterstuetzung', get: m => U(m).unterstuetzung, ind: true, aus: true, optional: true },
      { name: 'Personal inkl. Arbeitgeber', get: m => U(m).kevin + U(m).malin + U(m).unterstuetzung, ind: true, aus: true },
      ...kostenZeilen(['stelle']),
    );
    zeilen.push(
      { grp: 'Fixkosten (Sachkosten)', add: 'sachkosten', leerName: ['weitere Fixkostenzeile', 'weitere Fixkostenzeilen'] },
      ...d.sachkosten.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, d.plan), ind: true, aus: true, optional: true })),
      ...kostenZeilen(KOSTENARTEN_BLATT.filter(a => a !== 'stelle')),
      { name: 'Einmalige Kosten und Ereignisse', get: m => U(m).sach - sachSumme(m) - U(m).bausteineSach, ind: true, aus: true, optional: true },
      { name: 'Gründung', get: m => U(m).gruendung, ind: true, aus: true, optional: true },
      { name: 'Holding-Umlage', get: m => U(m).holding, ind: true, aus: true, optional: true },
      { name: 'Kosten gesamt', sum: true, aus: true, get: m => gb.kostenSumme[m - 1] },
      { grp: 'Ergebnis' },
      { name: 'Ergebnis vor Steuern', sum: true, key: true, get: m => gb.ergebnisVorSteuern[m - 1] },
      ...(ertragAn ? [{ name: 'Ertragsteuer-Aufwand (Näherung)', get: (m: number) => -gb.steuer[m - 1], ind: true, optional: true } as DatenZeile] : []),
      { name: 'Ergebnis nach Steuern', sum: true, key: true, get: m => gb.ergebnisNachSteuern[m - 1] },
      { grp: 'Zahlungsfluss und Liquidität', leerName: ['weitere Zeile', 'weitere Zeilen'] },
      { name: 'Eingang Retainer', get: m => U(m).retainerEingang, ind: true, optional: true },
      { name: 'Eingang aus Bausteinen', get: m => U(m).bausteineEingang, ind: true, optional: true },
      { name: 'Stammkapital und Gesellschafterdarlehen', get: m => U(m).kapital, ind: true, optional: true },
      { name: ustAn ? 'Einzahlungen' : 'Einzahlungen (inkl. USt-Durchlauf)', sum: true, get: m => U(m).einzahlungen },
      { name: 'Ausschüttung an Privat', get: m => -U(m).ausschuettung, ind: true, optional: true },
      { name: 'Partnerdarlehen-Rate', get: m => -U(m).bjoern, ind: true, optional: true },
      { name: 'Darlehen zurück', get: m => -U(m).darlehen, ind: true, optional: true },
      { name: ustAn ? 'Auszahlungen' : 'Auszahlungen (inkl. USt-Durchlauf)', sum: true, get: m => -U(m).auszahlungen },
      { name: 'Kontostand', stock: true, get: m => U(m).konto },
      { name: 'Frei verfügbar', stock: true, sum: true, key: true, get: m => U(m).frei },
      { grp: 'Steuern', leerName: steuerLeer },
      ...(ertragAn ? [
        { name: 'Ertragsteuer-Zahlung', get: (m: number) => -U(m).steuer, ind: true, optional: true } as DatenZeile,
        ...(einzeln ? [
          { name: 'davon Körperschaftsteuer', get: (m: number) => -U(m).steuer * anteile.kst, ind: true, optional: true } as DatenZeile,
          { name: 'davon Solidaritätszuschlag', get: (m: number) => -U(m).steuer * anteile.soli, ind: true, optional: true } as DatenZeile,
          { name: 'davon Gewerbesteuer', get: (m: number) => -U(m).steuer * anteile.gewst, ind: true, optional: true } as DatenZeile,
        ] : []),
        { name: 'Steuerrücklage', stock: true, get: (m: number) => -U(m).steuerRuecklage, optional: true } as DatenZeile,
      ] : []),
      ...(ustAn ? [
        { grp: 'Umsatzsteuer — Durchlauf', zu: true, leerName: steuerLeer } as BlattZeile,
        { name: 'USt vereinnahmt', get: (m: number) => U(m).ustEin, ind: true, optional: true } as DatenZeile,
        { name: 'USt an Finanzamt', get: (m: number) => -U(m).ustZahlung, ind: true, optional: true } as DatenZeile,
        { name: 'USt offen', stock: true, sum: true, get: (m: number) => -U(m).ustOffen } as DatenZeile,
      ] : []),
    );
  } else if (ort === 'kdv') {
    zeilen.push(
      { grp: 'Einnahmen', leerName: ['weitere Einnahmezeile', 'weitere Einnahmezeilen'] },
      { name: `Umlage aus ${finanzOrtName('ug')}`, get: m => U(m).kdvUmlage, ind: true, optional: true },
      { name: 'Partnerdarlehen-Rate von der Gesellschaft', get: m => U(m).kdvBjoernEin, ind: true, optional: true },
      { name: 'Ausstieg (Tranchen)', get: m => U(m).kdvExit, ind: true, optional: true },
      ...prodZeilen(),
      { name: 'Einnahmen', sum: true, get: m => gb.umsatz[m - 1] },
      { grp: 'Ausgaben', leerName: ['weitere Ausgabenzeile', 'weitere Ausgabenzeilen'] },
      { name: 'Holdingkosten', get: m => U(m).kdvHolding, ind: true, aus: true, optional: true },
      { name: 'Partnerdarlehen-Tilgung', get: m => U(m).kdvBjoern, ind: true, aus: true, optional: true },
      ...kostenZeilen(KOSTENARTEN_BLATT, false),
      { name: 'Ausgaben', sum: true, aus: true, get: m => gb.kostenSumme[m - 1] },
      { grp: 'Ergebnis' },
      { name: 'Ergebnis vor Steuern', sum: true, key: true, get: m => gb.ergebnisVorSteuern[m - 1] },
      ...(zeigeSteuer(d, 'kdv', 'exit') ? [{ name: 'Steuer auf den Ausstieg', get: (m: number) => -gb.steuer[m - 1], ind: true, optional: true } as DatenZeile] : []),
      { name: 'Ergebnis nach Steuern', sum: true, key: true, get: m => gb.ergebnisNachSteuern[m - 1] },
      { grp: 'Stand', leerName: ['weitere Zeile', 'weitere Zeilen'] },
      { name: 'Partnerdarlehen-Ablösung', get: m => -U(m).kdvAbloesung, ind: true, optional: true },
      { name: 'Kontostand KD Ventures', stock: true, sum: true, key: true, get: m => U(m).kdvKonto },
      { name: 'Partnerdarlehen offen', stock: true, get: m => -U(m).bjoernRest, optional: true },
    );
  } else {
    zeilen.push(
      { grp: 'Umsatz netto' },
      ...prodZeilen(),
      { name: 'Umsatz', sum: true, get: m => gb.umsatz[m - 1] },
      { grp: 'Kosten' },
      ...kostenZeilen(KOSTENARTEN_BLATT),
      { name: 'Kosten gesamt', sum: true, aus: true, get: m => gb.kostenSumme[m - 1] },
      { grp: 'Ergebnis' },
      { name: 'Ergebnis vor Steuern', sum: true, key: true, get: m => gb.ergebnisVorSteuern[m - 1] },
      ...(zeigeSteuer(d, 'kdc', 'est') ? [{ name: 'Einkommensteuer-Aufwand (Näherung)', get: (m: number) => -gb.steuer[m - 1], ind: true, optional: true } as DatenZeile] : []),
      { name: 'Ergebnis nach Steuern', sum: true, key: true, get: m => gb.ergebnisNachSteuern[m - 1] },
      { grp: 'Liquidität' },
      { name: gb.liquiditaetName, stock: true, sum: true, key: true, get: m => gb.liquiditaet[m - 1] },
    );
  }

  const u12 = summe12(gb.umsatz, m0), k12 = summe12(gb.kostenSumme, m0), v12 = summe12(gb.ergebnisVorSteuern, m0), n12 = summe12(gb.ergebnisNachSteuern, m0);
  const be = gb.breakEven;
  const beText = be.monatlich == null ? 'nicht im Plan' : monatLabel(d, be.monatlich);
  const liqJetzt = gb.liquiditaet[m0 - 1] ?? 0;

  return (
    <>
      <Kacheln min={170}>
        <Kachel label="Umsatz, 12 Monate" wert={<><Geld v={u12} /> €</>} unter={`ab ${monatLabel(d, m0)}`} />
        <Kachel label="Kosten, 12 Monate" wert={<><Geld v={k12} /> €</>} unter={<>Ø <Geld v={k12 / 12} farbe={C.inkDim} /> € im Monat</>} />
        <Kachel label="Ergebnis vor Steuern" punkt={v12 >= 0 ? LEUCHT.gut : LEUCHT.kritisch} wert={<><Geld v={v12} /> €</>} unter="12 Monate" />
        <Kachel label="Ergebnis nach Steuern" punkt={n12 >= 0 ? LEUCHT.gut : LEUCHT.kritisch} wert={<><Geld v={n12} /> €</>} unter={ort === 'ug' ? `Ertragsteuer ${prozent(satz, 1)} (Näherung)` : 'Näherung, keine Steuerberatung'} />
        <Kachel label="Break-even" punkt={be.monatlich == null ? LEUCHT.kritisch : be.monatlich <= m0 ? LEUCHT.gut : LEUCHT.achtung} wert={beText} unter={be.kumuliert == null ? 'insgesamt nicht im Plan gedeckt' : `insgesamt gedeckt ab ${monatLabel(d, be.kumuliert)}`} />
        <Kachel label="Runway" punkt={gb.runway == null ? LEUCHT.gut : gb.runway >= 6 ? LEUCHT.achtung : LEUCHT.kritisch} wert={runwayText(gb.runway, N, m0)} unter={<>{gb.liquiditaetName.split(' (')[0]} jetzt <Geld v={liqJetzt} farbe={C.inkDim} /> €</>} />
      </Kacheln>
      <BausteinKarten ort={ort} />
      <Karte i={3}>
        <Blatt zeilen={zeilen} titel={`${label} · ${ps?.name ?? sz.name}`} werkzeuge={<Etikett einheit={ort === 'kdc' ? 'selbststaendigkeit' : ort} />}
          onZeile={setDialog} onNeueZeile={async (liste, gruppe) => { const { op, id } = neueZeileOp(liste, gruppe); if (await aendere([op], 'Zeile angelegt')) setDialog(id); }} />
        <Hinweis>
          Zelle anklicken und tippen: bei Produkten und Kosten gilt der Wert für diesen Monat, bei Fixkosten und Gehältern überschreibt er den Plan (Entf setzt zurück).
          Leere Zeilen stehen hinter „weitere …“. {ort === 'ug' && 'Der Kern rechnet Bausteine der Selbstständigkeit mit — sie stehen hier als eigene Zeile und dort in ihrem Blatt. '}
          {ort === 'kdc' && 'Der Abschluss 2026 mit den Posten des laufenden Jahres steht darunter; dieses Blatt zeigt die Bausteine ab Planbeginn. '}
          {STEUER_HINWEIS}
        </Hinweis>
        {dialog && <ZeileDialog id={dialog} onZu={() => setDialog(null)} />}
      </Karte>
      <SteuerKarte ort={ort} offen={steuerOffen} i={4} />
      <AnnahmenKarte ort={ort} />
    </>
  );
}
