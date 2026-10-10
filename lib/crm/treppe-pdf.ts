// ─── Produkte · Fortschritts-Report als PDF (nur Server, 10.10.) ──────────────────────────────────────────────────────
// Gerüst wie das Angebot (lib/crm/angebot-pdf.ts: pdf-lib, Helvetica/WinAnsi, `sicherFuer` + `umbrechen` von dort): Kopf mit Absender,
// Kunde/Paket/Stand, Abschnitte „Erreicht“, „Nächste Schritte“, „Kennzahlen“ und ein ruhiger Fuß mit „Seite n von m“. Aufbau aus
// lib/crm/treppe-report.ts `reportDokument` — dieselbe Quelle wie die Mail. `erstellt` fest übergeben → gleiche Eingabe, gleiche Bytes.

import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { sicherFuer, umbrechen } from './angebot-pdf';
import type { ReportDokument } from './treppe-report';

const A4: [number, number] = [595.28, 841.89];
const RAND = 56;
const BREIT = A4[0] - 2 * RAND;
const OBEN = A4[1] - 56;
const UNTEN = 70;
const TINTE = rgb(0.1, 0.1, 0.12);
const LEISE = rgb(0.42, 0.42, 0.46);
const LINIE = rgb(0.82, 0.82, 0.85);
const AKZENT = rgb(0.13, 0.71, 0.67);

export async function reportPdf(d: ReportDokument, opt: { erstellt: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.titel} – ${d.kunde}`);
  doc.setSubject(d.paket ?? d.titel);
  if (d.absender) doc.setAuthor(d.absender);
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
  const text = (t: string, x: number, yy: number, groesse: number, o: { fett?: boolean; farbe?: ReturnType<typeof rgb> } = {}) =>
    seite.drawText(s(t), { x, y: yy, size: groesse, font: o.fett ? fb : f, color: o.farbe ?? TINTE });
  const platz = (h: number) => { if (y - h < UNTEN) neueSeite(); };
  const absatz = (t: string, groesse: number, o: { fett?: boolean; farbe?: ReturnType<typeof rgb>; x?: number; breite?: number } = {}) => {
    const zeilen = umbrechen(s(t), o.fett ? fb : f, groesse, o.breite ?? BREIT);
    for (const z of zeilen) { platz(groesse * 1.45); y -= groesse * 1.45; if (z) text(z, o.x ?? RAND, y, groesse, o); }
  };
  const abschnitt = (titel: string) => {
    platz(40); y -= 22;
    text(titel.toUpperCase(), RAND, y, 9, { fett: true, farbe: AKZENT });
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREIT, y }, thickness: 0.5, color: LINIE });
    y -= 4;
  };
  const punkte = (l: string[]) => { for (const p of l) { platz(16); const y0 = y; absatz(p, 10.5, { x: RAND + 14, breite: BREIT - 14 }); text('•', RAND + 2, y0 - 10.5 * 1.45, 10.5, { farbe: AKZENT }); } };

  neueSeite();
  if (d.absender) { text(d.absender, RAND, y, 9, { farbe: LEISE }); y -= 26; }
  text(d.titel, RAND, y, 22, { fett: true });
  y -= 24;
  absatz(d.kunde, 13, { fett: true });
  absatz([d.mandat, d.paket ? `Paket: ${d.paket}` : ''].filter(Boolean).join(' · '), 10.5, { farbe: LEISE });
  absatz(`Stand: ${d.stand}${d.schritt ? ` · aktueller Schritt: ${d.schritt}` : ''}`, 10.5, { farbe: LEISE });

  abschnitt('Erreicht');
  punkte(d.erreicht);
  abschnitt('Nächste Schritte');
  punkte(d.naechste);
  if (d.kennzahlen.length) {
    abschnitt('Kennzahlen');
    for (const k of d.kennzahlen) {
      platz(30);
      absatz(k.name, 10.5, { fett: true });
      absatz(k.wert, 10.5, { farbe: LEISE });
      y -= 4;
    }
  }
  y -= 10;
  absatz(d.hinweis, 9, { farbe: LEISE });

  seiten.forEach((p, i) => {
    p.drawLine({ start: { x: RAND, y: 46 }, end: { x: RAND + BREIT, y: 46 }, thickness: 0.4, color: LINIE });
    const fuss = s(`${d.titel} · ${d.kunde} · ${d.stand}`);
    p.drawText(fuss.length > 90 ? `${fuss.slice(0, 89)}…`.replace('…', '...') : fuss, { x: RAND, y: 32, size: 8, font: f, color: LEISE });
    const nr = s(`Seite ${i + 1} von ${seiten.length}`);
    p.drawText(nr, { x: A4[0] - RAND - f.widthOfTextAtSize(nr, 8), y: 32, size: 8, font: f, color: LEISE });
  });
  return doc.save({ useObjectStreams: false });
}
