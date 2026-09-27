import { describe, it, expect } from 'vitest';
import { leadScore, kanalVon, kanalLeistung, temperaturVon, temperaturVerteilung } from '@/lib/crm/score';
import { zuQualifizieren, brauchtQualifizierung, nichtKalt, leads, leereKriterien, type LeadZeile } from '@/lib/crm/leads';
import { imSegment, kontextAus } from '@/lib/crm/segmente';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Kriterien } from '@/lib/crm/typen';

const HEUTE = '2026-09-27';
const person = (o: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-1', vorname: 'Test', nachname: 'Person', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], ...o } as Kontakt);
const alleJa: Kriterien = { schmerz: 'ja', entscheider: 'ja', budget: 'ja', zeitpunkt: 'ja', wirkung: 'ja', alternative: 'ja' };

describe('Lead-Score — vier Teile, keine Blackbox', () => {
  it('ohne alles: nur Fit offen (8) → kalt', () => {
    const s = leadScore([person()], undefined, HEUTE);
    expect(s.punkte).toBe(8);
    expect(s.temperatur).toBe('kalt');
    expect(s.teile.map(t => t.id)).toEqual(['fit', 'waerme', 'qualifizierung', 'erreichbarkeit']);
  });
  it('Vollbild: Fit ja, Gespräch gestern, alle Kernfragen, alle Wege → 100 heiß', () => {
    const k = person({ eignung: 'ja', email: 'a@example.invalid', telefon: '1', linkedin: 'x', aktivitaeten: [{ am: '2026-09-26T10:00:00Z', art: 'gespraech', von: 'kevin' }] });
    const s = leadScore([k], { status: 'qualifizierung', kriterien: alleJa }, HEUTE);
    expect(s.punkte).toBe(100);
    expect(s.temperatur).toBe('heiss');
  });
  it('Schmerz „nein“ deckelt die Qualifizierung auf 10', () => {
    const s = leadScore([person()], { status: 'qualifizierung', kriterien: { ...alleJa, schmerz: 'nein' } }, HEUTE);
    expect(s.teile.find(t => t.id === 'qualifizierung')!.punkte).toBe(10);
  });
  it('Fit am Lead schlägt die Eignung aus der Liste', () => {
    const s = leadScore([person({ eignung: 'ja' })], { status: 'neu', kriterien: leereKriterien(), fit: 'nein' }, HEUTE);
    expect(s.teile.find(t => t.id === 'fit')!.punkte).toBe(0);
  });
  it('Wärme fällt mit der Zeit: 30 → 20 → 12 → Antwort 12 → angesprochen 8', () => {
    const g = (am: string) => leadScore([person({ aktivitaeten: [{ am, art: 'gespraech', von: 'kevin' }] })], undefined, HEUTE).teile[1].punkte;
    expect(g('2026-09-20')).toBe(30);
    expect(g('2026-07-20')).toBe(20);
    expect(g('2026-01-20')).toBe(12);
    expect(leadScore([person({ aktivitaeten: [{ am: '2026-09-01', art: 'antwort', von: 'kevin' }] })], undefined, HEUTE).teile[1].punkte).toBe(12);
    expect(leadScore([person({ aktivitaeten: [{ am: '2026-09-01', art: 'mail', von: 'kevin' }] })], undefined, HEUTE).teile[1].punkte).toBe(8);
    expect(leadScore([person({ aktivitaeten: [{ am: '2026-09-01', art: 'system', von: 'system' }] })], undefined, HEUTE).teile[1].punkte).toBe(0);
  });
  it('Temperatur-Schwellen 25 / 50 / 75', () => {
    expect(temperaturVon(24)).toBe('kalt'); expect(temperaturVon(25)).toBe('lau'); expect(temperaturVon(50)).toBe('warm'); expect(temperaturVon(75)).toBe('heiss');
  });
});

describe('Herkunftskanal', () => {
  it('gepflegte Herkunft zuerst, sonst die Quelle aus der Liste', () => {
    expect(kanalVon({ herkunft: 'empfehlung', quelle: 'HubSpot-Export' })).toBe('empfehlung');
    expect(kanalVon({ herkunft: 'veranstaltung' })).toBe('event');
    expect(kanalVon({ quelle: 'HubSpot-Export 27.08.2026 + Malin HubSpot-Import' })).toBe('bestand');
    expect(kanalVon({ quelle: 'Apple' })).toBe('netzwerk');
    expect(kanalVon({ quelle: 'Leadliste Berlin' })).toBe('outreach');
    expect(kanalVon({})).toBe('unbekannt');
  });
  it('Kanal-Leistung zählt warm+ und SQL je Kanal, sortiert nach SQL', () => {
    const s = (p: number) => ({ punkte: p, temperatur: temperaturVon(p), teile: [] });
    const z = kanalLeistung([
      { kanal: 'event', score: s(60), status: 'sql' }, { kanal: 'event', score: s(10), status: 'neu' },
      { kanal: 'bestand', score: s(80), status: 'kunde' }, { kanal: 'bestand', score: s(80), status: 'qualifizierung' }, { kanal: 'bestand', score: s(5), status: 'neu' },
    ]);
    expect(z[0].kanal).toBe('bestand');
    expect(z[0]).toMatchObject({ anzahl: 3, warm: 2, sql: 1, warmQuote: 67, sqlQuote: 33 });
    expect(z[1]).toMatchObject({ kanal: 'event', anzahl: 2, warm: 1, sql: 1 });
    expect(temperaturVerteilung([{ score: s(10) }, { score: s(60) }])).toEqual({ kalt: 1, lau: 0, warm: 1, heiss: 0 });
  });
});

const crmLeer = (): CrmBestand => ({ firmen: [], chancen: [], mandate: [], leistungen: [], events: [], teilnahmen: [], sitzungen: [], antraege: [], verarbeitungen: [], segmente: [], beitraege: [], newsletter: [], kampagnen: [] } as unknown as CrmBestand);

describe('Qualifizierungsrunde — wer ist dran', () => {
  const zeile = (o: Partial<LeadZeile>): LeadZeile => ({
    id: 'c-x', art: 'person', name: 'X', personen: [], status: 'neu', gesetzt: false, kriterien: leereKriterien(), besitzer: 'malin', ohneBesitzer: false,
    score: { punkte: 40, temperatur: 'lau', teile: [] }, kanal: 'bestand', ...o,
  });
  it('offene Kernfragen oder alte Prüfung → dran; SQL/Kunde/offener Deal → nicht', () => {
    expect(brauchtQualifizierung(zeile({}), HEUTE)).toBe(true);
    expect(brauchtQualifizierung(zeile({ kriterien: alleJa, qualifiziertAm: '2026-09-01' }), HEUTE)).toBe(false);
    expect(brauchtQualifizierung(zeile({ kriterien: alleJa, qualifiziertAm: '2026-06-01' }), HEUTE)).toBe(true);
    expect(brauchtQualifizierung(zeile({ status: 'sql' }), HEUTE)).toBe(false);
    expect(brauchtQualifizierung(zeile({ deal: { id: 'ch-1', titel: 'D', stufe: 'bedarf', wert: 0, offen: true } }), HEUTE)).toBe(false);
  });
  it('eigene zuerst, „beide“ zählt mit, ohne Besitzer nur auf Wunsch, kalte nur mit Schalter, warm vor lau', () => {
    const l = [
      zeile({ id: 'a', besitzer: 'malin', score: { punkte: 40, temperatur: 'lau', teile: [] } }),
      zeile({ id: 'b', besitzer: 'kevin' }),
      zeile({ id: 'c', besitzer: 'beide', score: { punkte: 70, temperatur: 'warm', teile: [] } }),
      zeile({ id: 'd', besitzer: 'kevin', ohneBesitzer: true }),
      zeile({ id: 'e', besitzer: 'malin', score: { punkte: 10, temperatur: 'kalt', teile: [] } }),
    ];
    expect(zuQualifizieren(l, { wer: 'malin', heute: HEUTE }).map(z => z.id)).toEqual(['c', 'a']);
    expect(zuQualifizieren(l, { wer: 'malin', heute: HEUTE, auchKalt: true }).map(z => z.id)).toEqual(['c', 'a', 'e']);
    expect(zuQualifizieren(l, { wer: 'ohne', heute: HEUTE }).map(z => z.id)).toEqual(['d']);
    expect(zuQualifizieren(l, { wer: 'alle', heute: HEUTE }).length).toBe(4);
    expect(zuQualifizieren(l, { wer: 'alle', heute: HEUTE, kanal: 'event' })).toEqual([]);
  });
  it('kalte Leads verschwinden aus der Leads-Liste — außer SQL, Kunde oder mit Deal', () => {
    expect(nichtKalt(zeile({ score: { punkte: 10, temperatur: 'kalt', teile: [] } }))).toBe(false);
    expect(nichtKalt(zeile({ score: { punkte: 10, temperatur: 'kalt', teile: [] }, status: 'sql' }))).toBe(true);
    expect(nichtKalt(zeile({}))).toBe(true);
  });
  it('leads() liefert Score, Kanal und ohneBesitzer je Zeile', () => {
    const k = person({ id: 'c-1', besitzer: undefined, quelle: 'Apple', eignung: 'ja' });
    const z = leads([k], crmLeer(), HEUTE);
    expect(z[0].score.punkte).toBe(40);
    expect(z[0].kanal).toBe('netzwerk');
    expect(z[0].ohneBesitzer).toBe(true);
  });
});

describe('Segment nach Temperatur', () => {
  it('„Vernetzen“ trifft nur kalte', () => {
    const ctx = kontextAus(crmLeer(), HEUTE);
    expect(imSegment(person(), { temperatur: ['kalt'] }, ctx)).toBe(true);
    expect(imSegment(person({ eignung: 'ja', email: 'a@example.invalid' }), { temperatur: ['kalt'] }, ctx)).toBe(false);
  });
});
