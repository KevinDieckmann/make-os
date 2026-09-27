// Brain-Konsolidierung (lib/brain/konsolidierung.ts): Tagesernte, Regelwerk ohne KI, Riegel — ohne Modellaufruf.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-kons-'));
const vault = path.join(wurzel, 'Make.Claude'); await fs.mkdir(path.join(wurzel, '.obsidian'), { recursive: true }); await fs.mkdir(vault, { recursive: true });
const daten = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-kons-daten-'));
process.env.MAKE_VAULT_DIR = vault; process.env.MAKE_OS_DOKU_WURZEL = 'aus'; process.env.MAKE_OS_DATEN_DIR = daten;
delete process.env.ANTHROPIC_API_KEY;
const K = await import('../lib/brain/konsolidierung');
const G = await import('../lib/jarvis/gedaechtnis');
const I = await import('../lib/brain/inbox');
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true }); await fs.rm(daten, { recursive: true, force: true }); });

describe('Konsolidierung', () => {
  it('Tagesernte nimmt nur frische, nicht gelöschte Fakten', () => {
    const jetzt = '2026-09-27T21:30:00.000Z';
    const f = (zeit: string, extra = {}) => ({ id: 'x', zeit, tag: zeit.slice(0, 10), art: 'zahl', thema: 't', satz: 's', raum: 'kevin', ...extra }) as import('../lib/jarvis/gedaechtnis').Fakt;
    expect(K.tagesernte([f('2026-09-27T08:00:00Z'), f('2026-09-25T08:00:00Z'), f('2026-09-27T09:00:00Z', { geloeschtAm: 'x' })], jetzt)).toHaveLength(1);
    expect(K.regelVorschlag([], '2026-09-27')).toBeNull();
    expect(K.regelVorschlag([f('2026-09-27T08:00:00Z', { raum: 'malin' })], '2026-09-27')).toBeNull();
  });
  it('ohne KI: ein Regelwerk-Vorschlag in der Inbox, danach greift der Tages-Riegel', async () => {
    await G.merke({ art: 'entscheidung', thema: 'KEMARIS', satz: 'Zweiter Standort ab Oktober in Erfurt.', woher: 'Kevin im Gespräch' });
    const r = await K.konsolidieren(new Date().toISOString());
    expect(r).toMatchObject({ ok: true, ohneKi: true, abgelegt: 1 });
    const offen = await I.vorschlaegeLesen({ person: 'kevin' });
    expect(offen).toHaveLength(1); expect(offen[0].text).toContain('Erfurt'); expect(offen[0].ziel).toBe('neu');
    const nochmal = await K.konsolidieren(new Date().toISOString());
    expect(nochmal.text).toBe('heute schon gelaufen');
    const erzwungen = await K.konsolidieren(new Date().toISOString(), true);
    expect(erzwungen.schonDa).toBe(1);
  });
});
