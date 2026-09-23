// ─── MAKE OS — Jarvis-Verlauf ───────────────────────────────────────────────
// Kevins Ansage: „ich möchte bei Jarvis auch immer die Historie reingeben,
// damit wir das sauber haben."
//
// Zwei Dinge, die vorher fehlten:
//   1. Jarvis bekam bei JEDER Nachricht ein leeres Gedächtnis — die vorherigen
//      Züge gingen nie an die KI. Jetzt geht der Verlauf mit in den Prompt.
//   2. Das Gespräch lag nur im sessionStorage — beim Schließen des Browsers weg.
//      Jetzt liegt es als Datei auf der Platte, wie alles andere im OS auch.
//
// Ein Gespräch ist der Behälter, Nachrichten liegen darin. Beim Öffnen kommt
// das letzte Gespräch zurück; „Neu" archiviert es, statt es zu löschen.

export type Rolle = 'kevin' | 'jarvis';

export interface VerlaufNachricht {
  rolle: Rolle;
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
}

/** Was wir behalten. Reicht für Monate; die Datei bleibt trotzdem klein. */
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
 * einen führenden Jarvis-Zug weg und fassen gleiche Rollen zusammen.
 */
export function fuerPrompt(nachrichten: VerlaufNachricht[], wieViele = GRENZEN.imPrompt): { role: 'user' | 'assistant'; content: string }[] {
  const teil = nachrichten.slice(-wieViele).filter(n => n.text.trim());
  const raus: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const n of teil) {
    const role = n.rolle === 'kevin' ? 'user' as const : 'assistant' as const;
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

/** Datum als „Heute · 14:32" / „Gestern · 09:10" / „So 27.07." */
export function wannText(iso: string, heute: string): string {
  const tag = iso.slice(0, 10);
  const uhr = iso.slice(11, 16);
  if (tag === heute) return `Heute · ${uhr}`;
  const gestern = new Date(`${heute}T12:00:00`);
  gestern.setDate(gestern.getDate() - 1);
  if (tag === gestern.toISOString().slice(0, 10)) return `Gestern · ${uhr}`;
  const d = new Date(`${tag}T12:00:00`);
  return `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]} ${tag.slice(8)}.${tag.slice(5, 7)}.`;
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
    // liest sich wie ein Minuszeichen, und in Jarvis' Antworten stehen oft
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
