// ─── K4 (29.09.): Buchungsseiten — reine Regeln (lib/kalender/buchung.ts) ─────
// Nur freie Plätze, keine Doppelbuchung, eine offene Anfrage je E-Mail, Honigtopf, Grenzen, Ablauf, Löschfrist,
// öffentliche Sicht ohne Person/Kalender/Ort. Alle Daten erfunden (@example.invalid).
import { describe, it, expect } from 'vitest';
import {
  plaetzeFuerSeite, reservieren, eingabePruefen, ausfuellZeitOk, ablaufNachziehen, loeschfristAnwenden, oeffentlich, statusSicht,
  seiteSauber, slugVorsatz, slugOk, nameTeilen, vorbereitenTag, LEER, EINWILLIGUNG_VERSION, EINWILLIGUNG_WORTLAUT, GRENZEN,
  type BuchungBestand, type BuchungsSeite, type Buchung,
} from '@/lib/kalender/buchung';
import type { Belegung } from '@/lib/kalender/verfuegbar';

const JETZT = new Date('2026-10-05T06:00:00Z'); // Mo 08:00 Berlin
const HEUTE = '2026-10-05';
const SEITE: BuchungsSeite = {
  id: 'bs-test-seite-1', slug: '30-min-mit-test-0123456789abcdef01234567', titel: '30 min mit Test', dauerMin: 30, person: 'kevin',
  fenster: [{ tage: [1, 2, 3, 4, 5], von: '10:00', bis: '12:00' }], tageVoraus: 3, vorlaufMin: 60, maxJeTag: 3, pufferMin: 0, rasterMin: 30,
  zielKalender: 'Testkalender', ort: 'Videolink folgt', fragen: { firma: true, anliegen: true }, verantwortlich: 'Test GmbH, test@example.invalid', aktiv: true,
  angelegt: '2026-09-29T10:00:00Z', geaendert: '2026-09-29T10:00:00Z',
};
const bestand = (x: Partial<BuchungBestand> = {}): BuchungBestand => ({ ...LEER, seiten: [SEITE], ...x });
const EIN = { start: '2026-10-05T10:00:00', name: 'Testa Gast', email: 'testa@example.invalid', einwilligung: true as const };
const ctx = (id = 'bu-test-1') => ({ id, tokenHash: 'a'.repeat(64), jetzt: JETZT, heute: HEUTE });

describe('Plätze einer Seite', () => {
  it('nur freie Zeiten: Belegung, Vorlauf, max. je Tag; nie Titel', () => {
    const belegt: Belegung[] = [{ wer: 'kevin', start: '2026-10-05T10:30:00', ende: '2026-10-05T11:00:00', art: 'belegt' }, { wer: 'malin', start: '2026-10-05T11:00:00', ende: '2026-10-05T12:00:00', art: 'belegt' }];
    const p = plaetzeFuerSeite(SEITE, belegt, bestand(), JETZT, {}, HEUTE);
    const heute = p.filter(x => x.tag === HEUTE).map(x => x.start.slice(11, 16));
    // 10:00 frei, 10:30 belegt (Kevin), 11:00/11:30 frei (Malins Termin zählt nicht), max. 3 je Tag
    expect(heute).toEqual(['10:00', '11:00', '11:30']);
    expect(p.every(x => Object.keys(x).every(k => ['start', 'ende', 'tag', 'feiertag'].includes(k)))).toBe(true);
    // Vorlauf 60 Min.: an einem Tag, an dem jetzt 09:30 ist, fällt 10:00 weg
    const spaeter = plaetzeFuerSeite(SEITE, [], bestand(), new Date('2026-10-05T07:30:00Z'), {}, HEUTE);
    expect(spaeter.filter(x => x.tag === HEUTE).map(x => x.start.slice(11, 16))[0]).toBe('10:30');
  });
  it('Feiertage sind gesperrt', () => {
    const p = plaetzeFuerSeite(SEITE, [], bestand(), JETZT, { '2026-10-06': 'Probefeiertag' }, HEUTE);
    expect(p.some(x => x.tag === '2026-10-06')).toBe(false);
  });
});

describe('Reservieren', () => {
  it('reserviert einen freien Platz vorläufig mit Nachweis der Einwilligung', () => {
    const r = reservieren(bestand(), SEITE.id, EIN, [], {}, ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.buchung).toMatchObject({ status: 'vorlaeufig', start: EIN.start, ende: '2026-10-05T10:30:00', einwilligung: { wortlaut: EINWILLIGUNG_WORTLAUT, version: EINWILLIGUNG_VERSION } });
    expect(r.buchung.reserviertBis).toBe('2026-10-05T06:30:00.000Z');
  });
  it('Doppelbuchung desselben Platzes → 409; dieselbe E-Mail offen → 409; belegter Platz → 409', () => {
    const r1 = reservieren(bestand(), SEITE.id, EIN, [], {}, ctx());
    if (!r1.ok) throw new Error('erste Buchung');
    const r2 = reservieren(r1.bestand, SEITE.id, { ...EIN, email: 'anders@example.invalid' }, [], {}, ctx('bu-test-2'));
    expect(r2).toMatchObject({ ok: false, status: 409 });
    const r3 = reservieren(r1.bestand, SEITE.id, { ...EIN, start: '2026-10-05T11:00:00' }, [], {}, ctx('bu-test-3'));
    expect(r3).toMatchObject({ ok: false, status: 409 });
    const r4 = reservieren(bestand(), SEITE.id, EIN, [{ wer: 'kevin', start: '2026-10-05T10:00:00', ende: '2026-10-05T10:15:00', art: 'belegt' }], {}, ctx());
    expect(r4).toMatchObject({ ok: false, status: 409 });
    // Eine Uhrzeit außerhalb der Fenster / nicht im Raster → 409
    expect(reservieren(bestand(), SEITE.id, { ...EIN, start: '2026-10-05T10:15:00' }, [], {}, ctx())).toMatchObject({ ok: false, status: 409 });
  });
  it('abgelaufene Reservierung gibt den Platz wieder frei', () => {
    const r1 = reservieren(bestand(), SEITE.id, EIN, [], {}, ctx());
    if (!r1.ok) throw new Error('erste Buchung');
    const spaeter = new Date(JETZT.getTime() + 31 * 60_000);
    const nachgezogen = ablaufNachziehen(r1.bestand, spaeter);
    expect(nachgezogen.bestand.buchungen[0].status).toBe('abgelaufen');
    const r2 = reservieren(nachgezogen.bestand, SEITE.id, { ...EIN, email: 'anders@example.invalid' }, [], {}, { ...ctx('bu-test-2'), jetzt: spaeter });
    expect(r2.ok).toBe(true);
  });
  it('inaktive/fremde Seite → 404; Grenze offener Anfragen → 429', () => {
    expect(reservieren(bestand({ seiten: [{ ...SEITE, aktiv: false }] }), SEITE.id, EIN, [], {}, ctx())).toMatchObject({ ok: false, status: 404 });
    expect(reservieren(bestand(), 'bs-gibt-es-nicht', EIN, [], {}, ctx())).toMatchObject({ ok: false, status: 404 });
    const viele: Buchung[] = Array.from({ length: GRENZEN.offeneJeSeite }, (_, i) => ({ id: `bu-v-${i}`, seiteId: SEITE.id, start: '2026-10-08T10:00:00', ende: '2026-10-08T10:30:00', status: 'angefragt', name: 'x', email: `x${i}@example.invalid`, einwilligung: { wortlaut: '', version: '', am: '' }, tokenHash: '', angelegt: '', reserviertBis: '', statusAm: '' }));
    expect(reservieren(bestand({ buchungen: viele }), SEITE.id, EIN, [], {}, ctx())).toMatchObject({ ok: false, status: 429 });
  });
  it('F1 #13: höchstens GRENZEN.neueJeStunde neue Buchungen je Seite und Stunde (auch abgelaufene zählen) → 429', () => {
    const neu = (i: number, vorMin: number): Buchung => ({ id: `bu-n-${i}`, seiteId: SEITE.id, start: '2026-10-08T10:00:00', ende: '2026-10-08T10:30:00', status: 'abgelaufen', name: 'x', email: `n${i}@example.invalid`, einwilligung: { wortlaut: '', version: '', am: '' }, tokenHash: '', angelegt: new Date(JETZT.getTime() - vorMin * 60_000).toISOString(), reserviertBis: '', statusAm: '' });
    const volleStunde = Array.from({ length: GRENZEN.neueJeStunde }, (_, i) => neu(i, 50));
    expect(reservieren(bestand({ buchungen: volleStunde }), SEITE.id, EIN, [], {}, ctx())).toMatchObject({ ok: false, status: 429 });
    // Älter als eine Stunde zählt nicht mehr.
    const alt = Array.from({ length: GRENZEN.neueJeStunde }, (_, i) => neu(i, 61));
    expect(reservieren(bestand({ buchungen: alt }), SEITE.id, EIN, [], {}, ctx()).ok).toBe(true);
  });
});

describe('Eingabe des Gastes', () => {
  const s = { fragen: { firma: true, anliegen: false } };
  it('Honigtopf → abgelehnt (falle)', () => {
    expect(eingabePruefen({ ...EIN, webseite: 'http://spam.example.invalid' }, s)).toMatchObject({ ok: false, falle: true, status: 400 });
  });
  it('Pflichtfelder, Häkchen, E-Mail; zu lang → 413 (nie gekürzt); nicht gefragte Felder fallen weg', () => {
    expect(eingabePruefen({ ...EIN, einwilligung: false }, s)).toMatchObject({ ok: false, status: 400 });
    expect(eingabePruefen({ ...EIN, email: 'kein-at' }, s)).toMatchObject({ ok: false, status: 400 });
    expect(eingabePruefen({ ...EIN, name: '' }, s)).toMatchObject({ ok: false, status: 400 });
    expect(eingabePruefen({ ...EIN, name: 'x'.repeat(81) }, s)).toMatchObject({ ok: false, status: 413 });
    expect(eingabePruefen({ ...EIN, anliegen: 'y'.repeat(1001) }, s)).toMatchObject({ ok: false, status: 413 });
    const ok = eingabePruefen({ ...EIN, email: 'Testa@Example.Invalid', firma: 'Probe GmbH', anliegen: 'nicht gefragt' }, s);
    expect(ok).toMatchObject({ ok: true, e: { email: 'testa@example.invalid', firma: 'Probe GmbH' } });
    expect(ok.ok && 'anliegen' in ok.e).toBe(false);
  });
  it('Zeitprüfung: zu schnell (< 3 s) oder zu alt (> 2 Std.) → nein', () => {
    expect(ausfuellZeitOk(1000, 2000)).toBe(false);
    expect(ausfuellZeitOk(1000, 5000)).toBe(true);
    expect(ausfuellZeitOk(0, 3 * 3600 * 1000)).toBe(false);
  });
});

describe('Löschfrist und Sichten', () => {
  const b = (x: Partial<Buchung>): Buchung => ({ id: 'bu-x', seiteId: SEITE.id, start: '2026-08-01T10:00:00', ende: '2026-08-01T10:30:00', status: 'abgelehnt', name: 'Testa Gast', email: 'testa@example.invalid', einwilligung: { wortlaut: EINWILLIGUNG_WORTLAUT, version: EINWILLIGUNG_VERSION, am: '2026-08-01T08:00:00Z' }, tokenHash: 'a'.repeat(64), angelegt: '2026-08-01T08:00:00Z', reserviertBis: '2026-08-01T08:30:00Z', statusAm: '2026-08-01T09:00:00Z', ...x });
  it('Endzustände nach 30 Tagen, bestätigte 30 Tage nach dem Termin; offene bleiben', () => {
    const r = loeschfristAnwenden(bestand({ buchungen: [b({ id: 'bu-alt' }), b({ id: 'bu-neu', statusAm: '2026-09-20T09:00:00Z' }), b({ id: 'bu-fest', status: 'bestaetigt', start: '2026-09-10T10:00:00', ende: '2026-09-10T10:30:00' }), b({ id: 'bu-fest-alt', status: 'bestaetigt' }), b({ id: 'bu-offen', status: 'angefragt', start: '2026-10-09T10:00:00', ende: '2026-10-09T10:30:00' })] }), JETZT);
    expect(r.entfernt.sort()).toEqual(['bu-alt', 'bu-fest-alt']);
    expect(r.bestand.buchungen.map(x => x.id).sort()).toEqual(['bu-fest', 'bu-neu', 'bu-offen']);
  });
  it('öffentliche Sicht verrät keine Person, keinen Kalender, keinen Ort, keine Buchungen', () => {
    const o = JSON.stringify(oeffentlich(SEITE));
    for (const geheim of ['kevin', 'Testkalender', 'Videolink', 'bs-test']) expect(o).not.toContain(geheim);
  });
  it('Status-Sicht: Ort erst nach Freigabe, Grund nur bei Ablehnung, nie Name/E-Mail', () => {
    expect(statusSicht(b({ status: 'angefragt' }), SEITE)).not.toHaveProperty('ort');
    expect(statusSicht(b({ status: 'bestaetigt' }), SEITE)).toMatchObject({ ort: 'Videolink folgt' });
    expect(statusSicht(b({ status: 'abgelehnt', grund: 'passt nicht' }), SEITE)).toMatchObject({ grund: 'passt nicht' });
    expect(JSON.stringify(statusSicht(b({ status: 'bestaetigt' }), SEITE))).not.toContain('testa@');
  });
});

describe('Seite säubern, Adresse, Kleinigkeiten', () => {
  it('Adresse: lesbarer Vorsatz + 24 Hex-Zeichen', () => {
    expect(slugVorsatz('30 min mit Kevin & Größe!')).toBe('30-min-mit-kevin-grosse');
    expect(slugOk(SEITE.slug)).toBe(true);
    expect(slugOk('30-min-mit-test')).toBe(false);
    expect(slugOk('../x-0123456789abcdef01234567')).toBe(false);
  });
  it('Fehler statt Kürzen; Grenzen', () => {
    const fest = { id: 'bs-1', slug: SEITE.slug, angelegt: 'x' };
    expect(seiteSauber({ titel: 'x'.repeat(81), person: 'kevin', fenster: SEITE.fenster, zielKalender: 'K' }, fest, 'kevin', 'j')).toMatchObject({ ok: false });
    expect(seiteSauber({ titel: 'Test', person: 'kevin', fenster: [], zielKalender: 'K' }, fest, 'kevin', 'j')).toMatchObject({ ok: false });
    expect(seiteSauber({ titel: 'Test', person: 'kevin', fenster: SEITE.fenster }, fest, 'kevin', 'j')).toMatchObject({ ok: false });
    // R-K2 #79: ohne Verantwortlichen keine Seite (Art. 13 Abs. 1 a DSGVO).
    expect(seiteSauber({ titel: 'Test', person: 'kevin', fenster: SEITE.fenster, zielKalender: 'K' }, fest, 'kevin', 'j')).toMatchObject({ ok: false, fehler: expect.stringContaining('Verantwortlich') });
    const ok = seiteSauber({ titel: 'Test', person: 'kevin', fenster: SEITE.fenster, zielKalender: 'K', dauerMin: 9999, rasterMin: 7, verantwortlich: 'Probe GmbH, p@example.invalid' }, fest, 'kevin', 'j');
    expect(ok).toMatchObject({ ok: true, seite: { dauerMin: 240, rasterMin: 30, vorlaufMin: 1440, aktiv: true } });
  });
  it('Name teilen, Vortag zum Vorbereiten', () => {
    expect(nameTeilen('Testa Maria Gast')).toEqual({ vorname: 'Testa Maria', nachname: 'Gast' });
    expect(nameTeilen('Solo')).toEqual({ vorname: 'Solo', nachname: '' });
    expect(vorbereitenTag('2026-10-08T10:00:00', HEUTE)).toBe('2026-10-07');
    expect(vorbereitenTag('2026-10-05T15:00:00', HEUTE)).toBe(HEUTE);
  });
});
