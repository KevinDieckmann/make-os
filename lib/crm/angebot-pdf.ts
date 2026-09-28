// ─── Markttraktion · Angebot als PDF (nur Server, 28.09.) ─────────────────────
// Kevins Entscheidung: noch kein Server-Versand — beim „Senden“ entsteht hier das
// PDF, liegt verschlüsselt in der Dateiablage (Bezug Kontakt/Firma/Deal/Angebot),
// der Browser lädt es herunter und öffnet das Mail-Programm.
//
// pdf-lib (fest gepinnt), Standardschrift Helvetica: sie kodiert WinAnsi — Umlaute,
// ß, €, „ “ – • gehen; was die Schrift nicht kann, wird ersetzt (`sicher`), nie ein
// Absturz. Aufbau aus lib/crm/angebot-dokument.ts — derselbe wie die HTML-Vorschau.
// Seitenumbruch mit wiederholtem Fuß (Pflichtangaben) und „Seite n von m“.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { AngebotDokument } from './angebot-dokument';

const A4: [number, number] = [595.28, 841.89];
const RAND = 56;
const BREIT = A4[0] - 2 * RAND;
const OBEN = A4[1] - 48;
const FUSS_HOEHE = 92;
const TINTE = rgb(0.1, 0.1, 0.12);
const LEISE = rgb(0.42, 0.42, 0.46);
const LINIE = rgb(0.82, 0.82, 0.85);
const AKZENT = rgb(0.13, 0.71, 0.67);

export interface PdfLogo { bytes: Uint8Array; typ: 'image/png' | 'image/jpeg' }

/** Text auf die Zeichen bringen, die die Schrift kann (WinAnsi); Ersatz für Häufiges. */
function sicherFuer(font: PDFFont): (t: string) => string {
  const kann = new Set(font.getCharacterSet());
  const ersatz: Record<string, string> = { '→': '->', '←': '<-', '✓': 'x', '×': 'x', ' ': ' ', ' ': ' ', ' ': ' ', '−': '-', '‑': '-', '≈': '~', '•': '•', '…': '...' };
  // Zeilenumbrüche bleiben (Absätze trennt `umbrechen`), alles andere, was die Schrift nicht kann, wird ersetzt.
  return (t: string) => Array.from(String(t ?? '').normalize('NFC').replace(/\r\n?/g, '\n')).map(z => (z === '\n' || kann.has(z.codePointAt(0)!) ? z : ersatz[z] && Array.from(ersatz[z]).every(x => kann.has(x.codePointAt(0)!)) ? ersatz[z] : z === '\t' ? ' ' : '?')).join('');
}

/** Zeilen umbrechen (an Wortgrenzen, zu lange Wörter hart). Absätze bleiben. */
function umbrechen(text: string, font: PDFFont, groesse: number, breite: number): string[] {
  const out: string[] = [];
  for (const absatz of String(text ?? '').split('\n')) {
    const woerter = absatz.split(/\s+/).filter(Boolean);
    if (!woerter.length) { out.push(''); continue; }
    let z = '';
    for (const w0 of woerter) {
      let w = w0;
      while (font.widthOfTextAtSize(w, groesse) > breite) {
        // Hartes Trennen eines überlangen Wortes (z. B. Link).
        let n = w.length - 1;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), groesse) > breite) n--;
        if (z) { out.push(z); z = ''; }
        out.push(w.slice(0, n)); w = w.slice(n);
      }
      const probe = z ? `${z} ${w}` : w;
      if (font.widthOfTextAtSize(probe, groesse) <= breite) z = probe; else { out.push(z); z = w; }
    }
    if (z) out.push(z);
  }
  return out;
}

/** Das PDF eines Angebots. `erstellt` fest übergeben — gleiche Eingabe, gleiche Bytes (Prüfsumme). */
export async function angebotPdf(d: AngebotDokument, opt: { logo?: PdfLogo | null; erstellt: Date; autor?: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Angebot ${d.nummer} – ${d.titel}`);
  doc.setSubject(d.titel);
  doc.setAuthor(opt.autor ?? d.absender.firmierung);
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
    } catch { logo = null; } // ein kaputtes Logo verhindert kein Angebot
  }

  const seiten: PDFPage[] = [];
  let seite!: PDFPage;
  let y = 0;
  const neueSeite = () => { seite = doc.addPage(A4); seiten.push(seite); y = OBEN; };
  const text = (t: string, x: number, yy: number, groesse: number, opts: { fett?: boolean; farbe?: ReturnType<typeof rgb>; rechts?: boolean } = {}) => {
    const font = opts.fett ? fb : f;
    const tt = s(t);
    const xx = opts.rechts ? x - font.widthOfTextAtSize(tt, groesse) : x;
    seite.drawText(tt, { x: xx, y: yy, size: groesse, font, color: opts.farbe ?? TINTE });
  };
  /** Platz sicherstellen — sonst neue Seite. */
  const platz = (h: number) => { if (y - h < RAND + FUSS_HOEHE - 30) neueSeite(); };
  const absatz = (t: string, groesse: number, opts: { fett?: boolean; farbe?: ReturnType<typeof rgb>; x?: number; breite?: number; zeile?: number } = {}) => {
    const font = opts.fett ? fb : f;
    const zeilen = umbrechen(s(t), font, groesse, opts.breite ?? BREIT);
    const zh = opts.zeile ?? groesse * 1.42;
    for (const z of zeilen) { platz(zh); y -= zh; if (z) text(z, opts.x ?? RAND, y, groesse, opts); }
  };

  // ── Kopf: Absender links, Logo rechts ──
  neueSeite();
  if (logo) seite.drawImage(logo.bild, { x: A4[0] - RAND - logo.b, y: OBEN - logo.h + 8, width: logo.b, height: logo.h });
  y = OBEN;
  text(d.absender.firmierung, RAND, y, 12, { fett: true });
  y -= 14;
  for (const z of [...d.absender.zeilen, ...d.absender.kontakt]) { text(z, RAND, y, 8.5, { farbe: LEISE }); y -= 11; }

  // ── Empfänger + Angaben ──
  y = Math.min(y, OBEN - 110) - 16;
  const empfY = y;
  text(d.absenderZeile, RAND, y, 7, { farbe: LEISE });
  seite.drawLine({ start: { x: RAND, y: y - 3 }, end: { x: RAND + Math.min(f.widthOfTextAtSize(s(d.absenderZeile), 7), 260), y: y - 3 }, thickness: 0.4, color: LINIE });
  y -= 18;
  for (const z of d.empfaenger) { text(z, RAND, y, 10.5); y -= 14; }
  let my = empfY;
  for (const m of d.meta) {
    text(m.label, A4[0] - RAND - 150, my, 8.5, { farbe: LEISE });
    text(m.wert, A4[0] - RAND, my, 9.5, { fett: m.label === 'Angebot', rechts: true });
    my -= 14;
  }
  y = Math.min(y, my) - 22;

  // ── Titel, Einleitung ──
  absatz(`Angebot: ${d.titel}`, 14, { fett: true, zeile: 18 });
  if (d.entwurf) { y -= 2; absatz('ENTWURF — noch nicht gestellt', 8.5, { fett: true, farbe: rgb(0.75, 0.35, 0.1) }); }
  y -= 8;
  if (d.einleitung.trim()) { absatz(d.einleitung, 10); y -= 10; }

  // ── Positionen ──
  const X = { nr: RAND, titel: RAND + 22, menge: RAND + 300, preis: RAND + 385, betrag: A4[0] - RAND };
  const TITEL_BREIT = 262;
  const kopfzeile = () => {
    platz(26);
    y -= 14;
    text('Pos.', X.nr, y, 8, { fett: true, farbe: LEISE }); text('Leistung', X.titel, y, 8, { fett: true, farbe: LEISE });
    text('Menge', X.menge, y, 8, { fett: true, farbe: LEISE, rechts: true }); text('Einzelpreis', X.preis, y, 8, { fett: true, farbe: LEISE, rechts: true });
    text('Betrag netto', X.betrag, y, 8, { fett: true, farbe: LEISE, rechts: true });
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: A4[0] - RAND, y }, thickness: 0.6, color: LINIE });
  };
  kopfzeile();
  for (const p of d.positionen) {
    const titelZeilen = umbrechen(s(p.titel), fb, 9.5, TITEL_BREIT);
    const textZeilen = p.text.trim() ? umbrechen(s(p.text), f, 8.5, TITEL_BREIT) : [];
    const erste = 13 * titelZeilen.length + 12;
    if (y - erste < RAND + FUSS_HOEHE - 30) { neueSeite(); kopfzeile(); }
    y -= 14;
    text(p.nr, X.nr, y, 9.5, { farbe: LEISE });
    text(p.menge, X.menge, y, 9.5, { rechts: true });
    text(p.einzelpreis, X.preis, y, 9.5, { rechts: true });
    text(p.betrag, X.betrag, y, 9.5, { fett: true, rechts: true });
    titelZeilen.forEach((z, i) => { if (i) { y -= 12.5; } text(z, X.titel, y, 9.5, { fett: true }); });
    y -= 11;
    text(`${p.basis}${p.rabatt ? ` · Rabatt ${p.rabatt}` : ''}`, X.titel, y, 7.5, { farbe: AKZENT });
    for (const z of textZeilen) { if (y - 11 < RAND + FUSS_HOEHE - 30) { neueSeite(); kopfzeile(); y -= 4; } y -= 11; if (z) text(z, X.titel, y, 8.5, { farbe: LEISE }); }
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: A4[0] - RAND, y }, thickness: 0.3, color: LINIE });
  }

  // ── Summen ──
  y -= 6;
  for (const z of d.summen) {
    platz(15);
    y -= z.stark ? 15 : 13;
    text(z.label, X.preis, y, z.stark ? 9.5 : 8.5, { fett: z.stark, farbe: z.leise ? LEISE : TINTE, rechts: true });
    text(z.wert, X.betrag, y, z.stark ? 10 : 8.5, { fett: z.stark, farbe: z.leise ? LEISE : TINTE, rechts: true });
  }
  y -= 16;
  for (const h of d.hinweise) absatz(h, 8.5, { farbe: LEISE, zeile: 12 });
  y -= 10;
  if (d.schluss.trim()) absatz(d.schluss, 10);

  // ── Fuß auf jeder Seite ──
  const n = seiten.length;
  seiten.forEach((pg, i) => {
    seite = pg;
    let fy = RAND + 44;
    pg.drawLine({ start: { x: RAND, y: fy + 12 }, end: { x: A4[0] - RAND, y: fy + 12 }, thickness: 0.4, color: LINIE });
    for (const z of d.absender.fuss.slice(0, 5)) {
      const zz = umbrechen(s(z), f, 6.8, BREIT)[0] ?? '';
      text(zz, RAND, fy, 6.8, { farbe: LEISE });
      fy -= 9;
    }
    text(`Seite ${i + 1} von ${n}`, A4[0] - RAND, RAND - 14, 7, { farbe: LEISE, rechts: true });
    text(`Angebot ${d.nummer}`, RAND, RAND - 14, 7, { farbe: LEISE });
  });
  return doc.save({ useObjectStreams: false });
}
