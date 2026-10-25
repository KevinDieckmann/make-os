// ─── Kundennummer an der Firma (rein, client-sicher, 25.10., kleine Bauten) ─────────────────────────────────────────────────────────
// Kevin 25.10. (Übernahme der echten Produkte): Angebote und Rechnungen tragen eine Kundennummer. EINE Stelle vergibt sie:
//   · Format je Instanz (`CrmBestand.kundennummern.format`, Stammdaten), Vorgabe `K-{NR4}` — {NR}/{NR3}–{NR6} Pflicht, {JAHR}/{JJ} erlaubt, kein {KURZ}.
//   · vergeben beim ersten Angebot (gestellt) bzw. beim ersten Mandat der Firma — nie für einen Entwurf, nie für eine Firma ohne Auftrag.
//   · fortlaufend über ALLE Firmen und nie doppelt: Zähler `zuletzt` (Höchstwert, auch wenn eine Firma später gelöscht wird) und jede schon vergebene
//     Nummer (auch von Hand eingetragen) ist belegt.
// Vergeben wird NUR hier (`kundennummernNachziehen` in crmSchreiben — jeder CRM-Schreibweg): Auslöser sind ein neues Mandat, ein Angebot, das seine Nummer
// reserviert (Stellen), bzw. eines, das kein Entwurf mehr ist. Altbestand bekommt die Nummer mit seinem nächsten Auftrag — nie still bei irgendeiner Änderung.
// Eine einmal vergebene Nummer bleibt an der Firma (auch bei Formatwechsel); `Firma.kundennummer` ist optional — der alte Stand verwirft das Feld beim
// nächsten Speichern der Firma, die PDFs behalten die gedruckte Nummer.

import type { CrmBestand, Firma } from './typen';
import { nummerAusFormat, nummernformatOk } from './angebote';

export const KUNDENNUMMER_VORGABE = 'K-{NR4}';
/** Ein Format für Kundennummern: wie beim Angebot (genau eine laufende Nummer, erlaubte Zeichen), ohne {KURZ}. */
export const kundennummerFormatOk = (f: string): boolean => nummernformatOk(f) && !/\{KURZ\}/.test(f);
export const kundennummerFormat = (b: Pick<CrmBestand, 'kundennummern'>): string => {
  const f = b.kundennummern?.format;
  return f && kundennummerFormatOk(f) ? f : KUNDENNUMMER_VORGABE;
};
/** Gültige Form einer Kundennummer (auch von Hand): Buchstaben, Ziffern und - _ . / (1–40). */
export const kundennummerOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,39}$/.test(v);

/** Die Firma braucht eine Nummer: sie hat ein Mandat (nicht im Papierkorb) oder ein Angebot, das kein Entwurf mehr ist. */
export function braucht(b: Pick<CrmBestand, 'mandate' | 'angebote'>, firmaId: string): boolean {
  return b.mandate.some(m => m.firmaId === firmaId && !m.geloeschtAm) || (b.angebote ?? []).some(a => a.firmaId === firmaId && a.status !== 'entwurf');
}

/**
 * Der Firma `firmaId` eine Kundennummer geben (rein) — hat sie schon eine bzw. gibt es sie nicht: derselbe Bestand (Objekt-gleich). Sonst die nächste
 * freie Nummer im Format der Instanz, Zähler `kundennummern.zuletzt` hochgezählt. `jahr` nur für {JAHR}/{JJ}.
 */
export function kundennummerVergeben(b: CrmBestand, firmaId: string, jahr: number): CrmBestand {
  const f = b.firmen.find(x => x.id === firmaId);
  if (!f || f.kundennummer) return b;
  const format = kundennummerFormat(b);
  const belegt = new Set(b.firmen.map(x => x.kundennummer).filter(Boolean));
  let nr = (b.kundennummern?.zuletzt ?? 0) + 1;
  let nummer = nummerAusFormat(format, '', jahr, nr);
  while (belegt.has(nummer)) { nr++; nummer = nummerAusFormat(format, '', jahr, nr); }
  return {
    ...b, firmen: b.firmen.map(x => (x.id === firmaId ? { ...x, kundennummer: nummer } as Firma : x)),
    kundennummern: { ...(b.kundennummern ?? {}), zuletzt: nr },
  };
}

/**
 * Nach einer Änderung (crmSchreiben, EINE Stelle für jeden Schreibweg): Firmen, die IN dieser Änderung ihr erstes Mandat bzw. ihr erstes gestelltes Angebot
 * bekamen und noch keine Nummer haben, bekommen eine. Altbestand (Mandat schon vorher da) bekommt sie erst mit dem nächsten Auftrag oder per Knopf — nie still
 * bei irgendeiner Änderung. Ohne Auslöser: derselbe Bestand (Objekt-gleich).
 */
export function kundennummernNachziehen(vorher: CrmBestand, nachher: CrmBestand, jahr: number): CrmBestand {
  // Eine vergebene Nummer ist fest: kein Schreibweg (Browser, Import, Zusammenführen) ändert oder leert sie — sie kommt aus dem Stand davor zurück; eine
  // Nummer, die nicht von hier stammt (von Hand, aus einem Import), fällt weg (sonst gäbe es Doppelte am Zähler vorbei).
  const fest = new Map(vorher.firmen.filter(f => f.kundennummer).map(f => [f.id, f.kundennummer!]));
  const soll = (f: Firma): string | undefined => fest.get(f.id);
  let b = nachher.firmen.some(f => f.kundennummer !== soll(f))
    ? { ...nachher, firmen: nachher.firmen.map(f => { if (f.kundennummer === soll(f)) return f; const { kundennummer: _k, ...ohne } = f; return soll(f) ? { ...ohne, kundennummer: soll(f)! } : ohne as Firma; }) }
    : nachher;
  // Der Zähler fällt nie (nie doppelt, auch nach einer Löschung) — das Format setzt nur die Stammdaten-Route, jede andere Änderung trägt es weiter.
  const zuletzt = Math.max(vorher.kundennummern?.zuletzt ?? 0, b.kundennummern?.zuletzt ?? 0);
  if (zuletzt && zuletzt !== b.kundennummern?.zuletzt) b = { ...b, kundennummern: { ...(b.kundennummern ?? {}), zuletzt } };
  const neu = new Set<string>();
  const altMandate = new Set(vorher.mandate.filter(m => !m.geloeschtAm).map(m => m.id));
  for (const m of nachher.mandate) if (m.firmaId && !m.geloeschtAm && !altMandate.has(m.id)) neu.add(m.firmaId);
  const altAngebot = new Map((vorher.angebote ?? []).map(a => [a.id, a.status]));
  for (const a of nachher.angebote ?? []) if (a.firmaId && a.status !== 'entwurf' && (altAngebot.get(a.id) ?? 'entwurf') === 'entwurf') neu.add(a.firmaId);
  // Beim Stellen reserviert das Angebot zuerst seine Nummer (`lauf`) — schon dann bekommt die Firma ihre Kundennummer, damit sie im PDF steht.
  const altLauf = new Set((vorher.angebote ?? []).filter(a => a.lauf).map(a => a.id));
  for (const a of nachher.angebote ?? []) if (a.firmaId && a.lauf && !altLauf.has(a.id)) neu.add(a.firmaId);
  for (const id of Array.from(neu).sort()) b = kundennummerVergeben(b, id, jahr);
  return b;
}
