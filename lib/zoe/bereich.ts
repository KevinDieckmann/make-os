// ─── ZOE: Bereich erkennen — Privat oder Business, je Vorschlag und je Merksatz (09.10. spät, rein, client-sicher) ──────────
// Befund live (09.10.): im Kopf-Schalter „Privat“ stand unter ZOE › Freigaben „Fakt merken — weil du gesagt hast: ‚… gibt es nicht
// mehr‘“ — über eine Firma aus dem Business. Wunsch: „ZOE muss unterscheiden, wo wir schreiben oder wie wir schreiben, und das dann auch dem
// richtigen Stapel zuordnen.“
//
// EINE Regel `bereichFuerVorschlag` — in dieser Reihenfolge, die erste, die etwas sagt, gewinnt:
//   (a) der fachliche Bezug: was der Server zum Bezug aufgelöst hat (Aufgabe → ihr Space, CRM-Kontakt/-Firma/-Deal/-Mandat → IMMER Business
//       (Entscheidung 09.10. spät), Kalender → Space des Kalenders, Vorschlag eines Heads → Bereich des Heads), sonst die Gruppe des Werkzeugs (Gesundheit,
//       Haushalt, Familie → Privat; Markttraktion, Kontakte, Kunden, Business, Bauplan → Business), sonst die ausdrückliche Angabe in der
//       Eingabe (`space`/`bereich`, `spaceId`/`einheit`/`firma` über den Bereich der Einheit);
//   (b) der Inhalt nennt einen bekannten Namen aus dem BESTAND (CRM-Firma, CRM-Kontakt mit vollem Namen, eigene Gesellschaft) — nie feste
//       Namen im Code; widersprechen sich die Treffer, entscheidet (c);
//   (c) der Bereich, in dem das Gespräch stattfand (der Browser schickt ihn mit, der Server prüft nur die Form);
//   (d) sonst „unklar“ — der Vorschlag steht in BEIDEN Sichten (Privat und Business) oben mit „Bereich wählen“ (Entscheidung 09.10. spät: der
//       Kopf-Schalter kennt nur noch Privat · Business).
// Gespeichert wird am Vorschlag nur `bereich: 'privat' | 'business'` (+ Quelle, ggf. Ort und genannte CRM-Kennungen); FEHLT das Feld, ist er
// „unklar“ — so liest sich auch der Altbestand. Merksätze (lib/zoe/gedaechtnis.ts) tragen denselben Bereich; ohne Bereich sind sie neutral.
// Die Sammellogik (Bestand lesen) steht in ./bereich-server.ts; hier wird nur gerechnet. Tests: tests/zoe-bereich.test.ts.

import { suchNorm } from '@/lib/text/such-norm';
import { bereichVon, finanzOrtAus, istGesellschaft, finanzOrtName } from '@/lib/einheiten';

export type Bereich = 'privat' | 'business';
/** Was die Oberfläche zeigt: ohne gespeicherten Bereich ist ein Vorschlag „unklar“. */
export type BereichSicht = Bereich | 'unklar';
/** Woher der Bereich kommt: Bezug (a) · Inhalt (b) · Gespräch (c) · von Hand gesetzt. */
export type BereichQuelle = 'bezug' | 'inhalt' | 'gespraech' | 'hand';
/** Gesellschaft bzw. Mandanten-Space, wenn eindeutig — Kennung + Anzeigename (nur zur Anzeige). */
export interface BereichOrt { id: string; name: string }
/** Eine Kennung aus der Markttraktion, die der Inhalt nennt (für den Weg „in der Markttraktion festhalten“). */
export interface BereichNennt { art: 'firma' | 'kontakt'; id: string }

/** Ein bekannter Name aus dem Bestand (nie aus dem Code) — mit dem Bereich, in den er gehört. */
export interface BekannterName {
  art: 'firma' | 'kontakt' | 'gesellschaft';
  id: string;
  /** Normalisierter Schlüssel (`namensSchluessel`) — leer = zu unsicher, wird nie verglichen. */
  schluessel: string;
  bereich: Bereich;
  ort?: BereichOrt;
}

export interface BereichKontext {
  /** Bereich des fachlichen Bezugs, vom Server aufgelöst (Aufgabe, Kalender, CRM-Eintrag, Head). */
  bezug?: { bereich: Bereich; ort?: BereichOrt; nennt?: BereichNennt[] } | null;
  /** Bereich des Heads, der den Vorschlag gemacht hat (Anlass „<Head>: …“) — zählt wie ein Bezug, nach der ausdrücklichen Angabe. */
  head?: Bereich | null;
  /** Bekannte Namen aus dem Bestand (CRM-Firmen, -Kontakte, eigene Gesellschaften). */
  namen?: readonly BekannterName[];
  /** Bereich des Gesprächs (geprüft) — null = unbekannt (kein Space, z. B. Telegram). */
  gespraech?: Bereich | null;
}

export interface BereichErgebnis {
  bereich: BereichSicht;
  quelle?: BereichQuelle;
  ort?: BereichOrt;
  nennt?: BereichNennt[];
}

/** Gruppen, deren Vorschläge immer im Business-Bereich liegen (Markttraktion, Kontakte, Kunden, Business-Zahlen, Bauplan). */
export const BUSINESS_GRUPPEN: ReadonlySet<string> = new Set(['markttraktion', 'kontakte', 'kunden', 'crm', 'business', 'bauplan']);
/** Gruppen, deren Vorschläge immer im Privat-Bereich liegen (Gesundheit, Haushaltsfinanzen, Familie). */
export const PRIVAT_GRUPPEN: ReadonlySet<string> = new Set(['gesundheit', 'haushalt', 'familie']);

export const BEREICH_NAME: Record<BereichSicht, string> = { privat: 'Privat', business: 'Business', unklar: 'Bereich unklar' };

/** Form-Prüfung einer Angabe von außen (Browser, Gespräch): nur `privat`/`business`, sonst null. */
export const bereichAus = (v: unknown): Bereich | null => (v === 'privat' || v === 'business' ? v : null);

/** Der Bereich, den ein Vorschlag zeigt — ohne gespeichertes Feld „unklar“ (Altbestand). */
export const bereichVonVorschlag = (v: { bereich?: unknown }): BereichSicht => bereichAus(v.bereich) ?? 'unklar';

/**
 * Gehört der Vorschlag in diese Sicht? `space` = Bereich der Sicht (null = ohne Sicht, z. B. ein älterer Aufruf: alles). Unter Privat nie ein
 * Business-Vorschlag und umgekehrt; „unklar“ steht in BEIDEN Sichten (oben, mit „Bereich wählen“), bis jemand den Bereich wählt.
 */
export const passtZurSicht = (v: { bereich?: unknown }, space: Bereich | null): boolean => {
  if (!space) return true;
  const b = bereichVonVorschlag(v);
  return b === space || b === 'unklar';
};
/** Nur Vorschläge GENAU dieses Bereichs (ohne „unklar“) — für die Sammelfreigabe: ein unklarer Vorschlag braucht erst seinen Bereich. */
export const genauImBereich = (v: { bereich?: unknown }, space: Bereich | null): boolean => !space || bereichVonVorschlag(v) === space;

/**
 * Wirkung des Bereichs auf die Eingabe bei der Freigabe (rein, 09.10. spät — „wo wir schreiben“): eine Aufgabe ohne eigenen Ort (create_task
 * ohne spaceId/einheit/meilenstein/unter) landet im Bereich des Vorschlags — auch wenn er von Hand gewählt wurde. Alle anderen Werkzeuge bleiben
 * unverändert (fakt_merken bekommt den Bereich als Kontext). Angewandt NUR in `fuehreAus` bei der Freigabe.
 */
export function eingabeMitBereich(werkzeug: string, eingabe: Record<string, unknown>, bereich: Bereich | null | undefined): Record<string, unknown> {
  if (!bereich || werkzeug !== 'create_task') return eingabe;
  if (['spaceId', 'einheit', 'meilenstein', 'unter'].some(k => typeof eingabe[k] === 'string' && (eingabe[k] as string).trim())) return eingabe;
  return eingabe.space === bereich ? eingabe : { ...eingabe, space: bereich };
}

/**
 * Was eine Lage für eine Sicht weglässt (rein, 09.10. spät — Empfang `/zoe` je Sicht): Privat ohne Markttraktion (CRM); Business ohne Familie,
 * Körperdaten und Haushaltsfinanzen. Weggelassenes steht gar nicht erst im Prompt (die Schalter von `promptBrain`). Ohne Sicht nichts weglassen.
 */
export function lageFuerSicht(space: Bereich | null): { aus: ('crm' | 'familie')[]; koerper: boolean; haushalt: boolean } {
  if (space === 'privat') return { aus: ['crm'], koerper: true, haushalt: true };
  if (space === 'business') return { aus: ['familie'], koerper: false, haushalt: false };
  return { aus: [], koerper: true, haushalt: true };
}

/** Merksatz ↔ Bereich des Gesprächs: ohne Bereich (Gespräch ohne Space) alle; sonst die eigenen und die neutralen (ohne Bereich). */
export const faktPasstZuBereich = (f: { bereich?: unknown }, bereich: Bereich | null | undefined): boolean => {
  if (!bereich) return true;
  const b = bereichAus(f.bereich);
  return !b || b === bereich;
};

// ── (a) ausdrückliche Angabe in der Eingabe ────────────────────────────────────────────────────────────────────────

const MANDANT = /^m-[a-z0-9-]{1,80}$/i;

/**
 * Der Bereich aus einer ausdrücklichen Angabe der Eingabe (`space`/`bereich` privat|business, `spaceId`/`einheit`/`firma` über den Bereich
 * der Einheit; Mandanten-Space `m-…` → Business). Ohne Angabe null. Dieselbe Lesart wie `vorschlagPrivat` (lib/zoe/stapel.ts).
 */
export function eingabeBereich(eingabe: Record<string, unknown> | undefined): { bereich: Bereich; ort?: BereichOrt } | null {
  const e = eingabe ?? {};
  const wert = (k: string) => (typeof e[k] === 'string' ? (e[k] as string).trim() : '');
  for (const k of ['space', 'bereich']) {
    const b = bereichAus(wert(k));
    if (b) return { bereich: b };
  }
  for (const k of ['spaceId', 'einheit', 'firma']) {
    const id = wert(k);
    if (!id) continue;
    if (MANDANT.test(id)) return { bereich: 'business', ort: { id, name: 'Mandant' } };
    const ort = finanzOrtAus(id);
    if (ort === 'privat') return { bereich: 'privat' };
    if (ort && istGesellschaft(ort)) return { bereich: bereichVon(ort), ort: { id: ort, name: finanzOrtName(ort) } };
  }
  return null;
}

// ── (b) bekannte Namen im Inhalt ────────────────────────────────────────────────────────────────────────────────────

/** Rechtsformen und Füllwörter, die in einem Firmennamen nicht zählen (wie lib/make-one/crm.ts `normFirma`). */
const RECHTSFORMEN = new Set(['gmbh', 'ag', 'ug', 'kg', 'ohg', 'gbr', 'se', 'kgaa', 'mbh', 'inc', 'ltd', 'llc', 'corp', 'plc', 'sa', 'sarl', 'bv', 'nv', 'partg', 'mbb', 'eg', 'ev', 'ek', 'haftungsbeschraenkt', 'co', 'cokg', 'gmbhcokg', 'und', 'and', 'the']);
const TITEL = new Set(['dr', 'prof', 'dipl', 'ing', 'mba', 'llm', 'phd', 'med', 'jur', 'herr', 'frau']);
/** Kürzer trägt ein Name nicht — zu viele zufällige Treffer. */
const MIN_ZEICHEN = 4;

const woerter = (t: string) => suchNorm(t).replace(/\be\.\s?(k|v)\.?/g, ' ').replace(/\b([a-z])\./g, '$1').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

/**
 * Normalisierter Schlüssel eines Namens (Wortfolge, durch Leerzeichen getrennt). Firmen/Gesellschaften ohne Rechtsform, Kontakte ohne Titel
 * und nur mit mindestens zwei Wörtern (Vor- und Nachname — ein Vorname allein trifft zu oft). Zu kurz → '' (wird nie verglichen).
 */
export function namensSchluessel(name: string, art: BekannterName['art']): string {
  const w = woerter(name).filter(x => !(art === 'kontakt' ? TITEL : RECHTSFORMEN).has(x));
  if (art === 'kontakt' && w.length < 2) return '';
  const s = w.join(' ');
  return s.replace(/ /g, '').length >= MIN_ZEICHEN ? s : '';
}

/** Der Text eines Vorschlags in Suchform, mit Leerzeichen an den Rändern (für Wortgrenzen). */
export function textSchluessel(texte: readonly (string | null | undefined)[]): string {
  return ` ${woerter(texte.filter(Boolean).join(' \n ')).join(' ')} `;
}

/** Welche bekannten Namen stehen als ganze Wörter im Text? (auch mit Genitiv-s: „…s“). Höchstens `max` Treffer, ohne Doppelte. */
export function genannteNamen(text: string, namen: readonly BekannterName[], max = 8): BekannterName[] {
  const raus: BekannterName[] = [];
  const gesehen = new Set<string>();
  for (const n of namen) {
    if (!n.schluessel || gesehen.has(`${n.art}:${n.id}`)) continue;
    if (text.includes(` ${n.schluessel} `) || text.includes(` ${n.schluessel}s `)) {
      gesehen.add(`${n.art}:${n.id}`);
      raus.push(n);
      if (raus.length >= max) break;
    }
  }
  return raus;
}

/** Alle Texte eines Vorschlags, in denen ein Name stehen kann: Titel, Vorher/Nachher, Anlass und die Text-Werte der Eingabe (ohne `_`-Felder). */
export function vorschlagTexte(v: { titel?: string; vorher?: string; nachher?: string; anlass?: string; eingabe?: Record<string, unknown> }): string[] {
  const aus: string[] = [v.titel ?? '', v.vorher ?? '', v.nachher ?? '', v.anlass ?? ''];
  for (const [k, w] of Object.entries(v.eingabe ?? {})) {
    if (k.startsWith('_')) continue;
    if (typeof w === 'string') aus.push(w);
    else if (Array.isArray(w)) for (const x of w) if (typeof x === 'string') aus.push(x);
  }
  return aus.map(t => t.slice(0, 4000));
}

// ── Die Regel ───────────────────────────────────────────────────────────────────────────────────────────────────────

const nenntVon = (treffer: readonly BekannterName[]): BereichNennt[] | undefined => {
  const l = treffer.filter((t): t is BekannterName & { art: 'firma' | 'kontakt' } => t.art === 'firma' || t.art === 'kontakt').slice(0, 3).map(t => ({ art: t.art, id: t.id }));
  return l.length ? l : undefined;
};

/**
 * DIE Regel (siehe Kopf): Bereich eines Vorschlags aus Bezug, Gruppe, ausdrücklicher Angabe, Inhalt und Gespräch. Rein, getestet.
 * `nennt` (CRM-Kennungen, die der Inhalt nennt) kommt immer mit, auch wenn (a) entschieden hat — damit „Fakt merken“ über eine Firma der
 * Markttraktion den Weg dorthin anbieten kann.
 */
export function bereichFuerVorschlag(
  v: { werkzeug?: string; gruppe: string; titel?: string; vorher?: string; nachher?: string; anlass?: string; eingabe?: Record<string, unknown>; bezug?: { art: string } },
  k: BereichKontext = {},
): BereichErgebnis {
  const treffer = k.namen?.length ? genannteNamen(textSchluessel(vorschlagTexte(v)), k.namen) : [];
  const nennt = nenntVon(treffer);
  const mit = (e: BereichErgebnis): BereichErgebnis => ({ ...e, ...(e.nennt ?? nennt ? { nennt: e.nennt ?? nennt } : {}) });
  // (a) fachlicher Bezug — zuerst der aufgelöste, dann die Gruppe, dann die ausdrückliche Angabe, dann der Head.
  if (k.bezug) return mit({ bereich: k.bezug.bereich, quelle: 'bezug', ...(k.bezug.ort ? { ort: k.bezug.ort } : {}), ...(k.bezug.nennt?.length ? { nennt: k.bezug.nennt } : {}) });
  if (v.bezug?.art === 'crm' || BUSINESS_GRUPPEN.has(v.gruppe)) return mit({ bereich: 'business', quelle: 'bezug' });
  if (PRIVAT_GRUPPEN.has(v.gruppe)) return mit({ bereich: 'privat', quelle: 'bezug' });
  const angabe = eingabeBereich(v.eingabe);
  if (angabe) return mit({ bereich: angabe.bereich, quelle: 'bezug', ...(angabe.ort ? { ort: angabe.ort } : {}) });
  if (k.head) return mit({ bereich: k.head, quelle: 'bezug' });
  // (b) der Inhalt nennt bekannte Namen — nur, wenn sie sich einig sind.
  const bereiche = new Set(treffer.map(t => t.bereich));
  if (bereiche.size === 1) {
    const orte = new Set(treffer.map(t => t.ort?.id ?? ''));
    const ort = orte.size === 1 ? treffer[0].ort : undefined;
    return mit({ bereich: treffer[0].bereich, quelle: 'inhalt', ...(ort ? { ort } : {}) });
  }
  // (c) das Gespräch — (d) sonst unklar.
  if (k.gespraech) return mit({ bereich: k.gespraech, quelle: 'gespraech' });
  return mit({ bereich: 'unklar' });
}

/** Ein Satz für die Oberfläche: woher der Bereich kommt (ohne Namen — die stehen im Vorschlag selbst). */
export function bereichGrund(v: { bereich?: unknown; bereichQuelle?: BereichQuelle; bereichOrt?: BereichOrt; bereichNennt?: readonly BereichNennt[] }): string {
  const b = bereichVonVorschlag(v);
  if (b === 'unklar') return 'ZOE konnte nicht sicher erkennen, ob das Privat oder Business ist — bitte wählen.';
  const wo = v.bereichOrt ? ` · ${v.bereichOrt.name}` : '';
  switch (v.bereichQuelle) {
    case 'bezug': return `${BEREICH_NAME[b]}${wo} — aus dem Bezug des Vorschlags.`;
    case 'inhalt': return `${BEREICH_NAME[b]}${wo} — der Inhalt nennt ${v.bereichNennt?.some(n => n.art === 'kontakt') && !v.bereichNennt?.some(n => n.art === 'firma') ? 'eine Person' : 'eine Firma'} aus dem Bestand.`;
    case 'gespraech': return `${BEREICH_NAME[b]}${wo} — aus dem Gespräch im Bereich ${BEREICH_NAME[b]}.`;
    case 'hand': return `${BEREICH_NAME[b]}${wo} — von Hand gesetzt.`;
    default: return `${BEREICH_NAME[b]}${wo}.`;
  }
}
