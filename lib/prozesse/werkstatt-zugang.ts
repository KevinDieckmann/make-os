// ─── Prozesse — Tor der Werkstatt-Routen (Server, Etappe B1, 21.10.; ANALYSE_100.md Punkt 68) ─────────────────────────────────────────────────────────
// Klasse `modul:prozesse` im Routen-Register (`tor: 'werkstattZugang'`) — Prozesse sind ein eigenes Modul (einzeln verkaufbar; eine Instanz startet auch ohne);
// bis es Modul-Lizenzen gibt, gilt das Haushalts-Tor. Regeln (serverseitig, nie nur versteckt):
//   · fremder Haushalt, Testkunde ohne Haushalt, Dienstweg ohne bzw. mit fremder Person → 403 (`nurHaushalt`)
//   · `?space=privat` → 403: Prozesse gehören zum Business (die Middleware sperrt es über ROUTEN_BEREICH schon vorher; hier nochmals)
//   · `schreiben`: nur eine angemeldete Person (Dienstweg → 403 — ZOE, Takt und Skripte bauen keine Prozesse), Bau-Kennung (`bauPruefen`, fremd → 409)
//   · die Rechte der Person (lib/prozesse/rollen.ts): Entwurf bauen volle Mitglieder UND „nur Business“; veröffentlichen, Status, Webhook nur volle Mitglieder.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt } from '@/lib/zugang/tor';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';
import { bauPruefen } from '@/lib/bau/pruefen';
import { prozessRechte, type ProzessRechte } from './rollen';
import { prozesseHaushalt } from './werkstatt-server';

export interface WerkstattTor { person: string; dienst: boolean; haushalt: string; rechte: ProzessRechte }

/** Satz für Anfragen aus der Sicht Privat (eine Stelle). */
export const NUR_BUSINESS_PROZESSE = 'Prozesse gehören zum Business — in der Sicht Privat gibt es nichts davon.';

export async function werkstattZugang(req: Request, opt: { schreiben?: boolean } = {}): Promise<WerkstattTor | NextResponse> {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (sichtDerAnfrage(req) === 'privat') return NextResponse.json({ ok: false, fehler: NUR_BUSINESS_PROZESSE, andererBereich: true }, { status: 403 });
  if (opt.schreiben) {
    if (z.dienst) return NextResponse.json({ ok: false, fehler: 'Prozesse ändert nur eine angemeldete Person.' }, { status: 403 });
    const alt = bauPruefen(req);
    if (alt) return alt;
  }
  const { kontoSicht } = await import('@/lib/zugang/konto-sicht-server');
  const k = await kontoSicht(z.person);
  const rechte = prozessRechte({ imHaushalt: !!k?.imHaushalt, vollesMitglied: !!k?.vollesMitglied, inhaber: await istInhaber(z.person), nurBusiness: !!k?.nurBusiness, dienst: z.dienst });
  return { ...z, haushalt: await prozesseHaushalt(), rechte };
}
