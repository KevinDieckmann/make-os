// ─── Standard · Fläche — was schwebende Leisten über einer Fläche verdecken (Feinschliff 1, 23.10.) ─────────────────────────────────────────────────────
// Misst die schwebenden Bedienelemente über einer Bühne (Werkzeugmodus: Kopfzeile, Werkzeugleiste links, Zoom/„Head fragen“ unten, Seitenfeld rechts; die
// Knoten-Auswahl der Werkstatt) und rechnet daraus die Ränder — die Rechnung selbst ist rein (lib/einpassen.ts `raenderAus`). „Alles zeigen“ der Landkarte
// (../../prozesse/Buehne.tsx) und der Werkstatt (../../prozesse/WerkstattFlaeche.tsx) fragen hier, bevor sie einpassen. Neue schwebende Leiste über einer
// Fläche: ihre Klasse in `SCHWEBE_SELEKTOR` (sonst liegt Inhalt nach „Alles zeigen“ darunter).

import { raenderAus, OHNE_RAENDER, type Feld, type Raender } from '@/lib/einpassen';

/** Die schwebenden Leisten (leere Orte des Rahmens sind unsichtbar und zählen nicht). */
export const SCHWEBE_SELEKTOR = '.wz-kopf-teil, .wz-schwebe, .wz-feld, .wz-feld-zu, .pw-auswahl-leiste';

const feldVon = (r: DOMRect): Feld => ({ x: r.left, y: r.top, b: r.width, h: r.height });

/** Die Ränder der Bühne `el`: im Werkzeugmodus alle Leisten des Rahmens, sonst die Leisten neben der Bühne in ihrem Rahmen. Ohne DOM: keine Ränder. */
export function schwebeRaender(el: Element | null | undefined): Raender {
  if (!el || typeof el.getBoundingClientRect !== 'function') return OHNE_RAENDER;
  const wurzel = el.closest('.wz-modus') ?? el.parentElement ?? el;
  const leisten = Array.from(wurzel.querySelectorAll(SCHWEBE_SELEKTOR)).filter(x => !el.contains(x)).map(x => feldVon(x.getBoundingClientRect()));
  return raenderAus(feldVon(el.getBoundingClientRect()), leisten);
}
