// ─── Besuchte Events — Wirkung, Übersicht, Kennzahlen-Trennung, „Heute bei“, Export für Kunden (03.10.) ───
// Erfundene Personen (@example.invalid). Die Make.One-Kennzahlen bleiben ohne besuchte Events; die besuchten haben eigene.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Chance, CrmBestand, Event, Teilnahme } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { eventKennzahlen } from '../lib/crm/traktion';
import { wochenScoreboard } from '../lib/crm/scoreboard';
import {
  besuchWirkung, besuchUrteil, besuchUebersicht, besuchJeKunde, besuchKennzahlen, eventsFuerKunde, heuteBeiAngebot, kundenExport, csvFeld, erfassteTeilnahmen,
  EXPORT_SPALTEN, EXPORT_KEINE_EINWILLIGUNG, URTEIL_AB_TAGE, type BesuchKontext,
} from '../lib/crm/besuche';

const HEUTE = '2026-10-31';
const ev = (x: Partial<Event> = {}): Event => ({ id: 'ev-a', titel: 'Mittelstandstag Beispielstadt', format: 'sonstig', ziel: '', datum: '2026-09-20', status: 'durchgefuehrt', marke: 'Netzwerken', geaendert: '2026-09-01', ...x });
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Muster', email: `${id}@example.invalid`, eignung: '', prio: '', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-09-20', ...x } as unknown as Kontakt);
const t = (id: string, eventId: string, x: Partial<Teilnahme> = {}): Teilnahme => ({ id: `t-${id}-${eventId}`, eventId, kontaktId: `c-${id}`, status: 'da', geaendert: '2026-09-20', ...x });
const chance = (x: Partial<Chance> = {}): Chance => ({ id: 'ch-1', titel: 'Beratung', kontaktIds: [], art: 'projekt', wert: { betrag: 10000, basis: 'einmalig' }, stufe: 'angebot', historie: [], angelegt: '2026-09-25T10:00:00.000Z', geaendert: '2026-09-25', ...x } as unknown as Chance);
const ctx = (o: Partial<BesuchKontext> = {}): BesuchKontext => ({ teilnahmen: [], kontakte: [], chancen: [], heute: HEUTE, ...o });
const nw = (schritt: string, x: Record<string, unknown> = {}) => ({ erfassungId: 'x', schritt, zustaendig: 'kevin', erfasstVon: 'kevin', erfasstAm: '2026-09-20T18:00:00.000Z', ...x } as unknown as Teilnahme['netzwerken']);

describe('Wirkung je Event', () => {
  const e = ev({ kostenEuro: 600 });
  const teilnahmen = [
    t('a', 'ev-a', { followUpAm: '2026-09-20', netzwerken: nw('termin', { terminAm: '2026-09-28T10:00' }) }),
    t('b', 'ev-a', { followUpAm: '2026-09-20', netzwerken: nw('angebot') }),
    t('c', 'ev-a', { followUpAm: '2026-09-20', netzwerken: nw('vermitteln') }),
    t('d', 'ev-a', { followUpAm: '2026-09-20', netzwerken: nw('makeone') }),
    t('e', 'ev-a', { netzwerken: nw('followup') }),
    t('abgesagt', 'ev-a', { status: 'abgesagt' }),
    t('fremd', 'ev-b', { followUpAm: '2026-09-20' }),
  ];
  const chancen = [
    chance({ id: 'ch-ev', quelle: 'event', quelleBezug: 'ev-a', stufe: 'angebot', wert: { betrag: 10000, basis: 'einmalig' } }),
    chance({ id: 'ch-nachher', kontaktIds: ['c-a'], stufe: 'gewonnen', wert: { betrag: 5000, basis: 'einmalig' }, angelegt: '2026-10-05T10:00:00.000Z' }),
    chance({ id: 'ch-vorher', kontaktIds: ['c-a'], angelegt: '2026-08-01T10:00:00.000Z' }),
    chance({ id: 'ch-spaet', kontaktIds: ['c-b'], angelegt: '2027-06-01T10:00:00.000Z' }),
    chance({ id: 'ch-andere', kontaktIds: ['c-fremd'], angelegt: '2026-09-25T10:00:00.000Z' }),
    chance({ id: 'ch-verloren', kontaktIds: ['c-c'], stufe: 'verloren', angelegt: '2026-09-26T10:00:00.000Z', wert: { betrag: 7000, basis: 'einmalig' } }),
  ];
  const w = besuchWirkung(e, ctx({ teilnahmen, chancen }));

  it('Kontakte: ohne Absagen und ohne fremde Events; Follow-up-Quote = Kontakte mit nächstem Schritt erledigt', () => {
    expect(w.kontakte).toBe(5);
    expect(w.nachgefasst).toBe(4);
    expect(w.followupQuote).toBeCloseTo(0.8);
    expect(w.nachfassenOffen).toBe(1);
    expect(erfassteTeilnahmen('ev-a', teilnahmen)).toHaveLength(5);
  });
  it('Termine aus dem Erfassen; Deals: aus dem Event entstanden ODER mit einer erfassten Person danach (180 Tage), nie davor, nie fremde', () => {
    expect(w.termine).toBe(1);
    expect(w.dealIds.sort()).toEqual(['ch-ev', 'ch-nachher', 'ch-verloren']);
    expect(w.deals).toBe(3);
    expect(w.pipeline).toBe(10000);   // offene Deals (Angebot) — verloren zählt nicht
    expect(w.umsatz).toBe(5000);      // gewonnen
  });
  it('Kosten je Kontakt: Euro durch erfasste Kontakte — ohne Kosten oder Kontakte keine Zahl', () => {
    expect(w.kosten).toBe(600);
    expect(w.kostenJeKontakt).toBe(120);
    expect(besuchWirkung(ev(), ctx()).kostenJeKontakt).toBeNull();
    expect(besuchWirkung(ev(), ctx()).followupQuote).toBeNull();
    expect(besuchWirkung(e, ctx()).kostenJeKontakt).toBeNull();
  });
  it('Zielpersonen: wie viele getroffen', () => {
    const z = besuchWirkung(ev({ zielpersonen: [{ kontaktId: 'c-a', getroffen: true }, { firmaId: 'f-w1' }] }), ctx());
    expect([z.zielGesamt, z.zielGetroffen]).toEqual([2, 1]);
  });
});

describe('Urteil — „Welche Events lohnen sich“ (erst ab 14 Tagen nach dem Event)', () => {
  const w = (x: Partial<ReturnType<typeof besuchWirkung>>) => ({ ...besuchWirkung(ev(), ctx()), ...x });
  it('zu früh vor Ablauf der Frist und für kommende Events', () => {
    expect(besuchUrteil(ev({ datum: '2026-10-25' }), w({ deals: 2, pipeline: 99999 }), HEUTE).art).toBe('frueh');
    expect(besuchUrteil(ev({ datum: '2026-11-20' }), w({}), HEUTE).art).toBe('frueh');
    expect(URTEIL_AB_TAGE).toBe(14);
  });
  it('lohnt: Deals da und Pipeline + Umsatz decken die Kosten (ohne Kosten genügt ein Deal)', () => {
    expect(besuchUrteil(ev(), w({ kosten: 600, deals: 1, pipeline: 500, umsatz: 200 }), HEUTE).art).toBe('lohnt');
    expect(besuchUrteil(ev(), w({ kosten: 0, deals: 1 }), HEUTE).art).toBe('lohnt');
  });
  it('läuft: Termin oder Deal, aber Kosten nicht gedeckt; ohne: Kontakte, aber nichts daraus', () => {
    expect(besuchUrteil(ev(), w({ kosten: 600, deals: 1, pipeline: 100 }), HEUTE).art).toBe('laeuft');
    expect(besuchUrteil(ev(), w({ termine: 2 }), HEUTE).art).toBe('laeuft');
    expect(besuchUrteil(ev(), w({ kontakte: 4 }), HEUTE).art).toBe('ohne');
  });
});

describe('Übersicht und je Kunde', () => {
  const events = [
    ev({ id: 'ev-1', titel: 'Messe A', datum: '2026-09-10', kostenEuro: 1000, fuer: { art: 'kunde', firmaId: 'f-kunde1' } }),
    ev({ id: 'ev-2', titel: 'Messe B', datum: '2026-09-12', kostenEuro: 300 }),
    ev({ id: 'ev-3', titel: 'Messe C (abgesagt)', datum: '2026-09-14', anmeldung: 'abgesagt', status: 'abgesagt' }),
    ev({ id: 'ev-4', titel: 'Kongress (kommt noch)', datum: '2026-12-01', status: 'geplant' }),
    ev({ id: 'ev-m', titel: 'Stammtisch', marke: 'Make.One', datum: '2026-09-15' }),
    ev({ id: 'ev-5', titel: 'Messe D', datum: '2026-10-01', fuer: { art: 'kunde', firmaId: 'f-kunde1' } }),
  ];
  const teilnahmen = [t('a', 'ev-1'), t('b', 'ev-1'), t('c', 'ev-2'), t('m', 'ev-m'), t('n', 'ev-5')];
  const chancen = [chance({ id: 'ch-1', kontaktIds: ['c-a', 'c-c'], wert: { betrag: 500, basis: 'einmalig' }, angelegt: '2026-09-20T10:00:00.000Z' }), chance({ id: 'ch-2', quelle: 'event', quelleBezug: 'ev-2', wert: { betrag: 400, basis: 'einmalig' } })];
  const c = ctx({ teilnahmen, chancen });
  const u = besuchUebersicht(events, c);

  it('nur besuchte, vergangene, nicht abgesagte Events — Make.One-Abende fehlen; „lohnt sich“ steht oben', () => {
    expect(u.zeilen.map(z => z.event.id)).toEqual(['ev-2', 'ev-1', 'ev-5']);
    expect(u.zeilen.map(z => z.urteil.art)).toEqual(['lohnt', 'laeuft', 'ohne']);
  });
  it('Summe zählt einen Deal, der zu zwei Events passt, nur einmal', () => {
    // ch-1 gehört zu ev-1 (c-a) UND ev-2 (c-c, nachher) — in der Summe nur einmal.
    expect(u.zeilen.find(z => z.event.id === 'ev-1')!.wirkung.dealIds).toContain('ch-1');
    expect(u.zeilen.find(z => z.event.id === 'ev-2')!.wirkung.dealIds).toContain('ch-1');
    expect(u.summe.deals).toBe(2);
    expect(u.summe.events).toBe(3);
    expect(u.summe.kontakte).toBe(4);
    expect(u.summe.kosten).toBe(1300);
  });
  it('je Kunde: ein Eintrag je Firma und „MAKE selbst“ (null) zuletzt; kommende zählen mit, abgesagte nicht', () => {
    const j = besuchJeKunde(events, c);
    expect(j.map(x => x.firmaId)).toEqual(['f-kunde1', null]);
    expect(j[0]).toMatchObject({ eventIds: ['ev-1', 'ev-5'], kontakte: 3 });
    expect(j[1].eventIds.sort()).toEqual(['ev-2', 'ev-4']);
    expect(eventsFuerKunde(events, 'f-kunde1').map(e => e.id)).toEqual(['ev-5', 'ev-1']);
  });
});

describe('Kennzahlen getrennt: Make.One ohne besuchte Events, besuchte mit eigenen', () => {
  const eigener = ev({ id: 'ev-eigen', titel: 'Stammtisch', marke: undefined, datum: '2026-10-20', status: 'durchgefuehrt' });
  const fremd = ev({ id: 'ev-fremd', datum: '2026-10-25' });
  const crm = (extra: Partial<CrmBestand> = {}): CrmBestand => ({
    ...leererBestand(), events: [eigener, fremd],
    // Zehn erfasste Personen am besuchten Event, alle nachgefasst — das darf „Nachgefasst binnen 48 h“ von Make.One nicht beschönigen.
    teilnahmen: [...Array.from({ length: 10 }, (_, i) => t(`n${i}`, 'ev-fremd', { followUpAm: '2026-10-25', netzwerken: nw('termin') })), t('g1', 'ev-eigen'), t('g2', 'ev-eigen')], ...extra,
  });
  it('Nachgefasst binnen 48 h zählt nur die Gäste der eigenen Abende (hier: 0 von 2, nicht 10 von 12)', () => {
    const n = eventKennzahlen([], crm(), HEUTE).find(x => x.id === 'nachfassen_48h')!;
    expect(n.anzeige).toBe('0 %');
    expect(n.quelle).toContain('0 von 2');
  });
  it('Wochen-Scoreboard: dieselbe Trennung bei „Nachgefasst binnen 48 h“', () => {
    const sb = wochenScoreboard([], crm(), HEUTE);
    const nf = sb.zeilen.find(z => z.id === 'nachfassen_48h')!;
    // Die Woche des 20.10. (Eigener Abend, zwei Gäste ohne Nachfassen, Frist 22.10. vorbei) = 0 %; die Woche des 25.10. (nur Fremdes) bleibt leer.
    expect(nf.werte.filter(v => v !== null)).toEqual([0]);
  });
  it('Besuchte Events haben eigene Kennzahlen (90 Tage) und stehen nie in den Make.One-Kennzahlen', () => {
    const b = besuchKennzahlen([eigener, fremd], ctx({ teilnahmen: crm().teilnahmen }));
    expect(b.map(x => x.id)).toEqual(['besuche_events', 'besuche_kontakte', 'besuche_followup', 'besuche_deals', 'besuche_kosten']);
    expect(b.find(x => x.id === 'besuche_events')!.anzeige).toBe('1');
    expect(b.find(x => x.id === 'besuche_kontakte')!.anzeige).toBe('10');
    expect(b.find(x => x.id === 'besuche_followup')).toMatchObject({ anzeige: '100 %', ampel: 'gruen' });
    const make = eventKennzahlen([], crm(), HEUTE);
    expect(make.some(x => x.id.startsWith('besuche_'))).toBe(false);
    expect(make.find(x => x.id === 'events_90')!.anzeige).toBe('1'); // nur der eigene Abend
  });
  it('ohne besuchte Events: alles leer, nie eine erfundene Null', () => {
    const b = besuchKennzahlen([eigener], ctx());
    expect(b.find(x => x.id === 'besuche_events')!.anzeige).toBe('—');
    expect(b.find(x => x.id === 'besuche_followup')).toMatchObject({ anzeige: '—', ampel: 'grau' });
  });
});

describe('„Heute bei“ in Netzwerken bietet die Events aus dem Kalender an', () => {
  const events = [
    ev({ id: 'heute-b', titel: 'Messe heute', datum: HEUTE, status: 'geplant', uhrzeit: '09:00' }),
    ev({ id: 'heute-m', titel: 'Stammtisch heute', datum: HEUTE, status: 'geplant', marke: 'Make.One', uhrzeit: '18:00' }),
    ev({ id: 'gestern', titel: 'Gestern', datum: '2026-10-30' }),
    ev({ id: 'morgen', titel: 'Morgen', datum: '2026-11-01', status: 'geplant' }),
    ev({ id: 'in-6', titel: 'In sechs Tagen', datum: '2026-11-06', status: 'geplant' }),
    ev({ id: 'in-20', titel: 'In zwanzig Tagen', datum: '2026-11-20', status: 'geplant' }),
    ev({ id: 'vor-9', titel: 'Vor neun Tagen', datum: '2026-10-22' }),
    ev({ id: 'abgesagt', titel: 'Abgesagt', datum: HEUTE, anmeldung: 'abgesagt', status: 'abgesagt' }),
    ev({ id: 'm-morgen', titel: 'Make.One morgen', datum: '2026-11-01', status: 'geplant', marke: 'Make.One' }),
  ];
  const a = heuteBeiAngebot(events, HEUTE);
  it('heute zuerst (besuchte vor unseren Abenden), dann besuchte der nahen Tage nach Nähe, der Rest nach Entfernung — Abgesagte nie', () => {
    expect(a.heute.map(e => e.id)).toEqual(['heute-b', 'heute-m']);
    expect(a.nah.map(e => e.id)).toEqual(['gestern', 'morgen', 'in-6']);
    expect(a.rest.map(e => e.id)).toEqual(['m-morgen', 'vor-9', 'in-20']);
    expect([...a.heute, ...a.nah, ...a.rest].some(e => e.id === 'abgesagt')).toBe(false);
  });
  it('das Fenster der nahen Tage ist einstellbar', () => {
    expect(heuteBeiAngebot(events, HEUTE, { zurueck: 10, voraus: 1 }).nah.map(e => e.id)).toEqual(['gestern', 'morgen', 'vor-9']);
  });
});

describe('„An Kunden übergeben“ — CSV nur mit Feldern, nie gesperrte Personen', () => {
  const e = ev({ titel: 'Mittelstandstag „Süd“', fuer: { art: 'kunde', firmaId: 'f-kunde1' } });
  const kontakte = [
    k('anna', { firma: 'Beispielwerk GmbH', position: 'Geschäftsführerin', telefon: '+49 30 1', sms: '0171 2', linkedin: 'https://linkedin.example/anna', firmaWebseite: 'https://beispielwerk.example', notiz: 'GEHEIME NOTIZ', privatNotiz: 'PRIVAT', personInfo: 'INFO' }),
    k('berta', { eingeschraenkt: { seit: '2026-09-25', grund: 'Antrag', von: 'kevin' } }),
    k('carla', { werbesperre: { seit: '2026-09-25', grund: 'Widerspruch', von: 'kevin' } } as Partial<Kontakt>),
    k('dora', { nachname: '=HYPERLINK("http://boese.example")', vorname: '+Dora' }),
  ];
  const teilnahmen = [
    t('anna', e.id, { notiz: 'Gespräch: vertraulich', netzwerken: nw('termin', { info: 'INFO AUS DEM GESPRÄCH', erfasstAm: '2026-09-20T18:00:00.000Z' }) }),
    t('berta', e.id, { netzwerken: nw('nur-kontakt', { erfasstAm: '2026-09-20T18:05:00.000Z' }) }),
    t('carla', e.id, { netzwerken: nw('nur-kontakt', { erfasstAm: '2026-09-20T18:06:00.000Z' }) }),
    t('dora', e.id, { netzwerken: nw('nur-kontakt', { erfasstAm: '2026-09-20T18:07:00.000Z' }) }),
    t('weg', e.id, { netzwerken: nw('nur-kontakt', { erfasstAm: '2026-09-20T18:08:00.000Z' }) }),
    t('fremd', 'ev-andere'),
  ];
  const x = kundenExport({ event: e, teilnahmen, kontakte });

  it('Art. 18 und Werbesperre gehen nie mit — und werden gezählt, nicht verschwiegen; Teilnahmen ohne Person in der Kartei ebenfalls', () => {
    expect(x.anzahl).toBe(2);
    expect(x.ausgelassen).toEqual({ gesperrt: 2, fehlend: 1 });
    expect(x.csv).not.toContain('berta@example.invalid');
    expect(x.csv).not.toContain('carla@example.invalid');
  });
  it('nur Felder: kein Gesprächstext, keine Notiz, keine Kennung, kein Bild und keine Sprachnotiz', () => {
    for (const verboten of ['GEHEIME NOTIZ', 'PRIVAT', 'INFO', 'vertraulich', 'c-anna', 't-anna', 'jpeg', 'foto', 'audio']) expect(x.csv, verboten).not.toContain(verboten);
    expect(x.csv).toContain('anna@example.invalid');
    expect(x.csv).toContain('Beispielwerk GmbH');
    expect(x.csv).toContain('Geschäftsführerin');
  });
  it('Kopfzeile, Herkunft und der Vermerk „keine Werbe-Einwilligung“ stehen in jeder Zeile; Excel-tauglich (BOM, Semikolon, CRLF)', () => {
    const zeilen = x.csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(x.csv.startsWith('﻿')).toBe(true);
    expect(zeilen[0].split(';')).toHaveLength(EXPORT_SPALTEN.length);
    expect(zeilen[0]).toBe(EXPORT_SPALTEN.map(s => `"${s}"`).join(';'));
    expect(zeilen).toHaveLength(3);
    for (const z of zeilen.slice(1)) { expect(z).toContain(EXPORT_KEINE_EINWILLIGUNG); expect(z).toContain('Visitenkarte, persönlich auf der Veranstaltung übergeben'); expect(z).toContain('20.09.2026'); }
    expect(x.dateiname).toBe('kontakte-mittelstandstag-sud-2026-09-20.csv');
  });
  it('Formel-Einschleusung wird neutralisiert (=, +, -, @) und Anführungszeichen werden verdoppelt', () => {
    expect(x.csv).toContain(`"'=HYPERLINK(""http://boese.example"")"`);
    expect(x.csv).toContain(`"'+Dora"`);
    expect(csvFeld('a"b')).toBe('"a""b"');
    expect(csvFeld('-1+1')).toBe(`"'-1+1"`);
    expect(csvFeld('@SUMME')).toBe(`"'@SUMME"`);
    expect(csvFeld('Zeile\nUmbruch')).toBe('"Zeile Umbruch"');
    expect(csvFeld(undefined)).toBe('""');
  });
});
