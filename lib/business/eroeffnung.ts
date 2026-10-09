// ─── 0-Punkt (Eröffnung) je Business-Gesellschaft — rein, Server UND Browser (05.10.) ───────────────────────────────────────
// Kevin 05.10.: „Bring in Business einen 0-Punkt rein. Ich lade alles hoch an Zahlen.“ Entscheidung: Eröffnung mit Stichtag je
// Gesellschaft des Business-Bereichs (`BUSINESS_GESELLSCHAFTEN`, unsere Instanz: MAKE Innovation GmbH, KD Ventures): Stichtag +
// Anfangsbestand (Kontostand, offene Forderungen/Verbindlichkeiten). Ab dem Stichtag rechnet die Gesellschaft neu; alles davor bleibt
// gespeichert und sichtbar („vor dem 0-Punkt (archiviert)“), zählt aber nicht mehr. Nichts wird gelöscht.
//
// EINE Quelle: Bestand `business-eroeffnung` (`{ eintraege: Eroeffnung[] }`, Historie — jede Änderung ist ein neuer Eintrag, „Rückgängig“
// nimmt den jüngsten zurück, beides bleibt nachvollziehbar). Server: lib/business/eroeffnung-server.ts, Route /api/business/eroeffnung.
//
// EINE Wirkungsstelle: `abEroeffnung(bundle, geltende)` — wer Firmen-Konten oder Business-Posten summiert (Business-Index, Liquidität,
// Zahlen, Fluss, Head of Finance, Schilde …), zieht die Posten vorher hier durch. Ohne Eröffnung kommt der Bestand unverändert
// (dieselben Listen) zurück — bit-gleich wie vorher.
//
// Regeln je Posten (Firma aus `firmaId`, auch Altnamen; Posten ohne Firma oder einer Firma ohne Eröffnung bleiben wie bisher):
//   Rechnung       Datum = Rechnungsdatum, sonst Fälligkeit, sonst „bezahlt am“ — vor dem Stichtag → archiviert; ohne jedes Datum zählt sie.
//   Zahlung        Fälligkeit vor dem Stichtag → archiviert; ohne Fälligkeit zählt sie.
//   Planposten     einmalig mit `ab` vor dem Stichtag oder `bis` vor dem Stichtag → archiviert; laufende zählen ab dem Stichtag weiter.
//   Monatsabschluss Monat vor dem Stichtag-Monat → archiviert (der Stichtag-Monat zählt).
//   Buchung        Datum vor dem Stichtag → archiviert (Firma aus `ort`).
//   Merkposten     ohne Datum — zählen weiter.
//   Konto          Kontostand ab dem 0-Punkt = Anfangsbestand; ein später eingetragener Kontostand (Kontostand-Datum NACH dem Stichtag) löst
//                  ihn ab. Fehlt das Konto, entsteht es aus der Eröffnung.
//   Offene Posten  der Eröffnung erscheinen als offene Forderung (Rechnung „gestellt“) bzw. offene Verbindlichkeit (Zahlung „offen“) mit
//                  `eroeffnung: true` — sie zählen in Liquidität, „kommt rein / muss raus“, Überfälliges und Quick Ratio.

import { planMonat, type FinanzDaten } from '@/lib/finanzen/rechenkern';
import { BUSINESS_GESELLSCHAFTEN, finanzOrtAus, finanzOrtName, istBusinessGesellschaft, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';

export const EROEFFNUNG_BESTAND = 'business-eroeffnung';

/**
 * Ein offener Posten der Eröffnung: wer, wie viel (brutto), wann fällig — seit 09.10. (B9 b, L34) optional Rechnungsnummer, Rechnungsdatum und
 * „bezahlt am“: ein bezahlter Posten ist nicht mehr offen (zählt nirgends mehr; der Zahlungseingang steckt im nächsten Kontostand) und bleibt in der
 * Historie der Eröffnung sichtbar. Bezahlt markieren = neue Fassung (wie jede Änderung am 0-Punkt), „Rückgängig“ nimmt sie zurück.
 */
export interface OffenerPosten { name: string; betrag: number; faellig?: string; rechnungsnr?: string; datum?: string; bezahltAm?: string }

export interface Eroeffnung {
  /** `er-<uuid>` — jede Änderung bekommt einen neuen Eintrag. */
  id: string;
  firma: Gesellschaftskennung;
  /** JJJJ-MM-TT: ab diesem Tag rechnet die Gesellschaft neu. */
  stichtag: string;
  /** Anfangsbestand des Geschäftskontos am Stichtag (€, auf den Cent). */
  kontostand: number;
  forderungen?: OffenerPosten[];
  verbindlichkeiten?: OffenerPosten[];
  notiz?: string;
  gesetztVon: string;
  /** ISO-Zeitpunkt. */
  gesetztAm: string;
  /** „Rückgängig“: der Eintrag bleibt in der Historie, gilt aber nicht mehr (der vorige gilt wieder). */
  zurueckgenommenAm?: string;
  zurueckgenommenVon?: string;
}
export interface EroeffnungsBestand { eintraege: Eroeffnung[] }
/** Die geltende Eröffnung je Business-Gesellschaft (fehlt = keine Eröffnung, alles wie bisher). */
export type Geltende = Partial<Record<Gesellschaftskennung, Eroeffnung>>;

export const TAG = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MAX_OFFENE_POSTEN = 200;

/** Die geltende Eröffnung je Gesellschaft: der jüngste nicht zurückgenommene Eintrag — nur Business-Gesellschaften. */
export function geltendeEroeffnungen(eintraege: readonly Eroeffnung[] | null | undefined): Geltende {
  const raus: Geltende = {};
  for (const e of eintraege ?? []) {
    if (e.zurueckgenommenAm || !istBusinessGesellschaft(e.firma) || !TAG.test(e.stichtag)) continue;
    const alt = raus[e.firma];
    if (!alt || e.gesetztAm > alt.gesetztAm) raus[e.firma] = e;
  }
  return raus;
}

/** Die Historie einer Gesellschaft, jüngste zuerst. */
export const historieVon = (eintraege: readonly Eroeffnung[], firma: Gesellschaftskennung): Eroeffnung[] =>
  eintraege.filter(e => e.firma === firma).slice().sort((a, b) => b.gesetztAm.localeCompare(a.gesetztAm));

/** Gibt es überhaupt eine geltende Eröffnung? */
export const hatEroeffnung = (g: Geltende | null | undefined): boolean => !!g && Object.values(g).some(Boolean);

/** Die Gesellschaft eines Postens aus seiner `firmaId` (Kennung oder Altname) — nur, wenn sie eine geltende Eröffnung hat. */
export function eroeffnungVon(firmaId: string | null | undefined, g: Geltende): Eroeffnung | undefined {
  if (!firmaId) return undefined;
  const k = istGesellschaft(firmaId) ? firmaId : finanzOrtAus(firmaId);
  return k && k !== 'privat' ? g[k] : undefined;
}

/** Liegt ein Datum (JJJJ-MM-TT, auch längere ISO) vor dem 0-Punkt der Gesellschaft? Ohne Datum oder Eröffnung: nein. */
export function vorEroeffnung(datum: string | null | undefined, firmaId: string | null | undefined, g: Geltende): boolean {
  const e = eroeffnungVon(firmaId, g);
  return !!e && typeof datum === 'string' && datum.length >= 10 && datum.slice(0, 10) < e.stichtag;
}

// ── Datum je Posten-Art (eine Regel je Art, oben beschrieben) ─────────────────────────────────────────────────────────────────────
type RechnungArt = { firmaId?: string; datum?: string; faellig?: string; bezahltAm?: string };
type ZahlungArt = { firmaId?: string; faellig?: string };
type PlanpostenArt = { firmaId?: string; ab: string; bis?: string; rhythmus: string };
type AbschlussArt = { firma: string; monat: string };
type BuchungArt = { datum?: string; ort?: string };

export const rechnungDatum = (r: RechnungArt): string | undefined => r.datum || r.faellig || r.bezahltAm || undefined;
export const rechnungVor = (r: RechnungArt, g: Geltende): boolean => vorEroeffnung(rechnungDatum(r), r.firmaId, g);
export const zahlungVor = (z: ZahlungArt, g: Geltende): boolean => vorEroeffnung(z.faellig, z.firmaId, g);
export function planpostenVor(p: PlanpostenArt, g: Geltende): boolean {
  const e = eroeffnungVon(p.firmaId, g);
  if (!e) return false;
  if (p.bis && p.bis.slice(0, 10) < e.stichtag) return true;
  return p.rhythmus === 'einmalig' && typeof p.ab === 'string' && p.ab.slice(0, 10) < e.stichtag;
}
export function abschlussVor(a: AbschlussArt, g: Geltende): boolean {
  const e = eroeffnungVon(a.firma, g);
  return !!e && typeof a.monat === 'string' && a.monat < e.stichtag.slice(0, 7);
}
export const buchungVor = (b: BuchungArt, g: Geltende): boolean => vorEroeffnung(b.datum, b.ort, g);

/** Monat (JJJJ-MM), vor dem die Gesamt-Zahlen (Controlling, ohne Firma) nicht mehr zählen: nur wenn JEDE Business-Gesellschaft eröffnet ist — der früheste Stichtag-Monat. */
export function gesamtAbMonat(g: Geltende): string | null {
  if (!BUSINESS_GESELLSCHAFTEN.length || BUSINESS_GESELLSCHAFTEN.some(f => !g[f])) return null;
  return BUSINESS_GESELLSCHAFTEN.map(f => g[f]!.stichtag.slice(0, 7)).sort()[0];
}

// ── Konten ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
type KontoArt = { id: string; name?: string; kontostand?: number | null; stand?: string | null };

/** Woher der Kontostand ab dem 0-Punkt kommt. */
export type KontoQuelle = 'eroeffnung' | 'konto';
/** Gilt der Kontostand des Kontos (später eingetragen als der Stichtag) oder der Anfangsbestand der Eröffnung? */
export function kontoQuelle(f: KontoArt, e: Eroeffnung): KontoQuelle {
  return typeof f.kontostand === 'number' && Number.isFinite(f.kontostand) && typeof f.stand === 'string' && f.stand.slice(0, 10) > e.stichtag ? 'konto' : 'eroeffnung';
}

// ── Die eine Wirkungsstelle ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FinanzBundle<F extends KontoArt = KontoArt, R extends RechnungArt = RechnungArt, Z extends ZahlungArt = ZahlungArt, P extends PlanpostenArt = PlanpostenArt> {
  firmen?: F[];
  rechnungen?: R[];
  zahlungen?: Z[];
  planposten?: P[];
}
export interface Archiv<R, Z, P> { rechnungen: R[]; zahlungen: Z[]; planposten: P[] }
export type AbEroeffnung<B extends FinanzBundle> = B & {
  /** Was vor dem 0-Punkt liegt — gespeichert, sichtbar, aber nicht mehr gezählt. */
  archiv: Archiv<NonNullable<B['rechnungen']>[number], NonNullable<B['zahlungen']>[number], NonNullable<B['planposten']>[number]>;
};

/** Kennung eines offenen Postens der Eröffnung (Rechnung/Zahlung zum Anzeigen; nie gespeichert). */
export const offenerPostenKennung = (e: Eroeffnung, art: 'f' | 'v', i: number) => `${e.id}-${art}${i + 1}`;
/** Eine Kennung aus der Eröffnung (offene Forderung/Verbindlichkeit)? Links führen dann zur Eröffnung, nicht in die Rechnungsliste. */
export const istEroeffnungsKennung = (id: string | undefined | null): boolean => typeof id === 'string' && id.startsWith('er-');

/** Ist der Posten noch offen? Betrag größer 0 und nicht bezahlt (09.10., L34). */
export const postenOffen = (p: OffenerPosten): boolean => p.betrag > 0 && !p.bezahltAm;

/**
 * Die offenen Posten einer Eröffnung als Rechnungen (Forderungen) und Zahlungen (Verbindlichkeiten). Bezahlte fallen heraus (09.10.); die Kennung
 * zählt die Stelle in der ganzen Liste — ein bezahlter Posten verschiebt die Kennungen der übrigen nicht.
 */
export function offenePostenAls(e: Eroeffnung) {
  const name = finanzOrtName(e.firma);
  const offen = (l: OffenerPosten[] | undefined) => (l ?? []).map((p, i) => ({ p, i })).filter(x => postenOffen(x.p));
  return {
    rechnungen: offen(e.forderungen).map(({ p, i }) => ({
      id: offenerPostenKennung(e, 'f', i), firmaId: e.firma, kunde: p.name, titel: `Offene Forderung zum 0-Punkt (${name})`,
      betrag: p.betrag, status: 'gestellt' as const, ...(p.faellig ? { faellig: p.faellig } : {}), ...(p.rechnungsnr ? { nummer: p.rechnungsnr } : {}), eroeffnung: true as const,
    })),
    zahlungen: offen(e.verbindlichkeiten).map(({ p, i }) => ({
      id: offenerPostenKennung(e, 'v', i), firmaId: e.firma, an: p.name, titel: `Offene Verbindlichkeit zum 0-Punkt (${name})${p.rechnungsnr ? ` · ${p.rechnungsnr}` : ''}`,
      betrag: p.betrag, status: 'offen' as const, ...(p.faellig ? { faellig: p.faellig } : {}), eroeffnung: true as const,
    })),
  };
}

/**
 * Den Bestand ab dem 0-Punkt rechnen — DIE Hilfsfunktion für jede Stelle, die Firmen-Konten oder Business-Posten summiert.
 * Ohne geltende Eröffnung: dieselben Listen (gleiche Objekte), `archiv` leer — bit-gleich wie vorher.
 * Andere Felder des Bestands (Merkposten, Produkte …) bleiben unverändert.
 */
export function abEroeffnung<B extends FinanzBundle>(b: B, g: Geltende | null | undefined): AbEroeffnung<B> {
  type R = NonNullable<B['rechnungen']>[number]; type Z = NonNullable<B['zahlungen']>[number]; type P = NonNullable<B['planposten']>[number];
  const leer: Archiv<R, Z, P> = { rechnungen: [], zahlungen: [], planposten: [] };
  if (!g || !hatEroeffnung(g)) return { ...b, archiv: leer };
  const archiv = leer;
  const teile = <T>(l: T[] | undefined, vor: (x: T) => boolean, ziel: T[]): T[] | undefined => {
    if (!l) return l;
    const raus: T[] = [];
    for (const x of l) (vor(x) ? ziel : raus).push(x);
    return raus;
  };
  const geltend = Object.values(g).filter((e): e is Eroeffnung => !!e);
  const offen = geltend.map(offenePostenAls);
  // Konten: Anfangsbestand der Eröffnung, außer ein später eingetragener Kontostand löst ihn ab; fehlt das Konto, entsteht es.
  let firmen = b.firmen;
  if (firmen) {
    firmen = firmen.map(f => {
      const e = istGesellschaft(f.id) ? g[f.id] : undefined;
      return e && kontoQuelle(f, e) === 'eroeffnung' ? { ...f, kontostand: e.kontostand, stand: e.stichtag } : f;
    });
    for (const e of geltend) if (!firmen.some(f => f.id === e.firma)) firmen.push({ id: e.firma, name: finanzOrtName(e.firma), bank: '', kontostand: e.kontostand, stand: e.stichtag } as unknown as NonNullable<B['firmen']>[number]);
  }
  const rechnungen = teile(b.rechnungen as R[] | undefined, r => rechnungVor(r as RechnungArt, g), archiv.rechnungen as R[]);
  const zahlungen = teile(b.zahlungen as Z[] | undefined, z => zahlungVor(z as ZahlungArt, g), archiv.zahlungen as Z[]);
  const planposten = teile(b.planposten as P[] | undefined, p => planpostenVor(p as PlanpostenArt, g), archiv.planposten as P[]);
  return {
    ...b,
    ...(firmen ? { firmen } : {}),
    ...(rechnungen ? { rechnungen: [...rechnungen, ...offen.flatMap(o => o.rechnungen as unknown as R[])] } : {}),
    ...(zahlungen ? { zahlungen: [...zahlungen, ...offen.flatMap(o => o.zahlungen as unknown as Z[])] } : {}),
    ...(planposten ? { planposten } : {}),
    archiv,
  };
}

/** Zahl der archivierten Posten je Gesellschaft (Rechnungen, Zahlungen, Planposten, Abschlüsse, Buchungen) — für den Hinweis nach dem Speichern. */
export interface ArchivZahl { rechnungen: number; zahlungen: number; planposten: number; abschluesse: number; buchungen: number; gesamt: number }
export function archivZahlen(
  g: Geltende,
  q: { rechnungen?: RechnungArt[]; zahlungen?: ZahlungArt[]; planposten?: PlanpostenArt[]; abschluesse?: AbschlussArt[]; buchungen?: BuchungArt[] },
): Partial<Record<Gesellschaftskennung, ArchivZahl>> {
  const raus: Partial<Record<Gesellschaftskennung, ArchivZahl>> = {};
  for (const f of BUSINESS_GESELLSCHAFTEN) {
    if (!g[f]) continue;
    const nur = <T>(l: T[] | undefined, firma: (x: T) => string | undefined, vor: (x: T) => boolean) => (l ?? []).filter(x => eroeffnungVon(firma(x), g)?.firma === f && vor(x)).length;
    const z: ArchivZahl = {
      rechnungen: nur(q.rechnungen, r => r.firmaId, r => rechnungVor(r, g)),
      zahlungen: nur(q.zahlungen, x => x.firmaId, x => zahlungVor(x, g)),
      planposten: nur(q.planposten, p => p.firmaId, p => planpostenVor(p, g)),
      abschluesse: nur(q.abschluesse, a => a.firma, a => abschlussVor(a, g)),
      buchungen: nur(q.buchungen, b => b.ort, b => buchungVor(b, g)),
      gesamt: 0,
    };
    z.gesamt = z.rechnungen + z.zahlungen + z.planposten + z.abschluesse + z.buchungen;
    raus[f] = z;
  }
  return raus;
}

// ── Prüfen (Schreibweg) ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const cent = (n: number) => Math.round(n * 100) / 100;
const zahlAus = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  // „12.500,50“ und „12500.50“ — deutsche Schreibweise zuerst.
  const t = v.trim().replace(/\s|€/g, '');
  // „1.000“ ohne Komma = tausend (Tausenderpunkte), „12500.50“ = Dezimalpunkt.
  const n = Number(/,/.test(t) || /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
};
const GRENZE_BETRAG = 1e12;

function posten(roh: unknown, art: string): { ok: true; liste: OffenerPosten[] } | { ok: false; fehler: string } {
  if (roh == null) return { ok: true, liste: [] };
  if (!Array.isArray(roh)) return { ok: false, fehler: `${art}: Liste erwartet.` };
  if (roh.length > MAX_OFFENE_POSTEN) return { ok: false, fehler: `${art}: höchstens ${MAX_OFFENE_POSTEN} Zeilen.` };
  const liste: OffenerPosten[] = [];
  const tagFeld = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  for (const [i, x] of roh.entries()) {
    const o = (x ?? {}) as Record<string, unknown>;
    const name = String(o.name ?? '').trim().slice(0, 160);
    const betrag = zahlAus(o.betrag);
    const faellig = tagFeld(o.faellig), datum = tagFeld(o.datum), bezahltAm = tagFeld(o.bezahltAm);
    // Rechnungsnummer (09.10.): nie kürzen — zu lang ist ein Fehler.
    const rechnungsnr = typeof o.rechnungsnr === 'string' ? o.rechnungsnr.replace(/\s+/g, ' ').trim() : '';
    if (!name && betrag == null && !faellig && !rechnungsnr) continue; // leere Zeile
    if (!name) return { ok: false, fehler: `${art}, Zeile ${i + 1}: Name fehlt.` };
    if (betrag == null || betrag <= 0 || betrag > GRENZE_BETRAG) return { ok: false, fehler: `${art}, Zeile ${i + 1}: Betrag größer 0 eintragen.` };
    if (faellig && !TAG.test(faellig)) return { ok: false, fehler: `${art}, Zeile ${i + 1}: Fälligkeit als JJJJ-MM-TT.` };
    if (datum && !TAG.test(datum)) return { ok: false, fehler: `${art}, Zeile ${i + 1}: Rechnungsdatum als JJJJ-MM-TT.` };
    if (bezahltAm && !TAG.test(bezahltAm)) return { ok: false, fehler: `${art}, Zeile ${i + 1}: „bezahlt am“ als JJJJ-MM-TT.` };
    if (rechnungsnr.length > 60) return { ok: false, fehler: `${art}, Zeile ${i + 1}: Rechnungsnummer länger als 60 Zeichen.` };
    liste.push({ name, betrag: cent(betrag), ...(faellig ? { faellig } : {}), ...(rechnungsnr ? { rechnungsnr } : {}), ...(datum ? { datum } : {}), ...(bezahltAm ? { bezahltAm } : {}) });
  }
  return { ok: true, liste };
}

/** Eingabe des Schreibwegs prüfen (Firma, Stichtag, Kontostand, offene Posten, Notiz) — ohne Kennung/Zeit/Person. */
export function eroeffnungPruefen(roh: Record<string, unknown>):
  | { ok: true; daten: Pick<Eroeffnung, 'firma' | 'stichtag' | 'kontostand' | 'forderungen' | 'verbindlichkeiten' | 'notiz'> }
  | { ok: false; fehler: string } {
  if (!istBusinessGesellschaft(roh.firma)) return { ok: false, fehler: 'Gesellschaft fehlt' };
  const stichtag = typeof roh.stichtag === 'string' ? roh.stichtag.trim() : '';
  if (!TAG.test(stichtag)) return { ok: false, fehler: 'Stichtag als JJJJ-MM-TT eintragen.' };
  const kontostand = zahlAus(roh.kontostand);
  if (kontostand == null || Math.abs(kontostand) > GRENZE_BETRAG) return { ok: false, fehler: 'Kontostand als Zahl eintragen (auch 0 oder negativ).' };
  const f = posten(roh.forderungen, 'Offene Forderungen');
  if (!f.ok) return f;
  const v = posten(roh.verbindlichkeiten, 'Offene Verbindlichkeiten');
  if (!v.ok) return v;
  const notiz = typeof roh.notiz === 'string' ? roh.notiz.trim().slice(0, 500) : '';
  return { ok: true, daten: { firma: roh.firma, stichtag, kontostand: cent(kontostand), ...(f.liste.length ? { forderungen: f.liste } : {}), ...(v.liste.length ? { verbindlichkeiten: v.liste } : {}), ...(notiz ? { notiz } : {}) } };
}

// ── Finanzplanung ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Konten der Finanzplanung, die eine Eröffnung tragen können (Kern-Kennungen der Gesellschaften mit eigener Kontoachse). */
const PLAN_KONTEN = ['ug', 'kdv'] as const;

/**
 * Kontostand-Startwert der Finanzplanung je Gesellschaft aus der Eröffnung (`FinanzDaten.eroeffnung`, nie gespeichert): Plan-Monat des Stichtags
 * (1 = Okt 26; ein Stichtag vor dem Plan → Monat 1, einer nach dem Plan → keiner) und der Anfangsbestand. Nur Business-Gesellschaften.
 */
export function kontoStartFuerPlan(g: Geltende | null | undefined, planMonate: number): FinanzDaten['eroeffnung'] | undefined {
  if (!g) return undefined;
  const raus: NonNullable<FinanzDaten['eroeffnung']> = {};
  for (const k of PLAN_KONTEN) {
    const e = g[k];
    if (!e || !istBusinessGesellschaft(k)) continue;
    const monat = Math.max(1, planMonat(e.stichtag));
    if (monat > planMonate) continue;
    raus[k] = { monat, betrag: e.kontostand, stichtag: e.stichtag };
  }
  return Object.keys(raus).length ? raus : undefined;
}
