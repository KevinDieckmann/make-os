// ─── Fulfillment · Kunde — Löschfristen (rein; C2, 10.10.; FULFILLMENT_KONZEPT.md 8.1) ───────────────────────────────────────────────────────────
// Täglich im Löschfristen-Lauf (lib/fulfillment/fristen-server.ts → `kundeFristen`), mit den WIRKSAMEN Fristen aus `LOESCHFRISTEN`:
//   · `fulfillment-mandatsdaten` (Vorgabe 12 Monate nach Mandatsende): Formular-Antworten fallen weg, Puls-Sätze werden geleert (Wert und Tag bleiben
//     für die Kennzahl), Puls-Anfragen und Links (nur Hashes) fallen weg.
//   · `fulfillment-unterlagen` (Vorgabe 90 Tage nach Mandatsende): Unterlagen samt Datei — AUSSER sie wurden als Beleg übernommen (`beleg`).
//   · Mandat endgültig gelöscht (auch nicht im Papierkorb): alles dieses Mandats fällt weg (Belege bleiben).
//   · Puls-Anfragen ohne Antwort, die seit 90 Tagen abgelaufen sind: weg (Haushaltung).
// Verwaiste Dateien im Ordner `fulfillment-unterlagen` (Datei ohne Eintrag — z. B. nach Art. 17, der nur die Metadaten entfernt) räumt der Server
// über `verwaisteDateien`: nur Namen, die in keinem Fulfillment-Bestand mehr vorkommen (Wirkungsbericht-PDFs von C1 hängen am Fall) und älter als
// ein Tag sind (ein Upload schreibt erst die Datei, dann den Eintrag). Gezählt wird nur (keine Namen, keine Kennungen).

import { tagePlus } from '@/lib/zeit';
import type { KundeDatei } from '../typen';

export interface KundeFristen { heute: string; mandatsdatenMonate: number; unterlagenTage: number }
/** Ende je Mandat: `bekannt` = im CRM (auch im Papierkorb); `ende` = Tag des Endes (läuft noch: null). */
export type EndeVon = (mandatId: string) => { bekannt: boolean; ende: string | null };

/** Tag + n Monate (Monatsende geklemmt). */
export function monatPlus(tag: string, n: number): string {
  const [j, m, t] = tag.slice(0, 10).split('-').map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1, 12));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0, 12)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

export interface FristenErgebnis { datei: KundeDatei; zaehler: Record<string, number>; dateienWeg: string[] }

export function kundeFristenAnwenden(d: KundeDatei, endeVon: EndeVon, k: KundeFristen): FristenErgebnis {
  const zaehler: Record<string, number> = {};
  const zaehle = (name: string, n = 1) => { if (n) zaehler[name] = (zaehler[name] ?? 0) + n; };
  const lage = new Map<string, { weg: boolean; daten: boolean; unterlagen: boolean }>();
  const fuer = (mandatId: string) => {
    let x = lage.get(mandatId);
    if (!x) {
      const e = endeVon(mandatId);
      x = !e.bekannt ? { weg: true, daten: true, unterlagen: true }
        : { weg: false, daten: !!e.ende && monatPlus(e.ende, k.mandatsdatenMonate) < k.heute, unterlagen: !!e.ende && tagePlus(e.ende, k.unterlagenTage) < k.heute };
      lage.set(mandatId, x);
    }
    return x;
  };
  const formulare = d.formulare.filter(f => { const x = fuer(f.mandatId); if (x.daten) { zaehle(x.weg ? 'fulfillment-kunde-verwaist' : 'fulfillment-antworten'); return false; } return true; });
  const puls = d.puls.flatMap(p => {
    const x = fuer(p.mandatId);
    if (x.weg) { zaehle('fulfillment-kunde-verwaist'); return []; }
    if (x.daten && p.satz) { zaehle('fulfillment-puls-saetze'); const { satz: _s, ...rest } = p; return [rest]; }
    return [p];
  });
  const altGrenze = tagePlus(k.heute, -90);
  const pulsAnfragen = d.pulsAnfragen.filter(a => {
    const x = fuer(a.mandatId);
    if (x.daten) { zaehle(x.weg ? 'fulfillment-kunde-verwaist' : 'fulfillment-puls-anfragen'); return false; }
    if (!a.beantwortetAm && a.offenBis < altGrenze) { zaehle('fulfillment-puls-anfragen'); return false; }
    return true;
  });
  const links = d.links.filter(l => { const x = fuer(l.mandatId); if (x.daten) { zaehle(x.weg ? 'fulfillment-kunde-verwaist' : 'fulfillment-links'); return false; } return true; });
  const dateienWeg: string[] = [];
  const unterlagen = d.unterlagen.filter(u => {
    const x = fuer(u.mandatId);
    if (!x.unterlagen || u.beleg) return true;
    zaehle(x.weg ? 'fulfillment-kunde-verwaist' : 'fulfillment-unterlagen');
    dateienWeg.push(unterlageDatei(u.id));
    return false;
  });
  const anders = formulare.length !== d.formulare.length || pulsAnfragen.length !== d.pulsAnfragen.length || links.length !== d.links.length
    || unterlagen.length !== d.unterlagen.length || puls.some((p, i) => p !== d.puls[i]) || puls.length !== d.puls.length;
  return { datei: anders ? { ...d, formulare, puls, pulsAnfragen, links, unterlagen } : d, zaehler, dateienWeg };
}

/** Dateiname einer Unterlage im Ordner `fulfillment-unterlagen` (BILD_NAME: Kleinbuchstaben, Ziffern, Bindestrich + `.bin`). */
export const unterlageDatei = (id: string): string => `${id}.bin`;

/**
 * Verwaiste Dateien: im Ordner liegt eine Datei, deren Name (bzw. Stamm ohne Endung) in keinem Fulfillment-Bestand vorkommt. `bekannt` = alle
 * Zeichenketten aus den Beständen (Kunde, Fälle, Dossiers …), `alt` = die Datei ist älter als ein Tag.
 */
export function verwaisteDateien(dateien: readonly { name: string; alt: boolean }[], bekannt: ReadonlySet<string>): string[] {
  return dateien.filter(x => {
    if (!x.alt) return false;
    const stamm = x.name.replace(/\.[a-z0-9]{1,5}$/i, '');
    return !bekannt.has(x.name) && !bekannt.has(stamm);
  }).map(x => x.name);
}

/** Alle Zeichenketten eines Bestands (tief) — für `verwaisteDateien`. */
export function alleTexte(x: unknown, raus = new Set<string>()): Set<string> {
  if (typeof x === 'string') raus.add(x);
  else if (Array.isArray(x)) for (const y of x) alleTexte(y, raus);
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x as Record<string, unknown>)) { raus.add(k); alleTexte(v, raus); }
  return raus;
}
