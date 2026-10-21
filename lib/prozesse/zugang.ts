// ─── Prozesse — Tor der Routen (Server, Etappe A, 21.10.) ──────────────────────────────────────────────────────────────────────────────────
// Klasse `modul:prozesse` im Routen-Register (lib/zugang/routen-register.ts, `tor: 'prozesseZugang'`) — Prozesse sind ein eigenes Modul (Plattform-Regel:
// einzeln verkaufbar, eine Instanz startet auch ohne); bis es Modul-Lizenzen gibt, gilt das Haushalts-Tor. Regeln (serverseitig, nie nur versteckt):
//   · fremder Haushalt, Testkunde ohne Haushalt, Dienstweg ohne bzw. mit fremder Person → 403 (`nurHaushalt`)
//   · `?space=privat` → 403: Prozesse gehören zum Business (die Middleware sperrt es über ROUTEN_BEREICH schon vorher; hier nochmals)
//   · ein Konto „nur Business“ (`finanzRecht: 'business'`) darf lesen — die Antwort enthält ohnehin nur Business.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt } from '@/lib/zugang/tor';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';

/** Satz für Anfragen aus der Sicht Privat (eine Stelle). */
export const NUR_BUSINESS_PROZESSE = 'Prozesse gehören zum Business — in der Sicht Privat gibt es nichts davon.';

export async function prozesseZugang(req: Request): Promise<{ person: string; dienst: boolean } | NextResponse> {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (sichtDerAnfrage(req) === 'privat') return NextResponse.json({ ok: false, fehler: NUR_BUSINESS_PROZESSE, andererBereich: true }, { status: 403 });
  return z;
}
