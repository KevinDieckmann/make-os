// ─── MAKE OS — Umsetzungs-Einschätzung ──────────────────────────────────────
// Unser eigener Beitrag zum Taskmanagement: Andere Werkzeuge verwalten
// Aufgaben — wir schätzen ein, WIE sie erledigt werden. Zu jeder Aufgabe:
// Kann Jarvis das übernehmen, braucht es einen Menschen, wie lange dauert es,
// und was ist der erste Schritt.
//
// Bewusst deterministisch (Regeln, keine KI): läuft ohne Netz, ist erklärbar
// und immer gleich. Jarvis verfeinert auf Knopfdruck.
//
// Client-safe: keine Server-Importe.

export type Wer = 'jarvis' | 'gemeinsam' | 'mensch';

export interface Einschaetzung {
  wer: Wer;
  /** Geschätzte Dauer in Minuten (Median-Fall). */
  dauer: number;
  /** Was Jarvis konkret beitragen kann — leer, wenn nichts. */
  beitrag?: string;
  /** Warum die Einschätzung so ausfällt. */
  warum: string;
}

export const WER_LABEL: Record<Wer, string> = {
  jarvis: 'Jarvis kann das',
  gemeinsam: 'Jarvis bereitet vor',
  mensch: 'nur persönlich',
};
export const WER_FARBE: Record<Wer, string> = {
  jarvis: '#21B5AA',
  gemeinsam: '#4A6CF7',
  mensch: '#DE9E63',
};

/** Handlungen, die zwingend ein Mensch tut — Unterschrift, Stimme, Körper, Geld. */
const NUR_MENSCH: { muster: RegExp; warum: string; beitrag?: string }[] = [
  { muster: /unterschr|unterzeichn|beurkund|notartermin/i, warum: 'Unterschrift', beitrag: 'Unterlagen vollständig zusammenstellen' },
  { muster: /\banruf|telefon|call\b|gespr[äa]ch f[üu]hren|besprechen mit/i, warum: 'Gespräch', beitrag: 'Gesprächsleitfaden + Fragenliste' },
  { muster: /\btermin\b|treffen|meeting|session\b/i, warum: 'Termin', beitrag: 'Agenda und Unterlagen vorbereiten' },
  { muster: /bezahl|[üu]berweis|zahlung ausl[öo]sen|einzahl/i, warum: 'Geldbewegung', beitrag: 'Betrag, Empfänger und Frist zusammentragen' },
  { muster: /einreich|abgeben|persönlich|vor ort|hinfahren|abholen/i, warum: 'persönlich vorzulegen', beitrag: 'Checkliste, was mitmuss' },
  { muster: /entscheid|festlegen|freigeb|abstimmen zwischen/i, warum: 'Entscheidung', beitrag: 'Entscheidungsvorlage mit Optionen und Folgen' },
  { muster: /training|sport|laufen|essen|kochen|einkauf|putzen|reparatur|aufr[äa]umen/i, warum: 'körperlich zu tun', beitrag: 'Plan oder Liste dafür' },
  { muster: /arzt|behandlung|physio|reha/i, warum: 'Gesundheit persönlich', beitrag: 'Termine und Fragen vorbereiten' },
];

/** Arbeit, die Jarvis allein zu Ende bringen kann. */
const JARVIS_KANN: { muster: RegExp; warum: string; beitrag: string }[] = [
  { muster: /recherch|analys|\bpr[üu]fen\b|vergleich|markt.?analyse|einsch[äa]tzung|kl[äa]ren\b|herausfinden/i, warum: 'Recherche und Analyse', beitrag: 'Recherche fahren und Ergebnis vorlegen' },
  { muster: /entwurf|texten|schreiben|formulier|vorlage|skript|agenda|konzept/i, warum: 'Text und Entwurf', beitrag: 'Entwurf schreiben — du gibst frei' },
  { muster: /liste|zusammenstell|sammeln|sortier|aufr[äa]umen im system|erfassen|[üu]bersicht/i, warum: 'Zusammenstellen', beitrag: 'Liste bauen und im System ablegen' },
  // „Agentur für Arbeit" ist kein Agent — Wortgrenze hinten ist Pflicht.
  { muster: /\bbauen\b|programmier|einrichten im system|automatis|\bagenten?\b|software|\bmodul/i, warum: 'Bauarbeit am System', beitrag: 'Bauen und verifizieren' },
  { muster: /zusammenfass|protokoll|dokumentation|aufbereiten/i, warum: 'Aufbereiten', beitrag: 'Zusammenfassung erstellen' },
];

/** Dauer-Anhaltspunkte: was die Aufgabe ungefähr kostet. */
const DAUER: { muster: RegExp; min: number }[] = [
  { muster: /strategie|konzept|aufsetzen|struktur|komplett|von vorne|entwickeln/i, min: 180 },
  { muster: /buchhalt|aufarbeit|alle .* schreiben|zusammenstell|durchplan|verteil/i, min: 120 },
  { muster: /gespr[äa]ch|meeting|termin|session|abstimmen/i, min: 90 },
  { muster: /entwurf|vorlage|agenda|skript|liste|recherch|analys/i, min: 45 },
  { muster: /anschreiben|mail|nachhaken|nachfragen|anfrage|klären mit/i, min: 20 },
  { muster: /eintragen|abhaken|weiterleiten|hochladen|bestellen|kurz\b/i, min: 10 },
];

export function einschaetzen(t: { title: string; description?: string; priority?: string }): Einschaetzung {
  const text = `${t.title} ${t.description ?? ''}`;

  const mensch = NUR_MENSCH.find(r => r.muster.test(text));
  const jarvis = JARVIS_KANN.find(r => r.muster.test(text));

  // Dauer: die längste zutreffende Regel gewinnt — lieber zu groß schätzen
  // als den Tag zu sprengen. Ohne Treffer: eine halbe Stunde.
  const dauer = DAUER.filter(d => d.muster.test(text)).reduce((mx, d) => Math.max(mx, d.min), 0) || 30;

  if (mensch && jarvis) {
    return { wer: 'gemeinsam', dauer, beitrag: jarvis.beitrag, warum: `${jarvis.warum} kann ich, ${mensch.warum} bleibt bei dir` };
  }
  if (mensch) {
    return { wer: 'mensch', dauer, beitrag: mensch.beitrag, warum: mensch.warum };
  }
  if (jarvis) {
    return { wer: 'jarvis', dauer: Math.max(10, Math.round(dauer * 0.4)), beitrag: jarvis.beitrag, warum: jarvis.warum };
  }
  return { wer: 'gemeinsam', dauer, beitrag: 'Aufgabe zerlegen und den ersten Schritt vorbereiten', warum: 'unklar zugeschnitten — Zerlegen hilft' };
}

/** „1 h 30" statt „90 Minuten" — kürzer zu lesen. */
export function dauerText(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}
