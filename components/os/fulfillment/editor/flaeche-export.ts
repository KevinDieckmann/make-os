// ─── Fulfillment · Prozess-Editor › Fläche — „Als Bild speichern“ (SVG/PNG, 17.10.) ─────────────────────────────────────────────────────────
// Für Präsentationen: NUR die Fläche (Rahmen, Knoten, Pfeile) mit Titel und Legende — keine Auswahl, keine Anfasser, keine Bedienung. Gezeichnet wird mit
// DENSELBEN Formen wie live (components/os/ui/reise/flaeche-formen.tsx, versteckte Export-Zeichnung in ./Flaeche.tsx); hier stehen nur Maße, Serialisieren und
// Herunterladen. Nichts geht an einen Server — die Datei entsteht im Browser.

import type { Box } from '@/lib/fulfillment/prozesse/flaeche';

/** Schrift im Bild (System-Schriften — eine Bilddatei lädt keine Schriften der Seite). */
export const EXPORT_SCHRIFT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
/** Rand, Titelzeile und Legende des Bilds (Bildpunkte der Fläche). */
export const EXPORT_MASS = { rand: 48, titel: 76, legende: 64 } as const;
/** Größte Kante eines PNG (Browser-Grenze der Leinwand, mit Abstand). */
const PNG_MAX = 12_000;

/** Ausschnitt des Bilds: der Inhalt mit Rand, oben die Titelzeile, unten die Legende. */
export function exportRahmen(box: Box): { x: number; y: number; b: number; h: number; inhaltY: number; legendeY: number } {
  const { rand, titel, legende } = EXPORT_MASS;
  const b = Math.max(640, Math.round(box.b + 2 * rand));
  const h = Math.round(box.h + 2 * rand + titel + legende);
  return { x: Math.round(box.x - rand), y: Math.round(box.y - rand - titel), b, h, inhaltY: box.y, legendeY: Math.round(box.y + box.h + rand) };
}

/** Dateiname aus dem Titel (nur Buchstaben, Ziffern, Bindestrich). */
export function dateiName(titel: string, endung: 'svg' | 'png'): string {
  const t = titel.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
  return `${t || 'ablauf'}.${endung}`;
}

/** Das SVG als Text (mit Namensraum, ohne Bedienteile). */
export function svgText(el: SVGSVGElement): string {
  const kopie = el.cloneNode(true) as SVGSVGElement;
  kopie.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  kopie.removeAttribute('style');
  kopie.removeAttribute('aria-hidden');
  for (const n of Array.from(kopie.querySelectorAll('[data-fl-nur-bearbeiten]'))) n.remove();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(kopie)}`;
}

/** SVG-Text → PNG (doppelte Auflösung, höchstens PNG_MAX je Kante). */
export async function svgZuPng(svg: string, b: number, h: number): Promise<Blob> {
  const skala = Math.max(0.25, Math.min(2, PNG_MAX / Math.max(b, h)));
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const bild = new Image();
    await new Promise<void>((fertig, fehler) => { bild.onload = () => fertig(); bild.onerror = () => fehler(new Error('Bild ließ sich nicht zeichnen.')); bild.src = url; });
    const lw = document.createElement('canvas');
    lw.width = Math.round(b * skala); lw.height = Math.round(h * skala);
    const ctx = lw.getContext('2d');
    if (!ctx) throw new Error('Keine Leinwand im Browser.');
    ctx.drawImage(bild, 0, 0, lw.width, lw.height);
    return await new Promise<Blob>((fertig, fehler) => lw.toBlob(x => (x ? fertig(x) : fehler(new Error('PNG ließ sich nicht erzeugen.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Eine Datei im Browser speichern (Download). */
export function herunterladen(inhalt: Blob, name: string): void {
  const url = URL.createObjectURL(inhalt);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
