// ─── Gesundheits-Module je Person — Server (09.10., PRIVATE_INHALTE_SUCHE.md Paket 2 › C) ───────────────────────────────
// Liest den wirksamen Modul-Stand einer Person: Körper-Profil (Einstellung) + ob ihre Tagebücher schon Einträge haben
// (Altbestand) → `moduleWirksam` (lib/gesundheit/module.ts, EINE Regel). Liest nur, schreibt nie — geschaltet wird allein über
// /api/gesundheit/koerper (Schritt `modul`, nur die Person selbst).
//
// Wer fragt, entscheidet der Aufrufer: hier gibt es keinen Personen-Parameter von außen. Ausgeliefert wird nur der wirksame
// Stand (an/aus) — nie die Einstellung oder Inhalte des Profils.

import { loadJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { koerperLaden } from './koerper-server';
import type { KoerperStand } from './koerper';
import { hatEintraege, moduleWirksam, modulAusText, type GesundheitModul, type ModulStand } from './module';

/** Hat die Person in den Beständen ihrer Module schon Einträge (Altbestand)? Bestandsnamen ausgeschrieben (Register-Wächter). */
export async function moduleBelegt(person: string): Promise<Record<GesundheitModul, boolean>> {
  const [haut, streak] = await Promise.all([
    loadJson<Record<string, unknown>>(speicherFuer('haut', person)),
    loadJson<Record<string, unknown>>(speicherFuer('streak', person)),
  ]);
  return { haut: hatEintraege(haut), serie: hatEintraege(streak) };
}

/** Wirksamer Modul-Stand + das eigene Körper-Profil (für Aufrufer, die den Namen des Reglers brauchen). */
export async function moduleUndKoerper(person: string): Promise<{ module: ModulStand; koerper: KoerperStand | null }> {
  const [{ koerper }, belegt] = await Promise.all([koerperLaden(person), moduleBelegt(person)]);
  return { module: moduleWirksam(koerper, belegt), koerper };
}

/** Wirksamer Modul-Stand der Person (an/aus je Modul). */
export async function moduleFuer(person: string): Promise<ModulStand> {
  return (await moduleUndKoerper(person)).module;
}

/** 409, wenn die Person in ein ausgeschaltetes Modul schreiben will — sonst null. Nach der Einwilligungs-Sperre aufrufen. */
export async function modulSchreibSperre(person: string, modul: GesundheitModul): Promise<Response | null> {
  if ((await moduleFuer(person))[modul]) return null;
  const { NextResponse } = await import('next/server');
  return NextResponse.json({ ok: false, error: modulAusText(modul), modul }, { status: 409 });
}
