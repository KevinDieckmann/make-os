// ─── MAKE OS — Planung: Priorität per Pfeil ─────────────────────────────────
// Malin (27.09.): „Priorität per Pfeil ▲▼ rechts an jeder Zeile“ — Ziele,
// Meilensteine, Routinen, Blöcke. Die Reihenfolge ist ein gespeicherter Rang
// (1 = oben). Einträge ohne Rang stehen hinten in Anlage-Reihenfolge; die
// Sortierung ist stabil, ein Verschieben schreibt allen Beteiligten einen
// lückenlosen Rang.

interface MitRang { id: string; rang?: number }

/** Stabil nach Rang sortiert — ohne Rang hinten, in der bisherigen Reihenfolge. */
export function sortiertNachRang<E extends MitRang>(liste: readonly E[]): E[] {
  return liste
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ra = a.e.rang ?? Number.POSITIVE_INFINITY, rb = b.e.rang ?? Number.POSITIVE_INFINITY;
      return ra === rb ? a.i - b.i : ra - rb;
    })
    .map(x => x.e);
}

/** Allen Einträgen einen lückenlosen Rang 1..n in der gegebenen Reihenfolge geben. */
export function mitRang<E extends MitRang>(liste: readonly E[]): E[] {
  return liste.map((e, i) => ({ ...e, rang: i + 1 }));
}

/**
 * Einen Eintrag innerhalb einer Teilmenge um eine Stelle verschieben.
 * `teilmenge` sind die Ids, zwischen denen getauscht wird (z. B. nur die
 * offenen Ziele im aktuellen Filter) — alle anderen behalten ihren Platz.
 * Zurück kommt die ganze Liste mit neuen Rängen; ist nichts zu verschieben
 * (Anfang/Ende/unbekannt), kommt die Liste unverändert zurück.
 */
export function verschiebe<E extends MitRang>(liste: readonly E[], id: string, richtung: 'auf' | 'ab', teilmenge?: readonly string[]): E[] {
  const sortiert = sortiertNachRang(liste);
  const erlaubt = teilmenge ? new Set(teilmenge) : null;
  const sichtbar = sortiert.filter(e => !erlaubt || erlaubt.has(e.id));
  const pos = sichtbar.findIndex(e => e.id === id);
  if (pos < 0) return [...liste];
  const ziel = richtung === 'auf' ? pos - 1 : pos + 1;
  if (ziel < 0 || ziel >= sichtbar.length) return [...liste];
  const a = sichtbar[pos], b = sichtbar[ziel];
  const ia = sortiert.indexOf(a), ib = sortiert.indexOf(b);
  const neu = [...sortiert];
  neu[ia] = b; neu[ib] = a;
  return mitRang(neu);
}

/** Offen und erledigt trennen — beide Teile nach Rang sortiert. */
export function offenErledigt<E extends MitRang & { erledigt?: boolean }>(liste: readonly E[]): { offen: E[]; erledigt: E[] } {
  const s = sortiertNachRang(liste);
  return { offen: s.filter(e => !e.erledigt), erledigt: s.filter(e => !!e.erledigt) };
}

/** Der nächste freie Rang — für Neuanlage ganz unten unter den offenen. */
export const naechsterRang = (liste: readonly MitRang[]): number => liste.reduce((m, e) => Math.max(m, e.rang ?? 0), 0) + 1;
