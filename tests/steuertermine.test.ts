// Steuertermine werden gerechnet, nicht erinnert — inkl. Wochenend- und Feiertagsregel.
import { describe, it, expect } from 'vitest';
import { steuertermine, werktag, feiertage } from '../lib/finanzen/chef/steuertermine';

describe('Steuertermine', () => {
  it('Wochenende und Feiertag verschieben auf den nächsten Werktag', () => {
    expect(werktag('2026-10-10')).toBe('2026-10-12'); // Samstag → Montag
    expect(werktag('2026-10-03')).toBe('2026-10-05'); // Tag der Deutschen Einheit (Sa) → Montag
    expect(feiertage(2026).has('2026-04-03')).toBe(true); // Karfreitag 2026
  });
  it('Quartal: USt-VA am 10. nach Quartalsende, ESt-Vorauszahlungen am 10.03/06/09/12', () => {
    const t = steuertermine('2026-09-24', '2026-12-31');
    expect(t.map(x => `${x.datum} ${x.art}`)).toEqual(['2026-10-12 ust', '2026-12-10 est']);
  });
  it('monatlich mit Dauerfristverlängerung: ein Monat später', () => {
    const t = steuertermine('2026-10-01', '2026-10-31', { ust: 'monatlich', dauerfrist: true, estVorauszahlung: false, gewstVorauszahlung: false });
    expect(t).toEqual([{ datum: '2026-10-12', art: 'ust', titel: 'Umsatzsteuer-Voranmeldung 08/2026', hinweis: 'Anmeldung und Zahlung (mit Dauerfristverlängerung)' }]);
  });
  it('Gewerbesteuer nur, wenn eingestellt', () => {
    expect(steuertermine('2026-11-01', '2026-11-30').some(x => x.art === 'gewst')).toBe(false);
    expect(steuertermine('2026-11-01', '2026-11-30', { ust: 'keine', dauerfrist: false, estVorauszahlung: false, gewstVorauszahlung: true })[0].datum).toBe('2026-11-16');
  });
});

describe('Steuertermine — Sondervorauszahlung und UG', () => {
  it('Monatszahler mit Dauerfrist: Sondervorauszahlung am 10.02. (Werktag)', () => {
    const t = steuertermine('2027-02-01', '2027-02-28', { ust: 'monatlich', dauerfrist: true, estVorauszahlung: false, gewstVorauszahlung: false });
    expect(t.find(x => x.art === 'ust-sv')?.datum).toBe('2027-02-10');
  });
  it('UG: Körperschaftsteuer an den ESt-Terminen', () => {
    const t = steuertermine('2026-12-01', '2026-12-31', { ust: 'keine', dauerfrist: false, estVorauszahlung: false, gewstVorauszahlung: false, kstVorauszahlung: true });
    expect(t.map(x => `${x.datum} ${x.art}`)).toEqual(['2026-12-10 kst']);
  });
});
