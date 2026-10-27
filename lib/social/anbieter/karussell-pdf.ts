// ─── MAKE OS — Social: Karussell als PDF (LinkedIn-Dokument-Beitrag) — 27.10.2026 ───────────────────────────────────────────────────
// LinkedIn kennt organisch kein Bild-Karussell, aber Dokument-Beiträge (PDF, ≤ 300 Seiten, ≤ 100 MB — FAKTEN_VEROEFFENTLICHEN.md) — die
// Plattform zeigt sie als blätterbare Folien. Aus dem Skript einer Karussell-Folge (Folien durch eine Zeile „---“ getrennt, erste Zeile je
// Folie = Überschrift) wird hier ein PDF im Hochformat 4:5. Schlicht und ohne Marke von MAKE OS (es ist der Beitrag des Kanals): dunkle
// Fläche, helle Schrift, Seitenzahl. Rein bis auf pdf-lib; gleiche Eingabe → gleiche Bytes (fester Zeitstempel).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sicherFuer, umbrechen } from '@/lib/crm/angebot-pdf';

export interface Folie { kopf: string; text: string }

/** Skript → Folien (leere fallen weg). */
export function folienAus(skript: string): Folie[] {
  return skript.split(/^\s*-{3,}\s*$/m).map(b => b.trim()).filter(Boolean).map(b => {
    const [kopf, ...rest] = b.split('\n');
    return { kopf: kopf.replace(/^#+\s*/, '').trim(), text: rest.join('\n').trim() };
  });
}

const MASS: [number, number] = [1080, 1350];
const RAND = 96;
const GRUND = rgb(0.07, 0.08, 0.09);
const HELL = rgb(0.96, 0.96, 0.97);
const LEISE = rgb(0.62, 0.64, 0.68);
const FEST = new Date(Date.UTC(2026, 0, 1));

export async function karussellPdf(titel: string, folien: readonly Folie[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(titel.slice(0, 200));
  doc.setCreationDate(FEST);
  doc.setModificationDate(FEST);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const s = sicherFuer(f);
  const breite = MASS[0] - 2 * RAND;
  folien.slice(0, 300).forEach((folie, i) => {
    const p = doc.addPage(MASS);
    p.drawRectangle({ x: 0, y: 0, width: MASS[0], height: MASS[1], color: GRUND });
    let y = MASS[1] - RAND - 60;
    const kopfGroesse = i === 0 ? 76 : 60;
    for (const z of umbrechen(s(folie.kopf), fb, kopfGroesse, breite)) { p.drawText(z, { x: RAND, y, size: kopfGroesse, font: fb, color: HELL }); y -= kopfGroesse * 1.18; }
    y -= 36;
    for (const z of umbrechen(s(folie.text), f, 40, breite)) { if (y < RAND + 80) break; p.drawText(z, { x: RAND, y, size: 40, font: f, color: HELL }); y -= 40 * 1.4; }
    p.drawText(`${i + 1} / ${folien.length}`, { x: RAND, y: RAND - 20, size: 28, font: f, color: LEISE });
  });
  return doc.save();
}
