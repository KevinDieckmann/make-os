// ─── Sport · Plan-Baukasten (09.10.2026): Einheiten je Tag, Vorlagen, Blöcke, Plan ↔ Ist, Tagesform, Entlastung, Wettkampf ────
// Nur erfundene Pläne und Werte (keine Person, keine echten Daten). Struktur und Erfassung, keine Trainingsberatung.
import { describe, it, expect } from 'vitest';
import { leererStand, saeubere, wendeAn, PLAN_GRENZEN, type SportStand, type Woche } from '@/lib/sport/modell';
import {
  START_VORLAGEN, STANDARD, einheitenVon, tagAus, vorlageVon, alleVorlagen, wocheInPhase, wocheFuer, geplanteEinheiten, planGegenIst, blockBauen,
  saison, countdownText, taperVorschlag, intensitaetVon, ERSATZ,
} from '@/lib/sport/plan-bau';
import { planUmfang, planIst, vorschlagWoche } from '@/lib/sport/plan';
import { tagesformHinweis } from '@/lib/sport/tagesform';
import { entlastungPruefen, ENTLASTUNG_VORGABE } from '@/lib/sport/entlastung';
import { tagPlus } from '@/lib/sport/pace';

const MO = '2026-10-05'; // Montag
const START = START_VORLAGEN.find(v => v.id === 'start-hyrox-5')!;
const mitWoche = (w: Woche, extra: Partial<SportStand> = {}): SportStand => ({ ...leererStand(), einstieg: { fertig: true }, woche: w, ...extra });

describe('Einheiten je Tag', () => {
  it('ein Tag mit Einheiten: Art = erste Einheit, Dauer = Summe — ältere Leser sehen denselben Tag', () => {
    const t = saeubere({ woche: { mi: { art: 'frei', einheiten: [{ id: 'a', sparte: 'hyrox', typ: 'stationen', dauerMin: 40 }, { id: 'b', sparte: 'lauf', typ: 'tempo', dauerMin: 20 }] } } }).woche.mi;
    expect(t).toMatchObject({ art: 'hyrox', dauerMin: 60 });
    expect(t.einheiten).toHaveLength(2);
  });
  it('ältere Pläne ohne Einheiten: der Tag ist EINE Einheit seiner Art; Ruhe/frei keine', () => {
    expect(einheitenVon({ art: 'lauf', dauerMin: 45 }, 'di')).toEqual([{ id: 'di-1', sparte: 'lauf', dauerMin: 45 }]);
    expect(einheitenVon({ art: 'ruhe' }, 'so')).toEqual([]);
    expect(planUmfang(vorschlagWoche('hyrox', 4)).einheiten).toBe(4); // wie bisher
  });
  it('Umfang zählt Einheiten (zwei an einem Tag = zwei) und je Sparte', () => {
    const u = planUmfang(START.woche);
    expect(u.einheiten).toBe(7);
    expect(u.jeSparte).toMatchObject({ lauf: 3, hyrox: 2, gym: 1, mobility: 1 });
    expect(u.ruhetage).toBe(1);
  });
  it('mehr als vier Einheiten an einem Tag → abgelehnt, nichts gekürzt', () => {
    const fuenf = Array.from({ length: PLAN_GRENZEN.einheitenJeTag + 1 }, (_, i) => ({ id: `e${i}`, sparte: 'lauf', dauerMin: 10 }));
    expect(() => wendeAn(leererStand(), { op: 'woche', tage: { mo: { art: 'lauf', einheiten: fuenf } } })).toThrow(/Höchstens 4/);
  });
  it('Intensität: angegeben, sonst Vorgabe des Typs', () => {
    expect(intensitaetVon({ sparte: 'lauf', typ: 'intervall' })).toBe('hart');
    expect(intensitaetVon({ sparte: 'lauf', typ: 'grundlage', intensitaet: 'mittel' })).toBe('mittel');
    expect(intensitaetVon({ sparte: 'mobility' })).toBe('leicht');
  });
});

describe('Vorlagen', () => {
  it('Startvorlagen: neutral, im Code, gültig nach der Säuberung, nicht änderbar', () => {
    expect(START_VORLAGEN.length).toBeGreaterThanOrEqual(3);
    for (const v of START_VORLAGEN) {
      expect(v.id.startsWith('start-')).toBe(true);
      expect(saeubere({ woche: v.woche }).woche).toEqual(v.woche);
    }
    expect(() => wendeAn(leererStand(), { op: 'plan-vorlage', eintrag: { ...START, name: 'meins' } })).toThrow(/Startvorlagen/);
  });
  it('eigene Vorlage speichern, ändern, entfernen — Standardwoche und Startvorlagen zur Wahl', () => {
    let s = wendeAn(leererStand(), { op: 'plan-vorlage', eintrag: { id: 'pv-1', name: 'Meine Woche', woche: START.woche } });
    s = wendeAn(s, { op: 'plan-vorlage', eintrag: { id: 'pv-1', name: 'Meine Woche 2', woche: START.woche } });
    expect(s.planVorlagen).toHaveLength(1);
    expect(vorlageVon(s, 'pv-1')!.name).toBe('Meine Woche 2');
    expect(vorlageVon(s, STANDARD)!.woche).toBe(s.woche);
    expect(alleVorlagen(s).map(v => v.art)).toEqual(['standard', 'eigen', ...START_VORLAGEN.map(() => 'start')]);
    expect(wendeAn(s, { op: 'plan-vorlage-weg', id: 'pv-1' }).planVorlagen).toBeUndefined();
  });
  it('höchstens 30 eigene Vorlagen; eine Vorlage im laufenden Block lässt sich nicht entfernen', () => {
    let s = leererStand();
    for (let i = 0; i < PLAN_GRENZEN.vorlagen; i++) s = wendeAn(s, { op: 'plan-vorlage', eintrag: { id: `pv-${i}`, name: `V${i}`, woche: {} } });
    expect(() => wendeAn(s, { op: 'plan-vorlage', eintrag: { id: 'pv-neu', name: 'zu viel', woche: {} } })).toThrow(/Höchstens 30/);
    s = wendeAn(s, { op: 'plan-block', block: { id: 'b1', start: MO, wochen: [{ vorlage: 'pv-0', phase: 'aufbau' }] } });
    expect(() => wendeAn(s, { op: 'plan-vorlage-weg', id: 'pv-0' })).toThrow(/Block/);
  });
});

describe('Phasen und Blöcke', () => {
  it('Deload: Umfang 60 % (auf 5 min, mind. 10), hart → mittel; Taper: Umfang 60 %, Intensität bleibt; je Person einstellbar', () => {
    const d = wocheInPhase(START.woche, 'deload');
    expect(d.do.einheiten![0]).toMatchObject({ dauerMin: 25, intensitaet: 'mittel' }); // Intervall 45 → 27 → 25
    expect(d.mo.einheiten![1].dauerMin).toBe(10); // Mobility 15 → 9 → mindestens 10
    const t = wocheInPhase(START.woche, 'taper');
    expect(t.do.einheiten![0].intensitaet).toBeUndefined();
    expect(wocheInPhase(START.woche, 'deload', { deload: 80 }).do.einheiten![0].dauerMin).toBe(35);
    expect(wocheInPhase(START.woche, 'aufbau')).toBe(START.woche);
  });
  it('blockBauen: Rhythmus 3 Aufbau + 1 Deload, Taper am Ende; „bis“ endet mit der Wettkampfwoche', () => {
    const b = blockBauen({ id: 'b', start: '2026-10-07', vorlage: STANDARD, wochen: 9, aufbau: 3, deload: 1, taper: 1 });
    expect(b.start).toBe(MO);
    expect(b.wochen.map(w => w.phase)).toEqual(['aufbau', 'aufbau', 'aufbau', 'deload', 'aufbau', 'aufbau', 'aufbau', 'deload', 'taper']);
    const bis = blockBauen({ id: 'b', start: '2026-10-09', vorlage: STANDARD, bis: '2026-10-17', aufbau: 3, deload: 0, taper: 1 });
    expect(bis.wochen.map(w => w.phase)).toEqual(['aufbau', 'taper']);
    const nachTagesform = blockBauen({ id: 'b', start: MO, vorlage: STANDARD, wochen: 6, aufbau: 3, deload: 0, taper: 0 });
    expect(nachTagesform.wochen.every(w => w.phase === 'aufbau')).toBe(true);
  });
  it('wocheFuer: Block-Woche mit Phase, außerhalb die Standardwoche; Phase der Person gewinnt', () => {
    let s = mitWoche(vorschlagWoche('lauf', 3));
    s = wendeAn(s, { op: 'plan-block', block: blockBauen({ id: 'b', start: MO, vorlage: 'start-hyrox-5', wochen: 2, aufbau: 1, deload: 1, taper: 0 }) });
    expect(wocheFuer(s, MO)).toMatchObject({ quelle: 'block', phase: 'aufbau', blockWoche: 1, blockWochen: 2, vorlage: { id: 'start-hyrox-5' } });
    expect(wocheFuer(s, '2026-10-14')).toMatchObject({ quelle: 'block', phase: 'deload', blockWoche: 2 });
    expect(wocheFuer(s, '2026-10-19')).toMatchObject({ quelle: 'standard', phase: 'aufbau' });
    s = wendeAn(s, { op: 'wochen-phase', montag: MO, phase: 'deload' });
    expect(wocheFuer(s, MO)).toMatchObject({ phase: 'deload', eigenePhase: true });
    s = wendeAn(s, { op: 'wochen-phase', montag: MO, phase: null });
    expect(s.wochenPhase).toBeUndefined();
  });
  it('Block-Prüfungen: Montag, bekannte Vorlagen, bekanntes Ziel, höchstens 52 Wochen', () => {
    expect(() => wendeAn(leererStand(), { op: 'plan-block', block: { id: 'b', start: '2026-10-06', wochen: [{ vorlage: STANDARD, phase: 'aufbau' }] } })).toThrow(/Montag/);
    expect(() => wendeAn(leererStand(), { op: 'plan-block', block: { id: 'b', start: MO, wochen: [{ vorlage: 'pv-gibtsnicht', phase: 'aufbau' }] } })).toThrow(/Vorlage/);
    expect(() => wendeAn(leererStand(), { op: 'plan-block', block: { id: 'b', start: MO, zielId: 'z-x', wochen: [{ vorlage: STANDARD, phase: 'aufbau' }] } })).toThrow(/Ziel/);
    expect(() => wendeAn(leererStand(), { op: 'plan-block', block: { id: 'b', start: MO, wochen: Array.from({ length: 53 }, () => ({ vorlage: STANDARD, phase: 'aufbau' })) } })).toThrow(/52/);
    expect(() => wendeAn(leererStand(), { op: 'plan-block', block: { id: 'b', start: MO, wochen: [{ vorlage: STANDARD, phase: 'quatsch' }] } })).toThrow(/unvollständig|Start/);
    expect(wendeAn(wendeAn(leererStand(), { op: 'plan-block', block: { id: 'b', start: MO, wochen: [{ vorlage: STANDARD, phase: 'aufbau' }] } }), { op: 'plan-block', block: null }).block).toBeUndefined();
  });
  it('Plan/Ist über 8 Wochen nimmt je Woche den Plan DIESER Woche (Block mit Phase)', () => {
    let s = mitWoche(vorschlagWoche('hyrox', 4));
    s = wendeAn(s, { op: 'plan-block', block: { id: 'b', start: MO, wochen: [{ vorlage: 'start-hyrox-5', phase: 'aufbau' }] } });
    const p = planIst(s, '2026-10-11', 2);
    expect(p[0].plan).toBe(4); // Woche davor: Standardwoche
    expect(p[1].plan).toBe(7); // Block-Woche
  });
});

describe('Plan ↔ Ist', () => {
  const s = (() => {
    let x = mitWoche(START.woche);
    // Mo: Lauf Grundlage erfüllt (am Tag), Mobility fehlt → verpasst; Di Stationen per WHOOP „Krafttraining“ (Ersatz), Tempo fehlt →
    // verpasst; Mi Kraft von Hand erfüllt; Do Intervall am Freitag gelaufen (+1); Sa Simulation offen; dazu ein Rad-Training (zusätzlich).
    x = wendeAn(x, { op: 'lauf', eintrag: { id: 'l1', datum: '2026-10-05', distanzKm: 8, dauerSek: 2880, art: 'locker' } });
    x = wendeAn(x, { op: 'gym', eintrag: { id: 'g1', datum: '2026-10-07', uebungen: [{ uebung: 'kniebeuge', saetze: [{ kg: 60, wdh: 5 }] }] } });
    x = { ...x, training: [
      { id: 't1', datum: '2026-10-06', sport: 'strength-trainer', dauerMin: 42, quelle: 'whoop', externeId: 'whoop:a', strain: 12 },
      { id: 't2', datum: '2026-10-09', sport: 'running', dauerMin: 44, quelle: 'whoop', externeId: 'whoop:b', strain: 13.5 },
      { id: 't3', datum: '2026-10-08', sport: 'cycling', dauerMin: 60, quelle: 'whoop', externeId: 'whoop:c', strain: 8 },
    ] };
    return x;
  })();
  const r = planGegenIst(s, MO, '2026-10-09');
  it('gleicher Tag, ±1 Tag, Ersatz-Sparte; verpasst erst nach der Toleranz; heute/offen', () => {
    const st = Object.fromEntries(r.zeilen.map(z => [z.plan.einheit.id + '@' + z.plan.wochentag, z.status]));
    expect(st['mo-1@mo']).toBe('erfuellt');
    expect(st['mo-2@mo']).toBe('verpasst');
    expect(st['mi-1@mi']).toBe('erfuellt');
    expect(st['di-1@di']).toBe('erfuellt');
    expect(r.zeilen.find(z => z.plan.einheit.id === 'di-1')!.ersatz).toBe(true);
    expect(st['di-2@di']).toBe('verpasst');
    expect(st['do-1@do']).toBe('erfuellt');
    expect(r.zeilen.find(z => z.plan.einheit.id === 'do-1')!.versetzt).toBe(1);
    expect(st['sa-1@sa']).toBe('offen');
    expect(planGegenIst(s, MO, '2026-10-10').zeilen.find(z => z.plan.wochentag === 'sa')!.status).toBe('heute');
    expect(r).toMatchObject({ geplant: 7, erfuellt: 4, verpasst: 2 });
  });
  it('zusätzliche Einheiten und Strain gegen Plan', () => {
    expect(r.zusaetzlich.map(e => e.id)).toEqual(['t3']);
    expect(r.strainIst).toBeCloseTo(12 + 13.5 + 8, 5);
    expect(r.strainPlan).toBeUndefined(); // ohne Strain-Ziele im Plan keine Plan-Summe
    const mitZiel = wendeAn(s, { op: 'woche', tage: { ...START.woche, mo: tagAus([{ id: 'mo-1', sparte: 'lauf', typ: 'grundlage', dauerMin: 50, strain: 9.5 }]) } });
    expect(planGegenIst(mitZiel, MO, '2026-10-09').strainPlan).toBe(9.5);
  });
  it('Ersatz-Tabelle: Hyrox ↔ Gym, Ausdauer nimmt Rad/Lauf, Sonstiges nimmt alles', () => {
    expect(ERSATZ.hyrox).toContain('gym');
    expect(ERSATZ.ausdauer).toEqual(['rad', 'lauf']);
    expect(ERSATZ.lauf).toEqual([]);
  });
});

describe('Tagesform an der geplanten Einheit (EINE Regel)', () => {
  it('grün/ohne Recovery: nichts; gelb nur an harten Einheiten; rot an allen außer Mobility', () => {
    expect(tagesformHinweis({ sparte: 'lauf', typ: 'intervall' }, 80)).toBeNull();
    expect(tagesformHinweis({ sparte: 'lauf', typ: 'intervall' })).toBeNull();
    expect(tagesformHinweis({ sparte: 'lauf', typ: 'intervall' }, 50)).toMatchObject({ stufe: 'gelb', vorschlag: 'leichter', kurz: 'heute leichter' });
    expect(tagesformHinweis({ sparte: 'lauf', typ: 'grundlage' }, 50)).toBeNull();
    expect(tagesformHinweis({ sparte: 'hyrox', typ: 'simulation' }, 30)).toMatchObject({ stufe: 'rot', vorschlag: 'tauschen' });
    expect(tagesformHinweis({ sparte: 'gym', typ: 'kraft' }, 30)).toMatchObject({ stufe: 'rot', vorschlag: 'locker' });
    expect(tagesformHinweis({ sparte: 'mobility' }, 20)).toBeNull();
    expect(tagesformHinweis({ sparte: 'lauf', typ: 'tempo' }, 30)!.text).toMatch(/Rahmen heute bis 10/);
  });
});

describe('Entlastung nach HRV-Trend und Ruhepuls (EINE Regel, einstellbar)', () => {
  const H = '2026-10-20';
  const basis = (hrv: number, puls: number, tage = 17) => Object.fromEntries(Array.from({ length: tage }, (_, i) => [tagPlus(H, -i), { hrv, ruhepuls: puls }]));
  it('stabile Werte → kein Vorschlag', () => {
    const r = entlastungPruefen(basis(60, 50), H)!;
    expect(r).toMatchObject({ vorschlag: false, auffaellig: 0, gemessen: 3, bezug: { hrv: 60, ruhepuls: 50 } });
  });
  it('zwei von drei Tagen HRV unter 90 % des Bezugs → Entlastung vorschlagen', () => {
    const log = basis(60, 50);
    log[H] = { hrv: 50, ruhepuls: 50 }; log[tagPlus(H, -1)] = { hrv: 52, ruhepuls: 51 };
    expect(entlastungPruefen(log, H)).toMatchObject({ vorschlag: true, auffaellig: 2 });
  });
  it('Ruhepuls über Bezug + 3 zählt ebenso; ein einzelner Tag ist noch kein Muster', () => {
    const log = basis(60, 50);
    log[H] = { hrv: 60, ruhepuls: 55 };
    const r = entlastungPruefen(log, H)!;
    expect(r).toMatchObject({ vorschlag: false, auffaellig: 1 });
    expect(r.tage.find(t => t.tag === H)!.gruende[0]).toMatch(/Ruhepuls 55/);
  });
  it('der Bezug liegt VOR dem Fenster — ein schlechtes Fenster zieht ihn nicht mit', () => {
    const log = basis(60, 50);
    for (let i = 0; i < 3; i++) log[tagPlus(H, -i)] = { hrv: 45, ruhepuls: 56 };
    expect(entlastungPruefen(log, H)!.bezug).toEqual({ hrv: 60, ruhepuls: 50 });
  });
  it('einstellbar: Fenster, Mindesttage, Schwellen, aus', () => {
    const log = basis(60, 50);
    log[H] = { hrv: 55, ruhepuls: 50 }; log[tagPlus(H, -1)] = { hrv: 55, ruhepuls: 50 };
    expect(entlastungPruefen(log, H)!.vorschlag).toBe(false); // 55 ≥ 54 (90 %)
    expect(entlastungPruefen(log, H, { hrvAnteil: 0.95 })!.vorschlag).toBe(true);
    expect(entlastungPruefen(log, H, { hrvAnteil: 0.95, mindestTage: 3 })!.vorschlag).toBe(false);
    expect(entlastungPruefen(log, H, { aus: true })).toBeNull();
    expect(ENTLASTUNG_VORGABE).toEqual({ fensterTage: 3, mindestTage: 2, hrvAnteil: 0.9, pulsPlus: 3 });
  });
  it('zu wenig Werte → nichts sagen (nie raten)', () => {
    expect(entlastungPruefen({ [H]: { hrv: 40 } }, H)).toBeNull();
    const nurBezug = basis(60, 50); delete nurBezug[H]; delete nurBezug[tagPlus(H, -1)];
    expect(entlastungPruefen(nurBezug, H)).toBeNull(); // nur ein gemessener Tag im Fenster
  });
  it('Einstellungen der Person werden gesäubert und zusammengeführt; null setzt zurück', () => {
    let s = wendeAn(leererStand(), { op: 'einstellungen', werte: { zuerst: 'schlaf', entlastung: { hrvAnteil: 0.92, fensterTage: 4 } } });
    expect(s.einstellungen).toEqual({ zuerst: 'schlaf', entlastung: { hrvAnteil: 0.92, fensterTage: 4 } });
    s = wendeAn(s, { op: 'einstellungen', werte: { entlastung: { hrvAnteil: null, pulsPlus: 5 }, deloadProzent: 70 } });
    expect(s.einstellungen).toEqual({ zuerst: 'schlaf', entlastung: { fensterTage: 4, pulsPlus: 5 }, deloadProzent: 70 });
    s = wendeAn(s, { op: 'einstellungen', werte: { zuerst: null, entlastung: null, deloadProzent: null } });
    expect(s.einstellungen).toBeUndefined();
    expect(saeubere({ einstellungen: { zuerst: 'quatsch', deloadProzent: 5, entlastung: { hrvAnteil: 2 } } }).einstellungen).toBeUndefined();
  });
});

describe('Wettkampf-Ziele: Countdown, Saison, Taper-Vorschlag', () => {
  const ziele = [
    { id: 'z-hm', art: 'lauf' as const, titel: 'Halbmarathon', datum: '2026-10-17', distanzKm: 21.1, zielzeitSek: 7200, angelegt: 'x' },
    { id: 'z-hx', art: 'hyrox' as const, titel: 'Hyrox', datum: '2026-12-12', angelegt: 'x' },
    { id: 'z-alt', art: 'lauf' as const, titel: 'Vorbei', datum: '2026-09-01', angelegt: 'x' },
  ];
  it('Countdown-Sätze', () => {
    expect([0, 1, 8, 20, 35].map(countdownText)).toEqual(['heute', 'morgen', 'in 8 Tagen', 'in 20 Tagen', 'in 5 Wochen']);
  });
  it('Saison: kommende Ziele der Reihe nach', () => {
    expect(saison(ziele, '2026-10-09').map(w => [w.ziel.id, w.tage])).toEqual([['z-hm', 8], ['z-hx', 64]]);
  });
  it('Taper-Vorschlag: Wettkampf in ≤ 21 Tagen ohne Taper-Woche → Wettkampfblock bis zur Wettkampfwoche; danach nicht mehr', () => {
    const s = { ...mitWoche(vorschlagWoche('lauf', 3)), ziele };
    const v = taperVorschlag(s, '2026-10-09')!;
    expect(v).toMatchObject({ ziel: { id: 'z-hm' }, tage: 8, wunsch: { start: MO, bis: '2026-10-17', taper: 1, deload: 0, zielId: 'z-hm' } });
    const b = blockBauen({ id: 'b', ...v.wunsch });
    expect(b.wochen.map(w => w.phase)).toEqual(['aufbau', 'taper']);
    const mitBlock = wendeAn(s, { op: 'plan-block', block: b });
    expect(taperVorschlag(mitBlock, '2026-10-09')).toBeNull();
    expect(taperVorschlag(s, '2026-09-20')).toBeNull(); // 27 Tage vorher: noch nicht
  });
  it('Ziel-Pace eines Halbmarathons in 2:00 h', async () => {
    const { zielPace, formatPace } = await import('@/lib/sport/pace');
    expect(formatPace(zielPace(ziele[0]))).toBe('5:41');
  });
});

describe('Alte Stände bleiben bit-gleich', () => {
  it('ein Stand ohne die neuen Felder säubert sich wie vorher', () => {
    const alt = { version: 1, einstieg: { fertig: true }, ziele: [], ausgang: { kraft: {} }, woche: vorschlagWoche('hyrox', 4), hyrox: [], laeufe: [], gym: { uebungen: [], einheiten: [], vorlagen: [] }, erholung: {} };
    const s = saeubere(JSON.parse(JSON.stringify(alt)));
    expect(s).toEqual(alt);
    expect(geplanteEinheiten(s, MO)).toHaveLength(4);
  });
});
