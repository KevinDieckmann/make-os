// ─── Fulfillment — Mandat fehlt im CRM: erst markieren, dann löschen (Löschfristen 8.1, rein; Gesamtprüfung 18.10. L3 B5) ──────────────────
// Dossiers, Personenkarten und die Kunden-Daten (Antworten, Puls, Unterlagen samt Dateien) eines Mandats, das endgültig weg ist (nicht im CRM, auch nicht
// im Papierkorb), räumt der Löschfristen-Lauf ab. Bis 18.10. geschah das SOFORT — eine unvollständige Mandatsliste (Rücksicherung, Umzug, Lesefehler)
// hätte Dossiers und Kunden-Unterlagen ohne Archiv gelöscht. Jetzt dieselbe Regel wie für die Fälle (lib/fulfillment/prozesse/verwaist.ts, Branch
// fix-runde-1):
//   · ohne ein einziges Mandat im CRM wird nichts angefasst (Bremse);
//   · ein fehlendes Mandat bekommt zuerst die Marke `mandat-fehlt:<mandat>` (Tag) im Vorlagen-Bestand (`marken`, Textkarte — keine neue Form);
//     erst nach `FEHLT_TAGE` ohne Mandat gilt es als weg; EINE Marke je Mandat für alle drei Teile (Dossier, Karten, Kunde);
//   · taucht das Mandat wieder auf (Rückspielen, Papierkorb zurück), fällt die Marke weg — nichts ging verloren;
//   · würden auf einmal mehr als die Hälfte der betroffenen Mandate (und mehr als `MASSEN_AB`) wegfallen, bremst der Lauf und löscht keins.
// Nur Zähler nach außen — keine Namen, keine Kennungen.

import { tagPlus } from '@/lib/kalender/zeit';

export const FEHLT_PREFIX = 'mandat-fehlt:';
export const markeMandatFehlt = (mandatId: string): string => `${FEHLT_PREFIX}${mandatId}`;
/** So lange bleibt alles eines fehlenden Mandats liegen, bevor der Lauf es entfernt. */
export const FEHLT_TAGE = 30;
/** Ab so vielen Mandaten auf einmal (und mehr als der Hälfte) bremst der Lauf. */
export const MASSEN_AB = 3;

export interface FehltPlan {
  /** Mandate, deren Daten heute entfernt werden dürfen. */
  weg: Set<string>;
  /** Neue Marken (Schlüssel → Tag). */
  neu: Record<string, string>;
  /** Marken, die wegfallen (Mandat wieder da). */
  aus: string[];
  gebremst: 'keine-mandate' | 'zu-viele' | null;
}

/**
 * `betroffen` = Mandate, auf die die Daten zeigen; `bekannt` = Mandate im CRM (auch Papierkorb); `marken` = Marken des Vorlagen-Bestands. Rein.
 */
export function fehlendeMandatePlanen(e: { betroffen: ReadonlySet<string>; bekannt: ReadonlySet<string>; marken: Readonly<Record<string, string>>; heute: string }): FehltPlan {
  const aus = Object.keys(e.marken).filter(k => k.startsWith(FEHLT_PREFIX) && e.bekannt.has(k.slice(FEHLT_PREFIX.length)));
  if (e.betroffen.size && !e.bekannt.size) return { weg: new Set(), neu: {}, aus: [], gebremst: 'keine-mandate' };
  const neu: Record<string, string> = {};
  const faellig: string[] = [];
  for (const id of Array.from(e.betroffen)) {
    if (e.bekannt.has(id)) continue;
    const seit = e.marken[markeMandatFehlt(id)];
    if (!seit) { neu[markeMandatFehlt(id)] = e.heute; continue; }
    if (tagPlus(seit.slice(0, 10), FEHLT_TAGE) <= e.heute) faellig.push(id);
  }
  if (faellig.length > MASSEN_AB && faellig.length * 2 > e.betroffen.size) return { weg: new Set(), neu, aus, gebremst: 'zu-viele' };
  return { weg: new Set(faellig), neu, aus, gebremst: null };
}

/** Marken ohne Bezug mehr (kein Bestand nennt das Mandat) — beim Aufräumen nach dem Lauf. Rein. */
export function markenOhneBezug(marken: Readonly<Record<string, string>>, genannt: ReadonlySet<string>): string[] {
  return Object.keys(marken).filter(k => k.startsWith(FEHLT_PREFIX) && !genannt.has(k.slice(FEHLT_PREFIX.length)));
}
