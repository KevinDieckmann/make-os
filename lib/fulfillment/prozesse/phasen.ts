// ─── Fulfillment · Phasen einer Paket-Vorlage: EINE Regel für Reihenfolge und Zuordnung (12.10.) ─────────────────────────────────────
// Gefunden in der Demo: Der Import hängte Phasen aus den Bausteinen (`phase`) HINTEN an, wenn die Paket-Vorlage keine gleichnamige hatte —
// „Sales-Systematik“ endete mit „… Übergabe → Analyse → Strategie → Umsetzung → Steuerung → Onboarding“, der Fall „Vertriebsleitung auf Zeit“
// mit den Phasen 9 „Strategie“ und 10 „Steuerung“ nach der Übergabe. „Strategie“ und „Steuerung“ sind Dach-Themen der Landkarte (Ziele,
// Positionierung, Führungsrhythmus, Kennzahlen) — keine eigene Phase im Kundenfall.
//
// Die Regel (rein, client-sicher, deterministisch; Tests: tests/fulfillment-phasen.test.ts):
//   · Kanonische Phasen in dieser Reihenfolge: Vorlauf/Onboarding · Analyse · Diagnose · Aufbau · Recruiting · Umsetzung · Führung · Übergabe.
//     Eine Phase gehört zu einer kanonischen, wenn ihr Titel (bzw. der Schlüssel eines Bausteins) eines ihrer Wörter trägt (`phaseVon`).
//   · Dach-Themen werden zugeordnet: Strategie → Diagnose, Steuerung → Führung (`DACH_ZUORDNUNG`).
//   · Eigene Phasen einer Vorlage (z. B. „Skripte & Workbooks“) sind die Kern-Arbeit des Pakets: sie stehen zwischen Aufbau und Recruiting und
//     behalten ihre Reihenfolge untereinander; „Weitere Bausteine“ (ohne Phase) steht am Ende.
//   · Import (`phaseFinden`, `phaseEinfuegen`): ein Baustein landet in der passenden vorhandenen Phase; fehlt sie, entsteht sie mit dem
//     kanonischen Titel an ihrer Stelle — nie hinten angehängt.
//   · Anzeigen (`phasenOrdnen`, im Säuberer lib/fulfillment/lesen.ts für Paket-Vorlagen und Fälle): gespeicherte Vorlagen werden NICHT
//     umgeschrieben, nur beim Lesen geordnet (der nächste Schreibvorgang speichert die geordnete Fassung). Eine Dach-Phase ohne eigene Angaben
//     (nur Titel — so legte sie der Import an; im Fall zusätzlich noch „offen“) wird mit der passenden vorhandenen Phase zusammengelegt: ihre
//     Schritte hängen danach dort, nichts geht verloren. Hat jemand die Phasen von Hand umgestellt (`phasenVonHand`), bleibt seine Reihenfolge.

import { kinderVon, wurzelVon } from '../regeln';
import { titelForm } from './pruefen';

export type PhaseSchluessel = 'vorlauf' | 'analyse' | 'diagnose' | 'aufbau' | 'recruiting' | 'umsetzung' | 'fuehrung' | 'uebergabe';
export interface PhaseDef { id: PhaseSchluessel; titel: string; woerter: readonly string[] }

/** Die kanonischen Phasen in ihrer Reihenfolge — Titel neuer Phasen aus dem Import, Wörter zum Wiedererkennen (Vergleichsform `titelForm`). */
export const PHASEN: readonly PhaseDef[] = [
  { id: 'vorlauf', titel: 'Vorlauf / Onboarding', woerter: ['vorlauf', 'onboarding', 'kickoff', 'kick off'] },
  { id: 'analyse', titel: 'Analyse', woerter: ['analyse', 'bestandsaufnahme', 'ist aufnahme'] },
  { id: 'diagnose', titel: 'Diagnose', woerter: ['diagnose'] },
  { id: 'aufbau', titel: 'Aufbau', woerter: ['aufbau'] },
  { id: 'recruiting', titel: 'Recruiting (nur Prozess)', woerter: ['recruiting'] },
  { id: 'umsetzung', titel: 'Umsetzung', woerter: ['umsetzung'] },
  { id: 'fuehrung', titel: 'Führung', woerter: ['fuehrung'] },
  { id: 'uebergabe', titel: 'Follow-up / Übergabe', woerter: ['uebergabe', 'follow up', 'followup', 'nachbetreuung'] },
];
/** Dach-Themen → die Phase, in die ihre Bausteine gehören (keine eigene Phase im Kundenfall). Neue Zuordnung nur hier. */
export const DACH_ZUORDNUNG: Readonly<Record<string, PhaseSchluessel>> = { strategie: 'diagnose', steuerung: 'fuehrung' };
/** Titel des Sammelknotens für Bausteine ohne Phase (Import) — steht immer am Ende. */
export const WEITERE_BAUSTEINE = 'Weitere Bausteine';

const RANG: Readonly<Record<PhaseSchluessel, number>> = Object.fromEntries(PHASEN.map((p, i) => [p.id, i])) as Record<PhaseSchluessel, number>;
/** Rang der eigenen Phasen eines Pakets (Kern-Arbeit): hinter „Aufbau“, vor „Recruiting“. */
const KERN = RANG.aufbau + 0.5;
const ENDE = PHASEN.length + 1;

export const phaseTitel = (id: PhaseSchluessel): string => PHASEN[RANG[id]].titel;

/**
 * Zu welcher kanonischen Phase gehört ein Titel bzw. Schlüssel (rein)? `dach` = über ein Dach-Thema zugeordnet (z. B. „Strategie“ → Diagnose).
 * Wörter der Phasen zählen vor den Dach-Themen („Umsetzung & Steuerung“ ist Umsetzung). Nichts davon → null (eigene Phase).
 */
export function phaseVon(titel: string): { id: PhaseSchluessel; dach: boolean } | null {
  const t = titelForm(titel);
  const woerter = t.split(' ');
  const passt = (w: string) => (w.includes(' ') ? ` ${t} `.includes(` ${w} `) : woerter.includes(w));
  for (const p of PHASEN) if (p.woerter.some(passt)) return { id: p.id, dach: false };
  for (const [w, id] of Object.entries(DACH_ZUORDNUNG)) if (passt(w)) return { id, dach: true };
  return null;
}

/** Rang einer Phase in der Reihenfolge: kanonisch nach `PHASEN`, eigene als Kern, „Weitere Bausteine“ am Ende. */
export function phasenRang(titel: string): number {
  const p = phaseVon(titel);
  if (p) return RANG[p.id];
  return titelForm(titel) === titelForm(WEITERE_BAUSTEINE) ? ENDE : KERN;
}

type Knotenartig = { id: string; elternId?: string; titel: string; rang: number };

/** Die Phasen (Ebene 2) in der Reihenfolge der Regel — stabil: gleicher Rang behält die bisherige Reihenfolge. */
export function phasenSortiert<T extends Knotenartig>(phasen: readonly T[]): T[] {
  return phasen.map((p, i) => ({ p, r: phasenRang(p.titel), i })).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.p);
}

/**
 * Die vorhandene Phase für einen kanonischen Schlüssel (Import): bevorzugt die mit einem Wort der Phase im Titel, sonst eine zugeordnete
 * Dach-Phase (eine ältere „Strategie“ nimmt weiter Strategie-Bausteine auf — es entsteht keine zweite Phase daneben).
 */
export function phaseFinden<T extends Knotenartig>(phasen: readonly T[], id: PhaseSchluessel): T | undefined {
  return phasen.find(p => { const x = phaseVon(p.titel); return x?.id === id && !x.dach; }) ?? phasen.find(p => phaseVon(p.titel)?.id === id);
}

/**
 * Eine neue Phase unter der Wurzel an IHRER Stelle einfügen (rein): hinter der letzten Phase mit kleinerem oder gleichem Rang, sonst ganz
 * vorn. Die übrigen Phasen bleiben in ihrer Reihenfolge; die Ränge der Phasen werden lückenlos neu gezählt.
 */
export function phaseEinfuegen<T extends Knotenartig>(knoten: readonly T[], wurzelId: string, neu: T): T[] {
  const phasen = kinderVon(wurzelId, knoten);
  const r = phasenRang(neu.titel);
  let pos = 0;
  phasen.forEach((p, i) => { if (phasenRang(p.titel) <= r) pos = i + 1; });
  const reihe = [...phasen.slice(0, pos), neu, ...phasen.slice(pos)];
  const rang = new Map(reihe.map((p, i) => [p.id, i + 1]));
  return [...knoten, neu].map(k => (rang.has(k.id) ? { ...k, rang: rang.get(k.id)! } : k));
}

/** Knoten ohne eigene Angaben (nur Struktur) — darf beim Zusammenlegen wegfallen, ohne dass etwas verloren geht. */
export const hohlerVorlagenKnoten = (k: object): boolean => Object.keys(k).every(f => f === 'id' || f === 'elternId' || f === 'titel' || f === 'rang');
/** Fall-Knoten ohne eigene Angaben: Struktur und noch „offen“ (nie angefasst). */
export const hohlerFallKnoten = (k: object): boolean =>
  (k as { status?: string }).status === 'offen' && Object.keys(k).every(f => f === 'id' || f === 'elternId' || f === 'titel' || f === 'rang' || f === 'status');

/** Die Kinder von `quelle` unter `ziel` hängen (hinten an); ein gleichnamiges hohles Kind wird mit dem gleichnamigen am Ziel zusammengelegt. */
function hineinlegen<T extends Knotenartig>(liste: T[], quelle: string, ziel: string, hohl: (k: T) => boolean): T[] {
  let l = liste;
  for (const c of kinderVon(quelle, l)) {
    const da = kinderVon(ziel, l).find(x => x.id !== c.id && titelForm(x.titel) === titelForm(c.titel));
    if (da && hohl(c) && hohl(da)) {
      l = hineinlegen(l, c.id, da.id, hohl).filter(x => x.id !== c.id);
      continue;
    }
    const rang = kinderVon(ziel, l).reduce((m, x) => Math.max(m, x.rang), 0) + 1;
    l = l.map(x => (x.id === c.id ? { ...x, elternId: ziel, rang } : x));
  }
  return l;
}

/**
 * Die Phasen einer Paket-Vorlage bzw. eines Falls nach der Regel ordnen (rein; Säuberer beim Lesen). Mit `hohl`: eine Dach-Phase ohne eigene
 * Angaben wird mit der passenden vorhandenen Phase zusammengelegt (Schritte hängen dann dort). Ändert sich nichts, kommt dieselbe Liste zurück.
 */
export function phasenOrdnen<T extends Knotenartig>(knoten: T[], o: { hohl?: (k: T) => boolean } = {}): T[] {
  const w = wurzelVon(knoten);
  if (!w) return knoten;
  let liste = knoten;
  if (o.hohl) {
    for (const p of kinderVon(w.id, liste)) {
      const x = phaseVon(p.titel);
      if (!x?.dach || !o.hohl(p)) continue;
      const ziel = kinderVon(w.id, liste).find(q => q.id !== p.id && phaseVon(q.titel)?.id === x.id && !phaseVon(q.titel)?.dach);
      if (!ziel) continue;
      liste = hineinlegen(liste, p.id, ziel.id, o.hohl).filter(k => k.id !== p.id);
    }
  }
  const phasen = kinderVon(w.id, liste);
  const sortiert = phasenSortiert(phasen);
  if (sortiert.every((p, i) => p === phasen[i])) return liste;
  const rang = new Map(sortiert.map((p, i) => [p.id, i + 1]));
  return liste.map(k => (rang.has(k.id) ? { ...k, rang: rang.get(k.id)! } : k));
}
