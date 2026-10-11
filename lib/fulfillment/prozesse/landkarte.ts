// ─── Fulfillment · Prozesse — Landkarte „Hochhaus“: Lage der Kästen (C1, 10.10.; FULFILLMENT_KONZEPT.md 2.2, 6.1, 6.2) ─────────────────
// Gerechnet wird NUR hier (Vorbild Lichtfäden); die Komponente zeichnet die Kästen und Pfeile und rechnet nichts. Aufbau:
//   Dach (Steuerung) oben als eine Reihe · Etagen gestapelt (Etage 1 unten über dem Fundament, Kreislauf-Reihenfolge von unten nach oben) ·
//   Fundament (Unterstützung) als breite Reihe unten. Rechts laufen die Pfeile des Kreislaufs nach oben, links führt einer zurück nach unten
//   („zurück in den Kreis“). Je Kasten: Titel, Zone, wie viele Kunden gerade dort stehen (`kundenJeKnoten`), Sprung in den Drill-down.
// Deterministisch: gleiche Vorlage, gleiche Zähler, gleiche Breite → gleiche Lage. Rein und client-sicher.

import type { ProzessVorlage, Zone } from '../typen';
import { kinderVon } from '../regeln';
import { WEG } from '@/lib/wege';

export interface LandkartenKasten { id: string; x: number; y: number; b: number; h: number; titel: string; zone: Zone; anzahl: number; href: string; verweis?: string; unter: string[] }
export interface LandkartenPfeil { pfad: string; art: 'kreislauf' | 'zurueck' }
export interface LandkartenLage { breite: number; hoehe: number; kaesten: LandkartenKasten[]; pfeile: LandkartenPfeil[]; dach: { pfad: string } | null }

export const LANDKARTE_MASS = { rand: 12, seite: 34, dachH: 58, etageH: 52, fundamentH: 58, luecke: 8, giebel: 28 } as const;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Die Lage des Hochhauses für eine Breite (px). `zaehler` = Ergebnis von `kundenJeKnoten` (Knoten → Mandate). */
export function landkarteLage(v: Pick<ProzessVorlage, 'knoten'>, zaehler: Record<string, readonly string[]>, breite: number): LandkartenLage {
  const M = LANDKARTE_MASS;
  const wurzel = v.knoten.find(k => !k.elternId);
  const ebene2 = wurzel ? kinderVon(wurzel.id, v.knoten) : [];
  const nachZone = (z: Zone) => ebene2.filter(k => (k.zone ?? 'etage') === z);
  const dach = nachZone('dach'), etagen = nachZone('etage'), fundament = nachZone('fundament');
  const innenX = M.rand + M.seite, innenB = Math.max(160, breite - 2 * (M.rand + M.seite));
  const kaesten: LandkartenKasten[] = [];
  const kasten = (k: (typeof ebene2)[number], x: number, y: number, b: number, h: number, zone: Zone) => kaesten.push({
    id: k.id, x: r1(x), y: r1(y), b: r1(b), h, titel: k.titel, zone, anzahl: zaehler[k.id]?.length ?? 0,
    href: WEG.fulfillment('prozesse', { k: k.id }), ...(k.verweis ? { verweis: k.verweis } : {}),
    unter: kinderVon(k.id, v.knoten).map(x => x.titel).slice(0, 6),
  });
  const reihe = (l: typeof ebene2, y: number, h: number, zone: Zone) => {
    if (!l.length) return;
    const b = (innenB - M.luecke * (l.length - 1)) / l.length;
    l.forEach((k, i) => kasten(k, innenX + i * (b + M.luecke), y, b, h, zone));
  };
  let y = M.rand + (dach.length ? M.giebel : 0);
  const dachY = y;
  reihe(dach, y, M.dachH, 'dach');
  if (dach.length) y += M.dachH + M.luecke;
  // Etagen: Etage 1 (erste nach Rang) unten.
  const etageY0 = y;
  [...etagen].reverse().forEach((k, i) => kasten(k, innenX, y + i * (M.etageH + M.luecke), innenB, M.etageH, 'etage'));
  y += etagen.length * (M.etageH + M.luecke);
  reihe(fundament, y, M.fundamentH, 'fundament');
  if (fundament.length) y += M.fundamentH;
  const hoehe = r1(y + M.rand);

  const pfeile: LandkartenPfeil[] = [];
  const mitteY = (i: number) => etageY0 + (etagen.length - 1 - i) * (M.etageH + M.luecke) + M.etageH / 2;
  const rechts = innenX + innenB + 6, links = innenX - 6;
  for (let i = 0; i + 1 < etagen.length; i++) {
    const y1 = mitteY(i) - 8, y2 = mitteY(i + 1) + 8;
    pfeile.push({ art: 'kreislauf', pfad: `M ${r1(rechts)} ${r1(y1)} C ${r1(rechts + 22)} ${r1(y1 - 10)} ${r1(rechts + 22)} ${r1(y2 + 10)} ${r1(rechts)} ${r1(y2)}` });
  }
  if (etagen.length > 1) {
    const oben = mitteY(etagen.length - 1), unten = mitteY(0);
    pfeile.push({ art: 'zurueck', pfad: `M ${r1(links)} ${r1(oben)} C ${r1(links - 28)} ${r1(oben + 20)} ${r1(links - 28)} ${r1(unten - 20)} ${r1(links)} ${r1(unten)}` });
  }
  const dachPfad = dach.length
    ? { pfad: `M ${r1(innenX - 10)} ${r1(dachY - 4)} L ${r1(innenX + innenB / 2)} ${r1(M.rand)} L ${r1(innenX + innenB + 10)} ${r1(dachY - 4)}` }
    : null;
  return { breite, hoehe, kaesten, pfeile, dach: dachPfad };
}

/** Brotkrumen eines Knotens (Ebene 1 → … → Knoten). */
export function brotkrumen(v: Pick<ProzessVorlage, 'knoten'>, id: string): { id: string; titel: string }[] {
  const nach = new Map(v.knoten.map(k => [k.id, k]));
  const raus: { id: string; titel: string }[] = [];
  const gesehen = new Set<string>();
  let x = nach.get(id);
  while (x && !gesehen.has(x.id)) { raus.unshift({ id: x.id, titel: x.titel }); gesehen.add(x.id); x = x.elternId ? nach.get(x.elternId) : undefined; }
  return raus;
}
