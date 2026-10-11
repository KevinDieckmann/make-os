// ─── Produkte · Leistungstreppe — die Daten (rein, client-sicher, getestet) ─────────────────────────────────────────
// Entscheidung 10.10.: Produkte & Mandate ist ein eigener Leistenpunkt; im Produkt-Bereich werden die Pakete sauber abgebildet und immer
// visualisiert — wohin wir wollen und warum die Schritte so wichtig sind. Das Modell ist GENERISCH: welche Stufen, Preise, Regeln und
// Messgrößen eine Instanz hat, sind Daten des Haushalts (Bestand `produkt-treppe--<haushalt>`, Business, lib/crm/treppe-server.ts) — nie
// Konstanten im Code (Plattform-Regel; die Demo-Saat bringt eine erfundene Beispiel-Treppe).
//
// Gespeichert wird nur, was es sonst nirgends gibt:
//   stufen         die Leistungstreppe: Stufen in Ebenen (gleiche Ebene = Alternativen nebeneinander), je Stufe Aufgabe/„warum vor der nächsten“,
//                  Ergebnis + Lieferobjekte, Kennzahl beim Kunden, Dauer, Aufwand (h → Kapazität), Preis/Preisart, Regeln (Mindestlaufzeit,
//                  Anrechnung, Bonus, höchstens N gleichzeitig), verknüpfte Leistungen aus dem Katalog, Ziel im Zieljahr (Umsatz, Kunden)
//   kreislauf      die Kundenreise als Kreislauf: Stationen mit Messgröße und Ziel (Ist aus einer verknüpften Stufe)
//   roadmap        Produkt-Entwicklung: geplante Pakete mit Zeitplan und Status
//   positionierung Claim, Zielgruppe, Problem, Versprechen, Story — die Seite, die die Heads im Datenpaket lesen dürfen
//   kunden         je Mandat (Kennung): Stufe (sonst aus dem Produkt abgeleitet), erledigte Lieferobjekte, nächster Schritt, Verlauf der Stufen
//   reports        je Mandat: letzter Fortschritts-Report (erstellt, Datei-Kennung, gesendet)
//   marken         Merker der Vorschläge (Report alle zwei Wochen, nächste Stufe einmal) — damit der Morgenlauf nichts doppelt vorschlägt
// Der aktuelle Schritt eines Kunden ist die Phase des Mandats (CRM, `Mandat.phase`) — nie doppelt gespeichert.
// Änderungen kommen als Einzel-Schritte mit Stand je Eintrag (409 bei fremder Änderung), nie als ganze Datei; über den Grenzen → 413,
// Unsinn → 400 — nie still gekürzt. Keine Personendaten Dritter: Mandate nur als Kennung, wer geändert hat = Speichername.

import { istKalendertag } from '@/lib/zeit';

export const TREPPE_VERSION = 1;
/** Antwort auf eine Anfrage aus der Sicht Privat: hier gibt es nichts — Produkte & Mandate sind Business. */
export const NUR_BUSINESS_TREPPE = 'Produkte & Mandate gehören zu Business — im Privat-Bereich gibt es keine Leistungstreppe.';

export type PreisArt = 'kostenlos' | 'fest' | 'monat' | 'jahr';
export const PREIS_ARTEN: readonly { id: PreisArt; label: string }[] = [
  { id: 'kostenlos', label: 'kostenlos' }, { id: 'fest', label: 'Festpreis' }, { id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' },
];

export interface StufenRegeln {
  /** Mindestlaufzeit in Monaten (Monats-/Jahrespakete). */
  mindestlaufzeitMonate?: number;
  /** Wird angerechnet — Freitext, z. B. „auf die nächste Stufe“. */
  anrechnung?: string;
  /** Bonus bei Zielen — Freitext. */
  bonus?: string;
  /** Höchstens so viele Kunden gleichzeitig in dieser Stufe (Kapazitätsgrenze). */
  maxGleichzeitig?: number;
}

export interface TreppenStufe {
  /** `ts-…` */
  id: string;
  name: string;
  /** Ebene der Treppe (1 = erste Stufe). Gleiche Ebene = Alternativen nebeneinander. */
  ebene: number;
  /** Aufgabe der Stufe — und warum sie vor der nächsten kommt. */
  aufgabe?: string;
  /** Was der Kunde am Ende hat. */
  ergebnis?: string;
  /** Lieferobjekte (Liste, abhakbar je Kunde). */
  lieferobjekte: string[];
  /** Kennzahl, die sich beim Kunden bewegen soll. */
  kennzahl?: string;
  dauerTage?: number;
  /** Aufwand in Stunden für die ganze Stufe — bei Preisart „je Monat“ je Monat, „je Jahr“ je Jahr (→ Kapazität). */
  aufwandStunden?: number;
  /** Preis netto in Euro (bei „kostenlos“ ohne Betrag). */
  preis: { art: PreisArt; betrag?: number };
  regeln: StufenRegeln;
  /** Verknüpfte Leistungen aus dem Katalog (Produkte) — Mandate auf diesen Produkten stehen ohne eigene Wahl in dieser Stufe. */
  leistungIds: string[];
  /** Ziel im Zieljahr der Treppe. */
  ziel?: { umsatz?: number; kunden?: number };
  geaendert: string;
  geaendertVon: string;
}

export interface KreislaufStation {
  /** `st-…` */
  id: string;
  name: string;
  /** Messgröße der Station (Text, z. B. „Anfragen je Monat“). */
  messgroesse?: string;
  /** Ziel der Messgröße (Zahl, optional). */
  ziel?: number;
  /** Ist von Hand (gilt nur, wenn keine Stufe verknüpft ist). */
  ist?: number;
  /** Verknüpfte Stufe — dann ist das Ist die Zahl der Kunden in dieser Stufe. */
  stufeId?: string;
  geaendert: string;
  geaendertVon: string;
}

export type PaketStatus = 'idee' | 'geplant' | 'in_arbeit' | 'fertig';
export const PAKET_STATUS: readonly { id: PaketStatus; label: string }[] = [
  { id: 'idee', label: 'Idee' }, { id: 'geplant', label: 'Geplant' }, { id: 'in_arbeit', label: 'In Arbeit' }, { id: 'fertig', label: 'Fertig' },
];
export interface RoadmapPaket {
  /** `rp-…` */
  id: string;
  titel: string;
  /** Warum dieses Paket — wohin es führt. */
  warum?: string;
  /** In welche Stufe es gehört (optional). */
  stufeId?: string;
  /** Monat JJJJ-MM. */
  start?: string;
  fertig?: string;
  status: PaketStatus;
  geaendert: string;
  geaendertVon: string;
}

export const POSITIONIERUNG_FELDER = ['claim', 'zielgruppe', 'problem', 'versprechen', 'story'] as const;
export type PositionierungFeld = typeof POSITIONIERUNG_FELDER[number];
export const POSITIONIERUNG_LABEL: Record<PositionierungFeld, string> = { claim: 'Claim', zielgruppe: 'Zielgruppe', problem: 'Problem', versprechen: 'Versprechen', story: 'Story' };
const POSITIONIERUNG_MAX: Record<PositionierungFeld, number> = { claim: 200, zielgruppe: 1000, problem: 1500, versprechen: 1500, story: 4000 };
export type Positionierung = Partial<Record<PositionierungFeld, string>> & { geaendert?: string; geaendertVon?: string };

export interface ErledigtMarke { was: string; am: string; von: string }
export interface KundenFortschritt {
  /** Gewählte Stufe — fehlt: aus dem Produkt des Mandats abgeleitet (lib/crm/treppe.ts `stufeVonMandat`). */
  stufeId?: string;
  erledigt: ErledigtMarke[];
  naechster?: { text: string; datum: string };
  /** Verlauf der Stufen (Übergänge im Zielbild). */
  verlauf: { stufeId: string; ab: string }[];
  geaendert: string;
  geaendertVon: string;
}
export interface ReportStand { erstelltAm?: string; dateiId?: string; gesendetAm?: string; gesendetVon?: string }

export interface TreppeDatei {
  version: number;
  /** Jahr, auf das sich die Ziele der Stufen beziehen. */
  zielJahr: number;
  stufen: TreppenStufe[];
  kreislauf: KreislaufStation[];
  roadmap: RoadmapPaket[];
  positionierung: Positionierung;
  kunden: Record<string, KundenFortschritt>;
  reports: Record<string, ReportStand>;
  /** `report:<mandat>` → Tag des letzten Vorschlags · `stufe:<mandat>:<stufe>` → Tag des Vorschlags (einmal). */
  marken: Record<string, string>;
}
export const leereTreppe = (jahr: number): TreppeDatei => ({ version: TREPPE_VERSION, zielJahr: jahr, stufen: [], kreislauf: [], roadmap: [], positionierung: {}, kunden: {}, reports: {}, marken: {} });

/** Grenzen — darüber wird abgelehnt (413), nie gekürzt. */
export const TREPPE_GRENZEN = { stufen: 30, stationen: 20, roadmap: 40, kunden: 2000, lieferobjekte: 20, erledigt: 60, leistungen: 10, marken: 6000, ops: 60, ebene: 12 } as const;
export const TEXT_MAX = { name: 80, aufgabe: 1000, ergebnis: 1000, lieferobjekt: 160, kennzahl: 200, regel: 300, naechster: 300, messgroesse: 200, titel: 120, warum: 600 } as const;

// ── Säubern (Lesen: robust — kaputte Einträge fallen weg, nie ein Absturz) ───────────────────────────────────────

const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:~-]{0,79}$/;
export const STUFE_ID = /^ts-[a-z0-9-]{4,60}$/;
export const STATION_ID = /^st-[a-z0-9-]{4,60}$/;
export const PAKET_ID = /^rp-[a-z0-9-]{4,60}$/;
export const MANDAT_KENNUNG = KENNUNG;
const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const PREIS_IDS = new Set<string>(PREIS_ARTEN.map(p => p.id));
const STATUS_IDS = new Set<string>(PAKET_STATUS.map(p => p.id));
const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(/\./g, '').replace(',', '.'))) ? Number(v.replace(/\./g, '').replace(',', '.')) : null);
/** Einzeiliger Text (Leerraum zusammengezogen). */
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
/** Mehrzeiliger Text (Absätze bleiben, höchstens zwei Leerzeilen). */
const absatz = (v: unknown): string => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '');
const rund2 = (n: number) => Math.round(n * 100) / 100;
const zeitstempel = (v: unknown) => (typeof v === 'string' && v.length <= 40 ? v : '');
const opt = <K extends string>(k: K, w: string | undefined | null): Partial<Record<K, string>> => (w ? { [k]: w } as Record<K, string> : {});

function stufeLesen(o: Record<string, unknown>): TreppenStufe | null {
  const id = text(o.id), name = text(o.name);
  if (!STUFE_ID.test(id) || !name) return null;
  const p = (o.preis && typeof o.preis === 'object' ? o.preis : {}) as Record<string, unknown>;
  const art = PREIS_IDS.has(text(p.art)) ? text(p.art) as PreisArt : 'fest';
  const betrag = zahl(p.betrag);
  const r = (o.regeln && typeof o.regeln === 'object' ? o.regeln : {}) as Record<string, unknown>;
  const ml = zahl(r.mindestlaufzeitMonate), mg = zahl(r.maxGleichzeitig);
  const z = (o.ziel && typeof o.ziel === 'object' ? o.ziel : {}) as Record<string, unknown>;
  const zu = zahl(z.umsatz), zk = zahl(z.kunden);
  const dauer = zahl(o.dauerTage), aufwand = zahl(o.aufwandStunden);
  const ebene = zahl(o.ebene);
  return {
    id, name: name.slice(0, TEXT_MAX.name),
    ebene: ebene !== null && ebene >= 1 ? Math.min(TREPPE_GRENZEN.ebene, Math.round(ebene)) : 1,
    ...opt('aufgabe', absatz(o.aufgabe).slice(0, TEXT_MAX.aufgabe)), ...opt('ergebnis', absatz(o.ergebnis).slice(0, TEXT_MAX.ergebnis)),
    lieferobjekte: (Array.isArray(o.lieferobjekte) ? o.lieferobjekte : []).map(text).filter(Boolean).map(x => x.slice(0, TEXT_MAX.lieferobjekt)).slice(0, TREPPE_GRENZEN.lieferobjekte),
    ...opt('kennzahl', text(o.kennzahl).slice(0, TEXT_MAX.kennzahl)),
    ...(dauer !== null && dauer > 0 && dauer <= 1100 ? { dauerTage: Math.round(dauer) } : {}),
    ...(aufwand !== null && aufwand > 0 && aufwand <= 5000 ? { aufwandStunden: rund2(aufwand) } : {}),
    preis: { art, ...(art !== 'kostenlos' && betrag !== null && betrag > 0 && betrag <= 10_000_000 ? { betrag: rund2(betrag) } : {}) },
    regeln: {
      ...(ml !== null && ml > 0 && ml <= 120 ? { mindestlaufzeitMonate: Math.round(ml) } : {}),
      ...opt('anrechnung', text(r.anrechnung).slice(0, TEXT_MAX.regel)), ...opt('bonus', text(r.bonus).slice(0, TEXT_MAX.regel)),
      ...(mg !== null && mg >= 1 && mg <= 1000 ? { maxGleichzeitig: Math.round(mg) } : {}),
    },
    leistungIds: Array.from(new Set((Array.isArray(o.leistungIds) ? o.leistungIds : []).map(text).filter(x => KENNUNG.test(x)))).slice(0, TREPPE_GRENZEN.leistungen),
    ...((zu !== null && zu > 0) || (zk !== null && zk > 0) ? { ziel: { ...(zu !== null && zu > 0 ? { umsatz: rund2(Math.min(zu, 1e9)) } : {}), ...(zk !== null && zk > 0 ? { kunden: Math.min(100_000, Math.round(zk)) } : {}) } } : {}),
    geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function stationLesen(o: Record<string, unknown>): KreislaufStation | null {
  const id = text(o.id), name = text(o.name);
  if (!STATION_ID.test(id) || !name) return null;
  const z = zahl(o.ziel), i = zahl(o.ist);
  return {
    id, name: name.slice(0, TEXT_MAX.name), ...opt('messgroesse', text(o.messgroesse).slice(0, TEXT_MAX.messgroesse)),
    ...(z !== null && z >= 0 && z <= 1e9 ? { ziel: rund2(z) } : {}), ...(i !== null && i >= 0 && i <= 1e9 ? { ist: rund2(i) } : {}),
    ...(STUFE_ID.test(text(o.stufeId)) ? { stufeId: text(o.stufeId) } : {}),
    geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function paketLesen(o: Record<string, unknown>): RoadmapPaket | null {
  const id = text(o.id), titel = text(o.titel);
  if (!PAKET_ID.test(id) || !titel) return null;
  return {
    id, titel: titel.slice(0, TEXT_MAX.titel), ...opt('warum', absatz(o.warum).slice(0, TEXT_MAX.warum)),
    ...(STUFE_ID.test(text(o.stufeId)) ? { stufeId: text(o.stufeId) } : {}),
    ...(MONAT.test(text(o.start)) ? { start: text(o.start) } : {}), ...(MONAT.test(text(o.fertig)) ? { fertig: text(o.fertig) } : {}),
    status: STATUS_IDS.has(text(o.status)) ? text(o.status) as PaketStatus : 'idee',
    geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function positionierungLesen(v: unknown): Positionierung {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const p: Positionierung = {};
  for (const f of POSITIONIERUNG_FELDER) { const t = (f === 'claim' ? text(o[f]) : absatz(o[f])).slice(0, POSITIONIERUNG_MAX[f]); if (t) p[f] = t; }
  if (zeitstempel(o.geaendert)) { p.geaendert = zeitstempel(o.geaendert); p.geaendertVon = text(o.geaendertVon).slice(0, 40); }
  return p;
}

function kundeLesen(o: Record<string, unknown>): KundenFortschritt {
  const erledigt = (Array.isArray(o.erledigt) ? o.erledigt : []).flatMap(x => {
    const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const was = text(e.was).slice(0, TEXT_MAX.lieferobjekt);
    return was && istKalendertag(e.am) ? [{ was, am: e.am as string, von: text(e.von).slice(0, 40) }] : [];
  }).slice(0, TREPPE_GRENZEN.erledigt);
  const n = (o.naechster && typeof o.naechster === 'object' ? o.naechster : {}) as Record<string, unknown>;
  const verlauf = (Array.isArray(o.verlauf) ? o.verlauf : []).flatMap(x => {
    const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return STUFE_ID.test(text(e.stufeId)) && istKalendertag(e.ab) ? [{ stufeId: text(e.stufeId), ab: e.ab as string }] : [];
  }).slice(-50);
  return {
    ...(STUFE_ID.test(text(o.stufeId)) ? { stufeId: text(o.stufeId) } : {}),
    erledigt,
    ...(text(n.text) && istKalendertag(n.datum) ? { naechster: { text: text(n.text).slice(0, TEXT_MAX.naechster), datum: n.datum as string } } : {}),
    verlauf, geaendert: zeitstempel(o.geaendert), geaendertVon: text(o.geaendertVon).slice(0, 40),
  };
}

function reportLesen(o: Record<string, unknown>): ReportStand {
  return {
    ...(istKalendertag(o.erstelltAm) ? { erstelltAm: o.erstelltAm as string } : {}),
    ...(typeof o.dateiId === 'string' && /^d-[a-z0-9-]{4,60}$/.test(o.dateiId) ? { dateiId: o.dateiId } : {}),
    ...(istKalendertag(o.gesendetAm) ? { gesendetAm: o.gesendetAm as string, gesendetVon: text(o.gesendetVon).slice(0, 40) } : {}),
  };
}

/** Den Bestand lesen — Unlesbares fällt weg (Liste), fehlende Teile gelten als leer. */
export function treppeAus(roh: unknown, jahr: number): TreppeDatei {
  if (!roh || typeof roh !== 'object') return leereTreppe(jahr);
  const o = roh as Record<string, unknown>;
  const liste = <T,>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] => (Array.isArray(v) ? v : []).flatMap(x => (x && typeof x === 'object' ? [f(x as Record<string, unknown>)] : [])).filter((x): x is T => !!x);
  const karte = <T,>(v: unknown, f: (x: Record<string, unknown>) => T): Record<string, T> => {
    const raus: Record<string, T> = {};
    for (const [k, x] of Object.entries(v && typeof v === 'object' ? v as Record<string, unknown> : {})) if (KENNUNG.test(k) && x && typeof x === 'object') raus[k] = f(x as Record<string, unknown>);
    return raus;
  };
  const zj = zahl(o.zielJahr);
  const marken: Record<string, string> = {};
  for (const [k, v] of Object.entries(o.marken && typeof o.marken === 'object' ? o.marken as Record<string, unknown> : {})) if (k.length <= 200 && /^(report|stufe):/.test(k) && istKalendertag(v)) marken[k] = v as string;
  return {
    version: TREPPE_VERSION, zielJahr: zj !== null && zj >= 2000 && zj <= 2100 ? Math.round(zj) : jahr,
    stufen: liste(o.stufen, stufeLesen), kreislauf: liste(o.kreislauf, stationLesen), roadmap: liste(o.roadmap, paketLesen),
    positionierung: positionierungLesen(o.positionierung), kunden: karte(o.kunden, kundeLesen), reports: karte(o.reports, reportLesen), marken,
  };
}

// ── Schreiben: Einzel-Schritte mit Stand ─────────────────────────────────────────────────────────────────────────

export type TreppeOp =
  | { op: 'stufe'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'stufe-weg'; id: string; stand?: string }
  | { op: 'station'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'station-weg'; id: string; stand?: string }
  | { op: 'paket'; eintrag: Record<string, unknown>; stand?: string }
  | { op: 'paket-weg'; id: string; stand?: string }
  | { op: 'positionierung'; felder: Record<string, unknown>; stand?: string }
  | { op: 'zieljahr'; jahr: number }
  | { op: 'kunde'; mandatId: string; felder: { stufeId?: string | null; naechster?: { text: string; datum: string } | null }; stand?: string }
  | { op: 'lieferobjekt'; mandatId: string; was: string; erledigt: boolean }
  | { op: 'report-gesendet'; mandatId: string }
  | { op: 'vorlage' };

export interface AnwendenKontext {
  person: string;
  jetzt: string;
  heute: string;
  /** Fingerabdruck eines Eintrags (Server: lib/store/fingerabdruck.ts) — injiziert, damit diese Datei client-sicher bleibt. */
  standVon: (x: object) => string;
  neueId: (praefix: 'ts' | 'st' | 'rp') => string;
}
export type AnwendenErgebnis =
  | { ok: true; datei: TreppeDatei; geaendert: string[] }
  | { ok: false; status: 409; konflikte: { op: number; id: string }[] }
  | { ok: false; status: 400 | 413; fehler: string };

class Abgelehnt extends Error { constructor(public status: 400 | 413, msg: string) { super(msg); } }
const nein = (msg: string, status: 400 | 413 = 400): never => { throw new Abgelehnt(status, msg); };

/** Felder eines Teil-Eintrags auf den alten legen — `null` entfernt ein optionales Feld, `undefined` bleibt beim alten. */
function mischen(alt: Record<string, unknown> | undefined, teil: Record<string, unknown>): Record<string, unknown> {
  const raus: Record<string, unknown> = { ...(alt ?? {}) };
  for (const [k, v] of Object.entries(teil)) { if (v === null) delete raus[k]; else if (v !== undefined) raus[k] = v; }
  return raus;
}
const laenge = (v: unknown, max: number, label: string) => { if (v !== undefined && typeof v === 'string' && v.trim().length > max) nein(`${label} ist zu lang (höchstens ${max} Zeichen).`, 413); };
const zahlIn = (o: Record<string, unknown>, k: string, min: number, max: number, label: string) => {
  if (o[k] === undefined) return;
  const n = zahl(o[k]); if (n === null || n < min || n > max) nein(`${label}: ${min} bis ${max.toLocaleString('de-DE')}.`);
};

/** Prüft die Rohwerte einer Stufe (vor dem Säubern), damit nichts still verschwindet. */
export function stufePruefen(o: Record<string, unknown>): void {
  if (!text(o.name)) nein('Die Stufe braucht einen Namen.');
  laenge(o.name, TEXT_MAX.name, 'Der Name'); laenge(o.aufgabe, TEXT_MAX.aufgabe, 'Die Aufgabe'); laenge(o.ergebnis, TEXT_MAX.ergebnis, 'Das Ergebnis'); laenge(o.kennzahl, TEXT_MAX.kennzahl, 'Die Kennzahl');
  zahlIn(o, 'ebene', 1, TREPPE_GRENZEN.ebene, 'Ebene'); zahlIn(o, 'dauerTage', 0, 1100, 'Dauer (Tage)'); zahlIn(o, 'aufwandStunden', 0, 5000, 'Aufwand (Stunden)');
  if (o.lieferobjekte !== undefined) {
    if (!Array.isArray(o.lieferobjekte)) nein('Lieferobjekte: eine Liste.');
    const l = (o.lieferobjekte as unknown[]).map(text).filter(Boolean);
    if (l.length > TREPPE_GRENZEN.lieferobjekte) nein(`Höchstens ${TREPPE_GRENZEN.lieferobjekte} Lieferobjekte je Stufe — nichts gespeichert.`, 413);
    for (const x of l) if (x.length > TEXT_MAX.lieferobjekt) nein(`Ein Lieferobjekt ist zu lang (höchstens ${TEXT_MAX.lieferobjekt} Zeichen).`, 413);
  }
  const p = o.preis === undefined ? undefined : (o.preis && typeof o.preis === 'object' ? o.preis as Record<string, unknown> : nein('Preis: ein Objekt mit Art und Betrag.'));
  if (p) {
    if (!PREIS_IDS.has(text(p.art))) nein('Unbekannte Preisart (kostenlos, fest, monat, jahr).');
    if (p.betrag !== undefined && p.betrag !== null && p.betrag !== '') { const b = zahl(p.betrag); if (b === null || b < 0 || b > 10_000_000) nein('Preis: eine Zahl ab 0 (Euro, netto).'); }
  }
  const r = o.regeln === undefined ? undefined : (o.regeln && typeof o.regeln === 'object' ? o.regeln as Record<string, unknown> : nein('Regeln: ein Objekt.'));
  if (r) {
    zahlIn(r, 'mindestlaufzeitMonate', 0, 120, 'Mindestlaufzeit (Monate)'); zahlIn(r, 'maxGleichzeitig', 1, 1000, 'Höchstens gleichzeitig');
    laenge(r.anrechnung, TEXT_MAX.regel, 'Die Anrechnung'); laenge(r.bonus, TEXT_MAX.regel, 'Der Bonus');
  }
  if (o.leistungIds !== undefined) {
    if (!Array.isArray(o.leistungIds)) nein('Leistungen: eine Liste von Kennungen.');
    const l = (o.leistungIds as unknown[]).map(text);
    if (l.length > TREPPE_GRENZEN.leistungen) nein(`Höchstens ${TREPPE_GRENZEN.leistungen} Leistungen je Stufe.`, 413);
    for (const x of l) if (!KENNUNG.test(x)) nein('Leistungen: nur Kennungen aus dem Katalog.');
  }
  const z = o.ziel === undefined ? undefined : (o.ziel && typeof o.ziel === 'object' ? o.ziel as Record<string, unknown> : nein('Ziel: ein Objekt mit Umsatz und/oder Kunden.'));
  if (z) { zahlIn(z, 'umsatz', 0, 1e9, 'Umsatzziel (Euro)'); zahlIn(z, 'kunden', 0, 100_000, 'Kundenziel'); }
}
function stationPruefen(o: Record<string, unknown>, stufen: readonly { id: string }[]): void {
  if (!text(o.name)) nein('Die Station braucht einen Namen.');
  laenge(o.name, TEXT_MAX.name, 'Der Name'); laenge(o.messgroesse, TEXT_MAX.messgroesse, 'Die Messgröße');
  zahlIn(o, 'ziel', 0, 1e9, 'Ziel'); zahlIn(o, 'ist', 0, 1e9, 'Ist');
  if (o.stufeId !== undefined && !stufen.some(s => s.id === text(o.stufeId))) nein('Diese Stufe gibt es nicht (mehr).');
}
function paketPruefen(o: Record<string, unknown>, stufen: readonly { id: string }[]): void {
  if (!text(o.titel)) nein('Das Paket braucht einen Titel.');
  laenge(o.titel, TEXT_MAX.titel, 'Der Titel'); laenge(o.warum, TEXT_MAX.warum, 'Das „Warum“');
  for (const k of ['start', 'fertig'] as const) if (o[k] !== undefined && !MONAT.test(text(o[k]))) nein('Zeitplan: Monat als JJJJ-MM.');
  if (o.start !== undefined && o.fertig !== undefined && text(o.start) > text(o.fertig)) nein('Fertig liegt vor dem Start.');
  if (o.status !== undefined && !STATUS_IDS.has(text(o.status))) nein('Unbekannter Status (idee, geplant, in_arbeit, fertig).');
  if (o.stufeId !== undefined && !stufen.some(s => s.id === text(o.stufeId))) nein('Diese Stufe gibt es nicht (mehr).');
}

/**
 * Leere Vorlage zum Ausfüllen (ohne KI): fünf Stufen in fünf Ebenen und je eine Station im Kreislauf — nur Platzhalter-Namen, keine Inhalte.
 * Nur auf eine leere Treppe (sonst 400).
 */
export function vorlageStufen(neueId: AnwendenKontext['neueId']): { stufen: Record<string, unknown>[]; stationen: Record<string, unknown>[] } {
  const stufen = [1, 2, 3, 4, 5].map(n => ({ id: neueId('ts'), name: `Stufe ${n}`, ebene: n, lieferobjekte: [], preis: { art: n <= 1 ? 'kostenlos' : 'fest' }, regeln: {}, leistungIds: [] }));
  return { stufen, stationen: stufen.map(s => ({ id: neueId('st'), name: s.name, stufeId: s.id })) };
}

/**
 * Schritte anwenden — alles oder nichts. Neu (Kennung unbekannt oder ohne Kennung) braucht keinen Stand; Ändern und Löschen eines
 * vorhandenen Eintrags nur mit dem Stand, den der Browser bekam (sonst 409 mit den Kennungen).
 */
export function treppeAnwenden(datei: TreppeDatei, opsRoh: unknown, k: AnwendenKontext): AnwendenErgebnis {
  if (!Array.isArray(opsRoh) || !opsRoh.length) return { ok: false, status: 400, fehler: 'ops: eine Liste von Änderungen.' };
  if (opsRoh.length > TREPPE_GRENZEN.ops) return { ok: false, status: 413, fehler: `Höchstens ${TREPPE_GRENZEN.ops} Änderungen auf einmal — nichts gespeichert.` };
  const d: TreppeDatei = { ...datei, stufen: [...datei.stufen], kreislauf: [...datei.kreislauf], roadmap: [...datei.roadmap], positionierung: { ...datei.positionierung }, kunden: { ...datei.kunden }, reports: { ...datei.reports }, marken: { ...datei.marken } };
  const konflikte: { op: number; id: string }[] = [];
  const geaendert: string[] = [];
  const vermerk = { geaendert: k.jetzt, geaendertVon: k.person };
  try {
    opsRoh.forEach((roh, i) => {
      if (!roh || typeof roh !== 'object') nein(`Änderung ${i + 1} ist kein Objekt.`);
      const op = roh as TreppeOp & Record<string, unknown>;
      type Art = 'stufe' | 'station' | 'paket';
      const LISTE: Record<Art, 'stufen' | 'kreislauf' | 'roadmap'> = { stufe: 'stufen', station: 'kreislauf', paket: 'roadmap' };
      const MUSTER: Record<Art, RegExp> = { stufe: STUFE_ID, station: STATION_ID, paket: PAKET_ID };
      const PRAEFIX: Record<Art, 'ts' | 'st' | 'rp'> = { stufe: 'ts', station: 'st', paket: 'rp' };
      const GRENZE: Record<Art, number> = { stufe: TREPPE_GRENZEN.stufen, station: TREPPE_GRENZEN.stationen, paket: TREPPE_GRENZEN.roadmap };
      const NAME: Record<Art, string> = { stufe: 'Stufen', station: 'Stationen', paket: 'Pakete' };
      if (op.op === 'stufe' || op.op === 'station' || op.op === 'paket') {
        const art = op.op as Art;
        const e = (op.eintrag && typeof op.eintrag === 'object' ? op.eintrag : nein(`Änderung ${i + 1}: eintrag fehlt.`)) as Record<string, unknown>;
        const liste = d[LISTE[art]] as { id: string }[];
        const id = e.id === undefined ? undefined : text(e.id);
        if (id !== undefined && !MUSTER[art].test(id)) nein(`Änderung ${i + 1}: ungültige Kennung.`);
        const alt = id ? liste.find(x => x.id === id) : undefined;
        if (alt && op.stand !== k.standVon(alt)) { konflikte.push({ op: i, id: alt.id }); return; }
        const roh2 = mischen(alt as Record<string, unknown> | undefined, { ...e, id: alt?.id ?? id ?? k.neueId(PRAEFIX[art]) });
        if (art === 'stufe') {
          // Teil-Objekte (Preis, Regeln, Ziel) werden auf den alten Stand gelegt — `null` in einem Feld entfernt es.
          for (const f of ['preis', 'regeln', 'ziel'] as const) if (e[f] && typeof e[f] === 'object' && alt) roh2[f] = mischen((alt as unknown as Record<string, Record<string, unknown> | undefined>)[f], e[f] as Record<string, unknown>);
          if (!roh2.preis) roh2.preis = { art: 'fest' };
          stufePruefen(roh2);
        } else if (art === 'station') stationPruefen(roh2, d.stufen);
        else paketPruefen(roh2, d.stufen);
        const neu = art === 'stufe' ? stufeLesen({ ...roh2, ...vermerk }) : art === 'station' ? stationLesen({ ...roh2, ...vermerk }) : paketLesen({ ...roh2, ...vermerk });
        if (!neu) nein(`Änderung ${i + 1}: Eintrag unvollständig.`);
        if (!alt) {
          if (liste.length >= GRENZE[art]) nein(`Höchstens ${GRENZE[art]} ${NAME[art]} — nichts gespeichert.`, 413);
          (d as unknown as Record<string, unknown>)[LISTE[art]] = [...liste, neu];
        } else (d as unknown as Record<string, unknown>)[LISTE[art]] = liste.map(x => (x.id === alt.id ? neu : x));
        geaendert.push((neu as { id: string }).id);
        return;
      }
      if (op.op === 'stufe-weg' || op.op === 'station-weg' || op.op === 'paket-weg') {
        const art = op.op.slice(0, -4) as Art;
        const liste = d[LISTE[art]] as { id: string }[];
        const alt = liste.find(x => x.id === text(op.id));
        if (!alt) return; // schon weg — idempotent
        if (op.stand !== k.standVon(alt)) { konflikte.push({ op: i, id: alt.id }); return; }
        (d as unknown as Record<string, unknown>)[LISTE[art]] = liste.filter(x => x.id !== alt.id);
        if (art === 'stufe') {
          // Verweise auf die Stufe lösen (Station, Paket, Kunde) — nie still mitlöschen.
          d.kreislauf = d.kreislauf.map(s => (s.stufeId === alt.id ? (({ stufeId: _x, ...r }) => r)(s) : s));
          d.roadmap = d.roadmap.map(p => (p.stufeId === alt.id ? (({ stufeId: _x, ...r }) => r)(p) : p));
          for (const [mid, f] of Object.entries(d.kunden)) if (f.stufeId === alt.id) d.kunden[mid] = (({ stufeId: _x, ...r }) => r)(f);
        }
        geaendert.push(alt.id);
        return;
      }
      if (op.op === 'positionierung') {
        if (op.stand !== k.standVon(d.positionierung)) { konflikte.push({ op: i, id: 'positionierung' }); return; }
        const f = (op.felder && typeof op.felder === 'object' ? op.felder : nein('felder fehlt.')) as Record<string, unknown>;
        const neu: Record<string, unknown> = { ...d.positionierung };
        for (const [key, v] of Object.entries(f)) {
          if (!(POSITIONIERUNG_FELDER as readonly string[]).includes(key)) nein(`Unbekanntes Feld „${key.slice(0, 40)}“.`);
          if (v !== null && typeof v !== 'string') nein(`„${POSITIONIERUNG_LABEL[key as PositionierungFeld]}“: Text.`);
          laenge(v, POSITIONIERUNG_MAX[key as PositionierungFeld], POSITIONIERUNG_LABEL[key as PositionierungFeld]);
          if (v === null || !String(v).trim()) delete neu[key]; else neu[key] = v;
        }
        d.positionierung = positionierungLesen({ ...neu, ...vermerk });
        geaendert.push('positionierung');
        return;
      }
      if (op.op === 'zieljahr') {
        const j = zahl(op.jahr);
        if (j === null || j < 2000 || j > 2100) nein('Zieljahr: eine Jahreszahl.');
        d.zielJahr = Math.round(j as number);
        geaendert.push('zieljahr');
        return;
      }
      if (op.op === 'kunde' || op.op === 'lieferobjekt' || op.op === 'report-gesendet') {
        const mid = text(op.mandatId);
        if (!KENNUNG.test(mid)) nein('Ungültige Mandat-Kennung.');
        const alt = d.kunden[mid];
        if (!alt && op.op !== 'report-gesendet' && Object.keys(d.kunden).length >= TREPPE_GRENZEN.kunden) nein(`Höchstens ${TREPPE_GRENZEN.kunden} Kunden mit Fortschritt.`, 413);
        const basis: KundenFortschritt = alt ?? { erledigt: [], verlauf: [], ...vermerk };
        if (op.op === 'report-gesendet') {
          d.reports[mid] = { ...(d.reports[mid] ?? {}), gesendetAm: k.heute, gesendetVon: k.person };
          geaendert.push(`${mid}:report`);
          return;
        }
        if (op.op === 'kunde') {
          if (alt && op.stand !== k.standVon(alt)) { konflikte.push({ op: i, id: mid }); return; }
          const f = (op.felder && typeof op.felder === 'object' ? op.felder : nein('felder fehlt.')) as Record<string, unknown>;
          let neu: KundenFortschritt = { ...basis, ...vermerk };
          if (f.stufeId !== undefined) {
            if (f.stufeId === null) { const { stufeId: _x, ...r } = neu; neu = r; }
            else {
              const sid = text(f.stufeId);
              if (!d.stufen.some(s => s.id === sid)) nein('Diese Stufe gibt es nicht (mehr).');
              if (neu.stufeId !== sid) neu = { ...neu, stufeId: sid, verlauf: [...neu.verlauf, { stufeId: sid, ab: k.heute }].slice(-50) };
            }
          }
          if (f.naechster !== undefined) {
            if (f.naechster === null) { const { naechster: _x, ...r } = neu; neu = r; }
            else {
              const n = (typeof f.naechster === 'object' ? f.naechster : nein('Nächster Schritt: Text und Datum.')) as Record<string, unknown>;
              if (!text(n.text)) nein('Der nächste Schritt braucht einen Text.');
              laenge(n.text, TEXT_MAX.naechster, 'Der nächste Schritt');
              if (!istKalendertag(n.datum)) nein('Der nächste Schritt braucht ein Datum (JJJJ-MM-TT).');
              neu = { ...neu, naechster: { text: text(n.text), datum: n.datum as string } };
            }
          }
          d.kunden[mid] = kundeLesen(neu as unknown as Record<string, unknown>);
          geaendert.push(mid);
          return;
        }
        // Lieferobjekt abhaken (idempotent, ohne Stand — wie ein Häkchen)
        const was = text(op.was);
        if (!was) nein('Welches Lieferobjekt?');
        laenge(was, TEXT_MAX.lieferobjekt, 'Das Lieferobjekt');
        const schon = basis.erledigt.some(x => x.was === was);
        if (op.erledigt && !schon) {
          if (basis.erledigt.length >= TREPPE_GRENZEN.erledigt) nein(`Höchstens ${TREPPE_GRENZEN.erledigt} erledigte Lieferobjekte je Kunde.`, 413);
          d.kunden[mid] = { ...basis, erledigt: [...basis.erledigt, { was, am: k.heute, von: k.person }], ...vermerk };
        } else if (!op.erledigt && schon) d.kunden[mid] = { ...basis, erledigt: basis.erledigt.filter(x => x.was !== was), ...vermerk };
        geaendert.push(`${mid}:lieferobjekt`);
        return;
      }
      if (op.op === 'vorlage') {
        if (d.stufen.length) nein('Die Vorlage gibt es nur für eine leere Treppe.');
        const v = vorlageStufen(k.neueId);
        d.stufen = v.stufen.map(s => stufeLesen({ ...s, ...vermerk })!).filter(Boolean);
        if (!d.kreislauf.length) d.kreislauf = v.stationen.map(s => stationLesen({ ...s, ...vermerk })!).filter(Boolean);
        geaendert.push('vorlage');
        return;
      }
      nein(`Änderung ${i + 1}: unbekannte Art „${String((roh as { op?: unknown }).op)}“.`);
    });
  } catch (e) {
    if (e instanceof Abgelehnt) return { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
  if (konflikte.length) return { ok: false, status: 409, konflikte };
  return { ok: true, datei: d, geaendert };
}

// ── Vorschlag aus einem Dokument (Head of Sales liest, der Mensch gibt frei) ────────────────────────────────────────

/** Was ein Vorschlag aus einem Dokument enthalten darf — dieselben Felder wie eine Stufe/Station, ohne Kennungen. */
export interface TreppeVorschlag {
  stufen: Omit<TreppenStufe, 'id' | 'geaendert' | 'geaendertVon' | 'leistungIds' | 'ziel'>[];
  /** `stufeIndex` = Stelle der Stufe im Vorschlag, zu der die Station gehört. */
  kreislauf: { name: string; messgroesse?: string; ziel?: number; stufeIndex?: number }[];
  positionierung: Partial<Record<PositionierungFeld, string>>;
}
const VORSCHLAG_GRENZEN = { stufen: 12, stationen: 12 } as const;

/** Säubert einen Vorschlag (aus dem Modell oder aus dem Stapel) — Unbrauchbares fällt weg, Texte auf ihre Grenzen. */
export function vorschlagSauber(roh: unknown): TreppeVorschlag {
  const o = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const stufen = (Array.isArray(o.stufen) ? o.stufen : []).slice(0, VORSCHLAG_GRENZEN.stufen).flatMap((x, i) => {
    const s = stufeLesen({ ...(x && typeof x === 'object' ? x as Record<string, unknown> : {}), id: `ts-vorschlag${i}`, ...(x && typeof x === 'object' && (x as Record<string, unknown>).ebene ? {} : { ebene: i + 1 }) });
    if (!s) return [];
    const { id: _i, geaendert: _g, geaendertVon: _v, leistungIds: _l, ziel: _z, ...rest } = s;
    return [rest];
  });
  const kreislauf = (Array.isArray(o.kreislauf) ? o.kreislauf : []).slice(0, VORSCHLAG_GRENZEN.stationen).flatMap((x, i) => {
    const e = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const s = stationLesen({ ...e, id: `st-vorschlag${i}` });
    if (!s) return [];
    const si = zahl(e.stufeIndex);
    return [{ name: s.name, ...(s.messgroesse ? { messgroesse: s.messgroesse } : {}), ...(s.ziel !== undefined ? { ziel: s.ziel } : {}), ...(si !== null && si >= 0 && si < stufen.length ? { stufeIndex: Math.round(si) } : {}) }];
  });
  const p = positionierungLesen(o.positionierung);
  const positionierung: Partial<Record<PositionierungFeld, string>> = {};
  for (const f of POSITIONIERUNG_FELDER) if (p[f]) positionierung[f] = p[f];
  return { stufen, kreislauf, positionierung };
}

/** Alle wählbaren Teile eines Vorschlags (für die Feld-Häkchen): `stufe:<i>`, `station:<i>`, `pos:<feld>`. */
export function vorschlagTeile(v: TreppeVorschlag): string[] {
  return [...v.stufen.map((_, i) => `stufe:${i}`), ...v.kreislauf.map((_, i) => `station:${i}`), ...POSITIONIERUNG_FELDER.filter(f => v.positionierung[f]).map(f => `pos:${f}`)];
}

/**
 * Einen Vorschlag übernehmen — nur die gewählten Teile (`auswahl`, sonst alles). Stufen kommen NEU dazu (nie überschrieben), Stationen
 * ebenso (verknüpft mit der neu angelegten Stufe, wenn ihre Stufe mitkommt); Positionierungs-Felder ersetzen die vorhandenen.
 * Über den Grenzen → 413, nichts übernommen.
 */
export function vorschlagAnwenden(datei: TreppeDatei, vorschlag: TreppeVorschlag, auswahl: readonly string[] | null, k: AnwendenKontext): AnwendenErgebnis {
  const gewaehlt = new Set(auswahl ?? vorschlagTeile(vorschlag));
  const vermerk = { geaendert: k.jetzt, geaendertVon: k.person };
  const d: TreppeDatei = { ...datei, stufen: [...datei.stufen], kreislauf: [...datei.kreislauf], positionierung: { ...datei.positionierung } };
  const neueIds = new Map<number, string>();
  const basisEbene = datei.stufen.length ? Math.max(...datei.stufen.map(s => s.ebene)) : 0;
  vorschlag.stufen.forEach((s, i) => {
    if (!gewaehlt.has(`stufe:${i}`)) return;
    const id = k.neueId('ts');
    neueIds.set(i, id);
    const neu = stufeLesen({ ...s, id, ebene: Math.min(TREPPE_GRENZEN.ebene, basisEbene + s.ebene), leistungIds: [], ...vermerk });
    if (neu) d.stufen.push(neu);
  });
  vorschlag.kreislauf.forEach((s, i) => {
    if (!gewaehlt.has(`station:${i}`)) return;
    const stufeId = s.stufeIndex !== undefined ? neueIds.get(s.stufeIndex) : undefined;
    const neu = stationLesen({ ...s, id: k.neueId('st'), ...(stufeId ? { stufeId } : {}), ...vermerk });
    if (neu) d.kreislauf.push(neu);
  });
  if (d.stufen.length > TREPPE_GRENZEN.stufen) return { ok: false, status: 413, fehler: `Höchstens ${TREPPE_GRENZEN.stufen} Stufen — nichts übernommen.` };
  if (d.kreislauf.length > TREPPE_GRENZEN.stationen) return { ok: false, status: 413, fehler: `Höchstens ${TREPPE_GRENZEN.stationen} Stationen — nichts übernommen.` };
  let posGeaendert = false;
  const pos: Record<string, unknown> = { ...d.positionierung };
  for (const f of POSITIONIERUNG_FELDER) if (gewaehlt.has(`pos:${f}`) && vorschlag.positionierung[f]) { pos[f] = vorschlag.positionierung[f]; posGeaendert = true; }
  if (posGeaendert) d.positionierung = positionierungLesen({ ...pos, ...vermerk });
  const geaendert = [...neueIds.values(), ...(posGeaendert ? ['positionierung'] : [])];
  if (!geaendert.length && d.kreislauf.length === datei.kreislauf.length) return { ok: false, status: 400, fehler: 'Nichts ausgewählt — nichts übernommen.' };
  return { ok: true, datei: d, geaendert };
}

// ── Konto löschen / Export (Art. 15/17/20, Prüf-Fund 11.10. — Muster `schildOhnePerson`) ───────────────────────────────

/** Speichername einer gelöschten Person in Stempeln. */
export const TREPPE_GETILGT = '[gelöscht]';

/** Konto gelöscht: der Speichername in allen Stempeln (geändert von, erledigt von, gesendet von) wird „[gelöscht]“ — Einträge bleiben. Rein. */
export function treppeOhnePerson(d: TreppeDatei, speicher: string): { neu: TreppeDatei; n: number } {
  let n = 0;
  const v = <T extends { geaendertVon?: string }>(x: T): T => (x.geaendertVon === speicher ? (n++, { ...x, geaendertVon: TREPPE_GETILGT }) : x);
  const neu: TreppeDatei = {
    ...d,
    stufen: d.stufen.map(v), kreislauf: d.kreislauf.map(v), roadmap: d.roadmap.map(v), positionierung: v(d.positionierung),
    kunden: Object.fromEntries(Object.entries(d.kunden).map(([k, f]) => [k, { ...v(f), erledigt: f.erledigt.map(e => (e.von === speicher ? (n++, { ...e, von: TREPPE_GETILGT }) : e)) }])),
    reports: Object.fromEntries(Object.entries(d.reports).map(([k, r]) => [k, r.gesendetVon === speicher ? (n++, { ...r, gesendetVon: TREPPE_GETILGT }) : r])),
  };
  return { neu, n };
}

/** Export: was die Person in der Treppe gestempelt hat — Art, Kennung, Zeit (keine Inhalte Dritter). Rein. */
export function treppeEintraegeVon(d: TreppeDatei, speicher: string): { art: string; id: string; am?: string; was?: string }[] {
  const raus: { art: string; id: string; am?: string; was?: string }[] = [];
  const liste: [string, readonly { id: string; geaendert: string; geaendertVon: string }[]][] = [['stufe', d.stufen], ['station', d.kreislauf], ['roadmap', d.roadmap]];
  for (const [art, l] of liste) for (const x of l) if (x.geaendertVon === speicher) raus.push({ art: `${art} geändert`, id: x.id, am: x.geaendert });
  if (d.positionierung.geaendertVon === speicher) raus.push({ art: 'positionierung geändert', id: 'positionierung', ...(d.positionierung.geaendert ? { am: d.positionierung.geaendert } : {}) });
  for (const [mid, f] of Object.entries(d.kunden)) {
    if (f.geaendertVon === speicher) raus.push({ art: 'fortschritt geändert', id: mid, am: f.geaendert });
    for (const e of f.erledigt) if (e.von === speicher) raus.push({ art: 'lieferung erledigt', id: mid, am: e.am, was: e.was });
  }
  for (const [mid, r] of Object.entries(d.reports)) if (r.gesendetVon === speicher) raus.push({ art: 'report gesendet', id: mid, ...(r.gesendetAm ? { am: r.gesendetAm } : {}) });
  return raus;
}
