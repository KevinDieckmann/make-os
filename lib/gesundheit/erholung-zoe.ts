// ─── Erholung für ZOE (10.10.) — nur über den Art.-9-Weg ─────────────────────────────────────────────────────────────────────────
// EINE Zeile für den Kontext der auslösenden Person („Erholung heute“: Vorschlag aus den eigenen Körperwerten, fällige Programme, eigener
// Fokus-Satz). Aufgerufen NUR aus gatherBrain (lib/brain.ts) und dort NUR mit Einwilligung (b) der Person (`gesundheitFrei`) — nie für eine
// andere Person, nie ohne Einwilligung. Wirft nie (leer = nichts).

import { erholungKurz } from './erholung-server';
import { erholungZoeZeilen } from './erholung-lage';

export async function erholungZoeFuer(person: string, heute: string): Promise<string> {
  try {
    const k = await erholungKurz(person, heute);
    return k ? erholungZoeZeilen(k.s, heute, k.sicht.vorschlag) : '';
  } catch { return ''; }
}
