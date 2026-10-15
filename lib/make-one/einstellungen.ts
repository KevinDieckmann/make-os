// ─── MAKE OS — Einstellungen (Aufräumen Etappe 1, 08.10.) ───────────────────
// Kevin: „ich weiß gar nicht mehr wo alles ist.“ Die frühere System-Seite (23 Links, Telegram und Wachstum doppelt, ZOE und
// „Bauen“ gemischt) heißt jetzt „Einstellungen“ — Adresse bleibt /os/system. Klare Gruppen (seit 10.10. fünf: + Bedienung), jede Seite genau einmal.
// Agenten- und ZOE-Dinge stehen hier NICHT (die liegen unter ZOE, lib/make-one/spaces.ts `ZOE_BEREICH`); Research, Content,
// Meeting, Board und Prospecting erreicht man über ZOE › Agenten. Rein (kein React), damit Leiste, Seite und Wächter
// (tests/aufraeumen-etappe1.test.ts) dieselbe Liste lesen.

export interface EinstellungsEintrag {
  href: string; label: string; was: string;
  /** Nur für Inhaber (15.10., Abnahme 2 B8): der Head of IT (Sicherheitslage, Server) — die Route lehnt andere ab (Routen-Register `inhaber`). */
  nurInhaber?: true;
  /** Führt in den Privat-Bereich (z. B. Gesundheit › WHOOP) — ein Konto „nur Business“ bekommt den Eintrag nicht (Business verlinkt nie ins Private). */
  privat?: true;
}
export interface EinstellungsGruppe { id: string; titel: string; eintraege: EinstellungsEintrag[] }

export const EINSTELLUNGEN_GRUPPEN: EinstellungsGruppe[] = [
  { id: 'konto', titel: 'Konto & Sicherheit', eintraege: [
    { href: '/os/konto', label: 'Konto', was: 'Name, Passwort, Anmelde-Adressen, zweiter Faktor, Team, Einladen, Gesundheit teilen' },
  ] },
  // 10.10. (Kevin: „… rechts mit drei Punkten und Einstellungen“): Wischen, „⋯“, Rückfrage vor dem Löschen, Dichte — je Gerät.
  { id: 'bedienung', titel: 'Bedienung', eintraege: [
    { href: '/os/system/bedienung', label: 'Bedienung', was: 'Wischen am Handy, Menü „⋯“, Rückfrage vor dem Löschen, Dichte der Listen, Vibrieren — je Gerät' },
  ] },
  { id: 'verbindungen', titel: 'Verbindungen', eintraege: [
    // Telegram steht nur hier (die Kopplung selbst liegt im Konto, die Verbindungs-Seite verweist dorthin).
    { href: '/os/verbindungen', label: 'Dienste', was: 'WhatsApp Business, Telegram, Microsoft, Miro, WHOOP-Export, Mac-Zulieferer abschalten' },
    { href: '/os/kalender?einstellungen=1', label: 'Kalender', was: 'iCloud und Google verbinden, Kalender zuordnen' },
    { href: '/os/inbox?postfaecher=1', label: 'Postfächer', was: 'Gmail, iCloud, IONOS und weitere — Bereich, Signatur, Verbindung erneuern' },
    { href: '/os/gesundheit#whoop', label: 'WHOOP', was: 'deine eigene WHOOP-Verbindung', privat: true },
  ] },
  { id: 'daten', titel: 'Daten & Datenschutz', eintraege: [
    { href: '/os/datenschutz', label: 'Datenschutz', was: 'Verantwortlicher, Einwilligungen, KI-Schalter, AVV, Verzeichnis, Nachweise' },
    { href: '/os/stammdaten', label: 'Stammdaten', was: 'Firmen, Konten, Adressen' },
    // 08.10. (Aufräumen Etappe 3): die Stammdaten der Markttraktion stehen dort hinter dem Zahnrad — und hier, damit man sie findet.
    { href: '/os/markttraktion?s=stammdaten', label: 'Kartei-Pflege', was: 'Datenqualität, Wertelisten, Betroffenenanträge, Import & Export der Markttraktion' },
    { href: '/os/datenbasis', label: 'Datenbasis', was: 'wo welche Zahl herkommt' },
  ] },
  { id: 'betrieb', titel: 'Betrieb', eintraege: [
    { href: '/os/hoi', label: 'Head of IT', was: 'Server, App, Sicherheit und der Blick von außen — in Ampeln', nurInhaber: true },
    { href: '/os/bauplan', label: 'Bauplan', was: 'was als Nächstes gebaut wird — mit Planung und den Phasen (früher „Roadmap“)' },
    { href: '/os/onboarding', label: 'Onboarding', was: 'die Einrichtung: Meine Einrichtung · Gemeinsam · Instanz' },
    { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit', was: 'wer woran baut, wie wir zusammen arbeiten' },
  ] },
];

/**
 * Die Gruppen für ein Konto (rein): ohne Inhaber-Rechte kein Head of IT, für ein Konto „nur Business“ keine Wege ins Private. `null` = noch
 * unbekannt → wie ohne Recht (lieber ein Eintrag zu wenig als ein Weg, der mit 403 endet). Leere Gruppen fallen weg.
 */
export function einstellungenFuer(k: { inhaber: boolean | null; nurBusiness: boolean | null }): EinstellungsGruppe[] {
  return EINSTELLUNGEN_GRUPPEN
    .map(g => ({ ...g, eintraege: g.eintraege.filter(e => (!e.nurInhaber || k.inhaber === true) && (!e.privat || k.nurBusiness === false)) }))
    .filter(g => g.eintraege.length);
}

/** Seiten, auf denen in der Leiste „Einstellungen“ leuchtet (Pfade, die nur hier gelistet sind). */
export const EINSTELLUNGEN_PFADE = ['/os/system', '/os/konto', '/os/verbindungen', '/os/datenschutz', '/os/stammdaten', '/os/datenbasis', '/os/hoi', '/os/bauplan', '/os/onboarding'];
