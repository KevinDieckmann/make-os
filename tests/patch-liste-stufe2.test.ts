// Datenschicht Stufe 2 (27.09.): Stand je Zeile (Fingerabdruck) + 409, `teil`, Prüfung in der Sperre, Delta-Abgleich.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-p2-'));
process.env.MAKE_OS_DATEN_DIR = dir;
const { listePatchen, opsLesen } = await import('../lib/store/patch-liste');
const { fingerabdruck, mitStand } = await import('../lib/store/fingerabdruck');
const { deltaAus, deltaAnwenden, staende, StandGedaechtnis } = await import('../lib/kontakte/delta');
const db = await import('../lib/store/local-db');
afterAll(() => fs.rm(dir, { recursive: true, force: true }));

interface Z { id: string; name: string; notiz?: string; log?: string[] }
type Bestand = { zeilen: Z[] };
const saeubern = (e: unknown): Z | null => { const o = e as Record<string, unknown>; return typeof o?.id === 'string' && typeof o.name === 'string' ? { id: o.id, name: o.name, ...(o.notiz ? { notiz: String(o.notiz) } : {}), ...(Array.isArray(o.log) ? { log: o.log as string[] } : {}) } : null; };

describe('Fingerabdruck', () => {
  it('ist stabil, ändert sich mit dem Inhalt und ignoriert das Feld stand', () => {
    const a = { id: '1', name: 'A' };
    expect(fingerabdruck(a)).toBe(fingerabdruck({ ...a }));
    expect(fingerabdruck(a)).not.toBe(fingerabdruck({ id: '1', name: 'B' }));
    expect(fingerabdruck({ ...a, stand: 'xyz' })).toBe(fingerabdruck(a));
    // Reihenfolge der Schlüssel und undefined spielen keine Rolle — verschiedene Schreiber bauen den Datensatz verschieden auf.
    expect(fingerabdruck({ name: 'A', id: '1', notiz: undefined, tief: { b: 1, a: [1, { y: 2, x: 1 }] } })).toBe(fingerabdruck({ id: '1', tief: { a: [1, { x: 1, y: 2 }], b: 1 }, name: 'A' }));
    expect(mitStand([a])[0].stand).toBe(fingerabdruck(a));
  });
});

describe('listePatchen mit Stand', () => {
  it('ohne Stand wie bisher; mit passendem Stand ok; mit altem Stand 409 samt aktuellem Datensatz', async () => {
    await db.saveJson<Bestand>('l1', { zeilen: [{ id: 'a', name: 'Alt' }] });
    const stand = fingerabdruck({ id: 'a', name: 'Alt' });
    const ok = await listePatchen<Z, Bestand>('l1', 'zeilen', [{ op: 'upsert', eintrag: { id: 'a', name: 'Neu' }, stand }], 10);
    expect(ok.ok).toBe(true); expect(ok.zeilen?.[0]).toEqual({ id: 'a', stand: fingerabdruck({ id: 'a', name: 'Neu' }) });
    const konflikt = await listePatchen<Z, Bestand>('l1', 'zeilen', [{ op: 'upsert', eintrag: { id: 'a', name: 'Noch neuer' }, stand }], 10);
    expect(konflikt.ok).toBe(false); expect(konflikt.konflikte?.[0]).toMatchObject({ id: 'a', grund: 'inzwischen geändert', aktuell: { name: 'Neu' } });
    expect((await db.loadJson<Bestand>('l1'))!.zeilen[0].name).toBe('Neu');
    const frei = await listePatchen<Z, Bestand>('l1', 'zeilen', [{ op: 'upsert', eintrag: { id: 'a', name: 'Ohne Stand' } }], 10);
    expect(frei.ok).toBe(true);
    const weg = await listePatchen<Z, Bestand>('l1', 'zeilen', [{ op: 'delete', id: 'a', stand: 'falsch' }], 10);
    expect(weg.ok).toBe(false); expect(weg.konflikte?.[0].grund).toBe('inzwischen geändert');
  });
  it('teil legt Felder auf den aktuellen Eintrag, vereint Logs und meldet Unbekanntes', async () => {
    await db.saveJson<Bestand>('l2', { zeilen: [{ id: 'a', name: 'A', log: ['x'] }] });
    const r = await listePatchen<Z, Bestand>('l2', 'zeilen', [{ op: 'teil', id: 'a', felder: { notiz: 'Hallo' } }], 10, undefined, {
      teil: (alt, felder) => saeubern({ ...alt, ...felder }),
      vereinen: (neu, alt) => ({ ...neu, log: [...(alt.log ?? []), ...(neu.log ?? []).filter(l => !(alt.log ?? []).includes(l))] }),
    });
    expect(r.ok).toBe(true);
    expect((await db.loadJson<Bestand>('l2'))!.zeilen[0]).toEqual({ id: 'a', name: 'A', notiz: 'Hallo', log: ['x'] });
    const u = await listePatchen<Z, Bestand>('l2', 'zeilen', [{ op: 'teil', id: 'gibts-nicht', felder: { notiz: 'x' } }], 10);
    expect(u.ok).toBe(false); expect(u.konflikte?.[0].grund).toBe('unbekannt');
  });
  it('pruefen läuft in der Sperre und lehnt die ganze Änderung ab; Massenlöschung ebenso', async () => {
    await db.saveJson<Bestand>('l3', { zeilen: Array.from({ length: 12 }, (_, i) => ({ id: `z${i}`, name: `N${i}` })) });
    const r = await listePatchen<Z, Bestand>('l3', 'zeilen', [{ op: 'upsert', eintrag: { id: 'z0', name: 'X' } }], 10, undefined, { pruefen: liste => (liste.length === 12 ? 'nicht heute' : null) });
    expect(r).toMatchObject({ ok: false, fehler: 'nicht heute' });
    expect((await db.loadJson<Bestand>('l3'))!.zeilen[0].name).toBe('N0');
    const viel = await listePatchen<Z, Bestand>('l3', 'zeilen', Array.from({ length: 7 }, (_, i) => ({ op: 'delete' as const, id: `z${i}` })), 10);
    expect(viel.ok).toBe(false); expect(viel.fehler).toContain('Hälfte');
  });
  it('opsLesen nimmt stand und teil mit', () => {
    const ops = opsLesen<Z>([{ op: 'upsert', eintrag: { id: 'a', name: 'A', stand: 's1' } }, { op: 'teil', id: 'b', felder: { name: 'B' }, stand: 's2' }, { op: 'delete', id: 'c' }, { op: 'teil', id: 'd' }], saeubern);
    expect(ops).toEqual([{ op: 'upsert', eintrag: { id: 'a', name: 'A' }, stand: 's1' }, { op: 'teil', id: 'b', felder: { name: 'B' }, stand: 's2' }, { op: 'delete', id: 'c' }]);
  });
});

describe('Delta-Abgleich', () => {
  it('liefert nur Geändertes und Gelöschtes; der Browser wendet es an', () => {
    const alt = mitStand([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]);
    const neu = mitStand([{ id: 'a', name: 'A' }, { id: 'b', name: 'B2' }, { id: 'd', name: 'D' }]);
    const d = deltaAus(staende(alt), neu);
    expect(d.geaendert.map(x => x.id)).toEqual(['b', 'd']); expect(d.geloescht).toEqual(['c']);
    expect(deltaAnwenden(alt, d).map(x => `${x.id}:${x.name}`)).toEqual(['a:A', 'b:B2', 'd:D']);
    const g = new StandGedaechtnis(2);
    g.merke('e1', staende(alt)); g.merke('e2', staende(neu)); g.merke('e3', staende(neu));
    expect(g.hole('e1')).toBeNull(); expect(g.hole('e3')).not.toBeNull(); expect(g.hole(null)).toBeNull();
  });
});
