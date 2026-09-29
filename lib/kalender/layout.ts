// ─── Kalender: Überlappende Termine nebeneinander legen (rein, getestet) ────
// Wie Google Kalender: Termine, die sich zeitlich überschneiden, teilen sich
// die Breite der Spalte; eine zusammenhängende Gruppe bekommt so viele
// Spalten, wie sich höchstens gleichzeitig überlappen.

import { montagVon } from '@/lib/zeit/kalender-kern';

export interface Lage { id: string; von: number; bis: number }
export interface Platz { id: string; spalte: number; spalten: number }

/** Minuten-Intervalle → Spalte je Termin. Gleichzeitige Gruppen unabhängig voneinander. */
export function spaltenLegen(liste: Lage[]): Platz[] {
  const sortiert = [...liste].sort((a, b) => a.von - b.von || (b.bis - b.von) - (a.bis - a.von));
  const raus: Platz[] = [];
  let gruppe: { lage: Lage; spalte: number }[] = [];
  let gruppenEnde = -Infinity;
  const schliesse = () => {
    const spalten = gruppe.reduce((m, g) => Math.max(m, g.spalte + 1), 0);
    for (const g of gruppe) raus.push({ id: g.lage.id, spalte: g.spalte, spalten });
    gruppe = [];
  };
  for (const l of sortiert) {
    if (gruppe.length && l.von >= gruppenEnde) schliesse();
    // Erste freie Spalte in der Gruppe (frei = kein Termin dieser Spalte überlappt noch)
    const belegt = new Set(gruppe.filter(g => g.lage.bis > l.von).map(g => g.spalte));
    let spalte = 0; while (belegt.has(spalte)) spalte++;
    gruppe.push({ lage: l, spalte });
    gruppenEnde = Math.max(gruppenEnde, l.bis);
  }
  if (gruppe.length) schliesse();
  return raus;
}

/** Wochen-/Monatsrechnung: Montag der Woche eines Tages — aus dem Kalender-Kern (29.09., K2). */
export { montagVon };

/** Die 42 Tage (6 Wochen) eines Monatsblatts, beginnend am Montag vor dem 1. */
export function monatsblatt(jahr: number, monat: number): string[] {
  const erster = `${jahr}-${String(monat).padStart(2, '0')}-01`;
  const start = montagVon(erster);
  const d = new Date(`${start}T12:00:00`);
  return Array.from({ length: 42 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; });
}

/**
 * Aufziehen im Raster (29.09., K1, wie Google): Anfang und aktuelle Position (Minuten seit Mitternacht) → Spanne im
 * 15-Minuten-Raster, in beide Richtungen, mindestens ein Rasterschritt, innerhalb des Tages.
 */
export function ziehSpanne(a: number, b: number, raster = 15): { von: number; bis: number } {
  const s = (m: number) => Math.max(0, Math.min(24 * 60, Math.round(m / raster) * raster));
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const von = Math.min(24 * 60 - raster, Math.floor(Math.max(0, lo) / raster) * raster);
  return { von, bis: Math.max(von + raster, s(hi)) };
}

/** „4–5 Uhr“, „9:30–10:15 Uhr“, „23–0 Uhr“ — die Vorschau beim Aufziehen. */
export function spanneText(von: number, bis: number): string {
  const t = (m: number) => { const h = Math.floor(m / 60) % 24, mi = m % 60; return mi ? `${h}:${String(mi).padStart(2, '0')}` : `${h}`; };
  return `${t(von)}–${t(bis)} Uhr`;
}
