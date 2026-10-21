// Rundgang 19.10. B8 (21.10.): Das Rechnungsfenster, aus dem Mandat geöffnet, führt beim Schließen zurück ins Mandat — nicht nach Finanzen › Rechnungen.
// `WEG.rechnungSchreiben(id, zurueck)` trägt das Ziel, `zurueckZiel` lässt nur eigene Pfade unter /os/ zu (nie eine fremde Adresse).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WEG, zurueckZiel } from '../lib/wege';

describe('B8 · Rechnung schreiben → zurück ins Mandat', () => {
  it('die Adresse trägt das Ziel; ohne Ziel wie bisher', () => {
    const u = new URL(WEG.rechnungSchreiben('r-1', WEG.mandat('m-1')), 'https://x.invalid');
    expect(u.pathname).toBe('/os/finanzen');
    expect(u.searchParams.get('re')).toBe('r-1');
    expect(u.searchParams.get('zurueck')).toBe(WEG.mandat('m-1'));
    expect(WEG.rechnungSchreiben('r-1')).not.toContain('zurueck');
  });
  it('nur eigene Pfade — keine fremden Adressen, kein Backslash, keine Leerzeichen', () => {
    expect(zurueckZiel('/os/mandate?k=m-1')).toBe('/os/mandate?k=m-1');
    for (const x of ['https://boese.invalid', '//boese.invalid', '/\\boese.invalid', '/os/ x', 'javascript:alert(1)', '/anmelden', null, undefined]) expect(zurueckZiel(x as string)).toBeNull();
    expect(WEG.rechnungSchreiben('r-1', 'https://boese.invalid')).not.toContain('zurueck');
  });
  it('Mandat (Monatsrechnung, „abrechnen“) übergibt das Mandat; das Fenster nimmt beim Schließen den Schritt zurück', () => {
    expect(readFileSync('components/os/crm/Kunden.tsx', 'utf8')).toContain('WEG.rechnungSchreiben(e.id, WEG.mandat(m.id))');
    expect(readFileSync('components/os/crm/MandatZusatz.tsx', 'utf8')).toContain('WEG.rechnungSchreiben(e.id, WEG.mandat(m.id))');
    const karte = readFileSync('components/os/rechnung/RechnungenKarte.tsx', 'utf8');
    expect(karte).toContain("zurueckZiel(q.get('zurueck'))");
    expect(karte).toMatch(/if \(zurueckNach\) \{ zurueck\(zurueckNach\); return; \}/);
  });
});
