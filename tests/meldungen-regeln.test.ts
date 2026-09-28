// ─── Meldungen (Glocke, 28.09. abends): die reinen Regeln ────────────────────
// Entdoppeln, Grenze ohne Verlust ungelesener, nie an sich selbst, fällig/überfällig am Berliner Tag,
// Gelesen-Merker je Tag. Erfundene Daten, keine Platte.
import { describe, it, expect } from 'vitest';
import {
  begrenzen, einfuegen, eintragAus, faelligAbleiten, gelesenSetzen, leererBestand, pruefeEingabe, sichtBauen, ungelesenZahl, vorZeit, bestandSaeubern,
  type Meldung, type FaelligOptionen,
} from '@/lib/meldungen/regeln';
import type { MeldungEingabe } from '@/lib/meldungen/melden';
import { heuteBerlin } from '@/lib/meldungen/speicher';
import { tagVon, wandzeit } from '@/lib/kalender/zeit';

const iso = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 60_000).toISOString();
const m = (id: string, n: number, x: Partial<Meldung> = {}): Meldung => ({ id, art: 'zuweisung', titel: id, link: '/os/aufgaben', am: iso(n), ...x });
const eingabe = (x: Partial<MeldungEingabe> = {}): MeldungEingabe => ({ an: 'malin', von: 'kevin', art: 'zuweisung', titel: 'Kevin hat dir „Belege Januar“ zugewiesen', link: '/os/aufgaben?offen=t-1', bezug: { art: 'aufgabe', id: 't-1' }, ...x });

describe('Eingabe prüfen', () => {
  it('nie an sich selbst, nur gültige Empfänger, Links nur in MAKE OS, lange Titel abgelehnt statt gekürzt', () => {
    expect(pruefeEingabe(eingabe())).toEqual({ ok: true });
    expect(pruefeEingabe(eingabe({ von: 'malin' }))).toMatchObject({ ok: false, grund: 'nie an sich selbst' });
    expect(pruefeEingabe(eingabe({ an: 'Malin!' })).ok).toBe(false);
    expect(pruefeEingabe(eingabe({ link: 'https://example.invalid' })).ok).toBe(false);
    expect(pruefeEingabe(eingabe({ link: '//example.invalid/x' })).ok).toBe(false);
    expect(pruefeEingabe(eingabe({ titel: 'x'.repeat(301) })).ok).toBe(false);
    expect(pruefeEingabe(eingabe({ titel: '  ' })).ok).toBe(false);
    expect(pruefeEingabe(eingabe({ art: 'quatsch' as never })).ok).toBe(false);
    expect(pruefeEingabe(eingabe({ bezug: { art: 'aufgabe', id: '../x' } })).ok).toBe(false);
    expect(pruefeEingabe(null as unknown as MeldungEingabe).ok).toBe(false);
  });
});

describe('Entdoppeln', () => {
  it('eine ungelesene je Art + Bezug — die neuere ersetzt; gelesene bleiben als Verlauf', () => {
    let b = leererBestand();
    b = einfuegen(b, eintragAus(eingabe(), 'a', iso(1)));
    b = einfuegen(b, eintragAus(eingabe({ titel: 'zweites Mal' }), 'b', iso(2)));
    expect(b.eintraege.map(e => e.id)).toEqual(['b']);
    // Andere Art, gleicher Bezug → eigene Meldung.
    b = einfuegen(b, eintragAus(eingabe({ art: 'kommentar' }), 'c', iso(3)));
    expect(b.eintraege.map(e => e.id)).toEqual(['c', 'b']);
    // Gelesen → eine neue Zuweisung ersetzt sie NICHT.
    b = gelesenSetzen(b, { ids: ['b'] }, '2026-09-01', []);
    b = einfuegen(b, eintragAus(eingabe(), 'd', iso(4)));
    expect(b.eintraege.map(e => e.id)).toEqual(['d', 'c', 'b']);
    // Ohne Bezug wird nicht entdoppelt.
    b = einfuegen(b, eintragAus(eingabe({ bezug: undefined }), 'e', iso(5)));
    b = einfuegen(b, eintragAus(eingabe({ bezug: undefined }), 'f', iso(6)));
    expect(b.eintraege.map(e => e.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
  });
});

describe('Grenze ohne Verlust ungelesener', () => {
  it('erst die ältesten gelesenen fallen weg', () => {
    const liste = [m('u1', 10), m('g1', 1, { gelesen: true }), m('u2', 5), m('g2', 2, { gelesen: true }), m('g3', 8, { gelesen: true })];
    expect(begrenzen(liste, 4).map(e => e.id)).toEqual(['u1', 'g3', 'u2', 'g2']);
    expect(begrenzen(liste, 3).map(e => e.id)).toEqual(['u1', 'g3', 'u2']);
  });
  it('nur ungelesene über der Grenze → die ältesten werden zu „+N weitere“ zusammengefasst, die Zahl bleibt gleich', () => {
    const liste = Array.from({ length: 8 }, (_, i) => m(`u${i}`, i));
    const r = begrenzen(liste, 5);
    expect(r).toHaveLength(5);
    expect(r.slice(0, 4).map(e => e.id)).toEqual(['u7', 'u6', 'u5', 'u4']);
    expect(r[4]).toMatchObject({ art: 'sammel', anzahl: 4, titel: '+4 weitere Meldungen' });
    expect(ungelesenZahl(r)).toBe(8);
    // Eine vorhandene Sammelmeldung wird beim nächsten Überlauf mitgezählt.
    const weiter = begrenzen([m('u8', 20), m('u9', 21), ...r], 5);
    expect(weiter).toHaveLength(5);
    expect(ungelesenZahl(weiter)).toBe(10);
    expect(weiter[4]).toMatchObject({ art: 'sammel', anzahl: 6 });
  });
  it('500 je Person über einfuegen', () => {
    let b = leererBestand();
    for (let i = 0; i < 520; i++) b = einfuegen(b, eintragAus(eingabe({ bezug: { art: 'aufgabe', id: `t-${i}` } }), `x${i}`, iso(i)));
    expect(b.eintraege).toHaveLength(500);
    expect(ungelesenZahl(b.eintraege)).toBe(520);
  });
});

describe('Berliner Tag', () => {
  it('heuteBerlin folgt Europe/Berlin, nicht UTC und nicht der Maschine', () => {
    expect(heuteBerlin(new Date('2026-09-27T22:30:00Z'))).toBe('2026-09-28'); // 00:30 MESZ
    expect(heuteBerlin(new Date('2026-09-28T21:59:00Z'))).toBe('2026-09-28'); // 23:59 MESZ
    expect(heuteBerlin(new Date('2026-09-28T22:00:00Z'))).toBe('2026-09-29');
    expect(heuteBerlin(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01'); // MEZ
  });
});

describe('Fällig / überfällig (abgeleitet)', () => {
  const opt = (x: Partial<FaelligOptionen> = {}): FaelligOptionen => ({
    person: 'malin', heute: '2026-09-28', am: '2026-09-27T22:00:00.000Z', link: id => `/os/aufgaben?offen=${id}`,
    tagVonIso: i => tagVon(wandzeit(new Date(i))), ...x,
  });
  const t = (id: string, x: Record<string, unknown>) => ({ id, title: `Aufgabe ${id}`, status: 'todo', assignee: 'malin', ...x });
  const aufgaben = [
    t('a1', { dueDate: '2026-09-28' }),
    t('a2', { dueDate: '2026-09-25' }),
    t('a3', { dueDate: '2026-09-29' }),
    t('a4', { dueDate: '2026-09-20', status: 'done' }),
    t('a5', { dueDate: '2026-09-28', assignee: 'kevin' }),
    t('a6', { dueDate: '2026-09-28', assignee: 'both' }),
    t('a7', {}),
    t('a8', { dueDate: '2026-09-27T22:30:00.000Z' }), // 00:30 Berlin am 28. → heute fällig
    t('a9', { dueDate: '2026-09-27T21:30:00.000Z' }), // 23:30 Berlin am 27. → überfällig
    t('a10', { dueDate: '2026-09-10', completedAt: '2026-09-11T08:00:00Z' }),
    t('a11', { dueDate: '2026-09-28', assignee: 'kevin', zustaendig: ['malin'] }),
  ];
  it('nur eigene (oder gemeinsame) offene Aufgaben mit Deadline ≤ heute; überfällige zuerst', () => {
    const r = faelligAbleiten(aufgaben, opt());
    expect(r.map(x => `${x.art}:${x.bezug?.id}`)).toEqual(['ueberfaellig:a2', 'ueberfaellig:a9', 'faellig:a1', 'faellig:a6', 'faellig:a8', 'faellig:a11']);
    expect(r[0]).toMatchObject({ id: 'ueberfaellig:2026-09-28:a2', virtuell: true, gelesen: false, link: '/os/aufgaben?offen=a2', titel: '„Aufgabe a2“ ist überfällig — fällig seit 25.09.' });
    expect(r[2].titel).toBe('„Aufgabe a1“ ist heute fällig');
    expect(faelligAbleiten(aufgaben, opt({ person: 'kevin' })).map(x => x.bezug?.id)).toEqual(['a5', 'a6', 'a11']);
  });
  it('Gelesen-Merker gilt je Tag — morgen meldet sich die offene Aufgabe neu', () => {
    let b = leererBestand();
    const ids = faelligAbleiten(aufgaben, opt()).map(x => x.id);
    b = gelesenSetzen(b, { ids: [ids[0], 'ueberfaellig:2026-09-28:fremd'] }, '2026-09-28', ids);
    expect(b.faelligGelesen).toEqual({ tag: '2026-09-28', ids: [ids[0]] });
    const heute = faelligAbleiten(aufgaben, opt({ gelesen: b.faelligGelesen }));
    expect(heute.filter(x => x.gelesen).map(x => x.id)).toEqual([ids[0]]);
    const morgen = faelligAbleiten(aufgaben, opt({ heute: '2026-09-29', gelesen: b.faelligGelesen }));
    expect(morgen.every(x => !x.gelesen)).toBe(true);
    // Tageswechsel ersetzt den Merker.
    const ids29 = morgen.map(x => x.id);
    b = gelesenSetzen(b, { alle: true }, '2026-09-29', ids29);
    expect(b.faelligGelesen).toEqual({ tag: '2026-09-29', ids: ids29 });
  });
  it('Sicht: neueste zuerst, Zahl an der Glocke, alle gelesen', () => {
    let b = leererBestand();
    b = einfuegen(b, eintragAus(eingabe(), 'neu1', '2026-09-28T08:00:00.000Z'));
    b = einfuegen(b, eintragAus(eingabe({ art: 'erwaehnung' }), 'alt1', '2026-09-26T08:00:00.000Z'));
    const abg = faelligAbleiten(aufgaben, opt());
    const s = sichtBauen(b, abg, '2026-09-28');
    expect(s.meldungen[0].id).toBe('neu1');
    expect(s.meldungen[s.meldungen.length - 1].id).toBe('alt1');
    expect(s.ungelesen).toBe(2 + abg.length);
    const alle = gelesenSetzen(b, { alle: true }, '2026-09-28', abg.map(x => x.id));
    expect(sichtBauen(alle, faelligAbleiten(aufgaben, opt({ gelesen: alle.faelligGelesen })), '2026-09-28').ungelesen).toBe(0);
  });
  it('kaputter Bestand wird tolerant gelesen', () => {
    expect(bestandSaeubern(null)).toEqual(leererBestand());
    expect(bestandSaeubern({ eintraege: [null, { id: 1 }, m('ok', 1)], einstellungen: { telegram: 'ja' } })).toEqual({ eintraege: [m('ok', 1)], einstellungen: { telegram: false } });
  });
});

describe('Zeit in der Liste', () => {
  it('vor 5 Min, vor 3 Std, gestern, vor 4 Tagen', () => {
    const j = Date.parse('2026-09-28T12:00:00Z');
    expect(vorZeit('2026-09-28T11:59:40Z', j)).toBe('gerade eben');
    expect(vorZeit('2026-09-28T11:55:00Z', j)).toBe('vor 5 Min');
    expect(vorZeit('2026-09-28T09:00:00Z', j)).toBe('vor 3 Std');
    expect(vorZeit('2026-09-27T10:00:00Z', j)).toBe('gestern');
    expect(vorZeit('2026-09-24T10:00:00Z', j)).toBe('vor 4 Tagen');
    expect(vorZeit('kaputt', j)).toBe('');
  });
});
