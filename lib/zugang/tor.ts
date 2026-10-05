// ─── MAKE OS — Tore für die Schnittstellen (05.10., Paket „Routen-Register + Zugangs-Wächter“) ─────────
// Eine Stelle für die Tor-Funktionen und ihre fertigen Antworten — damit eine Route ihre Prüfung in EINER Zeile am
// Anfang trägt und der Wächter (tests/routen-register.test.ts) sie am Namen erkennt:
//
//   if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();      // Haushalt des Inhabers (Person nötig)
//   if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();   // … oder Systemlauf (Dienstweg ohne Person)
//   if (!personStreng(req)) return ohnePerson();                         // eigene Daten der angemeldeten Person
//   if (!(await nurInhaber(req))) return nurDerInhaber();                // nur der Inhaber (oder Systemlauf)
//   if (!istDienst(req)) return nurDienstweg();                          // nur der interne Dienstweg
//   if (!(await privatFinanzZugang(req))) return keinFinanzZugang();     // private Haushaltsfinanzen (finanzRecht ≠ business)
//
// Welche Route welche Klasse hat, steht im Routen-Register (lib/zugang/routen-register.ts) — neue Route → Eintrag dort.

import { NextResponse } from 'next/server';
import { KARTEI_GESPERRT } from './haushalt-inhaber';
import { KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';

export { imHaushaltDesInhabers, imHaushaltOderSystemlauf, nurInhaber, istInhaber, inhaberSpeicher, personImHaushaltDesInhabers } from './haushalt-inhaber';
export { istDienst, istZulieferer } from './dienst';
export { personStreng, haushaltVon, privatFinanzZugang, planZugangVon } from '@/lib/finanzen/haushalt/zugriff';

const PERSON = /^[a-z0-9-]{1,40}$/;

/**
 * Die Person der SITZUNG — nie der Dienstweg (x-make-person). Für Konto-Wege, die nur die Person selbst am eigenen
 * Gerät auslösen darf (Adressen, Instanz-Einstellungen). Die Middleware setzt `x-make-user` nur aus einer gültigen Sitzung.
 */
export function personDerSitzung(req: Request): string | null {
  const p = req.headers.get('x-make-user');
  return p && PERSON.test(p) ? p : null;
}

/** 403: nur im Haushalt des Inhabers (anderer Haushalt, Konto ohne Haushalt, Dienstweg mit fremder Person). */
export const nurHaushalt = () => NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
/** 401: keine ausdrücklich benannte Person (z. B. Dienstweg ohne Person) — kein Rückfall auf eine feste Person. */
export const ohnePerson = () => NextResponse.json({ ok: false, fehler: 'Keine Person angemeldet.', error: 'Keine Person angemeldet.' }, { status: 401 });
/** 403: nur der Inhaber. */
export const nurDerInhaber = () => NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.', error: 'Nur der Inhaber.' }, { status: 403 });
/** 403: nur der interne Dienstweg (Arbeiter, Bote, Takt). */
export const nurDienstweg = () => NextResponse.json({ ok: false, fehler: 'Nur für den Dienstweg.', error: 'Nur für den Dienstweg.' }, { status: 403 });
/** 403: private Haushaltsfinanzen — nur Haushaltsmitglieder ohne Einschränkung „nur Business“. */
export const keinFinanzZugang = () => NextResponse.json({ ...KEIN_ZUGANG, error: KEIN_ZUGANG.fehler }, { status: 403 });
