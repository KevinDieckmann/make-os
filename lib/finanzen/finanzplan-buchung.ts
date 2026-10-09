// ─── Finanzplan → Buchungen: Zahlungseingang und Gegenbuchung (nur Server) ───
// Bis 08.10. lagen beide Helfer in app/api/state/finanzplan/route.ts. Seit „Rechnungen schreiben mit PDF“ storniert auch
// lib/finanzen/rechnung/server.ts (Stornorechnung) — EIN Weg für beide, damit Kennungen und Form gleich bleiben:
// Eingang `bu-re-<id>`, Gegenbuchung `bu-st-<id>`, beide idempotent. Aufgerufen in der Sperre des Finanzplans (innen nur `buchungen`).
//
// Eine Zahlung — einmal (09.10., Nahtstellen Finanzen): steht der Zahlungseingang schon aus einem Kontoauszug in den Buchungen (`bu-ka-…`,
// gleiche Gesellschaft, Betrag auf den Cent, ≤ 14 Tage, Rechnungsnummer im Zweck oder Name passt — lib/finanzen/zahlung-abgleich.ts), wird KEIN
// zweiter Eingang angelegt: der Bank-Umsatz bekommt den Bezug `rechnungId` („verknuepft“). Die Gegenbuchung eines Stornos findet den Eingang
// dann über diesen Bezug.

import { updateJson } from '@/lib/store/local-db';
import { buchungsId, stornoBuchungFuer, stornoBuchungsId, type RechnungsBuchung } from './finanzplan-bestand';
import { ausAuszug, type BusinessBuchung } from './kontoauszug/plan';
import { centAus, naechsterUmsatz } from './zahlung-abgleich';

type Gespeichert = RechnungsBuchung | BusinessBuchung;

/** Der Zahlungseingang einer Rechnung: `bu-re-<id>` oder ein Bank-Umsatz mit diesem Bezug (positiv, nicht die Gegenbuchung). */
export function eingangVon<T extends { id: string; betrag: number; rechnungId?: string }>(liste: readonly T[], rechnungId: string): T | undefined {
  return liste.find(x => x.id === buchungsId(rechnungId))
    ?? liste.find(x => x.rechnungId === rechnungId && x.id !== stornoBuchungsId(rechnungId) && Number(x.betrag) > 0);
}

/** Zum Zahlungseingang `bu-re-<id>` die Gegenbuchung `bu-st-<id>` anlegen, wenn es den Eingang gibt und die Gegenbuchung noch nicht. */
export async function gegenbuchungAnlegen(r: Parameters<typeof stornoBuchungFuer>[1], am: string): Promise<'neu' | 'vorhanden' | 'keine'> {
  let ergebnis: 'neu' | 'vorhanden' | 'keine' = 'keine';
  await updateJson<{ buchungen: RechnungsBuchung[] }>('buchungen', cur => {
    const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
    const eingang = eingangVon(liste, r.id);
    if (!eingang) return cur ?? { buchungen: liste };
    if (liste.some(x => x.id === stornoBuchungsId(r.id))) { ergebnis = 'vorhanden'; return cur ?? { buchungen: liste }; }
    ergebnis = 'neu';
    return { ...(cur ?? {}), buchungen: [...liste, stornoBuchungFuer(eingang, r, am)].sort((x, y) => y.datum.localeCompare(x.datum)) };
  });
  return ergebnis;
}

/**
 * Die Buchung zur Rechnung anlegen, wenn es sie noch nicht gibt (Kennung `bu-re-<id>`). Steht derselbe Zahlungseingang schon aus einem
 * Kontoauszug da (noch ohne Bezug), wird er verknüpft statt verdoppelt (`verknuepft`). `nummer` = Rechnungsnummer (für den Verwendungszweck).
 */
export async function buchungAnlegen(b: RechnungsBuchung, opt: { nummer?: string } = {}): Promise<'neu' | 'vorhanden' | 'verknuepft'> {
  let ergebnis: 'neu' | 'vorhanden' | 'verknuepft' = 'vorhanden';
  await updateJson<{ buchungen: Gespeichert[] }>('buchungen', cur => {
    const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
    if (liste.some(x => x.id === b.id) || eingangVon(liste, b.rechnungId)) return cur ?? { buchungen: liste };
    const bank = liste.filter((x): x is BusinessBuchung => ausAuszug(x) && x.ort === b.ort && !x.rechnungId && !(x as BusinessBuchung).beleg);
    const ziel = naechsterUmsatz(
      { datum: b.datum, cent: centAus(b.betrag), name: b.wer, ...(opt.nummer ? { nummer: opt.nummer } : {}) }, bank,
      x => ({ datum: x.datum, cent: centAus(x.betrag), gegenpartei: x.wer, zweck: x.zweck ?? '' }),
    );
    if (ziel) {
      ergebnis = 'verknuepft';
      return { ...(cur ?? {}), buchungen: liste.map(x => (x === ziel ? { ...x, rechnungId: b.rechnungId } : x)) };
    }
    ergebnis = 'neu';
    return { ...(cur ?? {}), buchungen: [...liste, b].sort((x, y) => y.datum.localeCompare(x.datum)) };
  });
  return ergebnis;
}
