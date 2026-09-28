// ─── Finanzen: eine Einheitenliste — Summen-Regression (28.09.) ─────────────
// Kevin: „Finanzen: eine Einheitenliste.“ Vor dem Umbau (sechs Listen →
// lib/einheiten.ts) sind hier die HEUTIGEN Ergebnisse mit erfundenen Beispiel-
// daten festgehalten — Cockpit (Business-Index), Steuern, Finanzplanung
// (Szenarien/Baukasten), Liquidität, Privat-Finanzen und Buchungen. Nach dem
// Umbau müssen dieselben Zahlen herauskommen. Wo sich eine Summe JE EINHEIT
// bewusst verschiebt, steht es am Test (und im Bericht); die Gesamtsumme bleibt.
// Alle Beträge sind ausgedacht.
import { describe, it, expect } from 'vitest';
import { berechne } from '../lib/business/index';
import { istMonate, type Bestand } from '../lib/business/messen';
import { geschaeftsmodell } from '../lib/business/modell';
import { STANDARD_STEUERN, fristen, ustZeitraum, zeitraumVon, prognose, jahresgewinn, belegPunkte, uebergabeMonat } from '../lib/steuern/rechnen';
import type { FinanzDaten, Szenario } from '../lib/finanzen/rechenkern';
import { monatsLabels } from '../lib/finanzen/plan/operationen';
import { rechneMit, auswertung, neuesPlanszenario, neuerBaustein, kontostand, type Baustein, type Planszenario } from '../lib/finanzen/szenarien';
import { vorschau, type Planposten } from '../lib/make-one/liquiditaet';
import { testHaushalt } from '../lib/finanzen/haushalt/testdaten';
import { privatFaktoren } from '../lib/finanzen/haushalt/score';
import { bruecke } from '../lib/finanzen/haushalt/gesamt';
import { wichtig } from '../lib/finanzen/haushalt/kennzahlen';
import { katNamen } from '../lib/finanzen/haushalt/einordnung';
import type { Beleg, Buchung, Haushalt, Schuld } from '../lib/finanzen/haushalt/typen';
import { buchungFuer, type Rechnung as FpRechnung } from '../lib/finanzen/finanzplan-bestand';
import type { Mandat, Chance, Leistung } from '../lib/crm/typen';

const HEUTE = '2026-09-25';
const J = '2026-09-25T10:00:00.000Z';
const r2 = (n: number) => Math.round(n * 100) / 100;
const summe = (l: number[]) => r2(l.reduce((s, x) => s + x, 0));

// ── Gemeinsame erfundene Firmen-Daten (kdc · kdv · ug · privat · ohne Firma) ──
const firmen = [
  { id: 'kdc', name: 'Beispiel Consulting', kontostand: 12000, stand: '2026-09-20' },
  { id: 'kdv', name: 'Beispiel Ventures', kontostand: 8000, stand: '2026-09-18' },
  { id: 'ug', name: 'Beispiel UG', kontostand: 3000, stand: '2026-09-22' },
  { id: 'privat', name: 'Privat', kontostand: 999, stand: '2026-09-22' },
];
const rechnungen = [
  { id: 'r1', kunde: 'Kunde A', titel: 'Retainer', betrag: 1190, status: 'bezahlt', datum: '2026-07-01', bezahltAm: '2026-07-20', faellig: '2026-07-15', ustSatz: 19, nummer: 'RE-1', firmaId: 'kdc' },
  { id: 'r2', kunde: 'Kunde B', titel: 'Workshop', betrag: 2380, status: 'gestellt', datum: '2026-09-01', faellig: '2026-09-15', ustSatz: 19, nummer: 'RE-2', firmaId: 'kdc' },
  { id: 'r3', kunde: 'Kunde C', titel: 'Beteiligung', betrag: 5950, status: 'gestellt', datum: '2026-09-10', faellig: '2026-10-10', ustSatz: 19, nummer: 'RE-3', firmaId: 'kdv' },
  { id: 'r4', kunde: 'Kunde D', titel: 'Lizenz', betrag: 1190.5, status: 'gestellt', datum: '2026-09-12', faellig: '2026-10-12', ustSatz: 19, nummer: 'RE-4', firmaId: 'ug' },
  { id: 'r5', kunde: 'Kunde E', titel: 'Lizenz', betrag: 595, status: 'bezahlt', datum: '2026-08-01', bezahltAm: '2026-08-20', ustSatz: 19, firmaId: 'ug' },
  { id: 'r6', kunde: 'Kunde F', titel: 'Alt ohne Firma', betrag: 476, status: 'gestellt', datum: '2026-09-05', faellig: '2026-09-30' },
  { id: 'r7', kunde: 'Privat', titel: 'privat', betrag: 100, status: 'gestellt', datum: '2026-09-05', firmaId: 'privat' },
  { id: 'r8', kunde: 'Kunde G', titel: 'geplant', betrag: 3000, status: 'geplant', faellig: '2026-11-01', firmaId: 'kdc' },
  { id: 'r9', kunde: 'Kunde H', titel: 'storniert', betrag: 800, status: 'storniert', datum: '2026-09-02', firmaId: 'ug' },
];
const planposten: Planposten[] = [
  { id: 'p1', titel: 'Miete Büro', betrag: -900, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'kdc', kategorie: 'miete' },
  { id: 'p2', titel: 'Software', betrag: -300, rhythmus: 'quartal', ab: '2026-01-01', sicher: true, firmaId: 'kdv', kategorie: 'software' },
  { id: 'p3', titel: 'Hosting', betrag: -120, rhythmus: 'monatlich', ab: '2026-02-01', sicher: true, firmaId: 'ug', kategorie: 'software' },
  { id: 'p4', titel: 'Versicherung', betrag: -600, rhythmus: 'jaehrlich', ab: '2026-03-01', sicher: true },
  { id: 'p5', titel: 'Privat', betrag: -1000, rhythmus: 'monatlich', ab: '2026-01-01', sicher: true, firmaId: 'privat' },
  { id: 'p6', titel: 'Förderung', betrag: 2000, rhythmus: 'einmalig', ab: '2026-10-15', sicher: false, firmaId: 'ug' },
];
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });
const chance = (id: string, stufe: Chance['stufe'], x: Partial<Chance> = {}): Chance => ({ id, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 10000, basis: 'einmalig' }, stufe, historie: [{ stufe, am: '2026-08-01T10:00:00.000Z' }], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: J, ...x } as Chance);
const mandate: Mandat[] = [
  mandat('m1', { gesellschaft: 'kdc', honorar: { betrag: 3000, basis: 'monat', netto: true } }),
  mandat('m2', { gesellschaft: 'kdc', honorar: { betrag: 1500, basis: 'monat', netto: true } }),
  mandat('m3', { gesellschaft: 'kdv', honorar: { betrag: 2000, basis: 'monat', netto: true } }),
  mandat('m4', { gesellschaft: 'ug', honorar: { betrag: 800, basis: 'monat', netto: true } }),
  mandat('m5', { gesellschaft: 'ug', honorar: { betrag: 5000, basis: 'einmalig', netto: true } }),
  mandat('m6', { gesellschaft: 'offen', honorar: { betrag: 400, basis: 'monat', netto: true } }),
];
const chancen: Chance[] = [
  chance('c1', 'gewonnen', { gesellschaft: 'kdc' }), chance('c2', 'verloren', { gesellschaft: 'kdc' }), chance('c3', 'angebot', { gesellschaft: 'kdv' }),
  chance('c4', 'gewonnen', { gesellschaft: 'ug' }), chance('c5', 'bedarf', { gesellschaft: 'ug' }),
];
const monate = (von: number, bis: number, u: number, k: number) => Array.from({ length: bis - von + 1 }, (_, i) => ({ monat: `2026-${String(von + i).padStart(2, '0')}`, umsatzNetto: u, kostenNetto: k }));

function bestand(scope: Bestand['scope']): Bestand {
  return {
    heute: HEUTE, scope, firmen, rechnungen, zahlungen: [{ id: 'z1', an: 'Lieferant', titel: 'Rechnung', betrag: 500, status: 'offen', faellig: '2026-10-05', firmaId: 'kdc' }],
    merkposten: [], planposten, finance: { jahr: 2026, zielUmsatz: 240000, zielGewinn: 0, cash: 0, months: Array.from({ length: 12 }, (_, i) => ({ m: String(i), umsatz: i < 3 ? 15000 : 0, kosten: i < 3 ? 9000 : 0 })) },
    grundlageMonate: monate(1, 7, 11000, 6500), grundlageFixkosten: { kdc: 1400, kdv: 350 },
    abschluesse: [
      { firma: 'kdc', monat: '2026-08', umsatz: 12500, kosten: 7000, personal: 2500, marketingVertrieb: 400, fakturierteTage: 12, eigenkapital: 20000, bilanzsumme: 50000, kurzfrVerbindlichkeiten: 6000 },
      { firma: 'kdv', monat: '2026-08', umsatz: 2000, kosten: 900, eigenkapital: 30000, bilanzsumme: 60000, kurzfrVerbindlichkeiten: 2000 },
      { firma: 'kdv', monat: '2026-07', umsatz: 1800, kosten: 850 },
    ],
    mandate, chancen, traktion: { score: 55, text: 'Beispiel' },
    termine: [], termineVollstaendig: true, bloecke: [], auftraege: [], meilensteine: [],
    fte: { kdc: 1.5, kdv: 0.5 }, mrrVerlauf: {}, ziele: { kdc: 150000, kdv: 30000 }, kapazitaet: { kdc: 15 },
  };
}
const werteVon = (bi: ReturnType<typeof berechne>) => Object.fromEntries(bi.saeulen.flatMap(s => s.kennzahlen.map(k => [k.id, k.wert == null ? null : r2(k.wert)])));

describe('Cockpit (Business-Index) — Summen je Sicht bleiben', () => {
  it('Gesamt · Selbstständigkeit · KD Ventures: Index und jede Kennzahl wie vor dem Umbau', () => {
    const ergebnis = Object.fromEntries((['gesamt', 'kdc', 'kdv'] as const).map(s => { const bi = berechne(bestand(s)); return [s, { index: bi.index, werte: werteVon(bi) }]; }));
    expect(ergebnis).toMatchInlineSnapshot(`
      {
        "gesamt": {
          "index": 76,
          "werte": {
            "auslastung": 80,
            "bereich_zeit": null,
            "bewusst_woche": null,
            "break_even": 81.8,
            "cac": null,
            "churn": null,
            "deckung13": 3.17,
            "delegation": null,
            "dso": 19,
            "ek_quote": 45.45,
            "fixkostenquote": 8.89,
            "fokus_tage": null,
            "fokuszeit": null,
            "kapitaldienst": 99,
            "konzentration": 38.96,
            "kostenquote": 58.64,
            "liquiditaet": 3.17,
            "ltv": null,
            "ltv_cac": null,
            "meetinglast": 0,
            "meilensteine": null,
            "nrr": null,
            "personalquote": 18.99,
            "pipeline": 0.06,
            "plan_ist": 674.51,
            "quick_ratio": 4.12,
            "recurring": 58.5,
            "run_rate": 30.77,
            "runway": 99,
            "sales_cycle": 0,
            "tagessatz": 1041.67,
            "traktion": 55,
            "ueberfaellig": 23.81,
            "umsatz_kopf": 78975,
            "win_rate": null,
            "zeit_woche": null,
          },
        },
        "kdc": {
          "index": 73,
          "werte": {
            "auslastung": 80,
            "bereich_zeit": null,
            "bewusst_woche": null,
            "break_even": 83.09,
            "cac": null,
            "churn": null,
            "deckung13": 1.75,
            "dso": null,
            "ek_quote": 40,
            "fixkostenquote": 8.49,
            "fokus_tage": null,
            "kapitaldienst": 99,
            "konzentration": 66.67,
            "kostenquote": 58.66,
            "liquiditaet": 1.8,
            "ltv": null,
            "ltv_cac": null,
            "nrr": null,
            "personalquote": 22.35,
            "pipeline": 0,
            "plan_ist": 677.78,
            "quick_ratio": 2.48,
            "recurring": 40.22,
            "run_rate": 73.97,
            "runway": 99,
            "sales_cycle": null,
            "tagessatz": 1041.67,
            "ueberfaellig": 83.33,
            "umsatz_kopf": 89500,
            "win_rate": null,
            "zeit_woche": null,
          },
        },
        "kdv": {
          "index": 71,
          "werte": {
            "bereich_zeit": null,
            "bewusst_woche": null,
            "break_even": 91.11,
            "deckung13": 9.14,
            "dso": null,
            "ek_quote": 50,
            "fixkostenquote": 5.26,
            "fokus_tage": null,
            "kapitaldienst": null,
            "kostenquote": 46.05,
            "liquiditaet": 9.14,
            "personalquote": null,
            "plan_ist": null,
            "quick_ratio": 6.98,
            "run_rate": 29.01,
            "runway": 99,
            "ueberfaellig": 0,
            "zeit_woche": null,
          },
        },
      }
    `);
  });
  it('Ist-Monate je Sicht (Umsatz/Kosten-Summen)', () => {
    const je = Object.fromEntries((['gesamt', 'kdc', 'kdv'] as const).map(s => { const l = istMonate(bestand(s)); return [s, { monate: l.length, umsatz: summe(l.map(m => m.umsatz)), kosten: summe(l.map(m => m.kosten)) }]; }));
    expect(je).toMatchInlineSnapshot(`
      {
        "gesamt": {
          "kosten": 61750,
          "monate": 8,
          "umsatz": 105300,
        },
        "kdc": {
          "kosten": 52500,
          "monate": 8,
          "umsatz": 89500,
        },
        "kdv": {
          "kosten": 1750,
          "monate": 2,
          "umsatz": 3800,
        },
      }
    `);
  });
  it('Geschäftsmodell: MRR und einmalige Honorare je Sicht', () => {
    const je = Object.fromEntries((['gesamt', 'kdc', 'kdv'] as const).map(s => { const g = geschaeftsmodell(mandate, [] as Leistung[], s, 1000); return [s, { mrr: g.mrr, einmalig: g.einmalig, mandate: g.mandate.length }]; }));
    expect(je).toMatchInlineSnapshot(`
      {
        "gesamt": {
          "einmalig": 5000,
          "mandate": 5,
          "mrr": 7700,
        },
        "kdc": {
          "einmalig": 0,
          "mandate": 2,
          "mrr": 4500,
        },
        "kdv": {
          "einmalig": 0,
          "mandate": 1,
          "mrr": 2000,
        },
      }
    `);
  });
});

describe('Steuern — Fristen, USt, Prognose, Belege, Übergabe bleiben', () => {
  it('Fristen: Anzahl je Einheit', () => {
    const f = fristen(STANDARD_STEUERN, HEUTE);
    const je: Record<string, number> = {};
    for (const x of f) je[x.einheit] = (je[x.einheit] ?? 0) + 1;
    expect({ gesamt: f.length, je }).toMatchInlineSnapshot(`
      {
        "gesamt": 26,
        "je": {
          "kdc": 5,
          "kdv": 15,
          "privat": 6,
        },
      }
    `);
  });
  it('Umsatzsteuer je Firma (laufender Zeitraum, Ist/Soll) — UG-Rechnungen zählen bei keiner der beiden', () => {
    const je = Object.fromEntries((['kdc', 'kdv'] as const).map(f => {
      const zr = zeitraumVon(HEUTE, 'quartal')!;
      const u = ustZeitraum(f, STANDARD_STEUERN[f], zr, rechnungen as never, null, null);
      return [f, { ust: u.ust, zahllast: u.zahllast, rechnungen: u.rechnungen.length }];
    }));
    expect(je).toMatchInlineSnapshot(`
      {
        "kdc": {
          "rechnungen": 1,
          "ust": 190,
          "zahllast": 190,
        },
        "kdv": {
          "rechnungen": 1,
          "ust": 950,
          "zahllast": 950,
        },
      }
    `);
  });
  it('Prognose: Summe Soll je Einheit und gesamt', () => {
    const e = { ...STANDARD_STEUERN, steuerquote: 30, ruecklageIst: { kdc: 500, kdv: 1000, privat: 2000 }, vorauszahlung: { est: 1000, kst: 200 } };
    const ist = [{ monat: '2026-07', umsatz: 12000, kosten: 7000, quelle: 'Monatsabschluss' }, { monat: '2026-08', umsatz: 13000, kosten: 7500, quelle: 'Monatsabschluss' }];
    const p = prognose(e, HEUTE, { kdc: jahresgewinn(ist, 2026), kdv: jahresgewinn(ist.map(m => ({ ...m, umsatz: m.umsatz / 4 })), 2026) }, { kdc: 1200, kdv: 300 });
    const soll = { kdc: r2(p.je.kdc.soll), kdv: r2(p.je.kdv.soll), privat: r2(p.je.privat.soll) };
    expect({ soll, summe: r2(soll.kdc + soll.kdv + soll.privat), zeilenSumme: summe(p.zeilen.map(z => z.betrag ?? 0)), ist: { kdc: p.je.kdc.ist, kdv: p.je.kdv.ist, privat: p.je.privat.ist } }).toMatchInlineSnapshot(`
      {
        "ist": {
          "kdc": 500,
          "kdv": 1000,
          "privat": 2000,
        },
        "soll": {
          "kdc": 1200,
          "kdv": 300,
          "privat": 15900,
        },
        "summe": 17400,
        "zeilenSumme": 17400,
      }
    `);
  });
  it('Belege und Übergabe: Anzahl offener Punkte und Status', () => {
    const belege = [
      { id: 'b1', stand: 1, art: 'beleg', bezeichnung: 'Quittung', empfaenger: null, betrag: 1200, faellig_am: '2026-09-10', verursacher: 'Kevin', einheit: 'selbststaendigkeit', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
      { id: 'b2', stand: 1, art: 'rechnung', bezeichnung: 'Notar', empfaenger: 'Notar Beispiel', betrag: 45000, faellig_am: '2026-10-01', verursacher: null, einheit: 'ug', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
      { id: 'b3', stand: 1, art: 'beleg', bezeichnung: 'privat', empfaenger: null, betrag: 100, faellig_am: null, verursacher: null, einheit: 'privat', erledigt: false, bezahlt_am: null, notiz: null, buchung_id: null },
    ] as unknown as Beleg[];
    const bp = belegPunkte(rechnungen as never, belege, HEUTE);
    const u = uebergabeMonat('2026-08', { rechnungen: rechnungen as never, belege, abschluesse: bestand('gesamt').abschluesse, buchungsMonate: ['2026-08'], abgehakt: {} });
    expect({ punkte: bp.length, arten: bp.map(p => p.art), uebergabe: u.map(p => `${p.key}:${p.status}`) }).toMatchInlineSnapshot(`
      {
        "arten": [
          "beleg",
          "eingangsrechnung",
          "pflichtangabe",
          "pflichtangabe",
          "pflichtangabe",
          "pflichtangabe",
          "pflichtangabe",
          "pflichtangabe",
          "pflichtangabe",
        ],
        "punkte": 9,
        "uebergabe": [
          "m:2026-08:konto:ok",
          "m:2026-08:rechnungen:offen",
          "m:2026-08:belege:ok",
          "m:2026-08:abschluss:ok",
          "m:2026-08:abgleich:hand",
          "m:2026-08:uebergeben:hand",
        ],
      }
    `);
  });
});

// ── Finanzplanung (Rechenkern v3 + Baukasten) ───────────────────────────────
const treiber = (over: Partial<Szenario> = {}): Szenario => ({
  id: 's1', name: 'Test', ob: { betrag: 1000, start: 1, laufzeit: 3 }, retainer: [{ name: 'Beispiel', betrag: 2000, start: 2, laufzeit: 6 }] as never, astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 },
  erhoehung: { betrag: 0, ab: 0 }, unterstuetzung: { betrag: 0, ab: 0 }, exit1: { betrag: 0, monat: 0 }, exit2: { betrag: 0, monat: 0 }, bjoernAbloesen: false, ...over,
});
function mini(): FinanzDaten {
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
    posten: [
      { id: 'k1', art: 'konto', einheit: 'privat', name: 'Girokonto', betrag: 4000 },
      { id: 'k2', art: 'konto', einheit: 'selbststaendigkeit', name: 'Geschäftskonto', betrag: 2500 },
      { id: 'k3', art: 'konto', einheit: 'ug', name: 'UG-Konto', betrag: 1500 },
      { id: 'k4', art: 'konto', einheit: 'kdv', name: 'KDV-Konto', betrag: null },
    ] as never,
    fokus: { saetze: [], regeln: [], schritte: [] }, plan: {}, ist: {}, protokoll: [],
  };
}
const bausteine = (): Baustein[] => [
  neuerBaustein('b1', { art: 'umsatz', einheit: 'ug', preis: 1500, menge: 2, start: 2, laufzeit: 12, zahlungsziel: 1 }),
  neuerBaustein('b2', { art: 'umsatz', einheit: 'kdv', preis: 700, start: 3 }),
  neuerBaustein('b3', { art: 'umsatz', einheit: 'privat', preis: 250, start: 1 }),
  neuerBaustein('b4', { art: 'kosten', einheit: 'ug', kostenArt: 'stelle', preis: 900, start: 4 }),
  neuerBaustein('b5', { art: 'kosten', einheit: 'ug', kostenArt: 'tool', preis: 80, start: 1 }),
  neuerBaustein('b6', { art: 'kosten', einheit: 'privat', preis: 120, start: 1, rhythmus: 'jaehrlich' }),
  neuerBaustein('b7', { art: 'kosten', einheit: 'kdv', preis: 50, start: 1 }),
];
const planszenario = (): Planszenario => ({ ...neuesPlanszenario('ps1', 'Probe', 's1', J), bausteine: bausteine(), annahmen: { ausschuettung: { betrag: 300, ab: 6 } } });

describe('Finanzplanung — Szenarien/Baukasten rechnen wie vorher', () => {
  it('Basis (reiner Treiber) und Planszenario: Summen UG, Privat, KD Ventures', () => {
    const d = mini();
    const zeile = (g: ReturnType<typeof rechneMit>) => ({
      ugUmsatz: summe(g.ug.map(u => u.umsatz)), ugFrei: r2(g.ug.at(-1)!.frei), kdvKonto: r2(g.ug.at(-1)!.kdvKonto), privatLuft: summe(g.pr.map(p => p.luft)),
    });
    const basis = rechneMit(d, null), mit = rechneMit(d, planszenario());
    const aw = auswertung(mit.d, mit.ug, mit.pr);
    expect({ basis: zeile(basis), mit: zeile(mit), frei: { gesamt: r2(aw.frei.gesamt), ug: r2(aw.frei.ug), kdv: r2(aw.frei.kdv), privat: r2(aw.frei.privat) } }).toMatchInlineSnapshot(`
      {
        "basis": {
          "kdvKonto": 0,
          "privatLuft": 42400,
          "ugFrei": -47630,
          "ugUmsatz": 15000,
        },
        "frei": {
          "gesamt": 5954,
          "kdv": -50,
          "privat": 4930,
          "ug": 1074,
        },
        "mit": {
          "kdvKonto": 16150,
          "privatLuft": 53647.6,
          "ugFrei": -48038,
          "ugUmsatz": 51000,
        },
      }
    `);
  });
  it('Kontostände je Einheit (Verpflichtungen › Kontostände)', () => {
    const d = mini();
    expect((['privat', 'selbststaendigkeit', 'ug', 'kdv'] as const).map(e => [e, kontostand(d, e).summe, kontostand(d, e).fehlen])).toMatchInlineSnapshot(`
      [
        [
          "privat",
          4000,
          0,
        ],
        [
          "selbststaendigkeit",
          2500,
          0,
        ],
        [
          "ug",
          1500,
          0,
        ],
        [
          "kdv",
          0,
          1,
        ],
      ]
    `);
  });
});

describe('Liquidität — Vorschau gesamt und je Firma bleibt', () => {
  it('13 Wochen: Start, Eingänge, Ausgänge, Tiefpunkt', () => {
    const v = (nur?: string) => { const x = vorschau(firmen, rechnungen, [{ id: 'z1', an: 'Lieferant', titel: 'Rechnung', betrag: 500, status: 'offen', faellig: '2026-10-05', firmaId: 'kdc' }], [], HEUTE, 13, false, planposten, 'real', nur, true); return { start: x.start, ein: r2(x.summeEin), aus: r2(x.summeAus), tief: r2(x.tiefpunkt.stand) }; };
    expect({ gesamt: v(), kdc: v('kdc'), kdv: v('kdv'), ug: v('ug') }).toMatchInlineSnapshot(`
      {
        "gesamt": {
          "aus": 3860,
          "ein": 9996.5,
          "start": 23000,
          "tief": 23000,
        },
        "kdc": {
          "aus": 3200,
          "ein": 2856,
          "start": 12000,
          "tief": 11656,
        },
        "kdv": {
          "aus": 300,
          "ein": 8806,
          "start": 8000,
          "tief": 8000,
        },
        "ug": {
          "aus": 360,
          "ein": 4046.5,
          "start": 3000,
          "tief": 3000,
        },
      }
    `);
  });
});

describe('Privat-Finanzen — nur Privates zählt, Firmen-Zeilen ändern nichts', () => {
  const mitFirmenZeilen = (): Haushalt => {
    const h = testHaushalt(HEUTE);
    // Altwerte wie im Speicher: Selbstständigkeit und die UG (Altname „KD Management UG“).
    const alt = (i: number) => (i % 2 ? 'selbststaendigkeit' : 'ug') as unknown as Buchung['einheit'];
    const buchungen = h.buchungen.map((b, i) => (i % 7 === 3 ? { ...b, einheit: alt(i) } : b));
    const belege = h.belege.map((b, i) => (i === 0 ? { ...b, einheit: alt(1) as Beleg['einheit'] } : b));
    const schulden = h.schulden.map((s, i) => (i === 0 ? { ...s, einheit: alt(2) as Schuld['einheit'] } : s));
    return { ...h, buchungen, belege, schulden };
  };
  it('Faktoren, Brücke und Hinweise wie vorher', () => {
    const h = mitFirmenZeilen();
    const f = privatFaktoren(h, HEUTE).map(x => [x.label, x.wert, x.echt]);
    const br = bruecke(h, { umsatzProMonat: 9000, fixkostenMonatBrutto: 1500, bisMonat: '2026-08', monate: 3 }, 30, HEUTE);
    const w = wichtig(h, katNamen(h.stamm), HEUTE);
    const privatSumme = h.buchungen.filter(b => b.einheit === 'privat').reduce((s, b) => s + b.betrag, 0);
    expect({ f, sockel: br.sockel, mindestUmsatz: br.mindestUmsatz, hinweise: w.length, privatSumme, zeilen: h.buchungen.length }).toMatchInlineSnapshot(`
      {
        "f": [
          [
            "Sparquote",
            100,
            true,
          ],
          [
            "Luft pro Monat",
            100,
            true,
          ],
          [
            "Schuldenabbau",
            100,
            true,
          ],
        ],
        "hinweise": 5,
        "mindestUmsatz": 150000,
        "privatSumme": 1231481,
        "sockel": 164298,
        "zeilen": 218,
      }
    `);
  });
});

describe('Buchungen — Zahlungseingang einer bezahlten Rechnung', () => {
  it('Summe Geschäftlich bleibt; je Ort siehe Kommentar', () => {
    const l = (rechnungen as unknown as FpRechnung[]).filter(r => r.firmaId !== 'privat').map(r => buchungFuer({ ...r, firmaId: r.firmaId ?? '' }, '2026-09-25'));
    const jeOrt: Record<string, number> = {};
    for (const b of l) jeOrt[b.ort] = r2((jeOrt[b.ort] ?? 0) + b.betrag);
    expect({ geschaeftlich: summe(l.map(b => b.betrag)), jeOrt }).toMatchInlineSnapshot(`
      {
        "geschaeftlich": 15581.5,
        "jeOrt": {
          "kdc": 9631.5,
          "kdv": 5950,
        },
      }
    `);
  });
});
