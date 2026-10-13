// ─── Konto-Sicht laden (Server, 09.10., E4) — die Regel steht rein in ./konto-sicht.ts ───────────────────────────────────────
// `kontoSicht(person)` liest nur den Konten-Bestand (für die Aufgaben-Sicht, den ZOE-Kontext, den Stapel — oft gerufen, darum ohne
// weitere Bestände). `kontoSichtLaden(person)` nimmt die Gesundheits-Einwilligung der Person dazu (Agenten-Bereich, `sichtLaden`).
// Unbekannte/ungültige Person → die leere Sicht (nichts im Haushalt). Ohne Person (Systemlauf) gibt es keine Sicht: `null`.

import { ladeKonten } from './konten';
import { kontoSichtAus, keineKontoSicht, type KontoSicht } from './konto-sicht';
import { haushaltVon, personStreng } from '@/lib/finanzen/haushalt/zugriff';

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

/**
 * Haushalt für BUSINESS-Bestände je Haushalt bzw. Person (Netzwerken, Visitenkarten — Gesamtprüfung 12.10.): `haushaltFuer` schließt Konten
 * „nur Business“ aus, weil es für die PRIVATEN Haushaltsfinanzen gedacht ist — Netzwerken ist aber Business, und ein Vertriebspartner sah dort
 * nur 403. Hier: jedes Konto im Haushalt der Inhaber, das Business sieht, mit eingetragenem Haushalt — sonst null (fremder Haushalt, Testkunde).
 */
export async function businessHaushaltFuer(person: string | null | undefined): Promise<{ person: string; haushalt: string } | null> {
  const s = await kontoSicht(person);
  return s && s.imHaushalt && s.business && s.haushalt ? { person: s.person, haushalt: s.haushalt } : null;
}

/**
 * Haushalt für BUSINESS-Bestände je Haushalt aus der Anfrage (Markttraktion: Angebote, CRM-Ablage, Absender — 13.10., Rolle „nur Business“):
 * volles Mitglied wie bisher über `haushaltVon` (`nurBusiness: false`), sonst ein Konto „nur Business“ im Haushalt der Inhaber
 * (`businessHaushaltFuer`, `nurBusiness: true`) — was diese Rolle dort darf, regelt lib/crm/nur-business.ts. Sonst null (→ 403).
 * Die Routen prüfen vorher ihr Tor (Haushalt des Inhabers); ein volles Mitglied eines anderen Haushalts kommt dort nicht vorbei.
 */
export async function businessHaushaltVon(req: Request): Promise<{ person: string; haushalt: string; nurBusiness: boolean } | null> {
  const voll = await haushaltVon(req);
  if (voll) return { ...voll, nurBusiness: false };
  const s = await kontoSicht(personStreng(req));
  return s && s.imHaushalt && s.nurBusiness && s.haushalt ? { person: s.person, haushalt: s.haushalt, nurBusiness: true } : null;
}

/** Wird für diese Person der Privat-Bereich ausgeblendet („nur Business“)? Systemlauf → nein. Unlesbarer Konten-Bestand wirft. */
export async function privatAusgeblendetFuer(person: string | null | undefined): Promise<boolean> {
  return !!(await kontoSicht(person))?.nurBusiness;
}
