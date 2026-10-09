// ─── Was ein Fach-Agent zurückbringt — seine KI-Kategorien (09.10., KI-Etiketten, Analyse 4 · K1) ─────────────────────────────
// `run_agent` (ZOE-Gespräch) und `fach_agent` (Mitarbeiter im Agenten-Bereich) reichen das Ergebnis eines Fach-Agenten zurück an das
// Modell. Bis heute ohne Kategorie: ein Tagesplan mit „Recovery 34 %“ ging in den NÄCHSTEN Modellaufruf, ohne dass das KI-Tor
// (Einwilligung (b), EU-Mindeststufe des Anbieter-Tors, KI-Schalter je Bereich) davon wusste.
//
// Jetzt EINE Stelle (rein): je Fach-Agent die Kategorien, die sein Ergebnis IMMER tragen kann (`AGENT_KATEGORIEN`), dazu „gesundheit“
// nur, wenn der Lauf sie wirklich hineingenommen hat (`AGENT_MIT_GESUNDHEIT` + Rückmeldung der Route, `gesundheit: true`). Die
// Schleife (lib/agenten/schleife.ts `zustandNach`) nimmt sie in den Zustand — der nächste `askText` trägt sie, das KI-Tor greift.
// Angeboten wird ein Fach-Agent nur, wenn seine festen Kategorien für die Person frei sind (`agentSperre`, gleiche Regel wie die
// Werkzeuge: lib/datenschutz/ki-werkzeuge.ts `werkzeugSperre`).
// Neuer Fach-Agent → hier eine Zeile (Wächter tests/ki-etiketten.test.ts: jeder ausführbare Fach-Agent hat einen Eintrag).

import type { KiKategorie, KiSchalter } from '@/lib/datenschutz/ki-einstellungen';
import { werkzeugSperre } from '@/lib/datenschutz/ki-werkzeuge';

/** Feste Kategorien je Fach-Agent — was im Ergebnis stehen KANN (nie weniger, sonst sieht das Tor es nicht). */
export const AGENT_KATEGORIEN: Readonly<Record<string, readonly KiKategorie[]>> = {
  research: ['allgemein', 'web'],
  board: ['finanzen', 'aufgaben', 'crm'],
  okr: ['finanzen', 'aufgaben'],
  controlling: ['finanzen'],
  finanzchef: ['finanzen', 'crm'],
  fokus: ['aufgaben'],
  kalender: ['kalender', 'aufgaben'],
  inbox: ['postfach'],
  task: ['aufgaben'],
  prospect: ['crm'],
  planung: ['kalender', 'aufgaben'],
  ernaehrung: ['allgemein'],
  performance: ['aufgaben', 'finanzen'],
  content: ['allgemein', 'brain', 'crm'],
  meeting: ['kalender', 'aufgaben'],
  outreach: ['crm'],
  crm: ['crm'],
  'head-sales': ['crm'],
  'head-marketing': ['crm'],
  'head-event': ['crm'],
};

/**
 * Fach-Agenten, deren Lauf Gesundheitswerte in den eigenen Prompt nehmen kann (nur mit Einwilligung (b) der Person) — dann trägt auch
 * das Ergebnis „gesundheit“. Ob es so war, meldet die Route (`gesundheit: true`); ohne Rückmeldung gilt vorsichtshalber „ja“.
 */
export const AGENT_MIT_GESUNDHEIT: ReadonlySet<string> = new Set(['fokus', 'kalender', 'planung', 'ernaehrung', 'performance']);

/** Kategorien eines Laufs (rein). `gesundheitImErgebnis`: Rückmeldung der Route — `undefined` = unbekannt (vorsichtig: ja). */
export function agentKategorien(agent: string, gesundheitImErgebnis?: boolean): KiKategorie[] {
  const fest = AGENT_KATEGORIEN[agent] ?? ['allgemein'];
  const mitG = AGENT_MIT_GESUNDHEIT.has(agent) && gesundheitImErgebnis !== false;
  return Array.from(new Set<KiKategorie>([...fest, ...(mitG ? ['gesundheit' as const] : [])]));
}

/**
 * Fach-Agenten, deren Ergebnis aus dem PRIVAT-BEREICH des Haushalts schöpft (09.10., E4 — EINE Konto-Sicht): die Ernährung (gemeinsamer
 * Plan, Einkauf, Profile des Haushalts). Ein Konto „nur Business“ bekommt sie weder angeboten (kimmi) noch gestartet (`runAgent`). Die
 * übrigen lesen Aufgaben/Ziele über die Sicht der Person (`ladeAufgabenSicht`, `gatherBrain`) — dort ist Privat schon herausgefiltert.
 */
export const PRIVAT_AGENTEN: ReadonlySet<string> = new Set(['ernaehrung']);
/** Darf ein Konto mit dieser Sicht den Fach-Agenten nutzen? (rein) `nurBusiness` = Konto „nur Business“. */
export const agentFuerKonto = (agent: string, nurBusiness: boolean): boolean => !nurBusiness || !PRIVAT_AGENTEN.has(agent);

/**
 * Darf ZOE diesen Fach-Agenten der Person anbieten? Gesperrt, sobald eine seiner FESTEN Kategorien für sie aus ist (Bereich-Schalter) —
 * „gesundheit“ zählt hier nicht: ohne (b) läuft der Agent ohne Gesundheitswerte (und meldet das zurück). Liefert den Satz oder null.
 */
export function agentSperre(agent: string, s: KiSchalter, gesundheitKi: boolean): string | null {
  for (const k of AGENT_KATEGORIEN[agent] ?? ['allgemein']) {
    const satz = werkzeugSperre(k, s, gesundheitKi);
    if (satz) return satz;
  }
  return null;
}
