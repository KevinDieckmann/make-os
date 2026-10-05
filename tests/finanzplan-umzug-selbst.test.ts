// ─── finanzplan-5 (05.10.) — Umzug Selbstständigkeit → Privat: nichts geht verloren, nur das Gewollte ändert sich ─────────────
// Kevin: „Selbstständigkeit und Privat können zusammengeführt werden. Das wird am Ende ja auch zusammen gerechnet und besteuert.“ und
// „Achte bei der Finanzplanung nur, dass wir das wirklich sauber machen.“
// Ein Alt-Plan mit allem, was am Umzug hängt (Handwerte auf kdc-Kennungen allgemein und nur im Szenario, Abschluss-Handwert, Bereichs-Einstellungen,
// Steuerprofile, Entnahme, Sachkosten-Zeile der Selbstständigkeit, Altdarlehen) wird mit dem neuen Kern gerechnet und gegen den Stand VOR dem Umbau
// verglichen (tests/fixtures/finanzplan5-vorher.json, erzeugt mit dem Kern auf `entwicklung` 4efe90a2). Erfundene Zahlen.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit, auswertung, arbeitsplanFuer, mitBereich } from '../lib/finanzen/szenarien';
import { pruefeDokument, wendeOperationenAn } from '../lib/finanzen/plan/operationen';
import { businessSicht, kennzahlenFuerSicht } from '../lib/finanzen/plan/sicht';
import { kennzahlenVon } from '../lib/finanzen/plan/speicher';
import { planAltMigration, planAltNeutral } from './fixtures/finanz-plan';
import vorherJson from './fixtures/finanzplan5-vorher.json';

type Lauf = { ug: Record<string, unknown>[]; kdc: Record<string, unknown>[]; pr: Record<string, unknown>[]; kz: Record<string, number>; gruppe: number[]; aw: Record<string, unknown> };
const vorher = vorherJson as unknown as Record<'voll' | 'neutral', { ps2: Lauf; ps3: Lauf; arbeitsplan: string | null }>;

/** Rekursiv gleich — nur die Schlüssel des Vorher-Stands (neue Felder wie `darlehenEin` gab es vorher nicht), Zahlen auf 1e-9. */
function gleich(ist: unknown, soll: unknown, pfad = ''): void {
  if (typeof soll === 'number') { expect(typeof ist, pfad).toBe('number'); expect(ist as number, pfad).toBeCloseTo(soll, 9); return; }
  if (Array.isArray(soll)) { expect(Array.isArray(ist), pfad).toBe(true); expect((ist as unknown[]).length, pfad).toBe(soll.length); soll.forEach((x, i) => gleich((ist as unknown[])[i], x, `${pfad}[${i}]`)); return; }
  if (soll && typeof soll === 'object') { for (const k of Object.keys(soll)) gleich((ist as Record<string, unknown>)?.[k], (soll as Record<string, unknown>)[k], `${pfad}.${k}`); return; }
  expect(ist, pfad).toEqual(soll);
}
const lauf = (d: FinanzDaten, psId: string) => {
  const g = rechneMit(d, (d.planszenarien ?? []).find(p => p.id === psId) ?? null);
  return { ...g, aw: auswertung(g.d, g.ug, g.pr, g.kdc) };
};
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('Umzug Selbstständigkeit → Privat: Speichern und Lesen verlieren nichts', () => {
  it('pruefeDokument (Laden/Import) behält Handwerte auf kdc-Kennungen, Szenario-Handwerte, Abschluss-Handwert, Bereiche, Steuern, Entnahme, Sachkosten-Zeile, Meta', () => {
    const d = planAltMigration();
    const p = pruefeDokument(json(d));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.dokument.plan).toEqual(d.plan);
    expect(Object.keys(p.dokument.plan).filter(k => k.startsWith('kdc.') || k.startsWith('ab.'))).toEqual(['kdc.konto:5', 'kdc.est:3', 'kdc.kosten:6', 'kdc.umsatz@ps2:4', 'kdc.entnahme@ps2:7', 'ab.est:0']);
    expect(p.dokument.bereiche).toEqual(d.bereiche);
    expect(p.dokument.steuern).toEqual(d.steuern);
    expect(p.dokument.meta).toEqual(d.meta);
    expect(p.dokument.planszenarien?.map(ps => ps.id)).toEqual(['ps2', 'ps3']);
    expect(p.dokument.planszenarien?.[0].annahmen.entnahme).toEqual({ betrag: 1500, ab: 2 });
    expect(p.dokument.planszenarien?.[0].annahmen.steuern).toEqual({ kdc: { param: { zahlweise: 'quartal' } } });
    expect(p.dokument.planszenarien?.[0].bausteine.filter(b => b.einheit === 'kdc').map(b => b.id)).toEqual(['k1', 'k2', 'k3']);
    expect(p.dokument.sachkosten.find(z => z.id === 'sk-kdc')?.einheit).toBe('selbststaendigkeit');
    expect(p.dokument.selbst).toEqual(d.selbst);
    // Eine beliebige Änderung schreibt alles unverändert mit (nur der geänderte Pfad ändert sich).
    const r = wendeOperationenAn(p.dokument, [{ pfad: '/plan/ug.konto:8', neu: 1 }], 'kevin', '2026-10-05T10:00:00.000Z').dokument;
    const { 'ug.konto:8': _neu, ...rest } = r.plan;
    expect(rest).toEqual(d.plan);
    expect(r.bereiche).toEqual(d.bereiche); expect(r.steuern).toEqual(d.steuern); expect(r.planszenarien).toEqual(p.dokument.planszenarien);
  });
  it('die Kennungen bleiben: dieselben Handwert-Schlüssel wirken wie vorher (allgemein, nur im Szenario, Bestand)', () => {
    const d = planAltMigration();
    const g2 = lauf(d, 'ps2'), g3 = lauf(d, 'ps3');
    expect(g2.kdc[4].konto).toBe(12345); expect(g3.kdc[4].konto).toBe(12345);                // allgemein: in beiden Szenarien
    expect(g2.kdc[2].st.est).toBe(800); expect(g2.kdc[5].kosten).toBe(2000);
    expect(g2.kdc[3].umsatz).toBe(9000); expect(g3.kdc[3].umsatz).not.toBe(9000);           // nur im Szenario ps2
    expect(g2.kdc[6].entnahme).toBe(0); expect(g2.kdc[7].entnahme).toBe(1500);
    expect(g2.formel['kdc.konto:5']).toBeDefined(); expect(g2.formel['ab.est:0']).toBeDefined();
  });
});

describe('Umzug Selbstständigkeit → Privat: Zahlen vorher → nachher', () => {
  for (const ps of ['ps2', 'ps3'] as const) {
    it(`${ps}, ohne die gewollten Änderungen (Gehalt nicht in der ESt, kein Abschluss, kein Altdarlehen): alles bit-genau wie vorher`, () => {
      const g = lauf(planAltNeutral(), ps), v = vorher.neutral[ps];
      gleich(json(g.ug), v.ug, 'ug'); gleich(json(g.kdc), v.kdc, 'kdc'); gleich(json(g.pr), v.pr, 'pr');
      gleich(g.gruppe, v.gruppe, 'gruppe'); gleich(json(g.kz), v.kz, 'kz');
      // Runway Privat zählt seit 05.10. (selbst-privat) das freie Geld der Selbstständigkeit mit — gewollt anders (tests/selbst-privat.test.ts).
      const ohneRunwayPrivat = (aw: unknown) => { const a = json(aw) as { runway: Record<string, unknown> }; return { ...a, runway: { ...a.runway, privat: 'gewollt anders' } }; };
      gleich(ohneRunwayPrivat(g.aw), ohneRunwayPrivat(v.aw), 'aw');
    });
    it(`${ps}, voller Alt-Plan: MAKE, KD Ventures und Privat exakt wie vorher — die Selbstständigkeit ändert nur Steuer, Darlehen und was daraus folgt`, () => {
      const g = lauf(planAltMigration(), ps), v = vorher.voll[ps];
      gleich(json(g.ug), v.ug, 'ug'); gleich(json(g.pr), v.pr, 'pr');
      // Selbstständigkeit: Leistung, Kosten, Eingang, USt, Entnahme (fester Betrag) unverändert.
      const fest = ['m', 'umsatz', 'eingang', 'ustEin', 'personal', 'sach', 'kosten', 'malinBrutto', 'gewinn', 'entnahme', 'ustZahlung', 'ustOffen'];
      g.kdc.forEach((k, i) => { for (const f of fest) expect((k as unknown as Record<string, number>)[f], `kdc[${i}].${f}`).toBeCloseTo((v.kdc[i] as Record<string, number>)[f], 9); });
      // Konto: Unterschied = Altdarlehen (−3.000 ab Okt 26, +3.000 zurück im Monat 14) − Unterschied der Steuerzahlungen; ab dem Handwert im Monat 5
      // (12.345, in beiden Ständen) zählt nur, was danach anders fließt.
      let delta = 0;
      g.kdc.forEach((k, i) => {
        const m = i + 1, alt = v.kdc[i] as unknown as { konto: number; st: { zahlung: number } };
        if (m === 5) delta = 0;
        else delta += -(k.st.zahlung - alt.st.zahlung) - (m === 1 ? 3000 : 0) + (m === 14 ? 3000 : 0);
        expect(k.konto - alt.konto, `Konto Monat ${m}`).toBeCloseTo(delta, 6);
      });
      // Gruppe und Kennzahlen: nur über „frei“ der Selbstständigkeit.
      g.gruppe.forEach((x, i) => expect(x - v.gruppe[i], `Gruppe ${i + 1}`).toBeCloseTo((g.kdc[i].frei as number) - (v.kdc[i] as unknown as { frei: number }).frei, 6));
      for (const k of Object.keys(v.kz).filter(k => k !== 'kdcFreiDez28' && k !== 'gruppeDez28')) expect((g.kz as unknown as Record<string, number>)[k], k).toBeCloseTo(v.kz[k], 9);
      const awv = v.aw as { frei: Record<string, number>; runway: unknown; mindestumsatz: unknown; uebergaenge: unknown; steuer: Record<string, number> };
      for (const k of ['ug', 'kdv', 'privat', 'privatLuft', 'privatKonten']) expect(g.aw.frei[k as 'ug'], `frei.${k}`).toBeCloseTo(awv.frei[k], 9);
      // Runway Privat zählt seit 05.10. (selbst-privat, Kevin: „Runway Privat zählt das Konto der Selbstständigkeit mit“) das freie Geld der
      // Selbstständigkeit mit — gewollt anders, geprüft in tests/selbst-privat.test.ts; MAKE-Runway und Horizont bleiben bit-genau.
      const rv = awv.runway as { ug: unknown; horizont: unknown };
      expect(g.aw.runway.ug).toEqual(rv.ug); expect(g.aw.runway.horizont).toEqual(rv.horizont); gleich(json(g.aw.mindestumsatz), awv.mindestumsatz); gleich(json(g.aw.uebergaenge), awv.uebergaenge);
      expect(g.aw.steuer.ruecklage).toBeCloseTo(awv.steuer.ruecklage, 9); expect(g.aw.steuer.ruecklageKdv).toBeCloseTo(awv.steuer.ruecklageKdv, 9);
    });
  }
});

describe('Umzug Selbstständigkeit → Privat: Bereiche und Sichten', () => {
  it('Bereichs-Einstellungen bleiben: Privat rechnet ps2 (mit Selbstständigkeit), Business ps3', () => {
    const d = planAltMigration();
    expect(arbeitsplanFuer(d, 'privat')?.id).toBe('ps2'); expect(arbeitsplanFuer(d, 'business')?.id).toBe('ps3');
    expect(mitBereich(d, 'business').arbeitsplan).toBe('ps3');
  });
  it('Business-Sicht: keine Selbstständigkeit — keine kdc-/ab-Werte, kein Abschluss, keine kdc-Bausteine/-Zeilen/-Steuern, keine Entnahme; Business-Zahlen = volle Sicht', () => {
    const d = planAltMigration(), b = businessSicht(d);
    expect(Object.keys(b.plan).filter(k => /^(kdc|ab)\./.test(k))).toEqual([]);
    expect(Object.keys(b.meta).filter(k => /^(kdc|ab)\./.test(k))).toEqual([]);
    expect(b.selbst.posten).toEqual([]); expect(b.selbst.kontoStart).toBe(0);
    expect(b.sachkosten.some(z => z.einheit === 'selbststaendigkeit')).toBe(false);
    expect(b.planszenarien?.flatMap(p => p.bausteine).some(x => x.einheit === 'kdc' || x.einheit === 'privat')).toBe(false);
    expect(b.planszenarien?.[0].annahmen.entnahme).toBeUndefined();
    expect(b.planszenarien?.[0].annahmen.steuern).toBeUndefined();
    expect(b.steuern?.kdc).toBeUndefined(); expect(b.steuern?.ug).toEqual(d.steuern?.ug);
    expect(b.bereiche).toEqual({ business: { arbeitsplan: 'ps3' } });
    for (const ps of ['ps2', 'ps3']) {
      const voll = lauf(d, ps), bus = lauf(b, ps);
      expect(JSON.stringify(bus.ug)).toBe(JSON.stringify(voll.ug));
    }
    // Kennzahlen der Business-Sicht ohne Selbstständigkeit, Privat und Gruppe; „frei jetzt“ und „Steuerrücklage“ nur der Gesellschaften.
    const k = kennzahlenFuerSicht(kennzahlenVon(b, 'business'), 'business');
    expect(Object.keys(k).filter(x => /privat|gruppe|kdc|selbst/i.test(x))).toEqual([]);
    const voll = lauf(mitBereich(d, 'business'), 'ps3');
    expect(k.freiJetzt).toBeCloseTo(voll.aw.frei.ug + voll.aw.frei.kdv, 9);
    expect(k.steuerRuecklage).toBeCloseTo(voll.aw.steuer.ruecklage + voll.aw.steuer.ruecklageKdv, 9);
  });
});
