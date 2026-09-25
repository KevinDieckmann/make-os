// Sales in drei Ebenen (25.09.): Lead (qualifizieren → SQL) · Deal (Pipeline) · Kunde (Mandat).
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, Firma, Kriterien } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { sqlBereit, fehltBisSql, abgeleitet, leads, trichter, dealAusLead, leereKriterien, geklaert } from '../lib/crm/leads';
import { leadSaeubern } from '../lib/crm/lead-form';
import { grundlauf } from '../lib/heads/grundlauf';

const HEUTE = '2026-09-25';
const J = '2026-09-25T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const f = (id: string, x: Partial<Firma> = {}): Firma => ({ id: `f-${id}`, name: `Firma ${id}`, rolle: 'zielkunde', geaendert: J, ...x });
const krit = (x: Partial<Kriterien> = {}): Kriterien => ({ ...leereKriterien(), ...x });
const deal = (x: Partial<Chance> = {}): Chance => ({ id: 'ch-1', titel: 'Retainer', kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 3000, basis: 'monat' }, stufe: 'qualifiziert', historie: [], qualifizierung: krit(), gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });

describe('SQL-Regel', () => {
  it('Schmerz UND Entscheider, dazu Budget ODER Zeitpunkt', () => {
    expect(sqlBereit(krit({ schmerz: 'ja', entscheider: 'ja', zeitpunkt: 'ja' }))).toBe(true);
    expect(sqlBereit(krit({ schmerz: 'ja', entscheider: 'ja', budget: 'ja' }))).toBe(true);
    expect(sqlBereit(krit({ schmerz: 'ja', entscheider: 'unklar', budget: 'ja', zeitpunkt: 'ja' }))).toBe(false);
    expect(fehltBisSql(krit({ schmerz: 'ja' }))).toEqual(['Entscheider', 'Budget oder Zeitpunkt']);
    expect(geklaert(krit({ schmerz: 'ja', wirkung: 'ja', budget: 'nein' }))).toBe(2);
  });
});

describe('Ebene 1 — Leads', () => {
  it('Status aus den Personen, solange niemand ihn gesetzt hat', () => {
    expect(abgeleitet([k('a', { stufe: 'gespraech' })], false)).toBe('im_gespraech');
    expect(abgeleitet([k('a', { stufe: 'angesprochen' })], false)).toBe('kontaktiert');
    expect(abgeleitet([k('a')], true)).toBe('sql');
    expect(abgeleitet([k('a', { lebensphase: 'kunde' })], false)).toBe('kunde');
    expect(abgeleitet([k('a', { stufe: 'ruht' })], false)).toBe('ruht');
  });
  it('je Firma eine Zeile mit ihren Personen, Personen ohne Firma einzeln, Dienstleister und Gesperrte nicht', () => {
    const kontakte = [k('a', { firmaId: 'f-x', stufe: 'gespraech' }), k('b', { firmaId: 'f-x' }), k('c', { stufe: 'angesprochen' }), k('d', { firmaId: 'f-dl' }), k('e', { werbesperre: { seit: '2026-09-01', grund: 'x' } })];
    const crm = { ...leererBestand(), firmen: [f('x'), f('dl', { rolle: 'dienstleister' })] };
    const z = leads(kontakte, crm);
    expect(z.map(x => [x.id, x.status, x.personen.length])).toEqual([['f-x', 'im_gespraech', 2], ['c-c', 'kontaktiert', 1]]);
  });
  it('gesetzter Status gewinnt; aus dem SQL-Deal wird Kunde (gewonnen) oder ruht (verloren, mit Grund)', () => {
    const kontakte = [k('a', { firmaId: 'f-x', stufe: 'gespraech' })];
    const gewonnen = leads(kontakte, { ...leererBestand(), firmen: [f('x', { lead: { status: 'sql', kriterien: krit(), chanceId: 'ch-1' } })], chancen: [deal({ stufe: 'gewonnen' })] });
    expect(gewonnen[0].status).toBe('kunde');
    const verloren = leads(kontakte, { ...leererBestand(), firmen: [f('x', { lead: { status: 'sql', kriterien: krit(), chanceId: 'ch-1' } })], chancen: [deal({ stufe: 'verloren', grund: 'Preis' })] });
    expect(verloren[0]).toMatchObject({ status: 'ruht', grund: 'Preis' });
    const gesetzt = leads(kontakte, { ...leererBestand(), firmen: [f('x', { lead: { status: 'qualifizierung', kriterien: krit({ schmerz: 'ja' }) } })] });
    expect(gesetzt[0]).toMatchObject({ status: 'qualifizierung', gesetzt: true, kriterien: { schmerz: 'ja' } });
  });
});

describe('Ebene 1 → 2: aus dem SQL wird ein Deal', () => {
  it('Kernfragen, Personen und Firma wandern mit, Stufe „SQL“, nächster Schritt gesetzt', () => {
    const z = leads([k('a', { firmaId: 'f-x', stufe: 'gespraech' }), k('b', { firmaId: 'f-x' })], { ...leererBestand(), firmen: [f('x', { lead: { status: 'qualifizierung', kriterien: krit({ schmerz: 'ja', entscheider: 'ja', zeitpunkt: 'ja' }) } })] })[0];
    const d = dealAusLead(z, { id: 'ch-neu', titel: '', art: 'retainer', betrag: 0, basis: 'monat', schritt: { text: 'Bedarfsgespräch', datum: '2026-09-29' }, besitzer: 'malin', jetzt: J });
    expect(d).toMatchObject({ titel: 'Firma x', firma: 'Firma x', stufe: 'qualifiziert', kontaktIds: ['c-a', 'c-b'], besitzer: 'malin', naechsterSchritt: { text: 'Bedarfsgespräch', datum: '2026-09-29' }, qualifizierung: { schmerz: 'ja', entscheider: 'ja', zeitpunkt: 'ja' }, wert: { betrag: 0 } });
  });
});

describe('Trichter über alle Ebenen', () => {
  it('zählt Leads je Status, offene Deals mit Wert, Gewonnene und aktive Kunden', () => {
    const kontakte = [k('a', { stufe: 'gespraech' }), k('b', { stufe: 'angesprochen' }), k('c', { stufe: 'gespraech' })];
    const crm = { ...leererBestand(), chancen: [deal({ kontaktIds: ['c-z'] })], mandate: [{ id: 'm-1', status: 'aktiv' } as never] };
    const t = trichter(leads(kontakte, crm), crm);
    expect(Object.fromEntries(t.stufen.map(s => [s.id, s.anzahl]))).toEqual({ kontaktiert: 1, im_gespraech: 2, qualifizierung: 0, deals: 1, gewonnen: 0, kunden: 1 });
    expect(t.stufen.find(s => s.id === 'deals')?.wert).toBe(36000);
  });
});

describe('Lead säubern', () => {
  it('nur bekannte Werte, unbekannter Status → kein Lead', () => {
    expect(leadSaeubern({ status: 'sql', kriterien: { schmerz: 'ja', entscheider: 'vielleicht' }, chanceId: 'ch-1', fit: 'ja' })).toMatchObject({ status: 'sql', kriterien: { schmerz: 'ja', entscheider: 'unklar' }, chanceId: 'ch-1', fit: 'ja' });
    expect(leadSaeubern({ status: 'irgendwas' })).toBeUndefined();
  });
});

describe('Head of Sales — Leads qualifizieren (Regelwerk)', () => {
  it('SQL-bereit ohne Deal → Deal anlegen; sonst die eine fehlende Kernfrage mit der Frage dazu', () => {
    const p = (id: string) => ({ id, name: id, kanal_erlaubt: ['telefon'] });
    const daten = { meta: { heute: HEUTE }, leads_in_arbeit: [
      { lead_id: 'f-a', name: 'Acme', status: 'qualifizierung', sql_bereit: true, fehlt: [], geklaert: 3, deal: null, letzter_kontakt: '2026-09-22', hauptkontakt: p('c-a') },
      { lead_id: 'f-b', name: 'Beta', status: 'im_gespraech', sql_bereit: false, fehlt: ['Entscheider', 'Budget oder Zeitpunkt'], geklaert: 1, deal: null, letzter_kontakt: '2026-09-20', hauptkontakt: p('c-b') },
    ] };
    const g = grundlauf('sales', 'lead_review', daten).antwort;
    expect(g.vorschlaege.map(v => [v.art, v.kontakt_id])).toEqual([['sql_anlegen', 'c-a'], ['qualifizierung_klaeren', 'c-b']]);
    expect(g.vorschlaege[1].titel).toBe('Entscheider klären: Beta');
    expect(g.vorschlaege[1].begruendung).toContain('Wer entscheidet und zahlt');
  });
});
