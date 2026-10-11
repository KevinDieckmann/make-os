// ─── Unternehmen › Beschlüsse & Satzung: Beschluss-Buch und Fassungen (rein, client-sicher, 10.10.) ─────────────────────────────────
// Kevin 10.10.: „Unternehmen wird extrem spannend, wenn ich da alle Gesellschafterbeschlüsse, den Gegenstand und alles dazu gesammelt habe.“
// EINE Quelle: der Register-Eintrag der Gesellschaft (`gesellschaften--<haushalt>`, Listen `beschluesse` und `fassungen`, alles optional — der
// Altbestand bleibt gültig). Hier stehen nur Regeln, nie Daten:
//   · Nummern: je Gesellschaft und Jahr fortlaufend. Der Server vergibt sie beim ersten „nicht mehr Entwurf“ (`naechsteNummer`) und schreibt sie
//     nie um; Altbestand ohne Nummer bekommt sie NUR in der Anzeige (`beschlussNummern`, an gespeicherten Nummern vorbei, „abgeleitet“).
//   · Abstimmung: Ergebnis nach Anteilen (Nennbetrag zum Zeitpunkt der Abstimmung, stimmrechtslose zählen nicht) bzw. nach Köpfen (Organe);
//     die Mehrheit ist der gesetzliche Regelfall (§ 47 Abs. 1, § 53 Abs. 2 GmbHG) — die Satzung kann abweichen. Hinweis, keine Rechtsberatung.
//   · Fassungen: „Stand am Datum X“ = je Merkmal die jüngste Fassung mit „gültig ab“ ≤ X; ohne Fassung gilt der Steckbrief (Altbestand).
//   · Folgen eines gefassten Beschlusses (Vorschläge, nichts automatisch): Ereignis im Pflichten-Kalender des Schilds (daraus Handelsregister-
//     Anmeldung, Gesellschafterliste, Transparenzregister mit Frist — EINE Quelle, lib/gesellschaften/schild/pflichten.ts), neue Fassung,
//     Cap-Table anpassen.
//   · Offene Eintragungen für den Recht-Check (gefasst, aber nicht angemeldet; angemeldet, aber lange nicht eingetragen).
// Tests: tests/beschluss-buch.test.ts.

import {
  BESCHLUSS_ARTEN, BESCHLUSS_STATUS, GREMIEN, SATZUNG_MERKMALE, STIMMEN, aktiveEintraege, anzeigeName, euroText,
  type Beschluss, type BeschlussArt, type BeschlussStatus, type Fassung, type Gremium, type RegisterGesellschaft, type SatzungMerkmal, type Stimme,
} from './modell';
import { ereignisDef } from './schild/pflichten';
import type { EreignisArt } from './schild/typen';
import type { SchildKontext } from './schild/kontext';
import type { GesellschaftId } from '@/lib/einheiten';
import { tagePlus, tageZwischen, tagText } from './schild/zeit';

export const BESCHLUSS_HINWEIS = 'Hinweis, keine Rechtsberatung — Mehrheiten, Formen und Fristen können in eurer Satzung abweichen; wesentliche Beschlüsse anwaltlich bzw. notariell prüfen.';

export const artLabel = (a: BeschlussArt) => BESCHLUSS_ARTEN.find(x => x.id === a)?.label ?? 'Beschluss';
export const statusLabelB = (s: BeschlussStatus) => BESCHLUSS_STATUS.find(x => x.id === s)?.label ?? s;
export const gremiumLabel = (g: Gremium) => GREMIEN.find(x => x.id === g)?.label ?? 'Gremium';
export const merkmalLabel = (m: SatzungMerkmal) => SATZUNG_MERKMALE.find(x => x.id === m)?.label ?? m;
export const stimmeLabel = (s: Stimme) => STIMMEN.find(x => x.id === s)?.label ?? s;

/** Gremium eines Beschlusses: gesetzt, sonst aus der Art (GF-Beschluss → Geschäftsführung, Beirat → Beirat, sonst Gesellschafterversammlung). */
export function gremiumVon(b: Pick<Beschluss, 'art' | 'gremium'>): Gremium {
  if (b.gremium) return b.gremium;
  return b.art === 'gf-beschluss' ? 'geschaeftsfuehrung' : b.art === 'beiratsbeschluss' ? 'beirat' : 'gesellschafterversammlung';
}

// ── Nummern ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Nummer { jahr: number; nr: number; abgeleitet?: true }
/** „Nr. 3/2026“ (abgeleitet: ohne Zusatz — die Anzeige sagt es im Titel). */
export const nummerText = (n: Pick<Nummer, 'jahr' | 'nr'> | undefined) => (n ? `Nr. ${n.nr}/${n.jahr}` : 'ohne Nummer');
const jahrVon = (b: Pick<Beschluss, 'datum'>) => Number(b.datum.slice(0, 4));
/** Zählt ein Beschluss im Buch? Entwürfe nicht (noch nicht gefasst). Papierkorb und aufgehobene behalten ihre Nummer (Lücken bleiben ehrlich). */
const imBuch = (b: Beschluss) => b.status !== 'entwurf';

/**
 * Nummern aller Beschlüsse (rein): gespeicherte bleiben; Altbestand (kein Entwurf, ohne Nummer) bekommt je Jahr die nächsten freien Nummern
 * nach Datum — an gespeicherten vorbei, mit `abgeleitet`. Entwürfe haben keine Nummer.
 */
export function beschlussNummern(liste: readonly Beschluss[] | undefined): Map<string, Nummer> {
  const raus = new Map<string, Nummer>();
  const l = liste ?? [];
  const belegt = new Map<number, Set<number>>();
  for (const b of l) {
    if (!b.nummer) continue;
    raus.set(b.id, { jahr: b.nummer.jahr, nr: b.nummer.nr });
    if (!belegt.has(b.nummer.jahr)) belegt.set(b.nummer.jahr, new Set());
    belegt.get(b.nummer.jahr)!.add(b.nummer.nr);
  }
  const alt = l.filter(b => !b.nummer && imBuch(b)).sort((a, b) => a.datum.localeCompare(b.datum) || (a.angelegt ?? '').localeCompare(b.angelegt ?? '') || a.id.localeCompare(b.id));
  const naechste = new Map<number, number>();
  for (const b of alt) {
    const j = jahrVon(b);
    const frei = belegt.get(j) ?? new Set<number>();
    let n = (naechste.get(j) ?? 0) + 1;
    while (frei.has(n)) n++;
    naechste.set(j, n);
    raus.set(b.id, { jahr: j, nr: n, abgeleitet: true });
  }
  return raus;
}

/** Die nächste Nummer im Jahr (Server): eins über der höchsten gespeicherten oder abgeleiteten. */
export function naechsteNummer(liste: readonly Beschluss[] | undefined, jahr: number): { jahr: number; nr: number } {
  let max = 0;
  for (const n of beschlussNummern(liste).values()) if (n.jahr === jahr) max = Math.max(max, n.nr);
  return { jahr, nr: max + 1 };
}

/**
 * Bekommt der Beschluss JETZT eine Nummer? (Server, rein) — wenn er nicht mehr Entwurf ist, noch keine hat und entweder neu ist oder gerade
 * aus dem Entwurf kommt. Altbestand, der schon gefasst war, bekommt nie eine gespeicherte Nummer (nur angezeigt-abgeleitet).
 */
export const braucheNummer = (neu: Beschluss, alt: Beschluss | undefined): boolean => !neu.nummer && imBuch(neu) && (!alt || alt.status === 'entwurf');

// ── Abstimmung ────────────────────────────────────────────────────────────────────────────────────────────────────

export type Mehrheit = 'einfach' | 'dreiviertel';
/** Gesetzlicher Regelfall: Satzungs- und Kapitalmaßnahmen drei Viertel der abgegebenen Stimmen (§ 53 Abs. 2 GmbHG), sonst einfache Mehrheit (§ 47 Abs. 1). */
export function mehrheitFuer(b: Pick<Beschluss, 'art' | 'aenderungen'>): Mehrheit {
  const satzung = (b.aenderungen ?? []).some(a => a.merkmal !== 'geschaeftsfuehrung');
  return b.art === 'satzungsaenderung' || b.art === 'kapitalmassnahme' || satzung ? 'dreiviertel' : 'einfach';
}
export interface Ergebnis {
  basis: 'anteile' | 'koepfe';
  ja: number; nein: number; enthaltung: number;
  /** Abgegebene Stimmen ohne Enthaltungen (Grundlage der Mehrheit). */
  abgegeben: number;
  mehrheit: Mehrheit;
  /** null = keine abgegebene Stimme. */
  angenommen: boolean | null;
  /** Stimmen ohne Stimmrecht, die nicht zählen. */
  ohneStimmrecht: number;
  text: string;
}
const prozent = (x: number, ges: number) => (ges ? `${(Math.round((x * 1000) / ges) / 10).toLocaleString('de-DE')} %` : '0 %');

/**
 * Das Ergebnis der Abstimmung (rein): sobald ein Gesellschafter abstimmt, nach Anteilen (gespeichertes Gewicht der Abstimmung); sonst nach
 * Köpfen. Enthaltungen zählen nicht als abgegeben; stimmrechtslose Anteile zählen nicht. `null`, wenn niemand abgestimmt hat.
 */
export function abstimmungsErgebnis(b: Pick<Beschluss, 'abstimmung' | 'art' | 'aenderungen'>): Ergebnis | null {
  const l = b.abstimmung ?? [];
  if (!l.length) return null;
  const anteile = l.some(s => s.id.startsWith('gs-'));
  const zaehlt = l.filter(s => (anteile ? s.id.startsWith('gs-') && !s.ohneStimmrecht : true));
  const gewicht = (s: (typeof l)[number]) => (anteile ? Math.max(0, s.gewichtCent ?? 0) : 1);
  const summe = (st: Stimme) => zaehlt.filter(s => s.stimme === st).reduce((n, s) => n + gewicht(s), 0);
  const ja = summe('ja'), nein = summe('nein'), enthaltung = summe('enthaltung');
  const abgegeben = ja + nein;
  const mehrheit = mehrheitFuer(b);
  const angenommen = abgegeben === 0 ? null : mehrheit === 'dreiviertel' ? ja * 4 >= abgegeben * 3 : ja > nein;
  const ohneStimmrecht = anteile ? l.filter(s => s.id.startsWith('gs-') && s.ohneStimmrecht).length : 0;
  const was = (x: number) => (anteile ? `${euroText(x)} (${prozent(x, ja + nein + enthaltung)})` : `${x}`);
  const text = `Ja ${was(ja)} · Nein ${was(nein)} · Enthaltung ${was(enthaltung)} — ${angenommen === null ? 'keine abgegebene Stimme' : angenommen ? 'angenommen' : 'abgelehnt'} (${mehrheit === 'dreiviertel' ? 'drei Viertel' : 'einfache Mehrheit'} der abgegebenen Stimmen${anteile ? ' nach Anteilen' : ' nach Köpfen'}, gesetzlicher Regelfall)${ohneStimmrecht ? ` · ${ohneStimmrecht} ohne Stimmrecht nicht gezählt` : ''}`;
  return { basis: anteile ? 'anteile' : 'koepfe', ja, nein, enthaltung, abgegeben, mehrheit, angenommen, ohneStimmrecht, text };
}

// ── Filter, Suche, Buch ───────────────────────────────────────────────────────────────────────────────────────────

export interface BuchFilter { jahr?: number; art?: BeschlussArt; status?: BeschlussStatus; q?: string }

/** Jahre, in denen Beschlüsse stehen (neueste zuerst). */
export const buchJahre = (liste: readonly Beschluss[] | undefined): number[] => [...new Set(aktiveEintraege(liste).map(jahrVon))].sort((a, b) => b - a);

/**
 * Das Buch (rein): Beschlüsse ohne Papierkorb, nach Datum (älteste zuerst — wie ein Buch; die Oberfläche dreht um), gefiltert. `passt` ist die
 * Suchregel der Oberfläche (lib/text/such-norm.ts `suchPasst`) — durchsucht Titel, Inhalt, Art, Nummer und Änderungen.
 */
export function buchListe(liste: readonly Beschluss[] | undefined, f: BuchFilter = {}, passt?: (texte: readonly (string | undefined)[], frage: string) => boolean): { b: Beschluss; nr?: Nummer }[] {
  const nummern = beschlussNummern(liste);
  return aktiveEintraege(liste)
    .filter(b => (f.jahr === undefined || jahrVon(b) === f.jahr) && (!f.art || b.art === f.art) && (!f.status || b.status === f.status))
    .filter(b => !f.q || !passt || passt([b.titel, b.inhalt, artLabel(b.art), nummerText(nummern.get(b.id)), ...(b.aenderungen ?? []).map(a => a.text)], f.q))
    .sort((a, b) => a.datum.localeCompare(b.datum) || (nummern.get(a.id)?.nr ?? 0) - (nummern.get(b.id)?.nr ?? 0))
    .map(b => ({ b, ...(nummern.get(b.id) ? { nr: nummern.get(b.id) } : {}) }));
}

// ── Fassungen: Gegenstand & Satzung ───────────────────────────────────────────────────────────────────────────────

/** Steckbrief-Feld, das ein Merkmal spiegelt (Gegenstand und Satzung haben keins). */
export const STECKBRIEF_FELD: Partial<Record<SatzungMerkmal, 'sitz' | 'stammkapitalCent' | 'geschaeftsfuehrung' | 'firmierung'>> = {
  sitz: 'sitz', stammkapital: 'stammkapitalCent', geschaeftsfuehrung: 'geschaeftsfuehrung', firmierung: 'firmierung',
};
/** Der Wert einer Fassung als Text („25.000 €“ bzw. Wortlaut). */
export const fassungWert = (f: Pick<Fassung, 'merkmal' | 'text' | 'cent'>): string => (f.merkmal === 'stammkapital' ? (typeof f.cent === 'number' ? euroText(f.cent) : '') : f.text ?? '');
const neuesteZuerst = (a: Fassung, b: Fassung) => b.ab.localeCompare(a.ab) || (b.angelegt ?? '').localeCompare(a.angelegt ?? '') || b.id.localeCompare(a.id);

/** Alle Fassungen eines Merkmals, neueste zuerst (ohne Papierkorb). */
export const fassungVerlauf = (g: Pick<RegisterGesellschaft, 'fassungen'>, m: SatzungMerkmal): Fassung[] => aktiveEintraege(g.fassungen).filter(f => f.merkmal === m).sort(neuesteZuerst);

export interface StandZeile { merkmal: SatzungMerkmal; wert?: string; fassung?: Fassung; /** Kein Eintrag in der Historie — der Wert kommt aus dem Steckbrief. */ ausSteckbrief?: true; /** Eine spätere Fassung ist schon beschlossen. */ kommt?: Fassung }

/**
 * Stand am Datum X (rein): je Merkmal die jüngste Fassung mit „gültig ab“ ≤ X. Gibt es bis X keine, gilt der Steckbrief-Wert — aber nur, solange
 * HEUTE noch keine Fassung dieses Merkmals gilt (sonst zeigt der Steckbrief schon den neuen Stand, und der Wert davor ist nicht festgehalten).
 * `kommt` = die nächste spätere Fassung.
 */
export function standAm(g: Pick<RegisterGesellschaft, 'fassungen' | 'sitz' | 'stammkapitalCent' | 'geschaeftsfuehrung' | 'firmierung' | 'ort'>, tag: string, heute: string): StandZeile[] {
  return SATZUNG_MERKMALE.map(({ id: m }) => {
    const v = fassungVerlauf(g, m);
    const gilt = v.find(f => f.ab <= tag);
    const kommt = [...v].reverse().find(f => f.ab > tag);
    if (gilt) return { merkmal: m, wert: fassungWert(gilt), fassung: gilt, ...(kommt ? { kommt } : {}) };
    const feld = STECKBRIEF_FELD[m];
    const roh = feld && !v.some(f => f.ab <= heute) ? (feld === 'sitz' ? g.sitz || g.ort : g[feld]) : undefined;
    const wert = typeof roh === 'number' ? euroText(roh) : roh || undefined;
    return { merkmal: m, ...(wert ? { wert, ausSteckbrief: true as const } : {}), ...(kommt ? { kommt } : {}) };
  });
}

/** Die heute gültige Fassung eines Merkmals (oder undefined). */
export const gueltigeFassung = (g: Pick<RegisterGesellschaft, 'fassungen'>, m: SatzungMerkmal, heute: string): Fassung | undefined => fassungVerlauf(g, m).find(f => f.ab <= heute);

/**
 * Steckbrief und gültige Fassung weichen ab (rein) — z. B. weil eine beschlossene Fassung inzwischen gilt oder der Steckbrief von Hand geändert
 * wurde. Die Oberfläche bietet „Steckbrief angleichen“ an (ein Klick, Steckbrief-Schreibweg); nichts geschieht von selbst.
 */
export function steckbriefAbweichungen(g: RegisterGesellschaft, heute: string): { merkmal: SatzungMerkmal; feld: 'sitz' | 'stammkapitalCent' | 'geschaeftsfuehrung' | 'firmierung'; steckbrief?: string; fassung: Fassung; wert: string | number }[] {
  const raus: ReturnType<typeof steckbriefAbweichungen> = [];
  for (const [m, feld] of Object.entries(STECKBRIEF_FELD) as [SatzungMerkmal, 'sitz' | 'stammkapitalCent' | 'geschaeftsfuehrung' | 'firmierung'][]) {
    const f = gueltigeFassung(g, m, heute);
    if (!f) continue;
    const wert = m === 'stammkapital' ? f.cent : f.text;
    if (wert === undefined || wert === g[feld]) continue;
    const s = g[feld];
    raus.push({ merkmal: m, feld, ...(s !== undefined ? { steckbrief: typeof s === 'number' ? euroText(s) : s } : {}), fassung: f, wert });
  }
  return raus;
}

/** Wird die neue Fassung heute gültig und ist sie die jüngste ihres Merkmals? Dann zieht der Server das Steckbrief-Feld im selben Schreiben nach. */
export function steckbriefNachziehen(g: Pick<RegisterGesellschaft, 'fassungen'>, f: Fassung, heute: string): { feld: 'sitz' | 'stammkapitalCent' | 'geschaeftsfuehrung' | 'firmierung'; wert: string | number } | null {
  const feld = STECKBRIEF_FELD[f.merkmal];
  if (!feld || f.ab > heute) return null;
  if (gueltigeFassung(g, f.merkmal, heute)?.id !== f.id) return null;
  const wert = f.merkmal === 'stammkapital' ? f.cent : f.text;
  return wert === undefined ? null : { feld, wert };
}

// ── Folgen eines gefassten Beschlusses ────────────────────────────────────────────────────────────────────────────

export type FolgeArt = 'ereignis' | 'fassung' | 'cap-table';
export interface BeschlussFolge {
  /** Stabil je Beschluss und Folge — Marke gegen Wiederholung, Schlüssel im Stapel. */
  schluessel: string;
  art: FolgeArt;
  titel: string;
  /** Was nach dem Klick passiert (ganzer Satz). */
  text: string;
  ereignis?: EreignisArt;
  /** Die Pflichten, die das Ereignis im Pflichten-Kalender auslöst (Titel + Norm). */
  pflichten?: string[];
  merkmal?: SatzungMerkmal;
  /** „Gültig ab“ einer neuen Fassung. */
  ab?: string;
}

/** Welche Ereignisse des Schilds ein Beschluss auslöst (rein) — aus der Art und den Änderungen, ohne Doppelte. */
export function ereignisseVon(b: Pick<Beschluss, 'art' | 'aenderungen'>): EreignisArt[] {
  const s = new Set<EreignisArt>();
  if (b.art === 'satzungsaenderung') s.add('satzungsaenderung');
  if (b.art === 'kapitalmassnahme') s.add('kapitalmassnahme');
  if (b.art === 'gf-bestellung') s.add('gf-wechsel');
  // Eine Kapitalmaßnahme ist selbst eine Satzungsänderung — deren Pflichten (Notar, Register) stecken schon im Ereignis „Kapitalmaßnahme“.
  for (const a of b.aenderungen ?? []) {
    if (a.merkmal === 'geschaeftsfuehrung') s.add('gf-wechsel');
    else if (a.merkmal === 'stammkapital') s.add('kapitalmassnahme');
    else if (a.merkmal === 'sitz') { s.add('satzungsaenderung'); s.add('sitz-anschrift'); }
    else s.add('satzungsaenderung');
  }
  return [...s];
}

/** Braucht der Beschluss eine Eintragung im Handelsregister? (Satzung, Kapital, Geschäftsführung, Sitz, Firmierung, Gegenstand.) */
export const braucheEintragung = (b: Pick<Beschluss, 'art' | 'aenderungen'>): boolean => ereignisseVon(b).length > 0;

/** Kann ein Beschluss überhaupt Folgen haben (Pflichten, Fassung, Cap-Table)? */
export const kannFolgenHaben = (b: Pick<Beschluss, 'art' | 'aenderungen'>): boolean => braucheEintragung(b) || (b.aenderungen?.length ?? 0) > 0 || b.art === 'kapitalmassnahme';

/** Nur so junge Beschlüsse bekommen ihre Folgen von selbst vorgeschlagen (Tage seit dem Beschlusstag). */
export const FOLGEN_TAGE = 90;
export const AELTER_HINWEIS = 'Älterer Beschluss — keine Folgen vorgeschlagen.';

/**
 * Schlägt MAKE OS die Folgen von sich aus vor? (rein, Entscheidung 10.10.: „alle historischen Beschlüsse werden nachgetragen — sonst eine Flut alter
 * Folgen“) Nur, wenn der Beschluss weder Entwurf noch aufgehoben ist und sein Datum höchstens `FOLGEN_TAGE` zurückliegt. Ältere (nachgetragene) Beschlüsse
 * bekommen Folgen nur, wenn eine Person ausdrücklich „Folgen vorschlagen“ anklickt — dieselbe Regel für Import und Handeingabe.
 */
export function folgenFaellig(b: Pick<Beschluss, 'datum' | 'status'>, heute: string): boolean {
  if (b.status === 'entwurf' || b.status === 'aufgehoben') return false;
  return tageZwischen(b.datum, heute) <= FOLGEN_TAGE;
}

/**
 * Vorbelegung des Formulars aus einem Dokument (rein): liegt das erkannte Datum mehr als `FOLGEN_TAGE` zurück, ist der Beschluss vermutlich längst
 * erledigt — eintragungspflichtige (Satzung, Kapital, Geschäftsführung …) stehen auf „eingetragen“, die übrigen auf „gefasst“; Folgen schlägt MAKE OS
 * dann nicht vor (`folgenFaellig`). Sonst „gefasst“.
 */
export function dokumentVorbelegung(v: { datum?: string; art?: BeschlussArt; aenderungen?: Beschluss['aenderungen'] }, heute: string): { status: BeschlussStatus; aelter: boolean; hinweis?: string } {
  if (!v.datum || tageZwischen(v.datum, heute) <= FOLGEN_TAGE) return { status: 'gefasst', aelter: false };
  return { status: braucheEintragung({ art: v.art ?? 'gesellschafterbeschluss', aenderungen: v.aenderungen }) ? 'eingetragen' : 'gefasst', aelter: true, hinweis: AELTER_HINWEIS };
}

/**
 * „Gültig ab“ einer Fassung aus dem Beschluss: Wirkung ab, sonst — bei satzungsrelevanten Merkmalen — der Tag der Eintragung (§ 54 Abs. 3 GmbHG),
 * sonst der Beschlusstag. Fehlt die Eintragung noch, gilt vorläufig der Beschlusstag (die Oberfläche sagt es).
 */
export function fassungAb(b: Pick<Beschluss, 'datum' | 'wirkungAb' | 'eingetragenAm'>, m: SatzungMerkmal): string {
  if (b.wirkungAb) return b.wirkungAb;
  return m !== 'geschaeftsfuehrung' && b.eingetragenAm ? b.eingetragenAm : b.datum;
}

/**
 * Die Folgen eines Beschlusses (rein) — nur Vorschläge, nichts geschieht ohne Klick:
 *   · Ereignis im Pflichten-Kalender (nur, wenn die Gesellschaft im Schild steht, das Ereignis für ihre Rechtsform gilt und der Beschluss noch
 *     nicht eingetragen ist) — mit den Pflichten, die daraus folgen (Handelsregister, Gesellschafterliste, Transparenzregister …);
 *   · je Änderung eine neue Fassung (falls es sie zu diesem Beschluss noch nicht gibt);
 *   · Cap-Table anpassen bei einer Kapitalmaßnahme.
 * Entwurf und aufgehoben: keine Folgen. `hinweise` = ganze Sätze für die Oberfläche (z. B. Rechtsform fehlt).
 */
export function beschlussFolgen(g: Pick<RegisterGesellschaft, 'fassungen'>, b: Beschluss, o: { kontext?: SchildKontext | null; ereignisseDa?: readonly { art: string; beschlussId?: string }[] } = {}): { folgen: BeschlussFolge[]; hinweise: string[] } {
  const folgen: BeschlussFolge[] = [];
  const hinweise: string[] = [];
  if (b.status === 'entwurf' || b.status === 'aufgehoben') return { folgen, hinweise };
  const s = (x: string) => `${b.id}:${x}`;
  if (b.status !== 'eingetragen') {
    for (const e of ereignisseVon(b)) {
      const def = ereignisDef(e);
      if (!def) continue;
      if (!o.kontext) { hinweise.push(`„${def.label}“: Die Pflichten (Handelsregister, Gesellschafterliste, Transparenzregister) führt das Schild nur für Gesellschaften im Bereich Business.`); continue; }
      if (!def.gilt(o.kontext)) { hinweise.push(`„${def.label}“: Die Pflichten gelten nur für GmbH bzw. UG — ist die Rechtsform im Steckbrief richtig eingetragen?`); continue; }
      if ((o.ereignisseDa ?? []).some(x => x.art === e && x.beschlussId === b.id)) continue;
      const pflichten = def.pflichten.map(p => `${p.titel} (${p.norm})`);
      folgen.push({
        schluessel: s(`ereignis:${e}`), art: 'ereignis', ereignis: e, pflichten,
        titel: `Pflichten anlegen: ${def.label} am ${tagText(b.datum)}`,
        text: `Ereignis „${def.label}“ im Pflichten-Kalender anlegen — daraus folgen mit Frist: ${pflichten.join(' · ')}.`,
      });
    }
  }
  for (const a of b.aenderungen ?? []) {
    if (aktiveEintraege(g.fassungen).some(f => f.beschlussId === b.id && f.merkmal === a.merkmal)) continue;
    if (a.merkmal !== 'satzung' && !a.text && a.cent === undefined) continue;
    const ab = fassungAb(b, a.merkmal);
    const wert = fassungWert({ merkmal: a.merkmal, text: a.text, cent: a.cent });
    folgen.push({
      schluessel: s(`fassung:${a.merkmal}`), art: 'fassung', merkmal: a.merkmal, ab,
      titel: `Neue Fassung: ${merkmalLabel(a.merkmal)} ab ${tagText(ab)}`,
      text: `${merkmalLabel(a.merkmal)} als neue Fassung ab ${tagText(ab)} festhalten${wert ? ` („${wert.length > 120 ? `${wert.slice(0, 119)}…` : wert}“)` : ''} — die bisherige bleibt in der Historie.`,
    });
    if (a.merkmal !== 'geschaeftsfuehrung' && !b.wirkungAb && !b.eingetragenAm) hinweise.push(`${merkmalLabel(a.merkmal)}: Eine Satzungsänderung wirkt erst mit der Eintragung (§ 54 Abs. 3 GmbHG) — wer erst nach der Eintragung freigibt, bekommt deren Tag als „gültig ab“.`);
  }
  if (b.art === 'kapitalmassnahme' || (b.aenderungen ?? []).some(a => a.merkmal === 'stammkapital')) {
    folgen.push({ schluessel: s('cap-table'), art: 'cap-table', titel: 'Cap-Table an den Beschluss anpassen', text: 'Aufgabe anlegen: Gesellschafter-Einträge (Nennbeträge, Einlagen, Ein- und Austritte) an die Kapitalmaßnahme anpassen — die Cap-Table rechnet daraus die Anteile.' });
  }
  return { folgen, hinweise };
}

// ── Offene Eintragungen (Recht-Check) ─────────────────────────────────────────────────────────────────────────────

/** Ab so vielen Tagen nach der Anmeldung fragt der Recht-Check nach der Eintragung. */
export const EINTRAGUNG_NACHFRAGEN_TAGE = 60;
export interface BeschlussOffen { gesellschaftId: GesellschaftId; gesellschaft: string; beschlussId: string; titel: string; nummer: string; status: 'gefasst' | 'angemeldet'; seit: string; tage: number; text: string }

/**
 * Beschlüsse ohne Anmeldung bzw. ohne Eintragung (rein): gefasst und eintragungspflichtig (Satzung, Kapital, Geschäftsführung, Sitz …), aber
 * noch nicht angemeldet; angemeldet seit mehr als `EINTRAGUNG_NACHFRAGEN_TAGE` Tagen, aber nicht eingetragen. Ohne Papierkorb.
 */
export function beschluesseOhneEintragung(alle: readonly RegisterGesellschaft[], heute: string): BeschlussOffen[] {
  const raus: BeschlussOffen[] = [];
  for (const g of alle) {
    if (g.geloeschtAm) continue;
    const nr = beschlussNummern(g.beschluesse);
    for (const b of aktiveEintraege(g.beschluesse)) {
      if (!braucheEintragung(b)) continue;
      const basis = { gesellschaftId: g.id, gesellschaft: anzeigeName(g), beschlussId: b.id, titel: b.titel, nummer: nummerText(nr.get(b.id)) };
      if (b.status === 'gefasst') {
        const tage = tageZwischen(b.datum, heute);
        raus.push({ ...basis, status: 'gefasst', seit: b.datum, tage, text: `Beschluss ${basis.nummer} „${b.titel}“ vom ${tagText(b.datum)} ist gefasst, aber noch nicht zum Handelsregister angemeldet` });
      } else if (b.status === 'angemeldet') {
        const seit = b.angemeldetAm ?? b.datum;
        const tage = tageZwischen(seit, heute);
        if (tage < EINTRAGUNG_NACHFRAGEN_TAGE) continue;
        raus.push({ ...basis, status: 'angemeldet', seit, tage, text: `Beschluss ${basis.nummer} „${b.titel}“: angemeldet am ${tagText(seit)}, die Eintragung steht seit ${tage} Tagen aus` });
      }
    }
  }
  return raus.sort((a, b) => a.seit.localeCompare(b.seit));
}

/** Für Anzeige und Test: wann der Recht-Check frühestens nach der Eintragung fragt. */
export const eintragungNachfragenAb = (angemeldetAm: string) => tagePlus(angemeldetAm, EINTRAGUNG_NACHFRAGEN_TAGE);

// ── Beteiligte und das Buch als Dokument (Oberfläche, PDF) ────────────────────────────────────────────────────────

/** Name eines Beteiligten (`gs-…`/`og-…`) über seinen Eintrag — `namen` = `art:id` → Name (aus der Antwort des Servers). */
export function beteiligtName(id: string, g: Pick<RegisterGesellschaft, 'gesellschafter' | 'organe'>, namen: Readonly<Record<string, string>>): string {
  const e = id.startsWith('gs-') ? (g.gesellschafter ?? []).find(x => x.id === id) : (g.organe ?? []).find(x => x.id === id);
  if (!e) return id.startsWith('gs-') ? 'Gesellschafter (gelöscht)' : 'Organ (gelöscht)';
  const n = namen[`${e.wer.art}:${e.wer.id}`];
  if (n) return n;
  return e.wer.id.includes('gelöscht') ? 'Eintrag (gelöscht)' : e.wer.art === 'gesellschaft' ? 'Gesellschaft' : e.wer.art === 'person' ? 'Person' : e.wer.art === 'firma' ? 'Firma' : 'Kontakt';
}

export interface BuchEintrag { kopf: string; titel: string; zeilen: string[] }
export interface BuchDokument { titel: string; untertitel: string; stand: string; hinweis: string; satzung: string[]; jahre: { jahr: number; eintraege: BuchEintrag[] }[] }

/**
 * Das Beschluss-Buch als Dokument (rein) — für Druck und PDF: Kopf, Gegenstand & Satzung (Stand am `heute`), dann je Jahr die Beschlüsse in
 * Reihenfolge mit Nummer, Datum, Art, Gremium, Status, Beteiligten, Abstimmung, Wirkung, Änderungen, Verweisen und dem Wortlaut.
 */
export function buchDokument(g: RegisterGesellschaft, namen: Readonly<Record<string, string>>, o: { heute: string; jahr?: number }): BuchDokument {
  const name = anzeigeName(g);
  const zeilen = buchListe(g.beschluesse, o.jahr !== undefined ? { jahr: o.jahr } : {});
  const jahre = new Map<number, BuchEintrag[]>();
  for (const { b, nr } of zeilen) {
    const j = jahrVon(b);
    const erg = abstimmungsErgebnis(b);
    const z = [
      `${artLabel(b.art)} · ${gremiumLabel(gremiumVon(b))} · ${statusLabelB(b.status)}${b.angemeldetAm ? ` · angemeldet ${tagText(b.angemeldetAm)}` : ''}${b.eingetragenAm ? ` · eingetragen ${tagText(b.eingetragenAm)}` : ''}`,
      ...(b.beteiligte?.length ? [`Beteiligte: ${b.beteiligte.map(x => beteiligtName(x, g, namen)).join(', ')}`] : []),
      ...(b.abstimmung?.length ? [`Abstimmung: ${b.abstimmung.map(s => `${beteiligtName(s.id, g, namen)} ${stimmeLabel(s.stimme)}`).join(' · ')}`, ...(erg ? [`Ergebnis: ${erg.text}`] : [])] : []),
      ...(b.wirkungAb ? [`Wirkung ab ${tagText(b.wirkungAb)}`] : []),
      ...(b.aenderungen ?? []).map(a => `Ändert: ${merkmalLabel(a.merkmal)}${fassungWert(a) ? ` — „${fassungWert(a)}“` : ''}`),
      ...(b.verweise ?? []).map(v => `Verweis: ${v.art === 'vertrag' ? `Vertrag „${(g.vertraege ?? []).find(x => x.id === v.id)?.titel ?? 'nicht mehr vorhanden'}“` : v.art === 'gesellschafter' ? `Gesellschafter ${beteiligtName(v.id, g, namen)}` : 'Risiko im Schild'}`),
      ...(b.dateiIds?.length ? [`Unterlagen in der Ablage: ${b.dateiIds.length}`] : []),
      ...(b.inhalt ? ['', ...b.inhalt.split('\n')] : []),
    ];
    if (!jahre.has(j)) jahre.set(j, []);
    jahre.get(j)!.push({ kopf: `${nr ? `${nummerText(nr)}${nr.abgeleitet ? ' (abgeleitet)' : ''}` : 'Entwurf'} · ${tagText(b.datum)}`, titel: b.titel, zeilen: z });
  }
  const satzung = standAm(g, o.heute, o.heute).filter(s => s.wert).map(s => `${merkmalLabel(s.merkmal)}: ${s.wert}${s.fassung ? ` (gültig ab ${tagText(s.fassung.ab)})` : ' (aus dem Steckbrief)'}`);
  return {
    titel: `Beschluss-Buch — ${name}`, untertitel: [g.firmierung && g.firmierung !== name ? g.firmierung : undefined, g.register].filter(Boolean).join(' · ') || name,
    stand: o.heute, hinweis: BESCHLUSS_HINWEIS, satzung,
    jahre: [...jahre.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, eintraege]) => ({ jahr, eintraege })),
  };
}
