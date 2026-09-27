// ─── Sport · Gym: Übungen, e1RM (Epley), Verlauf, Vorlagen ───────────────────

import type { GymEinheit, Satz, Uebung, Vorlage } from './modell';

/** Grundbibliothek — klein, erweiterbar (eigene Übungen legt die Person im Bestand an). */
export const UEBUNGEN: Uebung[] = [
  { id: 'kniebeuge', name: 'Kniebeuge', gruppe: 'beine' },
  { id: 'kreuzheben', name: 'Kreuzheben', gruppe: 'ruecken' },
  { id: 'bankdruecken', name: 'Bankdrücken', gruppe: 'brust' },
  { id: 'schulterdruecken', name: 'Schulterdrücken', gruppe: 'schulter' },
  { id: 'klimmzug', name: 'Klimmzug', gruppe: 'ruecken' },
  { id: 'rudern-lh', name: 'Rudern (Langhantel)', gruppe: 'ruecken' },
  { id: 'ausfallschritte', name: 'Ausfallschritte', gruppe: 'beine' },
  { id: 'hip-thrust', name: 'Hip Thrust', gruppe: 'beine' },
  { id: 'wall-ball', name: 'Wall Ball', gruppe: 'hyrox' },
  { id: 'sled-push', name: 'Sled Push', gruppe: 'hyrox' },
  { id: 'sled-pull', name: 'Sled Pull', gruppe: 'hyrox' },
  { id: 'farmers-carry', name: 'Farmers Carry', gruppe: 'hyrox' },
  { id: 'sandbag-lunges', name: 'Sandbag Lunges', gruppe: 'hyrox' },
  { id: 'burpee-broad-jump', name: 'Burpee Broad Jump', gruppe: 'hyrox' },
  { id: 'skierg', name: 'SkiErg', gruppe: 'hyrox' },
  { id: 'rudern-erg', name: 'Rudern (Ergometer)', gruppe: 'hyrox' },
  { id: 'plank', name: 'Plank', gruppe: 'rumpf' },
];

/** Vorlagen für Trainingstage — Vorschlag, keine Trainingsberatung. */
export const VORLAGEN: Vorlage[] = [
  { id: 'hyrox-kraft-a', name: 'Hyrox Kraft A (Unterkörper)', uebungen: [
    { uebung: 'kniebeuge', saetze: 4, wdh: '6' }, { uebung: 'ausfallschritte', saetze: 3, wdh: '12' }, { uebung: 'sled-push', saetze: 4, wdh: '25 m' }, { uebung: 'wall-ball', saetze: 3, wdh: '20' },
  ] },
  { id: 'hyrox-kraft-b', name: 'Hyrox Kraft B (Oberkörper & Zug)', uebungen: [
    { uebung: 'kreuzheben', saetze: 4, wdh: '5' }, { uebung: 'klimmzug', saetze: 4, wdh: '6' }, { uebung: 'sled-pull', saetze: 4, wdh: '25 m' }, { uebung: 'farmers-carry', saetze: 3, wdh: '100 m' },
  ] },
  { id: 'hyrox-stationen', name: 'Hyrox Stationen (Zirkel)', uebungen: [
    { uebung: 'skierg', saetze: 3, wdh: '500 m' }, { uebung: 'burpee-broad-jump', saetze: 3, wdh: '40 m' }, { uebung: 'rudern-erg', saetze: 3, wdh: '500 m' }, { uebung: 'sandbag-lunges', saetze: 3, wdh: '50 m' }, { uebung: 'wall-ball', saetze: 3, wdh: '25' },
  ] },
  { id: 'grundlagen-ganzkoerper', name: 'Grundlagen Ganzkörper', uebungen: [
    { uebung: 'kniebeuge', saetze: 3, wdh: '8' }, { uebung: 'bankdruecken', saetze: 3, wdh: '8' }, { uebung: 'rudern-lh', saetze: 3, wdh: '10' }, { uebung: 'schulterdruecken', saetze: 3, wdh: '10' }, { uebung: 'plank', saetze: 3, wdh: '45 s' },
  ] },
];

/** Alle Übungen: Bibliothek + eigene (eigene mit gleicher Kennung gewinnen). */
export function alleUebungen(eigene: Uebung[]): Uebung[] {
  const m = new Map<string, Uebung>(UEBUNGEN.map(u => [u.id, u]));
  for (const u of eigene) m.set(u.id, u);
  return [...m.values()];
}
export function alleVorlagen(eigene: Vorlage[]): Vorlage[] {
  const m = new Map<string, Vorlage>(VORLAGEN.map(v => [v.id, v]));
  for (const v of eigene) m.set(v.id, v);
  return [...m.values()];
}

/** Geschätztes 1RM nach Epley: kg × (1 + Wdh/30). Bei 1 Wdh das Gewicht selbst. */
export function e1rm(kg: number, wdh: number): number {
  if (!(kg > 0) || !(wdh > 0)) return 0;
  if (wdh === 1) return kg;
  return Math.round(kg * (1 + wdh / 30) * 10) / 10;
}

/** Bestes e1RM aus einer Satzliste. */
export function bestesE1rm(saetze: Satz[]): number {
  return saetze.reduce((b, s) => Math.max(b, e1rm(s.kg, s.wdh)), 0);
}

/** Volumen (kg × Wdh) einer Satzliste. */
export function volumen(saetze: Satz[]): number {
  return Math.round(saetze.reduce((s, x) => s + x.kg * x.wdh, 0));
}

export interface VerlaufPunkt { datum: string; einheitId: string; e1rm: number; topKg: number; volumen: number; saetze: number }

/** Verlauf einer Übung über alle Einheiten (älteste zuerst). */
export function verlauf(einheiten: GymEinheit[], uebung: string): VerlaufPunkt[] {
  const r: VerlaufPunkt[] = [];
  for (const e of einheiten) {
    const g = e.uebungen.filter(u => u.uebung === uebung).flatMap(u => u.saetze);
    if (!g.length) continue;
    r.push({ datum: e.datum, einheitId: e.id, e1rm: bestesE1rm(g), topKg: Math.max(...g.map(s => s.kg)), volumen: volumen(g), saetze: g.length });
  }
  return r.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

/** Bestes e1RM je Übung mit Datum. */
export function rekorde(einheiten: GymEinheit[]): Record<string, { e1rm: number; datum: string }> {
  const r: Record<string, { e1rm: number; datum: string }> = {};
  for (const e of einheiten) for (const u of e.uebungen) {
    const b = bestesE1rm(u.saetze);
    if (b > 0 && (!r[u.uebung] || b > r[u.uebung].e1rm)) r[u.uebung] = { e1rm: b, datum: e.datum };
  }
  return r;
}

/** Leere Sätze aus einer Vorlage (Gewicht aus dem letzten Mal, sonst 0). */
export function ausVorlage(v: Vorlage, einheiten: GymEinheit[]): { uebung: string; saetze: Satz[] }[] {
  return v.uebungen.map(u => {
    const letzte = einheiten.find(e => e.uebungen.some(x => x.uebung === u.uebung));
    const kg = letzte ? Math.max(...letzte.uebungen.filter(x => x.uebung === u.uebung).flatMap(x => x.saetze).map(s => s.kg)) : 0;
    const wdh = Number.parseInt(u.wdh, 10);
    return { uebung: u.uebung, saetze: Array.from({ length: u.saetze }, () => ({ kg, wdh: Number.isFinite(wdh) && wdh > 0 ? wdh : 8 })) };
  });
}
