// ─── Rechnungen · die Übersicht (rein, client-sicher, 27.10.) ──────────────────
// Kevin 27.10.: „Den ganzen Rechnungsprozess sauber ziehen … der ganze Kreislauf von Angebots- und Rechnungsstellung.“ Vorher zeigte die Karte nur
// Entwürfe und die zwölf zuletzt gestellten; Filter, Suche und Summen gab es nicht. Hier steht EINE Regel für den Zustand einer Rechnung (auch
// „überfällig“, das nie gespeichert wird), die Filter, die Reihenfolge und die Summen — die Karte rechnet nichts davon selbst.

import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { suchPasst } from '@/lib/text/such-norm';

/**
 * Zustand für die Anzeige: `entwurf` (geplant, mit Positionen — aus dem Editor), `geplant` (Planposten ohne Positionen, Altbestand/Liquidität),
 * `offen` (gestellt, noch nicht fällig), `ueberfaellig` (gestellt, Fälligkeit vorbei), `bezahlt`, `storniert`, `storno` (die Stornorechnung selbst).
 */
export type RechnungsZustand = 'entwurf' | 'geplant' | 'offen' | 'ueberfaellig' | 'bezahlt' | 'storniert' | 'storno';

export function rechnungsZustand(r: Pick<Rechnung, 'status' | 'art' | 'positionen' | 'faellig'>, heute: string): RechnungsZustand {
  if (r.art === 'storno') return 'storno';
  if (r.status === 'storniert') return 'storniert';
  if (r.status === 'bezahlt') return 'bezahlt';
  if (r.status === 'gestellt') return r.faellig && r.faellig < heute ? 'ueberfaellig' : 'offen';
  return r.positionen ? 'entwurf' : 'geplant';
}

export const ZUSTAND_NAME: Record<RechnungsZustand, string> = {
  entwurf: 'Entwurf', geplant: 'geplant', offen: 'offen', ueberfaellig: 'überfällig', bezahlt: 'bezahlt', storniert: 'storniert', storno: 'Stornorechnung',
};

/** Die Filter der Übersicht. `offen` schließt `ueberfaellig` ein (beides wartet auf Geld). */
export type RechnungsFilter = 'alle' | 'entwuerfe' | 'offen' | 'ueberfaellig' | 'bezahlt' | 'storniert';
export const RECHNUNGS_FILTER: { id: RechnungsFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' }, { id: 'entwuerfe', label: 'Entwürfe' }, { id: 'offen', label: 'Offen' }, { id: 'ueberfaellig', label: 'Überfällig' },
  { id: 'bezahlt', label: 'Bezahlt' }, { id: 'storniert', label: 'Storniert' },
];

const passtFilter = (z: RechnungsZustand, f: RechnungsFilter) =>
  f === 'alle' ? true
  : f === 'entwuerfe' ? z === 'entwurf' || z === 'geplant'
  : f === 'offen' ? z === 'offen' || z === 'ueberfaellig'
  : f === 'ueberfaellig' ? z === 'ueberfaellig'
  : f === 'bezahlt' ? z === 'bezahlt'
  : z === 'storniert' || z === 'storno';

/** Reihenfolge: Überfälliges zuerst (älteste Fälligkeit oben), dann Entwürfe, offene nach Fälligkeit, Bezahltes (jüngstes oben), Storniertes zuletzt. */
const RANG: Record<RechnungsZustand, number> = { ueberfaellig: 0, entwurf: 1, offen: 2, geplant: 3, bezahlt: 4, storniert: 5, storno: 5 };
function vergleich(heute: string) {
  return (a: Rechnung, b: Rechnung) => {
    const za = rechnungsZustand(a, heute); const zb = rechnungsZustand(b, heute);
    if (RANG[za] !== RANG[zb]) return RANG[za] - RANG[zb];
    if (za === 'ueberfaellig' || za === 'offen' || za === 'geplant') return (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999');
    if (za === 'bezahlt') return (b.bezahltAm ?? b.datum ?? '').localeCompare(a.bezahltAm ?? a.datum ?? '');
    if (za === 'entwurf') return 0; // Reihenfolge im Bestand (umgedreht unten: jüngste zuerst)
    return (b.datum ?? '').localeCompare(a.datum ?? '');
  };
}

/** Filtern + Suche (Kunde, Nummer, Titel, Empfänger) + Gesellschaft, sortiert. */
export function rechnungenFiltern<R extends Rechnung>(liste: readonly R[], o: { filter: RechnungsFilter; suche?: string; gesellschaft?: string | null }, heute: string): R[] {
  const q = (o.suche ?? '').trim();
  const gefiltert = liste.filter(r => passtFilter(rechnungsZustand(r, heute), o.filter)
    && (!o.gesellschaft || r.firmaId === o.gesellschaft)
    && (!q || suchPasst([r.kunde, r.nummer, r.titel, r.empfaenger?.firma, r.empfaenger?.name, r.angebot], q)));
  // Entwürfe: jüngste zuerst (der Bestand ist in Anlage-Reihenfolge) — stabil sortieren über die umgedrehte Liste.
  return [...gefiltert].reverse().sort(vergleich(heute));
}

/** Summen in Cent (brutto): offen (inkl. überfällig), überfällig, bezahlt im laufenden Jahr; Anzahl der Entwürfe. Stornos zählen nie. */
export function rechnungsSummen(liste: readonly Rechnung[], heute: string) {
  const s = { offenCent: 0, offen: 0, ueberfaelligCent: 0, ueberfaellig: 0, bezahltJahrCent: 0, bezahltJahr: 0, entwuerfe: 0 };
  const jahr = heute.slice(0, 4);
  for (const r of liste) {
    const z = rechnungsZustand(r, heute);
    const c = Math.round(r.betrag * 100);
    if (z === 'offen' || z === 'ueberfaellig') { s.offenCent += c; s.offen++; }
    if (z === 'ueberfaellig') { s.ueberfaelligCent += c; s.ueberfaellig++; }
    if (z === 'bezahlt' && (r.bezahltAm ?? r.datum ?? '').startsWith(jahr)) { s.bezahltJahrCent += c; s.bezahltJahr++; }
    if (z === 'entwurf') s.entwuerfe++;
  }
  return s;
}

/** Zeilentitel: Nummer bzw. „Entwurf“ und der Kunde — steht der Kunde schon vorn im Titel (Monatsrechnung eines Mandats), nicht doppelt. */
export function rechnungsZeile(r: Pick<Rechnung, 'kunde' | 'titel' | 'nummer'>): { titel: string; unter: string } {
  const kunde = r.kunde && r.kunde !== 'Kunde' ? r.kunde : '';
  const titel = kunde && r.titel.startsWith(kunde) ? r.titel.slice(kunde.length).replace(/^\s*[·—–-]\s*/, '') : r.titel;
  return { titel: [r.nummer ?? 'Entwurf', kunde || 'ohne Empfänger'].join(' · '), unter: titel };
}
