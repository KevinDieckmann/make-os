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
    'Wofür: Wir werten Ihre Antworten aus, damit Sie sofort Ihre Stufe und den Branchenvergleich sehen. Geben Sie Ihre Kontaktdaten an, schicken wir Ihnen den Bericht, legen Sie als Anfrage in unserem Kundensystem an, und Sie können das kostenlose Gespräch buchen (Art. 6 Abs. 1 lit. b DSGVO).',
    'Bitte machen Sie nur Angaben zu Ihrer Firma — keine Gesundheitsdaten und keine Namen von Mitarbeitenden oder Kunden.',
    'Zoe ist eine KI-Assistentin. In dieser Fassung des Checks sind ihre Texte fest vorgegeben; Ihre Antworten gehen an kein KI-Modell.',
    `Speicherdauer: ohne Kontaktdaten ${FRIST_OHNE_KONTAKT_TAGE} Tage, mit Kontaktdaten bis zu ${FRIST_MIT_KONTAKT_MONATE} Monate (für den kostenlosen Re-Check nach 90 Tagen). Den Newsletter bekommen Sie nur, wenn Sie ihn ankreuzen und bestätigen.`,
    `Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Widerspruch${link ? ` — mehr in der Datenschutzerklärung (${link})` : ''}.`,
  ];
}
