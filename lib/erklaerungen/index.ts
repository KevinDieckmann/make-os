// ─── Erklärungen (10.10.) — die EINE Stelle für alle Erklärtexte ───────────────────────────────────────────────────────────────
// Kevin 10.10.: „Wenn man auf die einzelnen Sachen klickt, möchte ich, dass die Erklärung dahinter ist und was es bedeutet — mit
// Fallbeispiel. Das will ich überall.“ Texte sind DATEN (eine Instanz kann sie anpassen), geordnet nach Thema:
//   einstellungen-datenschutz.ts   System › Datenschutz & KI (Gesundheit a/b/c, KI-Schalter, Telegram, Karten der Seite)
//   einstellungen-konto.ts         Konto & Sicherheit, Bedienung, Postfach, WhatsApp, Kalender, Medien, Chat
//   einstellungen-privat.ts        Gesundheit, Fokus, Planung, Kapazität
//   einstellungen-business.ts      Heads (Einstellungen, Abschnitte), Agenten-Werkstatt, Markttraktion, Finanzplanung, Unternehmen
//   agenten.ts                     je Head und Mitarbeiter: was er tut · was er nie tut · Beispiel-Vorschlag       (eigener Import)
//   kennzahlen.ts                  Index-Kennzahlen aus dem Register (Wie gerechnet · Beispiel · Was ihr tun könnt) (eigener Import)
// Der Baustein (components/os/ui/erklaerung.tsx, `erklaerung`-Prop an Schalter, Zeile, Ueberschrift, Beschriftung, Feldzeile, Kennzahl, Zahl)
// nimmt einen Schlüssel aus EINSTELLUNGEN oder fertige Abschnitte. Neuer Schalter/neue Einstellung = Eintrag hier (Typ und Wächter verlangen ihn).
// Beispiele sind erfunden und neutral (Plattform-Regel); der Wächter tests/erklaerungen.test.ts prüft Vollständigkeit und Namen.

import { einstellungAbschnitte, type EinstellungsText, type ErklaerAbschnitt } from './typen';
import { EINSTELLUNGEN_DATENSCHUTZ } from './einstellungen-datenschutz';
import { EINSTELLUNGEN_KONTO } from './einstellungen-konto';
import { EINSTELLUNGEN_PRIVAT } from './einstellungen-privat';
import { EINSTELLUNGEN_BUSINESS } from './einstellungen-business';
// Fulfillment (10.10.): je Paket eine Datei (C1 Prozesse, C2 Kunde, C3 Analyse) — angelegt in C0, gefüllt von den Paketen.
import { EINSTELLUNGEN_FULFILLMENT_PROZESSE } from './fulfillment-prozesse';
import { EINSTELLUNGEN_FULFILLMENT_KUNDE } from './fulfillment-kunde';
import { EINSTELLUNGEN_FULFILLMENT_ANALYSE } from './fulfillment-analyse';
// Prozesse (22.10.): Läufe, Tests, Scharfschalten, Webhook der Werkstatt.
import { EINSTELLUNGEN_PROZESSE_LAEUFE } from './prozesse-laeufe';

export type { EinstellungsText, ErklaerAbschnitt } from './typen';
export { KOPF } from './typen';

/** Alle Erklärungen von Einstellungen und Karten, Schlüssel „bereich.ding“. */
export const EINSTELLUNGEN = {
  ...EINSTELLUNGEN_DATENSCHUTZ, ...EINSTELLUNGEN_KONTO, ...EINSTELLUNGEN_PRIVAT, ...EINSTELLUNGEN_BUSINESS,
  ...EINSTELLUNGEN_FULFILLMENT_PROZESSE, ...EINSTELLUNGEN_FULFILLMENT_KUNDE, ...EINSTELLUNGEN_FULFILLMENT_ANALYSE,
  ...EINSTELLUNGEN_PROZESSE_LAEUFE,
} as const;

export type EinstellungsSchluessel = keyof typeof EINSTELLUNGEN;
/** Woher eine Erklärung kommt: ein Schlüssel aus EINSTELLUNGEN oder fertig zusammengesetzte Abschnitte (Kennzahl, Head, Onboarding-Schritt). */
export type ErklaerungsQuelle = EinstellungsSchluessel | readonly ErklaerAbschnitt[];

/** Der Text zu einem Schlüssel — oder undefined. */
export const erklaerungFuer = (schluessel: string): EinstellungsText | undefined => (EINSTELLUNGEN as Readonly<Record<string, EinstellungsText>>)[schluessel];

/** Die Abschnitte, die der Baustein zeigt. Ein unbekannter Schlüssel zeigt nichts (der Wächter findet ihn vorher). */
export function abschnitteVon(q: ErklaerungsQuelle): ErklaerAbschnitt[] {
  if (typeof q !== 'string') return [...q];
  const t = erklaerungFuer(q);
  return t ? einstellungAbschnitte(t) : [];
}
