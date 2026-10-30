// ─── MAKE OS — Personen-Fächer der Daten → Namen aus den Konten (14.10., Abnahme A1 — rein, client-sicher) ───────────────────
// Einige Bestände kennen genau zwei Personen-Fächer mit festen KENNUNGEN aus dem Altbestand: Kalender-Zuordnung (`kalender.kevin/malin/beide`),
// Finanzplan (`annahmen.kevinBrutto`, Konten, „wer“ an Verpflichtungen und Fokus-Schritten). Die Kennungen bleiben in den Daten (nie
// umbenennen) — angezeigt wird nie die Kennung, sondern der Vorname der Person dahinter: die Person mit DIESEM Speichernamen, sonst die
// erste bzw. zweite Person der Liste (Konten des Haushalts, Inhaber zuerst). Ohne Person ein neutraler Platzhalter.
// Die Abnahme (14.10.) sah in einer fremden Instanz „Kevin · Malin“ im Kalender — die Namen standen fest im Code.

/** Die zwei Fächer — Kennungen aus dem Altbestand, nie umbenennen. */
export const FAECHER = ['kevin', 'malin'] as const;
export type Fach = (typeof FAECHER)[number];
export const istFach = (v: unknown): v is Fach => v === FAECHER[0] || v === FAECHER[1];
/** Platzhalter, solange (bzw. falls) hinter einem Fach keine Person steht. */
export const FACH_ERSATZ: Readonly<Record<Fach, string>> = { kevin: 'Person 1', malin: 'Person 2' };

export interface FachPerson { id: string; name: string }

/** Wer steht hinter den Fächern? Gleicher Speichername gewinnt, sonst die Reihenfolge. Rein. */
export function fachPersonen(personen: readonly FachPerson[]): Partial<Record<Fach, FachPerson>> {
  const eins = personen.find(p => p.id === FAECHER[0]) ?? personen.find(p => p.id !== FAECHER[1]);
  const zwei = personen.find(p => p.id === FAECHER[1]) ?? personen.find(p => p !== eins && p.id !== FAECHER[0]);
  return { ...(eins ? { kevin: eins } : {}), ...(zwei ? { malin: zwei } : {}) };
}

/** In welchem Fach steht diese Person (Speichername)? `null`, wenn sie in keinem steht. Rein (30.10., neutral-nacht). */
export function fachDerPerson(speicher: string | null | undefined, personen: readonly FachPerson[]): Fach | null {
  if (!speicher) return null;
  const p = fachPersonen(personen);
  if (p.kevin?.id === speicher) return FAECHER[0];
  if (p.malin?.id === speicher) return FAECHER[1];
  // Ohne Person dahinter (Konten noch nicht geladen): „gleicher Speichername gewinnt“ — ein freies Fach mit diesem Namen.
  return istFach(speicher) && !p[speicher] ? speicher : null;
}

/** Namen der Fächer und welche belegt sind (für Auswahl-Leisten: ein leeres Fach zeigt man nicht). Rein. */
export function fachNamen(personen: readonly FachPerson[]): Record<Fach, string> & { belegt: Fach[] } {
  const p = fachPersonen(personen);
  return {
    kevin: p.kevin?.name || FACH_ERSATZ.kevin,
    malin: p.malin?.name || FACH_ERSATZ.malin,
    belegt: FAECHER.filter(f => !!p[f]),
  };
}

/** Vorname aus einem vollen Namen (erstes Wort). */
export const vorname = (name: string | null | undefined): string => String(name ?? '').trim().split(/\s+/)[0] ?? '';
