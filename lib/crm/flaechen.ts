// ─── Markttraktion — Flächen der drei Welten (27.09., rein) ─────────────────
// Kevin: „Mach bitte das Widget-Thema bei Sales, Marketing und Events noch mit
// rein.“ Die Start-Ansicht je Reiter ist eine Fläche (components/os/flaeche):
// je Person anordnen, Breite, ein-/ausblenden, Katalog-Widgets dazulegen. Die
// Unter-Reiter (Pillen) bleiben; tiefere Ansichten (Kampagnen, Event-Detail-
// Reiter) sind feste Karten. Hier steht die Standardanordnung als Daten — die
// Komponenten geben sie als `standard` an <Flaeche> und liefern je Kachel-Id
// den Inhalt; so ist die Reihenfolge testbar (tests/markttraktion-flaechen.test.ts)
// und der Standard wird nie gespeichert (istStandard).

import type { Breite, StandardPlatz } from '@/lib/flaeche/modell';

export type Welt = 'sales' | 'marketing' | 'event';
/** Seiten-Ids der Flächen (Route /api/state/flaeche?seite=…). */
export const FLAECHE: Record<Welt, string> = { sales: 'markttraktion-sales', marketing: 'markttraktion-marketing', event: 'markttraktion-event' };

export interface KachelDef { id: string; titel: string; breite: Breite }

/** Feste Karten je Welt in Standardreihenfolge — Breite in Sechsteln (2 = ⅓, 3 = ½, 4 = ⅔, 6 = voll). */
export const KACHELN: Record<Welt, KachelDef[]> = {
  sales: [
    { id: 'head', titel: 'Head of Sales', breite: 6 },
    { id: 'scoreboard', titel: 'Wochen-Scoreboard', breite: 6 },
    { id: 'trichter', titel: 'Sales-Trichter', breite: 3 },
    { id: 'kanal', titel: 'Kanal-Leistung', breite: 3 },
  ],
  marketing: [
    { id: 'strecke', titel: 'Marketing-Strecke', breite: 6 },
    { id: 'anfragen', titel: 'Anfragen', breite: 2 },
    { id: 'segmente', titel: 'Segmente', breite: 2 },
    { id: 'freigabe', titel: 'Wartet auf Freigabe', breite: 2 },
    { id: 'netzwerk', titel: 'LinkedIn-Netzwerk', breite: 3 },
    { id: 'je-person', titel: 'Beiträge je Person', breite: 3 },
    { id: 'wirkung', titel: 'Wirkung', breite: 6 },
    { id: 'duerfen', titel: 'Wen wir ansprechen dürfen', breite: 3 },
    { id: 'art14', titel: 'Art. 14 — Informationspflicht', breite: 3 },
    { id: 'quellen', titel: 'Woher Chancen kommen', breite: 3 },
    { id: 'stimme', titel: 'Stimme der Kunden', breite: 3 },
  ],
  event: [
    { id: 'head', titel: 'Head of Event', breite: 6 },
    { id: 'events', titel: 'Nächste Events', breite: 2 },
    { id: 'detail', titel: 'Gewähltes Event', breite: 4 },
    // Schmale Karten (⅓) stapeln sich links unter den Events, während rechts das gewählte Event steht (dichtes Raster).
    { id: 'nachfassen', titel: 'Nachfassen offen', breite: 2 },
    { id: 'wirkung', titel: 'Wirkung der Events', breite: 2 },
    // Reihen (03.10.): Fokus Innovation & Co. — Events, Gäste, Zusagen, Nachgefasst, Leads, Deals je Reihe (lib/crm/reihen.ts).
    { id: 'reihen', titel: 'Reihen', breite: 2 },
    { id: 'vergangen', titel: 'Vergangene Events', breite: 2 },
  ],
};

/** Die Kachel einer Welt — wirft bei unbekannter Id, damit ein Tippfehler nicht still eine leere Kachel erzeugt. */
export function kachel(welt: Welt, id: string): KachelDef {
  const k = KACHELN[welt].find(x => x.id === id);
  if (!k) throw new Error(`Unbekannte Kachel „${id}“ in der Fläche ${welt}.`);
  return k;
}

/** Standard der Fläche für <Flaeche standard={…}> — feste Karten in der Reihenfolge von KACHELN; je Welt dieselbe Referenz (stabile Abhängigkeit für Memos). */
const STANDARD = Object.fromEntries((Object.keys(KACHELN) as Welt[]).map(w => [w, KACHELN[w].map(k => ({ id: k.id, art: 'seite', breite: k.breite, titel: k.titel }))])) as Record<Welt, StandardPlatz[]>;
export const standardVon = (welt: Welt): StandardPlatz[] => STANDARD[welt];
