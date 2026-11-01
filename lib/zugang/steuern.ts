// ─── Zugang: die Arbeit steuern — EINE Regel (02.11., Prüfung D „Steuerung, Erinnerung, Rechte“; Kevin: „sie kann vollen Zugriff haben“) ─
// CLAUDE.md: „Malin und Kevin haben beide vollen Zugriff auf alles in diesem System.“ Bis 02.11. verlangten viele Stellen, die die ARBEIT steuern,
// einen Inhaber (`nurInhaber`/`istInhaber`): Kampagnen-Versand, Homepage-Funde, Newsletter, Kontaktformular, Website, Checks, Bausteine,
// Vertriebler-Formular, Angebote aus dem eigenen Postfach, Heads und Agenten-Schalter, Stellschrauben, Fulfillment, Vertragsvorlagen, Kapazität
// der Team-Personen, Firmen-Zusammenführung zurücknehmen, Kennungs-Umzug, Verbesserungs-Loop, Selbstbild, Agenten-Protokoll. Ein volles Mitglied
// des Inhaber-Haushalts bekam dort 403.
// EINE Regel: steuern darf ein wirksamer Inhaber ODER ein volles Mitglied des Inhaber-Haushalts (Konto mit Haushalt, nicht „nur Business“ — dieselbe
// Sicht wie lib/zugang/konto-sicht.ts `vollesMitglied`). Ein Konto „nur Business“ (`finanzRecht: 'business'`), ein fremder Haushalt, ein Testkunde
// ohne Haushalt und der Dienstweg/ZOE (das prüft die Route) dürfen nicht.
// Bewusst NICHT über diese Regel (bleiben beim Inhaber): Konten anlegen/löschen/Rollen, Haushalt zuordnen, Inhaber ernennen, 2FA-Pflicht und
// Konto-Einstellungen der Instanz, Datenschutz-Einrichtung, Pannen-Register und Nachweise, KI-Schalter/-Budget der Instanz, Instanz-Export/-Löschen,
// Mac-Postfach/-Kontakte/-Erinnerungen, Schlüssel/OAuth der Instanz (WhatsApp-Nummer registrieren, Whoop-Altweg), Demo zurücksetzen, Wiederherstellen
// und Absichten der Datenschicht, Onboarding-Schritte der Instanz. Persönliche Daten einer Person (Gesundheit, „nur ich“, private Notizen, eigene
// Postfächer, Visitenkarten, Gruß) sind kein Steuer-Recht und bleiben getrennt.

import { ladeKonten } from './konten';
import { istWirksamerInhaber, kontenImHaushaltDerInhaber, type InhaberStand } from './inhaber';
import { kontoSichtAus } from './konto-sicht';

/** Rein: darf diese Person die Arbeit steuern (wie ein Inhaber)? */
export function steuernAus(st: InhaberStand, person: string | null | undefined): boolean {
  if (!person) return false;
  if (istWirksamerInhaber(st, person)) return true;
  return kontoSichtAus(st, person).vollesMitglied;
}

/** Server: dieselbe Regel mit den Konten der Instanz. Ein Lesefehler sperrt (fail-closed). */
export async function darfSteuern(person: string | null | undefined): Promise<boolean> {
  if (!person) return false;
  try { return steuernAus(await ladeKonten(), person); } catch { return false; }
}

/**
 * Für Routen: Haushalt des Inhabers oder Systemlauf (Dienstweg OHNE Person, wo die Route ihn trägt) — und mit Person nur, wer steuern darf.
 * Ersatz für `nurInhaber(req)` an Steuer-Stellen. Der Dienstweg MIT Person (ZOE, im Auftrag) zählt als diese Person.
 */
export async function steuernOderSystemlauf(req: Request): Promise<boolean> {
  const { imHaushaltOderSystemlauf } = await import('./haushalt-inhaber');
  const w = await imHaushaltOderSystemlauf(req);
  if (!w) return false;
  return w.person === null ? true : darfSteuern(w.person);
}

/** Alle, die steuern dürfen (Glocken der Freigaben, z. B. Vertriebler-Formular) — in der Reihenfolge des Konten-Bestands. */
export async function alleSteuerer(): Promise<string[]> {
  const st = await ladeKonten();
  return kontenImHaushaltDerInhaber(st).map(k => k.speicher).filter(s => steuernAus(st, s));
}

/** Satz für 403 — neutral, ohne Namen. */
export const NUR_STEUERN = 'Das steuern nur Inhaber und volle Mitglieder des Haushalts — mit einem Konto „nur Business“ siehst du den Stand.';
