// ─── Fulfillment · Lieferzeit ab einem Ereignis (26.10.: „die Lieferzeit startet mit dem Formular“) ────────────────────────────
// Ein Schritt des Ablaufs trägt `lieferzeit` (Werktage). Ist er erledigt (eine Entscheidung: mit „ja“), läuft ab diesem Tag die Lieferzeit; das Lieferdatum =
// so viele Werktage (Mo–Fr ohne Feiertage NRW) später. Kommt das Formular später, verschiebt sich das Datum von selbst — nichts wird gespeichert, alles
// wird aus dem Fall abgeleitet (EINE Stelle: `lieferStand`). Mails nennen es über `{{fall.lieferdatum}}`, die Fall-Ansicht zeigt es im Kopf.
// Rein und client-sicher.

import type { Fall, FallKnoten } from '../typen';
import { werktagePlus } from '@/lib/zeit/kalender-kern';

export interface LieferStand {
  /** Der Schritt, an dem die Lieferzeit startet. */
  knotenId: string; titel: string;
  /** Lieferzeit in Werktagen. */
  werktage: number;
  /** Tag, an dem die Lieferzeit startete (YYYY-MM-DD) — fehlt, solange der Schritt offen ist. */
  startAm?: string;
  /** Geplante Lieferung (YYYY-MM-DD) — fehlt, solange die Lieferzeit nicht läuft. */
  bisAm?: string;
}

/** Ist dieser Schritt das Ereignis „Lieferzeit startet“ und schon eingetreten? Eine Entscheidung zählt nur mit „ja“ (bzw. ohne Nein). */
function eingetreten(k: FallKnoten): string | undefined {
  if (k.status !== 'erledigt') return undefined;
  if (k.form === 'entscheidung' && k.antwort === 'nein') return undefined;
  return k.erledigtAm ?? k.antwortAm ?? k.seit;
}

/** Alle Lieferzeiten des Falls (Paket und angehängte Zusatzmodule) in der Reihenfolge der Schritte — ohne Bausteine und ohne entfallene Schritte. */
export function lieferStaende(f: Pick<Fall, 'knoten'>): LieferStand[] {
  return f.knoten
    .filter(k => !k.bausteinId && k.lieferzeit !== undefined && k.lieferzeit > 0 && k.status !== 'entfaellt')
    .map(k => {
      const start = eingetreten(k);
      return { knotenId: k.id, titel: k.titel, werktage: k.lieferzeit!, ...(start ? { startAm: start, bisAm: werktagePlus(start, k.lieferzeit!) } : {}) };
    });
}

/** Die Lieferzeit des Falls — die erste (Paket vor Zusatzmodulen). `null`: der Ablauf kennt keine Lieferzeit. */
export function lieferStand(f: Pick<Fall, 'knoten'>): LieferStand | null {
  return lieferStaende(f)[0] ?? null;
}

/** Werktage von `heute` bis `bis` (0 = heute ist der Tag; negativ = überfällig). */
export function werktageBis(heute: string, bis: string): number {
  let n = 0, d = heute;
  if (heute < bis) while (d < bis && n < 1000) { d = werktagePlus(d, 1); n++; }
  else while (d > bis && n > -1000) { d = werktagePlus(d, -1); n--; }
  return n;
}

/** Ein kurzer Satz für Kopf und Mail-Vorschau: „Lieferung bis 12.11.2026 · noch 7 Werktage“ bzw. „10 Werktage ab „Formular vollständig?““. */
export function lieferSatz(s: LieferStand, heute: string, datum: (tag: string) => string): string {
  if (!s.bisAm) return `Lieferzeit ${s.werktage} Werktage — startet mit „${s.titel}“`;
  const rest = werktageBis(heute, s.bisAm);
  const wann = rest > 0 ? `noch ${rest} ${rest === 1 ? 'Werktag' : 'Werktage'}` : rest === 0 ? 'heute' : `${-rest} ${rest === -1 ? 'Werktag' : 'Werktage'} drüber`;
  return `Lieferung bis ${datum(s.bisAm)} · ${wann}`;
}
