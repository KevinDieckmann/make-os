// Kalender-Gesamtprüfung F3 (29.09.): Restfunde — nächster Termin aus EINER Quelle (Bezug, abgesagte nie, maskiert je
// Person), Planen zählt Überlappungen als Vereinigung (dieselbe Regel wie die Zeit-Auswertung), Verbindungsprüfung mit
// Überschrift nach Schwere und Namen statt Kennungen, Slug mit ae/oe/ue/ss. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { termineZu, naechsterTermin } from '../lib/kalender/termine-zu';
import { maskieren, type TerminMitBezug } from '../lib/kalender/bezug';
import { aufbereiten } from '../lib/crm/aktivitaeten';
import { wochenStunden, wochenTage } from '../lib/planung/bloecke';
import { minutenBelegung, wocheAuswerten } from '../lib/kalender/auswertung';
import { beispielNamen, verbindungsUeberschrift } from '../lib/crm/verbindungen-namen';
import { slugVorsatz } from '../lib/kalender/buchung';
import type { Kontakt } from '../lib/make-one/crm';
import type { CrmBestand } from '../lib/crm/typen';

const basis = { href: '', ganztags: false, kalender: 'K', kalenderId: 'k', serie: false, mitTeilnehmern: false, bearbeitbar: true, art: 'termin' as const, beschaeftigt: true, sichtbarkeit: 'standard' as const };
const termin = (id: string, start: string, ende: string, mehr: Partial<TerminMitBezug> = {}): TerminMitBezug => ({ ...basis, id, uid: id, titel: id, start, ende, ...mehr });

describe('F3 · nächster Termin der Kontaktakte — eine Quelle', () => {
  const l = [
    termin('K|abgesagt', '2026-10-01T09:00:00', '2026-10-01T10:00:00', { bezug: { kontaktId: 'c-anna1' }, abgesagt: true, beschaeftigt: false }),
    termin('K|privat-malin', '2026-10-01T11:00:00', '2026-10-01T12:00:00', { bezug: { kontaktId: 'c-anna1' }, sichtbarkeit: 'privat', von: 'malin' }),
    termin('K|kaffee', '2026-10-02T09:00:00', '2026-10-02T10:00:00', { gastKontakte: ['c-anna1'] }),
    termin('K|vorbei', '2026-09-28T09:00:00', '2026-09-28T10:00:00', { bezug: { kontaktId: 'c-anna1' } }),
  ];
  const JETZT = '2026-09-30T10:00:00';

  it('abgesagte stehen in der Liste (markiert), sind aber nie der nächste Termin', () => {
    const r = termineZu(l, { kontakte: ['c-anna1'] }, JETZT);
    expect(r.kommend.map(t => t.id)).toEqual(['K|abgesagt', 'K|privat-malin', 'K|kaffee']);
    expect(r.kommend[0].abgesagt).toBe(true);
    expect(naechsterTermin(r.kommend)?.id).toBe('K|privat-malin');
  });

  it('maskiert je Person: Kevin sieht Malins privaten Termin nicht als nächsten — Malin schon', () => {
    const fuer = (p: string) => naechsterTermin(termineZu(l.map(t => maskieren(t, p)), { kontakte: ['c-anna1'] }, JETZT).kommend);
    expect(fuer('kevin')?.id).toBe('K|kaffee');
    expect(fuer('malin')?.id).toBe('K|privat-malin');
    expect(naechsterTermin([])).toBeNull();
  });

  it('Verlauf: der nächste Termin kommt aus demselben Leser — steht er schon als Meeting (terminUid), nicht doppelt', () => {
    const k = { id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel', aktivitaeten: [{ am: '2026-09-29T08:00:00Z', art: 'termin', von: 'kevin', terminUid: 'K|kaffee' }] } as unknown as Kontakt;
    const zeiten = { 'K|kaffee': { start: '2026-10-02T09:00:00', ende: '2026-10-02T10:00:00' } };
    const mit = aufbereiten(k, null, { heute: '2026-09-30', jetzt: '2026-09-30T08:00:00Z', termin: { id: 'K|kaffee', titel: 'K|kaffee', start: '2026-10-02T09:00:00' }, termine: zeiten });
    expect(mit.filter(e => e.art === 'kalender')).toEqual([]);
    const ohne = aufbereiten({ ...k, aktivitaeten: [] } as Kontakt, null, { heute: '2026-09-30', jetzt: '2026-09-30T08:00:00Z', termin: { id: 'K|anders', titel: 'Kaffee', start: '2026-10-03T09:00:00' } });
    expect(ohne.find(e => e.art === 'kalender')).toMatchObject({ tag: '2026-10-03', zeit: '09:00', text: 'Kaffee', kommend: true, hinweis: 'verknüpft im Kalender' });
  });
});

describe('F3 · Planen zählt Überlappungen als Vereinigung (Regel der Zeit-Auswertung)', () => {
  const tage = wochenTage('2026-10-05');
  it('6 parallele Termine à 1 h = 1 h (vorher 6 h) — je Tag und gesamt', () => {
    const sechs = Array.from({ length: 6 }, (_, i) => termin(`p${i}`, '2026-10-05T09:00:00', '2026-10-05T10:00:00'));
    const s = wochenStunden([...sechs, termin('q', '2026-10-05T09:30:00', '2026-10-05T10:30:00')], tage);
    expect(s).toMatchObject({ terminMin: 90, blockMin: 0, gesamtMin: 90 });
    expect(s.jeTag['2026-10-05']).toBe(90);
  });
  it('Block unter einem Termin: die Minute zählt als Termin (Meeting vor Block), nichts doppelt', () => {
    const s = wochenStunden([
      termin('t', '2026-10-06T10:00:00', '2026-10-06T11:00:00'),
      termin('b', '2026-10-06T10:30:00', '2026-10-06T12:00:00', { art: 'block' }),
    ], tage);
    expect(s).toMatchObject({ terminMin: 60, blockMin: 60, gesamtMin: 120 });
  });
  it('dieselbe Hilfsfunktion wie die Auswertung: höherer Rang gewinnt, gleicher Rang die erste, Rand wird abgeschnitten', () => {
    const b = minutenBelegung<string>(10, q => (q === 'hoch' ? 1 : 0));
    b.legen(-5, 6, 'tief'); b.legen(2, 4, 'hoch'); b.legen(3, 20, 'tief2');
    expect(Array.from({ length: 10 }, (_, i) => b.quelle(i))).toEqual(['tief', 'tief', 'hoch', 'hoch', 'tief', 'tief', 'tief2', 'tief2', 'tief2', 'tief2']);
    expect(b.quelle(10)).toBeNull();
    // Auswertung unverändert: parallele Meetings zählen einmal.
    const w = wocheAuswerten({ termine: [0, 1].map(() => ({ start: '2026-10-05T09:00:00', ende: '2026-10-05T10:00:00', ganztags: false, space: 'business' as const })), bloecke: [], arbeitszeit: { vonStunde: 9, bisStunde: 17 } }, '2026-10-05');
    expect(w.minuten.meetings).toBe(60);
  });
});

describe('F3 · Verbindungsprüfung: Überschrift nach Schwere, Namen statt Kennungen', () => {
  it('nur Hinweise → nicht mehr „Alle Verbindungen sauber“', () => {
    expect(verbindungsUeberschrift([])).toEqual({ schwere: null, text: 'Alle Verbindungen sauber', zahlen: '' });
    expect(verbindungsUeberschrift([{ schwere: 'hinweis' }, { schwere: 'hinweis' }]).text).toBe('Keine Fehler — 2 Hinweise offen');
    expect(verbindungsUeberschrift([{ schwere: 'hinweis' }, { schwere: 'warnung' }])).toMatchObject({ schwere: 'warnung', zahlen: '1 Warnung · 1 Hinweis' });
    expect(verbindungsUeberschrift([{ schwere: 'fehler' }, { schwere: 'hinweis' }])).toMatchObject({ schwere: 'fehler', text: 'Fehler in den Verbindungen', zahlen: '1 Fehler · 1 Hinweis' });
  });
  it('Namen aus den Beständen; tote Kennungen, private Aufgaben und maskierte Termine bleiben Kennung', () => {
    const crm = { firmen: [{ id: 'f-1', name: 'Beispiel GmbH' }], chancen: [{ id: 'ch-1', titel: 'Pilot' }], events: [{ id: 'ev-1', titel: 'Sommerfest' }] } as unknown as CrmBestand;
    const kontakte = [{ id: 'c-anna1', vorname: 'Anna', nachname: 'Beispiel' }] as unknown as Kontakt[];
    const aufgaben = { liste: [{ id: 't-1', title: 'Angebot schreiben', projectId: 'p' }, { id: 't-2', title: 'Arzt', projectId: 'p', space: 'privat' as const }], orte: {}, eigeneEinheiten: [] };
    const befunde = [{ beispiele: ['c-anna1', 'f-1', 'ch-1', 'ev-1', 'c-tot', 't-1', 't-2', 'Kal|U1', 'U1', 'Kal|U2'] }];
    const n = beispielNamen({ kontakte, crm, aufgaben }, befunde, [
      { id: 'Kal|U1', titel: 'Kaffee', start: '2026-10-02T09:00:00' },
      { id: 'belegt-x', titel: 'Belegt', start: '2026-10-02T11:00:00', maskiert: true },
    ]);
    expect(n).toEqual({ 'c-anna1': 'Anna Beispiel', 'f-1': 'Beispiel GmbH', 'ch-1': 'Pilot', 'ev-1': 'Sommerfest', 't-1': 'Angebot schreiben', 'Kal|U1': 'Kaffee · 2.10.', U1: 'Kaffee · 2.10.' });
  });
});

describe('F3 · Buchungslink: Umlaute als ae/oe/ue/ss (nur neue Slugs)', () => {
  it('„Erstgespräch Größe Übung“ → erstgespraech-groesse-uebung', () => {
    expect(slugVorsatz('Erstgespräch Größe Übung')).toBe('erstgespraech-groesse-uebung');
    expect(slugVorsatz('Straße · Café')).toBe('strasse-cafe');
    expect(slugVorsatz('30 min mit Kevin')).toBe('30-min-mit-kevin');
    expect(slugVorsatz('!!!')).toBe('termin');
  });
});
