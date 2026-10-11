// ─── Fulfillment — Prüf-Funde 11.10.: Löschläufe löschen nie auf unsicherer Grundlage ────────────────────────────────────────────────────
// Funktion 7: ohne CRM-Bestand entfernt `personenFristen` nichts (sonst gälte jede Karte als „Mandat endgültig gelöscht“).
// Funktion 6: ist ein Fulfillment-Bestand UNLESBAR, bricht die Prüfung auf verwaiste Unterlagen ab — keine Datei wird gelöscht (vorher galt er
// als leer und jede Datei als verwaist). Eigener Datenordner, erfundene Daten.
import { describe, it, expect, afterAll, vi } from 'vitest';
import { rmSync, mkdirSync, writeFileSync, utimesSync, existsSync, chmodSync } from 'node:fs';
import path from 'node:path';

const ordner = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const p = await import('node:path');
  const o = mkdtempSync(p.join(tmpdir(), 'make-os-fulfillment-fristen-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pruef-schluessel-fulfillment-fristen', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
  for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'ANTHROPIC_API_KEY']) delete process.env[k];
  return o;
});

import type { PersonenKarte } from '@/lib/fulfillment/typen';

afterAll(() => rmSync(ordner, { recursive: true, force: true }));
const FRISTEN = { personenTage: 90, unterlagenTage: 90, mandatsdatenMonate: 12 };

describe('Löschläufe auf unsicherer Grundlage', () => {
  it('ohne CRM-Bestand: Personenkarten bleiben (Funktion 7)', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'pia', email: 'pia@example.invalid', name: 'Pia', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-ff' }], einladungen: [] });
    const sp = await import('@/lib/fulfillment/speicher');
    const karte: PersonenKarte = { id: 'pp-1', mandatId: 'm-weg', funktion: 'Leitung', name: 'Erika Probe', werdegang: [], themen: [], auftritte: [], aufhaenger: [], identitaet: 'hoch', ausgelassen: [], quellen: [], art14: { faelligAm: '2026-01-01' }, erfasstAm: '2025-12-01', status: 'entwurf' };
    await sp.fulfillmentAendern('personen', d => ({ ok: true, datei: { ...d, karten: [karte] }, geaendert: ['pp-1'] }));
    expect(await db.loadJson('crm')).toBeNull();
    const { personenFristen } = await import('@/lib/fulfillment/analyse/server');
    expect(await personenFristen({ heute: '2026-10-11', jetzt: new Date(), fristen: FRISTEN })).toEqual({});
    expect((await sp.fulfillmentLesen('personen')).karten.map(k => k.id)).toEqual(['pp-1']);
  });

  it('ein unlesbarer Fulfillment-Bestand bricht die Prüfung auf verwaiste Dateien ab (Funktion 6)', async () => {
    const db = await import('@/lib/store/local-db');
    const { leererBestand } = await import('@/lib/crm/speicher');
    await db.saveJson('crm', { ...leererBestand(), mandate: [] });
    const sp = await import('@/lib/fulfillment/speicher');
    const h = await sp.fulfillmentHaushalt();
    const ort = path.join(ordner, 'fulfillment-unterlagen');
    mkdirSync(ort, { recursive: true });
    const datei = path.join(ort, 'ud-verwaist-probe.bin');
    writeFileSync(datei, 'x');
    const alt = new Date(Date.now() - 3 * 86_400_000);
    utimesSync(datei, alt, alt);
    const { kundeFristen } = await import('@/lib/fulfillment/kunde/server');
    // (a) Der Dossier-Bestand ist nicht lesbar (Rechte) — er könnte die Datei nennen.
    const dossiers = path.join(ordner, `${sp.fulfillmentSpeicherFuer('dossiers', h)}.json`);
    writeFileSync(dossiers, '{"version":1,"dossiers":{}}');
    chmodSync(dossiers, 0o000);
    try {
      const z = await kundeFristen({ heute: '2026-10-11', jetzt: new Date(), fristen: FRISTEN });
      expect(z['fulfillment-unterlagen-verwaist']).toBeUndefined();
      expect(existsSync(datei)).toBe(true);
    } finally { chmodSync(dossiers, 0o600); }
    // (b) Er war beschädigt und liegt beiseite (`….corrupt-…`) — ebenso nichts löschen.
    writeFileSync(dossiers, '{ kaputt');
    expect(await kundeFristen({ heute: '2026-10-11', jetzt: new Date(), fristen: FRISTEN })).not.toHaveProperty('fulfillment-unterlagen-verwaist');
    expect(existsSync(datei)).toBe(true);
  });
});
