// Mail-Bausteine der Abläufe kennen auch die Platzhalter der Werkstatt-Form (25.10., Produkt-Übernahme) — erfundene Werte.
import { describe, expect, it } from 'vitest';
import { nachrichtEntwurf } from '@/lib/fulfillment/prozesse/ausfuehrung';

const werte = {
  anrede: 'Du' as const, vorname: 'Anna', nachname: 'Beispiel', kunde: 'Muster AG', absender: 'Lena',
  absenderName: 'Nordlicht Beratung', mandatTitel: 'Homepage Muster AG', mandatStart: '2026-11-02', produkt: 'Homepage Landing', heute: '2026-10-25',
};

describe('nachrichtEntwurf — Werkstatt-Platzhalter', () => {
  it('füllt Gruß, Firma, Absender, Mandat und Datum mit Formatierer', () => {
    const m = nachrichtEntwurf('Betreff: Start {{mandat.titel}}\n\n{{kontakt.gruss}},\nfür {{firma.name}} starten wir am {{mandat.start | datum-lang}} ({{mandat.start}}) mit {{mandat.produkt}}.\nDein Team von {{absender.name}}', werte, 'Vorgabe');
    expect(m.betreff).toBe('Start Homepage Muster AG');
    expect(m.text).toContain('Hallo Anna,');
    expect(m.text).toContain('für Muster AG starten wir am Montag, 2. November 2026 (02.11.2026) mit Homepage Landing.');
    expect(m.text).toContain('Dein Team von Nordlicht Beratung');
  });
  it('{{fall.termin}} wie {{termin}}: ohne Termin fällt der Satz weg', () => {
    const ohne = nachrichtEntwurf('{{kontakt.gruss}},\nwir sehen uns am {{fall.termin}}. Bis bald.', werte, 'V');
    expect(ohne.text).not.toContain('{{');
    expect(ohne.text).not.toContain('sehen uns');
    const mit = nachrichtEntwurf('Wir sehen uns am {{fall.termin}}.', { ...werte, termin: 'Mo, 2.11., 10:00' }, 'V');
    expect(mit.text).toBe('Wir sehen uns am Mo, 2.11., 10:00.');
  });
  it('alte Platzhalter gelten weiter, unbekannte bleiben sichtbar', () => {
    const m = nachrichtEntwurf('{{anrede}}, {{kunde}} · {{absender}} · {{unbekannt.feld}} · {{mandat.start | quatsch}}', werte, 'V');
    expect(m.text).toBe('Hallo Anna, Muster AG · Lena · {{unbekannt.feld}} · {{mandat.start | quatsch}}');
  });
  it('ohne Absender-Firmierung nimmt {{absender.name}} den bisherigen Absender', () => {
    const { absenderName: _a, ...rest } = werte;
    expect(nachrichtEntwurf('{{absender.name}}', rest, 'V').text).toBe('Lena');
  });
});
