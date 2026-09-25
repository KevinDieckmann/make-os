import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { privatNotizVereinen, fuerPerson, kontaktVereinen } from '../lib/make-one/crm';
import type { Chance, Event, Teilnahme, Beitrag, Kampagne, Mandat } from '../lib/crm/typen';
import { leererBestand, wendeCrmAn } from '../lib/crm/speicher';
import { wendeAn } from '../lib/sync';
import { verantwortlich, zustaendig, istMeins, haeltBeziehung, wer, fuerDich, teamFeed, BEIDE } from '../lib/crm/team';
import { werIstDran, karteGehoert } from '../lib/crm/heute';

const HEUTE = '2026-09-25';
const J = '2026-09-25T10:00:00.000Z';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const chance = (x: Partial<Chance> = {}): Chance => ({ id: 'ch-1', titel: 'Retainer', kontaktIds: ['c-a'], art: 'retainer', wert: { betrag: 3000, basis: 'monat' }, stufe: 'angebot', historie: [{ stufe: 'angebot', am: J, von: 'kevin' }], qualifizierung: { schmerz: 'ja', entscheider: 'ja', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' }, gesellschaft: 'offen', besitzer: 'kevin', angelegt: J, geaendert: J, ...x });

describe('Verantwortung und Zuständigkeit (Kevin 25.09.)', () => {
  it('Sales verantwortet Kevin, Marketing und Event Malin', () => {
    expect([verantwortlich('sales'), verantwortlich('marketing'), verantwortlich('event')]).toEqual(['kevin', 'malin', 'malin']);
  });
  it('ohne Eintrag gilt die Verantwortung, „beide“ gehört beiden', () => {
    expect(zustaendig(undefined, 'event')).toBe('malin');
    expect(istMeins(undefined, 'sales', 'malin')).toBe(false);
    expect(istMeins('malin', 'sales', 'malin')).toBe(true);
    expect(istMeins(BEIDE, 'sales', 'malin')).toBe(true);
    expect(haeltBeziehung(k('x'))).toBe('kevin');
  });
  it('nur Team-Kürzel oder „beide“ kommen durch', () => {
    expect(wer('Malin')).toBe('malin');
    expect(wer('beide')).toBe('beide');
    expect(wer('frank')).toBeUndefined();
  });
});

describe('Power Hour je Person — niemand ruft doppelt an', () => {
  const kontakte = [
    k('a', { naechsterSchritt: { text: 'Angebot nachfassen', datum: HEUTE }, telefon: '+49 30 1', rechtsgrundlage: 'bestandskunde_7_3' as Kontakt['rechtsgrundlage'] }),
    k('m', { besitzer: 'malin', naechsterSchritt: { text: 'Rückruf', datum: HEUTE }, telefon: '+49 30 2', rechtsgrundlage: 'bestandskunde_7_3' as Kontakt['rechtsgrundlage'] }),
  ];
  it('ohne Besitzer bei Kevin (Sales-Verantwortung), Malins Kontakt nur bei Malin', () => {
    const kev = werIstDran(kontakte, leererBestand(), HEUTE, 'kevin');
    const mal = werIstDran(kontakte, leererBestand(), HEUTE, 'malin');
    expect(kev.karten.map(c => c.kontakt.id)).not.toContain('c-m');
    expect(mal.karten.map(c => c.kontakt.id)).not.toContain('c-a');
    expect(kev.ausgefiltert.beiAnderen + mal.ausgefiltert.beiAnderen).toBeGreaterThan(0);
  });
  it('die Karte gehört der Chance, nicht der Beziehung', () => {
    expect(karteGehoert({ kontakt: k('a'), chance: chance({ besitzer: 'malin' }) }, leererBestand())).toBe('malin');
    const crm = { ...leererBestand(), kampagnen: [{ id: 'kp-1', zustaendig: 'malin' } as Kampagne] };
    expect(karteGehoert({ kontakt: k('a'), bezug: 'kp-1' }, crm)).toBe('malin');
    const ev = { ...leererBestand(), teilnahmen: [{ id: 't-1', eventId: 'ev-1', kontaktId: 'c-a', status: 'da', einladenDurch: 'malin', geaendert: J } as Teilnahme] };
    expect(karteGehoert({ kontakt: k('a'), bezug: 'ev-1' }, ev)).toBe('malin');
  });
});

describe('Teil-Änderung: nur diese Felder', () => {
  it('überschreibt keine anderen Felder und legt nie etwas an', () => {
    const liste = [{ id: 'e1', titel: 'A', ort: 'Berlin', status: 'idee' }];
    const r = wendeAn(liste, [{ liste: 'x', op: 'teil', id: 'e1', felder: { status: 'geplant' } }, { liste: 'x', op: 'teil', id: 'neu', felder: { titel: 'B' } }]);
    expect(r.liste).toEqual([{ id: 'e1', titel: 'A', ort: 'Berlin', status: 'geplant' }]);
    expect(r.angewandt).toBe(1);
  });
  it('zwei Personen, zwei Felder, dasselbe Event — beide Änderungen bleiben', () => {
    const ev: Event = { id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'drei Gespräche', datum: '2026-11-05', status: 'idee', geaendert: J };
    let b = { ...leererBestand(), events: [ev] };
    b = wendeCrmAn(b, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { ort: 'Kreuzberg' } }], J, 'kevin').bestand;
    b = wendeCrmAn(b, [{ liste: 'events', op: 'teil', id: 'ev-1', felder: { status: 'geplant' } }], J, 'malin').bestand;
    expect(b.events[0]).toMatchObject({ ort: 'Kreuzberg', status: 'geplant', geaendertVon: 'malin' });
  });
  it('Zuständigkeit wird gesäubert, fremde Namen fallen weg', () => {
    const b = wendeCrmAn({ ...leererBestand(), events: [] }, [{ liste: 'events', op: 'upsert', eintrag: { id: 'ev-2', titel: 'X', datum: '2026-11-05', ziel: '', zustaendig: 'frank' } }], J, 'kevin').bestand;
    expect(b.events[0].zustaendig).toBeUndefined();
  });
});

describe('Private Notiz nur für den Verfasser', () => {
  it('Malin sieht Kevins Notiz nicht und kann sie weder überschreiben noch löschen', () => {
    const alt = k('a', { privatNotiz: 'nur für Kevin', privatNotizVon: 'kevin' });
    expect(fuerPerson(alt, 'malin').privatNotiz).toBeUndefined();
    expect(fuerPerson(alt, 'kevin').privatNotiz).toBe('nur für Kevin');
    const vonMalin = { ...fuerPerson(alt, 'malin'), kreis: 'A' as const };
    const gespeichert = kontaktVereinen(vonMalin, alt, 'malin');
    expect(gespeichert).toMatchObject({ kreis: 'A', privatNotiz: 'nur für Kevin', privatNotizVon: 'kevin' });
  });
  it('der Verfasser darf ändern und löschen; eine neue Notiz gehört der schreibenden Person', () => {
    const alt = k('a', { privatNotiz: 'alt', privatNotizVon: 'kevin' });
    expect(privatNotizVereinen(k('a'), alt, 'kevin').privatNotiz).toBeUndefined();
    expect(privatNotizVereinen(k('b', { privatNotiz: 'neu' }), undefined, 'malin')).toMatchObject({ privatNotiz: 'neu', privatNotizVon: 'malin' });
  });
  it('alte Notizen ohne Verfasser gelten als Kevins', () => {
    expect(fuerPerson(k('a', { privatNotiz: 'alt' }), 'malin').privatNotiz).toBeUndefined();
  });
});

describe('Für dich und Zuletzt im Team', () => {
  it('Freigaben liegen bei der Stimme, Checkliste bei der Person des Punktes', () => {
    const b: Beitrag = { id: 'b-1', titel: 'Post', kanal: 'linkedin', status: 'entwurf', wirkung: [], quellen: [], zustaendig: 'malin', stimme: 'kevin', freigabe: { status: 'offen', an: 'kevin', von: 'malin' }, geaendert: J };
    const ev: Event = { id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-10-01', status: 'geplant', geaendert: J, checkliste: [{ id: 'c1', text: 'Location', tageVorher: 42, erledigt: false, wer: 'kevin' }, { id: 'c2', text: 'Einladung', tageVorher: 30, erledigt: false }] };
    const crm = { ...leererBestand(), beitraege: [b], events: [ev] };
    const kev = fuerDich('kevin', [], crm, HEUTE);
    const mal = fuerDich('malin', [], crm, HEUTE);
    expect(kev.find(x => x.id === 'freigaben')?.anzahl).toBe(1);
    expect(mal.find(x => x.id === 'freigaben')).toBeUndefined();
    // Event ist Malins (Verantwortung) — Punkt c1 gehört trotzdem Kevin.
    expect(mal.find(x => x.id === 'checkliste')?.anzahl).toBe(1);
  });
  it('Chancen ohne nächsten Schritt nur für die/den Zuständige(n)', () => {
    const crm = { ...leererBestand(), chancen: [chance({ besitzer: 'malin' }), chance({ id: 'ch-2' }), { ...chance({ id: 'ch-3' }), naechsterSchritt: { text: 'x', datum: HEUTE } }] as Chance[], mandate: [] as Mandat[] };
    expect(fuerDich('malin', [], crm, HEUTE).find(x => x.id === 'chancen-ohne-schritt')?.anzahl).toBe(1);
    expect(fuerDich('kevin', [], crm, HEUTE).find(x => x.id === 'chancen-ohne-schritt')?.anzahl).toBe(1);
  });
  it('Team-Verlauf: Menschen, keine Systemeinträge, neueste zuerst', () => {
    const kontakte = [k('a', { aktivitaeten: [
      { am: '2026-09-24T09:00:00Z', art: 'anruf', ergebnis: 'gespraech', von: 'malin' },
      { am: '2026-09-24T10:00:00Z', art: 'system', text: 'Import', von: 'system' },
      { am: '2026-09-25T08:00:00Z', art: 'uebergabe', text: 'an Malin', von: 'kevin' },
    ] })];
    const crm = { ...leererBestand(), events: [{ id: 'ev-1', titel: 'Dinner', format: 'dinner', ziel: '', datum: '2026-11-01', status: 'idee', geaendert: '2026-09-25T09:00:00Z', geaendertVon: 'malin' } as Event] };
    const f = teamFeed(kontakte, crm, '2026-09-20');
    expect(f.map(x => x.person)).toEqual(['malin', 'kevin', 'malin']);
    expect(f[1].text).toContain('übergeben');
  });
});
