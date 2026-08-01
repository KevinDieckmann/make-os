// ─── MAKE OS — Inbox-Aufteilung ─────────────────────────────────────────────
// Aus der Marktanalyse der besten Postfächer übernommen und auf Kevins Welt
// übersetzt:
//   · Split Inbox (Hey, Shortwave, Superhuman): nicht eine lange Liste,
//     sondern getrennte Fächer nach ART der Nachricht.
//   · Screener (Hey): neue Absender kommen nicht automatisch durch — sie
//     warten, bis Kevin einmal entscheidet. Das senkt die Menge dauerhaft.
//   · Bündeln (Shortwave): mehrere Nachrichten desselben Absenders als eine
//     Zeile, damit man sie am Stück wegräumt.
//
// Client-safe: keine Server-Importe.

export interface Fach {
  id: string;
  label: string;
  satz: string;
  farbe: string;
}

/** Die Fächer in der Reihenfolge, in der sie abgearbeitet werden. */
export const FAECHER: Fach[] = [
  { id: 'menschen', label: 'Menschen', satz: 'Echte Personen, die etwas von dir wollen.', farbe: '#21B5AA' },
  { id: 'geld', label: 'Geld & Papier', satz: 'Rechnungen, Verträge, Behörden, Banken.', farbe: '#DE9E63' },
  { id: 'system', label: 'Systemmeldungen', satz: 'Bestätigungen, Zustellungen, Technisches.', farbe: '#4A6CF7' },
  { id: 'rundschreiben', label: 'Rundschreiben', satz: 'Newsletter und Werbung — am Stück wegräumen.', farbe: '#8A9BA8' },
];

export const FACH = Object.fromEntries(FAECHER.map(f => [f.id, f])) as Record<string, Fach>;

const RUNDSCHREIBEN = /newsletter|no-?reply|noreply|donotreply|mailing|kampagne|abmelden|unsubscribe|marketing@|info@|news@|updates?@/i;
const SYSTEM = /bestätigung|confirm|verification|verifizier|passwort|zugang|automatisch|benachrichtigung|notification|zustellung|versandbest|tracking|termin(bestätigung|erinnerung)|kalender|einladung.*teams|abo verlängert/i;
const GELD = /rechnung|invoice|zahlung|mahnung|beitrag|vertrag|kündig|steuer|finanzamt|behörde|bank|konto|lastschrift|gutschrift|beleg|police|versicher|inkasso|gebühr|honorar|angebot|kostenvoranschlag/i;

/**
 * In welches Fach eine Nachricht gehört. Der Absender entscheidet zuerst
 * (Rundschreiben erkennt man am Absender, nicht am Betreff), dann der Inhalt.
 */
export function fachVon(
  m: { sender: string; senderEmail?: string; subject: string; preview?: string },
  handisch?: string,
): string {
  if (handisch && FACH[handisch]) return handisch;
  const absender = `${m.sender} ${m.senderEmail ?? ''}`;
  const text = `${m.subject} ${m.preview ?? ''}`;
  if (RUNDSCHREIBEN.test(absender)) return 'rundschreiben';
  if (GELD.test(text) || GELD.test(absender)) return 'geld';
  if (SYSTEM.test(text) || RUNDSCHREIBEN.test(text)) return 'system';
  return 'menschen';
}

/** Absender-Schlüssel: E-Mail wenn vorhanden, sonst der Anzeigename. */
export function absenderKey(m: { sender: string; senderEmail?: string }): string {
  return (m.senderEmail || m.sender || '').toLowerCase().trim();
}

export type AbsenderStatus = 'durchgelassen' | 'geblockt';
