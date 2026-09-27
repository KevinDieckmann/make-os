// ─── Finanzplanung jetzt — Szenario-Baukasten (erfundene, kleine Zahlen) ─────
// Bausteine → Monatsreihen → Rechenkern; Auswertung (frei, Runway, Ziele),
// Entscheidungen, Vergleich, Produkte als Quelle, Migration ohne planszenarien,
// Operationen auf planszenarien/arbeitsplan. Jede Erwartung von Hand gerechnet.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten, Szenario } from '../lib/finanzen/rechenkern';
import { rechneUG, rechnePrivat } from '../lib/finanzen/rechenkern';
import { monatsLabels, pruefeDokument, leeresDokument, wendeOperationenAn, OperationUngueltig } from '../lib/finanzen/plan/operationen';
import {
  betragImMonat, reihen, annahmenMit, rechneMit, auswertung, entscheidungen, vergleich, jetztMonat, kontostand,
  neuesPlanszenario, neuerBaustein, bausteinText, pruefeBaustein, pruefePlanszenarien, planszenarienVon, arbeitsplanVon, treiberVon,
  type Planszenario, type Baustein,
} from '../lib/finanzen/szenarien';
import { preisBasisVon, planungFehlt, margeVon, produktVorschlaege, bausteinAusProdukt, istBasisVorschlaege, produktInSzenarien } from '../lib/finanzen/produkte';
import type { Leistung, Mandat, Chance } from '../lib/crm/typen';

const HEUTE = '2026-09-27';
const JETZT = '2026-09-27T10:00:00.000Z';
const treiber = (over: Partial<Szenario> = {}): Szenario => ({
  id: 's1', name: 'Test', ob: { betrag: 1000, start: 1, laufzeit: 3 }, retainer: [], astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 },
  erhoehung: { betrag: 0, ab: 0 }, unterstuetzung: { betrag: 0, ab: 0 }, exit1: { betrag: 0, monat: 0 }, exit2: { betrag: 0, monat: 0 }, bjoernAbloesen: false, ...over,
});
function mini(over: Partial<FinanzDaten> = {}): FinanzDaten {
  return {
    version: 3, stand: HEUTE, monate: monatsLabels(2026, 10, 27), aktiv: 's1', planszenarien: [], arbeitsplan: null, schulden: [], meta: {}, abschluesse: [], historie: monatsLabels(2026, 1, 9),
    einstellungen: { heute: HEUTE, reserveMonate: 1, notgroschenMonate: 3 },
    buchungen: [], regeln: {}, ziele: [], check: { punkte: [], eintraege: [] }, notizen: {},
    annahmen: {
      kevinBrutto: 1000, kevinAb: 2, malinBrutto: 1000, malinAb: 2, agAnteil: 0.2, stammkapital: 500, gruendungskosten: 100, darlehenKevin: 0, darlehenRueckMonat: 0,
      retainerVerzug: 0, astarnaProvision: 100, steuerUG: 0.3, ust: 0.19, steuerMonat: 6, ruecklage5a: 0, holdingKosten: 0, holdingAb: 99, kdvStart: 0,
      bjoernBetrag: 0, bjoernRate: 0, bjoernRateVon: 0, bjoernRateBis: 0, bjoernSchluss: 0, bjoernSchlussMonat: 0, bjoernZinsMonat: 0, bjoernZinsDeckel: 0,
      exitSteuer: 0, nettoTabelle: [[1000, 800], [2000, 1500]], gehaltTag: 28,
    },
    sachkosten: [], privatEinnahmen: [], privatBudget: [], privatSchulden: [],
    szenarien: [treiber()],
    selbst: { posten: [], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 0 },
    posten: [], fokus: { saetze: [], regeln: [], schritte: [] }, plan: {}, ist: {}, protokoll: [],
    ...over,
  };
}
const ps = (bausteine: Baustein[] = [], annahmen: Planszenario['annahmen'] = {}): Planszenario => ({ ...neuesPlanszenario('ps1', 'Probe', 's1', JETZT), bausteine, annahmen });
const b = (teil: Partial<Baustein> & Pick<Baustein, 'art'>) => neuerBaustein(teil.id ?? 'b1', teil);

describe('betragImMonat()', () => {
  it('monatlich mit Laufzeit: Preis × Menge von Start bis Start+Laufzeit−1', () => {
    const x = b({ art: 'umsatz', preis: 100, menge: 2, start: 3, laufzeit: 4 });
    expect([2, 3, 6, 7].map(m => betragImMonat(x, m))).toEqual([0, 200, 200, 0]);
  });
  it('jährlich zahlt im Startmonat und alle 12 Monate, bis die Laufzeit endet', () => {
    const x = b({ art: 'umsatz', preis: 1200, menge: 1, rhythmus: 'jaehrlich', start: 2, laufzeit: 24 });
    expect([2, 3, 14, 26].map(m => betragImMonat(x, m))).toEqual([1200, 0, 1200, 0]);
  });
  it('einmalig nur im Startmonat; aus = 0; ohne Laufzeit bis zum Ende', () => {
    expect([4, 5, 6].map(m => betragImMonat(b({ art: 'kosten', preis: 700, rhythmus: 'einmalig', start: 5 }), m))).toEqual([0, 700, 0]);
    expect(betragImMonat(b({ art: 'umsatz', preis: 100, start: 1, an: false }), 1)).toBe(0);
    expect(betragImMonat(b({ art: 'umsatz', preis: 100, start: 1 }), 27)).toBe(100);
  });
});

describe('reihen()', () => {
  it('Umsatz UG: Leistung sofort, Eingang um das Zahlungsziel verschoben; letzte Eingänge fallen hinter der Achse weg', () => {
    const x = reihen(ps([b({ art: 'umsatz', einheit: 'ug', preis: 500, start: 1, zahlungsziel: 1 })]), 4);
    expect(x.ugUmsatz).toEqual([500, 500, 500, 500]);
    expect(x.ugEingang).toEqual([0, 500, 500, 500]);
  });
  it('Vorgabe Zahlungsziel aus den Annahmen, Stelle → Personal, Software → Sach, privat/KDV getrennt, Ausschüttung ab Monat', () => {
    const s = ps([
      b({ id: 'u', art: 'umsatz', einheit: 'ug', preis: 100, start: 1 }),
      b({ id: 'st', art: 'kosten', einheit: 'ug', kostenArt: 'stelle', preis: 1000, start: 1 }),
      b({ id: 'sw', art: 'kosten', einheit: 'ug', kostenArt: 'tool', preis: 50, start: 1 }),
      b({ id: 'r', art: 'kosten', einheit: 'privat', kostenArt: 'rate', preis: 80, start: 2 }),
      b({ id: 'pe', art: 'umsatz', einheit: 'privat', preis: 30, start: 1 }),
      b({ id: 'k', art: 'kosten', einheit: 'kdv', preis: 10, start: 1 }),
      b({ id: 'ke', art: 'umsatz', einheit: 'kdv', preis: 20, start: 1 }),
    ], { zahlungsziel: 2, ausschuettung: { betrag: 300, ab: 3 } });
    const x = reihen(s, 4);
    expect(x.ugUmsatz).toEqual([100, 100, 100, 100]); expect(x.ugEingang).toEqual([0, 0, 100, 100]);
    expect(x.ugPersonal).toEqual([1000, 1000, 1000, 1000]); expect(x.ugSach).toEqual([50, 50, 50, 50]);
    expect(x.privatAus).toEqual([0, 80, 80, 80]); expect(x.privatEin).toEqual([30, 30, 30, 30]);
    expect(x.kdvAus).toEqual([10, 10, 10, 10]); expect(x.kdvEin).toEqual([20, 20, 20, 20]);
    expect(x.ausschuettung).toEqual([0, 0, 300, 300]);
  });
});

describe('Kern mit Zusatz — rechneMit() gegen den reinen Treiber', () => {
  const d = mini();
  const basis = rechneMit(d, null);
  it('ohne Planszenario rechnet der Kern exakt wie bisher (kein Zusatz)', () => {
    const ug = rechneUG(d, d.szenarien[0]); const pr = rechnePrivat(d, ug, d.szenarien[0]);
    expect(basis.ug).toEqual(ug); expect(basis.pr).toEqual(pr);
    expect(basis.ug[0]).toMatchObject({ umsatz: 1000, einzahlungen: 1500, gewinn: 900, konto: 1400, frei: 1130, stellen: 0, bausteineUmsatz: 0, ausschuettung: 0 });
  });
  it('Umsatzbaustein 500 UG ohne Zahlungsziel: Umsatz, USt, Kasse, Gewinn und frei — von Hand', () => {
    const g = rechneMit(d, ps([b({ art: 'umsatz', einheit: 'ug', preis: 500, start: 1 })]));
    // Umsatz 1000+500; USt 500·0,19 = 95; Einzahlungen 500 Kapital + 1000 + 500 + 95 = 2095; Gewinn 1500−100 = 1400
    // Konto 2095 − 100 Gründung = 1995; Rücklage 0,3·1400 = 420; frei = 1995 − 420 − 95 = 1480
    expect(g.ug[0]).toMatchObject({ umsatz: 1500, bausteineUmsatz: 500, bausteineEingang: 500, ustEin: 95, einzahlungen: 2095, gewinn: 1400, konto: 1995, frei: 1480 });
  });
  it('Zahlungsziel 1: Leistung im Gewinn sofort, Geld einen Monat später', () => {
    const g = rechneMit(d, ps([b({ art: 'umsatz', einheit: 'ug', preis: 500, start: 1, zahlungsziel: 1 })]));
    expect(g.ug[0]).toMatchObject({ umsatz: 1500, bausteineEingang: 0, ustEin: 0, einzahlungen: 1500, gewinn: 1400 });
    expect(g.ug[1].bausteineEingang).toBe(500);
  });
  it('Stelle 1000 brutto ab Monat 2 kostet 1200 (Arbeitgeberanteil) und drückt den Gewinn; Software geht in die Sachkosten', () => {
    const g = rechneMit(d, ps([b({ id: 'st', art: 'kosten', einheit: 'ug', kostenArt: 'stelle', preis: 1000, start: 2 }), b({ id: 'sw', art: 'kosten', einheit: 'ug', kostenArt: 'tool', preis: 50, start: 2 })]));
    expect(g.ug[1].stellen).toBe(1200); expect(g.ug[1].bausteineSach).toBe(50); expect(g.ug[1].sach).toBe(50);
    expect(g.ug[1].gewinn).toBe(basis.ug[1].gewinn - 1250);
    expect(g.ug[0].gewinn).toBe(basis.ug[0].gewinn);
  });
  it('Ausschüttung 300 ab Monat 1: UG-Kasse −300 je Monat, nicht im Gewinn; privat +300 verfügbar und Luft', () => {
    const g = rechneMit(d, ps([], { ausschuettung: { betrag: 300, ab: 1 } }));
    expect(g.ug[0].konto).toBe(basis.ug[0].konto - 300); expect(g.ug[0].gewinn).toBe(basis.ug[0].gewinn);
    expect(g.pr[0].ausschuettung).toBe(300); expect(g.pr[0].verfuegbar).toBe(basis.pr[0].verfuegbar + 300); expect(g.pr[0].luft).toBe(basis.pr[0].luft + 300);
  });
  it('Private Bausteine: Rate mindert die Luft, private Einnahme erhöht sie; KDV-Bausteine bewegen das KDV-Konto', () => {
    const g = rechneMit(d, ps([b({ id: 'r', art: 'kosten', einheit: 'privat', kostenArt: 'rate', preis: 80, start: 1 }), b({ id: 'e', art: 'umsatz', einheit: 'privat', preis: 30, start: 1 }), b({ id: 'k', art: 'umsatz', einheit: 'kdv', preis: 20, start: 1 })]));
    expect(g.pr[0].luft).toBe(basis.pr[0].luft - 80 + 30);
    expect(g.ug[0].kdvKonto).toBe(basis.ug[0].kdvKonto + 20); expect(g.ug[2].kdvKonto).toBe(basis.ug[2].kdvKonto + 60);
  });
  it('Szenario-Annahmen überlagern: Steuerquote 0,5 → Rücklage 450, frei 950; Kevin brutto 2000 → 2400 Personalkosten ab Monat 2', () => {
    const g = rechneMit(d, ps([], { steuerUG: 0.5, kevinBrutto: 2000 }));
    expect(g.ug[0]).toMatchObject({ steuerRuecklage: 450, frei: 950 });
    expect(g.ug[1].kevin).toBe(2400); expect(g.ug[1].malin).toBe(1200);
    expect(annahmenMit(d.annahmen, { steuerUG: 2 }).steuerUG).toBe(1);
    expect(annahmenMit(d.annahmen, undefined)).toBe(d.annahmen);
  });
  it('treiberVon: Basis des Planszenarios, sonst der aktive; unbekannte Basis fällt auf den aktiven', () => {
    const dd = mini({ szenarien: [treiber(), treiber({ id: 's2', name: 'Zwei' })], aktiv: 's2' });
    expect(treiberVon(dd, null).id).toBe('s2');
    expect(treiberVon(dd, { ...ps(), basis: 's1' }).id).toBe('s1');
    expect(treiberVon(dd, { ...ps(), basis: 'gibtsnicht' }).id).toBe('s2');
    expect(rechneMit(dd, null, dd.szenarien[0]).sz.id).toBe('s1');
  });
});

describe('auswertung() und entscheidungen()', () => {
  const d = mini({
    posten: [{ id: 'k1', art: 'konto', einheit: 'privat', name: 'Giro', betrag: 2000, status: 'offen' }, { id: 'k2', art: 'konto', einheit: 'privat', name: 'Spar', betrag: null, status: 'offen' }, { id: 'k3', art: 'konto', einheit: 'ug', name: 'UG', betrag: 99, status: 'offen' }],
    ziele: [{ id: 'z1', name: 'Notgroschen', quelle: 'privat.angespart', ziel: 1000, bis: '2027-12', einheit: 'privat' }, { id: 'z2', name: 'Unmöglich', quelle: 'ug.frei', ziel: 9e9, bis: '2027-06', einheit: 'ug' }],
  });
  const g = rechneMit(d, null);
  const aw = auswertung(g.d, g.ug, g.pr);
  it('„jetzt“ ist Plan-Monat 1, solange heute vor Okt 26 liegt; Kontostände privat: bekannt und fehlend getrennt', () => {
    expect(jetztMonat(d)).toBe(1);
    expect(jetztMonat({ ...d, einstellungen: { ...d.einstellungen, heute: '2027-01-15' } })).toBe(4);
    expect(kontostand(d, 'privat')).toEqual({ summe: 2000, bekannt: 1, fehlen: 1 });
    expect(aw.frei.privatKonten).toBe(2000); expect(aw.frei.kontenFehlen).toBe(1);
  });
  it('frei verfügbar = UG frei + KDV + (private Konten + Luft dieses Monats)', () => {
    expect(aw.frei.ug).toBe(g.ug[0].frei); expect(aw.frei.privat).toBe(2000 + g.pr[0].luft);
    expect(aw.frei.gesamt).toBe(g.ug[0].frei + g.ug[0].kdvKonto + 2000 + g.pr[0].luft);
  });
  it('Runway UG: Monate ab jetzt bis frei unter null; danach ist frei wirklich negativ, davor nicht', () => {
    const r = aw.runway.ug; expect(r).not.toBeNull();
    expect(g.ug[r!].frei).toBeLessThan(0);
    for (let i = 0; i < r!; i++) expect(g.ug[i].frei).toBeGreaterThanOrEqual(0);
    expect(aw.runway.horizont).toBe(27);
  });
  it('Ziele: im Plan + knapp + gekippt = alle; das Unmögliche kippt', () => {
    expect(aw.ziele.gesamt).toBe(2); expect(aw.ziele.imPlan + aw.ziele.knapp + aw.ziele.gekippt).toBe(2);
    expect(aw.ziele.staende.find(z => z.ziel.id === 'z2')?.status).toBe('verfehlt'); expect(aw.ziele.gekippt).toBeGreaterThanOrEqual(1);
  });
  it('Mindestumsatz = Personal + Stellen + Sach + Holding; Monat 1 ohne Gehälter = 0, Ø 12 Monate = 11·2400/12 = 2200', () => {
    expect(aw.mindestumsatz.jetzt).toBe(0); expect(aw.mindestumsatz.schnitt12).toBeCloseTo(2200, 6);
    expect(aw.mindestumsatz.umsatzSchnitt12).toBeCloseTo(3000 / 12, 6);
  });
  it('Steuer: Rücklage jetzt; nächste Zahlung nur bei Gewinn im Vorjahr (Juni 27 = Monat 9)', () => {
    expect(aw.steuer.ruecklage).toBe(g.ug[0].steuerRuecklage);
    // Basis: 900 − 1400 − 1400 = −1900 Gewinn 2026 → keine Ertragsteuer im Planzeitraum vor 2028
    expect(aw.steuer.naechsteZahlung).toBeNull();
    const gg = rechneMit(d, ps([b({ art: 'umsatz', einheit: 'ug', preis: 5000, start: 1 })]));
    const aw2 = auswertung(gg.d, gg.ug, gg.pr);
    // 2026: 5900 + 3600 + 3600 = 13.100 Gewinn → 0,3 · 13.100 = 3.930 im Juni 27
    expect(aw2.steuer.naechsteZahlung).toEqual({ monat: 9, betrag: 3930 });
  });
  it('Entscheidungen: kritisch zuerst, ohne Arbeitsplan der Hinweis dazu, mit Arbeitsplan nicht; höchstens max', () => {
    const e = entscheidungen(d, { ug: g.ug, pr: g.pr, ps: null }, aw);
    expect(e[0].stufe).toBe('kritisch'); expect(e[0].id).toBe('ug-minus'); expect(e[0].ziel).toEqual({ u: 'planen', params: { feld: 'umsatz' } });
    expect(e.some(x => x.id === 'arbeitsplan')).toBe(true);
    expect(e.some(x => x.id === 'konten')).toBe(true);
    expect(e.some(x => x.id.startsWith('ziel-'))).toBe(true);
    for (let i = 1; i < e.length; i++) expect(['kritisch', 'achtung', 'info'].indexOf(e[i].stufe)).toBeGreaterThanOrEqual(['kritisch', 'achtung', 'info'].indexOf(e[i - 1].stufe));
    const mit = entscheidungen(d, { ug: g.ug, pr: g.pr, ps: ps() }, aw, 2);
    expect(mit).toHaveLength(2); expect(mit.some(x => x.id === 'arbeitsplan')).toBe(false);
    expect(mit[0].ziel.params).toEqual({ sz: 'ps1', feld: 'umsatz' });
  });
  it('Vergleich: Basis + Szenarien nebeneinander, höchstens drei, mit eigener Auswertung', () => {
    const v = vergleich(d, [null, ps([b({ art: 'umsatz', einheit: 'ug', preis: 5000, start: 1 })]), ps(), ps()]);
    expect(v).toHaveLength(3); expect(v[0].name).toBe('Basis'); expect(v[0].id).toBeNull(); expect(v[1].name).toBe('Probe');
    expect(v[1].g.kz.minFrei).toBeGreaterThan(v[0].g.kz.minFrei);
    expect(v[1].aw.frei.gesamt).toBeGreaterThan(v[0].aw.frei.gesamt);
  });
});

describe('Produkte als Quelle (lib/finanzen/produkte.ts)', () => {
  const leistung = (over: Partial<Leistung> = {}): Leistung => ({ id: 'l1', name: 'Retainer Kern', typ: 'retainer', stufe: 'kern', preis: { betrag: 1500, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: JETZT, ...over });
  it('Basis aus der Einheit, wenn nicht gesetzt; gesetzt gewinnt; unbekannt = null', () => {
    expect(preisBasisVon(leistung())).toBe('monat');
    expect(preisBasisVon(leistung({ preis: { betrag: 1, einheit: 'pro Jahr' } }))).toBe('jahr');
    expect(preisBasisVon(leistung({ preis: { betrag: 1, einheit: 'Pauschal' } }))).toBe('einmalig');
    expect(preisBasisVon(leistung({ preis: { betrag: 1, einheit: '???' } }))).toBeNull();
    expect(preisBasisVon(leistung({ preis: { betrag: 1, einheit: 'Monat', basis: 'einmalig' } }))).toBe('einmalig');
  });
  it('planungFehlt nennt, was fehlt; Marge aus Aufwandsanteil', () => {
    expect(planungFehlt(leistung())).toEqual(['Laufzeit']);
    expect(planungFehlt(leistung({ laufzeitMonate: 12 }))).toEqual([]);
    expect(planungFehlt(leistung({ preis: { betrag: 0, einheit: '?' }, gesellschaft: 'offen' }))).toEqual(['Preis', 'Basis (Monat · Jahr · einmalig)', 'Laufzeit', 'Gesellschaft']);
    expect(planungFehlt(leistung({ preis: { betrag: 900, einheit: 'Pauschal' } }))).toEqual([]);
    expect(margeVon(leistung({ aufwand: { anteil: 0.4 } }))).toEqual({ kosten: 600, marge: 900, anteil: 0.4 });
    expect(margeVon(leistung())).toBeNull();
  });
  it('Vorschläge und Baustein aus Produkt: Preis, Rhythmus, Laufzeit, Einheit vorbelegt — überschreibbar', () => {
    const crm = { leistungen: [leistung({ laufzeitMonate: 12 }), leistung({ id: 'l2', name: 'Alt', status: 'eingestellt' }), leistung({ id: 'l3', name: 'Workshop', typ: 'workshop', status: 'entwurf', gesellschaft: 'kdv', preis: { betrag: 900, einheit: 'Pauschal' } })] };
    const v = produktVorschlaege(crm);
    expect(v.map(x => x.id)).toEqual(['l1', 'l3']);
    const bs = bausteinAusProdukt('b9', v[0], { start: 3, menge: 2 });
    expect(bs).toMatchObject({ art: 'umsatz', einheit: 'ug', produktId: 'l1', produkt: 'Retainer Kern', preis: 1500, menge: 2, rhythmus: 'monatlich', start: 3, laufzeit: 12, an: true });
    const ws = bausteinAusProdukt('b8', v[1]);
    expect(ws).toMatchObject({ einheit: 'kdv', rhythmus: 'einmalig', preis: 900 }); expect(ws.laufzeit).toBeUndefined();
    expect(bausteinText(bs, monatsLabels(2026, 10, 27))).toBe('Retainer Kern · 2 × 1.500 € monatlich · ab Dez 26 · 12 Monate');
  });
  it('Ist-Basis aus aktiven Mandaten und gewonnenen Deals ohne Mandat', () => {
    const mandat = { id: 'm1', kunde: 'Muster AG', kontaktIds: [], titel: 'Begleitung', art: 'retainer', leistungId: 'l1', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true, start: '2026-11-01', verlaengerung: 'auto', honorar: { betrag: 2000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: JETZT } as unknown as Mandat;
    const deal = { id: 'c1', titel: 'Deal X', kontaktIds: [], firma: 'Beispiel GmbH', art: 'projekt', leistungId: 'l1', wert: { betrag: 5000, basis: 'einmalig' }, stufe: 'gewonnen', historie: [], gesellschaft: 'ug' } as unknown as Chance;
    const dealMitMandat = { ...deal, id: 'c2' } as Chance;
    const v = istBasisVorschlaege({ mandate: [mandat, { ...mandat, id: 'm2', status: 'beendet' } as Mandat, { ...mandat, id: 'm3', chanceId: 'c2' } as Mandat], chancen: [deal, dealMitMandat], leistungen: [leistung({ laufzeitMonate: 12 })] }, HEUTE);
    expect(v.map(x => `${x.quelle}:${x.quelleId}`)).toEqual(['mandat:m1', 'mandat:m3', 'deal:c1']);
    expect(v[0]).toMatchObject({ kunde: 'Muster AG', produktId: 'l1', betrag: 2000, rhythmus: 'monatlich', laufzeit: 12, start: 2 });
    expect(v[2]).toMatchObject({ kunde: 'Beispiel GmbH', betrag: 5000, rhythmus: 'einmalig', start: 1 });
  });
  it('produktInSzenarien zählt Mengen je Produkt und markiert den Arbeitsplan', () => {
    const a = { ...ps([b({ id: 'x', art: 'umsatz', produktId: 'l1', preis: 1, menge: 2, start: 1 }), b({ id: 'y', art: 'umsatz', produktId: 'l1', preis: 1, menge: 1, start: 1, an: false })]), id: 'a', name: 'A' };
    const c = { ...ps([b({ id: 'z', art: 'umsatz', produktId: 'l1', preis: 1, menge: 3, start: 1 })]), id: 'c', name: 'C' };
    expect(produktInSzenarien([a, c], 'c')).toEqual({ l1: [{ id: 'a', name: 'A', arbeitsplan: false, menge: 2 }, { id: 'c', name: 'C', arbeitsplan: true, menge: 3 }] });
  });
});

describe('Migration und Prüfung', () => {
  it('älteres Dokument ohne planszenarien/arbeitsplan läuft: leer und null', () => {
    const roh = leeresDokument(HEUTE) as unknown as Record<string, unknown>;
    delete roh.planszenarien; delete roh.arbeitsplan;
    const p = pruefeDokument(roh);
    expect(p.ok).toBe(true);
    if (p.ok) { expect(p.dokument.planszenarien).toEqual([]); expect(p.dokument.arbeitsplan).toBeNull(); expect(planszenarienVon(p.dokument)).toEqual([]); expect(arbeitsplanVon(p.dokument)).toBeNull(); }
  });
  it('Planszenarien werden bereinigt: Unbrauchbares fällt weg, unbekannte Basis → erster Treiber, Arbeitsplan auf Unbekanntes → null', () => {
    const roh = leeresDokument(HEUTE) as unknown as Record<string, unknown>;
    roh.planszenarien = [
      { id: 'ok', name: 'Gut', basis: 'gibtsnicht', bausteine: [{ id: 'b1', art: 'umsatz', preis: '12', start: 0 }, 'müll', { art: 'kosten' }], annahmen: { steuerUG: 0.25, zahlungsziel: 'x', ausschuettung: { betrag: 100 } } },
      { id: 'ok', name: 'Doppelt' }, 'kein Objekt', { name: 'ohne id' },
    ];
    roh.arbeitsplan = 'unbekannt';
    const p = pruefeDokument(roh);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.dokument.planszenarien).toHaveLength(1);
    const s = p.dokument.planszenarien![0];
    expect(s.basis).toBe('basis'); expect(s.bausteine).toHaveLength(1);
    expect(s.bausteine[0]).toMatchObject({ id: 'b1', art: 'umsatz', einheit: 'ug', preis: 0, menge: 1, start: 1, an: true, rhythmus: 'monatlich' });
    expect(s.annahmen).toEqual({ steuerUG: 0.25, ausschuettung: { betrag: 100, ab: 1 } });
    expect(p.dokument.arbeitsplan).toBeNull();
    expect(pruefePlanszenarien('nix', ['basis'])).toEqual([]);
    expect(pruefeBaustein({ id: 'k', art: 'kosten', kostenArt: 'quatsch', einheit: 'privat', preis: 5, laufzeit: 3.4, zahlungsziel: 1 })).toMatchObject({ kostenArt: 'sonstiges', einheit: 'privat', laufzeit: 3, zahlungsziel: 1 });
  });
  it('gültige Planszenarien überstehen die Prüfung unverändert', () => {
    const d = leeresDokument(HEUTE);
    const s = ps([b({ art: 'umsatz', einheit: 'ug', preis: 500, menge: 2, start: 3, laufzeit: 12, kunde: 'K', produkt: 'P', produktId: 'l1', zahlungsziel: 1, notiz: 'n' })], { kevinBrutto: 3000, ausschuettung: { betrag: 200, ab: 4 } });
    s.basis = 'basis';
    d.planszenarien = [s]; d.arbeitsplan = 'ps1';
    const p = pruefeDokument(d);
    expect(p.ok && p.dokument.planszenarien).toEqual([s]);
    expect(p.ok && p.dokument.arbeitsplan).toBe('ps1');
  });
});

describe('Operationen auf planszenarien und arbeitsplan', () => {
  const basisDok = () => { const d = leeresDokument(HEUTE); d.planszenarien = [{ ...ps(), basis: 'basis' }]; return d; };
  it('anlegen, Baustein anhängen, Feld ändern, Arbeitsplan setzen — mit lesbarem Protokoll', () => {
    const d = basisDok();
    const neu = { ...neuesPlanszenario('ps2', 'Zwei', 'basis', JETZT) };
    const r = wendeOperationenAn(d, [
      { pfad: '/planszenarien/-', neu },
      { pfad: '/planszenarien/id=ps2/bausteine/-', neu: b({ id: 'b7', art: 'umsatz', preis: 100, start: 1 }) },
      { pfad: '/planszenarien/id=ps2/bausteine/id=b7/preis', alt: 100, neu: 250, feld: 'Zwei · Baustein · Preis' },
      { pfad: '/arbeitsplan', alt: null, neu: 'ps2' },
    ], 'kevin', JETZT);
    expect(r.dokument.planszenarien).toHaveLength(2);
    expect(r.dokument.planszenarien![1].bausteine[0].preis).toBe(250);
    expect(r.dokument.arbeitsplan).toBe('ps2');
    expect(r.protokoll[2]).toMatchObject({ feld: 'Zwei · Baustein · Preis', alt: '100', neu: '250' });
    expect(arbeitsplanVon(r.dokument)?.name).toBe('Zwei');
  });
  it('Arbeitsplan auf Unbekanntes → Fehler; doppelte Kennung → Fehler; null hebt auf', () => {
    const d = basisDok();
    expect(() => wendeOperationenAn(d, [{ pfad: '/arbeitsplan', neu: 'nix' }], 'kevin', JETZT)).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(d, [{ pfad: '/arbeitsplan/x', neu: 'ps1' }], 'kevin', JETZT)).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(d, [{ pfad: '/planszenarien/-', neu: { ...ps() } }], 'kevin', JETZT)).toThrow(OperationUngueltig);
    d.arbeitsplan = 'ps1';
    expect(wendeOperationenAn(d, [{ pfad: '/arbeitsplan', alt: 'ps1', neu: null }], 'kevin', JETZT).dokument.arbeitsplan).toBeNull();
  });
  it('gelöschter Arbeitsplan → null; gelöschter Treiber zieht die Basis der Planszenarien auf den aktiven', () => {
    const d = basisDok(); d.arbeitsplan = 'ps1';
    const r = wendeOperationenAn(d, [{ pfad: '/planszenarien/id=ps1', alt: 'Probe' }], 'malin', JETZT);
    expect(r.dokument.planszenarien).toEqual([]); expect(r.dokument.arbeitsplan).toBeNull();
    const dd = basisDok(); dd.szenarien.push(treiber({ id: 's9', name: 'Neun' })); dd.planszenarien![0].basis = 's9';
    const r2 = wendeOperationenAn(dd, [{ pfad: '/szenarien/id=s9', alt: 'Neun' }], 'malin', JETZT);
    expect(r2.dokument.planszenarien![0].basis).toBe('basis');
  });
});
