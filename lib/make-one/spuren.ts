// ─── MAKE OS — Überlappende Termine nebeneinander legen ─────────────────────
// Reine Rechenlogik, aus dem Wochenplaner herausgelöst (Härtung 04.08.),
// damit sie testbar ist und die Tagesansicht sie mitbenutzen kann.

import type React from 'react';

// ─── Überlappungen nebeneinander legen ──────────────────────────────────────
// Vorher lag jeder Termin auf voller Spaltenbreite (left:3, right:3). Zwei
// Termine zur selben Zeit deckten sich gegenseitig zu — am Donnerstag lagen
// „Vorbereitung Buchhaltung" und „Buchhaltung" komplett ineinander, und die
// Reha legte sich obendrauf.
//
// Das übliche Kalender-Verfahren: alles, was sich zeitlich berührt, bildet
// eine Traube. Innerhalb der Traube bekommt jeder Termin die erste Spur, in
// der er niemanden schneidet. Die Traube wird dann in so viele Spuren geteilt,
// wie die breiteste Stelle braucht — so behält jeder Termin seine echte Lage
// und wird trotzdem lesbar.

export interface Zeitspanne { id: string; startMin: number; dauerMin: number }
export interface Lage { spur: number; spuren: number }

export function verteileSpuren(items: Zeitspanne[]): Map<string, Lage> {
  const lage = new Map<string, Lage>();
  const sortiert = [...items].sort((a, b) => a.startMin - b.startMin || b.dauerMin - a.dauerMin);

  let traube: Zeitspanne[] = [];
  let traubenEnde = -1;

  /** Der Traube ihre Spuren geben — erst wenn feststeht, wie breit sie ist. */
  const abschliessen = () => {
    if (!traube.length) return;
    const spuren: Zeitspanne[][] = [];
    for (const it of traube) {
      const ende = it.startMin + it.dauerMin;
      // Erste Spur, in der nichts hineinragt. Berührung an der Kante (Ende ==
      // Start) ist keine Überlappung — sonst rutscht ein Termin grundlos zur Seite.
      let s = spuren.findIndex(sp => sp.every(x => x.startMin + x.dauerMin <= it.startMin || x.startMin >= ende));
      if (s < 0) { spuren.push([]); s = spuren.length - 1; }
      spuren[s].push(it);
    }
    for (const it of traube) {
      const s = spuren.findIndex(sp => sp.includes(it));
      lage.set(it.id, { spur: s, spuren: spuren.length });
    }
    traube = [];
    traubenEnde = -1;
  };

  for (const it of sortiert) {
    // Beginnt der Termin nach dem bisherigen Ende, fängt eine neue Traube an.
    if (traube.length && it.startMin >= traubenEnde) abschliessen();
    traube.push(it);
    traubenEnde = Math.max(traubenEnde, it.startMin + it.dauerMin);
  }
  abschliessen();
  return lage;
}

/**
 * Titel im Kästchen. Je enger die Spur, desto kleiner die Schrift — und ab
 * drei Spuren darf der Titel umbrechen statt abgeschnitten zu werden. Beim
 * Planen muss man lesen können, was da liegt; ein „🔒 …" hilft niemandem.
 */
export function titelStil(spuren: number, farbe: string): React.CSSProperties {
  if (spuren > 2) {
    return {
      fontSize: 9, lineHeight: 1.15, fontWeight: 700, color: farbe,
      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
      overflow: 'hidden', overflowWrap: 'anywhere', hyphens: 'auto',
    };
  }
  return {
    fontSize: spuren === 2 ? 9.5 : 10.5, lineHeight: 1.2, fontWeight: 700, color: farbe,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  };
}

/** Position eines Termins in Prozent — Rand bleibt in Pixeln, damit es atmet. */
export function spurStil(lage: Lage | undefined): { left: string; width: string } {
  const spuren = lage?.spuren ?? 1;
  const spur = lage?.spur ?? 0;
  if (spuren <= 1) return { left: '3px', width: 'calc(100% - 6px)' };
  const breite = 100 / spuren;
  // Leichte Überlappung der Kästchen ist gewollt: so bleibt bei drei Spuren
  // noch Text lesbar, und die Kante zeigt trotzdem, dass da etwas liegt.
  return { left: `calc(${spur * breite}% + 3px)`, width: `calc(${breite}% - 5px)` };
}

