// ─── MAKE OS — Bauplan: was am System selbst noch zu tun ist ────────────────
// Bewusst GETRENNT von Kevins echten Aufgaben (/os/aufgaben). Hier steht, was
// an MAKE OS gebaut, angebunden oder verbessert werden muss — Anbindungen,
// Agenten, Qualität, Ideen. Kevin und ich tragen hier ein, was unterwegs
// auffällt, damit nichts verloren geht.

export type BacklogStatus = 'offen' | 'laufend' | 'erledigt';
export type BacklogKat = 'anbindung' | 'agent' | 'qualitaet' | 'idee';
/** Wer muss ran, damit es weitergeht. */
export type BacklogBlock = 'frei' | 'kevin' | 'extern';

export const KAT_LABEL: Record<BacklogKat, string> = {
  anbindung: 'Anbindung', agent: 'Agent', qualitaet: 'Qualität', idee: 'Idee',
};
export const STATUS_LABEL: Record<BacklogStatus, string> = {
  offen: 'Offen', laufend: 'Läuft', erledigt: 'Erledigt',
};
export const BLOCK_LABEL: Record<BacklogBlock, string> = {
  frei: 'kann ich bauen', kevin: 'braucht dich', extern: 'wartet auf Dritte',
};

export interface BacklogItem {
  id: string;
  titel: string;
  warum: string;
  kategorie: BacklogKat;
  status: BacklogStatus;
  /** 1 = als Nächstes, 3 = irgendwann */
  prio: 1 | 2 | 3;
  block: BacklogBlock;
  /** Was Kevin konkret tun muss, wenn block = 'kevin'. */
  brauche?: string;
  /** Woher der Punkt kommt (Audit, Review, Gespräch …). */
  quelle?: string;
  /** Roadmap-Phase (id aus roadmap-data). Ohne = noch nicht eingeordnet. */
  phase?: string;
  /** Zieldatum (YYYY-MM-DD) — macht den Punkt auf dem Zeitstrahl planbar. */
  ziel?: string;
  angelegt: string;
}

/** Startbestand: alles, was aus Audit, Review und Gesprächen offen ist. */
export const SEED: Omit<BacklogItem, 'angelegt'>[] = [
  {
    id: 'whoop-api', titel: 'Whoop-API anbinden', kategorie: 'anbindung', status: 'offen', prio: 1, block: 'kevin',
    warum: 'Dann kommen Recovery, Schlaf, HRV und Ruhepuls jeden Morgen von selbst — der Morgen-Check entfällt und der Tagesstart hat echte Tageswerte.',
    brauche: 'App auf developer.whoop.com registrieren → Client-ID + Secret in .env.local. Danach einmal autorisieren (OAuth), Refresh-Token bleibt lokal.',
    quelle: 'Gespräch 31.07.',
  },
  {
    id: 'oauth-fundament', titel: 'OAuth-Fundament sauber aufsetzen', kategorie: 'anbindung', status: 'offen', prio: 1, block: 'frei',
    warum: 'Whoop, HubSpot, Miro und M365 brauchen alle dasselbe Muster: Token holen, lokal verschlüsselt ablegen, automatisch erneuern. Einmal richtig gebaut, dann geht jede weitere Anbindung schnell.',
    quelle: 'Gespräch 31.07.',
  },
  {
    id: 'miro-api', titel: 'Miro live anbinden', kategorie: 'anbindung', status: 'offen', prio: 2, block: 'kevin',
    warum: 'Das Strategieboard ist eure Wahrheit für Aufgaben, Meilensteine und Team. Aktuell ist der Stand manuell abgeschrieben und veraltet mit jeder Planung.',
    brauche: 'Miro-API-Token aus deinem Miro-Konto (Developer → Create app).',
    quelle: 'Audit',
  },
  {
    id: 'hubspot-crm', titel: 'CRM-Agent an HubSpot', kategorie: 'agent', status: 'offen', prio: 2, block: 'kevin',
    warum: 'Aus der Prospecting-Liste würden echte Deals mit Forecast und Next-Best-Action — der Schritt von „Liste" zu „Pipeline".',
    brauche: 'HubSpot in den claude.ai-Connector-Einstellungen autorisieren.',
    quelle: 'Audit',
  },
  {
    id: 'm365-live', titel: 'M365 live (Postfach + Firmenkalender)', kategorie: 'anbindung', status: 'offen', prio: 2, block: 'kevin',
    warum: 'Der Inbox-Agent arbeitet auf Apple Mail; das Firmenpostfach und der KEMARIS-Kalender fehlen noch.',
    brauche: 'Azure App-Registrierung (Client-ID/Secret + Graph-Berechtigungen Mail.Read, Calendars.Read).',
    quelle: 'Audit',
  },
  {
    id: 'prospecting-quelle', titel: 'Firmensuche direkt in die App', kategorie: 'anbindung', status: 'offen', prio: 2, block: 'frei',
    warum: 'Das Qualifizieren läuft autonom, aber neue Firmen kommen aktuell über die Claude-Sitzung rein. Mit eigener Datenquelle füllt sich die Zielliste selbst.',
    quelle: 'Prospecting-Bau',
  },
  {
    id: 'meeting-transkript', titel: 'Meeting-Mitschrift automatisch', kategorie: 'agent', status: 'offen', prio: 3, block: 'kevin',
    warum: 'Heute fügst du das Transkript ein. Mit Anbindung an Granola/Fireflies entstehen Protokoll und Action-Items ohne Zutun.',
    brauche: 'Entscheidung, welches Werkzeug du nutzt — dann dessen API-Zugang.',
    quelle: 'Meeting-Bau',
  },
  {
    id: 'wissens-agent', titel: 'Wissens-/Dokument-Agent', kategorie: 'agent', status: 'offen', prio: 3, block: 'frei',
    warum: 'Verträge und Vault durchsuchbar machen (Vertragswerke, NDA, GV). Pragmatisch wie beim Meeting-Agent: Dokument einfügen → Zusammenfassung, Kernklauseln, Risiken.',
    quelle: 'Audit',
  },
  {
    id: 'loop-automatisch', titel: 'Loops zeitgesteuert statt beim Öffnen', kategorie: 'qualitaet', status: 'offen', prio: 3, block: 'frei',
    warum: 'Der Tagesstart läuft beim ersten Öffnen. Schöner wäre: morgens um 7 von selbst, Wochen-Loop sonntagabends — auch wenn die App zu ist.',
    quelle: 'Gespräch 31.07.',
  },
  {
    id: 'routen-konsolidieren', titel: 'Letzte zwei Routen auf die gemeinsame KI-Schicht', kategorie: 'qualitaet', status: 'offen', prio: 3, block: 'frei',
    warum: 'inbox/draft und kimmi haben noch eigenen Anthropic-Code. Funktioniert, ist aber die letzte Stelle mit doppelter Fehlerbehandlung.',
    quelle: 'Review',
  },
  {
    id: 'supabase-umzug', titel: 'Von Dateien auf echte Datenbank',  kategorie: 'qualitaet', status: 'offen', prio: 3, block: 'frei',
    warum: 'Alles liegt als JSON unter .data/. Reicht für einen Nutzer auf einem Mac. Sobald du von unterwegs oder mit Malin zugreifen willst, braucht es Supabase.',
    quelle: 'Audit',
  },
];
