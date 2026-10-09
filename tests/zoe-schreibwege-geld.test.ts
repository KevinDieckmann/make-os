// ─── Brain-Block GELD: Business-Forderungen ohne die Privat-Einheit (09.10., Zusatz zu den ZOE-Schreibwegen) ─────────────────
// Vorher filterte `gatherBrain` die Forderungen mit `firmaId !== 'privat'` — die Selbstständigkeit (Privat-Einheit) zählte als Business und
// stand so in ZOEs „GELD“ und im Kontext der Business-Heads. Jetzt EINE Regel (`bereichVonFirma`): unsere Instanz ohne die Selbstständigkeit,
// eine Instanz mit `NEXT_PUBLIC_MAKE_OS_EINHEITEN` `{"kdc":{"bereich":"business"}}` (Vorbild tests/selbst-privat.test.ts) mit ihr. Erfundene Zahlen.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.MAKE_OS_DATEN_DIR = mkdtempSync(path.join(tmpdir(), 'make-os-zoe-geld-'));
process.env.MAKE_VAULT_DIR = path.join(process.env.MAKE_OS_DATEN_DIR, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';

const HEUTE = '2026-10-09';
const WIE_VORHER = JSON.stringify({ kdc: { bereich: 'business' } });
const RECHNUNGEN = [
  { firmaId: 'kdc', status: 'gestellt', betrag: 1000, faellig: '2026-10-01' },   // Selbstständigkeit (Privat-Einheit), überfällig
  { firmaId: 'kdv', status: 'gestellt', betrag: 200, faellig: '2026-10-20' },
  { firmaId: 'ug', status: 'geplant', betrag: 30 },
  { firmaId: 'privat', status: 'gestellt', betrag: 4 },
  { status: 'gestellt', betrag: 5, faellig: '2026-10-02' },                        // ohne Firma: Business wie bisher
];

/** brain.ts frisch laden — mit (`vorher`) oder ohne die Instanz-Einstellung „Selbstständigkeit im Business“. */
async function geld(vorher: boolean) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_MAKE_OS_EINHEITEN', vorher ? WIE_VORHER : '');
  const { geldAus } = await import('@/lib/brain');
  return geldAus(RECHNUNGEN, HEUTE);
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('Brain GELD: Forderungen nur aus dem Business (bereichVonFirma)', () => {
  it('unsere Instanz: die Selbstständigkeit steht NICHT in den Business-Forderungen', async () => {
    expect(await geld(false)).toEqual({ forderungen: 205, vorbereitung: 30, ueberfaelligeForderungen: 5 });
  });
  it('Instanz mit der Selbstständigkeit im Business: sie zählt wieder mit (Plattform-Umstellung)', async () => {
    expect(await geld(true)).toEqual({ forderungen: 1205, vorbereitung: 30, ueberfaelligeForderungen: 1005 });
  });
  it('gatherBrain nimmt genau diese Rechnung (kein zweiter Filter im Code)', async () => {
    const { readFileSync } = await import('node:fs');
    const t = readFileSync(path.join(__dirname, '..', 'lib', 'brain.ts'), 'utf8');
    expect(t).toMatch(/geld: geldAus\(/);
    const code = t.split('\n').filter(z => !/^\s*(\*|\/\/|\/\*)/.test(z)).join('\n');
    expect(code).not.toMatch(/firmaId !== 'privat'/);
  });
});
