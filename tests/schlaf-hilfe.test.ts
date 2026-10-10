// ─── Schlaf-Hilfe, Tages-Check, Essen nach WHOOP (09.10.) — die reinen Regeln ──────────────────────────────────────────
// Stufen der Aufstehzeit, Schlafschuld, Schlafenszeit, Konsistenz, Erinnerung (über Mitternacht), Einstellungen (Rebase, Grenzen),
// Tages-Check (Säuberung, Tag, Auswertung ab Mindestmenge) und die Essens-Orientierung (mehr/normal/weniger, Belastungstage ohne
// Personen). Nur erfundene Werte.
import { describe, it, expect } from 'vitest';
import { aufstehenStufe, uhrZuMin, minZuUhr, uhrAbstand, schlafLage, konsistenzAus, erinnerungFaellig, schlafTipp, type SchlafNacht, type SchlafEingabe } from '@/lib/gesundheit/schlaf';
import { naechteAus, ortsMinute } from '@/lib/gesundheit/schlaf-naechte';
import { alltagAnwenden, alltagSaeubern, leererAlltag, nurAusschalten, AlltagFehler, alltagEinstellungen } from '@/lib/gesundheit/alltag';
import { aktiveFragen, checkAnwenden, checkAuswertung, checkEingangSaeubern, checkSaeubern, checkTagFuer, befundSatz, gestresstAusAnspannung, abgeloesteAntworten, CHECK_FRAGEN, CHECK_VORGABE, CHECK_MAX, CHECK_ABGELOEST, ANSPANNUNG_ID, ANSPANNUNG_STRESS_AB } from '@/lib/gesundheit/tages-check';
import { essenOrientierung, belastungsTage, belastungsTageHaushalt, belastungsZeile, planBelastung, strainJeWochentag, wTagVon, ergaenzungLabel, ERGAENZUNG_VORLAGEN } from '@/lib/ernaehrung/orientierung';
import { telegramInhalteFinden, hinweisSchlafenszeit, SCHLAF_ERINNERUNG_TITEL } from '@/lib/datenschutz/telegram-text';
import { tagePlus } from '@/lib/zeit';
import type { VitalsLog } from '@/lib/vitals';
import type { WSchlaf } from '@/lib/whoop/abbilden';

const HEUTE = '2026-10-09';
const T = (n: number) => tagePlus(HEUTE, n);

describe('Uhrzeiten', () => {
  it('HH:MM ↔ Minute, im Kreis', () => {
    expect(uhrZuMin('06:45')).toBe(405);
    expect(uhrZuMin('24:00')).toBeNull();
    expect(uhrZuMin('6:45')).toBeNull();
    expect(minZuUhr(-30)).toBe('23:30');
    expect(minZuUhr(1440 + 15)).toBe('00:15');
    expect(uhrAbstand(uhrZuMin('23:30')!, uhrZuMin('00:15')!)).toBe(45);
    expect(uhrAbstand(uhrZuMin('07:30')!, uhrZuMin('06:45')!)).toBe(-45);
  });
  it('Ortsminute aus Zeitpunkt + Offset', () => {
    expect(ortsMinute('2026-10-08T21:10:00.000Z', '+02:00')).toBe(23 * 60 + 10);
    expect(ortsMinute('2026-10-09T04:50:00.000Z', '+02:00')).toBe(6 * 60 + 50);
  });
});

describe('Stufen: die Aufstehzeit wandert schrittweise', () => {
  const e = { aufstehen: '07:30', aufstehenZiel: '06:45', schrittMin: 15, schrittTage: 3, ab: HEUTE };
  it('15 Min. alle 3 Tage von 7:30 nach 6:45 — nie über das Ziel hinaus', () => {
    expect(aufstehenStufe(e, HEUTE)).toMatchObject({ aufstehen: '07:30', schritt: 0, schritte: 3, fertig: false, naechsteAm: T(3), fertigAm: T(9), richtung: -1 });
    expect(aufstehenStufe(e, T(2))!.aufstehen).toBe('07:30');
    expect(aufstehenStufe(e, T(3))!.aufstehen).toBe('07:15');
    expect(aufstehenStufe(e, T(6))!).toMatchObject({ aufstehen: '07:00', naechsteAm: T(9) });
    expect(aufstehenStufe(e, T(9))).toMatchObject({ aufstehen: '06:45', fertig: true });
    expect(aufstehenStufe(e, T(40))!.aufstehen).toBe('06:45');
    expect(aufstehenStufe(e, T(40))!.naechsteAm).toBeUndefined();
  });
  it('ein Rest kleiner als die Schrittweite ist die letzte Stufe', () => {
    const r = { ...e, aufstehenZiel: '07:00', schrittMin: 20 }; // 30 Min.: 20 + 10
    expect(aufstehenStufe(r, T(3))!.aufstehen).toBe('07:10');
    expect(aufstehenStufe(r, T(6))!).toMatchObject({ aufstehen: '07:00', fertig: true });
  });
  it('später ist auch eine Richtung; über Mitternacht der kürzere Weg', () => {
    expect(aufstehenStufe({ ...e, aufstehen: '06:00', aufstehenZiel: '06:30' }, T(3))).toMatchObject({ aufstehen: '06:15', richtung: 1 });
    expect(aufstehenStufe({ ...e, aufstehen: '23:50', aufstehenZiel: '00:20', schrittMin: 15 }, T(3))!.aufstehen).toBe('00:05');
  });
  it('ohne Ziel die Aufstehzeit, ohne Start das Ziel, ohne beides nichts', () => {
    expect(aufstehenStufe({ ...e, aufstehenZiel: undefined }, T(5))).toMatchObject({ aufstehen: '07:30', fertig: true });
    expect(aufstehenStufe({ ...e, aufstehen: undefined }, T(5))).toMatchObject({ aufstehen: '06:45', fertig: true });
    expect(aufstehenStufe({ schrittMin: 15, schrittTage: 3 }, HEUTE)).toBeNull();
  });
});

// Nächte: Bedarf 8,25 h (davon 0,5 h Schuld laut WHOOP), geschlafen um 6,5 h.
const nacht = (tag: string, x: Partial<SchlafNacht> = {}): SchlafNacht => ({ tag, dauer: 6.5, bedarf: 8.25, ...x });
const E: SchlafEingabe = { aufstehen: '07:00', schrittMin: 15, schrittTage: 3, vorlaufMin: 30, ab: HEUTE };

describe('Schlaf-Lage', () => {
  it('Schuld = Σ (Bedarf − geschlafen) der 7 Nächte; Ziel = Bedarf ohne Schuld + Ausgleich (÷ 4, höchstens 1 h, Viertelstunden)', () => {
    const n = [0, -1, -2, -3, -4, -5, -6, -7].map(i => nacht(T(i), { bedarfOhneSchuld: 7.75, wach: 0.5 }));
    const l = schlafLage(n, E, HEUTE);
    expect(l.schuld).toEqual({ stunden: 12.3, naechte: 7 }); // 7 × 1,75 h; die 8. Nacht zählt nicht mehr
    expect(l.ziel).toEqual({ stunden: 8.75, grund: 7.75, ausgleich: 1, quelle: 'whoop' });
    expect(l.puffer).toEqual({ min: 30, eigen: true });
    // 07:00 − 8:45 − 0:30 = 21:45
    expect(l.schlafenszeit).toBe('21:45');
    expect(l.erinnerungUm).toBe('21:15');
    expect(l.letzte).toMatchObject({ tag: HEUTE, dauer: 6.5, bedarf: 8.25, fehlt: 1.75 });
    expect(l.tipp).toContain('Diese Woche fehlen dir');
    expect(l.tipp).toContain('21:45');
  });
  it('nur der GESAMTE WHOOP-Bedarf (Schuld schon drin): kein Ausgleich obendrauf', () => {
    const l = schlafLage([nacht(HEUTE), nacht(T(-1))], E, HEUTE);
    expect(l.ziel).toEqual({ stunden: 8.25, grund: 8.25, ausgleich: 0, quelle: 'whoop' });
    expect(l.schlafenszeit).toBe('22:30'); // 07:00 − 8:15 − 0:15 Vorgabe-Puffer
  });
  it('ohne WHOOP: eigenes Schlafziel, Schuld gegen das Ziel, Ausgleich in Viertelstunden', () => {
    const n = [nacht(HEUTE, { bedarf: undefined, dauer: 7 }), nacht(T(-1), { bedarf: undefined, dauer: 7 })];
    const l = schlafLage(n, { ...E, schlafziel: 8 }, HEUTE);
    expect(l.schuld).toEqual({ stunden: 2, naechte: 2 });
    expect(l.ziel).toEqual({ stunden: 8.5, grund: 8, ausgleich: 0.5, quelle: 'eigen' });
  });
  it('ein alter Bedarf (> 3 Tage) gilt nicht für heute Nacht; ohne Bedarf und Ziel keine Schlafenszeit', () => {
    const l = schlafLage([nacht(T(-5))], E, HEUTE);
    expect(l.ziel).toBeUndefined();
    expect(l.schlafenszeit).toBeUndefined();
    expect(l.tipp).toContain('Schlafbedarf');
  });
  it('die Stufe bestimmt die Schlafenszeit — und die Erinnerung folgt ihr', () => {
    const e: SchlafEingabe = { aufstehen: '07:30', aufstehenZiel: '06:45', schrittMin: 15, schrittTage: 3, vorlaufMin: 30, ab: HEUTE };
    const n = (h: string) => [nacht(h), nacht(tagePlus(h, -1))];
    expect(schlafLage(n(HEUTE), e, HEUTE).schlafenszeit).toBe('23:00');
    expect(schlafLage(n(T(3)), e, T(3)).schlafenszeit).toBe('22:45');
    expect(schlafLage(n(T(3)), e, T(3)).erinnerungUm).toBe('22:15');
    expect(schlafLage(n(T(9)), e, T(9)).schlafenszeit).toBe('22:15');
  });
  it('ohne Aufstehzeit sagt der Tipp, was fehlt', () => {
    expect(schlafLage([nacht(HEUTE)], { schrittMin: 15, schrittTage: 3, vorlaufMin: 30 }, HEUTE).tipp).toContain('Aufstehzeit');
  });
  it('Puffer aus „wach im Bett“ wird begrenzt (5–45 Min.)', () => {
    expect(schlafLage([nacht(HEUTE, { wach: 2 })], E, HEUTE).puffer).toEqual({ min: 45, eigen: true });
    expect(schlafLage([nacht(HEUTE, { wach: 0 })], E, HEUTE).puffer).toEqual({ min: 5, eigen: true });
  });
});

describe('Konsistenz', () => {
  it('Streuung der Einschlaf-/Aufwachzeiten über Mitternacht hinweg; ab 3 Nächten', () => {
    const n = [nacht(HEUTE, { einschlaf: 23 * 60 + 30, aufwach: 7 * 60 }), nacht(T(-1), { einschlaf: 30, aufwach: 7 * 60 }), nacht(T(-2), { einschlaf: 23 * 60 + 30, aufwach: 7 * 60 })];
    const k = konsistenzAus(n, HEUTE)!;
    expect(k.einschlaf).toBe('23:50');
    expect(k.einschlafStreuung).toBe(28);
    expect(k.aufwachStreuung).toBe(0);
    expect(k.bewertung).toBe('gleichmaessig');
    expect(konsistenzAus(n.slice(0, 2), HEUTE)).toBeUndefined();
  });
  it('unruhig → der Tipp nennt die Schwankung', () => {
    const n = [nacht(HEUTE, { einschlaf: 22 * 60, aufwach: 6 * 60, bedarf: 7 }), nacht(T(-1), { einschlaf: 60, aufwach: 9 * 60, bedarf: 7, dauer: 7 }), nacht(T(-2), { einschlaf: 22 * 60, aufwach: 6 * 60, bedarf: 7, dauer: 7 })];
    const l = schlafLage(n.map(x => ({ ...x, dauer: 7 })), E, HEUTE);
    expect(l.konsistenz?.bewertung).toBe('unruhig');
    expect(l.tipp).toContain('schwanken');
  });
});

describe('Nächte aus Vitalwerten und WHOOP-Spiegel', () => {
  it('Hauptschlaf je Aufwach-Tag (ohne Nickerchen), Bedarf ohne Schuld-Anteil, Ortszeit', () => {
    const vitals: VitalsLog = { [HEUTE]: { sleep: 6.9, schlafBedarf: 8.5, phaseWach: 0.4, schlafKonsistenz: 71 } };
    const s = (id: string, start: string, ende: string, x: Partial<WSchlaf> = {}): WSchlaf => ({ id, start, ende, tz: '+02:00', nap: false, state: 'SCORED', ...x });
    const spiegel = {
      a: s('a', '2026-10-08T21:20:00.000Z', '2026-10-09T05:05:00.000Z', { bedarfMs: 8.5 * 3_600_000, schuldMs: 0.5 * 3_600_000 }),
      b: s('b', '2026-10-09T11:00:00.000Z', '2026-10-09T11:30:00.000Z', { nap: true }),
    };
    const [n] = naechteAus(vitals, spiegel);
    expect(n).toMatchObject({ tag: HEUTE, dauer: 6.9, bedarf: 8.5, wach: 0.4, konsistenz: 71, einschlaf: 23 * 60 + 20, aufwach: 7 * 60 + 5, bedarfOhneSchuld: 8 });
  });
});

describe('Erinnerung', () => {
  it('fällig ab der Erinnerungszeit bis 90 Min. danach — einmal je Tag (Riegel)', () => {
    expect(erinnerungFaellig('21:15', `${HEUTE}T21:14:00`).faellig).toBe(false);
    expect(erinnerungFaellig('21:15', `${HEUTE}T21:15:00`)).toEqual({ faellig: true, tag: HEUTE });
    expect(erinnerungFaellig('21:15', `${HEUTE}T22:45:00`).faellig).toBe(true);
    expect(erinnerungFaellig('21:15', `${HEUTE}T22:46:00`).faellig).toBe(false);
    expect(erinnerungFaellig('21:15', `${HEUTE}T21:30:00`, HEUTE).faellig).toBe(false);
    expect(erinnerungFaellig('21:15', `${HEUTE}T21:30:00`, T(-1)).faellig).toBe(true);
  });
  it('über Mitternacht zählt der Tag, an dem die Erinnerungszeit lag', () => {
    expect(erinnerungFaellig('23:50', `${HEUTE}T00:20:00`)).toEqual({ faellig: true, tag: T(-1) });
    expect(erinnerungFaellig('23:50', `${HEUTE}T00:20:00`, T(-1)).faellig).toBe(false);
    expect(erinnerungFaellig('00:10', `${HEUTE}T00:20:00`)).toEqual({ faellig: true, tag: HEUTE });
    expect(erinnerungFaellig(undefined, `${HEUTE}T21:30:00`).faellig).toBe(false);
  });
  it('Text für Glocke und Handy ist neutral (keine Uhrzeit, kein Wert) — der Telegram-Wächter findet nichts', () => {
    const t = hinweisSchlafenszeit('https://beispiel.invalid/os/gesundheit');
    expect(telegramInhalteFinden(t)).toEqual([]);
    expect(telegramInhalteFinden(SCHLAF_ERINNERUNG_TITEL)).toEqual([]);
    expect(t).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('Einstellungen je Person (gesundheit-alltag)', () => {
  it('ohne Bestand: Vorgaben (Erinnerung aus, 15 Min./3 Tage, Orientierung an)', () => {
    expect(alltagSaeubern(null)).toEqual(leererAlltag());
    expect(leererAlltag().schlaf).toMatchObject({ erinnerung: false, schrittMin: 15, schrittTage: 3, vorlaufMin: 30, handy: false });
  });
  it('neue Aufstehzeit setzt die Stufen ab heute; nur das Ziel ändern → ab der HEUTIGEN Stufe weiter (kein Sprung zurück)', () => {
    let a = alltagAnwenden(leererAlltag(), [{ op: 'schlaf', felder: { aufstehen: '07:30', aufstehenZiel: '06:45' } }], HEUTE);
    expect(a.schlaf).toMatchObject({ aufstehen: '07:30', aufstehenZiel: '06:45', ab: HEUTE });
    a = alltagAnwenden(a, [{ op: 'schlaf', felder: { aufstehenZiel: '06:30' } }], T(6));
    expect(a.schlaf).toMatchObject({ aufstehen: '07:00', aufstehenZiel: '06:30', ab: T(6) });
    a = alltagAnwenden(a, [{ op: 'schlaf', felder: { erinnerung: true, vorlaufMin: 45 } }], T(7));
    expect(a.schlaf.ab).toBe(T(6)); // Erinnerung ändert die Stufen nicht
    a = alltagAnwenden(a, [{ op: 'schlaf', felder: { aufstehenZiel: null } }], T(8));
    expect(a.schlaf.aufstehenZiel).toBeUndefined();
  });
  it('ungültig → 400, zu viele Fragen → 413, nichts halb', () => {
    const fehler = (ops: unknown) => { try { alltagAnwenden(leererAlltag(), ops, HEUTE); return null; } catch (e) { return e instanceof AlltagFehler ? e.status : 'anders'; } };
    expect(fehler([{ op: 'schlaf', felder: { aufstehen: '7 Uhr' } }])).toBe(400);
    expect(fehler([{ op: 'schlaf', felder: { schrittMin: 2 } }])).toBe(400);
    expect(fehler([{ op: 'schlaf', felder: { geheim: 1 } }])).toBe(400);
    expect(fehler([{ op: 'check', fragen: ['gibt-es-nicht'] }])).toBe(400);
    expect(fehler([{ op: 'check', fragen: ['alkohol', 'stress'] }])).toBe(400); // abgelöst (10.10.): nicht mehr wählbar
    expect(fehler([{ op: 'check', fragen: CHECK_FRAGEN.map(f => f.id) }])).toBe(413);
    expect(fehler([{ op: 'ergaenzung', routine: 'r-1', vorlage: 'zauberpulver' }])).toBe(400);
    expect(fehler(Array.from({ length: 21 }, () => ({ op: 'essen', orientierung: true })))).toBe(413);
    expect(fehler([])).toBe(400);
  });
  it('Ergänzungen: Routine → Vorlage, null löst', () => {
    let a = alltagAnwenden(leererAlltag(), [{ op: 'ergaenzung', routine: 'r-abc', vorlage: 'kreatin' }], HEUTE);
    expect(a.ergaenzungen).toEqual({ 'r-abc': 'kreatin' });
    a = alltagAnwenden(a, [{ op: 'ergaenzung', routine: 'r-abc', vorlage: null }], HEUTE);
    expect(a.ergaenzungen).toEqual({});
  });
  it('nur ausschalten geht ohne Einwilligung — einschalten nicht', () => {
    expect(nurAusschalten([{ op: 'schlaf', felder: { erinnerung: false } }, { op: 'essen', orientierung: false }, { op: 'check', fragen: [] }])).toBe(true);
    expect(nurAusschalten([{ op: 'schlaf', felder: { erinnerung: true } }])).toBe(false);
    expect(nurAusschalten([{ op: 'schlaf', felder: { aufstehen: '07:00' } }])).toBe(false);
    expect(nurAusschalten([])).toBe(false);
  });
  it('eine gespeicherte Auswahl mit „stress“ wird beim Lesen still gesäubert — nie ein Fehler', () => {
    expect(alltagSaeubern({ check: { fragen: ['stress', 'alkohol', 'getrunken'] } }).check).toEqual({ fragen: ['alkohol', 'getrunken'] });
    expect(alltagSaeubern({ check: { fragen: ['stress'] } }).check).toEqual({ fragen: [] });
    expect(() => alltagAnwenden(leererAlltag(), [{ op: 'check', fragen: ['stress'] }], HEUTE)).toThrow(/Anspannung/);
  });
  it('der Riegel gehört nicht zu den Einstellungen', () => {
    const a = { ...leererAlltag(), erinnert: HEUTE, geaendert: 'x' };
    expect(alltagEinstellungen(a)).not.toHaveProperty('erinnert');
  });
});

describe('Tages-Check', () => {
  it('Vorgabe: fünf Fragen; eigene Auswahl in Reihenfolge des Katalogs; höchstens sechs', () => {
    expect(aktiveFragen(undefined).map(f => f.id)).toEqual([...CHECK_VORGABE]);
    expect(aktiveFragen({ fragen: ['draussen', 'alkohol'] }).map(f => f.id)).toEqual(['alkohol', 'draussen']);
    expect(aktiveFragen({ fragen: [] })).toEqual([]);
    expect(CHECK_VORGABE.length).toBeLessThanOrEqual(CHECK_MAX);
  });
  it('Eingang: nur Katalog-Fragen, nur ja/nein/null — sonst Fehler, nie still verworfen', () => {
    expect(checkEingangSaeubern({ alkohol: true, getrunken: false, draussen: null })).toEqual({ ok: true, werte: { alkohol: true, getrunken: false, draussen: null } });
    expect(checkEingangSaeubern({ alkohol: 'ja' }).ok).toBe(false);
    expect(checkEingangSaeubern({ fremd: true }).ok).toBe(false);
    expect(checkEingangSaeubern([]).ok).toBe(false);
    expect(checkAnwenden({ alkohol: true, getrunken: true }, { alkohol: null, draussen: false })).toEqual({ getrunken: true, draussen: false });
    expect(checkAnwenden({ alkohol: true }, { alkohol: null })).toBeUndefined();
    expect(checkSaeubern({ alkohol: true, x: true, getrunken: 'ja' })).toEqual({ alkohol: true });
  });
  it('Stress nur noch als Anspannung 1–5 (10.10.): die Ja/Nein-Frage ist nicht wählbar und nicht zu beantworten', () => {
    expect(CHECK_ABGELOEST).toContain('stress');
    expect(CHECK_FRAGEN.map(f => f.id)).not.toContain('stress');
    expect(CHECK_FRAGEN.some(f => /stress/i.test(f.frage))).toBe(false);
    expect(aktiveFragen({ fragen: ['stress', 'alkohol'] }).map(f => f.id)).toEqual(['alkohol']);
    const e = checkEingangSaeubern({ alkohol: true, stress: true });
    expect(e.ok).toBe(false);
    expect(e.ok ? '' : e.fehler).toContain('Anspannung');
    expect(checkEingangSaeubern({ stress: null }).ok).toBe(false);
  });
  it('Altbestand: gespeicherte „stress“-Antworten bleiben im Journal liegen — nie gezeigt, nie gelöscht', () => {
    expect(checkSaeubern({ stress: true, alkohol: false })).toEqual({ alkohol: false });
    expect(checkSaeubern({ stress: true })).toBeUndefined();
    expect(abgeloesteAntworten({ stress: false, alkohol: true, x: true })).toEqual({ stress: false });
    expect(checkAnwenden({ stress: true, alkohol: true }, { alkohol: null })).toEqual({ stress: true });
    expect(checkAnwenden({ stress: false }, { getrunken: true })).toEqual({ stress: false, getrunken: true });
    expect(checkAnwenden({ stress: 'ja', alkohol: true }, { alkohol: null })).toBeUndefined(); // kein echtes ja/nein → nie aufgehoben
  });
  it('gestresst aus der Anspannung: ≥ 4 ja, 1–3 nein, fehlt/ungültig kein Datenpunkt', () => {
    expect(ANSPANNUNG_STRESS_AB).toBe(4);
    expect([1, 2, 3, 4, 5].map(gestresstAusAnspannung)).toEqual([false, false, false, true, true]);
    for (const x of [undefined, null, 0, 6, '4', Number.NaN, {}]) expect(gestresstAusAnspannung(x)).toBeUndefined();
  });
  it('Auswertung „Stress“ aus der Anspannung des Tages D gegen die Nacht danach — alte Ja/Nein-Antworten zählen nicht', () => {
    const journal: Record<string, { check?: unknown; stress?: unknown }> = {};
    const vitals: VitalsLog = {};
    const werte = [5, 1, 4, 2, 4, 3, 5, 1];
    werte.forEach((w, i) => {
      const d = T(-i - 1);
      // Die alte Ja/Nein-Antwort sagt jeweils das GEGENTEIL — sie darf nichts ändern.
      journal[d] = { stress: w, check: { stress: w < 4 } };
      vitals[tagePlus(d, 1)] = { sleep: w >= 4 ? 6 : 7.5, rec: w >= 4 ? 45 : 65 };
    });
    journal[T(-9)] = { check: { stress: true } }; // nur die alte Antwort, keine Anspannung → kein Datenpunkt
    vitals[T(-8)] = { sleep: 3 };
    const r = checkAuswertung(journal, vitals, ['alkohol', ANSPANNUNG_ID, 'stress'], HEUTE);
    expect(r.befunde.map(b => b.id)).toEqual([ANSPANNUNG_ID]);
    expect(r.befunde[0]).toMatchObject({ kurz: 'Stress', quelle: 'Anspannung (Morgen-Check)', schlafDiffMin: -90, recDiff: -20, ja: { n: 4 }, nein: { n: 4 } });
    expect(r.befunde[0].satz).toBe('An Tagen mit „Stress“ hattest du im Schnitt 90 Min. weniger Schlaf und eine um 20 Punkte niedrigere Recovery (4 Tage mit, 4 ohne).');
    expect(r.fortschritt.map(f => f.id)).toEqual(['alkohol', ANSPANNUNG_ID]); // die abgelöste Frage zählt gar nicht
    // Nur alte Antworten, keine Anspannung → nichts.
    expect(checkAuswertung({ [T(-2)]: { check: { stress: true } } }, { [T(-1)]: { sleep: 7 } }, [ANSPANNUNG_ID], HEUTE).fortschritt[0]).toMatchObject({ ja: 0, nein: 0 });
  });
  it('vor 14 Uhr fragt die Karte nach gestern, danach nach heute', () => {
    expect(checkTagFuer(`${HEUTE}T07:30:00`)).toEqual({ tag: T(-1), welcher: 'gestern' });
    expect(checkTagFuer(`${HEUTE}T20:00:00`)).toEqual({ tag: HEUTE, welcher: 'heute' });
  });
  it('Auswertung: Tag D → Nacht danach (Vitalwerte D+1), erst ab 3 Tagen je Gruppe, sortiert nach Unterschied', () => {
    const journal: Record<string, { check?: unknown }> = {};
    const vitals: VitalsLog = {};
    for (let i = 1; i <= 8; i++) {
      const d = T(-i - 1);
      const alkohol = i % 2 === 0; // 4 × ja, 4 × nein
      journal[d] = { check: { alkohol, getrunken: true } };
      vitals[tagePlus(d, 1)] = { sleep: alkohol ? 6.5 : 7.5, rec: alkohol ? 40 : 60 };
    }
    const r = checkAuswertung(journal, vitals, ['alkohol', 'getrunken', 'koffein-spaet'], HEUTE);
    expect(r.befunde.map(b => b.id)).toEqual(['alkohol']); // „getrunken“ hat keine Nein-Tage
    expect(r.befunde[0]).toMatchObject({ schlafDiffMin: -60, recDiff: -20, ja: { n: 4, schlaf: 6.5, rec: 40 }, nein: { n: 4, schlaf: 7.5, rec: 60 } });
    expect(r.befunde[0].satz).toBe('An Tagen mit „Alkohol“ hattest du im Schnitt 60 Min. weniger Schlaf und eine um 20 Punkte niedrigere Recovery (4 Tage mit, 4 ohne).');
    expect(r.fortschritt.find(f => f.id === 'getrunken')).toMatchObject({ ja: 8, nein: 0, fehlt: 3 });
    expect(r.fortschritt.find(f => f.id === 'koffein-spaet')).toMatchObject({ ja: 0, nein: 0, fehlt: 6 });
  });
  it('heute selbst zählt nicht (die Nacht danach gibt es noch nicht); kleine Unterschiede heißen „kaum“', () => {
    expect(befundSatz('Stress', 5, 1, 3, 4)).toBe('„Stress“: kaum Unterschied in der Nacht danach (3 Tage mit, 4 ohne).');
    const r = checkAuswertung({ [HEUTE]: { check: { alkohol: true } } }, { [T(1)]: { sleep: 5 } }, ['alkohol'], HEUTE);
    expect(r.fortschritt[0]).toMatchObject({ ja: 0, nein: 0 });
  });
});

describe('Essen nach WHOOP', () => {
  const log = (x: Record<string, { kcal?: number; strain?: number; schritte?: number }>): VitalsLog => x;
  const woche = (kcal: number, strain: number, schritte = 8000) => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(i => [T(-i), { kcal, strain, schritte }]));
  it('Ø Energie der 7 Tage davor (auf 50 gerundet), normaler Tag', () => {
    const s = essenOrientierung({ log: log(woche(2612, 11)), heute: HEUTE });
    expect(s).toMatchObject({ kcal7: 2600, kcalTage: 7, kcalGestern: 2612, tendenz: 'normal' });
    expect(s.satz).toContain('normaler Tag');
  });
  it('harter Trainingstag geplant → eher mehr, mit Trinken-Hinweis', () => {
    const s = essenOrientierung({ log: log(woche(2600, 11)), heute: HEUTE, plan: 'hart' });
    expect(s.tendenz).toBe('mehr');
    expect(s.gruende).toContain('harter Trainingstag geplant');
    expect(s.trinken).toBeDefined();
  });
  it('Alltagsbewegung (Schritte bisher ≥ Ø × 1,3) zählt mit', () => {
    const s = essenOrientierung({ log: log({ ...woche(2600, 11, 8000), [HEUTE]: { schritte: 11000 } }), heute: HEUTE });
    expect(s).toMatchObject({ tendenz: 'mehr', gruende: ['viel Alltagsbewegung'] });
  });
  it('Strain bisher heute über dem Ø und harter Vortag zählen; Ruhetag → leichter, außer nach einem harten Tag', () => {
    expect(essenOrientierung({ log: log({ ...woche(2600, 10), [HEUTE]: { strain: 13 } }), heute: HEUTE }).gruende).toContain('heute schon mehr Belastung als sonst');
    expect(essenOrientierung({ log: log(woche(2600, 10)), heute: HEUTE, plan: 'ruhe' }).tendenz).toBe('weniger');
    const nachHart = log({ ...woche(2600, 10), [T(-1)]: { kcal: 3400, strain: 16 } });
    expect(essenOrientierung({ log: nachHart, heute: HEUTE, plan: 'ruhe' })).toMatchObject({ tendenz: 'mehr', gruende: ['gestern ein harter Tag'] });
  });
  it('ohne WHOOP-Werte keine Zahl — nie eine erfundene', () => {
    const s = essenOrientierung({ log: {}, heute: HEUTE, lauftag: true });
    expect(s.kcal7).toBeUndefined();
    expect(s.kcalTage).toBe(0);
    expect(s.trinken).toContain('Lauftag');
  });
  it('Belastungstage: Plan gewinnt, sonst Strain-Geschichte; für den Haushalt vereinigt — die Zeile nennt keine Person', () => {
    expect(planBelastung({ art: 'hyrox' })).toBe('hart');
    expect(planBelastung({ art: 'lauf', dauerMin: 90 })).toBe('hart');
    expect(planBelastung({ art: 'gym', dauerMin: 45 })).toBe('training');
    expect(planBelastung({ art: 'ruhe' })).toBe('ruhe');
    expect(belastungsTage({ di: 'hart', do: 'training', sa: 'ruhe' }, { mo: 18 })).toEqual(['di']);
    expect(belastungsTage({}, { mo: 15, mi: 9 })).toEqual(['mo']);
    expect(belastungsTageHaushalt([['do'], ['di', 'do']])).toEqual(['di', 'do']);
    const z = belastungsZeile(['di', 'do']);
    expect(z).toContain('Dienstag, Donnerstag');
    expect(z).toContain('Nenne keine Person');
    expect(belastungsZeile([])).toBe('');
  });
  it('Strain je Wochentag: Ø der letzten 4 Wochen, ab 2 Werten', () => {
    const l: VitalsLog = {};
    for (let w = 0; w < 4; w++) l[tagePlus(HEUTE, -7 * w - 7)] = { strain: 14 + w };
    expect(wTagVon(HEUTE)).toBe('fr');
    expect(strainJeWochentag(l, HEUTE)).toEqual({ fr: 15.5 });
  });
  it('Ergänzungs-Vorlagen ohne Mengenempfehlung — die Menge trägt die Person ein', () => {
    expect(ERGAENZUNG_VORLAGEN.map(v => v.id)).toEqual(['protein', 'kreatin', 'elektrolyte', 'trinken']);
    for (const v of ERGAENZUNG_VORLAGEN) expect(`${v.label} ${v.hinweis}`).not.toMatch(/\d+\s?(g|mg|ml|l)\b/i);
    expect(ergaenzungLabel('kreatin', ' 5   g ')).toBe('Kreatin · 5 g');
    expect(ergaenzungLabel('protein')).toBe('Protein');
  });
});

describe('Tipp-Vorrang', () => {
  it('Stufe läuft noch → nennt die nächste Stufe', () => {
    const stufe = aufstehenStufe({ aufstehen: '07:30', aufstehenZiel: '06:45', schrittMin: 15, schrittTage: 3, ab: HEUTE }, HEUTE)!;
    const t = schlafTipp({ stufe, ziel: { stunden: 8, grund: 8, ausgleich: 0, quelle: 'whoop' }, schlafenszeit: '23:15' });
    expect(t).toContain('12.10.');
    expect(t).toContain('früher');
    expect(t).toContain('06:45');
  });
});
