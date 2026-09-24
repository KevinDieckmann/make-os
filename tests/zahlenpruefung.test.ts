// Zahlenprüfung des Finanzagenten: erfundene Zahlen fallen auf, belegte nicht.
import { describe, it, expect } from 'vitest';
import { pruefeText, zahlenImText } from '../lib/finanzen/chef/pruefung';

const daten = { haushalt: { sockel_cent: 181298, einkommen_cent: 434000, sparquote: 40.2 }, business: { umsatzProMonat: 3571.43 } };

describe('Zahlenprüfung', () => {
  it('liest deutsche Beträge und Prozente', () => {
    expect(zahlenImText('Sockel 1.812,98 €, Quote 40 %, Minus −150 €').map(f => f.wert)).toEqual([1812.98, 40, -150]);
  });
  it('belegte Zahlen (auch gerundet, auch Differenz) gehen durch', () => {
    const t = 'Euer Sockel liegt bei 1.813 €, das Einkommen bei 4.340 €. Luft: 2.527 € (Einkommen minus Sockel). Sparquote 40 %. Umsatz Ø 3.571 €.';
    expect(pruefeText(t, daten).unbelegt).toEqual([]);
  });
  it('erfundene Zahl fällt auf', () => {
    const r = pruefeText('Ihr solltet 9.999 € Notgroschen haben und 17 % sparen.', daten);
    expect(r.unbelegt.map(f => f.text)).toEqual(['9.999 €', '17 %']);
  });
});
