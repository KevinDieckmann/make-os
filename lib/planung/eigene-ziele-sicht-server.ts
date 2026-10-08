// ─── MAKE OS — Eigene Ziele nur geteilt lesbar: Server-Seite (08.10., Kevin, Phase 0) ──────────────────────────────────
// Die Regel steht rein in eigene-ziele-sicht.ts; hier nur das Laden (Konten, Ziele des Haushalts). Nur lesen.

import { ladeKonten } from '@/lib/zugang/konten';
import { eigeneZieleLesbar, lesbareEigentuemer, verborgeneZielIds } from './eigene-ziele-sicht';

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
