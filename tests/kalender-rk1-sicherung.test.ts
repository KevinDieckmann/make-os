// Kalender R-K1 #K5 (29.09.) — tägliche Voll-Sicherung je Kalender (verschlüsselt ins Archiv) und Wiederherstellung mit
// Probelauf: zählt zuerst, schreibt nur mit Bestätigung, nur Fehlendes, nie Termine mit Gästen (Teilnehmer-Sperre).
// Eigener Datenordner mit Datenschlüssel, iCloud gemockt (nie ein Netzaufruf), erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-rk1-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-rk1-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-rk1-nur-im-test-0123456789abcdef';

const ic = vi.hoisted(() => ({ objekte: new Map<string, string>(), angelegt: [] as string[] }));
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const KAL = { id: 'https://p42-caldav.icloud.com/123/calendars/home/', name: 'Privat Kevin', schreibbar: true };
  return {
    ...echt,
    verbunden: () => true,
    ladeStand: async () => ({ at: '2026-10-05T01:00:00Z', kalender: [KAL], objekte: {} }),
    holeAlleObjekte: async () => [...ic.objekte.entries()].map(([uid, ics]) => ({ href: `/${uid}.ics`, etag: 'e', ics })),
    objektWiederherstellen: async (_k: unknown, uid: string, ics: string) => { if (ic.objekte.has(uid)) return 'schon-da'; ic.objekte.set(uid, ics); ic.angelegt.push(uid); return 'angelegt'; },
  };
});

const vcal = (uid: string, titel: string, extra: string[] = []) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:20260901T100000Z\r\nDTSTART;TZID=Europe/Berlin:20261005T090000\r\nDTEND;TZID=Europe/Berlin:20261005T100000\r\nSUMMARY:${titel}\r\n${extra.map(x => `${x}\r\n`).join('')}END:VEVENT\r\nEND:VCALENDAR`;
const WER = { art: 'person' as const, person: 'kevin' };
let sv: typeof import('@/lib/kalender/sicherung-server');

beforeAll(async () => {
  sv = await import('@/lib/kalender/sicherung-server');
  ic.objekte.set('a', vcal('a', 'Steuerberater'));
  ic.objekte.set('b', vcal('b', 'Zahnarzt'));
  ic.objekte.set('g', vcal('g', 'Mit Gast', ['ORGANIZER:mailto:kevin@example.invalid', 'ATTENDEE:mailto:gast@example.invalid']));
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('#K5 Voll-Export und Wiederherstellung', () => {
  it('nachts einmal je Tag: je Kalender eine verschlüsselte Datei im Archiv, Stand ohne Titel', async () => {
    expect(await sv.kalenderSicherungTaeglich(new Date('2026-10-05T00:30:00Z'))).toBeNull(); // 02:30 Berlin: noch nicht
    expect(await sv.kalenderSicherungTaeglich(new Date('2026-10-05T01:30:00Z'))).toEqual({ gesichert: 1, fehler: 0 });
    expect(await sv.kalenderSicherungTaeglich(new Date('2026-10-05T05:00:00Z'))).toBeNull(); // derselbe Tag
    const archiv = readdirSync(path.join(ordner, 'archiv'));
    expect(archiv).toEqual(['kalender-export-home-2026-10-05.json']);
    const roh = readFileSync(path.join(ordner, 'archiv', archiv[0]), 'utf8');
    expect(roh).not.toContain('Steuerberater'); expect(roh).not.toContain('gast@example.invalid'); // verschlüsselt, kein Klartext
    const stand = await sv.ladeSicherungStand();
    expect(stand).toMatchObject({ letzterTag: '2026-10-05', dateien: [{ kalender: 'Privat Kevin', kennung: 'home', termine: 3 }] });
    expect(JSON.stringify(stand)).not.toContain('Steuerberater');
  });

  it('Probelauf zählt nur; mit Bestätigung kommt nur Fehlendes ohne Gäste zurück — nie überschreiben', async () => {
    // In Apple gelöscht: b (ohne Gäste) und g (mit Gast); a geändert.
    ic.objekte.delete('b'); ic.objekte.delete('g');
    ic.objekte.set('a', vcal('a', 'Steuerberater (verschoben)'));
    const probe = await sv.kalenderWiederherstellen('Privat Kevin', { wer: WER });
    expect(probe).toMatchObject({ probelauf: true, plan: { fehlt: 1, gesperrt: 1, geaendert: 1, gleich: 0, neu: 0 } });
    expect(ic.angelegt).toEqual([]);
    const echt = await sv.kalenderWiederherstellen('Privat Kevin', { wer: WER, bestaetigt: true });
    expect(echt).toMatchObject({ probelauf: false, angelegt: 1, fehler: 0 });
    expect(ic.angelegt).toEqual(['b']);
    expect(ic.objekte.get('a')).toContain('Steuerberater (verschoben)');
    expect(ic.objekte.has('g')).toBe(false);
    expect(ic.objekte.get('b')).toContain('SUMMARY:Zahnarzt');
  });
});
