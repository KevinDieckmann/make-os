// Buchhaltung (02.11.) · Konto löschen: Buchungen bleiben (Aufbewahrung), „geprüft von“ der Person wird „[gelöscht]“.
// Eigener Datenordner, erfundene Werte (Kennungen, @example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buchungenOhnePruefer } from '@/lib/finanzen/buchhaltung/pruefung';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-bh-konto-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-bh-konto';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => { db = await import('@/lib/store/local-db'); });
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const b = (id: string, von?: string) => ({ id, datum: '2026-10-01', wer: 'Beispiel GmbH', betrag: -10, kategorie: 'Büro', ort: 'kdv',
  ...(von ? { pruefung: { status: 'bestaetigt', geprueftVon: von, geprueftAm: '2026-10-02T08:00:00.000Z' } } : {}) });

describe('buchungenOhnePruefer (rein)', () => {
  it('tilgt nur den Speichernamen der Person, sonst dieselbe Liste', () => {
    const l = [b('b1', 'person-weg'), b('b2', 'person-a'), b('b3')];
    const r = buchungenOhnePruefer(l, 'person-weg');
    expect(r.n).toBe(1);
    expect((r.neu[0] as { pruefung: { geprueftVon: string } }).pruefung.geprueftVon).toBe('[gelöscht]');
    expect(r.neu[1]).toBe(l[1]); expect(r.neu[2]).toBe(l[2]);
    const leer = buchungenOhnePruefer(l, 'niemand');
    expect(leer.n).toBe(0); expect(leer.neu).toBe(l);
  });
});

describe('kontoLoeschen · Bestand buchungen', () => {
  it('Buchungen bleiben, „geprüft von“ der gelöschten Person → „[gelöscht]“', { timeout: 180_000 }, async () => {
    const k = (id: string, speicher: string, rolle: string) => ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h-bh' });
    await db.saveJson('konten', { konten: [k('k1', 'person-a', 'inhaber'), k('k2', 'person-weg', 'mitglied')], einladungen: [] });
    await db.saveJson('buchungen', { buchungen: [b('b1', 'person-weg'), b('b2', 'person-a'), b('b3')] });
    const kd = await import('@/lib/datenschutz/konto-daten');
    await kd.kontoLoeschen('person-weg');
    const d = await db.loadJson<{ buchungen: { id: string; pruefung?: { geprueftVon?: string } }[] }>('buchungen');
    expect(d!.buchungen.map(x => x.id)).toEqual(['b1', 'b2', 'b3']);
    expect(JSON.stringify(d)).not.toContain('person-weg');
    expect(d!.buchungen[0].pruefung!.geprueftVon).toBe('[gelöscht]');
    expect(d!.buchungen[1].pruefung!.geprueftVon).toBe('person-a');
  });
});
