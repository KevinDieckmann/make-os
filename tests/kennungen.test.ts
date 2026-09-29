// Paket D-A (29.09., #34): Kennungen neuer Datensätze sind Präfix + zufällige UUID — keine Millisekunden-Kennungen mehr.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { neueKennung, zufallsUuid } from '@/lib/kennung';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => { vi.unstubAllGlobals(); });

describe('neueKennung', () => {
  it('Präfix + UUID v4, 10.000 ohne Dublette', () => {
    const k = neueKennung('r');
    expect(k).toMatch(/^r-/);
    expect(k.slice(2)).toMatch(UUID);
    expect(k.length).toBe(38);
    const alle = new Set(Array.from({ length: 10_000 }, () => neueKennung('r')));
    expect(alle.size).toBe(10_000);
  });
  it('ohne randomUUID (Browser ohne sicheren Kontext) aus getRandomValues', () => {
    const echt = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => echt.getRandomValues(a) });
    expect(zufallsUuid()).toMatch(UUID);
  });
  it('passt in die bestehenden Säuberer (Länge ≤ 40 bei Präfixen bis 3 Zeichen, nur [a-z0-9-])', () => {
    for (const p of ['r', 'z', 'm', 'lp', 'bu', 'kp', 'ang', 'ueb', 'eig']) {
      const k = neueKennung(p);
      expect(k.length).toBeLessThanOrEqual(40);
      expect(k).toMatch(/^[a-z0-9][a-z0-9-]{1,63}$/);
    }
  });
});

describe('Wächter: keine Millisekunden-Kennungen im Code', () => {
  // Ausnahmen mit Grund — alles andere nimmt neueKennung() aus lib/kennung.ts.
  const AUSNAHMEN: Record<string, string> = {
    'lib/zugang/konten.ts': 'Speichername-Zusatz bei Namensgleichheit, keine Datensatz-Kennung',
    // Pakete, die parallel an diesen Dateien arbeiten (29.09.) — übernehmen neueKennung selbst:
    'lib/zoe/crm-vorschlag.ts': 'Paket S2',
    'components/os/aufgaben/hilfe.ts': 'Paket Aufgaben',
  };
  it('Date.now().toString(36) als Kennung nur in den Ausnahmen', () => {
    const dateien = execSync('git ls-files app lib components context hooks', { encoding: 'utf8' }).split('\n').filter(f => /\.(ts|tsx|mjs)$/.test(f));
    const funde = dateien.filter(f => !AUSNAHMEN[f] && !f.startsWith('lib/aufgaben/') && !f.startsWith('lib/meldungen/') && !f.startsWith('lib/brain/'))
      .filter(f => { try { return /`[a-z-]*-?\$\{Date\.now\(\)\.toString\(36\)\}|\$\{p(?:raefix)?\}-?\$\{Date\.now\(\)/.test(readFileSync(f, 'utf8')); } catch { return false; } });
    expect(funde).toEqual([]);
  });
});

describe('Kontakt-Kennungen (Paket D-C #35)', () => {
  it('neue Kontakte: c-<uuid>, nie aus E-Mail oder Zeit; alte Formen erkannt', async () => {
    const { neueKontaktKennung, istNeueKontaktKennung, istAlteKontaktKennung } = await import('@/lib/kennung');
    const k = neueKontaktKennung();
    expect(k).toMatch(/^c-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(istNeueKontaktKennung(k)).toBe(true);
    expect(istAlteKontaktKennung(k)).toBe(false);
    for (const alt of ['c-annaexampleinvalid-1x2y3z', 'c-neu-mfx1a2b3c', 'c-weg']) { expect(istAlteKontaktKennung(alt)).toBe(true); expect(istNeueKontaktKennung(alt)).toBe(false); }
    expect(istAlteKontaktKennung('d-abc')).toBe(false);
    // passt in die bestehenden Säuberer (Kontakt-Kennung /^c-[a-z0-9-]{4,60}$/)
    expect(k).toMatch(/^c-[a-z0-9-]{4,60}$/);
  });
  it('Import legt neue Kontakte mit c-<uuid> an — der fachliche Schlüssel bleibt nur Index (zweiter Import: nichts neu)', async () => {
    const { importieren } = await import('@/lib/make-one/crm');
    const zeilen = [{ VORNAME: 'Testa', NACHNAME: 'Kennung', EMAIL: 'testa.kennung@example.invalid', FIRMA: 'Probe GmbH' }];
    const r1 = importieren([], zeilen, '2026-09-29');
    expect(r1.neu).toBe(1);
    const id = r1.kontakte[0].id;
    expect(id).toMatch(/^c-[0-9a-f]{8}-/);
    expect(id).not.toContain('testa');
    const r2 = importieren(r1.kontakte, zeilen, '2026-09-29');
    expect(r2.neu).toBe(0);
    expect(r2.kontakte.map(k => k.id)).toEqual([id]);
  });
});
