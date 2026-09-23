// ─── MAKE OS — Finanz-Grundlage ─────────────────────────────────────────────
// Kevins Ansage: „Malins Dashboard als Finanzgrundlage nehmen — das sind die
// einzigen Zahlen, die du wirklich hast. Darauf möchte ich aufbauen, das ist
// die aktuellste gepflegte Version."
//
// Also: eine Wahrheit. Malins Dashboard führt das Kassenbuch, MAKE OS rechnet
// damit. Hier wird der Export gelesen und in eine Form gebracht, mit der das
// System arbeiten kann — ohne eine einzige Zahl zu erfinden.
//
// AUFBAU DES EXPORTS (die localStorage-Schlüssel des Dashboards):
//   b = Belege            { bel: [] }
//   p = Privat            { bank: [], sch: [], ein/aus/spar/var: [] }
//   s = Selbständigkeit   { invOut: [], fixk: [], vark: [], cfg: {} }
//   u = KD Management UG  { inv: [], fixk: [] }
//
// s.invOut ist trotz des Namens KEINE reine Rechnungsliste, sondern das
// Kassenbuch des Geschäftskontos. Der Typ trennt: ein = Umsatz, priv =
// Entnahme, fix/var = Kosten. Positionen ohne Typ werden NICHT stillschweigend
// einsortiert — sie landen sichtbar unter „eingeordnet" bzw. „offen".

export interface RohPosten {
  id?: string; dat?: string; typ?: string; kat?: string;
  kunde?: string; leistung?: string;
  br?: number; ne?: number; mwst_rate?: number;
}
export interface RohSchuld { id?: string; nm?: string; rs?: number; rt?: number; zi?: number; gl?: string }
export interface RohFixk { id?: string; nm?: string; kat?: string; ne?: number; vst?: number; tur?: string }
export interface RohUInv { id?: string; dat?: string; fae?: string; lie?: string; rg?: string; kat?: string; bes?: string; ne?: number; br?: number; st?: string; df?: string }
export interface RohBank { id?: string; dat?: string; nm?: string; bes?: string; bt?: number; kat?: string; typ?: string }
export interface RohCfg { mb?: number; ag?: number; fk?: number; kv?: number; hb?: number }

export interface MalinExport {
  b?: { bel?: unknown[] };
  p?: { bank?: RohBank[]; sch?: RohSchuld[]; ein?: unknown[]; aus?: unknown[]; spar?: unknown[]; var?: unknown[] };
  s?: { invOut?: RohPosten[]; fixk?: RohFixk[]; vark?: unknown[]; cfg?: RohCfg; mon?: unknown[] };
  u?: { inv?: RohUInv[]; fixk?: RohFixk[] };
}

/** Wie eine Position eingeordnet wurde — steht so auch in der Oberfläche. */
export type Herkunft = 'typ' | 'erkannt' | 'offen';

export interface Position {
  id: string;
  datum: string;
  wer: string;
  zweck: string;
  brutto: number;
  netto: number;
  kategorie: string;
  /** Warum diese Position dort steht, wo sie steht. */
  wie: Herkunft;
}

export interface Schuld { id: string; name: string; rest: number; rate: number; zins: number }
export interface Fixkosten { id: string; name: string; kategorie: string; netto: number; brutto: number; rhythmus: string }

export interface Grundlage {
  /** Stand des Exports — ab wann diese Zahlen gelten. */
  stand: string;
  umsatz: Position[];
  kosten: Position[];
  entnahmen: Position[];
  /** Ohne Typ und ohne erkennbares Muster — Kevin muss entscheiden. */
  offen: Position[];
  schulden: Schuld[];
  fixkosten: Fixkosten[];
  /** Bezahlte/offene Eingangsrechnungen der UG. */
  ugRechnungen: { id: string; datum: string; faellig: string; lieferant: string; zweck: string; netto: number; brutto: number; status: string }[];
  /** Privates Hauptkonto — Kontoauszug, nicht Betrieb. */
  privat: { id: string; datum: string; wer: string; zweck: string; betrag: number; kategorie: string }[];
  konfiguration: {
    malinBruttoMonat: number;
    agSatzProzent: number;
    fixkostenBetriebMonat: number;
    kvPvKevinMonat: number;
    gewerbesteuerHebesatz: number;
  };
}

const zahl = (v: unknown, sonst = 0) => { const n = Number(v); return Number.isFinite(n) ? n : sonst; };
const text = (v: unknown, sonst = '') => String(v ?? '').trim() || sonst;
const tag = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : '';

/**
 * Positionen ohne Typ: nur bei einem klaren Rechnungsmuster als Umsatz gelesen
 * (Beleg-Nummer im Text UND Netto = Brutto ÷ 1,19). Alles andere bleibt offen —
 * lieber eine Zeile, die Kevin einsortiert, als eine erfundene Einnahme.
 */
const RECHNUNG = /\b(invoice|inv[-\s.]?\d|rechnung|re[-\s.]?\d{3,})/i;
function riechtNachUmsatz(p: RohPosten): boolean {
  const br = zahl(p.br), ne = zahl(p.ne);
  if (br <= 0 || ne <= 0) return false;
  if (!RECHNUNG.test(`${p.leistung ?? ''} ${p.kat ?? ''}`)) return false;
  return Math.abs(ne - br / 1.19) < 0.05;   // 19 % USt sauber herausgerechnet
}

function position(p: RohPosten, i: number, wie: Herkunft): Position {
  const brutto = Math.abs(zahl(p.br));
  const netto = Math.abs(zahl(p.ne, brutto));
  return {
    id: text(p.id, `pos-${i}`),
    datum: tag(p.dat),
    wer: text(p.kunde, 'Ohne Namen'),
    zweck: text(p.leistung),
    brutto,
    netto,
    kategorie: text(p.kat, 'Ohne Kategorie'),
    wie,
  };
}

export function lesen(roh: MalinExport, stand: string): Grundlage {
  const buch = Array.isArray(roh.s?.invOut) ? roh.s!.invOut! : [];
  const umsatz: Position[] = [];
  const kosten: Position[] = [];
  const entnahmen: Position[] = [];
  const offen: Position[] = [];

  buch.forEach((p, i) => {
    const t = text(p.typ).toLowerCase();
    if (t === 'ein') umsatz.push(position(p, i, 'typ'));
    else if (t === 'priv') entnahmen.push(position(p, i, 'typ'));
    else if (t === 'fix' || t === 'var') kosten.push(position(p, i, 'typ'));
    else if (riechtNachUmsatz(p)) umsatz.push(position(p, i, 'erkannt'));
    else offen.push(position(p, i, 'offen'));
  });

  const nachDatum = (a: Position, b: Position) => a.datum.localeCompare(b.datum);
  umsatz.sort(nachDatum); kosten.sort(nachDatum); entnahmen.sort(nachDatum); offen.sort(nachDatum);

  const fixListe = [...(roh.u?.fixk ?? []), ...(roh.s?.fixk ?? [])];

  return {
    stand,
    umsatz, kosten, entnahmen, offen,
    schulden: (roh.p?.sch ?? []).map((s, i) => ({
      id: text(s.id, `sch-${i}`),
      name: text(s.nm, 'Ohne Namen'),
      rest: Math.abs(zahl(s.rs)),
      rate: Math.abs(zahl(s.rt)),
      zins: zahl(s.zi),
    })).filter(s => s.rest > 0 || s.rate > 0),
    fixkosten: fixListe.map((f, i) => {
      const netto = Math.abs(zahl(f.ne));
      return {
        id: text(f.id, `fix-${i}`),
        name: text(f.nm, 'Ohne Namen'),
        kategorie: text(f.kat, 'Ohne Kategorie'),
        netto,
        brutto: Math.round((netto + Math.abs(zahl(f.vst))) * 100) / 100,
        rhythmus: text(f.tur, 'monthly'),
      };
    }),
    ugRechnungen: (roh.u?.inv ?? []).map((r, i) => ({
      id: text(r.id, `uinv-${i}`),
      datum: tag(r.dat),
      faellig: tag(r.fae),
      lieferant: text(r.lie, 'Ohne Namen'),
      zweck: text(r.bes),
      netto: Math.abs(zahl(r.ne)),
      brutto: Math.abs(zahl(r.br)),
      status: text(r.st, 'offen'),
    })),
    privat: (roh.p?.bank ?? []).map((b, i) => {
      const betrag = Math.abs(zahl(b.bt));
      return {
        id: text(b.id, `bank-${i}`),
        datum: tag(b.dat),
        wer: text(b.nm, 'Ohne Namen'),
        zweck: text(b.bes),
        betrag: text(b.typ).toLowerCase() === 'ein' ? betrag : -betrag,
        kategorie: text(b.kat, 'Sonstiges'),
      };
    }),
    konfiguration: {
      malinBruttoMonat: zahl(roh.s?.cfg?.mb),
      agSatzProzent: zahl(roh.s?.cfg?.ag, 20),
      fixkostenBetriebMonat: zahl(roh.s?.cfg?.fk),
      kvPvKevinMonat: zahl(roh.s?.cfg?.kv),
      gewerbesteuerHebesatz: zahl(roh.s?.cfg?.hb, 410),
    },
  };
}

export interface Kennzahlen {
  umsatzBrutto: number; umsatzNetto: number;
  kostenBrutto: number; kostenNetto: number;
  entnahmen: number;
  /** Netto minus Netto — das, was der Betrieb wirklich erwirtschaftet hat. */
  ergebnisNetto: number;
  schuldenRest: number; schuldenRateMonat: number;
  fixkostenMonatBrutto: number;
  /** Vom ersten bis zum letzten Beleg — nicht ab Januar. */
  vonMonat: string; bisMonat: string; monate: number;
  umsatzProMonat: number;
  offeneLuecken: number;
}

export function kennzahlen(g: Grundlage): Kennzahlen {
  const summe = (ps: Position[], feld: 'brutto' | 'netto') => Math.round(ps.reduce((s, p) => s + p[feld], 0) * 100) / 100;
  const alleMonate = [...g.umsatz, ...g.kosten, ...g.entnahmen].map(p => p.datum.slice(0, 7)).filter(Boolean).sort();
  const von = alleMonate[0] ?? '';
  const bis = alleMonate[alleMonate.length - 1] ?? '';
  const monate = von && bis
    ? (Number(bis.slice(0, 4)) - Number(von.slice(0, 4))) * 12 + (Number(bis.slice(5, 7)) - Number(von.slice(5, 7))) + 1
    : 0;
  const umsatzNetto = summe(g.umsatz, 'netto');
  const kostenNetto = summe(g.kosten, 'netto');
  const monatlich = (f: Fixkosten) => f.rhythmus === 'yearly' ? f.brutto / 12 : f.rhythmus === 'quarterly' ? f.brutto / 3 : f.brutto;
  return {
    umsatzBrutto: summe(g.umsatz, 'brutto'),
    umsatzNetto,
    kostenBrutto: summe(g.kosten, 'brutto'),
    kostenNetto,
    entnahmen: summe(g.entnahmen, 'brutto'),
    ergebnisNetto: Math.round((umsatzNetto - kostenNetto) * 100) / 100,
    schuldenRest: Math.round(g.schulden.reduce((s, x) => s + x.rest, 0) * 100) / 100,
    schuldenRateMonat: Math.round(g.schulden.reduce((s, x) => s + x.rate, 0) * 100) / 100,
    fixkostenMonatBrutto: Math.round(g.fixkosten.reduce((s, f) => s + monatlich(f), 0) * 100) / 100,
    vonMonat: von, bisMonat: bis, monate,
    umsatzProMonat: monate ? Math.round((umsatzNetto / monate) * 100) / 100 : 0,
    offeneLuecken: g.offen.length,
  };
}

export interface MonatsZeile { monat: string; umsatzNetto: number; kostenNetto: number; entnahmen: number; ergebnis: number }

/** Monat für Monat, nur echte Monate — kein leerer Januar, der den Schnitt kaputtmacht. */
export function monatsBild(g: Grundlage): MonatsZeile[] {
  const m = new Map<string, MonatsZeile>();
  const hol = (d: string) => {
    const k = d.slice(0, 7);
    if (!k) return null;
    if (!m.has(k)) m.set(k, { monat: k, umsatzNetto: 0, kostenNetto: 0, entnahmen: 0, ergebnis: 0 });
    return m.get(k)!;
  };
  g.umsatz.forEach(p => { const z = hol(p.datum); if (z) z.umsatzNetto += p.netto; });
  g.kosten.forEach(p => { const z = hol(p.datum); if (z) z.kostenNetto += p.netto; });
  g.entnahmen.forEach(p => { const z = hol(p.datum); if (z) z.entnahmen += p.brutto; });
  return Array.from(m.values())
    .map(z => ({
      ...z,
      umsatzNetto: Math.round(z.umsatzNetto * 100) / 100,
      kostenNetto: Math.round(z.kostenNetto * 100) / 100,
      entnahmen: Math.round(z.entnahmen * 100) / 100,
      ergebnis: Math.round((z.umsatzNetto - z.kostenNetto) * 100) / 100,
    }))
    .sort((a, b) => a.monat.localeCompare(b.monat));
}

/** Kosten nach Kategorie — wohin der Betrieb sein Geld trägt. */
export function kostenNachKategorie(g: Grundlage): { kategorie: string; netto: number; anzahl: number }[] {
  const m = new Map<string, { netto: number; anzahl: number }>();
  g.kosten.forEach(p => {
    const k = p.kategorie || 'Ohne Kategorie';
    const v = m.get(k) ?? { netto: 0, anzahl: 0 };
    v.netto += p.netto; v.anzahl += 1;
    m.set(k, v);
  });
  return Array.from(m.entries())
    .map(([kategorie, v]) => ({ kategorie, netto: Math.round(v.netto * 100) / 100, anzahl: v.anzahl }))
    .sort((a, b) => b.netto - a.netto);
}

export const MONAT_KURZ = (m: string) =>
  ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][Number(m.slice(5, 7)) - 1] ?? m;
