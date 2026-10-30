// ─── Datenprüfung der Nacht 30.10. — Wächter je Fund (DATEN_NACHT_3010.md) ─────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Werte (Kennungen, @example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-daten-nacht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-daten-nacht';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_DATENSCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
let community: typeof import('@/lib/social/community');
let formular: typeof import('@/lib/crm/formulare-speicher');

const TAG = 86_400_000;
const JETZT = new Date('2026-10-30T08:00:00.000Z');
const vor = (tage: number) => new Date(JETZT.getTime() - tage * TAG).toISOString();

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  community = await import('@/lib/social/community');
  formular = await import('@/lib/crm/formulare-speicher');
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

// ── Fund 1: Fristen von Social-Kommentaren/DMs und Formular-Eingängen wirkten nur beim Abholen bzw. Schreiben ──
describe('Fund 1 · Fristen auch ohne Verbindung bzw. ohne neue Anfrage', () => {
  const alt = { id: 'dm-1', art: 'dm' as const, kanalId: 'sk-1', richtung: 'ein' as const, gegen: { id: '111', name: 'erfunden_alt' }, text: 'alt', am: vor(200) };
  const neu = { id: 'dm-2', art: 'dm' as const, kanalId: 'sk-1', richtung: 'ein' as const, gegen: { id: '222', name: 'erfunden_neu' }, text: 'neu', am: vor(10) };
  const datei = () => ({
    eintraege: { [alt.id]: alt, [neu.id]: neu },
    faeden: { 'dm~sk-1~111': { gelesenBis: vor(199) }, 'dm~sk-1~222': { gelesenBis: vor(9) } },
    entwuerfe: { 'dm~sk-1~111': { fuer: alt.id, text: 'Entwurf', am: vor(199), grund: 'g' }, 'dm~sk-1~222': { fuer: neu.id, text: 'Entwurf', am: vor(9), grund: 'g' } },
    fremd: [
      { id: 'fk-1', kanalId: 'sk-1', link: 'https://www.instagram.com/p/AAAAA/', handle: 'fremd', entwurf: 'x', am: vor(300), von: 'p', erledigtAm: vor(250) },
      { id: 'fk-2', kanalId: 'sk-1', link: 'https://www.instagram.com/p/BBBBB/', entwurf: 'y', am: vor(300), von: 'p' },
    ],
  });

  it('communityFrist (rein): alte Einträge, ihr Faden (trägt die Kennung des Gegenübers), ihr Entwurf und erledigte Fremd-Entwürfe fallen; offene bleiben', () => {
    const r = community.communityFrist(datei(), JETZT);
    expect(Object.keys(r.datei.eintraege)).toEqual(['dm-2']);
    expect(Object.keys(r.datei.faeden)).toEqual(['dm~sk-1~222']);
    expect(Object.keys(r.datei.entwuerfe ?? {})).toEqual(['dm~sk-1~222']);
    expect((r.datei.fremd ?? []).map(f => f.id)).toEqual(['fk-2']);
    expect(r.n).toBe(4);
    const nochmal = community.communityFrist(r.datei, JETZT);
    expect(nochmal.n).toBe(0);
    expect(nochmal.datei).toBe(r.datei);
  });

  it('der Löschfristen-Lauf wendet sie an — ohne Instagram-Konfiguration und ohne Verbindung', async () => {
    delete process.env.INSTAGRAM_APP_ID;
    await db.saveJson('social-community--h-nacht', datei());
    await db.saveJson('angebot-formular--h-nacht', {
      v: 1, einstellungen: {}, links: [],
      eingaenge: [
        { id: 'af-alt', am: vor(800), status: 'verschickt', quelle: 'intern', von: 'p' },
        { id: 'af-offen', am: vor(800), status: 'freigabe', quelle: 'intern', von: 'p' },
        { id: 'af-neu', am: vor(30), status: 'verschickt', quelle: 'intern', von: 'p' },
      ],
    });
    const { loeschfristenLauf } = await import('@/lib/crm/loeschfristen-lauf');
    const r = await loeschfristenLauf(JETZT, true);
    expect(r.bereinigt['social-community']).toBe(4);
    expect(r.bereinigt['angebot-formular']).toBe(1);
    const c = await db.loadJson<{ eintraege: Record<string, unknown> }>('social-community--h-nacht');
    expect(Object.keys(c!.eintraege)).toEqual(['dm-2']);
    const f = await db.loadJson<{ eingaenge: { id: string }[] }>('angebot-formular--h-nacht');
    expect(f!.eingaenge.map(e => e.id)).toEqual(['af-offen', 'af-neu']);
    // idempotent, ohne Bestand nichts
    expect(await community.communityFristAnwenden('social-community--h-nacht', JETZT)).toBe(0);
    expect(await formular.formularFristAnwenden('angebot-formular--h-gibts-nicht', JETZT)).toBe(0);
    expect(await db.loadJson('angebot-formular--h-gibts-nicht')).toBeNull();
  });
});
