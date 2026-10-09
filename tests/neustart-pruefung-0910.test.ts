// ─── Prüfung vor dem Upload (09.10.2026, Neustart) — Funde der unabhängigen Prüfung der Einrichtung ───────────────────────────────────────
// 1. Schritt „Neustart: was mitkam“ sagt nicht mehr, die Konten seien mitgekommen (sie werden neu angelegt).
// 2. Steuerfristen VOR dem Neustart-Tag legen keine (überfälligen) Aufgaben an; Fristen ab dem Neustart-Tag wie bisher.
// 3. Mail-Umzug, WhatsApp und Medienspeicher sind im Neustart optional — die Karte auf Heute wartet nicht auf diese eigenen Termine.
// Erfundene Konten, eigener Datenordner.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-neustart-pruefung-'));
const DATEN = path.join(wurzel, 'daten');
process.env.MAKE_OS_DATEN_DIR = DATEN;
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_DEMO', 'MAKE_OS_EINRICHTUNG']) delete process.env[k];
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const db = await import('@/lib/store/local-db');
const D = await import('@/lib/make-one/onboarding-data');

describe('Einrichtung im Neustart — Texte und was zählt', () => {
  it('„Neustart: was mitkam“ nennt die Konten nicht als mitgekommen', () => {
    const s = D.SCHRITTE.find(x => x.id === 'neustart')!;
    expect(s.warum).not.toMatch(/nur eure Konten/);
    expect(s.wie[0]).not.toMatch(/eure Konten/);
    expect(s.wie.join(' ')).toMatch(/Konten \(dieselbe Adresse wie bisher, neuer zweiter Faktor\)/);
  });

  it('Mail-Umzug, WhatsApp und Medienspeicher sind im Neustart optional', () => {
    const alle = D.neustartSchritte();
    for (const id of ['mail-umzug', 'whatsapp', 'medienspeicher']) expect(alle.find(s => s.id === id)?.optional, id).toBe(true);
  });
});

describe('Steuerfristen vor dem Neustart-Tag legen keine Aufgabe an', () => {
  const frist = (id: string, datum: string, tage: number) => ({
    id, datum, einheit: 'kdv', art: 'kst', titel: `Frist ${id}`, hinweis: 'Hinweis', tage, aufgabeAb: '2026-08-01', erledigt: false, href: '/os/finanzen',
  });

  it('mit Neustart-Marke: nur Fristen ab dem Neustart-Tag; ohne Marke wie bisher', async () => {
    await db.saveJson('konten', { konten: [
      { id: 'k1', speicher: 'person-a', email: 'a@example.invalid', name: 'Person A', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-neu' },
    ], einladungen: [] });
    const { steuerAufgabenAbgleichen } = await import('@/lib/steuern/speicher');
    const f = [frist('q3-2026-kst', '2026-09-10', -29), frist('ust-2026-09', '2026-10-12', 3)] as Parameters<typeof steuerAufgabenAbgleichen>[0];

    await fs.mkdir(path.join(DATEN, 'system'), { recursive: true });
    await fs.writeFile(path.join(DATEN, 'system', 'neustart.json'), JSON.stringify({ am: '2026-10-09T19:00:00.000Z', zaehler: { kontakte: 1 } }));
    await steuerAufgabenAbgleichen(f, '2026-10-09');
    const ids = ((await db.loadJson<{ tasks?: { id: string }[] }>('tasks'))?.tasks ?? []).map(t => t.id);
    expect(ids).toContain('steuer-ust-2026-09');
    expect(ids).not.toContain('steuer-q3-2026-kst');

    await fs.rm(path.join(DATEN, 'system', 'neustart.json'));
    await steuerAufgabenAbgleichen(f, '2026-10-09');
    const ids2 = ((await db.loadJson<{ tasks?: { id: string }[] }>('tasks'))?.tasks ?? []).map(t => t.id);
    expect(ids2).toContain('steuer-q3-2026-kst');
  });
});
