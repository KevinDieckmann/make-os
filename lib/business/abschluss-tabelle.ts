// ─── Monatsabschluss als Tabelle — Einfügen aus Excel oder BWA-CSV (09.10., rein: Server UND Browser) ───────────────────────────────
// ONBOARDING_PLAN.md › B9 a / L7 / 3.7: bei einem Stichtag 01.01. sind es 9 Monate × 2 Gesellschaften × 10 Felder — Formular für Formular
// nicht zumutbar. Hier: mehrere Monate auf einmal aus der Zwischenablage (Excel: Monate in Zeilen ODER in Spalten) oder einer BWA-CSV
// (Zeilen = Positionen/Konten, Spalten = Monate, Vorspann darüber). Zuordnung Position → Feld des Abschlusses mit Vorschlag aus bekannten
// BWA-Bezeichnungen (nur Begriffe, keine Daten); mehrere Positionen auf ein Feld = Summe.
//
// Regeln (eine Stelle):
//   • Geschrieben wird NUR über den vorhandenen Weg `speichereAbschluss` (lib/business/speicher.ts) — je Monat, je Bereich (Business-Index bzw.
//     Privat › Selbstständigkeit über /api/privat/abschluss). Server: lib/business/abschluss-tabelle-server.ts.
//   • Leere Zellen ändern nichts (anders als im Formular, wo „leer“ ein Feld entfernt) — eine Einfügung löscht nie.
//   • Kosten mit Minus (manche BWA zeigen Aufwand negativ) werden als Betrag übernommen (Hinweis); Eigenkapital darf negativ sein.
//   • Monat in der Zukunft → Fehler (wie im Formular); derselbe Monat zweimal → Fehler.
//   • Vorschau zeigt je Monat neu · geändert · gleich mit den Werten alt → neu; `basis` = Stand der betroffenen Monate (sonst 409).
//   • Rückgängig: der Lauf hält NUR Gesellschaft, Monate, Feldnamen und alte/neue Werte (Zahlen der Gesellschaften, keine Personen) — er stellt
//     die alten Werte nur dort wieder her, wo seitdem niemand etwas geändert hat (`rueckPlan`).

import { kurzHash } from '@/lib/finanzen/kontoauszug/text';
import type { Monatsabschluss } from './messen';
import type { Bereich, Gesellschaftskennung } from '@/lib/einheiten';
import {
  centSumme, monatAus, monatLang, namensSchluessel, transponieren, zahlformatVon, zuordnungVorschlag,
  type Aufbereitet, type CsvZeile, type Datensatz, type FeldDef, type VorschauZeile,
} from '@/lib/tabelle/einfuegen';

/** Die Zahlenfelder eines Monatsabschlusses — EINE Liste (lib/business/speicher.ts reicht sie weiter). */
export const ABSCHLUSS_FELDER = ['umsatz', 'kosten', 'personal', 'marketingVertrieb', 'afa', 'fakturierteTage', 'eigenkapital', 'bilanzsumme', 'kurzfrVerbindlichkeiten', 'bankschulden'] as const;
export type AbschlussFeld = typeof ABSCHLUSS_FELDER[number];

/** Aufwand: steht er negativ in der BWA, zählt der Betrag. */
const AUFWAND: readonly AbschlussFeld[] = ['kosten', 'personal', 'marketingVertrieb', 'afa'];

/** Felder mit bekannten BWA-/Excel-Bezeichnungen (nur Begriffe). Alle Zahlenfelder sind Summen-Felder (mehrere Positionen = Summe). */
export const ABSCHLUSS_TABELLE_FELDER: readonly (FeldDef & { id: AbschlussFeld; tage?: true })[] = [
  { id: 'umsatz', label: 'Umsatz (netto)', summe: true, hilfe: 'BWA: Umsatzerlöse',
    namen: ['umsatzerlöse', 'umsatz', 'umsatz netto', 'umsatz (netto)', 'erlöse', 'nettoumsatz', 'umsatzerlöse netto'], enthaelt: ['umsatzerlös'], nicht: ['steuer', 'kumuliert'] },
  { id: 'kosten', label: 'Kosten gesamt (netto)', summe: true, hilfe: 'BWA: Gesamtkosten',
    namen: ['gesamtkosten', 'kosten gesamt', 'summe kosten', 'kosten', 'gesamte kosten', 'kosten (netto)', 'kosten gesamt (netto)', 'summe aufwand', 'aufwand gesamt'] },
  { id: 'personal', label: 'davon Personal', summe: true, hilfe: 'Löhne, Gehälter, Sozialabgaben',
    namen: ['personalkosten', 'personal', 'personalaufwand', 'löhne und gehälter', 'löhne/gehälter', 'davon personal'], enthaelt: ['personalkost', 'personalaufw'] },
  { id: 'marketingVertrieb', label: 'davon Marketing & Vertrieb', summe: true, hilfe: 'Werbung, Events, Vertriebskosten',
    namen: ['werbe-/reisekosten', 'werbe- und reisekosten', 'werbekosten', 'marketing', 'marketing & vertrieb', 'marketing und vertrieb', 'vertriebskosten', 'werbung', 'davon marketing & vertrieb'],
    enthaelt: ['werbekost', 'marketing', 'vertriebskost'] },
  { id: 'afa', label: 'Abschreibungen', summe: true, hilfe: 'BWA: AfA', namen: ['abschreibungen', 'afa', 'abschreibung'], enthaelt: ['abschreibung'] },
  { id: 'fakturierteTage', label: 'Fakturierte Beratertage', summe: true, tage: true, hilfe: 'abgerechnete Tage',
    namen: ['fakturierte tage', 'fakturierte beratertage', 'beratertage', 'tage', 'abgerechnete tage', 'projekttage'], enthaelt: ['beratertag', 'fakturierte tage'] },
  { id: 'eigenkapital', label: 'Eigenkapital', summe: true, hilfe: 'Bilanz / BWA-Vermögensteil', namen: ['eigenkapital'], enthaelt: ['eigenkapital'], nicht: ['quote', 'rentab', 'rendite'] },
  { id: 'bilanzsumme', label: 'Bilanzsumme', summe: true, hilfe: 'Summe Aktiva', namen: ['bilanzsumme', 'summe aktiva', 'aktiva'], enthaelt: ['bilanzsumme'] },
  { id: 'kurzfrVerbindlichkeiten', label: 'Kurzfr. Verbindlichkeiten', summe: true, hilfe: 'fällig innerhalb 12 Monaten',
    namen: ['kurzfristige verbindlichkeiten', 'kurzfr. verbindlichkeiten', 'kurzfr verbindlichkeiten', 'verbindlichkeiten kurzfristig', 'verbindlichkeiten (kurzfristig)'], enthaelt: ['kurzfr'] },
  { id: 'bankschulden', label: 'Bankschulden', summe: true, hilfe: 'Darlehen, Kontokorrent',
    namen: ['bankschulden', 'verbindlichkeiten gegenüber kreditinstituten', 'verbindlichkeiten ggü. kreditinstituten', 'bankverbindlichkeiten', 'darlehen', 'kontokorrent'],
    enthaelt: ['kreditinstitut', 'bankverbindl', 'bankschuld'] },
];
const FELD_LABEL = Object.fromEntries(ABSCHLUSS_TABELLE_FELDER.map(f => [f.id, f.label])) as Record<AbschlussFeld, string>;
export const abschlussFeldName = (f: AbschlussFeld): string => FELD_LABEL[f] ?? f;

// ── Aufbereiten: wo stehen die Monate? ───────────────────────────────────────────────────────────────────────────────────────────

export type Ausrichtung = 'monate-in-spalten' | 'monate-in-zeilen';

/** Wie viele Monate stehen in Zeile i bzw. Spalte s? */
const monateInZeile = (z: CsvZeile) => z.zellen.filter(c => !!monatAus(c)).length;

/** Ausrichtung erkennen: die Zeile mit den meisten Monaten (BWA: Kopfzeile) gegen die Spalte mit den meisten Monaten (Excel: Monat je Zeile). */
export function ausrichtungErkennen(zeilen: readonly CsvZeile[]): Ausrichtung | null {
  const inZeile = Math.max(0, ...zeilen.slice(0, 60).map(monateInZeile));
  const inSpalte = Math.max(0, ...transponieren(zeilen).map(monateInZeile));
  if (!inZeile && !inSpalte) return null;
  return inZeile >= inSpalte ? 'monate-in-spalten' : 'monate-in-zeilen';
}

/**
 * Aufbereiten: Datensatz = Monat, Quelle = Position (BWA-Zeile bzw. Excel-Spalte). Monate in Spalten (BWA): die Kopfzeile ist die Zeile mit den
 * meisten Monaten; alles darüber ist Vorspann; Spalten ohne Monat („Summe“, „kumuliert“, „%“) werden übersprungen. Monate in Zeilen (Excel):
 * erst transponieren — dann gilt dieselbe Regel.
 */
export function abschlussAufbereiten(zeilen: readonly CsvZeile[], wunsch?: Ausrichtung): Aufbereitet & { ausrichtung: Ausrichtung | null } {
  const ausrichtung = wunsch ?? ausrichtungErkennen(zeilen);
  const hinweise: string[] = [];
  if (!ausrichtung) return { ausrichtung: null, quellen: [], datensaetze: [], vorschlag: [], hinweise: ['Keine Monate erkannt — die Tabelle braucht eine Zeile oder Spalte mit Monaten (z. B. „Jan 2026“, „01/2026“ oder „2026-01“).'] };
  const t = ausrichtung === 'monate-in-spalten' ? [...zeilen] : transponieren(zeilen);
  let k = 0, best = -1;
  t.slice(0, 60).forEach((z, i) => { const n = monateInZeile(z); if (n > best) { best = n; k = i; } });
  const kopf = t[k]?.zellen ?? [];
  const spalten = kopf.map((c, s) => ({ s, monat: monatAus(c), text: c.trim() }));
  const monatsSpalten = spalten.filter(x => x.monat);
  const ohne = spalten.filter(x => !x.monat && x.text && t.slice(k + 1).some(z => (z.zellen[x.s] ?? '').trim()) && x.s > 0);
  if (ausrichtung === 'monate-in-spalten' && k > 0) hinweise.push(`Die ersten ${k} Zeile${k === 1 ? '' : 'n'} (Vorspann) sind übersprungen — die Monate stehen in Zeile ${t[k].zeile}.`);
  // Spalten mit Text, der kein Monat ist (Summe, kumuliert, Vorjahr, %): übersprungen — nie raten. Die erste Spalte trägt die Bezeichnungen.
  const textSpalten = new Set(ohne.filter(x => t.slice(k + 1).some(z => /\d/.test(z.zellen[x.s] ?? ''))).map(x => x.s));
  if (textSpalten.size) hinweise.push(`${textSpalten.size} ${textSpalten.size === 1 ? 'Spalte ohne Monat ist' : 'Spalten ohne Monat sind'} übersprungen (${Array.from(textSpalten).slice(0, 4).map(s => `„${kopf[s].trim()}“`).join(', ')}${textSpalten.size > 4 ? ' …' : ''}).`);
  // Positionen: Zeilen unter der Kopfzeile mit einer Bezeichnung (erster Text, der weder Monat noch Zahl ist) und mindestens einem Wert in einer Monatsspalte.
  const quellen: { label: string; beispiel: string; zeile: CsvZeile }[] = [];
  const gesehen = new Map<string, number>();
  for (const z of t.slice(k + 1)) {
    const werte = monatsSpalten.map(m => (z.zellen[m.s] ?? '').trim());
    if (!werte.some(Boolean)) continue;
    const bez = z.zellen.find((c, s) => !monatsSpalten.some(m => m.s === s) && c.trim() && !/^[-+]?[\d.,\s€%]+$/.test(c.trim()))?.trim()
      ?? (ausrichtung === 'monate-in-zeilen' ? `Spalte ${z.zeile}` : `Zeile ${z.zeile}`);
    // Doppelte Bezeichnungen (z. B. „sonstige“ in zwei Blöcken) bleiben unterscheidbar.
    const n = (gesehen.get(bez) ?? 0) + 1; gesehen.set(bez, n);
    quellen.push({ label: n > 1 ? `${bez} (${ausrichtung === 'monate-in-zeilen' ? 'Spalte' : 'Zeile'} ${z.zeile})` : bez, beispiel: werte.find(Boolean) ?? '', zeile: z });
  }
  // Doppelte Monate in der Kopfzeile: nur der erste zählt (der zweite ist meist „Vorjahr“ mit falscher Beschriftung) — sichtbar gemeldet.
  const monatGesehen = new Set<string>();
  const datensaetze: Aufbereitet['datensaetze'] = [];
  for (const m of monatsSpalten) {
    if (monatGesehen.has(m.monat!)) { hinweise.push(`${monatLang(m.monat!)} steht zweimal in der Kopfzeile — nur die erste Spalte zählt.`); continue; }
    monatGesehen.add(m.monat!);
    const wo = ausrichtung === 'monate-in-zeilen' ? `Zeile ${zeilen[m.s]?.zeile ?? m.s + 1}` : `Spalte ${m.s + 1}`;
    datensaetze.push({ quelle: `${monatLang(m.monat!)} (${wo})`, schluessel: m.monat!, zellen: quellen.map(q => q.zeile.zellen[m.s] ?? '') });
  }
  if (!datensaetze.length) hinweise.push('Keine Monate erkannt — die Tabelle braucht eine Zeile oder Spalte mit Monaten (z. B. „Jan 2026“, „01/2026“ oder „2026-01“).');
  return {
    ausrichtung, hinweise, datensaetze,
    quellen: quellen.map(q => ({ label: q.label, beispiel: q.beispiel })),
    vorschlag: zuordnungVorschlag(quellen.map(q => q.label), ABSCHLUSS_TABELLE_FELDER),
  };
}

// ── Prüfen und rechnen (Server) ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface AbschlussEingabe { monat: string; quelle: string; werte: Partial<Record<AbschlussFeld, number>> }
export interface ZeilenFehler { quelle: string; schluessel: string; text: string }

/** Datensätze → Monatswerte (Euro bzw. Tage auf zwei Stellen). Fehler je Datensatz, nie geraten. `heute` = Berliner Tag. */
export function abschlussEingaben(ds: readonly Datensatz[], heute: string): { eingaben: AbschlussEingabe[]; fehler: ZeilenFehler[]; hinweise: string[] } {
  const format = zahlformatVon(ds, [...ABSCHLUSS_FELDER]);
  const eingaben: AbschlussEingabe[] = [], fehler: ZeilenFehler[] = [], hinweise: string[] = [];
  const monate = new Set<string>();
  let negativ = 0;
  for (const [i, d] of ds.entries()) {
    const monat = d.schluessel && /^\d{4}-(0[1-9]|1[0-2])$/.test(d.schluessel) ? d.schluessel : monatAus(d.schluessel ?? '');
    const schluessel = monat ?? `z${i}`;
    if (!monat) { fehler.push({ quelle: d.quelle, schluessel, text: 'Kein Monat erkannt.' }); continue; }
    if (monat > heute.slice(0, 7)) { fehler.push({ quelle: d.quelle, schluessel, text: `${monatLang(monat)} liegt in der Zukunft — ein Abschluss für die Zukunft geht nicht.` }); continue; }
    if (monate.has(monat)) { fehler.push({ quelle: d.quelle, schluessel: `${monat}#${i}`, text: `${monatLang(monat)} kommt zweimal vor — bitte nur einmal einfügen.` }); continue; }
    monate.add(monat);
    const werte: Partial<Record<AbschlussFeld, number>> = {};
    let kaputt: string | null = null;
    for (const f of ABSCHLUSS_FELDER) {
      const r = centSumme(d.werte[f], format);
      if ('fehler' in r) { kaputt = `„${r.fehler.slice(0, 40)}“ ist keine Zahl (${abschlussFeldName(f)}).`; break; }
      if (r.cent === null) continue;
      let c = r.cent;
      if (c < 0 && AUFWAND.includes(f)) { c = -c; negativ++; }
      if (Math.abs(c) > 1e14) { kaputt = `${abschlussFeldName(f)}: Betrag zu groß.`; break; }
      werte[f] = c / 100;
    }
    if (kaputt) { fehler.push({ quelle: d.quelle, schluessel, text: kaputt }); continue; }
    if (!Object.keys(werte).length) continue;
    eingaben.push({ monat, quelle: d.quelle, werte });
  }
  if (negativ) hinweise.push(`${negativ} Kostenwert${negativ === 1 ? '' : 'e'} mit Minuszeichen als Betrag übernommen (Kosten zählen positiv).`);
  return { eingaben: eingaben.sort((a, b) => a.monat.localeCompare(b.monat)), fehler, hinweise };
}

export interface AbschlussPlanZeile { monat: string; quelle: string; status: 'neu' | 'geaendert' | 'gleich'; aenderungen: { feld: AbschlussFeld; alt: number | null; neu: number }[] }

/** Kennung des Stands der betroffenen Monate einer Gesellschaft (rein — Werte, Notiz, Zeitpunkt). Weicht er beim Übernehmen ab: 409. */
export function abschlussBasis(firma: string, monate: readonly string[], bestehende: readonly Monatsabschluss[]): string {
  const teile = [...monate].sort().map(m => {
    const e = bestehende.find(x => x.firma === firma && x.monat === m);
    return e ? [m, ...ABSCHLUSS_FELDER.map(f => e[f] ?? null), e.notiz ?? null, e.am ?? null] : [m, null];
  });
  return `ab-${kurzHash(JSON.stringify([firma, teile]))}`;
}

/** Vorschau: je Monat neu (gab es nicht) · geändert (mind. ein Feld anders) · gleich. Nur die eingefügten Felder zählen. */
export function abschlussPlan(eingaben: readonly AbschlussEingabe[], bestehende: readonly Monatsabschluss[], firma: Gesellschaftskennung): AbschlussPlanZeile[] {
  return eingaben.map(e => {
    const alt = bestehende.find(x => x.firma === firma && x.monat === e.monat);
    const aenderungen = (Object.keys(e.werte) as AbschlussFeld[])
      .map(f => ({ feld: f, alt: typeof alt?.[f] === 'number' ? alt[f] as number : null, neu: e.werte[f]! }))
      .filter(a => a.alt === null || Math.round(a.alt * 100) !== Math.round(a.neu * 100));
    return { monat: e.monat, quelle: e.quelle, status: !alt ? 'neu' : aenderungen.length ? 'geaendert' : 'gleich', aenderungen };
  });
}

const zahlText = (n: number | null, f: AbschlussFeld) => (n === null ? '—' : `${n.toLocaleString('de-DE', { minimumFractionDigits: f === 'fakturierteTage' ? 0 : 2, maximumFractionDigits: 2 })}${f === 'fakturierteTage' ? ' Tage' : ' €'}`);

/** Vorschau in der gemeinsamen Form (Oberfläche): je Monat eine Zeile, Fehler mit Grund. */
export function abschlussVorschauZeilen(plan: readonly AbschlussPlanZeile[], fehler: readonly ZeilenFehler[]): VorschauZeile[] {
  return [
    ...plan.map(p => ({
      schluessel: p.monat, quelle: p.quelle, titel: monatLang(p.monat), status: p.status,
      ...(p.status === 'gleich' ? { text: 'schon so eingetragen' } : {}),
      aenderungen: p.aenderungen.map(a => ({ feld: abschlussFeldName(a.feld), ...(a.alt !== null ? { alt: zahlText(a.alt, a.feld) } : {}), neu: zahlText(a.neu, a.feld) })),
    })),
    ...fehler.map(f => ({ schluessel: f.schluessel, quelle: f.quelle, titel: f.quelle, status: 'fehler' as const, text: f.text })),
  ];
}

// ── Lauf-Protokoll und Rückgängig ────────────────────────────────────────────────────────────────────────────────────────────────

export type LaufStatus = 'laeuft' | 'uebernommen' | 'zurueckgenommen' | 'teilweise';
export interface AbschlussLauf {
  /** `al-<uuid>` */
  id: string;
  bereich: Bereich;
  firma: Gesellschaftskennung;
  /** ISO-Zeitpunkt. */
  am: string;
  status: LaufStatus;
  /** Je Monat: gab es ihn vorher (`neu` = nein), und je Feld alter und neuer Wert. */
  monate: { monat: string; neu: boolean; felder: { feld: AbschlussFeld; alt: number | null; neu: number }[] }[];
  zurueck?: { am: string; zurueck: number; konflikte: number; schonZurueck: number };
}

/** Den Lauf aus dem Plan bauen (nur neu/geändert und nur die gewählten Monate). */
export function laufAusPlan(id: string, bereich: Bereich, firma: Gesellschaftskennung, am: string, plan: readonly AbschlussPlanZeile[]): AbschlussLauf {
  return {
    id, bereich, firma, am, status: 'laeuft',
    monate: plan.filter(p => p.status !== 'gleich').map(p => ({ monat: p.monat, neu: p.status === 'neu', felder: p.aenderungen.map(a => ({ feld: a.feld, alt: a.alt, neu: a.neu })) })),
  };
}

export type RueckAktion = { art: 'loeschen'; monat: string } | { art: 'setzen'; monat: string; werte: Partial<Record<AbschlussFeld, number | null>> };

const gleichCent = (a: unknown, b: number | null) => (b === null ? a === undefined || a === null : typeof a === 'number' && Math.round(a * 100) === Math.round(b * 100));

/**
 * Was „Rückgängig“ tun darf: je Monat nur, wenn seitdem niemand die eingefügten Felder geändert hat (alle stehen noch auf „neu“). Ein Monat, den der
 * Lauf angelegt hat, wird nur gelöscht, wenn außer den eingefügten Feldern nichts dazukam (sonst Konflikt — bleibt stehen). Stehen alle Felder schon
 * wieder auf „alt“: zählt als „schon zurück“.
 */
export function rueckPlan(lauf: AbschlussLauf, bestehende: readonly Monatsabschluss[]): { aktionen: RueckAktion[]; konflikte: string[]; schon: number } {
  const aktionen: RueckAktion[] = [], konflikte: string[] = [];
  let schon = 0;
  for (const m of lauf.monate) {
    const e = bestehende.find(x => x.firma === lauf.firma && x.monat === m.monat);
    const stehtNeu = !!e && m.felder.every(f => gleichCent(e[f.feld], f.neu));
    const stehtAlt = m.felder.every(f => gleichCent(e?.[f.feld], f.alt));
    if (stehtAlt) { schon++; continue; }
    if (!stehtNeu) { konflikte.push(m.monat); continue; }
    if (m.neu) {
      const eingefuegt = new Set(m.felder.map(f => f.feld));
      const mehr = ABSCHLUSS_FELDER.some(f => !eingefuegt.has(f) && typeof e![f] === 'number') || !!e!.notiz;
      if (mehr) { konflikte.push(m.monat); continue; }
      aktionen.push({ art: 'loeschen', monat: m.monat });
    } else {
      aktionen.push({ art: 'setzen', monat: m.monat, werte: Object.fromEntries(m.felder.map(f => [f.feld, f.alt])) });
    }
  }
  return { aktionen, konflikte, schon };
}

/** Kurzform eines Laufs für die Oberfläche (keine Werte). */
export interface LaufKurz { id: string; firma: Gesellschaftskennung; am: string; status: LaufStatus; monate: number; von: string; bis: string }
export const laufKurz = (l: AbschlussLauf): LaufKurz => {
  const ms = l.monate.map(m => m.monat).sort();
  return { id: l.id, firma: l.firma, am: l.am, status: l.status, monate: ms.length, von: ms[0] ?? '', bis: ms[ms.length - 1] ?? '' };
};

/** Für Tests und Doku: die Position einer BWA-Zeile auf ein Feld (oder null) — dieselbe Regel wie der Vorschlag. */
export const feldFuerPosition = (bezeichnung: string): AbschlussFeld | null =>
  (zuordnungVorschlag([bezeichnung], ABSCHLUSS_TABELLE_FELDER)[0] as AbschlussFeld | null) ?? null;
export { namensSchluessel };
