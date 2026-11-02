// Rechnungs-/Angebots-PDF (02.11., Kevin: „da überschneidet sich die Visualisierung“): Beschriftung und Wert der Angaben oben rechts
// überlappen nie — auch bei langer Nummer und Leistungszeitraum. Doppelte Ortsangabe wird einmal gedruckt.
import { describe, it, expect } from 'vitest';
import { angebotPdf } from '@/lib/crm/angebot-pdf';
import { rechnungDokument, empfaengerZeilen } from '@/lib/finanzen/rechnung/dokument';
import { GOLD_ABSENDER, GOLD_RECHNUNG } from './fixtures/kleine-bauten-gold';

type Teil = { str: string; transform: number[]; width: number };
async function textTeile(bytes: Uint8Array): Promise<Teil[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // @ts-expect-error Worker im selben Prozess (wie lib/dateien/text-auslesen.ts)
  globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false }).promise;
  const seite = await doc.getPage(1);
  const inhalt = await seite.getTextContent();
  return (inhalt.items as Teil[]).filter(t => typeof t.str === 'string' && t.str.trim());
}

describe('PDF-Kopf: Angaben ohne Überlappung', () => {
  it('Rechnungsnummer und Leistungszeitraum: Beschriftung endet vor dem Wert', async () => {
    const r = { ...GOLD_RECHNUNG, nummer: 'BWX-R-2026-0001', leistungVon: '2026-10-01', leistungBis: '2026-10-09' };
    const d = rechnungDokument(r, GOLD_ABSENDER, { datum: '2026-11-02' });
    const teile = await textTeile(await angebotPdf(d, { erstellt: new Date('2026-11-02T10:00:00Z') }));
    for (const m of d.meta) {
      const l = teile.find(t => t.str === m.label);
      const w = teile.find(t => t.str === m.wert && Math.abs(t.transform[5] - (l?.transform[5] ?? -1)) < 1);
      expect(l, m.label).toBeTruthy();
      expect(w, m.wert).toBeTruthy();
      expect(l!.transform[4] + l!.width + 5).toBeLessThan(w!.transform[4]);
    }
  });

  it('„Berlin Berlin“ wird einmal gedruckt, echte Ortsnamen bleiben', () => {
    expect(empfaengerZeilen({ firma: 'Beispiel GmbH', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt Musterstadt' })).toContain('12345 Musterstadt');
    expect(empfaengerZeilen({ firma: 'Beispiel GmbH', plz: '12345', ort: 'Frankfurt am Main' })).toContain('12345 Frankfurt am Main');
    expect(empfaengerZeilen({ firma: 'Beispiel GmbH', plz: '12345', ort: 'Halle Saale' })).toContain('12345 Halle Saale');
  });
});
