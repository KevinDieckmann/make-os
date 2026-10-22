// ─── Prozesse · Kunden-Begleitung — wo ein Begleit-Prozess am Paket andockt (22.10., B3; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md › B3) ─────────────
// Andocken ohne zweites Feld: ein Begleit-Prozess (Werkstatt, Fall-Art Mandat, Auslöser = Ereignis des Fulfillment-Falls bzw. der nächste Termin) gehört zu einem
// Paket bzw. Schritt ALLEIN über die Bedingungen seines Auslösers — `fall.paket` (bzw. `bezug.vorlageid`) = Paket, `bezug.knotenid` = Schritt oder Phase. Ohne
// Paket-Bedingung hört er auf jedes Paket („alle Pakete“). EINE Stelle für:
//   · `begleitFuer(paket, prozesse)`   welche Werkstatt-Prozesse an diesem Paket andocken (Werkstatt-Ansicht des Pakets)
//   · `andockenAnwenden(def, ziel)`     „+ Begleit-Prozess“ am Paket: die Vorlage bekommt beim Übernehmen „nur dieses Paket“ (und optional „nur dieser Schritt“)
// Rein und client-sicher; liest und schreibt keinen Bestand.

import type { Ausloeser, Bedingung, ProzessDefinition, ProzessStatus, SkillEreignis } from '../definition';
import { startKnoten } from '../fluss';
import { ausloeserText } from '../ausloeser';

/** Ereignisse des Fulfillment-Falls, auf die ein Begleit-Prozess hört (B1 + die vorhandenen Fall-Ereignisse). */
export const BEGLEIT_EREIGNISSE: ReadonlySet<SkillEreignis> = new Set<SkillEreignis>(['fall-phase', 'fall-wartet-kunde', 'abstimmung-bestaetigt', 'fall-haengt', 'kunde-geliefert', 'fall-schritt-erledigt', 'ziel-erreicht']);
/** Ereignisse, die einen Schritt bzw. eine Phase des Falls im Bezug tragen (`knotenId`) — nur dort dockt „nur dieser Schritt“ an. */
export const KNOTEN_EREIGNISSE: ReadonlySet<SkillEreignis> = new Set<SkillEreignis>(['fall-phase', 'fall-wartet-kunde', 'abstimmung-bestaetigt', 'fall-haengt', 'fall-schritt-erledigt']);
const PAKET_FELDER = new Set(['fall.paket', 'bezug.vorlageid']);
const KNOTEN_FELD = 'bezug.knotenid';

type MitBedingungen = Extract<Ausloeser, { art: 'ereignis' } | { art: 'datum' }>;
const istBegleitAusloeser = (a: Ausloeser | undefined): a is MitBedingungen =>
  !!a && ((a.art === 'ereignis' && BEGLEIT_EREIGNISSE.has(a.ereignis)) || (a.art === 'datum' && a.feld === 'fall.termin'));
const gleichWert = (l: readonly Bedingung[] | undefined, felder: (f: string) => boolean): string | null => {
  const b = (l ?? []).find(x => felder(x.feld) && x.op === 'gleich' && typeof x.wert === 'string' && x.wert);
  return b ? String(b.wert) : null;
};

/** Ist es ein Begleit-Prozess? (Fall-Art Mandat, mindestens ein Auslöser auf ein Ereignis des Falls bzw. den nächsten Termin.) */
export function istBegleitProzess(d: Pick<ProzessDefinition, 'knoten' | 'fallArt'>): boolean {
  return d.fallArt === 'mandat' && startKnoten(d).some(s => istBegleitAusloeser(s.ausloeser));
}

/** Woran er andockt (rein): Paket (null = alle Pakete) und Schritt/Phase (null = am ganzen Paket) — aus dem ersten Begleit-Auslöser. */
export function andockVon(d: Pick<ProzessDefinition, 'knoten' | 'fallArt'>): { paket: string | null; knoten: string | null; ausloeser: MitBedingungen } | null {
  if (d.fallArt !== 'mandat') return null;
  const a = startKnoten(d).map(s => s.ausloeser).find(istBegleitAusloeser);
  if (!a) return null;
  return { paket: gleichWert(a.bedingungen, f => PAKET_FELDER.has(f)), knoten: gleichWert(a.bedingungen, f => f === KNOTEN_FELD), ausloeser: a };
}

/** Ein Begleit-Prozess am Paket (Kachel in der Werkstatt-Ansicht des Pakets). */
export interface BegleitAndock {
  prozessId: string; titel: string; status: ProzessStatus;
  /** „Auslöser“ in Worten (dieselbe Formulierung wie überall in der Werkstatt). */
  ausloeser: string;
  /** `dieses` = nur dieses Paket, `alle` = hört auf jedes Paket. */
  paket: 'dieses' | 'alle';
  /** Schritt bzw. Phase des Pakets, an dem er andockt — fehlt: am ganzen Paket. */
  knoten?: string;
}

/**
 * Welche Werkstatt-Prozesse an einem Paket andocken (rein): Begleit-Prozesse, deren Paket-Bedingung dieses Paket nennt oder die keine haben; archivierte und solche
 * für ein anderes Paket fallen weg. `definition` = die jüngste veröffentlichte Version, sonst der Entwurf (der Aufrufer wählt). Reihenfolge: erst die nur für dieses
 * Paket, dann nach Titel.
 */
export function begleitFuer(paketId: string, prozesse: readonly { id: string; titel: string; status: ProzessStatus; definition: Pick<ProzessDefinition, 'knoten' | 'fallArt'> }[]): BegleitAndock[] {
  const raus: BegleitAndock[] = [];
  for (const p of prozesse) {
    if (p.status === 'archiviert') continue;
    const a = andockVon(p.definition);
    if (!a || (a.paket && a.paket !== paketId)) continue;
    raus.push({ prozessId: p.id, titel: p.titel, status: p.status, ausloeser: ausloeserText(a.ausloeser), paket: a.paket ? 'dieses' : 'alle', ...(a.paket && a.knoten ? { knoten: a.knoten } : {}) });
  }
  return raus.sort((x, y) => (x.paket === y.paket ? x.titel.localeCompare(y.titel, 'de') : x.paket === 'dieses' ? -1 : 1));
}

/**
 * „+ Begleit-Prozess“ am Paket (rein): jeder Begleit-Auslöser der Definition hört danach nur auf dieses Paket (`fall.paket` — gilt für jedes Ereignis des Falls und
 * den nächsten Termin) und, wenn ein Schritt gewählt ist und das Ereignis einen Schritt trägt, nur auf diesen (`bezug.knotenid`). Vorhandene Paket- bzw.
 * Schritt-Bedingungen werden ersetzt, alle anderen bleiben. Ein Auslöser mit „oder“-Verknüpfung bleibt unverändert (ein „und nur dieses Paket“ ließe sich dort
 * nicht ausdrücken) — dann ein Hinweis. Kein Begleit-Prozess → unverändert.
 */
export function andockenAnwenden(d: ProzessDefinition, ziel: { paket: string; knoten?: string }): { definition: ProzessDefinition; hinweise: string[] } {
  const hinweise: string[] = [];
  if (!istBegleitProzess(d)) return { definition: d, hinweise };
  const knoten = d.knoten.map(k => {
    const a = k.ausloeser;
    if (!istBegleitAusloeser(a)) return k;
    if (a.verknuepfung === 'oder' && (a.bedingungen?.length ?? 0) > 0) { hinweise.push(`„${k.titel}“: Bedingungen mit „oder“ — „nur dieses Paket“ bitte im Auslöser selbst setzen.`); return k; }
    const mitSchritt = !!ziel.knoten && a.art === 'ereignis' && KNOTEN_EREIGNISSE.has(a.ereignis);
    const bedingungen: Bedingung[] = [
      ...(a.bedingungen ?? []).filter(b => !PAKET_FELDER.has(b.feld) && !(mitSchritt && b.feld === KNOTEN_FELD)),
      { feld: 'fall.paket', op: 'gleich', wert: ziel.paket },
      ...(mitSchritt ? [{ feld: KNOTEN_FELD, op: 'gleich' as const, wert: ziel.knoten! }] : []),
    ];
    return { ...k, ausloeser: { ...a, bedingungen } as Ausloeser };
  });
  return { definition: { ...d, knoten }, hinweise };
}
