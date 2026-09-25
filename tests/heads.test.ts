// Die Heads: Datenpaket ohne Privates, Prüfer streicht Unzulässiges, Dedup, Takt.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import { leererBestand } from '../lib/crm/speicher';
import { datenpaket, person } from '../lib/heads/daten';
import { normalisiere, pruefe } from '../lib/heads/pruefer';
import { mischen, leererStand } from '../lib/heads/stand';
import { faelligeModi } from '../lib/heads/takt';

const HEUTE = '2026-09-24';
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const v = (x: Record<string, unknown> = {}) => ({ art: 'nachfassen', titel: 'Nachfassen bei A', begruendung: 'wartet', kontakt_id: 'c-a', chance_id: null, mandat_id: null, event_id: null, frist: '2026-09-25', prioritaet: 'hoch', dedup_schluessel: 'nachfassen:c-a', quelle: ['karten[0]'], entwurf: null, ...x });

describe('Datenpaket', () => {
  it('nie Privatnotiz, nie gesperrte Personen, Kanal-Ampel je Person', () => {
    const a = k('a', { email: 'a@b.de', kreis: 'A', privatNotiz: 'geheim', telefon: '030', letzterKontakt: '2026-07-01' });
    const g = k('g', { kreis: 'A', telefon: '030', werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } });
    const d = datenpaket('sales', 'power_hour', [a, g], leererBestand(), HEUTE, 'kevin', []);
    const text = JSON.stringify(d);
    expect(text).not.toContain('geheim');
    expect(text).not.toContain('c-g');
    expect(person(a).kanal_erlaubt).toEqual(['telefon', 'mail']);
  });
});

describe('Prüfer', () => {
  const kontakte = [k('a', { email: 'a@b.de', linkedin: 'https://l/a' }), k('s', { email: 's@b.de', werbesperre: { seit: '2026-09-01', grund: 'x' } })];
  it('streicht erfundene Personen, Sperren und unzulässige Kanäle — behält Vernetzen', () => {
    const roh = normalisiere({ status: 'handeln', zusammenfassung: 'x', befunde: [], fragen: [], datenluecken: [], antwort: '', vorschlaege: [
      v(), v({ titel: 'Erfunden', kontakt_id: 'c-gibtsnicht', dedup_schluessel: 'x1' }), v({ titel: 'Gesperrt', kontakt_id: 'c-s', dedup_schluessel: 'x2' }),
      v({ titel: 'Werbemail', dedup_schluessel: 'x3', entwurf: { kanal: 'mail', text: 'Hallo' } }), v({ titel: 'Vernetzen', dedup_schluessel: 'x4', entwurf: { kanal: 'vernetzen', text: 'Hallo' } }),
    ] }, 'sales');
    const r = pruefe(roh, {}, kontakte, leererBestand());
    expect(r.antwort.vorschlaege.map(x => x.titel)).toEqual(['Nachfassen bei A', 'Vernetzen']);
    expect(r.pruefung.gestrichen.map(g => g.titel)).toEqual(['Erfunden', 'Gesperrt', 'Werbemail']);
  });
  it('Vollzug und unbelegte Zahlen werden gemeldet', () => {
    const roh = normalisiere({ status: 'handeln', zusammenfassung: 'Ich habe die Mail an A gesendet, Wert 48.000 €.', befunde: [], vorschlaege: [], fragen: [], datenluecken: [], antwort: '' }, 'sales');
    const r = pruefe(roh, { wert: 36000 }, kontakte, leererBestand());
    expect(r.pruefung.verstoesse.length).toBe(1);
    expect(r.pruefung.unbelegt.length).toBe(1);
  });
});

describe('Freigabe-Liste', () => {
  it('gleicher Schlüssel aktualisiert, Abgelehntes kommt 30 Tage nicht wieder', () => {
    const r1 = mischen([], [normalisiere({ vorschlaege: [v()] }, 'sales').vorschlaege[0]], 'b1', `${HEUTE}T07:00:00Z`);
    const r2 = mischen(r1.liste, [normalisiere({ vorschlaege: [v({ begruendung: 'neu' })] }, 'sales').vorschlaege[0]], 'b2', `${HEUTE}T08:00:00Z`);
    expect(r2).toMatchObject({ neu: 0, aktualisiert: 1 });
    const abgelehnt = r2.liste.map(x => ({ ...x, status: 'abgelehnt' as const, entschieden: `${HEUTE}T09:00:00Z` }));
    expect(mischen(abgelehnt, [normalisiere({ vorschlaege: [v()] }, 'sales').vorschlaege[0]], 'b3', '2026-10-01T07:00:00Z').neu).toBe(0);
  });
});

describe('Takt', () => {
  it('Sales werktags ab 7 Uhr einmal, Event nachfassen am Tag danach', () => {
    const do7 = new Date(2026, 8, 24, 7, 5);
    expect(faelligeModi('sales', do7, leererStand(), [])).toEqual([{ modus: 'power_hour', grund: 'Power Hour vorbereiten (Kevin)', person: 'kevin' }]);
    // Zu zweit: je Person ein eigener Riegel — Kevins Lauf sperrt Malins nicht.
    expect(faelligeModi('sales', do7, { ...leererStand(), letzte: { 'power_hour:kevin': '2026-09-24T05:10:00Z' } }, [], ['kevin', 'malin'])).toEqual([{ modus: 'power_hour', grund: 'Power Hour vorbereiten (Malin)', person: 'malin' }]);
    expect(faelligeModi('sales', do7, { ...leererStand(), letzte: { power_hour: '2026-09-24T05:10:00Z' } }, [])).toEqual([]);
    expect(faelligeModi('sales', new Date(2026, 8, 27, 9), leererStand(), [])).toEqual([]); // Sonntag
    expect(faelligeModi('event', new Date(2026, 8, 24, 9), leererStand(), [{ datum: '2026-09-23', status: 'durchgefuehrt' }])[0].modus).toBe('nachfassen');
  });
});

describe('Kampagnen über die Heads', () => {
  const kontakte = [k('a', { email: 'a@b.de' }), k('s', { werbesperre: { seit: '2026-09-01', grund: 'x' } })];
  it('Prüfer: unbekanntes Vorgehen gestrichen, gesperrte/erfundene Personen aussortiert', () => {
    const roh = normalisiere({ status: 'handeln', zusammenfassung: 'x', befunde: [], fragen: [], datenluecken: [], antwort: '', vorschlaege: [
      v({ art: 'kampagne_planen', titel: 'Empfehlungen', kontakt_id: null, dedup_schluessel: 'k1', kampagne: { playbook: 'empfehlung', name: 'Empfehlungen Herbst', ziel: 'Intros', kontakt_ids: ['c-a', 'c-s', 'c-erfunden'] } }),
      v({ art: 'kampagne_planen', titel: 'Fantasie', kontakt_id: null, dedup_schluessel: 'k2', kampagne: { playbook: 'gibtsnicht', name: 'x', ziel: 'y', kontakt_ids: [] } }),
    ] }, 'marketing');
    const r = pruefe(roh, {}, kontakte, leererBestand());
    expect(r.antwort.vorschlaege.map(x => x.kampagne?.kontakt_ids)).toEqual([['c-a']]);
    expect(r.pruefung.gestrichen.map(g => g.titel)).toEqual(['Fantasie']);
  });
  it('Datenpaket im Modus Kampagne: Playbooks je Head, keine gesperrten Personen', () => {
    const d = datenpaket('sales', 'kampagne', kontakte, leererBestand(), HEUTE, 'kevin', []) as unknown as { playbooks: { id: string }[] };
    expect(d.playbooks.map(p => p.id)).toContain('verlaengerung');
    expect(d.playbooks.map(p => p.id)).not.toContain('newsletter');
    expect(JSON.stringify(d)).not.toContain('c-s');
  });
});

describe('Prüfer — Verneinung ist kein Vollzug', () => {
  it('„ist noch nicht eingeladen“ zählt nicht, „habe eingeladen“ schon', () => {
    const a = normalisiere({ status: 'beobachten', zusammenfassung: 'Frau Y ist noch nicht eingeladen.', befunde: [], vorschlaege: [], fragen: [], datenluecken: [], antwort: '' }, 'event');
    expect(pruefe(a, {}, [], leererBestand()).pruefung.verstoesse).toEqual([]);
    const b = normalisiere({ status: 'beobachten', zusammenfassung: 'Ich habe Frau Y eingeladen.', befunde: [], vorschlaege: [], fragen: [], datenluecken: [], antwort: '' }, 'event');
    expect(pruefe(b, {}, [], leererBestand()).pruefung.verstoesse.length).toBe(1);
  });
});
