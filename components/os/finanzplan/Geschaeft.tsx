'use client';

// ─── Finanzplanung jetzt — das Business-Blatt je Gesellschaft ────────────────
// Kevin 02.10.: „Businessplanung fertig“ — je Gesellschaft (Namen aus lib/einheiten.ts) ein vollständiges Blatt:
// Kacheln (Umsatz, Kosten, Ergebnis vor und nach Steuern, Break-even, Runway) · Produkte (Preis, Anzahl, Start, Laufzeit —
// frei anlegbar, Vorlagen ohne Preis) · Kosten (Personal, Software, Miete, Raten, Sonstiges) · das Blatt je Monat
// (Zelle anklicken → ändern) · „Welche Steuern gelten?“ · die Annahmen dieser Gesellschaft.
// Gerechnet wird im Rechenkern; die Blatt-Kennzahlen kommen aus lib/finanzen/geschaeft.ts. Steuern: Hinweis, keine Steuerberatung.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT } from '../ui';
import { finanzOrtName, type Gesellschaftskennung } from '@/lib/einheiten';
import { monatLabel, neueKennung, prozent } from '@/lib/finanzen/plan/hilfen';
import { wert } from '@/lib/finanzen/rechenkern';
import {
  KOSTENART_LABEL, RHYTHMUS_LABEL, STEUER_HINWEIS, betragImMonat, neuerBaustein, type Baustein, type KostenArt, type Rhythmus,
} from '@/lib/finanzen/szenarien';
import {
  BEISPIEL_PRODUKTE, KOSTENARTEN_BLATT, bausteineVon, geschaeftsblatt, kostenFaktor, neuesProdukt, sachkostenDerMake, summe12,
} from '@/lib/finanzen/geschaeft';
import { rechtsformVon, zeigeSteuer, steuerParameter } from '@/lib/finanzen/steuern';
import { gesamtquote } from '@/lib/finanzen/ertragsteuer';
import { usePlan } from './daten';
import { useArbeitsplan } from './arbeitsplan';
import { Geld, Kachel, Kacheln, Etikett, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Hinweis, Schalter, Nichts, personName } from './teile';
import { Blatt, type BlattZeile, type DatenZeile } from './Blatt';
import { ZeileDialog, neueZeileOp } from './ZeileDialog';
import { SteuerKarte } from './Steuern';
import { FeldK, AnnahmenKarte } from './Annahmen';
import { EntnahmeFelder } from './Entnahme';
/** Name der Gesellschaft `kdv` aus den Einstellungen (lib/einheiten.ts) — nie fest im Code. */
const KDV = finanzOrtName('kdv');

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
      <FeldK label="an"><Schalter an={b.an} onChange={v => setze('an', b.an, v, v ? 'an' : 'aus')} ariaLabel={`${n} rechnet mit`} /></FeldK>
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
        <span style={{ flex: '1 1 100%', fontSize: TYP.bedien, color: LEUCHT.achtung }}>
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
              style={{ fontSize: TYP.bedien, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid rgba(255,255,255,.12)', background: 'transparent', color: C.ink }}>+ {v.name}</button>
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
  const { d, dd, ug, kdc, ps, aw, aendere, params, sz } = ctx;
  const N = d.monate.length, m0 = aw.m0;
  const U = (m: number) => ug[m - 1], K = (m: number) => kdc[m - 1];
  const gb = useMemo(() => geschaeftsblatt(dd, ort, { ug, kdc }, ps, m0), [dd, ort, ug, kdc, ps, m0]);
  const [dialog, setDialog] = useState<string | null>(null);
  const rf = rechtsformVon(dd, ort);
  const sp = steuerParameter(dd, ort);
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
  /** Steuer-Aufwand je Steuerart (positiv = Belastung, im Blatt negativ) — nur, was zur Rechtsform gehört und gilt. */
  const aufwandZeilen = (): DatenZeile[] => {
    const a = gb.steuerArten;
    // Jede Steuerzeile ist ein Handwert des Kerns (`<ort>.kst` …); Aufwand wird als Minus gezeigt, gespeichert positiv.
    const z = (name: string, art: string, reihe: number[], optional = true, vorz = -1): DatenZeile => ({ name, edit: `${ort}.${art}`, get: (m: number) => vorz * reihe[m - 1], ind: true, optional, minus: vorz < 0 });
    const out: DatenZeile[] = [];
    if (rf === 'kapital') {
      if (zeigeSteuer(dd, ort, 'kst')) out.push(z('Körperschaftsteuer', 'kst', a.kst, false));
      if (zeigeSteuer(dd, ort, 'soli')) out.push(z('Solidaritätszuschlag', 'soli', a.soli));
    } else if (zeigeSteuer(dd, ort, 'est')) { out.push(z(ort === 'kdc' ? 'Einkommensteuer (gemeinsam mit Privat, Mehrsteuer)' : 'Einkommensteuer', 'est', a.est, false)); out.push(z('Anrechnung Gewerbesteuer (§ 35 EStG)', 'anrechnung', a.anrechnung, true, 1)); out.push(z('Solidaritätszuschlag (über der Freigrenze)', 'soli', a.soli)); }
    if (zeigeSteuer(dd, ort, 'gewst')) out.push(z('Gewerbesteuer', 'gewst', a.gewst, false));
    if (ort === 'kdv' && zeigeSteuer(dd, ort, 'exit')) out.push(z('Steuer auf den Ausstieg', 'exitSteuer', a.exit));
    return out;
  };
  const ertragAn = (['kst', 'est', 'gewst'] as const).some(art => zeigeSteuer(dd, ort, art));

  const zeilen: BlattZeile[] = [];
  // Jede Zeile trägt ihre Kennung (`edit`): Planzeilen wie bisher, gerechnete Zeilen als Handwert des Kerns (lib/finanzen/handwerte.ts).
  // `minus`: als Minus gezeigt, positiv gespeichert. Produkte und Kosten-Bausteine schreiben in den Baustein (`zelle`).
  if (ort === 'ug') {
    const sachMake = sachkostenDerMake(d.sachkosten);   // Selbst-Zeilen stehen nur im Selbstständigkeits-Blatt
    const ustAn = zeigeSteuer(dd, 'ug', 'ust');
    zeilen.push(
      { grp: 'Umsatz netto', leerName: ['weitere Umsatzzeile', 'weitere Umsatzzeilen'] },
      { name: 'Ankermandat', edit: 'ug.ob', get: m => U(m).ob, ind: true, optional: true }, { name: 'Retainer', edit: 'ug.retainer', get: m => U(m).retainer, ind: true, optional: true },
      { name: 'Provision', edit: 'ug.astarna', get: m => U(m).astarna, ind: true, optional: true }, { name: 'Events', edit: 'ug.events', get: m => U(m).events, ind: true, optional: true },
      ...prodZeilen(),
      { name: 'Umsatz', edit: 'ug.umsatz', sum: true, get: m => U(m).umsatz },
      { grp: 'Kosten', leerName: ['weitere Kostenzeile', 'weitere Kostenzeilen'] },
      { name: `${personName('kevin')} brutto`, edit: 'ug.kevin', get: m => U(m).kevinBrutto, ind: true, aus: true, optional: true }, { name: `${personName('malin')} brutto`, edit: 'ug.malin', get: m => U(m).malinBrutto, ind: true, aus: true, optional: true },
      { name: 'Unterstützung', edit: 'ug.unterstuetzung', get: m => U(m).unterstuetzung, ind: true, aus: true, optional: true },
      { name: 'Personal inkl. Arbeitgeber', edit: 'ug.personal', sum: true, get: m => U(m).personal, ind: true, aus: true },
      ...kostenZeilen(['stelle']),
    );
    zeilen.push(
      { grp: 'Fixkosten (Sachkosten)', add: 'sachkosten', leerName: ['weitere Fixkostenzeile', 'weitere Fixkostenzeilen'] },
      ...sachMake.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, dd.plan), ind: true, aus: true, optional: true })),
      ...kostenZeilen(KOSTENARTEN_BLATT.filter(a => a !== 'stelle')),
      { name: 'Einmalige Kosten und Ereignisse', edit: 'ug.einmalig', get: m => U(m).einmalig, ind: true, aus: true, optional: true },
      { name: 'Gründung', edit: 'ug.gruendung', get: m => U(m).gruendung, ind: true, aus: true, optional: true },
      { name: 'Holding-Umlage', edit: 'ug.holding', get: m => U(m).holding, ind: true, aus: true, optional: true },
      { name: 'Laufende Kosten (Mindestumsatz)', edit: 'ug.laufend', sum: true, aus: true, get: m => U(m).laufend, ind: true },
      { name: 'Kosten gesamt', edit: 'ug.kosten', sum: true, aus: true, get: m => gb.kostenSumme[m - 1] },
      { grp: 'Ergebnis' },
      { name: 'Ergebnis vor Steuern', edit: 'ug.gewinn', sum: true, key: true, get: m => gb.ergebnisVorSteuern[m - 1] },
      ...aufwandZeilen(),
      { name: 'Ergebnis nach Steuern', edit: 'ug.ergebnisNach', sum: true, key: true, get: m => gb.ergebnisNachSteuern[m - 1] },
      { grp: 'Zahlungsfluss und Liquidität', leerName: ['weitere Zeile', 'weitere Zeilen'] },
      { name: 'Eingang Retainer', edit: 'ug.retainerEingang', get: m => U(m).retainerEingang, ind: true, optional: true },
      { name: 'Eingang aus Bausteinen', edit: 'ug.bausteineEingang', get: m => U(m).bausteineEingang, ind: true, optional: true },
      { name: 'Eingang aus Umsatz von Hand', edit: 'ug.umsatzEingang', get: m => U(m).umsatzEingang, ind: true, optional: true },
      { name: 'Stammkapital und Gesellschafterdarlehen (alt)', edit: 'ug.kapital', get: m => U(m).kapital, ind: true, optional: true },
      { name: 'Darlehen erhalten oder zurückerhalten', edit: 'ug.darlehenEin', get: m => U(m).darlehenEin, ind: true, optional: true },
      ...(ustAn ? [] : [{ name: 'USt vereinnahmt (Durchlauf)', edit: 'ug.ustEin', get: (m: number) => U(m).ustEin, ind: true, optional: true } as DatenZeile]),
      { name: ustAn ? 'Einzahlungen' : 'Einzahlungen (inkl. USt-Durchlauf)', edit: 'ug.einzahlungen', sum: true, get: m => U(m).einzahlungen },
      { name: 'Ausschüttung an Privat', edit: 'ug.ausschuettung', minus: true, get: m => -U(m).ausschuettung, ind: true, optional: true },
      { name: 'Partnerdarlehen-Rate', edit: 'ug.bjoern', minus: true, get: m => -U(m).bjoern, ind: true, optional: true },
      { name: 'Darlehen ausgezahlt oder zurückgezahlt', edit: 'ug.darlehen', minus: true, get: m => -U(m).darlehen, ind: true, optional: true },
      { name: ustAn ? 'Auszahlungen' : 'Auszahlungen (inkl. USt-Durchlauf)', edit: 'ug.auszahlungen', minus: true, sum: true, get: m => -U(m).auszahlungen },
      { name: 'Kontostand', edit: 'ug.konto', stock: true, get: m => U(m).konto },
      { name: 'Frei verfügbar', edit: 'ug.frei', stock: true, sum: true, key: true, get: m => U(m).frei },
      { grp: 'Steuern', leerName: steuerLeer },
      ...(ertragAn ? [
        { name: 'Ertragsteuer-Zahlung', edit: 'ug.steuer', minus: true, get: (m: number) => -U(m).steuer, ind: true, optional: true } as DatenZeile,
        { name: 'Steuerrücklage', edit: 'ug.steuerRuecklage', minus: true, stock: true, get: (m: number) => -U(m).steuerRuecklage, optional: true } as DatenZeile,
        { name: 'Verlustvortrag zu Jahresbeginn', edit: 'ug.verlustvortrag', stock: true, get: (m: number) => U(m).st.verlustvortrag, ind: true, optional: true } as DatenZeile,
      ] : []),
      ...(ustAn ? [
        { grp: 'Umsatzsteuer — Durchlauf', zu: true, leerName: steuerLeer } as BlattZeile,
        { name: 'USt vereinnahmt', edit: 'ug.ustEin', get: (m: number) => U(m).ustEin, ind: true, optional: true } as DatenZeile,
        { name: 'USt an Finanzamt', edit: 'ug.ustZahlung', minus: true, get: (m: number) => -U(m).ustZahlung, ind: true, optional: true } as DatenZeile,
        { name: 'USt offen', edit: 'ug.ustOffen', minus: true, stock: true, sum: true, get: (m: number) => -U(m).ustOffen } as DatenZeile,
      ] : []),
    );
  } else if (ort === 'kdv') {
    zeilen.push(
      { grp: 'Einnahmen', leerName: ['weitere Einnahmezeile', 'weitere Einnahmezeilen'] },
      { name: `Umlage aus ${finanzOrtName('ug')}`, edit: 'kdv.umlage', get: m => U(m).kdvUmlage, ind: true, optional: true },
      { name: 'Partnerdarlehen-Rate von der Gesellschaft', edit: 'kdv.bjoernEin', get: m => U(m).kdvBjoernEin, ind: true, optional: true },
      { name: 'Ausstieg (Tranchen)', edit: 'kdv.exit', get: m => U(m).kdvExit, ind: true, optional: true },
      ...prodZeilen(),
      { name: 'Einnahmen', edit: 'kdv.einnahmen', sum: true, get: m => gb.umsatz[m - 1] },
      { grp: 'Ausgaben', leerName: ['weitere Ausgabenzeile', 'weitere Ausgabenzeilen'] },
      { name: 'Holdingkosten', edit: 'kdv.holding', get: m => U(m).kdvHolding, ind: true, aus: true, optional: true },
      { name: 'Partnerdarlehen-Tilgung', edit: 'kdv.tilgung', get: m => U(m).kdvBjoern, ind: true, aus: true, optional: true },
      ...kostenZeilen(KOSTENARTEN_BLATT, false),
      { name: 'Ausgaben', edit: 'kdv.ausgaben', sum: true, aus: true, get: m => gb.kostenSumme[m - 1] },
      { grp: 'Ergebnis' },
      { name: 'Ergebnis vor Steuern', edit: 'kdv.ergebnis', sum: true, key: true, get: m => gb.ergebnisVorSteuern[m - 1] },
      ...aufwandZeilen(),
      { name: 'Ergebnis nach Steuern', edit: 'kdv.ergebnisNach', sum: true, key: true, get: m => gb.ergebnisNachSteuern[m - 1] },
      { grp: 'Stand', leerName: ['weitere Zeile', 'weitere Zeilen'] },
      { name: 'Partnerdarlehen-Ablösung', edit: 'kdv.abloesung', minus: true, get: m => -U(m).kdvAbloesung, ind: true, optional: true },
      { name: 'Ertragsteuer-Zahlung', edit: 'kdv.steuer', minus: true, get: m => -U(m).kdvSt.zahlung, ind: true, optional: true },
      { name: 'Darlehen erhalten oder zurückerhalten (kein Ergebnis)', edit: 'kdv.darlehenEin', get: m => U(m).kdvDarlehenEin, ind: true, optional: true },
      { name: 'Darlehen ausgezahlt oder zurückgezahlt (kein Ergebnis)', edit: 'kdv.darlehenAus', minus: true, get: m => -U(m).kdvDarlehenAus, ind: true, optional: true },
      { name: 'Steuerrücklage', edit: 'kdv.steuerRuecklage', minus: true, stock: true, get: m => -U(m).kdvSt.ruecklage, ind: true, optional: true },
      { name: 'Verlustvortrag zu Jahresbeginn', edit: 'kdv.verlustvortrag', stock: true, get: m => U(m).kdvSt.verlustvortrag, ind: true, optional: true },
      { name: `Kontostand ${KDV}`, edit: 'kdv.konto', stock: true, get: m => U(m).kdvKonto },
      { name: 'Frei verfügbar', edit: 'kdv.frei', stock: true, sum: true, key: true, get: m => U(m).kdvFrei },
      { name: 'Partnerdarlehen offen', edit: 'kdv.darlehenOffen', minus: true, stock: true, get: m => -U(m).bjoernRest, optional: true },
    );
  } else {
    const fix = d.sachkosten.filter(z => z.einheit === 'selbststaendigkeit');
    const ustAn = zeigeSteuer(dd, 'kdc', 'ust');
    zeilen.push(
      { grp: 'Umsatz netto' },
      ...prodZeilen(),
      { name: 'Umsatz', edit: 'kdc.umsatz', sum: true, get: m => gb.umsatz[m - 1] },
      { grp: 'Kosten' },
      ...kostenZeilen(KOSTENARTEN_BLATT),
      { name: `${personName('malin')} brutto (bis zur GmbH, Arbeitgeberanteil kommt dazu)`, edit: 'kdc.malin', get: m => K(m).malinBrutto, ind: true, aus: true, optional: true },
      { grp: 'Fixkosten (Sachkosten)', add: 'sachkosten', addG: 'Selbstständigkeit', addE: 'selbststaendigkeit', leerName: ['weitere Fixkostenzeile', 'weitere Fixkostenzeilen'] },
      ...fix.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, dd.plan), ind: true, aus: true, optional: true })),
      { name: 'Kosten gesamt', edit: 'kdc.kosten', sum: true, aus: true, get: m => gb.kostenSumme[m - 1] },
      { grp: 'Ergebnis' },
      { name: 'Ergebnis vor Steuern', edit: 'kdc.gewinn', sum: true, key: true, get: m => gb.ergebnisVorSteuern[m - 1] },
      ...aufwandZeilen(),
      { name: 'Ergebnis nach Steuern', edit: 'kdc.ergebnisNach', sum: true, key: true, get: m => gb.ergebnisNachSteuern[m - 1] },
      { grp: 'Zahlungsfluss und Liquidität', leerName: ['weitere Zeile', 'weitere Zeilen'] },
      { name: 'Eingang aus Umsatz', edit: 'kdc.eingang', get: m => K(m).eingang, ind: true, optional: true },
      ...(ustAn ? [] : [{ name: 'USt vereinnahmt (Durchlauf)', edit: 'kdc.ustEin', get: (m: number) => K(m).ustEin, ind: true, optional: true } as DatenZeile]),
      { name: 'Darlehen erhalten oder zurückerhalten', edit: 'kdc.darlehenEin', get: m => K(m).darlehenEin, ind: true, optional: true },
      { name: ustAn ? 'Einzahlungen' : 'Einzahlungen (inkl. USt-Durchlauf)', edit: 'kdc.einzahlungen', sum: true, get: m => K(m).einzahlungen },
      { name: 'Steuerzahlung (Einkommen- und Gewerbesteuer)', edit: 'kdc.steuer', minus: true, get: m => -K(m).st.zahlung, ind: true, optional: true },
      { name: 'Entnahme an Privat', edit: 'kdc.entnahme', minus: true, get: m => -K(m).entnahme, ind: true, optional: true },
      { name: 'Darlehen ausgezahlt oder zurückgezahlt', edit: 'kdc.darlehenAus', minus: true, get: m => -K(m).darlehenAus, ind: true, optional: true },
      { name: ustAn ? 'Auszahlungen' : 'Auszahlungen (inkl. USt-Durchlauf)', edit: 'kdc.auszahlungen', minus: true, sum: true, get: m => -K(m).auszahlungen },
      { name: 'Kontostand', edit: 'kdc.konto', stock: true, get: m => K(m).konto },
      { name: gb.liquiditaetName, edit: 'kdc.frei', stock: true, sum: true, key: true, get: m => gb.liquiditaet[m - 1] },
      { grp: 'Steuern', leerName: steuerLeer },
      { name: 'Steuerrücklage', edit: 'kdc.steuerRuecklage', minus: true, stock: true, get: m => -K(m).steuerRuecklage, optional: true },
      { name: 'Verlustvortrag zu Jahresbeginn', edit: 'kdc.verlustvortrag', stock: true, get: m => K(m).st.verlustvortrag, ind: true, optional: true },
      ...(ustAn ? [
        { grp: 'Umsatzsteuer — Durchlauf', zu: true, leerName: steuerLeer } as BlattZeile,
        { name: 'USt vereinnahmt', edit: 'kdc.ustEin', get: (m: number) => K(m).ustEin, ind: true, optional: true } as DatenZeile,
        { name: 'USt an Finanzamt', edit: 'kdc.ustZahlung', minus: true, get: (m: number) => -K(m).ustZahlung, ind: true, optional: true } as DatenZeile,
        { name: 'USt offen', edit: 'kdc.ustOffen', minus: true, stock: true, get: (m: number) => -K(m).ustOffen, optional: true } as DatenZeile,
      ] : []),
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
        <Kachel label="Ergebnis nach Steuern" punkt={n12 >= 0 ? LEUCHT.gut : LEUCHT.kritisch} wert={<><Geld v={n12} /> €</>} unter={rf === 'kapital' && ertragAn ? `Ertragsteuern ${prozent(gesamtquote(sp), 1)} vom Gewinn (Näherung)` : 'Näherung, keine Steuerberatung'} />
        <Kachel label="Break-even" punkt={be.monatlich == null ? LEUCHT.kritisch : be.monatlich <= m0 ? LEUCHT.gut : LEUCHT.achtung} wert={beText} unter={be.kumuliert == null ? 'insgesamt nicht im Plan gedeckt' : `insgesamt gedeckt ab ${monatLabel(d, be.kumuliert)}`} />
        <Kachel label="Runway" punkt={gb.runway == null ? LEUCHT.gut : gb.runway >= 6 ? LEUCHT.achtung : LEUCHT.kritisch} wert={runwayText(gb.runway, N, m0)} unter={<>{gb.liquiditaetName.split(' (')[0]} jetzt <Geld v={liqJetzt} farbe={C.inkDim} /> €</>} />
      </Kacheln>
      <BausteinKarten ort={ort} />
      <Karte i={3}>
        <Blatt zeilen={zeilen} titel={`${label} · ${ps?.name ?? sz.name}`} werkzeuge={<Etikett einheit={ort === 'kdc' ? 'selbststaendigkeit' : ort} />}
          onZeile={setDialog} onNeueZeile={async (liste, gruppe, einheit) => { const { op, id } = neueZeileOp(liste, gruppe, einheit); if (await aendere([op], 'Zeile angelegt')) setDialog(id); }} />
        <Hinweis>
          Bei Produkten und Kosten-Bausteinen gilt ein eingetippter Wert für diesen Monat des Bausteins; jede andere Zahl überschreibt die Formel von Hand (✎) — Summen, Steuern, Ein- und Auszahlungen und Kontostand rechnen damit weiter.
          Leere Zeilen stehen hinter „weitere …“. {ort === 'kdc' && 'Die Selbstständigkeit gehört zu Privat und rechnet auf eigener Monatsachse (eigenes Konto). Die Einkommensteuer ist EINE Steuer je Jahr über Gewinn und Gehalt (Progression) — im Blatt steht der Teil, den die Selbstständigkeit zusätzlich zur Lohnsteuer kostet; 2026 beginnt mit dem Gewinn Jan–Sep aus dem Abschluss darunter. '}
          {STEUER_HINWEIS}
        </Hinweis>
        {dialog && <ZeileDialog id={dialog} onZu={() => setDialog(null)} />}
      </Karte>
      {ort === 'kdc' && (
        <Karte i={4}>
          <Ueberschrift>Entnahme nach Privat</Ueberschrift>
          <EntnahmeFelder />
          <Hinweis>Was Sie aus der Selbstständigkeit nach Privat entnehmen — fester Betrag je Monat und/oder ein Anteil am Ergebnis nach Steuern. Schon versteuert; es erscheint im Privat-Blatt als Einnahme und bleibt sonst im Konto der Selbstständigkeit. Gilt je Szenario (Arbeitsplan).</Hinweis>
        </Karte>
      )}
      <SteuerKarte ort={ort} offen={steuerOffen} i={5} />
      <AnnahmenKarte ort={ort} />
    </>
  );
}
