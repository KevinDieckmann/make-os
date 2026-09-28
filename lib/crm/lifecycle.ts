// ─── Markttraktion · Lifecycle einer Person (rein, getestet, 28.09.) ────────
// Kevin 28.09. (HubSpot-Vorbild): „Lifecycle wählbar als Chip mit Vorschlag“.
//   Lead · Marketing Qualified Lead · Sales Qualified Lead · Opportunity ·
//   Angebot · Kunde · Follow Up (= nach dem Auftrag: Nachbetreuung,
//   Folgegeschäft, Empfehlung).
// Das Feld `Kontakt.phase` wird von Hand gesetzt (Pipeline-Feld — der Import
// überschreibt es nie, er belegt es nur vor, solange es leer ist). Der
// Vorschlag aus den Daten steht in lib/crm/vorschlaege.ts (`lifecycleVorschlag`,
// `lifecycleVon`). Nicht zu verwechseln mit der Beziehungs-Lebensphase
// (lib/crm/phase.ts: Kontakt, Interessent, Kunde, Partner …) — die bleibt im
// Reiter „Daten“. Diese Datei hat bewusst keine Importe, damit das Modell
// (lib/make-one/crm.ts) sie ohne Kreis laden kann.

export type LifecyclePhase = 'lead' | 'mql' | 'sql' | 'opportunity' | 'angebot' | 'kunde' | 'follow_up';
export const LIFECYCLE_PHASEN: readonly LifecyclePhase[] = ['lead', 'mql', 'sql', 'opportunity', 'angebot', 'kunde', 'follow_up'];

/** Der volle Name — Tooltip, Export-Legende, Menü-Hinweis. */
export const LIFECYCLE_LABEL: Record<LifecyclePhase, string> = {
  lead: 'Lead', mql: 'Marketing Qualified Lead', sql: 'Sales Qualified Lead', opportunity: 'Opportunity', angebot: 'Angebot', kunde: 'Kunde', follow_up: 'Follow Up',
};
/** Die Kurzform für Chips, Spalten und Filter. */
export const LIFECYCLE_KURZ: Record<LifecyclePhase, string> = {
  lead: 'Lead', mql: 'MQL', sql: 'SQL', opportunity: 'Opportunity', angebot: 'Angebot', kunde: 'Kunde', follow_up: 'Follow Up',
};

export const istLifecycle = (v: unknown): v is LifecyclePhase => typeof v === 'string' && (LIFECYCLE_PHASEN as readonly string[]).includes(v);

/** Einträge für den Wahl-Chip: kurz im Chip, der volle Name als Hinweis im Menü. */
export const LIFECYCLE_WAHL: { id: LifecyclePhase; label: string; hinweis?: string }[] = LIFECYCLE_PHASEN.map(id => ({
  id, label: LIFECYCLE_KURZ[id], ...(LIFECYCLE_LABEL[id] !== LIFECYCLE_KURZ[id] ? { hinweis: LIFECYCLE_LABEL[id] } : {}),
}));

/** HubSpot-Werte der Masterlisten-Spalte LIFECYCLE → Phase. Alles andere (subscriber, evangelist, other …) → nichts. */
const AUS_LISTE: Record<string, LifecyclePhase> = {
  lead: 'lead', marketingqualifiedlead: 'mql', salesqualifiedlead: 'sql', opportunity: 'opportunity', customer: 'kunde',
};
export function lifecycleAusListe(roh?: string | null): LifecyclePhase | undefined {
  const n = String(roh ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return n ? AUS_LISTE[n] : undefined;
}

/**
 * Phase heben, nie senken (28.09., Prüfbericht F1): steht eine Phase und liegt sie vor `ziel`,
 * wird sie `ziel`; eine spätere (z. B. Follow Up nach Kunde) bleibt. Ohne gesetzte Phase `undefined` —
 * dann gilt weiter der Vorschlag aus den Daten, gespeichert wird nichts.
 */
export function phaseHeben(phase: LifecyclePhase | undefined, ziel: LifecyclePhase): LifecyclePhase | undefined {
  if (!phase) return undefined;
  return LIFECYCLE_PHASEN.indexOf(phase) < LIFECYCLE_PHASEN.indexOf(ziel) ? ziel : phase;
}

/** Leere Verteilung — jede Phase mit 0, in der Reihenfolge des Trichters. */
export const leereVerteilung = (): Record<LifecyclePhase, number> => Object.fromEntries(LIFECYCLE_PHASEN.map(p => [p, 0])) as Record<LifecyclePhase, number>;
