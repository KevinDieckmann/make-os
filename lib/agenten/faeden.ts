// ─── Agenten-Bereich: Threads — die Regeln (09.10., Paket 1 „Kern“; AGENTEN_KONZEPT.md C3/C4, ARCHITEKTUR.md Teil 8) ───────
// Rein (ohne Server-Module, getestet in tests/agenten-faeden.test.ts). Die Schreibstelle ist faeden-server.ts; der Bestand ist
// `agenten-faeden--<person>` (`fadenBestand`, lib/agenten/typen.ts). Regeln:
//   • Der Verlauf liegt NUR auf dem Server — der Prompt liest ihn hier (`fuerPrompt`: die letzten 16 Nachrichten + eine
//     serverseitig gerechnete Kurzfassung der älteren). Der Browser schickt nur die neue Nachricht.
//   • `fremdGelesen`/`vertraulich` stehen am Thread und setzt nur der Server (Lauf, Werkzeug, Bericht) — vererbt vom Eltern- auf
//     den Kind-Thread und vom Bericht zurück (R9).
//   • Einzeländerungen mit Stand (`fadenStand`) → 409; Grenzen → 413 mit Text, nie kürzen (CLAUDE.md „Nie abschneiden, ablehnen“).
//   • Löschfrist: 12 Monate nach der letzten Nachricht (Entscheidung 09.10., Fragerunde Teil 2 Nr. 17) — Feld je Thread mit Vorgabe.
//   • Gedächtnis „Persönlich“ liegt im selben Bestand (je Person, sichtbar und löschbar); „Haushalt“ nur per Klick (Stapel-Art
//     `merksatz`); nie Daten Dritter, nie aus einem Thread mit fremdem Text (R12).
// Typen von Paket 0 werden nur ERWEITERT (lokale Felder, alle optional) — `Faden`/`Nachricht` aus typen.ts bleiben gültig.

import { GRENZEN, agentSchluessel, laufEingereiht, type AgentRef, type AuftragKarte, type Bereich, type Brett, type BrettEintrag, type Faden, type FadenBestand, type FadenKurz, type FadenStatus, type LaufZustand, type Merksatz, type Nachricht, type PlanFreigabe } from './typen';

// ── Erweiterte Formen (alle Zusatzfelder optional) ──────────────────────────────────────────────────────────────────────

// Auftrag, Brett und Plan-Freigabe stehen seit Paket 4b im Vertrag (lib/agenten/typen.ts) — hier nur weitergereicht.
export type { AuftragKarte } from './typen';

/**
 * Metadaten eines Laufs (Lauf-Protokoll, R16) — angelehnt an OpenTelemetry GenAI (`gen_ai.operation.name` → `operation`,
 * `gen_ai.agent.name` → `agent`, `gen_ai.request.model` → `modell`, `gen_ai.usage.*` → `token`). Nie Inhalte, nie Namen.
 */
export interface LaufSpan {
  lauf_id: string;
  eltern_lauf_id?: string;
  agent: string;
  operation: 'chat' | 'invoke_agent';
  modell: string;
  runden: number;
  werkzeug_aufrufe: number;
  token: { ein: number; aus: number; cache_lesen: number; cache_schreiben: number };
  cent: number;
  dauer_ms: number;
  /** ok · gestapelt · abgebrochen:<grund> · fehler:<grund> · wartet:<grund>. */
  ergebnis: string;
}

export interface NachrichtKern extends Nachricht {
  /** Text eines Agenten aus einem ANDEREN Lauf (Bericht, Ergebnis) — im Prompt immer als `fremd(<quelle>, …)` gekapselt. */
  fremd?: string;
  /** Aufklappbare Karte „An Thread … gesendet“ (Ziel, Format, Grenzen, Quellen). */
  auftrag?: AuftragKarte;
  /** Lauf-Protokoll dieser Antwort (nur Metadaten). */
  lauf?: LaufSpan;
}

export type { Brett, BrettEintrag, PlanFreigabe } from './typen';

export interface FadenKern extends Faden {
  nachrichten: NachrichtKern[];
  /** Per Knopf geteilt (nur Business): das Team liest mit. */
  geteilt?: { am: string; von: string } | null;
  /** Bis wann der Besitzer gelesen hat (für „ungelesen“). */
  gelesenAm?: string;
  /** Head-Thread: Bretter je Auftrag. */
  bretter?: Brett[];
  /** Mitarbeiter-Thread: zu welchem Brett er gehört. */
  brettId?: string;
  /** Helfer-Thread (Antwort auf eine Hilfe-Frage): liefert nur Funde, schreibt nichts Wirksames (R4). */
  helfer?: { frageId: string; fuerFadenId: string };
  /** Agenten-Kette von oben nach unten — kein Agent zweimal (R3). */
  kette?: string[];
  /** Gestellte Hilfe-Fragen in diesem Thread (höchstens `KERN_GRENZEN.hilfeJeFaden`). */
  hilfeAnfragen?: number;
  /** Offene und entschiedene Plan-Freigaben (Head-Thread). */
  plaene?: PlanFreigabe[];
  /** Löschfrist in Monaten nach der letzten Nachricht — ohne Angabe die Vorgabe (12). */
  loeschfristMonate?: number;
  /** Lauf aus dem Takt (Hintergrund) — vererbt auf Kind-Threads. */
  hintergrund?: boolean;
}

export interface FadenBestandKern extends FadenBestand {
  faeden: FadenKern[];
  /** Gedächtnis „Persönlich“ je Agent (`agentSchluessel`) — nur die Person selbst sieht es. */
  gedaechtnis?: Partial<Record<string, Merksatz[]>>;
  /**
   * Einmalige Übernahme des alten ZOE-Verlaufs (Bestand `zoe-verlauf`) in ZOE-Threads (Paket 4a, lib/agenten/zoe-faden.ts) — gesetzt
   * beim ersten Lesen; danach nie wieder (der alte Bestand bleibt liegen).
   */
  zoeUebernahme?: { am: string; anzahl: number };
}

/** Zusätzliche Grenzen des Kerns (die gemeinsamen stehen in `GRENZEN`, typen.ts). */
export const KERN_GRENZEN = {
  titel: 120,
  kurzfassungZeichen: 4_000,
  brettEintraege: 200,
  bretterJeFaden: 50,
  hilfeJeLauf: 1,
  hilfeJeFaden: 3,
  plaeneJeFaden: 50,
  /** Mitarbeiter je Zug ohne Plan-Freigabe (R14: „mehr als 2“ braucht den Klick). */
  mitarbeiterOhnePlan: 2,
  /** Schätzung, ab der ein Auftrag die Plan-Freigabe braucht (Cent, Vorgabe — je Haushalt später einstellbar). */
  planSchwelleCent: 100,
  /** Bericht in den Head-Thread (R11: ≤ 1.500 Token ≈ 6.000 Zeichen) — der ganze Text steht im Mitarbeiter-Thread. */
  berichtZeichen: 6_000,
  /** Lauf: höchstens 5 Minuten (Fragerunde Teil 1 Nr. 11). */
  laufMs: 5 * 60_000,
  /** Abbruch nach so vielen Runden ohne Fortschritt (Nr. 10). */
  stillstandRunden: 2,
  /** Advisor („Rat holen“) je Lauf. */
  ratJeLauf: 2,
} as const;

/** Fristen (Entscheidung 09.10.: Threads 12 Monate nach der letzten Nachricht) — Felder mit Vorgabe. */
export const FRISTEN = { fadenMonate: 12, gedaechtnisMonate: 12 } as const;

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };
export const fehler = (status: Fehler['status'], text: string): Fehler => ({ ok: false, status, fehler: text });

// ── Stand (Fingerabdruck, ohne Server-Module) ───────────────────────────────────────────────────────────────────────────

function stabil(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}
function abdruck(s: string): string {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 0x5bd1e995); b ^= b >>> 13;
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}
/** Stand eines Threads — ändert irgendwer irgendetwas, ändert er sich (409 statt still überschreiben). */
export const fadenStand = (f: FadenKern): string => abdruck(stabil(f));
/** Fingerabdruck eines Textes (Hilfe-Fragen, gleiche Werkzeugaufrufe). */
export const textAbdruck = (t: string): string => abdruck(t.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim());

// ── Prüfen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Text, den eine Person oder ein Agent schreibt: nicht leer, nicht länger als die Grenze (413, nie kürzen). */
export function textPruefen(roh: unknown, max: number = GRENZEN.nachrichtZeichen, was = 'Nachricht'): { ok: true; text: string } | Fehler {
  if (typeof roh !== 'string') return fehler(400, `${was} fehlt.`);
  const text = roh.replace(/\u0000/g, '').trim();
  if (!text) return fehler(400, `${was} ist leer.`);
  if (text.length > max) return fehler(413, `${was} ist länger als ${max.toLocaleString('de-DE')} Zeichen — nichts gespeichert.`);
  return { ok: true, text };
}

/** Kurzer Titel aus einem Text (Anzeige; der volle Text steht in der Nachricht). */
export function titelAus(text: string): string {
  const eine = text.replace(/\s+/g, ' ').trim();
  return eine.length > KERN_GRENZEN.titel ? `${eine.slice(0, KERN_GRENZEN.titel - 1)}…` : eine || 'Neuer Thread';
}

const ID = /^fd-[a-z0-9-]{8,60}$/;
export const istFadenId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

// ── Anlegen und Anhängen ────────────────────────────────────────────────────────────────────────────────────────────────

export function neuerFaden(o: { id: string; besitzer: string; agent: AgentRef; bereich: Bereich; titel: string; jetzt: string; elternId?: string; fremdGelesen?: boolean; vertraulich?: boolean; kette?: string[]; brettId?: string; helfer?: FadenKern['helfer']; hintergrund?: boolean; skillId?: string; planId?: string }): FadenKern {
  return {
    id: o.id, besitzer: o.besitzer, agent: o.agent, bereich: o.bereich, titel: titelAus(o.titel), status: 'offen',
    fremdGelesen: !!o.fremdGelesen, vertraulich: !!o.vertraulich, nachrichten: [], erstellt: o.jetzt, aktualisiert: o.jetzt,
    ...(o.elternId ? { elternId: o.elternId } : {}),
    ...(o.kette?.length ? { kette: o.kette } : {}),
    ...(o.brettId ? { brettId: o.brettId } : {}),
    ...(o.helfer ? { helfer: o.helfer } : {}),
    ...(o.hintergrund ? { hintergrund: true } : {}),
    ...(o.skillId ? { skillId: o.skillId } : {}),
    ...(o.planId ? { planId: o.planId } : {}),
  };
}

/** Thread in den Bestand — über `GRENZEN.faedenJePerson` → 413. */
export function fadenHinzu(b: FadenBestandKern, f: FadenKern): { ok: true; bestand: FadenBestandKern } | Fehler {
  if (b.faeden.some(x => x.id === f.id)) return fehler(409, 'Diesen Thread gibt es schon.');
  if (b.faeden.length >= GRENZEN.faedenJePerson) return fehler(413, `Höchstens ${GRENZEN.faedenJePerson.toLocaleString('de-DE')} Threads je Person — bitte alte löschen. Nichts angelegt.`);
  return { ok: true, bestand: { ...b, faeden: [...b.faeden, f] } };
}

/** Nachrichten anhängen — Thread voll (400) → 413 „Fortsetzung anlegen“, nie gekürzt. Rechnet die Kurzfassung neu. */
export function anhaengen(f: FadenKern, neu: NachrichtKern[], jetzt: string): { ok: true; faden: FadenKern } | Fehler {
  for (const n of neu) if (n.text.length > GRENZEN.nachrichtZeichen) return fehler(413, `Nachricht länger als ${GRENZEN.nachrichtZeichen.toLocaleString('de-DE')} Zeichen — nichts gespeichert.`);
  if (f.nachrichten.length + neu.length > GRENZEN.fadenNachrichten) return fehler(413, `Thread voll (${GRENZEN.fadenNachrichten} Nachrichten) — bitte eine Fortsetzung anlegen. Nichts gespeichert.`);
  const nachrichten = [...f.nachrichten, ...neu];
  const kf = kurzfassung(nachrichten);
  const { kurzfassung: _alt, ...rest } = f;
  return { ok: true, faden: { ...rest, nachrichten, aktualisiert: jetzt, ...(kf ? { kurzfassung: kf } : {}) } };
}

/** Länger als ein Zug je dauern darf (Schleife: höchstens 5 Minuten) — danach gilt eine unbeantwortete Nachricht als liegen geblieben. */
export const ZUG_SPERRE_MS = 6 * 60_000;
export const ZUG_LAEUFT = 'Die Antwort auf deine letzte Nachricht läuft noch — kurz warten, dann noch einmal senden. Nichts gespeichert.';
/**
 * Läuft in diesem Thread gerade ein Zug (Härtetest 09.10.)? Die letzte Nachricht ist eine unbeantwortete der Person, jünger als `ZUG_SPERRE_MS`,
 * und kein Lauf ist seitdem zu Ende gegangen. Ein zweiter Tab bzw. Doppelklick bekommt dann 409, statt dass zwei Züge über denselben Verlauf
 * laufen und sich die Antworten überkreuzen. Rein.
 */
export function zugLaeuft(f: Pick<FadenKern, 'nachrichten' | 'lauf'>, jetztMs: number): boolean {
  const l = f.nachrichten[f.nachrichten.length - 1];
  if (!l || l.rolle !== 'person' || jetztMs - Date.parse(l.zeit) >= ZUG_SPERRE_MS) return false;
  return !(f.lauf?.ende && f.lauf.ende >= l.zeit);
}

/**
 * Ein abgebrochener Zug (Streaming, 09.10.: der Browser hat die Verbindung geschlossen, bevor die Antwort fertig war) — nichts Halbes
 * bleibt stehen: die Nachricht der Person geht wieder heraus, aber NUR, wenn sie noch die letzte des Threads ist (danach kam nichts, z. B.
 * kein Plan-Hinweis). War sie die einzige, verschwindet der eben angelegte Thread ganz. Sonst bleibt alles, wie es ist (`null`).
 */
export function zugZuruecknehmen(b: FadenBestandKern, fadenId: string, nachrichtId: string): FadenBestandKern | null {
  const f = b.faeden.find(x => x.id === fadenId);
  const letzte = f?.nachrichten[f.nachrichten.length - 1];
  if (!f || !letzte || letzte.id !== nachrichtId || letzte.rolle !== 'person') return null;
  const nachrichten = f.nachrichten.slice(0, -1);
  if (!nachrichten.length) return { ...b, faeden: b.faeden.filter(x => x.id !== fadenId && x.elternId !== fadenId) };
  const kf = kurzfassung(nachrichten);
  const { kurzfassung: _alt, ...rest } = f;
  return { ...b, faeden: b.faeden.map(x => (x.id === fadenId ? { ...rest, nachrichten, ...(kf ? { kurzfassung: kf } : {}) } : x)) };
}

// ── Prompt: die letzten 16 Nachrichten + Kurzfassung ────────────────────────────────────────────────────────────────────

const kuerzen =(t: string, n: number) => { const e = t.replace(/\s+/g, ' ').trim(); return e.length > n ? `${e.slice(0, n - 1)}…` : e; };

/**
 * Die Kurzfassung der Nachrichten VOR den letzten `promptNachrichten` — auf dem Server gerechnet (ohne Modell, deterministisch):
 * je Zug eine Zeile. Wird sie zu lang, fallen die ältesten Zeilen aus der KURZFASSUNG (nicht aus dem Thread) — mit Hinweis.
 */
export function kurzfassung(nachrichten: readonly NachrichtKern[]): string | undefined {
  const alt = nachrichten.slice(0, Math.max(0, nachrichten.length - GRENZEN.promptNachrichten));
  if (!alt.length) return undefined;
  const zeilen = alt.map(n => n.rolle === 'person' ? `• Person: ${kuerzen(n.text, 160)}` : n.rolle === 'agent' ? `• ${n.von}: ${kuerzen(n.text, 220)}` : `• Hinweis: ${kuerzen(n.text, 140)}`);
  const raus: string[] = [];
  let laenge = 0;
  for (let i = zeilen.length - 1; i >= 0; i--) {
    if (laenge + zeilen[i].length + 1 > KERN_GRENZEN.kurzfassungZeichen) break;
    raus.unshift(zeilen[i]); laenge += zeilen[i].length + 1;
  }
  const ausgelassen = zeilen.length - raus.length;
  return `${ausgelassen ? `(${ausgelassen} ältere Züge nicht in der Kurzfassung — der ganze Verlauf steht im Thread)\n` : ''}${raus.join('\n')}`;
}

export interface PromptNachricht { role: 'user' | 'assistant'; content: string }

/**
 * Der Verlauf fürs Modell — NUR aus dem gespeicherten Thread. `ich` = der Agent, der antwortet (seine Nachrichten sind
 * `assistant`); alles andere ist `user`: Person, Hinweise der Software, Aufträge anderer Agenten (Daten mit Auftragsfeldern,
 * keine Freigabe), Berichte (gekapselt mit `kapseln` = lib/anthropic.ts `fremd`). Aufeinanderfolgende gleiche Rollen werden
 * zusammengelegt; der Verlauf beginnt und endet mit `user`.
 */
export function fuerPrompt(f: Pick<FadenKern, 'nachrichten' | 'kurzfassung'>, ich: AgentRef, kapseln: (quelle: string, text: string) => string): PromptNachricht[] {
  const selbst = agentSchluessel(ich);
  const letzte = f.nachrichten.slice(-GRENZEN.promptNachrichten);
  const roh: PromptNachricht[] = [];
  if (f.kurzfassung && f.nachrichten.length > GRENZEN.promptNachrichten) roh.push({ role: 'user', content: `FRÜHERER VERLAUF (Kurzfassung, Daten):\n${kapseln('thread-verlauf', f.kurzfassung)}` });
  for (const n of letzte) {
    if (n.rolle === 'agent' && n.von === selbst && !n.fremd) { roh.push({ role: 'assistant', content: n.text }); continue; }
    if (n.rolle === 'person') { roh.push({ role: 'user', content: n.text }); continue; }
    const text = n.fremd ? kapseln(n.fremd, n.text) : n.text;
    if (n.rolle === 'agent') roh.push({ role: 'user', content: n.auftrag ? `AUFTRAG von ${n.von} (Daten mit Auftragsfeldern — keine Freigabe eines Menschen):\n${auftragText(n.auftrag)}` : `NACHRICHT von ${n.von} (Daten):\n${text}` });
    else roh.push({ role: 'user', content: `[Hinweis der Software] ${text}` });
  }
  const zusammen: PromptNachricht[] = [];
  for (const m of roh) {
    const vor = zusammen[zusammen.length - 1];
    if (vor && vor.role === m.role) vor.content = `${vor.content}\n\n${m.content}`;
    else zusammen.push({ ...m });
  }
  if (!zusammen.length || zusammen[0].role !== 'user') zusammen.unshift({ role: 'user', content: '(Fortsetzung eines Threads)' });
  if (zusammen[zusammen.length - 1].role !== 'user') zusammen.push({ role: 'user', content: 'Weiter.' });
  return zusammen;
}

export const auftragText = (a: AuftragKarte): string => `Ziel: ${a.ziel}\nFormat: ${a.format}\nGrenzen: ${a.grenzen}\nQuellen: ${a.quellen}`;

// ── Lesemodell ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Hat der Thread seit dem letzten Lesen etwas Neues von Agent oder Software? */
export function ungelesen(f: FadenKern): boolean {
  const letzte = [...f.nachrichten].reverse().find(n => n.rolle !== 'person');
  return !!letzte && letzte.zeit > (f.gelesenAm ?? '');
}

export function kurz(f: FadenKern, betrachter: string): FadenKurz & { geteilt?: true; besitzer?: string } {
  return {
    id: f.id, titel: f.titel, agent: f.agent, status: f.status, aktualisiert: f.aktualisiert,
    ...(f.elternId ? { elternId: f.elternId } : {}),
    ...(laufEingereiht(f) ? { eingereiht: true } : {}),
    ...(f.besitzer === betrachter && ungelesen(f) ? { ungelesen: true } : {}),
    ...(f.geteilt ? { geteilt: true as const } : {}),
    ...(f.besitzer !== betrachter ? { besitzer: f.besitzer } : {}),
  };
}

/** Passt der Thread zum Filter `?agent=` (`zoe` · `head:<id>` · `mitarbeiter:<head>:<id>`)? Head-Filter zeigt auch seine Mitarbeiter-Threads. */
export function passtAgent(f: Pick<Faden, 'agent'>, filter: string | null): boolean {
  if (!filter) return true;
  const s = agentSchluessel(f.agent);
  if (filter.startsWith('head:')) return s === filter || (f.agent.art === 'mitarbeiter' && `head:${f.agent.headId}` === filter);
  return s === filter;
}

/** Offene Läufe eines Bestands (wartet/läuft) — die Grenze „≤ 3 offene Mitarbeiter-Läufe je Person“ (C3). */
export function offeneLaeufe(b: Pick<FadenBestandKern, 'faeden'>): number {
  return b.faeden.filter(f => f.agent.art === 'mitarbeiter' && f.lauf && (f.lauf.status === 'wartet' || f.lauf.status === 'laeuft')).length;
}

/** Ein neuer Lauf-Zustand („wartet“ in der Warteschlange). */
export const laufWartet = (jetzt: string, auftragId?: string, kostenGrenzeCent?: number): LaufZustand => ({
  ...(auftragId ? { auftragId } : {}), status: 'wartet', schritte: [], start: jetzt, kostenCent: 0, ...(kostenGrenzeCent ? { kostenGrenzeCent } : {}),
});

/** Ab wann ein „läuft“ als liegen geblieben gilt: Laufzeit (5 Min.) + Pacht-Spielraum — danach läuft dieser Lauf nicht mehr (Härtetest 09.10.). */
export const VERWAIST_NACH_MS = KERN_GRENZEN.laufMs + 3 * 60_000;
export const VERWAIST_TEXT = 'Unterbrochen — der Lauf ist nicht fertig geworden (z. B. Neustart des Servers). Nichts weiter passiert; bitte neu starten.';

/**
 * Ist dieser Lauf verwaist (Härtetest 09.10.: „nie ‚läuft‘ für immer“)? Rein. Grund (Satz für den Thread) oder null:
 *   • „läuft“ seit länger als `VERWAIST_NACH_MS` — der Prozess, der ihn trug, ist weg (Neustart, Absturz);
 *   • „wartet“ auf einen Auftrag der Warteschlange, den der Arbeiter endgültig aufgegeben hat (`fehler` nach 3 Versuchen) bzw. der fehlt,
 *     obwohl er eingereiht war (älter als eine Stunde). Bewusstes Warten (Business-frei, Not-Aus, Plan-Freigabe, Hilfe) zählt nie.
 */
export function verwaistGrund(f: Pick<FadenKern, 'lauf' | 'agent'>, auftraege: readonly { id: string; status: string; fehler?: string }[], jetztMs: number): string | null {
  const l = f.lauf;
  if (!l || f.agent.art === 'zoe') return null;
  if (l.status === 'laeuft') return jetztMs - Date.parse(l.start) > VERWAIST_NACH_MS ? VERWAIST_TEXT : null;
  // Nur ein Lauf, der nie losging (keine Schritte, kein Grund) — ein Lauf, der auf eine Hilfe-Antwort wartet, lief schon und trägt seinen Grund.
  if (l.status !== 'wartet' || !l.auftragId || l.wartetAuf || l.schritte?.length || l.fehler) return null;
  const a = auftraege.find(x => x.id === l.auftragId);
  if (a?.status === 'fehler') return `Der Lauf konnte nicht gestartet werden${a.fehler ? ` (${a.fehler.slice(0, 160)})` : ''} — bitte neu starten.`;
  if (!a && jetztMs - Date.parse(l.start) > 3_600_000) return VERWAIST_TEXT;
  return null;
}

/** FadenStatus aus dem Lauf-Status. */
export function statusAusLauf(l: LaufZustand['status']): FadenStatus {
  return l === 'laeuft' ? 'laeuft' : l === 'fertig' ? 'fertig' : l === 'fehler' ? 'fehler' : l === 'abgebrochen' ? 'abgebrochen' : 'wartet';
}

// ── Löschfrist ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const monateZurueck = (jetzt: string, monate: number): string => {
  const d = new Date(jetzt);
  d.setUTCMonth(d.getUTCMonth() - monate);
  return d.toISOString();
};
/** Letzte Nachricht (sonst `aktualisiert`) älter als die Frist — und kein Lauf offen? */
export function abgelaufen(f: FadenKern, jetzt: string): boolean {
  if (f.lauf && (f.lauf.status === 'wartet' || f.lauf.status === 'laeuft')) return false;
  const letzte = f.nachrichten[f.nachrichten.length - 1]?.zeit ?? f.aktualisiert;
  return letzte < monateZurueck(jetzt, f.loeschfristMonate ?? FRISTEN.fadenMonate);
}
/** Bestand ohne abgelaufene Threads und ohne abgelaufene persönliche Merksätze. */
export function ohneAbgelaufene(b: FadenBestandKern, jetzt: string): FadenBestandKern {
  const grenze = monateZurueck(jetzt, FRISTEN.gedaechtnisMonate);
  const gedaechtnis = b.gedaechtnis ? Object.fromEntries(Object.entries(b.gedaechtnis).map(([k, l]) => [k, (l ?? []).filter(m => m.am >= grenze)]).filter(([, l]) => (l as Merksatz[]).length)) : undefined;
  return { ...b, faeden: b.faeden.filter(f => !abgelaufen(f, jetzt)), ...(gedaechtnis ? { gedaechtnis } : {}) };
}

// ── Gedächtnis „Persönlich“ ─────────────────────────────────────────────────────────────────────────────────────────────

const MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const TELEFON = /(?:\+|00)?\d[\d /-]{6,}\d/;
const URL_RE = /https?:\/\//i;
/**
 * Ein Merksatz, den ein Agent für die Person selbst ablegen will (R12): kurz, keine Adressen, Telefonnummern oder Links —
 * nie Daten Dritter. Namen aus der Kartei prüft der Server zusätzlich (Pseudonymisierer).
 */
export function merksatzPruefen(roh: unknown): { ok: true; text: string } | Fehler {
  const t = textPruefen(roh, GRENZEN.merksatzZeichen, 'Merksatz');
  if (!t.ok) return t;
  if (MAIL.test(t.text) || TELEFON.test(t.text) || URL_RE.test(t.text)) return fehler(400, 'Merksatz nicht abgelegt: keine Adressen, Nummern oder Links Dritter im Gedächtnis.');
  return t;
}

/** Persönliche Merksätze eines Agenten — Mitarbeiter erben die ihres Heads (Entscheidung, Fragerunde Teil 1 Nr. 12). */
export function gedaechtnisFuer(b: Pick<FadenBestandKern, 'gedaechtnis'>, a: AgentRef): Merksatz[] {
  const eigene = b.gedaechtnis?.[agentSchluessel(a)] ?? [];
  if (a.art !== 'mitarbeiter') return [...eigene];
  return [...(b.gedaechtnis?.[`head:${a.headId}`] ?? []), ...eigene];
}

export function merksatzHinzu(b: FadenBestandKern, schluessel: string, m: Merksatz): { ok: true; bestand: FadenBestandKern } | Fehler {
  const liste = b.gedaechtnis?.[schluessel] ?? [];
  if (liste.some(x => textAbdruck(x.text) === textAbdruck(m.text))) return { ok: true, bestand: b };
  if (liste.length >= GRENZEN.merksaetzeJeAgent) return fehler(413, `Höchstens ${GRENZEN.merksaetzeJeAgent} Merksätze je Agent — bitte alte löschen. Nichts abgelegt.`);
  return { ok: true, bestand: { ...b, gedaechtnis: { ...(b.gedaechtnis ?? {}), [schluessel]: [...liste, m] } } };
}

export function merksatzWeg(b: FadenBestandKern, schluessel: string, id: string): { ok: true; bestand: FadenBestandKern } | Fehler {
  const liste = b.gedaechtnis?.[schluessel] ?? [];
  if (!liste.some(m => m.id === id)) return fehler(404, 'Diesen Merksatz gibt es nicht.');
  const rest = liste.filter(m => m.id !== id);
  const g = { ...(b.gedaechtnis ?? {}) };
  if (rest.length) g[schluessel] = rest; else delete g[schluessel];
  return { ok: true, bestand: { ...b, gedaechtnis: g } };
}

// ── Brett ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export function brettVon(head: Pick<FadenKern, 'bretter'> | null | undefined, brettId: string | undefined): Brett | null {
  return brettId ? head?.bretter?.find(b => b.id === brettId) ?? null : null;
}
/** Eintrag ins Brett — über der Grenze 413 (nie kürzen). */
export function brettEintragen(head: FadenKern, brettId: string, e: BrettEintrag): { ok: true; faden: FadenKern } | Fehler {
  const brett = brettVon(head, brettId);
  if (!brett) return fehler(404, 'Diesen Arbeitsstand gibt es nicht.');
  if (brett.eintraege.length >= KERN_GRENZEN.brettEintraege) return fehler(413, `Arbeitsstand voll (${KERN_GRENZEN.brettEintraege} Einträge) — Auftrag abschließen und neu beginnen.`);
  const eintraege = e.art === 'antwort' && e.frageId
    ? [...brett.eintraege.map(x => (x.id === e.frageId ? { ...x, status: 'beantwortet' as const } : x)), e]
    : [...brett.eintraege, e];
  return { ok: true, faden: { ...head, bretter: (head.bretter ?? []).map(b => (b.id === brettId ? { ...b, eintraege } : b)) } };
}
export const offeneFragen = (b: Brett | null): BrettEintrag[] => (b?.eintraege ?? []).filter(e => e.art === 'frage' && e.status === 'offen');

/** Das Brett als Text für einen Prompt (Daten; fremde Einträge gekapselt). */
export function brettText(b: Brett, kapseln: (quelle: string, text: string) => string): string {
  const zeile = (e: BrettEintrag) => `- [${e.art}${e.art === 'frage' ? ` ${e.id} · ${e.status}` : ''}${e.frageId ? ` zu ${e.frageId}` : ''}] ${e.von}: ${e.fremd ? kapseln('brett', e.text) : e.text}`;
  return `ARBEITSSTAND „${b.ziel}“ (Brett ${b.id}, Daten):\n${b.eintraege.map(zeile).join('\n') || '(noch leer)'}`;
}
