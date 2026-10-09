// ─── MAKE OS — ZOE-Verlauf ───────────────────────────────────────────────
// Vorgabe: „ich möchte bei ZOE auch immer die Historie reingeben,
// damit wir das sauber haben."
//
// Zwei Dinge, die vorher fehlten:
//   1. ZOE bekam bei JEDER Nachricht ein leeres Gedächtnis — die vorherigen
//      Züge gingen nie an die KI. Jetzt geht der Verlauf mit in den Prompt.
//   2. Das Gespräch lag nur im sessionStorage — beim Schließen des Browsers weg.
//      Jetzt liegt es als Datei auf der Platte, wie alles andere im OS auch.
//
// Ein Gespräch ist der Behälter, Nachrichten liegen darin. Beim Öffnen kommt
// das letzte Gespräch zurück; „Neu" archiviert es, statt es zu löschen.

/**
 * Wer spricht: `nutzer` (die Person, mit der ZOE spricht) oder `zoe`. Bis 09.10. hieß die Nutzer-Rolle nach einer festen Person —
 * neu geschrieben wird nur noch `nutzer` (Plattform-Regel, Paket 4a); der Altbestand mit der alten Kennung wird weiter gelesen
 * (`istNutzer`: alles, was nicht `zoe` ist, ist die Person).
 */
export type Rolle = 'nutzer' | 'zoe';
/** Was im Bestand stehen kann: neue Rollen und — im Altbestand — die frühere Kennung der Person (wird nie neu geschrieben). */
export type GeleseneRolle = Rolle | (string & {});
/** Ist das die Person (nicht ZOE)? — versteht neue (`nutzer`) und alte Einträge. */
export const istNutzer = (rolle: unknown): boolean => rolle !== 'zoe';

export interface VerlaufNachricht {
  rolle: GeleseneRolle;
  text: string;
  /** ISO-Zeitpunkt. */
  zeit: string;
  /** Welche Agenten in diesem Zug gelaufen sind — für die Rückschau. */
  ran?: { agent: string; ok: boolean }[];
}

export interface Gespraech {
  id: string;
  /** ISO */
  begonnen: string;
  /** ISO — danach wird sortiert. */
  zuletzt: string;
  /** Aus der ersten Frage abgeleitet, damit die Liste lesbar ist. */
  titel: string;
  nachrichten: VerlaufNachricht[];
  /** Wem das Gespräch gehört (24.09.) — ohne Angabe: der Inhaber der Instanz (aus der Zeit mit nur einem Konto). */
  person?: string;
}

/** Was wir behalten. Reicht für Monate; die Datei bleibt trotzdem klein. */
import { wandzeit } from '@/lib/kalender/zeit';
import { tagePlus } from '@/lib/zeit';

export const GRENZEN = {
  gespraeche: 80,
  nachrichtenProGespraech: 240,
  zeichenProNachricht: 8000,
  /** So viele frühere Nachrichten gehen mit in den Prompt. */
  imPrompt: 16,
} as const;

/** Titel aus der ersten Frage — erster Satz, hart gekappt. */
export function titelAus(text: string): string {
  const roh = text.replace(/\s+/g, ' ').trim();
  if (!roh) return 'Gespräch';
  const satz = roh.split(/(?<=[.!?])\s/)[0] ?? roh;
  return (satz.length > 58 ? `${satz.slice(0, 56).trimEnd()}…` : satz);
}

/**
 * Der Ausschnitt, der an die KI geht. Anthropic verlangt: beginnt mit „user",
 * Rollen wechseln sich ab. Wir schneiden hinten ab (das Jüngste zählt), werfen
 * einen führenden ZOE-Zug weg und fassen gleiche Rollen zusammen.
 */
export function fuerPrompt(nachrichten: VerlaufNachricht[], wieViele = GRENZEN.imPrompt): { role: 'user' | 'assistant'; content: string }[] {
  const teil = nachrichten.slice(-wieViele).filter(n => n.text.trim());
  const raus: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const n of teil) {
    const role = istNutzer(n.rolle) ? 'user' as const : 'assistant' as const;
    if (!raus.length && role === 'assistant') continue;
    const letzte = raus[raus.length - 1];
    if (letzte && letzte.role === role) letzte.content = `${letzte.content}\n\n${n.text}`;
    else raus.push({ role, content: n.text });
  }
  // Endet der Ausschnitt beim Nutzer, hängt die aktuelle Frage direkt daran —
  // dann fehlt die Antwort dazwischen. Lieber den offenen Zug weglassen.
  if (raus.length && raus[raus.length - 1].role === 'user') raus.pop();
  return raus;
}

/**
 * Datum als „Heute · 14:32" / „Gestern · 09:10" / „So 27.07." — Tag und Uhrzeit in BERLINER Zeit (29.09., Paket D-A #40).
 * Vorher verglich es den UTC-Tag des Zeitstempels mit dem Berliner `heute`: zwischen 0 und 2 Uhr stand „Gestern“.
 */
export function wannText(iso: string, heute: string): string {
  const d = new Date(iso);
  const wand = Number.isNaN(d.getTime()) ? iso : wandzeit(d);
  const tag = wand.slice(0, 10);
  const uhr = wand.slice(11, 16);
  if (tag === heute) return `Heute · ${uhr}`;
  if (tag === tagePlus(heute, -1)) return `Gestern · ${uhr}`;
  return `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag}T12:00:00Z`).getUTCDay()]} ${tag.slice(8)}.${tag.slice(5, 7)}.`;
}

/**
 * Markdown raus, damit die Sprachausgabe keine Sternchen vorliest.
 * Bewusst konservativ: lieber ein Zeichen zu viel als ein Wort zu wenig.
 */
/**
 * Markdown weg, Absätze bleiben — für Flächen ohne Markdown-Darstellung.
 *
 * fuerStimme() macht daneben noch aus jedem Absatz einen Punkt; das ist zum
 * Vorlesen richtig und zum Lesen falsch. Auf dem Empfangsbildschirm standen
 * deshalb am 07.09. die Sternchen roh im Text.
 */
export function ohneMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Aufzählungsstriche werden zu Punkten: der Bindestrich am Zeilenanfang
    // liest sich wie ein Minuszeichen, und in ZOE' Antworten stehen oft
    // Zahlen direkt dahinter.
    .replace(/^\s{0,3}[-*+]\s+/gm, '·  ')
    .trim();
}

export function fuerStimme(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' Codeblock. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^\s*[-–—◇•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}
