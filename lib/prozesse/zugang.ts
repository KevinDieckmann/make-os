// ─── Prozesse — das EINE Tor der Routen (Server; Etappe A 21.10., zusammengeführt mit dem Werkstatt-Tor in B2) ─────────────────────────────────────
// Klasse `modul:prozesse` im Routen-Register (lib/zugang/routen-register.ts; `tor: 'prozesseZugang'` bzw. der Name `werkstattZugang` — dieselbe Funktion,
// lib/prozesse/werkstatt-zugang.ts reicht sie nur weiter). Prozesse sind ein eigenes Modul (Plattform-Regel: einzeln verkaufbar, eine Instanz startet auch
// ohne); bis es Modul-Lizenzen gibt, gilt das Haushalts-Tor. Regeln (serverseitig, nie nur versteckt):
//   · fremder Haushalt, Testkunde ohne Haushalt, Dienstweg ohne bzw. mit fremder Person → 403 (`nurHaushalt`)
//   · `?space=privat` → 403: Prozesse gehören zum Business (die Middleware sperrt es über ROUTEN_BEREICH schon vorher; hier nochmals)
//   · `schreiben`: nur eine angemeldete Person (Dienstweg → 403 — ZOE, Takt und Skripte bauen keine Prozesse), Bau-Kennung (`bauPruefen`, fremd → 409)
//   · ein Konto „nur Business“ (`finanzRecht: 'business'`) liest und baut Entwürfe; veröffentlichen, Status, Webhook nur volle Mitglieder (lib/prozesse/rollen.ts)
// Bis 21.10. gab es zwei Tore mit fast gleicher Aufgabe (`prozesseZugang` für die Landkarte, `werkstattZugang` für Werkstatt und Katalog) — jetzt EINE Stelle.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt } from '@/lib/zugang/tor';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';
import { bauPruefen } from '@/lib/bau/pruefen';
import { prozessRechte, type ProzessRechte } from './rollen';

/** Satz für Anfragen aus der Sicht Privat (eine Stelle). */
export const NUR_BUSINESS_PROZESSE = 'Prozesse gehören zum Business — in der Sicht Privat gibt es nichts davon.';

export interface ProzesseTor { person: string; dienst: boolean; haushalt: string; rechte: ProzessRechte }

export async function prozesseZugang(req: Request, opt: { schreiben?: boolean } = {}): Promise<ProzesseTor | NextResponse> {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (sichtDerAnfrage(req) === 'privat') return NextResponse.json({ ok: false, fehler: NUR_BUSINESS_PROZESSE, andererBereich: true }, { status: 403 });
  if (opt.schreiben) {
    if (z.dienst) return NextResponse.json({ ok: false, fehler: 'Prozesse ändert nur eine angemeldete Person.' }, { status: 403 });
    const alt = bauPruefen(req);
    if (alt) return alt;
  }
  const [{ kontoSicht }, { prozesseHaushalt }] = await Promise.all([import('@/lib/zugang/konto-sicht-server'), import('./werkstatt-server')]);
  const k = await kontoSicht(z.person);
  const rechte = prozessRechte({ imHaushalt: !!k?.imHaushalt, vollesMitglied: !!k?.vollesMitglied, inhaber: await istInhaber(z.person), nurBusiness: !!k?.nurBusiness, dienst: z.dienst });
  return { ...z, haushalt: await prozesseHaushalt(), rechte };
}
