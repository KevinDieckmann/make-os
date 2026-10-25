// ─── MAKE OS — Liquiditäts-Vorschau ─────────────────────────────────────────
// Die Frage, die zählt: Wie viel Geld ist wann da — und wann wird es eng?
//
// Gerechnet wird aus dem, was schon im System steht: Kontostände, gestellte
// und geplante Rechnungen, fällige Zahlungen, wiederkehrende Fixkosten.
// Deterministisch, damit man jeder Zahl ansehen kann, woher sie kommt.
//
// Client-safe: keine Server-Importe.

import { bereichVonFirma, gehoertZuPrivat } from '@/lib/einheiten';

export interface Firma { id: string; name: string; kontostand: number | null; stand: string | null }
/**
 * Kevins Ansage: „Was bringt es, 3.000 € einzutragen, wenn die Abläufe dahinter
 * nicht funktionieren — Angebotsnummer, Datum und so weiter fehlen." Deshalb
 * trägt eine Rechnung jetzt ihren ganzen Vorgang: vom Angebot bis zum Eingang.
 */
export interface Rechnung {
  id: string;
  kunde: string;
  titel: string;
  betrag: number;
  status: string;
  faellig?: string;
  /** Rechnungsnummer, wie sie beim Kunden liegt. */
  nummer?: string;
  /** Wann gestellt (YYYY-MM-DD). */
  datum?: string;
  /** Angebotsnummer und -datum — der Schritt davor. */
  angebot?: string;
  angebotAm?: string;
  /** Wann das Geld gekommen ist. */
  bezahltAm?: string;
  /** Netto, wenn abweichend gerechnet wird. */
  netto?: number;
  ustSatz?: number;
  /** Das Mandat, aus dem die Rechnung stammt (26.09.) — Rechnung ↔ Mandat ohne Namensheuristik. */
  mandatId?: string;
  /** Leistungszeitraum, für die Buchhaltung. */
  leistungVon?: string;
  leistungBis?: string;
  notiz?: string;
  /** Für „Rechnung statt Plan“ (21.10., `rechnungDeckung`): Zahlungsziel, Stornorechnung, aus einem Angebot, Positionen (nur Kennungen). */
  zahlungszielTage?: number;
  art?: string;
  angebotId?: string;
  positionen?: readonly { id: string }[];
}
export interface Zahlung { id: string; an: string; titel: string; betrag: number; status: string; faellig?: string; firmaId?: string }
export interface Merkposten { id: string; titel: string; betrag: number; art: string; notiz?: string; firmaId?: string }

// ── Privat ist nie Business (Kevin, 24.09.) ─────────────────────────────────
// Die privaten Finanzen leben seit dem Umzug von Malins Cockpit unter
// „Zahlen → Privat“. In den Business-Speichern stehen noch alte Einträge mit
// firmaId „privat“ — die zählen in keiner Business-Rechnung mehr. Was NICHT
// ausdrücklich privat markiert ist, gilt als Business (ältere Einträge ohne
// Firma sind Firmen-Posten; die Prüfliste unter Privat zeigt sie zum Zuordnen).
//
// 05.10. (Kevin: „Selbstständigkeit raus aus Business … überall unter Privat“): Der BUSINESS-Bereich (`nurBusiness`, `businessFirmen`,
// `vorschau(…, ohnePrivat)`) lässt zusätzlich die Posten und Konten der Privat-Einheiten weg (lib/einheiten.ts `bereichVonFirma`,
// unsere Instanz: die Selbstständigkeit `kdc`). Posten ohne Firma bleiben Business wie bisher. `istPrivatPosten` bleibt das enge
// „ausdrücklich privat“ (CRM-Umsatz, Steuern rechnen die Selbstständigkeit weiter mit) — `ohnePrivatPosten` ist die Liste dazu.
export const PRIVAT_ID = 'privat';
export const istPrivatPosten = (x: { firmaId?: string; kategorie?: string }) => x.firmaId === PRIVAT_ID || x.kategorie === PRIVAT_ID;
/** Nur ohne die ausdrücklich privaten Posten (die Selbstständigkeit bleibt drin) — Steuern, CRM-Umsatz. */
export const ohnePrivatPosten = <T extends { firmaId?: string; kategorie?: string }>(l: T[]): T[] => l.filter(x => !istPrivatPosten(x));
/** Business-Bereich: ohne Privat und ohne die Privat-Einheiten (Selbstständigkeit). */
export const nurBusiness = <T extends { firmaId?: string; kategorie?: string }>(l: T[]): T[] => l.filter(x => !istPrivatPosten(x) && bereichVonFirma(x.firmaId) === 'business');
/** Geschäftskonten des Business-Bereichs: ohne das Privatkonto und ohne die Konten der Privat-Einheiten. */
export const businessFirmen = <F extends { id: string }>(f: F[]): F[] => f.filter(x => x.id !== PRIVAT_ID && bereichVonFirma(x.id) === 'business');

export interface Bewegung {
  datum: string;
  text: string;
  betrag: number;
  art: 'eingang' | 'ausgang' | 'fix';
  /** Wie sicher ist das Geld? Gestellte Rechnungen sind belastbarer als geplante. */
  sicher: boolean;
  kategorie?: string;
  firmaId?: string;
  /** Woher der Posten kommt (16.10., Abnahme 2 · B7): Klick auf die Woche öffnet ihn (WEG.rechnung/zahlung/planposten). Fixkosten ohne. */
  quelle?: { art: 'rechnung' | 'zahlung' | 'planposten'; id: string };
}

export interface Woche {
  von: string;
  bis: string;
  label: string;
  eingang: number;
  ausgang: number;
  /** Kontostand am Ende der Woche. */
  stand: number;
  bewegungen: Bewegung[];
}

export interface Vorschau {
  start: number;
  wochen: Woche[];
  /** Erste Woche, in der der Stand negativ wird — null wenn es hält. */
  engpass: Woche | null;
  /** Tiefster Punkt im Zeitraum. */
  tiefpunkt: { stand: number; label: string };
  summeEin: number;
  summeAus: number;
  /** Wie viel davon nur geplant und nicht belastbar ist. */
  unsicher: number;
}

const tage = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Monatlich wiederkehrende Belastung aus den Merkposten herauslesen. */
export function monatlicheLast(merkposten: Merkposten[]): { text: string; betrag: number }[] {
  const raus: { text: string; betrag: number }[] = [];
  for (const m of merkposten) {
    // Fixkosten stehen als negativer Merkposten mit „monatlich" in der Notiz.
    if (/monatlich/i.test(m.notiz ?? '') && m.betrag < 0) {
      raus.push({ text: m.titel.replace(/^Fixkosten:\s*/i, ''), betrag: Math.abs(m.betrag) });
      continue;
    }
    // Kredite tragen ihre Rate in der Notiz: „Rate 90 €/Monat".
    const rate = (m.notiz ?? '').match(/Rate\s+([\d.]+)\s*€?\s*\/?\s*Monat/i);
    if (rate && m.betrag < 0) raus.push({ text: `${m.titel} (Rate)`, betrag: Math.round(Number(rate[1])) });
  }
  return raus;
}

/**
 * Vorschau über N Wochen. „geplant" zählt nur mit, wenn optimistisch=true —
 * sonst rechnen wir nur mit dem, was wirklich gestellt ist.
 */
export type Rhythmus = 'einmalig' | 'monatlich' | 'quartal' | 'jaehrlich';
export interface Planposten {
  id: string; titel: string; betrag: number; rhythmus: Rhythmus;
  ab: string; bis?: string; sicher: boolean; notiz?: string;
  /** Wessen Geld — erlaubt eine Planung je Firma statt nur im Topf. */
  firmaId?: string;
  /** Wofür — für die Aufschlüsselung nach Kategorien. */
  kategorie?: string;
  /** 0–100: wie wahrscheinlich der Posten eintritt (für Szenarien). */
  wahrscheinlich?: number;
  /** Ersetzt einen importierten Plan-Posten (Excel-Import legt ihn nicht wieder an). */
  ersetzt?: string;
  /**
   * Posten aus einem Mandat (21.10., Rundgang 19.10. A2 — gesetzt von lib/crm/kunden.ts `mandatPosten`, optional): das Mandat und der Leistungsmonat
   * der ersten Zahlung (`ab`; wiederkehrend je Zahlung + 1 bzw. 3 bzw. 12 Monate). Damit erkennt die Vorschau, welche Zahlung eine gestellte Rechnung
   * schon ersetzt (`rechnungDeckung`). Altbestand ohne die Felder: Mandat aus der Kennung `lp-mandat-<id>…`, Monat aus der Kennung bzw. `ab` − Zahlungsziel.
   */
  mandatId?: string;
  leistungsmonat?: string;
}

/** Die Kategorien, in denen bei uns gedacht wird. */
export const KATEGORIEN: { id: string; label: string; farbe: string; art: 'ein' | 'aus' }[] = [
  { id: 'mandat', label: 'Mandate & Honorare', farbe: '#58D9CD', art: 'ein' },
  { id: 'produkt', label: 'Produkte & Lizenzen', farbe: '#4A6CF7', art: 'ein' },
  { id: 'sonstige-ein', label: 'Sonstige Einnahmen', farbe: '#8A7CE0', art: 'ein' },
  { id: 'personal', label: 'Personal & Gehälter', farbe: '#DE9E63', art: 'aus' },
  { id: 'raum', label: 'Raum & Infrastruktur', farbe: '#B08968', art: 'aus' },
  { id: 'steuern', label: 'Steuern & Abgaben', farbe: '#E4572E', art: 'aus' },
  { id: 'kredite', label: 'Kredite & Tilgung', farbe: '#C9603A', art: 'aus' },
  { id: 'betrieb', label: 'Betrieb & Werkzeuge', farbe: '#8A9BA8', art: 'aus' },
  // 27.09.: Event-Budgets aus der Markttraktion (Planposten ev-<eventId>).
  { id: 'marketing/event', label: 'Marketing & Events', farbe: '#A79BFF', art: 'aus' },
  { id: 'privat', label: 'Privates', farbe: '#58D9CD', art: 'aus' },
];
export const KATEGORIE = Object.fromEntries(KATEGORIEN.map(k => [k.id, k])) as Record<string, typeof KATEGORIEN[number]>;

/** Drei Sichtweisen auf dieselben Zahlen. */
export type Szenario = 'schlecht' | 'real' | 'gut';
export const SZENARIO_LABEL: Record<Szenario, string> = {
  schlecht: 'Wenn es schlecht läuft', real: 'Realistisch', gut: 'Wenn es gut läuft',
};
/**
 * Szenarien, die sich wirklich unterscheiden (Abnahme 14.10., B11): gleiche Verläufe (Ende, Tiefpunkt, Engpass) werden zu EINER Kachel
 * zusammengefasst — drei identische Kacheln sagen nichts. Eine einzige Gruppe = alle gleich → die Ansicht zeigt statt der Kacheln einen Satz
 * (`SZENARIEN_GLEICH`). Reihenfolge schlecht → real → gut bleibt. Rein, getestet.
 */
export function szenarioGruppen(drei: Readonly<Record<Szenario, Pick<Vorschau, 'wochen' | 'tiefpunkt' | 'engpass'>>>): { szenarien: Szenario[]; label: string }[] {
  const schluessel = (f: Pick<Vorschau, 'wochen' | 'tiefpunkt' | 'engpass'>) => `${Math.round((f.wochen.at(-1)?.stand ?? 0) * 100)}|${Math.round(f.tiefpunkt.stand * 100)}|${f.engpass?.label ?? ''}`;
  const gruppen: { k: string; szenarien: Szenario[] }[] = [];
  for (const sz of ['schlecht', 'real', 'gut'] as const) {
    const k = schluessel(drei[sz]);
    const da = gruppen.find(g => g.k === k);
    if (da) da.szenarien.push(sz); else gruppen.push({ k, szenarien: [sz] });
  }
  return gruppen.map(g => ({ szenarien: g.szenarien, label: g.szenarien.map(sz => SZENARIO_LABEL[sz]).join(' = ') }));
}
/** Der Satz, wenn alle drei Szenarien gleich rechnen (keine unsicheren Eingänge im Zeitraum). */
export const SZENARIEN_GLEICH = 'Schlecht, realistisch und gut rechnen hier gleich — im Zeitraum gibt es keine unsicheren Eingänge (alles ist fest erwartet oder bezahlt).';
/**
 * „Heute auf den Konten“ gegen „frei verfügbar“ (Abnahme 14.10., B11) — EIN Satz für beide Ansichten: Liquidität zeigt das Geld auf den Konten
 * und wie es sich Woche für Woche aus Rechnungen, Zahlungen und Planposten bewegt; die Finanzplanung rechnet „frei verfügbar“ aus dem Kontostand
 * am Monatsende laut Plan, minus Steuerrücklage und offener Umsatzsteuer.
 */
export const CASH_GEGEN_FREI = 'Heute auf den Konten = was jetzt da ist. „Frei verfügbar“ in der Planung = Kontostand am Monatsende laut Plan, minus Steuerrücklage und offener Umsatzsteuer — darum weichen die Zahlen ab.';
/** Ab welcher Wahrscheinlichkeit ein unsicherer Eingang im Szenario zählt. */
const SZENARIO_SCHWELLE: Record<Szenario, number> = { schlecht: 100, real: 60, gut: 1 };

// ── Zahltage — EINE Stelle für Vorschau, Monatssumme und Ende (18.10., Nachprüfung N3/N4) ──────────────────────────────────
// Ein wiederkehrender Posten zahlt am Tag aus `ab` (am Monatsende gekappt: ab 31.01. → 28.02., 31.03. …), alle 1/3/12 Monate, nie vor `ab`
// und nie nach `bis`. Vorher prüfte die Wochen-Vorschau nur den Wochenanfang gegen `bis` (ein Zahltag nach `bis` in derselben Woche zählte
// noch) und ließ Monate ohne den 29.–31. aus.

const SCHRITT: Record<Rhythmus, number> = { einmalig: 0, monatlich: 1, quartal: 3, jaehrlich: 12 };
/** Monatswert eines wiederkehrenden Postens: monatlich 1, Quartal ⅓, Jahr 1/12; einmalig 0. */
export const MONATSANTEIL: Record<Rhythmus, number> = { einmalig: 0, monatlich: 1, quartal: 1 / 3, jaehrlich: 1 / 12 };

/** Der k-te Zahltag eines wiederkehrenden Postens (k = 0 → `ab`), Tag am Monatsende gekappt. */
function kterZahltag(ab: string, schritt: number, k: number): string {
  const [j, mo, ta] = ab.slice(0, 10).split('-').map(Number);
  const ziel = new Date(Date.UTC(j, mo - 1 + schritt * k, 1, 12));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0, 12)).getUTCDate();
  ziel.setUTCDate(Math.min(ta, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Alle Zahltage eines Postens von `von` bis `bisISO` (beide eingeschlossen), aufsteigend. */
export function zahltage(p: Pick<Planposten, 'ab' | 'bis' | 'rhythmus'>, von: string, bisISO: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}/.test(p.ab ?? '') || p.ab > bisISO) return [];
  if (p.bis && p.bis < von) return [];
  if (p.rhythmus === 'einmalig' || !SCHRITT[p.rhythmus]) return p.ab >= von && p.ab <= bisISO ? [p.ab] : [];
  const schritt = SCHRITT[p.rhythmus];
  const raus: string[] = [];
  // Erst grob an `von` heran (Monate), dann Zahltag für Zahltag — nie über `bis` des Postens oder des Zeitraums hinaus.
  const monate = (Number(von.slice(0, 4)) - Number(p.ab.slice(0, 4))) * 12 + Number(von.slice(5, 7)) - Number(p.ab.slice(5, 7));
  for (let k = Math.max(0, Math.floor(monate / schritt) - 1), n = 0; n < 5000; k++, n++) {
    const d = kterZahltag(p.ab, schritt, k);
    if (d > bisISO || (p.bis && d > p.bis)) break;
    if (d >= von) raus.push(d);
  }
  return raus;
}

/** Fällt der Posten in dieser Woche an? Liefert den (ersten) Zahltag, den keine Rechnung ersetzt (`deckung`), oder null. */
function faelligIn(p: Planposten, vonISO: string, bisISO: string, deckung: Deckung = KEINE_DECKUNG): string | null {
  return zahltage(p, vonISO, bisISO).find(t => !deckung(p, t)) ?? null;
}

/** Der letzte Zahltag eines Postens: einmalig `ab`; wiederkehrend mit `bis` der letzte bis dahin (null, wenn er nie zahlt); ohne `bis` offen (null). */
export function letzterZahltag(p: Pick<Planposten, 'ab' | 'bis' | 'rhythmus'>): string | null {
  if (p.rhythmus === 'einmalig') return p.ab;
  if (!p.bis || p.bis < p.ab) return null;
  return zahltage(p, p.ab, p.bis).at(-1) ?? null;
}

/** Tag + n Monate (am Monatsende gekappt). */
const monatePlus = (tag: string, n: number) => kterZahltag(tag, 1, n);

// ── Rechnung statt Plan (21.10., Rundgang 19.10. A2) — EINE Stelle für die Vorschau UND die Kopfzahl „Was reinkommt“ ─────────────────
// Vorher zählten eine gestellte Rechnung eines Mandats und der Planposten desselben Monats beide (Woche ab 02.11.: Rechnung +2.578 € und dieselben
// Posten noch einmal). Regel: Gibt es für einen Mandats-Monat eine Rechnung (gestellt oder bezahlt, nicht storniert, keine Stornorechnung; Mandat +
// Leistungsmonat), zählt die Rechnung — die Zahlung des Planpostens für diesen Monat nicht. Ein Entwurf ersetzt den Plan nur dort, wo er selbst zählt
// (optimistische Vorschau). Keine Monatsrechnung sind Rechnungen aus einem Angebot und Rechnungen nur aus abgerechneten Zusatzmodulen (`za-…`, wie der
// Rechnungs-Server). Ohne solche Rechnungen rechnet alles bit-gleich wie vorher.

/** Vorsilbe/Trenner der Mandats-Posten (= lib/crm/mandant-link.ts `PLANPOSTEN_MANDAT`/`PLANPOSTEN_TEIL`; hier ohne Import, die Datei bleibt leicht). */
const POSTEN_MANDAT = 'lp-mandat-';
const POSTEN_TEIL = '~';
/** Kennungs-Vorsilbe der Positionen aus „abrechnen“ — lib/crm/mandat-zusatz.ts `POS.abrechnen` liest sie von hier (EINE Stelle). */
export const ABGERECHNET_PRAEFIX = 'za-';
const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const monatVon = (tag: string) => tag.slice(0, 7);
const monatPlusN = (monat: string, n: number) => kterZahltag(`${monat}-01`, 1, n).slice(0, 7);
const monateAbstand = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const tagMinus = (tag: string, n: number) => new Date(Date.parse(`${tag.slice(0, 10)}T12:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

/** Das Mandat hinter einem Planposten: Feld `mandatId`, sonst aus der Kennung `lp-mandat-<id>` bzw. `lp-mandat-<id>~…` (sonst null). */
export function mandatVonPosten(p: Partial<Pick<Planposten, 'id' | 'mandatId'>>): string | null {
  if (p.mandatId) return p.mandatId;
  if (!p.id?.startsWith(POSTEN_MANDAT)) return null;
  return p.id.slice(POSTEN_MANDAT.length).split(POSTEN_TEIL)[0] || null;
}

/**
 * Der Leistungsmonat der Zahlung eines Mandats-Postens am Zahltag `tag` („JJJJ-MM“): der Monat der ersten Zahlung + so viele Monate, wie der Zahltag
 * hinter `ab` liegt (einmalig: 0). Der Monat der ersten Zahlung: Feld `leistungsmonat`, sonst der Monat am Ende der Kennung (`…~JJJJ-MM`: Teilmonat,
 * Zusatzmodul, Anrechnung), sonst (Altbestand) der Monat von `ab` − Zahlungsziel (`zielTage`, der Zahltag eines Mandats-Postens ist Beginn der
 * Leistung im Monat + Zahlungsziel — lib/crm/mandat-laufzeit.ts).
 */
export function postenLeistungsmonat(p: Pick<Planposten, 'ab' | 'rhythmus'> & Partial<Pick<Planposten, 'id' | 'leistungsmonat'>>, tag: string, zielTage: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(p.ab ?? '') || !/^\d{4}-\d{2}-\d{2}/.test(tag)) return null;
  const k = SCHRITT[p.rhythmus] ? monateAbstand(monatVon(p.ab), monatVon(tag)) : 0;
  const ausId = /~(\d{4}-\d{2})$/.exec(p.id ?? '')?.[1];
  const erster = p.leistungsmonat && MONAT.test(p.leistungsmonat) ? p.leistungsmonat : ausId && MONAT.test(ausId) ? ausId : monatVon(tagMinus(p.ab, Math.max(0, zielTage)));
  return monatPlusN(erster, k);
}

/** Ersetzt eine Zahlung eines Planpostens (Posten, Zahltag)? */
export type Deckung = (p: Pick<Planposten, 'ab' | 'rhythmus'> & Partial<Pick<Planposten, 'id' | 'mandatId' | 'leistungsmonat'>>, tag: string) => boolean;
/** Keine Rechnung ersetzt etwas (ohne Rechnungen; Altverhalten). */
export const KEINE_DECKUNG: Deckung = () => false;

/** Ist die Rechnung eine Monatsrechnung eines Mandats, die ihren Monat im Plan ersetzt? (gestellt/bezahlt; Entwurf nur mit `mitEntwurf`) */
export function rechnungDecktMonat(r: Pick<Rechnung, 'status' | 'mandatId' | 'leistungVon'> & Partial<Pick<Rechnung, 'art' | 'angebotId' | 'positionen'>>, mitEntwurf = false): boolean {
  if (!r.mandatId || typeof r.leistungVon !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(r.leistungVon)) return false;
  if (r.art === 'storno' || r.angebotId) return false;
  if (!(r.status === 'gestellt' || r.status === 'bezahlt' || (mitEntwurf && r.status === 'geplant'))) return false;
  const pos = r.positionen ?? [];
  return !(pos.length && pos.every(p => typeof p.id === 'string' && p.id.startsWith(ABGERECHNET_PRAEFIX)));
}

/**
 * Die EINE Regel „Rechnung statt Plan“ als Prüfung (Posten, Zahltag) → ersetzt (rein). `mitEntwurf`: auch Entwürfe (nur, wo sie selbst zählen —
 * die optimistische Vorschau). Ohne passende Rechnungen: `KEINE_DECKUNG` (bit-gleich).
 */
export function rechnungDeckung(rechnungen: readonly Rechnung[], opt: { mitEntwurf?: boolean } = {}): Deckung {
  const je = new Map<string, { monat: string; ziel: number }[]>();
  for (const r of rechnungen) {
    if (!rechnungDecktMonat(r, !!opt.mitEntwurf)) continue;
    const ziel = typeof r.zahlungszielTage === 'number' && Number.isFinite(r.zahlungszielTage) && r.zahlungszielTage >= 0 ? r.zahlungszielTage : 14;
    je.set(r.mandatId!, [...(je.get(r.mandatId!) ?? []), { monat: monatVon(r.leistungVon!), ziel }]);
  }
  if (!je.size) return KEINE_DECKUNG;
  return (p, tag) => {
    const mid = mandatVonPosten(p);
    const l = mid ? je.get(mid) : undefined;
    return !!l && l.some(d => postenLeistungsmonat(p, tag, d.ziel) === d.monat);
  };
}

/**
 * Das Kennzeichen eines Planpostens, dessen Zahlung(en) eine gestellte Rechnung ersetzt (24.10., Bau-Test: der ersetzte Posten stand ohne Kennzeichen weiter in
 * „Was reinkommt“) — DIESELBE Regel wie Vorschau und Kopfzahl (`rechnungDeckung`). Einmalig: „durch Rechnung ersetzt“; wiederkehrend: „November 2026 durch
 * Rechnung ersetzt“ bzw. „3 Zahlungen durch Rechnungen ersetzt“. null, wenn keine Zahlung ersetzt ist. Gezählt ab dem Beginn des Postens bis 13 Monate nach heute.
 */
export function ersetztText(p: Pick<Planposten, 'ab' | 'bis' | 'rhythmus'> & Partial<Pick<Planposten, 'id' | 'mandatId' | 'leistungsmonat'>>, heute: string, deckung: Deckung): string | null {
  if (deckung === KEINE_DECKUNG || !/^\d{4}-\d{2}-\d{2}/.test(p.ab ?? '')) return null;
  const von = p.ab < heute ? p.ab : heute;
  const bis = monatePlus(heute, 13);
  const ersetzt = zahltage(p, von, bis).filter(t => deckung(p, t));
  if (!ersetzt.length) return null;
  if (p.rhythmus === 'einmalig') return 'durch Rechnung ersetzt';
  if (ersetzt.length > 1) return `${ersetzt.length} Zahlungen durch Rechnungen ersetzt`;
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const lm = postenLeistungsmonat(p, ersetzt[0], 14) ?? ersetzt[0].slice(0, 7);
  return `${MONATE[Number(lm.slice(5, 7)) - 1]} ${lm.slice(0, 4)} durch Rechnung ersetzt`;
}

/**
 * Was ein Posten „je Monat“ ausmacht (Liquidität › Was reinkommt / Was rausgeht, Nachprüfung 18.10. N3): nur, solange er wirklich zahlt —
 * ein wiederkehrender Posten zählt mit seinem Monatswert (Quartal ⅓, Jahr 1/12), wenn er im nächsten Abstand ab heute (1 bzw. 3 bzw. 12 Monate)
 * einen Zahltag hat. Beendete (letzter Zahltag vorbei) und erst später beginnende zählen nicht; einmalige nie. Seit 21.10. (A2): Zahltage, die eine
 * Rechnung ersetzt (`deckung`, dieselbe Regel wie die Vorschau), zählen nicht.
 */
export function monatswert(p: Pick<Planposten, 'ab' | 'bis' | 'rhythmus' | 'betrag'> & Partial<Pick<Planposten, 'id' | 'mandatId' | 'leistungsmonat'>>, heute: string, deckung: Deckung = KEINE_DECKUNG): number {
  const schritt = SCHRITT[p.rhythmus];
  if (!schritt) return 0;
  const fensterEnde = new Date(Date.parse(`${monatePlus(heute, schritt)}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const fenster = zahltage(p, heute, fensterEnde).filter(t => !deckung(p, t));
  return fenster.length ? p.betrag * MONATSANTEIL[p.rhythmus] : 0;
}

/** Summe je Monat einer Liste (gerundet auf den Euro für die Kopfzeile) — `deckung` wie in der Vorschau (`rechnungDeckung`). */
export const monatsSumme = (l: readonly (Pick<Planposten, 'ab' | 'bis' | 'rhythmus' | 'betrag'> & Partial<Pick<Planposten, 'id' | 'mandatId' | 'leistungsmonat'>>)[], heute: string, deckung: Deckung = KEINE_DECKUNG): number =>
  Math.round(l.reduce((s, p) => s + monatswert(p, heute, deckung), 0));

const tagText = (d: string, heute: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4) !== heute.slice(0, 4) ? d.slice(2, 4) : ''}`;
const RHYTHMUS_TEXT: Record<Rhythmus, string> = { einmalig: 'einmalig', monatlich: 'jeden Monat', quartal: 'jedes Quartal', jaehrlich: 'jedes Jahr' };

/**
 * Die Zeile unter dem Posten (N3): Rhythmus, dazu „ab …“ (beginnt später), „bis …“ (letzter Zahltag) bzw. „beendet · letzte Zahlung …“ —
 * vorher stand nur der Rhythmus da, auch bei einem Posten, der längst nicht mehr zahlt.
 */
export function postenZeitText(p: Pick<Planposten, 'ab' | 'bis' | 'rhythmus'>, heute: string): string {
  if (p.rhythmus === 'einmalig') return `einmalig am ${tagText(p.ab, heute)}${p.ab < heute ? ' (vorbei)' : ''}`;
  const letzte = letzterZahltag(p);
  if (p.bis && (!letzte || letzte < heute)) return letzte ? `beendet · letzte Zahlung ${tagText(letzte, heute)}` : 'beendet';
  return [RHYTHMUS_TEXT[p.rhythmus], p.ab > heute ? `ab ${tagText(p.ab, heute)}` : '', letzte ? `bis ${tagText(letzte, heute)}` : ''].filter(Boolean).join(' · ');
}

export function vorschau(
  firmen: Firma[],
  rechnungen: Rechnung[],
  zahlungen: Zahlung[],
  merkposten: Merkposten[],
  heute: string,
  wochenAnzahl = 12,
  optimistisch = false,
  planposten: Planposten[] = [],
  szenario: Szenario = 'real',
  nurFirma?: string,
  /** true: Privates bleibt draußen (Business-Sicht). Standard für alle Firmen-Rechnungen. */
  ohnePrivat = false,
): Vorschau {
  if (ohnePrivat && nurFirma !== PRIVAT_ID && gehoertZuPrivat(nurFirma)) {
    // Eine Privat-Einheit ausdrücklich gewählt (Selbstständigkeit): nur das ausdrücklich Private bleibt draußen — wie vor dem 05.10.
    firmen = firmen.filter(x => x.id !== PRIVAT_ID); rechnungen = ohnePrivatPosten(rechnungen as (Rechnung & { firmaId?: string })[]);
    zahlungen = ohnePrivatPosten(zahlungen); merkposten = ohnePrivatPosten(merkposten); planposten = ohnePrivatPosten(planposten);
  } else if (ohnePrivat && nurFirma !== PRIVAT_ID) {
    firmen = businessFirmen(firmen); rechnungen = nurBusiness(rechnungen as (Rechnung & { firmaId?: string })[]);
    zahlungen = nurBusiness(zahlungen); merkposten = nurBusiness(merkposten); planposten = nurBusiness(planposten);
  }
  // „optimistisch" bleibt als Kurzform erhalten: es entspricht dem guten Fall.
  const schwelle = optimistisch ? SZENARIO_SCHWELLE.gut : SZENARIO_SCHWELLE[szenario];
  // Rechnung statt Plan (21.10., A2): die Zahlung eines Mandats-Postens, deren Monat eine Rechnung schon trägt, zählt nicht — Entwürfe nur, wo sie selbst zählen.
  const deckung = rechnungDeckung(rechnungen, { mitEntwurf: optimistisch });
  const start = (nurFirma ? firmen.filter(f => f.id === nurFirma) : firmen)
    .reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const fix = monatlicheLast(merkposten);
  const fixSumme = fix.reduce((s, f) => s + f.betrag, 0);

  const heuteD = new Date(`${heute}T00:00:00`);
  const wochen: Woche[] = [];
  let stand = start;
  let summeEin = 0, summeAus = 0, unsicher = 0;

  for (let i = 0; i < wochenAnzahl; i++) {
    const von = tage(heuteD, i * 7);
    const bis = tage(heuteD, i * 7 + 6);
    const vonISO = iso(von), bisISO = iso(bis);
    const bewegungen: Bewegung[] = [];

    // Eingänge: offene Rechnungen mit Fälligkeit in dieser Woche.
    for (const r of rechnungen) {
      // Stornierte Rechnungen (28.09., K3) bringen kein Geld mehr — sie bleiben nur als Beleg stehen.
      if (r.status === 'bezahlt' || r.status === 'storniert' || !r.betrag) continue;
      if (nurFirma && (r as { firmaId?: string }).firmaId && (r as { firmaId?: string }).firmaId !== nurFirma) continue;
      const geplant = r.status === 'geplant';
      if (geplant && !optimistisch) continue;
      // Ohne Fälligkeit: gestellte in der ersten Woche, geplante in der vierten.
      const faellig = r.faellig ?? iso(tage(heuteD, geplant ? 28 : 7));
      if (faellig < vonISO || faellig > bisISO) continue;
      // Überfälliges landet in der laufenden Woche, nicht in der Vergangenheit.
      // 24.10. (Bau-Test): eine Rechnung aus einem Mandat zählt unter „Mandate & Honorare“ (vorher „Sonstige Einnahmen“) — dieselbe Kategorie wie ihr Planposten.
      bewegungen.push({ datum: faellig, text: `${r.kunde}: ${r.titel}`.slice(0, 60), betrag: r.betrag, art: 'eingang', sicher: !geplant, ...(r.mandatId ? { kategorie: 'mandat' } : {}), ...(r.id ? { quelle: { art: 'rechnung' as const, id: r.id } } : {}) });
      if (geplant) unsicher += r.betrag;
    }
    // Überfällige Rechnungen in Woche 1 mitnehmen.
    if (i === 0) {
      for (const r of rechnungen) {
        if (r.status === 'bezahlt' || r.status === 'storniert' || !r.betrag || !r.faellig || r.faellig >= vonISO) continue;
        if (r.status === 'geplant' && !optimistisch) continue;
        bewegungen.push({ datum: r.faellig, text: `${r.kunde}: ${r.titel} (überfällig)`.slice(0, 60), betrag: r.betrag, art: 'eingang', sicher: false, ...(r.mandatId ? { kategorie: 'mandat' } : {}), ...(r.id ? { quelle: { art: 'rechnung' as const, id: r.id } } : {}) });
        unsicher += r.betrag;
      }
    }

    // Ausgänge: offene Zahlungen.
    for (const z of zahlungen) {
      if (z.status !== 'offen' || !z.betrag) continue;
      if (nurFirma && (z as { firmaId?: string }).firmaId && (z as { firmaId?: string }).firmaId !== nurFirma) continue;
      const faellig = z.faellig ?? iso(tage(heuteD, 14));
      const inWoche = faellig >= vonISO && faellig <= bisISO;
      const ueberfaellig = i === 0 && faellig < vonISO;
      if (!inWoche && !ueberfaellig) continue;
      bewegungen.push({ datum: faellig, text: `${z.an}${ueberfaellig ? ' (überfällig)' : ''}`.slice(0, 60), betrag: -z.betrag, art: 'ausgang', sicher: true, ...(z.id ? { quelle: { art: 'zahlung' as const, id: z.id } } : {}) });
    }

    // Geplante Posten — wiederkehrend oder einmalig.
    for (const p of planposten) {
      // Filter je Firma: erlaubt eine Planung pro Gesellschaft statt im Topf.
      if (nurFirma && p.firmaId && p.firmaId !== nurFirma) continue;
      const datum = faelligIn(p, vonISO, bisISO, deckung);
      if (!datum) continue;
      // Einnahmen zählen nur, wenn sie im gewählten Szenario überhaupt eintreten.
      // Ausgaben, die an unsicheren Einnahmen hängen (z. B. die USt-Zahllast
      // aus geplanten Umsätzen), tragen eine Wahrscheinlichkeit und folgen ihr —
      // sonst stünde im schlechten Fall Steuer auf Umsatz, der nie kam.
      if (!p.sicher && (p.betrag > 0 || p.wahrscheinlich != null)) {
        const chance = p.wahrscheinlich ?? 50;
        if (chance < schwelle) { if (p.betrag > 0) unsicher += p.betrag; continue; }
      }
      bewegungen.push({
        datum, text: p.titel.slice(0, 60), betrag: p.betrag,
        art: p.betrag > 0 ? 'eingang' : 'fix', sicher: p.sicher,
        kategorie: p.kategorie, firmaId: p.firmaId, ...(p.id ? { quelle: { art: 'planposten' as const, id: p.id } } : {}),
      });
      if (!p.sicher && p.betrag > 0) unsicher += p.betrag;
    }

    // Fixkosten aus den Merkposten — nur, solange es keine eigenen Planposten
    // gibt. Sonst würde dasselbe Geld zweimal abgezogen.
    if (fixSumme && i % 4 === 0 && !planposten.length) {
      bewegungen.push({ datum: vonISO, text: `Fixkosten (${fix.map(f => f.text).join(', ')})`.slice(0, 60), betrag: -fixSumme, art: 'fix', sicher: true });
    }

    const eingang = bewegungen.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
    const ausgang = bewegungen.filter(b => b.betrag < 0).reduce((s, b) => s + Math.abs(b.betrag), 0);
    stand = stand + eingang - ausgang;
    summeEin += eingang; summeAus += ausgang;

    wochen.push({
      von: vonISO, bis: bisISO,
      label: i === 0 ? 'diese Woche' : `KW +${i}`,
      eingang, ausgang, stand,
      bewegungen: bewegungen.sort((a, b) => a.datum.localeCompare(b.datum)),
    });
  }

  const engpass = wochen.find(w => w.stand < 0) ?? null;
  const tief = wochen.reduce((min, w) => (w.stand < min.stand ? { stand: w.stand, label: w.label } : min), { stand: start, label: 'heute' });

  return { start, wochen, engpass, tiefpunkt: tief, summeEin, summeAus, unsicher };
}
