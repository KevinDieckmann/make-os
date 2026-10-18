// Nachprüfung 18.10. (L1b): Mandat → Liquidität. Erfundene Daten.
//   N4  Liquiditätseingänge eines Mandats = seine Monatsrechnungen (Teilmonat anteilig, EINE Regel lib/crm/mandat-laufzeit.ts)
//   N3  „Was reinkommt“ je Monat nur aus Posten, die noch zahlen; die Zeile nennt das Ende
//   N14 der richtige Satz, wenn kein (bzw. ein beendeter) Posten da ist
//   N6  „Mandat beenden“: Vorgabe und Hinweise
//   N18 Firma nicht doppelt im Namen
import { describe, it, expect } from 'vitest';
import { mandatPosten, planpostenAus, mandatLiquiLage, postenAngleichen, keinPostenGrund, beendenVorgabe, beendenHinweise, hauptPostenId, teilPostenId } from '../lib/crm/kunden';
import { geplantesEnde, leistungsmonat, mindestEnde, mandatZahlplan } from '../lib/crm/mandat-laufzeit';
import { positionAusMandat, rechnungSummen, monatsGrenzen } from '../lib/finanzen/rechnung/regeln';
import { vorschau, zahltage, letzterZahltag, monatswert, monatsSumme, postenZeitText, type Planposten } from '../lib/make-one/liquiditaet';
import { nettoAusBrutto } from '../lib/finanzen/ust';
import { mandatName, titelOhneFirma } from '../lib/crm/mandat-name';
import { mandatAusPlanposten } from '../lib/crm/mandant-link';
import type { Mandat } from '../lib/crm/typen';

const mandat = (x: Partial<Mandat> = {}): Mandat => ({
  id: 'm-1', kunde: 'Brückenwerk Beispiel GmbH', kontaktIds: [], titel: 'Retainer', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-10-18', verlaengerung: 'offen', mindestlaufzeitMonate: 6, honorar: { betrag: 4200, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich',
  zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: '2026-10-18T09:00:00Z', ...x,
} as Mandat);

const monate = (von: string, bis: string) => { const l: string[] = []; for (let m = von; m <= bis;) { l.push(m); const [j, mo] = m.split('-').map(Number); m = mo === 12 ? `${j + 1}-01` : `${j}-${String(mo + 1).padStart(2, '0')}`; } return l; };
/** Die Monatsrechnungen (brutto, Cent) eines Mandats bis zu seinem Ende — genau wie der Rechnungs-Server (Leistungsmonat + Position + Summen). */
function rechnungen(m: Mandat, ende: string): number[] {
  const mit = { ...m, ende };
  return monate(m.start!.slice(0, 7), ende.slice(0, 7)).map(mo => {
    const lm = leistungsmonat(mit, mo)!;
    const p = positionAusMandat(mit, mo, { nettoAusBrutto, anteil: lm });
    return rechnungSummen([p]).brutto;
  });
}
/** Alle Eingänge der Vorschau (Cent) über genug Wochen. */
function eingaenge(posten: Planposten[], heute: string, wochen = 110): number[] {
  const v = vorschau([], [], [], [], heute, wochen, false, posten, 'real');
  return v.wochen.flatMap(w => w.bewegungen.filter(b => b.betrag > 0).map(b => Math.round(b.betrag * 100)));
}
const summe = (l: number[]) => l.reduce((a, b) => a + b, 0);

describe('N4 · Summe der Liquiditätseingänge = Summe der Rechnungen', () => {
  const faelle: { name: string; m: Partial<Mandat>; heute: string; zahlungen: number }[] = [
    { name: 'Beginn am 1., Mindestlaufzeit 6, Ziel 14', m: { start: '2026-11-01' }, heute: '2026-10-18', zahlungen: 6 },
    { name: 'Beginn mitten im Monat (18.10.), 6 Monate, Ziel 14 — der Fund aus der Nachprüfung', m: {}, heute: '2026-10-18', zahlungen: 7 },
    { name: 'Beginn mitten im Monat, Ziel 30', m: { zahlungszielTage: 30 }, heute: '2026-10-18', zahlungen: 7 },
    { name: 'ohne Mindestlaufzeit, Ende gesetzt mitten im Monat', m: { mindestlaufzeitMonate: undefined, ende: '2027-02-10' }, heute: '2026-10-18', zahlungen: 5 },
    { name: 'Beginn und Ende im selben Monat', m: { mindestlaufzeitMonate: undefined, ende: '2026-10-25' }, heute: '2026-10-18', zahlungen: 1 },
    { name: 'Ende am Monatsletzten, Ziel 30, Beginn am 31.', m: { start: '2026-12-31', mindestlaufzeitMonate: 3, zahlungszielTage: 30 }, heute: '2026-12-01', zahlungen: 4 },
    { name: 'Brutto-Honorar, Reverse Charge', m: { honorar: { betrag: 3000, basis: 'monat', netto: false }, ustSatz: 0 }, heute: '2026-10-18', zahlungen: 7 },
    { name: 'Brutto-Honorar mit 19 %', m: { honorar: { betrag: 4999.99, basis: 'monat', netto: false }, start: '2026-10-05', mindestlaufzeitMonate: 4 }, heute: '2026-10-05', zahlungen: 5 },
  ];
  for (const f of faelle) {
    it(f.name, () => {
      const m = mandat(f.m);
      const ende = geplantesEnde(m)!;
      const r = rechnungen(m, ende);
      const posten = mandatPosten(m, f.heute);
      const e = eingaenge(posten, f.heute);
      expect(e).toHaveLength(f.zahlungen);
      expect(r).toHaveLength(f.zahlungen);
      expect(summe(e)).toBe(summe(r));
      // Je Zahlung derselbe Betrag wie die Rechnung des Monats (in der Reihenfolge der Monate).
      expect(e).toEqual(r);
    });
  }

  it('der Fall aus der Nachprüfung: anteilig Oktober + 5 volle + anteilig April (nie 7 × 4.998 €)', () => {
    const l = mandatPosten(mandat(), '2026-10-18');
    expect(l.map(p => ({ id: p.id, betrag: p.betrag, rhythmus: p.rhythmus, ab: p.ab, bis: p.bis }))).toEqual([
      { id: 'lp-mandat-m-1~2026-10', betrag: 2257.16, rhythmus: 'einmalig', ab: '2026-11-01', bis: undefined },
      { id: 'lp-mandat-m-1', betrag: 4998, rhythmus: 'monatlich', ab: '2026-11-15', bis: '2027-03-15' },
      { id: 'lp-mandat-m-1~2027-04', betrag: 2832.2, rhythmus: 'einmalig', ab: '2027-04-15', bis: undefined },
    ]);
    expect(mindestEnde(mandat())).toBe('2027-04-17');
    expect(summe(eingaenge(l, '2026-10-18'))).not.toBe(7 * 499800);
  });

  it('offene Verlängerung: Teilmonat + Monatsposten ohne Ende; die ersten Zahlungen = die ersten Rechnungen', () => {
    const m = mandat({ verlaengerung: 'auto' });
    const l = mandatPosten(m, '2026-10-18');
    expect(l.map(p => p.id)).toEqual(['lp-mandat-m-1~2026-10', 'lp-mandat-m-1']);
    expect(l[1].bis).toBeUndefined();
    const e = eingaenge(l, '2026-10-18', 30);
    expect(e.slice(0, 6)).toEqual(rechnungen(m, '2027-03-31').slice(0, 6));
  });

  it('ein laufendes Mandat (begonnen vor Monaten) bleibt wie bisher: ein Monatsposten ab dem Monatsanfang', () => {
    const p = planpostenAus(mandat({ start: '2026-05-01', verlaengerung: 'auto', mindestlaufzeitMonate: undefined }), '2026-10-17')!;
    expect(p).toMatchObject({ id: 'lp-mandat-m-1', ab: '2026-10-15', betrag: 4998, rhythmus: 'monatlich' });
    expect(mandatPosten(mandat({ start: '2026-05-01', verlaengerung: 'auto', mindestlaufzeitMonate: undefined }), '2026-10-17')).toHaveLength(1);
  });

  it('Monatsrechnung und Plan nutzen dieselbe Teilmonat-Rechnung (Position anteilig = Betrag des Teilmonat-Postens)', () => {
    const m = mandat();
    const lm = leistungsmonat({ start: m.start }, '2026-10')!;
    const pos = positionAusMandat(m, '2026-10', { nettoAusBrutto, anteil: lm });
    expect(rechnungSummen([pos]).brutto / 100).toBe(mandatZahlplan(m, '2026-10', geplantesEnde(m)).teile[0].betrag);
  });
});

describe('N4 · Zahltage: nie nach „bis“, Monatsende gekappt', () => {
  it('ein Zahltag nach „bis“ in derselben Woche zählt nicht mehr', () => {
    const p: Planposten = { id: 'p', titel: 'x', betrag: 100, rhythmus: 'monatlich', ab: '2026-01-15', bis: '2026-03-10', sicher: true };
    expect(zahltage(p, '2026-01-01', '2026-12-31')).toEqual(['2026-01-15', '2026-02-15']);
    const v = vorschau([], [], [], [], '2026-03-09', 1, false, [p], 'real');
    expect(v.summeEin).toBe(0);
  });
  it('Zahltag am 31. fällt in kurzen Monaten auf den Monatsletzten (vorher fehlte die Zahlung)', () => {
    const p: Planposten = { id: 'p', titel: 'x', betrag: 100, rhythmus: 'monatlich', ab: '2026-01-31', bis: '2026-06-30', sicher: true };
    expect(zahltage(p, '2026-01-01', '2026-12-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30']);
    expect(letzterZahltag(p)).toBe('2026-06-30');
  });
  it('Quartal und Jahr wie bisher; einmalig am Tag', () => {
    const q: Planposten = { id: 'q', titel: 'x', betrag: 300, rhythmus: 'quartal', ab: '2026-01-10', sicher: true };
    expect(zahltage(q, '2026-01-01', '2026-12-31')).toEqual(['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']);
    expect(zahltage({ ...q, rhythmus: 'einmalig' }, '2026-01-01', '2026-12-31')).toEqual(['2026-01-10']);
    expect(zahltage({ ...q, ab: 'kaputt' }, '2026-01-01', '2026-12-31')).toEqual([]);
  });
});

describe('N3 · „Was reinkommt“ je Monat und die Zeile', () => {
  const heute = '2026-11-05';
  const lauf: Planposten = { id: 'a', titel: 'Läuft', betrag: 1000, rhythmus: 'monatlich', ab: '2026-01-15', sicher: true };
  const weg: Planposten = { id: 'b', titel: 'Beendet', betrag: 4998, rhythmus: 'monatlich', ab: '2026-11-01', bis: '2026-11-01', sicher: true };
  const spaeter: Planposten = { id: 'c', titel: 'Später', betrag: 500, rhythmus: 'monatlich', ab: '2027-02-01', sicher: true };
  const quartal: Planposten = { id: 'd', titel: 'Quartal', betrag: 900, rhythmus: 'quartal', ab: '2026-10-20', sicher: true };
  const einmal: Planposten = { id: 'e', titel: 'Einmal', betrag: 200, rhythmus: 'einmalig', ab: '2026-11-20', sicher: true };
  it('zählt nur, was ab heute noch zahlt', () => {
    expect(monatswert(lauf, heute)).toBe(1000);
    expect(monatswert(weg, heute)).toBe(0);
    expect(monatswert(spaeter, heute)).toBe(0);
    expect(monatswert(quartal, heute)).toBe(300);
    expect(monatswert(einmal, heute)).toBe(0);
    expect(monatsSumme([lauf, weg, spaeter, quartal, einmal], heute)).toBe(1300);
  });
  it('die Zeile nennt Beginn, Ende bzw. „beendet“', () => {
    expect(postenZeitText(lauf, heute)).toBe('jeden Monat');
    expect(postenZeitText(weg, heute)).toBe('beendet · letzte Zahlung 01.11.');
    expect(postenZeitText(spaeter, heute)).toBe('jeden Monat · ab 01.02.27');
    expect(postenZeitText({ ...lauf, bis: '2027-03-20' }, heute)).toBe('jeden Monat · bis 15.03.27');
    expect(postenZeitText(einmal, heute)).toBe('einmalig am 20.11.');
  });
});

describe('N4/N14 · Lage im Liquiditätsplan', () => {
  const heute = '2026-10-18';
  it('fehlt → anlegen → ok; der alte Posten (7 volle) weicht ab und wird angeglichen', () => {
    const m = mandat();
    expect(mandatLiquiLage(m, [], heute).lage).toBe('fehlt');
    const soll = mandatPosten(m, heute);
    expect(mandatLiquiLage(m, postenAngleichen([], m, soll, heute), heute).lage).toBe('ok');
    const alt: Planposten = { id: 'lp-mandat-m-1', titel: 'Brückenwerk Beispiel GmbH · Retainer', betrag: 4998, rhythmus: 'monatlich', ab: '2026-11-01', bis: '2027-05-01', sicher: true, kategorie: 'mandat' };
    const l = mandatLiquiLage(m, [alt], heute);
    expect(l.lage).toBe('abweichend');
    expect(l.grund).toContain('Oktober 2026 anteilig');
    const neu = postenAngleichen([alt], m, soll, heute);
    expect(neu.map(p => p.id).sort()).toEqual(['lp-mandat-m-1', 'lp-mandat-m-1~2026-10', 'lp-mandat-m-1~2027-04']);
    expect(mandatLiquiLage(m, neu, heute).lage).toBe('ok');
    // fremde Posten bleiben unberührt
    const fremd: Planposten = { id: 'lp-x', titel: 'Miete', betrag: -900, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true };
    expect(postenAngleichen([fremd, alt], m, soll, heute)[0]).toBe(fremd);
  });

  it('beendet: „endet“, solange der Plan weiter zahlt; nach dem Angleichen „beendet“ mit dem letzten Zahltag (nie „Status oder Honorar fehlt“)', () => {
    const lauf = mandat();
    const posten = postenAngleichen([], lauf, mandatPosten(lauf, heute), heute);
    const zu = mandat({ status: 'beendet', ende: '2026-12-10' });
    const vorher = mandatLiquiLage(zu, posten, heute);
    expect(vorher.lage).toBe('endet');
    const nachher = postenAngleichen(posten, zu, mandatPosten(zu, heute, { beendet: true }), heute, { nurZeit: true });
    const l = mandatLiquiLage(zu, nachher, heute);
    expect(l.lage).toBe('beendet');
    expect(l.letzteZahlung).toBe('2026-12-15');
    expect(l.grund).toBe('Mandat beendet — letzte Zahlung im Liquiditätsplan am 15.12.2026.');
    // Rechnungen und Plan: Oktober anteilig, November voll, Dezember anteilig (1.–10.)
    expect(summe(eingaenge(nachher, heute))).toBe(summe(rechnungen(zu, '2026-12-10')));
    expect(nachher.find(p => p.id === teilPostenId(zu, '2027-04'))).toBeUndefined();
  });

  it('beendet am Tag des Beginns: der Monatsposten zahlt nichts mehr, nur der eine Tag', () => {
    const lauf = mandat();
    const posten = postenAngleichen([], lauf, mandatPosten(lauf, heute), heute);
    const zu = mandat({ status: 'beendet', ende: '2026-10-18' });
    const nachher = postenAngleichen(posten, zu, mandatPosten(zu, heute, { beendet: true }), heute, { nurZeit: true });
    expect(summe(eingaenge(nachher, heute))).toBe(summe(rechnungen(zu, '2026-10-18')));
    expect(nachher.find(p => p.id === hauptPostenId(zu))!.bis! < nachher.find(p => p.id === hauptPostenId(zu))!.ab).toBe(true);
  });

  it('kein Posten: der Satz je Fall', () => {
    expect(keinPostenGrund(mandat({ status: 'beendet' }))).toBe('Mandat beendet — kein Posten im Liquiditätsplan.');
    expect(keinPostenGrund(mandat({ honorar: { betrag: 0, basis: 'monat', netto: true } }))).toBe('Honorar fehlt — ohne Honorar kein Posten.');
    expect(keinPostenGrund(mandat({ honorar: { betrag: 900, basis: 'tag', netto: true } }))).toContain('Tagessätze');
    expect(keinPostenGrund(mandat({ status: 'pausiert' }))).toContain('Pausiert');
    expect(mandatLiquiLage(mandat({ status: 'beendet' }), [], heute)).toMatchObject({ lage: 'kein-posten', grund: 'Mandat beendet — kein Posten im Liquiditätsplan.' });
  });

  it('Teilmonat-Posten gehören zum Mandat (Link in die Mandatsakte)', () => {
    expect(mandatAusPlanposten('lp-mandat-m-1~2026-10', [])).toBe('m-1');
    expect(mandatAusPlanposten('lp-mandat-m-1', [])).toBe('m-1');
    expect(mandatAusPlanposten('lp-hand', [{ id: 'm-9', planpostenId: 'lp-hand' }])).toBe('m-9');
  });
});

describe('N6 · „Mandat beenden“: Vorgabe und Hinweise', () => {
  it('Vorgabe = letzter Tag der Laufzeit, sonst das gesetzte Ende, sonst heute', () => {
    expect(beendenVorgabe(mandat(), '2026-10-18')).toEqual({ tag: '2027-04-17', art: 'laufzeit' });
    expect(beendenVorgabe(mandat({ ende: '2026-12-31' }), '2026-10-18')).toEqual({ tag: '2026-12-31', art: 'ende' });
    expect(beendenVorgabe(mandat({ mindestlaufzeitMonate: undefined }), '2026-10-18')).toEqual({ tag: '2026-10-18', art: 'heute' });
    expect(beendenVorgabe(mandat({ start: '2025-01-01' }), '2026-10-18')).toEqual({ tag: '2026-10-18', art: 'heute' });
    // automatische Verlängerung: Ende der laufenden Periode
    expect(beendenVorgabe(mandat({ start: '2026-01-10', verlaengerung: 'auto', mindestlaufzeitMonate: 3 }), '2026-10-18').tag).toBe('2026-11-09');
  });
  it('Hinweise: vor der Mindestlaufzeit, Kündigungsfrist, Ende in der Zukunft; Fehler vor dem Beginn', () => {
    const h = beendenHinweise(mandat({ kuendigungsfristTage: 30 }), '2026-10-18', '2026-10-18');
    expect(h.fehler).toBeNull();
    expect(h.hinweise[0]).toBe('Mindestlaufzeit bis 17.04.2027 — ein früheres Ende nur, wenn der Kunde zustimmt.');
    expect(h.hinweise[1]).toContain('hätte bis 19.09.2026 gekündigt sein müssen');
    const s = beendenHinweise(mandat({ kuendigungsfristTage: 30 }), '2027-04-17', '2026-10-18');
    expect(s.hinweise).toEqual(['Kündigungsfrist 30 Tage: für ein Ende am 17.04.2027 spätestens am 19.03.2027 kündigen.', 'Bis 17.04.2027 läuft die Leistung weiter — Monatsrechnungen gehen bis dahin, der letzte Monat anteilig.']);
    expect(beendenHinweise(mandat(), '2026-10-01', '2026-10-18').fehler).toBe('Das Ende liegt vor dem Beginn (18.10.2026).');
    expect(beendenHinweise(mandat(), '', '2026-10-18').fehler).toBe('Bitte ein Ende-Datum wählen.');
  });
});

describe('N18 · Firma nicht doppelt', () => {
  it('Titel mit der Firma vorn', () => {
    expect(mandatName('Brückenwerk Beispiel GmbH', 'Brückenwerk Beispiel GmbH · Retainer')).toBe('Brückenwerk Beispiel GmbH · Retainer');
    expect(mandatName('Brückenwerk Beispiel GmbH', 'Retainer')).toBe('Brückenwerk Beispiel GmbH · Retainer');
    expect(mandatName('Brückenwerk Beispiel GmbH', 'Brückenwerk Beispiel GmbH')).toBe('Brückenwerk Beispiel GmbH');
    expect(mandatName('Acme', 'Acmeplus Retainer')).toBe('Acme · Acmeplus Retainer');
    expect(mandatName('', 'Retainer')).toBe('Retainer');
    expect(titelOhneFirma('Brückenwerk Beispiel GmbH', 'brückenwerk beispiel gmbh – Analyse')).toBe('Analyse');
  });
  it('der Posten-Titel beim Anlegen', () => {
    const p = mandatPosten(mandat({ titel: 'Brückenwerk Beispiel GmbH · Retainer' }), '2026-10-18');
    expect(p.map(x => x.titel)).toEqual(['Brückenwerk Beispiel GmbH · Retainer — Oktober 2026 anteilig', 'Brückenwerk Beispiel GmbH · Retainer', 'Brückenwerk Beispiel GmbH · Retainer — April 2027 anteilig']);
  });
  it('monatsGrenzen bleibt über die Rechnungs-Regeln erreichbar', () => {
    expect(monatsGrenzen('2027-02')).toEqual({ von: '2027-02-01', bis: '2027-02-28' });
  });
});
