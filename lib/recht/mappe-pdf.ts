// ─── Head of Recht: Anwalts-Mappe als PDF (nur Server, 10.10.) ─────────────────────────────────────────────────────────────────────────
// Gerüst wie der Fortschritts-Report (lib/crm/treppe-pdf.ts: pdf-lib, Helvetica/WinAnsi, `sicherFuer` + `umbrechen` aus lib/crm/angebot-pdf.ts):
// Deckblatt mit Thema, Stand und Hinweis, dann die Abschnitte (Sachverhalt, Beteiligte, Dokumente, Fristen, Schritte, offene Fragen), danach die
// ANLAGEN: PDF-Unterlagen aus der Ablage werden Seite für Seite angehängt, Bilder (PNG/JPG) als eigene Seite; Word-Dateien und alles, was sich
// nicht einbinden lässt (verschlüsselte PDF, zu groß), stehen mit Grund im Verzeichnis „Anlagen“ — nie still weggelassen. Ein PDF = das Paket.

import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { sicherFuer, umbrechen } from '@/lib/crm/angebot-pdf';
import { MAPPE_GRENZEN, type MappeDokument } from './typen';

const A4: [number, number] = [595.28, 841.89];
const RAND = 56;
const BREIT = A4[0] - 2 * RAND;
const OBEN = A4[1] - 56;
const UNTEN = 70;
const TINTE = rgb(0.1, 0.1, 0.12);
const LEISE = rgb(0.42, 0.42, 0.46);
const LINIE = rgb(0.82, 0.82, 0.85);
const AKZENT = rgb(0.13, 0.71, 0.67);

/** Eine Anlage mit Inhalt (vom Server entschlüsselt geladen) — `bytes` fehlt, wenn sie nicht lesbar war. */
export interface AnlageInhalt { dateiId: string; titel: string; datum?: string; typ?: string; bytes?: Buffer; grund?: string }

export async function mappePdf(d: MappeDokument, anlagen: readonly AnlageInhalt[], opt: { erstellt: Date }): Promise<{ bytes: Uint8Array; eingebunden: number; ausgelassen: number }> {
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
    for (const z of umbrechen(s(t), o.fett ? fb : f, groesse, o.breite ?? BREIT)) { platz(groesse * 1.45); y -= groesse * 1.45; if (z) text(z, o.x ?? RAND, y, groesse, o); }
  };
  const abschnitt = (titel: string) => {
    platz(40); y -= 22;
    text(titel.toUpperCase(), RAND, y, 9, { fett: true, farbe: AKZENT });
    y -= 6;
    seite.drawLine({ start: { x: RAND, y }, end: { x: RAND + BREIT, y }, thickness: 0.5, color: LINIE });
    y -= 4;
  };
  const punkte = (l: readonly string[]) => { for (const p of l) { platz(16); const y0 = y; absatz(p, 10.5, { x: RAND + 14, breite: BREIT - 14 }); text('•', RAND + 2, y0 - 10.5 * 1.45, 10.5, { farbe: AKZENT }); } };

  neueSeite();
  text('ANWALTS-MAPPE', RAND, y, 9, { fett: true, farbe: AKZENT });
  y -= 26;
  absatz(d.titel.replace(/^Anwalts-Mappe — /, ''), 20, { fett: true });
  absatz(d.untertitel, 12, { farbe: LEISE });
  absatz(`Stand: ${d.stand.slice(8, 10)}.${d.stand.slice(5, 7)}.${d.stand.slice(0, 4)}`, 10.5, { farbe: LEISE });
  y -= 8;
  absatz(d.hinweis, 9.5, { farbe: LEISE });
  for (const a of d.abschnitte) { abschnitt(a.titel); punkte(a.zeilen); }

  // Anlagen: Verzeichnis, dann die Seiten.
  let summe = 0, eingebunden = 0, ausgelassen = 0;
  const verzeichnis: string[] = [];
  const anhaengen: (() => Promise<void>)[] = [];
  for (const [i, a] of anlagen.entries()) {
    const nr = `Anlage ${i + 1}`;
    const kopf = `${nr}: ${a.titel}${a.datum ? ` (abgelegt ${a.datum.slice(8, 10)}.${a.datum.slice(5, 7)}.${a.datum.slice(0, 4)})` : ''}`;
    if (i >= MAPPE_GRENZEN.anlagen) { verzeichnis.push(`${kopf} — nicht eingebunden (höchstens ${MAPPE_GRENZEN.anlagen} Anlagen)`); ausgelassen++; continue; }
    if (!a.bytes) { verzeichnis.push(`${kopf} — nicht eingebunden (${a.grund ?? 'nicht lesbar'})`); ausgelassen++; continue; }
    if (summe + a.bytes.length > MAPPE_GRENZEN.bytes) { verzeichnis.push(`${kopf} — nicht eingebunden (die Mappe würde zu groß; bitte einzeln aus der Ablage beifügen)`); ausgelassen++; continue; }
    const bytes = a.bytes;
    if (a.typ === 'application/pdf') {
      try {
        const quelle = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const n = quelle.getPageCount();
        anhaengen.push(async () => { const kopie = await doc.copyPages(quelle, quelle.getPageIndices()); for (const p of kopie) doc.addPage(p); });
        verzeichnis.push(`${kopf} — ${n} Seite${n === 1 ? '' : 'n'}`); summe += bytes.length; eingebunden++;
      } catch { verzeichnis.push(`${kopf} — nicht eingebunden (PDF verschlüsselt oder beschädigt; bitte einzeln beifügen)`); ausgelassen++; }
    } else if (a.typ === 'image/png' || a.typ === 'image/jpeg') {
      anhaengen.push(async () => {
        const bild = a.typ === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const p = doc.addPage(A4);
        const m = Math.min(BREIT / bild.width, (A4[1] - 2 * RAND - 30) / bild.height, 1);
        p.drawText(s(kopf).slice(0, 110), { x: RAND, y: A4[1] - RAND, size: 9, font: f, color: LEISE });
        p.drawImage(bild, { x: RAND, y: A4[1] - RAND - 16 - bild.height * m, width: bild.width * m, height: bild.height * m });
      });
      verzeichnis.push(`${kopf} — Bild`); summe += bytes.length; eingebunden++;
    } else {
      verzeichnis.push(`${kopf} — nicht eingebunden (Dateityp lässt sich nicht in ein PDF übernehmen; bitte einzeln aus der Ablage beifügen)`); ausgelassen++;
    }
  }
  abschnitt('Anlagen');
  punkte(verzeichnis.length ? verzeichnis : ['Keine Unterlagen in der Ablage zu diesem Thema.']);

  // Fuß der eigenen Seiten (Anlagen behalten ihr Aussehen).
  seiten.forEach((p, i) => {
    p.drawLine({ start: { x: RAND, y: 46 }, end: { x: RAND + BREIT, y: 46 }, thickness: 0.4, color: LINIE });
    const fuss = s(`${d.titel} · Keine Rechtsberatung`);
    p.drawText(fuss.length > 95 ? `${fuss.slice(0, 92)}...` : fuss, { x: RAND, y: 32, size: 8, font: f, color: LEISE });
    const nr = s(`Seite ${i + 1} von ${seiten.length}`);
    p.drawText(nr, { x: A4[0] - RAND - f.widthOfTextAtSize(nr, 8), y: 32, size: 8, font: f, color: LEISE });
  });
  for (const a of anhaengen) {
    try { await a(); } catch { ausgelassen++; eingebunden = Math.max(0, eingebunden - 1); }
  }
  return { bytes: await doc.save({ useObjectStreams: false }), eingebunden, ausgelassen };
}
