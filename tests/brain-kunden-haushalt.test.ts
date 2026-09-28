// ─── ZOE-Kontext (28.09.): Kunden/Mandate nur für Personen im Haushalt des Inhabers ───────────────────
// `gatherBrain` nahm `kundenAusMandaten` für jede Person in den Live-Zustand (→ ZOE-Prompt) — auch für ein Konto
// aus einem fremden Haushalt. Jetzt nur mit `personImHaushaltDesInhabers`. Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Mandat } from '@/lib/crm/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-brain-kunden-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const J = new Date().toISOString();
const H = J.slice(0, 10);
const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@test.invalid`, name: sp, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });
const mandat = (id: string, kunde: string, x: Partial<Mandat> = {}): Mandat => ({ id, kunde, kontaktIds: [], titel: `Mandat ${id}`, art: 'retainer', gesellschaft: 'offen', status: 'aktiv', vertragUnterschrieben: true, verlaengerung: 'offen', honorar: { betrag: 2500, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x });

let brain: typeof import('@/lib/brain');

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  const speicher = await import('@/lib/crm/speicher');
  await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber', 'haus-a'), konto('k2', 'malin', 'mitglied', 'haus-a'), konto('k3', 'gast', 'mitglied', 'haus-b')], einladungen: [] });
  await db.saveJson('crm', { ...speicher.leererBestand(), mandate: [mandat('m-1', 'Probe Eins AG'), mandat('m-2', 'Probe Zwei GmbH'), mandat('m-3', 'Probe Drei KG', { status: 'angebot' })] });
  brain = await import('@/lib/brain');
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('gatherBrain — Kunden nur im Haushalt des Inhabers', () => {
  it('Inhaber und Mitglied seines Haushalts sehen die Mandate', async () => {
    for (const p of ['kevin', 'malin']) {
      const b = await brain.gatherBrain(H, p);
      expect(b.mandate).toMatchObject({ aktiv: 2, gespraech: 1, cashflow: 5000 });
    }
  });
  it('eine Person aus einem anderen Haushalt bekommt nichts davon (auch keine Zahlen im Prompt)', async () => {
    const b = await brain.gatherBrain(H, 'gast');
    expect(b.mandate).toEqual({ aktiv: 0, gespraech: 0, cashflow: 0 });
    const prompt = brain.promptBrain(b);
    expect(prompt).not.toContain('Probe Eins');
    expect(prompt).not.toContain('5.000');
    expect(prompt).not.toMatch(/Mandate:/);
  });
  it('unbekannte Person → nichts', async () => {
    expect((await brain.gatherBrain(H, 'niemand')).mandate.aktiv).toBe(0);
  });
});
