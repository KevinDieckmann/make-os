// Traktions-Index (26.09.): der Traktions-Score auf dem gemeinsamen Kern —
// Sales 50 · Marketing 40 · Event 10 als geometrisches Mittel, Grundlage
// sichtbar mit Gewicht 0, jede Kennzahl mit Schwellen, Messlücken statt Nullen
// und den Punkten dahinter (Personen, Deals, Beiträge). Erfundene Daten.
import { describe, it, expect } from 'vitest';
import type { Kontakt } from '../lib/make-one/crm';
import type { Beitrag, Chance, CrmBestand, Mandat, PowerHourSitzung } from '../lib/crm/typen';
import { leererBestand } from '../lib/crm/speicher';
import { traktionsIndex, alsTraktion, TRAKTION_KENNZAHLEN, TRAKTION_SAEULEN, IM_SCORE, GRUNDLAGE } from '../lib/crm/traktion-index';
import { WELTEN } from '../lib/crm/traktion';
import { WEG } from '../lib/wege';

const HEUTE = '2026-09-25';
const J = `${HEUTE}T10:00:00.000Z`;
const tag = (i: number) => { const d = new Date(`${HEUTE}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i); return d.toISOString().slice(0, 10); };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id: `c-${id}`, vorname: id, nachname: 'Test', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-08-01', geaendertAm: '2026-08-01', ...x });
const gespraech = (i: number) => ({ am: `${tag(i)}T09:00:00.000Z`, art: 'gespraech' as const, von: 'kevin' as const, text: `Gespräch vor ${i} Tagen` });
const chance = (id: string, x: Partial<Chance> = {}): Chance => ({
  id: `ch-${id}`, titel: id, kontaktIds: [], art: 'retainer', wert: { betrag: 1000, basis: 'monat' }, stufe: 'qualifiziert', historie: [],
  qualifizierung: { schmerz: 'unklar', entscheider: 'unklar', budget: 'unklar', zeitpunkt: 'unklar', wirkung: 'unklar', alternative: 'unklar' },
  gesellschaft: 'kdc', besitzer: 'kevin', angelegt: J, geaendert: HEUTE, ...x,
} as Chance);
const mandat = (id: string, kunde: string, betrag: number): Mandat => ({ id, kunde, kontaktIds: [], titel: 't', art: 'retainer', gesellschaft: 'kdc', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J });
const sitzung = (i: number): PowerHourSitzung => ({ id: `ph-${i}`, person: 'kevin', datum: tag(i), start: `${tag(i)}T08:00:00.000Z`, ziel: { gespraeche: 5, termine: 1 }, karten: [] });
const beitrag = (id: string, x: Partial<Beitrag> = {}): Beitrag => ({ id: `bt-${id}`, titel: id, kanal: 'linkedin', status: 'veroeffentlicht', datum: tag(1), wirkung: [], quellen: [], geaendert: HEUTE, ...x });
const crm = (x: Partial<CrmBestand> = {}): CrmBestand => ({ ...leererBestand(), ...x });
const kz = (pi: ReturnType<typeof traktionsIndex>, id: string) => pi.saeulen.flatMap(s => s.kennzahlen).find(x => x.id === id)!;

// Ein Bestand, in dem Sales und Marketing messen, Event noch nicht.
const kontakte = [
  k('anna', { firma: 'Alpha GmbH', aktivitaeten: [gespraech(1), gespraech(3), gespraech(40)] }),  // erstes Gespräch vor 40 Tagen → kein Erstgespräch
  k('ben', { aktivitaeten: [gespraech(2), gespraech(5)] }),
  k('cara', { aktivitaeten: [gespraech(0), gespraech(6)] }),
  k('dan', { aktivitaeten: [gespraech(2), gespraech(4), gespraech(20)] }),
  k('eva', { aktivitaeten: [{ ...gespraech(1), art: 'notiz' as const }] }),                         // Notiz zählt nicht
];
const voll = crm({
  sitzungen: [sitzung(0), sitzung(2), sitzung(4), sitzung(6), sitzung(12)],
  chancen: [
    chance('a', { quelle: 'content', naechsterSchritt: { text: 'Angebot schicken', datum: tag(-2) } }),
    chance('b', { angelegt: `${tag(10)}T10:00:00.000Z` }),
    chance('alt', { angelegt: `${tag(100)}T10:00:00.000Z`, stufe: 'gewonnen' }),   // älter als 90 Tage: kein neuer Deal
  ],
  mandate: [mandat('m1', 'Alpha GmbH', 3000), mandat('m2', 'Beta AG', 1000)],
  beitraege: [beitrag('p1', { wirkung: [{ kontaktId: 'c-anna', art: 'gespraech', am: tag(3) }, { kontaktId: 'c-ben', art: 'anfrage', am: tag(8) }] }), beitrag('p2', { datum: tag(4) })],
});

describe('Traktions-Index', () => {
  it('Aufbau: die drei Welten 50/40/10 plus Grundlage mit Gewicht 0, Schwellen richtig herum, Kern und Grundlage getrennt', () => {
    expect(TRAKTION_SAEULEN.map(s => [s.id, s.gewicht])).toEqual([['sales', 0.5], ['marketing', 0.4], ['event', 0.1], ['grundlage', 0]]);
    expect(TRAKTION_SAEULEN.slice(0, 3).map(s => s.id)).toEqual(WELTEN.map(w => w.id));
    for (const x of TRAKTION_KENNZAHLEN) {
      expect(x.richtung === 'hoch' ? x.gruen > x.rot : x.gruen < x.rot, x.id).toBe(true);
      expect(x.pflegen?.href, x.id).toMatch(/^\/os\//);
    }
    expect(new Set(TRAKTION_KENNZAHLEN.map(x => x.id)).size).toBe(TRAKTION_KENNZAHLEN.length);
    expect(TRAKTION_KENNZAHLEN.filter(x => x.saeule === 'grundlage').map(x => x.id)).toEqual([...GRUNDLAGE]);
    expect(TRAKTION_KENNZAHLEN.filter(x => x.saeule !== 'grundlage').every(x => Object.values(IM_SCORE).flat().includes(x.id))).toBe(true);
  });

  it('ohne Daten: alles Messlücke, kein Score, Hinweis statt Null', () => {
    const pi = traktionsIndex({ kontakte: [], crm: crm(), heute: HEUTE });
    expect(pi.index).toBeNull();
    expect(pi.luecken).toBe(TRAKTION_KENNZAHLEN.length);
    for (const x of pi.saeulen.flatMap(s => s.kennzahlen)) expect(x.ampel, x.id).toBe('grau');
    expect(alsTraktion(pi)).toMatchObject({ score: null, vorlaeufig: false, hinweis: expect.stringContaining('Noch nichts gemessen') });
  });

  it('Sales misst aus Power Hours, Gesprächen, Deals und Mandaten — mit den Punkten dahinter', () => {
    const pi = traktionsIndex({ kontakte, crm: voll, heute: HEUTE });
    expect(kz(pi, 'power_hours')).toMatchObject({ wert: 4, ampel: 'gruen' });
    expect(kz(pi, 'power_hours').details).toHaveLength(3);
    expect(kz(pi, 'power_hours').details[0]).toMatchObject({ titel: `Power Hour ${HEUTE.slice(8)}.${HEUTE.slice(5, 7)}.`, href: WEG.powerHour() });
    expect(kz(pi, 'gespraeche')).toMatchObject({ wert: 8, ampel: 'gruen' });      // anna 2, ben 2, cara 2, dan 2 — dan vor 20 Tagen nicht, eva Notiz nicht
    expect(kz(pi, 'gespraeche').details.map(d => d.href)).toEqual(expect.arrayContaining(['/os/markttraktion?s=kontakte&a=akte&k=c-cara']));
    expect(kz(pi, 'erstgespraeche')).toMatchObject({ wert: 3, ampel: 'gelb' });   // ben, cara, dan — anna sprach schon vor 40 Tagen
    expect(kz(pi, 'sql_30')).toMatchObject({ wert: 2, ampel: 'gruen' });
    expect(kz(pi, 'sql_30').details.map(d => d.href)).toEqual(['/os/markttraktion?s=sales&a=pipeline&k=ch-a', '/os/markttraktion?s=sales&a=pipeline&k=ch-b']);
    expect(kz(pi, 'ohne_schritt')).toMatchObject({ wert: 1, ampel: 'gelb' });
    expect(kz(pi, 'ohne_schritt').details).toEqual([expect.objectContaining({ ampel: 'rot', href: '/os/markttraktion?s=sales&a=pipeline&k=ch-b' })]);
    expect(kz(pi, 'mrr')).toMatchObject({ wert: 75, ampel: 'rot' });              // Alpha 3.000 von 4.000
    expect(kz(pi, 'mrr').anzeige).toContain('75 %');
  });

  it('Marketing misst; Event bleibt Lücke; der Index ist das geometrische Mittel der messenden Welten', () => {
    const pi = traktionsIndex({ kontakte, crm: voll, heute: HEUTE });
    expect(kz(pi, 'veroeffentlichungen')).toMatchObject({ wert: 2, ampel: 'gruen' });
    expect(kz(pi, 'content_gespraeche')).toMatchObject({ wert: 2, ampel: 'gruen' });
    expect(kz(pi, 'marketing_anteil')).toMatchObject({ wert: 50, ampel: 'gruen' }); // 1 von 2 neuen Deals aus Content — Quote als Prozent
    expect(kz(pi, 'events_90').gemessen).toBe(false);
    const s = Object.fromEntries(pi.saeulen.map(x => [x.id, x]));
    expect(s.sales.score).not.toBeNull();
    expect(s.marketing.score).not.toBeNull();
    expect(s.event.score).toBeNull();
    expect(s.grundlage.gewicht).toBe(0);
    const erwartet = Math.exp((0.5 * Math.log(s.sales.score!) + 0.4 * Math.log(s.marketing.score!)) / 0.9);
    expect(Math.abs(pi.index! - erwartet)).toBeLessThanOrEqual(1);
    // Grundlage wird gemessen (Ansprechbar, Datenreife, Art. 14), zählt aber nicht mit.
    expect(kz(pi, 'reife').gemessen).toBe(true);
    const ohneGrundlage = traktionsIndex({ kontakte: kontakte.map(x => ({ ...x, email: 'x@example.invalid', firma: 'F', position: 'P' })), crm: voll, heute: HEUTE });
    expect(kz(ohneGrundlage, 'reife').wert).toBe(100);
    expect(ohneGrundlage.index).toBe(pi.index);
  });

  it('alsTraktion liefert die alte Form für Scoreboard und Business-Index — vorläufig, solange eine Welt fehlt', () => {
    const t = alsTraktion(traktionsIndex({ kontakte, crm: voll, heute: HEUTE }));
    expect(t.score).not.toBeNull();
    expect(t.vorlaeufig).toBe(true);
    expect(t.hinweis).toContain('Event');
    expect(t.welten.map(w => [w.id, w.score === null])).toEqual([['sales', false], ['marketing', false], ['event', true]]);
    expect(t.welten[0].gemessen).toBe(6);
  });

  it('eigene Schwellen gelten; alle Wege führen in die Software', () => {
    const pi = traktionsIndex({ kontakte, crm: voll, heute: HEUTE, schwellen: { power_hours: { gruen: 6, rot: 3 } } });
    expect(kz(pi, 'power_hours')).toMatchObject({ wert: 4, ampel: 'gelb', angepasst: true, standard: { gruen: 4, rot: 2 } });
    const alle = pi.saeulen.flatMap(s => s.kennzahlen).flatMap(x => [...x.details.map(d => d.href), x.pflegen?.href]).filter(Boolean) as string[];
    expect(alle.filter(h => !h.startsWith('/os/'))).toEqual([]);
  });
});
