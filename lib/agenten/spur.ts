// ─── Lauf-Spur: Regeln (10.10., Paket V1 „Messen & sparen“, AGENTEN_KONZEPT_V2.md C9; Entscheidung 10.10.: „eigene Lauf-Spur im Server, nur
// Metadaten, Hash-Kette wie die anderen Protokolle“) — rein, Server UND Browser (keine Node-Module; die Oberfläche liest die Typen). ──
//
// EINE Kette (`kette`) je Anstoß: ein ZOE-Zug, ein Chat mit einem Head, ein Lauf aus der Warteschlange. Jeder Abschnitt darin (ZOE-Zug,
// Head-/Mitarbeiter-Lauf, ein einzelner Modellaufruf über einen internen Sprung) ist EIN Eintrag (`lauf` = seine Kennung, `eltern` = der
// Abschnitt, aus dem er kam). Angelehnt an OpenTelemetry GenAI (trace_id → `kette`, span_id → `lauf`, parent_span_id → `eltern`,
// gen_ai.operation.name → `art`). Ein Eintrag trägt NUR Metadaten — wann, wie lange, welches Modell, Token (auch Cache), geschätzte Kosten,
// Zahl der Werkzeug- und Modellaufrufe, Ergebnis-Klasse, Person (Speichername) und Bereich. NIE Inhalte, Prompts, Antworten, Titel,
// Werkzeug-Eingaben oder Namen (`spurSaeubern` lässt nur Kennwörter und Zahlen durch — Wächter tests/agenten-spur.test.ts).
//
// Ablage (Trennung Privat/Business, 09.10. spät): je Bereich EIN Bestand je Berliner Monat — `lauf-spur--privat--JJJJ-MM` und
// `lauf-spur--business--JJJJ-MM`, nur anhängend über `anhaengenVerkettet` (Familie `lauf-spur` in MONATS_FAMILIEN, Hash-Kette + Siegel),
// Aufbewahrung 12 Monate (die nächtliche Durchsicht leert ältere Monate, Vermerk `bereinigt` bleibt). Ohne erkennbaren Bereich gilt
// „im Zweifel privat“ (C11); ein Konto „nur Business“ läuft immer im Business.
// Gelesen wird NUR über GET /api/agenten/kosten (lib/agenten/spur-server.ts): jede Person ihre eigenen Läufe, ein Inhaber zusätzlich die
// Summen der Instanz OHNE fremde Einzelheiten; ein Konto ohne Privat-Bereich bekommt den Privat-Bestand gar nicht erst geladen.

import { inEuroCent } from '@/lib/ki/kosten';

export const SPUR_PRAEFIX = 'lauf-spur';
export const SPUR_AUFBEWAHRUNG_MONATE = 12;
/** Kopf interner Sprünge (nur Dienstweg — `kiAus`, Lauf-Routen): `<kette>;<eltern>;<bereich>`. */
export const SPUR_KOPF = 'x-make-spur';

export type SpurBereich = 'privat' | 'business';
export const SPUR_BEREICHE: readonly SpurBereich[] = ['privat', 'business'];
/** zug = ein ZOE-Zug · chat = Head/Mitarbeiter im Gespräch · invoke_agent = Lauf im Hintergrund · modell = ein Modellaufruf über einen Sprung. */
export type SpurArt = 'zug' | 'chat' | 'invoke_agent' | 'modell';
export const SPUR_ARTEN: readonly SpurArt[] = ['zug', 'chat', 'invoke_agent', 'modell'];
/** Klasse des Ausgangs — nie der Grund als Text. `gesperrt` = Schalter, Budget, Not-Aus, Datenschutz (zählt nicht als Fehler). */
export type SpurErgebnis = 'ok' | 'gestapelt' | 'wartet' | 'abgebrochen' | 'gesperrt' | 'fehler';
export const SPUR_ERGEBNISSE: readonly SpurErgebnis[] = ['ok', 'gestapelt', 'wartet', 'abgebrochen', 'gesperrt', 'fehler'];

export interface SpurToken { ein: number; aus: number; cacheLesen: number; cacheSchreiben: number }

export interface SpurEintrag {
  /** Ende des Abschnitts (ISO). */
  zeit: string;
  /** Kennung dieses Abschnitts (`lauf-<uuid>`) — dieselbe wie `LaufSpan.lauf_id` an der Nachricht im Thread. */
  lauf: string;
  /** Kennung der Kette (der erste Abschnitt). */
  kette: string;
  /** Der Abschnitt, aus dem dieser kam. */
  eltern?: string;
  art: SpurArt;
  /** `zoe` · `head:<id>` · `mitarbeiter:<head>:<id>` · bei `modell` der Zweck (Kennwort). */
  agent: string;
  /** Speichername der auslösenden Person — null = Systemlauf. */
  person: string | null;
  bereich: SpurBereich;
  start: string;
  dauerMs: number;
  /** Zeit bis zum ersten Wort (nur im Strom gemessen). */
  ttftMs?: number;
  modell?: string;
  /** Zahl der Modellaufrufe in diesem Abschnitt (ohne die der Kind-Abschnitte). */
  aufrufe: number;
  token: SpurToken;
  /** Geschätzte Kosten in US-Cent (wie `ki-verbrauch`, zwei Nachkommastellen). */
  cent: number;
  /** Zahl der Werkzeugaufrufe. */
  werkzeuge: number;
  ergebnis: SpurErgebnis;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LAUF_ID = new RegExp(`^lauf-${UUID}$`);
const PERSON = /^[a-z0-9-]{1,40}$/;
/** Agent bzw. Zweck: nur Kennwörter (Kleinbuchstaben, Ziffern, : _ . -) — so kann kein Text Dritter hineingeraten. */
const KENNWORT = /^[a-z0-9][a-z0-9:_.-]{0,99}$/;
const MODELL = /^[a-z0-9][a-z0-9:_.@/-]{0,79}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export const istLaufId = (v: unknown): v is string => typeof v === 'string' && LAUF_ID.test(v);
export const istSpurBereich = (v: unknown): v is SpurBereich => v === 'privat' || v === 'business';

/** Berliner Monat (JJJJ-MM) eines Zeitpunkts — derselbe Schnitt wie Änderungs- und Lese-Protokoll. */
export function spurMonat(d: Date = new Date()): string {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).formatToParts(d);
  return `${t.find(x => x.type === 'year')!.value}-${t.find(x => x.type === 'month')!.value}`;
}

/** Bestandsname je Bereich und Berliner Monat — zwei Namens-Funktionen, damit das Speicher-Register jeden Bereich für sich kennt. */
export const spurPrivatBestand = (monat: string): string => `lauf-spur--privat--${monat}`;
export const spurBusinessBestand = (monat: string): string => `lauf-spur--business--${monat}`;
export function spurBestand(bereich: SpurBereich, monat: string): string {
  if (!/^\d{4}-\d{2}$/.test(monat)) throw new Error(`[lauf-spur] Monat ungültig: ${monat}`);
  return bereich === 'business' ? spurBusinessBestand(monat) : spurPrivatBestand(monat);
}
/** Gehört ein Dateiname (ohne `.json`) zur Lauf-Spur? Liefert Bereich und Monat. */
export function spurBestandTeile(name: string): { bereich: SpurBereich; monat: string } | null {
  const m = /^lauf-spur--(privat|business)--(\d{4}-\d{2})$/.exec(name);
  return m ? { bereich: m[1] as SpurBereich, monat: m[2] } : null;
}

/** Bereich eines Abschnitts: der angegebene, sonst „im Zweifel privat“ — ein Konto „nur Business“ immer Business (C11). */
export function spurBereichAus(v: unknown, o: { nurBusiness?: boolean } = {}): SpurBereich {
  if (o.nurBusiness) return 'business';
  return istSpurBereich(v) ? v : 'privat';
}

// ── Kopf für interne Sprünge ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SpurBezug { kette: string; eltern: string; bereich: SpurBereich }
export const spurKopfWert = (b: SpurBezug): string => `${b.kette};${b.eltern};${b.bereich}`;
/** Den Kopf lesen (rein) — alles, was nicht genau die Form hat, gilt als „kein Bezug“. */
export function spurKopfLesen(v: unknown): SpurBezug | null {
  if (typeof v !== 'string' || v.length > 120) return null;
  const [kette, eltern, bereich, ...rest] = v.split(';');
  if (rest.length || !istLaufId(kette) || !istLaufId(eltern) || !istSpurBereich(bereich)) return null;
  return { kette, eltern, bereich };
}

// ── Säubern ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

const zahl = (v: unknown, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : 0);
const cent = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v * 100) / 100, 1e7) : 0);

/**
 * Einen Eintrag säubern (rein): nur bekannte Felder, Kennungen nach Form, Kennwörter statt Text, Zahlen begrenzt. Was nicht passt, fällt weg
 * bzw. wird zum neutralen Wert — so kann auch ein Aufrufer, der versehentlich Text übergibt, nichts Inhaltliches hineinschreiben. null =
 * kein gültiger Eintrag (Kennung fehlt).
 */
export function spurSaeubern(roh: Partial<SpurEintrag> | Record<string, unknown>): SpurEintrag | null {
  const e = roh as Partial<SpurEintrag> & Record<string, unknown>;
  if (!istLaufId(e.lauf) || !istLaufId(e.kette)) return null;
  const t = (e.token ?? {}) as Partial<SpurToken>;
  const ttft = zahl(e.ttftMs, 3_600_000);
  return {
    zeit: typeof e.zeit === 'string' && ISO.test(e.zeit) ? e.zeit : new Date().toISOString(),
    lauf: e.lauf,
    kette: e.kette,
    ...(istLaufId(e.eltern) && e.eltern !== e.lauf ? { eltern: e.eltern } : {}),
    art: SPUR_ARTEN.includes(e.art as SpurArt) ? e.art as SpurArt : 'modell',
    agent: typeof e.agent === 'string' && KENNWORT.test(e.agent) ? e.agent : 'unbenannt',
    person: typeof e.person === 'string' && PERSON.test(e.person) ? e.person : null,
    bereich: spurBereichAus(e.bereich),
    start: typeof e.start === 'string' && ISO.test(e.start) ? e.start : (typeof e.zeit === 'string' && ISO.test(e.zeit) ? e.zeit : new Date().toISOString()),
    dauerMs: zahl(e.dauerMs, 24 * 3_600_000),
    ...(e.ttftMs !== undefined && ttft > 0 ? { ttftMs: ttft } : {}),
    ...(typeof e.modell === 'string' && MODELL.test(e.modell) ? { modell: e.modell } : {}),
    aufrufe: zahl(e.aufrufe, 10_000),
    token: { ein: zahl(t.ein), aus: zahl(t.aus), cacheLesen: zahl(t.cacheLesen), cacheSchreiben: zahl(t.cacheSchreiben) },
    cent: cent(e.cent),
    werkzeuge: zahl(e.werkzeuge, 10_000),
    ergebnis: SPUR_ERGEBNISSE.includes(e.ergebnis as SpurErgebnis) ? e.ergebnis as SpurErgebnis : 'fehler',
  };
}

// ── Rechnen (nie gespeichert) ────────────────────────────────────────────────────────────────────────────────────────────

/** Anteil der Eingabe, die aus dem Prompt-Cache kam: Cache lesen ÷ (Eingabe + Cache lesen + Cache schreiben). null ohne Eingabe. */
export function cacheQuote(t: SpurToken): number | null {
  const gesamt = t.ein + t.cacheLesen + t.cacheSchreiben;
  return gesamt > 0 ? Math.round((t.cacheLesen / gesamt) * 1000) / 1000 : null;
}

/** Perzentil (Nächster-Rang, rein) — null ohne Werte. */
export function perzentil(werte: readonly number[], p: number): number | null {
  const l = werte.filter(x => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!l.length) return null;
  const i = Math.min(l.length - 1, Math.max(0, Math.ceil((p / 100) * l.length) - 1));
  return l[i];
}

const tokenSumme = (l: readonly SpurEintrag[]): SpurToken => l.reduce((a, e) => ({
  ein: a.ein + e.token.ein, aus: a.aus + e.token.aus, cacheLesen: a.cacheLesen + e.token.cacheLesen, cacheSchreiben: a.cacheSchreiben + e.token.cacheSchreiben,
}), { ein: 0, aus: 0, cacheLesen: 0, cacheSchreiben: 0 });

export interface SpurSumme {
  ketten: number;
  laeufe: number;
  /** US-Cent (gemessen) und Euro-Cent (Kurs der Instanz). */
  cent: number;
  euroCent: number;
  token: SpurToken;
  cacheQuote: number | null;
  werkzeuge: number;
  aufrufe: number;
  fehler: number;
  /** Fehler ÷ Läufe ohne Sperren (KPI „Fehlerquote Läufe“, Teil F). */
  fehlerQuote: number | null;
}

/** Summen über Einträge (rein). */
export function summeVon(l: readonly SpurEintrag[], kurs: number): SpurSumme {
  const token = tokenSumme(l);
  const c = Math.round(l.reduce((a, e) => a + e.cent, 0) * 100) / 100;
  const ohneSperre = l.filter(e => e.ergebnis !== 'gesperrt').length;
  const fehler = l.filter(e => e.ergebnis === 'fehler').length;
  return {
    ketten: new Set(l.map(e => e.kette)).size, laeufe: l.length, cent: c, euroCent: Math.round(inEuroCent(c, kurs) * 100) / 100,
    token, cacheQuote: cacheQuote(token), werkzeuge: l.reduce((a, e) => a + e.werkzeuge, 0), aufrufe: l.reduce((a, e) => a + e.aufrufe, 0),
    fehler, fehlerQuote: ohneSperre ? Math.round((fehler / ohneSperre) * 1000) / 1000 : null,
  };
}

/** Tempo von ZOE (KPI „Zeit bis zum ersten Zeichen“): p50/p95 über die Züge mit gemessenem erstem Wort, dazu die Dauer der Züge. */
export interface ZoeTempo { zuege: number; ttftP50: number | null; ttftP95: number | null; dauerP50: number | null; dauerP95: number | null; cacheQuote: number | null }
export function zoeTempo(l: readonly SpurEintrag[]): ZoeTempo {
  const z = l.filter(e => e.art === 'zug');
  const ttft = z.map(e => e.ttftMs).filter((x): x is number => typeof x === 'number');
  const dauer = z.map(e => e.dauerMs);
  return { zuege: z.length, ttftP50: perzentil(ttft, 50), ttftP95: perzentil(ttft, 95), dauerP50: perzentil(dauer, 50), dauerP95: perzentil(dauer, 95), cacheQuote: cacheQuote(tokenSumme(z)) };
}

const RANG: Readonly<Record<SpurErgebnis, number>> = { ok: 0, gestapelt: 1, wartet: 2, gesperrt: 3, abgebrochen: 4, fehler: 5 };

/** Eine Kette für die Anzeige: wann, wer (Agenten-Schlüssel der Abschnitte), Dauer, Kosten, Werkzeuge — nie Inhalte. */
export interface KetteZeile {
  kette: string;
  start: string;
  ende: string;
  /** Agenten der Kette in Reihenfolge (ohne `modell`-Abschnitte, ohne Doppel). */
  agenten: string[];
  bereich: SpurBereich | 'beide';
  dauerMs: number;
  ttftMs?: number;
  cent: number;
  euroCent: number;
  werkzeuge: number;
  aufrufe: number;
  laeufe: number;
  cacheQuote: number | null;
  /** Der schlechteste Ausgang der Kette. */
  ergebnis: SpurErgebnis;
}

/** Abschnitte zu Ketten zusammenfassen (rein), jüngste zuerst, höchstens `max`. Dauer = vom ersten Start bis zum letzten Ende. */
export function kettenAus(l: readonly SpurEintrag[], kurs: number, max = 30): KetteZeile[] {
  const je = new Map<string, SpurEintrag[]>();
  for (const e of l) { const x = je.get(e.kette); if (x) x.push(e); else je.set(e.kette, [e]); }
  const raus: KetteZeile[] = [];
  for (const [kette, teile] of je) {
    const sortiert = teile.slice().sort((a, b) => a.start.localeCompare(b.start));
    const start = sortiert[0].start;
    const ende = teile.map(e => e.zeit).sort().at(-1)!;
    const wurzel = teile.find(e => e.lauf === kette);
    const c = Math.round(teile.reduce((a, e) => a + e.cent, 0) * 100) / 100;
    const bereiche = new Set(teile.map(e => e.bereich));
    raus.push({
      kette, start, ende,
      agenten: Array.from(new Set(sortiert.filter(e => e.art !== 'modell').map(e => e.agent))),
      bereich: bereiche.size > 1 ? 'beide' : teile[0].bereich,
      dauerMs: Math.max(0, Date.parse(ende) - Date.parse(start)),
      ...(wurzel?.ttftMs !== undefined ? { ttftMs: wurzel.ttftMs } : {}),
      cent: c, euroCent: Math.round(inEuroCent(c, kurs) * 100) / 100,
      werkzeuge: teile.reduce((a, e) => a + e.werkzeuge, 0), aufrufe: teile.reduce((a, e) => a + e.aufrufe, 0), laeufe: teile.length,
      cacheQuote: cacheQuote(tokenSumme(teile)),
      ergebnis: teile.reduce<SpurErgebnis>((a, e) => (RANG[e.ergebnis] > RANG[a] ? e.ergebnis : a), 'ok'),
    });
  }
  return raus.sort((a, b) => b.start.localeCompare(a.start)).slice(0, max);
}

// ── Sicht (die EINE Filterstelle der Route) ─────────────────────────────────────────────────────────────────────────────

export interface KostenAntwort {
  ok: true;
  /** Welche Bereiche diese Antwort enthält (serverseitig entschieden — Konto und `?space=`). */
  bereiche: SpurBereich[];
  kurs: number;
  eigene: { ketten: KetteZeile[]; tage7: SpurSumme; tage30: SpurSumme; zoe: ZoeTempo };
  /** Nur für einen Inhaber: Summen der Instanz je Bereich — ohne Personen, Agenten, Kennungen (keine fremden Einzelheiten). */
  instanz?: { tage7: Partial<Record<SpurBereich, SpurSumme>>; tage30: Partial<Record<SpurBereich, SpurSumme>>; zoe30: ZoeTempo };
}

const seit = (jetzt: Date, tage: number) => new Date(jetzt.getTime() - tage * 86_400_000).toISOString();

/**
 * Die Antwort für EIN Konto (rein — die Route lädt nur die Bestände der erlaubten Bereiche und ruft das hier). `eigene` = nur Abschnitte, die
 * diese Person ausgelöst hat (auch die Kind-Abschnitte ihrer Ketten tragen ihren Speichernamen). Ein Inhaber bekommt zusätzlich die Summen
 * der Instanz — nur Zahlen je Bereich, nie Personen, Agenten oder Kennungen anderer.
 */
export function kostenSicht(alle: readonly SpurEintrag[], o: { person: string; bereiche: readonly SpurBereich[]; inhaber: boolean; jetzt: Date; kurs: number }): KostenAntwort {
  const erlaubt = alle.filter(e => o.bereiche.includes(e.bereich));
  const eigene = erlaubt.filter(e => e.person === o.person);
  const ab7 = seit(o.jetzt, 7), ab30 = seit(o.jetzt, 30);
  const eigene30 = eigene.filter(e => e.zeit >= ab30);
  const antwort: KostenAntwort = {
    ok: true, bereiche: [...o.bereiche], kurs: o.kurs,
    eigene: { ketten: kettenAus(eigene30, o.kurs), tage7: summeVon(eigene.filter(e => e.zeit >= ab7), o.kurs), tage30: summeVon(eigene30, o.kurs), zoe: zoeTempo(eigene30) },
  };
  if (!o.inhaber) return antwort;
  const je = (ab: string) => Object.fromEntries(o.bereiche.map(b => [b, summeVon(erlaubt.filter(e => e.bereich === b && e.zeit >= ab), o.kurs)])) as Partial<Record<SpurBereich, SpurSumme>>;
  return { ...antwort, instanz: { tage7: je(ab7), tage30: je(ab30), zoe30: zoeTempo(erlaubt.filter(e => e.zeit >= ab30)) } };
}
