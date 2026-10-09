// ─── Konto-Sicht laden (Server, 09.10., E4) — die Regel steht rein in ./konto-sicht.ts ───────────────────────────────────────
// `kontoSicht(person)` liest nur den Konten-Bestand (für die Aufgaben-Sicht, den ZOE-Kontext, den Stapel — oft gerufen, darum ohne
// weitere Bestände). `kontoSichtLaden(person)` nimmt die Gesundheits-Einwilligung der Person dazu (Agenten-Bereich, `sichtLaden`).
// Unbekannte/ungültige Person → die leere Sicht (nichts im Haushalt). Ohne Person (Systemlauf) gibt es keine Sicht: `null`.

import { ladeKonten } from './konten';
import { kontoSichtAus, keineKontoSicht, type KontoSicht } from './konto-sicht';

export type { KontoSicht } from './konto-sicht';

const PERSON = /^[a-z0-9-]{1,40}$/;

/** Konto-Sicht der Person (ohne Gesundheits-Einwilligung). `null`/leer = Systemlauf → `null`. */
export async function kontoSicht(person: string | null | undefined): Promise<KontoSicht | null> {
  if (!person) return null;
  if (!PERSON.test(person)) return keineKontoSicht(person);
  return kontoSichtAus(await ladeKonten(), person);
}

/** Konto-Sicht MIT Gesundheits-Einwilligung (a)/(b) der Person selbst — nur im Haushalt (sonst „nein“). */
export async function kontoSichtLaden(person: string): Promise<KontoSicht> {
  if (!PERSON.test(person)) return keineKontoSicht(person);
  const st = await ladeKonten();
  const ohne = kontoSichtAus(st, person);
  if (!ohne.imHaushalt) return ohne;
  const { gesundheitStandFuer } = await import('@/lib/datenschutz/gesundheit-einwilligung');
  const g = await gesundheitStandFuer(person).catch(() => null);
  return kontoSichtAus(st, person, { verarbeiten: !!g?.verarbeitungErlaubt, ki: !!g?.ki.an });
}

/** Wird für diese Person der Privat-Bereich ausgeblendet („nur Business“)? Systemlauf → nein. Unlesbarer Konten-Bestand wirft. */
export async function privatAusgeblendetFuer(person: string | null | undefined): Promise<boolean> {
  return !!(await kontoSicht(person))?.nurBusiness;
}
