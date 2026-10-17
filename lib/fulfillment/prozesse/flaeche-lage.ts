// ─── Fulfillment · Prozesse — die Lage einer Paket-Vorlage auf der Fläche (Prozess-Editor › Fläche, 17.10.) ─────────────────────────────────
// Rückmeldung 17.10.: „Zeichnen wie in Miro: freie Fläche, Kästen frei platzieren, Pfeile ziehen, zoomen und schieben, Rahmen für Phasen.“ EINE reine Stelle für
// die Lage (Server UND Browser, ohne DOM):
//   · `flaecheLage(knoten, formVon)` — wo jeder Rahmen (Phase), jeder Schritt, der Start jeder Phase und ihr Abstimmungspunkt stehen. Gespeichertes `pos` gilt
//     (Phase: Rahmen absolut; Schritt: relativ zu seinem Rahmen); was keine Lage hat, legt die Regel automatisch aus der Reihenfolge aus — so öffnet sich
//     jede bestehende Vorlage sofort sauber: Rahmen von links nach rechts in der Reihenfolge der Phasen, darin der Start, die Schritte untereinander, der
//     Nein-Zweig einer Entscheidung rechts daneben, der Abstimmungspunkt am Ende. Ein Rahmen ist nie kleiner als sein Inhalt.
//   · `rahmenOrdnen(knoten, formVon)` — die Regel für die Reihenfolge der Phasen: sie bleibt die Reise-Zeile (Rang). Stehen Rahmen mit Lage auf der Fläche
//     nicht mehr von links nach rechts in dieser Reihenfolge (z. B. nach dem Umsortieren in der Reise), rücken sie in die Reihe — die Höhe (y) bleibt.
// Tests: tests/fulfillment-flaeche-modell.test.ts.

import type { KnotenForm, KnotenLage, ProzessKnoten } from '../typen';
import { phasenAbschnitte, phasenDer, neinZiele } from './fluss-struktur';

/** Die drei Umrisse auf der Fläche: Kasten (Schritt, Nachricht, Erinnerung), Raute (Entscheidung, Abstimmung), Termin (breite, flache Beschriftung). */
export type FlUmriss = 'kasten' | 'raute' | 'termin';
export interface Box { x: number; y: number; b: number; h: number }

/** Maße der Fläche — alles in Bildpunkten der Fläche, auf dem Raster (`raster`) ausgerichtet. */
export const FL = {
  raster: 20,
  kasten: { b: 220, h: 100 },
  raute: { b: 180, h: 140 },
  termin: { b: 240, h: 60 },
  start: { b: 220, h: 60 },
  /** Innenabstand des Rahmens und Höhe seiner Titelzeile. */
  rand: 40, kopf: 80,
  /** Senkrecht zwischen zwei Knoten, waagerecht zwischen Entscheidung und Nein-Zweig, zwischen zwei Rahmen. */
  abstand: 60, seite: 80, rahmenAbstand: 120,
  /** Rand einer Gruppe (benannter Teilprozess) um ihre Schritte und Platz für ihren Titel. */
  gruppeRand: 16, gruppeKopf: 28,
} as const;

export const umrissMass = (u: FlUmriss): { b: number; h: number } => FL[u];
/** Der Umriss einer Form auf der Fläche. */
export const umrissVon = (f: KnotenForm): FlUmriss => (f === 'entscheidung' || f === 'abstimmung' ? 'raute' : f === 'termin' ? 'termin' : 'kasten');

type K = Pick<ProzessKnoten, 'id' | 'elternId' | 'titel' | 'rang' | 'bausteinId' | 'form' | 'zweige' | 'pos' | 'freigabe'>;

export interface LageKnoten extends Box { id: string; phaseId: string; rel: { x: number; y: number }; auto: boolean }
export interface LageRahmen extends Box { id: string; auto: boolean; /** Mindestgröße = Inhalt (Rahmen nie kleiner). */ inhalt: { b: number; h: number } }
export interface LageGruppe { id: string; phaseId: string; titel: string; box: Box }
export interface FlaecheLage {
  rahmen: LageRahmen[];
  knoten: Map<string, LageKnoten>;
  /** Start (Kreis) und Abstimmungspunkt (Raute) je Phase — keine eigenen Knoten, ihre Lage folgt dem Rahmen. */
  start: Map<string, Box>;
  abstimmung: Map<string, Box>;
  gruppen: LageGruppe[];
}

const mitte = (aussen: number, innen: number) => Math.round((aussen - innen) / 2);

/** Die Lage aller Teile auf der Fläche (siehe Kopf). `formVon` sagt den Umriss eines Schritts (Raute, Termin, sonst Kasten). */
export function flaecheLage(kn: readonly K[], formVon: (k: K) => FlUmriss): FlaecheLage {
  const nz = neinZiele(kn);
  const rahmen: LageRahmen[] = [];
  const knoten = new Map<string, LageKnoten>();
  const start = new Map<string, Box>();
  const abstimmung = new Map<string, Box>();
  const gruppen: LageGruppe[] = [];
  let vorher: LageRahmen | null = null;
  for (const P of phasenDer(kn)) {
    const abschnitte = phasenAbschnitte(kn, P.id);
    const schritte = abschnitte.flatMap(a => a.schritte);
    const rel = new Map<string, Box & { auto: boolean }>();
    const mass = (k: K) => umrissMass(formVon(k));
    for (const s of schritte) if (s.pos) rel.set(s.id, { x: s.pos.x, y: s.pos.y, ...mass(s), auto: false });
    const startBox: Box = { x: FL.rand, y: FL.kopf, ...FL.start };
    let cursor = startBox.y + startBox.h + FL.abstand;
    const fest = [...rel.values()];
    if (fest.length) cursor = Math.max(cursor, Math.max(...fest.map(r => r.y + r.h)) + FL.abstand);
    // Der Strang: Schritte ohne Lage untereinander, mittig unter dem Start.
    for (const s of schritte) {
      if (nz.has(s.id) || rel.has(s.id)) continue;
      const m = mass(s);
      rel.set(s.id, { x: FL.rand + mitte(FL.kasten.b, m.b), y: cursor, ...m, auto: true });
      cursor += m.h + FL.abstand;
    }
    // Nein-Zweige rechts neben ihrer Entscheidung (eine Kette von Entscheidungen rückt weiter nach rechts).
    for (let runde = 0; runde < 4; runde++) {
      for (const s of schritte) {
        if (!nz.has(s.id) || rel.has(s.id)) continue;
        const d = rel.get(nz.get(s.id)!);
        if (!d && runde < 3) continue;
        const m = mass(s);
        rel.set(s.id, d ? { x: d.x + d.b + FL.seite, y: d.y + mitte(d.h, m.h), ...m, auto: true } : { x: FL.rand + FL.kasten.b + FL.seite, y: cursor, ...m, auto: true });
        if (!d) cursor += m.h + FL.abstand;
      }
    }
    const alle = [...rel.values()];
    const unten = Math.max(startBox.y + startBox.h, ...alle.map(r => r.y + r.h));
    const abBox: Box | null = P.freigabe ? { x: FL.rand + mitte(FL.kasten.b, FL.raute.b), y: unten + FL.abstand, ...FL.raute } : null;
    const teile = [startBox, ...alle, ...(abBox ? [abBox] : [])];
    const inhalt = {
      b: Math.max(FL.rand * 2 + FL.kasten.b, ...teile.map(r => r.x + r.b + FL.rand)),
      h: Math.max(...teile.map(r => r.y + r.h + FL.rand)),
    };
    const lage: KnotenLage | undefined = P.pos;
    const x = lage ? lage.x : vorher ? vorher.x + vorher.b + FL.rahmenAbstand : 0;
    const y = lage ? lage.y : vorher ? vorher.y : 0;
    const R: LageRahmen = { id: P.id, x, y, b: Math.max(lage?.b ?? 0, inhalt.b), h: Math.max(lage?.h ?? 0, inhalt.h), auto: !lage, inhalt };
    rahmen.push(R);
    start.set(P.id, { ...startBox, x: x + startBox.x, y: y + startBox.y });
    if (abBox) abstimmung.set(P.id, { ...abBox, x: x + abBox.x, y: y + abBox.y });
    for (const s of schritte) {
      const r = rel.get(s.id)!;
      knoten.set(s.id, { id: s.id, phaseId: P.id, x: x + r.x, y: y + r.y, b: r.b, h: r.h, rel: { x: r.x, y: r.y }, auto: r.auto });
    }
    for (const a of abschnitte) {
      if (a.art !== 'gruppe' || !a.gruppe || !a.schritte.length) continue;
      const bs = a.schritte.map(s => knoten.get(s.id)!);
      const x0 = Math.min(...bs.map(r => r.x)) - FL.gruppeRand, y0 = Math.min(...bs.map(r => r.y)) - FL.gruppeRand - FL.gruppeKopf;
      const x1 = Math.max(...bs.map(r => r.x + r.b)) + FL.gruppeRand, y1 = Math.max(...bs.map(r => r.y + r.h)) + FL.gruppeRand;
      gruppen.push({ id: a.gruppe.id, phaseId: P.id, titel: a.gruppe.titel, box: { x: x0, y: y0, b: x1 - x0, h: y1 - y0 } });
    }
    vorher = R;
  }
  return { rahmen, knoten, start, abstimmung, gruppen };
}

/**
 * Die Reihenfolge der Phasen ist die Reise-Zeile (Rang) — auf der Fläche stehen die Rahmen von links nach rechts in dieser Reihenfolge. Haben Rahmen eine
 * Lage und stehen sie nicht mehr in der Reihenfolge (nach „Phase verschieben“ in der Reise oder einem Rahmen, der an einem anderen vorbeigezogen wurde), rücken
 * sie in die Reihe: der erste an die Stelle des am weitesten links stehenden, jeder weitere mit `FL.rahmenAbstand` hinter seinem Vorgänger; die Höhe bleibt.
 * Stehen sie schon in der Reihenfolge, bleibt alles, wie es ist (freie Lage, auch Überlappen).
 */
export function rahmenOrdnen<T extends K>(kn: readonly T[], formVon: (k: K) => FlUmriss): T[] {
  const phasen = phasenDer(kn);
  const mitLage = phasen.filter(p => p.pos);
  if (mitLage.length < 2 || mitLage.every((p, i) => i === 0 || p.pos!.x >= mitLage[i - 1].pos!.x)) return [...kn];
  const lage = flaecheLage(kn, formVon);
  const breite = new Map(lage.rahmen.map(r => [r.id, r.b]));
  let x = Math.min(...mitLage.map(p => p.pos!.x));
  const neu = new Map<string, number>();
  for (const p of phasen) {
    if (p.pos) neu.set(p.id, x);
    x += (breite.get(p.id) ?? FL.kasten.b) + FL.rahmenAbstand;
  }
  return kn.map(k => (neu.has(k.id) && k.pos && k.pos.x !== neu.get(k.id) ? { ...k, pos: { ...k.pos, x: neu.get(k.id)! } } : k));
}
