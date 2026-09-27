// Brain-Index (lib/brain/index.ts): Aufbau aus einem Test-Vault, Sicht vor dem Ranking, inkrementell, Löschen.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-vault-'));
const vault = path.join(wurzel, 'Make.Claude');
const daten = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-bi-'));
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DATEN_DIR = daten;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
const ix = await import('../lib/brain/index');
const vaultLib = await import('../lib/zoe/vault');

const schreibe = async (rel: string, text: string) => { const p = path.join(vault, rel); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, text, 'utf8'); };
beforeAll(async () => {
  await fs.mkdir(path.join(wurzel, '.obsidian'), { recursive: true });
  await schreibe('01. KD Ventures/Frank Mathick.md', '---\ntype: person\nscope: intern\ntags: [person, team]\nstand: 2026-09-20\n---\n# Frank Mathick\n\n## Rolle\n\nFrank ist Mitgründer und kümmert sich um die Kapitalseite. Er trifft Kevin dienstags. [[KEMARIS]]\n\n## Zahlen\n\nBeteiligung 20 Prozent.');
  await schreibe('01. KD Ventures/KEMARIS.md', '---\ntype: firma\nscope: intern\n---\n# KEMARIS\n\nBeratung für Mittelstand. Frank und Kevin sind Gesellschafter.');
  await schreibe('02. Privat/Geheimnis.md', '---\ntype: notiz\nscope: privat\nowner: kevin\n---\n# Geheimnis\n\nFrank bekommt zum Geburtstag eine Uhr.');
});
afterAll(async () => { ix.schliesseIndex(); await fs.rm(wurzel, { recursive: true, force: true }); await fs.rm(daten, { recursive: true, force: true }); });

describe('Brain-Index', () => {
  it('baut den Index aus dem Vault und sucht über Abschnitte — Sicht vor dem Ranking', async () => {
    const l = await ix.aktualisieren(true);
    expect(l.neu).toBe(3); expect(l.chunks).toBeGreaterThanOrEqual(3); expect(l.entfernt).toBe(0);
    expect(ix.indexBereit()).toBe(true);
    const kevin = ix.indexSuche('Frank', 5, { person: 'kevin' });
    expect(kevin.treffer.map(t => t.titel)).toContain('Geheimnis');
    expect(kevin.treffer[0].titel).toBe('Frank Mathick');
    expect(kevin.treffer[0].abschnitt).toBeTruthy();
    const malin = ix.indexSuche('Frank', 5, { person: 'malin' });
    expect(malin.treffer.map(t => t.titel)).not.toContain('Geheimnis');
    const agent = ix.indexSuche('Uhr Geburtstag', 5, { person: 'kevin', agent: true });
    expect(agent.treffer).toHaveLength(0);
    // Der Index bedient auch die normale Suche des Vaults
    const ueberVault = await vaultLib.suche('Kapitalseite', 3, { person: 'kevin' });
    expect(ueberVault.treffer[0].titel).toBe('Frank Mathick');
  });
  it('ist inkrementell: unverändert bleibt liegen, Geändertes wird neu zerlegt, Gelöschtes fliegt raus', async () => {
    const nichts = await ix.aktualisieren(true);
    expect(nichts).toMatchObject({ neu: 0, geaendert: 0, entfernt: 0, unveraendert: 3 });
    await schreibe('01. KD Ventures/KEMARIS.md', '---\ntype: firma\n---\n# KEMARIS\n\nBeratung für Mittelstand. Neu: Standort Erfurt.');
    await fs.rm(path.join(vault, '02. Privat/Geheimnis.md'));
    const l = await ix.aktualisieren(true);
    expect(l).toMatchObject({ neu: 0, geaendert: 1, entfernt: 1, unveraendert: 1 });
    expect(ix.indexSuche('Erfurt', 3, { person: 'kevin' }).treffer[0]?.titel).toBe('KEMARIS');
    expect(ix.indexSuche('Uhr', 3, { person: 'kevin' }).treffer).toHaveLength(0);
    expect(ix.indexStand().notizen).toBe(2);
  });
});
