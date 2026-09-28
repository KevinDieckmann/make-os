// ─── MAKE OS — Team: nur noch Rückfall (Rollen-Platzhalter) ─────────────────
// Seit 28.09. (U4) steht das Team in den Daten: Speicher `team--<haushalt>`,
// gepflegt in der Karte „Team“ (Säule Beziehung & Team), gelesen über
// lib/make-one/team-speicher.ts (`teamVon`) bzw. GET /api/team. Diese Liste gilt
// nur, solange der Speicher leer ist, und in Tests. Rohbau-Regel: Personen außer
// Kevin und Malin stehen hier nur als Platzhalter mit ihren Zuständigkeiten —
// echte Namen Dritter gehören in die Daten, nie in den Code. `kurz` bleibt ein
// Wort ohne Leerzeichen (Delegiert-Marker „— Delegiert an X“).

export interface TeamMitglied {
  name: string;
  kurz: string;
  bereiche: string[];
  /** 'kern' = KEMARIS-Führung, 'partner' = extern/beratend, 'privat' = MAKE.One */
  kreis: 'kern' | 'partner' | 'privat';
  /** Wohin die Person gehört (organisation-data): kdv|kdc|kemaris|privat */
  org?: string;
}

export const TEAM: TeamMitglied[] = [
  { name: 'Kevin Dieckmann', kurz: 'Kevin', kreis: 'kern',
    bereiche: ['Sales definieren', 'Markttraktion', 'Consulting & Development', 'Wachstumsinfrastruktur AI'] },
  { name: 'Person A (Finanzen)', kurz: 'Finanzen', kreis: 'kern',
    bereiche: ['Finanzen & Controlling', 'Personal & OE', 'IT', 'Backoffice', 'Produkt'] },
  { name: 'Person B (Produkt)', kurz: 'Produkt', kreis: 'kern',
    bereiche: ['Produktentwicklung', 'Produktstrategie', 'Marktforschung'] },
  { name: 'Person C (Investoren & Recht)', kurz: 'Investoren', kreis: 'kern',
    bereiche: ['Investoren', 'Verträge & Recht', 'Gründungsprozess', 'Sales-Aufbau'] },
  { name: 'Person D (Beratung, extern)', kurz: 'Beratung', kreis: 'partner',
    bereiche: ['Steuerberatung', 'Verträge & Recht', 'Gründung', 'Unternehmensstrukturen', 'Netzwerk', 'Beteiligungen'] },
  { name: 'Person E (Kommunikation)', kurz: 'Kommunikation', kreis: 'kern',
    bereiche: ['Kommunikation & PR', 'Netzwerk & Events', 'politische Vernetzung', 'Connect-Aufbau', 'perspektivisch Marketing'] },
  { name: 'Person F (Buchhaltung)', kurz: 'Buchhaltung', kreis: 'kern',
    bereiche: ['Buchhaltung', 'vorbereitende Lohnbuchhaltung', 'interne Kommunikation'] },
  { name: 'Person G (Netzwerk)', kurz: 'Netzwerk', kreis: 'kern',
    bereiche: ['Investoren', 'Netzwerkaufbau', 'Eventmanagement (Family Offices)'] },
  { name: 'Person H (Family Offices, extern)', kurz: 'FamilyOffices', kreis: 'partner',
    bereiche: ['Investoren', 'Family Offices'] },
  { name: 'Malin', kurz: 'Malin', kreis: 'privat', org: 'privat',
    bereiche: ['Kevins rechte Hand', 'Board & Netzwerk', 'KD-Kostenaufstellung', 'MAKE.One', 'Gesundheits-Beauftragte', 'kritische Themen zuerst'] },
  { name: 'Steuerkanzlei (Beispiel)', kurz: 'Steuerkanzlei', kreis: 'partner', org: 'kdv',
    bereiche: ['Steuerberatung', 'Buchhaltung', 'Lohnbuchhaltung', 'Jahresabschluss', 'steuerliche Struktur'] },
  { name: 'Kanzlei (Rechtsanwalt)', kurz: 'Kanzlei', kreis: 'partner', org: 'privat',
    bereiche: ['Recht', 'Schriftsätze'] },
];

// Rituale, die die Beziehung tragen — aus MAKE.One. Bewusst wenige.
export interface Ritual { id: string; name: string; rhythmus: string; warum: string; }
export const RITUALE: Ritual[] = [
  { id: 'sunday-dinner', name: 'Sunday Dinner', rhythmus: 'sonntags 19:00', warum: 'Der feste Punkt der Woche mit Malin — nichts anderes wird davorgelegt.' },
  { id: 'wochen-reflexion', name: 'Wochen-Reflexion zu zweit', rhythmus: 'sonntags', warum: 'Was war gut, was hat gefehlt — bevor die neue Woche startet.' },
  { id: 'kein-handy', name: 'Abends Handy weg', rhythmus: 'täglich ab 21:00', warum: 'Schützt Schlaf und Aufmerksamkeit — beides zahlt direkt auf Ruhe ein.' },
  { id: 'team-checkin', name: 'KEMARIS Check-In', rhythmus: 'wöchentlich', warum: 'Der Takt mit dem Team — Delegation wird hier verbindlich.' },
];
