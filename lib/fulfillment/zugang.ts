// ─── Fulfillment — Tor der Routen (Server, C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 9) ─────────────────────────────────────────
// Klasse `modul:fulfillment` im Routen-Register (lib/zugang/routen-register.ts, `tor: 'fulfillmentZugang'`): bis es Modul-Lizenzen gibt,
// gilt das Haushalts-Tor (`imHaushaltDesInhabers`). Dazu je Route in EINER Zeile:
//   const z = await fulfillmentZugang(req, { schreiben: true });  if (z instanceof Response) return z;
// Regeln (serverseitig, nie nur versteckt — Plattform-Regel):
//   · fremder Haushalt, Testkunde ohne Haushalt, Dienstweg mit fremder Person → 403 (`nurHaushalt`)
//   · `?space=privat` → 403: Fulfillment ist Business (die Middleware sperrt es über ROUTEN_BEREICH schon vorher; hier nochmals)
//   · `schreiben`: nur eine angemeldete Person (Dienstweg → 403), Bau-Kennung (`bauPruefen`, fremde → 409 „neu laden“)
//   · `inhaber`: nur ein Inhaber (z. B. Kunden-Link-Schalter) → sonst 403
//   · `privat` (25.10., Fulfillment für die Selbstständigkeit): darf die Anfrage Fälle/Mandate einer Privat-Arbeits-Einheit sehen? Nur ein Konto mit Privat-Recht
//     (Konto-Sicht `privat` — nie `finanzRecht: 'business'`) und nicht die ausdrückliche Business-Sicht `?space=business`. Jede Antwort filtert damit
//     (`mandatInSicht`, lib/fulfillment/regeln.ts); Lesen/Schreiben EINES solchen Mandats ohne Recht → `mandatAusserSicht` (404 bzw. 403).
// `personenteilZugang` (Personenteil der Dossiers, C3): zusätzlich nur der Inhaber oder ein Mitglied OHNE `finanzRecht: 'business'` → sonst 403.
// `vorlagenZugang` (Prozess-Editor, 17.10.): Abläufe SEHEN alle mit dem Fulfillment-Tor; BEARBEITEN nur volle Mitglieder (Inhaber bzw. ohne
// `finanzRecht: 'business'`) — die Rolle „nur Business“ sieht nur, Schreiben → 403. Dieselbe Regel (`darfVorlagenBearbeiten`) prüft der alte Baum-Weg.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt, nurDerInhaber } from '@/lib/zugang/tor';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';
import { bauPruefen } from '@/lib/bau/pruefen';
import { fulfillmentHaushalt } from './speicher';

export interface FulfillmentTor {
  person: string; dienst: boolean; haushalt: string;
  /** Sieht diese Anfrage Mandate einer Privat-Arbeits-Einheit (25.10.)? Konto mit Privat-Recht und nicht `?space=business`. */
  privat: boolean;
}

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
  const { kontoSicht } = await import('@/lib/zugang/konto-sicht-server');
  const privat = !!(await kontoSicht(z.person))?.privat && sichtDerAnfrage(req) !== 'business';
  return { ...z, haushalt: await fulfillmentHaushalt(), privat };
}

/** Satz, wenn ein Konto „nur Business“ bzw. die Business-Sicht ein Mandat einer Privat-Arbeits-Einheit ändern will (ein Satz, überall gleich). */
export const NICHT_IN_DIESER_SICHT = 'Dieses Mandat gehört zum Privat-Bereich — in dieser Sicht nicht freigegeben.';
/**
 * Ein Mandat außerhalb der Sicht der Anfrage (25.10.)? Gehört es zu einer Privat-Arbeits-Einheit und darf die Anfrage kein Privat sehen (`tor.privat`), kommt die
 * Antwort: Lesen 404 (derselbe Satz wie „gibt es nicht“ — die Existenz bleibt verborgen), Schreiben 403. Sonst null (unbekannte Mandate entscheidet die Route).
 */
export async function mandatAusserSicht(z: Pick<FulfillmentTor, 'privat'>, mandatId: unknown, art: 'lesen' | 'schreiben'): Promise<NextResponse | null> {
  if (z.privat || typeof mandatId !== 'string' || !mandatId) return null;
  const [{ ladeCrm }, { istPrivatArbeitsMandat }] = await Promise.all([import('@/lib/crm/speicher'), import('./regeln')]);
  const m = (await ladeCrm()).mandate.find(x => x.id === mandatId);
  if (!m || !istPrivatArbeitsMandat(m.gesellschaft)) return null;
  return art === 'lesen'
    ? NextResponse.json({ ok: false, fehler: 'Dieses Mandat gibt es nicht (mehr).' }, { status: 404 })
    : NextResponse.json({ ok: false, fehler: NICHT_IN_DIESER_SICHT }, { status: 403 });
}

/**
 * Die Mandate, die eine Sicht OHNE Privat-Recht nicht bekommt (25.10.): alle Mandate der Privat-Arbeits-Einheit — für Listen anderer Module, die nur Kennungen
 * tragen (Läufe der Prozesse: Fall = Mandat). Mit Privat-Recht leer. Server.
 */
export async function verborgeneMandate(privat: boolean): Promise<ReadonlySet<string>> {
  if (privat) return new Set();
  const [{ ladeCrm }, { istPrivatArbeitsMandat }] = await Promise.all([import('@/lib/crm/speicher'), import('./regeln')]);
  return new Set((await ladeCrm()).mandate.filter(m => istPrivatArbeitsMandat(m.gesellschaft)).map(m => m.id));
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

/** Satz der Sperre fürs Bearbeiten von Abläufen (Rolle „nur Business“) — ein Satz, überall gleich. */
export const VORLAGEN_NUR_LESEN = 'Abläufe bearbeiten nur volle Mitglieder — mit der Rolle „nur Business“ kannst du sie ansehen.';

/** Darf diese Person Abläufe (Prozess-Vorlagen) bearbeiten? Inhaber oder volles Mitglied im Haushalt (nicht „nur Business“). */
export async function darfVorlagenBearbeiten(person: string): Promise<boolean> {
  if (await istInhaber(person)) return true;
  const { kontoSicht } = await import('@/lib/zugang/konto-sicht-server');
  return !!(await kontoSicht(person))?.vollesMitglied;
}

/** Prozess-Editor (17.10.): das Fulfillment-Tor; mit `schreiben` zusätzlich nur volle Mitglieder (sonst 403). */
export async function vorlagenZugang(req: Request, opt: { schreiben?: boolean } = {}): Promise<FulfillmentTor | NextResponse> {
  const z = await fulfillmentZugang(req, opt);
  if (z instanceof NextResponse) return z;
  if (opt.schreiben && !(await darfVorlagenBearbeiten(z.person))) return NextResponse.json({ ok: false, fehler: VORLAGEN_NUR_LESEN }, { status: 403 });
  return z;
}
