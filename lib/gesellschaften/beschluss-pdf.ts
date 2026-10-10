// ─── Unternehmen › Beschlüsse & Satzung: das Beschluss-Buch als PDF (nur Server, 10.10.) ───────────────────────────────────────────────
// Gerüst wie die Anwalts-Mappe (lib/recht/mappe-pdf.ts: pdf-lib, Helvetica/WinAnsi, `sicherFuer` + `umbrechen` aus lib/crm/angebot-pdf.ts). Inhalt NUR
// aus `buchDokument` (lib/gesellschaften/beschluesse.ts, rein) — hier wird nur gesetzt: Deckblatt mit Gesellschaft, Stand und Hinweis, Gegenstand &
// Satzung, dann je Jahr die Beschlüsse in Reihenfolge. Fuß mit Seitenzahl. Das PDF geht nur an die Person, die es lädt — verschickt wird nichts.

import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { sicherFuer, umbrechen } from '@/lib/crm/angebot-pdf';
import type { BuchDokument } from './beschluesse';

const A4: [number, number] = [595.28, 841.89];
const RAND = 56;
const BREIT = A4[0] - 2 * RAND;
const OBEN = A4[1] - 56;
const UNTEN = 70;
const TINTE = rgb(0.1, 0.1, 0.12);
const LEISE = rgb(0.42, 0.42, 0.46);
const LINIE = rgb(0.82, 0.82, 0.85);
const AKZENT = rgb(0.13, 0.71, 0.67);

export async function beschlussBuchPdf(d: BuchDokument, opt: { erstellt: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(d.titel);
  doc.setSubject(d.untertitel);
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
    if (!t.trim()) { platz(groesse); y -= groesse * 0.8; return; }
    for (const z of umbrechen(s(t), o.fett ? fb : f, groesse, o.breite ?? BREIT)) { platz(groesse * 1.45); y -= groesse * 1.45; if (z) text(z, o.x ?? RAND, y, groesse, o); }
  };
  const abschnitt = (titel: string) => {
    platz(48); y -= 22;
    text(titel.toUpperCase(), RAND, y, 9, { fett: true, farbe: AKZENT });
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREIT, y }, thickness: 0.5, color: LINIE });
    y -= 4;
  };

  neueSeite();
  text('BESCHLUSS-BUCH', RAND, y, 9, { fett: true, farbe: AKZENT });
  y -= 26;
  absatz(d.titel.replace(/^Beschluss-Buch — /, ''), 20, { fett: true });
  absatz(d.untertitel, 12, { farbe: LEISE });
  absatz(`Stand: ${d.stand.slice(8, 10)}.${d.stand.slice(5, 7)}.${d.stand.slice(0, 4)}`, 10.5, { farbe: LEISE });
  y -= 8;
  absatz(d.hinweis, 9.5, { farbe: LEISE });

  abschnitt('Gegenstand & Satzung (gültige Fassung)');
  for (const z of d.satzung.length ? d.satzung : ['Noch keine Fassung festgehalten.']) absatz(z, 10.5);

  if (!d.jahre.length) { abschnitt('Beschlüsse'); absatz('Noch kein Beschluss im Buch.', 10.5, { farbe: LEISE }); }
  for (const j of d.jahre) {
    abschnitt(`Beschlüsse ${j.jahr}`);
    for (const e of j.eintraege) {
      platz(60); y -= 8;
      absatz(e.kopf, 9.5, { fett: true, farbe: AKZENT });
      absatz(e.titel, 12, { fett: true });
      for (const z of e.zeilen) absatz(z, 10, { x: RAND + 10, breite: BREIT - 10 });
      y -= 4;
      platz(6);
      seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREIT, y }, thickness: 0.3, color: LINIE });
    }
  }

  seiten.forEach((p, i) => {
    p.drawLine({ start: { x: RAND, y: 46 }, end: { x: RAND + BREIT, y: 46 }, thickness: 0.4, color: LINIE });
    const fuss = s(`${d.titel} · Keine Rechtsberatung`);
    p.drawText(fuss.length > 95 ? `${fuss.slice(0, 92)}...` : fuss, { x: RAND, y: 32, size: 8, font: f, color: LEISE });
    const nr = s(`Seite ${i + 1} von ${seiten.length}`);
    p.drawText(nr, { x: A4[0] - RAND - f.widthOfTextAtSize(nr, 8), y: 32, size: 8, font: f, color: LEISE });
  });
  return doc.save({ useObjectStreams: false });
}

/** Dateiname des PDFs (ohne Sonderzeichen). */
export function buchDateiname(name: string, stand: string, jahr?: number): string {
  const sauber = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'Gesellschaft';
  return `Beschluss-Buch-${sauber}${jahr ? `-${jahr}` : ''}-${stand}.pdf`;
}
