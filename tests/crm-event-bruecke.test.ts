// Brücke Event → Lead → Follow-up → Finanzen → Kalender (E8, 27.09.). Erfundene Daten.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Event, Lead, Teilnahme, Chance } from '../lib/crm/typen';
import { leadNachGespraech, leadZiel, hebtLead, NACHFASS_ERGEBNISSE, followUpEingabe, followUpMoeglich, planpostenAusEvent, planpostenId, liquiplanStand, uebernommenAm, LIQUIPLAN_KATEGORIE, kalenderTermin, terminBekannt, TERMIN_DAUER_MIN } from '../lib/crm/event-bruecke';
import { eventZahlen, feedbackZahlen } from '../lib/crm/events';

const HEUTE = '2026-09-27';
const JETZT = `${HEUTE}T10:00:00.000Z`;
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-1', titel: 'Stammtisch Maschinenbau', format: 'stammtisch', ziel: 'drei Folgegespräche', datum: '2026-09-25', uhrzeit: '18:30', ort: 'Frankfurt', status: 'durchgefuehrt', geaendert: JETZT, ...x });
const t = (kontakt: string, status: Teilnahme['status'], x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${kontakt}`, eventId: 'ev-1', kontaktId: `c-${kontakt}`, status, geaendert: JETZT, ...x });
const lead = (status: Lead['status'], x: Partial<Lead> = {}): Lead => ({ status, kriterien: { schmerz: 'ja', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, ...x });

describe('Brücke 1 · Lead heben nach Gespräch oder Termin', () => {
  it('Gespräch und Termin heben, „nur erledigt“ nicht', () => {
    expect(hebtLead('gespraech')).toBe(true);
    expect(hebtLead('termin')).toBe(true);
    expect(hebtLead('erledigt')).toBe(false);
    expect(NACHFASS_ERGEBNISSE.map(x => x.id)).toEqual(['gespraech', 'termin', 'erledigt']);
  });
  it('der Lead hängt an der Firma, ohne Firma an der Person', () => {
    expect(leadZiel(k('a', { firmaId: 'f-acme' }))).toEqual({ art: 'firma', id: 'f-acme' });
    expect(leadZiel(k('b'))).toEqual({ art: 'person', id: 'c-b' });
  });
  it('gesetzt „Neu“ und „Kontaktiert“ → „Im Gespräch“, Kernfragen und Fit bleiben', () => {
    const r = leadNachGespraech(lead('kontaktiert', { fit: 'ja', notiz: 'Inhaber kennt uns' }), [k('a')], false, JETZT, 'malin');
    expect(r).toMatchObject({ von: 'kontaktiert', nach: 'im_gespraech', gesetzt: true, geaendert: true });
    expect(r.lead).toMatchObject({ status: 'im_gespraech', fit: 'ja', notiz: 'Inhaber kennt uns', geaendert: JETZT, geaendertVon: 'malin' });
    expect(r.lead?.kriterien.schmerz).toBe('ja');
    expect(leadNachGespraech(lead('neu'), [k('a')], false, JETZT, 'kevin').nach).toBe('im_gespraech');
  });
  it('schon weiter (Qualifizierung, SQL, Kunde) bleibt — mit Grund, ohne neuen Lead', () => {
    for (const s of ['im_gespraech', 'qualifizierung', 'sql', 'kunde'] as const) {
      const r = leadNachGespraech(lead(s), [k('a')], false, JETZT, 'kevin');
      expect(r.geaendert).toBe(false);
      expect(r.nach).toBe(s);
      expect(r.lead).toBeUndefined();
      expect(r.grund).toMatch(/bleibt/);
    }
  });
  it('bewusst gesetztes „Kein Fit“ oder „Ruht“ bleibt — das entscheidet jemand, nicht ein Klick', () => {
    const r = leadNachGespraech(lead('kein_fit', { grund: 'zu klein' }), [k('a')], false, JETZT, 'kevin');
    expect(r).toMatchObject({ von: 'kein_fit', nach: 'kein_fit', gesetzt: true, geaendert: false });
    expect(r.grund).toMatch(/bewusst/);
    expect(leadNachGespraech(lead('ruht'), [k('a')], false, JETZT, 'kevin').geaendert).toBe(false);
  });
  it('ohne gesetzten Lead zählt der abgeleitete Stand: Personen „angesprochen“ → Kontaktiert → wird gehoben; offener Deal (SQL) nicht', () => {
    const r = leadNachGespraech(undefined, [k('a', { stufe: 'angesprochen' }), k('b')], false, JETZT, 'kevin');
    expect(r).toMatchObject({ von: 'kontaktiert', nach: 'im_gespraech', gesetzt: false, geaendert: true });
    expect(r.lead?.kriterien).toEqual({ schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' });
    expect(leadNachGespraech(undefined, [k('a')], true, JETZT, 'kevin')).toMatchObject({ von: 'sql', geaendert: false });
    // Nur abgeleitetes „Ruht“ (alle Personen ruhen) wird durch das Gespräch wieder lebendig.
    expect(leadNachGespraech(undefined, [k('a', { stufe: 'ruht' })], false, JETZT, 'kevin')).toMatchObject({ von: 'ruht', nach: 'im_gespraech', geaendert: true });
  });
});

describe('Brücke 2 · Follow-up aus der Teilnahme', () => {
  it('baut genau den Körper für /api/crm/followup: Nachricht, 48 h nach dem Event, Quelle event, Bezug Event', () => {
    const f = followUpEingabe(ev(), t('a', 'da'));
    expect(f).toEqual({ aktion: 'anlegen', kontaktId: 'c-a', bezug: { art: 'event', id: 'ev-1' }, art: 'nachricht', text: 'Nachfassen nach „Stammtisch Maschinenbau“', faellig: '2026-09-27', quelle: 'event' });
    expect(followUpEingabe(ev(), t('a', 'da', { einladenDurch: 'malin' })).zustaendig).toBe('malin');
  });
  it('möglich nur für „da“ ohne followUpAm, sobald der Tag da ist', () => {
    expect(followUpMoeglich(ev(), t('a', 'da'), HEUTE)).toBe(true);
    expect(followUpMoeglich(ev({ datum: HEUTE }), t('a', 'da'), HEUTE)).toBe(true);
    expect(followUpMoeglich(ev({ datum: '2026-10-05' }), t('a', 'da'), HEUTE)).toBe(false);
    expect(followUpMoeglich(ev(), t('a', 'da', { followUpAm: HEUTE }), HEUTE)).toBe(false);
    expect(followUpMoeglich(ev(), t('a', 'zugesagt'), HEUTE)).toBe(false);
  });
});

describe('Brücke 3 · Rückmeldungen der Gäste (eventZahlen)', () => {
  const teilnahmen = [
    t('a', 'da', { feedback: { note: 5, text: 'Toller Abend', am: HEUTE } }),
    t('b', 'da', { feedback: { note: 4, am: HEUTE } }),
    t('c', 'da', { feedback: { text: 'Kein Kommentar zur Note', am: HEUTE } }),
    t('d', 'da', { feedback: { text: '   ' } }),
    t('e', 'no_show'),
    { ...t('f', 'da', { feedback: { note: 1 } }), eventId: 'ev-2' },
  ];
  it('zählt Rückmeldungen (Note oder Satz) und den Schnitt nur über die Noten, eine Nachkommastelle', () => {
    expect(feedbackZahlen(teilnahmen, 'ev-1')).toEqual({ rueckmeldungen: 3, noteSchnitt: 4.5 });
    expect(feedbackZahlen(teilnahmen, 'ev-3')).toEqual({ rueckmeldungen: 0, noteSchnitt: null });
    expect(feedbackZahlen([t('a', 'da', { feedback: { note: 4 } }), t('b', 'da', { feedback: { note: 3 } }), t('c', 'da', { feedback: { note: 3 } })], 'ev-1').noteSchnitt).toBe(3.3);
  });
  it('steht in den Event-Zahlen', () => {
    const chancen: Chance[] = [];
    const z = eventZahlen(ev(), teilnahmen, [k('a'), k('b'), k('c'), k('d'), k('e')], chancen);
    expect(z).toMatchObject({ da: 4, rueckmeldungen: 3, noteSchnitt: 4.5 });
  });
});

describe('Brücke 4 · Budget in den Liquiditätsplan', () => {
  const geplant = ev({ status: 'geplant', datum: '2026-11-05', budget: [{ id: 'b1', posten: 'Location', betrag: 800 }, { id: 'b2', posten: 'Material', betrag: 150.4 }] });
  it('Planposten: feste Kennung, negativer Betrag, einmalig am Eventdatum, Kategorie marketing/event, Stempel „übernommen am“', () => {
    const p = planpostenAusEvent(geplant, HEUTE);
    expect(p).toMatchObject({ id: 'ev-ev-1', titel: 'Event: Stammtisch Maschinenbau', betrag: -950, rhythmus: 'einmalig', ab: '2026-11-05', sicher: false, wahrscheinlich: 80, kategorie: LIQUIPLAN_KATEGORIE });
    expect(planpostenId('ev-1')).toBe('ev-ev-1');
    expect(uebernommenAm(p)).toBe(HEUTE);
    expect(uebernommenAm({ notiz: 'von Hand' })).toBeNull();
    expect(uebernommenAm(null)).toBeNull();
  });
  it('Einladung läuft → sicher, ohne Wahrscheinlichkeit; Pauschale zählt, wenn keine Positionen da sind', () => {
    const p = planpostenAusEvent(ev({ status: 'einladung', datum: '2026-11-05', kostenEuro: 300 }), HEUTE);
    expect(p).toMatchObject({ betrag: -300, sicher: true });
    expect(p).not.toHaveProperty('wahrscheinlich');
  });
  it('kein Posten ohne Budget oder außerhalb von geplant/einladung', () => {
    expect(planpostenAusEvent(ev({ status: 'geplant' }), HEUTE)).toBeNull();
    expect(planpostenAusEvent(ev({ status: 'idee', kostenEuro: 300 }), HEUTE)).toBeNull();
    expect(planpostenAusEvent(ev({ status: 'durchgefuehrt', kostenEuro: 300 }), HEUTE)).toBeNull();
    expect(planpostenAusEvent(ev({ status: 'abgesagt', kostenEuro: 300 }), HEUTE)).toBeNull();
  });
  it('Stand im Plan: fehlt · ok · abweichend · kein Posten — Kennung bleibt, nichts wird doppelt', () => {
    const p = planpostenAusEvent(geplant, HEUTE)!;
    expect(liquiplanStand(geplant, null, HEUTE)).toMatchObject({ lage: 'fehlt', vorhanden: null });
    expect(liquiplanStand(geplant, p, HEUTE)).toMatchObject({ lage: 'ok', uebernommenAm: HEUTE });
    expect(liquiplanStand(geplant, { ...p, betrag: -500 }, HEUTE)).toMatchObject({ lage: 'abweichend' });
    expect(liquiplanStand(geplant, { ...p, ab: '2026-11-06' }, HEUTE).lage).toBe('abweichend');
    expect(liquiplanStand(ev({ status: 'idee' }), null, HEUTE)).toMatchObject({ lage: 'kein-posten', vorschlag: null });
    expect(liquiplanStand({ ...geplant, status: 'abgesagt' }, p, HEUTE)).toMatchObject({ lage: 'abweichend' });
    // Zweimal übernehmen ergibt dieselbe Kennung — der Plan bekommt den Posten höchstens einmal.
    expect(planpostenAusEvent(geplant, '2026-10-01')!.id).toBe(p.id);
  });
});

describe('Brücke 5 · Termin im Kalender', () => {
  it('Termin: Titel mit Ort, Tag, Uhrzeit, drei Stunden — die Felder von /api/apple-calendar/create', () => {
    expect(kalenderTermin(ev())).toEqual({ title: 'Stammtisch Maschinenbau · Frankfurt', date: '2026-09-25', startHour: 18, startMin: 30, durationMin: TERMIN_DAUER_MIN });
    expect(kalenderTermin(ev({ ort: undefined }))!.title).toBe('Stammtisch Maschinenbau');
    expect(TERMIN_DAUER_MIN).toBe(180);
  });
  it('ohne Uhrzeit kein Termin', () => {
    expect(kalenderTermin(ev({ uhrzeit: undefined }))).toBeNull();
    expect(kalenderTermin(ev({ uhrzeit: '25:99' }))).toBeNull();
  });
  it('bekannt, wenn Titel (auch „Titel · Ort“) und Tag im Kalender-Cache stehen', () => {
    const cache = [
      { title: 'Stammtisch Maschinenbau · Frankfurt', startDate: '2026-09-25T18:30:00' },
      { title: 'Stammtisch Maschinenbau', startDate: '2026-10-02T18:30:00' },
      { title: 'Zahnarzt', startDate: '2026-09-25T09:00:00' },
    ];
    expect(terminBekannt(cache, ev())).toBe(true);
    expect(terminBekannt(cache, ev({ titel: '  stammtisch   maschinenbau ' }))).toBe(true);
    expect(terminBekannt(cache, ev({ datum: '2026-09-26' }))).toBe(false);
    expect(terminBekannt(cache, ev({ titel: 'Stammtisch' }))).toBe(false);
    expect(terminBekannt([{ title: 42, startDate: null }], ev())).toBe(false);
    expect(terminBekannt([], ev({ titel: '' }))).toBe(false);
  });
});
