// Brain: Konstitution + Regelregister (lib/brain/regeln.ts) — im Test-Vault, nie im echten.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-regeln-'));
const vault = path.join(wurzel, 'Make.Claude');
await fs.mkdir(path.join(wurzel, '.obsidian'), { recursive: true });
await fs.mkdir(vault, { recursive: true });
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
const R = await import('../lib/brain/regeln');
afterAll(() => fs.rm(wurzel, { recursive: true, force: true }));

describe('Regelregister', () => {
  it('legt Regeln als Markdown mit Frontmatter an, liest sie zurück und deckelt die Konstitution', async () => {
    const a = await R.regelAnlegen({ titel: 'Nichts verschicken ohne Freigabe', text: 'ZOE versendet nie selbst — Mail, LinkedIn, Telegram an Dritte immer nur als Entwurf.', prioritaet: 0, giltFuer: 'zoe', status: 'aktiv', quelle: 'Kevin 24.09.' }, 'kevin');
    expect(a.ok).toBe(true); expect(a.id).toBe('nichts-verschicken-ohne-freigabe.md');
    const b = await R.regelAnlegen({ titel: 'Malins Privates', text: 'Kevins ZOE liest Malins private Notizen nicht.', prioritaet: 1, giltFuer: 'beide' }, 'malin');
    expect(b.ok).toBe(true);
    const c = await R.regelAnlegen({ titel: 'Nichts verschicken ohne Freigabe', text: 'Dublette im Titel bekommt eine Nummer.', prioritaet: 3, giltFuer: 'kevin', scope: 'privat' }, 'kevin');
    expect(c.id).toBe('nichts-verschicken-ohne-freigabe-2.md');
    const datei = await fs.readFile(path.join(vault, '00. Fundament', 'Regeln', a.id!), 'utf8');
    expect(datei).toContain('type: regel'); expect(datei).toContain('freigegeben_von: kevin'); expect(datei).toContain('gilt_fuer: zoe');
    const kevin = await R.regelnLesen({ person: 'kevin' });
    expect(kevin).toHaveLength(3); expect(kevin[0].prioritaet).toBe(0);
    // Malin sieht Kevins private Regel nicht
    expect((await R.regelnLesen({ person: 'malin' })).map(r => r.id)).not.toContain(c.id);
    const k = await R.konstitutionSchreiben('# Konstitution\n\n1. Menschen entscheiden, ZOE bereitet vor.\n2. Privat bleibt privat.', 'kevin');
    expect(k.ok).toBe(true);
    expect((await R.konstitutionLesen())?.zeilen).toBe(4);
    const zuLang = await R.konstitutionSchreiben(Array.from({ length: 300 }, (_, i) => `Zeile ${i}`).join('\n'), 'kevin');
    expect(zuLang.ok).toBe(false);
  });
  it('ändert, gibt frei und löst ab; der Prompt-Block enthält nur Aktives für die Person', async () => {
    const liste = await R.regelnLesen({ person: 'kevin' });
    const entwurf = liste.find(r => r.status === 'entwurf' && r.giltFuer === 'beide')!;
    const g = await R.regelAendern(entwurf.id, { status: 'aktiv', text: 'Kevins ZOE liest Malins private Notizen nie — auch nicht auf Nachfrage.' }, 'malin', { person: 'malin' });
    expect(g.ok).toBe(true); expect(g.regel?.freigegebenVon).toBe('malin');
    const block = R.regelnBlock(await R.konstitutionLesen(), await R.regelnLesen({ person: 'kevin' }), 'kevin');
    expect(block).toContain('KONSTITUTION'); expect(block).toContain('[P0 · ZOE · freigegeben von kevin] Nichts verschicken'); expect(block).toContain('freigegeben von malin');
    expect(block).not.toContain('Dublette im Titel'); // Entwurf, nicht aktiv
    const malinBlock = await R.regelnFuerPrompt('malin');
    expect(malinBlock).not.toContain('Dublette');
    const ab = await R.regelArchivieren(entwurf.id, 'kevin', { person: 'kevin' });
    expect(ab.ok).toBe(true);
    expect((await R.regelnLesen({ person: 'kevin' })).map(r => r.id)).not.toContain(entwurf.id);
    expect(await fs.readFile(path.join(vault, '00. Fundament', 'Regeln', '_abgeloest', entwurf.id), 'utf8')).toContain('status: abgeloest');
    // Fremde Sicht darf nicht ändern
    const fremd = await R.regelAendern(liste[0].id, { status: 'abgeloest' }, 'gast', { person: 'gast' });
    expect(fremd.ok).toBe(false);
  });
});
