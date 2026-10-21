// ─── Titel von Angebot und Deal — wann ein Titel „automatisch“ ist (rein, client-sicher, getestet; 21.10., Rundgang 19.10. A1) ─────────────────
// Fund: Ein Angebot, das nur einen Strategie-Workshop enthielt, hieß nach dem offenen Deal „Vertriebsaufbau Atlas Software“ — Mandat, Fall und
// Rechnung erbten den falschen Titel. EINE Regel für „dieser Titel nennt nur ein Produkt (und die Firma)“: ein solcher Titel trägt keine eigene
// Aussage und darf einem neuen Produkt folgen; jeder andere Titel ist von Hand geschrieben und bleibt. Neue Titel: „<Firma> · <Produkt>“ (wie
// `dealTitel` in lib/crm/deal-anlegen.ts — `mandatName` (lib/crm/mandat-name.ts) nimmt die Firma vorne heraus, nichts steht doppelt).
// Hier liegen nur die Wörter und die Erkennung; welches Produkt ein Angebot trägt, sagt `angebotHauptprodukt` (lib/crm/angebote.ts).

import type { ChancenArt } from './typen';

/** Das Wort je Deal-Art im automatischen Deal-Titel (`dealTitel`: „<Firma> · Retainer“) — EINE Liste für Anlegen und Erkennen. */
export const ART_WORT: Record<ChancenArt, string> = { retainer: 'Retainer', projekt: 'Projekt', workshop: 'Workshop', vermittlung: 'Vermittlung', software: 'Software' };

const norm = (s: string | null | undefined) => String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
/** Firmenname ohne Rechtsform („Atlas Software GmbH“ → „Atlas Software“) — Deal-Titel nennen die Firma oft ohne. */
const ohneRechtsform = (n: string) => n.replace(/\s+(GmbH|gGmbH|UG|AG|SE|KG|OHG|GbR|e\.\s?K\.?|Limited|Ltd\.?|Inc\.?|LLC)\b.*$/i, '').trim() || n;
const TRENNER = '\\s·\\-–—:|/,';
const AM_RAND = new RegExp(`^[${TRENNER}]+|[${TRENNER}]+$`, 'g');
const TRENNT_VORNE = new RegExp(`^[${TRENNER}]`);
const TRENNT_HINTEN = new RegExp(`[${TRENNER}]$`);

/**
 * Der Kern eines Titels: ohne die Firma (mit oder ohne Rechtsform, vorne oder hinten, nur als ganzes Stück mit Trenner) und ohne Trenner am Rand —
 * klein geschrieben, Leerraum zusammengefasst. „Atlas Software GmbH · Workshop“ → „workshop“, „Vertriebsaufbau Atlas Software“ → „vertriebsaufbau“.
 */
export function titelKern(titel: string | null | undefined, firma?: string | null): string {
  let t = norm(titel);
  const f = String(firma ?? '').trim();
  const varianten = f ? Array.from(new Set([norm(f), norm(ohneRechtsform(f))])).filter(Boolean).sort((a, b) => b.length - a.length) : [];
  for (const v of varianten) {
    if (t === v) return '';
    if (t.startsWith(v) && TRENNT_VORNE.test(t.slice(v.length))) { t = t.slice(v.length); break; }
    if (t.endsWith(v) && TRENNT_HINTEN.test(t.slice(0, t.length - v.length))) { t = t.slice(0, t.length - v.length); break; }
  }
  return t.replace(AM_RAND, '').trim();
}

/**
 * Nennt der Titel NUR eines dieser Produkte (oder nur das Art-Wort des automatischen Deal-Titels), dazu höchstens die Firma? Dann ist er
 * automatisch entstanden und darf nachgezogen werden. Ein leerer Titel (oder nur die Firma) zählt ebenso. Alles andere ist von Hand geschrieben.
 */
export function titelNurProdukt(titel: string | null | undefined, ctx: { firma?: string | null; produkte: readonly (string | null | undefined)[]; art?: ChancenArt }): boolean {
  const kern = titelKern(titel, ctx.firma);
  if (!kern) return true;
  if (ctx.produkte.some(p => { const n = norm(p); return !!n && n === kern; })) return true;
  return !!ctx.art && kern === norm(ART_WORT[ctx.art]);
}

/** Ein neuer automatischer Titel: „<Firma> · <Produkt>“, ohne Firma nur das Produkt (nie ein Personenname — Datensparsamkeit). */
export function produktTitel(produkt: string, firma?: string | null, max = 200): string {
  const p = produkt.replace(/\s+/g, ' ').trim();
  const f = String(firma ?? '').replace(/\s+/g, ' ').trim();
  if (!p) return '';
  return (f && norm(p) !== norm(f) ? `${f} · ${p}` : p).slice(0, max);
}
