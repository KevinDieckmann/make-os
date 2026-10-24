// ─── Checks — Datenschutzhinweis der öffentlichen Seite (24.10., Innovations-Check) ─────────────────────────────
// Der Hinweis steht ausgeklappt unter dem Chat und noch einmal kurz an der Kontakt-Frage (Art. 13 DSGVO). Verantwortlicher NIE
// fest im Code — aus der Einrichtung der Instanz (lib/datenschutz/einrichtung-server.ts); ohne Verantwortlichen lässt sich der
// Check nicht einschalten. Fristen kommen aus lib/check/fristen.ts. Hinweis, keine Rechtsberatung — einmal anwaltlich gegenlesen
// (offener Punkt der Bauanleitung). Ändert sich der Text, die Fassung hochzählen (sie steht an jedem Kontakt). Rein.

import { FRIST_MIT_KONTAKT_MONATE, FRIST_OHNE_KONTAKT_TAGE } from './fristen';

export const HINWEIS_FASSUNG = 'check-hinweis-1';

export function checkHinweis(verantwortlich: string, link: string | null): string[] {
  return [
    `Verantwortlich: ${verantwortlich}.`,
    'Wofür: Wir werten deine Antworten aus, damit du sofort deine Stufe und den Branchenvergleich siehst. Gibst du deine Kontaktdaten an, schicken wir dir den Bericht, legen dich als Anfrage in unserem Kundensystem an und du kannst das kostenlose Gespräch buchen (Art. 6 Abs. 1 lit. b DSGVO).',
    'Gib bitte nur Angaben zu deiner Firma an — keine Gesundheitsdaten und keine Namen von Mitarbeitenden oder Kunden.',
    'Zoe ist eine KI-Assistentin. In dieser Fassung des Checks sind ihre Texte fest vorgegeben; deine Antworten gehen an kein KI-Modell.',
    `Speicherdauer: ohne Kontaktdaten ${FRIST_OHNE_KONTAKT_TAGE} Tage, mit Kontaktdaten bis zu ${FRIST_MIT_KONTAKT_MONATE} Monate (für den kostenlosen Re-Check nach 90 Tagen). Den Newsletter bekommst du nur, wenn du ihn ankreuzt und bestätigst.`,
    `Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch${link ? ` — mehr in der Datenschutzerklärung (${link})` : ''}.`,
  ];
}
