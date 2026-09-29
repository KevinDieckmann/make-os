// ─── Verbindungsprüfung: Familie — Wichtige Tage ohne Menschen (rein, getestet, F2 N4, 29.09.) ───────────
// Ein „Wichtiger Tag“ der Art Geburtstag verweist seit K2 nur auf den Menschen (`menschId`, OHNE eigenes Datum — der Mensch
// führt, lib/familie/logik.ts `tagDatum`). Wird der Mensch gelöscht, bleibt der Tag als leere Hülle zurück: kein Datum,
// keine Erinnerung, aber in „Wichtige Tage“ gezählt. Eingehängt in lib/crm/verbindungen.ts (Prüfen/Reparieren) und
// app/api/crm/verbindungen (Schreiben in `familie--<haushalt>` des Inhabers).
//   familie-tag-mensch-tot   Wichtiger Tag verweist auf einen Menschen, den es nicht mehr gibt. „Eintrag entfernen“ nimmt
//                            Tage ohne eigenes Datum weg; trägt ein alter Tag noch ein Datum, fällt nur der Verweis.
// Beispiele sind Kennungen der Tage — nie Titel oder Namen.

/** Was die Prüfung aus der Familie braucht — nur Kennungen und ob ein eigenes Datum da ist. */
export interface FamilieTageStand {
  menschen: string[];
  tage: { id: string; menschId?: string; mitDatum: boolean }[];
}

const e = (n: number, ein: string, mehr: string) => (n === 1 ? ein : mehr);

export const PRUEFUNGEN_FAMILIE = {
  'familie-tag-mensch-tot': { schwere: 'hinweis', bereich: 'planung', reparierbar: true, art: 'kennung', knopf: 'Eintrag entfernen', text: (n: number) => `${n} ${e(n, 'Wichtiger Tag verweist', 'Wichtige Tage verweisen')} auf einen Menschen der Familie, den es nicht mehr gibt — „Eintrag entfernen“ räumt ${e(n, 'ihn', 'sie')} ab (ein Tag mit eigenem Datum verliert nur den Verweis).` },
} as const;
export type FamiliePruefungId = keyof typeof PRUEFUNGEN_FAMILIE;

/** Kennungen der Tage mit totem Menschen-Verweis. */
export function familieTageTot(f: FamilieTageStand | null | undefined): string[] {
  if (!f) return [];
  const da = new Set(f.menschen);
  return f.tage.filter(t => !!t.menschId && !da.has(t.menschId)).map(t => t.id);
}

export function familiePruefen(f: FamilieTageStand | null | undefined, melde: (id: FamiliePruefungId, kennung: string) => void): void {
  for (const id of familieTageTot(f)) melde('familie-tag-mensch-tot', id);
}

/**
 * Den gespeicherten Familien-Bestand bereinigen (rein, für die Route in der Schreibsperre): Tage mit totem Verweis ohne
 * eigenes Datum fallen weg, mit Datum verlieren sie nur `menschId`. Alles andere bleibt, wie es ist.
 */
export function familieTageBereinigen<F extends { menschen?: { id: string }[]; tage?: { id: string; menschId?: string; datum?: string }[] }>(datei: F): { datei: F; n: number } {
  const da = new Set((datei.menschen ?? []).map(m => m.id));
  let n = 0;
  const tage = (datei.tage ?? []).flatMap(t => {
    if (!t.menschId || da.has(t.menschId)) return [t];
    n++;
    if (!t.datum) return [];
    const { menschId: _m, ...rest } = t;
    return [rest as typeof t];
  });
  return n ? { datei: { ...datei, tage }, n } : { datei, n: 0 };
}

/** Vorschau/Bestand nach der Reparatur (rein): Stand ohne die toten Verweise. */
export function familieReparieren(f: FamilieTageStand | null | undefined, will: ReadonlySet<string>): { familie: FamilieTageStand | null | undefined; aenderungen: { befundId: FamiliePruefungId; speicher: 'familie'; anzahl: number; text: string }[] } {
  if (!f || !will.has('familie-tag-mensch-tot')) return { familie: f, aenderungen: [] };
  const tot = new Set(familieTageTot(f));
  if (!tot.size) return { familie: f, aenderungen: [] };
  const tage = f.tage.flatMap(t => (!tot.has(t.id) ? [t] : t.mitDatum ? [{ id: t.id, mitDatum: true }] : []));
  return { familie: { ...f, tage }, aenderungen: [{ befundId: 'familie-tag-mensch-tot', speicher: 'familie', anzahl: tot.size, text: `${tot.size} ${e(tot.size, 'Wichtiger Tag', 'Wichtige Tage')} ohne Menschen bereinigt` }] };
}
