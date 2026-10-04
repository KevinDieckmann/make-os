// ─── Lichtfäden v2 — Baum, Dichte, Ansicht (LOD), Navigation (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import { baueBaum, rechneAnsicht, ansicht, ansichtText, raster, wochenVon, montag, kalenderwoche, faedenDeckeln, abstufen, FAEDEN, MAX_BUENDEL, MAX_STRANG_BUENDEL, type Baum } from '@/lib/lichtfaeden/baum';
import { BEIDE, GESAMT, knotenId, themaPfad, type Knoten, type Strang } from '@/lib/lichtfaeden/modell';
import { navStart, tiefer, zurueck } from '@/lib/lichtfaeden/navigation';

const HEUTE = '2026-10-03';
const VON = '2026-10-01', BIS = '2027-03-31';
const zielK = (id: string, eltern: string, farbe = '#FFC93C', rang = 1): Knoten => ({ id: knotenId.ziel(id), art: 'ziel', name: `Ziel ${id}`, farbe, eltern, rang, link: `/os/planung/ziel/${id}` });
const msK = (id: string, ziel: string, rang = 0): Knoten => ({ id: knotenId.meilenstein(id), art: 'meilenstein', name: `MS ${id}`, farbe: '#FF9F43', eltern: knotenId.ziel(ziel), rang });
let n = 0;
const s = (pfad: string[], tag: string, x: Partial<Strang> = {}): Strang => ({ id: `t:${++n}`, quelle: 'aufgabe', titel: `Strang ${n}`, pfad, person: BEIDE, zeit: { tag }, gewicht: 1, status: 'offen', ...x });

const BIZ = themaPfad('business', 'planung');
const Z1 = [...BIZ, 'ziel:z1'];
function bau(): Baum {
  n = 0;
  const knoten = [zielK('z1', BIZ.at(-1)!), msK('m1', 'z1'), msK('m2', 'z1', 1)];
  const st = [
    s([...Z1, 'ms:m1'], '2026-11-04', { quelle: 'meilenstein', gewicht: 3 }),
    s([...Z1, 'ms:m1'], '2026-11-02'), s([...Z1, 'ms:m1'], '2026-11-03', { person: 'kevin' }),
    s([...Z1, 'ms:m2'], '2027-01-20', { quelle: 'meilenstein', gewicht: 3 }),
    s(Z1, '2026-12-01', { quelle: 'ziel', gewicht: 3 }),
    s(themaPfad('privat', 'gesundheit'), '2026-10-20', { quelle: 'termin', gewicht: 0.5, person: 'malin' }),
    s(themaPfad('business', 'markttraktion'), '2026-10-14', { quelle: 'followup', person: 'malin' }),
    s([GESAMT, 'space:privat'], '2026-10-21', { quelle: 'belegt', titel: 'Belegt', gewicht: 0.5, person: 'malin' }),
    s([...Z1, 'ms:unbekannt'], '2026-10-15'), // Pfad endet an einem unbekannten Knoten → gekürzt bis zum Ziel
    s(BIZ, '2026-09-28', { status: 'ueberfaellig' }), // überfällig → zählt in der Woche von heute
    s(BIZ, '2025-01-01'), // weit außerhalb
  ];
  return baueBaum(knoten, st);
}

describe('Baum', () => {
  it('feste Ebenen gesamt → space → thema, Zusatzknoten darunter; Pfade auf bekannte Knoten gekürzt', () => {
    const b = bau();
    expect(b.kinder.get(GESAMT)).toEqual(['space:business', 'space:privat']);
    expect(b.kinder.get('space:privat')).toContain('thema:privat:gesundheit');
    expect(b.kinder.get('ziel:z1')).toEqual(['ms:m1', 'ms:m2']);
    expect(b.straenge.find(x => x.id === 't:9')!.pfad.at(-1)).toBe('ziel:z1');
  });
  it('Knoten ohne Eltern fallen weg, doppelte Stränge zählen einmal', () => {
    const b = baueBaum([zielK('lose', 'thema:business:gibtsnicht')], [s(BIZ, '2026-11-01', { id: 'x' }), s(BIZ, '2026-11-01', { id: 'x' })]);
    expect(b.knoten.has('ziel:lose')).toBe(false);
    expect(b.straenge.length).toBe(1);
  });
});

describe('Raster und Wochen', () => {
  it('Montage, KW, Spanne, überfällig in der Woche von heute', () => {
    expect(montag('2026-10-03')).toBe('2026-09-28');
    expect(kalenderwoche('2026-10-26')).toBe(44);
    expect(kalenderwoche('2027-01-01')).toBe(53);
    const r = raster('2026-10-01', '2026-12-31');
    expect(r.wochen[0]).toBe('2026-09-28');
    const spanne = wochenVon({ zeit: { tag: '2026-10-05', bis: '2026-10-20' }, status: 'offen' }, r, HEUTE);
    expect(spanne.length).toBe(3);
    const ueber = wochenVon({ zeit: { tag: '2026-08-01' }, status: 'ueberfaellig' }, r, HEUTE);
    const heuteW = wochenVon({ zeit: { tag: HEUTE }, status: 'offen' }, r, HEUTE);
    expect(ueber).toEqual(heuteW);
  });
});

describe('Ansicht — LOD, Summen, Dichte', () => {
  const alle = { art: 'alle' } as const;
  it('Gesamt: wenige dicke Bündel (Spaces), Summen = Summe der Kinder', () => {
    const b = bau();
    const a = ansicht(b, { wurzel: GESAMT, von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(a.buendel.map(x => x.id)).toEqual(['space:business', 'space:privat']);
    const biz = a.buendel[0];
    expect(biz.summe).toBe(3 + 1 + 1 + 3 + 3 + 1 + 1 + 1); // m1-Strang, 2 Aufgaben, m2, Ziel-Frist, gekürzte, Follow-up, überfällige
    expect(a.gesamt.reduce((x, y) => x + y, 0)).toBeCloseTo(a.buendel.reduce((x, y) => x + y.roh.reduce((p, q) => p + q, 0), 0));
    expect(biz.faeden).toBeGreaterThan(a.buendel[1].faeden);
    expect(biz.tiefer).toBe('space:business');
    expect(a.pfad.map(k => k.id)).toEqual([GESAMT]);
    // Strahl ruhig (04.10. abends): Ausschlag NUR aus Abweichungen — gleiche Länge wie die Dichte, 0 … 1 (tests/strahl-ruhig.test.ts).
    for (const x of a.buendel) {
      expect(x.ausschlag.length).toBe(x.dichte.length);
      expect(x.ausschlag.every(v => v >= 0 && v <= 1)).toBe(true);
    }
  });
  it('Space → Themen; Thema → Ziele; Ziel → Meilensteine + „Ohne Meilenstein“; Privat zeigt anonymes „Belegt“', () => {
    const b = bau();
    const o = (w: string) => ansicht(b, { wurzel: w, von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(o('space:business').buendel.map(x => x.id)).toEqual(['thema:business:planung', 'thema:business:markttraktion']);
    expect(o('thema:business:planung').buendel.map(x => x.id)).toEqual(['ziel:z1', 'direkt:thema:business:planung']);
    expect(o('thema:business:planung').buendel[1].name).toBe('Ohne Ziel');
    const z = o('ziel:z1');
    expect(z.buendel.map(x => x.id)).toEqual(['ms:m1', 'ms:m2', 'direkt:ziel:z1']);
    expect(z.pfad.map(k => k.id)).toEqual([GESAMT, 'space:business', 'thema:business:planung', 'ziel:z1']);
    const p = o('space:privat');
    expect(p.buendel.find(x => x.id === 'direkt:space:privat')).toMatchObject({ name: 'Belegt', anzahl: 1 });
  });
  it('Meilenstein = Blatt-Ebene: jeder Strang ein feiner Faden, ohne „tiefer“', () => {
    const a = ansicht(bau(), { wurzel: 'ms:m1', von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(a.buendel.every(x => x.art === 'strang' && !x.tiefer)).toBe(true);
    expect(a.buendel.length).toBe(3);
    expect(Math.max(...a.buendel.map(x => x.faeden))).toBeLessThanOrEqual(FAEDEN.strangMax);
  });
  it('Person: nur eigene + gemeinsame Stränge', () => {
    const a = ansicht(bau(), { wurzel: 'ms:m1', von: VON, bis: BIS, heute: HEUTE, person: { art: 'person', person: 'malin' } })!;
    expect(a.buendel.length).toBe(2);
  });
  it('Dichte 0 … 1, deterministisch, am Meilenstein höher als weit weg', () => {
    const b = bau();
    const o = { wurzel: 'ziel:z1', von: VON, bis: BIS, heute: HEUTE, person: alle } as const;
    const a = ansicht(b, o)!;
    expect(JSON.stringify(ansicht(bau(), o))).toBe(JSON.stringify(a));
    const m1 = a.buendel[0];
    const w = a.wochen.indexOf(montag('2026-11-04'));
    expect(m1.dichte[w]).toBeGreaterThan(0.4);
    expect(m1.dichte[a.wochen.indexOf(montag('2027-03-01'))]).toBeLessThan(0.05);
    for (const x of a.buendel) for (const v of x.dichte) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('Markierungen: Meilensteine/Ziel-Fristen im Fenster, im Bündel ihres Kindknotens', () => {
    const a = ansicht(bau(), { wurzel: 'thema:business:planung', von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(a.marken.map(m => m.quelle)).toEqual(['meilenstein', 'ziel', 'meilenstein']);
    expect(a.marken.every(m => m.buendel === 'ziel:z1')).toBe(true);
  });
  it(`Deckel: höchstens ${MAX_BUENDEL} Bündel (Rest „Weitere“), Blätter ${MAX_STRANG_BUENDEL}; Fäden je Leinwand gedeckelt`, () => {
    const knoten = Array.from({ length: 12 }, (_, i) => zielK(`v${i}`, BIZ.at(-1)!, '#FFC93C', i));
    const st = knoten.map((k, i) => s([...BIZ, k.id], '2026-11-01', { gewicht: i + 1 }));
    const a = ansicht(baueBaum(knoten, st), { wurzel: 'thema:business:planung', von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(a.buendel.length).toBe(MAX_BUENDEL);
    expect(a.buendel.at(-1)!.id).toBe('rest');
    expect(a.buendel.at(-1)!.name).toBe('Weitere (6)');
    expect(a.summe).toBe(st.reduce((x, y) => x + y.gewicht, 0)); // nichts geht verloren
    expect(a.buendel.reduce((x, y) => x + y.faeden, 0)).toBeLessThanOrEqual(FAEDEN.deckel.rechner);
    expect(faedenDeckeln(a.buendel, FAEDEN.deckel.handy).reduce((x, y) => x + y.faeden, 0)).toBeLessThanOrEqual(FAEDEN.deckel.handy + a.buendel.length);
    const blatt = Array.from({ length: 30 }, (_, i) => s([...Z1, 'ms:m1'], `2026-11-${String(i % 28 + 1).padStart(2, '0')}`));
    const b2 = ansicht(baueBaum([zielK('z1', BIZ.at(-1)!), msK('m1', 'z1')], blatt), { wurzel: 'ms:m1', von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(b2.buendel.length).toBe(MAX_STRANG_BUENDEL);
  });
  it('unbekannte Wurzel → null; leeres Fenster → keine Bündel; Text nennt Ebene und dichteste Woche', () => {
    const b = bau();
    expect(ansicht(b, { wurzel: 'ziel:gibtsnicht', von: VON, bis: BIS, heute: HEUTE, person: alle })).toBeNull();
    const leer = ansicht(b, { wurzel: GESAMT, von: '2030-01-01', bis: '2030-06-30', heute: HEUTE, person: alle })!;
    expect(leer.buendel).toEqual([]);
    expect(ansichtText(leer)).toContain('nichts Terminiertes');
    const t = ansichtText(ansicht(b, { wurzel: 'ziel:z1', von: VON, bis: BIS, heute: HEUTE, person: alle })!);
    expect(t).toContain('Gesamt › Business › Ziele & Planung › Ziel z1');
    expect(t).toContain('MS m1: 3 Stränge, am dichtesten in der Woche ab 02.11.2026');
  });
  it('Farben abstufen: deterministisch, erste unverändert, gültiges Hex', () => {
    expect(abstufen('#FFC93C', 0)).toBe('#FFC93C');
    expect(abstufen('#FFC93C', 3)).toBe(abstufen('#FFC93C', 3));
    expect(abstufen('#FFC93C', 3)).toMatch(/^#[0-9a-f]{6}$/);
    expect(abstufen('#FFC93C', 1)).not.toBe(abstufen('#FFC93C', 2));
  });
  it('rechneAnsicht nennt je Strang sein Bündel', () => {
    const e = rechneAnsicht(bau(), { wurzel: GESAMT, von: VON, bis: BIS, heute: HEUTE, person: alle })!;
    expect(e.straenge.length).toBe(10);
    expect(new Set(e.straenge.map(e.buendelVon))).toEqual(new Set(['space:business', 'space:privat']));
  });
});

describe('Navigation (Brotkrumen)', () => {
  it('tiefer: auf in das Bündel, mit Übergang „auf“; ohne „tiefer“ nichts', () => {
    const n1 = tiefer(navStart(GESAMT), { id: 'space:privat', tiefer: 'space:privat' })!;
    expect(n1).toEqual({ wurzel: 'space:privat', uebergang: { richtung: 'auf', fokus: 'space:privat', von: GESAMT } });
    expect(tiefer(n1, { id: 'strang:x' })).toBeNull();
  });
  it('zurück über eine Brotkrume: Fokus = Kind auf dem Weg zur alten Wurzel; aktuelle/unbekannte Krume → nichts', () => {
    const pfad = [{ id: GESAMT }, { id: 'space:business' }, { id: 'thema:business:planung' }, { id: 'ziel:z1' }];
    const stand = { wurzel: 'ziel:z1', uebergang: null };
    expect(zurueck(stand, GESAMT, pfad)).toEqual({ wurzel: GESAMT, uebergang: { richtung: 'zu', fokus: 'space:business', von: 'ziel:z1' } });
    expect(zurueck(stand, 'thema:business:planung', pfad)!.uebergang!.fokus).toBe('ziel:z1');
    expect(zurueck(stand, 'ziel:z1', pfad)).toBeNull();
    expect(zurueck(stand, 'gibtsnicht', pfad)).toBeNull();
  });
});
