// ─── Prozesse · Kundengewinnung — die Bibliothek der 18 Vorlagen (22.10.; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md, ANALYSE_100.md Punkt 72) ────────
// Kevin 21.10.: „Kundengewinnung wird unser Herzstück … extrem viele Vorlagen, die auf dem höchsten Level integriert sind.“ — Kernprozess-Bibliothek: jede Vorlage
// ist eine gültige Definition mit Steckbrief, Recht, Kennzahlen, Einstellbarem und ehrlich benannten offenen Punkten. „Aus Vorlage anlegen“ (Werkstatt) übernimmt
// sie mit neuen Kennungen (./uebernehmen.ts). Für jede Instanz gleich: keine Namen, keine Firmen, keine Beträge. Rein und client-sicher — die Galerie liest
// trotzdem über die Route (kleines Browser-Bündel).

import { WELLE_1 } from './welle1';
import { WELLE_2 } from './welle2';
import { WELLE_3 } from './welle3';
import { BRAUCHT_TEXT, type KgVorlage, type Braucht } from './bau';
import { alleSchritte, phasen, schloesser, startKnoten } from '../fluss';
import { ausloeserText } from '../ausloeser';
import { EIGNER_ROLLE_NAME } from './rollen';
import type { ProzessDefinition, ProzessForm } from '../definition';

/** Alle Vorlagen in der Reihenfolge der Spezifikation (V01 … V18). */
export const KUNDENGEWINNUNG_VORLAGEN: readonly KgVorlage[] = [...WELLE_1, ...WELLE_2, ...WELLE_3].slice().sort((a, b) => a.nr.localeCompare(b.nr));
/** Dieselben in der Bau-Reihenfolge der Wellen (Welle 1 → 3, innerhalb der Welle nach Nutzen). */
export const VORLAGEN_NACH_WELLE: readonly KgVorlage[] = [...WELLE_1, ...WELLE_2, ...WELLE_3];

export const vorlageVon = (id: string): KgVorlage | null => KUNDENGEWINNUNG_VORLAGEN.find(v => v.id === id) ?? null;

/** Kurzform für die Galerie (Name, Zweck, Auslöser, Zahl der Schritte, Freigaben, „braucht …“). */
export interface VorlageKurz {
  id: string; nr: string; welle: number; titel: string; zweck: string; bereich: string; fallArt: string; eigner: string;
  ausloeser: string; schritte: number; freigaben: number; agenten: number; teile: number; braucht: string[]; offen: string[]; uebergabeAn: string[];
}
const zaehle = (d: ProzessDefinition, f: (form: ProzessForm | undefined) => boolean) => alleSchritte(d).filter(x => f(x.schritt.form)).length;

export function vorlageKurz(v: KgVorlage): VorlageKurz {
  const d = v.definition;
  const schloss = schloesser(d.knoten).size;
  return {
    id: v.id, nr: v.nr, welle: v.welle, titel: v.titel, zweck: v.zweck, bereich: v.bereich, fallArt: v.fallArt, eigner: EIGNER_ROLLE_NAME[v.eignerRolle],
    ausloeser: startKnoten(d).map(s => (s.ausloeser ? ausloeserText(s.ausloeser) : s.titel)).join(' · ') || v.ausloeserText,
    schritte: zaehle(d, f => f !== 'ausloeser' && f !== 'ende' && f !== 'freigabe'),
    freigaben: schloss + v.teile.reduce((n, t) => n + schloesser(t.definition.knoten).size, 0),
    agenten: zaehle(d, f => f === 'agent') + v.teile.reduce((n, t) => n + zaehle(t.definition, f => f === 'agent'), 0),
    teile: v.teile.length, braucht: v.braucht.map((b: Braucht) => BRAUCHT_TEXT[b]), offen: v.offen.map(o => `${o.punkt}: ${o.text}`), uebergabeAn: v.uebergabeAn,
  };
}

/** Das Bild der Vorschau (rein): je Phase die Schritte mit Form und Titel — die Galerie zeichnet daraus den Fluss (oben → unten). */
export interface VorschauPhase { titel: string; schritte: { id: string; titel: string; form: ProzessForm; schloss: boolean }[] }
export function vorlageVorschau(d: ProzessDefinition): VorschauPhase[] {
  const mitSchloss = new Set(schloesser(d.knoten).keys());
  return phasen(d).map(p => ({
    titel: p.titel,
    schritte: alleSchritte(d).filter(x => x.phase.id === p.id && x.schritt.form !== 'freigabe').map(x => ({ id: x.schritt.id, titel: x.schritt.titel, form: x.schritt.form ?? 'schritt', schloss: mitSchloss.has(x.schritt.id) })),
  }));
}
