// ─── MAKE OS — Mit dem Brain chatten (24.09.) ───────────────────────────────
// Kevin: „bau bitte bei dem Wissen einen Chat mit rein, dass ich direkt mit
// dem Hirn chatten kann."
//
// Anders als Jarvis: kein Werkzeug mit Wirkung, keine Live-Zahlen, keine
// Agenten — nur das Obsidian-Brain. Es sucht selbst weiter, liest Notizen
// ganz, antwortet ausschließlich daraus und nennt die Quelle. Was nicht im
// Brain steht, wird nicht erfunden. Ändern kann es nichts; dafür ist Jarvis da.
//
// Die Sicht ist die der fragenden Person (lib/jarvis/vault.ts, darfSehen):
// Kevin fragt sein eigenes Brain und darf dabei auch Privates sehen, Malin
// alles außer Kevins Privatem. Die Antwort geht nur an die Person zurück.

import { askText, fremd, FREMD_REGEL } from '@/lib/anthropic';
import { suche, notiz, type Sicht, type Treffer } from './vault';
import { nameVon } from './raum';

export interface Zug { rolle: 'ich' | 'brain'; text: string }
export interface Quelle { id: string; titel: string; bereich: string; scope?: string }
export interface Antwort { ok: boolean; antwort: string; quellen: Quelle[]; fehler?: string }

const BEREICHE = ['Business', 'Fundament', 'Protokolle', 'Quellen', 'Privat', 'MAKE OS'];
const RUNDEN = 5;

const WERKZEUGE = [
  {
    name: 'suche_wissen',
    description: 'Sucht weiter im Obsidian-Brain — mit anderen Begriffen, Namen, Firmen, Synonymen oder eingeschränkt auf einen Bereich. Liefert Kennung, Titel, Stand und Ausschnitt.',
    input_schema: {
      type: 'object',
      properties: {
        frage: { type: 'string', description: 'Suchbegriffe' },
        bereich: { type: 'string', enum: BEREICHE, description: 'Optional: nur in diesem Bereich suchen' },
      },
      required: ['frage'],
    },
  },
  {
    name: 'lies_notiz',
    description: 'Liest eine Notiz ganz — per Kennung (QUELLE) oder per Titel/Wikilink-Namen. Immer nutzen, wenn es um konkrete Zahlen, Vereinbarungen, Daten oder Personen geht; der Ausschnitt reicht dafür nicht.',
    input_schema: {
      type: 'object',
      properties: { notiz: { type: 'string', description: 'Kennung oder Titel der Notiz' } },
      required: ['notiz'],
    },
  },
];

export function systemText(person: string, heute = new Date()): string {
  const datum = heute.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  return [
    `Du bist das Obsidian-Brain — die Wissensbank von Kevin und Malin (Vault „MAKE", Ordner Make.Claude, dazu die Doku der Software MAKE OS). Gerade chattet ${nameVon(person)} direkt mit dir. Heute ist ${datum}.`,
    '',
    'SO ANTWORTEST DU:',
    '- Nur aus den Notizen. Steht etwas nicht drin, sag das klar („Dazu steht nichts im Brain.") und erfinde nichts. Allgemeinwissen nur, wenn ausdrücklich danach gefragt wird, und dann als solches gekennzeichnet.',
    '- Zu jeder Frage liegen dir erste Suchtreffer bei. Reichen sie nicht, suche mit anderen Begriffen (suche_wissen). Geht es um Zahlen, Vereinbarungen, Termine oder Personen, lies die passende Notiz ganz (lies_notiz) — der Ausschnitt reicht dafür nicht.',
    '- In Wissensnotizen ist der oberste „## 🔴 UPDATE"-Block der gültige Stand, ältere Blöcke sind Historie. In Protokollen und Logs ist der letzte Eintrag der neueste. Achte auf „stand:" und nenne ihn, wenn er für die Antwort zählt.',
    '- Nenne die Quelle direkt an der Aussage als [[Titel]] — exakt der Notiztitel aus TITEL. Widersprechen sich Notizen, sag es und nenne beide mit Stand.',
    '- Deutsch, du-Form, knapp: erst die Antwort, dann das Nötige. Markdown ist erlaubt (Listen, Tabellen, **fett**). Keine Floskeln, keine Einleitung.',
    '- Notizen mit 🔒 PRIVAT darfst du hier verwenden: die Person fragt ihr eigenes Brain, die Antwort sieht nur sie.',
    '- Du kannst nichts anlegen, ändern oder verschicken. Will die Person etwas festhalten, sag ihr, dass Jarvis das kann.',
    '',
    FREMD_REGEL,
  ].join('\n');
}

export function trefferText(treffer: Treffer[], durchsucht: number): string {
  if (!treffer.length) return `Keine Treffer (${durchsucht} Notizen durchsucht).`;
  return `${treffer.length} Treffer aus ${durchsucht} Notizen:\n\n` + treffer.map(t =>
    `QUELLE ${t.id}\nTITEL ${t.titel} · ${t.bereich}${t.scope === 'privat' ? ' · 🔒 PRIVAT' : ''}${t.stand ? ` · stand: ${t.stand}` : ''}\n${t.ausschnitt}`,
  ).join('\n\n───\n\n');
}

/**
 * Der bisherige Verlauf als Nachrichten fürs Modell: nur Text, höchstens
 * `max` Züge, beginnt mit einer Frage, gleiche Rollen hintereinander werden
 * zusammengelegt (die Schnittstelle verlangt den Wechsel).
 */
export function verlaufNachrichten(verlauf: Zug[], max = 8): { role: 'user' | 'assistant'; content: string }[] {
  const aus: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const z of verlauf.slice(-max)) {
    const text = String(z.text ?? '').trim().slice(0, 4000);
    if (!text) continue;
    const role = z.rolle === 'ich' ? 'user' : 'assistant';
    const letzte = aus[aus.length - 1];
    if (letzte && letzte.role === role) letzte.content += `\n\n${text}`;
    else aus.push({ role, content: text });
  }
  while (aus.length && aus[0].role !== 'user') aus.shift();
  // Die neue Frage folgt als user — also muss der Verlauf mit einer Antwort enden.
  if (aus.length && aus[aus.length - 1].role === 'user') aus.pop();
  return aus;
}

/**
 * Welche Quellen unter der Antwort stehen: was ganz gelesen wurde und was die
 * Antwort als [[Titel]] nennt — sonst nichts. Bloße Suchtreffer wären bei
 * „Dazu steht nichts im Brain" irreführend (gefunden beim ersten Test).
 * Höchstens acht.
 */
export function quellenAuswahl(antwort: string, gelesen: string[], bekannt: Map<string, Quelle>): Quelle[] {
  const genannt = new Set(Array.from(antwort.matchAll(/\[\[([^\]|#]+)/g)).map(m => m[1].trim().toLowerCase()));
  const ids: string[] = [...gelesen];
  bekannt.forEach((q, id) => { if (genannt.has(q.titel.toLowerCase())) ids.push(id); });
  const aus: Quelle[] = [];
  for (const id of ids) {
    const q = bekannt.get(id);
    if (q && !aus.some(x => x.id === id)) aus.push(q);
  }
  return aus.slice(0, 8);
}

interface Block { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string }

/** Eine Frage an das Brain — mit eigener Suche, bis zu fünf Runden. */
export async function frageBrain(frage: string, verlauf: Zug[], sicht: Sicht): Promise<Antwort> {
  const bekannt = new Map<string, Quelle>();
  const merke = (t: { id: string; titel: string; bereich: string; scope?: string }) => bekannt.set(t.id, { id: t.id, titel: t.titel, bereich: t.bereich, scope: t.scope });
  const gelesen: string[] = [];

  // Kurze Nachfragen („und seit wann?") tragen die letzte Frage mit in die Suche.
  const letzteFrage = [...verlauf].reverse().find(z => z.rolle === 'ich')?.text ?? '';
  const suchtext = frage.length < 40 && letzteFrage ? `${letzteFrage} ${frage}` : frage;
  const erste = await suche(suchtext, 6, sicht);
  erste.treffer.forEach(merke);

  const msgs: unknown[] = [
    ...verlaufNachrichten(verlauf),
    { role: 'user', content: `${frage}\n\nErste Treffer aus dem Brain:\n${fremd('obsidian-brain', trefferText(erste.treffer, erste.durchsucht))}` },
  ];
  const system = systemText(sicht.person);
  let antwort = '';

  for (let runde = 0; runde < RUNDEN; runde++) {
    const r = await askText({ system, user: frage, messages: msgs, tools: WERKZEUGE, maxTokens: 3500, timeoutMs: 120_000, zweck: 'brain-chat' });
    if (!r.ok) {
      const fehler = r.error === 'no-key' ? 'Ohne Anthropic-Schlüssel kann das Brain nicht antworten.' : `Die KI hat nicht geantwortet (${r.status || 'offline'}).`;
      return { ok: false, antwort: '', quellen: [], fehler };
    }
    const content: Block[] = Array.isArray((r.raw as { content?: Block[] })?.content) ? (r.raw as { content: Block[] }).content : [];
    const rufe = content.filter(b => b.type === 'tool_use');
    if (!rufe.length || r.stopReason !== 'tool_use') { antwort = r.text; break; }

    msgs.push({ role: 'assistant', content });
    const ergebnisse: unknown[] = [];
    for (const b of rufe) {
      const input = b.input ?? {};
      let text = 'Unbekanntes Werkzeug.';
      if (b.name === 'suche_wissen') {
        const bereich = BEREICHE.includes(String(input.bereich)) ? String(input.bereich) : undefined;
        const d = await suche(String(input.frage ?? '').slice(0, 300), 6, sicht, bereich);
        d.treffer.forEach(merke);
        text = fremd('obsidian-brain', trefferText(d.treffer, d.durchsucht));
      } else if (b.name === 'lies_notiz') {
        const d = await notiz(String(input.notiz ?? ''), 9000, sicht);
        if (d.ok && d.id) {
          merke({ id: d.id, titel: d.titel ?? d.id, bereich: d.bereich ?? '', scope: d.scope });
          if (!gelesen.includes(d.id)) gelesen.push(d.id);
          text = fremd('obsidian-brain', `NOTIZ ${d.id}\nTITEL ${d.titel}${d.scope === 'privat' ? ' · 🔒 PRIVAT' : ''}${d.stand ? ` · stand: ${d.stand}` : ''}${d.typ ? ` · typ: ${d.typ}` : ''}${d.oben ? `\nGÜLTIGER STAND (oberster 🔴-Block):\n${d.oben}\n───` : ''}\n\n${d.text}`);
        } else text = d.fehler ?? 'Nicht lesbar.';
      }
      ergebnisse.push({ type: 'tool_result', tool_use_id: b.id, content: text });
    }
    // Vor der letzten Runde: jetzt antworten, nicht weitersuchen.
    if (runde === RUNDEN - 2) ergebnisse.push({ type: 'text', text: 'Genug gesucht — antworte jetzt mit dem, was du gefunden hast.' });
    msgs.push({ role: 'user', content: ergebnisse });
  }

  if (!antwort.trim()) return { ok: false, antwort: '', quellen: quellenAuswahl('', gelesen, bekannt), fehler: 'Ich habe gesucht, aber keine Antwort formuliert. Frag bitte etwas genauer.' };
  return { ok: true, antwort: antwort.trim(), quellen: quellenAuswahl(antwort, gelesen, bekannt) };
}
