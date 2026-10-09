// ─── Jahresziele für eine Person — EINE Lesestelle für den Agenten-Überblick und den Kontext von ZOE und den Heads (Durchstich 09.10.) ─
// Kevin 09.10.: „Bekommen Heads/ZOE Ziele … so, wie die Seite sie zeigt?“ — Vorher zeigte der Agenten-Bereich „Jahresziele“, ZOE und die
// Heads kannten sie aber nicht (das Brain trug nur Nordstern und Business-Meilensteine). Jetzt liest beides HIER:
//   • Bestand `ziele` (geteilte Ziele des Haushalts), Horizont Jahr, offen, Jahr über `zielJahr` (laufendes Jahr, Berliner Tag);
//   • Bereich über `wirksamerSpace` (Privat-Einheit → privat) — nie `z.space` direkt;
//   • Privat-Ziele nur für volle Mitglieder (Konto mit Haushalt, nicht „nur Business“) — dieselbe Regel wie die Agenten-Sicht.
// Lesen schreibt nie; Fehler → leere Liste (der Kontext sagt dann „keine hinterlegt“).

import { loadJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { zielJahr } from './zeitstrahl';
import { wirksamerSpace } from './bereich';
import type { ZieleDatei } from './typen';

export interface JahreszielKurz { id: string; titel: string; bereich: 'privat' | 'business'; fortschritt: number | null }

/** Offene Jahresziele des laufenden Jahres, die diese Person sehen darf (Privat nur mit `privat`). */
export async function jahreszieleFuer(o: { privat: boolean; heute?: string }): Promise<JahreszielKurz[]> {
  try {
    const jahr = Number((o.heute ?? localDay()).slice(0, 4));
    const d = await loadJson<ZieleDatei>('ziele');
    const raus: JahreszielKurz[] = [];
    for (const z of d?.jahr ?? []) {
      if (z.erledigt || zielJahr(z, jahr) !== jahr) continue;
      const bereich = wirksamerSpace(z) === 'privat' ? 'privat' : 'business';
      if (bereich === 'privat' && !o.privat) continue;
      raus.push({ id: z.id, titel: z.titel, bereich, fortschritt: typeof z.fortschritt === 'number' ? z.fortschritt : null });
    }
    return raus;
  } catch {
    return [];
  }
}
