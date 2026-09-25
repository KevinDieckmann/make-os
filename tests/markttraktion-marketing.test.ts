// ─── Markttraktion · Marketing zu zweit — Autor, Stimme, Freigabe, Zahlen je Person
// Regeln aus lib/crm/marketing.ts (25.09.): Marketing verantwortet Malin; ein
// Beitrag im Namen einer Person, die ihn nicht selbst schreibt, braucht vor
// „geplant“/„veröffentlicht“ ihr Okay. Newsletter: Freigabe auf Wunsch.

import { describe, it, expect } from 'vitest';
import type { Beitrag, Freigabe, NewsletterAusgabe } from '../lib/crm/typen';
import {
  freigabeNoetig, freigabeStand, planSperre, darfPlanen, beitragStatusWechsel, beitragNachTextAenderung, rollenWechsel,
  freigabeAnfrage, freigabeOk, aenderungsWunsch, ausgabeFreigabeStand, ausgabeSperre, ausgabeStatusWechsel, ausgabeNachTextAenderung,
  freigabeLage, liegtBei, beitraegeJePerson, wocheWerSchreibt, redaktionFuerMich, naechsterSchritt, ausgabeNaechsterSchritt,
  autorVon, stimmPerson, stimmeText, genitiv, STIMMEN_WAHL,
} from '../lib/crm/marketing';

const HEUTE = '2026-09-25'; // Freitag, KW 39 (21.–27.9.)
const JETZT = '2026-09-25T10:00:00.000Z';
const b = (id: string, x: Partial<Beitrag> = {}): Beitrag => ({ id: `bt-${id}`, titel: id, kanal: 'linkedin', status: 'entwurf', wirkung: [], quellen: [], geaendert: HEUTE, ...x });
const nl = (id: string, x: Partial<NewsletterAusgabe> = {}): NewsletterAusgabe => ({ id: `nl-${id}`, titel: id, status: 'entwurf', inhalt: 'Text', beitragIds: [], geaendert: HEUTE, ...x });
const fg = (status: Freigabe['status'], an: string, x: Partial<Freigabe> = {}): Freigabe => ({ status, an, von: 'malin', am: '2026-09-24T09:00:00.000Z', ...x });

/** Malin schreibt (Standard, ohne Eintrag), erscheint in Kevins Namen. */
const fuerKevin = (x: Partial<Beitrag> = {}) => b('fuer-kevin', { stimme: 'kevin', ...x });

describe('Autor und Stimme', () => {
  it('ohne Eintrag schreibt Malin (Verantwortung Marketing)', () => {
    expect(autorVon({})).toBe('malin');
    expect(autorVon({ zustaendig: 'kevin' })).toBe('kevin');
    expect(autorVon({ zustaendig: 'beide' })).toBe('beide');
  });
  it('Stimme: Person oder Marke — „beide“ und Unbekanntes sind keine Person', () => {
    expect(stimmPerson({ stimme: 'kevin' })).toBe('kevin');
    expect(stimmPerson({ stimme: 'marke' })).toBeNull();
    expect(stimmPerson({ stimme: 'beide' })).toBeNull();
    expect(stimmPerson({})).toBeNull();
    expect(stimmeText('marke')).toBe('Marke');
    expect(stimmeText(undefined)).toBe('offen');
    expect(STIMMEN_WAHL.map(s => s.id)).toEqual(['kevin', 'malin', 'marke']);
  });
  it('Genitiv: Kevins, Malins — bei s-Endung nur Apostroph', () => {
    expect(genitiv('Kevin')).toBe('Kevins');
    expect(genitiv('Malin')).toBe('Malins');
    expect(genitiv('Klaus')).toBe('Klaus’');
  });
});

describe('Freigabe nötig?', () => {
  it('nur, wenn die Stimme eine Person ist, die nicht selbst (mit)schreibt', () => {
    expect(freigabeNoetig(fuerKevin())).toBe(true);
    expect(freigabeNoetig(b('x', { stimme: 'malin' }))).toBe(false);
    expect(freigabeNoetig(fuerKevin({ zustaendig: 'kevin' }))).toBe(false);
    expect(freigabeNoetig(fuerKevin({ zustaendig: 'beide' }))).toBe(false);
    expect(freigabeNoetig(b('x', { stimme: 'malin', zustaendig: 'kevin' }))).toBe(true);
    expect(freigabeNoetig(b('x', { stimme: 'marke' }))).toBe(false);
    expect(freigabeNoetig(b('x'))).toBe(false);
  });
  it('Stand: fehlt · offen · aenderung · ok — eine Freigabe an jemand anderen zählt nicht', () => {
    expect(freigabeStand(b('x', { stimme: 'marke' }))).toBe('nicht_noetig');
    expect(freigabeStand(fuerKevin())).toBe('fehlt');
    expect(freigabeStand(fuerKevin({ freigabe: fg('offen', 'kevin') }))).toBe('offen');
    expect(freigabeStand(fuerKevin({ freigabe: fg('aenderung', 'kevin', { notiz: 'kürzer' }) }))).toBe('aenderung');
    expect(freigabeStand(fuerKevin({ freigabe: fg('ok', 'kevin') }))).toBe('ok');
    expect(freigabeStand(fuerKevin({ freigabe: fg('ok', 'malin') }))).toBe('fehlt');
  });
});

describe('darfPlanen / planSperre', () => {
  it('ohne Freigabe darf der Autor nicht planen — die Stimme selbst schon', () => {
    const x = fuerKevin();
    expect(darfPlanen(x, 'malin')).toBe(false);
    expect(planSperre(x, 'malin')).toBe('Erscheint in Kevins Namen — vor dem Planen zur Freigabe an Kevin.');
    expect(darfPlanen(x, 'kevin')).toBe(true);
    expect(darfPlanen(x, null)).toBe(false);
  });
  it('offen und Änderungswunsch sperren, ok gibt frei', () => {
    expect(planSperre(fuerKevin({ freigabe: fg('offen', 'kevin') }), 'malin')).toBe('Wartet auf Kevins Freigabe.');
    expect(planSperre(fuerKevin({ freigabe: fg('aenderung', 'kevin') }), 'malin')).toMatch(/^Kevin wünscht eine Änderung/);
    expect(darfPlanen(fuerKevin({ freigabe: fg('ok', 'kevin') }), 'malin')).toBe(true);
  });
  it('ohne nötige Freigabe darf jede Person planen', () => {
    expect(darfPlanen(b('x', { stimme: 'malin' }), 'kevin')).toBe(true);
    expect(darfPlanen(b('x', { stimme: 'marke' }), null)).toBe(true);
  });
});

describe('Statuswechsel Beitrag', () => {
  it('„Geplant“ ist gesperrt, zurück zu „Entwurf“ geht immer', () => {
    expect(beitragStatusWechsel(fuerKevin(), 'geplant', 'malin', HEUTE, JETZT)).toEqual({ ok: false, grund: 'Erscheint in Kevins Namen — vor dem Planen zur Freigabe an Kevin.' });
    expect(beitragStatusWechsel(fuerKevin({ status: 'geplant' }), 'entwurf', 'malin', HEUTE, JETZT)).toEqual({ ok: true, felder: { status: 'entwurf' } });
  });
  it('plant die Stimme selbst, wird ihr Okay mit eingetragen (Anfrage bleibt vermerkt)', () => {
    const r = beitragStatusWechsel(fuerKevin({ freigabe: fg('offen', 'kevin') }), 'geplant', 'kevin', HEUTE, JETZT);
    expect(r).toEqual({ ok: true, felder: { status: 'geplant', freigabe: { status: 'ok', an: 'kevin', von: 'malin', am: JETZT } } });
  });
  it('mit Okay kein neues Freigabe-Feld; „Veröffentlicht“ ohne Datum bekommt heute', () => {
    expect(beitragStatusWechsel(fuerKevin({ freigabe: fg('ok', 'kevin') }), 'veroeffentlicht', 'malin', HEUTE, JETZT)).toEqual({ ok: true, felder: { status: 'veroeffentlicht', datum: HEUTE } });
    expect(beitragStatusWechsel(b('x', { stimme: 'marke', datum: '2026-09-20' }), 'veroeffentlicht', 'malin', HEUTE, JETZT)).toEqual({ ok: true, felder: { status: 'veroeffentlicht' } });
  });
});

describe('Freigabe-Aktionen', () => {
  it('anfragen, freigeben, Änderung wünschen (nur mit Notiz)', () => {
    expect(freigabeAnfrage('kevin', 'malin', JETZT)).toEqual({ status: 'offen', an: 'kevin', von: 'malin', am: JETZT });
    expect(freigabeAnfrage('kevin', null, JETZT)).toEqual({ status: 'offen', an: 'kevin', am: JETZT });
    expect(freigabeOk(fg('offen', 'kevin', { notiz: 'alt' }), 'kevin', JETZT)).toEqual({ status: 'ok', an: 'kevin', von: 'malin', am: JETZT });
    expect(aenderungsWunsch(fg('offen', 'kevin'), 'kevin', '   ', JETZT)).toBeNull();
    expect(aenderungsWunsch(fg('offen', 'kevin'), 'kevin', ' Einstieg schärfer ', JETZT)).toEqual({ status: 'aenderung', an: 'kevin', von: 'malin', am: JETZT, notiz: 'Einstieg schärfer' });
  });
  it('Textänderung nach dem Okay: liegt wieder bei der Stimme — außer die Stimme ändert selbst', () => {
    const x = fuerKevin({ freigabe: fg('ok', 'kevin') });
    expect(beitragNachTextAenderung(x, 'malin', JETZT)).toEqual({ status: 'offen', an: 'kevin', von: 'malin', am: JETZT, notiz: 'Nach der Freigabe geändert — bitte noch einmal ansehen.' });
    expect(beitragNachTextAenderung(x, 'kevin', JETZT)).toBeNull();
    expect(beitragNachTextAenderung({ ...x, status: 'veroeffentlicht' }, 'malin', JETZT)).toBeNull();
    expect(beitragNachTextAenderung(fuerKevin({ freigabe: fg('offen', 'kevin') }), 'malin', JETZT)).toBeNull();
    expect(beitragNachTextAenderung(b('x', { stimme: 'malin', freigabe: fg('ok', 'malin') }), 'kevin', JETZT)).toBeNull();
  });
  it('Autor oder Stimme wechseln: unpassende Freigabe fällt weg, passende bleibt', () => {
    const x = fuerKevin({ freigabe: fg('offen', 'kevin') });
    expect(rollenWechsel(x, { stimme: 'malin' })).toEqual({ stimme: 'malin', freigabe: null });
    expect(rollenWechsel(x, { stimme: 'marke' })).toEqual({ stimme: 'marke', freigabe: null });
    expect(rollenWechsel(x, { zustaendig: 'kevin' })).toEqual({ zustaendig: 'kevin', freigabe: null });
    expect(rollenWechsel(x, { zustaendig: 'beide' })).toEqual({ zustaendig: 'beide', freigabe: null });
    expect(rollenWechsel(x, { zustaendig: 'malin' })).toEqual({ zustaendig: 'malin' });
    expect(rollenWechsel(fuerKevin(), { stimme: 'malin' })).toEqual({ stimme: 'malin' });
  });
});

describe('Newsletter-Freigabe', () => {
  it('ohne Anfrage frei; angefragt sperrt sie bis zum Okay — die angefragte Person darf', () => {
    expect(ausgabeFreigabeStand(nl('a'))).toBe('nicht_noetig');
    expect(ausgabeSperre(nl('a'), 'malin')).toBeNull();
    const a = nl('a', { freigabe: fg('offen', 'kevin') });
    expect(ausgabeSperre(a, 'malin')).toBe('Wartet auf Kevins Freigabe.');
    expect(ausgabeSperre(a, 'kevin')).toBeNull();
    expect(ausgabeStatusWechsel(a, 'bereit', 'malin', HEUTE, JETZT).ok).toBe(false);
    expect(ausgabeStatusWechsel(a, 'bereit', 'kevin', HEUTE, JETZT)).toEqual({ ok: true, felder: { status: 'bereit', freigabe: { status: 'ok', an: 'kevin', von: 'malin', am: JETZT } } });
    expect(ausgabeStatusWechsel(nl('b', { freigabe: fg('ok', 'kevin') }), 'versendet', 'malin', HEUTE, JETZT)).toEqual({ ok: true, felder: { status: 'versendet', datum: HEUTE } });
  });
  it('Textänderung nach dem Okay: wieder offen — nicht nach dem Versand', () => {
    expect(ausgabeNachTextAenderung(nl('a', { freigabe: fg('ok', 'kevin') }), 'malin', JETZT)).toMatchObject({ status: 'offen', an: 'kevin', von: 'malin' });
    expect(ausgabeNachTextAenderung(nl('a', { freigabe: fg('ok', 'kevin') }), 'kevin', JETZT)).toBeNull();
    expect(ausgabeNachTextAenderung(nl('a', { status: 'versendet', freigabe: fg('ok', 'kevin') }), 'malin', JETZT)).toBeNull();
  });
  it('nächster Schritt', () => {
    expect(ausgabeNaechsterSchritt(nl('a', { inhalt: '' }), 'malin', 3)).toBe('Inhalt schreiben — eine Einsicht, konkret.');
    expect(ausgabeNaechsterSchritt(nl('a', { freigabe: fg('offen', 'kevin') }), 'kevin', 3)).toBe('Lesen, dann freigeben oder Änderung wünschen.');
    expect(ausgabeNaechsterSchritt(nl('a', { status: 'bereit' }), 'malin', 0)).toBe('Ohne Empfänger mit Double-Opt-in nicht versenden.');
    expect(ausgabeNaechsterSchritt(nl('a', { status: 'versendet' }), 'malin', 3)).toMatch(/^Empfänger, Antworten und Abmeldungen/);
  });
});

describe('Was bei wem liegt', () => {
  const beitraege = [
    fuerKevin({ id: 'bt-a', titel: 'A', freigabe: fg('offen', 'kevin', { am: '2026-09-23T08:00:00.000Z' }) }),
    fuerKevin({ id: 'bt-b', titel: 'B', freigabe: fg('aenderung', 'kevin', { notiz: 'kürzer', am: '2026-09-22T08:00:00.000Z' }) }),
    fuerKevin({ id: 'bt-c', titel: 'C', status: 'geplant', datum: '2026-09-26' }),
    fuerKevin({ id: 'bt-d', titel: 'D' }), // Entwurf, nie angefragt — noch Arbeit am Text, nicht „wartet“
    fuerKevin({ id: 'bt-e', titel: 'E', status: 'veroeffentlicht', freigabe: fg('offen', 'kevin') }),
    b('f', { stimme: 'malin', freigabe: fg('offen', 'kevin') }), // Freigabe passt nicht mehr zur Stimme
  ];
  const newsletter = [nl('n', { titel: 'N', zustaendig: 'kevin', freigabe: fg('offen', 'malin', { von: 'kevin', am: '2026-09-24T12:00:00.000Z' }) }), nl('v', { status: 'versendet', freigabe: fg('offen', 'malin') })];
  it('offen bei der Stimme, Änderungswunsch zurück beim Autor, geplant ohne Okay beim Autor — am längsten Wartendes zuerst', () => {
    const l = freigabeLage({ beitraege, newsletter });
    expect(l.map(p => [p.id, p.stand, p.bei])).toEqual([
      ['bt-b', 'aenderung', 'malin'],
      ['bt-a', 'offen', 'kevin'],
      ['nl-n', 'offen', 'malin'],
      ['bt-c', 'fehlt', 'malin'],
    ]);
    expect(l[0]).toMatchObject({ art: 'beitrag', an: 'kevin', autor: 'malin', notiz: 'kürzer' });
    expect(l[2]).toMatchObject({ art: 'newsletter', autor: 'kevin', von: 'kevin' });
  });
  it('„beide“ liegt bei beiden', () => {
    expect(liegtBei({ bei: 'beide' }, 'kevin')).toBe(true);
    expect(liegtBei({ bei: 'malin' }, 'kevin')).toBe(false);
    expect(liegtBei({ bei: 'malin' }, null)).toBe(false);
  });
  it('Für dich im Redaktionsplan: Freigabe → Änderung → fällig → anfragen → Wirkung', () => {
    const l = [
      ...beitraege,
      b('heute', { titel: 'Heute', status: 'geplant', datum: HEUTE }),
      b('wirkung', { titel: 'Ohne Wirkung', status: 'veroeffentlicht', datum: '2026-09-20' }),
      fuerKevin({ id: 'bt-fertig', titel: 'Fertig', text: 'Entwurfstext' }),
    ];
    expect(redaktionFuerMich(l, 'kevin', HEUTE).map(x => [x.titel, x.art])).toEqual([['A', 'freigabe']]);
    expect(redaktionFuerMich(l, 'malin', HEUTE).map(x => [x.titel, x.art])).toEqual([['B', 'aenderung'], ['Heute', 'faellig'], ['C', 'anfragen'], ['Fertig', 'anfragen'], ['Ohne Wirkung', 'wirkung']]);
    expect(redaktionFuerMich(l, 'malin', HEUTE)[0].was).toBe('Kevin wünscht eine Änderung: „kürzer“');
    expect(redaktionFuerMich(l, null, HEUTE)).toEqual([]);
  });
});

describe('Beiträge je Person', () => {
  it('ohne Beiträge grau (null) statt erfundener Null', () => {
    expect(beitraegeJePerson([], HEUTE)).toEqual([
      { person: 'kevin', veroeffentlicht: null, inIhremNamen: null, gespraeche: null, belege: [] },
      { person: 'malin', veroeffentlicht: null, inIhremNamen: null, gespraeche: null, belege: [] },
    ]);
  });
  it('zählt beim Autor im Zeitraum, gemeinsame bei beiden; Gespräche je Person und Beitrag einmal', () => {
    const l = [
      b('m1', { status: 'veroeffentlicht', datum: '2026-09-20', stimme: 'kevin', freigabe: fg('ok', 'kevin'), wirkung: [
        { kontaktId: 'c-a', art: 'anfrage', am: '2026-09-21' }, { kontaktId: 'c-a', art: 'gespraech', am: '2026-09-22' }, { kontaktId: 'c-b', art: 'reaktion', am: '2026-09-21' },
      ] }),
      b('m2', { status: 'veroeffentlicht', datum: '2026-09-10', stimme: 'malin' }),
      b('alt', { status: 'veroeffentlicht', datum: '2026-08-01', wirkung: [{ kontaktId: 'c-c', art: 'gespraech', am: '2026-08-02' }] }),
      b('gemeinsam', { zustaendig: 'beide', status: 'veroeffentlicht', datum: '2026-09-24', stimme: 'marke', wirkung: [{ kontaktId: 'c-d', art: 'gespraech', am: HEUTE }] }),
      b('kevin-idee', { zustaendig: 'kevin', status: 'idee' }),
    ];
    const [kevin, malin] = beitraegeJePerson(l, HEUTE);
    expect(malin).toMatchObject({ veroeffentlicht: 3, inIhremNamen: 1, gespraeche: 2 });
    expect(malin.belege.map(x => x.id)).toEqual(['bt-gemeinsam', 'bt-m1', 'bt-m2']);
    expect(kevin).toMatchObject({ veroeffentlicht: 1, inIhremNamen: 1, gespraeche: 1 });
    // Kevin mit nur einer Idee: 0 veröffentlicht ist echt — Gespräche erst messbar, wenn etwas erschienen ist.
    expect(beitraegeJePerson([b('k', { zustaendig: 'kevin', status: 'idee' })], HEUTE)[0]).toMatchObject({ veroeffentlicht: 0, gespraeche: null, inIhremNamen: null });
  });
});

describe('Diese Woche: wer schreibt was', () => {
  it('Beiträge der Woche je Autor, Liegengebliebenes dabei, Beide nur wenn nötig', () => {
    const w = wocheWerSchreibt([
      b('mo', { datum: '2026-09-21', status: 'veroeffentlicht' }),
      b('so', { datum: '2026-09-27', status: 'geplant', stimme: 'kevin' }),
      b('k', { zustaendig: 'kevin', datum: '2026-09-23' }),
      b('liegen', { datum: '2026-09-10', status: 'geplant' }),
      b('erledigt', { datum: '2026-09-10', status: 'veroeffentlicht' }),
      b('naechste', { datum: '2026-09-28' }),
      b('ohne'),
    ], HEUTE);
    expect(w).toMatchObject({ von: '2026-09-21', bis: '2026-09-27' });
    expect(w.label).toMatch(/^KW 39/);
    expect(w.je.map(g => [g.person, g.beitraege.map(x => x.titel)])).toEqual([['kevin', ['k']], ['malin', ['liegen', 'mo', 'so']]]);
    expect(wocheWerSchreibt([b('x', { zustaendig: 'beide', datum: HEUTE })], HEUTE).je.map(g => g.person)).toEqual(['kevin', 'malin', 'beide']);
  });
});

describe('Nächster Schritt am Beitrag', () => {
  it('sagt je Stand und Person, was zu tun ist', () => {
    expect(naechsterSchritt(b('x', { status: 'idee' }), 'malin', HEUTE)).toBe('Entwurf schreiben — und festlegen, in wessen Namen es erscheint.');
    expect(naechsterSchritt(fuerKevin(), 'malin', HEUTE)).toBe('Fertig? Zur Freigabe an Kevin.');
    expect(naechsterSchritt(fuerKevin(), 'kevin', HEUTE)).toBe('Erscheint in deinem Namen: lesen und freigeben.');
    expect(naechsterSchritt(fuerKevin({ freigabe: fg('offen', 'kevin') }), 'malin', HEUTE)).toBe('Wartet auf Kevins Freigabe.');
    expect(naechsterSchritt(fuerKevin({ freigabe: fg('aenderung', 'kevin') }), 'malin', HEUTE)).toBe('Kevins Änderungswunsch einarbeiten, dann erneut zur Freigabe.');
    expect(naechsterSchritt(fuerKevin({ status: 'geplant', datum: '2026-09-20', freigabe: fg('ok', 'kevin') }), 'malin', HEUTE)).toBe('Überfällig — veröffentlichen oder neu planen.');
    expect(naechsterSchritt(b('x', { status: 'geplant', datum: HEUTE, stimme: 'malin' }), 'malin', HEUTE)).toBe('Heute veröffentlichen, dann Status und Link eintragen.');
    expect(naechsterSchritt(b('x', { status: 'veroeffentlicht', datum: HEUTE }), 'malin', HEUTE)).toBe('Wirkung eintragen: Wer hat reagiert, wer kam ins Gespräch?');
  });
});
