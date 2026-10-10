// ─── Fulfillment — Tor der Routen (Server, C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 9) ─────────────────────────────────────────
// Klasse `modul:fulfillment` im Routen-Register (lib/zugang/routen-register.ts, `tor: 'fulfillmentZugang'`): bis es Modul-Lizenzen gibt,
// gilt das Haushalts-Tor (`imHaushaltDesInhabers`). Dazu je Route in EINER Zeile:
//   const z = await fulfillmentZugang(req, { schreiben: true });  if (z instanceof Response) return z;
// Regeln (serverseitig, nie nur versteckt — Plattform-Regel):
//   · fremder Haushalt, Testkunde ohne Haushalt, Dienstweg mit fremder Person → 403 (`nurHaushalt`)
//   · `?space=privat` → 403: Fulfillment ist Business (die Middleware sperrt es über ROUTEN_BEREICH schon vorher; hier nochmals)
//   · `schreiben`: nur eine angemeldete Person (Dienstweg → 403), Bau-Kennung (`bauPruefen`, fremde → 409 „neu laden“)
//   · `inhaber`: nur ein Inhaber (z. B. Kunden-Link-Schalter) → sonst 403
// `personenteilZugang` (Personenteil der Dossiers, C3): zusätzlich nur der Inhaber oder ein Mitglied OHNE `finanzRecht: 'business'` → sonst 403.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt, nurDerInhaber } from '@/lib/zugang/tor';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';
import { bauPruefen } from '@/lib/bau/pruefen';
import { fulfillmentHaushalt } from './speicher';

export interface FulfillmentTor { person: string; dienst: boolean; haushalt: string }

/** Satz für Anfragen aus der Sicht Privat (eine Stelle). */
export const NUR_BUSINESS_FULFILLMENT = 'Fulfillment gehört zum Business — in der Sicht Privat gibt es nichts davon.';

export async function fulfillmentZugang(req: Request, opt: { schreiben?: boolean; inhaber?: boolean } = {}): Promise<FulfillmentTor | NextResponse> {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (sichtDerAnfrage(req) === 'privat') return NextResponse.json({ ok: false, fehler: NUR_BUSINESS_FULFILLMENT, andererBereich: true }, { status: 403 });
  if (opt.schreiben) {
    if (z.dienst) return NextResponse.json({ ok: false, fehler: 'Fulfillment ändert nur eine angemeldete Person.' }, { status: 403 });
    const alt = bauPruefen(req);
    if (alt) return alt;
  }
  if (opt.inhaber && !(await istInhaber(z.person))) return nurDerInhaber();
  return { ...z, haushalt: await fulfillmentHaushalt() };
}

/** Satz der Sperre für den Personenteil (ein Satz, überall gleich). */
export const PERSONENTEIL_GESPERRT = 'Den Personenteil der Dossiers sehen nur der Inhaber und Mitglieder mit vollem Zugang.';

/** Personenteil der Dossiers (C3): das Fulfillment-Tor und zusätzlich Inhaber oder Mitglied ohne `finanzRecht: 'business'`. */
export async function personenteilZugang(req: Request, opt: { schreiben?: boolean } = {}): Promise<FulfillmentTor | NextResponse> {
  const z = await fulfillmentZugang(req, opt);
  if (z instanceof NextResponse) return z;
  if (await istInhaber(z.person)) return z;
  const { kontoSicht } = await import('@/lib/zugang/konto-sicht-server');
  const k = await kontoSicht(z.person);
  if (!k || k.nurBusiness || !k.imHaushalt) return NextResponse.json({ ok: false, fehler: PERSONENTEIL_GESPERRT }, { status: 403 });
  return z;
}
