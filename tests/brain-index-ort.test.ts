// ─── Brain-Index nie im Klartext auf der Platte (05.10., Paket „Verschlüsselung lückenlos“) ────────────────────────
// Prüft die Regeln für den Ort (rein), die Erkennung von tmpfs, und am echten Index: mit Datenschlüssel liegt nach einem
// vollen Neubau (Vault + Arbeitsbestände) KEINE Index-Datei (auch kein -wal/-shm) im Datenordner; ein alter Klartext-Index
// wird überschrieben und gelöscht; ein ausdrücklicher Plattenpfad wird verworfen; ohne Schlüssel (lokal) bleibt die Datei.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs, readdirSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-bio-vault-'));
const vault = path.join(wurzel, 'Make.Claude');
const daten = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-bio-daten-'));
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_EMBEDDINGS = 'aus';
delete process.env.MAKE_OS_BRAIN_INDEX;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'test-schluessel-brain-ort-' + 'b'.repeat(30);
const ort = await import('../lib/brain/index-ort');
const ix = await import('../lib/brain/index');

await fs.mkdir(path.join(vault, '01. Arbeit'), { recursive: true });
await fs.writeFile(path.join(vault, '01. Arbeit', 'Mandat Beispiel.md'), '---\ntype: notiz\nscope: intern\n---\n# Mandat Beispiel\n\nVERTRAULICHER-INHALT des Mandats, Strategie und Zahlen.\n');
afterAll(async () => { ix.schliesseIndex(); await fs.rm(wurzel, { recursive: true, force: true }); await fs.rm(daten, { recursive: true, force: true }); });

const nie = () => false;
const eingabe = (env: Record<string, string | undefined>, schluessel: boolean, ram: (p: string) => boolean = nie) => ({ env, schluessel, ramDateisystem: ram, datenOrdner: '/daten' });

describe('Ort des Index (rein)', () => {
  it('mit Datenschlüssel nie auf der Platte: ohne Angabe Arbeitsspeicher, tmpfs-Pfad tmpfs, Plattenpfad verworfen', () => {
    expect(ort.indexOrtWaehlen(eingabe({}, true))).toMatchObject({ art: 'arbeitsspeicher', pfad: ':memory:', klartextAufPlatte: false });
    expect(ort.indexOrtWaehlen(eingabe({ MAKE_OS_BRAIN_INDEX: '/brain-index/index/b.sqlite' }, true, p => p.startsWith('/brain-index')))).toMatchObject({ art: 'tmpfs', pfad: '/brain-index/index/b.sqlite' });
    expect(ort.indexOrtWaehlen(eingabe({ MAKE_OS_BRAIN_INDEX: '/srv/b.sqlite' }, true))).toMatchObject({ art: 'arbeitsspeicher', verworfen: '/srv/b.sqlite' });
    expect(ort.indexOrtWaehlen(eingabe({ MAKE_OS_BRAIN_INDEX: 'speicher' }, false))).toMatchObject({ art: 'arbeitsspeicher' });
  });
  it('ohne Schlüssel (lokale Entwicklung) wie bisher als Datei; Notweg nur ausdrücklich und dann als Klartext markiert', () => {
    expect(ort.indexOrtWaehlen(eingabe({}, false))).toMatchObject({ art: 'platte', pfad: '/daten/brain-index.sqlite', klartextAufPlatte: false });
    expect(ort.indexOrtWaehlen(eingabe({ MAKE_OS_BRAIN_INDEX_PLATTE: '1' }, true))).toMatchObject({ art: 'platte', klartextAufPlatte: true });
  });
  it('tmpfs erkennt den längsten Einhängepunkt (Linux /proc/self/mounts)', () => {
    const mounts = ort.einhaengepunkte('overlay / overlay rw 0 0\ntmpfs /brain-index tmpfs rw,nosuid,nodev,noexec,size=262144k 0 0\n/dev/sda1 /app/.data ext4 rw 0 0\n')!;
    expect(ort.ramDateisystem('/brain-index/index/brain-index.sqlite', mounts)).toBe(true);
    expect(ort.ramDateisystem('/app/.data/brain-index.sqlite', mounts)).toBe(false);
    expect(ort.ramDateisystem('/brain-indexer/x.sqlite', mounts)).toBe(false);
    expect(ort.ramDateisystem('/x', null)).toBe(false);
  });
});

describe('kein Klartext-Brain-Index auf der Platte', () => {
  it('voller Neubau nach dem Start: Index gebaut, im Datenordner keine Index-Datei, kein -wal/-shm', async () => {
    // Ein alter Klartext-Index vom Stand vor dem 05.10. liegt noch da:
    await fs.writeFile(path.join(daten, 'brain-index.sqlite'), 'SQLite format 3\u0000 VERTRAULICHER-INHALT');
    await fs.writeFile(path.join(daten, 'brain-index.sqlite-wal'), 'VERTRAULICHER-INHALT');
    expect(await ix.alterIndexDa()).toBe(true);
    // Die Sicht kommt seit 09.10. aus den Konten (Inhaber + Mitglied eines Haushalts).
    await (await import('./fixtures/konten')).haushaltKonten(await import('@/lib/store/local-db'));
    const nb = await ix.indexNachStart();
    expect(nb.fehler).toBeNull();
    expect(nb.notizen).toBe(1);
    expect(ix.indexOrt().art).toBe('arbeitsspeicher');
    expect(ix.indexBereit()).toBe(true);
    expect(ix.indexSuche('Mandat', 5, await (await import('@/lib/zoe/vault')).sichtAufloesen({ person: 'kevin' })).treffer.length).toBe(1);
    expect(readdirSync(daten).filter(f => f.startsWith('brain-index'))).toEqual([]);
    expect(await ix.alterIndexDa()).toBe(false);
    expect(ix.indexGroesseMb()).toBeGreaterThan(0);
  });

  it('ein ausdrücklicher Plattenpfad wird bei Schlüssel verworfen und dort liegende Dateien gelöscht', async () => {
    const p = path.join(daten, 'woanders', 'index.sqlite');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, 'VERTRAULICHER-INHALT');
    process.env.MAKE_OS_BRAIN_INDEX = p;
    try {
      expect(ix.indexOrt()).toMatchObject({ art: 'arbeitsspeicher', verworfen: p });
      await ix.alterIndexEntfernen();
      expect(existsSync(p)).toBe(false);
      await ix.aktualisieren(true);
      expect(existsSync(p)).toBe(false);
    } finally { delete process.env.MAKE_OS_BRAIN_INDEX; }
  });

  it('ohne Datenschlüssel (lokal) liegt er wie bisher als Datei im Datenordner', async () => {
    const s = process.env.MAKE_OS_DATEN_SCHLUESSEL;
    // Die verschlüsselten Test-Konten (oben) wären ohne Schlüssel unlesbar — der Vault liest sie für die Ordner-Regel (09.10.).
    await fs.rm(path.join(daten, 'konten.json'), { force: true });
    delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
    try {
      expect(ix.indexOrt().art).toBe('platte');
      await ix.aktualisieren(true);
      expect(existsSync(path.join(daten, 'brain-index.sqlite'))).toBe(true);
      expect(await ix.alterIndexEntfernen()).toBe(0); // lokal: nichts wird gelöscht
    } finally { ix.schliesseIndex(); process.env.MAKE_OS_DATEN_SCHLUESSEL = s; }
  });
});
