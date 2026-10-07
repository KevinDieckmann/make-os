// ─── Seil (07.10.): das reine Modell und die Geometrie — erfundene Ziele, Meilensteine, Karten ───────────────────────────
// Kevin: „Am Ende müssen sie irgendwo alle ineinander greifen, wie ein Kabel oder ein Seil.“ Geprüft: Lage der Stränge (Start,
// Einmündung, Spur-Reihenfolge), Status und Grund (blockiert, überfällig), Seil-Dichte (Momentum, Schwung), kritischer Pfad und
// Engpass, Kanten, Unterziele, Geometrie (Spuren, Einmündung, Fasern, Zulauf, Drall), Determinismus.
import { describe, it, expect } from 'vitest';
import { SEIL, kritischerPfad, schwungAus, seilRechnen, seilWurzelVon, fokusMenge, type SeilEingang } from '@/lib/lichtfaeden/seil';
import { SEIL_FORM, drallLaenge, faserBei, fasernBei, kantenKurve, bezierPunkt, miniSeil, seilLage, seilRadius, seilX, strangY } from '@/lib/lichtfaeden/seil-geometrie';

const HEUTE = '2026-10-07';
const eingang = (): SeilEingang => ({
  heute: HEUTE, von: '2026-09-01', bis: '2027-08-31',
  ziele: [
    { id: 'umsatz', titel: 'Umsatz verdoppeln', farbe: '#E0A84E', rang: 1, space: 'business', anker: '2027-06-30', ankerArt: 'frist', link: '/os/planung/ziel/umsatz' },
    { id: 'q1', titel: 'Q1: zehn Kunden', farbe: '#E0A84E', rang: 5, space: 'business', anker: '2027-03-31', elternId: 'umsatz', fortschritt: 30 },
    { id: 'gesund', titel: 'Gesund bleiben', farbe: '#3FBF8A', rang: 2, space: 'privat', anker: '2026-12-31', ankerArt: 'jahresende', fortschritt: 40 },
    { id: 'leer', titel: 'Noch leer', farbe: '#A79BFF', rang: 3, space: 'business', fortschritt: 20 },
  ],
  straenge: [
    { id: 'ms:vertrag', art: 'meilenstein', titel: 'Vertrag', zielId: 'umsatz', ende: '2026-11-15', erledigt: true, erledigtAm: '2026-10-02', fortschritt: 1 },
    { id: 'ms:website', art: 'meilenstein', titel: 'Website', zielId: 'umsatz', ende: '2027-02-01', fortschritt: 0.5, wartetAuf: ['ms:vertrag'] },
    { id: 'ms:launch', art: 'meilenstein', titel: 'Launch', zielId: 'umsatz', ende: '2027-05-01', fortschritt: 0, wartetAuf: ['ms:website'] },
    { id: 'ms:spaet', art: 'meilenstein', titel: 'Nach der Frist', zielId: 'umsatz', ende: '2027-08-01', fortschritt: 0 },
    { id: 'ziel:q1', art: 'unterziel', titel: 'Q1: zehn Kunden', zielId: 'umsatz', ende: '2027-03-31', fortschritt: 0.3 },
    { id: 'ms:q1-a', art: 'meilenstein', titel: 'Akquise-Welle', zielId: 'q1', ende: '2027-01-20', fortschritt: 0 },
    { id: 'karten:gesund', art: 'karten', titel: 'Lose Karten', zielId: 'gesund' },
    { id: 'projekt:alt', art: 'projekt', titel: 'Altlast', zielId: 'gesund', ende: '2026-09-20' },
    { id: 'projekt:frei', art: 'projekt', titel: 'Ohne Ziel', zielId: null, start: '2026-10-01', ende: '2026-11-30' },
  ],
  karten: [
    { id: 'a1', strang: 'ms:website', titel: 'Texte', tag: '2026-11-20', status: 'erledigt', erledigtAm: '2026-10-05' },
    { id: 'a2', strang: 'ms:website', titel: 'Design', tag: '2026-12-10', status: 'offen', wartetAuf: ['a1'] },
    { id: 'a3', strang: 'ms:website', titel: 'Freigabe', tag: '2027-01-15', status: 'offen', wartetAuf: ['a2'] },
    { id: 'l1', strang: 'ms:launch', titel: 'Presse', tag: '2027-04-10', status: 'offen', wartetAuf: ['a3'] },
    { id: 'g1', strang: 'karten:gesund', titel: 'Check-up', tag: '2026-11-03', status: 'erledigt', erledigtAm: '2026-10-06' },
    { id: 'g2', strang: 'karten:gesund', titel: 'Laufschuhe', tag: '2026-10-20', status: 'offen' },
    { id: 'g3', strang: 'karten:gesund', titel: 'Abgesagt', tag: '2026-10-21', status: 'abgebrochen' },
    { id: 'x1', strang: 'projekt:alt', titel: 'Überfälliges', tag: '2026-09-20', status: 'offen' },
    { id: 'f1', strang: 'projekt:frei', titel: 'Frei 1', tag: '2026-10-15', status: 'offen', wartetAuf: ['f2'] },
    { id: 'f2', strang: 'projekt:frei', titel: 'Frei 2', tag: '2026-10-10', status: 'offen' },
    { id: 'fremd', strang: 'gibt-es-nicht', titel: 'Fremd', tag: '2026-10-10', status: 'offen' },
  ],
  marken: [
    { id: 'termin:t1', strang: 'ms:website', karte: 'a2', tag: '2026-12-08', art: 'termin', titel: 'Design-Termin' },
    { id: 'deal:d1', strang: 'ms:launch', tag: '2027-09-30', art: 'deal', titel: 'Außerhalb des Fensters' },
  ],
});

describe('Seile und Stränge', () => {
  const a = seilRechnen(eingang());
  it('Seile = oberste Ziele nach Rang; Unterziele münden ins Seil ihres Oberziels; ohne Ziel ein eigenes Bündel', () => {
    expect(a.seile.map(s => s.zielId)).toEqual(['umsatz', 'gesund', 'leer']);
    expect(seilWurzelVon(eingang().ziele).get('q1')).toBe('umsatz');
    expect(a.straenge['ms:q1-a']).toMatchObject({ seil: 'umsatz', ueber: 'Q1: zehn Kunden' });
    expect(a.ohneZiel).toEqual(['projekt:frei']);
    expect(a.straenge['projekt:frei'].seil).toBeNull();
    expect(Object.keys(a.straenge)).not.toContain('gibt-es-nicht');
  });
  it('Start: spätestes Ende der Vorgänger, sonst früheste Karte bzw. ausdrücklicher Start, sonst Ende − Vorlauf; mindestens 7 Tage', () => {
    expect(a.straenge['ms:website'].von).toBe('2026-11-15'); // nach dem Vertrag
    expect(a.straenge['ms:launch'].von).toBe('2027-02-01');
    expect(a.straenge['ms:q1-a'].von).toBe('2026-12-09'); // 42 Tage Vorlauf
    expect(a.straenge['projekt:frei'].von).toBe('2026-10-01');
    expect(a.straenge['karten:gesund'].von).toBe('2026-10-20'); // früheste Karte
    expect(a.straenge['karten:gesund'].bis).toBe('2026-11-03'); // späteste Karte
  });
  it('Einmündung: am Ende; offen und überfällig → HEUTE; nie hinter dem Anker (Hinweis „nach Anker“)', () => {
    expect(a.straenge['ms:vertrag'].muendung).toBe('2026-11-15');
    expect(a.straenge['projekt:alt']).toMatchObject({ status: 'ueberfaellig', muendung: HEUTE, grund: 'überfällig seit 20.09.' });
    expect(a.straenge['ms:spaet']).toMatchObject({ muendung: '2027-06-30', nachAnker: true });
  });
  it('Status und Grund: erledigt, blockiert durch Vorgänger (mit Satz), blockiert, weil alle offenen Karten warten', () => {
    expect(a.straenge['ms:vertrag'].status).toBe('erledigt');
    expect(a.straenge['ms:website'].status).toBe('offen'); // a2 wartet nur auf Erledigtes — es geht voran
    // alle offenen Karten warten auf Offenes → der Strang ist blockiert (auch ohne eigene Vorgänger)
    const nur = seilRechnen({ ...eingang(), karten: eingang().karten.map(k => (k.id === 'a1' ? { ...k, status: 'offen' as const, erledigtAm: undefined, wartetAuf: ['x1'] } : k)) });
    expect(nur.straenge['ms:website']).toMatchObject({ status: 'blockiert' });
    expect(nur.straenge['ms:website'].grund).toMatch(/^alle offenen Karten warten/);
    expect(a.straenge['ms:launch']).toMatchObject({ status: 'blockiert', blockiertBis: '2027-02-01' });
    expect(a.straenge['ms:launch'].grund).toBe('wartet auf „Website“ (offen, fällig 01.02.)');
    expect(a.straenge['karten:gesund'].status).toBe('offen');
  });
  it('Fortschritt: von außen (Meilenstein) oder aus den Karten (Abgebrochenes zählt nicht)', () => {
    expect(a.straenge['karten:gesund'].fortschritt).toBe(0.5);
    expect(a.straenge['karten:gesund'].zahl).toEqual({ gesamt: 2, erledigt: 1 });
    expect(a.straenge['ms:website'].fortschritt).toBe(0.5);
  });
  it('Karten am Strang mit Blockade-Grund; Marken nur im Fenster', () => {
    const w = a.straenge['ms:website'];
    expect(w.karten.map(k => k.id)).toEqual(['a1', 'a2', 'a3']);
    expect(w.karten.find(k => k.id === 'a2')).toMatchObject({ blockiert: false, status: 'offen' }); // a1 ist erledigt
    expect(w.karten.find(k => k.id === 'a3')).toMatchObject({ blockiert: true, grund: 'wartet auf „Design“' });
    expect(w.marken.map(m => m.id)).toEqual(['termin:t1']);
    expect(a.straenge['ms:launch'].marken).toEqual([]);
  });
  it('Spuren: wer früher einmündet, liegt unten (näher am Seil) — die erste Einmündung steht zuletzt', () => {
    const u = a.seile[0].straenge.map(id => a.straenge[id].muendung);
    expect([...u].sort().reverse()).toEqual(u);
  });
});

describe('Seil-Dichte, kritischer Pfad, Engpass', () => {
  const a = seilRechnen(eingang());
  const umsatz = a.seile[0];
  it('Momentum = Mittel des Strang-Fortschritts; ohne Stränge der Fortschritt des Ziels', () => {
    const l = umsatz.straenge.map(id => a.straenge[id].fortschritt);
    expect(umsatz.momentum).toBeCloseTo(l.reduce((x, y) => x + y, 0) / l.length, 3);
    expect(a.seile.find(s => s.zielId === 'leer')!.momentum).toBe(0.2);
    expect(umsatz.fertig).toBe(1);
  });
  it('Schwung zählt Erledigtes der letzten 14 Tage (Karten und Stränge)', () => {
    expect(umsatz.schwung).toBeCloseTo(schwungAus(2), 3); // a1 (05.10.) + Vertrag (02.10.)
    expect(schwungAus(0)).toBe(0);
    expect(schwungAus(3)).toBeCloseTo(0.5, 5);
    expect(schwungAus(30)).toBeGreaterThan(0.99);
  });
  it('kritischer Pfad: Design → Freigabe → Presse → Launch (über Karten und Stränge; Gleichstand → das spätere Glied), Text nennt ihn', () => {
    expect(umsatz.pfad).toEqual(['k:a2', 'k:a3', 'k:l1', 's:ms:launch']);
    expect(umsatz.pfadText).toBe('„Design“ → „Freigabe“ → „Presse“ → „Launch“ (4 offen, das letzte Glied fällig 01.05.)');
    expect(a.straenge['ms:launch'].kritisch).toBe(true);
    expect(a.straenge['ms:vertrag'].kritisch).toBe(false);
    expect(a.straenge['ms:website'].karten.find(k => k.id === 'a3')!.kritisch).toBe(true);
    expect(a.kanten.find(k => k.id === 'k:a2>k:a3')).toMatchObject({ offen: true, kritisch: true });
    expect(a.kanten.find(k => k.id === 's:ms:vertrag>s:ms:website')).toMatchObject({ offen: false, kritisch: false });
  });
  it('ohne ausdrückliche Abhängigkeit gibt es keinen kritischen Pfad (nur offene Karten)', () => {
    expect(a.seile.find(s => s.zielId === 'gesund')!.pfad).toEqual([]);
  });
  it('Engpass: worauf (transitiv) am meisten gewartet wird — nur ausdrückliche Abhängigkeiten zählen', () => {
    expect(umsatz.engpass).toEqual({ id: 'k:a2', titel: 'Design', wartende: 2 });
    expect(umsatz.text).toContain('Engpass: „Design“ — 2 warten darauf');
  });
  it('kritischerPfad (rein): Kreise bleiben außen vor, Gleichstand → späteres Ende', () => {
    const r = kritischerPfad([{ id: 'a', vor: ['b'] }, { id: 'b', vor: ['a'] }, { id: 'c', tag: '2026-01-01', vor: [] }, { id: 'd', tag: '2026-02-01', vor: [] }]);
    expect(r.pfad).toEqual(['d']);
    expect(kritischerPfad([]).pfad).toEqual([]);
    const k = kritischerPfad([{ id: 'x', vor: [] }, { id: 'y', vor: ['x'] }, { id: 'z', vor: ['y', 'fremd'] }]);
    expect(k.pfad).toEqual(['x', 'y', 'z']);
    expect(k.wartende.get('x')).toBe(2);
  });
  it('Fokus: genau die Stränge und Karten eines Seils', () => {
    const f = fokusMenge(a, 'gesund')!;
    expect([...f.straenge].sort()).toEqual(['karten:gesund', 'projekt:alt']);
    expect(f.karten.has('g1')).toBe(true);
    expect(fokusMenge(a, 'gibt-es-nicht')).toBeNull();
    expect(fokusMenge(a, null)).toBeNull();
  });
  it('deterministisch und mit Vorleser-Text', () => {
    expect(JSON.stringify(seilRechnen(eingang()))).toBe(JSON.stringify(seilRechnen(eingang())));
    expect(a.text).toContain('„Umsatz verdoppeln“: 1 von 6 Strängen fertig');
    expect(seilRechnen({ heute: HEUTE, von: '2026-09-01', bis: '2026-12-31', ziele: [], straenge: [], karten: [] }).text).toBe('Im Zeitraum zahlt noch nichts auf ein Ziel ein.');
  });
});

describe('Geometrie', () => {
  const a = seilRechnen(eingang());
  const lage = seilLage(a, 1000);
  it('x linear im Fenster; Gruppen untereinander, Spuren mit festem Abstand, Seil unter den Spuren', () => {
    expect(seilX('2026-09-01', '2026-09-01', '2026-09-30', 300)).toBeCloseTo(5, 5);
    expect(seilX('2026-09-30', '2026-09-01', '2026-09-30', 300)).toBeCloseTo(295, 5);
    let y = 0;
    for (const g of lage.gruppen) {
      expect(g.y0).toBe(y);
      y += g.hoehe;
      g.spuren.forEach((s, i) => { expect(s.y).toBeCloseTo(g.y0 + SEIL_FORM.kopf + i * SEIL_FORM.spur + SEIL_FORM.spur / 2, 5); expect(s.y).toBeLessThan(g.seilY); });
    }
    expect(lage.hoehe).toBe(y);
    expect(lage.gruppen.map(g => g.seil)).toEqual(['umsatz', 'gesund', 'leer', null]);
  });
  it('Einmündung nie hinter dem Anker; Anker außerhalb des Fensters läuft über den Rand', () => {
    const g = lage.gruppen[0];
    for (const s of g.spuren) expect(s.x1).toBeLessThanOrEqual(g.xAnker + 1e-9);
    const eng = seilLage(seilRechnen({ ...eingang(), bis: '2027-03-31' }), 1000);
    expect(eng.gruppen[0]).toMatchObject({ ankerAusserhalb: 'rechts', xAnker: 1000 + SEIL_FORM.ueberRand });
    expect(lage.gruppen[0].spuren.find(s => s.id === 'ms:launch')!.xBlockiert).toBeDefined();
  });
  it('Faser-Reihenfolge = Einmündung; Seil wächst mit jeder Faser und läuft am Anker zusammen', () => {
    const g = lage.gruppen[0];
    const reihe = [...g.spuren].sort((p, q) => p.faser - q.faser).map(s => s.x1);
    expect([...reihe].sort((p, q) => p - q)).toEqual(reihe);
    expect(fasernBei(g, g.muendungen[0] - 1)).toBe(0);
    expect(fasernBei(g, g.xAnker)).toBe(g.spuren.length);
    expect(seilRadius(4, 6, 0, 1000)).toBeGreaterThan(seilRadius(1, 6, 0, 1000));
    expect(seilRadius(4, 6, 1000, 1000)).toBeCloseTo(seilRadius(4, 6, 0, 1000) * SEIL_FORM.spitze, 5);
    expect(seilRadius(0, 6, 0, 1000)).toBe(0);
    expect(drallLaenge(1)).toBeLessThan(drallLaenge(0)); // straffer mit Momentum
  });
  it('Strang-Weg: vor dem Start nichts, auf der Spur bis zur Einmündung, stetig in seine Faser, nach dem Anker nichts', () => {
    const g = lage.gruppen[0];
    const s = g.spuren.find(x => x.id === 'ms:website')!;
    expect(strangY(g, s, s.x0 - 5)).toBeNull();
    expect(strangY(g, s, s.x0 + 1)).toBe(s.y);
    expect(strangY(g, s, s.x1)).toBeCloseTo(faserBei(g, s.faser, s.fasern, s.x1).y, 5);
    // stetig: keine Sprünge über die Einmündung
    let vor = strangY(g, s, s.x1 - SEIL_FORM.einmuendung)!;
    for (let x = s.x1 - SEIL_FORM.einmuendung + 1; x <= s.x1 + 40; x++) { const y = strangY(g, s, x)!; expect(Math.abs(y - vor)).toBeLessThan(3); vor = y; }
    expect(strangY(g, s, g.xAnker + 2)).toBeNull();
    const ohne = lage.gruppen[3];
    expect(strangY(ohne, ohne.spuren[0], ohne.spuren[0].x1 + 3)).toBeNull();
  });
  it('Fasern liegen im Seil (Radius) und fließen mit der Zeit — bei t = 0 ein Standbild', () => {
    const g = lage.gruppen[0];
    const x = (g.xSeilVon + g.xAnker) / 2;
    for (let f = 0; f < g.spuren.length; f++) expect(Math.abs(faserBei(g, f, g.spuren.length, x).y - g.seilY)).toBeLessThanOrEqual(SEIL_FORM.radius.max + 1e-9);
    expect(faserBei(g, 0, 6, x, 0).y).toBe(faserBei(g, 0, 6, x, 0).y);
    expect(faserBei(g, 0, 6, x, 5000).y).not.toBeCloseTo(faserBei(g, 0, 6, x, 0).y, 3);
  });
  it('Abhängigkeits-Kurve beginnt und endet an den Karten; Handy-Seil hat je Faser einen Linienzug', () => {
    const k = kantenKurve(10, 20, 200, 80);
    expect(bezierPunkt(k, 0)).toEqual({ x: 10, y: 20 });
    expect(bezierPunkt(k, 1)).toEqual({ x: 200, y: 80 });
    const mini = miniSeil([{ fertig: true }, { fertig: false }, { fertig: true }], 120, 0.6);
    expect(mini).toHaveLength(3);
    expect(mini[0].fertig).toBe(false); // offene zuerst (hinten), erledigte vorn
    expect(mini[0].punkte.split(' ').length).toBe(41);
  });
  it('die Maße stehen an EINER Stelle', () => {
    expect(SEIL.vorlaufTage).toBe(42);
    expect(SEIL_FORM.radius.max).toBeLessThanOrEqual(SEIL_FORM.seilZone / 2);
    expect(SEIL_FORM.roehre * 2).toBeLessThan(SEIL_FORM.spur);
  });
});
