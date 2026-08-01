// ─── MAKE OS — Zeit (die EINE Quelle für Datums-Schlüssel) ──────────────────
// Vorher gab es localDay/tagKey/todayISO/localKey in acht Dateien — jede Kopie
// eine Gelegenheit für den UTC-Fehler (toISOString liefert nachts den Vortag).
// Ab jetzt kommt der Tages-Schlüssel nur noch von hier.

/** YYYY-MM-DD in LOKALER Zeit. Bewusst nicht toISOString(): das rechnet UTC. */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Tage-Liste rückwärts/vorwärts, DST-sicher über setDate. */
export function tagePlus(start: string, tage: number): string {
  const d = new Date(`${start}T12:00:00`);
  d.setDate(d.getDate() + tage);
  return localDay(d);
}

/** Alter eines ISO-Zeitstempels in Stunden; null wenn unbrauchbar. */
export function alterStunden(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}
