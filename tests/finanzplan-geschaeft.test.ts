// ─── Finanzplanung jetzt — Business-Blatt, Break-even, Produkte, Lücken (erfundene Zahlen) ──
import { describe, it, expect } from 'vitest';
import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit, betragImMonat, reihen, pruefeBaustein, pruefePlanszenarien, neuerBaustein, planszenarienVon } from '../lib/finanzen/szenarien';
import { wendeOperationenAn, pruefeDokument } from '../lib/finanzen/plan/operationen';
import {
  breakEven, runwayAb, geschaeftsblatt, sachkostenDerMake, einmaligeKostenMake, bausteineVon, arbeitsplanSichern, neuesProdukt, BEISPIEL_PRODUKTE, summe12,
} from '../lib/finanzen/geschaeft';
import { luecken } from '../lib/finanzen/luecken';
import { annahmeGruppen, ANNAHMEN_IN_KARTE_STEUER, ANNAHMEN_EIGENER_EDITOR } from '../lib/finanzen/annahmen-felder';
import { planFix, arbeitsplanFix, arbeitsplanSelbst } from './fixtures/finanz-plan';
import type { Zeile } from '../lib/finanzen/rechenkern';

const JETZT = '2026-10-02T10:00:00.000Z';
const an = (d: FinanzDaten, ops: Parameters<typeof wendeOperationenAn>[1]) => wendeOperationenAn(d, ops, 'kevin', JETZT).dokument;

describe('Break-even und Runway', () => {
  it('Monatsergebnis: erster Monat der letzten nicht-negativen Strecke', () => {
    expect(breakEven([-5, -2, 1, 3, 4]).monatlich).toBe(3);
    expect(breakEven([-5, 2, -1, 3, 4]).monatlich).toBe(4);   // Rückfall in Monat 3 → erst ab 4
    expect(breakEven([1, 2, 3]).monatlich).toBe(1);
    expect(breakEven([1, 2, -3]).monatlich).toBeNull();
    expect(breakEven([0, 0, 0]).monatlich).toBe(1);
  });
  it('kumuliert: ab wann die Summe nicht mehr negativ ist', () => {
    expect(breakEven([-5, -2, 4, 4, 4]).kumuliert).toBe(4);  // −5 −7 −3 +1 +5
    expect(breakEven([-5, -2, 1]).kumuliert).toBeNull();
  });
  it('Runway: Monate ab jetzt bis die Liquidität unter null fällt', () => {
    expect(runwayAb([10, 8, 5, -1, -4], 2)).toBe(2);   // ab Monat 2: Monat 4 ist der erste negative → 2 Monate
    expect(runwayAb([10, 8, 5], 1)).toBeNull();
    expect(runwayAb([-3, 8], 1)).toBe(0);
  });
});

describe('Geschäftsblatt je Gesellschaft', () => {
  const d = planFix(14000), ps = arbeitsplanFix();
  const g = rechneMit(d, ps);
  const blatt = (ort: 'ug' | 'kdv' | 'kdc') => geschaeftsblatt(g.d, ort, g, ps, 1);
  it('MAKE: Umsatz, Kosten und Ergebnis kommen aus dem Kern; nach Steuern = vor − Einzelsteuern', () => {
    const b = blatt('ug');
    expect(b.umsatz).toEqual(g.ug.map(u => u.umsatz));
    expect(b.ergebnisVorSteuern).toEqual(g.ug.map(u => u.gewinn));
    b.ergebnisNachSteuern.forEach((v, i) => expect(v).toBeCloseTo(b.ergebnisVorSteuern[i] - b.steuer[i], 9));
    b.steuer.forEach((v, i) => expect(v).toBeCloseTo(g.ug[i].st.summe, 9));
    expect(b.liquiditaet).toEqual(g.ug.map(u => u.frei));
    b.umsatz.forEach((v, i) => expect(v - b.kostenSumme[i]).toBeCloseTo(b.ergebnisVorSteuern[i], 6));
  });
  it('Produkte der Gesellschaft stehen als Zeilen; Bausteine der Selbstständigkeit laufen NICHT mehr in den MAKE-Zahlen', () => {
    const b = blatt('ug');
    expect(b.produkte.map(p => p.b.id)).toEqual(['b1']);
    // Umsatz = Treiber (ob + retainer + provision + events) + ug-Bausteine — ohne die Selbstständigkeit
    g.ug.forEach((u, i) => expect(u.umsatz).toBeCloseTo(u.ob + u.retainer + u.astarna + u.events + b.produkte[0].werte[i], 6));
  });
  it('KD Ventures: Umlage und Rate heben sich auf; Ergebnis = Ausstieg + Bausteine; Steuer = Ertragsteuer auf die Bausteine + Steuer auf den Ausstieg', () => {
    const b = blatt('kdv');
    b.ergebnisVorSteuern.forEach((v, i) => expect(v).toBeCloseTo(g.ug[i].kdvExit + g.ug[i].kdvBausteineEin, 6));
    expect(b.liquiditaet).toEqual(g.ug.map(u => u.kdvFrei));
    b.steuer.forEach((v, i) => expect(v).toBeCloseTo(g.ug[i].kdvExitSteuer + g.ug[i].kdvSt.summe, 9));
  });
  it('Selbstständigkeit: eigene Bausteine, eigene Achse; Liquidität = frei (Konto nach Rücklage und USt), startet beim Kontostand', () => {
    const b = blatt('kdc');
    expect(b.umsatz.slice(0, 6)).toEqual([500, 500, 500, 500, 500, 500]); expect(b.umsatz[6]).toBe(0);
    expect(b.liquiditaet).toEqual(g.kdc.map(k => k.frei));
    expect(g.kdc[0].konto).toBeCloseTo(5000 + 500 * 1.19, 9);   // Konto-Start 5.000 + Eingang 500 (kein Zahlungsziel) + USt
    expect(b.breakEven.monatlich).toBe(1);      // keine Kosten: das Ergebnis ist nie negativ
  });
  it('Stellen zählen im Blatt mit Arbeitgeberanteil (wie im Kern)', () => {
    const b = blatt('ug');
    expect(b.kosten.find(k => k.b.id === 'b2')!.werte[5]).toBeCloseTo(2000 * 1.2, 9);
    expect(b.kosten.find(k => k.b.id === 'b3')!.werte[0]).toBe(99);
  });
  it('Selbstständigkeit: Stellen zählen auch dort mit Arbeitgeberanteil (wie im Kern)', () => {
    const p = arbeitsplanSelbst(), gg = rechneMit(planFix(14000), p);
    const b = geschaeftsblatt(gg.d, 'kdc', gg, p, 1);
    expect(b.kosten.find(k => k.b.id === 'k3')!.werte[3]).toBeCloseTo(1000 * 1.2, 9);
    expect(b.kostenSumme[3]).toBeCloseTo(300 + 1200, 9);
    expect(b.ergebnisVorSteuern[3]).toBeCloseTo(6000 - 1500, 9);
  });
  it('summe12 nimmt die nächsten zwölf Monate ab „jetzt“', () => {
    expect(summe12([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 2)).toBe(2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13);
  });
});

describe('Produkte im Business-Blatt', () => {
  it('ohne Arbeitsplan legt das erste Produkt einen an — in EINER Änderung, rückgängig als Ganzes', () => {
    const d = planFix();
    const s = arbeitsplanSichern(d, 'psNeu', JETZT);
    expect(s.id).toBe('psNeu'); expect(s.vorOps.length).toBe(2);
    const b = neuesProdukt('b9', 'ug', { name: BEISPIEL_PRODUKTE[0].name, rhythmus: 'monatlich', laufzeit: 6, start: 2 });
    const e = an(d, [...s.vorOps, { pfad: '/planszenarien/id=psNeu/bausteine/-', neu: b }]);
    expect(e.arbeitsplan).toBe('psNeu'); expect(planszenarienVon(e)[0].bausteine[0]).toMatchObject({ id: 'b9', einheit: 'ug', preis: 0, menge: 1, name: 'Interim CSO', laufzeit: 6 });
    // mit Preis: der Umsatz erscheint im Kern
    const f = an(e, [{ pfad: '/planszenarien/id=psNeu/bausteine/id=b9/preis', neu: 7000 }]);
    expect(rechneMit(f, planszenarienVon(f)[0]).ug[1].bausteineUmsatz).toBe(7000);
    expect(rechneMit(e, planszenarienVon(e)[0]).ug[1].bausteineUmsatz).toBe(0);   // Vorlage ohne Preis bringt nichts
  });
  it('mit vorhandenem Arbeitsplan: keine zusätzlichen Schritte', () => {
    const d = { ...planFix(), planszenarien: [arbeitsplanFix()], arbeitsplan: 'ps1' };
    expect(arbeitsplanSichern(d, 'x', JETZT)).toEqual({ id: 'ps1', vorOps: [] });
  });
  it('Vorlagen sind leer: Beispiel-Namen, kein Preis', () => {
    expect(BEISPIEL_PRODUKTE.map(v => v.name)).toEqual(['Interim CSO', 'Interim Head of Sales', 'Events']);
    const b = neuesProdukt('x', 'kdv', { name: 'Events', rhythmus: 'einmalig', start: 3 });
    expect(b).toMatchObject({ preis: 0, rhythmus: 'einmalig', einheit: 'kdv' }); expect('laufzeit' in b).toBe(false);
  });
  it('Monat von Hand überschreiben: gilt unabhängig von Laufzeit, „aus“ schaltet auch ihn ab, Rest unverändert', () => {
    const b = neuerBaustein('b', { art: 'umsatz', preis: 100, start: 2, laufzeit: 2 });
    expect([1, 2, 3, 4].map(m => betragImMonat(b, m))).toEqual([0, 100, 100, 0]);
    const u = { ...b, ueber: { m4: 555, m2: 0 } };
    expect([1, 2, 3, 4].map(m => betragImMonat(u, m))).toEqual([0, 0, 100, 555]);
    expect(betragImMonat({ ...u, an: false }, 4)).toBe(0);
    const p = { ...arbeitsplanFix(), bausteine: [u] };
    expect(reihen(p, 5).ugUmsatz).toEqual([0, 0, 100, 555, 0]);
  });
  it('Säuberer behält ueber, verwirft Unsinn; Überschreibung per Operation setzen und zurücksetzen', () => {
    expect(pruefeBaustein({ id: 'b', art: 'umsatz', ueber: { m3: 5, x: 1, m4: 'a', m5: Infinity } })?.ueber).toEqual({ m3: 5 });
    expect(pruefeBaustein({ id: 'b', art: 'umsatz', ueber: {} })?.ueber).toBeUndefined();
    expect(pruefePlanszenarien([{ id: 'p', bausteine: [{ id: 'b', art: 'umsatz', ueber: { m2: 9 } }] }], ['s1'])[0].bausteine[0].ueber).toEqual({ m2: 9 });
    const d = { ...planFix(), planszenarien: [arbeitsplanFix()], arbeitsplan: 'ps1' };
    const e = an(d, [{ pfad: '/planszenarien/id=ps1/bausteine/id=b1/ueber/m5', neu: 4242 }]);
    expect(rechneMit(e, planszenarienVon(e)[0]).ug[4].bausteineUmsatz).toBe(4242);
    const f = an(e, [{ pfad: '/planszenarien/id=ps1/bausteine/id=b1/ueber/m5' }]);
    expect(rechneMit(f, planszenarienVon(f)[0]).ug[4].bausteineUmsatz).toBe(1600);
    const p = pruefeDokument(JSON.parse(JSON.stringify(e)));
    expect(p.ok && p.dokument.planszenarien?.[0].bausteine[0].ueber).toEqual({ m5: 4242 });
  });
  it('bausteineVon trennt nach Gesellschaft und Art, Regler nur auf Wunsch', () => {
    const p = { ...arbeitsplanFix(), bausteine: [...arbeitsplanFix().bausteine, neuerBaustein('r', { art: 'umsatz', einheit: 'ug', preis: 1, regler: 'umsatz' })] };
    expect(bausteineVon(p, 'ug', 'umsatz').map(b => b.id)).toEqual(['b1']);
    expect(bausteineVon(p, 'ug', 'umsatz', true).map(b => b.id)).toEqual(['b1', 'r']);
    expect(bausteineVon(p, 'kdc', 'kosten')).toEqual([]);
    expect(bausteineVon(null, 'ug', 'umsatz')).toEqual([]);
  });
});

describe('Was ist noch offen?', () => {
  it('leerer Plan: Arbeitsplan, Netto-Tabelle, Umsatz je Gesellschaft, Steuern, Gehälter, Ziele', () => {
    const d = planFix(0);
    const e: FinanzDaten = { ...d, plan: {}, szenarien: [{ ...d.szenarien[0], ob: { betrag: 0, start: 0, laufzeit: 0 }, retainer: [], astarna: { betrag: 0, ab: 0 }, events: { betrag: 0, ab: 0 }, exit1: { betrag: 0, monat: 0 }, exit2: { betrag: 0, monat: 0 } }], selbst: { ...d.selbst, posten: [] }, annahmen: { ...d.annahmen, kevinBrutto: 0, malinBrutto: 0, nettoTabelle: [[0, 0], [1, 1]] }, sachkosten: [] };
    const l = luecken(e, rechneMit(e, null).ug, 2).map(x => x.id);
    expect(l).toEqual(expect.arrayContaining(['arbeitsplan', 'netto', 'umsatz-ug', 'umsatz-kdv', 'umsatz-kdc', 'steuern', 'gehaelter', 'kosten-ug', 'konten', 'ziele']));
  });
  it('Punkte verschwinden, wenn das Feld gefüllt ist', () => {
    let d: FinanzDaten = { ...planFix(14000), planszenarien: [arbeitsplanFix()], arbeitsplan: 'ps1', ziele: [{ id: 'z', name: 'Z', quelle: 'ug.frei', ziel: 1, bis: '2027-12', einheit: 'ug' }] };
    d = an(d, [{ pfad: '/steuern/ug/rechtsform', neu: 'kapital' }]);
    const ids = luecken(d, rechneMit(d, arbeitsplanFix()).ug, 0).map(x => x.id);
    expect(ids).not.toContain('arbeitsplan'); expect(ids).not.toContain('steuern'); expect(ids).not.toContain('ziele'); expect(ids).not.toContain('umsatz-ug');
  });
  it('Produkt ohne Preis wird genannt', () => {
    const p = { ...arbeitsplanFix(), bausteine: [neuerBaustein('x', { art: 'umsatz', einheit: 'ug', name: 'Leer', preis: 0 })] };
    const d = { ...planFix(), planszenarien: [p], arbeitsplan: 'ps1' };
    expect(luecken(d, rechneMit(d, p).ug, 0).find(x => x.id === 'ohne-preis')?.text).toContain('Leer');
  });
});

describe('Annahmen-Felder', () => {
  it('jedes Feld des Kerns hat genau einen Ort: Feldliste, Steuerkarte oder eigener Editor', () => {
    const felder = annahmeGruppen('A', 'B').flatMap(g => g.felder.map(f => f.k));
    const alle = Object.keys(planFix().annahmen);
    const abgedeckt = new Set<string>([...felder, ...ANNAHMEN_IN_KARTE_STEUER, ...ANNAHMEN_EIGENER_EDITOR]);
    expect(alle.filter(k => !abgedeckt.has(k))).toEqual([]);
    expect(new Set(felder).size).toBe(felder.length);
  });
});

describe('Sachkosten der Selbstständigkeit im MAKE-Blatt', () => {
  const selbst = { id: 'sk9', name: 'Selbst-Software', einheit: 'selbststaendigkeit', gruppe: 'Tools', soll: 120, ab: 1 } as Zeile;
  it('stehen nicht in der MAKE-Liste (nicht doppelt) und verzerren „Einmalige Kosten und Ereignisse“ nicht ins Negative', () => {
    const d = planFix(9000);
    const mit = { ...d, sachkosten: [...d.sachkosten, selbst] };
    const g = rechneMit(mit, arbeitsplanFix());
    const ohne = rechneMit(d, arbeitsplanFix());
    expect(sachkostenDerMake(mit.sachkosten).map(z => z.id)).toEqual(['sk1', 'sk2']);
    for (const m of [1, 4, 8]) {
      expect(einmaligeKostenMake(g.ug[m - 1], mit, m)).toBeGreaterThanOrEqual(-1e-9);
      expect(einmaligeKostenMake(g.ug[m - 1], mit, m)).toBeCloseTo(einmaligeKostenMake(ohne.ug[m - 1], d, m), 9);
    }
  });
});
