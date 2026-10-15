// ─── Fulfillment · Termine des Kunden — was im Kalender mit Bezug zum Mandat steht (rein, client-sicher; 15.10., Abnahme B3) ────────────────────
// Die Abnahme fand: „Cockpit-Abstimmung Lumen“ steht jeden Donnerstag im Kalender und auf Heute — der Fall sagte „Kein Termin im Kalender“, „Kick-off
// noch nicht terminiert“, die Kunden-Seite „Die festen Termine stimmen wir gemeinsam ab“. Bis dahin kannte der Fall nur Termine, die über „Termin anlegen“
// an einem Ritual hingen (`Fall.rituale[].terminUids`). Jetzt zählt JEDER Termin mit Bezug zum Mandat (bzw. ohne Mandat zur Firma des Mandats) aus
// `kalender-bezug` — gelesen nur über lib/fulfillment/prozesse/termine-server.ts `fallTermine`, gerechnet nur hier:
//   · `zuordnen`        welcher Termin zu welchem Ritual gehört (über die gemerkten Kennungen) — der Rest sind „weitere Termine mit dem Kunden“
//   · `ersterTermin`    der erste Termin ab dem Start des Falls — er macht „Kick-off terminiert“ (Onboarding) wahr, auch ohne Ritual
// „Der nächste Termin“ bleibt EINE Regel: lib/fulfillment/prozesse/rituale.ts `naechsterFallTermin` (liest diese Termine). Nie ein erfundener Termin.

/** Ein Termin des Kunden: Kennung (UID), Berliner Tag, Uhrzeit (HH:MM) und Titel (privat → ohne Titel). */
export interface FallTermin { uid: string; tag: string; von?: string; titel?: string }
/** Ein Termin mit seinem Ritual (falls er an einem hängt). */
export interface FallTerminMitRitual extends FallTermin { ritualId?: string }

type Bezug = { mandatId?: string; firmaId?: string };

/** Gehört ein Bezug zu diesem Mandat? Mandat direkt, oder — ohne Mandat am Termin — die Firma des Mandats. */
export function bezugGehoertZu(b: Bezug | undefined | null, m: { id: string; firmaId?: string | null }): boolean {
  if (!b) return false;
  if (b.mandatId) return b.mandatId === m.id;
  return !!m.firmaId && b.firmaId === m.firmaId;
}

/** Die Termine je Ritual des Falls zuordnen (gemerkte Kennungen) — ohne Ritual bleibt `ritualId` leer. Nach Tag und Uhrzeit sortiert, ohne Doppelte. */
export function zuordnen(termine: readonly FallTermin[], fallRituale: readonly { ritualId: string; terminUids: readonly string[] }[]): FallTerminMitRitual[] {
  const ritual = new Map<string, string>();
  for (const r of fallRituale) for (const u of r.terminUids) if (!ritual.has(u)) ritual.set(u, r.ritualId);
  const gesehen = new Set<string>();
  return [...termine].sort((a, b) => (a.tag + (a.von ?? '')).localeCompare(b.tag + (b.von ?? '')))
    .filter(t => { const k = `${t.uid}|${t.tag}`; if (gesehen.has(k)) return false; gesehen.add(k); return true; })
    .map(t => (ritual.has(t.uid) ? { ...t, ritualId: ritual.get(t.uid)! } : { ...t }));
}

/** Der erste Termin mit dem Kunden ab dem Start des Falls (Tag) — für „Kick-off terminiert“. */
export function ersterTermin(termine: readonly Pick<FallTermin, 'tag'>[], start: string): string | undefined {
  return termine.map(t => t.tag).filter(t => t >= start).sort()[0];
}

/** Ein Termin-Titel ohne den Kunden-Namen am Ende („Wochen-Check · Nordwerk …“ → „Wochen-Check“) — nur Anzeige. */
export function terminTitelKurz(titel: string | undefined, kunde?: string): string | undefined {
  const t = (titel ?? '').trim();
  if (!t) return undefined;
  if (kunde && t.endsWith(` · ${kunde}`)) return t.slice(0, -(kunde.length + 3)).trim() || t;
  return t;
}
