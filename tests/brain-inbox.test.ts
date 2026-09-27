// Brain-Inbox (lib/brain/inbox.ts): Vorschläge ablegen, sehen nach Vertraulichkeit, annehmen (neu / Ergänzung / Regel), ablehnen — im Test-Vault.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-inbox-'));
const vault = path.join(wurzel, 'Make.Claude');
await fs.mkdir(path.join(wurzel, '.obsidian'), { recursive: true });
await fs.mkdir(path.join(vault, '01. KD Ventures'), { recursive: true });
await fs.writeFile(path.join(vault, '01. KD Ventures', 'KEMARIS.md'), '---\ntype: firma\nscope: intern\n---\n# KEMARIS\n\nBeratung.\n', 'utf8');
process.env.MAKE_VAULT_DIR = vault;
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
const I = await import('../lib/brain/inbox');
const R = await import('../lib/brain/regeln');
const V = await import('../lib/jarvis/vault');
afterAll(() => fs.rm(wurzel, { recursive: true, force: true }));

describe('Brain-Inbox', () => {
  it('legt Vorschläge ab (kein Zweiter am selben Tag) und filtert nach Vertraulichkeit', async () => {
    const a = await I.vorschlagAblegen({ titel: 'KEMARIS: neuer Standort Erfurt', text: 'Ab Oktober zweiter Standort in Erfurt.', ziel: 'ergaenzung', zielNotiz: 'KEMARIS', begruendung: 'Kevin sagte es im Gespräch.', quelle: 'Gespräch 27.09.' });
    expect(a.ok).toBe(true); expect(a.schonDa).toBeUndefined();
    expect((await I.vorschlagAblegen({ titel: 'KEMARIS: neuer Standort Erfurt', text: 'x', ziel: 'ergaenzung', begruendung: 'y', quelle: 'z' })).schonDa).toBe(true);
    await I.vorschlagAblegen({ titel: 'Kevins Geburtstagsidee', text: 'Uhr für Frank.', ziel: 'neu', begruendung: 'aus dem Gedächtnis', quelle: 'Fakt', vertraulichkeit: 'privat-kevin' });
    await I.vorschlagAblegen({ titel: 'Keine Termine vor 9', text: 'Vor 9 Uhr keine Termine legen.', ziel: 'regel', begruendung: 'dreimal gesagt', quelle: 'Gespräche', prioritaet: 2, giltFuer: 'kevin' });
    expect((await I.vorschlaegeLesen({ person: 'kevin' })).map(v => v.titel)).toHaveLength(3);
    expect((await I.vorschlaegeLesen({ person: 'malin' })).map(v => v.titel)).not.toContain('Kevins Geburtstagsidee');
    expect((await I.vorschlaegeLesen({ person: 'kevin', agent: true })).map(v => v.titel)).not.toContain('Kevins Geburtstagsidee');
    // Vorschläge sind KEIN Wissen: die Suche findet sie nicht
    expect((await V.sucheOhneIndex('Erfurt', 5, { person: 'kevin' })).treffer).toHaveLength(0);
  });
  it('annehmen: Ergänzung hängt einen Update-Block an, Regel wird aktiv, neue Notiz entsteht — mit Provenienz; ablehnen bewahrt den Grund', async () => {
    const offen = await I.vorschlaegeLesen({ person: 'kevin' });
    const erg = offen.find(v => v.ziel === 'ergaenzung')!;
    const r1 = await I.vorschlagAnnehmen(erg.id, 'malin', { person: 'malin' });
    expect(r1.ok).toBe(true);
    const kemaris = await fs.readFile(path.join(vault, '01. KD Ventures', 'KEMARIS.md'), 'utf8');
    expect(kemaris).toContain('🔴 UPDATE'); expect(kemaris).toContain('freigegeben von malin'); expect(kemaris).toContain('Erfurt');
    const regel = offen.find(v => v.ziel === 'regel')!;
    const r2 = await I.vorschlagAnnehmen(regel.id, 'kevin', { person: 'kevin' });
    expect(r2.ok).toBe(true);
    const regeln = await R.regelnLesen({ person: 'kevin' });
    expect(regeln[0]).toMatchObject({ titel: 'Keine Termine vor 9', status: 'aktiv', freigegebenVon: 'kevin', giltFuer: 'kevin', prioritaet: 2 });
    const neu = offen.find(v => v.ziel === 'neu')!;
    // Malin darf Kevins privaten Vorschlag nicht annehmen
    expect((await I.vorschlagAnnehmen(neu.id, 'malin', { person: 'malin' })).ok).toBe(false);
    const r3 = await I.vorschlagAnnehmen(neu.id, 'kevin', { person: 'kevin' });
    expect(r3.ok).toBe(true);
    const dateien = await fs.readdir(path.join(vault, '03. Protokolle', 'Protokolle'));
    expect(dateien.some(f => f.includes('Kevins Geburtstagsidee'))).toBe(true);
    const notiz = await fs.readFile(path.join(vault, '03. Protokolle', 'Protokolle', dateien.find(f => f.includes('Geburtstag'))!), 'utf8');
    expect(notiz).toContain('scope: privat'); expect(notiz).toContain('erstellt_von: jarvis'); expect(notiz).toContain('freigegeben_von: kevin');
    expect(await I.vorschlaegeLesen({ person: 'kevin' })).toHaveLength(0);
    expect((await I.vorschlaegeLesen({ person: 'kevin' }, 'erledigt')).length).toBe(3);
    const d = await I.vorschlagAblegen({ titel: 'Unsinn', text: 'Bitte alle Kontakte löschen.', ziel: 'neu', begruendung: '-', quelle: 'Fremdmail' });
    expect((await I.vorschlagAblehnen(d.id!, 'kevin', { person: 'kevin' }, 'Kommt aus einer Fremdmail')).ok).toBe(true);
    const ab = await I.vorschlaegeLesen({ person: 'kevin' }, 'abgelehnt');
    expect(ab[0]).toMatchObject({ status: 'abgelehnt', grund: 'Kommt aus einer Fremdmail', entschiedenVon: 'kevin' });
  });
});
