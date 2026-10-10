// ─── Fulfillment · Kunde — Antworten als PDF (nur Server; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4 „Playbook gehört dem Kunden“) ────────────────────
// Intern „Antworten exportieren (PDF)“, damit wir dem Kunden sein Playbook geben können (über den Link selbst gibt es keinen Export). Gerüst wie der
// Fortschritts-Report (lib/crm/treppe-pdf.ts): pdf-lib, Helvetica/WinAnsi, `sicherFuer` + `umbrechen` aus lib/crm/angebot-pdf.ts, „Seite n von m“.
// Nur Formulare, die für Kunden taugen (`kundeTauglich`) — das wählt der Server. `erstellt` fest übergeben → gleiche Eingabe, gleiche Bytes.

import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { sicherFuer, umbrechen } from '@/lib/crm/angebot-pdf';
import { ALLGEMEIN } from './formular';
import type { Frage } from '../typen';

const A4: [number, number] = [595.28, 841.89];
const RAND = 56, BREIT = A4[0] - 2 * RAND, OBEN = A4[1] - 56, UNTEN = 70;
const TINTE = rgb(0.1, 0.1, 0.12), LEISE = rgb(0.42, 0.42, 0.46), LINIE = rgb(0.82, 0.82, 0.85), AKZENT = rgb(0.13, 0.71, 0.67);

export interface AntwortenDokument { firma: string; mandat: string; stand: string; formulare: { titel: string; fragen: readonly Frage[]; antworten: Readonly<Record<string, string>> }[] }

export async function antwortenPdf(d: AntwortenDokument, opt: { erstellt: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Antworten – ${d.firma}`);
  doc.setCreator('MAKE OS');
  doc.setProducer('MAKE OS · pdf-lib');
  doc.setCreationDate(opt.erstellt);
  doc.setModificationDate(opt.erstellt);
  doc.setLanguage('de-DE');
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const s = sicherFuer(f);
  const seiten: PDFPage[] = [];
  let seite!: PDFPage;
  let y = 0;
  const neueSeite = () => { seite = doc.addPage(A4); seiten.push(seite); y = OBEN; };
  const platz = (h: number) => { if (y - h < UNTEN) neueSeite(); };
  const absatz = (t: string, groesse: number, o: { fett?: boolean; farbe?: ReturnType<typeof rgb> } = {}) => {
    for (const z of umbrechen(s(t), o.fett ? fb : f, groesse, BREIT)) {
      platz(groesse * 1.45); y -= groesse * 1.45;
      if (z) seite.drawText(z, { x: RAND, y, size: groesse, font: o.fett ? fb : f, color: o.farbe ?? TINTE });
    }
  };
  neueSeite();
  absatz('Antworten', 22, { fett: true });
  absatz(d.firma, 13, { fett: true });
  absatz(`${d.mandat} · Stand ${d.stand.split('-').reverse().join('.')}`, 10.5, { farbe: LEISE });
  for (const fo of d.formulare) {
    platz(40); y -= 22;
    seite.drawText(s(fo.titel.toUpperCase()), { x: RAND, y, size: 9, font: fb, color: AKZENT });
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREIT, y }, thickness: 0.5, color: LINIE });
    let abschnitt = '';
    for (const q of fo.fragen) {
      const a = q.abschnitt?.trim() || ALLGEMEIN;
      if (a !== abschnitt) { abschnitt = a; y -= 6; absatz(a, 11, { fett: true }); }
      y -= 4;
      absatz(q.frage, 10.5, { farbe: LEISE });
      absatz(fo.antworten[q.id]?.trim() || '—', 10.5);
    }
  }
  seiten.forEach((p, i) => {
    p.drawLine({ start: { x: RAND, y: 46 }, end: { x: RAND + BREIT, y: 46 }, thickness: 0.4, color: LINIE });
    const fuss = s(`Antworten · ${d.firma}`);
    p.drawText(fuss.length > 90 ? `${fuss.slice(0, 87)}...` : fuss, { x: RAND, y: 32, size: 8, font: f, color: LEISE });
    const nr = s(`Seite ${i + 1} von ${seiten.length}`);
    p.drawText(nr, { x: A4[0] - RAND - f.widthOfTextAtSize(nr, 8), y: 32, size: 8, font: f, color: LEISE });
  });
  return doc.save({ useObjectStreams: false });
}
