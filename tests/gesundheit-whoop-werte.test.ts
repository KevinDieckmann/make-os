// ─── Gesundheit × WHOOP-Zusatzwerte (09.10.): Strain-Rahmen, Körperwerte gegen den eigenen Bezug, Index bit-gleich ohne die neuen Werte,
// und die Trennung: die neuen Werte bekommt nur die Person selbst — oder wer ihre Gesundheit geteilt bekommt (Art. 9). Nur erfundene Werte,
// eigener Datenordner im Temp-Verzeichnis (nie .data/).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';

// Datenordner VOR allen Imports (lib/vitals hängt an der Datenschicht).
const wurzel = await vi.hoisted(async () => {
  const nfs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = nfs.mkdtempSync(p.join(os.tmpdir(), 'make-os-gesundheit-whoop-'));
  process.env.MAKE_OS_DATEN_DIR = p.join(o, 'daten');
  delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
  return o;
});
import { belastungLage, belastungQuote, strainRahmen, recZone, REC_GRUEN, REC_GELB, STRAIN_RAHMEN } from '@/lib/gesundheit/belastung';
import { koerperwerteAus, phasenAnteile, bezugVon } from '@/lib/gesundheit/koerperwerte';
import { berechneGesundheit, kennzahlenFuer, GESUNDHEIT_KENNZAHLEN, GESUNDHEIT_MESSEN, GESUNDHEIT_SAEULEN, type GesundheitBestand } from '@/lib/gesundheit/index';
import { berechneModell } from '@/lib/kennzahlen/kern';
import { tageZurueck } from '@/lib/gesundheit/eintraege';
import { zoneOf, hatKernwert, type VitalsLog } from '@/lib/vitals';

afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 });
});

describe('Strain-Rahmen nach der Tagesform (lib/gesundheit/belastung.ts)', () => {
  it('dieselben Recovery-Schwellen wie zoneOf', () => {
    for (const rec of [1, 39, 40, 41, 65, 66, 67, 100]) {
      const z = recZone(rec);
      expect({ rec, z }).toEqual({ rec, z: ({ GRÜN: 'gruen', GELB: 'gelb', ROT: 'rot' } as const)[zoneOf(rec)] });
    }
    expect([REC_GRUEN, REC_GELB]).toEqual([66, 40]);
    expect(recZone(undefined)).toBeNull();
    expect(recZone(0)).toBeNull(); // 0 = keine Angabe, nie „rot“ aus einer erfundenen Zahl
  });
  it('Recovery grün + wenig Strain → Spielraum; im Rahmen; drüber → achtung; deutlich drüber → kritisch', () => {
    expect(belastungLage(8.4, 80)).toMatchObject({ ampel: 'gut', kurz: 'Spielraum', rahmen: { zone: 'gruen', von: 14, bis: 18 } });
    expect(belastungLage(8.4, 80)!.text).toBe('Noch Spielraum für Belastung (Rahmen heute 14–18).');
    expect(belastungLage(16, 80)).toMatchObject({ ampel: 'gut', kurz: 'im Rahmen' });
    expect(belastungLage(18, 80)!.ampel).toBe('gut');
    expect(belastungLage(19.5, 80)!.ampel).toBe('achtung');
    expect(belastungLage(20.1, 80)!.ampel).toBe('kritisch');
    expect(belastungLage(13, 30)).toMatchObject({ ampel: 'kritisch', rahmen: { zone: 'rot', von: 0, bis: 10 } });
    expect(belastungLage(13, 30)!.text).toContain('Rahmen heute bis 10');
    expect(belastungLage(12, 50)).toMatchObject({ ampel: 'gut', kurz: 'im Rahmen', rahmen: { zone: 'gelb' } });
  });
  it('ohne Strain: nichts (nie eine Null); ohne Recovery: kein Rahmen, keine Ampel', () => {
    expect(belastungLage(undefined, 80)).toBeNull();
    expect(belastungLage(Number.NaN, 80)).toBeNull();
    expect(belastungLage(9, undefined)).toMatchObject({ ampel: 'offen' });
    expect(belastungLage(9, undefined)!.rahmen).toBeUndefined();
    expect(strainRahmen(0)).toBeNull();
  });
  it('Quote für den Index: Tage mit Strain UND Recovery, ab 3 Tagen', () => {
    expect(belastungQuote([{ strain: 10, rec: 80 }, { strain: 12, rec: 30 }])).toBeNull();
    expect(belastungQuote([{ strain: 10, rec: 80 }, { strain: 12, rec: 30 }, { strain: 9, rec: 50 }, { strain: 15 }])).toEqual({ quote: 2 / 3, tage: 3, drueber: 1 });
    expect(Object.keys(STRAIN_RAHMEN)).toEqual(['gruen', 'gelb', 'rot']);
  });
});

// Ein Tag mit allen WHOOP-Werten + sieben Tage davor als Bezug.
const HEUTE = '2026-10-09';
const T = tageZurueck(HEUTE, 40);
const logMitWhoop = (): VitalsLog => {
  const log: VitalsLog = {};
  for (let i = 1; i <= 7; i++) log[T[i]] = { rec: 70, sleep: 7.5, hrv: 60, rhr: 52, atem: 15, spo2: 96, hautTemp: 33.5, strain: 12, schlafLeistung: 90 };
  log[HEUTE] = {
    rec: 45, sleep: 6.4, hrv: 48, rhr: 58, strain: 13.2, kcal: 2400, schritte: 9100, spo2: 95.4, hautTemp: 34.1, atem: 16.2,
    schlafLeistung: 78, schlafKonsistenz: 70, schlafEffizienz: 91, schlafBedarf: 8.2, phaseLeicht: 3.2, phaseTief: 1.5, phaseRem: 1.7, phaseWach: 0.6, stoerungen: 7,
  };
  return log;
};

describe('Körperwerte gegen den eigenen 7-Tage-Bezug (lib/gesundheit/koerperwerte.ts)', () => {
  it('Bezug = Ø der 7 Tage davor (der Tag selbst zählt nicht), mindestens 3 Werte', () => {
    const log = logMitWhoop();
    expect(bezugVon(log, HEUTE, 'hrv')).toBe(60);
    expect(bezugVon({ [T[1]]: { hrv: 50 }, [T[2]]: { hrv: 70 } }, HEUTE, 'hrv')).toBeUndefined();
  });
  it('alle Werte des Tages; HRV/Ruhepuls bewertet (Schwellen wie im Index), Atem/SpO2/Haut nur Abweichung', () => {
    const k = koerperwerteAus(logMitWhoop(), HEUTE);
    expect(k).toMatchObject({ tag: HEUTE, strain: 13.2, kcal: 2400, schritte: 9100, leer: false });
    expect(k.schlaf).toEqual({ dauer: 6.4, bedarf: 8.2, leistung: 78, konsistenz: 70, effizienz: 91, stoerungen: 7, phasen: { leicht: 3.2, tief: 1.5, rem: 1.7, wach: 0.6 } });
    const je = Object.fromEntries(k.koerper.map(x => [x.id, x]));
    expect(je.hrv).toMatchObject({ wert: 48, bezug: 60, diff: -12, lage: 'achtung' }); // 48 < 0,85 × 60
    expect(je.rhr).toMatchObject({ wert: 58, bezug: 52, diff: 6, lage: 'achtung' }); // mehr als +4
    expect(je.atem).toMatchObject({ wert: 16.2, bezug: 15, diff: 1.2, lage: 'neutral' });
    expect(je.spo2).toMatchObject({ wert: 95.4, bezug: 96, diff: -0.6, lage: 'neutral' });
    expect(je.hautTemp).toMatchObject({ wert: 34.1, diff: 0.6, lage: 'neutral', nurAbweichung: true });
    const p = phasenAnteile(k.schlaf.phasen)!;
    expect(p.leicht + p.tief + p.rem + p.wach).toBeCloseTo(1, 10);
  });
  it('ohne Zusatzwerte: leer — fehlende Werte fehlen (keine Null, kein Bezug ohne Wert)', () => {
    const k = koerperwerteAus({ [HEUTE]: { rec: 60, sleep: 7, hrv: 55, rhr: 50 } }, HEUTE);
    expect(k.leer).toBe(true);
    expect(k.strain).toBeUndefined();
    expect(k.schlaf).toEqual({ dauer: 7 });
    expect(k.koerper.find(x => x.id === 'atem')).toEqual({ id: 'atem', label: 'Atemfrequenz', einheit: '/min', lage: 'neutral' });
    expect(phasenAnteile(undefined)).toBeNull();
  });
  it('resolveVitals-Regel: ein Tag nur mit Zusatzwerten (z. B. Schritte nach Mitternacht) verdrängt den letzten Morgen-Check nicht', () => {
    expect(hatKernwert({ schritte: 400 })).toBe(false);
    expect(hatKernwert({ strain: 3, quellen: { strain: 'whoop' } })).toBe(false);
    expect(hatKernwert({ rec: 70 })).toBe(true);
    expect(hatKernwert({ note: 'müde' })).toBe(true);
  });
});

describe('Gesundheits-Index: die WHOOP-Zusatzwerte zählen nur mit Werten — ohne sie bit-gleich', () => {
  const basis = (vitals: VitalsLog): GesundheitBestand => ({
    heute: HEUTE, person: 'test', vitals, routinen: [{ id: 'reha', label: 'Reha & Mobilität' }], log: { [HEUTE]: ['reha'] }, journal: { [HEUTE]: { stress: 2, energy: 4 } },
    haut: {}, streak: {}, bloecke: [], termine: [], kalenderFrisch: false, meilensteine: [], ernaehrung: null,
  });
  const ohneNeue = (b: GesundheitBestand) => berechneModell({
    saeulen: GESUNDHEIT_SAEULEN, kennzahlen: GESUNDHEIT_KENNZAHLEN.filter(k => !['belastung', 'schlafleistung', 'haut', 'schuebe', 'streak'].includes(k.id)),
    messen: GESUNDHEIT_MESSEN, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: b.person,
  });
  it('nur Kernwerte (wie vor dem 09.10.) → exakt dasselbe Ergebnis wie ohne die neuen Kennzahlen', () => {
    const vitals: VitalsLog = {};
    for (let i = 0; i < 30; i++) vitals[T[i]] = { rec: 60 + (i % 7), sleep: 7 + (i % 3) / 10, hrv: 50 + (i % 5), rhr: 55 - (i % 4) };
    const b = basis(vitals);
    expect(kennzahlenFuer(b).map(k => k.id)).not.toEqual(expect.arrayContaining(['belastung']));
    expect(kennzahlenFuer(b).map(k => k.id)).not.toContain('schlafleistung');
    expect(berechneGesundheit(b)).toEqual(ohneNeue(b));
    // auch ohne Vitalwerte
    expect(berechneGesundheit(basis({}))).toEqual(ohneNeue(basis({})));
  });
  it('mit WHOOP-Zusatzwerten: Belastung zur Tagesform (Säule Bewegung) und Schlaf gegen Bedarf (Säule Erholung) zählen', () => {
    const pi = berechneGesundheit(basis(logMitWhoop()));
    const k = (id: string) => pi.saeulen.flatMap(s => s.kennzahlen.map(x => ({ ...x, saeule: s.id }))).find(x => x.id === id)!;
    // 7 Tage zählen (heute + 6 davor): 6× Strain 12 bei Recovery 70 (Rahmen bis 18) + heute 13,2 bei 45 (Rahmen bis 14) → alle im Rahmen
    expect(k('belastung')).toMatchObject({ saeule: 'ba', gemessen: true, wert: 100, ampel: 'gruen' });
    expect(k('schlafleistung')).toMatchObject({ saeule: 'er', gemessen: true, ampel: 'gruen' });
    expect(k('schlafleistung').wert).toBeCloseTo((78 + 6 * 90) / 7, 5);
    const drueber = logMitWhoop();
    drueber[HEUTE] = { ...drueber[HEUTE], strain: 17, rec: 30 };
    const pi2 = berechneGesundheit(basis(drueber));
    expect(pi2.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === 'belastung')).toMatchObject({ wert: (6 / 7) * 100, quelle: '6 von 7 Tagen im Rahmen der Tagesform · 1× drüber' });
  });
});

describe('Karten Schlaf + Körperwerte (components/os/gesundheit/WhoopWerte.tsx): zeigen, rechnen nicht; fehlend = „—“', () => {
  it('mit allen Werten: Bedarf, Phasen, Abweichung gegen Ø 7 Tage — keine NaN, keine Null-Anzeige', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { SchlafDetailKarte, KoerperwerteKarte } = await import('@/components/os/gesundheit/WhoopWerte');
    const k = koerperwerteAus(logMitWhoop(), HEUTE);
    const schlaf = renderToStaticMarkup(createElement(SchlafDetailKarte, { k, heute: HEUTE }));
    expect(schlaf).toContain('6:24 h'); // 6,4 h
    expect(schlaf).toContain('Bedarf 8:12 h');
    expect(schlaf).toContain('1:48 h unter dem Bedarf');
    expect(schlaf).toContain('Schlafphasen: Tief 1:30 h, REM 1:42 h, Leicht 3:12 h, Wach 0:36 h');
    const koerper = renderToStaticMarkup(createElement(KoerperwerteKarte, { k, heute: HEUTE }));
    expect(koerper).toContain('−12 gegen Ø 60');
    expect(koerper).toContain('+0,6 °C');
    expect(koerper).toContain('2.400 kcal');
    expect(schlaf + koerper).not.toMatch(/NaN|undefined/);
  });
  it('ohne Zusatzwerte: Striche statt Nullen', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { KoerperwerteKarte } = await import('@/components/os/gesundheit/WhoopWerte');
    const html = renderToStaticMarkup(createElement(KoerperwerteKarte, { k: koerperwerteAus({ [HEUTE]: { hrv: 55 } }, HEUTE), heute: HEUTE }));
    expect(html).toContain('55 ms');
    expect(html).toContain('Bezug ab 3 Tagen');
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(4); // Ruhepuls, Atem, SpO2, Haut
    expect(html).not.toContain('kcal');
  });
});

// ── Trennung (Art. 9): die neuen Werte nur für die Person selbst bzw. mit `teilt.gesundheit` ─────────────────────────────────
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', teilt: string[] = []) =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: teilt }, haushalt: 'haus-test' });

describe('Gesundheitsseite (/api/gesundheit/stand): die WHOOP-Zusatzwerte sieht nur, wer die Gesundheit sehen darf', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const { speicherFuer } = await import('@/lib/zoe/raum');
    await db.saveJson('konten', { konten: [konto('k1', 'eins', 'inhaber'), konto('k2', 'zwei', 'mitglied')], einladungen: [] });
    const { localDay } = await import('@/lib/zeit');
    const heute = localDay();
    const log = logMitWhoop();
    // auf den echten heutigen Tag schieben (die Route rechnet mit „heute“)
    const verschoben: VitalsLog = {};
    const tz = tageZurueck(heute, 8);
    for (let i = 0; i <= 7; i++) verschoben[tz[i]] = log[T[i]];
    await db.saveJson(speicherFuer('vitals', 'eins'), verschoben);
  });
  const hole = async (person: string, fuer?: string) => {
    const route = await import('@/app/api/gesundheit/stand/route');
    const r = await route.GET(new Request(`http://test/api/gesundheit/stand${fuer ? `?fuer=${fuer}` : ''}`, { headers: { 'x-make-user': person } }));
    return { status: r.status, d: await r.json() as Record<string, unknown> & { koerperwerte?: { strain?: number; schritte?: number } } };
  };
  it('die Person selbst bekommt Strain, Schritte, Körperwerte', async () => {
    const r = await hole('eins');
    expect(r.status).toBe(200);
    expect(r.d.koerperwerte).toMatchObject({ strain: 13.2, schritte: 9100, leer: false });
  });
  it('eine andere Person ohne Teilen bekommt nichts davon (403, kein Wert in der Antwort)', async () => {
    const r = await hole('zwei', 'eins');
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.d)).not.toMatch(/13\.2|9100|koerperwerte/);
  });
  it('teilt die Person ihre Gesundheit, sieht die andere die Werte — danach wieder nicht', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [konto('k1', 'eins', 'inhaber', ['zwei']), konto('k2', 'zwei', 'mitglied')], einladungen: [] });
    try {
      expect((await hole('zwei', 'eins')).d.koerperwerte).toMatchObject({ strain: 13.2 });
    } finally {
      await db.saveJson('konten', { konten: [konto('k1', 'eins', 'inhaber'), konto('k2', 'zwei', 'mitglied')], einladungen: [] });
    }
    expect((await hole('zwei', 'eins')).status).toBe(403);
  });
});
