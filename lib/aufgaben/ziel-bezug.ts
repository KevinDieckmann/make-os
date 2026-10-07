// ─── Aufgaben → Ziel (rein, client- und server-sicher, 03.10. · erweitert 07.10. „Seil“) ──
// Kevin: „immer der Fokus auf die Ziele“ — wo eine Aufgabe (oder ein Termin mit Aufgabe) auf ein Ziel einzahlt, zeigt die Oberfläche
// es ruhig als Chip in der Ziel-Farbe. Die Farbe rechnet hier niemand: sie kommt fertig vom Server (`farbe` je Ziel,
// lib/planung/ziel-farben-server.ts) — dieselbe wie in den Lichtfäden.
//
// Das WIRKSAME Ziel einer Aufgabe — EINE Regel (`zielVonAufgabe`), alle Leser nur darüber (Chip, Seil, Detail, ZOE):
//   1. Die Aufgabe liegt in der Liste eines Meilensteins (`meilensteinListeId`) → das Ziel des Meilensteins (`zielVonMeilenstein`).
//   2. Ihr eigenes `zielId` (07.10., „zahlt ein auf …“, von Hand gewählt).
//   3. Der nächste Vorfahre mit eigenem `zielId` (Unteraufgaben erben).
//   4. Das `zielId` ihres Projekts.
// Ein unbekanntes/gelöschtes Ziel zählt nicht (dann gilt die nächste Stufe). Gespeichert wird nur, was jemand ausdrücklich wählt.

import { meilensteinListeId, zielVonMeilenstein } from '@/lib/planung/meilenstein-aufgaben';

export interface ZielRoh { id: string; titel: string; farbe: string }
export interface MeilensteinRoh { id: string; titel: string; zielId?: string; abgeleitetVon?: string }
/** Woher der Bezug kommt: über den Meilenstein, direkt an der Aufgabe, von einer Hauptaufgabe oder vom Projekt. */
export type ZielUeber = 'meilenstein' | 'aufgabe' | 'eltern' | 'projekt';
export interface ZielBezug { zielId: string; zielTitel: string; farbe: string; meilensteinId?: string; meilensteinTitel?: string; ueber: ZielUeber }

/** Was `zielVonAufgabe` von einer Aufgabe braucht. */
export interface AufgabeZielRoh { id: string; listeId?: string; zielId?: string; parentId?: string; projectId?: string }
export interface ZielKontext {
  /** Liste eines Meilensteins → Kennung seines Ziels (und des Meilensteins). */
  msListe: ReadonlyMap<string, { zielId: string; meilensteinId: string }>;
  /** Alle Aufgaben (für die Vorfahren). */
  nachId?: ReadonlyMap<string, AufgabeZielRoh>;
  /** Projekte → ihr Ziel. */
  projekte?: ReadonlyMap<string, { zielId?: string }>;
  /** Lebt das Ziel (steht es im Bestand)? */
  lebt: (zielId: string) => boolean;
}

/** Liste eines Meilensteins → Ziel/Meilenstein (nur Meilensteine mit Ziel). */
export function msListeKarte(meilensteine: readonly Pick<MeilensteinRoh, 'id' | 'zielId' | 'abgeleitetVon'>[]): Map<string, { zielId: string; meilensteinId: string }> {
  const aus = new Map<string, { zielId: string; meilensteinId: string }>();
  for (const m of meilensteine) {
    const z = zielVonMeilenstein(m);
    if (z) aus.set(meilensteinListeId(m.id), { zielId: z, meilensteinId: m.id });
  }
  return aus;
}

/** Das wirksame Ziel einer Aufgabe (siehe Kopf) — null ohne Ziel. Kreisfest (höchstens 16 Vorfahren). */
export function zielVonAufgabe(t: AufgabeZielRoh | undefined | null, k: ZielKontext): { zielId: string; ueber: ZielUeber; meilensteinId?: string } | null {
  if (!t) return null;
  const ms = t.listeId ? k.msListe.get(t.listeId) : undefined;
  if (ms && k.lebt(ms.zielId)) return { zielId: ms.zielId, ueber: 'meilenstein', meilensteinId: ms.meilensteinId };
  if (t.zielId && k.lebt(t.zielId)) return { zielId: t.zielId, ueber: 'aufgabe' };
  const gesehen = new Set([t.id]);
  let pid = t.parentId;
  let wurzel: AufgabeZielRoh = t;
  for (let n = 0; pid && n < 16 && !gesehen.has(pid); n++) {
    gesehen.add(pid);
    const e = k.nachId?.get(pid);
    if (!e) break;
    if (e.zielId && k.lebt(e.zielId)) return { zielId: e.zielId, ueber: 'eltern' };
    wurzel = e;
    pid = e.parentId;
  }
  const pz = k.projekte?.get(t.projectId ?? wurzel.projectId ?? '')?.zielId;
  if (pz && k.lebt(pz)) return { zielId: pz, ueber: 'projekt' };
  return null;
}

/** Liste eines Meilensteins (Kennung) → Ziel-Bezug. Meilensteine ohne (lebendes) Ziel kommen nicht vor. */
export function bezugNachListe(ziele: readonly ZielRoh[], meilensteine: readonly MeilensteinRoh[]): Map<string, ZielBezug> {
  const nachId = new Map(ziele.map(z => [z.id, z]));
  const aus = new Map<string, ZielBezug>();
  for (const m of meilensteine) {
    const zid = zielVonMeilenstein(m);
    const z = zid ? nachId.get(zid) : undefined;
    if (!z) continue;
    aus.set(meilensteinListeId(m.id), { zielId: z.id, zielTitel: z.titel, farbe: z.farbe, meilensteinId: m.id, meilensteinTitel: m.titel, ueber: 'meilenstein' });
  }
  return aus;
}

/**
 * Der Ziel-Bezug einer Aufgabe: zuerst über ihre Liste (Meilenstein), sonst — wenn `extra` mitkommt — direkt, über eine
 * Hauptaufgabe oder das Projekt (`zielVonAufgabe`). null ohne (lebendes) Ziel.
 */
export function bezugVonAufgabe(
  t: AufgabeZielRoh | { listeId?: string } | undefined | null,
  karte: ReadonlyMap<string, ZielBezug>,
  extra?: { ziele: ReadonlyMap<string, ZielRoh>; nachId?: ReadonlyMap<string, AufgabeZielRoh>; projekte?: ReadonlyMap<string, { zielId?: string }> },
): ZielBezug | null {
  const l = t?.listeId ? karte.get(t.listeId) : undefined;
  if (l) return l;
  if (!t || !extra || !('id' in t)) return null;
  const w = zielVonAufgabe(t, { msListe: new Map(), nachId: extra.nachId, projekte: extra.projekte, lebt: id => extra.ziele.has(id) });
  const z = w ? extra.ziele.get(w.zielId) : undefined;
  return w && z ? { zielId: z.id, zielTitel: z.titel, farbe: z.farbe, ueber: w.ueber } : null;
}
