// ─── Paket D-B (29.09.): Brain-Regeln nur freigegeben (#100), Vault-Sicht symmetrisch (#92), Vault-Abgleich meldet
// Konflikt/Push-Fehler (#97), Head of IT warnt ohne Pepper. Test-Vault und Test-Repos in Temp-Ordnern — nie der echte Vault.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs, existsSync } from 'fs';
import { execFileSync } from 'node:child_process';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-d-b-brain-'));
const vault = path.join(wurzel, 'Make.Claude');
const daten = path.join(wurzel, 'daten');
await fs.mkdir(path.join(wurzel, '.obsidian'), { recursive: true });
await fs.mkdir(path.join(vault, '00. Fundament', 'Regeln'), { recursive: true });
await fs.mkdir(daten, { recursive: true });
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_DATEN_DIR = daten;
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
afterAll(() => fs.rm(wurzel, { recursive: true, force: true }));

const regel = (felder: string, titel: string) => `---\ntype: regel\ntitel: ${titel}\nprioritaet: 1\ngilt_fuer: beide\n${felder}\n---\n\n# ${titel}\n\nText der Regel ${titel}.\n`;

describe('Brain-Regeln nur mit Freigabe einer bekannten Person (#100)', () => {
  it('aktiv ohne freigegeben_von, mit unbekannter Person oder unlesbarem Kopf wirkt NICHT', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@test', name: 'K', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' }], einladungen: [] });
    const R = path.join(vault, '00. Fundament', 'Regeln');
    await fs.writeFile(path.join(R, 'gut.md'), regel('status: aktiv\nfreigegeben_von: kevin\nfreigegeben_am: 2026-09-29', 'Regel-Gut'));
    await fs.writeFile(path.join(R, 'ohne.md'), regel('status: aktiv', 'Regel-Ohne-Freigabe'));
    await fs.writeFile(path.join(R, 'fremd.md'), regel('status: aktiv\nfreigegeben_von: angreifer', 'Regel-Unbekannt'));
    await fs.writeFile(path.join(R, 'liste.md'), regel('status: aktiv\nfreigegeben_von:\n  - kevin', 'Regel-Liste'));
    await fs.writeFile(path.join(R, 'block.md'), regel('status: aktiv\nfreigegeben_von: kevin\nnotiz: |\n  eingeschleust', 'Regel-Block'));
    const { regelnFuerPrompt, regelFreigegeben } = await import('@/lib/brain/regeln');
    const block = await regelnFuerPrompt('kevin');
    expect(block).toContain('Regel-Gut');
    for (const t of ['Regel-Ohne-Freigabe', 'Regel-Unbekannt', 'Regel-Liste', 'Regel-Block']) expect(block, t).not.toContain(t);
    expect(regelFreigegeben({ status: 'aktiv', freigegebenVon: 'kevin' }, ['kevin'])).toBe(true);
    expect(regelFreigegeben({ status: 'entwurf', freigegebenVon: 'kevin' }, ['kevin'])).toBe(false);
  });
  it('YAML-Kopf: mehrzeilige Listen werden gelesen, Verschachteltes abgelehnt (Warnung)', async () => {
    const { leseKopf } = await import('@/lib/zoe/vault');
    const a = leseKopf('---\ntype: notiz\ntags:\n  - eins\n  - zwei\nscope: intern\n---\nText');
    expect(a.kopf.tags).toEqual(['eins', 'zwei']);
    expect(a.kopf.scope).toBe('intern');
    expect(a.warnungen).toBeUndefined();
    const b = leseKopf('---\ntype: regel\nquelle:\n  wer: kevin\nstatus: aktiv\n---\n');
    expect(b.warnungen?.[0]).toMatchObject({ feld: 'quelle' });
    expect(b.kopf.felder.quelle).toBeUndefined();
    expect(b.kopf.felder.status).toBe('aktiv');
  });
});

describe('Vault-Sicht symmetrisch (#92)', () => {
  it('Privates sieht nur, wem es gehört — auch Kevin nicht Malins', async () => {
    const { darfSehen } = await import('@/lib/zoe/vault');
    expect(darfSehen({ scope: 'privat', owner: 'malin' }, { person: 'kevin' })).toBe(false);
    expect(darfSehen({ scope: 'privat', owner: 'malin' }, { person: 'malin' })).toBe(true);
    expect(darfSehen({ scope: 'privat', owner: 'kevin' }, { person: 'kevin' })).toBe(true);
    expect(darfSehen({ scope: 'privat' }, { person: 'malin' })).toBe(false); // ohne owner: Kevins Vault
    expect(darfSehen({ scope: 'intern' }, { person: 'kevin' })).toBe(true);
  });
});

describe('Vault-Abgleich meldet Konflikt und Push-Fehler (#97)', () => {
  const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'init.defaultBranch=main', ...a], { cwd, stdio: 'pipe' }).toString();
  const skript = path.resolve(__dirname, '..', 'deploy', 'vault-abgleich.sh');
  const lauf = (repo: string) => { try { execFileSync('bash', [skript, repo], { stdio: 'pipe', env: { ...process.env, MAKE_OS_VAULT_MITTEILUNG: 'aus', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@example.invalid' } }); return 0; } catch (e) { return (e as { status?: number }).status ?? 1; } };

  it('erfolgreicher Push → Marke „letzter Push“; Konflikt → Marke „Konflikt“ bleibt nach dem Abbruch', async () => {
    const basis = path.join(wurzel, 'git');
    const fern = path.join(basis, 'fern.git');
    await fs.mkdir(fern, { recursive: true });
    git(fern, 'init', '--bare', '-q');
    const a = path.join(basis, 'a'), b = path.join(basis, 'b');
    git(basis, 'clone', '-q', fern, a);
    await fs.writeFile(path.join(a, 'Notiz.md'), 'eins\n');
    git(a, 'add', '-A'); git(a, 'commit', '-qm', 'start'); git(a, 'push', '-q', 'origin', 'HEAD:main');
    git(basis, 'clone', '-q', fern, b);
    await fs.writeFile(path.join(a, 'Notiz.md'), 'zwei\n');
    expect(lauf(a)).toBe(0);
    expect(existsSync(path.join(a, '.git', 'make-os-letzter-push'))).toBe(true);
    // b ändert dieselbe Zeile → Konflikt beim Rebase
    await fs.writeFile(path.join(b, 'Notiz.md'), 'drei\n');
    expect(lauf(b)).toBe(1);
    expect(existsSync(path.join(b, '.git', 'make-os-konflikt'))).toBe(true);
    expect(existsSync(path.join(b, '.git', 'rebase-merge'))).toBe(false); // abgebrochen — und trotzdem sichtbar
  });

  it('der Head of IT wird rot bei Konflikt/Push-Fehler und nennt den letzten erfolgreichen Push', async () => {
    const { befundeAus } = await import('@/lib/hoi/lage');
    const innen = { zeit: '2026-09-29T10:00:00Z', prozess: { laufzeitStunden: 1, heapMb: 1, rssMb: 100, node: 'v22' }, bestaende: { anzahl: 1, gesamtMb: 1, groesste: [] }, takt: { letzterLaufMinuten: 1, fehlerquote24h: null, wartend: 0, laufend: 0 }, fehler: { client24h: 0 }, anmeldungen: { fehl24h: 0, neueNetze7d: 0 }, csp: { meldungen7d: 0 }, verschluesselt: true, ki: { schluessel: true, guthabenLeerSeit: null }, datenschutz: { pepper: false, grabsteinOrdner: false, produktion: true } };
    const host = (vault: object) => ({ zeit: '2026-09-29T09:58:00Z', vault });
    const v = (x: object) => befundeAus(innen, host(x), null, '2026-09-29T10:00:00Z').find(b => b.id === 'vault')!;
    expect(v({ letzter_commit_stunden: 0.1, letzter_push_stunden: 1, konflikt: true })).toMatchObject({ ampel: 'rot', wert: 'Konflikt' });
    expect(v({ letzter_commit_stunden: 0.1, letzter_push_stunden: 60, push_fehler: true })).toMatchObject({ ampel: 'rot', wert: 'Push fehlgeschlagen' });
    expect(v({ letzter_commit_stunden: 0.1, letzter_push_stunden: 72 })).toMatchObject({ ampel: 'gelb' });
    expect(v({ letzter_commit_stunden: 0.1, letzter_push_stunden: 72 }).wert).toContain('letzter erfolgreicher Push');
    const alle = befundeAus(innen, null, null, '2026-09-29T10:00:00Z');
    expect(alle.find(b => b.id === 'pepper')).toMatchObject({ ampel: 'gelb' });
    expect(alle.find(b => b.id === 'grabsteine')).toMatchObject({ ampel: 'gelb' });
    const mit = befundeAus({ ...innen, datenschutz: { pepper: true, grabsteinOrdner: true, produktion: true } }, null, null, '2026-09-29T10:00:00Z');
    expect(mit.find(b => b.id === 'pepper')).toMatchObject({ ampel: 'gruen' });
    expect(mit.find(b => b.id === 'grabsteine')).toBeUndefined();
  });
});
