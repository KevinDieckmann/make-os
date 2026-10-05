// ─── Finanzplanung jetzt — erfundener Plan für Tests (nie echte Zahlen) ──────
// Zwei Fassungen desselben Dokuments: A (kleiner Umsatz, kaum Steuer) und B (größerer Umsatz, Steuer fällt an).
// Die Erwartungswerte in tests/finanzplan-regression.test.ts wurden MIT DEM UNVERÄNDERTEN Rechenkern (Stand 1818c5c) gerechnet.
import type { FinanzDaten, Szenario } from '../../lib/finanzen/rechenkern';
import { monatsLabels, leeresDokument } from '../../lib/finanzen/plan/operationen';
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
    einstellungen: { heute: '2026-09-27', reserveMonate: 2 }, buchungen: [], regeln: {}, ziele: [], check: { punkte: [], eintraege: [] }, notizen: {},
    annahmen: { kevinBrutto: 3000, kevinAb: 2, malinBrutto: 2500, malinAb: 3, agAnteil: 0.2, stammkapital: 2500, gruendungskosten: 900, darlehenKevin: 3000, darlehenRueckMonat: 14, retainerVerzug: 1, astarnaProvision: 120, steuerUG: 0.3, ust: 0.19, steuerMonat: 6, holdingKosten: 400, holdingAb: 4, kdvStart: 1000, bjoernBetrag: 12000, bjoernRate: 600, bjoernRateVon: 2, bjoernRateBis: 11, bjoernSchluss: 6000, bjoernSchlussMonat: 12, bjoernZinsMonat: 50, bjoernZinsDeckel: 900, exitSteuer: 0.25, nettoTabelle: [[1000, 800], [2000, 1500], [4000, 2700], [6000, 3800]], gehaltTag: 28 },
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

/**
 * Arbeitsplan mit einer kräftigen Selbstständigkeit (Baustein-Einheit kdc): Umsatz, Software, eine Stelle — und eine
 * Entnahme-Regel lässt sich von den Tests darübersetzen. Erfundene Zahlen. Gebraucht für den Kern-Umbau 02.10. (Vorher-Nachher-Bericht).
 */
export function arbeitsplanSelbst(): Planszenario {
  const a = arbeitsplanFix();
  return {
    ...a, id: 'ps2', name: 'Plan mit Selbstständigkeit',
    bausteine: [
      ...a.bausteine.filter(b => b.id !== 'b4'),
      neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Interim', preis: 6000, start: 1, laufzeit: 24, zahlungsziel: 1 }),
      neuerBaustein('k2', { art: 'kosten', einheit: 'kdc', kostenArt: 'tool', name: 'Software', preis: 300, start: 1 }),
      neuerBaustein('k3', { art: 'kosten', einheit: 'kdc', kostenArt: 'stelle', name: 'Assistenz', preis: 1000, start: 4 }),
    ],
  };
}

/** Arbeitsplan ohne Bausteine der Selbstständigkeit und ohne KD-Ventures-Baustein: der Teil des Plans, den der Kern-Umbau 02.10. NICHT berührt (Privat, MAKE ohne Selbstständigkeit, Ziele, Töpfe). */
export function arbeitsplanOhneSelbst(): Planszenario {
  const a = arbeitsplanFix();
  return { ...a, id: 'ps3', name: 'Plan ohne Selbstständigkeit', bausteine: a.bausteine.filter(b => b.einheit !== 'kdc' && b.einheit !== 'kdv') };
}

/** Plan mit Zielen und Buchungen für die Regressionsprüfung (Ziele, Töpfe, Buchungen müssen nach dem Umbau bit-genau gleich bleiben). */
export function planGold(): FinanzDaten {
  const d = planFix(14000);
  d.ziele = [
    { id: 'z1', name: 'Rücklage', quelle: 'privat.angespart', ziel: 40000, bis: '2027-12', einheit: 'privat' },
    { id: 'z2', name: 'MAKE frei', quelle: 'ug.frei', ziel: 5000, bis: '2028-06', einheit: 'ug' },
    { id: 'z3', name: 'Darlehen', quelle: 'kdv.bjoern', ziel: 0, bis: '2027-09', einheit: 'kdv' },
    { id: 'z4', name: 'Gruppe', quelle: 'gruppe', ziel: 30000, bis: '2028-12', einheit: 'privat' },
  ];
  d.buchungen = [
    { id: 'b1', d: '2026-05-03', b: -1200, n: 'Vermieter', k: 'giro', z: 'pb1' }, { id: 'b2', d: '2026-05-10', b: -80.5, n: 'Markt', k: 'giro', z: 'pb2' },
    { id: 'b3', d: '2026-06-01', b: 2000, n: 'Kunde', k: 'giro', z: 'x.einnahme' }, { id: 'b4', d: '2026-06-02', b: -40, n: 'Unbekannt', k: 'giro', z: 'x.offen' },
  ];
  return d;
}

/**
 * Alt-Plan für den Umzug Selbstständigkeit → Privat (finanzplan-5, 05.10.): Bausteine der Selbstständigkeit, Handwerte auf kdc-Kennungen (allgemein
 * und nur in einem Szenario), ein Handwert im Abschluss, Bereichs-Einstellungen (Privat/Business rechnen verschiedene Szenarien), Steuerprofile
 * (auch nur im Szenario), Entnahme-Regel, Sachkosten-Zeile der Selbstständigkeit, Altdarlehen. Der Vorher-Stand dazu stammt aus dem Kern auf
 * `entwicklung` (4efe90a2) — tests/fixtures/finanzplan5-vorher.json. Erfundene Zahlen.
 */
export function planAltMigration(): FinanzDaten {
  const d = planFix(14000);
  const ps2 = arbeitsplanSelbst();
  ps2.annahmen = { ...ps2.annahmen, entnahme: { betrag: 1500, ab: 2 }, steuern: { kdc: { param: { zahlweise: 'quartal' } } } };
  const ps3 = arbeitsplanOhneSelbst();
  return {
    ...d, planszenarien: [ps2, ps3], arbeitsplan: 'ps2', bereiche: { privat: { arbeitsplan: 'ps2' }, business: { arbeitsplan: 'ps3' } },
    steuern: { kdc: { zeilen: { gewst: { hebesatz: 380 } } }, ug: { zeilen: { gewst: { hebesatz: 410 } } } },
    sachkosten: [...d.sachkosten, { id: 'sk-kdc', name: 'Coworking', einheit: 'selbststaendigkeit', gruppe: 'Räume', soll: 150, ab: 1 }],
    plan: { ...d.plan, 'kdc.konto:5': 12345, 'kdc.est:3': 800, 'kdc.kosten:6': 2000, 'kdc.umsatz@ps2:4': 9000, 'kdc.entnahme@ps2:7': 0, 'ab.est:0': 50, 'ug.konto:7': 4242, 'p.luft:9': 100, 'sk-kdc:3': 300 },
    meta: { 'kdc.konto:5': { wer: 'kevin', wann: '2026-10-01T10:00:00.000Z' }, 'ab.est:0': { wer: 'malin', wann: '2026-10-01T10:00:00.000Z' } },
  };
}
/**
 * Derselbe Alt-Plan ohne die bewusst geänderten Teile (Gehalt nicht in der Einkommensteuer, kein Abschluss Jan–Sep, kein Altdarlehen, kein
 * Handwert ab.est) — muss mit dem neuen Kern bit-genau wie mit dem alten rechnen.
 */
export function planAltNeutral(): FinanzDaten {
  const d = planAltMigration();
  const { 'ab.est:0': _ab, ...plan } = d.plan;
  return { ...d, plan, annahmen: { ...d.annahmen, darlehenKevin: 0 }, selbst: { ...d.selbst, posten: [] }, steuern: { ...d.steuern, kdc: { ...d.steuern!.kdc, param: { lohnEinbeziehen: false } } } };
}

/** Der Plan des Rechen-Prüfstands (tests/finanzplan-pruefstand.test.ts, Formel-Prüfung 05.10.) — alle Erwartungen dort sind von Hand gerechnet. */
export function pruefPlan(): FinanzDaten {
  const d = leeresDokument('2026-10-01');
  d.annahmen = {
    ...d.annahmen, kevinBrutto: 4000, kevinAb: 1, malinBrutto: 3000, malinAb: 1, agAnteil: 0.2, stammkapital: 25000, gruendungskosten: 1000,
    darlehenKevin: 0, darlehenRueckMonat: 0, retainerVerzug: 1, astarnaProvision: 0, steuerUG: 0.3, ust: 0.19, steuerMonat: 6,
    holdingKosten: 500, holdingAb: 2, kdvStart: 10000, exitSteuer: 0.25, nettoTabelle: [[0, 0], [4000, 2600], [8000, 4800]], gehaltTag: 28,
  };
  d.steuern = {
    ug: { rechtsform: 'kapital', zeilen: { kst: { satz: 0.15 }, soli: { satz: 0.055 }, gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6 } },
    kdv: { rechtsform: 'kapital', zeilen: { kst: { satz: 0.15 }, soli: { satz: 0.055 }, gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6 } },
    kdc: { rechtsform: 'einzel', zeilen: { gewst: { satz: 0.035, hebesatz: 400 } }, param: { zahlweise: 'folgejahr', zahlMonat: 6, freibetrag: 24500, anrechnung: 4 } },
  };
  d.szenarien = [{ id: 'basis', name: 'Basis', ob: { betrag: 10000, start: 1, laufzeit: 99 }, retainer: [{ betrag: 2000, start: 2, laufzeit: 99 }], astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 },
    erhoehung: { betrag: 0, ab: 0 }, unterstuetzung: { betrag: 0, ab: 0 }, exit1: { betrag: 50000, monat: 13 }, exit2: { betrag: 0, monat: 0 }, bjoernAbloesen: false,
    ereignisse: [{ id: 'e1', name: 'Messe', einheit: 'ug', betrag: 1200, monat: 3 }, { id: 'e2', name: 'Umzug', einheit: 'privat', betrag: 800, monat: 4 }] }];
  d.sachkosten = [
    { id: 'ug.s.miete', name: 'Miete', einheit: 'ug', gruppe: 'Räume', soll: 1500, ab: 1 },
    { id: 'ug.s.tool', name: 'Software', einheit: 'ug', gruppe: 'Tools', soll: 300, ab: 1, bis: 2 },
    { id: 'ug.s.kdc', name: 'Büro Selbstständigkeit', einheit: 'selbststaendigkeit', gruppe: 'Räume', soll: 200, ab: 1 },
  ];
  d.privatBudget = [
    { id: 'p.b.miete', name: 'Miete', einheit: 'privat', gruppe: 'Fixkosten', soll: 2000, typ: 'fix', tag: 3 },
    { id: 'p.b.essen', name: 'Essen', einheit: 'privat', gruppe: 'Flexibel', soll: 800, typ: 'flex' },
    { id: 'p.b.vers', name: 'Versicherung', einheit: 'privat', gruppe: 'Jahreskosten & Puffer', soll: 100, typ: 'jahr', jahresbetrag: 1200, faellig: [12] },
    { id: 'p.b.spar', name: 'Rücklage', einheit: 'privat', gruppe: 'Sparen', soll: 300, typ: 'sparen' },
  ];
  d.privatSchulden = [{ id: 'p.d.kredit', name: 'Kredit', einheit: 'privat', gruppe: 'Schulden', soll: 250, ab: 1, bis: 3, tag: 5 }];
  d.selbst = { posten: [{ id: 'sp1', name: 'Honorar', art: 'einnahme', betrag: 20000, status: 'bezahlt' }, { id: 'sp2', name: 'Kosten', art: 'ausgabe', betrag: 4000, status: 'offen' }], vorsorge: 0, sonderausgaben: 0, sicherheit: 0, darlehenAnUG: 0, consorsAbloesung: 0, kontoStart: 8000 };
  const ps: Planszenario = {
    ...neuesPlanszenario('ps1', 'Plan', 'basis', '2026-10-01T00:00:00.000Z'),
    bausteine: [
      neuerBaustein('k1', { art: 'umsatz', einheit: 'kdc', name: 'Interim', preis: 6000, start: 1, zahlungsziel: 1 }),
      neuerBaustein('u1', { art: 'umsatz', einheit: 'ug', name: 'Produkt', preis: 1000, start: 2, zahlungsziel: 2 }),
      neuerBaustein('st', { art: 'kosten', einheit: 'ug', kostenArt: 'stelle', name: 'Assistenz', preis: 3000, start: 3 }),
      neuerBaustein('kv', { art: 'kosten', einheit: 'kdv', kostenArt: 'sonstiges', name: 'Beratung', preis: 100, start: 1 }),
    ],
    annahmen: { ausschuettung: { betrag: 1000, ab: 4 }, entnahme: { betrag: 2000, ab: 2 }, zahlungsziel: 0 },
  };
  return { ...d, planszenarien: [ps], arbeitsplan: 'ps1', plan: {} };
}
