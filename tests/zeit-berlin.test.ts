// Paket D-A (29.09., #40): „heute“ ist der Berliner Tag — unabhängig von der Zeitzone der Maschine.
// Die vitest-Konfiguration setzt TZ=Europe/Berlin; hier wird absichtlich auf UTC und eine ferne Zone umgestellt.
import { describe, it, expect, afterEach } from 'vitest';
import { localDay, tagVon, tagePlus } from '@/lib/zeit';
import { wannText } from '@/lib/make-one/zoe-verlauf';

const vorher = process.env.TZ;
afterEach(() => { process.env.TZ = vorher; });

describe('localDay/tagVon rechnen in Europe/Berlin (#40)', () => {
  it('die Test-Konfiguration steht auf Berlin', () => {
    expect(process.env.TZ).toBe('Europe/Berlin');
  });
  for (const zone of ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    it(`auch mit TZ=${zone}: 00:30 Berliner Sommerzeit ist schon der neue Tag`, () => {
      process.env.TZ = zone;
      const d = new Date('2026-09-28T22:30:00Z'); // 29.09. 00:30 MESZ
      expect(localDay(d)).toBe('2026-09-29');
      expect(tagVon('2026-09-28T22:30:00.000Z')).toBe('2026-09-29');
      expect(localDay(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01'); // Winterzeit, Jahreswechsel
    });
  }
  it('tagePlus rechnet Kalendertage ohne Zeitzone (auch über die Zeitumstellung)', () => {
    process.env.TZ = 'UTC';
    expect(tagePlus('2026-10-24', 2)).toBe('2026-10-26');
    expect(tagePlus('2026-03-28', 1)).toBe('2026-03-29');
    expect(tagePlus('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('wannText: zwischen 0 und 2 Uhr Berliner Zeit ist es „Heute“ mit Berliner Uhrzeit', () => {
    process.env.TZ = 'UTC';
    expect(wannText('2026-09-28T22:30:00.000Z', '2026-09-29')).toBe('Heute · 00:30');
    expect(wannText('2026-09-28T08:05:00.000Z', '2026-09-29')).toBe('Gestern · 10:05');
    expect(wannText('2026-09-26T08:05:00.000Z', '2026-09-29')).toBe('Sa 26.09.');
  });
});
