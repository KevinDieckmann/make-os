// ─── Gesamtprüfung 18.10. (L2 Zählungen A1, L3 B1): Termine eines Mandats — der Rückfall über `kalender-bezug` nur ohne lesbaren Stand ─────────────
// Vorher kamen abgesagte, verschobene und gelöschte Termine über den liegen gebliebenen Bezug (`bezug.tag`) zurück — „nächster Termin“, Kick-off,
// Health und Kunden-Seite zählten einen Termin, den es nicht mehr gibt (Google und iCloud je Person ziehen `bezug.tag` gar nicht nach). Jetzt: mit
// lesbarem Kalender-Stand gilt allein der Stand; der Rückfall nur, wenn es keinen Stand gibt. Dazu (B1): Art und „privat“ gehen mit, die Kunden-Wege
// (`terminTageFuer`) nehmen nur gemeinsame Termine ohne Kalender-Titel. Eigener Datenordner, erfundene Termine, kein Netz (Mac-Stand).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ff-termine-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-termine';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;

const tag = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };
const MANDAT = { id: 'm-ft1', firmaId: 'f-ft1' };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [{ id: '1', speicher: 'pa', email: 'pa@example.invalid', name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: 'h-ft' }], einladungen: [] });
  const jetzt = new Date().toISOString();
  await db.saveJson('kalender-bezug', { bezuege: {
    'u-da': { mandatId: MANDAT.id, tag: tag(3), geaendert: jetzt },
    // In Apple gelöscht bzw. verschoben: der Bezug liegt noch mit dem alten Tag.
    'u-weg': { mandatId: MANDAT.id, tag: tag(2), geaendert: jetzt },
    'u-fokus': { firmaId: MANDAT.firmaId, art: 'fokus', tag: tag(4), geaendert: jetzt },
    'u-intern': { firmaId: MANDAT.firmaId, tag: tag(5), geaendert: jetzt },
  } });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });
// Der Zwischenspeicher (`merken`) ist im Test aus (memoAktiv) — jede Abfrage liest frisch.
beforeEach(async () => (await import('@/lib/store/memo')).memoLeeren());

const mac = (id: string, title: string, n: number) => ({ id, title, startDate: `${tag(n)}T10:00:00`, endDate: `${tag(n)}T11:00:00`, calendarName: 'Arbeit' });

describe('A1: Rückfall über kalender-bezug nur ohne lesbaren Kalender-Stand', () => {
  it('mit Stand: der gelöschte/verschobene Termin kommt nicht über den Bezug zurück', async () => {
    await db.saveJson('calendar-cache', { at: new Date().toISOString(), events: [mac('u-da', 'Abstimmung', 3), mac('u-intern', 'Intern: Preis-Untergrenze', 5)] });
    const { fallTermine } = await import('@/lib/fulfillment/prozesse/termine-server');
    const t = (await fallTermine([MANDAT], tag(0)))[MANDAT.id];
    expect(t.map(x => x.uid)).toEqual(['u-da', 'u-intern']);
    expect(t.some(x => x.uid === 'u-weg' || x.uid === 'u-fokus')).toBe(false);
  });
  it('ohne Stand (kein Abgleich, kein Mac): der Rückfall liefert die Bezüge mit Tag — mit Art aus der Sicherung', async () => {
    await db.saveJson('calendar-cache', { events: [] });
    const { fallTermine } = await import('@/lib/fulfillment/prozesse/termine-server');
    const t = (await fallTermine([MANDAT], tag(1)))[MANDAT.id];
    expect(t.map(x => x.uid)).toEqual(['u-weg', 'u-da', 'u-fokus', 'u-intern']);
    expect(t.find(x => x.uid === 'u-fokus')).toMatchObject({ art: 'fokus' });
    expect(t.every(x => !x.titel)).toBe(true);
  });
  it('Kunden-Weg (`terminTageFuer`): ohne Kalender-Titel, ohne Fokus', async () => {
    await db.saveJson('calendar-cache', { events: [] });
    const { terminTageFuer } = await import('@/lib/fulfillment/kunde/server');
    const t = await terminTageFuer(MANDAT);
    expect(t.map(x => x.uid)).toEqual(['u-weg', 'u-da', 'u-intern']);
    await db.saveJson('calendar-cache', { at: new Date().toISOString(), events: [mac('u-da', 'Abstimmung', 3), mac('u-intern', 'Intern: Preis-Untergrenze', 5)] });
    const mitStand = await terminTageFuer(MANDAT);
    expect(mitStand.map(x => x.uid)).toEqual(['u-da', 'u-intern']);
    expect(JSON.stringify(mitStand)).not.toContain('Preis-Untergrenze');
  });
});
