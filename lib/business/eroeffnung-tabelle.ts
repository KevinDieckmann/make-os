// ─── 0-Punkt: offene Posten als Tabelle einfügen + „bezahlt am“ (09.10., rein: Server UND Browser) ─────────────────────────────────
// ONBOARDING_PLAN.md › B9 b / 3.6 / L34: alle am Stichtag offenen Forderungen und Verbindlichkeiten (OP-Liste vom Steuerberater, Excel) auf einmal —
// Kunde/Lieferant, Rechnungsnr., Datum, Betrag brutto, fällig (optional „bezahlt am“). Übernahme = NEUE FASSUNG der Eröffnung über den vorhandenen
// Schreibweg (`speichereEroeffnung`, Historie bleibt, Stand = Kennung der geltenden Fassung → 409); „Rückgängig“ = das vorhandene Zurücknehmen.
//
// Regeln (eine Stelle):
//   • Ergänzen (Vorgabe): vorhandene Posten bleiben; ein eingefügter Posten mit derselben Rechnungsnummer (bzw. ohne Nummer: gleicher Name + Betrag +
//     Datum) ist „gleich“ oder „geändert“, sonst „neu“. Ersetzen: die Liste wird die eingefügte — was nicht mehr vorkommt, „entfällt“ (Vorschau).
//   • Leere Zellen ändern an einem vorhandenen Posten nichts. Beträge als Betrag (Kreditoren-Listen zeigen sie oft negativ — Hinweis).
//   • Höchstens `MAX_OFFENE_POSTEN` je Liste (sonst Fehler, nie gekürzt).

import { betragCent, datumAus, textGlaetten, vergleichsText } from '@/lib/finanzen/kontoauszug/text';
import { MAX_OFFENE_POSTEN, type Eroeffnung, type OffenerPosten } from './eroeffnung';
import { zahlformatVon, type Datensatz, type FeldDef, type VorschauZeile } from '@/lib/tabelle/einfuegen';

export type PostenArt = 'forderungen' | 'verbindlichkeiten';
export type PostenModus = 'ergaenzen' | 'ersetzen';
export const POSTEN_ARTEN: readonly { id: PostenArt; label: string; einzeln: string }[] = [
  { id: 'forderungen', label: 'Offene Forderungen', einzeln: 'Forderung' },
  { id: 'verbindlichkeiten', label: 'Offene Verbindlichkeiten', einzeln: 'Verbindlichkeit' },
];

/** Spalten einer OP-Liste (nur Begriffe). */
export const POSTEN_FELDER: readonly FeldDef[] = [
  { id: 'name', label: 'Kunde / Lieferant', pflicht: true,
    namen: ['kunde', 'lieferant', 'debitor', 'kreditor', 'name', 'firma', 'geschäftspartner', 'kontobezeichnung', 'gläubiger', 'schuldner', 'empfänger', 'auftraggeber', 'kunde/lieferant', 'customer', 'supplier', 'vendor', 'partner'],
    enthaelt: ['kunde', 'lieferant', 'debitor', 'kreditor', 'glaeubiger', 'geschaeftspartner'], nicht: ['nr', 'nummer', 'konto'] },
  { id: 'rechnungsnr', label: 'Rechnungsnr.', namen: ['rechnungsnr', 'rechnungsnr.', 'rechnungsnummer', 're-nr', 're-nr.', 'rg-nr', 'rg-nr.', 'beleg', 'belegnr', 'belegnr.', 'belegnummer', 'beleg-nr', 'invoice', 'invoice no', 'invoice number', 'rechnung'],
    enthaelt: ['rechnungsn', 'belegn', 'beleg nr', 're nr', 'rg nr', 'invoice'] },
  { id: 'datum', label: 'Rechnungsdatum', namen: ['datum', 'rechnungsdatum', 'belegdatum', 'rg-datum', 're-datum', 'invoice date', 'date'], enthaelt: ['rechnungsdat', 'belegdat'] },
  { id: 'betrag', label: 'Betrag brutto', pflicht: true,
    namen: ['betrag', 'brutto', 'betrag brutto', 'bruttobetrag', 'offen', 'offener betrag', 'saldo', 'op-betrag', 'op betrag', 'summe', 'betrag (eur)', 'betrag eur', 'amount', 'restbetrag', 'offener posten'],
    enthaelt: ['brutto', 'betrag', 'offen'], nicht: ['netto', 'steuer', 'ust', 'mwst'] },
  { id: 'faellig', label: 'Fällig am', namen: ['fällig', 'fälligkeit', 'fällig am', 'fälligkeitsdatum', 'zahlungsziel', 'due date', 'due'], enthaelt: ['faellig', 'due'] },
  { id: 'bezahltAm', label: 'Bezahlt am', namen: ['bezahlt', 'bezahlt am', 'zahlungseingang', 'ausgeglichen am', 'zahldatum', 'paid', 'paid on'], enthaelt: ['bezahlt', 'ausgeglichen'] },
];

export interface PostenEingabe { quelle: string; posten: OffenerPosten }
export interface PostenFehler { quelle: string; schluessel: string; text: string }

/** Datensätze → offene Posten (Name, Betrag in Euro auf den Cent, Tage JJJJ-MM-TT). Fehler je Zeile, nie geraten. `heute` für „bezahlt am“. */
export function postenEingaben(ds: readonly Datensatz[], heute: string): { eingaben: PostenEingabe[]; fehler: PostenFehler[]; hinweise: string[] } {
  const format = zahlformatVon(ds, ['betrag']);
  const eingaben: PostenEingabe[] = [], fehler: PostenFehler[] = [], hinweise: string[] = [];
  let negativ = 0;
  const eins = (d: Datensatz, f: string) => (d.werte[f] ?? []).join(' ').trim();
  for (const [i, d] of ds.entries()) {
    const schluessel = `z${i}`;
    const fehlt = (text: string) => fehler.push({ quelle: d.quelle, schluessel, text });
    const name = textGlaetten(eins(d, 'name'));
    if (!name) { fehlt('Kunde bzw. Lieferant fehlt.'); continue; }
    if (name.length > 160) { fehlt('Name länger als 160 Zeichen.'); continue; }
    const betragText = eins(d, 'betrag');
    let c = betragText ? betragCent(betragText, format) : null;
    if (c === null) { fehlt(betragText ? `„${betragText.slice(0, 30)}“ ist kein Betrag.` : 'Betrag fehlt.'); continue; }
    if (c < 0) { c = -c; negativ++; }
    if (c === 0) { fehlt('Betrag ist 0 — ein offener Posten braucht einen Betrag.'); continue; }
    const rechnungsnr = textGlaetten(eins(d, 'rechnungsnr'));
    if (rechnungsnr.length > 60) { fehlt('Rechnungsnummer länger als 60 Zeichen.'); continue; }
    const tag = (f: string, label: string): string | undefined | false => {
      const t = eins(d, f);
      if (!t) return undefined;
      const x = datumAus(t);
      if (!x) { fehlt(`„${t.slice(0, 20)}“ ist kein Datum (${label}).`); return false; }
      return x;
    };
    const datum = tag('datum', 'Rechnungsdatum'); if (datum === false) continue;
    const faellig = tag('faellig', 'fällig am'); if (faellig === false) continue;
    const bezahltAm = tag('bezahltAm', 'bezahlt am'); if (bezahltAm === false) continue;
    if (bezahltAm && bezahltAm > heute) { fehlt('„Bezahlt am“ liegt in der Zukunft.'); continue; }
    eingaben.push({ quelle: d.quelle, posten: { name, betrag: c / 100, ...(rechnungsnr ? { rechnungsnr } : {}), ...(datum ? { datum } : {}), ...(faellig ? { faellig } : {}), ...(bezahltAm ? { bezahltAm } : {}) } });
  }
  if (negativ) hinweise.push(`${negativ} Betrag${negativ === 1 ? '' : 'e'} mit Minuszeichen als Betrag übernommen (offene Posten zählen positiv).`);
  return { eingaben, fehler, hinweise };
}

/** Woran ein Posten wiedererkannt wird: Name + Rechnungsnummer; ohne Nummer Name + Betrag + Rechnungsdatum. */
export const postenSchluessel = (p: OffenerPosten): string =>
  p.rechnungsnr ? `nr:${vergleichsText(p.name)}|${vergleichsText(p.rechnungsnr)}` : `bt:${vergleichsText(p.name)}|${Math.round(p.betrag * 100)}|${p.datum ?? ''}`;

const FELDER_POSTEN: readonly (keyof OffenerPosten)[] = ['name', 'betrag', 'rechnungsnr', 'datum', 'faellig', 'bezahltAm'];
const FELD_NAME: Record<string, string> = { name: 'Name', betrag: 'Betrag', rechnungsnr: 'Rechnungsnr.', datum: 'Datum', faellig: 'fällig', bezahltAm: 'bezahlt am' };
const euro = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const anzeigen = (f: keyof OffenerPosten, v: unknown) => (v === undefined || v === null || v === '' ? undefined : f === 'betrag' ? euro(v as number) : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? `${String(v).slice(8, 10)}.${String(v).slice(5, 7)}.${String(v).slice(0, 4)}` : String(v));

export interface PostenPlanZeile { schluessel: string; quelle: string; status: 'neu' | 'geaendert' | 'gleich' | 'entfaellt'; posten: OffenerPosten; aenderungen: { feld: string; alt?: string; neu?: string }[] }

/**
 * Plan: was die eingefügte Liste mit der bisherigen macht. Ergänzen: vorhandene bleiben (geänderte mit den neuen Werten, leere Zellen lassen den
 * alten Wert), neue hinten an. Ersetzen: die Liste = die eingefügte (Reihenfolge der Einfügung, Werte wie beim Ergänzen zusammengeführt); was nicht
 * mehr vorkommt, „entfällt“. Dieselbe Rechnung zweimal in der Einfügung → Fehler.
 */
export function postenPlan(eingaben: readonly PostenEingabe[], bisher: readonly OffenerPosten[], modus: PostenModus): { zeilen: PostenPlanZeile[]; doppelt: PostenFehler[] } {
  const zeilen: PostenPlanZeile[] = [], doppelt: PostenFehler[] = [];
  const gesehen = new Set<string>();
  const vorhanden = new Map(bisher.map((p, i) => [postenSchluessel(p), { p, i }]));
  const getroffen = new Set<number>();
  for (const [n, e] of eingaben.entries()) {
    const k = postenSchluessel(e.posten);
    if (gesehen.has(k)) { doppelt.push({ quelle: e.quelle, schluessel: `d${n}`, text: `${e.posten.name}${e.posten.rechnungsnr ? ` (${e.posten.rechnungsnr})` : ''} kommt zweimal vor — bitte nur einmal einfügen.` }); continue; }
    gesehen.add(k);
    const alt = vorhanden.get(k);
    if (!alt) { zeilen.push({ schluessel: `n${n}`, quelle: e.quelle, status: 'neu', posten: e.posten, aenderungen: FELDER_POSTEN.filter(f => e.posten[f] !== undefined).map(f => ({ feld: FELD_NAME[f], neu: anzeigen(f, e.posten[f]) })) }); continue; }
    getroffen.add(alt.i);
    // Zusammenführen: was die Einfügung trägt, gewinnt; leere Zellen lassen den alten Wert stehen.
    // Name und Rechnungsnummer sind der Schlüssel — eine andere Schreibweise („re-1“ statt „RE-1“) ist keine Änderung.
    const neu: OffenerPosten = { ...alt.p, ...Object.fromEntries(Object.entries(e.posten).filter(([, v]) => v !== undefined && v !== '')), name: alt.p.name, ...(alt.p.rechnungsnr ? { rechnungsnr: alt.p.rechnungsnr } : {}) } as OffenerPosten;
    const aenderungen = FELDER_POSTEN.filter(f => String(alt.p[f] ?? '') !== String(neu[f] ?? '')).map(f => ({ feld: FELD_NAME[f], alt: anzeigen(f, alt.p[f]), neu: anzeigen(f, neu[f]) }));
    zeilen.push({ schluessel: `v${alt.i}`, quelle: e.quelle, status: aenderungen.length ? 'geaendert' : 'gleich', posten: neu, aenderungen });
  }
  if (modus === 'ersetzen') bisher.forEach((p, i) => { if (!getroffen.has(i)) zeilen.push({ schluessel: `x${i}`, quelle: 'bisher', status: 'entfaellt', posten: p, aenderungen: [] }); });
  return { zeilen, doppelt };
}

/**
 * Die neue Liste aus dem Plan und der Auswahl (abgewählte Zeilen wirken nicht: ein abgewählter neuer Posten kommt nicht dazu, ein abgewählter
 * geänderter behält seine alten Werte, ein abgewählter „entfällt“ bleibt).
 */
export function neueListe(plan: readonly PostenPlanZeile[], bisher: readonly OffenerPosten[], modus: PostenModus, auswahl: Set<string> | null): OffenerPosten[] {
  const gewaehlt = (z: PostenPlanZeile) => !auswahl || z.status === 'gleich' || auswahl.has(z.schluessel);
  const ersetzt = new Map<number, OffenerPosten>();
  for (const z of plan) if (z.schluessel.startsWith('v')) ersetzt.set(Number(z.schluessel.slice(1)), gewaehlt(z) ? z.posten : bisher[Number(z.schluessel.slice(1))]);
  const neue = plan.filter(z => z.status === 'neu' && gewaehlt(z)).map(z => z.posten);
  if (modus === 'ergaenzen') return [...bisher.map((p, i) => ersetzt.get(i) ?? p), ...neue];
  // Ersetzen: in der Reihenfolge der Einfügung; abgewählte „entfällt“ bleiben hinten stehen.
  const raus: OffenerPosten[] = [];
  for (const z of plan) {
    if (z.status === 'neu') { if (gewaehlt(z)) raus.push(z.posten); continue; }
    if (z.status === 'entfaellt') { if (!gewaehlt(z)) raus.push(z.posten); continue; }
    raus.push(ersetzt.get(Number(z.schluessel.slice(1))) ?? z.posten);
  }
  return raus;
}

/** Vorschau in der gemeinsamen Form. */
export function postenVorschauZeilen(plan: readonly PostenPlanZeile[], fehler: readonly PostenFehler[]): VorschauZeile[] {
  return [
    ...plan.map(z => ({
      schluessel: z.schluessel, quelle: z.quelle, status: z.status,
      titel: `${z.posten.name}${z.posten.rechnungsnr ? ` · ${z.posten.rechnungsnr}` : ''} · ${euro(z.posten.betrag)}`,
      ...(z.status === 'gleich' ? { text: 'steht schon so in der Liste' } : z.status === 'entfaellt' ? { text: 'kommt in der eingefügten Liste nicht vor — fällt weg' } : z.posten.bezahltAm ? { text: `bezahlt am ${anzeigen('bezahltAm', z.posten.bezahltAm)} — zählt nicht mehr als offen` } : {}),
      aenderungen: z.status === 'geaendert' ? z.aenderungen : [],
    })),
    ...fehler.map(f => ({ schluessel: f.schluessel, quelle: f.quelle, titel: f.quelle, status: 'fehler' as const, text: f.text })),
  ];
}

/** Grenze der Liste prüfen (nie kürzen). */
export const listeZuLang = (l: readonly OffenerPosten[], art: PostenArt): string | null =>
  l.length > MAX_OFFENE_POSTEN ? `${POSTEN_ARTEN.find(a => a.id === art)!.label}: höchstens ${MAX_OFFENE_POSTEN} Posten — die Liste hätte ${l.length}. Nichts übernommen.` : null;

/** Die Felder der nächsten Fassung (für `speichereEroeffnung`) — alles wie die geltende, nur die eine Liste neu. */
export function fassungMit(e: Eroeffnung, art: PostenArt, liste: readonly OffenerPosten[]): Record<string, unknown> {
  return {
    firma: e.firma, stichtag: e.stichtag, kontostand: e.kontostand, ...(e.notiz ? { notiz: e.notiz } : {}),
    forderungen: art === 'forderungen' ? liste : e.forderungen ?? [],
    verbindlichkeiten: art === 'verbindlichkeiten' ? liste : e.verbindlichkeiten ?? [],
  };
}

/** „Bezahlt am“ für einen Posten setzen (oder mit `null` wieder öffnen) — die Liste der nächsten Fassung. Unbekannte Stelle → null. */
export function mitBezahlt(l: readonly OffenerPosten[], index: number, tag: string | null): OffenerPosten[] | null {
  if (!Number.isInteger(index) || index < 0 || index >= l.length) return null;
  return l.map((p, i) => {
    if (i !== index) return p;
    const { bezahltAm: _alt, ...rest } = p;
    return tag ? { ...rest, bezahltAm: tag } : rest;
  });
}
