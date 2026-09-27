// Datenschicht Stufe 1 (27.09.): Lesefehler sind Fehler, Beschädigtes wird nicht überschrieben,
// Unverändertes nicht geschrieben, Lesecache je Bestand — und Rauschen leert den Zwischenspeicher nicht.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-db1-'));
process.env.MAKE_OS_DATEN_DIR = dir;
const db = await import('../lib/store/local-db');
const memo = await import('../lib/store/memo');
const datei = (n: string) => path.join(dir, `${n}.json`);
afterAll(() => fs.rm(dir, { recursive: true, force: true }));

describe('Stufe 1 — Lesen', () => {
  it('„Datei fehlt“ ist null, ein Lesefehler wirft', async () => {
    expect(await db.loadJson('gibt-es-nicht')).toBeNull();
    await fs.mkdir(datei('verzeichnis'));
    await expect(db.loadJson('verzeichnis')).rejects.toBeInstanceOf(db.BestandNichtLesbar);
    // und updateJson schreibt dann NICHT „leer“ zurück
    await expect(db.updateJson('verzeichnis', () => ({ a: 1 }))).rejects.toBeInstanceOf(db.BestandNichtLesbar);
  });
  it('beschädigt: beiseitegelegt, danach keine Schreibung, bis die Kopie weg ist', async () => {
    await fs.writeFile(datei('kaputt'), '{ "a": ', 'utf8');
    expect(await db.loadJson('kaputt')).toBeNull();
    const kopien = (await fs.readdir(dir)).filter(f => f.startsWith('kaputt.json.corrupt-'));
    expect(kopien).toHaveLength(1);
    await expect(db.updateJson('kaputt', () => ({ a: 1 }))).rejects.toBeInstanceOf(db.BestandBeschaedigt);
    await expect(db.saveJson('kaputt', { a: 1 })).rejects.toBeInstanceOf(db.BestandBeschaedigt);
    await fs.unlink(path.join(dir, kopien[0]));
    expect(await db.updateJson('kaputt', () => ({ a: 2 }))).toEqual({ a: 2 });
  });
  it('Lesecache: eigene Schreibung füllt ihn, eine fremde fällt über stat auf', async () => {
    await db.saveJson('cache', { n: 1 });
    expect(await db.loadJson('cache')).toEqual({ n: 1 });
    await new Promise(r => setTimeout(r, 15));
    await fs.writeFile(datei('cache'), JSON.stringify({ n: 2 }), 'utf8');
    expect(await db.loadJson('cache')).toEqual({ n: 2 });
  });
});

describe('Stufe 1 — Schreiben', () => {
  it('unveränderter Stand wird nicht geschrieben (Inode und Zeit bleiben)', async () => {
    await db.saveJson('still', { liste: [1, 2, 3] });
    const vorher = await fs.stat(datei('still'));
    await new Promise(r => setTimeout(r, 15));
    expect(await db.updateJson<{ liste: number[] }>('still', cur => ({ ...(cur ?? { liste: [] }) }))).toEqual({ liste: [1, 2, 3] });
    await db.saveJson('still', { liste: [1, 2, 3] });
    const nachher = await fs.stat(datei('still'));
    expect(nachher.ino).toBe(vorher.ino);
    expect(nachher.mtimeMs).toBe(vorher.mtimeMs);
    // eine echte Änderung schreibt
    await db.updateJson<{ liste: number[] }>('still', cur => ({ liste: [...(cur?.liste ?? []), 4] }));
    expect((await fs.stat(datei('still'))).ino).not.toBe(vorher.ino);
    expect(await db.loadJson('still')).toEqual({ liste: [1, 2, 3, 4] });
  });
  it('Klartext von früher wird trotz „unverändert“ verschlüsselt, sobald ein Schlüssel da ist', async () => {
    await db.saveJson('alt', { x: 1 });
    process.env.MAKE_OS_DATEN_SCHLUESSEL = 'test-schluessel';
    try {
      db.leseCacheLeeren();
      await db.saveJson('alt', { x: 1 });
      expect(await fs.readFile(datei('alt'), 'utf8')).toContain(db.HUELLE);
      expect(await db.loadJson('alt')).toEqual({ x: 1 });
    } finally { delete process.env.MAKE_OS_DATEN_SCHLUESSEL; db.leseCacheLeeren(); }
  });
});

describe('Stufe 1 — Zwischenspeicher je Bestand', () => {
  it('Rauschen (Anwesenheit, Nutzung, Läufe) lässt Gemerktes stehen, ein echter Bestand nicht', async () => {
    process.env.MAKE_OS_MEMO = 'an';
    memo.memoLeeren();
    let n = 0;
    const rechne = async () => ++n;
    expect(await memo.merken('idx', 60_000, rechne)).toBe(1);
    memo.standErhoehen('anwesenheit'); memo.standErhoehen('nutzung'); memo.standErhoehen('jarvis-auftraege'); memo.standErhoehen('hoi-csp');
    expect(await memo.merken('idx', 60_000, rechne)).toBe(1);
    memo.standErhoehen('kontakte');
    expect(await memo.merken('idx', 60_000, rechne)).toBe(2);
    // 27.09. (Tempo-Prüfung): Zeit & Fokus, Tageslauf, Kalender-Stände und Verläufe sind Rauschen — echte Index-Eingänge nicht.
    for (const n of ['zeit', 'zeit--malin', 'tageslauf', 'calendar-cache', 'kalender-icloud', 'traktion-verlauf', 'performance--malin', 'crm-signale']) expect(memo.istRauschen(n)).toBe(true);
    for (const n of ['crm', 'kontakte', 'grundlage', 'haushalt-buchungen--kevin-malin', 'vitals', 'tasks']) expect(memo.istRauschen(n)).toBe(false);
  });
});
