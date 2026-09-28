// ─── „Heute“ ist der Berliner Tag (28.09., K3 · #75/#77) ────────────────────
// `toISOString().slice(0, 10)` liefert den UTC-Tag — nachts zwischen 0 und 2 Uhr
// (MESZ) liegt der einen Tag zurück. Hier fest auf Europe/Berlin, damit der Test
// auf jedem Rechner dasselbe prüft.
process.env.TZ = 'Europe/Berlin';
import { describe, it, expect } from 'vitest';
import { dealAusLead, type LeadZeile } from '../lib/crm/leads';
import { verarbeitungenStart } from '../lib/crm/datenschutz';
import { saeubern } from '../lib/crm/speicher';
import { tagVon, localDay } from '../lib/zeit';

// 00:30 Uhr Berliner Zeit am 28.09. = 22:30 UTC am 27.09.
const NACHT = '2026-09-27T22:30:00.000Z';

describe('Tag aus einem Zeitstempel', () => {
  it('tagVon / localDay nehmen den Berliner Tag, nicht den UTC-Tag', () => {
    expect(tagVon(NACHT)).toBe('2026-09-28');
    expect(localDay(new Date(NACHT))).toBe('2026-09-28');
    expect(NACHT.slice(0, 10)).toBe('2026-09-27'); // so war es vorher
  });
  it('Deal aus Lead: letzteAktivitaet ist der Berliner Tag', () => {
    const z = { id: 'f-probe', art: 'firma', name: 'Probe GmbH', personen: [{ id: 'c-probe-1', name: 'P', stufe: 'neu' }], kriterien: {} } as unknown as LeadZeile;
    const c = dealAusLead(z, { id: 'ch-1', titel: 'Probe', art: 'retainer', betrag: 1000, basis: 'monat', schritt: { text: 'Termin', datum: '2026-10-01' }, besitzer: 'kevin', jetzt: NACHT });
    expect(c.letzteAktivitaet).toBe('2026-09-28');
  });
  it('Verarbeitungsverzeichnis: Stand ist der Berliner Tag', () => {
    expect(verarbeitungenStart(NACHT).every(v => v.stand === '2026-09-28')).toBe(true);
  });
});

describe('Art.-15-Frist „+1 Monat“ mit Kappung am Monatsende (#77)', () => {
  const frist = (eingang: string) => (saeubern('antraege', { id: 'an-probe', name: 'Probe', eingang }, NACHT, 'kevin') as { frist: string }).frist;
  it('31.01. → 28.02. (vorher: 03.03.), im Schaltjahr 29.02.', () => {
    expect(frist('2026-01-31')).toBe('2026-02-28');
    expect(frist('2028-01-31')).toBe('2028-02-29');
    expect(frist('2026-03-31')).toBe('2026-04-30');
  });
  it('normale Tage: gleicher Tag im Folgemonat, auch über den Jahreswechsel', () => {
    expect(frist('2026-03-15')).toBe('2026-04-15');
    expect(frist('2026-12-20')).toBe('2027-01-20');
  });
});
