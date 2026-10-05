// ─── Bauplan-Bildschirmfotos: verschlüsselt abgelegt, Löschfrist, im Register mit Personenbezug (05.10.) ─
// Eigener Datenordner, erfundene Bilder — nie der echte Bestand.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, utimesSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-bauplan-bilder-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-nur-fuer-bauplan-bilder';
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

import { bilderFaellig } from '@/lib/bauplan/bilder-frist';
import { registerEintrag } from '@/lib/crm/speicher-register';
import { LOESCHFRISTEN } from '@/lib/crm/loeschfristen';
import type { BacklogItem } from '@/lib/make-one/backlog-data';

// Ein echtes (winziges) PNG: Signatur + IHDR reicht für die Typprüfung.
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452000000010000000108060000001f15c489', 'hex')]);
const karte = (x: Partial<BacklogItem>): BacklogItem => ({ id: 'bp-x', titel: 'Erfunden', warum: '', kategorie: 'qualitaet', status: 'offen', prio: 2, block: 'frei', angelegt: '2026-01-01T10:00:00.000Z', ...x });

describe('Löschfrist (rein)', () => {
  const G = '2026-07-07', V = '2026-09-28';
  it('offene Karte behält, fertige/verworfene nach der Frist, verwaiste nach 7 Tagen', () => {
    const items = [
      karte({ id: 'offen', bilder: ['aaaaaaaa-1.png'] }),
      karte({ id: 'fertig-alt', spalte: 'fertig', abgenommen: { von: 'pa', am: '2026-06-01T10:00:00.000Z' }, bilder: ['bbbbbbbb-1.png'] }),
      karte({ id: 'fertig-neu', spalte: 'fertig', abgenommen: { von: 'pa', am: '2026-09-01T10:00:00.000Z' }, bilder: ['cccccccc-1.png'] }),
      karte({ id: 'verworfen', verworfen: true, kommentare: [{ von: 'pa', am: '2026-05-01T10:00:00.000Z', text: 'nein' }], bilder: ['dddddddd-1.png'] }),
    ];
    const d = (name: string, tag = '2026-01-02') => ({ name, tag });
    expect(bilderFaellig(items, [d('aaaaaaaa-1.png'), d('bbbbbbbb-1.png'), d('cccccccc-1.png'), d('dddddddd-1.png'), d('eeeeeeee-1.png', '2026-09-01'), d('ffffffff-1.png', '2026-10-01')], G, V).sort())
      .toEqual(['bbbbbbbb-1.png', 'dddddddd-1.png', 'eeeeeeee-1.png']);
  });
  it('Frist steht in der Tabelle; Register stuft Bilder mit Personenbezug ein (nicht „kein“)', () => {
    expect(LOESCHFRISTEN.find(f => f.id === 'bauplan-bilder')).toMatchObject({ standard: 90, wirkung: 'automatisch' });
    const e = registerEintrag('bauplan-bilder')!;
    expect(e.bezug).toBe('dritte');
    expect(e.loeschfrist).toMatch(/90 Tage/);
    expect(registerEintrag('backlog')?.bezug).not.toBe('kein');
  });
});

describe('Ablage verschlüsselt, Lesen, Aufräumen (Server)', () => {
  it('mit Datenschlüssel liegt auf der Platte nur die Hülle; Lesen liefert das Bild; Klartext-Altbestand bleibt lesbar', async () => {
    const sp = await import('@/lib/bauplan/speicher');
    const r = await sp.bildSpeichern(`data:image/png;base64,${PNG.toString('base64')}`);
    expect('name' in r).toBe(true);
    if (!('name' in r)) return;
    const roh = readFileSync(path.join(ordner, 'bauplan-bilder', r.name));
    expect(roh.subarray(0, 7).toString('ascii')).toBe('MKOSDAT');
    expect(roh.includes(PNG.subarray(8))).toBe(false);
    expect((await sp.bildLesen(r.name))?.daten.equals(PNG)).toBe(true);
    // Unter anderem Namen abgelegt → öffnet sich nicht (AAD).
    writeFileSync(path.join(ordner, 'bauplan-bilder', '99999999-0000.png'), roh);
    expect(await sp.bildLesen('99999999-0000.png')).toBeNull();
    // Alter Klartext
    writeFileSync(path.join(ordner, 'bauplan-bilder', '11111111-alt.png'), PNG);
    expect((await sp.bildLesen('11111111-alt.png'))?.daten.equals(PNG)).toBe(true);
  });
  it('Umschlüsseln verschlüsselt Klartext-Bilder', async () => {
    const { allesUmschluesseln } = await import('@/lib/store/umschluesseln');
    const e = await allesUmschluesseln();
    expect(e.fehler.filter(f => f.startsWith('bauplan-bilder/') && !f.includes('99999999'))).toEqual([]);
    expect(readFileSync(path.join(ordner, 'bauplan-bilder', '11111111-alt.png')).subarray(0, 7).toString('ascii')).toBe('MKOSDAT');
  });
  it('Aufräumen: verwaistes altes Bild weg, Bild an offener Karte bleibt, Name fällt aus der Karte', async () => {
    const sp = await import('@/lib/bauplan/speicher');
    const db = await import('@/lib/store/local-db');
    mkdirSync(path.join(ordner, 'bauplan-bilder'), { recursive: true });
    writeFileSync(path.join(ordner, 'bauplan-bilder', '22222222-fertig.png'), PNG);
    writeFileSync(path.join(ordner, 'bauplan-bilder', '33333333-offen.png'), PNG);
    const alt = new Date('2026-01-01T10:00:00Z');
    for (const n of ['22222222-fertig.png', '33333333-offen.png', '11111111-alt.png', '99999999-0000.png']) utimesSync(path.join(ordner, 'bauplan-bilder', n), alt, alt);
    await db.saveJson('backlog', { items: [
      karte({ id: 'bp-fertig', spalte: 'fertig', abgenommen: { von: 'pa', am: '2026-02-01T10:00:00.000Z' }, bilder: ['22222222-fertig.png'] }),
      karte({ id: 'bp-offen', bilder: ['33333333-offen.png'] }),
    ], etappen: [] });
    const n = await sp.bauplanBilderAufraeumen('2026-07-07', new Date('2026-10-05T10:00:00Z'));
    expect(n).toBe(3); // fertig + zwei verwaiste (11111111-alt, 99999999-0000); dazu das neue aus dem ersten Test bleibt (jung)
    expect(existsSync(path.join(ordner, 'bauplan-bilder', '22222222-fertig.png'))).toBe(false);
    expect(existsSync(path.join(ordner, 'bauplan-bilder', '33333333-offen.png'))).toBe(true);
    const b = await db.loadJson<{ items: BacklogItem[] }>('backlog');
    expect(b?.items.find(k => k.id === 'bp-fertig')?.bilder).toEqual([]);
  });
});
