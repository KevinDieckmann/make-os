// Rechnung schreiben unter Business: Einheiten, die zu Privat gehören (Selbstständigkeit), stehen nicht als Absender — ein Weg dorthin (31.10.).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { finanzOrt } from '@/lib/finanzen/navigation';
import { WEG } from '@/lib/wege';

describe('Hinweis „rechnet unter Privat ab“', () => {
  const e = readFileSync('components/os/rechnung/Editor.tsx', 'utf8');
  it('nur für volle Haushaltsmitglieder und nur außerhalb des Privat-Bereichs', () => {
    expect(e).toContain("daten.stand?.sicht === 'privat' && daten.stand?.bereich !== 'privat' && PRIVAT_GESELLSCHAFTEN.length > 0");
    expect(e).toContain('WEG.buchungen({ privat: true })');
  });
  it('der Weg führt zu Privat › Konten & Buchungen › Selbstständigkeit (dort steht „Rechnung schreiben“)', () => {
    const url = new URL(WEG.buchungen({ privat: true }), 'http://x');
    const o = finanzOrt(url.searchParams, { haushalt: true });
    expect(o).toMatchObject({ bereich: 'privat', reiter: 'konten', unter: 'firma' });
  });
});
