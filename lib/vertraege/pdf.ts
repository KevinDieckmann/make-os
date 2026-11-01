// ─── Verträge · PDF (nur Server, 01.11.) ─────────────────────────────────────────────────────────────────────────────
// Optik wie das Angebot (lib/crm/angebot-pdf.ts: pdf-lib, Helvetica/WinAnsi, `sicherFuer` + `umbrechen`, Absender oben links, Logo rechts,
// Akzentfarbe, Fuß mit Seitenzahl). Inhalt NUR aus `VertragDokument` (fertig gefüllt) — hier wird nur gesetzt. Ein Entwurf trägt „ENTWURF“.

import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { sicherFuer, umbrechen, type PdfLogo } from '@/lib/crm/angebot-pdf';
import type { VertragAbsender, VertragPartner } from './modell';

const A4: [number, number] = [595.28, 841.89];
const RAND = 56;
const BREIT = A4[0] - 2 * RAND;
const OBEN = A4[1] - 56;
const UNTEN = 70;
const TINTE = rgb(0.1, 0.1, 0.12);
const LEISE = rgb(0.42, 0.42, 0.46);
const LINIE = rgb(0.82, 0.82, 0.85);
const AKZENT = rgb(0.13, 0.71, 0.67);

export interface VertragDokument {
  titel: string;
  nummer?: string;
  datum: string;
  entwurf: boolean;
  absender: VertragAbsender;
  partner: VertragPartner;
  paragraphen: { nr: string; titel: string; text: string }[];
  ort?: string;
}

const tagText = (t: string) => (/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : t);

export async function vertragPdf(d: VertragDokument, opt: { erstellt: Date; logo?: PdfLogo | null }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${d.titel}${d.nummer ? ` ${d.nummer}` : ''}`);
  doc.setSubject(d.titel);
  doc.setAuthor(d.absender.firmierung);
  doc.setCreator('MAKE OS');
  doc.setProducer('MAKE OS · pdf-lib');
  doc.setCreationDate(opt.erstellt);
  doc.setModificationDate(opt.erstellt);
  doc.setLanguage('de-DE');
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const s = sicherFuer(f);
  let logo: { bild: Awaited<ReturnType<PDFDocument['embedPng']>>; b: number; h: number } | null = null;
  if (opt.logo) {
    try {
      const bild = opt.logo.typ === 'image/png' ? await doc.embedPng(opt.logo.bytes) : await doc.embedJpg(opt.logo.bytes);
      const k = Math.min(150 / bild.width, 52 / bild.height, 1);
      logo = { bild, b: bild.width * k, h: bild.height * k };
    } catch { logo = null; }
  }
  const seiten: PDFPage[] = [];
  let seite!: PDFPage;
  let y = 0;
  const neueSeite = () => {
    seite = doc.addPage(A4); seiten.push(seite); y = OBEN;
    if (d.entwurf) seite.drawText('ENTWURF', { x: A4[0] - RAND - fb.widthOfTextAtSize('ENTWURF', 9), y: A4[1] - 34, size: 9, font: fb, color: AKZENT });
  };
  const text = (t: string, x: number, yy: number, groesse: number, o: { fett?: boolean; farbe?: ReturnType<typeof rgb> } = {}) =>
    seite.drawText(s(t), { x, y: yy, size: groesse, font: o.fett ? fb : f, color: o.farbe ?? TINTE });
  const platz = (h: number) => { if (y - h < UNTEN) neueSeite(); };
  const absatz = (t: string, groesse: number, o: { fett?: boolean; farbe?: ReturnType<typeof rgb>; x?: number; breite?: number } = {}) => {
    for (const roh of String(t).split('\n')) {
      if (!roh.trim()) { platz(groesse); y -= groesse * 0.7; continue; }
      for (const z of umbrechen(s(roh), o.fett ? fb : f, groesse, o.breite ?? BREIT)) { platz(groesse * 1.45); y -= groesse * 1.45; if (z) text(z, o.x ?? RAND, y, groesse, o); }
    }
  };

  neueSeite();
  if (logo) seite.drawImage(logo.bild, { x: A4[0] - RAND - logo.b, y: OBEN - logo.h + 8, width: logo.b, height: logo.h });
  text(d.absender.firmierung, RAND, y, 12, { fett: true });
  y -= 14;
  for (const z of d.absender.zeilen) { text(z, RAND, y, 8.5, { farbe: LEISE }); y -= 11; }
  y = Math.min(y, OBEN - 90) - 20;

  text(d.titel.toUpperCase(), RAND, y, 15, { fett: true });
  y -= 18;
  text([d.nummer ? `Nr. ${d.nummer}` : '', tagText(d.datum)].filter(Boolean).join(' · '), RAND, y, 9.5, { farbe: LEISE });
  y -= 22;
  text('ZWISCHEN', RAND, y, 8, { fett: true, farbe: AKZENT });
  y -= 2;
  absatz([d.absender.firmierung, ...d.absender.zeilen].join(', '), 10.5);
  if (d.absender.vertretung) absatz(`vertreten durch ${d.absender.vertretung}`, 9.5, { farbe: LEISE });
  if (d.absender.register) absatz(d.absender.register, 9.5, { farbe: LEISE });
  y -= 8;
  text('UND', RAND, y, 8, { fett: true, farbe: AKZENT });
  y -= 2;
  absatz([d.partner.name, ...d.partner.zeilen].filter(Boolean).join(', '), 10.5);
  if (d.partner.ansprechpartner) absatz(`vertreten durch ${d.partner.ansprechpartner}`, 9.5, { farbe: LEISE });
  y -= 6;
  seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREIT, y }, thickness: 0.5, color: LINIE });

  for (const p of d.paragraphen) {
    platz(48); y -= 16;
    absatz([p.nr, p.titel].filter(Boolean).join(' '), 11, { fett: true });
    y -= 2;
    absatz(p.text, 10);
  }

  // Unterschriften
  platz(110); y -= 40;
  const halb = (BREIT - 30) / 2;
  const zeileU = (x: number, unter: string) => {
    seite.drawLine({ start: { x, y }, end: { x: x + halb, y }, thickness: 0.5, color: TINTE });
    let yy = y - 12;
    for (const z of umbrechen(s(unter), f, 8.5, halb)) { seite.drawText(z, { x, y: yy, size: 8.5, font: f, color: LEISE }); yy -= 11; }
  };
  text(`${d.ort ? `${d.ort}, ` : ''}den ______________`, RAND, y + 24, 9.5);
  text('Ort, Datum ______________', RAND + halb + 30, y + 24, 9.5);
  zeileU(RAND, d.absender.firmierung);
  zeileU(RAND + halb + 30, d.partner.name);

  seiten.forEach((p, i) => {
    p.drawLine({ start: { x: RAND, y: 46 }, end: { x: RAND + BREIT, y: 46 }, thickness: 0.4, color: LINIE });
    const fuss = s(`${d.titel}${d.nummer ? ` · ${d.nummer}` : ''}${d.entwurf ? ' · Entwurf' : ''}`);
    p.drawText(fuss.length > 95 ? `${fuss.slice(0, 92)}...` : fuss, { x: RAND, y: 32, size: 8, font: f, color: LEISE });
    const nr = s(`Seite ${i + 1} von ${seiten.length}`);
    p.drawText(nr, { x: A4[0] - RAND - f.widthOfTextAtSize(nr, 8), y: 32, size: 8, font: f, color: LEISE });
  });
  return doc.save({ useObjectStreams: false });
}
