// ─── Übernahme der Wochenplan-Blöcke in den Kalender (rein, getestet, 29.09., K5) ─
// Bis K5 lagen die Blöcke des Wochenplaners in einem eigenen Bestand (`wochenplan` = Kevin, `wochenplan--<person>`,
// Schlüssel = Montag der Woche) — neben dem Kalender, mit einer Apple-Kopie (`appleUid`), die beim Verschieben stehen
// blieb (Verbindungskarte Befund 5). Seit K5 ist ein Block ein iCloud-Termin (lib/planung/bloecke.ts).
//
// Die Übernahme (einmal, nach dem Upload — UPDATES.md) überführt NUR ZUKÜNFTIGE Blöcke (Beginn ≥ jetzt):
//   · mit `appleUid`, deren Termin es in iCloud noch gibt → dieser Termin bekommt Art/Unterart (keine Kopie);
//   · sonst → neuer Termin mit FESTER, echter UID (`uidFuerBlock`) — ein abgebrochener Lauf legt nie doppelt an.
// Vergangene Blöcke bleiben als Archiv lesbar (`archivBloecke`, nur lesen) — Gesundheits-/Business-Kennzahlen der
// letzten Wochen rechnen weiter mit ihnen. Der alte Bestand wird NICHT verändert; der Stand der Übernahme
// (Block-Kennung → Termin-UID, keine Titel) liegt in `wochenplan-uebernahme`. Nur diese Datei und ihr Server-Teil
// lesen den alten Bestand.
// F1 (Prüfer 1 #3/#4): Die Apple-Kopie wird nur dann DER Block, wenn sie noch zum Block passt — sonst schreibt die
// Übernahme Start/Ende/Titel des Blocks mit (der Block ist die Wahrheit). Lässt sie sich nicht ändern (Serie, Gäste,
// nur lesbar, mehrdeutig), entsteht ein neuer Termin mit `uidFuerBlock`; scheitert auch das, steht der Block mit Grund
// unter `uebersprungen` (nie Titel) und die Übernahme macht mit dem nächsten weiter — kein Block hält sie auf.

import { PLAN_ARTEN, type PlanBlock } from '@/types/planer';
import { wandAus } from '@/lib/kalender/zeit';
import type { PlanBlockSicht } from './bloecke';

export const UEBERNAHME_SPEICHER = 'wochenplan-uebernahme';
export const UEBERNAHME_ARCHIV_PRAEFIX = 'wochenplan-vor-uebernahme-';
/** Der alte Bestand einer Person (Kevin behielt den gewachsenen Namen). */
export const altName = (person: string): string => (person === 'kevin' ? 'wochenplan' : `wochenplan--${person}`);

export type AltDatei = Record<string, PlanBlock[] | undefined>;
/** `uebersprungen` (F1 #4): Block-Kennung → kurzer technischer Grund — der Block bleibt Archiv, kein neuer Versuch. */
export interface UebernahmePerson { am?: string; bloecke: Record<string, string>; uebersprungen?: Record<string, string> }
export interface UebernahmeStand { version: 1; personen: Record<string, UebernahmePerson>; archiv?: string }
export const LEER_STAND: UebernahmeStand = { version: 1, personen: {} };

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

export function standSauber(v: unknown): UebernahmeStand {
  const o = v && typeof v === 'object' ? v as Partial<UebernahmeStand> : {};
  const personen: Record<string, UebernahmePerson> = {};
  for (const [p, e] of Object.entries(o.personen ?? {})) {
    if (!PERSON.test(p) || !e || typeof e !== 'object') continue;
    const bloecke: Record<string, string> = {};
    for (const [id, uid] of Object.entries((e as UebernahmePerson).bloecke ?? {})) if (typeof uid === 'string' && uid) bloecke[id] = uid;
    const uebersprungen: Record<string, string> = {};
    for (const [id, grund] of Object.entries((e as UebernahmePerson).uebersprungen ?? {})) if (typeof grund === 'string' && !bloecke[id]) uebersprungen[id] = grund.slice(0, 160);
    personen[p] = { ...(typeof (e as UebernahmePerson).am === 'string' ? { am: (e as UebernahmePerson).am } : {}), bloecke, ...(Object.keys(uebersprungen).length ? { uebersprungen } : {}) };
  }
  return { version: 1, personen, ...(typeof o.archiv === 'string' ? { archiv: o.archiv } : {}) };
}

/** Alle Blöcke einer alten Datei — gesäubert, je Kennung einmal (die erste Woche gewinnt). */
export function altBloecke(datei: AltDatei | null | undefined): PlanBlock[] {
  const raus: PlanBlock[] = [];
  const gesehen = new Set<string>();
  for (const liste of Object.values(datei ?? {})) {
    for (const b of Array.isArray(liste) ? liste : []) {
      if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !b.id || gesehen.has(b.id) || !TAG.test(String(b.date))) continue;
      const startMin = Number(b.startMin), dauerMin = Number(b.dauerMin);
      if (!Number.isFinite(startMin) || !Number.isFinite(dauerMin) || dauerMin <= 0) continue;
      gesehen.add(b.id);
      raus.push({
        id: b.id, date: b.date, startMin: Math.max(0, Math.min(24 * 60 - 15, Math.round(startMin))), dauerMin: Math.max(15, Math.min(8 * 60, Math.round(dauerMin))),
        titel: String(b.titel ?? '').slice(0, 120) || 'Block', art: (PLAN_ARTEN as readonly string[]).includes(b.art) ? b.art : 'block',
        ...(b.taskId ? { taskId: String(b.taskId).slice(0, 80) } : {}), ...(b.appleUid ? { appleUid: String(b.appleUid).slice(0, 300) } : {}),
      });
    }
  }
  return raus.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}

/** Beginnt der Block jetzt oder später? (`jetztWand` = Berliner Wandzeit, nie über new Date(wandzeit).) */
export const istZukuenftig = (b: Pick<PlanBlock, 'date' | 'startMin'>, jetztWand: string): boolean => wandAus(b.date, b.startMin) >= jetztWand.slice(0, 19);

/** Feste, echte UID des Termins zu einem alten Block (je Person + Block eindeutig, gültig für iCloud). */
export function uidFuerBlock(person: string, blockId: string): string {
  const id = blockId.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 90);
  return `makeos-wochenplan-${person.replace(/[^a-z0-9-]/g, '')}-${id}`;
}

export interface UebernahmeEintrag { person: string; block: PlanBlock; uid: string; weg: 'apple' | 'neu' }
export interface UebernahmePlan { person: string; offen: UebernahmeEintrag[]; vergangen: number; schon: number; uebersprungen: number }

/**
 * Was für eine Person zu tun ist. `appleDa`: gibt es den gespiegelten Apple-Termin (appleUid) noch in iCloud?
 * Schon übernommene Blöcke (im Stand) zählen nur.
 */
export function uebernahmePlanen(person: string, datei: AltDatei | null | undefined, stand: UebernahmeStand, jetztWand: string, appleDa: (uid: string) => boolean): UebernahmePlan {
  const schonMap = stand.personen[person]?.bloecke ?? {};
  const weg = stand.personen[person]?.uebersprungen ?? {};
  const plan: UebernahmePlan = { person, offen: [], vergangen: 0, schon: 0, uebersprungen: 0 };
  for (const b of altBloecke(datei)) {
    if (schonMap[b.id]) { plan.schon++; continue; }
    if (weg[b.id]) { plan.uebersprungen++; continue; }
    if (!istZukuenftig(b, jetztWand)) { plan.vergangen++; continue; }
    const apple = !!b.appleUid && appleDa(b.appleUid);
    plan.offen.push({ person, block: b, uid: apple ? b.appleUid! : uidFuerBlock(person, b.id), weg: apple ? 'apple' : 'neu' });
  }
  return plan;
}

/**
 * Nur lesen: Blöcke des alten Bestands, die (noch) NICHT übernommen sind, im Zeitraum [von, bis) — vergangene
 * (Archiv) und vor der Übernahme auch zukünftige (dann mit `wartet: true`, damit die Oberfläche sie als „wartet auf
 * Übernahme“ zeigt und nichts verschwindet). Kennung `archiv:<person>:<id>`.
 */
export type ArchivBlock = PlanBlockSicht & { wartet?: true; /** Hatte eine Apple-Kopie — die steht als eigener Termin im Kalender (Ansicht blendet den Block dann aus). */ gespiegelt?: true; /** Bei der Übernahme übersprungen (F1 #4) — bleibt Archiv, wartet nicht mehr. */ uebersprungen?: true };
export function archivBloecke(person: string, datei: AltDatei | null | undefined, stand: UebernahmeStand, von: string, bis: string, jetztWand: string): ArchivBlock[] {
  const schonMap = stand.personen[person]?.bloecke ?? {};
  const weg = stand.personen[person]?.uebersprungen ?? {};
  return altBloecke(datei)
    .filter(b => !schonMap[b.id] && b.date >= von && b.date < bis)
    .map(b => {
      const { appleUid: _a, ...rest } = b;
      return { ...rest, id: `archiv:${person}:${b.id}`, quelle: 'archiv' as const, wer: person, ...(weg[b.id] ? { uebersprungen: true as const } : istZukuenftig(b, jetztWand) ? { wartet: true as const } : {}), ...(b.appleUid ? { gespiegelt: true as const } : {}) };
    });
}
