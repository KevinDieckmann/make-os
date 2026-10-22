// ─── Prozesse — neue Stellschrauben der festen Prozesse: Werte, Prüfung, Lesefunktionen (rein, client-sicher; 22.10., Branch `prozesse-stellschrauben`) ───────
// Werte, die bis 22.10. fest im Code standen und keinen eigenen Einstellungs-Bestand haben, liegen jetzt im Bestand `prozesse-stellschrauben--<haushalt>`
// (Business, nur Abweichungen von der Vorgabe — ohne Eintrag verhält sich jede Stelle bit-gleich wie vorher). Jeder Wert hat GENAU EINE Lesefunktion hier
// (Rückfall = Vorgabe); die ausführenden Stellen lesen nur über sie:
//   Head-Modi        Uhrzeit, Wochentag, an/aus je Modus der Heads Sales/Marketing/Event       lib/heads/takt.ts `faelligeModi` (+ Vorschau lib/agenten/naechstes.ts)
//   Monatsabschluss  Fenster ab n-tem Werktag bis Tag x des Monats                              lib/finanzen/chef/plan.ts `faelligerModus`
//   Buchung          Haltezeit einer vorläufigen Buchung, Gültigkeit des Mail-Links              lib/kalender/buchung.ts `reservieren`, app/api/kalender/buchung
//   Kapazität        Schwellen „machbar“ / „eng“                                                lib/kapazitaet/modell.ts, lib/crm/planung.ts
//   Leistungstreppe  Abstand der Fortschritts-Reports                                           lib/crm/treppe.ts `reportNaechsterFaellig`
// Geschrieben nur über POST /api/prozesse/stellschrauben (lib/prozesse/stellschrauben-werte-server.ts: Stand/409, alles oder nichts, Protokoll ohne Werte).
// Werte der Markttraktion (Nachfassfrist, Wiedervorlage, Deal-Ampel) liegen in den Wertelisten (lib/crm/stellschrauben.ts) — ein vorhandener Bestand.

/** Die Heads und ihre Modi im Takt — die Vorgaben sind genau die Zeiten, die bis 22.10. in lib/heads/takt.ts standen. */
export type HeadModusRhythmus = 'werktags' | 'woche' | 'monat' | 'nach-event' | 'vor-event';
export interface HeadModusDef { head: 'sales' | 'marketing' | 'event'; modus: string; name: string; rhythmus: HeadModusRhythmus; stunde: number; wochentag?: number }
export const HEAD_MODI: readonly HeadModusDef[] = [
  { head: 'sales', modus: 'power_hour', name: 'Power Hour vorbereiten', rhythmus: 'werktags', stunde: 7 },
  { head: 'sales', modus: 'wochenreview', name: 'Wochenreview Vertrieb', rhythmus: 'woche', wochentag: 5, stunde: 14 },
  { head: 'sales', modus: 'lead_review', name: 'Leads qualifizieren (Wochenstart)', rhythmus: 'woche', wochentag: 1, stunde: 9 },
  { head: 'sales', modus: 'kundenreview', name: 'Kundenreview zum Monatsanfang', rhythmus: 'monat', stunde: 9 },
  { head: 'marketing', modus: 'wochenplan', name: 'Wochenplan Marketing', rhythmus: 'woche', wochentag: 1, stunde: 8 },
  { head: 'marketing', modus: 'netzwerk', name: 'Vernetzen-Runde planen', rhythmus: 'werktags', stunde: 8 },
  { head: 'marketing', modus: 'monatsreview', name: 'Monatsreview Marketing', rhythmus: 'monat', stunde: 10 },
  { head: 'event', modus: 'nachfassen', name: 'Nachfassen nach dem Event', rhythmus: 'nach-event', stunde: 8 },
  { head: 'event', modus: 'planung', name: 'Countdown bis zum Event', rhythmus: 'vor-event', stunde: 8 },
];
export const HEAD_NAMEN: Record<HeadModusDef['head'], string> = { sales: 'Head of Sales', marketing: 'Head of Marketing', event: 'Head of Event' };
export const RHYTHMUS_TEXT: Record<HeadModusRhythmus, string> = {
  werktags: 'werktags (Mo–Fr), einmal am Tag', woche: 'einmal die Woche', monat: 'am ersten Werktag des Monats', 'nach-event': 'am Tag nach einem eigenen Event', 'vor-event': 'täglich in den 7 Tagen vor einem eigenen Event',
};

export type WertArt = 'zahl' | 'schalter' | 'stunde' | 'wochentag';
/** Eine neue Stellschraube (flache Kennung). `prozess` = der System-Prozess, dessen Steckbrief sie zeigt. */
export interface WertDef { id: string; prozess: string; gruppe: string; name: string; art: WertArt; vorgabe: number | boolean; min?: number; max?: number; einheit?: string; erklaerung: string }

const headWerte = (m: HeadModusDef): WertDef[] => {
  const basis = `head.${m.head}.${m.modus}`;
  const gruppe = HEAD_NAMEN[m.head];
  return [
    { id: `${basis}.an`, prozess: 'sp-head-takt', gruppe, name: `${m.name}: an/aus`, art: 'schalter', vorgabe: true, erklaerung: `Läuft ${RHYTHMUS_TEXT[m.rhythmus]}. Aus = der Head schlägt diesen Lauf im Takt nicht mehr vor (auch nicht nachgeholt).` },
    ...(m.wochentag !== undefined ? [{ id: `${basis}.wochentag`, prozess: 'sp-head-takt', gruppe, name: `${m.name}: Wochentag`, art: 'wochentag' as const, vorgabe: m.wochentag, min: 0, max: 6, erklaerung: 'An welchem Tag der Woche der Lauf kommt (verpasst: höchstens sechs Tage nachgeholt).' }] : []),
    { id: `${basis}.stunde`, prozess: 'sp-head-takt', gruppe, name: `${m.name}: ab Uhrzeit`, art: 'stunde', vorgabe: m.stunde, min: 0, max: 23, erklaerung: 'Ab dieser vollen Stunde (Berliner Zeit) kommt der Lauf — einmal am Tag; Business-frei ruht er.' },
  ];
};

/** Alle neuen Stellschrauben dieses Bestands — Kennung, Vorgabe, Grenzen. Neue Stellschraube = ein Eintrag hier + EINE Lesefunktion unten + Test. */
export const WERTE: readonly WertDef[] = [
  ...HEAD_MODI.flatMap(headWerte),
  { id: 'abschluss.abWerktag', prozess: 'sp-monatsabschluss', gruppe: 'Fenster des Monatsabschlusses', name: 'Ab dem … Werktag', art: 'zahl', vorgabe: 3, min: 1, max: 15, einheit: '. Werktag',
    erklaerung: 'Ab diesem Werktag des Monats schlägt der Head of Finance den Monatsabschluss des Vormonats vor.' },
  { id: 'abschluss.bisTag', prozess: 'sp-monatsabschluss', gruppe: 'Fenster des Monatsabschlusses', name: 'Bis zum … des Monats', art: 'zahl', vorgabe: 20, min: 1, max: 28, einheit: '.',
    erklaerung: 'Nach diesem Tag gilt ein Abschluss des Vormonats als zu spät — der Head schlägt ihn nicht mehr vor.' },
  { id: 'buchung.halteMin', prozess: 'sp-buchung', gruppe: 'Buchung', name: 'Platz halten', art: 'zahl', vorgabe: 30, min: 5, max: 240, einheit: 'Minuten',
    erklaerung: 'So lange hält eine vorläufige Buchung ihren Platz, bis der Gast sie bestätigt — danach ist er wieder frei.' },
  { id: 'buchung.mailLinkTage', prozess: 'sp-buchung', gruppe: 'Buchung', name: 'Bestätigungslink gilt', art: 'zahl', vorgabe: 7, min: 1, max: 30, einheit: 'Tage',
    erklaerung: 'So lange gilt der Link, mit dem ein Gast seine E-Mail-Adresse bestätigt (einmalig). Der Datenschutz-Hinweis der Buchungsseite nennt den Wert.' },
  { id: 'kapa.machbarBis', prozess: 'sp-meilensteine', gruppe: 'Kapazität', name: 'Machbar bis', art: 'zahl', vorgabe: 70, min: 10, max: 100, einheit: '% der freien Zeit',
    erklaerung: 'Braucht der Rest höchstens diesen Anteil der freien Zeit bis zum Termin, gilt er als machbar (sonst eng bzw. nicht machbar).' },
  { id: 'kapa.engBis', prozess: 'sp-meilensteine', gruppe: 'Kapazität', name: 'Eng bis', art: 'zahl', vorgabe: 90, min: 10, max: 150, einheit: '% der freien Zeit',
    erklaerung: 'Bis zu diesem Anteil gilt ein Ziel als eng, darüber als nicht machbar. Muss über „machbar bis“ liegen.' },
  { id: 'treppe.reportTage', prozess: 'sp-treppe', gruppe: 'Fortschritts-Report', name: 'Report alle', art: 'zahl', vorgabe: 14, min: 7, max: 90, einheit: 'Tage',
    erklaerung: 'So viele Tage nach dem letzten Report ist der nächste fällig — Treppe, Hänger im Fall-Kopf und Report-Zeitachse lesen denselben Wert.' },
];
const NACH_ID = new Map(WERTE.map(w => [w.id, w]));
export const wertDef = (id: string): WertDef | undefined => NACH_ID.get(id);
/** Prozesse, deren Steckbrief eine Stellschraube auch zeigt (dieselbe Kennung, derselbe Wert). */
export const AUCH_IN: Readonly<Record<string, readonly string[]>> = { 'kapa.machbarBis': ['sp-vertriebsplanung'], 'kapa.engBis': ['sp-vertriebsplanung'] };

export type Werte = Readonly<Record<string, number | boolean>>;
/** Der Bestand. `werte` trägt NUR Abweichungen von der Vorgabe. */
export interface StellschraubenBestand { v: 1; werte: Record<string, number | boolean>; geaendertAm?: string; geaendertVon?: string }
export const leererBestand = (): StellschraubenBestand => ({ v: 1, werte: {} });

/** Ist ein Wert für diese Stellschraube gültig? */
export function wertGueltig(d: WertDef, v: unknown): v is number | boolean {
  if (d.art === 'schalter') return typeof v === 'boolean';
  return typeof v === 'number' && Number.isInteger(v) && (d.min === undefined || v >= d.min) && (d.max === undefined || v <= d.max);
}
const kreuzFehler = (w: Werte): string | null => {
  const m = typeof w['kapa.machbarBis'] === 'number' ? w['kapa.machbarBis'] as number : 70, e = typeof w['kapa.engBis'] === 'number' ? w['kapa.engBis'] as number : 90;
  if (m >= e) return 'Kapazität: „machbar bis“ muss unter „eng bis“ liegen.';
  return null;
};

/** Den Bestand lesen (Säuberer, schreibt nie): unbekannte Kennungen, ungültige Werte und Werte der Vorgabe fallen weg — nie geraten. */
export function bestandAus(roh: unknown): StellschraubenBestand {
  const o = roh && typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : {};
  const w = o.werte && typeof o.werte === 'object' && !Array.isArray(o.werte) ? o.werte as Record<string, unknown> : {};
  const werte: Record<string, number | boolean> = {};
  for (const [id, v] of Object.entries(w)) { const d = NACH_ID.get(id); if (d && wertGueltig(d, v) && v !== d.vorgabe) werte[id] = v; }
  // Ein Kreuzfehler (z. B. machbar ≥ eng aus einem älteren Stand) gilt nie — dann die Vorgaben dieser beiden.
  if (kreuzFehler(werte)) { delete werte['kapa.machbarBis']; delete werte['kapa.engBis']; }
  return { v: 1, werte, ...(typeof o.geaendertAm === 'string' ? { geaendertAm: o.geaendertAm } : {}), ...(typeof o.geaendertVon === 'string' ? { geaendertVon: o.geaendertVon } : {}) };
}

/** Der wirksame Wert (gespeichert, sonst Vorgabe) — die Grundlage aller Lesefunktionen. Unbekannte Kennung wirft (Programmfehler). */
export function wert(w: Werte | null | undefined, id: string): number | boolean {
  const d = NACH_ID.get(id);
  if (!d) throw new Error(`Unbekannte Stellschraube: ${id}`);
  const v = w?.[id];
  return v !== undefined && wertGueltig(d, v) ? v : d.vorgabe;
}
const zahl = (w: Werte | null | undefined, id: string) => wert(w, id) as number;

// ── Lesefunktionen (EINE je Wert) ────────────────────────────────────────────────────────────────────────────────────

/** Plan eines Head-Modus: an/aus, ab Stunde, Wochentag (0 = Sonntag … 6 = Samstag; nur bei Modi „einmal die Woche“). */
export function headModusPlan(w: Werte | null | undefined, head: string, modus: string): { an: boolean; stunde: number; wochentag?: number } {
  const m = HEAD_MODI.find(x => x.head === head && x.modus === modus);
  if (!m) return { an: true, stunde: 0 };
  const b = `head.${head}.${modus}`;
  return { an: wert(w, `${b}.an`) as boolean, stunde: zahl(w, `${b}.stunde`), ...(m.wochentag !== undefined ? { wochentag: zahl(w, `${b}.wochentag`) } : {}) };
}
/** Fenster des Monatsabschlusses: ab dem n-ten Werktag bis zum Tag x des Monats. */
export const abschlussFenster = (w?: Werte | null): { abWerktag: number; bisTag: number } => ({ abWerktag: zahl(w, 'abschluss.abWerktag'), bisTag: zahl(w, 'abschluss.bisTag') });
/** So lange (Minuten) hält eine vorläufige Buchung ihren Platz. */
export const buchungHalteMin = (w?: Werte | null): number => zahl(w, 'buchung.halteMin');
/** So lange (Tage) gilt ein Bestätigungslink für die E-Mail-Adresse. */
export const buchungMailLinkTage = (w?: Werte | null): number => zahl(w, 'buchung.mailLinkTage');
/** Schwellen der Machbarkeit als Anteil (0,7 = 70 %). */
export const kapaSchwellen = (w?: Werte | null): { machbarBis: number; engBis: number } => ({ machbarBis: zahl(w, 'kapa.machbarBis') / 100, engBis: zahl(w, 'kapa.engBis') / 100 });
/** Abstand der Fortschritts-Reports in Tagen. */
export const reportTage = (w?: Werte | null): number => zahl(w, 'treppe.reportTage');

// ── Ändern (rein) ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Höchstens so viele Änderungen je Anfrage (darüber 413 — nie gekürzt). */
export const OPS_MAX = 60;
export type AendernErgebnis =
  | { ok: true; bestand: StellschraubenBestand; geaendert: string[] }
  | { ok: false; status: 400 | 404 | 413; fehler: string };

/**
 * Änderungen anwenden (alles oder nichts): `ops` = [{ id, wert }] mit `wert: null` = zurück auf die Vorgabe. Gleich der Vorgabe = nicht gespeichert.
 * Unbekannte Kennung 404, ungültiger Wert 400 (mit Grenzen), zu viele 413.
 */
export function werteAendern(alt: StellschraubenBestand, ops: unknown, k: { person: string; jetzt: string }): AendernErgebnis {
  if (!Array.isArray(ops) || !ops.length) return { ok: false, status: 400, fehler: 'Keine Änderung (ops) — nichts gespeichert.' };
  if (ops.length > OPS_MAX) return { ok: false, status: 413, fehler: `Höchstens ${OPS_MAX} Änderungen auf einmal — nichts gespeichert.` };
  const werte: Record<string, number | boolean> = { ...alt.werte };
  const geaendert: string[] = [];
  for (const o of ops) {
    const x = o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, unknown> : {};
    const id = typeof x.id === 'string' ? x.id : '';
    const d = NACH_ID.get(id);
    if (!d) return { ok: false, status: 404, fehler: `Diese Stellschraube gibt es nicht${id ? ` („${id.slice(0, 60)}“)` : ''} — nichts gespeichert.` };
    const vorher = werte[id];
    if (x.wert === null || x.wert === d.vorgabe) delete werte[id];
    else if (wertGueltig(d, x.wert)) werte[id] = x.wert;
    else return { ok: false, status: 400, fehler: `${d.name}: ${d.art === 'schalter' ? 'an oder aus' : `ganze Zahl ${d.min}–${d.max}${d.einheit ? ` ${d.einheit}` : ''}`} — nichts gespeichert.` };
    if (vorher !== werte[id] && !geaendert.includes(id)) geaendert.push(id);
  }
  const kreuz = kreuzFehler(werte);
  if (kreuz) return { ok: false, status: 400, fehler: `${kreuz} Nichts gespeichert.` };
  if (!geaendert.length) return { ok: true, bestand: alt, geaendert };
  return { ok: true, bestand: { v: 1, werte, geaendertAm: k.jetzt, geaendertVon: k.person }, geaendert };
}
