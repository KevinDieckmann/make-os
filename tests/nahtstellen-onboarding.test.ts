// ─── Nahtstellen Onboarding (09.10., Endprüfung der Nacht) ───────────────────────────────────────────────────────────────────────
// Die Prüfungen der Einrichtung lesen Bestände anderer Pakete (CRM, Kapazität, Konten-Register, Agenten-Einstellungen). Ein beschädigter
// Bestand (local-db legt ihn als `.corrupt-…` beiseite und liefert danach null) ist „nicht prüfbar“ — nie „leer“, denn bei einem leeren
// Befund entscheidet das Häkchen, und ein altes Häkchen machte den Schritt dann „fertig“. Eigener Datenordner, erfundene Konten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-nahtstellen-onb-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-nahtstellen-onb';
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const HAUS = 'haus-onb';
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const konto = (speicher: string, rolle: 'inhaber' | 'mitglied', x: Record<string, unknown> = {}) => ({ id: `k-${speicher}`, speicher, email: `${speicher}@test.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, ...x });
  await db.saveJson('konten', { konten: [konto('kevin', 'inhaber'), konto('malin', 'inhaber'), konto('partner', 'mitglied', { finanzRecht: 'business' })], einladungen: [] });
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Onboarding-Prüfungen: beschädigter Bestand = „nicht prüfbar“, nie „leer“', () => {
  it('CRM beschädigt → Mandate, Kapazität, Produkte „nicht prüfbar“ (vorher: „kein laufendes Mandat“ → das Häkchen entschied)', async () => {
    writeFileSync(path.join(ordner, 'crm.json'), '{ kaputt');
    const { pruefeAlles } = await import('@/lib/onboarding-status');
    const b = await pruefeAlles('kevin');
    for (const id of ['mandate', 'kapazitaet', 'produkte']) {
      expect(b[id], id).toMatchObject({ erfuellt: false, wert: 'nicht prüfbar' });
      expect(b[id].leer, id).toBeFalsy();
    }
  });
  it('mit einem Häkchen bleibt der Schritt „Laufende Mandate“ offen, solange das CRM nicht lesbar ist', async () => {
    const { istFertig, schrittMitId } = await import('@/lib/make-one/onboarding-data');
    const { pruefeAlles } = await import('@/lib/onboarding-status');
    const befunde = await pruefeAlles('kevin');
    expect(istFertig(schrittMitId('mandate')!, { erledigt: { mandate: { at: '2026-10-01T00:00:00.000Z', von: 'kevin' } }, befunde })).toBe(false);
  });
});
