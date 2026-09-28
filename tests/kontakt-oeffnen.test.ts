// ─── Kontakt öffnen (28.09., Paket H1): Adresse, Zusammenfassung, Lifecycle ──
// Alle Daten erfunden (@example.invalid).
import { describe, it, expect } from 'vitest';
import { ausZeile, importieren, zusammenfuehren, saeubereKontakt, type Kontakt, type Aktivitaet } from '../lib/make-one/crm';
import type { Chance, CrmBestand, Firma, Mandat, Lead } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { markttraktion, kontaktAkte, akteReiter, akteUnter } from '../lib/crm/adresse';
import { lifecycleAusListe, istLifecycle, LIFECYCLE_PHASEN, LIFECYCLE_WAHL } from '../lib/crm/lifecycle';
import { lifecycleVorschlag, lifecycleVon, lifecycleVerteilung } from '../lib/crm/vorschlaege';
import { zusammenfassung, zusammenfassungText, kontaktPaket, nummer } from '../lib/crm/zusammenfassung';
import { ankerListe } from '../lib/crm/aktivitaeten';
import { kontextAus, imSegment } from '../lib/crm/segmente';
import { kriterienSauber, kriterienText } from '../lib/crm/marketing';
import { exportCsv, EXPORT_SPALTEN } from '../lib/crm/export';

const HEUTE = '2026-09-28';
const J = '2026-09-01T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ...x } as Mandat);
const lead = (status: Lead['status']): Lead => ({ status, kriterien: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' } });
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
const akt = (am: string, art: Aktivitaet['art'], x: Partial<Aktivitaet> = {}): Aktivitaet => ({ am, art, von: 'kevin', ...x });

describe('Adresse von „Kontakt öffnen“', () => {
  it('neue Reiter und Unter-Reiter der Aktivitäten', () => {
    expect(kontaktAkte('c-a', 'aktivitaeten', 'notizen')).toBe('/os/markttraktion?s=kontakte&a=akte&k=c-a&t=aktivitaeten&u=notizen');
    expect(kontaktAkte('c-a', 'umsatz')).toBe('/os/markttraktion?s=kontakte&a=akte&k=c-a&t=umsatz');
    // u nur im Reiter Aktivitäten und nur als kurzes Kennwort.
    expect(kontaktAkte('c-a', 'daten', 'notizen')).toBe('/os/markttraktion?s=kontakte&a=akte&k=c-a&t=daten');
    expect(kontaktAkte('c-a', 'aktivitaeten', '<script>')).toBe('/os/markttraktion?s=kontakte&a=akte&k=c-a&t=aktivitaeten');
    expect(markttraktion('kontakte', undefined, 'c-a', 'aktivitaeten', 'alle')).toBe('/os/markttraktion?s=kontakte&k=c-a');
    expect(akteUnter('alle')).toBe('alle');
    expect(akteUnter('')).toBeNull();
    expect(akteUnter('../x')).toBeNull();
  });
  it('alte Reiter vom 27.09. werden übersetzt', () => {
    expect(akteReiter('ueberblick')).toBe('ueber');
    expect(akteReiter('verlauf')).toBe('aktivitaeten');
    expect(['stammdaten', 'beziehung', 'datenschutz'].map(akteReiter)).toEqual(['daten', 'daten', 'daten']);
  });
});

describe('Lifecycle — Typ, Liste, Import', () => {
  it('sieben Phasen, Kurzform im Chip, voller Name als Hinweis', () => {
    expect(LIFECYCLE_PHASEN).toEqual(['lead', 'mql', 'sql', 'opportunity', 'angebot', 'kunde', 'follow_up']);
    expect(LIFECYCLE_WAHL.find(x => x.id === 'mql')).toEqual({ id: 'mql', label: 'MQL', hinweis: 'Marketing Qualified Lead' });
    expect(LIFECYCLE_WAHL.find(x => x.id === 'kunde')).toEqual({ id: 'kunde', label: 'Kunde' });
    expect(istLifecycle('sql')).toBe(true);
    expect(istLifecycle('customer')).toBe(false);
  });
  it('HubSpot-Werte der Spalte LIFECYCLE → Phase, alles andere → nichts', () => {
    expect(lifecycleAusListe('lead')).toBe('lead');
    expect(lifecycleAusListe('marketingqualifiedlead')).toBe('mql');
    expect(lifecycleAusListe('Sales Qualified Lead')).toBe('sql');
    expect(lifecycleAusListe('opportunity')).toBe('opportunity');
    expect(lifecycleAusListe('customer')).toBe('kunde');
    expect(lifecycleAusListe('subscriber')).toBeUndefined();
    expect(lifecycleAusListe('evangelist')).toBeUndefined();
    expect(lifecycleAusListe('')).toBeUndefined();
    expect(lifecycleAusListe(undefined)).toBeUndefined();
  });
  const zeile = (extra: Record<string, string> = {}) => ({ VORNAME: 'Testa', NACHNAME: 'Beispiel', FIRMA: 'Testfirma-L GmbH', EMAIL: 'testa@example.invalid', ...extra });
  it('Import belegt die Phase nur vor — ausZeile setzt sie, der Rohwert bleibt', () => {
    const n = ausZeile(zeile({ LIFECYCLE: 'customer' }), HEUTE);
    expect(n.phase).toBe('kunde');
    expect(n.lifecycle).toBe('customer');
    expect(ausZeile(zeile({ LIFECYCLE: 'other' }), HEUTE).phase).toBeUndefined();
  });
  it('zusammenführen füllt eine leere Phase und überschreibt eine gesetzte nie', () => {
    const leer = ausZeile(zeile(), HEUTE);
    expect(leer.phase).toBeUndefined();
    const r1 = zusammenfuehren(leer, ausZeile(zeile({ LIFECYCLE: 'opportunity' }), '2026-10-01'), '2026-10-01');
    expect(r1.kontakt.phase).toBe('opportunity');
    const gesetzt: Kontakt = { ...leer, phase: 'angebot' };
    const r2 = zusammenfuehren(gesetzt, ausZeile(zeile({ LIFECYCLE: 'lead' }), '2026-10-01'), '2026-10-01');
    expect(r2.kontakt.phase).toBe('angebot');
    expect(r2.konflikte.some(x => x.feld === 'phase')).toBe(false);
    // Auch über importieren: bestehende Person mit gesetzter Phase bleibt, wie sie ist.
    const imp = importieren([gesetzt], [zeile({ LIFECYCLE: 'customer' })], '2026-10-01');
    expect(imp.kontakte.find(x => x.id === gesetzt.id)?.phase).toBe('angebot');
  });
  it('Säuberung behält gültige Phasen und verwirft unbekannte', () => {
    expect(saeubereKontakt({ ...k('abcd'), phase: 'follow_up' })?.phase).toBe('follow_up');
    expect(saeubereKontakt({ ...k('abcd'), phase: 'customer' })?.phase).toBeUndefined();
    expect(saeubereKontakt({ ...k('abcd'), phase: 7 })?.phase).toBeUndefined();
  });
});

describe('Lifecycle-Vorschlag — alle Zweige, in dieser Reihenfolge', () => {
  it('aktives Mandat → Kunde (vor allem anderen)', () => {
    const b = bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'] })], chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'angebot' })] });
    expect(lifecycleVorschlag(k('a'), b, HEUTE)).toMatchObject({ id: 'kunde' });
  });
  it('beendetes Mandat oder gewonnener Deal ohne aktives Mandat → Follow Up', () => {
    expect(lifecycleVorschlag(k('a'), bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'], status: 'beendet' })] }), HEUTE).id).toBe('follow_up');
    expect(lifecycleVorschlag(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'gewonnen' })] }), HEUTE)).toMatchObject({ id: 'follow_up', grund: expect.stringContaining('gewonnen') });
  });
  it('offener Deal in Angebot oder Abschluss → Angebot; sonst offener Deal → Opportunity', () => {
    expect(lifecycleVorschlag(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'abschluss' })] }), HEUTE).id).toBe('angebot');
    expect(lifecycleVorschlag(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'angebot' })] }), HEUTE).grund).toContain('Angebot');
    expect(lifecycleVorschlag(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'bedarf' })] }), HEUTE).id).toBe('opportunity');
    // Verlorene und fremde Deals zählen nicht.
    expect(lifecycleVorschlag(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'verloren' }), deal('d2', { kontaktIds: ['c-b'], stufe: 'bedarf' })] }), HEUTE).id).toBe('lead');
  });
  it('Lead-Status SQL → SQL, an der Firma vor der Person', () => {
    expect(lifecycleVorschlag(k('a', { lead: lead('sql') }), bestand(), HEUTE).id).toBe('sql');
    const b = bestand({ firmen: [firma('x', { lead: lead('sql') })] });
    expect(lifecycleVorschlag(k('a', { firmaId: 'f-x', lead: lead('neu') }), b, HEUTE)).toMatchObject({ id: 'sql', grund: expect.stringContaining('Firma') });
  });
  it('Marketing-Signal → MQL: Antwort, Anfrage, beim Event dabei, Score warm', () => {
    expect(lifecycleVorschlag(k('a', { aktivitaeten: [akt('2026-09-20T09:00:00Z', 'antwort')] }), bestand(), HEUTE)).toMatchObject({ id: 'mql', grund: 'Antwort am 20.09.' });
    expect(lifecycleVorschlag(k('a', { aktivitaeten: [akt('2026-09-21T09:00:00Z', 'antwort', { text: 'Anfrage über Webseite: Hallo' })] }), bestand(), HEUTE).grund).toBe('Anfrage am 21.09.');
    const ev = bestand({ teilnahmen: [{ id: 't1', eventId: 'e1', kontaktId: 'c-a', status: 'da', geaendert: J }] });
    expect(lifecycleVorschlag(k('a'), ev, HEUTE).id).toBe('mql');
    // Warm: Fit „ja“ + echtes Gespräch vor wenigen Tagen + erreichbar.
    const warm = k('a', { eignung: 'ja', email: 'a@example.invalid', telefon: '030 1', aktivitaeten: [akt('2026-09-25T09:00:00Z', 'gespraech')] });
    expect(lifecycleVorschlag(warm, bestand(), HEUTE)).toMatchObject({ id: 'mql', grund: expect.stringContaining('Score') });
  });
  it('sonst Lead; ohne Bestand ebenfalls Lead', () => {
    expect(lifecycleVorschlag(k('a'), bestand(), HEUTE)).toMatchObject({ id: 'lead' });
    expect(lifecycleVorschlag(k('a'), null, HEUTE).id).toBe('lead');
    // Eine eingeladene, aber nicht erschienene Person ist noch kein MQL.
    expect(lifecycleVorschlag(k('a'), bestand({ teilnahmen: [{ id: 't1', eventId: 'e1', kontaktId: 'c-a', status: 'eingeladen', geaendert: J }] }), HEUTE).id).toBe('lead');
  });
  it('lifecycleVon: von Hand gewinnt über den Vorschlag; Verteilung zählt beides', () => {
    const b = bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'] })] });
    expect(lifecycleVon(k('a', { phase: 'follow_up' }), b, HEUTE)).toMatchObject({ phase: 'follow_up', vonHand: true });
    expect(lifecycleVon(k('a'), b, HEUTE)).toMatchObject({ phase: 'kunde', vonHand: false });
    const v = lifecycleVerteilung([k('a'), k('b', { phase: 'sql' }), k('c')], b, HEUTE);
    expect(v.je).toMatchObject({ kunde: 1, sql: 1, lead: 1, mql: 0 });
    expect(v.gesetzt).toBe(1);
  });
});

describe('Datensatz-Zusammenfassung', () => {
  const verlauf = [
    akt('2026-09-10T09:00:00Z', 'anruf', { ergebnis: 'gespraech', text: 'Bedarf an Controlling besprochen' }),
    akt('2026-09-12T09:00:00Z', 'system', { von: 'system', text: 'Stufe' }),
    akt('2026-09-15T09:00:00Z', 'antwort', { text: 'Danke, passt gut' }),
    akt('2026-09-05T09:00:00Z', 'mail', { text: 'Erste Mail' }),
  ];
  const person = k('a', { aktivitaeten: verlauf, naechsterSchritt: { text: 'Angebot schicken', datum: '2026-09-30' } });
  const b = bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'angebot', titel: 'Controlling', wert: { betrag: 3000, basis: 'monat' } })], mandate: [mandat('m1', { kontaktIds: ['c-a'], titel: 'Finanzen', start: '2026-03-01' })] });

  it('Reihenfolge: Gespräch · Mail/Antwort · Deal/Mandat · Schritt & Lifecycle — Quellen fortlaufend nummeriert', () => {
    const z = zusammenfassung(person, b, HEUTE);
    expect(z.leer).toBe(false);
    expect(z.saetze).toHaveLength(4);
    expect(z.saetze[0].text).toMatch(/^Letztes echtes Gespräch am 10\.09\. \(Anruf, vor 18 Tagen\)/);
    expect(z.saetze[1].text).toContain('Antwort');
    expect(z.saetze[2].text).toContain('Deal „Controlling“ in Stufe Angebot');
    expect(z.saetze[2].text).toContain('aktives Mandat „Finanzen“');
    expect(z.saetze[3].text).toMatch(/^Nächster Schritt: „Angebot schicken“ am 30\.09\. · Lifecycle Kunde/);
    expect(z.saetze.flatMap(s => s.quellen)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(z.quellen.map(q => q.art)).toEqual(['aktivitaet', 'aktivitaet', 'deal', 'mandat', 'feld', 'feld']);
  });
  it('Quellen der Aktivitäten tragen den Anker des Aktivitäten-Reiters (Position im Log)', () => {
    const z = zusammenfassung(person, b, HEUTE);
    const anker = ankerListe(verlauf);
    expect(z.quellen[0]).toMatchObject({ art: 'aktivitaet', anker: anker[0] });
    expect(z.quellen[1]).toMatchObject({ art: 'aktivitaet', anker: anker[2] });
    expect(z.quellen[2]).toMatchObject({ art: 'deal', id: 'd1' });
    expect(z.quellen[3]).toMatchObject({ art: 'mandat', id: 'm1' });
  });
  it('eine Mail vor dem Gespräch ist kein eigener Satz; überfälliger Schritt wird genannt', () => {
    const p = k('a', { aktivitaeten: [akt('2026-09-01T09:00:00Z', 'mail'), akt('2026-09-10T09:00:00Z', 'termin')], naechsterSchritt: { text: 'Nachfassen', datum: '2026-09-20' } });
    const z = zusammenfassung(p, bestand(), HEUTE);
    expect(z.saetze).toHaveLength(2);
    expect(z.saetze[0].text).toContain('(Meeting,');
    expect(z.saetze[1].text).toContain('überfällig');
  });
  it('ohne Daten: ein Satz, leer, nur die Lifecycle-Quelle', () => {
    const z = zusammenfassung(k('a'), bestand(), HEUTE);
    expect(z.leer).toBe(true);
    expect(z.saetze).toHaveLength(1);
    expect(z.saetze[0].text).toMatch(/^Noch nichts festgehalten/);
    expect(z.saetze[0].text).toContain('Lifecycle Lead (Vorschlag:');
    expect(z.quellen).toEqual([{ nr: 1, art: 'feld', feld: 'phase', label: 'Lifecycle Lead' }]);
  });
  it('gesetzter Lifecycle ohne „Vorschlag“, Klartext mit Nummern', () => {
    const z = zusammenfassung(k('a', { phase: 'mql' }), bestand(), HEUTE);
    expect(z.saetze[0].text).toContain('Lifecycle Marketing Qualified Lead.');
    expect(zusammenfassungText(z)).toMatch(/①$/);
    expect(nummer(3)).toBe('③');
    expect(nummer(12)).toBe('(12)');
  });
  it('abgeschlossener Deal erscheint, wenn nichts offen ist', () => {
    const z = zusammenfassung(k('a'), bestand({ chancen: [deal('d9', { kontaktIds: ['c-a'], stufe: 'verloren', grund: 'Preis' })] }), HEUTE);
    expect(z.saetze[0].text).toBe('Deal „Deal d9“ verloren (Preis).');
  });
});

describe('Datenpaket für „Frage stellen“', () => {
  it('nie die private Notiz, nie Einwilligungs-Nachweise, nur diese Person', () => {
    const p = k('a', { privatNotiz: 'GEHEIM-PRIVAT', privatNotizVon: 'kevin', notiz: 'Team weiß das', einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: HEUTE, nachweis: 'NACHWEIS-TEXT' }], aktivitaeten: [akt(J, 'anruf', { ergebnis: 'gespraech', text: 'Gespräch' })] });
    const paket = kontaktPaket(p, bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'] }), deal('d2', { kontaktIds: ['c-b'] })] }), HEUTE);
    const text = JSON.stringify(paket);
    expect(text).not.toContain('GEHEIM-PRIVAT');
    expect(text).not.toContain('NACHWEIS-TEXT');
    expect(paket?.deals.map(d => d.titel)).toEqual(['Deal d1']);
    expect(paket?.team_notiz).toBe('Team weiß das');
    expect(paket?.zusammenfassung).toContain('①');
  });
  it('Werbesperre: kein Paket', () => {
    expect(kontaktPaket(k('a', { werbesperre: { seit: HEUTE, grund: 'Widerspruch' } }), bestand(), HEUTE)).toBeNull();
  });
});

describe('Segment-Kriterium Lifecycle', () => {
  const b = bestand({ chancen: [deal('d1', { kontaktIds: ['c-b'], stufe: 'bedarf' })] });
  const ctx = kontextAus(b, HEUTE);
  it('trifft gesetzte und vorgeschlagene Phasen; Gesperrte nie', () => {
    expect(imSegment(k('a', { phase: 'sql' }), { lifecycle: ['sql'] }, ctx)).toBe(true);
    expect(imSegment(k('b'), { lifecycle: ['opportunity'] }, ctx)).toBe(true);
    expect(imSegment(k('c'), { lifecycle: ['opportunity'] }, ctx)).toBe(false);
    expect(imSegment(k('c'), { lifecycle: ['lead'] }, ctx)).toBe(true);
    expect(imSegment(k('d', { phase: 'sql', werbesperre: { seit: HEUTE, grund: 'x' } }), { lifecycle: ['sql'] }, ctx)).toBe(false);
  });
  it('ohne Bestand im Kontext zählt nur die gesetzte Phase, sonst Lead', () => {
    const nur = { ...ctx, bestand: undefined };
    expect(imSegment(k('b'), { lifecycle: ['opportunity'] }, nur)).toBe(false);
    expect(imSegment(k('b'), { lifecycle: ['lead'] }, nur)).toBe(true);
  });
  it('Speichern behält Lifecycle und Temperatur (nur bekannte Werte), der Text nennt sie', () => {
    const kr = kriterienSauber({ lifecycle: ['sql', 'mql', 'quatsch' as never], temperatur: ['heiss', 'kalt'] });
    expect(kr.lifecycle).toEqual(['mql', 'sql']);
    expect(kr.temperatur).toEqual(['kalt', 'heiss']);
    expect(kriterienText({ lifecycle: ['mql', 'sql'] })).toBe('Lifecycle MQL, SQL');
  });
});

describe('Export', () => {
  it('Spalten LIFECYCLE_PHASE und LIFECYCLE_GESETZT — gesetzt oder Vorschlag', () => {
    expect(EXPORT_SPALTEN.kontakte).toContain('LIFECYCLE_PHASE');
    const csv = exportCsv('kontakte', { kontakte: [k('a', { phase: 'angebot' }), k('b')], crm: bestand({ chancen: [deal('d1', { kontaktIds: ['c-b'] })] }), heute: HEUTE });
    const [kopf, ...zeilen] = csv.replace(/^﻿/, '').split('\n').map(z => z.split(';'));
    const i = kopf.indexOf('LIFECYCLE_PHASE'), j = kopf.indexOf('LIFECYCLE_GESETZT');
    expect(zeilen.map(z => [z[i], z[j]])).toEqual([['angebot', 'ja'], ['opportunity', 'nein']]);
  });
});
