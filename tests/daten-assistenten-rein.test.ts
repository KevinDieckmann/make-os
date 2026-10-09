// ─── Daten-Assistenten (09.10., ONBOARDING_PLAN.md › B9 a–c, L7, L34) — die reinen Regeln ─────────────────────────────────────────────
// Einfügen aus Excel (Tab-getrennt) und BWA/OP-CSV (Vorspann, Windows-1252), Zuordnung, Monate, Plan (neu · geändert · gleich), Rückgängig-Plan,
// offene Posten (ergänzen/ersetzen, „bezahlt am“), Mandate (Gesellschaft Pflicht, feste Kennung, Firma vorhanden/neu/Papierkorb).
// Erfundene Namen und Zahlen — keine echten Daten.
import { describe, it, expect } from 'vitest';
import {
  tabelleLesen, transponieren, zuordnungVorschlag, zuordnungPruefen, datensaetzeBauen, zeilenAufbereiten, monatAus, centSumme, datensaetzePruefen,
  vorschauZahlen, EINFUEGEN_GRENZEN, type Datensatz,
} from '@/lib/tabelle/einfuegen';
import {
  ABSCHLUSS_TABELLE_FELDER, ABSCHLUSS_FELDER, abschlussAufbereiten, abschlussEingaben, abschlussPlan, abschlussBasis, feldFuerPosition, laufAusPlan, rueckPlan, ausrichtungErkennen,
} from '@/lib/business/abschluss-tabelle';
import { ABSCHLUSS_FELDER as SPEICHER_FELDER } from '@/lib/business/speicher';
import { POSTEN_FELDER, postenEingaben, postenPlan, neueListe, mitBezahlt, fassungMit, listeZuLang } from '@/lib/business/eroeffnung-tabelle';
import { offenePostenAls, eroeffnungPruefen, type Eroeffnung, type OffenerPosten } from '@/lib/business/eroeffnung';
import { MANDAT_FELDER, mandatEingaben, mandatKennung, mandatPlan, laufzeitAus, gesellschaftAus, neuesMandat, altWerte } from '@/lib/crm/mandate-tabelle';
import type { Monatsabschluss } from '@/lib/business/messen';
import type { Firma, Leistung, Mandat } from '@/lib/crm/typen';

/** Windows-1252-Bytes (wie Excel-CSV deutscher Programme): Umlaute als ein Byte. */
const cp1252 = (t: string) => Uint8Array.from(Array.from(t).map(c => ({ 'ä': 0xe4, 'ö': 0xf6, 'ü': 0xfc, 'Ä': 0xc4, 'Ö': 0xd6, 'Ü': 0xdc, 'ß': 0xdf, '€': 0x80 } as Record<string, number>)[c] ?? c.charCodeAt(0)));
const ds = (werte: Record<string, string | string[]>, schluessel?: string, quelle = 'Zeile 2'): Datensatz =>
  ({ quelle, ...(schluessel ? { schluessel } : {}), werte: Object.fromEntries(Object.entries(werte).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])) });

describe('Lesen: Excel aus der Zwischenablage und CSV-Dateien', () => {
  it('Tab-getrennt aus Excel — auch mit Anführungszeichen, Zeilenumbruch in der Zelle und Semikolon im Text', () => {
    const t = 'Kunde\tBetrag\tNotiz\n"Beispiel; GmbH"\t1.234,56\t"zwei\nZeilen"\nMuster AG\t99,00\t\n';
    const g = tabelleLesen(t);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.trenner).toBe('\t');
    expect(g.zeilen.map(z => z.zellen)).toEqual([['Kunde', 'Betrag', 'Notiz'], ['Beispiel; GmbH', '1.234,56', 'zwei\nZeilen'], ['Muster AG', '99,00', '']]);
  });

  it('BWA-CSV mit Vorspann in Windows-1252: Zeichensatz erkannt, Vorspann übersprungen, Monate in Spalten', () => {
    const csv = [
      '"BWA";"Kurzfristige Erfolgsrechnung"',
      '"Mandant";"Beispiel GmbH"',
      '"Zeitraum";"01/2026 - 03/2026"',
      '',
      '"Bezeichnung";"Jan/2026";"%";"Feb/2026";"%";"Mär/2026";"%";"Summe"',
      '"Umsatzerlöse";"10.000,00";"100,0";"12.500,50";"100,0";"9.000,00";"100,0";"31.500,50"',
      '"Personalkosten";"-4.000,00";"40,0";"-4.000,00";"32,0";"-4.100,00";"45,6";"-12.100,00"',
      '"Raumkosten";"-800,00";"8,0";"-800,00";"6,4";"-800,00";"8,9";"-2.400,00"',
      '"Werbe-/Reisekosten";"-300,00";"3,0";"-450,00";"3,6";"";"";"-750,00"',
      '"Abschreibungen";"-120,00";"1,2";"-120,00";"1,0";"-120,00";"1,3";"-360,00"',
      '"Gesamtkosten";"-5.220,00";"52,2";"-5.370,00";"43,0";"-5.020,00";"55,8";"-15.610,00"',
    ].join('\r\n');
    const g = tabelleLesen(cp1252(csv));
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(g.zeichensatz).toBe('windows-1252');
    expect(g.trenner).toBe(';');
    const a = abschlussAufbereiten(g.zeilen);
    expect(a.ausrichtung).toBe('monate-in-spalten');
    expect(a.datensaetze.map(d => d.schluessel)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(a.quellen.map(q => q.label)).toEqual(['Umsatzerlöse', 'Personalkosten', 'Raumkosten', 'Werbe-/Reisekosten', 'Abschreibungen', 'Gesamtkosten']);
    // Vorschlag aus den BWA-Bezeichnungen — Raumkosten bleibt „nicht übernehmen“ (es gibt kein eigenes Feld; nie raten).
    expect(a.vorschlag).toEqual(['umsatz', 'personal', null, 'marketingVertrieb', 'afa', 'kosten']);
    expect(a.hinweise.join(' ')).toContain('Vorspann');
    expect(a.hinweise.join(' ')).toMatch(/Spalten ohne Monat sind übersprungen/);
    const e = abschlussEingaben(datensaetzeBauen(a, a.vorschlag), '2026-10-09');
    expect(e.fehler).toEqual([]);
    expect(e.eingaben[1]).toMatchObject({ monat: '2026-02', werte: { umsatz: 12500.5, personal: 4000, marketingVertrieb: 450, afa: 120, kosten: 5370 } });
    // Leere Zelle (März, Werbe-/Reisekosten) = kein Wert — nicht 0.
    expect(e.eingaben[2].werte.marketingVertrieb).toBeUndefined();
    expect(e.hinweise.join(' ')).toMatch(/Minuszeichen als Betrag/);
  });

  it('Excel-Raster mit Monaten in Zeilen wird gedreht; mehrere Positionen auf ein Feld = Summe', () => {
    const g = tabelleLesen('Monat\tUmsatz\tWerbung\tVertriebskosten\tTage\n2026-01\t5000\t100\t50\t12,5\n2026-02\t6000,25\t\t70\t14\nSumme\t11000,25\t100\t120\t26,5\n');
    if (!g.ok) throw new Error(g.fehler);
    expect(ausrichtungErkennen(g.zeilen)).toBe('monate-in-zeilen');
    const a = abschlussAufbereiten(g.zeilen);
    expect(a.datensaetze.map(d => d.schluessel)).toEqual(['2026-01', '2026-02']);
    expect(a.vorschlag).toEqual(['umsatz', 'marketingVertrieb', 'marketingVertrieb', 'fakturierteTage']);
    expect(zuordnungPruefen(a.vorschlag, ABSCHLUSS_TABELLE_FELDER, a.quellen)).toBeNull();
    const e = abschlussEingaben(datensaetzeBauen(a, a.vorschlag), '2026-10-09');
    expect(e.eingaben.map(x => x.werte)).toEqual([{ umsatz: 5000, marketingVertrieb: 150, fakturierteTage: 12.5 }, { umsatz: 6000.25, marketingVertrieb: 70, fakturierteTage: 14 }]);
  });

  it('nie kürzen: zu viele Zeilen → Fehler, nichts gelesen; leere Einfügung → Fehler', () => {
    const viel = Array.from({ length: EINFUEGEN_GRENZEN.zeilen + 1 }, (_, i) => `a${i}\t${i}`).join('\n');
    expect(tabelleLesen(viel)).toMatchObject({ ok: false });
    expect(tabelleLesen('   \n')).toMatchObject({ ok: false });
    const r = datensaetzePruefen(Array.from({ length: EINFUEGEN_GRENZEN.datensaetze + 1 }, () => ({ werte: { kunde: ['x'] } })), ['kunde']);
    expect(r).toMatchObject({ ok: false, zuGross: true });
    expect(datensaetzePruefen([{ werte: { unbekannt: ['x'] } }], ['kunde'])).toMatchObject({ ok: false });
    expect(datensaetzePruefen([{ werte: { kunde: [{ boese: 1 }] } }], ['kunde'])).toMatchObject({ ok: false });
  });

  it('transponieren tauscht Zeilen und Spalten; Monate in vielen Schreibweisen, Zeiträume/Summen nie', () => {
    expect(transponieren([{ zeile: 1, zellen: ['a', 'b'] }, { zeile: 2, zellen: ['c'] }]).map(z => z.zellen)).toEqual([['a', 'c'], ['b', '']]);
    for (const [t, m] of [['2026-01', '2026-01'], ['01/2026', '2026-01'], ['1/26', '2026-01'], ['01.2026', '2026-01'], ['Jan 2026', '2026-01'], ['Mär. 26', '2026-03'],
      ['Januar 2026', '2026-01'], ['Sept 2026', '2026-09'], ['Okt/2026', '2026-10'], ['31.12.2026', '2026-12'], ['2026/11', '2026-11']] as const) expect(monatAus(t), t).toBe(m);
    for (const t of ['Summe', 'Jan/2026 - Sep/2026', '12,50', '1.234', '2026', '%', '']) expect(monatAus(t), t).toBeNull();
  });

  it('Zuordnung: Pflichtfeld fehlt bzw. Nicht-Summen-Feld zweimal → Satz; Summen-Feld darf mehrfach', () => {
    const q = [{ label: 'A', beispiel: '' }, { label: 'B', beispiel: '' }];
    expect(zuordnungPruefen([null, null], MANDAT_FELDER, q)).toMatch(/Kunde/);
    expect(zuordnungPruefen(['kunde', 'kunde'], MANDAT_FELDER, q)).toMatch(/zweimal/);
    expect(zuordnungPruefen(['umsatz', 'umsatz'], ABSCHLUSS_TABELLE_FELDER, q)).toBeNull();
    expect(feldFuerPosition('4. Personalkosten')).toBe('personal');
    expect(feldFuerPosition('Eigenkapitalquote')).toBeNull();
    expect(feldFuerPosition('Verbindlichkeiten gegenüber Kreditinstituten')).toBe('bankschulden');
  });

  it('Felder des Abschlusses: EINE Liste (Speicher reicht sie weiter), jedes Feld in der Tabelle', () => {
    expect(SPEICHER_FELDER).toBe(ABSCHLUSS_FELDER);
    expect(ABSCHLUSS_TABELLE_FELDER.map(f => f.id).sort()).toEqual([...ABSCHLUSS_FELDER].sort());
  });

  it('Zahlen: deutsches und englisches Format je Einfügung, kaputte Zelle → Fehler (nie raten)', () => {
    expect(centSumme(['1.234,56', '10'], 'komma')).toEqual({ cent: 124456 });
    expect(centSumme(['1,234.56'], 'punkt')).toEqual({ cent: 123456 });
    expect(centSumme(['zwölf'], 'komma')).toEqual({ fehler: 'zwölf' });
    expect(centSumme([], 'komma')).toEqual({ cent: null });
  });
});

describe('Monatsabschluss: Prüfen, Plan, Rückgängig', () => {
  const heute = '2026-10-09';
  it('Fehler je Monat: Zukunft, doppelt, keine Zahl — die übrigen Monate gehen durch', () => {
    const e = abschlussEingaben([
      ds({ umsatz: '100' }, '2026-09'), ds({ umsatz: '100' }, '2026-11'), ds({ umsatz: '200' }, '2026-09'), ds({ kosten: 'viel' }, '2026-08'), ds({}, '2026-07'),
    ], heute);
    expect(e.eingaben.map(x => x.monat)).toEqual(['2026-09']);
    expect(e.fehler.map(f => f.text)).toEqual([expect.stringMatching(/Zukunft/), expect.stringMatching(/zweimal/), expect.stringMatching(/keine Zahl/)]);
  });

  const alt: Monatsabschluss[] = [
    { firma: 'ug', monat: '2026-08', umsatz: 1000, kosten: 500, von: 'pa', am: '2026-09-02T10:00:00.000Z' },
    { firma: 'kdv', monat: '2026-08', umsatz: 7, von: 'pa', am: '2026-09-02T10:00:00.000Z' },
  ];
  it('Plan: neu · geändert · gleich, nur die eingefügten Felder zählen; Basis ändert sich mit dem Bestand', () => {
    const e = abschlussEingaben([ds({ umsatz: '1000', kosten: '600' }, '2026-08'), ds({ umsatz: '900' }, '2026-09'), ds({ umsatz: '1.000,00' }, '2026-07')], heute).eingaben;
    const p = abschlussPlan(e, [...alt, { firma: 'ug', monat: '2026-07', umsatz: 1000 }], 'ug');
    expect(p.map(x => [x.monat, x.status])).toEqual([['2026-07', 'gleich'], ['2026-08', 'geaendert'], ['2026-09', 'neu']]);
    expect(p[1].aenderungen).toEqual([{ feld: 'kosten', alt: 500, neu: 600 }]);
    const b1 = abschlussBasis('ug', ['2026-08', '2026-09'], alt);
    expect(abschlussBasis('ug', ['2026-08', '2026-09'], [{ ...alt[0], kosten: 501 }, alt[1]])).not.toBe(b1);
    // Eine andere Gesellschaft ändert die Basis nicht.
    expect(abschlussBasis('ug', ['2026-08', '2026-09'], [alt[0], { ...alt[1], umsatz: 8 }])).toBe(b1);
  });

  it('Rückgängig: unverändert → alte Werte zurück, neuer Monat → gelöscht; geändert → Konflikt (bleibt); schon zurück → gezählt', () => {
    const e = abschlussEingaben([ds({ kosten: '600' }, '2026-08'), ds({ umsatz: '900' }, '2026-09')], heute).eingaben;
    const lauf = laufAusPlan('al-1', 'business', 'ug', '2026-10-09T08:00:00.000Z', abschlussPlan(e, alt, 'ug'));
    expect(lauf.monate).toEqual([{ monat: '2026-08', neu: false, felder: [{ feld: 'kosten', alt: 500, neu: 600 }] }, { monat: '2026-09', neu: true, felder: [{ feld: 'umsatz', alt: null, neu: 900 }] }]);
    const nachher: Monatsabschluss[] = [{ ...alt[0], kosten: 600 }, { firma: 'ug', monat: '2026-09', umsatz: 900 }];
    expect(rueckPlan(lauf, nachher)).toEqual({ aktionen: [{ art: 'setzen', monat: '2026-08', werte: { kosten: 500 } }, { art: 'loeschen', monat: '2026-09' }], konflikte: [], schon: 0 });
    // Jemand hat inzwischen geändert: August-Kosten 650, im September kam „Kosten“ dazu.
    expect(rueckPlan(lauf, [{ ...alt[0], kosten: 650 }, { firma: 'ug', monat: '2026-09', umsatz: 900, kosten: 1 }])).toEqual({ aktionen: [], konflikte: ['2026-08', '2026-09'], schon: 0 });
    // Schon zurück (August wieder 500, September weg).
    expect(rueckPlan(lauf, [alt[0]])).toEqual({ aktionen: [], konflikte: [], schon: 2 });
  });
});

describe('Offene Posten des 0-Punkts', () => {
  const heute = '2026-10-09';
  const bisher: OffenerPosten[] = [
    { name: 'Kunde A', betrag: 1500, rechnungsnr: 'RE-1', faellig: '2026-10-20' },
    { name: 'Kunde B', betrag: 800 },
  ];
  it('Eingaben: Betrag als Betrag (Minus aus Kreditoren-Listen), Datum deutsch, „bezahlt am“ nicht in der Zukunft', () => {
    const e = postenEingaben([
      ds({ name: 'Lieferant X', betrag: '-1.190,00', rechnungsnr: 'L-7', datum: '01.09.2026', faellig: '30.09.2026' }),
      ds({ name: 'Kunde C', betrag: '0' }), ds({ betrag: '10' }), ds({ name: 'Kunde D', betrag: '5', bezahltAm: '31.12.2026' }), ds({ name: 'Kunde E', betrag: '5', faellig: 'morgen' }),
    ], heute);
    expect(e.eingaben).toEqual([{ quelle: 'Zeile 2', posten: { name: 'Lieferant X', betrag: 1190, rechnungsnr: 'L-7', datum: '2026-09-01', faellig: '2026-09-30' } }]);
    expect(e.fehler.map(f => f.text)).toEqual([expect.stringMatching(/Betrag ist 0/), expect.stringMatching(/fehlt/), expect.stringMatching(/Zukunft/), expect.stringMatching(/kein Datum/)]);
    expect(e.hinweise.join(' ')).toMatch(/Minuszeichen/);
  });

  it('Ergänzen: dieselbe Rechnung (Name + Nr.) wird aktualisiert, leere Zellen lassen den alten Wert; neue kommen dazu', () => {
    const e = postenEingaben([ds({ name: 'Kunde A', rechnungsnr: 're-1', betrag: '1500' }), ds({ name: 'Kunde A', rechnungsnr: 'RE-1', betrag: '1600' }, undefined, 'Zeile 3'), ds({ name: 'Kunde F', betrag: '50' })], heute).eingaben;
    const { zeilen, doppelt } = postenPlan(e, bisher, 'ergaenzen');
    expect(zeilen.map(z => [z.schluessel, z.status])).toEqual([['v0', 'gleich'], ['n2', 'neu']]);
    expect(doppelt).toHaveLength(1); // RE-1 zweimal in der Einfügung
    expect(zeilen[0].posten.faellig).toBe('2026-10-20');
    expect(neueListe(zeilen, bisher, 'ergaenzen', null)).toEqual([...bisher, { name: 'Kunde F', betrag: 50 }]);
    expect(neueListe(zeilen, bisher, 'ergaenzen', new Set())).toEqual(bisher); // alles abgewählt
  });

  it('Ersetzen: was fehlt, entfällt — abgewählt bleibt es stehen; Grenze nie gekürzt', () => {
    const e = postenEingaben([ds({ name: 'Kunde B', betrag: '900' })], heute).eingaben;
    const { zeilen } = postenPlan(e, bisher, 'ersetzen');
    expect(zeilen.map(z => [z.schluessel, z.status])).toEqual([['n0', 'neu'], ['x0', 'entfaellt'], ['x1', 'entfaellt']]); // ohne Nr.: Betrag gehört zum Schlüssel
    expect(neueListe(zeilen, bisher, 'ersetzen', null)).toEqual([{ name: 'Kunde B', betrag: 900 }]);
    expect(neueListe(zeilen, bisher, 'ersetzen', new Set(['n0']))).toEqual([{ name: 'Kunde B', betrag: 900 }, ...bisher]);
    expect(listeZuLang(Array.from({ length: 201 }, () => bisher[0]), 'forderungen')).toMatch(/höchstens 200/);
  });

  it('„bezahlt am“ (L34): zählt nicht mehr als offen, die Kennungen der übrigen bleiben; neue Fassung trägt alles andere mit', () => {
    const e: Eroeffnung = { id: 'er-a', firma: 'ug', stichtag: '2026-09-15', kontostand: 100, gesetztVon: 'pa', gesetztAm: '2026-10-01T00:00:00.000Z', forderungen: bisher, verbindlichkeiten: [{ name: 'Lieferant Y', betrag: 10 }] };
    const l = mitBezahlt(bisher, 0, '2026-10-05')!;
    expect(l[0]).toMatchObject({ bezahltAm: '2026-10-05' });
    expect(mitBezahlt(l, 0, null)![0].bezahltAm).toBeUndefined();
    expect(mitBezahlt(bisher, 9, '2026-10-05')).toBeNull();
    const o = offenePostenAls({ ...e, forderungen: l });
    expect(o.rechnungen.map(r => [r.id, r.kunde])).toEqual([['er-a-f2', 'Kunde B']]);
    expect(offenePostenAls(e).rechnungen[0]).toMatchObject({ id: 'er-a-f1', nummer: 'RE-1' });
    const f = fassungMit(e, 'forderungen', l);
    expect(f).toMatchObject({ firma: 'ug', stichtag: '2026-09-15', kontostand: 100, verbindlichkeiten: e.verbindlichkeiten });
    // Der Schreibweg nimmt die neuen Felder an — und prüft sie.
    const p = eroeffnungPruefen(f);
    expect(p.ok && p.daten.forderungen?.[0]).toMatchObject({ rechnungsnr: 'RE-1', bezahltAm: '2026-10-05' });
    expect(eroeffnungPruefen({ ...f, forderungen: [{ name: 'X', betrag: 1, bezahltAm: '5.10.' }] }).ok).toBe(false);
    expect(eroeffnungPruefen({ ...f, forderungen: [{ name: 'X', betrag: 1, rechnungsnr: 'R'.repeat(61) }] }).ok).toBe(false);
  });

  it('Spalten einer OP-Liste werden erkannt', () => {
    const g = tabelleLesen('Debitor;Belegnr.;Belegdatum;Offener Betrag;Fälligkeit\nKunde G;RE-9;01.09.2026;1.190,00;01.10.2026\n');
    if (!g.ok) throw new Error(g.fehler);
    const a = zeilenAufbereiten(g.zeilen, POSTEN_FELDER);
    expect(a.vorschlag).toEqual(['name', 'rechnungsnr', 'datum', 'betrag', 'faellig']);
  });
});

describe('Mandate-Tabelle', () => {
  const leistungen = [{ id: 'l-retainer', name: 'Beispiel-Retainer', typ: 'retainer' }, { id: 'l-alt', name: 'Alt', typ: 'sprint', geloeschtAm: '2026-09-01T00:00:00.000Z' }] as unknown as Leistung[];
  const register = [{ id: 'g-beispiel-holding', name: 'Beispiel Holding GmbH' }];
  it('Gesellschaft: feste über Name/Kurzname/Kennung, Register über Namen; „offen“, „privat“, Unbekanntes nie', () => {
    expect(gesellschaftAus('KD Ventures', register)).toBe('kdv');
    expect(gesellschaftAus('ug', register)).toBe('ug');
    expect(gesellschaftAus('Beispiel Holding GmbH', register)).toBe('g-beispiel-holding');
    expect(gesellschaftAus('g-beispiel-holding', register)).toBe('g-beispiel-holding');
    for (const t of ['offen', 'privat', 'Irgendwas GmbH', 'g-gibt-es-nicht']) expect(gesellschaftAus(t, register), t).toBeNull();
  });

  it('Eingaben: Vorgabe-Gesellschaft für leere Zellen, Produkt aus dem Katalog, Laufzeit in Monaten/Jahren, Status, USt', () => {
    const r = mandatEingaben([
      ds({ kunde: 'Beispiel Werke GmbH', produkt: 'Beispiel-Retainer', honorar: '4.500,00', start: '01.11.2026', laufzeit: '1 Jahr' }),
      ds({ kunde: 'Muster AG', produkt: 'Workshop XY', honorar: '1200', gesellschaft: 'MAKE', status: 'pausiert', ust: '0 %' }),
      ds({ kunde: 'Ohne Gesellschaft', gesellschaft: 'offen' }),
      ds({ kunde: 'Kaputt', honorar: 'viel' }),
      ds({ produkt: 'nur Produkt' }),
    ], { leistungen, register, vorgabe: 'kdv' });
    expect(r.eingaben[0]).toMatchObject({ kunde: 'Beispiel Werke GmbH', gesellschaft: 'kdv', leistung: { id: 'l-retainer' }, titel: 'Beispiel-Retainer', honorar: 4500, start: '2026-11-01', laufzeit: 12 });
    expect(r.eingaben[1]).toMatchObject({ gesellschaft: 'ug', titel: 'Workshop XY', status: 'pausiert', ustSatz: 0 });
    expect(r.eingaben[1].leistung).toBeUndefined();
    expect(r.fehler.map(f => f.text)).toEqual([expect.stringMatching(/unbekannt/), expect.stringMatching(/kein Honorar/), expect.stringMatching(/fehlt/)]);
    expect(r.hinweise.join(' ')).toMatch(/nicht im Katalog/);
    // Ohne Vorgabe braucht jede Zeile ihre Gesellschaft.
    expect(mandatEingaben([ds({ kunde: 'X' })], { leistungen, register, vorgabe: 'offen' }).fehler[0].text).toMatch(/Gesellschaft fehlt/);
    expect([laufzeitAus('12'), laufzeitAus('24 Monate'), laufzeitAus('2 Jahre'), laufzeitAus('0'), laufzeitAus('bald')]).toEqual([12, 24, 24, null, null]);
  });

  it('Plan: feste Kennung, Firma vorhanden/neu/Papierkorb, gleich/geändert, von Hand angelegtes → übersprungen, doppelt → Fehler', () => {
    const firmen: Firma[] = [
      { id: 'f-beispielwerke-x', name: 'Beispiel Werke', rolle: 'kunde', geaendert: '2026-09-01T00:00:00.000Z' } as Firma,
      { id: 'f-korb-y', name: 'Korb AG', rolle: 'offen', geaendert: '2026-09-01T00:00:00.000Z', geloeschtAm: '2026-10-01T00:00:00.000Z' } as Firma,
    ];
    const e = mandatEingaben([
      ds({ kunde: 'Beispiel Werke GmbH', produkt: 'Beispiel-Retainer', honorar: '4500', start: '2026-11-01' }),
      ds({ kunde: 'Neu GmbH', titel: 'Projekt', honorar: '100' }),
      ds({ kunde: 'Korb AG', titel: 'Projekt', honorar: '100' }),
      ds({ kunde: 'Neu GmbH', titel: 'Projekt', honorar: '200' }),
    ], { leistungen, register, vorgabe: 'ug' }).eingaben;
    expect(mandatKennung(e[0])).toBe(mandatKennung({ ...e[0], kunde: 'Beispiel Werke' })); // Rechtsform zählt nicht
    expect(mandatKennung(e[0])).toMatch(/^m-tab-[a-z0-9]{14}$/);
    const p = mandatPlan(e, { firmen, mandate: [] }, '2026-10-09', '2026-10-09T08:00:00.000Z');
    expect(p.zeilen.map(z => [z.status, z.firma.art])).toEqual([['neu', 'vorhanden'], ['neu', 'neu'], ['neu', 'zurueck']]);
    expect(p.doppelt).toHaveLength(1);
    // Schon da (gleiche Kennung): gleich bzw. geändert; von Hand angelegt (andere Kennung, gleiche Firma/Gesellschaft/Leistung): übersprungen.
    const da = { ...neuesMandat(mandatKennung(e[0]), e[0], firmen[0], 'Test'), geaendert: '2026-10-01T00:00:00.000Z' } as unknown as Mandat;
    expect(mandatPlan([e[0]], { firmen, mandate: [da] }, '2026-10-09', 'j').zeilen[0].status).toBe('gleich');
    const p2 = mandatPlan([{ ...e[0], honorar: 5000, laufzeit: 6 }], { firmen, mandate: [da] }, '2026-10-09', 'j').zeilen[0];
    expect(p2.status).toBe('geaendert');
    expect(p2.aenderungen.map(a => a.feld)).toEqual(['Honorar / Monat', 'Laufzeit']);
    expect(altWerte(da, { ...e[0], honorar: 5000, laufzeit: 6 })).toEqual({ honorar: { betrag: 4500, basis: 'monat', netto: true }, mindestlaufzeitMonate: '' });
    const hand = { ...da, id: 'm-von-hand', start: undefined } as unknown as Mandat;
    expect(mandatPlan([e[0]], { firmen, mandate: [hand] }, '2026-10-09', 'j').zeilen[0]).toMatchObject({ status: 'uebersprungen' });
    expect(mandatPlan([e[0]], { firmen, mandate: [{ ...da, geloeschtAm: '2026-10-02T00:00:00.000Z' } as Mandat] }, '2026-10-09', 'j').zeilen[0].text).toMatch(/Papierkorb/);
    expect(neuesMandat('m-tab-x', e[1], { id: 'f-neu', name: 'Neu GmbH' }, 'q')).toMatchObject({ gesellschaft: 'ug', status: 'aktiv', firmaId: 'f-neu', kunde: 'Neu GmbH', honorar: { betrag: 100, basis: 'monat', netto: true }, ustSatz: 19 });
  });

  it('Vorschau-Zählung', () => {
    expect(vorschauZahlen([{ schluessel: 'a', quelle: '', titel: '', status: 'neu' }, { schluessel: 'b', quelle: '', titel: '', status: 'fehler' }])).toMatchObject({ neu: 1, fehler: 1, gleich: 0 });
    expect(zuordnungVorschlag(['Kunde', 'Produkt', 'Honorar netto/Monat', 'Start', 'Laufzeit', 'Gesellschaft'], MANDAT_FELDER)).toEqual(['kunde', 'produkt', 'honorar', 'start', 'laufzeit', 'gesellschaft']);
  });
});

describe('Oberfläche: ein Baustein für alle drei Assistenten (Design-Standard, Handy)', () => {
  it('EinfuegeTabelle: Einfügefeld 16 px (kein Zoom am iPhone), Datei-Knopf, ohne Zugang nur der Hinweis', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { EinfuegeTabelle } = await import('@/components/os/ui');
    const p = { felder: MANDAT_FELDER, vorschau: async () => ({ ok: false as const }), uebernehmen: async () => ({ ok: false }) };
    const html = renderToStaticMarkup(createElement(EinfuegeTabelle, p));
    expect(html).toContain('<textarea');
    expect(html).toMatch(/font-size:16px/);
    expect(html).toContain('CSV-Datei wählen');
    expect(html).toContain('ui-knopf');
    const aus = renderToStaticMarkup(createElement(EinfuegeTabelle, { ...p, aus: 'Erst den 0-Punkt setzen.' }));
    expect(aus).toContain('ui-hinweis');
    expect(aus).not.toContain('<textarea');
  });

  it('die drei Karten hängen am Baustein und an den vorhandenen Schreibwegen (kein eigener CSV-Leser)', async () => {
    const { readFileSync } = await import('node:fs');
    const lies = (f: string) => readFileSync(f, 'utf8');
    expect(lies('components/os/business/Abschluss.tsx')).toMatch(/<EinfuegeTabelle[\s\S]*abschlussAufbereiten/);
    expect(lies('components/os/business/Eroeffnung.tsx')).toMatch(/<EinfuegeTabelle[\s\S]*POSTEN_FELDER/);
    expect(lies('components/os/mandate/ProdukteMandate.tsx')).toContain('<MandateTabelle');
    for (const f of ['components/os/ui/einfuegen.tsx', 'lib/tabelle/einfuegen.ts', 'lib/business/abschluss-tabelle.ts', 'lib/business/eroeffnung-tabelle.ts', 'lib/crm/mandate-tabelle.ts']) {
      expect(lies(f), f).not.toMatch(/\.split\((['"])[;,\t]\1\)/); // nie eine eigene Zerlegung neben csvZerlegen
    }
    // Geschrieben wird nur über die vorhandenen Wege.
    expect(lies('lib/business/abschluss-tabelle-server.ts')).toContain('speichereAbschluss');
    expect(lies('lib/business/eroeffnung-server.ts')).toMatch(/postenUebernehmen[\s\S]*speichereEroeffnung/);
    const m = lies('lib/crm/mandate-tabelle-server.ts');
    expect(m).toContain('firmaSichern');
    expect(m).toContain('wendeCrmAn');
    expect(m).not.toMatch(/updateJson[^(]*\(\s*['"]crm['"]/);
  });
});
