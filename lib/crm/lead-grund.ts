// ─── Warum ein Lead ausscheidet oder wartet (rein, 03.10.) ───────────────────
// Kevin: „Mit Grund disqualifizieren — der Grund fließt in die Auswertung.“ `Lead.grund` bleibt der freie Satz; die FESTE Art
// (`Lead.grundArt`) macht daraus eine Zahl: wie viele Leads scheiden aus welchem Grund aus, wie viele warten warum. Beides
// steht in Sales › Auswertung und im Datenblock von Head of Sales/Marketing — damit Marketing sieht, welche Leads gar nicht
// erst passten, und Sales, woran sie scheitern.

import type { LeadStatus } from './typen';

export interface GrundArt { id: string; label: string; hinweis?: string }

/** Warum „Kein Fit“ (der Lead scheidet aus). */
export const GRUND_RAUS: readonly GrundArt[] = [
  { id: 'zu_klein', label: 'Zu klein oder passt nicht zum Profil', hinweis: 'Größe, Branche oder Geschäftsmodell liegen außerhalb der Zielgruppe.' },
  { id: 'kein_schmerz', label: 'Kein erkennbarer Schmerz', hinweis: 'Es gibt kein Problem, das wir lösen.' },
  { id: 'kein_budget', label: 'Kein Budget', hinweis: 'Der Bedarf ist da, aber kein Rahmen in Sicht.' },
  { id: 'kein_entscheider', label: 'Kein Zugang zum Entscheider' },
  { id: 'wettbewerber', label: 'Anderer Anbieter oder intern gelöst' },
  { id: 'kein_interesse', label: 'Kein Interesse' },
  { id: 'nicht_erreichbar', label: 'Nicht erreichbar' },
  { id: 'dublette', label: 'Dublette oder falscher Eintrag' },
  { id: 'sonstiges', label: 'Sonstiges' },
];
/** Warum „Parken“ (der Lead wartet bis zu einem Tag). */
export const GRUND_PARKEN: readonly GrundArt[] = [
  { id: 'spaeter', label: 'Später — der Anlass fehlt noch' },
  { id: 'budget_spaeter', label: 'Budget kommt später (neues Jahr, neue Runde)' },
  { id: 'wartet', label: 'Wartet auf andere (Entscheidung, Gespräch, Zahlen)' },
  { id: 'nicht_erreicht', label: 'Nicht erreicht — später noch einmal' },
  { id: 'sonstiges', label: 'Sonstiges' },
];
export const GRUND_ARTEN: readonly GrundArt[] = [...GRUND_RAUS, ...GRUND_PARKEN.filter(g => !GRUND_RAUS.some(r => r.id === g.id))];
export const istGrundRaus = (v: unknown): v is string => typeof v === 'string' && GRUND_RAUS.some(g => g.id === v);
export const istGrundParken = (v: unknown): v is string => typeof v === 'string' && GRUND_PARKEN.some(g => g.id === v);
export const grundLabel = (id?: string): string => (id ? GRUND_ARTEN.find(g => g.id === id)?.label ?? id : 'ohne Angabe');

export interface GrundZeile { art: string; label: string; anzahl: number }
export interface LeadGruende { ausgeschieden: GrundZeile[]; geparkt: GrundZeile[]; nAus: number; nGeparkt: number }

/** Verteilung der Gründe über alle Leads: Status „Kein Fit“ → ausgeschieden, „Ruht“ → geparkt; ohne feste Art zählt „ohne Angabe“. */
export function leadGruende(zeilen: readonly { status: LeadStatus; grundArt?: string }[]): LeadGruende {
  const zaehle = (status: LeadStatus): GrundZeile[] => {
    const je = new Map<string, number>();
    for (const z of zeilen) if (z.status === status) je.set(z.grundArt ?? '', (je.get(z.grundArt ?? '') ?? 0) + 1);
    return Array.from(je, ([art, anzahl]) => ({ art: art || 'ohne', label: grundLabel(art || undefined), anzahl })).sort((a, b) => b.anzahl - a.anzahl || a.label.localeCompare(b.label));
  };
  const ausgeschieden = zaehle('kein_fit'), geparkt = zaehle('ruht');
  return { ausgeschieden, geparkt, nAus: ausgeschieden.reduce((s, z) => s + z.anzahl, 0), nGeparkt: geparkt.reduce((s, z) => s + z.anzahl, 0) };
}
