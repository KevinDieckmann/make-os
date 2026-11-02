// ─── Buchhaltung — Geld zwischen eigenen Konten: Umbuchung, Entnahme, Einlage, Gesellschafter, Verrechnung (02.11., rein) ───────────────
// Bisher hieß jeder Umsatz zu einem eigenen Konto „Umbuchung“ und zählte nirgends. Buchhalterisch ist Geld zwischen einer Gesellschaft und
// Privat aber keine Umbuchung (L2). Die EINE Regel (bereichsneutral über `bereichVon` und die Rechtsart aus lib/einheiten.ts, nie eine feste
// Gesellschaft):
//   • gleiches Konto-Ziel (dieselbe Gesellschaft, oder Privat ↔ Gemeinsam) oder gleicher Bereich (Gesellschaft im Privat-Bereich ↔ Privat) → Umbuchung,
//   • Gesellschaft ↔ andere Gesellschaft → „Verrechnung/Darlehen zwischen Gesellschaften — zuordnen“,
//   • Business-Gesellschaft ↔ Privat: Einzelunternehmen → Privatentnahme (Abfluss) bzw. Privateinlage (Zufluss);
//     Kapitalgesellschaft → „Gesellschafterdarlehen/Ausschüttung — bitte zuordnen“ (Kategorie offen, Markierung).
// Die Haushalts-Seite ist dann KEINE Umbuchung, sondern Einnahme bzw. Ausgabe („Entnahme aus <G>“ / „Einlage in <G>“).
// Automatisch nur bei NEUEN Importen; gespeicherte Buchungen bekommen eine Vorschlagsliste mit Klick (lib/finanzen/buchhaltung/server.ts).

import { bereichVon, finanzOrtName, istGesellschaft, RECHTSART, type Bereich, type Gesellschaftskennung, type Rechtsart } from '@/lib/einheiten';
import { KAT } from './kategorien';
import { gegenbuchungPaare, type BhBuchung, type Zuordnen } from './arbeitsliste';

/** Ort eines eigenen Kontos (wie im Konten-Register): privat · gemeinsam · Gesellschaft. */
export type EigenerOrt = 'privat' | 'gemeinsam' | Gesellschaftskennung;
export type GegenArt = 'umbuchung' | 'entnahme' | 'einlage' | 'gesellschafter' | 'verrechnung';

/** Woher Bereich und Rechtsart kommen (Vorgabe: lib/einheiten.ts — in Tests austauschbar). */
export interface EinheitenInfo { bereich: (g: Gesellschaftskennung) => Bereich; rechtsart: (g: Gesellschaftskennung) => Rechtsart }
export const EINHEITEN_INFO: EinheitenInfo = { bereich: g => bereichVon(g), rechtsart: g => RECHTSART[g] };

const privatOrt = (o: EigenerOrt) => o === 'privat' || o === 'gemeinsam';

/**
 * Was ist ein Umsatz zwischen dem eigenen Konto (`hier`) und einem anderen eigenen Konto (`dort`)? `cent` aus Sicht von `hier`
 * (+ Zufluss, − Abfluss). Liefert die Art aus Sicht der GESELLSCHAFT, um die es geht (bei Privat ↔ Gesellschaft die Gesellschaft).
 */
export function gegenArt(hier: EigenerOrt, dort: EigenerOrt, cent: number, info: EinheitenInfo = EINHEITEN_INFO): { art: GegenArt; gesellschaft?: Gesellschaftskennung } {
  if (hier === dort || (privatOrt(hier) && privatOrt(dort))) return { art: 'umbuchung' };
  if (istGesellschaft(hier) && istGesellschaft(dort)) return { art: 'verrechnung' };
  const g = (istGesellschaft(hier) ? hier : dort) as Gesellschaftskennung;
  // Gleicher Bereich (z. B. eine Gesellschaft, die die Instanz im Privat-Bereich führt) bleibt Umbuchung.
  if (info.bereich(g) === 'privat') return { art: 'umbuchung', gesellschaft: g };
  if (info.rechtsart(g) === 'kapitalgesellschaft') return { art: 'gesellschafter', gesellschaft: g };
  // Fluss aus Sicht der Gesellschaft: Abfluss bei ihr = Entnahme, Zufluss = Einlage.
  const centBeiG = istGesellschaft(hier) ? cent : -cent;
  return { art: centBeiG < 0 ? 'entnahme' : 'einlage', gesellschaft: g };
}

/** Kategorie und Markierung der Business-Seite. */
export function businessKategorie(a: GegenArt): { kategorie: string; zuordnen?: Zuordnen } {
  switch (a) {
    case 'umbuchung': return { kategorie: KAT.umbuchung };
    case 'entnahme': return { kategorie: KAT.entnahme };
    case 'einlage': return { kategorie: KAT.einlage };
    case 'gesellschafter': return { kategorie: KAT.sonstiges, zuordnen: 'gesellschafter' };
    case 'verrechnung': return { kategorie: KAT.sonstiges, zuordnen: 'verrechnung' };
  }
}

/** Die Haushalts-Seite: Umbuchung nur bei `umbuchung`; sonst Einnahme/Ausgabe mit einer Notiz („Entnahme aus …“). */
export function haushaltSeite(a: GegenArt, g: Gesellschaftskennung | undefined, centImHaushalt: number): { umbuchung: boolean; notiz?: string; entnahme?: boolean } {
  if (a === 'umbuchung' || a === 'verrechnung' || !g) return { umbuchung: true };
  const name = finanzOrtName(g);
  if (a === 'entnahme') return { umbuchung: false, notiz: `Entnahme aus ${name}`, entnahme: centImHaushalt > 0 };
  if (a === 'einlage') return { umbuchung: false, notiz: `Einlage in ${name}` };
  return { umbuchung: false, notiz: centImHaushalt > 0 ? `Von ${name} — Gesellschafterdarlehen oder Ausschüttung, bitte zuordnen` : `An ${name} — Gesellschafterdarlehen, bitte zuordnen` };
}

export const GEGEN_TEXT: Readonly<Record<GegenArt, string>> = {
  umbuchung: 'Umbuchung', entnahme: 'Privatentnahme', einlage: 'Privateinlage', gesellschafter: 'Gesellschafterdarlehen/Ausschüttung — zuordnen', verrechnung: 'Verrechnung zwischen Gesellschaften — zuordnen',
};

// ── Vorschläge für GESPEICHERTE Umbuchungen (per Klick, nie automatisch) ──────────────────────────────────────────────────────────────
export interface UmbuchungVorschlag {
  id: string; datum: string; wer: string; betrag: number; ort: string;
  art: Exclude<GegenArt, 'umbuchung'>; kategorie: string; zuordnen?: Zuordnen; text: string;
  /** Warum: „ohne Gegenbuchung im Business“ (Gegenseite vermutlich Privat) bzw. „Gegenbuchung bei <Gesellschaft>“. */
  grund: string;
}

/**
 * Gespeicherte Umbuchungen einer Gesellschaft, die nach der neuen Regel keine sind:
 *   • Gegenbuchung bei einer ANDEREN Gesellschaft → Verrechnung (zuordnen),
 *   • keine Gegenbuchung im Bestand → die Gegenseite ist vermutlich Privat → Entnahme/Einlage bzw. Gesellschafter (je Rechtsart).
 * Von Hand gesetzte Kategorien bleiben (Hand gewinnt); Gesellschaften im Privat-Bereich bleiben Umbuchung. Die Haushalts-Seite fasst das nicht an.
 */
export function umbuchungVorschlaege(alle: readonly BhBuchung[], info: EinheitenInfo = EINHEITEN_INFO): UmbuchungVorschlag[] {
  const paare = gegenbuchungPaare(alle);
  const nachId = new Map(alle.map(b => [b.id, b]));
  const raus: UmbuchungVorschlag[] = [];
  for (const b of alle) {
    if (b.kategorie !== KAT.umbuchung || b.kategorieHand || !b.ort || !istGesellschaft(b.ort)) continue;
    const partner = paare.get(b.id);
    const dort = partner ? nachId.get(partner)?.ort : undefined;
    let g: ReturnType<typeof gegenArt>, grund: string;
    if (partner) {
      if (!dort || dort === b.ort || !istGesellschaft(dort)) continue;
      g = gegenArt(b.ort as Gesellschaftskennung, dort as Gesellschaftskennung, Math.round(b.betrag * 100), info);
      grund = `Gegenbuchung bei ${finanzOrtName(dort as Gesellschaftskennung)}`;
    } else {
      g = gegenArt(b.ort as Gesellschaftskennung, 'privat', Math.round(b.betrag * 100), info);
      grund = 'ohne Gegenbuchung im Business — Gegenseite vermutlich Privat';
    }
    if (g.art === 'umbuchung') continue;
    const k = businessKategorie(g.art);
    raus.push({ id: b.id, datum: b.datum, wer: b.wer, betrag: b.betrag, ort: b.ort, art: g.art, kategorie: k.kategorie, ...(k.zuordnen ? { zuordnen: k.zuordnen } : {}), text: GEGEN_TEXT[g.art], grund });
  }
  return raus.sort((a, b) => b.datum.localeCompare(a.datum) || a.id.localeCompare(b.id));
}
