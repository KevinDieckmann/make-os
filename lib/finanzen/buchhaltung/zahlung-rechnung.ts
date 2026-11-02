// ─── Buchhaltung — Abgleich Zahlungseingang ↔ offene Rechnung (02.11., rein: Server UND Browser) ───────────────────────────────────────
// Kevin 02.11.: Eingänge ohne Rechnung sollen ihre Rechnung finden — als VORSCHLAG, nie automatisch. Erst der Klick „bezahlt“ vermerkt die Rechnung
// über den EINEN Weg (`/api/rechnung` `aktion: 'bezahlt'` mit `buchungId` → lib/finanzen/rechnung/bezahlt-server.ts), der diese Buchung verknüpft.
// Ein Vorschlag braucht beides:
//   • Betrag: auf ±0,5 % gleich („genau“ bei 0 Cent Abweichung, sonst „nahe“ — Bankgebühren, Rundung) ODER kleiner als die Rechnung (Teilbetrag),
//   • Bezug: die Rechnungsnummer steht im Verwendungszweck ODER der Name der Gegenseite passt zum Kunden (lib/finanzen/zahlung-abgleich.ts).
// Dieselbe Gesellschaft, der Eingang liegt nicht vor dem Rechnungsdatum (sonst lehnt „bezahlt“ ab). Je Buchung höchstens drei Vorschläge.

import { namenPassen, nummerImText } from '@/lib/finanzen/zahlung-abgleich';
import type { BhBuchung } from './arbeitsliste';

/** Die Felder einer Rechnung, die der Abgleich braucht (wie `/api/rechnung` sie liefert). */
export interface RechnungFuerAbgleich { id: string; firmaId: string; kunde?: string; nummer?: string; betrag: number; status: string; datum?: string; positionen?: unknown }

export type ZahlungArt = 'genau' | 'nahe' | 'teil';
export const ZAHLUNG_ART_TEXT: Readonly<Record<ZahlungArt, string>> = { genau: 'Betrag gleich', nahe: 'Betrag fast gleich (±0,5 %)', teil: 'Teilbetrag' };

export interface ZahlungVorschlag {
  buchungId: string; rechnungId: string; nummer?: string; kunde?: string;
  buchungCent: number; rechnungCent: number; art: ZahlungArt;
  /** Woran erkannt: „Nummer im Zweck“ bzw. „Name passt“. */
  grund: string;
}

/** Höchstens so viele Vorschläge je Buchung. */
export const VORSCHLAEGE_JE_BUCHUNG = 3;
/** Toleranz „fast gleich“: 0,5 % des Rechnungsbetrags. */
export const NAHE_ANTEIL = 0.005;

const cent = (euro: number) => Math.round(Number(euro) * 100);

/** Offen = gestellt (oder überfällig/gemahnt) — nicht bezahlt, nicht storniert, kein Entwurf aus dem Editor, kein Storno-Beleg. */
export function rechnungOffen(r: RechnungFuerAbgleich): boolean {
  if (r.status === 'bezahlt' || r.status === 'storniert') return false;
  if (r.status === 'geplant' && r.positionen) return false;
  return cent(r.betrag) > 0;
}

/** Wie gut passt der Betrag? null = gar nicht (mehr als 0,5 % darüber). */
export function betragArt(buchungCent: number, rechnungCent: number): ZahlungArt | null {
  if (buchungCent <= 0 || rechnungCent <= 0) return null;
  const diff = Math.abs(buchungCent - rechnungCent);
  if (diff === 0) return 'genau';
  if (diff <= Math.round(rechnungCent * NAHE_ANTEIL)) return 'nahe';
  return buchungCent < rechnungCent ? 'teil' : null;
}

const RANG: Record<ZahlungArt, number> = { genau: 0, nahe: 1, teil: 2 };

/** Die Vorschläge: Eingänge ohne Rechnung × offene Rechnungen derselben Gesellschaft. Beste zuerst (Nummer vor Name, genau vor nahe vor Teil). */
export function zahlungVorschlaege(buchungen: readonly BhBuchung[], rechnungen: readonly RechnungFuerAbgleich[]): ZahlungVorschlag[] {
  const offen = rechnungen.filter(rechnungOffen);
  if (!offen.length) return [];
  const raus: (ZahlungVorschlag & { rang: number })[] = [];
  for (const b of buchungen) {
    const bc = cent(b.betrag);
    if (bc <= 0 || b.rechnungId || !b.ort) continue;
    const je: (ZahlungVorschlag & { rang: number })[] = [];
    for (const r of offen) {
      if (r.firmaId !== b.ort) continue;
      if (r.datum && b.datum < r.datum) continue;
      const art = betragArt(bc, cent(r.betrag));
      if (!art) continue;
      const nummer = !!r.nummer && nummerImText(r.nummer, `${b.zweck ?? ''} ${b.wer}`);
      const name = !nummer && !!r.kunde && (namenPassen(b.wer, r.kunde) || namenPassen(b.zweck ?? '', r.kunde));
      if (!nummer && !name) continue;
      je.push({
        buchungId: b.id, rechnungId: r.id, ...(r.nummer ? { nummer: r.nummer } : {}), ...(r.kunde ? { kunde: r.kunde } : {}),
        buchungCent: bc, rechnungCent: cent(r.betrag), art, grund: nummer ? 'Nummer im Zweck' : 'Name passt',
        rang: (nummer ? 0 : 10) + RANG[art],
      });
    }
    je.sort((x, y) => x.rang - y.rang || x.rechnungId.localeCompare(y.rechnungId));
    raus.push(...je.slice(0, VORSCHLAEGE_JE_BUCHUNG));
  }
  return raus.map(({ rang: _r, ...v }) => v);
}
