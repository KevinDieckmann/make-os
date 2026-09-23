// ─── MAKE OS — Die Ordnung ──────────────────────────────────────────────────
// Kevins & Malins Grundsatz-Reihenfolge: WAS zuerst zählt, wenn alles wichtig
// ist. Die Reihenfolge der Themen ist die eigentliche Priorisierung — sie
// steht über der Dringlichkeit einer einzelnen Aufgabe (Eisenhower: erst das
// Wichtige, dann das Dringende).
//
// Client-safe: keine Server-Importe (wird auch in Views geladen).

export interface Thema {
  id: string;
  label: string;
  /** Ein Satz: warum dieses Thema an dieser Stelle steht. */
  satz: string;
  farbe: string;
  /** Erkennt das Thema am Aufgaben-Text, wenn nichts von Hand gesetzt ist. */
  muster: RegExp;
}

/** Die vier Bahnen, in denen bei uns gearbeitet wird. */
export const THEMEN: Thema[] = [
  {
    id: 'recht',
    label: 'Recht & Fundament',
    satz: 'Sauber und rechtssicher dastehen — sonst trägt nichts darüber.',
    farbe: '#DE9E63',
    muster: /rechtsf|gewerbe|steuer|notar|gründ|anmeld|umsatzsteuer|ust|buchhalt|vertrag|versicher|namensänder|rechtsstreit|anwalt|behörde|agentur für arbeit|finanzamt|betriebsnummer|abwickeln/i,
  },
  {
    id: 'umsatz',
    label: 'Umsatz & Cashflow',
    satz: 'Geld verdienen und Liquidität sichern — der Motor.',
    farbe: '#21B5AA',
    muster: /rechnung|kunde|mandat|cashflow|umsatz|sales|pipeline|crm|kontakt|netzwerk|investor|förder|kredit|zahlung|budget|schulden|preis|produkt.?paket|akquise|angebot|honorar/i,
  },
  {
    id: 'produkt',
    label: 'Produkt & System',
    satz: 'Die eigene Software und die Systeme dahinter — unser Hebel.',
    farbe: '#4A6CF7',
    muster: /software|make os|capos|agent|system|bauplan|deploy|hetzner|github|datenbasis|stammdaten|dashboard|automatis|f&f|launch|jarvis|prototyp/i,
  },
  {
    id: 'leben',
    label: 'Gesundheit & Leben',
    satz: 'Gesundheit, Beziehung, Zuhause — wofür das alles gemacht wird.',
    farbe: '#58D9CD',
    muster: /gesund|sport|reha|ernähr|routine|schlaf|wohnung|umzug|urlaub|hyrox|arzt|therapie|lebensziel|beziehung|familie/i,
  },
];

export const THEMA = Object.fromEntries(THEMEN.map(t => [t.id, t])) as Record<string, Thema>;

/** Kevins diktierte Startreihenfolge — von Kevin & Malin jederzeit änderbar. */
export const STANDARD_ORDNUNG = ['recht', 'umsatz', 'produkt', 'leben'];

/** Projekte, die immer in eine feste Bahn gehören (schlägt die Mustererkennung). */
const PROJEKT_THEMA: Record<string, string> = {
  'proj-health': 'leben',
  'proj-privat': 'leben',
  'proj-make': 'produkt',
  'proj-capos': 'produkt',
};

/**
 * Bahn einer Aufgabe: von Hand gesetzt > Projekt-Zuordnung > Muster im Text >
 * „umsatz" als Auffangbahn (Geschäft ist der Normalfall).
 */
export function themaVon(
  t: { id: string; title: string; description?: string; projectId: string },
  zuordnung: Record<string, string> = {},
): string {
  const hand = zuordnung[t.id];
  if (hand && THEMA[hand]) return hand;
  const fest = PROJEKT_THEMA[t.projectId];
  if (fest) return fest;
  const text = `${t.title} ${t.description ?? ''}`;
  for (const th of THEMEN) if (th.muster.test(text)) return th.id;
  return 'umsatz';
}

/**
 * Themen mit Kevins und Malins eigenen Bezeichnungen. Kommt aus dem Kompass
 * („Eigene Bezeichnungen") — leer heißt: es bleibt beim Standard.
 */
export function themenMit(eigene: Record<string, string> = {}): Record<string, Thema> {
  const raus: Record<string, Thema> = {};
  for (const t of THEMEN) {
    const name = (eigene[t.id] ?? '').trim();
    raus[t.id] = name ? { ...t, label: name } : t;
  }
  return raus;
}

/** Themen in der gespeicherten Reihenfolge, unbekannte hinten dran. */
export function sortierteThemen(reihenfolge: string[], eigene: Record<string, string> = {}): Thema[] {
  const karte = themenMit(eigene);
  const bekannt = reihenfolge.filter(id => karte[id]);
  const rest = THEMEN.filter(t => !bekannt.includes(t.id)).map(t => t.id);
  return [...bekannt, ...rest].map(id => karte[id]);
}
