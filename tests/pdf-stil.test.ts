// ─── Neuer PDF-Stil (02.11.): Akzentfarbe je Gesellschaft, Absender-Leiste der rechten Spalte ──────────────────────────────
// Alle Werte erfunden (IBAN = die übliche Beispiel-IBAN aus Dokumentationen).
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gesellschaftAnwenden, ABSENDER_FELDER, type Gesellschaft } from '@/lib/crm/gesellschaften';
import { absenderAus, angebotDokument } from '@/lib/crm/angebot-dokument';
import { angebotPdf } from '@/lib/crm/angebot-pdf';
import { ibanMaskiert } from '@/lib/crm/zahlung';
import { GOLD_ABSENDER, GOLD_ANGEBOT } from './fixtures/kleine-bauten-gold';

const J = '2026-11-02T10:00:00.000Z';
const IBAN = 'DE89370400440532013000';
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const G: Gesellschaft = {
  id: 'ug', firmierung: 'Beispiel Werkstatt GmbH', strasse: 'Musterweg 1', plz: '12345', ort: 'Musterstadt', telefon: '0000 000', email: 'hallo@example.invalid',
  ustId: 'DE000000000', geschaeftsfuehrung: 'Erika Muster', register: 'Amtsgericht Musterstadt HRB 0000', bank: { bank: 'Beispielbank', iban: IBAN, bic: 'BEISDEXXX' },
} as Gesellschaft;

describe('Akzentfarbe der Gesellschaft', () => {
  it('gültig → groß geschrieben gespeichert, ungültig → Fehler (nichts gespeichert), leer → entfernt', () => {
    const a = gesellschaftAnwenden({ id: 'ug' }, { akzentfarbe: '#a82e44' }, J, 'pa');
    expect(a.fehler).toEqual([]);
    expect(a.g.akzentfarbe).toBe('#A82E44');
    for (const falsch of ['rot', '#12345', '#GGGGGG', 'A82E44', '#A82E441']) {
      const f = gesellschaftAnwenden(a.g, { akzentfarbe: falsch }, J, 'pa');
      expect(f.fehler.map(x => x.feld), falsch).toEqual(['akzentfarbe']);
      expect(f.g.akzentfarbe).toBe('#A82E44');
    }
    expect(gesellschaftAnwenden(a.g, { akzentfarbe: '' }, J, 'pa').g).not.toHaveProperty('akzentfarbe');
    expect(gesellschaftAnwenden(a.g, { akzentfarbe: null }, J, 'pa').g).not.toHaveProperty('akzentfarbe');
    // Ohne das Feld im Körper bleibt sie, wie sie ist.
    expect(gesellschaftAnwenden(a.g, { kurz: 'BW' }, J, 'pa').g.akzentfarbe).toBe('#A82E44');
    expect(ABSENDER_FELDER).toContain('akzentfarbe');
  });
});

describe('absenderAus: Akzent und Leiste', () => {
  it('liefert `akzent` nur mit gesetzter Farbe und `leiste` in Gruppen', () => {
    expect(absenderAus(G)).not.toHaveProperty('akzent');
    expect(absenderAus({ ...G, akzentfarbe: '#A82E44' }).akzent).toBe('#A82E44');
    const l = absenderAus(G).leiste!;
    expect(l.length).toBeGreaterThanOrEqual(4);
    expect(l[0].map(z => z.wert)).toEqual(['Beispiel Werkstatt GmbH', 'Musterweg 1', '12345 Musterstadt']);
    expect(l.flat()).toEqual(expect.arrayContaining([{ label: 'E-Mail', wert: 'hallo@example.invalid' }, { label: 'USt-IdNr.', wert: 'DE000000000' }, { label: 'BIC', wert: 'BEISDEXXX' }]));
    // Leere Gruppen fallen weg.
    for (const gr of l) expect(gr.length).toBeGreaterThan(0);
  });

  it('IBAN in der Leiste: ohne `ibanVoll` maskiert wie im Fuß, mit `ibanVoll` voll — beide Stellen gleich', () => {
    const iban = (a: ReturnType<typeof absenderAus>) => a.leiste!.flat().find(z => z.label === 'IBAN')?.wert;
    const masker = absenderAus(G);
    expect(iban(masker)).toBe(ibanMaskiert(IBAN));
    expect(iban(masker)).not.toContain('0532');
    expect(masker.fuss.join(' ')).toContain(`IBAN ${ibanMaskiert(IBAN)}`);
    const voll = absenderAus(G, { ibanVoll: true });
    expect(iban(voll)).toBe('DE89 3704 0044 0532 0130 00');
    expect(voll.fuss.join(' ')).toContain('IBAN DE89 3704 0044 0532 0130 00');
  });
});

describe('PDF und Vorschau mit dem neuen Stil', () => {
  const empf = { name: 'Max Muster', zeilen: ['Beispielkunde GmbH'] };
  it('fehlendes `akzent`/`leiste` ist deterministisch; eine ungültige Farbe zeichnet wie keine (Tinte)', async () => {
    const d = angebotDokument(GOLD_ANGEBOT, GOLD_ABSENDER, empf, '2026-10-20');
    const erstellt = new Date(J);
    const a = sha(await angebotPdf(d, { erstellt }));
    expect(sha(await angebotPdf(d, { erstellt }))).toBe(a);
    expect(sha(await angebotPdf({ ...d, absender: { ...d.absender, akzent: 'rot' } }, { erstellt }))).toBe(a);
    expect(sha(await angebotPdf({ ...d, absender: { ...d.absender, akzent: '#A82E44' } }, { erstellt }))).not.toBe(a);
    expect(sha(await angebotPdf({ ...d, absender: { ...d.absender, leiste: absenderAus(G).leiste } }, { erstellt }))).not.toBe(a);
  });

  it('Vorschau: Band in der Akzentfarbe, Überschrift mit Nummer + Unterzeile, Leiste (sonst Fuß) rechts', async () => {
    const { Blatt } = await import('@/components/os/crm/angebot/Blatt');
    const mit = angebotDokument(GOLD_ANGEBOT, { ...absenderAus({ ...G, akzentfarbe: '#A82E44' }) }, empf, '2026-10-20');
    const html = renderToStaticMarkup(createElement(Blatt, { d: mit }));
    expect(html).toContain('background:#A82E44');
    expect(html).toContain(`Angebot Nr. ${GOLD_ANGEBOT.nummer}`);
    expect(html).toContain(GOLD_ANGEBOT.titel);
    expect(html).toContain('hallo@example.invalid');
    expect(html).not.toContain('0532 0130'); // Vorschau: IBAN maskiert
    const alt = renderToStaticMarkup(createElement(Blatt, { d: angebotDokument(GOLD_ANGEBOT, GOLD_ABSENDER, empf, '2026-10-20') }));
    expect(alt).toContain('background:#0B0E10');
    expect(alt).toContain('Geschäftsführung: Erika Muster');
  });
});
