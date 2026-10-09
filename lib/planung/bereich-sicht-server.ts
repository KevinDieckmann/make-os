// ─── Planung: wie viel von der GEMEINSAMEN Planung eine Person sieht (Server, 09.10., E4-Rest) ─────────────────────────────────────
// Routinen, Ziele und Meilensteine liegen in Beständen der Instanz (`routinen`, `ziele`, `meilensteine`) — sie gehören dem Haushalt der
// Inhaber. Wer liest, was einer Person aus diesen Beständen zusteht, fragt HIER (eine Regel, über die EINE Konto-Sicht):
//   · `alles`    — Person im Haushalt der Inhaber (volles Mitglied, Haupt-Inhaber ohne Haushalt-Eintrag) und der Systemlauf ohne Person.
//   · `business` — Konto „nur Business“ (`finanzRecht: 'business'`): ohne den Privat-Bereich (lib/planung/bereich-sicht.ts).
//   · `nichts`   — Person außerhalb des Haushalts (Testkunde ohne Haushalt, fremder Haushalt) oder Konten unlesbar (fail-closed). Vorher lasen
//                  Gesundheits-Stand und -Index die Routinen „für beide“ und die Meilensteine des Haushalts für JEDE angemeldete Person
//                  (Messlatte 09.10.: Testkunde und fremder Haushalt sahen die Planung des Haushalts).
// Eine Instanz ganz ohne Konten (erster Start, reine Rechen-Tests) hat niemanden zu trennen — dort gilt `alles` wie bisher; eine Sitzung
// kann es dort nicht geben (die Tore der Routen lehnen ohne Konto ab).

import { ladeKonten } from '@/lib/zugang/konten';
import { kontoSichtAus } from '@/lib/zugang/konto-sicht';
import { sichtbarFuer } from './routinen';
import { meilensteineOhnePrivat, routineImPrivat } from './bereich-sicht';
import type { Routine } from './typen';

export type PlanungsUmfang = 'alles' | 'business' | 'nichts';

/** Wie viel der gemeinsamen Planung `person` sieht. Ohne Person (Systemlauf) `alles`. */
export async function planungsUmfangFuer(person: string | null | undefined): Promise<PlanungsUmfang> {
  if (!person) return 'alles';
  try {
    const st = await ladeKonten();
    if (!st.konten.length) return 'alles';
    const k = kontoSichtAus(st, person);
    if (!k.imHaushalt) return 'nichts';
    return k.nurBusiness ? 'business' : 'alles';
  } catch {
    return 'nichts';
  }
}

/** Routinen im Umfang der Person (ohne „eigene und gemeinsame“ — für Leser, die die Routinen EINER ANDEREN Person zeigen). */
export async function routinenImUmfang<R extends { space?: string; einheit?: string }>(routinen: readonly R[], person: string | null | undefined): Promise<R[]> {
  const u = await planungsUmfangFuer(person);
  if (u === 'nichts') return [];
  return u === 'business' ? routinen.filter(r => !routineImPrivat(r as Pick<Routine, 'space' | 'einheit'>)) : [...routinen];
}

/** Routinen, die `person` sieht und abhakt: im Umfang (s. o.), dann eigene und gemeinsame (`sichtbarFuer`). */
export async function routinenSichtbarFuer<R extends { owner?: string; space?: string; einheit?: string }>(routinen: readonly R[], person: string): Promise<R[]> {
  return sichtbarFuer(await routinenImUmfang(routinen, person), person);
}

/** Meilensteine im Umfang der Person (ohne die Regel „eigene Ziele nur geteilt“ — die steht in ./eigene-ziele-sicht-server.ts). */
export async function meilensteineImUmfang<M>(liste: readonly M[], person: string | null | undefined): Promise<M[]> {
  const u = await planungsUmfangFuer(person);
  if (u === 'nichts') return [];
  return u === 'business' ? meilensteineOhnePrivat(liste as readonly (M & { space?: unknown })[]) as M[] : [...liste];
}
