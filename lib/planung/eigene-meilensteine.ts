// ─── MAKE OS — Eigene Meilensteine an eigenen Zielen (10.10., Kevin: „Ja, eigene Meilensteine“) — rein ─────────────────────────────
// Bis zum 10.10. trugen eigene Ziele (`ziele-eigen--<person>`) keine Meilensteine — die hingen nur am gemeinsamen Bestand `meilensteine`
// (Regel seit 07.10.). Jetzt hat jede Person ihre eigenen Meilensteine an ihren eigenen Zielen:
//   · Bestand je Person `meilensteine-eigen--<person>` — IMMER mit Suffix (neuer Bestand ohne Altbestand, auch das Erstkonto), getrennt vom
//     gemeinsamen `meilensteine`. Immer Privat: kein Space-Feld, keine Einheit, kein Mandat, kein Aufwand, keine Kette, keine Kaskade, keine
//     Aufgaben-Liste (`lm-…`) — bewusst offen für einen späteren Schritt.
//   · Jeder eigene Meilenstein hängt an GENAU einem eigenen Ziel derselben Person (`zielId`, Pflicht). Der Schreibweg prüft nur einen NEU
//     gesetzten Bezug (`eigenerZielBezugPruefen`): Ziel vorhanden, nicht im Business.
//   · Sichtbar nur für die Person selbst; die andere Person sieht einen Meilenstein nur, wenn das zugehörige eigene Ziel geteilt ist
//     (`geteilt`) — gefiltert auf dem SERVER an EINER Stelle (lib/planung/eigene-ziele-sicht.ts `eigeneMeilensteineSicht` /
//     `eigeneMeilensteineFuerBetrachter`).
//   · Fortschritt eines eigenen Ziels: hat es (nicht archivierte) Meilensteine, gilt ihr Mittelwert (erledigt = 100), sonst der Wert von Hand
//     — `eigenesZielFortschritt` (eine reine Funktion; der Server schreibt ihn wie `zieleNachziehen` in den Ziel-Bestand der Person).
// Wird ein eigenes Ziel gelöscht, bleiben seine Meilensteine im Bestand stehen (ohne sichtbares Ziel) — „Rückgängig“ legt das Ziel mit
// derselben Kennung wieder an, dann sind sie wieder da. Konto löschen entfernt den ganzen Bestand (PERSON_BESTAENDE).
// Client-safe, keine Server-Importe.

import { sauberMeilenstein } from './meilensteine';
import { wirksamerSpace } from './bereich';
import { BEREICH_GETRENNT, ZIEL_FEHLT } from './bezuege';
import { ZIEL_HORIZONTE, type Meilenstein, type Ziel, type ZieleDatei } from './typen';

/** Grundname des Bestands — der Bestand heißt IMMER `meilensteine-eigen--<speicher>` (lib/datenschutz/konto-daten.ts `nurMitSuffix`). */
export const EIGENE_MS_BASIS = 'meilensteine-eigen';
/** Name des Bestands einer Person (immer mit Suffix — `meilensteine-eigen` allein gibt es nicht). */
export const eigeneMeilensteineName = (person: string) => `meilensteine-eigen--${person.replace(/[^a-z0-9-]/g, '')}`;

/** Höchstzahl eigener Meilensteine je Person — darüber wird abgelehnt (413), nie gekürzt. */
export const EIGENE_MS_GRENZE = 500;
/** Höchstzahl Änderungen je Aufruf. */
export const EIGENE_MS_OPS_MAX = 160;

/** Ein eigener Meilenstein: die Felder des gemeinsamen Meilensteins, die im Privat-Bereich Sinn ergeben — plus das Pflicht-Ziel. */
export type EigenerMeilenstein = Pick<Meilenstein, 'id' | 'titel' | 'fortschritt' | 'erledigt' | 'erledigtAm' | 'faellig' | 'messlatte' | 'rang' | 'archiviertAm'> & {
  /** Das eigene Ziel (gleiche Person), auf das der Meilenstein einzahlt — Pflicht. */
  zielId: string;
};
export interface EigeneMeilensteineDatei { meilensteine: EigenerMeilenstein[] }

const KENNUNG = /^[A-Za-z0-9_~:.-]{1,80}$/;

/** Ablehnung, wenn ein Eintrag nicht taugt (Route → 400, nie still verworfen). */
export const EIGENER_MS_UNGUELTIG = 'Abgelehnt: ein Meilenstein braucht eine gültige Kennung, einen Titel und ein eigenes Ziel. Nichts gespeichert.';

/**
 * Einen eigenen Meilenstein säubern — über die Regeln des gemeinsamen Bestands (`sauberMeilenstein`, lib/planung/meilensteine.ts), dann
 * nur die Felder, die es hier gibt. Ohne gültige Kennung, Titel oder Ziel: null.
 */
export function sauberEigenerMeilenstein(roh: unknown): EigenerMeilenstein | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  if (typeof r.id !== 'string' || !KENNUNG.test(r.id)) return null;
  // Privat, ohne Einheit/Mandat/Aufwand/Kette/Kaskade — was der gemeinsame Bestand darüber hinaus kennt, fällt hier weg.
  const m = sauberMeilenstein({ id: r.id, titel: r.titel, space: 'privat', faellig: r.faellig, messlatte: r.messlatte, fortschritt: r.fortschritt, erledigt: r.erledigt, erledigtAm: r.erledigtAm, rang: r.rang, zielId: r.zielId, archiviertAm: r.archiviertAm });
  if (!m || !m.zielId) return null;
  return {
    id: m.id, titel: m.titel, zielId: m.zielId, fortschritt: m.fortschritt, erledigt: m.erledigt,
    ...(m.erledigtAm ? { erledigtAm: m.erledigtAm } : {}),
    ...(m.faellig ? { faellig: m.faellig } : {}),
    ...(m.messlatte ? { messlatte: m.messlatte } : {}),
    ...(m.rang ? { rang: m.rang } : {}),
    ...(m.archiviertAm ? { archiviertAm: m.archiviertAm } : {}),
  };
}

/** Alle eigenen Ziele einer Datei (alle Horizonte), nach Kennung. */
export function eigeneZieleNachId(d: Partial<ZieleDatei> | null | undefined): Map<string, Ziel> {
  const aus = new Map<string, Ziel>();
  for (const h of ZIEL_HORIZONTE) for (const z of Array.isArray(d?.[h]) ? d![h]! : []) if (z && typeof z.id === 'string') aus.set(z.id, z);
  return aus;
}

/**
 * Darf ein eigener Meilenstein auf dieses Ziel zeigen? Nur auf ein eigenes Ziel derselben Person (`ziele` = deren Bestand) — und nie auf ein
 * Ziel im Business (Firma und Privat getrennt, auch in den Daten). Null = in Ordnung.
 */
export function eigenerZielBezugPruefen(zielId: string, ziele: ReadonlyMap<string, Pick<Ziel, 'space' | 'einheit'>>): string | null {
  const z = ziele.get(zielId);
  if (!z) return ZIEL_FEHLT;
  return wirksamerSpace(z) === 'business' ? BEREICH_GETRENNT : null;
}

/** Die Meilensteine eines eigenen Ziels, die zählen (ohne archivierte). */
export const meilensteineDesZiels = <M extends Pick<EigenerMeilenstein, 'zielId' | 'archiviertAm'>>(zielId: string, ms: readonly M[]): M[] =>
  ms.filter(m => m.zielId === zielId && !m.archiviertAm);

/**
 * DIE Fortschritts-Regel eines eigenen Ziels (rein): erledigt = 100; hat es Meilensteine (ohne archivierte), gilt ihr Mittelwert (erledigt = 100,
 * gerundet); sonst der Wert von Hand.
 */
export function eigenesZielFortschritt(z: Pick<Ziel, 'id' | 'fortschritt' | 'erledigt'>, ms: readonly Pick<EigenerMeilenstein, 'zielId' | 'archiviertAm' | 'fortschritt' | 'erledigt'>[]): number {
  if (z.erledigt) return 100;
  const l = meilensteineDesZiels(z.id, ms);
  if (!l.length) return z.fortschritt;
  return Math.round(l.reduce((s, m) => s + (m.erledigt ? 100 : m.fortschritt), 0) / l.length);
}

/**
 * Den gespeicherten Fortschritt aller offenen eigenen Ziele nachziehen (rein, alle Horizonte) — geändert nur, wo die Regel einen anderen Wert
 * ergibt. Erledigte Ziele bleiben, wie sie sind; Ziele ohne Meilensteine behalten den Wert von Hand.
 */
export function eigeneZieleFortschrittAnwenden<D extends Partial<ZieleDatei>>(d: D, ms: readonly EigenerMeilenstein[]): { datei: D; geaendert: number } {
  let geaendert = 0;
  const aus = { ...d };
  for (const h of ZIEL_HORIZONTE) {
    const l = d[h];
    if (!Array.isArray(l)) continue;
    aus[h] = l.map(z => {
      if (!z || z.erledigt) return z;
      const v = eigenesZielFortschritt(z, ms);
      if (v === z.fortschritt) return z;
      geaendert++;
      return { ...z, fortschritt: v };
    }) as D[typeof h];
  }
  return { datei: geaendert ? aus : d, geaendert };
}
