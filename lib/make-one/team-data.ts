// ─── MAKE OS — Team & Verantwortung (Miro-Strategieboard) ───────────────────
// Aus dem Board „Kevin & Frank" abgelesen. Bis zur Miro-Anbindung ist das der
// gepflegte Stand — Quelle für Delegations-Vorschläge und die Säule
// „Beziehung & Team".

export interface TeamMitglied {
  name: string;
  kurz: string;
  bereiche: string[];
  /** 'kern' = KEMARIS-Führung, 'partner' = extern/beratend, 'privat' = MAKE.One */
  kreis: 'kern' | 'partner' | 'privat';
}

export const TEAM: TeamMitglied[] = [
  { name: 'Kevin Dieckmann', kurz: 'Kevin', kreis: 'kern',
    bereiche: ['Sales definieren', 'Markttraktion', 'Consulting & Development', 'Wachstumsinfrastruktur AI'] },
  { name: 'Frank Mathick', kurz: 'Frank', kreis: 'kern',
    bereiche: ['Finanzen & Controlling', 'Personal & OE', 'IT', 'Backoffice', 'Produkt'] },
  { name: 'Alex Groß-Ophoff', kurz: 'Alex', kreis: 'kern',
    bereiche: ['Produktentwicklung', 'Produktstrategie', 'Marktforschung (CapOS)'] },
  { name: 'Clemens Walter', kurz: 'Clemens', kreis: 'kern',
    bereiche: ['Investoren', 'Verträge & Recht', 'Gründungsprozess CapOS', 'Sales-Aufbau'] },
  { name: 'Björn Frentrup', kurz: 'Björn', kreis: 'partner',
    bereiche: ['Steuerberatung', 'Verträge & Recht', 'Gründung', 'Unternehmensstrukturen', 'Netzwerk OWL', 'Beteiligungen'] },
  { name: 'Jan Kronenberger', kurz: 'Jan', kreis: 'kern',
    bereiche: ['Kommunikation & PR', 'Netzwerk & Events', 'politische Vernetzung', 'Connect-Aufbau', 'perspektivisch Marketing'] },
  { name: 'Lisa Gohlke', kurz: 'Lisa', kreis: 'kern',
    bereiche: ['Buchhaltung', 'vorbereitende Lohnbuchhaltung', 'interne Kommunikation'] },
  { name: 'Katharina Heinschke', kurz: 'Katharina', kreis: 'kern',
    bereiche: ['Investoren', 'Netzwerkaufbau', 'Eventmanagement (Family Offices)'] },
  { name: 'Michael Höppner (Akasha)', kurz: 'Michael', kreis: 'partner',
    bereiche: ['Investoren', 'Family Offices'] },
  { name: 'Malin', kurz: 'Malin', kreis: 'privat',
    bereiche: ['Kevins rechte Hand', 'Board & Netzwerk', 'KD-Kostenaufstellung', 'MAKE.One'] },
];

/** Für Prompts: eine Zeile je Person. */
export const teamZeilen = () => TEAM.map(t => `${t.name}: ${t.bereiche.join(', ')}`);

// Rituale, die die Beziehung tragen — aus MAKE.One. Bewusst wenige.
export interface Ritual { id: string; name: string; rhythmus: string; warum: string; }
export const RITUALE: Ritual[] = [
  { id: 'sunday-dinner', name: 'Sunday Dinner', rhythmus: 'sonntags 19:00', warum: 'Der feste Punkt der Woche mit Malin — nichts anderes wird davorgelegt.' },
  { id: 'wochen-reflexion', name: 'Wochen-Reflexion zu zweit', rhythmus: 'sonntags', warum: 'Was war gut, was hat gefehlt — bevor die neue Woche startet.' },
  { id: 'kein-handy', name: 'Abends Handy weg', rhythmus: 'täglich ab 21:00', warum: 'Schützt Schlaf und Aufmerksamkeit — beides zahlt direkt auf Ruhe ein.' },
  { id: 'team-checkin', name: 'KEMARIS Check-In', rhythmus: 'wöchentlich', warum: 'Der Takt mit Frank und dem Team — Delegation wird hier verbindlich.' },
];
