// ─── MAKE OS — Zeit je Aufgabe (rein, 28.09. spät) ──────────────────────────
// Kevin: „Zeit je Aufgabe (Fokus-Zeit).“ Summe der bewussten Fokus-Blöcke, die auf die Aufgabe (oder eine ihrer
// Unteraufgaben) gebucht sind — je Person des Haushalts und gesamt. Die Zuordnung eines Blocks passiert im
// Zeit-Schreibweg (lib/zeitmessung/einheiten.ts `zuordnungSaeubern`, nur Business); hier wird nur gezählt.
// Route: GET /api/aufgaben/zeit?ids=<Aufgabe>,<Unteraufgabe>…

import type { ZeitDatei } from '@/lib/zeitmessung/modell';

export interface ZeitJeAufgabe {
  sek: number;
  bloecke: number;
  je: { person: string; name: string; sek: number }[];
  /** Je Aufgaben-Kennung (Aufgabe selbst, Unteraufgaben). */
  jeAufgabe: Record<string, number>;
  letzter?: string;
}

export function zeitJeAufgabe(dateien: readonly { person: string; name: string; datei: ZeitDatei }[], ids: readonly string[]): ZeitJeAufgabe {
  const gesucht = new Set(ids);
  const raus: ZeitJeAufgabe = { sek: 0, bloecke: 0, je: [], jeAufgabe: {} };
  for (const d of dateien) {
    let sek = 0;
    for (const tag of Object.values(d.datei?.tage ?? {})) {
      for (const b of tag.bloecke ?? []) {
        if (!b.aufgabeId || !gesucht.has(b.aufgabeId)) continue;
        const s = Math.max(0, Number(b.sek) || 0);
        sek += s; raus.bloecke++;
        raus.jeAufgabe[b.aufgabeId] = (raus.jeAufgabe[b.aufgabeId] ?? 0) + s;
        if (!raus.letzter || b.bis > raus.letzter) raus.letzter = b.bis;
      }
    }
    raus.sek += sek;
    if (sek) raus.je.push({ person: d.person, name: d.name, sek });
  }
  return raus;
}

/** 5400 → „1:30 h“, 600 → „10 min“. */
export function dauerText(sek: number): string {
  const min = Math.round(sek / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} h`;
}
