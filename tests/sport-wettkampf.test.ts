// ─── Sport · Wettkampf-Rechner, Taper-Tage, Tage flexibel (09.10.2026) ───────────────────────────────────────────────────
// Erfundene Ziele und Zeiten (keine Person). Prognose = Riegel als Spanne (1,06 … 1,09), Pacing gleichmäßig mit negativem Split.
import { describe, it, expect } from 'vitest';
import { leererStand, wendeAn, type SportStand, type Ziel, type PlanEinheit } from '@/lib/sport/modell';
import { wettkampfRechnung, referenzFuer, taperTage, taperUebernommen, RIEGEL_SPANNE } from '@/lib/sport/wettkampf';
import { wocheFuer, geplanteEinheiten, planPruefen, tageVorschlagen, einheitenDerWoche, START_VORLAGEN, tagAus } from '@/lib/sport/plan-bau';
import { riegel, formatZeit } from '@/lib/sport/pace';
import { vorschlagWoche } from '@/lib/sport/plan';

const HM: Ziel = { id: 'z-hm', art: 'lauf', titel: 'Halbmarathon', datum: '2026-10-17', distanzKm: 21.1, zielzeitSek: 7200, angelegt: 'x' };
const HEUTE = '2026-10-09';
const stand = (x: Partial<SportStand> = {}): SportStand => ({ ...leererStand(), einstieg: { fertig: true }, ...x });

describe('Wettkampf-Rechner: Ziel ehrlich neben der Prognose', () => {
  it('Riegel mit Exponent; Standard bleibt 1,06', () => {
    expect(riegel(3000, 10, 21.1)).toBe(Math.round(3000 * Math.pow(2.11, 1.06)));
    expect(riegel(3000, 10, 21.1, 1.09)).toBeGreaterThan(riegel(3000, 10, 21.1));
    expect(RIEGEL_SPANNE).toEqual({ von: 1.06, bis: 1.09 });
  });
  it('10 km in 57:30 → Prognose rund 2:07–2:10; Ziel 2:00 ist sehr ambitioniert; Start nicht schneller als die Prognose + 5 s', () => {
    const r = wettkampfRechnung(stand(), { ...HM, referenz: { distanzKm: 10, sek: 3450 } }, HEUTE)!;
    expect(formatZeit(r.prognose!.von)).toBe('2:06:53');
    expect(formatZeit(r.prognose!.bis)).toBe('2:09:46');
    expect(r.einschaetzung).toBe('sehr-ambitioniert');
    expect(r.ziel!.pace).toBeCloseTo(7200 / 21.1, 5);
    expect(r.startPace).toBeCloseTo(r.prognose!.paceVon + 5, 5);
    expect(r.saetze.join(' ')).toMatch(/Ziel 2:00:00 = 5:41 min\/km/);
    expect(r.saetze.join(' ')).toMatch(/Prognose 2:06:53–2:09:46/);
  });
  it('negativer Split: zweite Hälfte schneller, Endzeit = schnelles Ende der Prognose', () => {
    const r = wettkampfRechnung(stand(), { ...HM, referenz: { distanzKm: 10, sek: 3450 } }, HEUTE)!;
    expect(r.splits.map(s => s.km)).toEqual([5, 10, 15, 20, 21.1]);
    const ende = r.splits[r.splits.length - 1].sek;
    expect(Math.abs(ende - r.prognose!.von)).toBeLessThanOrEqual(1);
    const ersteHaelfte = r.splits[1].sek / 10, zweite = (ende - r.splits[1].sek) / 11.1;
    expect(zweite).toBeLessThan(ersteHaelfte);
  });
  it('10 km in 55:00 → Ziel 2:00 ambitioniert; ein langsameres Ziel ist realistisch bzw. vorsichtig', () => {
    const ref = { distanzKm: 10, sek: 3300 };
    expect(wettkampfRechnung(stand(), { ...HM, referenz: ref }, HEUTE)!.einschaetzung).toBe('ambitioniert');
    expect(wettkampfRechnung(stand(), { ...HM, referenz: ref, zielzeitSek: riegel(3300, 10, 21.1) + 30 }, HEUTE)!.einschaetzung).toBe('realistisch');
    expect(wettkampfRechnung(stand(), { ...HM, referenz: ref, zielzeitSek: 3 * 3600 }, HEUTE)!.einschaetzung).toBe('vorsichtig');
  });
  it('Referenz: eigene Angabe → Bestzeit der letzten 180 Tage (nächste Distanz ≤ Ziel) → Ausgangswert; ohne alles keine Prognose', () => {
    const s = stand({ laeufe: [
      { id: 'l5', datum: '2026-09-20', distanzKm: 5, dauerSek: 1620, art: 'tempo', quelle: 'hand' },
      { id: 'l10', datum: '2026-09-27', distanzKm: 10.05, dauerSek: 3480, art: 'locker', quelle: 'hand' },
      { id: 'lalt', datum: '2025-01-01', distanzKm: 10, dauerSek: 3000, art: 'wettkampf', quelle: 'hand' },
    ] });
    expect(referenzFuer(s, HM, HEUTE)).toMatchObject({ distanzKm: 10, quelle: 'bestzeit', datum: '2026-09-27' });
    expect(referenzFuer(s, { ...HM, referenz: { distanzKm: 10, sek: 3400 } }, HEUTE)).toMatchObject({ sek: 3400, quelle: 'eingabe' });
    expect(referenzFuer(stand({ ausgang: { kraft: {}, lauf10kSek: 3500 } }), HM, HEUTE)).toMatchObject({ distanzKm: 10, sek: 3500, quelle: 'ausgang' });
    const ohne = wettkampfRechnung(stand(), HM, HEUTE)!;
    expect(ohne.einschaetzung).toBe('offen');
    expect(ohne.prognose).toBeUndefined();
    expect(ohne.saetze.join(' ')).toMatch(/Referenzzeit/);
  });
  it('nur Lauf-Ziele mit Distanz', () => {
    expect(wettkampfRechnung(stand(), { ...HM, art: 'hyrox' }, HEUTE)).toBeNull();
    expect(wettkampfRechnung(stand(), { ...HM, distanzKm: undefined }, HEUTE)).toBeNull();
  });
  it('die Referenz am Ziel übersteht die Säuberung', () => {
    const s = wendeAn(leererStand(), { op: 'ziel', eintrag: { ...HM, referenz: { distanzKm: 10, sek: 3450 } } });
    expect(s.ziele[0].referenz).toEqual({ distanzKm: 10, sek: 3450 });
  });
});

describe('Taper-Tage: die letzten 7 Tage als Plan einzelner Tage', () => {
  it('Lauf: sechs Tage vorher bis zum Tag danach, nie in der Vergangenheit; Wettkampftag mit Zielzeit', () => {
    const t = taperTage(HM, HEUTE);
    expect(Object.keys(t).sort()).toEqual(['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
    expect(t['2026-10-15'].art).toBe('ruhe');
    expect(t['2026-10-17'].einheiten![0]).toMatchObject({ sparte: 'lauf', typ: 'wettkampf', dauerMin: 120 });
    expect(Object.keys(taperTage(HM, '2026-10-14')).sort()).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });
  it('übernommen über `plan-tage`: die Tage gewinnen über die Woche und werden nicht skaliert; zurücknehmen mit null', () => {
    let s = stand({ ziele: [HM], woche: vorschlagWoche('lauf', 4) });
    expect(taperUebernommen(s, HM, HEUTE)).toBe(false);
    s = wendeAn(s, { op: 'plan-tage', tage: taperTage(HM, HEUTE) });
    expect(taperUebernommen(s, HM, HEUTE)).toBe(true);
    const w = wocheFuer(s, '2026-10-12');
    expect(w.eigeneTage).toEqual(['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']);
    expect(w.woche.sa.einheiten![0].typ).toBe('wettkampf');
    expect(wocheFuer(s, '2026-10-05').eigeneTage).toEqual(['so']); // der Sonntag davor gehört schon zum Taper
    s = wendeAn(s, { op: 'plan-tage', tage: Object.fromEntries(Object.keys(taperTage(HM, HEUTE)).map(d => [d, null])) });
    expect(s.tage).toBeUndefined();
  });
  it('Hyrox bekommt einen eigenen Vorschlag (Stationen kurz, Aktivierung am Vortag)', () => {
    const t = taperTage({ ...HM, id: 'z-hx', art: 'hyrox', datum: '2026-12-12', zielzeitSek: undefined, titel: 'Hyrox' }, HEUTE);
    expect(t['2026-12-12'].einheiten![0]).toMatchObject({ sparte: 'hyrox', typ: 'wettkampf', dauerMin: 90 });
    expect(t['2026-12-11'].einheiten![0].sparte).toBe('hyrox');
  });
  it('Grenzen: höchstens vier Einheiten je Tag, ungültige Tage abgelehnt', () => {
    const fuenf = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, sparte: 'lauf', dauerMin: 10 }));
    expect(() => wendeAn(leererStand(), { op: 'plan-tage', tage: { '2026-10-12': { art: 'lauf', einheiten: fuenf } } })).toThrow(/vier|4/);
    expect(() => wendeAn(leererStand(), { op: 'plan-tage', tage: { 'morgen': { art: 'ruhe' } } })).toThrow(/ungültig/);
  });
  it('verschieben = zwei Tage: der alte frei, der neue mit der Einheit — Plan/Ist sieht sie am neuen Tag', () => {
    let s = stand({ woche: vorschlagWoche('lauf', 3) });
    const g = geplanteEinheiten(s, '2026-10-12');
    const erste = g[0];
    const ziel = '2026-10-16';
    s = wendeAn(s, { op: 'plan-tage', tage: { [erste.datum]: { art: 'frei' }, [ziel]: tagAus([...(wocheFuer(s, '2026-10-12').woche.fr.einheiten ?? []), { ...erste.einheit, id: 'fr-v1' }]) } });
    const neu = geplanteEinheiten(s, '2026-10-12');
    expect(neu.find(x => x.datum === erste.datum)).toBeUndefined();
    expect(neu.filter(x => x.datum === ziel).map(x => x.einheit.id)).toContain('fr-v1');
    expect(neu).toHaveLength(g.length);
  });
});

describe('Tage flexibel: prüfen und vorschlagen', () => {
  const E = (id: string, sparte: PlanEinheit['sparte'], typ: PlanEinheit['typ'], dauerMin = 45): PlanEinheit => ({ id, sparte, typ, dauerMin });
  it('harte Einheiten an Folgetagen (auch So → Mo) und langer Lauf unter der Woche werden gemeldet', () => {
    const w = tageVorschlagen([], []);
    expect(planPruefen(w)).toEqual([]);
    const schlecht = { ...w, mi: tagAus([E('a', 'lauf', 'intervall')]), do: tagAus([E('b', 'hyrox', 'simulation')]), so: tagAus([E('c', 'lauf', 'tempo')]), mo: tagAus([E('d', 'lauf', 'tempo')]), di: tagAus([E('e', 'lauf', 'longrun', 90)]) };
    const h = planPruefen(schlecht);
    expect(h.filter(x => x.art === 'hart-folge').map(x => x.tage)).toEqual([['mi', 'do'], ['so', 'mo']]);
    expect(h.find(x => x.art === 'lang-unter-der-woche')!.tage).toEqual(['di']);
  });
  it('Vorschlag: langer Lauf aufs Wochenende, harte Einheiten mit Luft, Rest auf freie Tage — nur verfügbare Tage', () => {
    const w = tageVorschlagen([E('1', 'lauf', 'intervall'), E('2', 'hyrox', 'simulation', 60), E('3', 'lauf', 'longrun', 90), E('4', 'gym', 'kraft', 60)], ['mo', 'di', 'mi', 'do', 'sa', 'so']);
    expect(planPruefen(w)).toEqual([]);
    expect(w.so.einheiten![0].typ).toBe('longrun');
    expect(w.fr.art).toBe('ruhe'); // nicht verfügbar
    expect(einheitenDerWoche(w)).toHaveLength(4);
    const ids = Object.values(w).flatMap(t => (t.einheiten ?? []).map(e => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('drei Tage, drei harte Einheiten: geht nicht ohne Folgetage → trotzdem verteilt, die Prüfung meldet es', () => {
    const w = tageVorschlagen([E('1', 'lauf', 'intervall'), E('2', 'hyrox', 'simulation'), E('3', 'lauf', 'tempo')], ['mo', 'di', 'mi']);
    expect(einheitenDerWoche(w)).toHaveLength(3);
    expect(planPruefen(w).some(h => h.art === 'hart-folge')).toBe(true);
  });
  it('Startvorlagen halten die Regeln selbst ein', () => {
    for (const v of START_VORLAGEN) expect(planPruefen(v.woche), v.id).toEqual([]);
  });
});
