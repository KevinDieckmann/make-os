// ─── Produkte & Mandate · „Ein Produkt, eine Karte“ — die EINE Stelle für Produkt-Regeln (rein, Server + Browser, 19.10.) ──────────
// PRODUKTE_KONZEPT.md (Kevin 19.10.): Preis, Laufzeit, Text, Ablauf und Stufe stehen genau EINMAL am Produkt (CRM-Liste `leistungen`,
// Typ `Leistung`). Preis-Formen sind kombinierbar (Preis-Teile), ein Mandat = Hauptprodukt + Zusatzmodule. Jede Stelle, die ein Produkt
// liest (Angebot, Mandat, Finanzplan, Kapazität, Treppe …), liest über diese Funktionen — nie `l.preis` direkt.
//
// Grundsatz „ohne Karte gilt das Alte“ (Live-Daten, Update-Probe): solange ein Produkt keine der neuen Felder trägt, rechnet jede Funktion
// hier BIT-GLEICH wie vorher (gleiche Felder, gleiche Zahlen, gleiche Treppe). Neue Felder wirken nur, wo sie stehen:
//   preise      → Preis überall (Angebot, Planung, Mandat-Honorar); der Server spiegelt das alte `preis` aus dem Hauptpreis-Teil
//   vertrag     → Mindestlaufzeit (gespiegelt nach `laufzeitMonate`), Kündigung, Rhythmus, Zahlungsziel, USt fürs Mandat
//   aufwandStundenWoche → Kapazität (gespiegelt nach `aufwand.stunden` je Preis-Einheit)
//   irgendein Karten-Feld → das Produkt ist eine „Karte“: in der Treppe gewinnt die Karte, die gespeicherte Stufe füllt nur Leeres
// Geld in neuen Feldern in Cent (`betragCent`), gerechnet über lib/finanzen/ust.ts. Keine echten Produkte, Preise oder Namen hier.
//
// Abhängigkeiten nur nach unten (keine Kreise): typen, treppe-daten (nur Typen), finanzen/ust, einheiten. angebote.ts, finanzen/produkte.ts,
// crm/produkte.ts, mandat-anlegen.ts und treppe.ts lesen von HIER.

import type {
  AngebotBasis, AngebotPosition, ChancenArt, Gesellschaft, Leistung, Mandat, MandatZusatz, MandatZusatzBasis, PreisTeil, PreisTeilArt,
  ProduktRegeln, ProduktRolle, ProduktVertrag,
} from './typen';
import type { TreppeDatei, TreppenStufe } from './treppe-daten';
import type { Rhythmus } from '@/lib/finanzen/szenarien';
import { inCent } from '@/lib/finanzen/ust';
import { bereichVonGesellschaft } from '@/lib/einheiten';
import { PROZESS_KENNUNG } from '@/lib/prozesse/definition';

export type { PreisTeil, PreisTeilArt, ProduktVertrag, ProduktRegeln, ProduktRolle, MandatZusatz, MandatZusatzBasis } from './typen';

// ── Grundwerte ───────────────────────────────────────────────────────────────

/** Die Preis-Formen in ihrer Reihenfolge (Auswahl der Oberfläche). `betrag`: ob ein Betrag dazugehört. */
export const PREIS_TEIL_ARTEN: readonly { id: PreisTeilArt; label: string; betrag: boolean }[] = [
  { id: 'kostenlos', label: 'kostenlos', betrag: false }, { id: 'fest', label: 'Festpreis', betrag: true },
  { id: 'monatlich', label: 'monatlich', betrag: true }, { id: 'jaehrlich', label: 'jährlich', betrag: true },
  { id: 'je_einheit', label: 'je Einheit', betrag: true }, { id: 'tagessatz', label: 'Tagessatz', betrag: true },
  { id: 'stundensatz', label: 'Stundensatz', betrag: true }, { id: 'erfolg', label: 'Erfolgsanteil', betrag: true },
];
const ARTEN = new Set<string>(PREIS_TEIL_ARTEN.map(a => a.id));
export const preisArtLabel = (a: PreisTeilArt): string => PREIS_TEIL_ARTEN.find(x => x.id === a)?.label ?? a;

export const VERTRAG_DANACH = ['monatlich_kuendbar', 'verlaengert_um_laufzeit', 'endet'] as const;
export const RECHNUNGS_RHYTHMEN = ['monatlich', 'quartal', 'einmalig'] as const;
export const REISEKOSTEN = ['separat', 'inklusive'] as const;
export const PRODUKT_ROLLEN: readonly ProduktRolle[] = ['haupt', 'zusatz', 'beides'];
export const INKLUSIVE_JE = ['monat', 'quartal', 'jahr'] as const;
export const ZUSATZ_BASEN: readonly MandatZusatzBasis[] = ['monat', 'jahr', 'einmalig', 'einheit', 'tag', 'stunde'];
export const UST_SAETZE_KARTE = [19, 7, 0] as const;

/** Grenzen — darüber lehnt der Server ab (`produktPruefen`: 413 bzw. 400), nie still gekürzt. */
export const PRODUKT_GRENZEN = {
  preise: 12, betragCent: 1_000_000_000, text: 300, einheit: 40, kontingent: 300, aufgabe: 1000, kennzahl: 200, ebene: 12, dauerTage: 1100,
  aufwandStundenWoche: 168, mindestlaufzeitMonate: 120, kuendigungsfristTage: 365, zahlungszielTage: 120, maxGleichzeitig: 1000,
  anrechnungAuf: 10, inklusive: 10, inklusiveMenge: 1000, stundenJeMonat: 744, zielUmsatz: 1e9, zielKunden: 100_000, zusatz: 50,
  /** Artikelnummer eines Preis-Teils (25.10.). */
  artikelnummer: 40,
} as const;

/** Die Felder der Karte (19.10.) — trägt ein Produkt eines davon, ist es eine Karte (`istKarte`). */
export const KARTEN_FELDER = ['preise', 'vertrag', 'regeln', 'rolle', 'ebene', 'aufgabe', 'kennzahl', 'dauerTage', 'aufwandStundenWoche', 'ziel'] as const;
export type KartenFeld = typeof KARTEN_FELDER[number];
export type KartenFelder = Partial<Pick<Leistung, KartenFeld>>;

const gesetzt = (v: unknown) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length);
/** Trägt das Produkt mindestens ein Feld der Karte? Sonst gilt überall das Alte (bit-gleich). */
export const istKarte = (l: Partial<Pick<Leistung, KartenFeld>>): boolean => KARTEN_FELDER.some(f => gesetzt(l[f]));
/** Hat das Produkt eigene Preis-Teile? Sonst kommt der Preis aus dem alten `preis`. */
export const hatPreisteile = (l: Pick<Leistung, 'preise'>): boolean => Array.isArray(l.preise) && l.preise.length > 0;

// ── Altpreis (das alte Feld `preis`) — bisher in lib/finanzen/produkte.ts bzw. lib/crm/produkte.ts ─────────────────

export type PreisBasis = 'monat' | 'jahr' | 'einmalig';
/** Basis des alten Preises: eingetragen, sonst aus der Einheit („Monat netto“ → monat, „Jahr“ → jahr, sonst einmalig); null, wenn nichts erkennbar. */
export function basisAusAltpreis(p: Pick<Leistung['preis'], 'basis' | 'einheit'> | undefined): PreisBasis | null {
  if (!p) return null;
  if (p.basis) return p.basis;
  const e = (p.einheit ?? '').toLowerCase();
  if (/monat|mtl|\/m\b|month/.test(e)) return 'monat';
  if (/jahr|jährlich|jaehrlich|p\.\s*a\.|year/.test(e)) return 'jahr';
  if (/einmal|pauschal|projekt|tag|stunde|workshop|festpreis|one/.test(e)) return 'einmalig';
  return null;
}
/** Ein kostenloses Produkt im alten Preis (16.10.): Betrag 0 und Einheit „kostenlos“. */
export const istKostenlosAlt = (p: Pick<Leistung['preis'], 'betrag' | 'einheit'> | undefined): boolean => !!p && !p.betrag && /^kostenlos$/i.test((p.einheit ?? '').trim());

/** Kennung des aus dem alten Preis abgeleiteten Teils (nie gespeichert). */
export const ALT_TEIL_ID = 'pt-preis';
/** Den alten Preis als EINEN Preis-Teil lesen (Grund). Einheit „Tag“/„Stunde“ bei einmaliger Basis → Tages-/Stundensatz. */
export function teilAusAltpreis(p: Leistung['preis'] | undefined): PreisTeil {
  if (!p) return { id: ALT_TEIL_ID, art: 'fest', rolle: 'grund' };
  if (istKostenlosAlt(p)) return { id: ALT_TEIL_ID, art: 'kostenlos', rolle: 'grund' };
  const basis = basisAusAltpreis(p);
  const e = (p.einheit ?? '').toLowerCase();
  const art: PreisTeilArt = basis === 'monat' ? 'monatlich' : basis === 'jahr' ? 'jaehrlich'
    : /(^|[^a-zäöüß])tag/.test(e) ? 'tagessatz' : /stunde|(^|[^a-z])std\b/.test(e) ? 'stundensatz' : 'fest';
  const betrag = Number.isFinite(p.betrag) && p.betrag > 0 ? inCent(p.betrag) : undefined;
  const bis = betrag !== undefined && typeof p.bis === 'number' && p.bis > p.betrag ? inCent(p.bis) : undefined;
  return { id: ALT_TEIL_ID, art, ...(betrag !== undefined ? { betragCent: betrag } : {}), ...(bis !== undefined ? { bisCent: bis } : {}), rolle: 'grund' };
}

// ── Preis-Teile lesen ────────────────────────────────────────────────────────

/** Die Preis-Teile eines Produkts: die eigenen, sonst EIN Teil aus dem alten `preis`. */
export function preisteileVon(l: Pick<Leistung, 'preis' | 'preise'>): PreisTeil[] {
  return hatPreisteile(l) ? l.preise! : [teilAusAltpreis(l.preis)];
}
/**
 * Rang der Preis-Formen für den Hauptpreis (Kevin 24.10., Bau-Test: „der laufende Preis-Teil, monatlich vor jährlich vor …“ — NIE „der erste, der
 * immer gilt“): laufend vor einmalig, Kostenloses zuletzt. Tages-/Stundensatz zählen als laufend (geplant Satz × Menge je Monat).
 */
const HAUPT_RANG: Record<PreisTeilArt, number> = { monatlich: 0, jaehrlich: 1, stundensatz: 2, tagessatz: 3, fest: 4, je_einheit: 5, erfolg: 6, kostenlos: 7 };
/**
 * Der Hauptpreis-Teil einer Liste — EINE Regel (Server, Browser, Spiegeln, Angebot, Mandat): unter den Teilen mit Rolle „grund“ (ohne solche unter
 * allen) der mit dem besten Rang der Form (`HAUPT_RANG`), bei gleicher Form der höhere Betrag, dann die Kennung. Die Reihenfolge der Teile auf der Karte
 * entscheidet NICHTS (bis 24.10.: „der erste, der immer gilt“ — ein Festpreis vor dem Monatspreis wurde so das Mandat-Honorar).
 */
export function hauptpreisAus(teile: readonly PreisTeil[]): PreisTeil | null {
  const grund = teile.filter(x => x.rolle === 'grund');
  const l = grund.length ? grund : teile;
  if (l.length <= 1) return l[0] ?? null;
  return [...l].sort((a, b) => HAUPT_RANG[a.art] - HAUPT_RANG[b.art] || (b.betragCent ?? -1) - (a.betragCent ?? -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}
/** Der Hauptpreis-Teil eines Produkts (`hauptpreisAus`). Er wird ins alte `preis` gespiegelt und ist das Honorar des Mandats. */
export function hauptpreis(l: Pick<Leistung, 'preis' | 'preise'>): PreisTeil | null {
  return hauptpreisAus(preisteileVon(l));
}
/** Die Teile in der Reihenfolge für Angebot und Mandat: der Hauptpreis zuerst, danach die übrigen wie auf der Karte. */
export function teileHauptZuerst(teile: readonly PreisTeil[]): PreisTeil[] {
  const h = hauptpreisAus(teile);
  return h ? [h, ...teile.filter(t => t !== h)] : [...teile];
}
/** Wie ein Preis-Teil neben dem Produktnamen heißt: „Festpreis“, „Tagessatz“, „monatlich“, „je Event“ … */
export const teilLabel = (t: Pick<PreisTeil, 'art' | 'einheit'>): string => (t.art === 'je_einheit' ? jeText(t.einheit) : preisArtLabel(t.art));
const BASIS_JE_ART: Record<PreisTeilArt, PreisBasis> = {
  kostenlos: 'einmalig', fest: 'einmalig', monatlich: 'monat', jaehrlich: 'jahr', je_einheit: 'einmalig', tagessatz: 'einmalig', stundensatz: 'einmalig', erfolg: 'einmalig',
};
/** Basis (Monat · Jahr · einmalig) eines Preis-Teils — wie er abgerechnet wird (Tages-/Stundensatz: je Menge, darum „einmalig“). */
export const basisVonTeil = (t: Pick<PreisTeil, 'art'>): PreisBasis => BASIS_JE_ART[t.art];
/** Tages- bzw. Stundensatz: abgerechnet nach Menge, GEPLANT als Satz × geplante Menge je Monat (21.10., Rundgang B4). */
export const istSatz = (art: PreisTeilArt): art is 'tagessatz' | 'stundensatz' => art === 'tagessatz' || art === 'stundensatz';
/**
 * Die geplante Menge je Monat eines Tages-/Stundensatzes (Kevin 21.10.): `mengeJeMonat`, sonst der Deckel (Stundensatz) bzw. 0; beim Stundensatz höchstens
 * der Deckel. Andere Preis-Formen: 0. EINE Regel für Finanzplanung, Mandat-Vorlage und Zusatzmodule.
 */
export function geplanteMenge(t: Pick<PreisTeil, 'art'> & Partial<Pick<PreisTeil, 'mengeJeMonat' | 'deckel'>>): number {
  if (!istSatz(t.art)) return 0;
  const d = t.art === 'stundensatz' ? t.deckel?.stundenJeMonat : undefined;
  const m = t.mengeJeMonat ?? d ?? 0;
  return d ? Math.min(m, d) : m;
}
/** „Stunden“ bzw. „Tage“ — die Einheit der geplanten Menge. */
export const mengeEinheit = (art: PreisTeilArt) => (art === 'stundensatz' ? 'Std.' : 'Tage');
/** Basis des Produkts: aus dem Hauptpreis-Teil — ohne Preis-Teile wie bisher aus dem alten Preis (auch null, wenn nichts erkennbar). */
export function preisBasisVon(l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise'>>): PreisBasis | null {
  if (hatPreisteile(l)) { const h = hauptpreis(l as Pick<Leistung, 'preis' | 'preise'>); return h ? basisVonTeil(h) : null; }
  return basisAusAltpreis(l.preis);
}
/** Kostenlos: alle Grund-Teile „kostenlos“ — ohne Preis-Teile wie bisher (Betrag 0 und Einheit „kostenlos“). */
export function istKostenlos(l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise'>>): boolean {
  if (!hatPreisteile(l)) return istKostenlosAlt(l.preis);
  const grund = l.preise!.filter(t => t.rolle === 'grund');
  return grund.length > 0 && grund.every(t => t.art === 'kostenlos');
}

const jeText = (e: string | undefined): string => {
  const t = (e ?? '').trim();
  if (!t) return 'je Einheit';
  return /^(je|pro)\s/i.test(t) ? t : `je ${t}`;
};
const EINHEIT_SPIEGEL: Record<PreisTeilArt, string> = {
  kostenlos: 'kostenlos', fest: 'pauschal netto', monatlich: 'Monat netto', jaehrlich: 'Jahr netto', je_einheit: '', tagessatz: 'Tag netto', stundensatz: 'Stunde netto', erfolg: 'Erfolg',
};
/** Ein Preis-Teil in der Form des alten Feldes `preis` (Euro, Einheit, Basis) — fürs Spiegeln. */
export function preisAusTeil(t: PreisTeil): Leistung['preis'] {
  if (t.art === 'kostenlos') return { betrag: 0, einheit: 'kostenlos', basis: 'einmalig' };
  const betrag = typeof t.betragCent === 'number' ? t.betragCent / 100 : 0;
  const bis = typeof t.betragCent === 'number' && typeof t.bisCent === 'number' && t.bisCent > t.betragCent ? t.bisCent / 100 : undefined;
  const einheit = t.art === 'je_einheit' ? `${jeText(t.einheit)} netto` : EINHEIT_SPIEGEL[t.art];
  return { betrag, ...(bis !== undefined ? { bis } : {}), einheit, basis: BASIS_JE_ART[t.art] };
}

const zahlDe = (cent: number) => (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 });
/** „2.500 €“ bzw. „2.500–3.500 €“ (null ohne Betrag). */
export function betragText(t: Pick<PreisTeil, 'betragCent' | 'bisCent'>): string | null {
  if (typeof t.betragCent !== 'number') return null;
  return typeof t.bisCent === 'number' && t.bisCent > t.betragCent ? `${zahlDe(t.betragCent)}–${zahlDe(t.bisCent)} €` : `${zahlDe(t.betragCent)} €`;
}
const zahlplanText = (p: number) => (p === 50 ? 'Zahlung 50/50' : `${p} % Anzahlung`);
/** Wie ein Preis-Teil heißt: „2.500 € netto/Monat“, „kostenlos“, „1.500 € netto je Event · Zahlung 50/50“, „Bonus bei Zielen“ … */
export function preisText(t: PreisTeil): string {
  const b = betragText(t);
  let kern: string;
  switch (t.art) {
    case 'kostenlos': kern = 'kostenlos'; break;
    case 'erfolg': kern = t.text?.trim() || (b ? `${b} bei Erfolg` : 'Erfolgsanteil'); break;
    case 'fest': kern = b ? `${b} netto einmalig` : 'Festpreis offen'; break;
    case 'monatlich': kern = b ? `${b} netto/Monat` : 'monatlich, Preis offen'; break;
    case 'jaehrlich': kern = b ? `${b} netto/Jahr` : 'jährlich, Preis offen'; break;
    case 'je_einheit': kern = b ? `${b} netto ${jeText(t.einheit)}` : `${jeText(t.einheit)}, Preis offen`; break;
    case 'tagessatz': kern = b ? `${b} netto/Tag` : 'Tagessatz offen'; break;
    case 'stundensatz': kern = b ? `${b} netto/Stunde` : 'Stundensatz offen'; break;
  }
  const extra = [
    t.kontingent?.trim() ? `inkl. ${t.kontingent.trim()}` : '',
    t.deckel?.stundenJeMonat ? `höchstens ${t.deckel.stundenJeMonat} Std./Monat` : '',
    istSatz(t.art) && typeof t.mengeJeMonat === 'number' ? `${t.mengeJeMonat.toLocaleString('de-DE')} ${mengeEinheit(t.art)}/Monat geplant` : '',
    t.zahlplan?.anzahlungProzent ? zahlplanText(t.zahlplan.anzahlungProzent) : '',
  ].filter(Boolean);
  return [kern, ...extra].join(' · ');
}
/** Der ganze Preis eines Produkts in einer Zeile: Grund-Teile, dann „optional: …“. Ohne Preis-Teile aus dem alten Preis. */
export function preiseText(l: Pick<Leistung, 'preis' | 'preise'>): string {
  const t = preisteileVon(l);
  const grund = t.filter(x => x.rolle === 'grund').map(preisText);
  const option = t.filter(x => x.rolle === 'option').map(x => `optional: ${preisText(x)}`);
  return [...grund, ...option].join(' · ') || 'Preis offen';
}

// ── Vertrag ──────────────────────────────────────────────────────────────────

/** Der Vertrag eines Produkts: `vertrag`, die Mindestlaufzeit sonst aus `laufzeitMonate` bzw. der verknüpften Treppen-Stufe. */
export function vertragVon(l: Pick<Leistung, 'vertrag' | 'laufzeitMonate'>, stufe?: Pick<TreppenStufe, 'regeln'> | null): ProduktVertrag {
  const v: ProduktVertrag = { ...(l.vertrag ?? {}) };
  if (v.mindestlaufzeitMonate == null) {
    const m = l.laufzeitMonate && l.laufzeitMonate > 0 ? Math.round(l.laufzeitMonate) : stufe?.regeln.mindestlaufzeitMonate;
    if (m) v.mindestlaufzeitMonate = m;
  }
  return v;
}

// ── Kapazität ────────────────────────────────────────────────────────────────

/**
 * Stunden je Woche aus Stunden je Takt — EINE Rechnung (auch `stufeStundenWoche` in lib/crm/treppe.ts): je Monat ×12/52, je Jahr /52,
 * sonst über die Dauer verteilt; ohne Dauer /4 (Annahme vier Wochen).
 */
export function wochenStunden(stunden: number, takt: PreisBasis, dauerTage?: number): { stunden: number; annahme: boolean } {
  if (takt === 'monat') return { stunden: (stunden * 12) / 52, annahme: false };
  if (takt === 'jahr') return { stunden: stunden / 52, annahme: false };
  if (dauerTage) return { stunden: stunden / Math.max(1, dauerTage / 7), annahme: false };
  return { stunden: stunden / 4, annahme: true };
}
/** Takt der (gespeicherten) Treppen-Stufe für `wochenStunden`. */
export const stufenTakt = (art: TreppenStufe['preis']['art']): PreisBasis => (art === 'monat' ? 'monat' : art === 'jahr' ? 'jahr' : 'einmalig');

/**
 * Stunden je Woche, die EIN Kunde dieses Produkts bindet: `aufwandStundenWoche` (die Karte) → `aufwand.stunden` (je Preis-Einheit, alt) →
 * die verknüpfte Treppen-Stufe. null ohne jeden Aufwand.
 */
export function kapazitaetStundenWoche(
  l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise' | 'aufwand' | 'aufwandStundenWoche' | 'dauerTage'>>,
  stufe?: Pick<TreppenStufe, 'aufwandStunden' | 'preis' | 'dauerTage' | 'wochenAufwand'> | null,
): { stunden: number; annahme: boolean } | null {
  if (typeof l.aufwandStundenWoche === 'number' && l.aufwandStundenWoche > 0) return { stunden: l.aufwandStundenWoche, annahme: false };
  const je = l.aufwand?.stunden;
  if (typeof je === 'number' && je > 0) return wochenStunden(je, preisBasisVon(l) ?? 'einmalig', l.dauerTage ?? stufe?.dauerTage);
  if (stufe?.wochenAufwand) return stufe.wochenAufwand;
  if (stufe?.aufwandStunden) return wochenStunden(stufe.aufwandStunden, stufenTakt(stufe.preis.art), stufe.dauerTage);
  return null;
}

// ── Die Karte (zusammengeführte Sicht) ───────────────────────────────────────

export interface ProduktKarte {
  id: string; name: string; gesellschaft: Gesellschaft; status: Leistung['status'];
  /** Trägt das Produkt Felder der Karte? (sonst ist es Altbestand und die Treppe nimmt die gespeicherte Stufe) */
  istKarte: boolean;
  rolle: ProduktRolle;
  /** Ebene der Treppe (Karte, sonst gespeicherte Stufe) — null: nicht auf der Treppe. */
  ebene: number | null;
  preise: PreisTeil[];
  hauptpreis: PreisTeil | null;
  preisText: string;
  vertrag: ProduktVertrag;
  regeln: ProduktRegeln & { anrechnungText?: string; bonus?: string };
  aufgabe?: string; ergebnis?: string; kennzahl?: string; dauerTage?: number;
  lieferumfang: string[];
  aufwand: { stunden: number; annahme: boolean } | null;
  ziel?: { umsatz?: number; kunden?: number };
  /** Kennung der gespeicherten Treppen-Stufe, die an diesem Produkt hängt (falls übergeben). */
  stufeId?: string;
  geaendert: string;
}
const STUFEN_ART: Record<TreppenStufe['preis']['art'], PreisTeilArt> = { kostenlos: 'kostenlos', fest: 'fest', monat: 'monatlich', jahr: 'jaehrlich' };
/** Ist der Preis „offen“ (kein Betrag, nicht kostenlos)? Dann darf eine gespeicherte Stufe ihn füllen. */
const preisOffen = (t: PreisTeil[]) => t.every(x => x.art !== 'kostenlos' && x.art !== 'erfolg' && typeof x.betragCent !== 'number');
const nameVon = (id: string, alle?: readonly Pick<Leistung, 'id' | 'name'>[]) => alle?.find(x => x.id === id)?.name ?? id;

/**
 * Die zusammengeführte Sicht eines Produkts: die Karte gewinnt, die gespeicherte Treppen-Stufe (falls übergeben) füllt nur Leeres.
 * `alle` (optional): der Katalog — für die Namen in „angerechnet auf …“.
 */
export function produktKarte(l: Leistung, stufe?: TreppenStufe | null, alle?: readonly Pick<Leistung, 'id' | 'name'>[]): ProduktKarte {
  let preise = preisteileVon(l);
  if (stufe && !hatPreisteile(l) && preisOffen(preise) && (stufe.preis.art === 'kostenlos' || typeof stufe.preis.betrag === 'number')) {
    const b = stufe.preis.art !== 'kostenlos' && typeof stufe.preis.betrag === 'number' ? inCent(stufe.preis.betrag) : undefined;
    preise = [{ id: ALT_TEIL_ID, art: STUFEN_ART[stufe.preis.art], ...(b !== undefined ? { betragCent: b } : {}), rolle: 'grund' }];
  }
  const h = hauptpreisAus(preise);
  const r = l.regeln ?? {};
  const erfolg = preise.find(x => x.art === 'erfolg');
  const anrechnungText = r.anrechnung?.auf.length ? `${r.anrechnung.anteilProzent === 100 ? 'voll' : `zu ${r.anrechnung.anteilProzent} %`} angerechnet auf ${r.anrechnung.auf.map(id => nameVon(id, alle)).join(', ')}` : stufe?.regeln.anrechnung;
  const bonus = erfolg ? (erfolg.text?.trim() || preisText(erfolg)) : stufe?.regeln.bonus;
  const maxG = r.maxGleichzeitig ?? stufe?.regeln.maxGleichzeitig;
  const ziel = l.ziel || stufe?.ziel ? { ...(stufe?.ziel ?? {}), ...(l.ziel ?? {}) } : undefined;
  const ebene = l.ebene ?? stufe?.ebene ?? null;
  const dauer = l.dauerTage ?? stufe?.dauerTage;
  return {
    id: l.id, name: l.name, gesellschaft: l.gesellschaft, status: l.status, istKarte: istKarte(l), rolle: l.rolle ?? 'haupt', ebene,
    preise, hauptpreis: h, preisText: [...preise.filter(x => x.rolle === 'grund').map(preisText), ...preise.filter(x => x.rolle === 'option').map(x => `optional: ${preisText(x)}`)].join(' · ') || 'Preis offen',
    vertrag: vertragVon(l, stufe),
    regeln: { ...r, ...(maxG ? { maxGleichzeitig: maxG } : {}), ...(anrechnungText ? { anrechnungText } : {}), ...(bonus ? { bonus } : {}) },
    ...((l.aufgabe ?? stufe?.aufgabe) ? { aufgabe: l.aufgabe ?? stufe?.aufgabe } : {}),
    ...((l.ergebnis ?? stufe?.ergebnis) ? { ergebnis: l.ergebnis ?? stufe?.ergebnis } : {}),
    ...((l.kennzahl ?? stufe?.kennzahl) ? { kennzahl: l.kennzahl ?? stufe?.kennzahl } : {}),
    ...(dauer ? { dauerTage: dauer } : {}),
    lieferumfang: l.lieferumfang?.length ? l.lieferumfang : stufe?.lieferobjekte ?? [],
    aufwand: kapazitaetStundenWoche(l, stufe),
    ...(ziel && (ziel.umsatz || ziel.kunden) ? { ziel } : {}),
    ...(stufe ? { stufeId: stufe.id } : {}),
    geaendert: l.geaendert,
  };
}

// ── Treppe = Ansicht der Karten ──────────────────────────────────────────────

const fnv = (s: string): string => { let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0; } return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'); };
const STUFE_KENNUNG = /^ts-[a-z0-9-]{4,60}$/;
/** Kennung der Stufe eines Produkts ohne gespeicherte Stufe — fest aus der Produkt-Kennung (Kundenfortschritt `stufeId` bleibt gültig). */
export function katalogStufeId(leistungId: string): string {
  const roh = `ts-k-${leistungId.toLowerCase()}`;
  return STUFE_KENNUNG.test(roh) ? roh : `ts-k-${fnv(leistungId)}`;
}

export interface KatalogTreppe {
  /** Die Stufen, mit denen lib/crm/treppe.ts rechnet (gespeicherte zuerst in ihrer Reihenfolge, dann neue aus dem Katalog nach Ebene/Name). */
  stufen: TreppenStufe[];
  /** Gespeicherte Stufen, an denen kein (vorhandenes) Produkt hängt — „Stufe ohne Produkt“ (sie rechnen weiter mit, nichts geht verloren). */
  ohneProdukt: TreppenStufe[];
  /** Je Stufe: aus welchem Produkt, ob gespeichert, ob die Karte gewinnt. */
  herkunft: Record<string, { leistungId?: string; gespeichert: boolean; karte: boolean }>;
}

/** Eine Stufe aus der Karte — Karte gewinnt, die gespeicherte Stufe füllt nur Leeres, ihre Kennung bleibt. */
function stufeAusKarte(l: Leistung, s: TreppenStufe | undefined, id: string, leistungIds: string[], alle: readonly Leistung[], ebeneVorgabe?: number): TreppenStufe {
  const k = produktKarte(l, s, alle);
  const h = k.hauptpreis;
  const betrag = h && h.art !== 'kostenlos' && typeof h.betragCent === 'number' ? h.betragCent / 100 : undefined;
  const preis: TreppenStufe['preis'] = h
    ? { art: h.art === 'kostenlos' ? 'kostenlos' : h.art === 'monatlich' ? 'monat' : h.art === 'jaehrlich' ? 'jahr' : 'fest', ...(betrag !== undefined ? { betrag } : {}) }
    : s?.preis ?? { art: 'fest' };
  const regeln: TreppenStufe['regeln'] = {
    ...(k.vertrag.mindestlaufzeitMonate ? { mindestlaufzeitMonate: k.vertrag.mindestlaufzeitMonate } : {}),
    ...(k.regeln.anrechnungText ? { anrechnung: k.regeln.anrechnungText } : {}),
    ...(k.regeln.bonus ? { bonus: k.regeln.bonus } : {}),
    ...(k.regeln.maxGleichzeitig ? { maxGleichzeitig: k.regeln.maxGleichzeitig } : {}),
  };
  return {
    id, name: l.name, ebene: k.ebene ?? ebeneVorgabe ?? 1,
    ...(k.aufgabe ? { aufgabe: k.aufgabe } : {}), ...(k.ergebnis ? { ergebnis: k.ergebnis } : {}),
    lieferobjekte: k.lieferumfang,
    ...(k.kennzahl ? { kennzahl: k.kennzahl } : {}), ...(k.dauerTage ? { dauerTage: k.dauerTage } : {}),
    ...(s?.aufwandStunden ? { aufwandStunden: s.aufwandStunden } : {}),
    preis, regeln, leistungIds,
    ...(k.ziel ? { ziel: k.ziel } : {}),
    ...(k.aufwand ? { wochenAufwand: k.aufwand } : {}),
    geaendert: s?.geaendert ?? l.geaendert, geaendertVon: s?.geaendertVon ?? '',
  };
}

/**
 * Die Treppe aus dem Katalog (PRODUKTE_KONZEPT.md „Treppe = Ansicht der Karten“). Rein. Regeln:
 *  · Jede gespeicherte Stufe gehört dem ersten Produkt ihrer `leistungIds`, das es (außerhalb des Papierkorbs) gibt und das noch keine Stufe hat.
 *    Ist dieses Produkt noch keine Karte (`istKarte`), bleibt die gespeicherte Stufe GENAU so (Altbestand bit-gleich); ist es eine Karte,
 *    gewinnt die Karte und die Stufe füllt nur Leeres — die Kennung der Stufe bleibt (Kundenfortschritt `stufeId`, Verlauf).
 *  · Jede weitere Karte mit Ebene (eigene oder aus einer verknüpften Stufe) bekommt eine eigene Stufe (`katalogStufeId`) und fällt aus den
 *    `leistungIds` der gespeicherten Stufe heraus. Neue Stufen nur für Business-Produkte, die nicht eingestellt sind.
 *  · Gespeicherte Stufen ohne vorhandenes Produkt bleiben in `stufen` (rechnen weiter mit) und stehen zusätzlich in `ohneProdukt`.
 */
export function katalogTreppe(leistungen: readonly Leistung[], gespeicherte: readonly TreppenStufe[]): KatalogTreppe {
  const alle = leistungen.filter(l => !l.geloeschtAm);
  const nach = new Map(alle.map(l => [l.id, l]));
  const besitzer = new Map<string, Leistung>();
  const besessen = new Set<string>();
  for (const s of gespeicherte) {
    const l = s.leistungIds.map(id => nach.get(id)).find((x): x is Leistung => !!x && !besessen.has(x.id));
    if (l) { besitzer.set(s.id, l); besessen.add(l.id); }
  }
  // Karten, die eine eigene (neue) Stufe bekommen: mit Ebene, nicht Besitzer einer gespeicherten Stufe.
  const verknuepft = (id: string) => gespeicherte.find(s => s.leistungIds.includes(id));
  const eigene = alle.filter(l => istKarte(l) && !besessen.has(l.id) && l.status !== 'eingestellt' && bereichVonGesellschaft(l.gesellschaft) === 'business'
    && (l.ebene ?? verknuepft(l.id)?.ebene) != null);
  const eigeneIds = new Set(eigene.map(l => l.id));
  const herkunft: KatalogTreppe['herkunft'] = {};
  const ohneProdukt: TreppenStufe[] = [];
  const stufen: TreppenStufe[] = gespeicherte.map(s => {
    const l = besitzer.get(s.id);
    if (!l) { ohneProdukt.push(s); herkunft[s.id] = { gespeichert: true, karte: false }; }
    const ids = s.leistungIds.some(id => eigeneIds.has(id)) ? s.leistungIds.filter(id => !eigeneIds.has(id)) : s.leistungIds;
    if (!l || !istKarte(l)) {
      if (l) herkunft[s.id] = { leistungId: l.id, gespeichert: true, karte: false };
      return ids === s.leistungIds ? s : { ...s, leistungIds: ids };
    }
    herkunft[s.id] = { leistungId: l.id, gespeichert: true, karte: true };
    return stufeAusKarte(l, s, s.id, ids, alle);
  });
  const vergeben = new Set(stufen.map(s => s.id));
  const neu = eigene.map(l => {
    let id = katalogStufeId(l.id);
    if (vergeben.has(id)) id = `ts-k-${fnv(`${l.id}|neu`)}`;
    vergeben.add(id);
    herkunft[id] = { leistungId: l.id, gespeichert: false, karte: true };
    // Die verknüpfte Stufe gehört einem anderen Produkt — sie gibt nur die Ebene vor, wenn die Karte keine eigene trägt (sonst nichts).
    return stufeAusKarte(l, undefined, id, [l.id], alle, verknuepft(l.id)?.ebene);
  }).sort((a, b) => a.ebene - b.ebene || a.name.localeCompare(b.name));
  return { stufen: [...stufen, ...neu], ohneProdukt, herkunft };
}
/** Die Stufen, mit denen lib/crm/treppe.ts rechnet — Altbestand ohne Karten: genau die gespeicherten (bit-gleich). */
export const stufenAusKatalog = (leistungen: readonly Leistung[], gespeicherte: readonly TreppenStufe[]): TreppenStufe[] => katalogTreppe(leistungen, gespeicherte).stufen;
/** Gespeicherte Stufen ohne Produkt („Als Produkt anlegen“ — nur auf Klick, nie automatisch). */
export const stufenOhneProdukt = (leistungen: readonly Leistung[], gespeicherte: readonly TreppenStufe[]): TreppenStufe[] => katalogTreppe(leistungen, gespeicherte).ohneProdukt;
/** Die Treppe zum Rechnen: dieselbe Datei, die Stufen aus dem Katalog (nie speichern — geschrieben wird nur die gespeicherte Datei). */
export const treppeMitKatalog = <T extends Pick<TreppeDatei, 'stufen'>>(datei: T, leistungen: readonly Leistung[]): T => ({ ...datei, stufen: stufenAusKatalog(leistungen, datei.stufen) });

// ── Mandat übernimmt den Vertrag ─────────────────────────────────────────────

/**
 * Monatshonorar + Rechnungsrhythmus aus einem Preis (Produkt bzw. Deal-Wert) — EINE Stelle für „+ Mandat“ und „Mandat aus Deal“ (Prüf-Fund
 * 11.10.: ein Jahrespreis stand sonst 12-fach als Monatshonorar im Mandat). „je Jahr“ → ÷ 12 auf den Cent, „einmalig“ bleibt einmalig, sonst monatlich.
 * (Bis 19.10. in lib/crm/mandat-anlegen.ts — dort weiter exportiert.)
 */
export function honorarAusPreis(p: { betrag?: number | null; basis?: 'monat' | 'jahr' | 'einmalig' | null } | null | undefined): { honorar: Mandat['honorar']; rechnungsrhythmus: Mandat['rechnungsrhythmus'] } {
  const roh = typeof p?.betrag === 'number' && Number.isFinite(p.betrag) ? p.betrag : 0;
  const einmalig = p?.basis === 'einmalig';
  const betrag = p?.basis === 'jahr' ? Math.round((roh / 12) * 100) / 100 : roh;
  return { honorar: { betrag, basis: einmalig ? 'einmalig' : 'monat', netto: true }, rechnungsrhythmus: einmalig ? 'einmalig' : 'monatlich' };
}

export interface MandatVorlage {
  titel: string;
  leistungId: string;
  art: ChancenArt;
  /** Die Gesellschaft des Produkts (fehlt bei „offen“). */
  gesellschaft?: Gesellschaft;
  honorar: Mandat['honorar'];
  rechnungsrhythmus: Mandat['rechnungsrhythmus'];
  mindestlaufzeitMonate?: number;
  kuendigungsfristTage?: number;
  verlaengerung?: Mandat['verlaengerung'];
  zahlungszielTage?: number;
  ustSatz?: number;
  /** Leistungen des Mandats: Leistungstext (wenn kurz genug für die Liste, ≤ 400 Zeichen) + Lieferumfang. */
  leistungen: string[];
  zusatz?: MandatZusatz[];
  /** Zahlplan des einmaligen Honorars (21.10., B2): vom Festpreis-Hauptpreis, z. B. 50/50 — nur bei Honorar-Basis „einmalig“. */
  zahlplan?: { anzahlungProzent: number };
  /** Tagessatz (21.10., B4): geplante Tage je Monat (`geplanteMenge`) — nur bei Honorar-Basis „tag“. */
  tageJeMonat?: number;
  /** Was die Vorlage nicht als Feld ausdrücken kann (Stundensatz ohne Deckel, je Einheit …) — für die offenen Punkte am Mandat. */
  hinweise: string[];
}
export interface ZusatzWahl { leistung: Leistung; ab?: string; bis?: string; inklusive?: boolean }

const ART_AUS_TYP: Partial<Record<Leistung['typ'], ChancenArt>> = { workshop: 'workshop', vermittlung: 'vermittlung', software: 'software' };
/** Art des Mandats aus der Karte: Typ (Workshop/Vermittlung/Software), sonst die Preis-Form des Hauptpreises. */
export function mandatArtVon(l: Pick<Leistung, 'typ' | 'preis' | 'preise'>): ChancenArt {
  const t = ART_AUS_TYP[l.typ];
  if (t) return t;
  const h = hauptpreis(l);
  return h?.art === 'monatlich' || h?.art === 'jaehrlich' ? 'retainer' : h?.art === 'erfolg' ? 'vermittlung' : 'projekt';
}
const ZUSATZ_BASIS: Partial<Record<PreisTeilArt, MandatZusatzBasis>> = { monatlich: 'monat', jaehrlich: 'jahr', fest: 'einmalig', je_einheit: 'einheit', tagessatz: 'tag', stundensatz: 'stunde' };
/** Honorar eines Zusatzmoduls aus einem Preis-Teil (Cent) — ohne Betrag bzw. kostenlos/Erfolg: keins. */
export function teilHonorar(t: PreisTeil | null | undefined): MandatZusatz['honorar'] | undefined {
  const basis = t ? ZUSATZ_BASIS[t.art] : undefined;
  return t && basis && typeof t.betragCent === 'number' ? { betragCent: t.betragCent, basis } : undefined;
}
/** Honorar eines Zusatzmoduls aus dem Hauptpreis seines Produkts (Cent) — ohne Betrag bzw. kostenlos/Erfolg: keins. */
export function zusatzHonorar(l: Pick<Leistung, 'preis' | 'preise'>): MandatZusatz['honorar'] | undefined {
  return teilHonorar(hauptpreis(l));
}
/**
 * Was ein Zusatzmodul zusätzlich von einem Preis-Teil übernimmt: den Zahlplan eines Festpreises (z. B. 50/50), beim Stundensatz die geplanten Stunden
 * (`mengeJeMonat`, sonst der Deckel), beim Tagessatz die geplanten Tage (21.10., B4). Ohne beides: `{}`.
 */
export function teilExtras(t: PreisTeil | null | undefined): Pick<MandatZusatz, 'zahlplan' | 'stundenJeMonat' | 'tageJeMonat'> {
  if (!t) return {};
  const menge = geplanteMenge(t);
  return {
    ...(t.art === 'fest' && t.zahlplan?.anzahlungProzent ? { zahlplan: { anzahlungProzent: t.zahlplan.anzahlungProzent } } : {}),
    ...(t.art === 'stundensatz' && menge > 0 ? { stundenJeMonat: menge } : {}),
    ...(t.art === 'tagessatz' && menge > 0 ? { tageJeMonat: menge } : {}),
  };
}
/**
 * Was ein Zusatzmodul zusätzlich vom Hauptpreis seines Produkts übernimmt (P3, 19.10.): den Zahlplan eines einmaligen Preises (z. B. 50/50) und beim
 * Stundensatz den Deckel als geplante Stunden je Monat (Liquidität). Ohne Preis-Teile bzw. ohne beides: `{}`.
 */
export function zusatzExtras(l: Pick<Leistung, 'preis' | 'preise'>): Pick<MandatZusatz, 'zahlplan' | 'stundenJeMonat' | 'tageJeMonat'> {
  return hatPreisteile(l) ? teilExtras(hauptpreis(l)) : {};
}

// ── Eigene Preis-Teile als Zusatzmodule (24.10., Bau-Test: „Mandat verliert Preis-Teile“) ─────────────────────────────────────────────

/** Kennung des Zusatzmoduls für einen eigenen Preis-Teil des Hauptprodukts — fest aus der Teil-Kennung (mehrfach gerechnet = dieselbe). */
export const eigeneZusatzId = (teilId: string) => `mz-e-${teilId.replace(/^pt-/, '').slice(0, 56)}`;
/** Ist das Produkt eine Kombination (mehr als ein Preis-Teil)? Nur dann tragen weitere Teile eigene Zusatzmodule — ein Preis bleibt bit-gleich. */
export const istKombi = (l: Pick<Leistung, 'preise'>): boolean => Array.isArray(l.preise) && l.preise.length > 1;
/**
 * Ein eigener Preis-Teil des Hauptprodukts als Zusatzmodul des Mandats (24.10.) — über das VORHANDENE Modell (`MandatZusatz`, Rechnung und Liquidität in
 * lib/crm/mandat-zusatz.ts): `leistungId` = das Hauptprodukt, `preisTeilId` = der Teil; Honorar und Extras aus dem Teil (Festpreis mit Zahlplan → Anzahlung
 * im Monat des Beginns, Rest nach der vorhandenen Regel; Tagessatz mit geplanten Tagen → Liquidität plant Satz × Tage, abgerechnet über „abrechnen“).
 * `honorarCent`/`menge` überschreiben (Angebot: verhandelter Preis, geplante Menge). null ohne Betrag (kostenlos, Erfolg ohne Betrag).
 */
export function zusatzAusTeil(l: Pick<Leistung, 'id'>, t: PreisTeil, opt: { honorarCent?: number; menge?: number; ab?: string } = {}): MandatZusatz | null {
  const h = teilHonorar(t);
  if (!h) return null;
  const extras = teilExtras(t);
  const menge = opt.menge !== undefined && opt.menge > 0 ? Math.round(opt.menge * 100) / 100 : undefined;
  return {
    id: eigeneZusatzId(t.id), leistungId: l.id, preisTeilId: t.id, ...(opt.ab ? { ab: opt.ab } : {}),
    honorar: { betragCent: opt.honorarCent ?? h.betragCent, basis: h.basis },
    ...extras,
    ...(menge !== undefined && t.art === 'tagessatz' ? { tageJeMonat: menge } : {}),
    ...(menge !== undefined && t.art === 'stundensatz' ? { stundenJeMonat: Math.min(menge, t.deckel?.stundenJeMonat ?? menge) } : {}),
  };
}
/**
 * Die eigenen Preis-Teile eines Produkts, die ein Mandat noch als Zusatzmodul aufnehmen kann („+ Zusatzmodul“, 24.10.): nur bei einer Kombination, ohne den
 * Hauptpreis (er ist das Honorar), ohne Teile ohne Betrag und ohne die schon übernommenen (`vorhanden` = `preisTeilId` der Module).
 */
export function eigeneTeileOffen(l: Pick<Leistung, 'preis' | 'preise'>, vorhanden: readonly (string | undefined)[]): PreisTeil[] {
  if (!istKombi(l)) return [];
  const h = hauptpreis(l);
  return l.preise!.filter(t => t !== h && !!teilHonorar(t) && !vorhanden.includes(t.id));
}
const VERLAENGERUNG: Record<NonNullable<ProduktVertrag['danach']>, Mandat['verlaengerung']> = { monatlich_kuendbar: 'auto', verlaengert_um_laufzeit: 'auto', endet: 'manuell' };
export type MandatVertragsFelder = Partial<Pick<Mandat, 'mindestlaufzeitMonate' | 'kuendigungsfristTage' | 'verlaengerung' | 'rechnungsrhythmus' | 'zahlungszielTage' | 'ustSatz'>>;
/**
 * Die Vertragsfelder eines Mandats aus der Karte (`vertragVon`): Mindestlaufzeit, Kündigungsfrist, Verlängerung („danach“), Rechnungsrhythmus
 * (nur, wenn er zur Honorar-Basis passt — einmalig ↔ einmalig), Zahlungsziel, USt. Ohne Karten-Felder: `{}` (alles wie bisher).
 */
export function mandatVertragAusProdukt(l: Leistung, honorarBasis?: Mandat['honorar']['basis']): MandatVertragsFelder {
  if (!istKarte(l)) return {};
  const v = vertragVon(l);
  const rh = v.rechnungsrhythmus && (honorarBasis === undefined || (honorarBasis === 'einmalig') === (v.rechnungsrhythmus === 'einmalig')) ? v.rechnungsrhythmus : undefined;
  return {
    ...(v.mindestlaufzeitMonate ? { mindestlaufzeitMonate: v.mindestlaufzeitMonate } : {}),
    ...(v.kuendigungsfristTage != null ? { kuendigungsfristTage: v.kuendigungsfristTage } : {}),
    ...(v.danach ? { verlaengerung: VERLAENGERUNG[v.danach] } : {}),
    ...(rh ? { rechnungsrhythmus: rh } : {}),
    ...(v.zahlungszielTage != null ? { zahlungszielTage: v.zahlungszielTage } : {}),
    ...(v.ustSatz != null ? { ustSatz: v.ustSatz } : {}),
  };
}

/**
 * Die Mandatsfelder aus einem Produkt (PRODUKTE_KONZEPT.md „Mandat übernimmt den Vertrag“) — rein. Genutzt von „+ Mandat“ (`mandatEntwurf`),
 * Mandat aus Deal/angenommenem Angebot (`mandatVorbelegung`) und künftig „Mandat aus Produkt anlegen“ (P3).
 * Ohne Karten-Felder genau wie bisher „+ Mandat“: Titel, Produkt, Art „retainer“, Honorar aus dem alten Preis (`honorarAusPreis`), keine Leistungen.
 */
export function mandatVorlageAusProdukt(l: Leistung, zusatz: readonly ZusatzWahl[] = [], opt: { optionen?: readonly string[] } = {}): MandatVorlage {
  const gesellschaft = l.gesellschaft && l.gesellschaft !== 'offen' ? { gesellschaft: l.gesellschaft } : {};
  // 24.10. (Bau-Test): jeder weitere Preis-Teil einer Kombination wird ein Zusatzmodul (Grund-Teile immer, Optionen nur gewählt) — vorher standen sie nur
  // als Namen unter „Leistungen“ und wurden nie abgerechnet. Ein Produkt mit EINEM Preis: keine (bit-gleich).
  const eigene = eigeneZusatzModule(l, opt.optionen ?? []);
  const zu = [...eigene.module, ...zusatzListe(l, zusatz)];
  const mitZusatz = zu.length ? { zusatz: zu } : {};
  if (!istKarte(l)) return { titel: l.name, leistungId: l.id, art: 'retainer', ...gesellschaft, ...honorarAusPreis(l.preis), leistungen: [], ...mitZusatz, hinweise: [] };
  const hinweise: string[] = [];
  const h = hauptpreis(l);
  const euro = typeof h?.betragCent === 'number' ? h.betragCent / 100 : 0;
  let honorar: { honorar: Mandat['honorar']; rechnungsrhythmus: Mandat['rechnungsrhythmus'] };
  switch (h?.art) {
    case 'monatlich': honorar = honorarAusPreis({ betrag: euro, basis: 'monat' }); break;
    case 'jaehrlich': honorar = honorarAusPreis({ betrag: euro, basis: 'jahr' }); break;
    case 'tagessatz': honorar = { honorar: { betrag: euro, basis: 'tag', netto: true }, rechnungsrhythmus: 'monatlich' }; break;
    case 'stundensatz': {
      // Geplante Stunden (21.10., B4): `mengeJeMonat`, sonst der Deckel — höchstens der Deckel.
      const n = geplanteMenge(h);
      const d = h.deckel?.stundenJeMonat;
      honorar = n ? honorarAusPreis({ betrag: Math.round(euro * n * 100) / 100, basis: 'monat' }) : { honorar: { betrag: 0, basis: 'monat', netto: true }, rechnungsrhythmus: 'monatlich' };
      hinweise.push(n ? `Stundensatz ${betragText(h)} netto${d ? `, höchstens ${d} Std./Monat` : ''}${n !== d ? `, ${n} Std./Monat geplant` : ''} — als Monatshonorar stehen die geplanten Stunden; nach Aufwand abrechnen.` : `Stundensatz ${betragText(h) ?? 'offen'} netto — Honorar nach Aufwand eintragen.`);
      break;
    }
    case 'je_einheit': honorar = honorarAusPreis({ betrag: euro, basis: 'einmalig' }); hinweise.push(`Preis ${jeText(h.einheit)} — Menge beim Abrechnen angeben.`); break;
    case 'erfolg': honorar = honorarAusPreis({ betrag: 0, basis: 'einmalig' }); hinweise.push(`Erfolgsanteil: ${preisText(h)} — Höhe beim Abrechnen festlegen.`); break;
    case 'kostenlos': honorar = honorarAusPreis({ betrag: 0, basis: 'einmalig' }); break;
    default: honorar = honorarAusPreis({ betrag: euro, basis: 'einmalig' });
  }
  const texte = [l.angebot?.leistungstext?.trim() ?? '', ...(l.lieferumfang ?? [])].filter(t => t && t.length <= 400);
  // Zahlplan (21.10., B2): ein Festpreis mit Anzahlung (z. B. 50/50) wird am Mandat zwei Zahlungen — wie beim einmaligen Zusatzmodul.
  const zahlplan = mandatZahlplanAusProdukt(l, honorar.honorar.basis);
  // Tagessatz (21.10., B4): die geplanten Tage je Monat — die Liquidität plant Satz × Tage, die Rechnung nimmt die echten Tage.
  const tage = h?.art === 'tagessatz' ? geplanteMenge(h) : 0;
  return {
    titel: l.name, leistungId: l.id, art: mandatArtVon(l), ...gesellschaft, ...honorar, ...mandatVertragAusProdukt(l, honorar.honorar.basis),
    leistungen: texte, ...mitZusatz, ...(zahlplan ? { zahlplan } : {}), ...(tage > 0 ? { tageJeMonat: tage } : {}), hinweise: [...hinweise, ...eigene.hinweise],
  };
}
/**
 * Die eigenen Preis-Teile einer Kombination als Zusatzmodule (`zusatzAusTeil`): alle Grund-Teile außer dem Hauptpreis, dazu die gewählten Optionen.
 * Teile ohne Betrag (Erfolgsanteil) werden ein offener Punkt. Ohne Kombination: keine.
 */
export function eigeneZusatzModule(l: Pick<Leistung, 'id' | 'preis' | 'preise'>, optionen: readonly string[]): { module: MandatZusatz[]; hinweise: string[] } {
  if (!istKombi(l)) return { module: [], hinweise: [] };
  const h = hauptpreis(l);
  const liste: MandatZusatz[] = [];
  const hinweise: string[] = [];
  for (const t of l.preise!) {
    if (t === h || !(t.rolle === 'grund' || optionen.includes(t.id))) continue;
    const z = zusatzAusTeil(l, t);
    if (z) liste.push(z);
    else if (t.art === 'erfolg') hinweise.push(`Erfolgsanteil: ${preisText(t)} — Höhe beim Abrechnen festlegen.`);
  }
  return { module: liste, hinweise };
}
/**
 * Der Zahlplan eines Mandats aus dem Produkt (21.10., Rundgang B2 — EINE Regel für „+ Mandat“, Mandat aus Deal und aus angenommenem Angebot): der
 * Zahlplan des Hauptpreis-Teils, wenn er ein Festpreis ist und das Mandat einmalig abrechnet; sonst keiner.
 */
export function mandatZahlplanAusProdukt(l: Pick<Leistung, 'preis' | 'preise'>, honorarBasis: Mandat['honorar']['basis']): { anzahlungProzent: number } | undefined {
  if (honorarBasis !== 'einmalig' || !hatPreisteile(l)) return undefined;
  const h = hauptpreis(l);
  return h?.art === 'fest' && h.zahlplan?.anzahlungProzent ? { anzahlungProzent: h.zahlplan.anzahlungProzent } : undefined;
}

/** Zusatzmodule: die gewählten (mit Honorar aus ihrem Hauptpreis) und die laut `regeln.inklusive` enthaltenen (0 € mit Hinweis). */
function zusatzListe(l: Leistung, wahl: readonly ZusatzWahl[]): MandatZusatz[] {
  const inkl = l.regeln?.inklusive ?? [];
  const out: MandatZusatz[] = wahl.map((w, i) => {
    const i2 = inkl.find(x => x.leistungId === w.leistung.id);
    const honorar = zusatzHonorar(w.leistung);
    const inklusive = w.inklusive ?? !!i2;
    return {
      id: `mz-${i + 1}`, leistungId: w.leistung.id, ...(w.ab ? { ab: w.ab } : {}), ...(w.bis ? { bis: w.bis } : {}),
      ...(honorar && !inklusive ? { honorar, ...zusatzExtras(w.leistung) } : {}), ...(inklusive ? { inklusive: true } : {}), ...(i2 && inklusive ? { menge: i2.menge, je: i2.je } : {}),
    };
  });
  for (const x of inkl) if (!out.some(z => z.leistungId === x.leistungId)) out.push({ id: `mz-${out.length + 1}`, leistungId: x.leistungId, inklusive: true, menge: x.menge, je: x.je });
  return out;
}

// ── Platzgrenze „höchstens N gleichzeitig“ (21.10., Rundgang B3 — Kevin: warnen, aber erlauben) ──────────────────────

export interface PlatzLage { max: number; belegt: number; voll: boolean }
/**
 * Die Plätze eines Produkts mit „höchstens N gleichzeitig“ (Regel der Karte, sonst die der Treppen-Stufe `stufeMax`): belegt = aktive Mandate dieses
 * Produkts außerhalb des Papierkorbs (dieselbe Zählung wie „n/N Plätze“ im Katalog). `voll` = ein weiteres Mandat ginge über die Grenze. null ohne Grenze.
 * Angelegt wird trotzdem — die Oberfläche fragt vorher („Alle N Plätze belegt — trotzdem anlegen?“), der Server gibt danach einen Hinweis.
 */
export function plaetzeVonProdukt(l: Pick<Leistung, 'id'> & Partial<Pick<Leistung, 'regeln'>>, mandate: readonly Pick<Mandat, 'leistungId' | 'status' | 'geloeschtAm'>[], stufeMax?: number | null): PlatzLage | null {
  const max = l.regeln?.maxGleichzeitig ?? stufeMax ?? undefined;
  if (!max) return null;
  const belegt = mandate.filter(m => m.leistungId === l.id && m.status === 'aktiv' && !m.geloeschtAm).length;
  return { max, belegt, voll: belegt >= max };
}
const platzWort = (n: number) => (n === 1 ? 'Platz' : 'Plätze');
/** Die Rückfrage vor dem Anlegen (Kevin 21.10.). */
export const platzFrage = (p: PlatzLage, name: string) => `Alle ${p.max} ${platzWort(p.max)} von „${name}“ belegt (${p.belegt}/${p.max}) — trotzdem anlegen?`;
/** Der Hinweis des Servers, wenn über der Grenze angelegt wurde (`p` = die Lage VOR dem Anlegen). */
export const platzHinweis = (p: PlatzLage, name: string) => `Über der Platzgrenze angelegt: „${name}“ hat jetzt ${p.belegt + 1} laufende Mandate, vorgesehen sind höchstens ${p.max} gleichzeitig.`;

// ── Angebot ──────────────────────────────────────────────────────────────────

/** Längen einer Angebots-Position (= `ANGEBOT_GRENZEN.titel/text` in lib/crm/angebote.ts, die von hier liest). */
export const POSITION_GRENZEN = { titel: 200, text: 6000 } as const;
/** Einheit der Angebots-Position je Basis. */
export const ANGEBOT_EINHEIT_JE_BASIS: Record<AngebotBasis, string> = { einmalig: 'pauschal', monat: 'Monat', jahr: 'Jahr' };

/** Positionstext aus den Angebotstexten des Produkts (Leistungstext, Ergebnis, Hinweise) — ohne Angebotstext: Beschreibung + Lieferumfang. */
export function positionsText(l: Pick<Leistung, 'angebot' | 'beschreibung' | 'lieferumfang' | 'ergebnis'>, opt: { lieferumfang?: boolean } = {}): string {
  const a = l.angebot;
  if (a?.leistungstext?.trim()) {
    // 24.10. (Bau-Test, Reibung): der Lieferumfang der Karte steht im Angebot (Punkte, nur was der Leistungstext nicht schon sagt) — nur für Karten.
    const lt = a.leistungstext.trim();
    const punkte = opt.lieferumfang ? (l.lieferumfang ?? []).map(x => x.trim()).filter(x => x && !lt.includes(x)) : [];
    return [lt, punkte.length ? punkte.map(x => `• ${x}`).join('\n') : '', a.ergebnis?.trim() ? `Ergebnis: ${a.ergebnis.trim()}` : '', a.hinweise?.trim() ?? ''].filter(Boolean).join('\n\n');
  }
  // Altbestand ohne Angebotstext: Beschreibung + Lieferumfang als Vorschlag (die Oberfläche markiert „Text fehlt“).
  return [l.beschreibung?.trim() ?? '', l.lieferumfang?.length ? l.lieferumfang.map(x => `• ${x}`).join('\n') : '', l.ergebnis?.trim() ? `Ergebnis: ${l.ergebnis.trim()}` : ''].filter(Boolean).join('\n\n');
}

/** Die Position eines Produkts OHNE Preis-Teile — genau wie bis 19.10. (`positionAusProdukt`). */
function altePosition(l: Leistung, id: string, kleinunternehmer: boolean): AngebotPosition {
  const basis: AngebotBasis = basisAusAltpreis(l.preis) ?? 'einmalig';
  return {
    id, leistungId: l.id, titel: (l.angebot?.titel?.trim() || l.name).slice(0, POSITION_GRENZEN.titel), text: positionsText(l).slice(0, POSITION_GRENZEN.text),
    menge: 1, einheit: ANGEBOT_EINHEIT_JE_BASIS[basis], einzelpreisCent: inCent(l.preis.betrag || 0), ustSatz: kleinunternehmer ? 0 : 19, basis,
    ...(basis !== 'einmalig' && l.laufzeitMonate ? { laufzeitMonate: Math.round(l.laufzeitMonate) } : {}),
  };
}
const einheitKurz = (e: string | undefined) => (e ?? '').trim().replace(/^(je|pro)\s+/i, '').slice(0, 30) || 'Einheit';
const POS_EINHEIT: Record<PreisTeilArt, string> = { kostenlos: 'pauschal', fest: 'pauschal', monatlich: 'Monat', jaehrlich: 'Jahr', je_einheit: 'Einheit', tagessatz: 'Tag', stundensatz: 'Stunde', erfolg: 'pauschal' };
/** Kurze Hinweise eines Teils für den Positionstext (Kontingent, Deckel, Zahlplan). */
function teilHinweise(t: PreisTeil): string[] {
  return [
    t.kontingent?.trim() ? `Enthalten: ${t.kontingent.trim()}` : '',
    t.deckel?.stundenJeMonat ? `Höchstens ${t.deckel.stundenJeMonat} Stunden je Monat.` : '',
    t.zahlplan?.anzahlungProzent ? (t.zahlplan.anzahlungProzent === 50 ? 'Zahlung 50 % bei Auftrag, 50 % bei Abschluss.' : `Zahlung ${t.zahlplan.anzahlungProzent} % bei Auftrag, Rest bei Abschluss.`) : '',
  ].filter(Boolean);
}

/**
 * Die Angebots-Positionen eines Produkts: je Grund-Teil eine Position, dazu die gewählten Optionen (`gewaehlteOptionen` = Kennungen der Teile).
 * Erfolgsanteile werden keine Position, sondern ein Satz im Text der ersten; „kostenlos“ nur, wenn sonst nichts kostet. Kennungen: `idBasis`,
 * dann `idBasis-2` … Ohne Preis-Teile: genau die eine Position wie bis 19.10.
 */
export function angebotPositionenAusProdukt(l: Leistung, gewaehlteOptionen: readonly string[] = [], opt: { idBasis?: string; kleinunternehmer?: boolean } = {}): AngebotPosition[] {
  const idBasis = opt.idBasis ?? 'p-1';
  if (!hatPreisteile(l)) return [altePosition(l, idBasis, !!opt.kleinunternehmer)];
  const kombi = istKombi(l);
  // 24.10. (Bau-Test): der Hauptpreis (laufend vor einmalig, `hauptpreis`) steht vorne und trägt Titel und Text des Produkts — die Reihenfolge der Karte
  // entscheidet nicht mehr, welcher Teil die erste Position ist. Ein Produkt mit einem Preis: wie bisher.
  const teile = (kombi ? teileHauptZuerst(l.preise!) : l.preise!).filter(t => t.rolle === 'grund' || gewaehlteOptionen.includes(t.id));
  const erfolg = teile.filter(t => t.art === 'erfolg');
  const bezahlt = teile.filter(t => t.art !== 'erfolg' && t.art !== 'kostenlos');
  const kostenlos = teile.filter(t => t.art === 'kostenlos');
  const pos = bezahlt.length ? bezahlt : kostenlos.length ? [kostenlos[0]] : [{ id: ALT_TEIL_ID, art: 'fest', rolle: 'grund' } as PreisTeil];
  const v = vertragVon(l);
  const ust = opt.kleinunternehmer ? 0 : v.ustSatz ?? 19;
  return pos.map((t, i) => {
    // Tages-/Stundensatz in einer Kombination (24.10.): „je Tag“ mit der geplanten Menge je Monat, gezählt als laufend (nie mehr „1 Tag einmalig“).
    // Abgerechnet wird die echte Menge („abrechnen“ am Mandat). Allein (ein Preis) bleibt er wie bisher.
    const satz = kombi && istSatz(t.art) ? (t.art === 'tagessatz' ? 'tag' as const : 'stunde' as const) : undefined;
    const basis: AngebotBasis = t.art === 'monatlich' || satz ? 'monat' : t.art === 'jaehrlich' ? 'jahr' : 'einmalig';
    const menge = satz ? geplanteMenge(t) || 1 : 1;
    const satzText = satz ? `Abgerechnet nach ${satz === 'tag' ? 'Tagen' : 'Stunden'} — geplant ${menge.toLocaleString('de-DE')} ${satz === 'tag' ? (menge === 1 ? 'Tag' : 'Tage') : 'Std.'} je Monat.` : '';
    const saetze = i === 0
      ? [positionsText(l, { lieferumfang: true }), ...teilHinweise(t), satzText, ...erfolg.map(e => `Zusätzlich: ${e.text?.trim() || preisText(e)}.`), v.reisekosten === 'separat' ? 'Reisekosten werden separat abgerechnet.' : '']
      : [t.text?.trim() ?? '', ...teilHinweise(t), satzText];
    return {
      id: i === 0 ? idBasis : `${idBasis}-${i + 1}`, leistungId: l.id,
      preisTeilId: t.id,
      titel: (i === 0 ? l.angebot?.titel?.trim() || l.name : `${l.name} · ${teilLabel(t)}`).slice(0, POSITION_GRENZEN.titel),
      text: saetze.filter(Boolean).join('\n\n').slice(0, POSITION_GRENZEN.text),
      menge, einheit: t.art === 'je_einheit' ? einheitKurz(t.einheit) : POS_EINHEIT[t.art], einzelpreisCent: typeof t.betragCent === 'number' ? t.betragCent : 0, ustSatz: ust, basis,
      ...(satz ? { satz } : {}),
      ...(basis !== 'einmalig' && v.mindestlaufzeitMonate ? { laufzeitMonate: v.mindestlaufzeitMonate } : {}),
      // Artikelnummer des Teils (25.10.) — ohne Nummer am Teil bleibt die Position bit-gleich.
      ...(t.artikelnummer ? { artikelnummer: t.artikelnummer } : {}),
    };
  });
}

/** Die Positionen des Angebots, die diese Option des Produkts tragen (Kennungen) — „angehakt“ heißt: sie steht im Angebot (25.10.). */
export const optionImAngebot = (produktId: string, teilId: string, positionen: readonly Pick<AngebotPosition, 'id' | 'leistungId' | 'preisTeilId'>[]): string[] =>
  positionen.filter(x => x.leistungId === produktId && x.preisTeilId === teilId).map(x => x.id);
/**
 * Eine Option der Produktkarte im Angebot umschalten — EIN Klick (25.10., Kern-Bau-Test 2: vorher Haken + zweiter Klick aufs Produkt): steht sie drin, kommt sie
 * heraus (`weg`, nur im Entwurf — der Aufrufer), sonst kommt NUR ihre Position dazu (`dazu`, dieselbe Position wie `angebotPositionenAusProdukt` sie baut).
 */
export function optionUmschalten(l: Leistung, teilId: string, positionen: readonly Pick<AngebotPosition, 'id' | 'leistungId' | 'preisTeilId'>[], opt: { idBasis?: string; kleinunternehmer?: boolean } = {}): { dazu: AngebotPosition[]; weg: string[] } {
  const weg = optionImAngebot(l.id, teilId, positionen);
  if (weg.length) return { dazu: [], weg };
  return { dazu: angebotPositionenAusProdukt(l, [teilId], opt).filter(x => x.preisTeilId === teilId), weg: [] };
}

// ── Deal ─────────────────────────────────────────────────────────────────────

/**
 * Vorgabe des Deal-Werts aus einem Produkt (24.10., Bau-Test: Deal-Formular mit Produktfeld) — netto Euro. Laufend = monatliche Grund-Teile + jährliche ÷ 12
 * + geplante Tages-/Stundensätze (Satz × geplante Menge), einmalig = Festpreise der Grund-Teile (`einmalBetrag` neben laufendem Wert); Laufzeit =
 * Mindestlaufzeit. Ohne laufenden Teil: jährlich bzw. einmalig. Je Einheit, Erfolg, Optionen und Kostenloses zählen nicht (ohne Menge keine Zahl). null ohne Betrag.
 */
export function dealWertAusProdukt(l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise' | 'vertrag' | 'laufzeitMonate'>>): { betrag: number; basis: PreisBasis; laufzeitMonate?: number; einmalBetrag?: number; geplantBetrag?: number; geplantSatz?: 'tag' | 'stunde' } | null {
  const teile = preisteileVon(l as Pick<Leistung, 'preis' | 'preise'>).filter(t => t.rolle === 'grund' && typeof t.betragCent === 'number' && t.betragCent > 0);
  const summe = (f: (t: PreisTeil) => number) => teile.reduce((x, t) => x + f(t), 0);
  const saetze = summe(t => (istSatz(t.art) ? kaufmaennischCent(t.betragCent! * geplanteMenge(t)) : 0));
  const monat = summe(t => (t.art === 'monatlich' ? t.betragCent! : 0)) + saetze;
  const jahr = summe(t => (t.art === 'jaehrlich' ? t.betragCent! : 0));
  const einmal = summe(t => (t.art === 'fest' ? t.betragCent! : 0));
  const lz = vertragVon({ vertrag: l.vertrag, laufzeitMonate: l.laufzeitMonate }).mindestlaufzeitMonate;
  const mitLz = lz ? { laufzeitMonate: lz } : {};
  const mitEinmal = einmal ? { einmalBetrag: einmal / 100 } : {};
  // 25.10.: die geplanten Sätze getrennt benannt (`geplantBetrag`, wie `dealWertAusAngebot`).
  const satzArten = new Set(teile.filter(t => istSatz(t.art) && geplanteMenge(t) > 0).map(t => (t.art === 'tagessatz' ? 'tag' : 'stunde') as 'tag' | 'stunde'));
  const mitGeplant = saetze ? { geplantBetrag: saetze / 100, ...(satzArten.size === 1 ? { geplantSatz: [...satzArten][0] } : {}) } : {};
  if (monat) return { betrag: (monat + kaufmaennischCent(jahr / 12)) / 100, basis: 'monat', ...mitLz, ...mitEinmal, ...mitGeplant };
  if (jahr) return { betrag: jahr / 100, basis: 'jahr', ...mitLz, ...mitEinmal };
  if (einmal) return { betrag: einmal / 100, basis: 'einmalig' };
  // Ein Tages-/Stundensatz ohne geplante Menge (bzw. je Einheit) allein: der Satz als einmaliger Wert (wie bisher der Hauptpreis).
  const h = hauptpreis(l as Pick<Leistung, 'preis' | 'preise'>);
  return h && typeof h.betragCent === 'number' && h.betragCent > 0 && h.art !== 'erfolg' ? { betrag: h.betragCent / 100, basis: 'einmalig' } : null;
}
const kaufmaennischCent = (c: number) => Math.round(c);

// ── Finanzplanung ────────────────────────────────────────────────────────────

export const RHYTHMUS_AUS_BASIS: Record<PreisBasis, Rhythmus> = { monat: 'monatlich', jahr: 'jaehrlich', einmalig: 'einmalig' };
export interface PlanBausteinVorlage {
  /** Preis je Einheit netto in Euro (Hauptpreis) — beim Tages-/Stundensatz der geplante Monatsbetrag (Satz × geplante Menge, 21.10.). */
  preis: number;
  einheit: string;
  basis: PreisBasis | null;
  rhythmus: Rhythmus | null;
  laufzeit: number | null;
  /** Was für die Planung fehlt — leer heißt planbar. */
  fehlt: string[];
  /** Kostenlos (21.10., B4): die Planung sagt „kostenlos“, nicht „Preis offen“. */
  kostenlos: boolean;
  /** Tages-/Stundensatz (21.10., B4): Satz (€ netto), geplante Menge je Monat und ihre Einheit — geplant wird Satz × Menge monatlich. */
  satz?: { betrag: number; menge: number; einheit: string };
  /** Basis, wie das Produkt abgerechnet wird (Anzeige der Einheit) — beim Satz „einmalig“ (je Menge), geplant wird monatlich (`basis`). */
  anzeigeBasis: PreisBasis | null;
}
/**
 * Was die Planung aus einem Produkt zieht (lib/finanzen/produkte.ts `produktVorschlaege`/`bausteinAusProdukt`): der Hauptpreis-Teil,
 * Basis, Laufzeit (Mindestlaufzeit), Einheit. Ohne Preis-Teile genau wie bis 19.10. (alter Preis, alte Laufzeit, gleiche Lücken).
 */
export function planBausteinAusProdukt(l: Pick<Leistung, 'preis'> & Partial<Pick<Leistung, 'preise' | 'vertrag' | 'laufzeitMonate' | 'gesellschaft'>>): PlanBausteinVorlage {
  if (!hatPreisteile(l)) {
    const basis = basisAusAltpreis(l.preis);
    const fehlt: string[] = [];
    if (!l.preis.betrag && !istKostenlosAlt(l.preis)) fehlt.push('Preis');
    if (!basis) fehlt.push('Basis (Monat · Jahr · einmalig)');
    if (basis !== 'einmalig' && !l.laufzeitMonate) fehlt.push('Laufzeit');
    if (l.gesellschaft === 'offen') fehlt.push('Gesellschaft');
    return { preis: l.preis.betrag, einheit: l.preis.einheit, basis, rhythmus: basis ? RHYTHMUS_AUS_BASIS[basis] : null, laufzeit: l.laufzeitMonate ?? null, fehlt, kostenlos: istKostenlosAlt(l.preis), anzeigeBasis: basis };
  }
  const h = hauptpreis(l as Pick<Leistung, 'preis' | 'preise'>)!;
  const laufzeit = vertragVon({ vertrag: l.vertrag, laufzeitMonate: l.laufzeitMonate }).mindestlaufzeitMonate ?? null;
  const fehlt: string[] = [];
  const kostenlos = istKostenlos(l);
  if (typeof h.betragCent !== 'number' && h.art !== 'kostenlos' && h.art !== 'erfolg') fehlt.push('Preis');
  if (l.gesellschaft === 'offen') fehlt.push('Gesellschaft');
  if (istSatz(h.art)) {
    // Tages-/Stundensatz (Kevin 21.10., Rundgang B4 — vorher „160 € einmalig“): geplant wird Satz × geplante Menge je Monat, monatlich; eine Laufzeit braucht
    // es nicht (läuft, solange geplant). Ohne geplante Menge: Lücke „geplante Menge je Monat“.
    const satz = typeof h.betragCent === 'number' ? h.betragCent / 100 : 0;
    const menge = geplanteMenge(h);
    if (!menge) fehlt.push(`geplante ${h.art === 'stundensatz' ? 'Stunden' : 'Tage'} je Monat`);
    return { preis: Math.round(satz * menge * 100) / 100, einheit: preisAusTeil(h).einheit, basis: 'monat', rhythmus: 'monatlich', laufzeit, fehlt, kostenlos, satz: { betrag: satz, menge, einheit: mengeEinheit(h.art) }, anzeigeBasis: basisVonTeil(h) };
  }
  const basis = basisVonTeil(h);
  if (basis !== 'einmalig' && !laufzeit) fehlt.push('Laufzeit');
  return { preis: typeof h.betragCent === 'number' ? h.betragCent / 100 : 0, einheit: preisAusTeil(h).einheit, basis, rhythmus: RHYTHMUS_AUS_BASIS[basis], laufzeit, fehlt, kostenlos, anzeigeBasis: basis };
}

// ── Säubern (Lesen und Schreiben: robust — Kaputtes fällt weg; abgelehnt wird vorher in `produktPruefen`) ───────────

const istObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ganz = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= min && v <= max ? v : undefined);
const dezimal = (v: unknown, min: number, max: number): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : undefined);
const zeile = (v: unknown, n: number): string | undefined => { const t = typeof v === 'string' ? v.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim() : ''; return t ? t.slice(0, n) : undefined; };
const absatz = (v: unknown, n: number): string | undefined => { const t = typeof v === 'string' ? v.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : ''; return t ? t.slice(0, n) : undefined; };
const KENNUNG = /^[a-z0-9][a-z0-9-]{1,63}$/;
/**
 * Verweis auf einen Prozess der Werkstatt (22.10., Prozesse × Fulfillment; `Leistung.prozessId`): nur die Form `pz-<uuid>` — ob es ihn gibt und ob er zu einem
 * Mandat passt, entscheidet der Motor beim Start (lib/prozesse/produkt-bindung.ts) und zeigt die Verbindungsprüfung. Sonst undefined.
 */
export const produktProzessKennung = (v: unknown): string | undefined => (typeof v === 'string' && PROZESS_KENNUNG.test(v) ? v : undefined);
const TEIL_ID = /^pt-[a-z0-9-]{1,40}$/;
/** Form einer Artikelnummer (25.10.): Buchstabe oder Ziffer vorn, dann Buchstaben, Ziffern, Leerzeichen und - _ . / — höchstens `PRODUKT_GRENZEN.artikelnummer`. */
const ARTIKELNUMMER = /^[\p{L}\p{N}][\p{L}\p{N} ._\-/]*$/u;
/** Eine Artikelnummer, gesäubert (Leerzeichen zusammengezogen, NFC) — undefined, wenn leer, zu lang oder in fremder Form (Säuberer: fällt weg; Prüfung: Fehler). */
export function artikelnummerSaeubern(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.normalize('NFC').replace(/\s+/g, ' ').trim();
  return t && t.length <= PRODUKT_GRENZEN.artikelnummer && ARTIKELNUMMER.test(t) ? t : undefined;
}
const ZUSATZ_ID = /^mz-[a-z0-9-]{1,60}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const G = PRODUKT_GRENZEN;
const aus = <T extends string>(v: unknown, l: readonly T[]): T | undefined => (l.includes(v as T) ? v as T : undefined);

/** Ein Preis-Teil, gesäubert — null, wenn die Art unbekannt ist. `id` fehlt/ungültig → `fallbackId`. */
export function preisteilSaeubern(v: unknown, fallbackId: string): PreisTeil | null {
  if (!istObj(v) || !ARTEN.has(String(v.art))) return null;
  const art = v.art as PreisTeilArt;
  const betrag = art === 'kostenlos' ? undefined : ganz(v.betragCent, 0, G.betragCent);
  const bis = betrag !== undefined ? ganz(v.bisCent, betrag + 1, G.betragCent) : undefined;
  const ap = istObj(v.zahlplan) ? ganz(v.zahlplan.anzahlungProzent, 1, 99) : undefined;
  const dk = art === 'stundensatz' && istObj(v.deckel) ? ganz(v.deckel.stundenJeMonat, 1, G.stundenJeMonat) : undefined;
  // Geplante Menge je Monat (21.10., B4): nur Tages-/Stundensatz, 0 … 744 (Viertel erlaubt).
  const mj = istSatz(art) ? dezimal(v.mengeJeMonat, 0, G.stundenJeMonat) : undefined;
  const einheit = art === 'je_einheit' ? zeile(v.einheit, G.einheit) : undefined;
  return {
    id: typeof v.id === 'string' && TEIL_ID.test(v.id) ? v.id : fallbackId, art,
    ...(betrag !== undefined ? { betragCent: betrag } : {}), ...(bis !== undefined ? { bisCent: bis } : {}),
    ...(einheit ? { einheit } : {}), rolle: v.rolle === 'option' ? 'option' : 'grund',
    ...(ap !== undefined ? { zahlplan: { anzahlungProzent: ap } } : {}),
    ...(zeile(v.kontingent, G.kontingent) ? { kontingent: zeile(v.kontingent, G.kontingent) } : {}),
    ...(dk !== undefined ? { deckel: { stundenJeMonat: dk } } : {}),
    ...(mj !== undefined ? { mengeJeMonat: mj } : {}),
    ...(zeile(v.text, G.text) ? { text: zeile(v.text, G.text) } : {}),
    // Artikelnummer (25.10., optional) — ohne diese Zeile fiele sie beim Speichern der Karte weg.
    ...(artikelnummerSaeubern(v.artikelnummer) ? { artikelnummer: artikelnummerSaeubern(v.artikelnummer) } : {}),
  };
}
function preiseSaeubern(v: unknown): PreisTeil[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ids = new Set<string>();
  let n = 0;
  const out = v.slice(0, G.preise).map(x => preisteilSaeubern(x, '')).filter((x): x is PreisTeil => !!x).map(t => {
    let id = t.id && !ids.has(t.id) ? t.id : '';
    while (!id || ids.has(id)) id = `pt-${++n}`;
    ids.add(id);
    return { ...t, id };
  });
  return out.length ? out : undefined;
}
function vertragSaeubern(v: unknown): ProduktVertrag | undefined {
  if (!istObj(v)) return undefined;
  const out: ProduktVertrag = {
    ...(ganz(v.mindestlaufzeitMonate, 1, G.mindestlaufzeitMonate) !== undefined ? { mindestlaufzeitMonate: v.mindestlaufzeitMonate as number } : {}),
    ...(aus(v.danach, VERTRAG_DANACH) ? { danach: v.danach as ProduktVertrag['danach'] } : {}),
    ...(ganz(v.kuendigungsfristTage, 0, G.kuendigungsfristTage) !== undefined ? { kuendigungsfristTage: v.kuendigungsfristTage as number } : {}),
    ...(aus(v.rechnungsrhythmus, RECHNUNGS_RHYTHMEN) ? { rechnungsrhythmus: v.rechnungsrhythmus as ProduktVertrag['rechnungsrhythmus'] } : {}),
    ...(ganz(v.zahlungszielTage, 0, G.zahlungszielTage) !== undefined ? { zahlungszielTage: v.zahlungszielTage as number } : {}),
    ...((UST_SAETZE_KARTE as readonly number[]).includes(v.ustSatz as number) ? { ustSatz: v.ustSatz as number } : {}),
    ...(aus(v.reisekosten, REISEKOSTEN) ? { reisekosten: v.reisekosten as ProduktVertrag['reisekosten'] } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}
function regelnSaeubern(v: unknown): ProduktRegeln | undefined {
  if (!istObj(v)) return undefined;
  const a = istObj(v.anrechnung) ? v.anrechnung : undefined;
  const auf = a && Array.isArray(a.auf) ? Array.from(new Set(a.auf.filter((x): x is string => typeof x === 'string' && KENNUNG.test(x)))).slice(0, G.anrechnungAuf) : [];
  const anteil = a ? ganz(a.anteilProzent, 1, 100) : undefined;
  const mg = ganz(v.maxGleichzeitig, 1, G.maxGleichzeitig);
  const inkl = Array.isArray(v.inklusive) ? v.inklusive.slice(0, G.inklusive).flatMap(x => {
    if (!istObj(x) || typeof x.leistungId !== 'string' || !KENNUNG.test(x.leistungId)) return [];
    const menge = ganz(x.menge, 1, G.inklusiveMenge), je = aus(x.je, INKLUSIVE_JE);
    return menge !== undefined && je ? [{ leistungId: x.leistungId, menge, je }] : [];
  }) : [];
  const out: ProduktRegeln = {
    ...(auf.length && anteil !== undefined ? { anrechnung: { auf, anteilProzent: anteil } } : {}),
    ...(mg !== undefined ? { maxGleichzeitig: mg } : {}),
    ...(inkl.length ? { inklusive: inkl } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}
function zielSaeubern(v: unknown): Leistung['ziel'] | undefined {
  if (!istObj(v)) return undefined;
  const u = dezimal(v.umsatz, 0, G.zielUmsatz), k = ganz(v.kunden, 0, G.zielKunden);
  const out = { ...(u ? { umsatz: u } : {}), ...(k ? { kunden: k } : {}) };
  return Object.keys(out).length ? out : undefined;
}

/**
 * Die Felder der Karte aus einem rohen Eintrag — nur, was gültig ist (lib/crm/speicher.ts `zusatz('leistungen')`). Ohne Karten-Felder: `{}`
 * (der Eintrag bleibt bit-gleich).
 */
export function kartenFelderSaeubern(o: Record<string, unknown>): KartenFelder {
  const preise = preiseSaeubern(o.preise), vertrag = vertragSaeubern(o.vertrag), regeln = regelnSaeubern(o.regeln), ziel = zielSaeubern(o.ziel);
  const rolle = aus(o.rolle, PRODUKT_ROLLEN), ebene = ganz(o.ebene, 1, G.ebene), dauerTage = ganz(o.dauerTage, 1, G.dauerTage);
  const aufwand = dezimal(o.aufwandStundenWoche, 0.01, G.aufwandStundenWoche);
  const aufgabe = absatz(o.aufgabe, G.aufgabe), kennzahl = zeile(o.kennzahl, G.kennzahl);
  return {
    ...(preise ? { preise } : {}), ...(vertrag ? { vertrag } : {}), ...(regeln ? { regeln } : {}), ...(rolle ? { rolle } : {}), ...(ebene !== undefined ? { ebene } : {}),
    ...(aufgabe ? { aufgabe } : {}), ...(kennzahl ? { kennzahl } : {}), ...(dauerTage !== undefined ? { dauerTage } : {}),
    ...(aufwand !== undefined ? { aufwandStundenWoche: aufwand } : {}), ...(ziel ? { ziel } : {}),
  };
}

/** Ein Zahlplan `{ anzahlungProzent }` (1–99, ganze Zahl), gesäubert — sonst undefined. Für Zusatzmodule und das einmalige Honorar am Mandat (21.10.). */
export function zahlplanSaeubern(v: unknown): { anzahlungProzent: number } | undefined {
  const ap = istObj(v) ? ganz(v.anzahlungProzent, 1, 99) : undefined;
  return ap !== undefined ? { anzahlungProzent: ap } : undefined;
}

/** Zusatzmodule eines Mandats, gesäubert (lib/crm/speicher.ts `zusatz('mandate')`) — ungültige Einträge fallen weg; leer → undefined. */
export function mandatZusatzSaeubern(v: unknown): MandatZusatz[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const ids = new Set<string>();
  const out = v.slice(0, G.zusatz).flatMap((x): MandatZusatz[] => {
    if (!istObj(x) || typeof x.id !== 'string' || !ZUSATZ_ID.test(x.id) || ids.has(x.id) || typeof x.leistungId !== 'string' || !KENNUNG.test(x.leistungId)) return [];
    ids.add(x.id);
    const h = istObj(x.honorar) ? x.honorar : undefined;
    const betrag = h ? ganz(h.betragCent, 0, G.betragCent) : undefined, basis = h ? aus(h.basis, ZUSATZ_BASEN) : undefined;
    const menge = ganz(x.menge, 1, G.inklusiveMenge), je = aus(x.je, INKLUSIVE_JE);
    // P3 (19.10.): Zahlplan (einmalig, z. B. 50/50) und geplante Stunden je Monat (Stundensatz) — beide optional.
    const ap = istObj(x.zahlplan) ? ganz(x.zahlplan.anzahlungProzent, 1, 99) : undefined;
    const std = dezimal(x.stundenJeMonat, 0.25, G.stundenJeMonat);
    const tage = dezimal(x.tageJeMonat, 0.25, G.stundenJeMonat);
    return [{
      id: x.id, leistungId: x.leistungId,
      // 24.10.: ein eigener Preis-Teil des Produkts (`pt-…`, optional) — der alte Stand verwirft das Feld, das Modul bleibt mit seinem Honorar gültig.
      ...(typeof x.preisTeilId === 'string' && TEIL_ID.test(x.preisTeilId) ? { preisTeilId: x.preisTeilId } : {}),
      ...(typeof x.ab === 'string' && TAG.test(x.ab) ? { ab: x.ab } : {}), ...(typeof x.bis === 'string' && TAG.test(x.bis) ? { bis: x.bis } : {}),
      ...(betrag !== undefined && basis ? { honorar: { betragCent: betrag, basis } } : {}), ...(x.inklusive === true ? { inklusive: true } : {}),
      ...(menge !== undefined ? { menge } : {}), ...(je ? { je } : {}),
      ...(ap !== undefined ? { zahlplan: { anzahlungProzent: ap } } : {}), ...(std !== undefined ? { stundenJeMonat: std } : {}), ...(tage !== undefined ? { tageJeMonat: tage } : {}),
    }];
  });
  return out.length ? out : undefined;
}

/**
 * Zusatzmodule eines Schreibvorgangs am Mandat prüfen (P3, 19.10.) — nur Einträge, die neu sind oder sich geändert haben (`alt` = gespeichert),
 * damit ein später gelöschtes Produkt nie jede Änderung am Mandat sperrt. 413 = zu viele, 400 = Unsinn; nie still gekürzt. Leer = in Ordnung.
 *   · ein Produkt aus dem Katalog (nicht im Papierkorb), nie das Hauptprodukt des Mandats selbst
 *   · ohne „inklusive“: nur Produkte mit Rolle „zusatz“ bzw. „beides“ (inklusive darf jedes — die Regel kommt vom Hauptprodukt)
 *   · ab ≤ bis, Honorar mit Basis, Zahlplan 1–99 %, geplante Stunden nur beim Stundensatz
 */
export function mandatZusatzPruefen(roh: unknown, alt: readonly MandatZusatz[] | undefined, ctx: { katalog: readonly (Pick<Leistung, 'id' | 'name' | 'rolle' | 'geloeschtAm'> & Partial<Pick<Leistung, 'preis' | 'preise'>>)[]; hauptId?: string }): PruefFehler[] {
  if (roh === undefined || roh === null || roh === '') return [];
  if (!Array.isArray(roh)) return [{ status: 400, text: 'Zusatzmodule: eine Liste.' }];
  if (roh.length > G.zusatz) return [{ status: 413, text: `Höchstens ${G.zusatz} Zusatzmodule je Mandat — nichts gespeichert.` }];
  const f: PruefFehler[] = [];
  const ids = new Set<string>();
  for (const x of roh) {
    if (!istObj(x) || typeof x.id !== 'string' || !ZUSATZ_ID.test(x.id)) { f.push({ status: 400, text: 'Zusatzmodul: Kennung „mz-…“.' }); continue; }
    if (ids.has(x.id)) { f.push({ status: 400, text: 'Zusatzmodule: jede Kennung nur einmal.' }); continue; }
    ids.add(x.id);
    const vorher = alt?.find(a => a.id === x.id);
    if (vorher && JSON.stringify(mandatZusatzSaeubern([x])?.[0] ?? null) === JSON.stringify(vorher)) continue;
    const l = typeof x.leistungId === 'string' ? ctx.katalog.find(k => k.id === x.leistungId && !k.geloeschtAm) : undefined;
    const name = l ? `„${l.name}“` : 'Zusatzmodul';
    if (!l) { f.push({ status: 400, text: 'Zusatzmodul: das Produkt gibt es nicht (mehr) im Katalog.' }); continue; }
    // 24.10.: ein eigener Preis-Teil (`preisTeilId`) — nur einer, den das Produkt trägt, nie der Hauptpreis (der ist das Honorar), jeder Teil nur einmal.
    const teilId = x.preisTeilId;
    if (teilId !== undefined && teilId !== null) {
      const teil = typeof teilId === 'string' && TEIL_ID.test(teilId) && l.preise?.length ? l.preise.find(t => t.id === teilId) : undefined;
      if (!teil) { f.push({ status: 400, text: `${name}: diesen Preis-Teil gibt es am Produkt nicht (mehr).` }); continue; }
      if (l.id === ctx.hauptId && hauptpreis({ preis: l.preis ?? { betrag: 0, einheit: '' }, preise: l.preise }) === teil) f.push({ status: 400, text: `${name}: dieser Preis-Teil ist schon das Honorar des Mandats — nicht zugleich Zusatzmodul.` });
      if ((roh as unknown[]).filter(y => istObj(y) && y.preisTeilId === teilId && y.leistungId === x.leistungId).length > 1) f.push({ status: 400, text: `${name}: jeder Preis-Teil nur einmal als Zusatzmodul.` });
      if (l.id !== ctx.hauptId && x.inklusive !== true && l.rolle !== 'zusatz' && l.rolle !== 'beides') f.push({ status: 400, text: `${name} ist kein Zusatzmodul (Rolle am Produkt „Zusatz“ bzw. „beides“) — oder als „inklusive“ eintragen.` });
    } else {
      if (l.id === ctx.hauptId) f.push({ status: 400, text: `${name} ist schon das Hauptprodukt dieses Mandats — nicht zugleich Zusatzmodul.` });
      if (x.inklusive !== true && l.rolle !== 'zusatz' && l.rolle !== 'beides') f.push({ status: 400, text: `${name} ist kein Zusatzmodul (Rolle am Produkt „Zusatz“ bzw. „beides“) — oder als „inklusive“ eintragen.` });
    }
    for (const k of ['ab', 'bis'] as const) if (x[k] != null && x[k] !== '' && !(typeof x[k] === 'string' && TAG.test(x[k] as string))) f.push({ status: 400, text: `${name}: ${k} als Tag JJJJ-MM-TT.` });
    if (typeof x.ab === 'string' && typeof x.bis === 'string' && TAG.test(x.ab) && TAG.test(x.bis) && x.bis < x.ab) f.push({ status: 400, text: `${name}: „bis“ liegt vor „ab“.` });
    if (x.honorar != null) {
      const h = x.honorar;
      if (!istObj(h) || !aus(h.basis, ZUSATZ_BASEN)) f.push({ status: 400, text: `${name}: Honorar { betragCent, basis: ${ZUSATZ_BASEN.join(' · ')} }.` });
      else f.push(...nur([zahlFehler(h.betragCent, `${name}, Honorar (Cent)`, 0, G.betragCent)]));
    }
    if (x.zahlplan != null) {
      if (!istObj(x.zahlplan)) f.push({ status: 400, text: `${name}: Zahlplan { anzahlungProzent }.` });
      else f.push(...nur([zahlFehler(x.zahlplan.anzahlungProzent, `${name}, Anzahlung (%)`, 1, 99)]));
    }
    if (x.stundenJeMonat != null) {
      f.push(...nur([zahlFehler(x.stundenJeMonat, `${name}, Stunden je Monat`, 0.25, G.stundenJeMonat, false)]));
      if (!(istObj(x.honorar) && x.honorar.basis === 'stunde')) f.push({ status: 400, text: `${name}: geplante Stunden gibt es nur beim Stundensatz.` });
    }
    if (x.tageJeMonat != null) {
      f.push(...nur([zahlFehler(x.tageJeMonat, `${name}, Tage je Monat`, 0.25, G.stundenJeMonat, false)]));
      if (!(istObj(x.honorar) && x.honorar.basis === 'tag')) f.push({ status: 400, text: `${name}: geplante Tage gibt es nur beim Tagessatz.` });
    }
    if (x.menge != null) f.push(...nur([zahlFehler(x.menge, `${name}, Menge`, 1, G.inklusiveMenge)]));
    if (x.je != null && !aus(x.je, INKLUSIVE_JE)) f.push({ status: 400, text: `${name}: je ${INKLUSIVE_JE.join(', ')}.` });
  }
  return f;
}

// ── Spiegeln (nur im Säuberer des Servers) ───────────────────────────────────

/**
 * Die alten Felder aus der Karte, damit alte Leser und der alte Stand weiterarbeiten: `preis` = Hauptpreis-Teil, `laufzeitMonate` =
 * Mindestlaufzeit, `aufwand.stunden` = Aufwand je Preis-Einheit (Monat ×52/12, Jahr ×52, einmalig × Dauer in Wochen — ohne Dauer bleibt er).
 * Ohne Karten-Felder kommt GENAU dasselbe Objekt zurück.
 */
export function produktSpiegeln<T extends Leistung>(l: T): T {
  const preise = hatPreisteile(l);
  const ml = l.vertrag?.mindestlaufzeitMonate;
  const w = l.aufwandStundenWoche;
  if (!preise && !ml && !w) return l;
  const out: T = { ...l };
  if (preise) out.preis = preisAusTeil(hauptpreis(l)!);
  if (ml) out.laufzeitMonate = ml;
  if (w) {
    const basis = preisBasisVon(out) ?? 'einmalig';
    const je = basis === 'monat' ? (w * 52) / 12 : basis === 'jahr' ? w * 52 : l.dauerTage ? (w * l.dauerTage) / 7 : undefined;
    if (je !== undefined) out.aufwand = { ...(l.aufwand?.anteil ? { anteil: l.aufwand.anteil } : {}), stunden: Math.round(je * 100) / 100 };
  }
  return out;
}

/**
 * Schreibt jemand (alte Oberfläche) das gespiegelte Feld einer Karte direkt — anderer Preis bzw. andere Laufzeit, aber keine Preis-Teile /
 * kein Vertrag mit —, ginge die Eingabe beim Spiegeln still verloren. Dann: Ablehnung mit Text (409), nie still.
 */
export function spiegelKonflikt(alt: Leistung | undefined, roh: Record<string, unknown>): string | null {
  if (!alt) return null;
  const name = `„${String(roh.name ?? alt.name)}“`;
  if ('preis' in roh && !('preise' in roh) && hatPreisteile(alt) && istObj(roh.preis)) {
    const s = preisAusTeil(hauptpreis(alt)!);
    const p = roh.preis;
    const gleich = Number(p.betrag ?? 0) === s.betrag && Number(p.bis ?? 0) === (s.bis ?? 0) && (p.basis === undefined || p.basis === s.basis);
    if (!gleich) return `${name} hat Preis-Teile — den Preis bitte in der Produkt-Karte ändern (das alte Preisfeld folgt automatisch). Nichts gespeichert.`;
  }
  if ('laufzeitMonate' in roh && !('vertrag' in roh) && alt.vertrag?.mindestlaufzeitMonate && roh.laufzeitMonate != null && Number(roh.laufzeitMonate) !== alt.vertrag.mindestlaufzeitMonate) {
    return `${name} hat einen Vertrag mit Mindestlaufzeit — die Laufzeit bitte im Vertrag der Produkt-Karte ändern. Nichts gespeichert.`;
  }
  return null;
}

// ── Prüfen (vor dem Schreiben: 400 Unsinn, 413 zu groß — nie still kürzen) ─────────────────────────────────────

export interface PruefFehler { status: 400 | 413; text: string }
/** 413, wenn eine Grenze überschritten ist, sonst 400; null ohne Fehler. */
export const pruefStatus = (f: readonly PruefFehler[]): 400 | 413 | null => (f.length ? (f.some(x => x.status === 413) ? 413 : 400) : null);

const zahlFehler = (v: unknown, name: string, min: number, max: number, ganzzahl = true): PruefFehler | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return { status: 400, text: `${name}: eine Zahl.` };
  if (ganzzahl && !Number.isInteger(v)) return { status: 400, text: `${name}: eine ganze Zahl.` };
  if (v < min || v > max) return { status: 400, text: `${name}: zwischen ${min.toLocaleString('de-DE')} und ${max.toLocaleString('de-DE')}.` };
  return null;
};
const textFehler = (v: unknown, name: string, max: number): PruefFehler | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return { status: 400, text: `${name}: Text.` };
  return v.trim().length > max ? { status: 413, text: `${name} ist zu lang (höchstens ${max} Zeichen) — nichts gespeichert.` } : null;
};
const nur = (f: (PruefFehler | null)[]): PruefFehler[] => f.filter((x): x is PruefFehler => !!x);

/** Einen Preis-Teil prüfen (`nr` für den Text, ab 1). Leer = in Ordnung. */
export function preisteilPruefen(v: unknown, nr = 1): PruefFehler[] {
  const p = `Preis-Teil ${nr}`;
  if (!istObj(v)) return [{ status: 400, text: `${p}: ein Objekt mit Art und Betrag.` }];
  if (!ARTEN.has(String(v.art))) return [{ status: 400, text: `${p}: unbekannte Preis-Form „${String(v.art ?? '').slice(0, 30)}“ (${PREIS_TEIL_ARTEN.map(a => a.id).join(', ')}).` }];
  const art = v.art as PreisTeilArt;
  const f = nur([
    v.id !== undefined && (typeof v.id !== 'string' || !TEIL_ID.test(v.id)) ? { status: 400, text: `${p}: Kennung „pt-…“.` } : null,
    v.rolle !== undefined && v.rolle !== 'grund' && v.rolle !== 'option' ? { status: 400, text: `${p}: Rolle „grund“ oder „option“.` } : null,
    zahlFehler(v.betragCent, `${p}, Betrag (Cent)`, 0, G.betragCent),
    zahlFehler(v.bisCent, `${p}, „bis“ (Cent)`, 0, G.betragCent),
    art === 'kostenlos' && typeof v.betragCent === 'number' && v.betragCent > 0 ? { status: 400, text: `${p}: „kostenlos“ hat keinen Betrag.` } : null,
    v.bisCent != null && (typeof v.betragCent !== 'number' || (typeof v.bisCent === 'number' && v.bisCent <= v.betragCent)) ? { status: 400, text: `${p}: „bis“ nur mit Betrag und größer als er.` } : null,
    v.einheit != null && art !== 'je_einheit' ? { status: 400, text: `${p}: eine Einheit gibt es nur bei „je Einheit“.` } : textFehler(v.einheit, `${p}, Einheit`, G.einheit),
    v.deckel != null && art !== 'stundensatz' ? { status: 400, text: `${p}: einen Deckel gibt es nur beim Stundensatz.` } : null,
    v.mengeJeMonat != null && !istSatz(art) ? { status: 400, text: `${p}: eine geplante Menge je Monat gibt es nur beim Tages- und Stundensatz.` } : zahlFehler(v.mengeJeMonat, `${p}, geplant je Monat`, 0, G.stundenJeMonat, false),
    v.deckel != null && !istObj(v.deckel) ? { status: 400, text: `${p}: Deckel { stundenJeMonat }.` } : null,
    istObj(v.deckel) ? zahlFehler(v.deckel.stundenJeMonat, `${p}, Stunden je Monat`, 1, G.stundenJeMonat) : null,
    v.zahlplan != null && (!istObj(v.zahlplan) || typeof v.zahlplan.anzahlungProzent !== 'number') ? { status: 400, text: `${p}: Zahlplan { anzahlungProzent }.` } : null,
    istObj(v.zahlplan) ? zahlFehler(v.zahlplan.anzahlungProzent, `${p}, Anzahlung (%)`, 1, 99) : null,
    textFehler(v.kontingent, `${p}, Kontingent`, G.kontingent),
    textFehler(v.text, `${p}, Text`, G.text),
    // Artikelnummer (25.10.): zu lang → 413, fremde Form → 400 (nie still verworfen).
    textFehler(v.artikelnummer, `${p}, Artikelnummer`, G.artikelnummer)
      ?? (v.artikelnummer != null && String(v.artikelnummer).trim() && !artikelnummerSaeubern(v.artikelnummer) ? { status: 400, text: `${p}: Artikelnummer nur aus Buchstaben, Ziffern, Leerzeichen und - _ . / (vorn ein Buchstabe oder eine Ziffer).` } : null),
  ]);
  return f;
}

/**
 * Die Karten-Felder eines Schreibvorgangs prüfen (nur die, die mitkommen — `null` = leeren, erlaubt). `id`: das Produkt selbst (nicht auf
 * sich anrechnen/enthalten), `bekannt`: gibt es dieses Produkt (für Anrechnung/Inklusive). Leer = in Ordnung.
 */
export function produktPruefen(felder: Record<string, unknown>, opt: { id?: string; bekannt?: (id: string) => boolean } = {}): PruefFehler[] {
  const f: PruefFehler[] = [];
  const d = felder;
  if (d.preise != null) {
    if (!Array.isArray(d.preise)) f.push({ status: 400, text: 'Preis-Teile: eine Liste.' });
    else {
      if (d.preise.length > G.preise) f.push({ status: 413, text: `Höchstens ${G.preise} Preis-Teile je Produkt — nichts gespeichert.` });
      d.preise.forEach((t, i) => f.push(...preisteilPruefen(t, i + 1)));
      const ids = d.preise.map(t => (istObj(t) ? t.id : undefined)).filter((x): x is string => typeof x === 'string');
      if (new Set(ids).size !== ids.length) f.push({ status: 400, text: 'Preis-Teile: jede Kennung nur einmal.' });
      if (d.preise.length && !d.preise.some(t => istObj(t) && (t.rolle === undefined || t.rolle === 'grund'))) f.push({ status: 400, text: 'Mindestens ein Preis-Teil muss immer gelten (Rolle „grund“).' });
    }
  }
  if (d.vertrag != null) {
    if (!istObj(d.vertrag)) f.push({ status: 400, text: 'Vertrag: ein Objekt.' });
    else {
      const v = d.vertrag;
      f.push(...nur([
        zahlFehler(v.mindestlaufzeitMonate, 'Mindestlaufzeit (Monate)', 1, G.mindestlaufzeitMonate),
        v.danach != null && !aus(v.danach, VERTRAG_DANACH) ? { status: 400, text: `Danach: ${VERTRAG_DANACH.join(', ')}.` } : null,
        zahlFehler(v.kuendigungsfristTage, 'Kündigungsfrist (Tage)', 0, G.kuendigungsfristTage),
        v.rechnungsrhythmus != null && !aus(v.rechnungsrhythmus, RECHNUNGS_RHYTHMEN) ? { status: 400, text: `Rechnungsrhythmus: ${RECHNUNGS_RHYTHMEN.join(', ')}.` } : null,
        zahlFehler(v.zahlungszielTage, 'Zahlungsziel (Tage)', 0, G.zahlungszielTage),
        v.ustSatz != null && !(UST_SAETZE_KARTE as readonly unknown[]).includes(v.ustSatz) ? { status: 400, text: 'USt-Satz: 19, 7 oder 0.' } : null,
        v.reisekosten != null && !aus(v.reisekosten, REISEKOSTEN) ? { status: 400, text: 'Reisekosten: separat oder inklusive.' } : null,
      ]));
    }
  }
  if (d.regeln != null) {
    if (!istObj(d.regeln)) f.push({ status: 400, text: 'Regeln: ein Objekt.' });
    else {
      const r = d.regeln;
      if (r.anrechnung != null) {
        const a = r.anrechnung;
        if (!istObj(a) || !Array.isArray(a.auf)) f.push({ status: 400, text: 'Anrechnung: { auf: [Produkte], anteilProzent }.' });
        else {
          if (a.auf.length > G.anrechnungAuf) f.push({ status: 413, text: `Anrechnung: höchstens ${G.anrechnungAuf} Produkte — nichts gespeichert.` });
          for (const x of a.auf) {
            if (typeof x !== 'string' || !KENNUNG.test(x)) f.push({ status: 400, text: 'Anrechnung: nur Kennungen aus dem Katalog.' });
            else if (x === opt.id) f.push({ status: 400, text: 'Anrechnung: ein Produkt wird nicht auf sich selbst angerechnet.' });
            else if (opt.bekannt && !opt.bekannt(x)) f.push({ status: 400, text: `Anrechnung: das Produkt „${x}“ gibt es nicht (mehr).` });
          }
          if (!a.auf.length) f.push({ status: 400, text: 'Anrechnung: auf welches Produkt?' });
          f.push(...nur([a.anteilProzent == null ? { status: 400, text: 'Anrechnung: Anteil in Prozent (1–100).' } : zahlFehler(a.anteilProzent, 'Anrechnung (%)', 1, 100)]));
        }
      }
      f.push(...nur([zahlFehler(r.maxGleichzeitig, 'Höchstens gleichzeitig', 1, G.maxGleichzeitig)]));
      if (r.inklusive != null) {
        if (!Array.isArray(r.inklusive)) f.push({ status: 400, text: 'Inklusive: eine Liste.' });
        else {
          if (r.inklusive.length > G.inklusive) f.push({ status: 413, text: `Inklusive: höchstens ${G.inklusive} Einträge — nichts gespeichert.` });
          for (const x of r.inklusive) {
            if (!istObj(x) || typeof x.leistungId !== 'string' || !KENNUNG.test(x.leistungId)) { f.push({ status: 400, text: 'Inklusive: { leistungId, menge, je }.' }); continue; }
            if (x.leistungId === opt.id) f.push({ status: 400, text: 'Inklusive: ein Produkt enthält sich nicht selbst.' });
            else if (opt.bekannt && !opt.bekannt(x.leistungId)) f.push({ status: 400, text: `Inklusive: das Produkt „${x.leistungId}“ gibt es nicht (mehr).` });
            f.push(...nur([x.menge == null ? { status: 400, text: 'Inklusive: Menge.' } : zahlFehler(x.menge, 'Inklusive, Menge', 1, G.inklusiveMenge), !aus(x.je, INKLUSIVE_JE) ? { status: 400, text: `Inklusive: je ${INKLUSIVE_JE.join(', ')}.` } : null]));
          }
        }
      }
    }
  }
  if (d.ziel != null) {
    if (!istObj(d.ziel)) f.push({ status: 400, text: 'Ziel: { umsatz, kunden }.' });
    else f.push(...nur([zahlFehler(d.ziel.umsatz, 'Umsatzziel (Euro)', 0, G.zielUmsatz, false), zahlFehler(d.ziel.kunden, 'Kundenziel', 0, G.zielKunden)]));
  }
  f.push(...nur([
    // Prozess der Werkstatt (22.10.): nur eine Kennung `pz-…` — `null` löst den Verweis.
    d.prozessId != null && !produktProzessKennung(d.prozessId) ? { status: 400, text: 'Prozess: eine Kennung aus der Werkstatt (pz-…).' } : null,
    d.rolle != null && !aus(d.rolle, PRODUKT_ROLLEN) ? { status: 400, text: `Rolle: ${PRODUKT_ROLLEN.join(', ')}.` } : null,
    zahlFehler(d.ebene, 'Ebene der Treppe', 1, G.ebene),
    textFehler(d.aufgabe, 'Die Aufgabe', G.aufgabe),
    textFehler(d.kennzahl, 'Die Kennzahl', G.kennzahl),
    zahlFehler(d.dauerTage, 'Dauer (Tage)', 1, G.dauerTage),
    zahlFehler(d.aufwandStundenWoche, 'Aufwand (Stunden je Woche)', 0.01, G.aufwandStundenWoche, false),
  ]));
  return f;
}
