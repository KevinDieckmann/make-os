// ─── Prozesse — der Agenten-Baustein (Etappe B1, 21.10.; ANALYSE_100.md Punkte 51, 53, 54, 55) ─────────────────────────────────────────────────────
// Entscheidung 21.10.: „wie ein n8n-AI-Agent-Knoten, aber mit unseren Dingen“ — ein Agenten-Schritt wählt ZOE, einen Head (lib/agenten/katalog.ts) oder einen Skill
// und hat drei Andockpunkte:
//   Modell       Stufe schnell · ausgewogen · stark (Haiku · Sonnet · Opus) — aufgerufen wird NUR über das KI-Tor `askText` (lib/anthropic.ts), mit Budget
//                je Schritt (Pflicht). Keine zweite Agentenwelt: der Motor (Etappe C) startet über `reihe(...)`/`runAgent`.
//   Gedächtnis   Brain (Sicht wie immer) und die Akte des Falls (nur über die vorhandenen Lesewege).
//   Werkzeuge    ZOE-Werkzeuge mit ihrer Rechte-Klasse (lib/werkzeuge/einordnung.ts) — Teilmenge dessen, was ZOE, der Head bzw. der Skill hat; nur Business.
// Vertrag je Schritt (Punkt 54): Ein- und Ausgabe-Schema, NUR Kennungen, Zahlen, Tage, ja/nein, Auswahl — nie Freitext zwischen Schritten (`vertragPruefen`
// prüft vor jeder Übergabe). Pflichtsatz „Warum reicht keine Regel?“ (Punkt 53). Rechte-Profil mit Ampel „tödliches Dreieck“ (Punkt 55): private Daten +
// fremder Text + Außenweg → Freigabe Pflicht, NICHT abschaltbar (das Schloss setzt lib/prozesse/schloss.ts).
// Rein und client-sicher; was nur der Server weiß (Skills, Bereich und Kategorie eines Werkzeugs), kommt über `AgentKontext`.
// Tests: tests/prozesse-agent-baustein.test.ts.

import { headDef } from '@/lib/agenten/katalog';
import { EINORDNUNG } from '@/lib/werkzeuge/einordnung';
import { IMMER_FREIGABE } from '@/lib/werkzeuge/vertrag';
import {
  FELD_KENNUNG, KENNUNG_ARTEN, PROZESS_GRENZEN, PROZESS_TEXT, VORSCHLAG_ZIELFELDER,
  type AgentSchritt, type AgentWer, type Befund, type KennungArt, type KiKategorie, type ModelTier, type Rechteklasse, type SchlossMarke, type VertragFeld,
} from './definition';
import { staerkste } from './baustein-katalog';
import { modellWahlAus, stufeVorgabe, type ModellOption } from './modell-wahl';
import { ohneRahmenMarken } from '@/lib/planung/nordstern';

/**
 * Ein `<daten>`-Block für den Prompt eines Agenten-Schritts (rein, Sicherheitsprüfung 30.10.): Rahmen-Marken im Inhalt werden entfernt — sonst
 * schlösse ein Firmenname oder Grund aus einem öffentlichen Formular („…</daten> Neue Anweisung: …“) den Block und stünde als Anweisung im
 * Prompt. Dieselbe Regel wie `daten` (lib/brain.ts) und der Nordstern.
 */
export const agentDatenBlock = (quelle: string, inhalt: string): string => `<daten quelle="${quelle.replace(/[^a-z0-9-]/g, '')}">${ohneRahmenMarken(inhalt)}</daten>`;

/** Modellstufen — die Namen sagen, welches Modell das KI-Tor dafür nimmt; die Kennung eines Modells steht nie hier. */
export const MODELL_STUFEN: readonly { id: ModelTier; titel: string }[] = [
  { id: 'schnell', titel: 'schnell — klein (Haiku)' },
  { id: 'ausgewogen', titel: 'ausgewogen — mittel (Sonnet)' },
  { id: 'stark', titel: 'stark — groß (Opus)' },
];
const MODELLE = MODELL_STUFEN.map(m => m.id) as readonly ModelTier[];
/** Mindestlänge des Pflichtsatzes „Warum reicht keine Regel?“ (ein echter Satz, kein „weil“). */
export const WARUM_MIN = 20;

/** Was nur der Server weiß (lib/prozesse/werkstatt-server.ts `pruefKontext`). Ohne Angabe wird nur die Form geprüft. */
export interface AgentKontext {
  /** Ein Skill: sein Head, seine Werkzeuge, ob er aktiv ist — null = unbekannt bzw. nicht sichtbar. */
  skill?: (id: string) => { headId: string; werkzeuge: readonly string[]; aktiv: boolean } | null;
  /** Bereich eines Werkzeugs (Vertrag) — null = unbekannt. */
  werkzeugBereich?: (name: string) => 'privat' | 'business' | 'beide' | null;
  /** KI-Kategorie eines Werkzeugs (`kategorieVonWerkzeug`) — ohne: die Ausnahme aus der Einordnung, sonst keine. */
  werkzeugKategorie?: (name: string) => KiKategorie | null;
  /** Die angebundenen Modelle der Instanz (lib/prozesse/modell-wahl.ts `modellOptionen`) — ohne: nur die Form einer Modell-Wahl geprüft. */
  modelle?: readonly ModellOption[] | null;
}

type O = Record<string, unknown>;
const istObj = (v: unknown): v is O => !!v && typeof v === 'object' && !Array.isArray(v);
const SKILL = /^sk-[a-z0-9-]{1,60}$/;
/** Eine Kennung im Vertrag (wie die Säuberer der Bestände). */
export const VERTRAG_KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const istTag = (t: string) => TAG.test(t) && new Date(`${t}T12:00:00Z`).toISOString().slice(0, 10) === t;

/**
 * Vorhandene Fach-Agenten des Business, die ein Prozess-Schritt aufrufen darf (lib/zoe/agenten.ts `AUSFUEHRBAR` — Wächter: Teilmenge), mit dem, was sie
 * lesen (KI-Kategorien) und ob sie Text Dritter bringen. Ihre Werkzeuge sind fest (keine Auswahl). Neuer Fach-Agent im Prozess = eine Zeile hier.
 */
export const FACH_AGENTEN: readonly { id: string; titel: string; kategorien: readonly KiKategorie[]; fremd: boolean }[] = [
  { id: 'research', titel: 'Research (Web-Recherche mit Quellen)', kategorien: ['web', 'brain'], fremd: true },
  { id: 'prospect', titel: 'Prospecting (Firmen und Ansprechpartner finden)', kategorien: ['web', 'crm'], fremd: true },
  { id: 'content', titel: 'Content (Beiträge und Texte)', kategorien: ['web', 'brain'], fremd: true },
  { id: 'outreach', titel: 'Outreach (Ansprache vorbereiten)', kategorien: ['crm'], fremd: true },
];
const fachAgent = (id: string) => FACH_AGENTEN.find(f => f.id === id) ?? null;
/** Liest dieser Agenten-Schritt das Web? (Research, Prospecting, Content) — dann gelten Recherche-Frische und „höchstens n Suchen je Lead“ (Motor, M6). */
export const istWebRecherche = (a: Pick<AgentSchritt, 'wer'>): boolean => a.wer.art === 'fach' && !!fachAgent(a.wer.agentId)?.kategorien.includes('web');
/**
 * Gilt „Nur öffentliche Angaben“ (Entscheidung 22.10. nachts)? Nur für Web-Recherche-Fach-Agenten — sonst ist das Feld wirkungslos. Dann gehen an das Modell nur
 * Firmenname, Website/Domain und Branche (der Motor erzwingt es), Akte und Brain sind aus, gelesen wird nur `web` + `allgemein` — kein Dreieck, kein Pflicht-Schloss.
 */
export const oeffentlichModus = (a: Pick<AgentSchritt, 'wer' | 'nurOeffentlich'>): boolean => a.nurOeffentlich === true && istWebRecherche(a);
/** Was ein Agent im Modus „nur öffentliche Angaben“ liest (KI-Kategorien des Aufrufs — ehrlich, wie im KI-Protokoll). */
export const OEFFENTLICH_KATEGORIEN: readonly KiKategorie[] = ['allgemein', 'web'];
/** Das Gedächtnis, das wirklich gilt: im Modus „nur öffentliche Angaben“ sind Akte und Brain aus — ganz gleich, was gespeichert ist. */
export const gedaechtnisWirksam = (a: Pick<AgentSchritt, 'wer' | 'gedaechtnis' | 'nurOeffentlich'>): AgentSchritt['gedaechtnis'] =>
  oeffentlichModus(a) ? { brain: false, akte: false } : a.gedaechtnis;

/** ZOE-Werkzeuge (Register, nicht Agenten-/Steuerungs-Werkzeuge) — die Menge, aus der ein Agenten-Schritt wählen kann. */
export const ZOE_WERKZEUGE: readonly string[] = Object.entries(EINORDNUNG).filter(([, e]) => e.herkunft === 'zoe').map(([n]) => n);

/** Welche Werkzeuge der gewählte Agent hat (rein): ZOE alle Register-Werkzeuge, ein Head seine, ein Skill seine. null = unbekannt. */
export function erlaubteWerkzeuge(wer: AgentWer, k: AgentKontext = {}): readonly string[] | null {
  if (wer.art === 'zoe') return ZOE_WERKZEUGE;
  if (wer.art === 'head') return headDef(wer.headId)?.werkzeuge ?? null;
  if (wer.art === 'fach') return []; // Fach-Agenten bringen ihre Werkzeuge mit — keine Auswahl
  return k.skill?.(wer.skillId)?.werkzeuge ?? null;
}
/** Der Head hinter dem Agenten (ZOE: keiner). */
export const headVonAgent = (wer: AgentWer, k: AgentKontext = {}): string | null =>
  wer.art === 'head' ? wer.headId : wer.art === 'skill' ? k.skill?.(wer.skillId)?.headId ?? null : null;

// ── Vertrag (Punkt 54) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein Vertrags-Schema säubern und prüfen (rein): eindeutige Feld-Kennungen, nur Kennung/Zahl/Tag/ja-nein/Auswahl, Auswahl mit Optionen, Anzahl. */
export function vertragAus(roh: unknown, wo: string, knotenId?: string): { felder: VertragFeld[]; befunde: Befund[] } {
  const befunde: Befund[] = [];
  const b = (stufe: Befund['stufe'], text: string) => befunde.push({ stufe, text: `${wo}: ${text}`, ...(knotenId ? { knotenId } : {}) });
  if (roh === undefined || roh === null) return { felder: [], befunde };
  if (!Array.isArray(roh)) { b('fehler', 'als Liste.'); return { felder: [], befunde }; }
  if (roh.length > PROZESS_GRENZEN.vertragFelder) b('fehler', `höchstens ${PROZESS_GRENZEN.vertragFelder} Felder (jetzt ${roh.length}).`);
  const felder: VertragFeld[] = [];
  const ids = new Set<string>();
  for (const x of roh) {
    if (!istObj(x)) { b('fehler', 'ein Feld ist unlesbar.'); continue; }
    const id = typeof x.id === 'string' ? x.id.trim() : '';
    if (!FELD_KENNUNG.test(id) || ids.has(id)) { b('fehler', `Feld-Kennung „${id}“ ungültig oder doppelt.`); continue; }
    const art = x.art;
    if (art !== 'kennung' && art !== 'zahl' && art !== 'datum' && art !== 'ja-nein' && art !== 'auswahl') { b('fehler', `„${id}“: nur Kennung, Zahl, Tag, ja/nein oder Auswahl — kein Freitext zwischen Schritten.`); continue; }
    ids.add(id);
    const f: VertragFeld = { id, art };
    if (art === 'kennung') {
      if (x.kennung !== undefined && !(KENNUNG_ARTEN as readonly string[]).includes(x.kennung as string)) { b('fehler', `„${id}“: unbekannte Art der Kennung.`); continue; }
      if (x.kennung) f.kennung = x.kennung as KennungArt;
    }
    if (art === 'auswahl') {
      const o = Array.isArray(x.optionen) ? Array.from(new Set(x.optionen.filter((y): y is string => typeof y === 'string' && FELD_KENNUNG.test(y)))) : [];
      if (!o.length || o.length > PROZESS_GRENZEN.optionen) { b('fehler', `„${id}“: Auswahl mit 1 bis ${PROZESS_GRENZEN.optionen} Optionen (Kennungen).`); continue; }
      f.optionen = o;
    }
    if (x.pflicht === true) f.pflicht = true;
    if (x.liste === true) f.liste = true;
    felder.push(f);
  }
  return { felder, befunde };
}

/** Ein Wert eines Vertragsfelds (rein) — gesäubert oder null. */
function einzelwert(f: VertragFeld, v: unknown): string | number | boolean | null {
  switch (f.art) {
    case 'kennung': return typeof v === 'string' && VERTRAG_KENNUNG.test(v) ? v : null;
    case 'zahl': return typeof v === 'number' && Number.isFinite(v) ? v : null;
    case 'datum': return typeof v === 'string' && istTag(v) ? v : null;
    case 'ja-nein': return typeof v === 'boolean' ? v : null;
    case 'auswahl': return typeof v === 'string' && (f.optionen ?? []).includes(v) ? v : null;
  }
}
/** Höchstzahl Einträge einer Liste im Vertrag (darüber abgelehnt, nie gekürzt). */
export const VERTRAG_LISTE_MAX = 200;

/**
 * Werte gegen einen Vertrag prüfen (rein, Punkt 54 — der Motor ruft das vor JEDER Übergabe): nur Felder des Schemas (Unbekanntes wird verworfen und
 * gezählt), Art passend, Pflicht da, Listen begrenzt. Ungültig → `ok: false` mit Sätzen (nur Feld-Kennungen, nie Werte) — der Motor gibt EINE
 * Korrekturrunde, dann die Fehlerkante.
 */
export function vertragPruefen(roh: unknown, schema: readonly VertragFeld[]): { ok: boolean; werte: Record<string, string | number | boolean | (string | number | boolean)[]>; fehler: string[]; verworfen: number } {
  const werte: Record<string, string | number | boolean | (string | number | boolean)[]> = {};
  const fehler: string[] = [];
  const o: O = istObj(roh) ? roh : {};
  if (!istObj(roh)) fehler.push('Die Ausgabe ist kein Objekt.');
  const bekannt = new Set(schema.map(f => f.id));
  const verworfen = Object.keys(o).filter(k => !bekannt.has(k)).length;
  for (const f of schema) {
    const v = o[f.id];
    if (v === undefined || v === null || (Array.isArray(v) && !v.length)) { if (f.pflicht) fehler.push(`„${f.id}“ fehlt.`); continue; }
    if (f.liste) {
      if (!Array.isArray(v)) { fehler.push(`„${f.id}“: Liste erwartet.`); continue; }
      if (v.length > VERTRAG_LISTE_MAX) { fehler.push(`„${f.id}“: höchstens ${VERTRAG_LISTE_MAX} Einträge.`); continue; }
      const l = v.map(x => einzelwert(f, x));
      if (l.some(x => x === null)) { fehler.push(`„${f.id}“: ein Eintrag passt nicht zur Art (${f.art}).`); continue; }
      werte[f.id] = l as (string | number | boolean)[];
      continue;
    }
    const w = einzelwert(f, v);
    if (w === null) { fehler.push(`„${f.id}“ passt nicht zur Art (${f.art}).`); continue; }
    werte[f.id] = w;
  }
  return { ok: !fehler.length, werte, fehler, verworfen };
}

// ── Agenten-Schritt prüfen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Einen Agenten-Schritt säubern und prüfen (rein). `fehler` = unlesbar bzw. gegen eine Regel (Head nicht Business, Werkzeug, das der Agent nicht hat,
 * Privat-Werkzeug, Budget über der Grenze); `offen` = unvollständig (Auftrag, Budget, Pflichtsatz, Skill unbekannt).
 */
export function agentAus(roh: unknown, k: AgentKontext = {}, knotenId?: string): { agent: AgentSchritt | null; befunde: Befund[] } {
  const befunde: Befund[] = [];
  const b = (stufe: Befund['stufe'], text: string, feld?: string, nurWert?: true) => befunde.push({ stufe, text: `Agent: ${text}`, ...(knotenId ? { knotenId } : {}), ...(feld ? { feld } : {}), ...(nurWert ? { nurWert } : {}) });
  if (!istObj(roh)) { b('offen', 'wähle ZOE, einen Head oder einen Skill.'); return { agent: null, befunde }; }
  // Wer
  const w = istObj(roh.wer) ? roh.wer : {};
  let wer: AgentWer | null = null;
  if (w.art === 'zoe') wer = { art: 'zoe' };
  else if (w.art === 'head' && typeof w.headId === 'string') {
    const h = headDef(w.headId);
    if (!h) b('fehler', 'diesen Head gibt es nicht.', 'headId');
    else if (h.bereich !== 'business') b('fehler', `„${h.name}“ gehört zu Privat — Prozesse sind Business.`, 'headId');
    else wer = { art: 'head', headId: h.id };
  } else if (w.art === 'fach' && typeof w.agentId === 'string') {
    if (!fachAgent(w.agentId)) b('fehler', 'diesen Fach-Agenten gibt es im Prozess nicht.', 'agentId');
    else wer = { art: 'fach', agentId: w.agentId };
  } else if (w.art === 'skill' && typeof w.skillId === 'string' && SKILL.test(w.skillId)) {
    const s = k.skill?.(w.skillId);
    if (k.skill && !s) b('offen', 'diesen Skill gibt es nicht (mehr) bzw. er gehört zu keinem Business-Head.', 'skillId');
    else if (s && headDef(s.headId)?.bereich !== 'business') b('fehler', 'der Skill gehört zu einem Privat-Head — Prozesse sind Business.', 'skillId');
    wer = { art: 'skill', skillId: w.skillId };
  } else b('offen', 'wähle ZOE, einen Head oder einen Skill.');
  // Auftrag
  const auftrag = typeof roh.auftrag === 'string' ? roh.auftrag.trim() : '';
  if (!auftrag) b('offen', 'der Auftrag fehlt.', 'auftrag');
  else if (auftrag.length > PROZESS_TEXT.auftrag) b('fehler', `Auftrag höchstens ${PROZESS_TEXT.auftrag.toLocaleString('de-DE')} Zeichen.`, 'auftrag');
  // Modell (Stufe; optional ein bestimmtes angebundenes Modell der Instanz), Budget
  // Vorgabe = die Stufe der Rolle (Head/ZOE ausgewogen, Skill/Fach-Agent wie Mitarbeiter schnell) — ein Modellwechsel der Instanz wirkt dann von selbst.
  let modell: ModelTier = MODELLE.includes(roh.modell as ModelTier) ? roh.modell as ModelTier : stufeVorgabe(wer);
  if (roh.modell !== undefined && roh.modell !== null && !MODELLE.includes(roh.modell as ModelTier)) b('fehler', 'Stufe: schnell, ausgewogen oder stark.', 'modell');
  const mw = modellWahlAus(roh.modellWahl, k.modelle, knotenId);
  befunde.push(...mw.befunde);
  if (mw.wahl) modell = mw.wahl.stufe;
  const bc = roh.budgetCent;
  const budgetCent = typeof bc === 'number' && Number.isInteger(bc) ? bc : 0;
  if (budgetCent <= 0) b('offen', 'Budget je Schritt fehlt (Cent, mindestens 1).', 'budgetCent');
  else if (budgetCent > PROZESS_GRENZEN.budgetCentMax) b('fehler', `Budget höchstens ${PROZESS_GRENZEN.budgetCentMax} Cent je Schritt.`, 'budgetCent', true);
  // Gedächtnis — im Modus „nur öffentliche Angaben“ (nur Web-Recherche-Fach-Agenten) sind Akte und Brain aus.
  const g = istObj(roh.gedaechtnis) ? roh.gedaechtnis : {};
  const oeffentlich = roh.nurOeffentlich === true && !!wer && istWebRecherche({ wer });
  if (roh.nurOeffentlich === true && wer && !oeffentlich) b('hinweis', '„Nur öffentliche Angaben“ gibt es nur für Web-Recherche-Agenten — hier wirkt es nicht.', 'nurOeffentlich');
  const gedaechtnis = oeffentlich ? { brain: false, akte: false } : { brain: g.brain === true, akte: g.akte !== false };
  // Werkzeuge
  const werkzeuge = Array.isArray(roh.werkzeuge) ? Array.from(new Set(roh.werkzeuge.filter((x): x is string => typeof x === 'string'))) : [];
  if (werkzeuge.length > PROZESS_GRENZEN.werkzeugeJeAgent) b('fehler', `höchstens ${PROZESS_GRENZEN.werkzeugeJeAgent} Werkzeuge.`, 'werkzeuge');
  const erlaubt = wer ? erlaubteWerkzeuge(wer, k) : null;
  for (const name of werkzeuge) {
    const e = EINORDNUNG[name];
    if (!e || e.herkunft !== 'zoe') { b('fehler', `das Werkzeug „${name}“ gibt es nicht.`, 'werkzeuge'); continue; }
    // 24.10.: nach einem Wechsel des Agenten nur ein falscher Wert — der Entwurf speichert trotzdem, veröffentlicht wird erst ohne.
    if (erlaubt && !erlaubt.includes(name)) b('fehler', `„${name}“ hat ${wer?.art === 'zoe' ? 'ZOE' : wer?.art === 'head' ? 'dieser Head' : wer?.art === 'fach' ? 'der Fach-Agent nicht zur Auswahl (er bringt seine Werkzeuge mit) —' : 'dieser Skill'} nicht — ein Schritt kann nur Werkzeuge nutzen, die der Agent schon hat.`, 'werkzeuge', true);
    const bereich = k.werkzeugBereich?.(name) ?? e.bereich ?? null;
    if (bereich === 'privat') b('fehler', `„${name}“ gehört zu Privat — Prozesse sind Business.`, 'werkzeuge');
  }
  // Vertrag
  const ein = vertragAus(roh.eingabe, 'Eingabe', knotenId);
  const aus = vertragAus(roh.ausgabe, 'Ausgabe', knotenId);
  befunde.push(...ein.befunde, ...aus.befunde);
  // Pflichtsatz
  const warum = typeof roh.warumKeineRegel === 'string' ? roh.warumKeineRegel.trim() : '';
  if (warum.length < WARUM_MIN) b('offen', `„Warum reicht keine Regel?“ — mindestens ${WARUM_MIN} Zeichen.`, 'warumKeineRegel');
  else if (warum.length > PROZESS_TEXT.warum) b('fehler', `„Warum reicht keine Regel?“ höchstens ${PROZESS_TEXT.warum} Zeichen.`, 'warumKeineRegel');
  if (!wer) return { agent: null, befunde };
  // Ergebnis: Daten (Kennungen) oder Vorschlag in den Stapel — mit fremdem Text aus dem Web IMMER Vorschlag (Regel 6).
  const vf = Array.isArray(roh.vorschlagFelder) ? Array.from(new Set(roh.vorschlagFelder.filter((x): x is string => typeof x === 'string'))) : [];
  const fremdeZiele = vf.filter(x => !(VORSCHLAG_ZIELFELDER as readonly string[]).includes(x));
  if (fremdeZiele.length) b('fehler', `ein Vorschlag darf nur diese Felder füllen: ${VORSCHLAG_ZIELFELDER.join(', ')}.`, 'vorschlagFelder');
  const mussVorschlag = ergebnisMussVorschlag({ wer, werkzeuge, gedaechtnis }, k);
  let ergebnis: 'daten' | 'vorschlag' = roh.ergebnis === 'vorschlag' ? 'vorschlag' : 'daten';
  if (mussVorschlag && ergebnis !== 'vorschlag') { ergebnis = 'vorschlag'; b('hinweis', 'das Ergebnis ist ein Vorschlag — Web-Inhalte sind fremder Text und gehen nur per Klick in die Akte.'); }
  const uebernahme = roh.uebernahme === 'sammel' ? 'sammel' as const : undefined;
  return {
    agent: {
      wer, auftrag, modell, ...(mw.wahl ? { modellWahl: mw.wahl } : {}), budgetCent: Math.max(0, budgetCent), gedaechtnis, werkzeuge, eingabe: ein.felder, ausgabe: aus.felder, warumKeineRegel: warum,
      ...(ergebnis === 'vorschlag' ? { ergebnis, ...(vf.length && !fremdeZiele.length ? { vorschlagFelder: vf } : {}), ...(uebernahme ? { uebernahme } : {}) } : {}),
      ...(oeffentlich ? { nurOeffentlich: true as const } : {}),
    },
    befunde,
  };
}

/** Muss das Ergebnis ein Vorschlag sein? (rein) — sobald der Schritt das Web liest (Research, Prospecting, Content, Head mit Web; auch „nur öffentliche Angaben“). */
export function ergebnisMussVorschlag(a: Pick<AgentSchritt, 'wer' | 'werkzeuge' | 'gedaechtnis' | 'nurOeffentlich'>, k: AgentKontext = {}): boolean {
  return rechteProfil(a, {}, k).lesebereiche.includes('web');
}

// ── Rechte-Profil mit Ampel „tödliches Dreieck“ (Punkt 55) ────────────────────────────────────────────────────────────────────────────────────────

/** KI-Kategorien, die KEINE privaten bzw. personenbezogenen Daten sind — alles andere zählt als „private Daten“ (Kartei, Postfach, Kalender, Finanzen …). */
const NICHT_PRIVAT: ReadonlySet<KiKategorie> = new Set(['allgemein', 'web', 'medien']);
/** Kategorien, die Text Dritter tragen (zusätzlich zu Werkzeugen mit Fremd-Quelle): Postfach, Web. */
const FREMD_KATEGORIEN: ReadonlySet<KiKategorie> = new Set(['postfach', 'web']);

export interface RechteProfil {
  /** Lesebereiche (KI-Kategorien) — erben automatisch vom Head bzw. Skill, den Werkzeugen und dem Gedächtnis. */
  lesebereiche: KiKategorie[];
  /** Klassen der Werkzeuge (mit „lesen“). */
  klassen: Rechteklasse[];
  staerkste: Rechteklasse;
  /** Die drei Ecken. */
  privateDaten: boolean; fremderText: boolean; aussenweg: boolean;
  dreieck: boolean;
  /** Freigabe Pflicht (Dreieck oder eine Klasse außen · Geld · Löschen) — nicht abschaltbar. */
  freigabePflicht: boolean;
  ampel: 'gruen' | 'gelb' | 'rot';
  /** Warum (Sätze ohne Inhalte). */
  gruende: string[];
}

/**
 * Das Rechte-Profil eines Agenten-Schritts (rein). `laufFremd` = der Lauf trägt schon fremden Text (Auslöser Webhook, Mail, WhatsApp — „fremd gelesen“
 * gilt für den ganzen Lauf, Punkt 56). Akte und Brain tragen Notizen/Aktivitäten Dritter → zählen als fremder Text (CLAUDE.md Regel 6).
 * „Nur öffentliche Angaben“ (`oeffentlichModus`): der Fach-Agent liest nur `web` + `allgemein` (Firmenname, Website, Branche — der Motor erzwingt es), Akte und
 * Brain sind aus → keine privaten Daten → kein Dreieck. Fremder Text (Web) und der Weg nach außen bleiben: gelb, das Ergebnis bleibt ein Vorschlag.
 */
export function rechteProfil(a: Pick<AgentSchritt, 'wer' | 'werkzeuge' | 'gedaechtnis' | 'nurOeffentlich'>, umfeld: { laufFremd?: boolean } = {}, k: AgentKontext = {}): RechteProfil {
  const kat = new Set<KiKategorie>();
  const headId = headVonAgent(a.wer, k);
  for (const x of (headId ? headDef(headId)?.kategorien : null) ?? []) kat.add(x);
  const klassen = new Set<Rechteklasse>(['lesen']);
  let fremdWerkzeug = false;
  const oeffentlich = oeffentlichModus(a);
  const gedaechtnis = gedaechtnisWirksam(a);
  if (a.wer.art === 'fach') {
    const f = fachAgent(a.wer.agentId);
    for (const x of oeffentlich ? OEFFENTLICH_KATEGORIEN : f?.kategorien ?? []) kat.add(x);
    if (f?.fremd) fremdWerkzeug = true;
  }
  for (const name of a.werkzeuge) {
    const e = EINORDNUNG[name];
    if (!e) continue;
    klassen.add(e.rechte);
    if (e.fremd) fremdWerkzeug = true;
    const c = k.werkzeugKategorie ? k.werkzeugKategorie(name) : ('kategorie' in e ? e.kategorie ?? null : null);
    if (c) kat.add(c);
  }
  if (gedaechtnis.brain) kat.add('brain');
  if (gedaechtnis.akte) kat.add('crm');
  const lesebereiche = Array.from(kat).sort();
  const gruende: string[] = [];
  const privateDaten = lesebereiche.some(x => !NICHT_PRIVAT.has(x));
  if (privateDaten) gruende.push('liest Daten des Haushalts bzw. Dritter');
  else if (oeffentlich) gruende.push('nur öffentliche Angaben (Firmenname, Website, Branche)');
  const fremderText = !!umfeld.laufFremd || fremdWerkzeug || gedaechtnis.akte || gedaechtnis.brain || lesebereiche.some(x => FREMD_KATEGORIEN.has(x));
  if (fremderText) gruende.push('sieht fremden Text (Akte, Notizen, Mails, Webhook)');
  const kl = Array.from(klassen);
  const aussenweg = klassen.has('aussen') || kat.has('web');
  if (aussenweg) gruende.push('hat einen Weg nach außen');
  const dreieck = privateDaten && fremderText && aussenweg;
  const freigabePflicht = dreieck || kl.some(x => IMMER_FREIGABE.has(x));
  const ecken = [privateDaten, fremderText, aussenweg].filter(Boolean).length;
  return {
    lesebereiche, klassen: kl, staerkste: staerkste(kl), privateDaten, fremderText, aussenweg, dreieck, freigabePflicht,
    ampel: dreieck ? 'rot' : ecken >= 2 || freigabePflicht ? 'gelb' : 'gruen', gruende,
  };
}

/** Grund eines Schlosses hinter dem Agenten-Schritt — oder null (kein Schloss nötig). Löschen vor außen vor Geld vor Dreieck. */
export function agentSchlossGrund(p: Pick<RechteProfil, 'klassen' | 'dreieck'>): SchlossMarke['grund'] | null {
  for (const x of ['loeschen', 'aussen', 'geld'] as const) if (p.klassen.includes(x)) return x;
  return p.dreieck ? 'dreieck' : null;
}

/** Der Agenten-Schritt als Satz (Steckbrief, Liste). */
export function agentText(a: AgentSchritt, k: AgentKontext = {}): string {
  const wer = a.wer.art === 'zoe' ? 'ZOE' : a.wer.art === 'head' ? headDef(a.wer.headId)?.name ?? 'Head' : a.wer.art === 'fach' ? fachAgent(a.wer.agentId)?.titel ?? 'Fach-Agent'
    : `Skill${headVonAgent(a.wer, k) ? ` (${headDef(headVonAgent(a.wer, k)!)?.kurz ?? ''})` : ''}`;
  return `${wer} · ${MODELL_STUFEN.find(m => m.id === a.modell)?.titel ?? a.modell} · bis ${a.budgetCent} Cent${oeffentlichModus(a) ? ' · nur öffentliche Angaben' : ''}`;
}
