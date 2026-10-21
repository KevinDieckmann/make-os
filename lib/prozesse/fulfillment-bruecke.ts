// ─── Prozesse — die Brücke zum Fulfillment (Etappe B1, 21.10.; ANALYSE_100.md Punkt 6, Entscheidung E3) ──────────────────────────────────────────────
// Fulfillment-Vorlagen SIND Prozesse dieses Modells (lib/prozesse/definition.ts; lib/fulfillment/typen.ts exportiert die Typen nur weiter). Sie bleiben in
// ihrem Bestand `fulfillment--<haushalt>`, werden dort bearbeitet (Prozess-Editor) und bit-gleich weitergelesen: ihnen fehlen die neuen Felder, und Fehlen
// heißt Bereich Fulfillment, Fall = Mandat. Diese Stelle zeigt sie neben den Prozessen der Werkstatt — nur lesend, ohne Kopie (E3: erst zeigen, dann einzeln
// in den Motor überführen). Rein und client-sicher.

import { bereichVon, fallArtVon, type FallArt, type ProzessBereich, type ProzessDefinition, type ProzessEintrag, type ProzessStatus, type ProzessVorlage } from './definition';
import { entwurfGeaendert } from './versionen';

/** Eine Fulfillment-Vorlage als allgemeiner Prozess (rein) — Knoten unverändert (dieselbe Liste), nur Bereich und Fall-Art als Vorgabe ergänzt. */
export function prozessAusFulfillment(v: ProzessVorlage): ProzessVorlage & { bereich: ProzessBereich; fallArt: FallArt } {
  return { ...v, bereich: bereichVon(v), fallArt: fallArtVon(v) };
}

/** Eine Zeile der Liste „alle Prozesse“ (Werkstatt, Landkarte). */
export interface ProzessKurz {
  id: string; titel: string; bereich: ProzessBereich; fallArt: FallArt;
  /** werkstatt = Bestand `prozesse--<h>`; fulfillment = Paket-Vorlage (nur lesen, bearbeitet im Fulfillment-Editor). */
  quelle: 'werkstatt' | 'fulfillment';
  status: ProzessStatus | null;
  /** Jüngste veröffentlichte Version bzw. Fassung der Fulfillment-Vorlage. */
  version: number | null;
  eigner?: string;
  nurLesen: boolean;
  /** Hat der Entwurf etwas, das die jüngste Version nicht hat? */
  entwurfGeaendert?: boolean;
  geaendert: string;
}
export function kurzAusEintrag(e: ProzessEintrag, nurLesen = false): ProzessKurz {
  const d: ProzessDefinition = e.entwurf;
  return {
    id: e.id, titel: d.titel, bereich: bereichVon(d), fallArt: fallArtVon(d), quelle: 'werkstatt', status: e.status, version: e.versionen.at(-1)?.nr ?? null,
    ...(d.eigner ? { eigner: d.eigner } : {}), nurLesen, entwurfGeaendert: entwurfGeaendert(e), geaendert: e.entwurfAm,
  };
}
export function kurzAusFulfillment(v: ProzessVorlage): ProzessKurz {
  const p = prozessAusFulfillment(v);
  return { id: v.id, titel: v.titel, bereich: p.bereich, fallArt: p.fallArt, quelle: 'fulfillment', status: null, version: v.fassung, nurLesen: true, geaendert: v.geaendert };
}
/** Die Paket-Vorlagen des Fulfillments, die als Prozesse gelten (Landkarte und gezeichnete Abläufe sind Bilder, keine Abläufe mit Schritten). */
export const fulfillmentProzesse = (l: readonly ProzessVorlage[]): ProzessVorlage[] => l.filter(v => v.art === 'paket');
