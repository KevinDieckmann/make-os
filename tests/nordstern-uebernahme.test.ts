// ─── Einmalige Übernahme des Altbestands „Nordstern“ (08.10. abends, Paket A2) — NUR erfundener Inhalt (Platzhalter) ──────────
// Regeln: ohne Variable nichts; Demo nie; nur der Inhaber mit Haushalt; genau einmal (Marken); nie über vorhandene Daten; der
// persönliche Teil nur mit Einwilligung (a) — und er landet als EIGENES Jahresziel (privat), der gemeinsame Satz als Nordstern.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-nordstern-uebernahme-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-nordstern-uebernahme';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;
delete process.env.MAKE_OS_DEMO;
afterAll(() => { delete process.env.MAKE_OS_ALTBESTAND_PERSON; delete process.env.MAKE_OS_DEMO; rmSync(ordner, { recursive: true, force: true }); });

const PLATZHALTER = 'Platzhalter-Satz für den Haushalt. Persönliches Kernziel: Platzhalter-Ziel der Person.';
const GEMEINSAM = 'Platzhalter-Satz für den Haushalt.';
const PERSOENLICH = 'Platzhalter-Ziel der Person.';
const TAG = '2026-10-08';

type Modul = typeof import('@/lib/altbestand/nordstern-uebernahme');
let m: Modul;
let db: typeof import('@/lib/store/local-db');
const lauf = () => m.nordsternAltbestandUebernehmen({ inhalt: PLATZHALTER, tag: TAG, jahr: 2026 });
const ergebnis = (b: Awaited<ReturnType<typeof lauf>>, teil: 'nordstern' | 'kernziel') => b.teile.find(t => t.name === teil)?.ergebnis;
const eigeneZiele = async () => ((await db.loadJson<{ jahr?: { id: string; titel: string; space?: string; jahr?: number }[] }>('ziele-eigen--person-a'))?.jahr ?? []);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  m = await import('@/lib/altbestand/nordstern-uebernahme');
  const k = (id: string, speicher: string, rolle: string, extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: speicher, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
  await db.saveJson('konten', { konten: [k('k1', 'person-a', 'inhaber', { haushalt: 'haus-u' }), k('k2', 'person-b', 'mitglied', { haushalt: 'haus-u' })], einladungen: [] });
});
beforeEach(() => { delete process.env.MAKE_OS_ALTBESTAND_PERSON; delete process.env.MAKE_OS_DEMO; });

describe('nordsternTeilen (rein)', () => {
  it('teilt an der Marke; ohne Marke alles gemeinsam', () => {
    expect(m.nordsternTeilen(PLATZHALTER)).toEqual({ gemeinsam: GEMEINSAM, persoenlich: PERSOENLICH });
    expect(m.nordsternTeilen('Nur ein Satz.')).toEqual({ gemeinsam: 'Nur ein Satz.', persoenlich: '' });
  });
});

describe('Übernahme', () => {
  it('ohne Variable passiert nichts', async () => {
    const b = await lauf();
    expect(b).toEqual({ lauf: false, grund: 'keine Variable', teile: [] });
    expect(await db.loadJson('nordstern--haus-u')).toBeNull();
  });

  it('Demo-Instanz: auch mit Variable nichts; eine andere Person als der Inhaber: nichts', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    process.env.MAKE_OS_DEMO = '1';
    expect((await lauf()).grund).toBe('Demo-Instanz');
    delete process.env.MAKE_OS_DEMO;
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-b';
    expect((await lauf()).grund).toBe('nicht Inhaber');
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'gibt-es-nicht';
    expect((await lauf()).grund).toBe('kein Konto');
    expect(await db.loadJson('nordstern--haus-u')).toBeNull();
    expect(await db.loadJson('ziele-eigen--person-a')).toBeNull();
  });

  it('mit Variable, ohne Einwilligung (a): Nordstern ja, persönliches Ziel nein', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    const b = await lauf();
    expect(b.lauf).toBe(true);
    expect(ergebnis(b, 'nordstern')).toBe('uebernommen');
    expect(ergebnis(b, 'kernziel')).toBe('ohne-einwilligung');
    const { nordsternLaden } = await import('@/lib/planung/nordstern-server');
    expect((await nordsternLaden('haus-u')).text).toBe(GEMEINSAM);
    expect(await db.loadJson('ziele-eigen--person-a')).toBeNull();
  });

  it('genau einmal: zweiter Lauf schreibt den Nordstern nicht erneut — auch nicht, nachdem er geleert wurde', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    expect(ergebnis(await lauf(), 'nordstern')).toBe('schon-uebernommen');
    const { nordsternSchreiben, nordsternLaden } = await import('@/lib/planung/nordstern-server');
    await nordsternSchreiben('haus-u', '', (await nordsternLaden('haus-u')).stand, { art: 'person', person: 'person-a' });
    expect(ergebnis(await lauf(), 'nordstern')).toBe('schon-uebernommen');
    expect((await nordsternLaden('haus-u')).text).toBe('');
  });

  it('mit Einwilligung (a): persönlicher Teil wird EIGENES Jahresziel (privat) — genau einmal, kommt nach dem Löschen nicht zurück', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    const { gesundheitErklaeren, GESUNDHEIT_FASSUNG } = await import('@/lib/datenschutz/gesundheit-einwilligung');
    expect((await gesundheitErklaeren('person-a', 'verarbeiten', true, GESUNDHEIT_FASSUNG)).ok).toBe(true);
    const b = await lauf();
    expect(ergebnis(b, 'kernziel')).toBe('uebernommen');
    const ziele = await eigeneZiele();
    expect(ziele).toHaveLength(1);
    expect(ziele[0]).toMatchObject({ id: m.KERNZIEL_ID, titel: PERSOENLICH, space: 'privat', jahr: 2026 });
    // Nicht im gemeinsamen Ziele-Bestand.
    expect(JSON.stringify(await db.loadJson('ziele'))).not.toContain(PERSOENLICH);
    expect(ergebnis(await lauf(), 'kernziel')).toBe('schon-uebernommen');
    expect(await eigeneZiele()).toHaveLength(1);
    // Person löscht das Ziel → es kommt nie zurück (Marke).
    await db.saveJson('ziele-eigen--person-a', { tag: [], woche: [], monat: [], quartal: [], jahr: [], fokus: {} });
    expect(ergebnis(await lauf(), 'kernziel')).toBe('schon-uebernommen');
    expect(await eigeneZiele()).toHaveLength(0);
  });

  it('nie über vorhandene Daten: gepflegter Nordstern und gleichlautendes eigenes Ziel bleiben, wie sie sind', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    // Frischer Haushalt-Stand ohne Marken, aber mit gepflegtem Nordstern und einem gleichlautenden eigenen Ziel.
    await db.saveJson('nordstern--haus-u', { nordstern: { text: 'Selbst gepflegter Nordstern (Beispiel)', geaendertAm: '2026-10-01T08:00:00.000Z' } });
    await db.saveJson('ziele-eigen--person-a', { tag: [], woche: [], monat: [], quartal: [], jahr: [{ id: 'z-eigen', titel: PERSOENLICH, fortschritt: 30 }], fokus: {} });
    const b = await lauf();
    expect(ergebnis(b, 'nordstern')).toBe('ziel-belegt');
    expect(ergebnis(b, 'kernziel')).toBe('ziel-belegt');
    const { nordsternLaden } = await import('@/lib/planung/nordstern-server');
    expect((await nordsternLaden('haus-u')).text).toBe('Selbst gepflegter Nordstern (Beispiel)');
    expect(await eigeneZiele()).toEqual([{ id: 'z-eigen', titel: PERSOENLICH, fortschritt: 30 }]);
  });

  it('gepflegter Nordstern zählt als entschieden: belegt → später geleert → Neustart holt den alten Text nicht zurück', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    await db.saveJson('nordstern--haus-u', { nordstern: { text: 'Vorher gepflegt (Beispiel)', geaendertAm: '2026-10-01T08:00:00.000Z' } });
    expect(ergebnis(await lauf(), 'nordstern')).toBe('ziel-belegt');
    const { nordsternSchreiben, nordsternLaden } = await import('@/lib/planung/nordstern-server');
    expect((await nordsternLaden('haus-u')).text).toBe('Vorher gepflegt (Beispiel)');
    await nordsternSchreiben('haus-u', '', (await nordsternLaden('haus-u')).stand, { art: 'person', person: 'person-a' });
    // „Neustart“: der nächste Lauf sieht die Marke und schreibt nichts.
    expect(ergebnis(await lauf(), 'nordstern')).toBe('schon-uebernommen');
    expect((await nordsternLaden('haus-u')).text).toBe('');
  });

  it('ohne gemeinsamen Satz („leer“): Marke gesetzt, kein Nordstern geschrieben', async () => {
    process.env.MAKE_OS_ALTBESTAND_PERSON = 'person-a';
    await db.saveJson('nordstern--haus-u', {});
    const b = await m.nordsternAltbestandUebernehmen({ inhalt: `Persönliches Kernziel: ${PERSOENLICH}`, tag: TAG, jahr: 2026 });
    expect(ergebnis(b, 'nordstern')).toBe('leer');
    const datei = await db.loadJson<{ nordstern?: unknown; altbestand?: { nordstern?: string } }>('nordstern--haus-u');
    expect(datei?.nordstern).toBeUndefined();
    expect(datei?.altbestand?.nordstern).toBe(TAG);
    expect(ergebnis(await lauf(), 'nordstern')).toBe('schon-uebernommen');
  });

  it('der bisherige Inhalt im Modul hat beide Teile (nur Längen geprüft — kein Inhalt im Test)', () => {
    const l = m.altbestandLaengen();
    expect(l.gemeinsam).toBeGreaterThan(10);
    expect(l.persoenlich).toBeGreaterThan(3);
  });
});
