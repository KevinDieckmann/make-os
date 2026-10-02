// ─── Finanzplanung jetzt — Welche Steuern gelten? (erfundene Zahlen) ─────────
// Standard je Rechtsform, Schalter, Aufschlüsselung, Operationen, Säuberer, Schwellen, Netto-Tabelle.
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { wendeOperationenAn, pruefeDokument, nettoTabelleOk, OperationUngueltig } from '../lib/finanzen/plan/operationen';
import {
  rechtsformStandard, rechtsformVon, steuerArtenFuer, zeigeSteuer, steuerOps, steuerZeilen, steuerFelder, steuerParameter, steuernMit, pruefeSteuern,
} from '../lib/finanzen/steuern';
import { aufteilen, gesamtquote, TARIF_2026 } from '../lib/finanzen/ertragsteuer';
import { schwellenVon, pruefeSchwellen, SCHWELLEN_VORGABE } from '../lib/finanzen/schwellen';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

const JETZT = '2026-10-02T10:00:00.000Z';
const an = (d: FinanzDaten, ops: Parameters<typeof wendeOperationenAn>[1]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;

describe('Standard je Rechtsform', () => {
  it('GmbH/UG sind Kapitalgesellschaften, die Selbstständigkeit ein Einzelunternehmen, Privat hat keine Rechtsform', () => {
    expect(rechtsformStandard('ug')).toBe('kapital'); expect(rechtsformStandard('kdv')).toBe('kapital');
    expect(rechtsformStandard('kdc')).toBe('einzel'); expect(rechtsformStandard('privat')).toBeNull();
  });
  it('nur die Zeilen, die zur Rechtsform passen', () => {
    expect(steuerArtenFuer('ug', 'kapital')).toEqual(['kst', 'soli', 'gewst', 'ust', 'ausschuettung']);
    expect(steuerArtenFuer('ug', 'einzel')).toEqual(['est', 'gewst', 'ust', 'ausschuettung']);
    expect(steuerArtenFuer('kdv', 'kapital')).toEqual(['kst', 'soli', 'gewst', 'exit']);
    expect(steuerArtenFuer('kdc', 'einzel')).toEqual(['est', 'gewst', 'ust']);
    expect(steuerArtenFuer('privat', null)).toEqual(['netto', 'ausschuettung']);
  });
  it('ohne Profil: alles Passende gilt, nichts Unpassendes erscheint', () => {
    const d = planFix();
    expect(zeigeSteuer(d, 'ug', 'kst')).toBe(true); expect(zeigeSteuer(d, 'ug', 'est')).toBe(false);
    expect(zeigeSteuer(d, 'kdc', 'est')).toBe(true); expect(zeigeSteuer(d, 'kdc', 'kst')).toBe(false); expect(zeigeSteuer(d, 'kdc', 'ust')).toBe(true); expect(zeigeSteuer(d, 'kdv', 'kst')).toBe(true);
    expect(rechtsformVon(d, 'ug')).toBe('kapital');
  });
  it('Rechtsform wechseln (jede Gesellschaft) zeigt andere Zeilen; die Annahmen bleiben unangetastet', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'rechtsform', wert: 'einzel' }));
    expect(rechtsformVon(d, 'ug')).toBe('einzel'); expect(d.annahmen.steuerUG).toBe(0.3);
    expect(zeigeSteuer(d, 'ug', 'est')).toBe(true); expect(zeigeSteuer(d, 'ug', 'kst')).toBe(false);
    expect(steuerZeilen(d, 'ug', 0.264).map(z => z.art)).toEqual(['est', 'gewst', 'ust', 'ausschuettung']);
    d = an(d, steuerOps(d, 'kdc', { art: 'rechtsform', wert: 'kapital' }));
    expect(steuerParameter(d, 'kdc').form).toBe('kapital');
  });
});

describe('Parameter: Vorgabe, Eintrag, Zurücksetzen', () => {
  it('ohne Eintrag gelten die Vorgaben; der Hebesatz ist aus dem früheren Gesamtsatz abgeleitet', () => {
    const p = steuerParameter(planFix(), 'ug');
    expect(p.kst).toBe(0.15); expect(p.soli).toBe(0.055); expect(p.messzahl).toBe(0.035);
    expect(p.hebesatz).toBeCloseTo(((0.3 - 0.15 * 1.055) / 0.035) * 100, 9);
    expect(gesamtquote(p)).toBeCloseTo(0.3, 12);
    expect(p.verlustvortrag).toBe(true); expect(p.zahlweise).toBe('folgejahr'); expect(p.zahlMonat).toBe(6);
    const k = steuerParameter(planFix(), 'kdc');
    expect(k.form).toBe('einzel'); expect(k.freibetrag).toBe(24500); expect(k.anrechnung).toBe(4); expect(k.tarif).toEqual(TARIF_2026); expect(k.estAbzug).toBe(3500);
  });
  it('aufteilen(): die Summe ergibt immer genau den Gesamtsatz, der Hebesatz ist der Rest', () => {
    for (const g of [0.3, 0.2825, 0.158251, 0.15, 0.05, 0]) { const a = aufteilen(g); expect(a.kst * (1 + a.soli) + a.messzahl * a.hebesatz / 100).toBeCloseTo(g, 12); }
    expect(aufteilen(0.3).hebesatz).toBeCloseTo(((0.3 - 0.15 * 1.055) / 0.035) * 100, 9);
    expect(aufteilen(0.1).hebesatz).toBe(0); expect(aufteilen(0.1).kst).toBeLessThan(0.15);
  });
  it('Ein Feld eintragen schreibt unter /steuern/<ort>; „zurücksetzen“ (null) entfernt es wieder — danach gilt die Vorgabe', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'feld', id: 'gewst.hebesatz', wert: 400 }));
    expect(d.steuern?.ug?.zeilen?.gewst?.hebesatz).toBe(400); expect(steuerParameter(d, 'ug').hebesatz).toBe(400);
    d = an(d, steuerOps(d, 'ug', { art: 'feld', id: 'zahlweise', wert: 'quartal' }));
    expect(steuerParameter(d, 'ug').zahlweise).toBe('quartal');
    d = an(d, steuerOps(d, 'ug', { art: 'feld', id: 'gewst.hebesatz', wert: null }));
    d = an(d, steuerOps(d, 'ug', { art: 'feld', id: 'zahlweise', wert: null }));
    expect(d.steuern).toBeUndefined();   // leeres Profil verschwindet
    expect(steuerParameter(d, 'ug')).toEqual(steuerParameter(planFix(), 'ug'));
  });
  it('steuerFelder(): Wert, Vorgabe und „gesetzt“ je Feld; Tarif-Eckwerte nur bei Einzelunternehmen', () => {
    const d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'feld', id: 'kst.satz', wert: 0.2 }));
    const f = steuerFelder(d, 'ug', d.steuern, undefined);
    const kst = f.find(x => x.id === 'kst.satz')!;
    expect(kst).toMatchObject({ wert: 0.2, vorgabe: 0.15, gesetzt: true });
    expect(f.find(x => x.id === 'soli.satz')).toMatchObject({ wert: 0.055, gesetzt: false });
    expect(f.some(x => x.gruppe === 'tarif')).toBe(false);
    const k = steuerFelder(planFix(), 'kdc', undefined, undefined);
    expect(k.filter(x => x.gruppe === 'tarif').length).toBe(13); expect(k.find(x => x.id === 'freibetrag')).toMatchObject({ wert: 24500, gesetzt: false });
    expect(steuerFelder(planFix(), 'privat', undefined, undefined)).toEqual([]);
  });
  it('Je Szenario: die Überlagerung gilt nur dort, der Platzhalter zeigt den Wert des Plans', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'feld', id: 'gewst.hebesatz', wert: 400 }));
    d = { ...d, planszenarien: [{ ...arbeitsplanFix(), annahmen: {} }] };
    const ops = steuerOps(d, 'ug', { art: 'feld', id: 'gewst.hebesatz', wert: 500 }, { art: 'szenario', id: 'ps1' }, undefined);
    expect(ops[0].pfad).toBe('/planszenarien/id=ps1/annahmen/steuern/ug/zeilen/gewst/hebesatz');
    d = an(d, ops);
    const ps = d.planszenarien![0];
    expect(ps.annahmen.steuern?.ug?.zeilen?.gewst?.hebesatz).toBe(500);
    expect(steuerParameter({ ...d, steuern: steuernMit(d.steuern, ps.annahmen.steuern) }, 'ug').hebesatz).toBe(500);
    expect(steuerParameter(d, 'ug').hebesatz).toBe(400);
    const f = steuerFelder({ ...d, steuern: steuernMit(d.steuern, ps.annahmen.steuern) }, 'ug', ps.annahmen.steuern, d.steuern).find(x => x.id === 'gewst.hebesatz')!;
    expect(f).toMatchObject({ wert: 500, vorgabe: 400, gesetzt: true });
    // Zurücksetzen räumt die Überlagerung auf
    const e = an(d, steuerOps(d, 'ug', { art: 'feld', id: 'gewst.hebesatz', wert: null }, { art: 'szenario', id: 'ps1' }, ps.annahmen.steuern));
    expect(e.planszenarien![0].annahmen.steuern).toBeUndefined();
  });
  it('Zeile ausschalten gilt als Parameter (kstAn/gewstAn); Soli nur mit Körperschaftsteuer', () => {
    let d = an(planFix(), steuerOps(planFix(), 'ug', { art: 'an', steuer: 'gewst', wert: false }));
    expect(steuerParameter(d, 'ug').gewstAn).toBe(false);
    expect(gesamtquote(steuerParameter(d, 'ug'))).toBeCloseTo(0.15 * 1.055, 12);
    d = an(d, steuerOps(d, 'ug', { art: 'an', steuer: 'kst', wert: false }));
    expect(gesamtquote(steuerParameter(d, 'ug'))).toBe(0);
  });
  it('Steuer auf den Ausstieg: aus = Satz 0, der alte Satz bleibt gemerkt und kommt zurück', () => {
    let d = an(planFix(), steuerOps(planFix(), 'kdv', { art: 'an', steuer: 'exit', wert: false }));
    expect(d.annahmen.exitSteuer).toBe(0); expect(d.steuern?.kdv?.zeilen?.exit?.satz).toBe(0.25);
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
