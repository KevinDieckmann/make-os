// ─── Flächen-Register: jede anpassbare Seite mit ihrer Kennung (rein, 30.10.) ──────────────────────────────────────────────────────────
// Kevin 30.10.: „Das Anpassen der Karten überall weitermachen, dass wir den Überblick etc. selber anpassen können.“ Jede Seite, die eine
// <Flaeche seite="…"> trägt, steht hier — mit dem Namen, unter dem man sie findet. Regeln (Wächter tests/flaeche-register.test.ts):
//   · eine Kennung NIE umbenennen — gespeicherte Layouts hängen an ihr (frühere bleiben in `FRUEHER` stehen, nie löschen);
//   · jede Kennung genau einmal, Form wie `seiteOk` (lib/flaeche/modell.ts), höchstens `SEITEN_MAX` je Person (sauberDatei);
//   · der Bereich folgt aus der Kennung (`spaceAusFlaeche`) — der Katalog bietet nur passende Widgets an, der Server prüft dasselbe.

export interface FlaecheEintrag { seite: string; name: string }

/** Höchstzahl gespeicherter Seiten je Person (`sauberDatei` in lib/flaeche/modell.ts). */
export const SEITEN_MAX = 80;

export const FLAECHEN: readonly FlaecheEintrag[] = [
  // Heute (HEUTE_FLAECHE in components/os/HeuteView.tsx)
  { seite: 'uebersicht-privat', name: 'Heute › Privat' },
  { seite: 'uebersicht-business', name: 'Heute › Business' },
  // Gesundheit
  { seite: 'gesundheit-heute', name: 'Gesundheit › Heute' },
  { seite: 'gesundheit-erholung', name: 'Gesundheit › Erholung' },
  { seite: 'gesundheit-koerper', name: 'Gesundheit › Körper' },
  { seite: 'ernaehrung', name: 'Gesundheit › Ernährung' },
  { seite: 'journal', name: 'Journal' },
  { seite: 'sport-plan', name: 'Sport › Ziele & Plan' },
  { seite: 'sport-training', name: 'Sport › Training' },
  { seite: 'sport-hyrox', name: 'Sport › Hyrox' },
  { seite: 'sport-lauf', name: 'Sport › Running' },
  { seite: 'sport-gym', name: 'Sport › Gym' },
  { seite: 'sport-erholung', name: 'Sport › Erholung' },
  // Familie & Kontakte
  { seite: 'familie-wir', name: 'Familie › Wir zwei' },
  { seite: 'familie-orga', name: 'Familie › Familie' },
  { seite: 'familie-rahmen', name: 'Familie › Rahmen' },
  { seite: 'menschen', name: 'Kontakte (Privat)' },
  // Aufgaben & Planung
  { seite: 'aufgaben-ueberblick', name: 'Aufgaben › Überblick' },
  { seite: 'aufgaben-ueberblick-privat', name: 'Aufgaben › Überblick (Privat)' },
  { seite: 'aufgaben-ueberblick-business', name: 'Aufgaben › Überblick (Business)' },
  { seite: 'planung-tag', name: 'Planung › Tag' },
  { seite: 'planung-monat', name: 'Planung › Monat' },
  { seite: 'planung-quartal', name: 'Planung › Quartal' },
  { seite: 'planung-jahr', name: 'Planung › Jahr' },
  // Finanzen
  { seite: 'finanzen-ueberblick-privat', name: 'Finanzen › Privat › Überblick' },
  { seite: 'business', name: 'Finanzen › Business › Cockpit' },
  { seite: 'score-business', name: 'Business-Score' },
  { seite: 'controlling-business', name: 'Finanzen › Business › Controlling & Ziele' },
  { seite: 'zahlen', name: 'Finanzen › Business › Konten & Fälliges' },
  { seite: 'finanzchef', name: 'Head of Finance' },
  // Markttraktion (FLAECHE in lib/crm/flaechen.ts)
  { seite: 'markttraktion-ueberblick', name: 'Markttraktion › Überblick' },
  { seite: 'markttraktion-marketing', name: 'Markttraktion › Marketing' },
  { seite: 'markttraktion-event', name: 'Markttraktion › Make.One' },
  // ZOE & System
  { seite: 'loops', name: 'ZOE › Loops' },
  { seite: 'konto', name: 'Konto' },
  { seite: 'system', name: 'Einstellungen' },
];

/** Frühere Kennungen — gespeicherte Layouts bleiben liegen, gezeigt werden sie nicht mehr. Nie wiederverwenden. */
export const FRUEHER: readonly string[] = [
  'home', // Heute › Alles (bis 09.10.)
  'markttraktion-sales', // Markttraktion › Sales (Reiter seit Aufräumen Etappe 3, 08.10., aufgelöst)
];
