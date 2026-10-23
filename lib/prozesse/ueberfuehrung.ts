// ─── Prozesse · Überführung — feste System-Abläufe ziehen echt in die Werkstatt (22.10., Paket Ü; rein, client-sicher) ──────────────────────────────────
// Entscheidung 22.10. (Plan-Seite abgenommen): „Die Prozesse im Code zeigen ihre Einstellungen schon im Steckbrief. Fünf davon ziehen echt in die Werkstatt um: zuerst ein paar
// Tage im Schatten neben dem alten Code, umgeschaltet wird erst, wenn beide dasselbe tun. Hältst du einen überführten Prozess an, läuft der alte Weg wieder.“ —
// „Erst Stellschrauben, dann überführen“, „klein und sicher zuerst“.
//
// Die Bausteine dieser Datei (alles rein; Server: ./ueberfuehrung-server.ts, Schritte: ./system-schritte-server.ts):
//   · `UEBERFUEHRBAR` — die feste Liste der Teile, die umziehen können: System-Prozess (`sp-…`), der FESTE SCHRITT (`system.fest` mit `schritt`), der alte
//     Einstiegspunkt (fragt die Weiche genau einmal) und die Kennungs-Brücke (dieselben Kennungen wie der alte Code).
//   · Ablöse-Weiche `wegEntscheiden`: der alte Weg läuft, AUSSER ein Prozess mit `ersetzt === sp` ist aktiv, in Phase „scharf“ UND im Motor scharf geschaltet.
//     Angehalten, Entwurf, archiviert, Schatten oder ein nicht lesbarer Bestand → alter Weg. Der Motor nimmt DIESELBE Regel (`neuerWegScharf` in `modusFuer`) —
//     so läuft nie beides scharf und nie keins.
//   · Schatten-Vergleich: beide Wege melden je Gelegenheit (Berliner Tag) ihr Wirkungsbild — nur Art, Ziel-Kennung, Tag und (als Fingerabdruck) die Zuständigkeit,
//     nie Texte, nie Werte, nie Namen. Ein Tag zählt, sobald er vorbei ist: gleich, anders, nur alt bzw. nur neu. Gespeichert werden nur Zähler und die letzte
//     Abweichung (Kennungen und Feldnamen) am Prozess (`ProzessEintrag.ueberfuehrung`, schreibt NUR der Server).
//   · Umschalten erst ab N Läufen und M Tagen ohne Abweichung (Stellschrauben `ueberfuehrung.laeufe` / `ueberfuehrung.tage`, Vorgabe 5 / 3) — und nur per Klick
//     einer Person (nie automatisch, nie Dienstweg/ZOE).
// Ohne `ersetzt`/`ueberfuehrung` rechnet alles bit-gleich wie vorher (Säuberer lässt die Felder weg, die Weiche sagt „alt“, der Motor ändert nichts).

import type { ProzessEintrag } from './definition';

// ══ Was umziehen kann ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Ein fester Schritt (Baustein `system.fest`): der Kern eines alten Ablaufs — dieselbe Regel, dieselben Kennungen, derselbe Schreibweg. */
export type SystemSchrittId = 'mahnaufgaben' | 'treppe-report';
export const SYSTEM_SCHRITT_IDS = ['mahnaufgaben', 'treppe-report'] as const satisfies readonly SystemSchrittId[];
export const istSystemSchritt = (v: unknown): v is SystemSchrittId => typeof v === 'string' && (SYSTEM_SCHRITT_IDS as readonly string[]).includes(v);

export interface UeberfuehrbarDef {
  /** Der System-Prozess (lib/prozesse/register.ts), von dem ein Teil umzieht. */
  sp: string;
  /** Der feste Schritt, der im neuen Prozess die Arbeit tut. */
  schritt: SystemSchrittId;
  /** Der Teil, der umzieht (ein Wort für Steckbrief und Band). */
  teil: string;
  /** Name des Werkstatt-Prozesses. */
  titel: string;
  /** Was der feste Schritt tut — ein Satz (Palette, Maske, Steckbrief). */
  satz: string;
  /** Der alte Einstiegspunkt: Datei und Funktion — dort fragt der Code die Weiche GENAU EINMAL (Wächter in tests/prozesse-ueberfuehrung.test.ts). */
  einstieg: { datei: string; funktion: string };
  /** Die Kennungs-Brücke: über welche EINE Funktion beide Wege dieselben Kennungen bilden (Umschalten mitten im Monat legt nie doppelt an). */
  kennung: string;
  /** Was am System-Prozess im Code bleibt (der Rest des Ablaufs). */
  bleibt: string;
}

/**
 * Die feste Liste (Reihenfolge „klein und sicher zuerst“). Nicht dabei (Bericht Paket Ü): Power-Hour-Vorbereitung (Head-Lauf je Person mit Nachholen in Business-
 * freien Zeiten — der Zeitplan startet einmal je Slot, eine Fan-out „je Person“ gibt es im Motor nicht), Event-Nachfassen (der alte Weg schreibt nichts — er misst nur;
 * es gibt nichts abzulösen) und Übergabe & Onboarding (der alte Weg ist Klick + Fulfillment-Morgenlauf, keine eine Stelle mit denselben Schreibungen).
 */
export const UEBERFUEHRBAR: readonly UeberfuehrbarDef[] = [
  {
    sp: 'sp-rechnung', schritt: 'mahnaufgaben', teil: 'Mahnaufgaben', titel: 'Mahnaufgaben (überführt)',
    satz: 'Je fälliger Mahnstufe einer Rechnung der Business-Gesellschaften eine Aufgabe — dieselbe Regel, dieselben Kennungen wie der Morgenlauf. Verschickt wird per Klick.',
    einstieg: { datei: 'lib/finanzen/rechnung/server.ts', funktion: 'mahnAufgabenNachziehen' },
    kennung: '`mahnAufgabeId(rechnung, stufe)` (lib/finanzen/rechnung/regeln.ts) — Aufgabe `mahn-<rechnung>-<stufe>`',
    bleibt: 'Rechnung stellen, Storno, Mahnung vermerken (per Klick) und die Mahnaufgaben der Privat-Gesellschaften bleiben im Code.',
  },
  {
    sp: 'sp-treppe', schritt: 'treppe-report', teil: 'Fortschritts-Report', titel: 'Fortschritts-Report (überführt)',
    satz: 'Je aktivem Mandat der Leistungstreppe alle n Tage ein Vorschlag „Fortschritts-Report“ in den Stapel und eine Glocke — dieselbe Regel und Marke wie der Morgenlauf. Gesendet wird per Klick.',
    einstieg: { datei: 'lib/crm/treppe-server.ts', funktion: 'treppeMorgenlauf' },
    kennung: 'Marke `report:<mandat>` im Bestand der Treppe (`reportFaelligHeute`) und der Vorschlag `report-<fnv(mandat|tag)>` (lib/crm/treppe-server.ts)',
    bleibt: '„Nächste Stufe anbieten“ und das Erstellen des Reports bei der Freigabe bleiben im Code.',
  },
];
const NACH_SP = new Map(UEBERFUEHRBAR.map(u => [u.sp, u]));
export const ueberfuehrbarVon = (sp: string | undefined | null): UeberfuehrbarDef | null => (sp ? NACH_SP.get(sp) ?? null : null);
export const istUeberfuehrbar = (sp: unknown): sp is string => typeof sp === 'string' && NACH_SP.has(sp);
export const ueberfuehrbarZuSchritt = (s: SystemSchrittId): UeberfuehrbarDef => UEBERFUEHRBAR.find(u => u.schritt === s)!;

// ══ Das Feld am Prozess (`ProzessEintrag.ersetzt` + `ProzessEintrag.ueberfuehrung` — schreibt NUR der Server) ══════════════════════════════════════

export type UeberfuehrungPhase = 'schatten' | 'scharf';
/** Ein Eintrag des Wirkungsbilds (nur Kennungen): Art, Ziel-Kennung, Tag, Fingerabdruck der Zuständigkeit. */
export interface Wirkungsbild { art: 'aufgabe' | 'vorschlag' | 'auftrag' | 'meldung'; ziel: string; tag?: string; zustaendig?: string }
/** Eine noch offene Gelegenheit (ein Berliner Tag): die Schlüssel der Wirkungen je Weg. */
export interface VergleichSlot { tag: string; alt?: string[]; neu?: string[] }
export type AbweichungGrund = 'nur-alt' | 'nur-neu' | 'anders' | 'zu-viele';
/** Die letzte Abweichung — nur Kennungen (Ziele) und Feldnamen. */
export interface VergleichAbweichung { tag: string; grund: AbweichungGrund; kennungen: string[]; felder?: string[] }
export interface Vergleich {
  /** Abgeschlossene Gelegenheiten insgesamt. */
  laeufe: number; gleich: number; abweichend: number;
  /** Gleich in Folge seit der letzten Abweichung — und seit welchem Tag. */
  gleichLaeufe: number; gleichSeit?: string;
  letzte?: VergleichAbweichung;
  offen?: VergleichSlot;
}
export interface Ueberfuehrung {
  phase: UeberfuehrungPhase;
  /** Seit wann überführt (ISO). */
  seit: string;
  umgeschaltetAm?: string; umgeschaltetVon?: string;
  vergleich: Vergleich;
}
export const leererVergleich = (): Vergleich => ({ laeufe: 0, gleich: 0, abweichend: 0, gleichLaeufe: 0 });

/** Höchstens so viele Wirkungen je Weg und Gelegenheit (darüber: nicht vergleichbar → Abweichung „zu viele“, nie still gekürzt). */
export const BILD_MAX = 200;
/** Höchstens so viele Kennungen an der letzten Abweichung. */
export const LETZTE_MAX = 8;

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const SCHLUESSEL = /^[a-z]{3,12}\|[A-Za-z0-9:._~-]{1,160}\|(\d{4}-\d{2}-\d{2})?\|[0-9a-f]{0,16}$/;
const ZIEL = /^[A-Za-z0-9:._~-]{1,160}$/;
const FELD = /^[a-z]{1,20}$/;
const o = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);
const zahl = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
const text = (v: unknown, max = 120): string | undefined => (typeof v === 'string' && v && v.length <= max ? v : undefined);
const liste = (v: unknown, re: RegExp, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && re.test(x)).slice(0, max) : []);

/** Der Säuberer des Felds (rein, schreibt nie): Unlesbares fällt weg — ohne Feld bleibt alles wie vorher. */
export function ueberfuehrungAus(roh: unknown): Ueberfuehrung | undefined {
  const x = o(roh);
  if (!x) return undefined;
  const phase = x.phase === 'scharf' ? 'scharf' : x.phase === 'schatten' ? 'schatten' : null;
  const seit = text(x.seit, 40);
  if (!phase || !seit) return undefined;
  const v = o(x.vergleich) ?? {};
  const l = o(v.letzte);
  const letzte: VergleichAbweichung | undefined = l && typeof l.tag === 'string' && TAG.test(l.tag) && (['nur-alt', 'nur-neu', 'anders', 'zu-viele'] as const).includes(l.grund as AbweichungGrund)
    ? { tag: l.tag, grund: l.grund as AbweichungGrund, kennungen: liste(l.kennungen, ZIEL, LETZTE_MAX), ...(Array.isArray(l.felder) && l.felder.length ? { felder: liste(l.felder, FELD, 6) } : {}) }
    : undefined;
  const of = o(v.offen);
  const offen: VergleichSlot | undefined = of && typeof of.tag === 'string' && TAG.test(of.tag)
    ? { tag: of.tag, ...(Array.isArray(of.alt) ? { alt: liste(of.alt, SCHLUESSEL, BILD_MAX + 1) } : {}), ...(Array.isArray(of.neu) ? { neu: liste(of.neu, SCHLUESSEL, BILD_MAX + 1) } : {}) }
    : undefined;
  const gleichSeit = typeof v.gleichSeit === 'string' && TAG.test(v.gleichSeit) ? v.gleichSeit : undefined;
  return {
    phase, seit, ...(text(x.umgeschaltetAm, 40) ? { umgeschaltetAm: x.umgeschaltetAm as string } : {}), ...(text(x.umgeschaltetVon, 60) ? { umgeschaltetVon: x.umgeschaltetVon as string } : {}),
    vergleich: {
      laeufe: zahl(v.laeufe), gleich: zahl(v.gleich), abweichend: zahl(v.abweichend), gleichLaeufe: zahl(v.gleichLaeufe),
      ...(gleichSeit ? { gleichSeit } : {}), ...(letzte ? { letzte } : {}), ...(offen ? { offen } : {}),
    },
  };
}
/** `ersetzt` lesen: nur ein System-Prozess der festen Liste — sonst fehlt das Feld. */
export const ersetztAus = (roh: unknown): string | undefined => (istUeberfuehrbar(roh) ? roh : undefined);

// ══ Die Ablöse-Weiche (EINE Entscheidungsstelle — Server: `wegFuer`, Motor: `modusFuer`) ═════════════════════════════════════════════════════════

type Ersetzer = Pick<ProzessEintrag, 'id' | 'status'> & Partial<Pick<ProzessEintrag, 'ersetzt' | 'ueberfuehrung'>>;

/** Der (nicht archivierte) Prozess, der diesen System-Prozess ersetzt — höchstens einer je `sp-…` (der Server lehnt einen zweiten mit 409 ab). */
export function ersetzerVon<T extends Ersetzer>(prozesse: readonly T[], sp: string): T | null {
  return prozesse.find(p => p.ersetzt === sp && p.status !== 'archiviert') ?? null;
}
/**
 * Läuft der NEUE Weg scharf? Nur, wenn der Prozess einen System-Prozess ersetzt, aktiv ist, in Phase „scharf“ steht UND im Motor scharf geschaltet ist (Budget,
 * Rückfrage). Angehalten, Probelauf, Entwurf, Schatten → nein. Der Motor fragt dieselbe Funktion (`modusFuer`): ein Prozess in Überführung läuft scharf NUR so.
 */
export function neuerWegScharf(e: Ersetzer | null | undefined, motorScharf: boolean): boolean {
  return !!e?.ersetzt && e.status === 'aktiv' && e.ueberfuehrung?.phase === 'scharf' && motorScharf;
}
export interface WegEntscheidung {
  weg: 'alt' | 'neu';
  /** Der ersetzende Prozess (auch, wenn der alte Weg läuft). */
  prozessId?: string;
  /** Der neue Weg rechnet gerade im Schatten mit — dann meldet auch der alte Weg sein Wirkungsbild (Vergleich). */
  schatten: boolean;
}
/**
 * Die Weiche (rein): `motorScharf(id)` = steht im Lauf-Bestand „scharf geschaltet“? Schatten = Phase Schatten UND der Prozess läuft (Probelauf bzw. aktiv) — ein
 * angehaltener Prozess vergleicht nicht (sonst zählten Tage, an denen er gar nicht laufen durfte, als Abweichung).
 */
export function wegEntscheiden(prozesse: readonly Ersetzer[], sp: string, motorScharf: (id: string) => boolean): WegEntscheidung {
  const e = ersetzerVon(prozesse, sp);
  if (!e) return { weg: 'alt', schatten: false };
  if (neuerWegScharf(e, motorScharf(e.id))) return { weg: 'neu', prozessId: e.id, schatten: false };
  const laeuft = e.status === 'aktiv' || e.status === 'probelauf';
  return { weg: 'alt', prozessId: e.id, schatten: laeuft && (e.ueberfuehrung?.phase ?? 'schatten') === 'schatten' };
}

// ══ Der Schatten-Vergleich (rein) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Kurzer Fingerabdruck (FNV-1a, 8 hex) — für die Zuständigkeit im Wirkungsbild (nie ein Name im Bestand). */
export function kurzFingerabdruck(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}
/** Der Schlüssel eines Eintrags im Wirkungsbild: `art|ziel|tag|<Fingerabdruck der Zuständigkeit>` — nur Kennungen. */
export function bildSchluessel(w: Wirkungsbild): string {
  return `${w.art}|${w.ziel}|${w.tag ?? ''}|${w.zustaendig ? kurzFingerabdruck(w.zustaendig) : ''}`;
}
const teile = (s: string) => { const [art, ziel, tag, zust] = s.split('|'); return { art, ziel, tag, zust }; };

/** Eine Gelegenheit bewerten (rein): gleich, anders (mit Feldnamen), nur ein Weg, zu viele. */
export function slotUrteil(s: VergleichSlot): { gleich: true } | { gleich: false; abweichung: VergleichAbweichung } {
  const alt = s.alt, neu = s.neu;
  if (!alt || !neu) {
    const da = (alt ?? neu ?? []).map(x => teile(x).ziel);
    return { gleich: false, abweichung: { tag: s.tag, grund: alt ? 'nur-alt' : 'nur-neu', kennungen: Array.from(new Set(da)).slice(0, LETZTE_MAX) } };
  }
  if (alt.length > BILD_MAX || neu.length > BILD_MAX) return { gleich: false, abweichung: { tag: s.tag, grund: 'zu-viele', kennungen: [] } };
  const a = new Set(alt), n = new Set(neu);
  if (a.size === n.size && [...a].every(x => n.has(x))) return { gleich: true };
  // Was weicht ab? Ziele nur auf einer Seite bzw. dieselben Ziele mit anderem Tag / anderer Zuständigkeit.
  const ziele = (l: Set<string>) => new Map([...l].map(x => [`${teile(x).art}|${teile(x).ziel}`, teile(x)]));
  const za = ziele(a), zn = ziele(n);
  const kennungen = new Set<string>(), felder = new Set<string>();
  for (const [k, x] of za) {
    const y = zn.get(k);
    if (!y) { kennungen.add(x.ziel); continue; }
    if (x.tag !== y.tag) { felder.add('tag'); kennungen.add(x.ziel); }
    if (x.zust !== y.zust) { felder.add('zustaendig'); kennungen.add(x.ziel); }
  }
  for (const [k, y] of zn) if (!za.has(k)) kennungen.add(y.ziel);
  return { gleich: false, abweichung: { tag: s.tag, grund: 'anders', kennungen: [...kennungen].slice(0, LETZTE_MAX), ...(felder.size ? { felder: [...felder] } : {}) } };
}

/** Eine abgeschlossene Gelegenheit in die Zähler (rein). */
function buchen(v: Vergleich, s: VergleichSlot): Vergleich {
  const u = slotUrteil(s);
  if (u.gleich) return { ...v, laeufe: v.laeufe + 1, gleich: v.gleich + 1, gleichLaeufe: v.gleichLaeufe + 1, gleichSeit: v.gleichSeit ?? s.tag };
  const { gleichSeit: _g, ...rest } = v;
  return { ...rest, laeufe: v.laeufe + 1, abweichend: v.abweichend + 1, gleichLaeufe: 0, letzte: u.abweichung };
}

/** Offene Gelegenheiten vor `heute` abschließen (rein) — der Tag ist vorbei, beide Wege hätten gemeldet haben müssen. */
export function vergleichAbschliessen(v: Vergleich, heute: string): Vergleich {
  if (!v.offen || v.offen.tag >= heute) return v;
  const { offen, ...rest } = v;
  return buchen(rest, offen);
}

/**
 * Ein Weg meldet sein Wirkungsbild für einen Tag (rein): ältere offene Tage werden zuerst abgeschlossen; derselbe Tag wird vereinigt (ein Weg kann an einem Tag
 * mehrmals melden). Gespeichert werden nur Schlüssel (`bildSchluessel`) — höchstens `BILD_MAX` + 1 (darüber „zu viele“).
 */
export function vergleichMelden(v0: Vergleich, seite: 'alt' | 'neu', tag: string, bild: readonly Wirkungsbild[]): Vergleich {
  if (!TAG.test(tag)) return v0;
  const v = vergleichAbschliessen(v0, tag);
  const schluessel = bild.map(bildSchluessel);
  const slot: VergleichSlot = v.offen?.tag === tag ? { ...v.offen } : { tag };
  slot[seite] = Array.from(new Set([...(slot[seite] ?? []), ...schluessel])).sort().slice(0, BILD_MAX + 1);
  return { ...v, offen: slot };
}

/** Die Regel fürs Umschalten (Stellschrauben, Vorgabe 5 Läufe / 3 Tage). */
export interface UmschaltRegel { laeufe: number; tage: number }
export const UMSCHALT_VORGABE: UmschaltRegel = { laeufe: 5, tage: 3 };

/** Ganze Kalendertage zwischen zwei Berliner Tagen (rein). */
export function tageZwischen(von: string, bis: string): number {
  const t = (x: string) => Date.UTC(Number(x.slice(0, 4)), Number(x.slice(5, 7)) - 1, Number(x.slice(8, 10)));
  return Math.round((t(bis) - t(von)) / 86_400_000);
}

export interface UmschaltPruefung { erlaubt: boolean; grund?: string; laeufe: number; tage: number; regel: UmschaltRegel }
/**
 * Darf umgeschaltet werden? (rein) — nur in Phase „schatten“, nach mindestens `regel.laeufe` gleichen Läufen in Folge (abgeschlossene Tage) über mindestens
 * `regel.tage` Tage, ohne Abweichung seitdem. Der Klick einer Person entscheidet — das hier sagt nur, ob er schon geht.
 */
export function umschaltenPruefen(ue: Ueberfuehrung | undefined, regel: UmschaltRegel, heute: string): UmschaltPruefung {
  if (!ue) return { erlaubt: false, grund: 'Dieser Prozess ersetzt keinen System-Ablauf.', laeufe: 0, tage: 0, regel };
  if (ue.phase === 'scharf') return { erlaubt: false, grund: 'Schon umgeschaltet — der neue Weg arbeitet.', laeufe: ue.vergleich.gleichLaeufe, tage: 0, regel };
  const v = vergleichAbschliessen(ue.vergleich, heute);
  const tage = v.gleichSeit ? tageZwischen(v.gleichSeit, heute) : 0;
  if (v.gleichLaeufe < regel.laeufe || tage < regel.tage) {
    const fehlt = [v.gleichLaeufe < regel.laeufe ? `noch ${regel.laeufe - v.gleichLaeufe} ${regel.laeufe - v.gleichLaeufe === 1 ? 'gleicher Lauf' : 'gleiche Läufe'}` : '', tage < regel.tage ? `noch ${regel.tage - tage} ${regel.tage - tage === 1 ? 'Tag' : 'Tage'}` : ''].filter(Boolean).join(' und ');
    return { erlaubt: false, grund: `Erst im Schatten vergleichen — ${fehlt} ohne Abweichung.`, laeufe: v.gleichLaeufe, tage, regel };
  }
  return { erlaubt: true, laeufe: v.gleichLaeufe, tage, regel };
}

/** Phase zurück auf „Schatten“ (rein): der Vergleich beginnt neu zu zählen (die Summen bleiben als Verlauf). */
export function zurueckInDenSchatten(ue: Ueberfuehrung): Ueberfuehrung {
  const { umgeschaltetAm: _a, umgeschaltetVon: _b, ...rest } = ue;
  const { gleichSeit: _g, offen: _o, ...v } = ue.vergleich;
  return { ...rest, phase: 'schatten', vergleich: { ...v, gleichLaeufe: 0 } };
}

// ══ Anzeige (Landkarte, Steckbrief, Werkstatt) ═══════════════════════════════════════════════════════════════════════════════════════════════════

/** Wie es um eine Überführung steht — für Kachel und Steckbrief (der Server hängt es an, `ProzessDef.ueberfuehrung`). */
export type UeberfuehrungStand = 'moeglich' | 'schatten' | 'scharf' | 'angehalten';
export function standVonUeberfuehrung(e: Ersetzer | null, motorScharf: boolean): UeberfuehrungStand {
  if (!e) return 'moeglich';
  if (neuerWegScharf(e, motorScharf)) return 'scharf';
  if (e.ueberfuehrung?.phase === 'scharf') return 'angehalten';
  return e.status === 'aktiv' || e.status === 'probelauf' ? 'schatten' : 'angehalten';
}
export const STAND_TEXT: Readonly<Record<UeberfuehrungStand, string>> = {
  moeglich: 'kann in die Werkstatt umziehen',
  schatten: 'im Schatten — der alte Weg arbeitet, der neue rechnet mit',
  scharf: 'überführt — der neue Weg arbeitet',
  angehalten: 'angehalten — der alte Weg arbeitet wieder',
};
/** Die Marke der Kachel (kurz). */
export const STAND_MARKE: Readonly<Record<UeberfuehrungStand, string | null>> = { moeglich: null, schatten: 'im Schatten', scharf: 'überführt', angehalten: 'alter Weg' };
/** Die Ansicht einer Überführung (Werkstatt-Band; GET /api/prozesse/werkstatt?id=) — nur Zahlen, Kennungen, Sätze. */
export interface UeberfuehrungAnsicht {
  sp: string; spTitel: string; teil: string; satz: string; kennung: string; bleibt: string;
  phase: UeberfuehrungPhase; stand: UeberfuehrungStand; seit: string; umgeschaltetAm?: string; umgeschaltetVon?: string;
  /** Der Vergleich mit den Tagen, die vorbei sind, abgeschlossen (die offene Gelegenheit von heute steht unter `heute`). */
  vergleich: Omit<Vergleich, 'offen'>; heute?: { alt: boolean; neu: boolean };
  umschalten: UmschaltPruefung;
  /** Welcher Weg JETZT arbeitet. */
  arbeitet: 'alt' | 'neu';
}
/** Sätze zu den Abweichungen. */
export const ABWEICHUNG_TEXT: Readonly<Record<AbweichungGrund, string>> = {
  'nur-alt': 'nur der alte Weg hat an diesem Tag gewirkt',
  'nur-neu': 'nur der neue Weg hat an diesem Tag gewirkt',
  anders: 'beide haben gewirkt, aber nicht gleich',
  'zu-viele': 'zu viele Wirkungen zum Vergleichen',
};
