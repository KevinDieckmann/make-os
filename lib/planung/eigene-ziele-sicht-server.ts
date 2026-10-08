// ─── MAKE OS — Eigene Ziele nur geteilt lesbar: Server-Seite (08.10., Kevin, Phase 0) ──────────────────────────────────
// Die Regel steht rein in eigene-ziele-sicht.ts; hier nur das Laden (Konten, Ziele des Haushalts, Meilensteine). Nur lesen.

import { loadJson } from '@/lib/store/local-db';
import { ladeKonten } from '@/lib/zugang/konten';
import { eigeneZieleLesbar, lesbareEigentuemer, meilensteinVerborgen, verborgeneMeilensteinIds, verborgeneZielIds } from './eigene-ziele-sicht';

/** Darf `betrachter` die eigenen Ziele von `eigentuemer` lesen? */
export async function eigeneZieleLesbarFuer(eigentuemer: string, betrachter: string | null | undefined): Promise<boolean> {
  if (betrachter && eigentuemer === betrachter) return true;
  return eigeneZieleLesbar((await ladeKonten()).konten, eigentuemer, betrachter);
}

/** Wessen eigene Ziele `betrachter` lesen darf (inklusive der eigenen; ohne Person: niemand). */
export async function lesbareEigentuemerFuer(betrachter: string | null | undefined): Promise<Set<string>> {
  if (!betrachter) return new Set();
  return lesbareEigentuemer((await ladeKonten()).konten, betrachter);
}

/** Kennungen der Ziele (alle Horizonte, alle Personen des Haushalts), die `betrachter` nicht lesen darf. */
export async function verborgeneZieleFuer(betrachter: string | null | undefined): Promise<Set<string>> {
  const [{ haushaltsZiele }, lesbar] = await Promise.all([import('./ziel-farben-server'), lesbareEigentuemerFuer(betrachter)]);
  return verborgeneZielIds(await haushaltsZiele(), lesbar);
}

type MsBezug = { id: string; zielId?: string; abgeleitetVon?: string };
const hatZiel = (m: { zielId?: string; abgeleitetVon?: string }) => !!(m.zielId || m.abgeleitetVon);

/**
 * Kennungen der Meilensteine, die `betrachter` nicht sehen darf (Altbestand: an einem nicht geteilten eigenen Ziel einer anderen
 * Person). Ohne Person (Systemlauf, Sammel-Ausgaben für alle): jeder Meilenstein an einem eigenen Ziel. `liste` = schon geladene
 * Meilensteine (sonst der Bestand). Ohne Ziel-Bezug im Bestand wird nichts weiter geladen.
 */
export async function verborgeneMeilensteineFuer(betrachter: string | null | undefined, liste?: readonly MsBezug[] | null): Promise<Set<string>> {
  const ms = liste ?? ((await loadJson<{ meilensteine?: MsBezug[] }>('meilensteine'))?.meilensteine ?? []);
  if (!Array.isArray(ms) || !ms.some(hatZiel)) return new Set();
  return verborgeneMeilensteinIds(ms, await verborgeneZieleFuer(betrachter));
}

/** Nur die Meilensteine, die `betrachter` sehen darf (ohne Person: keiner an einem eigenen Ziel). */
export async function meilensteineSichtbarFuer<M extends { zielId?: string; abgeleitetVon?: string }>(liste: readonly M[] | null | undefined, betrachter: string | null | undefined): Promise<M[]> {
  const l = Array.isArray(liste) ? liste : [];
  if (!l.some(hatZiel)) return [...l];
  const verborgen = await verborgeneZieleFuer(betrachter);
  return verborgen.size ? l.filter(m => !meilensteinVerborgen(m, verborgen)) : [...l];
}

/**
 * Kennungen der Aufgaben-Listen (`lm-…`) verborgener Meilensteine — für den neutralen Namen in der Aufgaben-Sicht und die Schreibsperre.
 * Kann der Bestand nicht gelesen werden: `null` (der Aufrufer behandelt dann JEDE Meilenstein-Liste als verborgen — nie Titel auf Verdacht).
 */
export async function verborgeneMeilensteinListenFuer(betrachter: string | null | undefined): Promise<Set<string> | null> {
  try {
    const ids = await verborgeneMeilensteineFuer(betrachter);
    if (!ids.size) return new Set();
    const { meilensteinListeId } = await import('./meilenstein-aufgaben');
    return new Set([...ids].map(meilensteinListeId));
  } catch {
    return null;
  }
}
