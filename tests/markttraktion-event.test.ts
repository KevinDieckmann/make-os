// ─── Markttraktion · Event zu zweit ─────────────────────────────────────────
// Event verantwortet Malin, Kevin arbeitet mit. Geprüft wird die reine Logik
// aus lib/crm/eventplanung.ts: wer einlädt und nachfasst (Standard: wer die
// Beziehung hält), wer einen Checklisten-Punkt erledigt und damit die
// Aufgabe bekommt, wann eine Aufgabe beim Umverteilen mitzieht, was bei wem
// liegt, die Nachfass-Gruppen und die Teil-Änderungen für zwei Geräte.

import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Event, Teilnahme } from '../lib/crm/typen';
import { leererBestand, wendeCrmAn } from '../lib/crm/speicher';
import {
  einlader, einladerMit, punktWer, aufgabenBearbeiter, checklisteAlsAufgaben, aufgabeAbgleichen, punktAendern,
  arbeitJePerson, nachfassGruppen, teilAenderung, type ChecklistenPunkt,
} from '../lib/crm/eventplanung';

const HEUTE = '2026-09-25';
const JETZT = '2026-09-25T08:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-1', titel: 'Stammtisch Maschinenbau', format: 'stammtisch', ziel: 'drei Folgegespräche', datum: '2026-10-30', status: 'geplant', geaendert: HEUTE, ...x });
const t = (kontakt: string, status: Teilnahme['status'], x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${kontakt}`, eventId: 'ev-1', kontaktId: `c-${kontakt}`, status, geaendert: HEUTE, ...x });
const punkt = (id: string, tageVorher: number, x: Partial<ChecklistenPunkt> = {}): ChecklistenPunkt => ({ id, text: `Punkt ${id}`, tageVorher, erledigt: false, ...x });

describe('Wer lädt ein und fasst nach', () => {
  it('eingetragen vor Beziehung; ohne Eintrag am Kontakt hält Sales (Kevin) die Beziehung', () => {
    expect(einladerMit(t('a', 'vorgemerkt', { einladenDurch: 'malin' }), k('a', { besitzer: 'kevin' }), ev())).toEqual({ person: 'malin', quelle: 'eingetragen' });
    expect(einladerMit(t('a', 'vorgemerkt'), k('a', { besitzer: 'malin' }), ev())).toEqual({ person: 'malin', quelle: 'beziehung' });
    expect(einladerMit(t('a', 'vorgemerkt'), k('a'), ev())).toEqual({ person: 'kevin', quelle: 'beziehung' });
  });

  it('halten beide die Beziehung oder fehlt der Kontakt: die Event-Zuständigkeit — bei „beide“ die Verantwortung (Malin)', () => {
    const beide = k('a', { besitzer: 'beide' });
    expect(einladerMit(t('a', 'vorgemerkt'), beide, ev())).toEqual({ person: 'malin', quelle: 'event' });
    expect(einlader(t('a', 'vorgemerkt'), beide, ev({ zustaendig: 'kevin' }))).toBe('kevin');
    expect(einlader(t('a', 'vorgemerkt'), beide, ev({ zustaendig: 'beide' }))).toBe('malin');
    expect(einlader(t('a', 'vorgemerkt'), undefined, ev({ zustaendig: 'kevin' }))).toBe('kevin');
    // „beide“ als Einlader gibt es nicht (der Säuberer lässt es weg) — dann gilt der Standard.
    expect(einlader(t('a', 'vorgemerkt', { einladenDurch: 'beide' }), k('a', { besitzer: 'malin' }), ev())).toBe('malin');
  });
});

describe('Checkliste: wer erledigt, wer bekommt die Aufgabe', () => {
  it('punktWer: eingetragen, sonst die Event-Zuständigkeit (Standard Malin), „beide“ bleibt „beide“', () => {
    expect(punktWer({ wer: 'kevin' }, ev())).toBe('kevin');
    expect(punktWer({}, ev())).toBe('malin');
    expect(punktWer({}, ev({ zustaendig: 'kevin' }))).toBe('kevin');
    expect(punktWer({}, ev({ zustaendig: 'beide' }))).toBe('beide');
    expect(aufgabenBearbeiter('beide')).toBe('both');
    expect(aufgabenBearbeiter('kevin')).toBe('kevin');
  });

  it('„Als Aufgaben anlegen“ weist jede Aufgabe der Person des Punktes zu — nicht der, die klickt', () => {
    const e = ev({ checkliste: [punkt('a', 28, { wer: 'kevin' }), punkt('b', 21), punkt('c', 14, { wer: 'beide' }), punkt('d', 7, { erledigt: true, wer: 'kevin' })] });
    const r = checklisteAlsAufgaben(e, new Set(), 'kevin', JETZT);
    expect(r.neu.map(a => [a.id, a.assignee])).toEqual([['ev-ev-1-a', 'kevin'], ['ev-ev-1-b', 'malin'], ['ev-ev-1-c', 'both']]);
    expect(r.neu[1].description).toContain('angelegt von Kevin');
    expect(r.neu[1].description).toContain('/os/markttraktion?s=event&k=ev-1');
    // Event an Kevin übergeben → Punkte ohne eigene Person gehen mit.
    expect(checklisteAlsAufgaben({ ...e, zustaendig: 'kevin' }, new Set(), 'malin', JETZT).neu.map(a => a.assignee)).toEqual(['kevin', 'kevin', 'both']);
  });
});

describe('Punkt umverteilt, abgehakt, verschoben → Aufgabe zieht mit, wenn ohne Risiko', () => {
  const e = ev();
  const vorher = punkt('a', 21, { aufgabeId: 'ev-ev-1-a' });
  const offen = { status: 'todo', assignee: 'malin', dueDate: '2026-10-09', title: 'Punkt a — Stammtisch Maschinenbau' };

  it('umverteilen: offene Aufgabe bei der bisherigen Person zieht mit', () => {
    expect(aufgabeAbgleichen(offen, e, vorher, { ...vorher, wer: 'kevin' })).toEqual({ patch: { assignee: 'kevin' }, hinweise: [] });
    // Zurück auf „wie Event“ (Eintrag weg) — Malin ist Standard.
    expect(aufgabeAbgleichen({ ...offen, assignee: 'kevin' }, e, { ...vorher, wer: 'kevin' }, vorher).patch).toEqual({ assignee: 'malin' });
    // Liegt schon richtig → nichts zu tun.
    expect(aufgabeAbgleichen({ ...offen, assignee: 'kevin' }, e, vorher, { ...vorher, wer: 'kevin' })).toEqual({ patch: {}, hinweise: [] });
  });

  it('von Hand umgehängt oder schon erledigt: kein Zugriff, nur ein Hinweis', () => {
    const vonHand = aufgabeAbgleichen({ ...offen, assignee: 'both' }, e, vorher, { ...vorher, wer: 'kevin' });
    expect(vonHand.patch).toEqual({});
    expect(vonHand.hinweise[0]).toMatch(/liegt bei Beide .*umgehängt/);
    const fertig = aufgabeAbgleichen({ ...offen, status: 'done' }, e, vorher, { ...vorher, wer: 'kevin' });
    expect(fertig.patch).toEqual({});
    expect(fertig.hinweise[0]).toMatch(/schon erledigt/);
    const weg = aufgabeAbgleichen(undefined, e, vorher, { ...vorher, wer: 'kevin' });
    expect(weg.hinweise[0]).toMatch(/nicht mehr/);
  });

  it('abhaken und wieder öffnen: Status folgt — geöffnet wird nur, was erledigt war', () => {
    expect(aufgabeAbgleichen(offen, e, vorher, { ...vorher, erledigt: true }).patch).toEqual({ status: 'done' });
    expect(aufgabeAbgleichen({ ...offen, status: 'done' }, e, { ...vorher, erledigt: true }, vorher).patch).toEqual({ status: 'todo' });
    expect(aufgabeAbgleichen({ ...offen, status: 'in-progress' }, e, { ...vorher, erledigt: true }, vorher).patch).toEqual({});
  });

  it('Vorlauf und Text: Fälligkeit und Titel nur, wenn sie noch dem alten Stand entsprechen', () => {
    expect(aufgabeAbgleichen(offen, e, vorher, { ...vorher, tageVorher: 14 }).patch).toEqual({ dueDate: '2026-10-16' });
    const vonHand = aufgabeAbgleichen({ ...offen, dueDate: '2026-10-01' }, e, vorher, { ...vorher, tageVorher: 14 });
    expect(vonHand.patch).toEqual({});
    expect(vonHand.hinweise[0]).toMatch(/von Hand/);
    expect(aufgabeAbgleichen(offen, e, vorher, { ...vorher, text: 'Neu' }).patch).toEqual({ title: 'Neu — Stammtisch Maschinenbau' });
    expect(aufgabeAbgleichen({ ...offen, title: 'Eigener Titel' }, e, vorher, { ...vorher, text: 'Neu' }).patch).toEqual({});
  });
});

describe('Einen Punkt ändern — auf dem Stand des Servers', () => {
  const liste = [punkt('a', 21), punkt('b', 7, { wer: 'kevin' })];

  it('neu, ändern, weg — geprüft wie im Säuberer', () => {
    const neu = punktAendern(liste, { op: 'neu', punkt: { id: 'cl-x1', text: '  Co-Host briefen ', tageVorher: 500, wer: 'Kevin' } })!;
    expect(neu.nachher).toEqual({ id: 'cl-x1', text: 'Co-Host briefen', tageVorher: 120, erledigt: false, wer: 'kevin' });
    expect(neu.liste).toHaveLength(3);
    expect(punktAendern(liste, { op: 'neu', punkt: { id: 'a', text: 'doppelt', tageVorher: 1 } })).toBeNull();
    expect(punktAendern(liste, { op: 'neu', punkt: { id: 'cl-y', text: '   ', tageVorher: 1 } })).toBeNull();
    expect(punktAendern(liste, { op: 'neu', punkt: { id: 'böse id', text: 'x', tageVorher: 1 } })).toBeNull();

    const ae = punktAendern(liste, { op: 'aendern', id: 'b', felder: { erledigt: true, tageVorher: -99, wer: '' } })!;
    expect(ae.vorher).toEqual(liste[1]);
    expect(ae.nachher).toEqual({ id: 'b', text: 'Punkt b', tageVorher: -30, erledigt: true });
    expect(punktAendern(liste, { op: 'aendern', id: 'a', felder: { wer: 'jemand' } })!.nachher!.wer).toBeUndefined();
    expect(punktAendern(liste, { op: 'aendern', id: 'a', felder: { text: '' } })).toBeNull();
    expect(punktAendern(liste, { op: 'aendern', id: 'gibtsnicht', felder: { erledigt: true } })).toBeNull();

    const weg = punktAendern(liste, { op: 'weg', id: 'a' })!;
    expect(weg.liste.map(p => p.id)).toEqual(['b']);
    expect(weg.nachher).toBeUndefined();
  });

  it('zwei Personen, zwei Punkte, gleichzeitig: beide Änderungen bleiben', () => {
    // Kevin hakt a ab, Malin verteilt b um — beide auf dem jeweils aktuellen Stand.
    const nachKevin = punktAendern(liste, { op: 'aendern', id: 'a', felder: { erledigt: true } })!.liste;
    const nachMalin = punktAendern(nachKevin, { op: 'aendern', id: 'b', felder: { wer: 'malin' } })!.liste;
    expect(nachMalin).toEqual([{ ...liste[0], erledigt: true }, { ...liste[1], wer: 'malin' }]);
  });
});

describe('Was bei wem liegt', () => {
  const kontakte = [k('anna', { besitzer: 'kevin' }), k('ben', { besitzer: 'malin' }), k('cem'), k('dora', { besitzer: 'malin' }), k('emil', { besitzer: 'malin' })];
  const e = ev({
    datum: '2026-10-02',
    checkliste: [punkt('a', 14, { wer: 'kevin' }), punkt('b', 3), punkt('c', 7, { wer: 'beide' }), punkt('d', 1, { erledigt: true })],
  });
  const teilnahmen = [
    t('anna', 'vorgemerkt'), t('ben', 'vorgemerkt'), t('cem', 'zugesagt'), t('dora', 'da'), t('emil', 'da', { followUpAm: '2026-10-03', einladenDurch: 'kevin' }),
    t('ben', 'da', { id: 't-anderes', eventId: 'ev-2' }),
  ];

  it('Zähler je Person: Punkte (beide zählt bei beiden, fällig bis heute), Gäste, noch einzuladen, nachfassen', () => {
    const a = arbeitJePerson(e, teilnahmen, kontakte, HEUTE);
    // a fällig 18.09., b 29.09., c 25.09. (heute) — d erledigt.
    expect(a.kevin).toEqual({ punkteOffen: 2, punkteFaellig: 2, gaeste: 3, einladen: 1, zugesagt: 2, nachfassen: 0 });
    expect(a.malin).toEqual({ punkteOffen: 2, punkteFaellig: 1, gaeste: 2, einladen: 1, zugesagt: 1, nachfassen: 1 });
    // „Kevin lädt 3 ein · Malin 2“ — die Summe ist die ganze Liste dieses Events.
    expect(a.kevin.gaeste + a.malin.gaeste).toBe(5);
    // Mit Map statt Liste dasselbe.
    expect(arbeitJePerson(e, teilnahmen, new Map(kontakte.map(x => [x.id, x])), HEUTE)).toEqual(a);
  });

  it('Nachfass-Gruppen: „Deine Gäste“ zuerst, dann die der/des anderen', () => {
    const offen = teilnahmen.filter(x => x.eventId === 'ev-1' && x.status !== 'vorgemerkt').map(x => ({ t: x, k: kontakte.find(y => y.id === x.kontaktId) }));
    const fuerKevin = nachfassGruppen(offen, e, 'kevin');
    expect(fuerKevin.map(g => [g.person, g.eigene, g.liste.map(x => x.t.kontaktId)])).toEqual([['kevin', true, ['c-cem', 'c-emil']], ['malin', false, ['c-dora']]]);
    expect(nachfassGruppen(offen, e, 'malin').map(g => [g.person, g.eigene])).toEqual([['malin', true], ['kevin', false]]);
    expect(nachfassGruppen(offen, e, null).map(g => [g.person, g.eigene])).toEqual([['kevin', false], ['malin', false]]);
    // Leere Gruppen bleiben da — die Oberfläche sagt „bei dir ist alles nachgefasst“.
    expect(nachfassGruppen([], e, 'kevin').map(g => g.liste.length)).toEqual([0, 0]);
  });
});

describe('Teil-Änderungen: zwei Geräte am selben Event', () => {
  it('nur Geändertes; „entfernen“ geht als leerer Wert, Listen werden inhaltlich verglichen', () => {
    const e = ev({ ort: 'Frankfurt', ablauf: [{ zeit: '18:30', punkt: 'Ankommen' }] });
    expect(teilAenderung(e, { ort: 'Frankfurt', titel: 'Neu' })).toEqual({ titel: 'Neu' });
    expect(teilAenderung(e, { ort: undefined, zielgruppe: undefined })).toEqual({ ort: '' });
    expect(teilAenderung(e, { ablauf: [{ zeit: '18:30', punkt: 'Ankommen' }] })).toEqual({});
    expect(teilAenderung(e, { ablauf: [] })).toEqual({ ablauf: [] });
  });

  it('auf dem Server: Kevin ändert den Ort, Malin gleichzeitig das Ziel — beides bleibt; leer nimmt Felder weg', () => {
    const e = ev({ ort: 'Frankfurt', zustaendig: 'malin' });
    const gast = t('anna1', 'zugesagt', { einladenDurch: 'malin', notiz: 'kennt Ben' });
    const b0 = { ...leererBestand(), events: [e], teilnahmen: [gast] };
    const b1 = wendeCrmAn(b0, [{ liste: 'events', op: 'teil', id: e.id, felder: teilAenderung(e, { ort: 'Mainz' }) }], JETZT, 'kevin').bestand;
    const b2 = wendeCrmAn(b1, [{ liste: 'events', op: 'teil', id: e.id, felder: teilAenderung(e, { ziel: 'fünf Folgegespräche' }) }], JETZT, 'malin').bestand;
    expect(b2.events[0]).toMatchObject({ ort: 'Mainz', ziel: 'fünf Folgegespräche', zustaendig: 'malin', geaendertVon: 'malin' });

    // Am Einlass: Kevin checkt ein, Malin schreibt die Notiz — und „lädt ein“ zurück auf den Standard.
    const b3 = wendeCrmAn(b2, [{ liste: 'teilnahmen', op: 'teil', id: gast.id, felder: teilAenderung(gast, { status: 'da' }) }], JETZT, 'kevin').bestand;
    expect(b3.teilnahmen[0]).toMatchObject({ status: 'da', notiz: 'kennt Ben', einladenDurch: 'malin', geaendertVon: 'kevin' });
    const b4 = wendeCrmAn(b3, [{ liste: 'teilnahmen', op: 'teil', id: gast.id, felder: teilAenderung(gast, { einladenDurch: undefined, notiz: undefined }) }], JETZT, 'malin').bestand;
    expect(b4.teilnahmen[0].status).toBe('da');
    expect(b4.teilnahmen[0].einladenDurch).toBeUndefined();
    expect(b4.teilnahmen[0].notiz).toBeUndefined();
  });
});
