// ─── Zugang: Haushalt des Inhabers ──────────────────────────────────────────
// Kalender (25.09.) und Business-Index (25.09.) gehören Kevin und Malin: Sehen
// und ändern darf, wer im SELBEN Haushalt ist wie der Inhaber — ein anderer
// Haushalt (z. B. der Test-Haushalt) oder ein Konto ohne Haushalt nicht. Dazu
// der Dienstweg (Arbeiter, Zulieferer, ZOE im Hintergrund), den die
// Middleware schon am Schlüssel erkannt hat.
// Seit 09.10. (R9) kann es mehrere Inhaber geben: „Haushalt des Inhabers“ = Haushalt der Inhaber (der des Haupt-Inhabers, alle
// Inhaber teilen ihn), „nur der Inhaber“ = JEDER wirksame Inhaber, `inhaberSpeicher()` = der Haupt-Inhaber. Regeln rein in
// lib/zugang/inhaber.ts — hier nur Laden + Anfrage.

import { ladeKonten } from '@/lib/zugang/konten';
import { istDienst } from '@/lib/zugang/dienst';
import { hauptInhaber, imHaushaltDerInhaber, istWirksamerInhaber, istHauptInhaber, haushaltDerInhaber, wirksameInhaber } from '@/lib/zugang/inhaber';

/**
 * Haushalt des Inhabers (Sitzung oder Dienstweg). Seit 28.09. (Integritätsprüfung, K1/Regel 5) beim Dienstweg
 * genauso streng wie `karteiZugang`: Nennt der Dienstweg eine Person, muss sie im Haushalt des Inhabers sein;
 * ohne Person gibt es keinen Rückfall auf „kevin“ mehr — `null` (→ 403). Vorher handelte ein Dienstaufruf ohne
 * Person als „kevin“, und einer mit fremder Person (ZOE-Gespräch aus dem Test-Haushalt) kam durch.
 * Systemläufe ohne Person (Zulieferer, Takt) gehen nur dort, wo die Route das ausdrücklich trägt:
 * `imHaushaltOderSystemlauf` (Kalender, Erinnerungen) bzw. `karteiZugang`.
 */
export async function imHaushaltDesInhabers(req: Request): Promise<{ person: string; dienst: boolean } | null> {
  if (istDienst(req)) {
    const p = req.headers.get('x-make-person');
    if (!p || !/^[a-z0-9-]{1,40}$/.test(p)) return null;
    return (await personImHaushaltDesInhabers(p)) ? { person: p, dienst: true } : null;
  }
  const person = req.headers.get('x-make-user');
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return null;
  return (await personImHaushaltDesInhabers(person)) ? { person, dienst: false } : null;
}

/**
 * Wie `imHaushaltDesInhabers`, lässt aber den Systemlauf (Dienstweg OHNE Person) durch — `person` ist dann null.
 * Nur für Routen, die Systemläufe tragen müssen (Kalender-Abgleich, Zulieferer vom Mac); wer eine Person braucht,
 * lehnt bei `person === null` selbst ab (Regel 5, kein Rückfall).
 */
export async function imHaushaltOderSystemlauf(req: Request): Promise<{ person: string | null; dienst: boolean } | null> {
  if (istDienst(req) && !req.headers.get('x-make-person')) return { person: null, dienst: true };
  return imHaushaltDesInhabers(req);
}

/**
 * Kartei und Personen-Bestände (28.09., K1 #66/#67): `/api/state/{kontakte,kunden,prospects,netzwerk,
 * stammdaten,aenderungen}` gehören dem Haushalt des Inhabers — vorher reichte „angemeldet“, und ein neues
 * Konto ohne Haushalt konnte die ganze Kartei lesen und ändern.
 * Strenger als `imHaushaltDesInhabers`: Nennt der Dienstweg eine Person (ZOE, Heads, Arbeiter im Auftrag),
 * muss auch DIESE Person im Haushalt des Inhabers sein — sonst holte ein Gespräch aus einem anderen Haushalt
 * die Kartei über ZOE. Dienstweg ohne Person = Systemlauf des Takts (Regel 7): darf, `person` ist dann null
 * (kein Rückfall auf „kevin“, Regel 5).
 */
export async function karteiZugang(req: Request): Promise<{ person: string | null; dienst: boolean } | null> {
  return imHaushaltOderSystemlauf(req);
}

/** Die 403-Antwort der Kartei-Routen (ein Satz, überall gleich). */
export const KARTEI_GESPERRT = { ok: false, fehler: 'Nur im Haushalt des Inhabers.' } as const;

/** Dieselbe Regel für eine Person (z. B. ZOE-Werkzeuge, die im Auftrag handeln). */
export async function personImHaushaltDesInhabers(person: string | undefined | null): Promise<boolean> {
  if (!person || !/^[a-z0-9-]{1,40}$/.test(person)) return false;
  return imHaushaltDerInhaber(await ladeKonten(), person);
}

/** Hat diese Person Inhaber-Rechte (Rolle Inhaber im Haushalt der Inhaber — seit 09.10. jeder Inhaber, nicht nur einer)? */
export async function istInhaber(person: string | null | undefined): Promise<boolean> {
  if (!person) return false;
  return istWirksamerInhaber(await ladeKonten(), person);
}

/**
 * Inhaber-Dinge (Haushalt, 2FA-Pflicht, Datenschutz, Nachweise, Agenten-Regler …): JEDER Inhaber. Der
 * Dienstweg ohne Person ist ein Systemlauf (Zulieferer, Signale) und darf;
 * handelt er für eine Person (ZOE), gilt deren Recht.
 */
export async function nurInhaber(req: Request): Promise<boolean> {
  const w = await imHaushaltOderSystemlauf(req);
  if (!w) return false;
  if (w.person === null) return true; // Systemlauf (Dienstweg ohne Person)
  return istInhaber(w.person);
}

/**
 * Persönliches des Haupt-Inhabers, das an seinem Gerät hängt (09.10.): das Mac-Adressbuch (auch Privates) — „Inhaber“ heißt
 * Verwaltung, nicht Einsicht. Weitere Inhaber bekommen es nicht. Systemlauf (Dienstweg ohne Person) darf wie bei `nurInhaber`.
 */
export async function nurHauptInhaber(req: Request): Promise<boolean> {
  if (!(await nurInhaber(req))) return false;
  const w = await imHaushaltOderSystemlauf(req);
  if (!w) return false;
  if (w.person === null) return true;
  return istDerHauptInhaber(w.person);
}

/** Ist diese Person der Haupt-Inhaber? Für Persönliches an seinem Gerät (Mac-Adressbuch, Apple-Erinnerungen) — nie für Rechte. */
export async function istDerHauptInhaber(person: string | null | undefined): Promise<boolean> {
  return !!person && istHauptInhaber(await ladeKonten(), person);
}

/** Der Speichername des Haupt-Inhabers — statt einer festen Person im Code (Plattform-Regel); ohne Inhaber null. */
export async function inhaberSpeicher(): Promise<string | null> {
  return hauptInhaber(await ladeKonten())?.speicher ?? null;
}

/** Alle wirksamen Inhaber (Haupt-Inhaber zuerst) — für Meldungen „an den Inhaber“. */
export async function alleInhaberSpeicher(): Promise<string[]> {
  return wirksameInhaber(await ladeKonten()).map(k => k.speicher);
}

/** Der Haushalt des Inhabers — Kalender und Business-Index gehören genau diesem Haushalt (bei mehreren Inhabern: ihrem gemeinsamen). */
export async function haushaltDesInhabers(): Promise<string | null> {
  return haushaltDerInhaber(await ladeKonten());
}
