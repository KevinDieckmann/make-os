// ─── Werkzeug-Verträge: Form und Regeln (10.10., Paket V3 „Werkzeug-Verträge“, AGENTEN_KONZEPT_V2.md A4 S2/S3, C3, C10, T1–T3) — rein ──
// Server UND Browser (keine Node-Module, nur Typ-Importe). Bis V3 erkannten drei Stellen den Erfolg eines Werkzeugs am Antworttext (Regex in
// lib/zoe/ausfuehren.ts, app/api/kimmi `FEHLER_TEXT`, lib/agenten/gespraech.ts `OK_TEXT`) — ein neues Werkzeug mit anderem Fehlersatz („Kein Zugang“,
// „Nicht eingetragen“, „Abgelehnt: …“) galt als Erfolg und landete im Stapel als „freigegeben“. Jetzt:
//
//   • Jedes Werkzeug hat einen VERTRAG (lib/werkzeuge/register.ts): Eingabe-Schema (zur Laufzeit geprüft, lib/werkzeuge/schema.ts), Rechteklasse,
//     Bereich, KI-Kategorie, Fremd-Quelle — die Einordnung steht EINMAL in lib/werkzeuge/einordnung.ts, Schema und Stufe kommen aus den Quellen,
//     die es schon gab (lib/zoe/werkzeug-defs.ts, lib/zoe/register.ts).
//   • Ein Werkzeug meldet sein Ergebnis AUSDRÜCKLICH: `erfolg(…)` oder `fehlschlag(klasse, …)` — nie mehr ein Satz, aus dem jemand den Ausgang
//     rät. Ein Werkzeug, das noch einen bloßen Text zurückgibt, gilt als Erfolg; nur der Rückfall `ausAltText` (die EINE verbliebene Textregel)
//     fängt einen vergessenen Fehlersatz noch ab — und zählt ihn in der Lauf-Spur (`rueckfall`, Ziel 0; Wächter tests/werkzeug-vertraege.test.ts).
//   • Die Rechteklasse entscheidet mit der Stufe und den Marken des Laufs über die Wirkung (`wirkungsEntscheid` — „Rule of Two“ an EINER Stelle):
//     Außenwirkung, Geld und Löschen gehen IMMER über den Freigabe-Stapel; nach fremdem Text wirkt nichts Schreibendes ohne Klick.
//   • Der Bereich eines Werkzeugs passt zur Sicht oder es wird abgelehnt (`bereichPasst`): ein Business-Werkzeug läuft nie in der Sicht Privat
//     und umgekehrt — serverseitig, nicht nur ausgeblendet (CLAUDE.md, Plattform-Regel).

import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';

/**
 * Was ein Werkzeug darf (C3, Entscheidung V3): lesen · vorschlag (legt NUR in den Stapel, übernommen wird per Klick) · intern (schreibt eigene
 * Bestände: Aufgabe, Notiz, Kalender-Block, Kartei, Thread) · aussen (verlässt das Haus: senden, veröffentlichen — heute bewusst kein Werkzeug) ·
 * geld (Finanzbestände: Kontostand, Rechnung, Zahlung, Planposten, Ziele, Honorare, Haushaltsbuchungen) · loeschen (heute bewusst kein Werkzeug).
 */
export type Rechteklasse = 'lesen' | 'vorschlag' | 'intern' | 'aussen' | 'geld' | 'loeschen';
export const RECHTEKLASSEN: readonly Rechteklasse[] = ['lesen', 'vorschlag', 'intern', 'aussen', 'geld', 'loeschen'];
export const RECHTEKLASSE_TEXT: Readonly<Record<Rechteklasse, string>> = {
  lesen: 'liest nur', vorschlag: 'legt nur einen Vorschlag in den Stapel', intern: 'schreibt eigene Bestände', aussen: 'wirkt nach außen',
  geld: 'ändert Finanzbestände', loeschen: 'löscht',
};
/** Diese Klassen wirken NIE ohne Klick eines Menschen im Freigabe-Stapel — egal, was Register, Skill, Head oder Autonomie sagen (C10, F5). */
export const IMMER_FREIGABE: ReadonlySet<Rechteklasse> = new Set(['aussen', 'geld', 'loeschen']);
/** Diese Klassen schreiben nichts selbst — sie laufen auch nach fremdem Text (Rule of Two: keine Wirkung). */
export const OHNE_WIRKUNG: ReadonlySet<Rechteklasse> = new Set(['lesen', 'vorschlag']);

/** Wo ein Werkzeug hingehört: nur Privat, nur Business oder beide (dann entscheidet die Eingabe bzw. der Bereich des Laufs). */
export type WerkzeugBereich = 'privat' | 'business' | 'beide';
export type Sicht = 'privat' | 'business';

/** Ausgang eines Aufrufs (V3): erfolg · abgelehnt (eine Regel sagt nein — Rechte, Sperre) · fehler · braucht_freigabe (liegt im Stapel). */
export type ErgebnisArt = 'erfolg' | 'abgelehnt' | 'fehler' | 'braucht_freigabe';
export const ERGEBNIS_ARTEN: readonly ErgebnisArt[] = ['erfolg', 'abgelehnt', 'fehler', 'braucht_freigabe'];
/** Fehlerklassen (T2): nur `voruebergehend`, `intern` und `konflikt` lohnen eine Wiederholung (`wiederholbar`). */
export type Fehlerklasse = 'eingabe' | 'rechte' | 'sperre' | 'nicht_gefunden' | 'konflikt' | 'grenze' | 'voruebergehend' | 'intern';
export const FEHLERKLASSEN: readonly Fehlerklasse[] = ['eingabe', 'rechte', 'sperre', 'nicht_gefunden', 'konflikt', 'grenze', 'voruebergehend', 'intern'];
/** Rechte und Sperren (Datenschutz, Einwilligung, Business-frei) sind eine Entscheidung → „abgelehnt“; alles andere ist ein Fehler. */
export const ART_JE_KLASSE: Readonly<Record<Fehlerklasse, ErgebnisArt>> = {
  eingabe: 'fehler', rechte: 'abgelehnt', sperre: 'abgelehnt', nicht_gefunden: 'fehler', konflikt: 'fehler', grenze: 'fehler', voruebergehend: 'fehler', intern: 'fehler',
};
export const wiederholbar = (k: Fehlerklasse | undefined): boolean => k === 'voruebergehend' || k === 'intern' || k === 'konflikt';

/** Das typisierte Ergebnis eines Werkzeugs — die Hülle (`fuehreAus`) ergänzt Spur und Herkunft. */
export interface WerkzeugErgebnis<D = unknown> {
  /** Marke der Form — unterscheidet das Ergebnis von einem bloßen Text, auch nach JSON. */
  werkzeugErgebnis: 1;
  ok: boolean;
  art: ErgebnisArt;
  /** Nur bei `fehler`/`abgelehnt`. */
  klasse?: Fehlerklasse;
  /** Der Satz für das Modell bzw. die Person (unverändert der bisherige Text). */
  meldung: string;
  daten?: D;
  /** Kennung des Vorschlags (nur `braucht_freigabe`). */
  vorschlagId?: string;
  /** Lauf-Spur des Abschnitts, in dem das Werkzeug lief (nur Kennungen, V1) — gesetzt von der Hülle. */
  spur?: { kette: string; lauf: string };
  /** `alttext` = der Ausgang kam aus dem Rückfall `ausAltText` (Zähler in der Spur, Ziel 0). */
  herkunft?: 'typisiert' | 'alttext';
}
/** Was ein Werkzeug zurückgeben darf: ein typisiertes Ergebnis oder (Erfolg) einen bloßen Text. */
export type WerkzeugRueckgabe = string | WerkzeugErgebnis;

export const istWerkzeugErgebnis = (x: unknown): x is WerkzeugErgebnis =>
  !!x && typeof x === 'object' && (x as { werkzeugErgebnis?: unknown }).werkzeugErgebnis === 1 && typeof (x as { meldung?: unknown }).meldung === 'string';

/** Erfolg mit Satz (und optional Daten). */
export function erfolg<D = unknown>(meldung: string, daten?: D): WerkzeugErgebnis<D> {
  return { werkzeugErgebnis: 1, ok: true, art: 'erfolg', meldung, ...(daten !== undefined ? { daten } : {}) };
}
/** Fehlschlag mit Klasse — der Satz bleibt genau der, den das Werkzeug bisher sagte (für das Modell ändert sich nichts). */
export function fehlschlag(klasse: Fehlerklasse, meldung: string): WerkzeugErgebnis<never> {
  return { werkzeugErgebnis: 1, ok: false, art: ART_JE_KLASSE[klasse], klasse, meldung };
}
/** Vorschlag liegt im Stapel. */
export function brauchtFreigabe(meldung: string, vorschlagId?: string): WerkzeugErgebnis<never> {
  return { werkzeugErgebnis: 1, ok: true, art: 'braucht_freigabe', meldung, ...(vorschlagId ? { vorschlagId } : {}) };
}

/** Der Satz eines Ergebnisses — für Aufrufer, die nur den Text brauchen (Tests, Altwege). */
export const meldungVon = (r: WerkzeugRueckgabe): string => (typeof r === 'string' ? r : r.meldung);

/**
 * HTTP-Status einer internen Route → Fehlerklasse (lib/zoe/innen.ts): 400 Eingabe · 401/403 Rechte · 404 nicht gefunden · 409 Konflikt ·
 * 413 Grenze · 423/429/5xx vorübergehend.
 */
export function klasseAusStatus(status: number): Fehlerklasse {
  if (status === 400 || status === 415 || status === 422) return 'eingabe';
  if (status === 401 || status === 403) return 'rechte';
  if (status === 404 || status === 410) return 'nicht_gefunden';
  if (status === 409) return 'konflikt';
  if (status === 413) return 'grenze';
  if (status === 423 || status === 429 || status >= 500 || status === 0) return 'voruebergehend';
  return 'intern';
}

/**
 * DER Rückfall für bloße Texte (die EINE verbliebene Textregel — vorher drei auseinanderlaufende Regex in ausfuehren.ts, kimmi und gespraech.ts):
 * Satzanfang bzw. die ersten 200 Zeichen tragen einen der bekannten Fehlersätze. Nur für Werkzeuge, die noch keinen typisierten Ausgang melden —
 * jeder Treffer zählt in der Lauf-Spur als `rueckfall` (Ziel 0). Ein neues Werkzeug meldet IMMER `fehlschlag(…)`, nie einen Satz, den man hier
 * nachtragen müsste.
 */
const ALT_ANFANG = /^(Fehlgeschlagen|Nicht ausgeführt|Nicht angeboten|Unbekannt|Nicht erfasst|Nicht notiert|Nicht eingereiht|Nicht eingeplant|Nicht eingetragen|Abgelehnt|Kein Zugang|Kollision|Kein Meilenstein|Nicht beantwortet)/i;
const ALT_IRGENDWO = /fehlgeschlagen|nicht erreichbar|nicht lesbar|nicht angelegt|nicht eingeplant|Kollision|Kein Meilenstein|Nicht ausgeführt|nicht erfasst|nicht notiert|nicht eingereiht|nicht vermerkt|Nicht beantwortet/i;
export function ausAltText(text: string): { ok: boolean; klasse?: Fehlerklasse } {
  const t = String(text ?? '');
  if (ALT_ANFANG.test(t.trim()) || ALT_IRGENDWO.test(t.slice(0, 200))) return { ok: false, klasse: /Abgelehnt|Kein Zugang|Nicht angeboten/i.test(t.slice(0, 80)) ? 'rechte' : 'intern' };
  return { ok: true };
}

/**
 * Ein beliebiges Werkzeug-Ergebnis in die feste Form (rein): typisiert bleibt typisiert; ein bloßer Text ist ein Erfolg — außer der Rückfall
 * `ausAltText` erkennt einen Fehlersatz (dann `herkunft: 'alttext'`, die Hülle zählt es).
 */
export function ergebnisAus(r: WerkzeugRueckgabe | null | undefined): WerkzeugErgebnis {
  if (istWerkzeugErgebnis(r)) return { ...r, herkunft: r.herkunft ?? 'typisiert' };
  const text = typeof r === 'string' ? r : '';
  const alt = ausAltText(text);
  if (alt.ok) return erfolg(text);
  return { ...fehlschlag(alt.klasse ?? 'intern', text), herkunft: 'alttext' };
}

/** Passt der Bereich eines Werkzeugs zur Sicht des Laufs? Ohne Sicht (Alles, Telegram, Hintergrund) passt alles. */
export const bereichPasst = (b: WerkzeugBereich, sicht: Sicht | null | undefined): boolean => !sicht || b === 'beide' || b === sicht;
/**
 * Darf dieses Werkzeug in dieser Sicht laufen (rein — DIE Regel für Hülle und Angebot)? Bereich passt — oder es legt NUR einen Vorschlag in den
 * Stapel (`vorschlag`, z. B. `crm_vorschlag`): der Stapel ordnet jeden Vorschlag seinem Bereich zu und zeigt ihn nur dort („Wohin damit“, 09.10.
 * spät) — so kann ZOE im Privat-Gespräch einen Fakt über eine Firma dorthin vorschlagen, wo er hingehört, ohne dass Business-Daten in Privat landen.
 */
export const vertragPasstZurSicht = (v: { bereich: WerkzeugBereich; rechteklasse: Rechteklasse }, sicht: Sicht | null | undefined): boolean =>
  v.rechteklasse === 'vorschlag' || bereichPasst(v.bereich, sicht);
const BEREICH_NAME: Readonly<Record<Sicht, string>> = { privat: 'Privat', business: 'Business' };
/** Der Satz, wenn ein Werkzeug nicht in die Sicht gehört — ohne Inhalte, nur der Name des Werkzeugs. */
export const bereichAbgelehntText = (name: string, b: Sicht, sicht: Sicht): string =>
  `Nicht ausgeführt: „${name}“ gehört zu ${BEREICH_NAME[b]} — in der Sicht ${BEREICH_NAME[sicht]} nicht verfügbar. Sag der Person, dass sie es oben unter „${BEREICH_NAME[b]}“ (oder „Alles“) fragen kann.`;

/**
 * Die Wirkung EINES Aufrufs („Rule of Two“ an einer Stelle, C10/T9) — rein. Eingang: Rechteklasse und Register-Stufe des Werkzeugs, Marken des
 * Laufs (fremder Text gelesen), Wunsch des Aufrufers (`vorschlagen`), Freigabe aus dem Stapel (`erzwingen`). Ausgang:
 *   ausfuehren · vorschlag (in den Stapel) · sperre (Stufe „nie“).
 * Regeln: „nie“ sperrt (außer der Freigabe selbst) · die Freigabe aus dem Stapel führt aus · Außenwirkung, Geld, Löschen → IMMER Vorschlag ·
 * Stufe „freigabe“ oder `vorschlagen` → Vorschlag · nach fremdem Text wirkt nichts Schreibendes ohne Klick (nur `lesen`/`vorschlag` laufen) ·
 * sonst ausführen.
 */
export type Wirkung = 'ausfuehren' | 'vorschlag' | 'sperre';
export function wirkungsEntscheid(v: { rechteklasse: Rechteklasse; risiko: 'frei' | 'freigabe' | 'nie' }, z: { erzwingen?: boolean; vorschlagen?: boolean; fremdGelesen?: boolean }): Wirkung {
  if (v.risiko === 'nie' && !z.erzwingen) return 'sperre';
  if (z.erzwingen) return 'ausfuehren';
  if (IMMER_FREIGABE.has(v.rechteklasse)) return 'vorschlag';
  if (v.risiko === 'freigabe' || z.vorschlagen) return 'vorschlag';
  if (z.fremdGelesen && !OHNE_WIRKUNG.has(v.rechteklasse)) return 'vorschlag';
  return 'ausfuehren';
}

/** Ein Vertrag — wie ihn das Register (lib/werkzeuge/register.ts) liefert. */
export interface WerkzeugVertrag {
  name: string;
  /** zoe = Register-Werkzeug (über `fuehreAus`) · steuerung = ZOE-Steuerung im Gespräch (run_agent, open_agent) · agent = nur Heads/Mitarbeiter. */
  herkunft: 'zoe' | 'steuerung' | 'agent';
  /** Das Eingabe-Schema (JSON-Schema-Teilmenge, lib/werkzeuge/schema.ts) — dieselbe Quelle wie die Beschreibung fürs Modell. */
  eingabe: Record<string, unknown>;
  rechteklasse: Rechteklasse;
  /** Register-Stufe (frei/freigabe/nie) — nur für `zoe`; Agenten-Werkzeuge entscheiden im Handler (Vorschlag). */
  risiko: 'frei' | 'freigabe' | 'nie';
  bereich: WerkzeugBereich;
  /** KI-Kategorie (lib/datenschutz/ki-werkzeuge.ts) — null = keine Bereichsdaten. */
  kategorie: KiKategorie | null;
  /** Trägt Text Dritter (Quelle im <fremde_daten>-Rahmen) — null = nein. */
  fremd: string | null;
  /** Kapselt seine Antwort selbst (Kopfzeile + eigener Rahmen). */
  gekapselt: boolean;
  gruppe: string;
}
