// ─── Kalender — welcher Bereich für welches Konto? (Gesamtprüfung 12.10.) ──────────────────────────────────────────────────────────
// Konten „nur Business“ (`finanzRecht: 'business'`, EINE Konto-Sicht lib/zugang/konto-sicht.ts) sehen den Haushalts-Kalender IMMER nur im
// Business-Bereich — auch ohne bzw. mit anderem `?space=`. Vorher kamen über GET /api/kalender und /api/apple-calendar Termine aus Privat-
// Kalendern mit Titel an (z. B. ein Abendessen im Kalender „Privat“), /api/kalender/jahr zählte den Privat-Kalender mit, und über
// /api/kalender/termin ließ sich in Privat-Kalender schreiben. Eigene Datei (nicht lib/kalender/zugang.ts), weil viele Tests das Tor dort
// ersetzen. Ein unlesbarer Konten-Bestand wirft (nie still alles zeigen). Wächter: tests/gesamt-ablaeufe.test.ts.

import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';
import { sichtDerAnfrage, type Sicht } from '@/lib/zugang/sicht-bereich';

/** Darf diese Person nur den Business-Bereich des Kalenders sehen und beschreiben? Systemlauf (ohne Person) → nein. */
export const kalenderNurBusiness = (person: string | null | undefined): Promise<boolean> => privatAusgeblendetFuer(person);

/** Der wirksame Bereich einer Kalender-Anfrage: „nur Business“ → immer `business`, sonst `?space=` wie bisher (`sichtDerAnfrage`). */
export async function kalenderBereich(req: Request, person: string | null | undefined): Promise<{ bereich: Sicht | null; nurBusiness: boolean }> {
  const nurBusiness = await kalenderNurBusiness(person);
  return nurBusiness ? { bereich: 'business', nurBusiness } : { bereich: sichtDerAnfrage(req), nurBusiness };
}
