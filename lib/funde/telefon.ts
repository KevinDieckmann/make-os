// ─── Funde — Telefonnummern: Handy vor Festnetz (31.10.2026, Kevin: „am besten Handynummern … vom Scoring besser als die anderen“) ───────
// Rein. Nur Nummern, die der Betrieb SELBST veröffentlicht (OSM, eigene Website, Impressum) — nie private Nummern aus anderen Quellen.
// Form überall `normTelefon` (lib/make-one/crm.ts, „+49…“). Deutsche Mobilnetze: +49 15x, 16x, 17x.

import { normTelefon } from '@/lib/make-one/crm';
import type { Fund } from './typen';

export type TelefonArt = 'mobil' | 'festnetz' | 'ausland';
export interface Nummer { nummer: string; art: TelefonArt }

/** Art einer (normierten) Nummer. */
export function telefonArt(n: string): TelefonArt {
  if (!n.startsWith('+49')) return 'ausland';
  return /^\+491[567]\d/.test(n) ? 'mobil' : 'festnetz';
}

/** Alle Nummern aus Rohangaben („030 123; 0171 456“, „+49 …/ …“) — normiert, doppelte einmal, Handy zuerst. */
export function nummernAus(...roh: (string | undefined | null)[]): Nummer[] {
  const aus: Nummer[] = [];
  for (const r of roh) for (const teil of String(r ?? '').split(/;|,|\s\/\s|\soder\s|\sund\s|\|/i)) {
    const n = normTelefon(teil);
    if (n && n.length >= 9 && n.length <= 16 && !aus.some(x => x.nummer === n)) aus.push({ nummer: n, art: telefonArt(n) });
  }
  return aus.sort((a, b) => (a.art === 'mobil' ? 0 : 1) - (b.art === 'mobil' ? 0 : 1));
}

/** Für den Fund: Handy (falls veröffentlicht) und eine Festnetz-/sonstige Nummer. */
export function telefonFelder(...roh: (string | undefined | null)[]): Pick<Fund, 'mobil' | 'telefon'> {
  const l = nummernAus(...roh);
  const m = l.find(x => x.art === 'mobil'), f = l.find(x => x.art !== 'mobil');
  return { ...(m ? { mobil: m.nummer } : {}), ...(f ? { telefon: f.nummer } : {}) };
}

/**
 * Erreichbarkeit 0–100 für die Reihenfolge (wer zuerst angerufen wird): Handy 100 · Festnetz 60 · nur Mail 25 · nichts 0.
 * Getrennt vom Website-Bedarf (`bewertung.punkte`) — beide stehen am Fund, sortiert wird erst nach Erreichbarkeit, dann nach Bedarf.
 */
export function erreichbarkeit(f: Pick<Fund, 'mobil' | 'telefon' | 'email'>): number {
  return f.mobil ? 100 : f.telefon ? 60 : f.email ? 25 : 0;
}

/** Reihenfolge der Liste: Erreichbarkeit, dann Website-Bedarf, dann jüngste zuerst. */
export function fundReihenfolge<F extends Pick<Fund, 'mobil' | 'telefon' | 'email' | 'bewertung' | 'angelegt'>>(a: F, b: F): number {
  return erreichbarkeit(b) - erreichbarkeit(a) || (b.bewertung?.punkte ?? 0) - (a.bewertung?.punkte ?? 0) || b.angelegt.localeCompare(a.angelegt);
}
