// ─── Instanz-Export ohne Zugangsdaten (09.10., Befund der Medien-Prüfung) ───────────────────────────────────────────────────
// Der Export schrieb jeden Bestand entschlüsselt — auch Token/Passwörter verbundener Dienste und die Zugangsgeheimnisse der Konten.
// Jetzt: Bestände mit `export: false` (PERSON_BESTAENDE) und die OAuth-Bestände stehen nur als Vermerk „entfernt“ drin; Konten ohne Hash,
// Salz, KDF, zweiten Faktor; Einladungen ohne Code. Alles andere unverändert. Eigener Datenordner, erfundene Werte.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-instanz-export-schutz-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const GEHEIM = ['GEHEIM-HASH-1', 'GEHEIM-SALZ-1', 'GEHEIM-TOTP-1', 'GEHEIM-WIEDER-1', 'GEHEIM-EINLADUNG-1', 'GEHEIM-GOOGLE-TOKEN', 'GEHEIM-POSTFACH-PW',
  'GEHEIM-ICLOUD-PW', 'GEHEIM-WHOOP-TOKEN', 'GEHEIM-OAUTH-TOKEN', 'GEHEIM-OAUTH-STATE'];
let text = '';

beforeAll(async () => {
  const db = await import('@/lib/store/local-db');
  await db.saveJson('konten', {
    konten: [{ id: 'k1', speicher: 'eins', email: 'eins@example.invalid', name: 'Eins Prüf', rolle: 'inhaber', hash: 'GEHEIM-HASH-1', salz: 'GEHEIM-SALZ-1', kdf: { N: 16384 },
      angelegt: '2026-10-01', teilt: { gesundheit: [] }, haushalt: 'h', zweiterFaktor: { geheimnis: 'GEHEIM-TOTP-1', seit: '2026-10-01', wiederherstellung: [{ hash: 'GEHEIM-WIEDER-1' }] } }],
    einladungen: [{ code: 'GEHEIM-EINLADUNG-1', von: 'eins', bis: '2026-12-31' }],
  });
  await db.saveJson('google-verbindung--eins', { token: 'GEHEIM-GOOGLE-TOKEN' });
  await db.saveJson('postfach-zugang--eins', { pf: { passwort: 'GEHEIM-POSTFACH-PW' } });
  await db.saveJson('icloud-verbindung--eins', { passwort: 'GEHEIM-ICLOUD-PW' });
  await db.saveJson('whoop-verbindung--eins', { refresh: 'GEHEIM-WHOOP-TOKEN' });
  await db.saveJson('oauth-tokens', { whoop: { access_token: 'GEHEIM-OAUTH-TOKEN' } });
  await db.saveJson('google-oauth-zustand', { s: 'GEHEIM-OAUTH-STATE' });
  await db.saveJson('ziele', { ziele: [{ id: 'z1', titel: 'SICHTBAR-ZIEL' }] });
  const { instanzExportTeile } = await import('@/lib/datenschutz/instanz-export');
  for await (const t of instanzExportTeile({ von: 'eins' })) text += t;
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Instanz-Export: keine Zugangsdaten', () => {
  it('ist gültiges JSON und enthält keinen der geheimen Werte', () => {
    const j = JSON.parse(text);
    expect(j.bestaende).toBeTruthy();
    for (const g of GEHEIM) expect(text, g).not.toContain(g);
  });
  it('Zugangs-Bestände stehen nur als Vermerk drin, normale Bestände vollständig', () => {
    const j = JSON.parse(text) as { bestaende: Record<string, unknown> };
    for (const n of ['google-verbindung--eins', 'postfach-zugang--eins', 'icloud-verbindung--eins', 'whoop-verbindung--eins', 'oauth-tokens', 'google-oauth-zustand']) {
      expect(j.bestaende[n], n).toMatchObject({ entfernt: expect.stringContaining('Zugangsdaten') });
    }
    expect(JSON.stringify(j.bestaende.ziele)).toContain('SICHTBAR-ZIEL');
  });
  it('Konten ohne Hash/Salz/KDF/zweiten Faktor, mit `zweiterFaktorAn`; Einladungen ohne Code', () => {
    const j = JSON.parse(text) as { bestaende: { konten: { konten: Record<string, unknown>[]; einladungen: Record<string, unknown>[] } } };
    const k = j.bestaende.konten.konten[0];
    expect(k).toMatchObject({ speicher: 'eins', email: 'eins@example.invalid', zweiterFaktorAn: true });
    for (const f of ['hash', 'salz', 'kdf', 'zweiterFaktor', 'zweiterFaktorEntwurf']) expect(k, f).not.toHaveProperty(f);
    expect(j.bestaende.konten.einladungen[0]).not.toHaveProperty('code');
    expect(j.bestaende.konten.einladungen[0]).toMatchObject({ von: 'eins' });
  });
  it('der Kopf nennt beides unter „nicht enthalten“', () => {
    const j = JSON.parse(text) as { kopf: { nichtEnthalten: { was: string }[] } };
    const was = j.kopf.nichtEnthalten.map(x => x.was).join(' | ');
    expect(was).toMatch(/Zugangsdaten verbundener Dienste/);
    expect(was).toMatch(/Passwort-Hashes/);
  });
});
