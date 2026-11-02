// ─── Markttraktion · Angebot als PDF (nur Server, 28.09.) ─────────────────────
// Kevins Entscheidung: noch kein Server-Versand — beim „Senden“ entsteht hier das
// PDF, liegt verschlüsselt in der Dateiablage (Bezug Kontakt/Firma/Deal/Angebot),
// der Browser lädt es herunter und öffnet das Mail-Programm.
//
// pdf-lib (fest gepinnt), Standardschrift Helvetica: sie kodiert WinAnsi — Umlaute,
// ß, €, „ “ – • gehen; was die Schrift nicht kann, wird ersetzt (`sicher`), nie ein
// Absturz. Aufbau aus lib/crm/angebot-dokument.ts — derselbe wie die HTML-Vorschau.
// Seitenumbruch mit wiederholter rechter Spalte (Pflichtangaben) und „Seite n von m“.
//
// Gestaltung (02.11., Malin: „sieht nicht gut aus“ — Vorbild gängige Rechnungsprogramme): Band oben in der Akzentfarbe der
// Gesellschaft (ohne: Tinte), links die Hauptspalte (Rücksendezeile, Anschrift, „Rechnung Nr. …“, Positionen auf hellen Flächen,
// großer Endbetrag), rechts eine schmale Spalte mit Logo bzw. Wortmarke, den Angaben (gesperrte Großbuchstaben + fetter Wert) und
// unten Anschrift, Kontakt, Steuer, Bank. Farben aus dem Papier/Tinte-Satz der Marke (website/css/seite.css), nie Firmenfarben fest.

import { PDFDocument, StandardFonts, rgb, popGraphicsState, pushGraphicsState, setCharacterSpacing, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { AngebotDokument } from './angebot-dokument';

const A4: [number, number] = [595.28, 841.89];
const [W, H] = A4;
/** Hauptspalte links … rechts, schmale Spalte rechts daneben. */
const L = 56;
const MR = 418;
const SX = 438;
const SR = W - 36;
const SB = SR - SX;
const BAND = 6;
const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const TINTE = hex('#0B0E10');
const DIM = hex('#4F5A5D');
const LEISE = hex('#6A7376');
const FLAECHE = hex('#F2F0EA');
const HAAR = hex('#D9D6CD');
const ENTWURF = rgb(0.75, 0.35, 0.1);

export interface PdfLogo { bytes: Uint8Array; typ: 'image/png' | 'image/jpeg' }

/** Text auf die Zeichen bringen, die die Schrift kann (WinAnsi); Ersatz für Häufiges. */
export function sicherFuer(font: PDFFont): (t: string) => string {
  const kann = new Set(font.getCharacterSet());
  const ersatz: Record<string, string> = { '→': '->', '←': '<-', '✓': 'x', '×': 'x', ' ': ' ', ' ': ' ', ' ': ' ', '−': '-', '‑': '-', '≈': '~', '•': '•', '…': '...' };
  // Zeilenumbrüche bleiben (Absätze trennt `umbrechen`), alles andere, was die Schrift nicht kann, wird ersetzt.
  return (t: string) => Array.from(String(t ?? '').normalize('NFC').replace(/\r\n?/g, '\n')).map(z => (z === '\n' || kann.has(z.codePointAt(0)!) ? z : ersatz[z] && Array.from(ersatz[z]).every(x => kann.has(x.codePointAt(0)!)) ? ersatz[z] : z === '\t' ? ' ' : '?')).join('');
}

/** Zeilen umbrechen (an Wortgrenzen, zu lange Wörter hart). Absätze bleiben. */
export function umbrechen(text: string, font: PDFFont, groesse: number, breite: number): string[] {
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

/** Das PDF eines Angebots (seit 08.10. auch einer Rechnung, `d.art`). `erstellt` fest übergeben — gleiche Eingabe, gleiche Bytes (Prüfsumme). */
export async function angebotPdf(d: AngebotDokument, opt: { logo?: PdfLogo | null; erstellt: Date; autor?: string; /** E-Rechnung (31.10.): vor dem Speichern z. B. die ZUGFeRD-XML einbetten (lib/finanzen/erechnung/pdf.ts) — ohne: bit-gleich wie bisher. */ vorSpeichern?: (doc: PDFDocument) => Promise<void> | void }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const art = d.art ?? 'Angebot';
  doc.setTitle(`${art} ${d.nummer} – ${d.titel}`);
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
  const akzent = d.absender.akzent && /^#[0-9a-f]{6}$/i.test(d.absender.akzent) ? hex(d.absender.akzent) : TINTE;
  let logo: { bild: Awaited<ReturnType<PDFDocument['embedPng']>>; b: number; h: number } | null = null;
  if (opt.logo) {
    try {
      const bild = opt.logo.typ === 'image/png' ? await doc.embedPng(opt.logo.bytes) : await doc.embedJpg(opt.logo.bytes);
      const k = Math.min(SB / bild.width, 50 / bild.height, 1);
      logo = { bild, b: bild.width * k, h: bild.height * k };
    } catch { logo = null; } // ein kaputtes Logo verhindert keinen Beleg
  }

  type Stil = { fett?: boolean; farbe?: RGB; rechts?: boolean; sperren?: number };
  const breite = (t: string, groesse: number, o: Stil = {}) => { const tt = s(t); return (o.fett ? fb : f).widthOfTextAtSize(tt, groesse) + (o.sperren ?? 0) * Math.max(0, Array.from(tt).length - 1); };
  const seiten: PDFPage[] = [];
  let seite!: PDFPage;
  const text = (t: string, x: number, yy: number, groesse: number, o: Stil = {}) => {
    const tt = s(t);
    if (!tt) return;
    const xx = o.rechts ? x - breite(t, groesse, o) : x;
    if (o.sperren) seite.pushOperators(pushGraphicsState(), setCharacterSpacing(o.sperren));
    seite.drawText(tt, { x: xx, y: yy, size: groesse, font: o.fett ? fb : f, color: o.farbe ?? TINTE });
    if (o.sperren) seite.pushOperators(popGraphicsState());
  };
  const versal = (t: string) => t.toLocaleUpperCase('de-DE');
  /** Fläche mit runden Ecken (Radius 3) — hinter Positionen und Steuerzeilen. */
  const flaeche = (x: number, unten: number, b: number, h: number) => {
    const r = Math.min(3, h / 2);
    seite.drawSvgPath(`M ${r} 0 H ${b - r} Q ${b} 0 ${b} ${r} V ${h - r} Q ${b} ${h} ${b - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`, { x, y: unten + h, color: FLAECHE, borderWidth: 0 }); // SVG-Pfade zeichnen von y nach unten
  };

  // Unterer Rand der Hauptspalte: darunter steht nur „Seite n von m“ (und der AGB-Link).
  const agbZeilen = d.agb ? umbrechen(s(`Es gelten unsere Allgemeinen Geschäftsbedingungen: ${d.agb}`), f, 6.8, MR - L).slice(0, 2) : [];
  const UNTEN = 58 + agbZeilen.length * 9;
  const OBEN_FOLGE = H - 74;
  let y = 0;
  const neueSeite = () => {
    seite = doc.addPage(A4); seiten.push(seite);
    seite.drawRectangle({ x: 0, y: H - BAND, width: W, height: BAND, color: akzent });
    y = OBEN_FOLGE;
  };
  const absatz = (t: string, groesse: number, o: Stil & { zeile?: number; x?: number; b?: number } = {}) => {
    const zh = o.zeile ?? groesse * 1.42;
    for (const z of umbrechen(s(t), o.fett ? fb : f, groesse, o.b ?? MR - L)) {
      if (y - zh < UNTEN) neueSeite();
      y -= zh;
      if (z) text(z, o.x ?? L, y, groesse, o);
    }
  };

  // ── Seite 1: Rücksendezeile, Anschrift, Falzmarken ──
  neueSeite();
  for (const mm of [105, 148.5, 210]) seite.drawLine({ start: { x: 0, y: H - mm * 2.8346 }, end: { x: mm === 148.5 ? 10 : 14, y: H - mm * 2.8346 }, thickness: 0.5, color: HAAR });
  y = H - 146;
  for (const z of umbrechen(s(d.absenderZeile.split(' · ').join('  ·  ')), fb, 7, MR - L).slice(0, 2)) { text(z, L, y, 7, { fett: true, farbe: DIM }); y -= 9; }
  y -= 12;
  for (const z of d.empfaenger) for (const zz of umbrechen(s(z), f, 10, MR - L)) { text(zz, L, y, 10); y -= 13.5; }

  // ── Überschrift (links) und Angaben (rechte Spalte, bündig mit der Überschrift) ──
  y = Math.min(H - 286, y - 34);
  const titelOben = y;
  const titelZeilen = umbrechen(s(d.ueberschrift ?? `Angebot: ${d.titel}`), fb, 17, MR - L);
  titelZeilen.forEach((z, i) => text(z, L, y - i * 20, 17, { fett: true }));
  y -= (titelZeilen.length - 1) * 20;
  if (d.unterzeile?.trim()) { y -= 6; absatz(d.unterzeile, 10.5, { farbe: DIM, zeile: 14 }); }
  if (d.entwurf) { y -= 4; absatz(versal('Entwurf — noch nicht gestellt'), 7, { fett: true, farbe: ENTWURF, sperren: 0.9, zeile: 11 }); }
  let my = titelOben + 4;
  for (const m of d.meta) {
    if (!m.wert) continue;
    const lb = versal(m.label);
    if (breite(lb, 6.3, { sperren: 0.8 }) + 5 + breite(m.wert, 7.6, { fett: true }) <= SB) {
      text(lb, SX, my, 6.3, { farbe: LEISE, sperren: 0.8 });
      text(m.wert, SX + breite(lb, 6.3, { sperren: 0.8 }) + 5, my, 7.6, { fett: true });
      my -= 12.5;
    } else {
      text(lb, SX, my, 6.3, { farbe: LEISE, sperren: 0.8 });
      my -= 10;
      for (const z of umbrechen(s(m.wert), fb, 7.6, SB)) { text(z, SX, my, 7.6, { fett: true }); my -= 10; }
      my -= 2.5;
    }
  }
  y -= 26;
  if (d.einleitung.trim()) { absatz(d.einleitung, 9.5, { zeile: 13.5 }); y -= 16; }

  // ── Positionen auf hellen Flächen ──
  const KOPF = { titel: 'Beschreibung', menge: 'Menge', preis: 'Einzelpreis', betrag: 'Gesamt' };
  const wB = Math.max(breite(KOPF.betrag, 8.5, { fett: true }), ...d.positionen.map(p => breite(p.betrag, 9)));
  const wP = Math.max(breite(KOPF.preis, 8.5, { fett: true }), ...d.positionen.map(p => breite(p.einzelpreis, 9)));
  const wM = Math.max(breite(KOPF.menge, 8.5, { fett: true }), ...d.positionen.map(p => breite(p.menge, 9)));
  const X = { nr: L + 8, titel: L + 26, betrag: MR - 8, preis: MR - 8 - wB - 14, menge: MR - 8 - wB - 14 - wP - 14 };
  const TITEL_B = Math.max(90, X.menge - wM - 14 - X.titel);
  const kopfzeile = () => {
    if (y - 40 < UNTEN) neueSeite();
    y -= 12;
    text(KOPF.titel, X.nr, y, 8.5, { fett: true });
    text(KOPF.menge, X.menge, y, 8.5, { fett: true, rechts: true });
    text(KOPF.preis, X.preis, y, 8.5, { fett: true, rechts: true });
    text(KOPF.betrag, X.betrag, y, 8.5, { fett: true, rechts: true });
    y -= 8;
  };
  kopfzeile();
  type Zeile = { h: number; zeichne: (grund: number) => void };
  const PO = 8, PU = 7;
  for (const p of d.positionen) {
    const zeilen: Zeile[] = [];
    umbrechen(s(p.titel), fb, 9, TITEL_B).forEach((z, i) => zeilen.push({ h: 12.5, zeichne: g => {
      text(z, X.titel, g, 9, { fett: true });
      if (!i) { text(p.nr + '.', X.nr, g, 9); text(p.menge, X.menge, g, 9, { rechts: true }); text(p.einzelpreis, X.preis, g, 9, { rechts: true }); text(p.betrag, X.betrag, g, 9, { rechts: true }); }
    } }));
    if (p.artikelnummer) for (const z of umbrechen(s(`Art.-Nr. ${p.artikelnummer}`), f, 7.5, TITEL_B)) zeilen.push({ h: 10.5, zeichne: g => text(z, X.titel, g, 7.5, { farbe: LEISE }) });
    // Rechnungen (08.10.) haben keine Basis — die Zeile steht nur, wenn es etwas zu sagen gibt (Angebote: immer).
    if (p.basis || p.rabatt) { const b = `${p.basis}${p.rabatt ? `${p.basis ? ' · ' : ''}Rabatt ${p.rabatt}` : ''}`; for (const z of umbrechen(s(b), f, 7.5, TITEL_B)) zeilen.push({ h: 10.5, zeichne: g => text(z, X.titel, g, 7.5, { farbe: DIM }) }); }
    if (p.text.trim()) for (const z of umbrechen(s(p.text), f, 8.6, TITEL_B)) zeilen.push({ h: 12, zeichne: g => { if (z) text(z, X.titel, g, 8.6); } });
    const ganz = PO + PU + zeilen.reduce((a, z) => a + z.h, 0);
    // Passt die Position auf eine frische Seite, aber nicht mehr hierhin: ganz auf die nächste (nie mitten durch eine kurze Position).
    if (y - ganz < UNTEN && ganz <= OBEN_FOLGE - UNTEN - 30) { neueSeite(); kopfzeile(); }
    let i = 0;
    while (i < zeilen.length) {
      let k = 0, h = PO + PU;
      while (i + k < zeilen.length && y - (h + zeilen[i + k].h) >= UNTEN) { h += zeilen[i + k].h; k++; }
      if (!k) { neueSeite(); kopfzeile(); continue; }
      flaeche(L, y - h, MR - L, h);
      let g = y - PO;
      for (let j = i; j < i + k; j++) { g -= zeilen[j].h; zeilen[j].zeichne(g + 3); }
      y -= h + 4;
      i += k;
      if (i < zeilen.length) { neueSeite(); kopfzeile(); }
    }
  }

  // ── Summen: netto ohne Fläche, Steuer auf Fläche, Endbetrag groß ──
  const letzteStark = d.summen.map(z => !!z.stark).lastIndexOf(true);
  const zh = (i: number) => (i === letzteStark ? 34 : d.summen[i].leise ? 20 : 19);
  const summenH = d.summen.reduce((a, _, i) => a + zh(i), 0) + 6;
  if (y - summenH < UNTEN) neueSeite();
  y -= 4;
  d.summen.forEach((z, i) => {
    const h = zh(i);
    if (z.leise) flaeche(L, y - h + 2, MR - L, h - 2);
    if (i === letzteStark) {
      const g = y - 24;
      text(z.label, X.nr, g, 9.5, { fett: true });
      text(z.wert, X.betrag, g, 17, { fett: true, rechts: true });
    } else {
      const g = y - 13;
      text(z.label, X.nr, g, 9, { fett: z.stark, farbe: z.leise ? DIM : TINTE });
      text(z.wert, X.betrag, g, z.stark ? 10 : 9, { fett: z.stark, farbe: z.leise ? DIM : TINTE, rechts: true });
    }
    y -= h;
  });
  y -= 18;
  for (const h of d.hinweise) { absatz(h, 9, { zeile: 12.5 }); y -= 5; }
  if (d.schluss.trim()) { y -= 6; absatz(d.schluss, 9.5, { zeile: 13.5 }); }
  // Annahmeblock (25.10., nur wenn die Gesellschaft ihn eingeschaltet hat): zwei Linien für Ort/Datum und Unterschrift des Kunden.
  if (d.annahme) {
    if (y - 86 < UNTEN) neueSeite();
    y -= 26;
    text('Angebot angenommen', L, y, 10, { fett: true });
    y -= 38;
    const halb = (MR - L - 24) / 2;
    seite.drawLine({ start: { x: L, y }, end: { x: L + halb, y }, thickness: 0.6, color: TINTE });
    seite.drawLine({ start: { x: L + halb + 24, y }, end: { x: MR, y }, thickness: 0.6, color: TINTE });
    y -= 11;
    text('Ort, Datum', L, y, 8, { farbe: LEISE });
    text('Unterschrift und Name (Kunde)', L + halb + 24, y, 8, { farbe: LEISE });
  }

  // ── Rechte Spalte auf jeder Seite: oben Logo bzw. Wortmarke, unten Anschrift · Kontakt · Steuer · Bank ──
  type LZ = { t: string; x: number; groesse: number; stil: Stil; h: number };
  const leiste: LZ[] = [];
  const gruppen = d.absender.leiste?.length ? d.absender.leiste : [d.absender.fuss.map(w => ({ label: '', wert: w }))];
  gruppen.forEach((gr, gi) => {
    if (gi) leiste.push({ t: '', x: SX, groesse: 6, stil: {}, h: 8 });
    for (const r of gr) {
      const ohne = !r.label;
      const stilW: Stil = ohne && !d.absender.leiste?.length ? { farbe: DIM } : { fett: true };
      const gW = ohne && !d.absender.leiste?.length ? 6.6 : 7.3;
      if (ohne) { for (const z of umbrechen(s(r.wert), stilW.fett ? fb : f, gW, SB)) leiste.push({ t: z, x: SX, groesse: gW, stil: stilW, h: 10 }); continue; }
      const lb = versal(r.label);
      const lbB = breite(lb, 6.1, { sperren: 0.8 });
      if (lbB + 5 + breite(r.wert, gW, stilW) <= SB) {
        leiste.push({ t: lb, x: SX, groesse: 6.1, stil: { farbe: LEISE, sperren: 0.8 }, h: 0 });
        leiste.push({ t: r.wert, x: SX + lbB + 5, groesse: gW, stil: stilW, h: 10 });
      } else {
        leiste.push({ t: lb, x: SX, groesse: 6.1, stil: { farbe: LEISE, sperren: 0.8 }, h: 9 });
        for (const z of umbrechen(s(r.wert), fb, gW, SB)) leiste.push({ t: z, x: SX, groesse: gW, stil: stilW, h: 10 });
      }
    }
  });
  const leisteH = leiste.reduce((a, z) => a + z.h, 0);
  const wortmarke = logo ? [] : umbrechen(s(d.absender.firmierung), fb, 15, SB).slice(0, 3);
  const n = seiten.length;
  seiten.forEach((pg, i) => {
    seite = pg;
    if (logo) seite.drawImage(logo.bild, { x: SX, y: H - 44 - logo.h, width: logo.b, height: logo.h });
    wortmarke.forEach((z, j) => text(z, SX, H - 58 - j * 17, 15, { fett: true }));
    let ly = 34 + leisteH;
    for (const z of leiste) { if (z.t) text(z.t, z.x, ly - (z.h || 10), z.groesse, z.stil); ly -= z.h; }
    agbZeilen.forEach((z, j) => text(z, L, 46 + (agbZeilen.length - 1 - j) * 9, 6.8, { farbe: LEISE }));
    text(`${art} ${d.nummer}  ·  Seite ${i + 1} von ${n}`, L, 30, 6.5, { farbe: LEISE, sperren: 0.5 });
  });
  await opt.vorSpeichern?.(doc);
  return doc.save({ useObjectStreams: false });
}

/** Derselbe Weg unter dem allgemeinen Namen — Rechnungen und Stornorechnungen (lib/finanzen/rechnung/server.ts). */
export const belegPdf = angebotPdf;
