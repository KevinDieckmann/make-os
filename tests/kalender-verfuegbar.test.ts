// ─── K4 (29.09.): freie Zeit finden — reine Rechnung (lib/kalender/verfuegbar.ts) ─
// Arbeitszeiten, Belegungen, Puffer, gemeinsame Termine, Vorlauf, Feiertage, Zeitumstellung, Übersetzung aus K1.
import { describe, it, expect } from 'vitest';
import { freieZeiten, fensterSauber, wochentag, istFrei, ARBEITSZEIT_STANDARD, type Belegung } from '@/lib/kalender/verfuegbar';

// Montag, 05.10.2026, 08:00 Berliner Zeit (06:00 UTC).
const JETZT = new Date('2026-10-05T06:00:00Z');
const basis = { dauerMin: 60, von: '2026-10-05', tage: 1, jetzt: JETZT, rasterMin: 60 };
const starts = (l: { start: string }[]) => l.map(f => f.start.slice(11, 16));

describe('freieZeiten', () => {
  it('Standard Mo–Fr 09–18: neun Stunden-Plätze, am Wochenende keine', () => {
    expect(starts(freieZeiten({ ...basis, personen: ['kevin'], belegungen: [] }))).toEqual(['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00']);
    expect(freieZeiten({ ...basis, von: '2026-10-10', tage: 2, personen: ['kevin'], belegungen: [] })).toEqual([]);
    expect(wochentag('2026-10-05')).toBe(1);
    expect(wochentag('2026-10-11')).toBe(7);
  });

  it('gemeinsam: Termine beider zählen, ein gemeinsamer Termin für jede Person, Puffer davor und danach', () => {
    const b: Belegung[] = [
      { wer: 'kevin', start: '2026-10-05T10:00:00', ende: '2026-10-05T11:00:00', art: 'belegt' },
      { wer: 'malin', start: '2026-10-05T13:30:00', ende: '2026-10-05T14:00:00', art: 'belegt' },
      { wer: 'beide', start: '2026-10-05T16:00:00', ende: '2026-10-05T17:00:00', art: 'belegt' },
    ];
    expect(starts(freieZeiten({ ...basis, personen: ['kevin', 'malin'], belegungen: b }))).toEqual(['09:00', '11:00', '12:00', '14:00', '15:00', '17:00']);
    // Nur Kevin: Malins Termin stört nicht, der gemeinsame schon.
    expect(starts(freieZeiten({ ...basis, personen: ['kevin'], belegungen: b }))).toEqual(['09:00', '11:00', '12:00', '13:00', '14:00', '15:00', '17:00']);
    // 15 Minuten Puffer, Raster 15: belegt 09:45–11:15 → 9:00 passt nicht mehr (bis 10:00), erster Platz 11:15.
    const mitPuffer = freieZeiten({ ...basis, rasterMin: 15, pufferMin: 15, personen: ['kevin'], belegungen: b.slice(0, 1) });
    expect(starts(mitPuffer)[0]).toBe('11:15');
    expect(mitPuffer.every(f => !(f.start < '2026-10-05T11:15:00' && f.ende > '2026-10-05T09:45:00'))).toBe(true);
  });

  it('mehrtägige Belegung (Abwesend) sperrt jeden Tag darin', () => {
    const b: Belegung[] = [{ wer: 'kevin', start: '2026-10-05T00:00:00', ende: '2026-10-07T00:00:00', art: 'abwesend' }];
    const f = freieZeiten({ ...basis, tage: 3, personen: ['kevin'], belegungen: b });
    expect(new Set(f.map(x => x.tag))).toEqual(new Set(['2026-10-07']));
  });

  it('Vorlauf: nichts vor jetzt + Vorlauf; Grenze je Tag mit schon gebuchten', () => {
    const f = freieZeiten({ ...basis, personen: ['kevin'], belegungen: [], vorlaufMin: 4 * 60 }); // ab 12:00
    expect(starts(f)[0]).toBe('12:00');
    const g = freieZeiten({ ...basis, personen: ['kevin'], belegungen: [], maxJeTag: 3, bereitsJeTag: { '2026-10-05': 1 } });
    expect(g).toHaveLength(2);
  });

  it('Feiertage NRW: als Hinweis am Vorschlag, auf Wunsch gesperrt', () => {
    const f = freieZeiten({ ...basis, jetzt: new Date('2026-10-01T06:00:00Z'), von: '2026-10-02', tage: 2, personen: ['kevin'], belegungen: [], feiertage: { '2026-10-03': 'Tag der Deutschen Einheit' }, arbeitszeiten: { kevin: [{ tage: [1, 2, 3, 4, 5, 6], von: '09:00', bis: '11:00' }] } });
    expect(f.filter(x => x.tag === '2026-10-03').every(x => x.feiertag === 'Tag der Deutschen Einheit')).toBe(true);
    expect(f.some(x => x.tag === '2026-10-03')).toBe(true);
    const g = freieZeiten({ ...basis, jetzt: new Date('2026-10-01T06:00:00Z'), von: '2026-10-02', tage: 2, personen: ['kevin'], belegungen: [], feiertage: { '2026-10-03': 'Tag der Deutschen Einheit' }, feiertageSperren: true, arbeitszeiten: { kevin: [{ tage: [1, 2, 3, 4, 5, 6], von: '09:00', bis: '11:00' }] } });
    expect(g.some(x => x.tag === '2026-10-03')).toBe(false);
  });

  it('Zeitumstellung: die fehlende Stunde Ende März gibt es nicht; Ende Oktober keine doppelt langen Plätze', () => {
    const nacht = { kevin: [{ tage: [7], von: '01:00', bis: '05:00' }] };
    const maerz = freieZeiten({ dauerMin: 60, rasterMin: 30, von: '2026-03-29', tage: 1, jetzt: new Date('2026-03-01T00:00:00Z'), personen: ['kevin'], belegungen: [], arbeitszeiten: nacht });
    expect(starts(maerz)).not.toContain('02:00');
    expect(starts(maerz)).not.toContain('01:30'); // 01:30–02:30: 02:30 gibt es nicht
    expect(starts(maerz)).toContain('03:00');
    const okt = freieZeiten({ dauerMin: 60, rasterMin: 30, von: '2026-10-25', tage: 1, jetzt: new Date('2026-10-01T00:00:00Z'), personen: ['kevin'], belegungen: [], arbeitszeiten: nacht });
    // Doppelte Stunde: 02:xx meint nach RFC 5545 das ERSTE Vorkommen (Sommerzeit, R-K1 #5). 02:00–03:00 dauert damit
    // real 2 Std. → kein Platz; 01:00–02:00 und 01:30–02:30 dauern genau 1 Std.
    expect(starts(okt)).toContain('01:00');
    expect(starts(okt)).toContain('01:30');
    expect(starts(okt)).not.toContain('02:00');
    expect(starts(okt)).not.toContain('02:30');
    expect(starts(okt)).toContain('03:00');
  });

  it('ohne Personen keine Vorschläge; istFrei prüft genau', () => {
    expect(freieZeiten({ ...basis, personen: [], belegungen: [] })).toEqual([]);
    const f = freieZeiten({ ...basis, personen: ['kevin'], belegungen: [] });
    expect(istFrei('2026-10-05T09:00:00', '2026-10-05T10:00:00', f)).toBe(true);
    expect(istFrei('2026-10-05T09:30:00', '2026-10-05T10:30:00', f)).toBe(false);
  });
});

describe('Übersetzung aus K1 verfuegbarkeitFuer (lib/kalender/freie-zeit.ts)', () => {
  const v = (tage: Partial<import('@/lib/kalender/verfuegbarkeit').TagVerfuegbarkeit>[]) => ({ person: 'kevin', von: '2026-10-05', bis: '2026-10-08', tage: tage.map((t, i) => ({ tag: `2026-10-0${5 + i}`, wochenende: false, abwesend: [], ganzAbwesend: false, arbeitszeit: [], beschaeftigt: [], ...t })) });
  it('beschäftigt und ganz abwesend werden Belegungen; Arbeitszeit je Tag aus der Wochenvorlage', async () => {
    const { belegungenAus, arbeitszeitAus, feiertageAus } = await import('@/lib/kalender/freie-zeit');
    const x = v([
      { beschaeftigt: [{ start: '2026-10-05T10:00:00', ende: '2026-10-05T11:00:00', art: 'termin', ganztags: false }], arbeitszeit: [{ start: '2026-10-05T08:00:00', ende: '2026-10-05T12:00:00' }] },
      { ganzAbwesend: true },
      { feiertag: 'Probefeiertag' },
    ]);
    expect(belegungenAus(x)).toEqual([
      { wer: 'kevin', start: '2026-10-05T10:00:00', ende: '2026-10-05T11:00:00', art: 'belegt' },
      { wer: 'kevin', start: '2026-10-06T00:00:00', ende: '2026-10-07T00:00:00', art: 'abwesend' },
    ]);
    expect(arbeitszeitAus(x)['2026-10-05']).toEqual([{ start: '2026-10-05T08:00:00', ende: '2026-10-05T12:00:00' }]);
    expect(feiertageAus(x)).toEqual({ '2026-10-07': 'Probefeiertag' });
    const f = freieZeiten({ ...basis, tage: 3, personen: ['kevin'], belegungen: belegungenAus(x), arbeitszeitJeTag: { kevin: arbeitszeitAus(x) } });
    expect(starts(f)).toEqual(['08:00', '09:00', '11:00']);
  });
  it('ohne Wochenvorlage: Standard Mo–Fr 9–18, nicht an Feiertagen oder ganz abwesenden Tagen', async () => {
    const { arbeitszeitAus } = await import('@/lib/kalender/freie-zeit');
    const a = arbeitszeitAus(v([{}, { ganzAbwesend: true }, { feiertag: 'Probefeiertag' }]));
    expect(a['2026-10-05']).toEqual([{ start: '2026-10-05T09:00:00', ende: '2026-10-05T18:00:00' }]);
    expect(a['2026-10-06']).toEqual([]);
    expect(a['2026-10-07']).toEqual([]);
  });
});

describe('fensterSauber', () => {
  it('gültig, leer oder abgelehnt (nie gekürzt)', () => {
    expect(fensterSauber([{ tage: [5, 1, 1, 9], von: '09:00', bis: '18:00' }])).toEqual([{ tage: [1, 5], von: '09:00', bis: '18:00' }]);
    expect(fensterSauber([{ tage: [1], von: '18:00', bis: '09:00' }])).toBeNull();
    expect(fensterSauber(Array.from({ length: 22 }, () => ARBEITSZEIT_STANDARD[0]))).toBeNull();
    expect(fensterSauber([])).toEqual([]);
  });
});
