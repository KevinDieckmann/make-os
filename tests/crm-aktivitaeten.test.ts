// Kontakt öffnen · Reiter „Aktivitäten“ (28.09., Paket H3): Zuordnung, Filter, Suche, Zeitraum in Europe/Berlin,
// Gruppierung, System ausgeblendet, Anker, eigene Notizen. Erfundene Daten.
import { describe, it, expect } from 'vitest';
import {
  aufbereiten, filtern, zaehlen, gruppieren, berlin, unterAus, passtZeitraum, passtPerson, meetingText, meetingAusText,
  ankerListe, aktivitaetAnker, followupAnker, istAktAnker, notizAendern, notizLoeschen, darfBearbeiten, bezugAufloesen, filterGesetzt,
  FILTER_START, KATEGORIE_VON_ART, type AktFilter, type Eintrag,
} from '../lib/crm/aktivitaeten';
import { leererBestand } from '../lib/crm/speicher';
import { AKTIVITAET_ARTEN, type Aktivitaet, type Kontakt } from '../lib/make-one/crm';
import type { CrmBestand, FollowUp } from '../lib/crm/typen';

const HEUTE = '2026-09-28';
const JETZT = '2026-09-28T10:00:00.000Z'; // 12:00 in Berlin (MESZ)
const akt = (x: Partial<Aktivitaet> & Pick<Aktivitaet, 'art' | 'am'>): Aktivitaet => ({ von: 'kevin', ...x });
const k = (x: Partial<Kontakt> = {}): Kontakt => ({ id: 'c-anna', vorname: 'Anna', nachname: 'Test', eignung: 'ja', prio: 'A', stufe: 'gespraech', aktivitaeten: [], importiertAm: HEUTE, geaendertAm: HEUTE, besitzer: 'kevin', ...x } as Kontakt);
const fu = (x: Partial<FollowUp>): FollowUp => ({ id: 'fu-1', bezug: { art: 'kontakt', id: 'c-anna' }, kontaktId: 'c-anna', art: 'anruf', text: 'Anrufen', faellig: HEUTE, zustaendig: 'kevin', status: 'offen', quelle: 'hand', angelegt: HEUTE, geaendert: HEUTE, ...x });
const f = (x: Partial<AktFilter> = {}): AktFilter => ({ ...FILTER_START, ...x });

const verlauf: Aktivitaet[] = [
  akt({ am: '2026-07-10T09:00:00.000Z', art: 'mail', text: 'Erstansprache zum Thema Nachfolge' }),
  akt({ am: '2026-08-31T22:30:00.000Z', art: 'anruf', ergebnis: 'gespraech', notiz: { bedarf: 'Kapitalmarktreife bis 2027' }, von: 'malin' }), // Berlin: 1.9. 00:30
  akt({ am: '2026-09-20T08:00:00.000Z', art: 'notiz', text: 'Mag keine langen Mails.' }),
  akt({ am: '2026-09-21T08:00:00.000Z', art: 'stufe', text: 'Stufe → Gespräch', von: 'system' }),
  akt({ am: '2026-09-22T08:00:00.000Z', art: 'linkedin', text: 'Glückwunsch zum Jubiläum' }),
  akt({ am: '2026-09-25T08:00:00.000Z', art: 'termin', text: meetingText({ tag: '2026-10-02', zeit: '14:00', ort: 'Büro Hamburg', notiz: 'Diagnose besprechen' }) }),
  akt({ am: '2026-09-26T08:00:00.000Z', art: 'uebergabe', text: 'an Malin', von: 'kevin' }),
  akt({ am: '2026-09-27T08:00:00.000Z', art: 'antwort', text: 'Passt nächste Woche.', bezug: 'ch-1' }),
];
const crm: CrmBestand = {
  ...leererBestand(),
  chancen: [{ id: 'ch-1', titel: 'Kapitalmarkt-Diagnose', kontaktIds: ['c-anna'], stufe: 'bedarf', historie: [], naechsterSchritt: { text: 'Angebot', datum: '2026-10-05' }, besitzer: 'kevin', angelegt: HEUTE, geaendert: HEUTE } as unknown as CrmBestand['chancen'][number]],
  followups: [
    fu({ id: 'fu-offen', text: 'Unterlagen nachfragen', faellig: '2026-09-30', zustaendig: 'beide' }),
    fu({ id: 'fu-alt', text: 'Einladung schicken', faellig: '2026-09-10', status: 'erledigt', erledigtAm: '2026-09-09T21:30:00.000Z', zustaendig: 'malin' }),
    fu({ id: 'fu-fremd', kontaktId: 'c-bert', bezug: { art: 'kontakt', id: 'c-bert' }, text: 'Andere Person' }),
  ],
};
const person = k({ aktivitaeten: verlauf, naechsterSchritt: { text: 'Rückruf', datum: '2026-09-29' } });
const liste = aufbereiten(person, crm, { heute: HEUTE, jetzt: JETZT, termin: { titel: 'Kennenlernen', start: '2026-10-01T07:00:00.000Z' } });
const nach = (anker: string) => liste.find(e => e.anker === anker)!;

describe('Aktivitäten — Zuordnung der Arten', () => {
  it('jede Art hat genau einen Unter-Reiter; System = stufe, system, uebergabe', () => {
    for (const a of AKTIVITAET_ARTEN) expect(KATEGORIE_VON_ART[a]).toBeTruthy();
    expect(KATEGORIE_VON_ART.notiz).toBe('notizen');
    expect([KATEGORIE_VON_ART.mail, KATEGORIE_VON_ART.antwort, KATEGORIE_VON_ART.linkedin]).toEqual(['emails', 'emails', 'emails']);
    expect(KATEGORIE_VON_ART.anruf).toBe('anrufe');
    expect([KATEGORIE_VON_ART.termin, KATEGORIE_VON_ART.gespraech, KATEGORIE_VON_ART.event]).toEqual(['meetings', 'meetings', 'meetings']);
    expect([KATEGORIE_VON_ART.stufe, KATEGORIE_VON_ART.system, KATEGORIE_VON_ART.uebergabe]).toEqual(['system', 'system', 'system']);
  });
  it('Aufgaben = offene (echte + virtuelle) und abgeschlossene Follow-ups der Person — keine fremden', () => {
    const aufgaben = filtern(liste, 'aufgaben', f(), HEUTE);
    const ids = aufgaben.map(e => e.followupId);
    expect(ids).toContain('fu-offen');
    expect(ids).toContain('fu-alt');
    expect(ids).toContain('v:schritt:c-anna');
    expect(ids).toContain('v:dealschritt:ch-1');
    expect(ids).not.toContain('fu-fremd');
    expect(nach(followupAnker('fu-alt'))).toMatchObject({ status: 'erledigt', kommend: false, tag: '2026-09-09' });
    expect(nach(followupAnker('v:schritt:c-anna'))).toMatchObject({ kommend: true, hinweis: 'aus: Nächster Schritt am Kontakt', anker: 'akt-fu-v-schritt-c-anna' });
  });
  it('Meetings: termin mit Datum aus dem Text, kommender Kalendertermin; Titel mit Ergebnis', () => {
    const m = filtern(liste, 'meetings', f(), HEUTE);
    expect(m.map(e => e.art).sort()).toEqual(['kalender', 'termin']);
    expect(m.find(e => e.art === 'termin')).toMatchObject({ tag: '2026-10-02', zeit: '14:00', ort: 'Büro Hamburg', text: 'Diagnose besprechen', kommend: true });
    expect(m.find(e => e.art === 'kalender')).toMatchObject({ tag: '2026-10-01', zeit: '09:00', kommend: true, text: 'Kennenlernen' });
    expect(filtern(liste, 'anrufe', f(), HEUTE)[0].titel).toBe('Anruf · Gespräch geführt');
  });
  it('vergangener Kalendertermin erscheint nicht', () => {
    const l = aufbereiten(person, crm, { heute: HEUTE, jetzt: JETZT, termin: { titel: 'Vorbei', start: '2026-09-27T07:00:00.000Z' } });
    expect(l.some(e => e.art === 'kalender')).toBe(false);
  });
  it('Unter-Reiter aus der Adresse', () => {
    expect(unterAus('notizen')).toBe('notizen');
    expect(unterAus('quatsch')).toBe('alle');
    expect(unterAus(null)).toBe('alle');
  });
});

describe('Aktivitäten — System ausgeblendet, Filter, Suche', () => {
  it('System nur unter „Alle“ und nur mit Schalter', () => {
    expect(filtern(liste, 'alle', f(), HEUTE).some(e => e.kategorie === 'system')).toBe(false);
    expect(filtern(liste, 'alle', f({ system: true }), HEUTE).filter(e => e.kategorie === 'system')).toHaveLength(2);
    for (const u of ['notizen', 'emails', 'anrufe', 'aufgaben', 'meetings'] as const) expect(filtern(liste, u, f({ system: true }), HEUTE).some(e => e.kategorie === 'system')).toBe(false);
  });
  it('Arten-Filter (mehrfach) wirkt unter „Alle“', () => {
    const l = filtern(liste, 'alle', f({ arten: ['notizen', 'anrufe'] }), HEUTE);
    expect(new Set(l.map(e => e.kategorie))).toEqual(new Set(['notizen', 'anrufe']));
  });
  it('Zähler je Unter-Reiter folgen Suche/Zeitraum/Person', () => {
    const z = zaehlen(liste, f(), HEUTE);
    expect(z).toMatchObject({ notizen: 1, emails: 3, anrufe: 1, meetings: 2 });
    expect(z.alle).toBe(z.notizen + z.emails + z.anrufe + z.meetings + z.aufgaben);
    expect(zaehlen(liste, f({ suche: 'jubilaeum' }), HEUTE)).toMatchObject({ alle: 1, emails: 1, notizen: 0 });
  });
  it('Suche über Text, Notizvorlage und Ergebnis — Umlaute egal, alle Wörter', () => {
    expect(filtern(liste, 'alle', f({ suche: 'kapitalmarktreife' }), HEUTE).map(e => e.art)).toEqual(['anruf']);
    expect(filtern(liste, 'alle', f({ suche: 'gespräch geführt' }), HEUTE).map(e => e.art)).toEqual(['anruf']);
    expect(filtern(liste, 'alle', f({ suche: 'Gluckwunsch' }), HEUTE)).toHaveLength(0);
    expect(filtern(liste, 'alle', f({ suche: 'glueckwunsch' }), HEUTE)).toHaveLength(1);
    expect(filtern(liste, 'alle', f({ suche: 'hamburg' }), HEUTE).map(e => e.art)).toEqual(['termin']);
  });
  it('Person: eigene + gemeinsame; „Beide“ nur gemeinsame', () => {
    expect(passtPerson({ person: 'beide' }, 'kevin')).toBe(true);
    expect(passtPerson({ person: 'malin' }, 'kevin')).toBe(false);
    expect(passtPerson({ person: 'kevin' }, 'beide')).toBe(false);
    const malin = filtern(liste, 'alle', f({ person: 'malin' }), HEUTE);
    expect(malin.every(e => e.person === 'malin' || e.person === 'beide')).toBe(true);
    expect(malin.some(e => e.followupId === 'fu-offen')).toBe(true);
  });
  it('filterGesetzt erkennt Abweichungen vom Start', () => {
    expect(filterGesetzt(FILTER_START)).toBe(false);
    expect(filterGesetzt(f({ zeitraum: '30' }))).toBe(true);
    expect(filterGesetzt(f({ suche: '  ' }))).toBe(false);
  });
});

describe('Aktivitäten — Zeit in Europe/Berlin', () => {
  it('UTC-Stempel werden Berliner Tag und Uhrzeit (Sommer- und Winterzeit)', () => {
    expect(berlin('2026-08-31T22:30:00.000Z')).toEqual({ tag: '2026-09-01', zeit: '00:30' });
    expect(berlin('2026-12-31T23:30:00.000Z')).toEqual({ tag: '2027-01-01', zeit: '00:30' });
    expect(berlin('2026-09-28')).toEqual({ tag: '2026-09-28' });
    expect(berlin('2026-10-01T14:00')).toEqual({ tag: '2026-10-01', zeit: '14:00' });
  });
  it('der Anruf kurz nach Mitternacht (Berlin) zählt im September', () => {
    const anruf = liste.find(e => e.art === 'anruf')!;
    expect(anruf.tag).toBe('2026-09-01');
    expect(gruppieren([anruf])[0].id).toBe('2026-09');
  });
  it('Zeiträume schauen zurück; Kommendes fällt nie heraus', () => {
    expect(passtZeitraum({ tag: '2026-09-21', kommend: false }, '7', HEUTE)).toBe(true);
    expect(passtZeitraum({ tag: '2026-09-20', kommend: false }, '7', HEUTE)).toBe(false);
    expect(passtZeitraum({ tag: '2026-07-01', kommend: false }, '90', HEUTE)).toBe(true);
    expect(passtZeitraum({ tag: '2025-12-31', kommend: false }, 'jahr', HEUTE)).toBe(false);
    expect(passtZeitraum({ tag: '2026-01-01', kommend: false }, 'jahr', HEUTE)).toBe(true);
    expect(passtZeitraum({ tag: '2026-12-01', kommend: true }, '7', HEUTE)).toBe(true);
    const l = filtern(liste, 'alle', f({ zeitraum: '30' }), HEUTE);
    expect(l.some(e => e.art === 'mail')).toBe(false);
    expect(l.some(e => e.art === 'anruf')).toBe(true);
  });
});

describe('Aktivitäten — Gruppierung', () => {
  const g = gruppieren(filtern(liste, 'alle', f(), HEUTE));
  it('„Kommend“ oben, nächstes zuerst; dann Monate, neueste zuerst', () => {
    expect(g.map(x => x.id)).toEqual(['kommend', '2026-09', '2026-07']);
    expect(g[1].label).toBe('September 2026');
    const kommend = g[0].eintraege.map(e => e.tag);
    expect(kommend).toEqual([...kommend].sort());
    expect(kommend[0]).toBe('2026-09-29');
    const sep = g[1].eintraege.map(e => e.sortier);
    expect(sep).toEqual([...sep].sort().reverse());
  });
  it('abgeschlossene Follow-ups stehen in ihrem Monat, nicht unter „Kommend“', () => {
    expect(g[1].eintraege.some(e => e.followupId === 'fu-alt')).toBe(true);
    expect(g[0].eintraege.every(e => e.kommend)).toBe(true);
  });
});

describe('Aktivitäten — Meeting-Text, Anker, eigene Notizen, Bezug', () => {
  it('Meeting-Text hin und zurück', () => {
    const t = meetingText({ tag: '2026-10-02', zeit: '09:30', ort: ' Zoom ', notiz: 'Agenda' });
    expect(t).toBe('Meeting am 02.10.2026 um 09:30 Uhr · Ort: Zoom\nAgenda');
    expect(meetingAusText(t)).toEqual({ tag: '2026-10-02', zeit: '09:30', ort: 'Zoom', notiz: 'Agenda' });
    expect(meetingAusText(meetingText({ tag: '2026-10-02' }))).toEqual({ tag: '2026-10-02' });
    expect(meetingAusText('Termin vereinbart')).toBeNull();
  });
  it('Anker sind stabil, eindeutig und unabhängig vom Text', () => {
    const a = ankerListe(verlauf);
    expect(new Set(a).size).toBe(a.length);
    expect(a.every(istAktAnker)).toBe(true);
    expect(aktivitaetAnker(verlauf, 2)).toBe(a[2]);
    expect(ankerListe(verlauf.map(x => ({ ...x, text: 'anders' })))).toEqual(a);
    const doppelt = [akt({ am: '2026-09-01', art: 'notiz', text: 'a' }), akt({ am: '2026-09-01', art: 'notiz', text: 'b' })];
    const d = ankerListe(doppelt);
    expect(d[1]).toBe(`${d[0]}-2`);
    expect(liste.find(e => e.index === 2)!.anker).toBe(a[2]);
  });
  it('nur eigene Notizen lassen sich ändern und löschen', () => {
    const a = ankerListe(verlauf);
    expect(darfBearbeiten(verlauf[2], 'kevin')).toBe(true);
    expect(darfBearbeiten(verlauf[2], 'malin')).toBe(false);
    expect(darfBearbeiten(verlauf[0], 'kevin')).toBe(false);
    const neu = notizAendern(verlauf, a[2], ' Kurz halten. ', 'kevin')!;
    expect(neu[2].text).toBe('Kurz halten.');
    expect(neu).toHaveLength(verlauf.length);
    expect(notizAendern(verlauf, a[2], '   ', 'kevin')).toBeNull();
    expect(notizAendern(verlauf, a[2], 'x', 'malin')).toBeNull();
    expect(notizAendern(verlauf, a[0], 'x', 'kevin')).toBeNull();
    const weg = notizLoeschen(verlauf, a[2], 'kevin')!;
    expect(weg).toHaveLength(verlauf.length - 1);
    expect(weg.some(x => x.art === 'notiz')).toBe(false);
    expect(notizLoeschen(verlauf, a[2], 'malin')).toBeNull();
  });
  it('Bezug wird zu Deal/Event mit Titel', () => {
    expect(bezugAufloesen('ch-1', crm)).toEqual({ art: 'deal', id: 'ch-1', titel: 'Kapitalmarkt-Diagnose' });
    expect(bezugAufloesen('ev-x', crm)).toBeNull();
    expect(bezugAufloesen(undefined, crm)).toBeNull();
    const e: Eintrag = nach(ankerListe(verlauf)[7]);
    expect(e.bezug).toBe('ch-1');
  });
  it('ohne CRM-Bestand nur der Verlauf', () => {
    const l = aufbereiten(person, null, { heute: HEUTE, jetzt: JETZT });
    expect(l).toHaveLength(verlauf.length);
  });
});
