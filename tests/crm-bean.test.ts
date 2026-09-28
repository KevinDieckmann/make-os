// ─── BEAN-Kundengruppe (28.09., Paket H4): Ableitung, Vorrang, Handfeld, Filter, Segment, Export ──
// Alle Daten erfunden (@example.invalid).
import { describe, it, expect } from 'vitest';
import { beanVon, beanFirma, beanVerteilung, beanFuerLead, offeneAngebote, istBean, BEAN_IDS, BEAN_WAHL, BEAN_LABEL, type AngebotHinweis } from '../lib/crm/bean';
import { saeubereKontakt, zusammenfuehren, PIPELINE_FELDER, type Kontakt } from '../lib/make-one/crm';
import { saeubern, leererBestand } from '../lib/crm/speicher';
import { kontextAus, imSegment } from '../lib/crm/segmente';
import { kriterienSauber, kriterienText } from '../lib/crm/marketing';
import { exportCsv } from '../lib/crm/export';
import { leads, zuQualifizieren } from '../lib/crm/leads';
import { karteiBean } from '../lib/crm/adresse';
import type { Chance, CrmBestand, Firma, Mandat } from '../lib/crm/typen';

const HEUTE = '2026-09-28';
const J = '2026-09-01T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const deal = (id: string, x: Partial<Chance> = {}): Chance => ({ id, titel: `Deal ${id}`, kontaktIds: [], art: 'retainer', wert: { betrag: 0, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });
const mandat = (id: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde: `Kunde ${id}`, kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ...x } as Mandat);
const firma = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const bestand = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });

describe('BEAN — Ableitung mit Vorrang B > A > E > N', () => {
  it('B: aktives Mandat der Person oder ihrer Firma', () => {
    expect(beanVon(k('a'), bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'] })] }))).toMatchObject({ bean: 'B', vonHand: false, grund: expect.stringContaining('aktives Mandat') });
    const b = bestand({ firmen: [firma('x')], mandate: [mandat('m1', { firmaId: 'f-x' })] });
    expect(beanVon(k('a', { firmaId: 'f-x' }), b).bean).toBe('B');
  });
  it('A: Deal in Angebot/Abschluss, Mandat im Angebot, offenes Angebot in der Ablage', () => {
    expect(beanVon(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'abschluss' })] }))).toMatchObject({ bean: 'A', grund: expect.stringContaining('Abschluss') });
    expect(beanVon(k('a'), bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'], status: 'verhandlung' })] })).bean).toBe('A');
    // Ein offener Deal in früher Stufe ist noch kein Angebot.
    expect(beanVon(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'bedarf' })] })).bean).toBe('N');
    const angebote: AngebotHinweis[] = [{ titel: 'Angebot Q4', kontaktId: 'c-a' }];
    expect(beanVon(k('a'), bestand(), { angebote })).toMatchObject({ bean: 'A', grund: expect.stringContaining('Ablage') });
    // Angebot an der Firma oder an einem Deal der Person zählt auch; fremdes nicht.
    const b = bestand({ firmen: [firma('x')], chancen: [deal('d9', { kontaktIds: ['c-a'], stufe: 'bedarf' })] });
    expect(beanVon(k('a', { firmaId: 'f-x' }), b, { angebote: [{ firmaId: 'f-x' }] }).bean).toBe('A');
    expect(beanVon(k('a'), b, { angebote: [{ dealId: 'd9' }] }).bean).toBe('A');
    expect(beanVon(k('a'), b, { angebote: [{ kontaktId: 'c-b' }] }).bean).toBe('N');
  });
  it('E: beendetes/pausiertes Mandat, gewonnener Deal ohne aktives Mandat, Ex-Kunde', () => {
    expect(beanVon(k('a'), bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'], status: 'beendet' })] }))).toMatchObject({ bean: 'E', grund: expect.stringContaining('beendet') });
    expect(beanVon(k('a'), bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'], status: 'pausiert' })] })).bean).toBe('E');
    expect(beanVon(k('a'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'gewonnen' })] })).bean).toBe('E');
    expect(beanVon(k('a', { lebensphase: 'ex_kunde' }), bestand())).toMatchObject({ bean: 'E', grund: 'Lebensphase Ex-Kunde' });
    expect(beanVon(k('a', { firmaId: 'f-x' }), bestand({ firmen: [firma('x', { rolle: 'ex_kunde' })] })).bean).toBe('E');
  });
  it('Vorrang: B schlägt A, A schlägt E; sonst N', () => {
    const ba = bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'] })], chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'angebot' })] });
    expect(beanVon(k('a'), ba).bean).toBe('B');
    const ae = bestand({ mandate: [mandat('m1', { kontaktIds: ['c-a'], status: 'beendet' })], chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'angebot' })] });
    expect(beanVon(k('a'), ae).bean).toBe('A');
    expect(beanVon(k('a'), bestand())).toMatchObject({ bean: 'N', grund: expect.stringContaining('Qualifizieren') });
    expect(beanVon(k('a'), null).bean).toBe('N');
  });
  it('von Hand: an der Person vor der Firma vor der Ableitung — die Ableitung bleibt sichtbar', () => {
    const b = bestand({ firmen: [firma('x', { bean: 'E' })], mandate: [mandat('m1', { kontaktIds: ['c-a'] })] });
    expect(beanVon(k('a', { bean: 'A' }), b)).toMatchObject({ bean: 'A', vonHand: true, abgeleitet: { bean: 'B' } });
    expect(beanVon(k('a', { firmaId: 'f-x' }), b)).toMatchObject({ bean: 'E', vonHand: true, grund: expect.stringContaining('Firma') });
  });
  it('Firma: aus Mandaten/Deals der Firma und ihrer Personen; von Hand gewinnt', () => {
    const personen = [k('a', { firmaId: 'f-x' }), k('b', { firmaId: 'f-y' })];
    expect(beanFirma(firma('x'), bestand({ chancen: [deal('d1', { kontaktIds: ['c-a'], stufe: 'angebot' })] }), personen).bean).toBe('A');
    expect(beanFirma(firma('x'), bestand({ mandate: [mandat('m1', { kunde: 'Firma x' })] }), personen).bean).toBe('B');
    expect(beanFirma(firma('x', { bean: 'N' }), bestand({ mandate: [mandat('m1', { firmaId: 'f-x' })] }), personen)).toMatchObject({ bean: 'N', vonHand: true, abgeleitet: { bean: 'B' } });
    expect(beanFirma(firma('x'), bestand(), personen, { angebote: [{ kontaktId: 'c-a' }] }).bean).toBe('A');
    expect(beanFirma(firma('x'), bestand(), personen, { angebote: [{ kontaktId: 'c-b' }] }).bean).toBe('N');
  });
  it('Verteilung und Lead-Gruppe', () => {
    const b = bestand({ firmen: [firma('x')], mandate: [mandat('m1', { kontaktIds: ['c-a'] })] });
    const v = beanVerteilung([k('a'), k('b', { bean: 'E' }), k('c')], b);
    expect(v).toEqual({ je: { B: 1, E: 1, A: 0, N: 1 }, vonHand: 1 });
    expect(beanFuerLead({ id: 'f-x', art: 'firma' }, b, [k('a', { firmaId: 'f-x' })])?.bean).toBe('B');
    expect(beanFuerLead({ id: 'c-c', art: 'person' }, b, [k('c')])?.bean).toBe('N');
    expect(beanFuerLead({ id: 'f-nichts', art: 'firma' }, b, [])).toBeNull();
  });
  it('offene Angebote aus Ablage-Einträgen: nur art „angebot“ mit Status offen, nur Bezüge', () => {
    const l = offeneAngebote([
      { art: 'angebot', titel: 'A1', angebot: { status: 'offen' }, kontaktId: 'c-a' },
      { art: 'angebot', titel: 'A2', angebot: { status: 'angenommen' }, kontaktId: 'c-a' },
      { art: 'vertrag', titel: 'V', kontaktId: 'c-a' },
      { art: 'angebot', firmaId: 'f-x' },
    ]);
    expect(l).toEqual([{ titel: 'A1', kontaktId: 'c-a' }, { firmaId: 'f-x' }]);
  });
  it('Typ, Wahl-Liste, Kurzlink', () => {
    expect(BEAN_IDS).toEqual(['B', 'E', 'A', 'N']);
    expect(BEAN_WAHL[0]).toMatchObject({ id: 'B', label: 'B · Bestandskunde' });
    expect(BEAN_LABEL).toEqual({ B: 'Bestandskunde', E: 'Ehemalig', A: 'Angebotskunde', N: 'Neu' });
    expect(istBean('A')).toBe(true);
    expect(istBean('X')).toBe(false);
    expect(karteiBean('A')).toBe('/os/markttraktion?s=kontakte&bean=A');
    expect(karteiBean('<x>')).toBe('/os/markttraktion?s=kontakte');
  });
});

describe('BEAN — Handfeld: Säuberung, Import, Firma', () => {
  it('Säuberung behält B/E/A/N und verwirft Unbekanntes', () => {
    expect(saeubereKontakt({ ...k('abcd'), bean: 'A' })?.bean).toBe('A');
    expect(saeubereKontakt({ ...k('abcd'), bean: 'Q' })?.bean).toBeUndefined();
    const f = saeubern('firmen', { id: 'f-xy', name: 'Firma', rolle: 'kunde', bean: 'E' }, J, 'kevin') as unknown as Firma;
    expect(f.bean).toBe('E');
    expect((saeubern('firmen', { id: 'f-xy', name: 'Firma', bean: 'Z' }, J, 'kevin') as unknown as Firma).bean).toBeUndefined();
  });
  it('der Import überschreibt die Gruppe nie (Pipeline-Feld)', () => {
    expect(PIPELINE_FELDER).toContain('bean');
    const r = zusammenfuehren(k('a', { bean: 'B' }), { ...k('a'), bean: 'N' } as Kontakt, HEUTE);
    expect(r.kontakt.bean).toBe('B');
  });
});

describe('BEAN — Filter in Runde und Leads, Segment, Export', () => {
  const b = bestand({ firmen: [firma('x')], mandate: [mandat('m1', { firmaId: 'f-x' })] });
  const personen = [k('a', { firmaId: 'f-x', stufe: 'angesprochen' }), k('b', { stufe: 'angesprochen' })];
  it('Leads tragen die Gruppe; die Runde filtert auf „Neu“', () => {
    const z = leads(personen, b, HEUTE);
    expect(z.find(x => x.id === 'f-x')?.bean).toBe('B');
    expect(z.find(x => x.id === 'c-b')?.bean).toBe('N');
    const alle = zuQualifizieren(z, { wer: 'alle', auchKalt: true, heute: HEUTE });
    const neu = zuQualifizieren(z, { wer: 'alle', auchKalt: true, bean: 'N', heute: HEUTE });
    expect(neu.every(x => x.bean === 'N')).toBe(true);
    expect(neu.length).toBeLessThanOrEqual(alle.length);
    expect(neu.some(x => x.id === 'c-b')).toBe(true);
  });
  it('Segment-Kriterium bean: trifft abgeleitet und von Hand; Gesperrte nie', () => {
    const ctx = kontextAus(b, HEUTE);
    expect(imSegment(personen[0], { bean: ['B'] }, ctx)).toBe(true);
    expect(imSegment(personen[1], { bean: ['B'] }, ctx)).toBe(false);
    expect(imSegment(personen[1], { bean: ['N', 'E'] }, ctx)).toBe(true);
    expect(imSegment(k('c', { bean: 'E' }), { bean: ['E'] }, ctx)).toBe(true);
    expect(imSegment(k('d', { bean: 'E', werbesperre: { seit: HEUTE, grund: 'x' } }), { bean: ['E'] }, ctx)).toBe(false);
  });
  it('Kriterien: sauber (nur B/E/A/N, Reihenfolge B-E-A-N), Text, und der Speicher behält bean, lifecycle, temperatur', () => {
    expect(kriterienSauber({ bean: ['N', 'B', 'Q' as never] }).bean).toEqual(['B', 'N']);
    expect(kriterienText({ bean: ['B', 'A'] })).toBe('BEAN Bestandskunde, Angebotskunde');
    const sg = saeubern('segmente', { id: 'sg-1', name: 'Neue', kriterien: { bean: ['N', 'x'], lifecycle: ['sql', 'quatsch'], temperatur: ['warm'] } }, J, 'kevin') as { kriterien: Record<string, unknown> };
    expect(sg.kriterien).toMatchObject({ bean: ['N'], lifecycle: ['sql'], temperatur: ['warm'] });
  });
  it('Export: Spalte BEAN in Kontakte und Firmen', () => {
    const tab = (csv: string) => csv.replace(/^﻿/, '').split('\n').map(z => z.split(';'));
    const [kopf, ...zeilen] = tab(exportCsv('kontakte', { kontakte: [...personen, k('c', { bean: 'E' })], crm: b, heute: HEUTE }));
    const i = kopf.indexOf('BEAN');
    expect(i).toBeGreaterThan(-1);
    expect(zeilen.map(z => z[i])).toEqual(['B', 'N', 'E']);
    const [fk, ...fz] = tab(exportCsv('firmen', { kontakte: personen, crm: b, heute: HEUTE }));
    expect(fz[0][fk.indexOf('BEAN')]).toBe('B');
  });
});
