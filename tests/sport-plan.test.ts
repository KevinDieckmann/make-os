// ─── Sport · Ziele & Plan: Wochenstruktur, Plan/Ist, Deload, Modell ─────────
import { describe, it, expect } from 'vitest';
import { wochenBis, hauptziel, vorschlagWoche, planUmfang, wocheIst, planIst, deload, wochentagVon } from '../lib/sport/plan';
import { leererStand, saeubere, wendeAn, WOCHENTAGE, type Ziel } from '../lib/sport/modell';

const ziel = (id: string, teil: Partial<Ziel> = {}): Ziel => ({ id, art: 'hyrox', titel: 'Test', angelegt: '2026-09-01T00:00:00.000Z', ...teil });

describe('Ziele', () => {
  it('Wochen bis zum Ziel, aufgerundet, nie negativ', () => {
    expect(wochenBis('2026-09-27', '2026-12-05')).toBe(10);
    expect(wochenBis('2026-09-27', '2026-09-28')).toBe(1);
    expect(wochenBis('2026-09-27', '2026-09-01')).toBe(0);
  });
  it('Hauptziel ist das nächste offene mit Datum', () => {
    const z = [ziel('a', { datum: '2027-03-01' }), ziel('b', { datum: '2026-12-05' }), ziel('c', { datum: '2026-01-01' }), ziel('d', { erledigt: true, datum: '2026-10-01' })];
    expect(hauptziel(z, '2026-09-27')!.id).toBe('b');
    expect(hauptziel([ziel('x')], '2026-09-27')!.id).toBe('x');
    expect(hauptziel([], '2026-09-27')).toBeNull();
  });
});

describe('Wochenstruktur', () => {
  it('Hyrox mit 4 Tagen: Lauf, Gym, Hyrox, Lauf — Sonntag Ruhe, Rest frei', () => {
    const w = vorschlagWoche('hyrox', 4);
    expect([w.di.art, w.do.art, w.sa.art, w.mo.art]).toEqual(['lauf', 'gym', 'hyrox', 'lauf']);
    expect(w.so.art).toBe('ruhe');
    const u = planUmfang(w);
    expect(u.einheiten).toBe(4); expect(u.ruhetage).toBe(1); expect(u.je.frei).toBe(2);
    expect(u.minuten).toBe(45 + 60 + 60 + 45);
  });
  it('Laufziel ist überwiegend Laufen, Kraftziel überwiegend Gym', () => {
    expect(planUmfang(vorschlagWoche('lauf', 3)).je.lauf).toBe(2);
    expect(planUmfang(vorschlagWoche('kraft', 3)).je.gym).toBe(2);
  });
  it('auch mit 6 Tagen bleibt ein Ruhetag', () => {
    const w = vorschlagWoche('grundlagen', 6);
    expect(WOCHENTAGE.filter(t => w[t].art === 'ruhe')).toHaveLength(1);
    expect(planUmfang(w).einheiten).toBe(6);
  });
});

describe('Plan gegen Ist', () => {
  const s = (() => {
    let st = leererStand();
    st = wendeAn(st, { op: 'woche', tage: vorschlagWoche('hyrox', 4), planStart: '2026-09-07' });
    st = wendeAn(st, { op: 'lauf', eintrag: { id: 'l1', datum: '2026-09-22', distanzKm: 8, dauerSek: 2400, art: 'locker' } });
    st = wendeAn(st, { op: 'gym', eintrag: { id: 'g1', datum: '2026-09-24', uebungen: [{ uebung: 'kniebeuge', saetze: [{ kg: 60, wdh: 5 }] }] } });
    st = wendeAn(st, { op: 'hyrox', eintrag: { id: 'h1', datum: '2026-09-26', stationen: { skierg: 250 }, laeufe: [] } });
    st = wendeAn(st, { op: 'lauf', eintrag: { id: 'l0', datum: '2026-09-15', distanzKm: 5, dauerSek: 1500, art: 'tempo' } });
    return st;
  })();
  it('zählt die Woche', () => {
    expect(wocheIst(s, '2026-09-21')).toMatchObject({ hyrox: 1, lauf: 1, gym: 1, einheiten: 3, km: 8 });
    expect(wocheIst(s, '2026-09-14').einheiten).toBe(1);
  });
  it('Plan/Ist je Woche, aktuelle zuletzt', () => {
    const p = planIst(s, '2026-09-27', 4);
    expect(p).toHaveLength(4);
    expect(p[3]).toMatchObject({ montag: '2026-09-21', plan: 4, ist: 3, anteil: 0.75 });
    expect(p[2]).toMatchObject({ plan: 4, ist: 1 });
  });
  it('Deload alle 4 Wochen ab Planstart', () => {
    expect(deload(undefined, '2026-09-27')).toBeNull();
    expect(deload('2026-09-07', '2026-09-27', 4)).toMatchObject({ wocheImBlock: 3, jetzt: false, naechsteIn: 1, naechsterMontag: '2026-09-28' });
    expect(deload('2026-09-07', '2026-09-30', 4)).toMatchObject({ wocheImBlock: 4, jetzt: true, naechsteIn: 0 });
    expect(deload('2026-09-07', '2026-10-06', 4)!.wocheImBlock).toBe(1);
  });
  it('Wochentag eines Datums', () => {
    expect(wochentagVon('2026-09-27')).toBe('so');
    expect(wochentagVon('2026-09-21')).toBe('mo');
  });
});

describe('Modell: Prüfung und Schritte', () => {
  it('saeubere macht aus Müll einen leeren Stand und behält Gültiges', () => {
    expect(saeubere(null)).toEqual(leererStand());
    expect(saeubere('x').ziele).toEqual([]);
    const s = saeubere({ ziele: [{ id: 'z1', art: 'lauf', titel: '10 km', zielzeitSek: '3000', distanzKm: 10 }, { id: 'kaputt' }], laeufe: [{ id: 'l1', datum: '2026-09-01', distanzKm: '5,5', dauerSek: 1800 }, { id: 'l2', datum: 'gestern', distanzKm: 5, dauerSek: 1800 }], erholung: { '2026-09-01': { schlafH: 7.5, gefuehl: 9 }, 'x': { schlafH: 7 } }, woche: { mo: { art: 'lauf', dauerMin: 40 }, di: { art: 'quatsch' } } });
    expect(s.ziele).toHaveLength(1); expect(s.ziele[0].zielzeitSek).toBe(3000);
    expect(s.laeufe).toHaveLength(1); expect(s.laeufe[0].distanzKm).toBe(5.5); expect(s.laeufe[0].quelle).toBe('hand');
    expect(s.erholung['2026-09-01']).toEqual({ schlafH: 7.5 }); expect(s.erholung.x).toBeUndefined();
    expect(s.woche.mo).toEqual({ art: 'lauf', dauerMin: 40 }); expect(s.woche.di.art).toBe('frei');
  });
  it('Schritte verändern das Original nicht und lehnen Unvollständiges ab', () => {
    const a = leererStand();
    const b = wendeAn(a, { op: 'erholung', tag: '2026-09-27', werte: { schlafH: 7, gefuehl: 4 } });
    expect(a.erholung).toEqual({});
    expect(b.erholung['2026-09-27']).toEqual({ schlafH: 7, gefuehl: 4 });
    const c = wendeAn(b, { op: 'erholung', tag: '2026-09-27', werte: { muskelkater: 2 } });
    expect(c.erholung['2026-09-27']).toEqual({ schlafH: 7, gefuehl: 4, muskelkater: 2 });
    expect(() => wendeAn(a, { op: 'lauf', eintrag: { id: 'l', datum: '2026-09-27' } })).toThrow(/Distanz/);
    expect(() => wendeAn(a, { op: 'gym', eintrag: { id: 'g', datum: '2026-09-27', uebungen: [] } })).toThrow(/Satz/);
    expect(() => wendeAn(a, { op: 'erholung', tag: 'heute', werte: {} })).toThrow(/Tag/);
  });
  it('Ziele werden nach Datum sortiert und per Kennung ersetzt', () => {
    let s = wendeAn(leererStand(), { op: 'ziel', eintrag: ziel('a', { datum: '2027-01-01' }) });
    s = wendeAn(s, { op: 'ziel', eintrag: ziel('b', { datum: '2026-12-05' }) });
    s = wendeAn(s, { op: 'ziel', eintrag: ziel('a', { datum: '2026-11-01', titel: 'Neu' }) });
    expect(s.ziele.map(z => z.id)).toEqual(['a', 'b']);
    expect(s.ziele[0].titel).toBe('Neu');
    expect(wendeAn(s, { op: 'ziel-weg', id: 'a' }).ziele).toHaveLength(1);
  });
  it('Ausgangswerte werden zusammengeführt, Kraft je Übung', () => {
    let s = wendeAn(leererStand(), { op: 'ausgang', werte: { lauf10kSek: 3300, kraft: { kniebeuge: 70 } } });
    s = wendeAn(s, { op: 'ausgang', werte: { tageProWoche: 4, kraft: { kreuzheben: 90 } } });
    expect(s.ausgang).toEqual({ lauf10kSek: 3300, tageProWoche: 4, kraft: { kniebeuge: 70, kreuzheben: 90 } });
  });
});
