// ─── EINE Konto-Sicht (09.10., E4 — Kevin: „Ja, Privates bleibt privat“; ANALYSE_AGENTEN_DATEN.md › 5 D) ─────────────────────
// Was ein Konto sehen darf, steht genau HIER (rein, Server und Browser) — vorher prüften rund zwölf Stellen `finanzRecht === 'business'`
// einzeln, und der ZOE-Kern (Aufgaben-Sicht, gatherBrain, Stapel, Suche, Agenten-Angebot) prüfte es gar nicht: ein Business-Partner sah
// Privat-Aufgaben des Haushalts — in der Aufgaben-Sicht und über ZOE (Titel/Notizen gingen ans Modell).
// Aus lib/agenten/sicht.ts herausgelöst: der Agenten-Bereich nimmt dieselbe Sicht (`sichtLaden` → `kontoSichtLaden`).
//
//   Konto                                   imHaushalt   privat   business   nurBusiness   vollesMitglied   privatFinanzen
//   volles Mitglied (Haushalt, ohne Recht)  ja           ja       ja         nein          ja               ja
//   Haupt-Inhaber ohne Haushalt-Eintrag     ja           ja       ja         nein          nein             nein
//   `finanzRecht: 'business'` (Partner)     ja           nein     ja         ja            nein             nein
//   Testkunde / fremder Haushalt            nein         nein     nein       (Recht)       nein             nein
//
// Begriffe:
//   · `privat` — darf den Privat-Bereich DES HAUSHALTS sehen (Privat-Aufgaben, Privat-Projekte, ZOE-Kontext daraus): im Haushalt der
//     Inhaber und nicht „nur Business“. Der Haupt-Inhaber ohne eingetragenen Haushalt bleibt dabei (er ist dann der einzige im Haushalt —
//     vorher sah er seine Privat-Aufgaben, so bleibt es).
//   · `vollesMitglied` — im Haushalt der Inhaber, Haushalt am Konto eingetragen UND nicht „nur Business“ (wie `haushaltFuer` im Haushalt der
//     Inhaber): Bestände JE HAUSHALT (Privat-Heads, Familie, Haushaltsfinanzen) brauchen den Eintrag zusätzlich. `privatFinanzen` = dasselbe
//     mit dem Haushalt der Inhaber am Konto (ist es nach `imHaushalt` immer — eigenes Feld, damit die Regel lesbar bleibt).
//   · `nurBusiness` — das Konto trägt `finanzRecht: 'business'`. Wer ausgeblendet wird, entscheidet NUR dieses Feld (`privatAusblenden`):
//     Konten außerhalb des Haushalts kommen an den Toren der Routen gar nicht vorbei — hier keine zweite Torprüfung, kein Verhaltenswechsel.
//   · `bereiche` — die Bereiche, die das Konto im Haushalt sieht (leer außerhalb).
// Systemläufe ohne Person haben KEINE Konto-Sicht (`null`) — sie filtern wie bisher selbst (z. B. „nur ich“ nie).
// Wächter: tests/konto-sicht.test.ts („Sicht Business bekommt nichts aus Privat“), tests/messlatte-malin.test.ts (Partner).

import type { Rolle } from './konten';
import { haushaltDerInhaber, imHaushaltDerInhaber, istWirksamerInhaber, type InhaberStand } from './inhaber';

export type KontoBereich = 'privat' | 'business';

export interface KontoSicht {
  /** Speichername aus der Sitzung bzw. dem Auftrag. */
  person: string;
  /** Rolle am Konto (`null` = kein Konto). */
  rolle: Rolle | null;
  /** Wirksamer Inhaber (Rolle Inhaber im Haushalt der Inhaber). */
  inhaber: boolean;
  /** Haushalt am Konto (gültige Kennung) — oder null. */
  haushalt: string | null;
  /** Finanzrecht am Konto (`business` = nur die Business-Sicht). */
  finanzRecht: 'business' | null;
  /** Gehört die Person zum Haushalt der Inhaber? Sonst sieht sie nichts (fremder Haushalt, Testkunde). */
  imHaushalt: boolean;
  /** Darf den Privat-Bereich des Haushalts sehen (im Haushalt, nicht „nur Business“). */
  privat: boolean;
  /** Darf den Business-Bereich sehen (im Haushalt). */
  business: boolean;
  /** Konto „nur Business“ (`finanzRecht: 'business'`). */
  nurBusiness: boolean;
  /** Bereiche, die das Konto im Haushalt sieht. */
  bereiche: readonly KontoBereich[];
  /** Volles Mitglied (Haushalt eingetragen, ohne `finanzRecht: 'business'`) — Bestände je Haushalt, Privat-Heads. */
  vollesMitglied: boolean;
  /** Privater Finanzzugang (`privatFinanzZugang`): volles Mitglied UND Haushalt der Inhaber. */
  privatFinanzen: boolean;
  /** Gesundheits-Einwilligung der Person selbst: (a) verarbeiten, (b) an die KI — nur geladen, wenn gefragt (sonst beides nein). */
  gesundheit: { verarbeiten: boolean; ki: boolean };
}

const PERSON = /^[a-z0-9-]{1,40}$/;
const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KEINE_GESUNDHEIT = { verarbeiten: false, ki: false } as const;

/** Die Konto-Sicht aus dem Konten-Bestand (rein). `gesundheit` reicht der Lader dazu (sonst „nein“). */
export function kontoSichtAus(st: InhaberStand, person: string, gesundheit: { verarbeiten: boolean; ki: boolean } = KEINE_GESUNDHEIT): KontoSicht {
  const k = PERSON.test(person) ? st.konten.find(x => x.speicher === person) : undefined;
  const nurBusiness = k?.finanzRecht === 'business';
  const haushalt = k?.haushalt && HAUSHALT.test(k.haushalt) ? k.haushalt : null;
  const imHaushalt = !!k && imHaushaltDerInhaber(st, person);
  const privat = imHaushalt && !nurBusiness;
  const vollesMitglied = imHaushalt && !!haushalt && !nurBusiness;
  const inhaberHaushalt = haushaltDerInhaber(st);
  return {
    person,
    rolle: k?.rolle ?? null,
    inhaber: !!k && istWirksamerInhaber(st, person),
    haushalt,
    finanzRecht: nurBusiness ? 'business' : null,
    imHaushalt,
    privat,
    business: imHaushalt,
    nurBusiness,
    bereiche: imHaushalt ? (privat ? ['privat', 'business'] : ['business']) : [],
    vollesMitglied,
    privatFinanzen: vollesMitglied && !!inhaberHaushalt && haushalt === inhaberHaushalt,
    gesundheit: { verarbeiten: !!gesundheit.verarbeiten, ki: !!gesundheit.ki },
  };
}

/**
 * Wird für dieses Konto der Privat-Bereich des Haushalts ausgeblendet? EINE Regel für alle Leser (Aufgaben, ZOE-Kontext, Stapel,
 * Suche, Agenten-Angebot): genau die Konten „nur Business“. `null` = Systemlauf ohne Person → nichts ausblenden (wie bisher).
 */
export const privatAusblenden = (k: Pick<KontoSicht, 'nurBusiness'> | null | undefined): boolean => !!k?.nurBusiness;

/** Darf das Konto diesen Bereich sehen? Ohne Konto-Sicht (Systemlauf) ja — die Leser filtern dort selbst. */
export function bereichErlaubt(k: Pick<KontoSicht, 'nurBusiness'> | null | undefined, bereich: KontoBereich | null | undefined): boolean {
  return bereich !== 'privat' || !privatAusblenden(k);
}

/** Die leere Sicht (unbekannte Person) — nichts im Haushalt. */
export const keineKontoSicht = (person: string): KontoSicht => kontoSichtAus({ konten: [] }, person);
