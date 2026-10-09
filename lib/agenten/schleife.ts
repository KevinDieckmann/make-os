// ─── EINE Gesprächsschleife für ZOE, Heads und Mitarbeiter (09.10., Paket 4a; AGENTEN_KONZEPT.md C7 „Gesprächsschleife“, C9 Risiko 5) ──
// Bis 09.10. gab es zwei Schleifen: die Werkzeug-Schleife im ZOE-Gespräch (app/api/kimmi) und die der Heads/Mitarbeiter
// (lib/agenten/gespraech.ts `agentLauf`). Sie liefen auseinander (wann gilt „fremd gelesen“, wann wird gekapselt, was zählt ins
// Budget). Jetzt ist es EINE Schleife — die Aufrufer geben nur die Unterschiede als Parameter:
//
//                          ZOE (kimmi)                    Head/Mitarbeiter (Chat · Lauf)
//   Runden                 3                              3 · 6 (GRENZEN.headRunden / mitarbeiterRunden)
//   letzte Runde           mit Werkzeugen                 ohne Werkzeuge (Antwort erzwingen)
//   Ausführung je Runde    parallel (Promise.all)         nacheinander, gleiche Aufrufe nur einmal
//   Wirkung                Register-Stufe (frei/Freigabe) jedes schreibende Werkzeug nur als Vorschlag (Antwort 10)
//   Grenzen                Budget je Art im Handler       14 Aufrufe, 5 Minuten, Kostengrenze, Abbruch, Stillstand nach 2 Runden
//
// Was die Schleife IMMER tut (die gemeinsamen Regeln — sie stehen nur hier):
//   • Modell nur über `askText` mit `ki: { lauf, person, kategorien }` — die Kategorien wachsen mit dem, was Werkzeuge
//     zurückbringen (KI-Tor und KI-Protokoll sehen, was wirklich im Prompt steht).
//   • Text Dritter: liefert ein Werkzeug eine Fremd-Quelle (lib/zoe/fremd.ts), wird sein Ergebnis mit `fremd()` gekapselt (außer
//     es kapselt selbst, `SELBST_GEKAPSELT`), und „fremd gelesen“ gilt ab da fürs GANZE Gespräch; vertrauliche Quellen setzen
//     „vertraulich“ (Web-Agenten danach nur als Vorschlag). Wer den Zustand speichert (Thread), entscheidet der Aufrufer.
//   • Jede Wirkung läuft im Handler über `fuehreAus` (lib/zoe/ausfuehren.ts) — die Schleife selbst wirkt nie.
//   • Protokoll nur Metadaten (Runden, Aufrufe, Token, Cent, Dauer) — nie Inhalte.
//   • Streaming (09.10.): mit `ereignis` läuft jede Runde über `askStream` (dieselbe Schranke wie `askText`) — Text-Stücke und
//     Werkzeug-Stände (nur Namen) gehen an den Aufrufer; Regeln, Grenzen, Kapselung und Ergebnis bleiben genau dieselben. `signal`
//     (Browser weg) beendet den Lauf mit `abgebrochen` (`ABBRUCH_BROWSER`) — der Aufrufer speichert dann keine halbe Antwort.

import { askStream, askText, fremd, kiGesperrt, kiSperrText, type AskResult } from '@/lib/anthropic';
import type { StromEreignis, WerkzeugStand } from '@/lib/http/sse';
import { kosten } from '@/lib/zoe/verbrauch';
import { SELBST_GEKAPSELT } from '@/lib/zoe/fremd';
import { VERTRAULICHE_QUELLEN } from '@/lib/zoe/gespraech-schutz';
import type { KiKategorie, LaufSchritt } from './typen';

export interface Block { type: string; id?: string; name?: string; text?: string; input?: Record<string, unknown> }
export interface Aufruf { id: string; name: string; input: Record<string, unknown> }

/** Der Zustand des Gesprächs, den die Schleife fortschreibt (und der Handler liest). */
export interface SchleifenZustand {
  fremdGelesen: boolean;
  vertraulich: boolean;
  kategorien: Set<KiKategorie>;
  /** Runde (0-basiert). */
  runde: number;
}

/** Was ein Handler für EINEN Werkzeug-Aufruf zurückmeldet. Die Schleife kapselt, zählt und schreibt den Zustand fort. */
export interface AufrufErgebnis {
  /** Der Text für das Modell (noch nicht gekapselt). */
  inhalt: string;
  ok: boolean;
  /** Fremd-Quelle (lib/zoe/fremd.ts) — gesetzt nur, wenn das Ergebnis wirklich Text Dritter tragen kann. */
  quelle?: string | null;
  /** Kategorien, die mit diesem Ergebnis in den nächsten Prompt gehen. */
  kategorien?: readonly KiKategorie[];
  gestapelt?: boolean;
  vorschlagId?: string;
  /** Zählt als Fortschritt (Stillstand-Erkennung) — ohne Angabe: `ok`. */
  fortschritt?: boolean;
  /** Der Lauf endet danach mit „wartet“ (z. B. Hilfe-Frage an den Head). */
  wartet?: string;
  /** In der Liste `aufrufe` erscheinen (Rückschau „ran“) — ohne Angabe ja. */
  zaehlt?: boolean;
  /** Name in der Liste `aufrufe` (z. B. der Agent bei run_agent). */
  name?: string;
}

export interface SchleifenEingabe {
  system: string;
  /** Verlauf fürs Modell — die Schleife hängt Assistent-Züge und Werkzeug-Ergebnisse DIREKT an (der Aufrufer sieht den Stand, z. B. „Rat holen“). */
  messages: unknown[];
  /** Das Feld `user` des Modell-Aufrufs (bei `messages` nur Rückfall). */
  user?: string;
  tools: readonly unknown[];
  runden: number;
  /** Letzte Runde ohne Werkzeuge — erzwingt eine Antwort (Heads/Mitarbeiter). */
  letzteRundeOhneWerkzeuge?: boolean;
  /** Aufrufe einer Runde nebeneinander (ZOE) statt nacheinander (Heads). */
  parallel?: boolean;
  /** Derselbe Aufruf (Name + Eingabe) läuft je Lauf nur einmal (Heads). */
  doppeltErkennen?: boolean;
  /** Höchstens so viele Werkzeug-Aufrufe je Lauf (darüber „Budget erschöpft“, nichts ausgeführt). */
  werkzeugBudget?: number;
  /** Nur weitermachen, wenn mindestens ein Aufruf einer Runde hiervon erfasst ist (ZOE: Register-Werkzeuge und run_agent). */
  weiterBei?: (name: string) => boolean;
  /** Ein Aufruf → Ergebnis. Wirkung NUR über `fuehreAus`. */
  ausfuehren: (a: Aufruf, z: SchleifenZustand) => Promise<AufrufErgebnis>;
  /** Vor einer Runde: Aufrufe, die NICHT laufen (Plan-Freigabe), mit dem Satz fürs Modell. */
  vorRunde?: (aufrufe: readonly Aufruf[], z: SchleifenZustand) => Promise<{ zurueck: ReadonlySet<string>; text?: string }>;
  /** Vor jeder Runde: abgebrochen / Not-Aus? (Satz = Grund). */
  abbrechen?: () => Promise<string | null>;
  /** Absolute Zeitgrenze (ms seit Epoche). */
  deadline?: number;
  kostenGrenzeCent?: number;
  /** Abbruch nach so vielen Runden ohne Fortschritt. */
  stillstand?: number;
  zustand: { fremdGelesen: boolean; vertraulich: boolean; kategorien: Iterable<KiKategorie> };
  ask: {
    model?: string;
    effort?: 'low' | 'medium' | 'high';
    maxTokens: number;
    cacheSystem?: boolean;
    timeoutMs: number;
    zweck: string;
    ki: { lauf: 'gespraech' | 'aufruf' | 'hintergrund'; person: string };
  };
  jetzt?: () => number;
  /**
   * Streaming (09.10., „wie Claude“): Text-Stücke und Werkzeug-Stände an den Aufrufer (Route → Server-Sent Events). Nur Anzeige —
   * gespeichert wird weiter allein das Endergebnis (der Aufrufer schreibt wie ohne Strom). Ohne `ereignis`: das Modell wie bisher am Stück.
   */
  ereignis?: (e: StromEreignis) => void;
  /** Abbruch von außen (Browser weg): keine neue Runde, kein neues Werkzeug, der laufende Modell-Aufruf endet sofort. */
  signal?: AbortSignal;
}

/** Der Grund, wenn der Browser die Verbindung geschlossen hat — der Aufrufer speichert dann nichts (keine halbe Antwort). */
export const ABBRUCH_BROWSER = 'abgebrochen — die Verbindung wurde geschlossen';

export interface SchleifenAusgang {
  status: 'fertig' | 'wartet' | 'fehler' | 'abgebrochen';
  grund?: string;
  /** Alle Texte des Modells, zusammengefügt. */
  text: string;
  /** Text vom Modell (KI-VO Art. 50). */
  ki: boolean;
  /** Das Modell hat abgelehnt bzw. war nicht erreichbar (Rohergebnis des letzten Aufrufs). */
  modellFehler?: AskResult;
  /** Alle Blöcke aller Runden (ZOE liest daraus die Verweise `open_agent`). */
  blocks: Block[];
  aufrufe: { name: string; ok: boolean; gestapelt?: boolean; vorschlagId?: string }[];
  runden: number;
  werkzeugAufrufe: number;
  token: { ein: number; aus: number; cache_lesen: number; cache_schreiben: number };
  cent: number;
  modell: string;
  dauerMs: number;
  schritte: LaufSchritt[];
  zustand: { fremdGelesen: boolean; vertraulich: boolean; kategorien: KiKategorie[] };
}

function stabil(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') { const o = v as Record<string, unknown>; return `{${Object.keys(o).sort().map(k => `${k}:${stabil(o[k])}`).join(',')}}`; }
  return JSON.stringify(v ?? null);
}

/**
 * Name eines Aufrufs für die Anzeige im Strom — nur der Werkzeug-Name, nie die Eingabe; beim Fach-Agenten (`run_agent`) die Kennung des
 * Agenten (wie in der Liste `aufrufe`), wenn sie eine schlichte Kennung ist.
 */
export function zeigeName(u: Pick<Aufruf, 'name' | 'input'>): string {
  const agent = u.input?.agent;
  return u.name === 'run_agent' && typeof agent === 'string' && /^[a-z0-9_-]{1,40}$/i.test(agent) ? agent : u.name.slice(0, 80);
}

/** Das Ergebnis fürs Modell: gekapselt, wenn es Text Dritter trägt (außer der Leser kapselt selbst). */
export function inhaltFuerModell(name: string, e: AufrufErgebnis): string {
  return e.quelle && !SELBST_GEKAPSELT.has(name) ? fremd(e.quelle, e.inhalt) : e.inhalt;
}

/** Den Zustand nach einem Ergebnis fortschreiben (die gemeinsame Regel für „fremd gelesen“ und „vertraulich“). */
export function zustandNach(z: SchleifenZustand, e: AufrufErgebnis): void {
  if (e.quelle) {
    z.fremdGelesen = true;
    if (VERTRAULICHE_QUELLEN.has(e.quelle)) z.vertraulich = true;
  }
  for (const k of e.kategorien ?? []) z.kategorien.add(k);
}

/** Die EINE Werkzeug-Schleife. Schreibt selbst nichts — Thread, Protokoll und Antwort macht der Aufrufer. */
export async function schleife(e: SchleifenEingabe): Promise<SchleifenAusgang> {
  const jetzt = e.jetzt ?? Date.now;
  const start = jetzt();
  const z: SchleifenZustand = { fremdGelesen: e.zustand.fremdGelesen, vertraulich: e.zustand.vertraulich, kategorien: new Set(e.zustand.kategorien), runde: 0 };
  const messages = e.messages;
  const token = { ein: 0, aus: 0, cache_lesen: 0, cache_schreiben: 0 };
  const aufrufe: SchleifenAusgang['aufrufe'] = [];
  const schritte: LaufSchritt[] = [];
  const blocks: Block[] = [];
  const frueher = new Map<string, string>();
  const modell = e.ask.model ?? process.env.ANTHROPIC_MODEL ?? 'standard';
  let cent = 0, runden = 0, werkzeugAufrufe = 0, still = 0;
  let budget = e.werkzeugBudget ?? Number.POSITIVE_INFINITY;
  let text = '', ki = false;
  let status: SchleifenAusgang['status'] = 'fertig';
  let grund: string | undefined;
  let modellFehler: AskResult | undefined;
  // Streaming: hat die Oberfläche schon Text gesehen? Dann beginnt der Text einer neuen Runde mit einer Leerzeile — wie `text` unten.
  let gezeigt = false;
  const browserWeg = () => !!e.signal?.aborted;
  /** Anzeige darf den Lauf nie stören — ein Fehler beim Senden eines Ereignisses wird geschluckt. */
  const melde = (x: StromEreignis) => { try { e.ereignis?.(x); } catch { /* Anzeige */ } };
  const werkzeugStand = (u: Aufruf, stand: WerkzeugStand) => melde({ art: 'werkzeug', name: zeigeName(u), status: stand });

  for (let runde = 0; runde < e.runden; runde++) {
    z.runde = runde;
    if (browserWeg()) { status = 'abgebrochen'; grund = ABBRUCH_BROWSER; break; }
    if (e.abbrechen) { const g = await e.abbrechen(); if (g) { status = 'abgebrochen'; grund = g; break; } }
    const rest = e.deadline !== undefined ? e.deadline - jetzt() : Number.POSITIVE_INFINITY;
    if (rest <= 5_000) { status = runden ? 'fertig' : 'fehler'; grund = 'Zeitgrenze erreicht (5 Minuten)'; break; }
    if (e.kostenGrenzeCent && cent >= e.kostenGrenzeCent) { status = 'abgebrochen'; grund = 'Kostengrenze des Laufs erreicht'; break; }
    const mitWerkzeugen = e.tools.length > 0 && budget > 0 && !(e.letzteRundeOhneWerkzeuge && runde >= e.runden - 1);
    const frage = {
      system: e.system, user: e.user ?? '', messages, ...(e.ask.model ? { model: e.ask.model } : {}), ...(e.ask.effort ? { effort: e.ask.effort } : {}),
      maxTokens: e.ask.maxTokens, ...(e.ask.cacheSystem ? { cacheSystem: true } : {}), tools: mitWerkzeugen ? [...e.tools] : (e.letzteRundeOhneWerkzeuge ? [] : [...e.tools]),
      timeoutMs: Math.min(e.ask.timeoutMs, rest), zweck: e.ask.zweck,
    };
    const kiKontext = { lauf: e.ask.ki.lauf, person: e.ask.ki.person, kategorien: Array.from(z.kategorien) };
    let rundeGezeigt = false;
    const r = e.ereignis
      ? await askStream({ ...frage, ki: kiKontext }, {
        ...(e.signal ? { signal: e.signal } : {}),
        onText: stueck => { const vorweg = gezeigt && !rundeGezeigt ? '\n\n' : ''; rundeGezeigt = gezeigt = true; melde({ art: 'text', text: vorweg + stueck }); },
      })
      : await askText({ ...frage, ki: kiKontext });
    runden++;
    if (r.usage) {
      token.ein += r.usage.ein; token.aus += r.usage.aus; token.cache_lesen += r.usage.cacheLesen; token.cache_schreiben += r.usage.cacheSchreiben;
      cent += kosten(e.ask.model ?? modell, r.usage.ein, r.usage.aus, r.usage.cacheLesen, r.usage.cacheSchreiben);
    }
    if (browserWeg()) { status = 'abgebrochen'; grund = ABBRUCH_BROWSER; break; }
    if (!r.ok) {
      status = 'fehler'; modellFehler = r;
      grund = kiGesperrt(r) ? kiSperrText(r) : r.error === 'guthaben-leer' ? 'KI-Guthaben ist leer' : `Modell nicht erreichbar (${r.status || 'offline'})`;
      break;
    }
    const content: Block[] = Array.isArray((r.raw as { content?: Block[] })?.content) ? (r.raw as { content: Block[] }).content : [];
    blocks.push(...content);
    if (r.text) { text = [text, r.text].filter(Boolean).join('\n\n'); ki = true; }
    const uses: Aufruf[] = content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id ?? '', name: b.name ?? '', input: b.input ?? {} }));
    const weiter = e.weiterBei ? uses.some(u => e.weiterBei!(u.name)) : uses.length > 0;
    if (!weiter || r.stopReason !== 'tool_use' || (e.letzteRundeOhneWerkzeuge && !mitWerkzeugen)) break;
    messages.push({ role: 'assistant', content });

    const plan = e.vorRunde ? await e.vorRunde(uses, z) : { zurueck: new Set<string>() as ReadonlySet<string> };
    const schritt: LaufSchritt = { id: `s${runde + 1}`, titel: `Runde ${runde + 1}: ${uses.map(u => u.name).join(', ')}`, status: 'fertig', start: new Date(jetzt()).toISOString() };
    let fortschritt = false;
    let wartet: string | undefined;

    /** Was VOR der Ausführung feststeht (Plan, Wiederholung, Budget) — sonst null = ausführen. */
    const vorab = (u: Aufruf): { inhalt: string; gestapelt?: boolean } | null => {
      if (plan.zurueck.has(u.id)) return { inhalt: plan.text ?? 'Wartet auf die Plan-Freigabe per Klick.', gestapelt: true };
      if (e.doppeltErkennen) { const s = `${u.name}:${stabil(u.input)}`; if (frueher.has(s)) return { inhalt: `(Gleicher Aufruf wie vorhin — dieselbe Antwort.)\n${frueher.get(s)}` }; }
      if (budget <= 0) return { inhalt: `Nicht ausgeführt: Werkzeug-Budget dieses Laufs erschöpft (${e.werkzeugBudget}).` };
      return null;
    };
    const verbuchen = (u: Aufruf, erg: AufrufErgebnis): string => {
      zustandNach(z, erg);
      if (erg.zaehlt !== false) aufrufe.push({ name: erg.name ?? u.name, ok: erg.ok, ...(erg.gestapelt ? { gestapelt: true } : {}), ...(erg.vorschlagId ? { vorschlagId: erg.vorschlagId } : {}) });
      if (erg.ok && (erg.fortschritt ?? true)) fortschritt = true;
      if (erg.wartet) wartet = erg.wartet;
      const inhalt = inhaltFuerModell(u.name, erg);
      if (e.doppeltErkennen) frueher.set(`${u.name}:${stabil(u.input)}`, inhalt);
      return inhalt;
    };

    /** Ein Aufruf mit Stand für die Anzeige (läuft → fertig/Fehler/Vorschlag) — die Wirkung bleibt allein beim Handler. */
    const ausfuehren = async (u: Aufruf): Promise<AufrufErgebnis> => {
      werkzeugStand(u, 'laeuft');
      const erg = await e.ausfuehren(u, z);
      werkzeugStand(u, erg.gestapelt ? 'vorgeschlagen' : erg.ok ? 'fertig' : 'fehler');
      return erg;
    };

    const ergebnisse: unknown[] = [];
    // Browser weg: kein neues Werkzeug mehr (was schon lief, ist über `fuehreAus` vollständig gewirkt oder gar nicht).
    if (browserWeg()) { status = 'abgebrochen'; grund = ABBRUCH_BROWSER; break; }
    if (e.parallel) {
      // Budget VOR dem Start ziehen (wie bisher im ZOE-Gespräch): alle Aufrufe einer Runde sehen den Zustand vom Rundenbeginn.
      const geplant = uses.map(u => {
        const v = vorab(u);
        if (v) { if (v.gestapelt) werkzeugStand(u, 'vorgeschlagen'); return { u, v }; }
        budget--; werkzeugAufrufe++;
        return { u, p: ausfuehren(u) };
      });
      const fertig = await Promise.all(geplant.map(g => ('p' in g ? g.p! : Promise.resolve(null))));
      geplant.forEach((g, i) => {
        if ('v' in g && g.v) { if (g.v.gestapelt) aufrufe.push({ name: g.u.name, ok: true, gestapelt: true }); ergebnisse.push({ type: 'tool_result', tool_use_id: g.u.id, content: g.v.inhalt }); return; }
        ergebnisse.push({ type: 'tool_result', tool_use_id: g.u.id, content: verbuchen(g.u, fertig[i]!) });
      });
    } else {
      for (const u of uses) {
        if (browserWeg()) { ergebnisse.push({ type: 'tool_result', tool_use_id: u.id, content: 'Nicht ausgeführt: abgebrochen.' }); continue; }
        const v = vorab(u);
        if (v) { if (v.gestapelt) { aufrufe.push({ name: u.name, ok: true, gestapelt: true }); werkzeugStand(u, 'vorgeschlagen'); } ergebnisse.push({ type: 'tool_result', tool_use_id: u.id, content: v.inhalt }); continue; }
        budget--; werkzeugAufrufe++;
        ergebnisse.push({ type: 'tool_result', tool_use_id: u.id, content: verbuchen(u, await ausfuehren(u)) });
      }
    }
    schritt.ende = new Date(jetzt()).toISOString();
    schritte.push(schritt);
    messages.push({ role: 'user', content: ergebnisse });
    if (browserWeg()) { status = 'abgebrochen'; grund = ABBRUCH_BROWSER; break; }
    if (wartet) { status = 'wartet'; grund = wartet; break; }
    still = fortschritt ? 0 : still + 1;
    if (e.stillstand && still >= e.stillstand) { status = 'abgebrochen'; grund = 'festgefahren — zwei Runden ohne Fortschritt'; break; }
  }

  return {
    status, ...(grund ? { grund } : {}), text, ki, ...(modellFehler ? { modellFehler } : {}), blocks, aufrufe, runden, werkzeugAufrufe, token,
    cent: Math.round(cent * 100) / 100, modell, dauerMs: jetzt() - start, schritte,
    zustand: { fremdGelesen: z.fremdGelesen, vertraulich: z.vertraulich, kategorien: Array.from(z.kategorien) },
  };
}
