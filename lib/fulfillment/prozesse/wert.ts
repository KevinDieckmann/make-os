// ─── Fulfillment · Prozesse — Wert-Konto: Zielerreichung, Ist-Text, Messreihe (C1, 10.10.; FULFILLMENT_KONZEPT.md 1.3, 7.5) ───────────
// Das Wert-Konto ist das gemeinsame Zielbild DES KUNDEN (Ausgangslage, Zielwerte, Datum — im Kick-off festgelegt; keine Garantie, kein
// Erfolgshonorar). Die Ziele selbst bleiben in `Mandat.ziele` (eine Wahrheit für „was ist das Ziel“); der Fall ergänzt je Ziel-Kennung
// Ausgang, Zielzahl, Einheit, Richtung, Datum und die Messreihe. Messwerte trägt nur MAKE ein (Kevin 10.10.). Eine neue Messung schreibt im
// selben Klick `Mandat.ziele[i].ist` (formatierter Wert, ≤ 80 Zeichen) über den CRM-Weg — so bleibt der heutige Report richtig.
// Rein und client-sicher.

import type { WertKontoEintrag } from '../typen';

/** Letzte Messung (nach Tag) — oder null. */
export const letzteMessung = (e: Pick<WertKontoEintrag, 'messungen'> | undefined) =>
  e?.messungen?.length ? [...e.messungen].sort((a, b) => (a.am < b.am ? -1 : a.am > b.am ? 1 : 0)).at(-1)! : null;

/**
 * Zielerreichung in Prozent (0–100) zwischen Ausgang und Ziel — die letzte Messung zählt. Richtung ergibt sich aus Ausgang/Ziel
 * („runter“: weniger ist besser). Ohne Ausgangs- und Zielzahl oder ohne Messung: null.
 */
export function zielErreichung(e: WertKontoEintrag | undefined): number | null {
  if (!e || e.ausgangZahl === undefined || e.zielZahl === undefined || e.zielZahl === e.ausgangZahl) return null;
  const l = letzteMessung(e);
  if (!l) return null;
  const anteil = (l.wert - e.ausgangZahl) / (e.zielZahl - e.ausgangZahl);
  return Math.round(Math.max(0, Math.min(1, anteil)) * 100);
}

/** Der Ist-Wert für `Mandat.ziele[i].ist` (höchstens 80 Zeichen): „12 Termine (Stand 14.10.)“. */
export function istText(wert: number, einheit: string | undefined, am: string): string {
  const tag = /^\d{4}-\d{2}-\d{2}$/.test(am) ? `${am.slice(8, 10)}.${am.slice(5, 7)}.` : '';
  return `${wert.toLocaleString('de-DE')}${einheit ? ` ${einheit}` : ''}${tag ? ` (Stand ${tag})` : ''}`.slice(0, 80);
}

/** Der Zielwert für `Mandat.ziele[i].ziel`, wenn er dort noch leer ist (≤ 80 Zeichen). */
export const zielText = (zahl: number, einheit: string | undefined, bis: string | undefined) =>
  `${zahl.toLocaleString('de-DE')}${einheit ? ` ${einheit}` : ''}${bis ? ` bis ${bis.slice(8, 10)}.${bis.slice(5, 7)}.${bis.slice(0, 4)}` : ''}`.slice(0, 80);

/** Punkte einer kleinen Verlaufslinie (0–1 je Achse) — Ausgang, Messungen; das Ziel als eigene Linie. Rein für die Zeichnung. */
export function wertReihe(e: WertKontoEintrag | undefined): { punkte: { x: number; y: number; am: string; wert: number }[]; zielY: number | null } {
  if (!e) return { punkte: [], zielY: null };
  const m = [...e.messungen].sort((a, b) => (a.am < b.am ? -1 : 1));
  const werte = [...(e.ausgangZahl !== undefined ? [e.ausgangZahl] : []), ...m.map(x => x.wert), ...(e.zielZahl !== undefined ? [e.zielZahl] : [])];
  if (!werte.length) return { punkte: [], zielY: null };
  const min = Math.min(...werte), max = Math.max(...werte);
  const y = (w: number) => (max === min ? 0.5 : (w - min) / (max - min));
  const reihe = [...(e.ausgangZahl !== undefined ? [{ am: 'Ausgang', wert: e.ausgangZahl }] : []), ...m];
  const n = Math.max(1, reihe.length - 1);
  return { punkte: reihe.map((p, i) => ({ x: reihe.length === 1 ? 0.5 : i / n, y: y(p.wert), am: p.am, wert: p.wert })), zielY: e.zielZahl !== undefined ? y(e.zielZahl) : null };
}

/** Ø Zielerreichung über die messbaren Ziele eines Falls — oder null. */
export function wertDurchschnitt(wertKonto: Record<string, WertKontoEintrag>): { wert: number; ziele: number } | null {
  const l = Object.values(wertKonto).map(zielErreichung).filter((x): x is number => x != null);
  return l.length ? { wert: Math.round(l.reduce((a, b) => a + b, 0) / l.length), ziele: l.length } : null;
}
