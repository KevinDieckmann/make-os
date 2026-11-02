// Rechnungs-/Angebots-PDF (02.11., Kevin: „da überschneidet sich die Visualisierung“): Beschriftung und Wert der Angaben
// überlappen nie — auch bei langer Nummer und Leistungszeitraum. Doppelte Ortsangabe wird einmal gedruckt.
// Seit dem neuen PDF-Stil (02.11.) stehen die Angaben als gesperrte Großbuchstaben in der schmalen rechten Spalte; geprüft wird
// dasselbe: kein Label überlappt seinen Wert, nichts aus der rechten Spalte ragt in die Hauptspalte, die Absender-Leiste unten
// überlappt weder die Angaben noch einander.
import { describe, it, expect } from 'vitest';
import { angebotPdf } from '@/lib/crm/angebot-pdf';
import { rechnungDokument, empfaengerZeilen } from '@/lib/finanzen/rechnung/dokument';
import { GOLD_ABSENDER, GOLD_RECHNUNG } from './fixtures/kleine-bauten-gold';

type Teil = { str: string; transform: number[]; width: number; height: number };
async function textTeile(bytes: Uint8Array): Promise<Teil[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // @ts-expect-error Worker im selben Prozess (wie lib/dateien/text-auslesen.ts)
  globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false }).promise;
  const seite = await doc.getPage(1);
  const inhalt = await seite.getTextContent();
  return (inhalt.items as Teil[]).filter(t => typeof t.str === 'string' && t.str.trim());
}

/** Grenzen der Spalten wie in lib/crm/angebot-pdf.ts (Hauptspalte endet bei 418, rechte Spalte beginnt bei 438). */
const HAUPT_RECHTS = 418;
const SPALTE_LINKS = 438;
const versal = (t: string) => t.toLocaleUpperCase('de-DE');
/** Gesperrter Text kommt aus pdf.js mit Leerzeichen zwischen den Buchstaben zurück — verglichen wird ohne Leerzeichen. */
const ohne = (t: string) => t.replace(/\s+/g, '');
const x = (t: Teil) => t.transform[4];
const y = (t: Teil) => t.transform[5];

const LEISTE = [
  [{ label: '', wert: 'Beispiel Werkstatt GmbH' }, { label: '', wert: 'Musterweg 1' }, { label: '', wert: '12345 Musterstadt' }],
  [{ label: 'Tel.', wert: '0000 000' }, { label: 'E-Mail', wert: 'hallo@example.invalid' }],
  [{ label: 'USt-IdNr.', wert: 'DE000000000' }, { label: 'Geschäftsführung', wert: 'Erika Muster' }, { label: 'Register', wert: 'Amtsgericht Musterstadt HRB 0000' }],
  [{ label: 'Bank', wert: 'Beispielbank' }, { label: 'IBAN', wert: 'DE00 0000 0000 0000 0000 00' }],
];

describe('PDF-Kopf: Angaben ohne Überlappung', () => {
  it('Rechnungsnummer und Leistungszeitraum: Beschriftung (versal, rechte Spalte) endet vor dem Wert', async () => {
    const r = { ...GOLD_RECHNUNG, nummer: 'BWX-R-2026-0001', leistungVon: '2026-10-01', leistungBis: '2026-10-09' };
    const d = rechnungDokument(r, { ...GOLD_ABSENDER, leiste: LEISTE }, { datum: '2026-11-02' });
    const teile = await textTeile(await angebotPdf(d, { erstellt: new Date('2026-11-02T10:00:00Z') }));
    const angaben: Teil[] = [];
    for (const m of d.meta) {
      const l = teile.find(t => ohne(t.str) === ohne(versal(m.label)) && x(t) >= SPALTE_LINKS - 0.5);
      expect(l, m.label).toBeTruthy();
      // Wert in derselben Zeile rechts daneben — oder (zu lang) in der Zeile darunter, linksbündig.
      const w = teile.find(t => t.str === m.wert && Math.abs(y(t) - y(l!)) < 1) ?? teile.find(t => t.str === m.wert && y(t) < y(l!) && y(l!) - y(t) < 12);
      expect(w, m.wert).toBeTruthy();
      if (Math.abs(y(w!) - y(l!)) < 1) expect(x(l!) + l!.width + 3).toBeLessThan(x(w!)); // pdf.js zählt die Sperrung nach dem letzten Buchstaben mit
      angaben.push(l!, w!);
    }
    // Nichts aus der rechten Spalte ragt in die Hauptspalte, nichts über den rechten Rand.
    for (const t of angaben) { expect(x(t)).toBeGreaterThanOrEqual(SPALTE_LINKS - 0.5); expect(x(t) + t.width).toBeLessThanOrEqual(595.28 - 36 + 0.5); }
    // Die Überschrift bleibt in der Hauptspalte.
    const titel = teile.find(t => t.str === d.ueberschrift);
    expect(titel).toBeTruthy();
    expect(x(titel!) + titel!.width).toBeLessThanOrEqual(HAUPT_RECHTS + 0.5);
    // Die Absender-Leiste unten: steht in der rechten Spalte, unter den Angaben, ohne sich selbst zu überlappen.
    const tiefsteAngabe = Math.min(...angaben.map(y));
    const leiste = teile.filter(t => x(t) >= SPALTE_LINKS - 0.5 && y(t) < tiefsteAngabe - 1 && y(t) < 300);
    expect(leiste.some(t => t.str === 'Musterweg 1')).toBe(true);
    expect(leiste.some(t => ohne(t.str) === 'IBAN')).toBe(true);
    for (const t of leiste) expect(x(t) + t.width).toBeLessThanOrEqual(595.28 - 36 + 0.5);
    const zeilen = [...new Set(leiste.map(t => Math.round(y(t) * 10) / 10))].sort((a, b) => b - a);
    for (let i = 1; i < zeilen.length; i++) expect(zeilen[i - 1] - zeilen[i]).toBeGreaterThanOrEqual(7.5);
    for (const zeile of zeilen) {
      const inZeile = leiste.filter(t => Math.abs(y(t) - zeile) < 0.2).sort((a, b) => x(a) - x(b));
      for (let i = 1; i < inZeile.length; i++) expect(x(inZeile[i - 1]) + inZeile[i - 1].width).toBeLessThan(x(inZeile[i]));
    }
  });

  it('„Berlin Berlin“ wird einmal gedruckt, echte Ortsnamen bleiben', () => {
    expect(empfaengerZeilen({ firma: 'Beispiel GmbH', strasse: 'Weg 1', plz: '12345', ort: 'Musterstadt Musterstadt' })).toContain('12345 Musterstadt');
    expect(empfaengerZeilen({ firma: 'Beispiel GmbH', plz: '12345', ort: 'Frankfurt am Main' })).toContain('12345 Frankfurt am Main');
    expect(empfaengerZeilen({ firma: 'Beispiel GmbH', plz: '12345', ort: 'Halle Saale' })).toContain('12345 Halle Saale');
  });
});
