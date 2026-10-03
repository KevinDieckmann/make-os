// ─── Aufgaben → Meilenstein → Ziel (rein, client- und server-sicher, 03.10.) ──
// Kevin: „immer der Fokus auf die Ziele“ — wo eine Aufgabe (oder ein Termin mit Aufgabe) auf ein Ziel einzahlt, zeigt die Oberfläche
// es ruhig als Chip in der Ziel-Farbe. Nichts wird gespeichert und kein Feld kommt dazu: der Bezug folgt der Kette, die es schon gibt —
// Aufgabe liegt in der Liste eines Meilensteins (`meilensteinVonAufgabe`), der Meilenstein zeigt auf ein Ziel (`zielVonMeilenstein`).
// Die Farbe ist DIESELBE wie in den Lichtfäden der Planung: je Space nach Rang (dann Titel) fortlaufend durch `FADEN_FARBEN`,
// höchstens `MAX_ZIEL_BUENDEL` Ziele eigene Farben, darüber „ohne“ (Zeit-Cyan).

import { FADEN_FARBEN } from '@/lib/make-one/design';
import { MAX_ZIEL_BUENDEL } from '@/lib/lichtfaeden/dichte';
import { meilensteinListeId, zielVonMeilenstein } from '@/lib/planung/meilenstein-aufgaben';

export interface ZielRoh { id: string; titel: string; space?: 'privat' | 'business'; rang?: number; erledigt?: boolean }
export interface MeilensteinRoh { id: string; titel: string; zielId?: string; abgeleitetVon?: string }
export interface ZielBezug { zielId: string; zielTitel: string; farbe: string; meilensteinId: string; meilensteinTitel: string }

/** Die Farbe je Ziel — wie in `buendelFarben` (lib/lichtfaeden/farben.ts), aber ohne Bündel: nur aus Rang und Space. */
export function zielFarben(ziele: readonly ZielRoh[]): Map<string, string> {
  const aus = new Map<string, string>();
  for (const space of ['privat', 'business'] as const) {
    const reihe = space === 'privat' ? FADEN_FARBEN.privat : FADEN_FARBEN.business;
    const dieses = ziele.filter(z => (z.space === 'privat' ? 'privat' : 'business') === space && !z.erledigt)
      .sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.titel.localeCompare(b.titel, 'de') || a.id.localeCompare(b.id));
    dieses.forEach((z, i) => aus.set(z.id, i < MAX_ZIEL_BUENDEL ? reihe[i % reihe.length] : FADEN_FARBEN.ohne));
  }
  // Erledigte Ziele behalten eine ruhige Farbe, damit ihre Aufgaben nicht „ohne Ziel“ aussehen.
  for (const z of ziele) if (!aus.has(z.id)) aus.set(z.id, FADEN_FARBEN.ohne);
  return aus;
}

/** Liste eines Meilensteins (Kennung) → Ziel-Bezug. Meilensteine ohne (lebendes) Ziel kommen nicht vor. */
export function bezugNachListe(ziele: readonly ZielRoh[], meilensteine: readonly MeilensteinRoh[]): Map<string, ZielBezug> {
  const farben = zielFarben(ziele);
  const nachId = new Map(ziele.map(z => [z.id, z]));
  const aus = new Map<string, ZielBezug>();
  for (const m of meilensteine) {
    const zid = zielVonMeilenstein(m);
    const z = zid ? nachId.get(zid) : undefined;
    if (!z) continue;
    aus.set(meilensteinListeId(m.id), { zielId: z.id, zielTitel: z.titel, farbe: farben.get(z.id) ?? FADEN_FARBEN.ohne, meilensteinId: m.id, meilensteinTitel: m.titel });
  }
  return aus;
}

/** Der Ziel-Bezug einer Aufgabe (über ihre Liste) — null, wenn sie in keiner Meilenstein-Liste liegt oder das Ziel fehlt. */
export function bezugVonAufgabe(t: { listeId?: string } | undefined | null, karte: ReadonlyMap<string, ZielBezug>): ZielBezug | null {
  return (t?.listeId && karte.get(t.listeId)) || null;
}
