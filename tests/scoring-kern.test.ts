// ─── Qualifizierung & Scoring — der Rechenkern (03.10.): Stufen, Schwellen, Muss, Deckel, Gewicht, Prüfung ─────
import { describe, it, expect } from 'vitest';
import {
  bisherigeRechnung, standardScoring, scoringRechnen, scoringPruefen, scoringSaeubern, scoringOderStandard, temperaturAus, altWertAusStufe, gespraechsFragen,
  MESSUNGEN, MESSUNG_IDS, SCORING_GRENZEN, type ScoringEinstellungen,
} from '@/lib/crm/scoring';
import { leadScore } from '@/lib/crm/score';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Event, Teilnahme } from '@/lib/crm/typen';

const HEUTE = '2026-10-03';
const p = (o: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-1', vorname: 'Test', nachname: 'Person', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], ...o } as Kontakt);
const kopie = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const sales = (e: ScoringEinstellungen, personen: Kontakt[] = [p()], stufen: Record<string, string> = {}, extra: object = {}) =>
  scoringRechnen(personen, { stufen, ...extra }, HEUTE, { einstellungen: e }).sales;

describe('Vorschlag — Stufen 1 · 3 · 5, Gewicht, Muss, Schwelle', () => {
  const v = standardScoring();
  it('ist gültig, hat die Blöcke Fit · Qualifikation · Potenzial und eine Mindestpunktzahl', () => {
    expect(scoringPruefen(v)).toEqual([]);
    expect(v.sales.teile.map(t => t.id)).toEqual(['fit', 'qualifikation', 'potenzial']);
    expect(v.sales.schwelle).toBe(28);
    expect(sales(v).max).toBe(70);
    // Stufen sind 0 · 1 · 3 · 5 (Fit-Stufen ausgenommen: dort 0 · 1 · 3 · 5 ebenfalls)
    for (const t of v.sales.teile) for (const k of t.kriterien) expect(k.stufen.map(s => s.punkte).sort()).toEqual([0, 1, 3, 5]);
  });
  it('Gewicht verdoppelt: Schmerz Stufe 5 zählt 10 von 10', () => {
    const r = sales(v, [p()], { schmerz: 's5' });
    const k = r.teile.flatMap(t => t.kriterien).find(x => x.id === 'schmerz')!;
    expect(k).toMatchObject({ punkte: 10, max: 10, stufePunkte: 5, herkunft: 'lead' });
  });
  it('Muss-Kriterien: ohne Schmerz und Entscheider hilft keine Punktzahl — auch bei Punkten über der Schwelle', () => {
    const viele = { groesse: 's5', passung: 's5', fit: 'ja', champion: 's5', prozess: 's5', wirkung: 's5', alternative: 's5', folge: 's5', budget: 's5', zeitpunkt: 's5' };
    const r = sales(v, [p()], viele);
    expect(r.punkte).toBeGreaterThanOrEqual(v.sales.schwelle);
    expect(r.erreicht).toBe(false);
    expect(r.fehlt).toEqual(['Schmerz', 'Entscheider']);
    const ok = sales(v, [p()], { ...viele, schmerz: 's3', entscheider: 's3' });
    expect(ok.erreicht).toBe(true);
    expect(ok.fehlt).toEqual([]);
  });
  it('„Budget oder Zeitpunkt“: eins von beiden genügt, eine zu niedrige Stufe nicht', () => {
    const basis = { schmerz: 's5', entscheider: 's5', groesse: 's5', passung: 's5', fit: 'ja' };
    expect(sales(v, [p()], { ...basis, zeitpunkt: 's3' }).erreicht).toBe(true);
    expect(sales(v, [p()], { ...basis, budget: 's1' }).fehlt).toContain('Budget oder Zeitpunkt');
    expect(sales(v, [p()], { ...basis, budget: 's1', zeitpunkt: 's1' }).erreicht).toBe(false);
  });
  it('Punkte unter der Schwelle: „fehlt“ nennt erst Muss, dann die Punkte', () => {
    const r = sales(v, [p()], { schmerz: 's3', entscheider: 's3', budget: 's3' });
    expect(r.muss.every(m => m.ok)).toBe(true);
    expect(r.punkte).toBe(6 + 6 + 3 + 1); // Schmerz 3×2, Entscheider 3×2, Budget 3, Fit offen (1)
    expect(r.erreicht).toBe(false);
    expect(r.fehlt).toEqual([`Punkte (16 von mindestens 28)`]);
  });
  it('die alte Antwort (ja/nein) zählt weiter: ja = beste Stufe, nein = 0', () => {
    const r = scoringRechnen([p()], { kriterien: { schmerz: 'ja', entscheider: 'nein', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } }, HEUTE, { einstellungen: v }).sales;
    const k = (id: string) => r.teile.flatMap(t => t.kriterien).find(x => x.id === id)!;
    expect(k('schmerz')).toMatchObject({ punkte: 10, herkunft: 'alt' });
    expect(k('entscheider')).toMatchObject({ punkte: 0, herkunft: 'alt' });
    expect(k('budget')).toMatchObject({ punkte: 0, offen: true, herkunft: 'ohne' });
  });
  it('eine gewählte Stufe schlägt die alte Antwort', () => {
    const r = scoringRechnen([p()], { stufen: { schmerz: 's1' }, kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } }, HEUTE, { einstellungen: v }).sales;
    expect(r.teile.flatMap(t => t.kriterien).find(x => x.id === 'schmerz')).toMatchObject({ punkte: 2, herkunft: 'lead' });
  });
  it('Fit ohne Antwort kommt aus der Liste (Eignung) und bleibt „offen“ für die Runde', () => {
    const r = sales(v, [p({ eignung: 'ja' })]);
    expect(r.teile.flatMap(t => t.kriterien).find(x => x.id === 'fit')).toMatchObject({ punkte: 5, herkunft: 'messung', offen: true });
  });
  it('Gespräch: die Fragen kommen aus den Einstellungen, in der Reihenfolge der Blöcke', () => {
    const f = gespraechsFragen(v).map(x => x.kriterium.id);
    expect(f).toEqual(['fit', 'groesse', 'passung', 'schmerz', 'entscheider', 'budget', 'zeitpunkt', 'champion', 'prozess', 'wirkung', 'alternative', 'folge']);
    expect(gespraechsFragen(bisherigeRechnung()).map(x => x.kriterium.id)).toEqual(['fit', 'schmerz', 'entscheider', 'budget', 'zeitpunkt', 'wirkung', 'alternative']);
  });
});

describe('Deckel, Schwellen, Temperatur, Gesamtwert', () => {
  it('Deckel der Stufe: „kein Schmerz“ kappt den Block (Standard: Qualifizierung auf 10)', () => {
    const e = bisherigeRechnung();
    const r = scoringRechnen([p()], { kriterien: { schmerz: 'nein', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' } }, HEUTE, { einstellungen: e }).sales;
    const q = r.teile.find(t => t.id === 'qualifizierung')!;
    expect(q.punkte).toBe(10);
    expect(q.gedeckeltAuf).toBe(10);
    expect(q.grund).toContain('deckelt');
  });
  it('Schwelle und „erreicht“: Marketing der bisherigen Rechnung ab 35 Punkten (für einen Marketing-Lead)', () => {
    const e = bisherigeRechnung();
    const m = (aktivitaeten: Kontakt['aktivitaeten']) => scoringRechnen([p({ aktivitaeten, quelle: 'Website-Anfrage' })], undefined, HEUTE, { einstellungen: e }).marketing;
    expect(m([{ am: '2026-09-20T10:00:00Z', art: 'gespraech', von: 'kevin' }])).toMatchObject({ punkte: 30, erreicht: false });
    expect(scoringRechnen([p({ quelle: 'Website-Anfrage', email: 'a@example.invalid', telefon: '1', aktivitaeten: [{ am: '2026-09-20T10:00:00Z', art: 'gespraech', von: 'kevin' }] })], undefined, HEUTE, { einstellungen: e }).marketing).toMatchObject({ punkte: 37, erreicht: true });
    expect(m([{ am: '2026-09-20T10:00:00Z', art: 'mail', von: 'kevin' }])).toMatchObject({ punkte: 8, erreicht: false });
  });
  it('Gesamtwert = Anteil an der möglichen Summe, nicht die Summe selbst (Vorschlag: 53 + 70 = 123 möglich)', () => {
    const v = standardScoring();
    const r = scoringRechnen([p({ eignung: 'ja' })], { stufen: { schmerz: 's5', entscheider: 's5' } }, HEUTE, { einstellungen: v });
    expect(r.gesamt).toBe(Math.round((100 * (r.marketing.punkte + r.sales.punkte)) / (r.marketing.max + r.sales.max)));
    expect(r.marketing.max + r.sales.max).toBe(123);
  });
  it('Temperatur-Stufen sind einstellbar', () => {
    expect(temperaturAus(40)).toBe('lau');
    expect(temperaturAus(40, { lau: 10, warm: 30, heiss: 60 })).toBe('warm');
    const e = { ...bisherigeRechnung(), temperaturAb: { lau: 5, warm: 10, heiss: 15 } };
    expect(leadScore([p({ eignung: 'ja' })], undefined, HEUTE, undefined, { einstellungen: e }).temperatur).toBe('heiss');
  });
  it('ein Kriterium auf „aus“ zählt weder Punkte noch Maximum', () => {
    const e = kopie(bisherigeRechnung());
    e.sales.teile[1].kriterien.find(k => k.id === 'wirkung')!.aus = true;
    const r = sales(e);
    expect(r.teile.find(t => t.id === 'qualifizierung')!.max).toBe(25);
    expect(scoringPruefen(e)).toEqual([]);
  });
});

describe('Signale (Marketing) aus den Daten', () => {
  const v = standardScoring();
  const sig = (personen: Kontakt[], ctx: { teilnahmen?: Teilnahme[]; events?: Event[] } = {}) =>
    scoringRechnen(personen, undefined, HEUTE, { einstellungen: v, ...ctx }).marketing.teile.flatMap(t => t.kriterien);
  const ev = (id: string, marke?: string): Event => ({ id, titel: id, format: 'abend', ziel: '', datum: '2026-09-01', status: 'durchgefuehrt', ...(marke ? { marke } : {}), geaendert: '2026-09-01' } as unknown as Event);
  const tn = (eventId: string, kontaktId = 'c-1', status: Teilnahme['status'] = 'da'): Teilnahme => ({ id: `t-${eventId}-${kontaktId}`, eventId, kontaktId, status, geaendert: '2026-09-01' });
  it('Event besucht (Netzwerken) und Make.One-Gast werden getrennt gezählt — nur mit „da“', () => {
    const k = sig([p()], { events: [ev('e1', 'Netzwerken'), ev('e2', 'Netzwerken'), ev('m1'), ev('m2')], teilnahmen: [tn('e1'), tn('e2'), tn('m1'), tn('m2', 'c-1', 'no_show')] });
    expect(k.find(x => x.id === 'event')).toMatchObject({ stufeId: 'zwei', punkte: 3 });
    expect(k.find(x => x.id === 'makeone')).toMatchObject({ stufeId: 'eins', punkte: 3 });
  });
  it('Newsletter zählt voll nur mit vollständig nachgewiesenem Double-Opt-in', () => {
    const voll = { kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'DOI', zeitpunkt: '2026-09-01T10:00:00Z', erfasstVon: 'kevin', wortlaut: 'Ja, ich möchte den Newsletter.', wortlautVersion: 'v1', belegRef: 'formular' } as never;
    const duenn = { kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'angemeldet' } as never;
    expect(sig([p({ einwilligungen: [voll] })]).find(x => x.id === 'newsletter')).toMatchObject({ stufeId: 'doi', punkte: 3 });
    expect(sig([p({ einwilligungen: [duenn] })]).find(x => x.id === 'newsletter')).toMatchObject({ stufeId: 'offen', punkte: 1 });
    expect(sig([p({ einwilligungen: [{ ...(voll as object), widerrufenAm: '2026-09-02' } as never] })]).find(x => x.id === 'newsletter')).toMatchObject({ stufeId: 'keine', punkte: 0 });
  });
  it('Antwort, Termin, Empfehlung, Website-Anfrage und Erreichbarkeit', () => {
    const k = sig([p({ herkunft: 'empfehlung', email: 'a@example.invalid', telefon: '1', aktivitaeten: [
      { am: '2026-09-25T10:00:00Z', art: 'antwort', von: 'kevin' }, { am: '2026-09-28T10:00:00Z', art: 'termin', von: 'kevin' },
      { am: '2026-09-29T10:00:00Z', art: 'antwort', von: 'system', text: 'Anfrage über die Buchungsseite' },
    ] })]);
    expect(k.find(x => x.id === 'antwort')).toMatchObject({ stufeId: 't30', punkte: 10 });
    expect(k.find(x => x.id === 'termin')).toMatchObject({ stufeId: 't30', punkte: 5 });
    expect(k.find(x => x.id === 'empfehlung')).toMatchObject({ stufeId: 'empfehlung', punkte: 5 });
    expect(k.find(x => x.id === 'anfrage')).toMatchObject({ stufeId: 'ja', punkte: 5 });
    expect(k.find(x => x.id === 'erreichbar')).toMatchObject({ stufeId: 'zwei', punkte: 3 });
  });
  it('jede Messung liefert nur Stufen, die ihr Katalog kennt', () => {
    for (const id of MESSUNG_IDS) {
      const m = MESSUNGEN[id].messen([p()], { heute: HEUTE, teilnahmen: [], events: [] });
      expect(MESSUNGEN[id].stufen.map(s => s.id), id).toContain(m.stufe);
    }
  });
});

describe('Prüfen und säubern — nichts wird still gekürzt', () => {
  it('Standard und Vorschlag sind gültig und überstehen das Säubern unverändert (idempotent)', () => {
    for (const e of [bisherigeRechnung(), standardScoring()]) {
      expect(scoringPruefen(e)).toEqual([]);
      const s = scoringSaeubern(e)!;
      expect(scoringSaeubern(s)).toEqual(s);
      expect(scoringRechnen([p({ eignung: 'ja' })], { stufen: {} }, HEUTE, { einstellungen: s }).gesamt).toBe(scoringRechnen([p({ eignung: 'ja' })], { stufen: {} }, HEUTE, { einstellungen: e }).gesamt);
    }
  });
  it('nennt jeden Fehler mit Pfad: doppelte Kennung, Punkte außerhalb, unbekannte Messung, Muss ins Leere, Temperatur', () => {
    const e = kopie(standardScoring());
    e.sales.teile[1].kriterien[1].id = e.sales.teile[1].kriterien[0].id; // doppelt
    e.sales.teile[0].kriterien[1].stufen[0].punkte = 500;
    e.marketing.teile[0].kriterien[0].messung = 'gibtesnicht' as never;
    e.sales.muss.push({ kriterien: ['unbekannt'], mindestens: 1, stufePunkte: 3 });
    e.temperaturAb = { lau: 50, warm: 40, heiss: 30 };
    const f = scoringPruefen(e);
    const pfade = f.map(x => x.pfad).join(' | ');
    expect(pfade).toContain('sales.teile[1].kriterien[1].id');
    expect(pfade).toContain('sales.teile[0].kriterien[1].stufen[0].punkte');
    expect(pfade).toContain('marketing.teile[0].kriterien[0].messung');
    expect(pfade).toContain('sales.muss[3]');
    expect(pfade).toContain('temperaturAb');
    expect(scoringSaeubern(e)).toBeNull();
  });
  it('Marketing-Kriterien sind Messungen, Sales-Kriterien Fragen — nicht vertauschbar; Messungs-Stufen nur aus dem Katalog', () => {
    const e = kopie(bisherigeRechnung());
    e.sales.teile[1].kriterien[0] = { ...e.marketing.teile[1].kriterien[0] };
    expect(scoringPruefen(e).some(x => /beantwortet|gemessen/.test(x.text))).toBe(true);
    const e2 = kopie(bisherigeRechnung());
    e2.marketing.teile[1].kriterien[0].stufen.push({ id: 'erfunden', text: 'x', punkte: 1 });
    expect(scoringPruefen(e2).some(x => x.pfad.endsWith('.id') && /kennt keine Stufe/.test(x.text))).toBe(true);
  });
  it('Grenzen lehnen ab (413), statt zu kürzen: zu viele Kriterien, Stufen, Blöcke', () => {
    const e = kopie(standardScoring());
    const viele = Array.from({ length: SCORING_GRENZEN.kriterienJeSeite + 1 }, (_, i) => ({ ...kopie(e.sales.teile[2].kriterien[0]), id: `extra${i}` }));
    e.sales.teile[2].kriterien = viele;
    expect(scoringPruefen(e).some(x => x.status === 413)).toBe(true);
    const e2 = kopie(standardScoring());
    e2.sales.teile[2].kriterien[0].stufen = Array.from({ length: SCORING_GRENZEN.stufenJeKriterium + 1 }, (_, i) => ({ id: `s${i}`, text: 'x', punkte: i }));
    expect(scoringPruefen(e2).some(x => x.status === 413)).toBe(true);
  });
  it('beschädigt gespeichert → Standard (nie ein Absturz beim Rechnen)', () => {
    expect(scoringOderStandard({ marketing: 'kaputt' })).toEqual(standardScoring());
    expect(scoringOderStandard(null)).toEqual(standardScoring());
  });
  it('eigene Frage hinzufügen, umbenennen, Stufen ändern, entfernen — gerechnet wird sofort danach', () => {
    const e = kopie(bisherigeRechnung());
    e.sales.teile[1].kriterien.push({ id: 'referenz', name: 'Referenzkunde', hinweis: 'Würde er uns weiterempfehlen?', quelle: 'frage', stufen: [{ id: 'ja', text: 'ja', punkte: 4 }, { id: 'nein', text: 'nein', punkte: 0 }] });
    e.sales.teile[1].kriterien.find(k => k.id === 'wirkung')!.name = 'Ziel in sechs Monaten';
    expect(scoringPruefen(e)).toEqual([]);
    const r = sales(e, [p()], { referenz: 'ja' });
    expect(r.teile.find(t => t.id === 'qualifizierung')!.kriterien.find(k => k.id === 'referenz')).toMatchObject({ punkte: 4, max: 4 });
    expect(r.teile.find(t => t.id === 'qualifizierung')!.max).toBe(34);
    e.sales.teile[1].kriterien = e.sales.teile[1].kriterien.filter(k => k.id !== 'referenz');
    e.sales.muss = e.sales.muss.filter(m => !m.kriterien.includes('referenz'));
    expect(scoringPruefen(e)).toEqual([]);
  });
});

describe('Spiegelung an die alten Felder', () => {
  it('beste Stufe = ja, ab 60 % = ja, darunter unklar, 0 = nein, keine = unklar', () => {
    const k = standardScoring().sales.teile[1].kriterien[0]; // Schmerz 5/3/1/0
    expect(altWertAusStufe(k, 's5')).toBe('ja');
    expect(altWertAusStufe(k, 's3')).toBe('ja');
    expect(altWertAusStufe(k, 's1')).toBe('unklar');
    expect(altWertAusStufe(k, 's0')).toBe('nein');
    expect(altWertAusStufe(k, null)).toBe('unklar');
    const s = bisherigeRechnung().sales.teile[1].kriterien[0];
    expect(altWertAusStufe(s, 'ja')).toBe('ja');
    expect(altWertAusStufe(s, 'nein')).toBe('nein');
  });
});
