// ─── Finanzplanung jetzt — Welche Steuern gelten? (erfundene Zahlen) ─────────
// Standard je Rechtsform, Schalter, Aufschlüsselung, Operationen, Säuberer, Schwellen, Netto-Tabelle.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit } from '../lib/finanzen/szenarien';
import { wendeOperationenAn, pruefeDokument, nettoTabelleOk, OperationUngueltig } from '../lib/finanzen/plan/operationen';
import {
  rechtsformStandard, rechtsformVon, steuerArtenFuer, zeigeSteuer, aufteilen, gesamtsatzAus, steuerAnteile, steuerOps, steuerZeilen, pruefeSteuern, STEUER_STANDARD,
} from '../lib/finanzen/steuern';
import { schwellenVon, pruefeSchwellen, SCHWELLEN_VORGABE } from '../lib/finanzen/schwellen';
import { planFix } from './fixtures/finanz-plan';

const JETZT = '2026-10-02T10:00:00.000Z';
const an = (d: FinanzDaten, ops: Parameters<typeof wendeOperationenAn>[1]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;

describe('Standard je Rechtsform', () => {
  it('GmbH/UG sind Kapitalgesellschaften, die Selbstständigkeit ein Einzelunternehmen, Privat hat keine Rechtsform', () => {
    expect(rechtsformStandard('ug')).toBe('kapital'); expect(rechtsformStandard('kdv')).toBe('kapital');
    expect(rechtsformStandard('kdc')).toBe('einzel'); expect(rechtsformStandard('privat')).toBeNull();
  });
  it('nur die Zeilen, die zur Rechtsform passen', () => {
    expect(steuerArtenFuer('ug', 'kapital')).toEqual(['kst', 'soli', 'gewst', 'ust', 'ausschuettung']);
    expect(steuerArtenFuer('ug', 'einzel')).toEqual(['est', 'ust', 'ausschuettung']);
    expect(steuerArtenFuer('kdv', 'kapital')).toEqual(['exit']);
    expect(steuerArtenFuer('kdc', 'einzel')).toEqual(['est']);
    expect(steuerArtenFuer('privat', null)).toEqual(['netto', 'ausschuettung']);
  });
  it('ohne Profil: alles Passende gilt, nichts Unpassendes erscheint', () => {
    const d = planFix();
    expect(zeigeSteuer(d, 'ug', 'kst')).toBe(true); expect(zeigeSteuer(d, 'ug', 'est')).toBe(false);
    expect(zeigeSteuer(d, 'kdc', 'est')).toBe(true); expect(zeigeSteuer(d, 'kdc', 'ust')).toBe(false); expect(zeigeSteuer(d, 'kdv', 'kst')).toBe(false);
    expect(rechtsformVon(d, 'ug')).toBe('kapital');
  });
  it('Rechtsform wechseln zeigt andere Zeilen und schaltet die Aufschlüsselung ab, ohne den Satz anzufassen', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'einzeln', wert: true }));
    d = an(d, steuerOps(d, 'ug', { art: 'rechtsform', wert: 'einzel' }));
    expect(rechtsformVon(d, 'ug')).toBe('einzel'); expect(d.steuern?.ug?.einzeln).toBe(false); expect(d.annahmen.steuerUG).toBe(0.3);
    expect(zeigeSteuer(d, 'ug', 'est')).toBe(true); expect(zeigeSteuer(d, 'ug', 'kst')).toBe(false);
    expect(steuerZeilen(d, 'ug', 0.264).map(z => z.art)).toEqual(['est', 'ust', 'ausschuettung']);
  });
});

describe('Aufschlüsseln', () => {
  it('aufteilen(): die Summe ergibt immer genau den Gesamtsatz, der Hebesatz ist der Rest', () => {
    for (const g of [0.3, 0.2825, 0.158251, 0.15, 0.05, 0]) expect(gesamtsatzAus(aufteilen(g))).toBeCloseTo(g, 12);
    const p = aufteilen(0.3);
    expect(p.zeilen?.gewst?.hebesatz).toBeCloseTo(((0.3 - 0.15 * 1.055) / 0.035) * 100, 9);
    expect(aufteilen(0.1).zeilen?.gewst?.an).toBe(false);
  });
  it('Änderung eines Bestandteils schreibt die Summe in annahmen.steuerUG — der Kern rechnet damit', () => {
    let d = planFix(14000);
    d = an(d, steuerOps(d, 'ug', { art: 'einzeln', wert: true }));
    d = an(d, steuerOps(d, 'ug', { art: 'hebesatz', wert: 400 }));
    expect(d.annahmen.steuerUG).toBeCloseTo(0.15 * 1.055 + 0.035 * 4, 12);
    const g = rechneMit(d, null);
    // Zahlung im Juni 28 (Plan-Monat 21) = Satz × Gewinn 2027 (Plan-Monate 4–15), gerechnet mit dem NEUEN Gesamtsatz.
    const gewinn2027 = g.ug.slice(3, 15).reduce((s, u) => s + u.gewinn, 0);
    expect(gewinn2027).toBeGreaterThan(0);
    expect(g.ug[20].steuer).toBeCloseTo(d.annahmen.steuerUG * gewinn2027, 6);
    expect(g.d.annahmen.steuerUG).toBe(d.annahmen.steuerUG);
  });
  it('Zeile ausschalten nimmt sie aus dem Gesamtsatz; wieder einschalten stellt ihn her (bit-genau)', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'einzeln', wert: true }));
    const vorher = d.annahmen.steuerUG;
    d = an(d, steuerOps(d, 'ug', { art: 'an', steuer: 'gewst', wert: false }));
    expect(d.annahmen.steuerUG).toBeCloseTo(0.15 * 1.055, 12);
    d = an(d, steuerOps(d, 'ug', { art: 'an', steuer: 'gewst', wert: true }));
    expect(d.annahmen.steuerUG).toBeCloseTo(vorher, 12);
    const t = steuerAnteile(d.steuern!.ug!);
    expect(t.kst + t.soli + t.gewst).toBeCloseTo(1, 12);
  });
  it('Soli gilt nur mit Körperschaftsteuer', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'einzeln', wert: true }));
    d = an(d, steuerOps(d, 'ug', { art: 'an', steuer: 'kst', wert: false }));
    expect(gesamtsatzAus(d.steuern!.ug!)).toBeCloseTo(d.annahmen.steuerUG, 12);
    expect(d.annahmen.steuerUG).toBeCloseTo(STEUER_STANDARD.messzahl * (((planFix().annahmen.steuerUG - 0.15 * 1.055) / 0.035)), 9);
  });
  it('Pauschale Sätze (Einzel-Rechtsform, Ausstieg): aus = Satz 0, der alte Satz bleibt gemerkt und kommt zurück', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'rechtsform', wert: 'einzel' }));
    d = an(d, steuerOps(d, 'ug', { art: 'an', steuer: 'est', wert: false }));
    expect(d.annahmen.steuerUG).toBe(0); expect(d.steuern?.ug?.zeilen?.est?.satz).toBe(0.3);
    d = an(d, steuerOps(d, 'ug', { art: 'an', steuer: 'est', wert: true }));
    expect(d.annahmen.steuerUG).toBe(0.3);
    d = an(d, steuerOps(d, 'kdv', { art: 'an', steuer: 'exit', wert: false }));
    expect(d.annahmen.exitSteuer).toBe(0);
    d = an(d, steuerOps(d, 'kdv', { art: 'an', steuer: 'exit', wert: true }));
    expect(d.annahmen.exitSteuer).toBe(0.25);
  });
});

describe('Schreibweg: Stand, Säuberer, Rückweg', () => {
  it('Sätze werden begrenzt, Unbekanntes fällt weg, leeres Profil verschwindet', () => {
    const d = an(planFix(), [{ pfad: '/steuern/ug/zeilen/kst/satz', neu: 5 }, { pfad: '/steuern/ug/zeilen/gibtsnicht/an', neu: false }, { pfad: '/steuern/ug/zeilen/gewst/hebesatz', neu: -3 }]);
    expect(d.steuern?.ug?.zeilen?.kst?.satz).toBe(1);
    expect(d.steuern?.ug?.zeilen?.gewst?.hebesatz).toBe(0);
    expect(JSON.stringify(d.steuern)).not.toContain('gibtsnicht');
    expect(an(d, [{ pfad: '/steuern' }]).steuern).toBeUndefined();
    expect(pruefeSteuern({ ug: { rechtsform: 'quatsch', zeilen: { kst: { an: 'ja' } } } })).toBeUndefined();
  });
  it('pruefeDokument behält steuern und schwellen (sonst gingen sie beim Speichern verloren)', () => {
    const d = an(planFix(), [{ pfad: '/steuern/kdc/zeilen/est/an', neu: false }, { pfad: '/schwellen/freiGut', neu: 123 }]);
    const p = pruefeDokument(JSON.parse(JSON.stringify(d)));
    expect(p.ok && p.dokument.steuern?.kdc?.zeilen?.est?.an).toBe(false);
    expect(p.ok && p.dokument.schwellen?.freiGut).toBe(123);
  });
  it('Netto-Tabelle: mindestens zwei Paare, Brutto aufsteigend — sonst lehnt der Schreibweg ab', () => {
    expect(nettoTabelleOk([[1000, 800], [2000, 1500]])).toBe(true);
    expect(nettoTabelleOk([[1000, 800]])).toBe(false); expect(nettoTabelleOk([[2000, 1500], [1000, 800]])).toBe(false); expect(nettoTabelleOk([[1000, 800], [1000, 900]])).toBe(false);
    const d = planFix();
    expect(an(d, [{ pfad: '/annahmen/nettoTabelle', neu: [[1000, 700], [3000, 2000]] }]).annahmen.nettoTabelle[1]).toEqual([3000, 2000]);
    expect(() => an(d, [{ pfad: '/annahmen/nettoTabelle', neu: [[3000, 2000], [1000, 700]] }])).toThrow(OperationUngueltig);
  });
});

describe('Schwellen', () => {
  it('ohne Eintrag gelten die bisherigen Vorgaben; Eintrag überlagert; Unsinn fällt weg', () => {
    expect(schwellenVon({})).toEqual(SCHWELLEN_VORGABE);
    expect(schwellenVon({ schwellen: { runwayWarnMonate: 3 } }).runwayWarnMonate).toBe(3);
    expect(pruefeSchwellen({ ankerAnteilMax: 7, freiGut: -5, x: 1, runwayWarnMonate: 'a' })).toEqual({ ankerAnteilMax: 1, freiGut: 0 });
    expect(pruefeSchwellen({})).toBeUndefined();
  });
});
