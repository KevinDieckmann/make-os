// ─── Messwerte der Datenschicht (29.09., Paket D-A #75/#87) ─────────────────────
// Engpässe (Import, Zusammenführen, Angebot) fielen bisher erst auf, wenn etwas hing.
// Hier sammelt der Prozess, was der Head of IT braucht — nur Zahlen, nie Inhalte:
//   · sperrWarten   Wartezeit auf die Schreibsperre eines Bestands (ms)
//   · sperrHalten   wie lange eine Schreibsperre gehalten wurde (ms)
//   · schreiben     Dauer einer Schreibung (verschlüsseln + fsync + rename, ms)
//   · 409 / 413     Konflikte (Stand veraltet) und abgelehnte Übergrößen
//   · Parse-Zeit je Bestand (letzte und größte, ms) und Bytes
// Ring je Art (die letzten 500 Werte) → p50/p99. Liegt auf globalThis, damit Hot-Reload
// und mehrfach geladene Module denselben Speicher sehen.

export type MessArt = 'sperrWarten' | 'sperrHalten' | 'schreiben';
export type ZaehlArt = '409' | '413' | 'sperrZeitlimit' | 'sicherungFehler' | 'klartextAbgelehnt';

const RING = 500;

interface Zustand {
  ringe: Record<MessArt, number[]>;
  zaehler: Record<ZaehlArt, number>;
  parse: Map<string, { letzteMs: number; maxMs: number; zeichen: number; zeit: number }>;
  /** Schreibdauer je Bestand (09.10., Agenten-Datenschicht): letzte/größte — für den HOI-Befund „Agenten-Bestände“. */
  schreib?: Map<string, { letzteMs: number; maxMs: number; zeit: number }>;
  seit: string;
}

const g = globalThis as unknown as { __makeosMesswerte?: Zustand };
const Z: Zustand = (g.__makeosMesswerte ??= {
  ringe: { sperrWarten: [], sperrHalten: [], schreiben: [] },
  zaehler: { '409': 0, '413': 0, sperrZeitlimit: 0, sicherungFehler: 0, klartextAbgelehnt: 0 },
  parse: new Map(),
  seit: new Date().toISOString(),
});

export function messe(art: MessArt, ms: number): void {
  const r = Z.ringe[art];
  r.push(Math.max(0, Math.round(ms * 10) / 10));
  if (r.length > RING) r.splice(0, r.length - RING);
}

export function zaehle(art: ZaehlArt, n = 1): void { Z.zaehler[art] = (Z.zaehler[art] ?? 0) + n; }

/** Schreibdauer eines Bestands (local-db `schreibeDatei`) — nur Name und Zahlen. */
export function schreibMessen(bestand: string, ms: number): void {
  const m = (Z.schreib ??= new Map());
  const alt = m.get(bestand);
  const w = Math.round(ms * 10) / 10;
  m.set(bestand, { letzteMs: w, maxMs: Math.max(alt?.maxMs ?? 0, w), zeit: Date.now() });
  if (m.size > 2000) m.delete(m.keys().next().value as string);
}

/** Größte gemessene Schreibdauer der Bestände, deren Name `passt` (ms) — oder null, wenn keiner gemessen ist. */
export function schreibMaxFuer(passt: (bestand: string) => boolean): number | null {
  let max: number | null = null;
  for (const [b, x] of Array.from(Z.schreib ?? new Map<string, { maxMs: number }>())) if (passt(b)) max = Math.max(max ?? 0, x.maxMs);
  return max;
}

export function parseMessen(bestand: string, ms: number, zeichen: number): void {
  const alt = Z.parse.get(bestand);
  Z.parse.set(bestand, { letzteMs: Math.round(ms * 10) / 10, maxMs: Math.max(alt?.maxMs ?? 0, Math.round(ms * 10) / 10), zeichen, zeit: Date.now() });
  if (Z.parse.size > 2000) Z.parse.delete(Z.parse.keys().next().value as string);
}

/** Quantil (0…1) einer Liste — rein. Leere Liste → null. */
export function quantil(werte: number[], q: number): number | null {
  if (!werte.length) return null;
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
}

export interface MessBild {
  seit: string;
  sperrWarten: { p50: number | null; p99: number | null; n: number };
  sperrHalten: { p50: number | null; p99: number | null; n: number };
  schreiben: { p50: number | null; p99: number | null; n: number };
  zaehler: Record<ZaehlArt, number>;
  /** die drei langsamsten Bestände beim Parsen (größte gemessene Zeit) */
  parseLangsam: { bestand: string; maxMs: number; mb: number }[];
}

export function messBild(): MessBild {
  const teil = (a: MessArt) => ({ p50: quantil(Z.ringe[a], 0.5), p99: quantil(Z.ringe[a], 0.99), n: Z.ringe[a].length });
  const parseLangsam = Array.from(Z.parse.entries())
    .sort((a, b) => b[1].maxMs - a[1].maxMs).slice(0, 3)
    .map(([bestand, p]) => ({ bestand, maxMs: p.maxMs, mb: Math.round((p.zeichen / 1_048_576) * 100) / 100 }));
  return { seit: Z.seit, sperrWarten: teil('sperrWarten'), sperrHalten: teil('sperrHalten'), schreiben: teil('schreiben'), zaehler: { ...Z.zaehler }, parseLangsam };
}

/** Nur für Tests. */
export function messwerteLeeren(): void {
  for (const k of Object.keys(Z.ringe) as MessArt[]) Z.ringe[k] = [];
  for (const k of Object.keys(Z.zaehler) as ZaehlArt[]) Z.zaehler[k] = 0;
  Z.parse.clear();
  Z.schreib?.clear();
}
