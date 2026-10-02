// ─── Finanzplanung jetzt — erfundener Plan für Tests (nie echte Zahlen) ──────
// Zwei Fassungen desselben Dokuments: A (kleiner Umsatz, kaum Steuer) und B (größerer Umsatz, Steuer fällt an).
// Die Erwartungswerte in tests/finanzplan-regression.test.ts wurden MIT DEM UNVERÄNDERTEN Rechenkern (Stand 1818c5c) gerechnet.
import type { FinanzDaten, Szenario } from '../../lib/finanzen/rechenkern';
import { monatsLabels } from '../../lib/finanzen/plan/operationen';
import { neuesPlanszenario, neuerBaustein, type Planszenario } from '../../lib/finanzen/szenarien';

export const treiberFix = (obBetrag: number): Szenario => ({
  id: 's1', name: 'Test', ob: { betrag: obBetrag, start: 1, laufzeit: 14 }, retainer: [{ betrag: 1500, start: 2, laufzeit: 10 }, { betrag: 900, start: 5, laufzeit: 12 }],
  astarna: { betrag: 3, ab: 4 }, events: { betrag: 700, ab: 6 }, erhoehung: { betrag: 200, ab: 10 }, unterstuetzung: { betrag: 500, ab: 3 },
  exit1: { betrag: 20000, monat: 12 }, exit2: { betrag: 5000, monat: 20 }, bjoernAbloesen: true,
  ereignisse: [{ id: 'e1', name: 'Umzug', einheit: 'privat', betrag: 2500, monat: 7 }, { id: 'e2', name: 'Messe', einheit: 'ug', betrag: 1800, monat: 8 }],
});

export function planFix(obBetrag = 4000): FinanzDaten {
  return {
    version: 3, stand: '2026-09-27', monate: monatsLabels(2026, 10, 27), aktiv: 's1', planszenarien: [], arbeitsplan: null, schulden: [], meta: {}, abschluesse: [], historie: monatsLabels(2026, 1, 9),
    einstellungen: { heute: '2026-09-27', reserveMonate: 2, notgroschenMonate: 3 }, buchungen: [], regeln: {}, ziele: [], check: { punkte: [], eintraege: [] }, notizen: {},
    annahmen: { kevinBrutto: 3000, kevinAb: 2, malinBrutto: 2500, malinAb: 3, agAnteil: 0.2, stammkapital: 2500, gruendungskosten: 900, darlehenKevin: 3000, darlehenRueckMonat: 14, retainerVerzug: 1, astarnaProvision: 120, steuerUG: 0.3, ust: 0.19, steuerMonat: 6, ruecklage5a: 0, holdingKosten: 400, holdingAb: 4, kdvStart: 1000, bjoernBetrag: 12000, bjoernRate: 600, bjoernRateVon: 2, bjoernRateBis: 11, bjoernSchluss: 6000, bjoernSchlussMonat: 12, bjoernZinsMonat: 50, bjoernZinsDeckel: 900, exitSteuer: 0.25, nettoTabelle: [[1000, 800], [2000, 1500], [4000, 2700], [6000, 3800]], gehaltTag: 28 },
    sachkosten: [{ id: 'sk1', name: 'Software', einheit: 'ug', gruppe: 'Tools', soll: 250, ab: 1 }, { id: 'sk2', name: 'Büro', einheit: 'ug', gruppe: 'Räume', soll: 400, ab: 3, bis: 20 }],
    privatEinnahmen: [{ id: 'pe1', name: 'Nebenjob', einheit: 'privat', gruppe: 'Einnahmen', soll: 300, ab: 1 }],
    privatBudget: [{ id: 'pb1', name: 'Miete', einheit: 'privat', gruppe: 'Fixkosten', soll: 1200, typ: 'fix', tag: 3 }, { id: 'pb2', name: 'Essen', einheit: 'privat', gruppe: 'Flexibel', soll: 600, typ: 'flex' }, { id: 'pb3', name: 'Versicherung', einheit: 'privat', gruppe: 'Jahreskosten & Puffer', soll: 100, typ: 'jahr', jahresbetrag: 1200, faellig: [3, 9] }, { id: 'pb4', name: 'Rücklage', einheit: 'privat', gruppe: 'Sparen', soll: 200, typ: 'sparen' }],
    privatSchulden: [{ id: 'ps1', name: 'Kredit', einheit: 'privat', gruppe: 'Schulden', soll: 250, ab: 1, bis: 24, tag: 5 }],
    szenarien: [treiberFix(obBetrag)],
    selbst: { posten: [{ id: 'sp1', name: 'Honorar', art: 'einnahme', betrag: 20000, status: 'bezahlt' }, { id: 'sp2', name: 'Kosten', art: 'ausgabe', betrag: 4000, status: 'offen' }], vorsorge: 3000, sonderausgaben: 500, sicherheit: 1000, darlehenAnUG: 3000, consorsAbloesung: 2000, kontoStart: 5000 },
    posten: [], fokus: { saetze: [], regeln: [], schritte: [] }, plan: { 'ug.events:9': 1200 }, ist: {}, protokoll: [],
  };
}

/** Arbeitsplan mit Bausteinen in allen drei Gesellschaften, Ausschüttung und eigener Steuerquote. */
export function arbeitsplanFix(): Planszenario {
  return {
    ...neuesPlanszenario('ps1', 'Plan', 's1', '2026-09-27T10:00:00.000Z'),
    bausteine: [
      neuerBaustein('b1', { art: 'umsatz', einheit: 'ug', name: 'A', preis: 800, menge: 2, start: 2, laufzeit: 8, zahlungsziel: 1 }),
      neuerBaustein('b2', { art: 'kosten', einheit: 'ug', kostenArt: 'stelle', name: 'S', preis: 2000, start: 6 }),
      neuerBaustein('b3', { art: 'kosten', einheit: 'ug', kostenArt: 'tool', name: 'T', preis: 99, start: 1 }),
      neuerBaustein('b4', { art: 'umsatz', einheit: 'kdc', name: 'K', preis: 500, start: 1, laufzeit: 6 }),
      neuerBaustein('b5', { art: 'umsatz', einheit: 'kdv', name: 'V', preis: 200, start: 3 }),
      neuerBaustein('b6', { art: 'kosten', einheit: 'privat', kostenArt: 'miete', name: 'M', preis: 50, start: 2 }),
    ],
    annahmen: { ausschuettung: { betrag: 600, ab: 8 }, steuerUG: 0.28 },
  };
}
