import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Event, Teilnahme, Firma } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { eventZahlen, nachfassenRest, followUpBis } from '../lib/crm/events';
import { VORLAGEN, vorlageAnwenden, mix, mixGruppe, checklisteFaellig, checklisteStand, checklisteAlsAufgaben, aufgabenId, budgetSumme, gaesteVorschlag, icsText, icsEscape, icsDateiname, zielHinweis } from '../lib/crm/eventplanung';

const HEUTE = '2026-09-24';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-1', titel: 'Stammtisch Maschinenbau', format: 'stammtisch', ziel: 'drei Folgegespräche mit Inhabern', datum: '2026-11-05', status: 'geplant', geaendert: HEUTE, ...x });
const t = (kontakt: string, status: Teilnahme['status'], eventId = 'ev-1'): Teilnahme => ({ id: `t-${eventId}-${kontakt}`, eventId, kontaktId: `c-${kontakt}`, status, geaendert: HEUTE });

describe('Vorlagen', () => {
  it('jede Vorlage: Kapazität, Soll-Mischung, Ablauf, Checkliste mit Vorlauf vor und nach dem Event, Budget-Gerüst', () => {
    expect(VORLAGEN.map(v => v.id)).toEqual(['stammtisch', 'workshop', 'dinner', 'webinar']);
    for (const v of VORLAGEN) {
      expect(v.kapazitaet).toBeGreaterThan(0);
      expect(v.ablauf.length).toBeGreaterThan(3);
      expect(v.checkliste.some(p => p.tageVorher === 42)).toBe(true);
      expect(v.checkliste.some(p => p.tageVorher === -1)).toBe(true);
      expect(v.checkliste.some(p => p.tageVorher === -30)).toBe(true);
      expect(new Set(v.checkliste.map(p => p.id)).size).toBe(v.checkliste.length);
      expect(v.checkliste.every(p => p.tageVorher >= -30 && p.tageVorher <= 120)).toBe(true);
      expect(v.budget.length).toBeGreaterThan(0);
    }
  });

  it('ergänzt nur, überschreibt nie — Checkliste, Budget, Ablauf, Rahmen', () => {
    const vorher = ev({
      format: 'sonstig', kapazitaet: 20, mixZiel: { zielkunden: 60, kunden: 10 },
      ablauf: [{ zeit: '18:00', punkt: 'Eigener Ablauf' }],
      checkliste: [{ id: 'ziel', text: 'Mein eigenes Ziel-Briefing', tageVorher: 50, erledigt: true, aufgabeId: 'ev-ev-1-ziel' }, { id: 'x', text: 'Einladungen persönlich (per Mail nur mit Grundlage)', tageVorher: 25, erledigt: false }],
      budget: [{ id: 'b1', posten: 'Location & Getränke', betrag: 400 }],
    });
    const nach = vorlageAnwenden(vorher, 'stammtisch');
    expect(nach.format).toBe('stammtisch');
    expect(nach.kapazitaet).toBe(20);
    expect(nach.mixZiel).toEqual({ zielkunden: 60, kunden: 10 });
    expect(nach.ablauf).toEqual([{ zeit: '18:00', punkt: 'Eigener Ablauf' }]);
    expect(nach.uhrzeit).toBe('18:30');
    const ziel = nach.checkliste!.filter(p => p.id === 'ziel');
    expect(ziel).toEqual([{ id: 'ziel', text: 'Mein eigenes Ziel-Briefing', tageVorher: 50, erledigt: true, aufgabeId: 'ev-ev-1-ziel' }]);
    expect(nach.checkliste!.filter(p => /Einladungen persönlich/.test(p.text))).toHaveLength(1); // gleicher Text zählt als vorhanden
    expect(nach.checkliste!.length).toBe(VORLAGEN[0].checkliste.length);
    expect(nach.budget!.find(b => b.posten === 'Location & Getränke')!.betrag).toBe(400);
    expect(nach.budget!.filter(b => b.posten === 'Location & Getränke')).toHaveLength(1);
    expect(nach.vorlage).toBe('stammtisch');
    // Zweimal anwenden ändert nichts mehr; unbekannte Vorlage lässt alles stehen.
    expect(vorlageAnwenden(nach, 'stammtisch')).toEqual(nach);
    expect(vorlageAnwenden(vorher, 'gibtsnicht')).toBe(vorher);
  });

  it('leeres Event bekommt alles aus der Vorlage; das Format bleibt, wenn es gesetzt ist', () => {
    const e = vorlageAnwenden(ev({ format: 'dinner' }), 'workshop');
    expect(e.format).toBe('dinner');
    expect(e.ablauf![0]).toEqual({ zeit: '09:30', punkt: 'Ankommen, Kaffee' });
    expect(e.checkliste!.every(p => p.erledigt === false)).toBe(true);
    expect(e.budget!.every(b => b.betrag === 0)).toBe(true);
  });

  it('Ziel nach Parker: leer, „Netzwerken“ oder ohne Zahl bekommt einen Hinweis', () => {
    expect(zielHinweis('')).toMatch(/Noch kein Ziel/);
    expect(zielHinweis('Netzwerken')).toMatch(/kein Ziel/);
    expect(zielHinweis('Inhaber kennenlernen')).toMatch(/kein Ziel/);
    expect(zielHinweis('Folgegespräche mit Inhabern')).toMatch(/Zahl/);
    expect(zielHinweis('drei Folgegespräche mit Inhabern binnen 30 Tagen')).toBeNull();
  });
});

describe('Gästemischung', () => {
  const firmen: Firma[] = [{ id: 'f-ziel', name: 'Ziel GmbH', rolle: 'zielkunde', geaendert: HEUTE }, { id: 'f-kunde', name: 'Kunde AG', rolle: 'kunde', geaendert: HEUTE }];
  const kontakte = [
    k('z1', { lebensphase: 'interessent' }), k('z2', { firmaId: 'f-ziel' }), k('z3', { prio: 'A' }),
    k('k1', { lebensphase: 'kunde' }), k('k2', { lebensphase: 'multiplikator' }), k('k3', { firmaId: 'f-kunde' }),
    k('s1'), k('s2', { prio: 'C' }), k('s3', { lebensphase: 'ex_kunde' }), k('s4'),
  ];
  it('Gruppen: Kunden/Multiplikatoren vor Zielkunden, Rest sonstige', () => {
    expect(mixGruppe(kontakte[0])).toBe('zielkunde');
    expect(mixGruppe(kontakte[1], firmen[0])).toBe('zielkunde');
    expect(mixGruppe(kontakte[2])).toBe('zielkunde');
    expect(mixGruppe(k('x', { lebensphase: 'kunde', prio: 'A' }))).toBe('kunde');
    expect(mixGruppe(kontakte[5], firmen[1])).toBe('kunde');
    expect(mixGruppe(kontakte[6])).toBe('sonstig');
  });

  it('Quote aus den Zusagen (inkl. „da“), Ampel gegen das Soll, was fehlt', () => {
    const teil = [t('z1', 'zugesagt'), t('z2', 'da'), t('k1', 'zugesagt'), t('s1', 'zugesagt'), t('s2', 'zugesagt'), t('z3', 'eingeladen'), t('k2', 'abgesagt')];
    const m = mix(ev(), teil, kontakte, firmen);
    expect(m.basis).toBe('zugesagt');
    expect(m.n).toBe(5);
    expect(m.anzahl).toEqual({ zielkunde: 2, kunde: 1, sonstig: 2 });
    expect(m.anteil).toEqual({ zielkunde: 40, kunde: 20, sonstig: 40 });
    expect(m.ziel).toEqual({ zielkunden: 40, kunden: 20 });
    expect(m.ampel).toBe('gruen');
    expect(m.fehlen).toEqual({ zielkunden: 0, kunden: 0 });
  });

  it('eigenes Soll: knapp darunter gelb, deutlich darunter rot mit Anzahl, die fehlt', () => {
    const teil = [t('z1', 'zugesagt'), t('k1', 'zugesagt'), t('s1', 'zugesagt'), t('s2', 'zugesagt'), t('s3', 'zugesagt'), t('s4', 'zugesagt')];
    const m = mix(ev({ mixZiel: { zielkunden: 50, kunden: 20 } }), teil, kontakte, firmen);
    expect(m.anteil.zielkunde).toBe(17);
    expect(m.ampel).toBe('rot');
    // (1 + x) / (6 + x) ≥ 50 % → x = 4
    expect(m.fehlen.zielkunden).toBe(4);
    expect(m.hinweis).toMatch(/4 Zielkunden/);
    const gelb = mix(ev({ mixZiel: { zielkunden: 45, kunden: 20 } }), [t('z1', 'zugesagt'), t('z2', 'zugesagt'), t('k1', 'zugesagt'), t('s1', 'zugesagt'), t('s2', 'zugesagt')], kontakte, firmen);
    expect(gelb.ampel).toBe('gelb');
  });

  it('ohne Zusagen zählt die Gästeliste (vorgemerkt + eingeladen); unter drei Gästen keine Ampel', () => {
    const m = mix(ev(), [t('z1', 'vorgemerkt'), t('k1', 'eingeladen'), t('s1', 'abgesagt')], kontakte, firmen);
    expect(m.basis).toBe('gaesteliste');
    expect(m.n).toBe(2);
    expect(m.ampel).toBeNull();
    expect(mix(ev(), [], kontakte, firmen).basis).toBe('leer');
  });
});

describe('Checkliste', () => {
  const e = ev({
    datum: '2026-10-01',
    checkliste: [
      { id: 'a', text: 'Gästeliste', tageVorher: 28, erledigt: false },
      { id: 'b', text: 'Erinnerung', tageVorher: 7, erledigt: false },
      { id: 'c', text: 'Nachfassen', tageVorher: -1, erledigt: false },
      { id: 'd', text: 'Wirkung prüfen', tageVorher: -30, erledigt: false },
      { id: 'e', text: 'Ziel', tageVorher: 42, erledigt: true, aufgabeId: 'ev-ev-1-e' },
    ],
  });
  it('fällig = Datum minus Vorlauf, negativer Vorlauf liegt nach dem Event; überfällig nur, wenn offen', () => {
    const l = checklisteFaellig(e, HEUTE);
    expect(l.map(p => [p.id, p.faelligAm])).toEqual([['e', '2026-08-20'], ['a', '2026-09-03'], ['b', '2026-09-24'], ['c', '2026-10-02'], ['d', '2026-10-31']]);
    expect(l.find(p => p.id === 'a')).toMatchObject({ ueberfaellig: true, tage: -21 });
    expect(l.find(p => p.id === 'b')).toMatchObject({ ueberfaellig: false, tage: 0 });
    expect(l.find(p => p.id === 'c')).toMatchObject({ ueberfaellig: false, tage: 8 });
    expect(l.find(p => p.id === 'e')!.ueberfaellig).toBe(false);
    expect(checklisteStand(e, HEUTE)).toMatchObject({ gesamt: 5, erledigt: 1, offen: 4, ueberfaellig: 1, bald: 1, ohneAufgabe: 4 });
  });

  it('als Aufgaben: nur offene ohne Aufgabe, feste ID, wiederholbar ohne Dubletten', () => {
    const r = checklisteAlsAufgaben(e, new Set(['ev-ev-1-b']), 'malin', '2026-09-24T08:00:00.000Z');
    expect(Object.keys(r.verknuepft)).toEqual(['a', 'b', 'c', 'd']);
    expect(r.neu.map(x => x.id)).toEqual(['ev-ev-1-a', 'ev-ev-1-c', 'ev-ev-1-d']);
    expect(r.neu[0]).toMatchObject({ title: 'Gästeliste — Stammtisch Maschinenbau', status: 'todo', priority: 'medium', assignee: 'malin', tags: ['crm', 'event'], subTasks: [], dependencies: [], sortOrder: 0, dueDate: '2026-09-03' });
    expect(r.neu[1].dueDate).toBe('2026-10-02');
    expect(aufgabenId('ev-1', 'Ä b')).toBe('ev-ev-1---b');
    const zweiter = checklisteAlsAufgaben(e, new Set(r.neu.map(x => x.id).concat('ev-ev-1-b')), 'malin', '2026-09-24T08:00:00.000Z');
    expect(zweiter.neu).toEqual([]);
  });
});

describe('Budget', () => {
  it('Summe der Positionen, sonst die Pauschale; fließt in Kosten je Folgegespräch', () => {
    expect(budgetSumme(ev({ budget: [{ id: 'a', posten: 'Location', betrag: 250 }, { id: 'b', posten: 'Getränke', betrag: 120.5 }], kostenEuro: 999 }))).toBe(370.5);
    expect(budgetSumme(ev({ budget: [{ id: 'a', posten: 'Location', betrag: 0 }], kostenEuro: 300 }))).toBe(300);
    expect(budgetSumme(ev())).toBe(0);
    const e = ev({ datum: '2026-09-10', budget: [{ id: 'a', posten: 'Location', betrag: 600 }] });
    const z = eventZahlen(e, [t('a', 'da'), t('b', 'da')], [k('a', { aktivitaeten: [{ am: '2026-09-15T10:00', art: 'gespraech', von: 'kevin' }] }), k('b', { aktivitaeten: [{ am: '2026-09-20T10:00', art: 'termin', von: 'kevin' }] })], []);
    expect(z).toMatchObject({ kosten: 600, folgegespraeche: 2, kostenJeFolgegespraech: 300 });
  });
});

describe('Nachfassen', () => {
  it('Reststunden bis zum Ende des Frist-Tages (Event + 2 Tage)', () => {
    const e = ev({ datum: '2026-09-22' });
    expect(followUpBis(e)).toBe('2026-09-24');
    const mittag = new Date('2026-09-24T12:00:00').getTime();
    expect(nachfassenRest(e, mittag)).toBe(11);
    expect(nachfassenRest(e, new Date('2026-09-25T12:00:00').getTime())).toBeLessThan(0);
  });
});

describe('Gäste-Vorschläge', () => {
  const ew = { kanal: 'einladung' as const, grundlage: 'einwilligung' as const, erteiltAm: '2026-05-01', nachweis: 'im Gespräch: gern einladen' };
  const kontakte = [
    k('a', { kreis: 'A', email: 'a@x.de' }),
    k('b', { kreis: 'B', lebensphase: 'kunde', email: 'b@x.de' }),
    k('c', { prio: 'A', email: 'c@x.de', einwilligungen: [ew] }),
    k('d', { kreis: 'A', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('e', { kreis: 'A', lebensphase: 'multiplikator' }),
    k('f'),
  ];
  const crm = { ...leererBestand(), teilnahmen: [t('e', 'eingeladen'), t('a', 'da', 'ev-alt')] };

  it('ohne Gesperrte, ohne wer schon auf der Liste steht, ohne Irrelevante; sortiert nach Punkten', () => {
    const v = gaesteVorschlag(kontakte, crm, ev(), HEUTE);
    const ids = v.map(x => x.kontakt.id);
    expect(ids).not.toContain('c-d');
    expect(ids).not.toContain('c-e');
    expect(ids).not.toContain('c-f');
    expect(ids[0]).toBe('c-b');
    expect(v.find(x => x.kontakt.id === 'c-a')!.gruende).toContain('war schon bei einem Event');
  });

  it('Einladungsweg: Mail nur bei grüner Ampel (Einwilligung, Kunde), sonst persönlich', () => {
    const v = gaesteVorschlag(kontakte, crm, ev(), HEUTE);
    const weg = Object.fromEntries(v.map(x => [x.kontakt.id, x.weg]));
    expect(weg['c-a']).toBe('persoenlich');
    expect(weg['c-b']).toBe('mail');
    expect(weg['c-c']).toBe('mail');
  });

  it('mit Segment nur dessen Mitglieder — Gesperrte bleiben draußen', () => {
    const v = gaesteVorschlag(kontakte, crm, ev(), HEUTE, { kreis: ['A'] });
    expect(v.map(x => x.kontakt.id)).toEqual(['c-a']);
  });
});

describe('Kalender-Datei', () => {
  const e = ev({
    titel: 'Dinner, Wein; Gespräche', uhrzeit: '19:00', ort: 'Villa Rothschild, Königstein', coHost: 'Anna Beispiel',
    ziel: 'geheimes internes Ziel', notiz: 'interne Notiz',
    ablauf: [{ zeit: '22:30', punkt: 'Ausklang' }, { zeit: '19:00', punkt: 'Aperitif' }],
  });
  const ics = icsText(e, '2026-09-24T08:15:30.000Z');
  const zeilen = ics.split('\r\n');

  it('Rahmen nach RFC 5545: VCALENDAR/VEVENT, CRLF, UID, DTSTAMP, Zeitzone', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(zeilen).toContain('UID:ev-1@makeos');
    expect(zeilen).toContain('DTSTAMP:20260924T081530Z');
    expect(zeilen).toContain('BEGIN:VTIMEZONE');
    expect(zeilen).toContain('TZID:Europe/Berlin');
    expect(zeilen).toContain('DTSTART;TZID=Europe/Berlin:20261105T190000');
    expect(zeilen).toContain('DTEND;TZID=Europe/Berlin:20261105T230000');
    expect(zeilen).toContain('STATUS:CONFIRMED');
  });

  it('Kommas und Semikolons maskiert, lange Zeilen gefaltet, nichts Internes', () => {
    expect(zeilen).toContain('SUMMARY:Dinner\\, Wein\\; Gespräche');
    expect(ics).toContain('LOCATION:Villa Rothschild\\, Königstein');
    expect(icsEscape('a\\b\nc')).toBe('a\\\\b\\nc');
    const bytes = (s: string) => new TextEncoder().encode(s).length;
    expect(zeilen.every(z => bytes(z) <= 75)).toBe(true);
    const entfaltet = ics.replace(/\r\n /g, '');
    expect(entfaltet).toContain('19:00 Aperitif\\n22:30 Ausklang');
    expect(entfaltet).not.toContain('geheimes');
    expect(entfaltet).not.toContain('interne Notiz');
  });

  it('ohne Uhrzeit ganztägig, ohne Zeitzone; Absage als CANCELLED; Mitternacht rollt ins nächste Datum', () => {
    const ganz = icsText(ev({ status: 'abgesagt' }), '2026-09-24T08:00:00Z').split('\r\n');
    expect(ganz).toContain('DTSTART;VALUE=DATE:20261105');
    expect(ganz).toContain('DTEND;VALUE=DATE:20261106');
    expect(ganz).not.toContain('BEGIN:VTIMEZONE');
    expect(ganz).toContain('STATUS:CANCELLED');
    const spaet = icsText(ev({ uhrzeit: '22:30', format: 'dinner' }), '2026-09-24T08:00:00Z').split('\r\n');
    expect(spaet).toContain('DTEND;TZID=Europe/Berlin:20261106T020000');
    expect(icsDateiname(ev({ titel: 'Stammtisch: Größe & Übergabe' }))).toBe('2026-11-05-stammtisch-groesse-uebergabe.ics');
  });
});
