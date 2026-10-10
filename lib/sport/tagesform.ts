// ─── Sport · Tagesform an der geplanten Einheit: „heute leichter“ (rein, getestet, 09.10.2026) ────────────────────────────
// EINE Regel für jede Stelle, die eine geplante Einheit zeigt (Sport › Plan, Cockpit „Training heute“, ZOE-Tagesvorschlag):
//   Recovery grün oder unbekannt → kein Hinweis.
//   Recovery gelb → nur an harten Einheiten (Intervall, Tempo, Stationen, Simulation, Wettkampf): „heute leichter“.
//   Recovery rot  → an jeder Einheit außer Mobility/Erholung: hart → „tauschen oder leichter“, sonst „locker halten“.
// Zonen und Strain-Rahmen kommen aus lib/gesundheit/belastung.ts (dieselben Schwellen wie der Strain-Ring). Ein Vorschlag, keine
// Trainingsberatung — die Person entscheidet.

import { recZone, strainRahmen, type StrainRahmen } from '@/lib/gesundheit/belastung';
import type { PlanEinheit } from './modell';
import { TYP_LABEL, KLASSE_LABEL } from './modell';
import { intensitaetVon } from './plan-bau';

export interface TagesformHinweis {
  stufe: 'gelb' | 'rot';
  /** Was die Person tun könnte. */
  vorschlag: 'leichter' | 'tauschen' | 'locker';
  /** Etikett an der Einheit. */
  kurz: string;
  /** Ein ganzer Satz. */
  text: string;
  rahmen: StrainRahmen;
}

const rahmenText = (r: StrainRahmen) => (r.von > 0 ? `${r.von}–${r.bis}` : `bis ${r.bis}`);

/** Hinweis an einer geplanten Einheit aus der Recovery des Tages — null, wenn nichts zu sagen ist. */
export function tagesformHinweis(e: Pick<PlanEinheit, 'sparte' | 'typ' | 'intensitaet'>, rec?: number): TagesformHinweis | null {
  const zone = recZone(rec);
  const rahmen = strainRahmen(rec);
  if (!zone || zone === 'gruen' || !rahmen) return null;
  if (e.sparte === 'mobility' || e.typ === 'mobility' || e.typ === 'erholung') return null;
  const int = intensitaetVon(e);
  const name = e.typ ? TYP_LABEL[e.typ] : KLASSE_LABEL[e.sparte];
  const r = `Strain-Rahmen heute ${rahmenText(rahmen)}`;
  if (zone === 'gelb') {
    if (int !== 'hart') return null;
    return { stufe: 'gelb', vorschlag: 'leichter', kurz: 'heute leichter', rahmen, text: `Recovery gelb — ${name} heute leichter: kürzere Wiederholungen oder Tempo zu Grundlage, Technik vor Maximal (${r}).` };
  }
  if (int === 'hart') return { stufe: 'rot', vorschlag: 'tauschen', kurz: 'tauschen oder leichter', rahmen, text: `Recovery rot — ${name} heute mit einem leichten Tag tauschen oder locker und kurz halten (${r}).` };
  return { stufe: 'rot', vorschlag: 'locker', kurz: 'locker halten', rahmen, text: `Recovery rot — ${name} locker und eher kürzer; bei Schwere lieber Mobility (${r}).` };
}
