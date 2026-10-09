// ─── Rechnungen schreiben mit PDF — Regeln (rein, client-sicher, getestet, 08.10.) ─
// Alles, was ohne Platte geht: Säubern der neuen Felder (auch für die Säuberung des ganzen Finanzplans), Summen in Cent
// (eine Steuer je Satz über lib/finanzen/ust.ts, kaufmännisch je Rechnung), Pflichtangaben nach § 14 Abs. 4 UStG (+ § 35a GmbHG
// für Kapitalgesellschaften), Nummern (`{KURZ}-R-{JAHR}-{NR4}`, laufende Nummer je Gesellschaft und Jahr), Entwürfe aus Angebot,
// Mandat und Kartei, Stornorechnung, Mahnstufen als Vorschlag, Mail-Entwürfe.
// Hinweis, keine Steuerberatung — Pflichtangaben und Nummernkreis einmal mit dem Steuerberater abstimmen (RECHNUNGEN_PLAN.md).

import type { Angebot, Firma, Mandat } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Gesellschaft } from '@/lib/crm/gesellschaften';
import type { Mahnstufe, Mahnung, RechnungEmpfaenger, RechnungLauf, RechnungPosition, RechnungZusatz, SteuerHinweis } from './typen';
import { RECHTSART, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';
import { positionNettoCent, ustCent, nummerAusFormat, euroCent, mengeText, KURZ_VORGABE, ZAHLUNGSZIEL_VORGABE_TAGE, UST_SAETZE } from '@/lib/crm/angebote';
import { istKontaktKennung } from '@/lib/kennung';
import { WEG } from '@/lib/wege';

// ── Grundwerte ───────────────────────────────────────────────────────────────

/** Nummernformat der Rechnungen (Kevin 08.10.: „wie beim Angebot“) — z. B. „KDV-R-2026-0001“. Gemeinsamer Kreis für Rechnungen und Stornorechnungen. */
export const RECHNUNG_NUMMER_FORMAT = '{KURZ}-R-{JAHR}-{NR4}';
/** Grenzen — darüber lehnt der Server ab (413), nie still kürzen. */
export const RECHNUNG_GRENZEN = { positionen: 200, titel: 200, text: 6000, einleitung: 3000, schluss: 3000, grund: 300, empfaengerFeld: 160 } as const;
/** Höchstwerte je Position (Schutz vor Tippfehlern). */
export const RECHNUNG_POSITION_MAX = { menge: 100000, einzelpreisCent: 1_000_000_000 } as const;
/** Mahnstufen-Vorgabe: Zahlungserinnerung 7, 1. Mahnung 14, 2. Mahnung 21 Tage nach Fälligkeit (einstellbar). */
export const MAHN_VORGABE_TAGE: readonly [number, number, number] = [7, 14, 21];
export const MAHNSTUFEN: readonly { stufe: Mahnstufe; label: string }[] = [
  { stufe: 1, label: 'Zahlungserinnerung' }, { stufe: 2, label: '1. Mahnung' }, { stufe: 3, label: '2. Mahnung' },
];
export const mahnLabel = (s: Mahnstufe): string => MAHNSTUFEN.find(x => x.stufe === s)?.label ?? 'Mahnung';
/** Satz unter jedem Werkzeug, das plant oder rechnet. */
export const KEINE_STEUERBERATUNG = 'Hinweis, keine Steuerberatung — Pflichtangaben und Nummernkreis einmal mit dem Steuerberater abstimmen.';
/** Die Felder, die NUR der Server setzt — der allgemeine Finanzplan-Weg übernimmt sie nie aus dem Browser. */
export const RECHNUNG_SERVER_FELDER = ['absender', 'lauf', 'pdfDateiId', 'sha256', 'gestelltAm', 'gestelltVon', 'art', 'stornoZu', 'stornoRechnungId', 'mahnungen'] as const satisfies readonly (keyof RechnungZusatz)[];
/** Was ab „gestellt mit PDF“ feststeht (steht so im PDF) — ändern nur über Storno + neue Rechnung. */
export const FEST_MIT_PDF = ['positionen', 'empfaenger', 'leistungVon', 'leistungBis', 'faellig', 'zahlungszielTage', 'steuerHinweis', 'steuerfreiGrund', 'einleitung', 'schluss', 'kunde', 'titel', 'firmaId', 'mandatId', 'kontaktId', 'kundeFirmaId', 'angebotId', 'angebot', 'angebotAm'] as const satisfies readonly (keyof Rechnung)[];

// ── Kleine Helfer ────────────────────────────────────────────────────────────

const txt = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n);
const zeile = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const tagMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
/** Kalendertage von `a` bis `b` (b − a), über UTC-Mittag — keine Zeitumstellung im Weg. */
export const tageZwischen = (a: string, b: string) => Math.round((tagMs(b) - tagMs(a)) / 864e5);
export const plusTage = (d: string, n: number) => new Date(tagMs(d) + n * 864e5).toISOString().slice(0, 10);
const datumDe = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');
export const firmaIdOk = (v: unknown): v is string => typeof v === 'string' && /^f-[a-z0-9-]{2,63}$/.test(v);
export const kontaktIdOk = (v: unknown): v is string => typeof v === 'string' && istKontaktKennung(v);
export const angebotIdOk = (v: unknown): v is string => typeof v === 'string' && /^ang-[a-z0-9-]{4,60}$/.test(v);
export const rechnungIdOk = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && ID.test(v);

// ── Säubern (Server UND Säuberung des Finanzplans — nie kürzen außer Texten auf ihre Grenze) ──

/** Eine Position säubern — null, wenn sie nichts taugt (kein Titel). Einzelpreis nie negativ. */
export function positionSaeubern(o: Record<string, unknown>, i: number): RechnungPosition | null {
  const titel = zeile(o.titel, RECHNUNG_GRENZEN.titel);
  if (!titel) return null;
  const menge = Math.max(0, Math.min(RECHNUNG_POSITION_MAX.menge, Math.round((Number(o.menge) || 0) * 1000) / 1000));
  const preis = Math.max(0, Math.min(RECHNUNG_POSITION_MAX.einzelpreisCent, Math.round(Number(o.einzelpreisCent) || 0)));
  const rabatt = Math.max(0, Math.min(100, Math.round((Number(o.rabattProzent) || 0) * 100) / 100));
  const satz = (UST_SAETZE as readonly number[]).includes(Number(o.ustSatz)) ? Number(o.ustSatz) : 19;
  return {
    id: typeof o.id === 'string' && ID.test(o.id) ? o.id : `p${i + 1}`, ...(typeof o.leistungId === 'string' && ID.test(o.leistungId) ? { leistungId: o.leistungId } : {}),
    titel, text: txt(o.text, RECHNUNG_GRENZEN.text), menge, einheit: zeile(o.einheit, 30) || 'pauschal', einzelpreisCent: preis,
    ...(rabatt ? { rabattProzent: rabatt } : {}), ustSatz: satz,
  };
}

/** Positionen säubern: ungültige fallen weg, doppelte Kennungen werden hinten nummeriert (nichts geht verloren). */
export function positionenSaeubern(roh: unknown): RechnungPosition[] {
  const l = Array.isArray(roh) ? (roh as Record<string, unknown>[]).map((p, i) => positionSaeubern(p ?? {}, i)).filter((p): p is RechnungPosition => !!p) : [];
  const gesehen = new Set<string>();
  for (const p of l) { let id = p.id; let n = 2; while (gesehen.has(id)) id = `${p.id}-${n++}`; p.id = id; gesehen.add(id); }
  return l;
}

const EMPF_FELDER = ['name', 'firma', 'strasse', 'plz', 'ort', 'land', 'ustId', 'email', 'referenz'] as const;
/** Empfänger säubern — nur bekannte Felder, Zeilen ohne Steuerzeichen; leer = undefined. */
export function empfaengerSaeubern(roh: unknown): RechnungEmpfaenger | undefined {
  if (!roh || typeof roh !== 'object') return undefined;
  const o = roh as Record<string, unknown>;
  const e: RechnungEmpfaenger = {};
  for (const f of EMPF_FELDER) {
    const max = f === 'plz' ? 12 : f === 'ustId' ? 20 : RECHNUNG_GRENZEN.empfaengerFeld;
    const w = f === 'ustId' ? zeile(o[f], max).replace(/\s/g, '').toUpperCase() : zeile(o[f], max);
    if (w) e[f] = w;
  }
  return Object.keys(e).length ? e : undefined;
}

function absenderSaeubern(roh: unknown): RechnungZusatz['absender'] | undefined {
  if (!roh || typeof roh !== 'object') return undefined;
  const o = roh as Record<string, unknown>;
  if (typeof o.firmierung !== 'string') return undefined;
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(x => zeile(x, 400)) : []);
  return { firmierung: zeile(o.firmierung, 160), zeilen: liste(o.zeilen), kontakt: liste(o.kontakt), fuss: liste(o.fuss), kleinunternehmer: o.kleinunternehmer === true };
}

function mahnungenSaeubern(roh: unknown): Mahnung[] | undefined {
  if (!Array.isArray(roh)) return undefined;
  const l = roh.filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .filter(m => (m.stufe === 1 || m.stufe === 2 || m.stufe === 3) && tagOk(m.am))
    .map(m => ({ stufe: m.stufe as Mahnstufe, am: m.am as string, von: zeile(m.von, 40) || 'unbekannt' }));
  return l.length ? l : undefined;
}

/**
 * Die neuen Felder einer Rechnung säubern (Lesen UND Schreiben) — nur, was da und gültig ist. Ohne neue Felder kommt `{}` heraus:
 * eine Rechnung aus der Zeit davor bleibt Byte für Byte, wie sie war.
 */
export function zusatzSaeubern(x: Record<string, unknown>): RechnungZusatz {
  const z: RechnungZusatz = {};
  if (Array.isArray(x.positionen)) z.positionen = positionenSaeubern(x.positionen);
  const e = empfaengerSaeubern(x.empfaenger); if (e) z.empfaenger = e;
  const a = absenderSaeubern(x.absender); if (a) z.absender = a;
  if (kontaktIdOk(x.kontaktId)) z.kontaktId = x.kontaktId;
  if (firmaIdOk(x.kundeFirmaId)) z.kundeFirmaId = x.kundeFirmaId;
  if (angebotIdOk(x.angebotId)) z.angebotId = x.angebotId;
  if (x.zahlungszielTage != null && Number.isFinite(Number(x.zahlungszielTage))) z.zahlungszielTage = Math.max(0, Math.min(365, Math.round(Number(x.zahlungszielTage))));
  if (x.steuerHinweis === 'reverse-charge' || x.steuerHinweis === 'steuerfrei') z.steuerHinweis = x.steuerHinweis as SteuerHinweis;
  if (zeile(x.steuerfreiGrund, 200)) z.steuerfreiGrund = zeile(x.steuerfreiGrund, 200);
  if (txt(x.einleitung, RECHNUNG_GRENZEN.einleitung)) z.einleitung = txt(x.einleitung, RECHNUNG_GRENZEN.einleitung);
  if (txt(x.schluss, RECHNUNG_GRENZEN.schluss)) z.schluss = txt(x.schluss, RECHNUNG_GRENZEN.schluss);
  const l = x.lauf as RechnungLauf | undefined;
  if (l && Number.isInteger(l.jahr) && l.jahr >= 2000 && l.jahr <= 2999 && Number.isInteger(l.nr) && l.nr >= 1) z.lauf = { jahr: l.jahr, nr: l.nr };
  if (typeof x.pdfDateiId === 'string' && /^d-[a-z0-9-]{4,60}$/.test(x.pdfDateiId)) z.pdfDateiId = x.pdfDateiId;
  if (typeof x.sha256 === 'string' && /^[a-f0-9]{64}$/.test(x.sha256)) z.sha256 = x.sha256;
  if (typeof x.gestelltAm === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x.gestelltAm)) z.gestelltAm = x.gestelltAm.slice(0, 40);
  if (typeof x.gestelltVon === 'string' && /^[a-z0-9-]{1,40}$/.test(x.gestelltVon)) z.gestelltVon = x.gestelltVon;
  if (x.art === 'storno') z.art = 'storno';
  if (rechnungIdOk(x.stornoZu)) z.stornoZu = x.stornoZu;
  if (rechnungIdOk(x.stornoRechnungId)) z.stornoRechnungId = x.stornoRechnungId;
  const m = mahnungenSaeubern(x.mahnungen); if (m) z.mahnungen = m;
  return z;
}

/** Server-Felder aus dem gespeicherten Stand übernehmen (fehlen sie dort, fallen sie aus der Eingabe weg). Rein. */
export function serverFelderUebernehmen<T extends Partial<RechnungZusatz>>(alt: Partial<RechnungZusatz> | undefined, neu: T): T {
  const n = { ...neu } as Record<string, unknown>;
  for (const f of RECHNUNG_SERVER_FELDER) {
    const w = alt?.[f];
    if (w === undefined) delete n[f]; else n[f] = w;
  }
  return n as T;
}

// ── Summen (Cent) ────────────────────────────────────────────────────────────

export interface RechnungSumme { netto: number; ust: number; brutto: number; jeSatz: { satz: number; netto: number; ust: number }[] }

/** Netto einer Position in Cent (menge × Einzelpreis − Rabatt, kaufmännisch) — dieselbe Rechnung wie beim Angebot. */
export const positionNetto = (p: Pick<RechnungPosition, 'menge' | 'einzelpreisCent' | 'rabattProzent'>) => positionNettoCent(p);

/**
 * Summen einer Rechnung in Cent: Netto je Steuersatz, Steuer EINMAL je Satz auf die Summe (kaufmännisch je Rechnung).
 * Kleinunternehmer (§ 19 UStG): alles zu 0 %. `vorzeichen: -1` = Stornorechnung (gleiche Beträge, umgekehrtes Vorzeichen).
 */
export function rechnungSummen(positionen: readonly RechnungPosition[], opt: { kleinunternehmer?: boolean; vorzeichen?: 1 | -1 } = {}): RechnungSumme {
  const ku = !!opt.kleinunternehmer;
  const v = opt.vorzeichen ?? 1;
  const jeSatz = new Map<number, number>();
  for (const p of positionen) { const s = ku ? 0 : p.ustSatz; jeSatz.set(s, (jeSatz.get(s) ?? 0) + positionNetto(p)); }
  const l = Array.from(jeSatz.entries()).sort((a, b) => b[0] - a[0]).map(([satz, netto]) => ({ satz, netto, ust: satz ? ustCent(netto, satz) : 0 }));
  const netto = l.reduce((a, x) => a + x.netto, 0);
  const ust = l.reduce((a, x) => a + x.ust, 0);
  const n = (c: number) => (v < 0 ? -c : c);
  return { netto: n(netto), ust: n(ust), brutto: n(netto + ust), jeSatz: l.map(x => ({ satz: x.satz, netto: n(x.netto), ust: n(x.ust) })) };
}

/** Die Betragsfelder des Finanzplans aus den Positionen: brutto/netto in € (auf den Cent), USt-Satz nur, wenn es genau einer ist. */
export function betragFelder(positionen: readonly RechnungPosition[], opt: { kleinunternehmer?: boolean; vorzeichen?: 1 | -1 } = {}): { betrag: number; netto: number; ustSatz?: number } {
  const s = rechnungSummen(positionen, opt);
  const saetze = Array.from(new Set(s.jeSatz.map(x => x.satz)));
  return { betrag: s.brutto / 100, netto: s.netto / 100, ...(saetze.length === 1 ? { ustSatz: saetze[0] } : {}) };
}

// ── Nummern ──────────────────────────────────────────────────────────────────

/** Der Schlüssel des Nummernkreises: Gesellschaft + Jahr. */
export const kreisSchluessel = (g: Gesellschaftskennung, jahr: number) => `${g}-${jahr}`;

/** Höchste schon VERGEBENE laufende Nummer eines Kreises im Bestand (gestellte Rechnungen und Stornorechnungen). */
export function hoechsteVergeben(rechnungen: readonly Pick<Rechnung, 'firmaId' | 'lauf'>[], g: Gesellschaftskennung, jahr: number): number {
  let max = 0;
  for (const r of rechnungen) if (r.firmaId === g && r.lauf?.jahr === jahr && r.lauf.nr > max) max = r.lauf.nr;
  return max;
}

/**
 * Die nächste Nummer — lückenlos: höchste vergebene (Zähler-Bestand ODER Finanzplan, falls der Zähler nach einem Abbruch
 * hinterherhinkt) + 1. Belegt eine Nummer schon den Text (z. B. nach einem Kürzel-Wechsel), wird weitergezählt.
 */
export function naechsteNummer(rechnungen: readonly Pick<Rechnung, 'firmaId' | 'lauf' | 'nummer'>[], zaehler: number | undefined, g: Gesellschaftskennung, jahr: number, kurz: string): { lauf: RechnungLauf; nummer: string } {
  let nr = Math.max(zaehler ?? 0, hoechsteVergeben(rechnungen, g, jahr)) + 1;
  const texte = new Set(rechnungen.map(r => r.nummer).filter(Boolean));
  let nummer = nummerAusFormat(RECHNUNG_NUMMER_FORMAT, kurz, jahr, nr);
  while (texte.has(nummer)) { nr++; nummer = nummerAusFormat(RECHNUNG_NUMMER_FORMAT, kurz, jahr, nr); }
  return { lauf: { jahr, nr }, nummer };
}

/** Kürzel der Gesellschaft (Register, sonst Vorgabe). */
export const kurzVon = (g: Pick<Gesellschaft, 'id' | 'kurz'>) => g.kurz || KURZ_VORGABE[g.id];

// ── Pflichtangaben (§ 14 Abs. 4 UStG, § 35a GmbHG) ───────────────────────────

export interface Pflicht { text: string; /** Wo man es behebt (Absender im Register); fehlt = im Entwurf selbst. */ weg?: string }

type EntwurfFelder = Pick<Rechnung, 'firmaId' | 'leistungVon' | 'leistungBis'> & Pick<RechnungZusatz, 'positionen' | 'empfaenger' | 'steuerHinweis' | 'steuerfreiGrund' | 'zahlungszielTage'>;

/**
 * Was fehlt, damit die Rechnung gestellt werden darf (leer = alles da). Nummer und Ausstellungsdatum vergibt der Server beim Stellen.
 * `g` = der Absender aus dem Gesellschafts-Register (roh, nicht maskiert — für die Prüfung genügt „IBAN vorhanden“).
 */
export function pflichtFehlt(r: EntwurfFelder, g: Gesellschaft | null | undefined): Pflicht[] {
  const f: Pflicht[] = [];
  if (!istGesellschaft(r.firmaId)) f.push({ text: 'Gesellschaft (Absender) fehlt — Rechnungen gibt es für die festen Gesellschaften des Finanzplans.' });
  if (g) {
    const weg = WEG.unternehmen(g.id, 'absender');
    if (!g.firmierung) f.push({ text: 'Absender: vollständige Firmierung fehlt (§ 14 Abs. 4 Nr. 1 UStG).', weg });
    if (!g.strasse || !g.plz || !g.ort) f.push({ text: 'Absender: Anschrift (Straße, PLZ, Ort) fehlt (§ 14 Abs. 4 Nr. 1 UStG).', weg });
    if (!g.steuernummer && !g.ustId) f.push({ text: 'Absender: Steuernummer oder USt-IdNr. fehlt (§ 14 Abs. 4 Nr. 2 UStG).', weg });
    if (!g.bank?.iban) f.push({ text: 'Absender: Bankverbindung (IBAN) fehlt — der Kunde braucht sie zum Zahlen.', weg });
    if (RECHTSART[g.id] === 'kapitalgesellschaft') {
      if (!g.geschaeftsfuehrung) f.push({ text: 'Absender: Geschäftsführung fehlt (§ 35a GmbHG, Pflicht auf Geschäftsbriefen).', weg });
      if (!g.register) f.push({ text: 'Absender: Registergericht und HRB fehlen (§ 35a GmbHG).', weg });
    }
  } else if (istGesellschaft(r.firmaId)) f.push({ text: 'Absender der Gesellschaft ist nicht gepflegt.', weg: WEG.unternehmen(r.firmaId, 'absender') });
  const e = r.empfaenger ?? {};
  if (!e.name?.trim() && !e.firma?.trim()) f.push({ text: 'Empfänger: Name bzw. Firma fehlt (§ 14 Abs. 4 Nr. 1 UStG).' });
  if (!e.strasse?.trim() || !e.plz?.trim() || !e.ort?.trim()) f.push({ text: 'Empfänger: vollständige Anschrift (Straße, PLZ, Ort) fehlt (§ 14 Abs. 4 Nr. 1 UStG).' });
  if (!tagOk(r.leistungVon)) f.push({ text: 'Leistungsdatum bzw. Beginn des Leistungszeitraums fehlt (§ 14 Abs. 4 Nr. 6 UStG).' });
  else if (r.leistungBis && tagOk(r.leistungBis) && r.leistungBis < r.leistungVon) f.push({ text: 'Leistungszeitraum: „bis“ liegt vor „von“.' });
  const pos = r.positionen ?? [];
  if (!pos.length) f.push({ text: 'Mindestens eine Position — Menge und Art der Leistung (§ 14 Abs. 4 Nr. 5 UStG).' });
  if (pos.some(p => !(p.menge > 0))) f.push({ text: 'Eine Position hat Menge 0.' });
  const ku = !!g?.kleinunternehmer;
  if (pos.length && rechnungSummen(pos, { kleinunternehmer: ku }).netto <= 0) f.push({ text: 'Der Rechnungsbetrag ist 0 € — eine Rechnung braucht ein Entgelt.' });
  if (!ku && pos.some(p => p.ustSatz === 0)) {
    if (!r.steuerHinweis) f.push({ text: 'Position ohne Umsatzsteuer: Grund wählen — Reverse Charge (§ 13b UStG) oder steuerfrei mit Grund (§ 14 Abs. 4 Nr. 8 UStG).' });
    else if (r.steuerHinweis === 'reverse-charge' && !e.ustId) f.push({ text: 'Reverse Charge: USt-IdNr. des Empfängers fehlt (§ 14a UStG).' });
    else if (r.steuerHinweis === 'steuerfrei' && !r.steuerfreiGrund?.trim()) f.push({ text: 'Steuerfrei: Grund der Steuerbefreiung fehlt (z. B. „§ 4 Nr. … UStG“).' });
  }
  return f;
}

// ── Entwurf (Browser → Server) ───────────────────────────────────────────────

/** Die Felder, die der Browser an einem ENTWURF setzen darf. Alles andere (Nummer, Status, PDF …) setzt der Server. */
export const ENTWURF_FELDER = ['firmaId', 'kunde', 'titel', 'empfaenger', 'positionen', 'leistungVon', 'leistungBis', 'zahlungszielTage', 'steuerHinweis', 'steuerfreiGrund', 'einleitung', 'schluss', 'notiz', 'kontaktId', 'kundeFirmaId', 'mandatId'] as const;

/** Welche Grenze eine Eingabe überschreitet — Sätze für 413 (leer = alles gut). Nie still kürzen. */
export function entwurfGrenzen(roh: Record<string, unknown>): string[] {
  const f: string[] = [];
  const lang = (name: string, v: unknown, max: number) => { if (typeof v === 'string' && v.length > max) f.push(`„${name}“ ist länger als ${max} Zeichen — nichts gekürzt, bitte kürzen.`); };
  lang('titel', roh.titel, RECHNUNG_GRENZEN.titel); lang('einleitung', roh.einleitung, RECHNUNG_GRENZEN.einleitung); lang('schluss', roh.schluss, RECHNUNG_GRENZEN.schluss);
  lang('notiz', roh.notiz, 300); lang('kunde', roh.kunde, 120);
  if (Array.isArray(roh.positionen)) {
    if (roh.positionen.length > RECHNUNG_GRENZEN.positionen) f.push(`${roh.positionen.length} Positionen — höchstens ${RECHNUNG_GRENZEN.positionen}. Abgelehnt, nichts gekürzt.`);
    for (const p of roh.positionen as Record<string, unknown>[]) { lang('Positionstext', p?.text, RECHNUNG_GRENZEN.text); lang('Positionstitel', p?.titel, RECHNUNG_GRENZEN.titel); }
  }
  return f;
}

/**
 * Entwurf säubern: nur ENTWURF_FELDER aus `roh` auf den bisherigen Entwurf legen; Status bleibt „geplant“, Server-Felder bleiben
 * (aus `alt`). `firmaId` nur eine feste Gesellschaft. Die Beträge kommen aus den Positionen (`betragFelder`).
 */
export function entwurfAnwenden(alt: Rechnung, roh: Record<string, unknown>, opt: { kleinunternehmer?: boolean } = {}): Rechnung {
  const r = (f: (typeof ENTWURF_FELDER)[number]) => (f in roh ? roh[f] : (alt as unknown as Record<string, unknown>)[f]);
  const n: Rechnung = { ...alt, status: 'geplant' };
  const g = r('firmaId'); if (istGesellschaft(g)) n.firmaId = g;
  n.kunde = zeile(r('kunde'), 120) || n.kunde;
  n.titel = zeile(r('titel'), RECHNUNG_GRENZEN.titel) || 'Rechnung';
  const o = n as unknown as Record<string, unknown>;
  const setze = (k: keyof Rechnung, v: unknown) => { if (v === undefined || v === '') delete o[k]; else o[k] = v; };
  setze('empfaenger', empfaengerSaeubern(r('empfaenger')));
  n.positionen = positionenSaeubern(r('positionen'));
  setze('leistungVon', tagOk(r('leistungVon')) ? r('leistungVon') as string : undefined);
  setze('leistungBis', tagOk(r('leistungBis')) ? r('leistungBis') as string : undefined);
  const ziel = Math.round(Number(r('zahlungszielTage')));
  n.zahlungszielTage = Number.isFinite(ziel) && ziel >= 0 ? Math.min(365, ziel) : (alt.zahlungszielTage ?? ZAHLUNGSZIEL_VORGABE_TAGE);
  const sh = r('steuerHinweis');
  setze('steuerHinweis', sh === 'reverse-charge' || sh === 'steuerfrei' ? sh : undefined);
  setze('steuerfreiGrund', zeile(r('steuerfreiGrund'), 200) || undefined);
  setze('einleitung', txt(r('einleitung'), RECHNUNG_GRENZEN.einleitung) || undefined);
  setze('schluss', txt(r('schluss'), RECHNUNG_GRENZEN.schluss) || undefined);
  setze('notiz', zeile(r('notiz'), 300) || undefined);
  setze('kontaktId', kontaktIdOk(r('kontaktId')) ? r('kontaktId') as string : undefined);
  setze('kundeFirmaId', firmaIdOk(r('kundeFirmaId')) ? r('kundeFirmaId') as string : undefined);
  const m = r('mandatId'); setze('mandatId', typeof m === 'string' && m.length <= 40 && ID.test(m) ? m : undefined);
  // Beträge aus den Positionen — die Liquidität sieht so den Entwurf mit dem richtigen Brutto.
  if (n.positionen.length) {
    const b = betragFelder(n.positionen, opt);
    n.betrag = b.betrag; n.netto = b.netto;
    if (b.ustSatz !== undefined) n.ustSatz = b.ustSatz; else delete n.ustSatz;
  }
  return n;
}

// ── Vorbelegung aus Kartei, Angebot, Mandat ──────────────────────────────────

/** „Straße 1, 12345 Ort“ bzw. mehrzeilig → Straße, PLZ, Ort (Land dahinter). Was nicht passt, bleibt in der Straße (nie verworfen). */
export function anschriftZerlegen(t: string | undefined): Pick<RechnungEmpfaenger, 'strasse' | 'plz' | 'ort' | 'land'> {
  const teile = String(t ?? '').split(/\n|,\s*/).map(s => s.trim()).filter(Boolean);
  if (!teile.length) return {};
  const i = teile.findIndex(s => /^(?:D-)?\d{4,5}\s+\S/.test(s));
  if (i < 0) return { strasse: teile.join(', ') };
  const m = /^(?:D-)?(\d{4,5})\s+(.+)$/.exec(teile[i])!;
  const strasse = teile.slice(0, i).join(', ');
  const land = teile.slice(i + 1).join(', ');
  return { ...(strasse ? { strasse } : {}), plz: m[1], ort: m[2], ...(land ? { land } : {}) };
}

type KontaktTeil = Pick<Kontakt, 'id' | 'vorname' | 'nachname' | 'email' | 'firma' | 'zahlung'>;
type FirmaTeil = Pick<Firma, 'id' | 'name' | 'stadt' | 'zahlung'>;

/** Empfänger aus der Kartei: Rechnungsempfänger der Zahlungsdaten zuerst, sonst Firma/Person; USt-IdNr. und Referenz dazu. */
export function empfaengerAusCrm(k: KontaktTeil | undefined, f: FirmaTeil | undefined): RechnungEmpfaenger {
  const z = f?.zahlung ?? k?.zahlung;
  const person = `${k?.vorname ?? ''} ${k?.nachname ?? ''}`.trim();
  const firma = f?.name ?? k?.firma;
  const anschrift = anschriftZerlegen(z?.empfaenger?.anschrift);
  const e: RechnungEmpfaenger = {
    ...(firma ? { firma } : {}), ...(z?.empfaenger?.name ? { name: z.empfaenger.name } : person ? { name: person } : {}),
    ...anschrift, ...(!anschrift.ort && f?.stadt ? { ort: f.stadt } : {}),
    ...(z?.ustId ? { ustId: z.ustId.replace(/\s/g, '').toUpperCase() } : {}),
    ...(z?.empfaenger?.email ? { email: z.empfaenger.email } : k?.email ? { email: k.email } : {}),
    ...(z?.referenz ? { referenz: z.referenz } : {}),
  };
  return empfaengerSaeubern(e) ?? {};
}

/** Anzeigename des Kunden für den Finanzplan (`kunde`). */
export const kundeAus = (e: RechnungEmpfaenger | undefined, rueckfall = 'Kunde') => (e?.firma || e?.name || rueckfall).slice(0, 120);

/** Basis eines neuen Entwurfs (geplant, ohne Nummer). */
export function neuerEntwurf(p: { id: string; firmaId: Gesellschaftskennung; kunde: string; titel?: string; empfaenger?: RechnungEmpfaenger; positionen?: RechnungPosition[]; zahlungszielTage?: number; heute: string } & Partial<Pick<Rechnung, 'mandatId' | 'leistungVon' | 'leistungBis' | 'angebot' | 'angebotAm'>> & Partial<Pick<RechnungZusatz, 'kontaktId' | 'kundeFirmaId' | 'angebotId' | 'steuerHinweis' | 'einleitung' | 'schluss'>>, opt: { kleinunternehmer?: boolean } = {}): Rechnung {
  const positionen = p.positionen ?? [];
  const b: { betrag: number; netto: number; ustSatz?: number } = positionen.length ? betragFelder(positionen, opt) : { betrag: 0, netto: 0 };
  const ziel = p.zahlungszielTage ?? ZAHLUNGSZIEL_VORGABE_TAGE;
  return {
    id: p.id, firmaId: p.firmaId, ...(p.mandatId ? { mandatId: p.mandatId } : {}), kunde: p.kunde.slice(0, 120) || 'Kunde', titel: (p.titel || 'Rechnung').slice(0, RECHNUNG_GRENZEN.titel),
    betrag: b.betrag, status: 'geplant', faellig: plusTage(p.heute, ziel),
    ...(p.angebot ? { angebot: p.angebot } : {}), ...(p.angebotAm ? { angebotAm: p.angebotAm } : {}),
    netto: b.netto, ...(b.ustSatz !== undefined ? { ustSatz: b.ustSatz } : {}),
    ...(p.leistungVon ? { leistungVon: p.leistungVon } : {}), ...(p.leistungBis ? { leistungBis: p.leistungBis } : {}),
    positionen, ...(p.empfaenger && Object.keys(p.empfaenger).length ? { empfaenger: p.empfaenger } : {}),
    ...(p.kontaktId ? { kontaktId: p.kontaktId } : {}), ...(p.kundeFirmaId ? { kundeFirmaId: p.kundeFirmaId } : {}), ...(p.angebotId ? { angebotId: p.angebotId } : {}),
    zahlungszielTage: ziel, ...(p.steuerHinweis ? { steuerHinweis: p.steuerHinweis } : {}),
    ...(p.einleitung ? { einleitung: p.einleitung } : {}), ...(p.schluss ? { schluss: p.schluss } : {}),
  };
}

/** Positionen aus einem Angebot: Titel, Text, Menge, Einheit, Preis, Rabatt, Satz — die Basis (monatlich …) steht dann in der Einheit. */
export function positionenAusAngebot(a: Pick<Angebot, 'positionen'>, kleinunternehmer = false): RechnungPosition[] {
  return a.positionen.map((p, i) => ({
    id: `p${i + 1}`, ...(p.leistungId ? { leistungId: p.leistungId } : {}), titel: p.titel, text: p.text, menge: p.menge,
    einheit: p.basis === 'monat' && /^(pauschal|)$/i.test(p.einheit) ? 'Monat' : p.basis === 'jahr' && /^(pauschal|)$/i.test(p.einheit) ? 'Jahr' : p.einheit,
    einzelpreisCent: p.einzelpreisCent, ...(p.rabattProzent ? { rabattProzent: p.rabattProzent } : {}), ustSatz: kleinunternehmer ? 0 : p.ustSatz,
  }));
}

/** Erster und letzter Tag eines Monats „JJJJ-MM“. */
export function monatsGrenzen(monat: string): { von: string; bis: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return null;
  const [j, m] = monat.split('-').map(Number);
  const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return { von: `${monat}-01`, bis: `${monat}-${String(letzter).padStart(2, '0')}` };
}
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** „2026-10“ → „Oktober 2026“. */
export const monatsName = (monat: string) => (/^\d{4}-\d{2}$/.test(monat) ? `${MONATE[Number(monat.slice(5)) - 1]} ${monat.slice(0, 4)}` : monat);

/** Die Position der Monatsrechnung aus dem Honorar des Mandats (netto; ein Brutto-Honorar wird über ust.ts zurückgerechnet). */
export function positionAusMandat(m: Pick<Mandat, 'titel' | 'honorar' | 'ustSatz' | 'leistungen'>, monat: string, opt: { kleinunternehmer?: boolean; nettoAusBrutto: (b: number, s: number) => number }): RechnungPosition {
  const netto = m.honorar.netto ? m.honorar.betrag : opt.nettoAusBrutto(m.honorar.betrag, m.ustSatz);
  const einheit = m.honorar.basis === 'tag' ? 'Tag' : m.honorar.basis === 'einmalig' ? 'pauschal' : 'Monat';
  return {
    id: 'p1', titel: `${m.titel || 'Leistung'} — ${monatsName(monat)}`.slice(0, RECHNUNG_GRENZEN.titel), text: (m.leistungen ?? []).filter(Boolean).map(x => `• ${x}`).join('\n').slice(0, RECHNUNG_GRENZEN.text),
    menge: 1, einheit, einzelpreisCent: Math.max(0, Math.round(netto * 100)), ustSatz: opt.kleinunternehmer ? 0 : (UST_SAETZE as readonly number[]).includes(m.ustSatz) ? m.ustSatz : 19,
  };
}

/**
 * Vorbelegung eines FREIEN Entwurfs (08.10., Markttraktion Woche 2 · 3.13 — EIN Rechnungs-Anleger): ein abgelegtes Angebot aus dem
 * Altbestand (Kontakt › Umsatz „→ als Rechnung planen“) bringt Titel, Bruttobetrag, Angebotsnummer und -datum mit. Daraus wird EINE
 * Position; gestellt wird wie immer erst im Editor (Nummer + PDF). Alles optional, Unsinn fällt weg — nie still ein Betrag erfunden.
 */
export interface EntwurfVorlage { titel?: string; bruttoCent?: number; angebot?: string; angebotAm?: string }
export function vorlageSaeubern(roh: unknown): EntwurfVorlage | undefined {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return undefined;
  const o = roh as Record<string, unknown>;
  const titel = zeile(o.titel, RECHNUNG_GRENZEN.titel);
  const brutto = Math.round(Number(o.bruttoCent));
  const bruttoCent = Number.isFinite(brutto) && brutto > 0 && brutto <= RECHNUNG_POSITION_MAX.einzelpreisCent ? brutto : undefined;
  const angebot = zeile(o.angebot, 40);
  const v: EntwurfVorlage = { ...(titel ? { titel } : {}), ...(bruttoCent ? { bruttoCent } : {}), ...(angebot ? { angebot } : {}), ...(tagOk(o.angebotAm) ? { angebotAm: o.angebotAm } : {}) };
  return Object.keys(v).length ? v : undefined;
}
/** EINE Position aus einem Bruttobetrag (Satz 19 %, Kleinunternehmer 0 %) — netto kaufmännisch über die eine USt-Rechnung (lib/finanzen/ust.ts). */
export function positionAusBrutto(titel: string, bruttoCent: number, opt: { kleinunternehmer?: boolean; nettoAusBrutto: (b: number, s: number) => number }): RechnungPosition {
  const satz = opt.kleinunternehmer ? 0 : 19;
  const netto = satz ? opt.nettoAusBrutto(bruttoCent / 100, satz) : bruttoCent / 100;
  return { id: 'p1', titel: (titel || 'Leistung').slice(0, RECHNUNG_GRENZEN.titel), text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: Math.max(0, Math.round(netto * 100)), ustSatz: satz };
}

/**
 * Statuswechsel einer Rechnung OHNE Positionen von Hand (Finanzen › Rechnungen & Zahlungen, 08.10., Woche 2 · 3.11): vorher wechselte
 * ein Klick auf den Status sofort — ohne Nummer, ohne Datum. Jetzt fragt die Oberfläche nach und prüft hier:
 *   geplant → gestellt   Nummer Pflicht und im Nummernkreis der Gesellschaft noch frei; Rechnungsdatum ein Tag, nicht in der Zukunft
 *   gestellt → bezahlt   „bezahlt am“ ein Tag, nicht in der Zukunft und nicht vor dem Rechnungsdatum
 * Rückgabe: die Fehler als Sätze (leer = in Ordnung). Rechnungen mit Positionen stellt nur der Editor (Nummer + PDF).
 */
export function statusWechselFehlt(r: { id: string; firmaId: string; status: string; datum?: string; positionen?: readonly unknown[] }, ziel: 'gestellt' | 'bezahlt', e: { nummer?: string; datum?: string; am?: string }, alle: readonly { id: string; firmaId: string; nummer?: string }[], heute: string): string[] {
  const f: string[] = [];
  if (ziel === 'gestellt') {
    if (r.status !== 'geplant') f.push('Nur eine geplante Rechnung wird gestellt.');
    if (r.positionen) f.push('Diese Rechnung hat Positionen — sie wird im Editor gestellt (Nummer und PDF).');
    const nr = (e.nummer ?? '').trim();
    if (!nr) f.push('Rechnungsnummer fehlt.');
    else if (alle.some(x => x.id !== r.id && x.firmaId === r.firmaId && (x.nummer ?? '').trim().toLowerCase() === nr.toLowerCase())) f.push(`Die Nummer ${nr} ist bei dieser Gesellschaft schon vergeben.`);
    if (!tagOk(e.datum)) f.push('Rechnungsdatum fehlt.');
    else if (e.datum! > heute) f.push('Das Rechnungsdatum liegt in der Zukunft.');
  } else {
    if (r.status !== 'gestellt') f.push('Bezahlt wird nur eine gestellte Rechnung.');
    if (!tagOk(e.am)) f.push('„Bezahlt am“ fehlt.');
    else if (e.am! > heute) f.push('„Bezahlt am“ liegt in der Zukunft.');
    else if (r.datum && e.am! < r.datum) f.push('„Bezahlt am“ liegt vor dem Rechnungsdatum.');
  }
  return f;
}

/** Vorlage-Texte (Sie-Form, neutral — anpassbar im Entwurf). */
export const EINLEITUNG_VORLAGE = 'vielen Dank für Ihren Auftrag. Für die folgenden Leistungen stellen wir Ihnen in Rechnung:';
export const SCHLUSS_VORLAGE = 'Mit freundlichen Grüßen';

// ── Stornorechnung ───────────────────────────────────────────────────────────

/**
 * Die Stornorechnung zu einer gestellten Rechnung (rein): gleiche Positionen und Empfänger, Summen mit umgekehrtem Vorzeichen,
 * Bezug `stornoZu`, Status „storniert“ (zählt in Liquidität/Umsatz/Steuern nicht — wie das Original danach). Nummer, PDF und
 * Absender setzt der Server beim Festschreiben.
 */
export function stornoEntwurf(o: Rechnung, p: { id: string; heute: string; grund: string; kleinunternehmer?: boolean }): Rechnung {
  const pos = (o.positionen ?? []).map(x => ({ ...x }));
  const b = betragFelder(pos, { kleinunternehmer: p.kleinunternehmer, vorzeichen: -1 });
  return {
    id: p.id, firmaId: o.firmaId, ...(o.mandatId ? { mandatId: o.mandatId } : {}), kunde: o.kunde, titel: `Storno zu Rechnung ${o.nummer ?? ''}`.trim().slice(0, RECHNUNG_GRENZEN.titel),
    betrag: b.betrag, status: 'storniert', storniertAm: p.heute, stornoGrund: p.grund, datum: p.heute, netto: b.netto, ...(b.ustSatz !== undefined ? { ustSatz: b.ustSatz } : {}),
    ...(o.leistungVon ? { leistungVon: o.leistungVon } : {}), ...(o.leistungBis ? { leistungBis: o.leistungBis } : {}),
    positionen: pos, ...(o.empfaenger ? { empfaenger: { ...o.empfaenger } } : {}),
    ...(o.kontaktId ? { kontaktId: o.kontaktId } : {}), ...(o.kundeFirmaId ? { kundeFirmaId: o.kundeFirmaId } : {}),
    ...(o.steuerHinweis ? { steuerHinweis: o.steuerHinweis } : {}), ...(o.steuerfreiGrund ? { steuerfreiGrund: o.steuerfreiGrund } : {}),
    zahlungszielTage: 0, art: 'storno', stornoZu: o.id,
  };
}

// ── Mahnstufen (nur Vorschlag) ───────────────────────────────────────────────

/** Drei steigende ganze Zahlen 1–365 — sonst null (der Server lehnt dann mit 400 ab). */
export function mahnTageSaeubern(roh: unknown): [number, number, number] | null {
  if (!Array.isArray(roh) || roh.length !== 3) return null;
  const t = roh.map(x => Math.round(Number(x)));
  if (t.some(x => !Number.isFinite(x) || x < 1 || x > 365) || !(t[0] < t[1] && t[1] < t[2])) return null;
  return [t[0], t[1], t[2]];
}

export const mahnstufeVon = (r: Pick<RechnungZusatz, 'mahnungen'>): 0 | Mahnstufe => (r.mahnungen ?? []).reduce<0 | Mahnstufe>((m, x) => (x.stufe > m ? x.stufe : m), 0);

export interface MahnVorschlag { rechnungId: string; stufe: Mahnstufe; label: string; tageUeberfaellig: number; nummer?: string }

/**
 * Ist für diese Rechnung eine Mahnstufe dran? Nur gestellte (nicht bezahlt/storniert, keine Stornorechnung) mit Fälligkeit.
 * Die nächste Stufe (nie eine überspringen) ist dran, wenn die Rechnung mindestens `tage[stufe-1]` Tage überfällig ist UND seit der
 * letzten Mahnung mindestens der Abstand zwischen den Stufen vergangen ist. Rein — vermerkt wird erst der Versand per Klick.
 */
export function mahnVorschlag(r: Pick<Rechnung, 'id' | 'status' | 'faellig' | 'nummer'> & Pick<RechnungZusatz, 'art' | 'mahnungen'>, heute: string, tage: readonly [number, number, number] = MAHN_VORGABE_TAGE): MahnVorschlag | null {
  if (r.status !== 'gestellt' || r.art === 'storno' || !tagOk(r.faellig)) return null;
  const ueber = tageZwischen(r.faellig, heute);
  const bisher = mahnstufeVon(r);
  if (bisher >= 3) return null;
  const naechste = (bisher + 1) as Mahnstufe;
  if (ueber < tage[naechste - 1]) return null;
  if (bisher > 0) {
    const letzte = (r.mahnungen ?? []).filter(m => m.stufe === bisher).map(m => m.am).sort().pop();
    if (letzte && tageZwischen(letzte, heute) < tage[naechste - 1] - tage[bisher - 1]) return null;
  }
  return { rechnungId: r.id, stufe: naechste, label: mahnLabel(naechste), tageUeberfaellig: ueber, ...(r.nummer ? { nummer: r.nummer } : {}) };
}

/** Alle fälligen Vorschläge, älteste Fälligkeit zuerst. */
export function mahnVorschlaege(rechnungen: readonly Rechnung[], heute: string, tage: readonly [number, number, number] = MAHN_VORGABE_TAGE): MahnVorschlag[] {
  return rechnungen.map(r => mahnVorschlag(r, heute, tage)).filter((v): v is MahnVorschlag => !!v).sort((a, b) => b.tageUeberfaellig - a.tageUeberfaellig);
}

/** Kennung der Aufgabe zu einem Mahnvorschlag (fest, idempotent). */
export const mahnAufgabeId = (rechnungId: string, stufe: Mahnstufe) => `mahn-${rechnungId}-${stufe}`.slice(0, 80);

// ── Mail-Entwürfe (MAKE OS verschickt nichts — der Browser öffnet das Mail-Programm) ──

const gruss = (e?: RechnungEmpfaenger) => (e?.name ? `Guten Tag ${e.name},` : 'Guten Tag,');

/** Betreff und Text zur Rechnung („Rechnung {Nummer} – {Titel}“). */
export function rechnungMail(r: Pick<Rechnung, 'nummer' | 'titel' | 'betrag' | 'faellig'> & Pick<RechnungZusatz, 'empfaenger'>, absender?: string): { betreff: string; text: string } {
  const betreff = `Rechnung${r.nummer ? ` ${r.nummer}` : ''} – ${r.titel || 'Rechnung'}`;
  const text = `${gruss(r.empfaenger)}\n\nanbei erhalten Sie unsere Rechnung${r.nummer ? ` ${r.nummer}` : ''} über ${euroCent(Math.round(r.betrag * 100))}${r.faellig ? `, zahlbar bis zum ${datumDe(r.faellig)}` : ''}.\n\nBei Fragen melden Sie sich gern.\n\nMit freundlichen Grüßen${absender ? `\n${absender}` : ''}`;
  return { betreff, text };
}

/** Betreff und Text einer Mahnstufe — sachlich, ohne Gebühren oder Rechtsfolgen (die entscheidet ihr). */
export function mahnMail(stufe: Mahnstufe, r: Pick<Rechnung, 'nummer' | 'datum' | 'betrag' | 'faellig'> & Pick<RechnungZusatz, 'empfaenger'>, opt: { heute: string; absender?: string; fristTage?: number }): { betreff: string; text: string } {
  const frist = plusTage(opt.heute, opt.fristTage ?? 7);
  const nr = r.nummer ? ` ${r.nummer}` : '';
  const vom = r.datum ? ` vom ${datumDe(r.datum)}` : '';
  const betrag = euroCent(Math.round(r.betrag * 100));
  const betreff = `${mahnLabel(stufe)}: Rechnung${nr}`;
  const kern = stufe === 1
    ? `sicher ist es Ihrer Aufmerksamkeit entgangen: Unsere Rechnung${nr}${vom} über ${betrag} war am ${datumDe(r.faellig)} fällig. Bitte überweisen Sie den Betrag bis zum ${datumDe(frist)} auf das in der Rechnung genannte Konto.`
    : stufe === 2
      ? `leider haben wir zu unserer Rechnung${nr}${vom} über ${betrag} (fällig am ${datumDe(r.faellig)}) trotz Erinnerung noch keinen Zahlungseingang. Bitte überweisen Sie den offenen Betrag bis zum ${datumDe(frist)}.`
      : `zu unserer Rechnung${nr}${vom} über ${betrag} (fällig am ${datumDe(r.faellig)}) ist trotz Erinnerung und Mahnung bisher keine Zahlung eingegangen. Bitte begleichen Sie den offenen Betrag bis spätestens ${datumDe(frist)}.`;
  const text = `${gruss(r.empfaenger)}\n\n${kern}\n\nSollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.\n\nMit freundlichen Grüßen${opt.absender ? `\n${opt.absender}` : ''}`;
  return { betreff, text };
}

/** Kurzform einer Position für Listen („2 Monat · 1.250,00 €“). */
export const positionKurz = (p: RechnungPosition) => `${mengeText(p.menge)} ${p.einheit} · ${euroCent(positionNetto(p))}`;

/** Dieselbe Prüfung für Browser und Server: Darf diese Sicht die Rechnung sehen/bearbeiten? Business-Sicht nur Business-Gesellschaften. */
export function rechnungInSicht(r: Pick<Rechnung, 'firmaId'>, sicht: 'privat' | 'business', istBusiness: (g: unknown) => boolean): boolean {
  return sicht === 'privat' || istBusiness(r.firmaId);
}

export type { RechnungPosition, RechnungEmpfaenger, RechnungZusatz, Mahnstufe, Mahnung, SteuerHinweis } from './typen';
