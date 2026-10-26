// ─── Markttraktion · Angebote — Regeln (rein, client-sicher, getestet, 28.09.) ─
// Kevin 28.09.: „Das Angebots-Tool, direkt verbunden mit Kunden, Mandaten,
// Produktinhalten und Preisen. Im Call muss es extrem schnell gehen.“
//
// Hier steht alles, was ohne Platte geht:
//   · Summen in CENT: je Position menge × Einzelpreis − Rabatt (kaufmännisch), Steuer je
//     Satz auf die Summe der Basis über lib/finanzen/ust.ts (eine Funktion, kaufmännisch je
//     Angebot) — einmalig, monatlich, jährlich getrennt, dazu der Gesamtwert über die Laufzeit.
//   · Nummern: Format der Gesellschaft (`{KURZ}-A-{JAHR}-{NR4}`), laufende Nummer je
//     Gesellschaft und Jahr — lückenlos, weil gestellte Angebote nie gelöscht werden und die
//     Vergabe in EINER Schreibsperre läuft (lib/crm/angebot-server.ts).
//   · Säubern eines Entwurfs, Prüfen vor dem Stellen, Ablauf nach „gültig bis“,
//     Vorlagen (Anrede Sie/Du), Position aus einem Produkt, Deal-Wert und Mandat-Vorbelegung.
//   · Personenbezug (Art. 15/17, Dubletten): Entwürfe fallen weg, gestellte Angebote sind
//     Geschäftsunterlagen — der Bezug wird gelöst, das Angebot bleibt (§ 257 HGB, § 147 AO).
// Keine Rechts- oder Steuerberatung — Pflichtangaben einmal mit dem Steuerberater abstimmen.

import type { Angebot, AngebotBasis, AngebotPosition, AngebotsStatus, Chance, CrmBestand, FollowUp, Leistung, Mandat, MandatZusatz, PreisTeil } from './typen';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { KERN_EINHEITEN, UG_KURZ, EINHEITEN_UEBERSCHRIEBEN } from '@/lib/einheiten';
import { inCent, ausCent, ustAusNetto, kaufmaennisch } from '@/lib/finanzen/ust';
import { angebotPositionenAusProdukt, positionsText, ANGEBOT_EINHEIT_JE_BASIS, POSITION_GRENZEN, mandatVertragAusProdukt, mandatVorlageAusProdukt, mandatZahlplanAusProdukt, hauptpreis, hauptpreisAus, istKombi, istSatz, zusatzAusTeil, artikelnummerSaeubern, artikelnummerFuer } from './produkt-karte';
import { werktagePlus as kernWerktagePlus } from '@/lib/zeit/kalender-kern';
import { produktTitel, titelNurProdukt } from './titel-regel';
import { angebotWerte, hatGruss, mailTexteSaeubern, platzhalterFuellen } from './vorlage-platzhalter';

// ── Grundwerte ───────────────────────────────────────────────────────────────

export const ANGEBOT_STATUS: readonly { id: AngebotsStatus; label: string }[] = [
  { id: 'entwurf', label: 'Entwurf' }, { id: 'gestellt', label: 'gestellt' }, { id: 'angenommen', label: 'angenommen' },
  { id: 'abgelehnt', label: 'abgelehnt' }, { id: 'abgelaufen', label: 'abgelaufen' }, { id: 'ersetzt', label: 'ersetzt' },
];
export const ANGEBOT_STATUS_LABEL = Object.fromEntries(ANGEBOT_STATUS.map(s => [s.id, s.label])) as Record<AngebotsStatus, string>;
export const BASIS_LABEL: Record<AngebotBasis, string> = { einmalig: 'einmalig', monat: 'monatlich', jahr: 'jährlich' };
export const UST_SAETZE = [19, 7, 0] as const;
export const GESELLSCHAFTEN: readonly Gesellschaftskennung[] = ['kdc', 'kdv', 'ug'];
export const istGesellschaft = (v: unknown): v is Gesellschaftskennung => typeof v === 'string' && (GESELLSCHAFTEN as readonly string[]).includes(v);
export const gesellschaftLabel = (g: string | undefined) => KERN_EINHEITEN.find(e => e.id === g)?.label ?? 'offen';

/** Vorgabe des Nummernformats (Kevin 28.09.). */
export const NUMMER_VORGABE = '{KURZ}-A-{JAHR}-{NR4}';
/**
 * Vorgabe des Rechnungsnummer-Formats (08.10.; seit 25.10. je Gesellschaft einstellbar, `Gesellschaft.rechnungsformat`) — dieselbe Regel wie beim Angebot
 * (`nummernformatOk`), dazu Pflicht: das Jahr ({JAHR} oder {JJ}), weil die laufende Nummer je Gesellschaft und Jahr zählt (sonst gäbe es dieselbe Nummer zweimal).
 */
export const RECHNUNG_NUMMER_VORGABE = '{KURZ}-R-{JAHR}-{NR4}';
/** Vorgaben je Gesellschaft, solange in den Stammdaten nichts steht. */
export const GUELTIG_VORGABE_TAGE = 30;
export const ZAHLUNGSZIEL_VORGABE_TAGE = 14;
/** Nachfassen nach dem Stellen: +5 Werktage (Kevin), änderbar. */
export const NACHFASSEN_WERKTAGE = 5;

/** Grenzen — darüber lehnt der Server ab (413), nie still kürzen. */
export const ANGEBOT_GRENZEN = { positionen: 200, titel: POSITION_GRENZEN.titel, text: POSITION_GRENZEN.text, einleitung: 6000, schluss: 6000, grund: 600 } as const;
/** Höchstwerte je Position (Schutz vor Tippfehlern: 10 Mio. € je Einzelpreis, 100.000 Stück). */
export const POSITION_MAX = { menge: 100000, einzelpreisCent: 1_000_000_000, laufzeitMonate: 600 } as const;

/** Nach dem Stellen unveränderlich — Status und die Felder, die der Server beim Übergang setzt. */
export const istEntwurf = (a: Pick<Angebot, 'status'>) => a.status === 'entwurf';
/**
 * Der offene Entwurf eines Deals (25.10., Kern-Bau-Test 2: jedes erneute Öffnen über den Deal legte einen NEUEN Entwurf an — „Entwurf · Entwurf · Entwurf“ an der
 * Deal-Akte): der zuletzt geänderte Entwurf mit diesem Deal; null ohne. „Angebot erstellen“ öffnet ihn statt eines neuen — eine neue Version legt man ausdrücklich an.
 * Vorhandene Doppel bleiben, wie sie sind (nur keine neuen).
 */
export function offenerEntwurfFuerDeal(angebote: readonly Pick<Angebot, 'id' | 'status' | 'dealId' | 'geaendert'>[], dealId: string | null | undefined): string | null {
  if (!dealId) return null;
  return angebote.filter(a => istEntwurf(a) && a.dealId === dealId).sort((a, b) => (b.geaendert ?? '').localeCompare(a.geaendert ?? '') || a.id.localeCompare(b.id))[0]?.id ?? null;
}
/** Offen im Sinne von „wartet auf Antwort“ (BEAN: Angebotskunde). */
export const istOffen = (a: Pick<Angebot, 'status'>) => a.status === 'gestellt';

// ── Summen (Cent) ────────────────────────────────────────────────────────────

/** Netto einer Position in Cent: menge × Einzelpreis × (1 − Rabatt), kaufmännisch auf den Cent. */
export function positionNettoCent(p: Pick<AngebotPosition, 'menge' | 'einzelpreisCent' | 'rabattProzent'>): number {
  const menge = Number.isFinite(p.menge) ? p.menge : 0;
  const preis = Number.isFinite(p.einzelpreisCent) ? p.einzelpreisCent : 0;
  const rabatt = Math.max(0, Math.min(100, Number(p.rabattProzent) || 0));
  return kaufmaennisch(menge * preis * (1 - rabatt / 100));
}

/** Steuer in Cent aus einem Netto in Cent — über die EINE Funktion in lib/finanzen/ust.ts. */
export const ustCent = (nettoCent: number, satz: number) => inCent(ustAusNetto(ausCent(nettoCent), satz));

export interface Summe { netto: number; ust: number; brutto: number; /** Steuer je Satz (Cent). */ jeSatz: { satz: number; netto: number; ust: number }[] }
export interface AngebotSummen {
  einmalig: Summe;
  /** Monatlich — ohne Tages-/Stundensätze (die stehen unter `aufwand`). */
  monat: Summe;
  /** Tages- und Stundensätze je Monat, geplant (Positionen mit `satz`, 24.10.): Satz × geplante Menge — abgerechnet wird die echte Menge. */
  aufwand: Summe;
  jahr: Summe;
  /** Gesamtwert über die Laufzeit: einmalig + monatlich × Laufzeit (Vorgabe 12) + jährlich × Jahre (Vorgabe 1). */
  gesamt: Summe;
  /** Positionen mit laufender Basis ohne Laufzeit — dort gilt die Vorgabe (Hinweis in der Oberfläche). */
  ohneLaufzeit: number;
  kleinunternehmer: boolean;
}

const leer = (): Summe => ({ netto: 0, ust: 0, brutto: 0, jeSatz: [] });
/** Summe über Posten (Netto je Satz) — Steuer je Satz EINMAL auf die Summe gerechnet (kaufmännisch je Angebot). */
function summeAus(posten: { netto: number; satz: number }[], kleinunternehmer: boolean): Summe {
  const jeSatz = new Map<number, number>();
  for (const p of posten) jeSatz.set(kleinunternehmer ? 0 : p.satz, (jeSatz.get(kleinunternehmer ? 0 : p.satz) ?? 0) + p.netto);
  const l = Array.from(jeSatz.entries()).sort((a, b) => b[0] - a[0]).map(([satz, netto]) => ({ satz, netto, ust: satz ? ustCent(netto, satz) : 0 }));
  const netto = l.reduce((a, x) => a + x.netto, 0);
  const ust = l.reduce((a, x) => a + x.ust, 0);
  return { netto, ust, brutto: netto + ust, jeSatz: l };
}

/** Laufzeit-Faktor einer Position für den Gesamtwert. */
export function laufzeitFaktor(p: Pick<AngebotPosition, 'basis' | 'laufzeitMonate'>): number {
  if (p.basis === 'einmalig') return 1;
  const m = p.laufzeitMonate && p.laufzeitMonate > 0 ? p.laufzeitMonate : p.basis === 'monat' ? 12 : 12;
  return p.basis === 'monat' ? m : m / 12;
}

/** Ist die Position ein Tages-/Stundensatz mit geplanter Menge je Monat (`satz`, nur mit Basis „monat“)? */
export const istSatzPosition = (p: Pick<AngebotPosition, 'basis'> & Partial<Pick<AngebotPosition, 'satz'>>) => p.basis === 'monat' && (p.satz === 'tag' || p.satz === 'stunde');

/** Alle Summen eines Angebots — in Cent, kaufmännisch je Angebot. Kleinunternehmer (§ 19 UStG): keine Steuer. */
export function angebotSummen(a: Pick<Angebot, 'positionen'>, opt: { kleinunternehmer?: boolean } = {}): AngebotSummen {
  const ku = !!opt.kleinunternehmer;
  // Tages-/Stundensatz (24.10., `satz`): laufend je Monat, aber eine eigene Summe — nie unter „einmalig“, nie still im festen Monatsbetrag.
  const nach = (b: AngebotBasis, satz: boolean) => a.positionen.filter(p => p.basis === b && istSatzPosition(p) === satz).map(p => ({ netto: positionNettoCent(p), satz: p.ustSatz }));
  const gesamt = a.positionen.map(p => ({ netto: kaufmaennisch(positionNettoCent(p) * laufzeitFaktor(p)), satz: p.ustSatz }));
  return {
    einmalig: summeAus(nach('einmalig', false), ku), monat: summeAus(nach('monat', false), ku), aufwand: summeAus(nach('monat', true), ku), jahr: summeAus(nach('jahr', false), ku),
    gesamt: gesamt.length ? summeAus(gesamt, ku) : leer(),
    ohneLaufzeit: a.positionen.filter(p => p.basis !== 'einmalig' && !(p.laufzeitMonate && p.laufzeitMonate > 0)).length,
    kleinunternehmer: ku,
  };
}

/** Cent → „1.234,56 €“. */
export const euroCent = (cent: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cent || 0) / 100);
/** Eingabe „1.234,5“ / „1234.50“ / „1234“ → Cent (null = keine Zahl). */
export function centAusEingabe(t: string): number | null {
  const s = String(t ?? '').replace(/\s|€/g, '');
  if (!s) return null;
  // Deutsche Schreibweise: Punkt als Tausender, Komma als Dezimal. Nur ein Punkt ohne Komma mit ≠ 3 Nachstellen = Dezimalpunkt.
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  const n = Number(norm);
  return Number.isFinite(n) && n >= 0 ? inCent(n) : null;
}
/** Cent → Eingabetext „1234,50“. */
export const eingabeAusCent = (cent: number) => (cent % 100 === 0 ? String(cent / 100) : (cent / 100).toFixed(2).replace('.', ','));
/** Menge „1,5“ → 1.5 (null = keine Zahl). */
export function mengeAusEingabe(t: string): number | null {
  const n = Number(String(t ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}
export const mengeText = (m: number) => m.toLocaleString('de-DE', { maximumFractionDigits: 3 });

// ── Nummern ──────────────────────────────────────────────────────────────────

/** Höchstlänge eines Nummern-Kürzels. */
export const KUERZEL_MAX = 10;
/**
 * Ein Kurzname als Nummern-Kürzel: nur Großbuchstaben und Ziffern (Umlaute ausgeschrieben), ganze Wörter, höchstens `KUERZEL_MAX` Zeichen — nie mitten im
 * Wort abgeschnitten (15.10., Abnahme C19: „Nordlicht Labs“ ergab „NORDLICH“). Passt schon das erste Wort nicht, die Anfangsbuchstaben der Wörter.
 */
export function kuerzelAus(name: string, rueckfall: string): string {
  const woerter = String(name ?? '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').split(/[^A-Z0-9]+/).filter(Boolean);
  let k = '';
  for (const w of woerter) { if ((k + w).length > KUERZEL_MAX) break; k += w; }
  if (!k && woerter.length) k = woerter.length > 1 ? woerter.map(w => w[0]).join('').slice(0, KUERZEL_MAX) : woerter[0].slice(0, KUERZEL_MAX);
  return k || rueckfall;
}
/**
 * Kürzel für die Nummer, solange die Gesellschaft keines trägt. `ug` kommt aus dem Kurznamen der Instanz (`UG_KURZ`, lib/einheiten.ts —
 * 08.10., Markttraktion Woche 2 · 3.15: vorher stand hier noch das Kürzel des Altnamens). Vergebene Nummern bleiben, wie sie sind.
 */
// 14.10. (Abnahme A1): `kdc`/`kdv` nehmen den Kurznamen der Instanz, wenn sie einen eigenen trägt (NEXT_PUBLIC_MAKE_OS_EINHEITEN) — ohne Variable bleibt
// die Vorgabe unserer Instanz (vergebene und künftige Nummern unverändert).
export const KURZ_VORGABE: Record<Gesellschaftskennung, string> = {
  kdc: EINHEITEN_UEBERSCHRIEBEN.kdc?.kurz ? kuerzelAus(EINHEITEN_UEBERSCHRIEBEN.kdc.kurz, 'KDC') : 'KDC',
  kdv: EINHEITEN_UEBERSCHRIEBEN.kdv?.kurz ? kuerzelAus(EINHEITEN_UEBERSCHRIEBEN.kdv.kurz, 'KDV') : 'KDV',
  ug: kuerzelAus(UG_KURZ, 'UG'),
};

/** Ein Format ist gültig, wenn es genau eine laufende Nummer trägt und nur erlaubte Zeichen. */
export function nummernformatOk(f: string): boolean {
  const t = String(f ?? '');
  if (!t || t.length > 60 || !/^[A-Za-z0-9{}._\-/]+$/.test(t)) return false;
  const nr = t.match(/\{NR[3-6]?\}/g) ?? [];
  const rest = t.replace(/\{(KURZ|JAHR|JJ|NR[3-6]?)\}/g, '');
  return nr.length === 1 && !/[{}]/.test(rest);
}

/** Ein Format für Rechnungs- bzw. Stornonummern (25.10.): wie beim Angebot UND mit dem Jahr — der Nummernkreis zählt je Gesellschaft und Jahr. */
export const rechnungsformatOk = (f: string): boolean => nummernformatOk(f) && /\{(JAHR|JJ)\}/.test(f);

/** Nummer aus Format, Kürzel, Jahr und laufender Nummer: `{KURZ}-A-{JAHR}-{NR4}` → „KDV-A-2026-0001“. */
export function nummerAusFormat(format: string, kurz: string, jahr: number, nr: number): string {
  const f = nummernformatOk(format) ? format : NUMMER_VORGABE;
  return f.replace(/\{KURZ\}/g, kurz).replace(/\{JAHR\}/g, String(jahr)).replace(/\{JJ\}/g, String(jahr).slice(-2))
    .replace(/\{NR([3-6])?\}/g, (_m, s: string | undefined) => String(nr).padStart(s ? Number(s) : 1, '0'));
}

/** Nächste laufende Nummer je Gesellschaft und Jahr — Höchstwert + 1 über ALLE Angebote (gestellte werden nie gelöscht). */
export function naechsteLaufnummer(angebote: readonly Pick<Angebot, 'gesellschaft' | 'lauf'>[], gesellschaft: Gesellschaftskennung, jahr: number): number {
  let max = 0;
  for (const a of angebote) if (a.gesellschaft === gesellschaft && a.lauf?.jahr === jahr && a.lauf.nr > max) max = a.lauf.nr;
  return max + 1;
}

// ── Tage ─────────────────────────────────────────────────────────────────────

const tagMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const tagAus = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(tagMs(v));
export const plusTage = (d: string, n: number) => tagAus(tagMs(d) + n * 864e5);
/** +n Werktage (Mo–Fr ohne Feiertage NRW, Kalender-Kern — 29.09., K2: vorher zählten Feiertage mit). */
export const werktagePlus = (d: string, n: number): string => (n > 0 ? kernWerktagePlus(d, n) : d);

// ── Säubern (Entwurf aus dem Browser) ────────────────────────────────────────

const txt = (v: unknown, n: number) => String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, n);
const zeile = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const idOk = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
/** Kennung eines Preis-Teils (dieselbe Form wie `preisteilSaeubern` in lib/crm/produkt-karte.ts). */
const TEIL_ID = /^pt-[a-z0-9-]{1,40}$/;
export const kontaktIdOk = (v: unknown): v is string => typeof v === 'string' && /^c-[a-z0-9-]{4,60}$/.test(v);
export const firmaIdOk = (v: unknown): v is string => typeof v === 'string' && /^f-[a-z0-9-]{2,63}$/.test(v);
const BASEN: readonly AngebotBasis[] = ['einmalig', 'monat', 'jahr'];

/** Welche Grenze eine Eingabe überschreitet — Texte für 413 (leer = alles gut). Nie still kürzen. */
export function angebotGrenzen(roh: Record<string, unknown>): string[] {
  const f: string[] = [];
  const lang = (feld: keyof typeof ANGEBOT_GRENZEN, v: unknown) => { if (typeof v === 'string' && v.length > ANGEBOT_GRENZEN[feld]) f.push(`„${feld}“ ist länger als ${ANGEBOT_GRENZEN[feld]} Zeichen — nichts gekürzt, bitte kürzen.`); };
  lang('titel', roh.titel); lang('einleitung', roh.einleitung); lang('schluss', roh.schluss);
  if (Array.isArray(roh.positionen)) {
    if (roh.positionen.length > ANGEBOT_GRENZEN.positionen) f.push(`${roh.positionen.length} Positionen — höchstens ${ANGEBOT_GRENZEN.positionen}. Abgelehnt, nichts gekürzt.`);
    for (const p of roh.positionen as Record<string, unknown>[]) { lang('text', p?.text); lang('titel', p?.titel); }
  }
  return f;
}

/** Eine Position säubern — null, wenn sie nichts taugt (kein Titel). */
export function positionSaeubern(o: Record<string, unknown>, i: number): AngebotPosition | null {
  const titel = zeile(o.titel, ANGEBOT_GRENZEN.titel);
  if (!titel) return null;
  const menge = Math.max(0, Math.min(POSITION_MAX.menge, Math.round((Number(o.menge) || 0) * 1000) / 1000));
  const preis = Math.max(0, Math.min(POSITION_MAX.einzelpreisCent, Math.round(Number(o.einzelpreisCent) || 0)));
  const rabatt = Math.max(0, Math.min(100, Math.round((Number(o.rabattProzent) || 0) * 100) / 100));
  const satz = (UST_SAETZE as readonly number[]).includes(Number(o.ustSatz)) ? Number(o.ustSatz) : 19;
  const basis = BASEN.includes(o.basis as AngebotBasis) ? (o.basis as AngebotBasis) : 'einmalig';
  const lz = Math.round(Number(o.laufzeitMonate) || 0);
  return {
    id: idOk(o.id) ? o.id : `p${i + 1}`, ...(idOk(o.leistungId) ? { leistungId: o.leistungId } : {}),
    ...(idOk(o.leistungId) && typeof o.preisTeilId === 'string' && TEIL_ID.test(o.preisTeilId) ? { preisTeilId: o.preisTeilId } : {}),
    titel, text: txt(o.text, ANGEBOT_GRENZEN.text), menge, einheit: zeile(o.einheit, 30) || 'pauschal', einzelpreisCent: preis,
    ...(rabatt ? { rabattProzent: rabatt } : {}), ustSatz: satz, basis,
    ...(basis !== 'einmalig' && lz > 0 ? { laufzeitMonate: Math.min(POSITION_MAX.laufzeitMonate, lz) } : {}),
    // Tages-/Stundensatz mit geplanter Menge je Monat (24.10.) — nur bei Basis „monat“; wer die Basis umstellt, nimmt ihn weg.
    ...(basis === 'monat' && (o.satz === 'tag' || o.satz === 'stunde') ? { satz: o.satz } : {}),
    // Artikelnummer (25.10., optional) — aus dem Preis-Teil bzw. von Hand; ohne diese Zeile fiele sie beim Speichern des Entwurfs weg.
    ...(artikelnummerSaeubern(o.artikelnummer) ? { artikelnummer: artikelnummerSaeubern(o.artikelnummer) } : {}),
  };
}

/** Die Felder, die ein Browser an einem ENTWURF setzen darf. Alles andere (Nummer, Status, Prüfsumme …) setzt der Server. */
export const ENTWURF_FELDER = ['gesellschaft', 'kontaktId', 'firmaId', 'dealId', 'mandatId', 'titel', 'positionen', 'einleitung', 'schluss', 'gueltigBis', 'zahlungszielTage', 'titelVonHand', 'dealWahl', 'zahlweise'] as const;

/**
 * Entwurf säubern: nur ENTWURF_FELDER aus `roh`, auf den bisherigen Entwurf gelegt. Status bleibt „entwurf“,
 * Version/Vorgänger bleiben, wie der Server sie setzte. Kennungen nur in ihrer Form (tote prüft die Verbindungsprüfung).
 */
/** `gesellschaftVorgabe` (08.10.): Absender eines NEUEN Entwurfs ohne Angabe — die operative Business-Gesellschaft (Server: `absenderVorgabe`). */
export function entwurfSaeubern(roh: Record<string, unknown>, alt: Angebot | null, basis: { id: string; jetzt: string; person: string; heute: string; gueltigTage?: number; zielTage?: number; gesellschaftVorgabe?: Gesellschaftskennung }): Angebot {
  const r = (f: (typeof ENTWURF_FELDER)[number]) => (f in roh ? roh[f] : alt ? (alt as unknown as Record<string, unknown>)[f] : undefined);
  const g = r('gesellschaft');
  const pos = r('positionen');
  const positionen = Array.isArray(pos) ? (pos as Record<string, unknown>[]).map((p, i) => positionSaeubern(p ?? {}, i)).filter((p): p is AngebotPosition => !!p) : [];
  // Doppelte Positions-Kennungen (zwei Fenster): hinten nummerieren, nichts wegwerfen.
  const gesehen = new Set<string>();
  for (const p of positionen) { let id = p.id; let n = 2; while (gesehen.has(id)) id = `${p.id}-${n++}`; p.id = id; gesehen.add(id); }
  const gb = r('gueltigBis');
  const ziel = Math.round(Number(r('zahlungszielTage')));
  // „Neuer Deal“ (21.10., B9) heißt: kein Deal am Entwurf — ein mitgeschickter Deal fällt dann weg.
  const dealNeu = r('dealWahl') === 'neu';
  return {
    // Rückfall `kdc` nur noch, wenn das Register keine eindeutige operative Business-Gesellschaft kennt (Altverhalten, im Editor sichtbar).
    id: basis.id, gesellschaft: istGesellschaft(g) ? g : alt?.gesellschaft ?? basis.gesellschaftVorgabe ?? 'kdc',
    ...(kontaktIdOk(r('kontaktId')) ? { kontaktId: r('kontaktId') as string } : {}),
    ...(firmaIdOk(r('firmaId')) ? { firmaId: r('firmaId') as string } : {}),
    ...(idOk(r('dealId')) && !dealNeu ? { dealId: r('dealId') as string } : {}),
    ...(idOk(r('mandatId')) ? { mandatId: r('mandatId') as string } : {}),
    titel: zeile(r('titel'), ANGEBOT_GRENZEN.titel), positionen,
    // 21.10. (Rundgang A1/B9): Titel von Hand und die Wahl des Deals — nur in ihrer Form, `null` nimmt sie weg.
    ...(r('titelVonHand') === true ? { titelVonHand: true as const } : {}),
    ...(r('dealWahl') === 'deal' || r('dealWahl') === 'neu' ? { dealWahl: r('dealWahl') as 'deal' | 'neu' } : {}),
    einleitung: txt(r('einleitung'), ANGEBOT_GRENZEN.einleitung), schluss: txt(r('schluss'), ANGEBOT_GRENZEN.schluss),
    gueltigBis: tagOk(gb) ? gb : plusTage(basis.heute, basis.gueltigTage ?? GUELTIG_VORGABE_TAGE),
    zahlungszielTage: Number.isFinite(ziel) && ziel >= 0 ? Math.min(180, ziel) : basis.zielTage ?? ZAHLUNGSZIEL_VORGABE_TAGE,
    // Zahlungsweise (26.10.) — `null` nimmt sie weg (= ganze Summe wie bisher).
    ...(zahlweiseSaeubern(r('zahlweise')) ? { zahlweise: zahlweiseSaeubern(r('zahlweise')) } : {}),
    status: 'entwurf', version: alt?.version ?? 1, ...(alt?.vorgaengerId ? { vorgaengerId: alt.vorgaengerId } : {}),
    angelegt: alt?.angelegt ?? basis.jetzt, ...(alt?.angelegtVon ? { angelegtVon: alt.angelegtVon } : { angelegtVon: basis.person }),
    geaendert: basis.jetzt, geaendertVon: basis.person,
  };
}

/** Säuberung aus dem Speicher (Lesen/fremde Schreiber): hält die Form, lässt Server-Felder, wie sie sind. */
export function angebotAusSpeicher(o: Record<string, unknown>): Angebot | null {
  if (!idOk(o.id)) return null;
  const a = o as unknown as Angebot;
  if (!Array.isArray(a.positionen) || !istGesellschaft(a.gesellschaft)) return null;
  return a;
}

// ── Prüfen vor dem Stellen ───────────────────────────────────────────────────

/** Was fehlt, um das Angebot zu stellen? (leer = kann gestellt werden) */
/** Ablehnung, wenn ein Angebot über 0 € gestellt werden soll (3.12) — derselbe Text in Editor-Liste und Server-Antwort. */
export const SUMME_NULL = 'Die Summe ist 0 € — ein Angebot über nichts belegt nur eine Nummer.';
export function stellenFehlt(a: Angebot, heute: string): string[] {
  const f: string[] = [];
  if (!istEntwurf(a)) f.push('Nur ein Entwurf kann gestellt werden.');
  if (!a.kontaktId) f.push('Empfänger fehlt — erst einen Kontakt wählen.');
  if (!a.positionen.length) f.push('Keine Position — mindestens ein Produkt oder eine freie Position.');
  if (a.positionen.some(p => !(p.menge > 0))) f.push('Eine Position hat Menge 0.');
  // 3.12 (08.10.): ein Angebot über 0 € belegte eine feste Nummer — die Summe muss über 0 liegen (der Server antwortet 409).
  if (a.positionen.length && !(angebotSummen(a).gesamt.netto > 0)) f.push(SUMME_NULL);
  if (!a.titel.trim()) f.push('Titel fehlt.');
  if (a.gueltigBis < heute) f.push('„Gültig bis“ liegt in der Vergangenheit.');
  return f;
}

// ── Ablauf ───────────────────────────────────────────────────────────────────

/** Gestellte Angebote nach „gültig bis“ → abgelaufen. Liefert die neue Liste und die Kennungen, die sich änderten. */
export function ablaufen(liste: readonly Angebot[], heute: string, jetzt: string): { liste: Angebot[]; ids: string[] } {
  const ids: string[] = [];
  const neu = liste.map(a => {
    if (a.status !== 'gestellt' || !(a.gueltigBis < heute)) return a;
    ids.push(a.id);
    return { ...a, status: 'abgelaufen' as const, abgelaufenAm: heute, geaendert: jetzt, geaendertVon: 'system' };
  });
  return { liste: ids.length ? neu : [...liste], ids };
}

/** Der Follow-up-Hinweis, wenn ein gestelltes Angebot abläuft (28.09.). */
export const ABLAUF_FOLLOWUP_TEXT = 'Angebot abgelaufen — nachfassen oder Version 2';

/**
 * Follow-ups zu frisch abgelaufenen Angeboten (28.09.): steht das „Angebot nachfassen“ (`fu-<angebot>`) noch offen,
 * bekommt es den Hinweis und wird heute fällig (nie später als vorher); sonst ein neues `fu-<angebot>-ablauf` —
 * höchstens einmal je Angebot. Ohne Person und ohne Deal kein Follow-up; `ausgenommen` (Art. 18) auch nicht.
 */
export function ablaufFollowUps(followups: readonly FollowUp[], abgelaufen: readonly Angebot[], ctx: {
  heute: string; jetzt: string; zustaendig: (a: Angebot) => string; ausgenommen?: (kontaktId: string) => boolean;
}): FollowUp[] {
  const liste = [...followups];
  for (const a of abgelaufen) {
    if (a.kontaktId && ctx.ausgenommen?.(a.kontaktId)) continue;
    const bezug: FollowUp['bezug'] | null = a.dealId ? { art: 'chance', id: a.dealId } : a.kontaktId ? { art: 'kontakt', id: a.kontaktId } : null;
    if (!bezug) continue;
    const text = `${ABLAUF_FOLLOWUP_TEXT}${a.nummer ? ` (${a.nummer})` : ''}`;
    const i = liste.findIndex(f => f.id === `fu-${a.id}` && f.status === 'offen');
    if (i >= 0) {
      const f = liste[i];
      liste[i] = { ...f, text, faellig: f.faellig < ctx.heute ? f.faellig : ctx.heute, geaendert: ctx.jetzt, geaendertVon: 'system' };
      continue;
    }
    const id = `fu-${a.id}-ablauf`;
    if (liste.some(f => f.id === id)) continue;
    liste.push({
      id, bezug, ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), art: 'anruf', text, faellig: ctx.heute, zustaendig: ctx.zustaendig(a),
      status: 'offen', quelle: 'deal', angelegt: ctx.jetzt, geaendert: ctx.jetzt, geaendertVon: 'system',
    });
  }
  return liste;
}

// ── Produkte ─────────────────────────────────────────────────────────────────

/** Was einem Produkt für Angebote fehlt (Kevin: Leistungstext ist Pflicht). */
export function produktAngebotFehlt(l: Pick<Leistung, 'angebot'>): string[] {
  return l.angebot?.leistungstext?.trim() ? [] : ['Leistungstext'];
}

/** Säuberung der Angebotstexte eines Produkts (lib/crm/speicher.ts). */
export function leistungAngebotSaeubern(v: unknown): Leistung['angebot'] | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const t = (x: unknown, n: number) => { const s = txt(x, n); return s || undefined; };
  // Begleit-Mail je Produkt (25.10., optional) — ohne diese Zeile fiele sie beim Speichern der Texte weg.
  const mail = mailTexteSaeubern(o.mail);
  const out = { ...(t(o.titel, 200) ? { titel: t(o.titel, 200) } : {}), ...(t(o.einleitung, 3000) ? { einleitung: t(o.einleitung, 3000) } : {}), leistungstext: txt(o.leistungstext, ANGEBOT_GRENZEN.text), ...(t(o.ergebnis, 2000) ? { ergebnis: t(o.ergebnis, 2000) } : {}), ...(t(o.hinweise, 2000) ? { hinweise: t(o.hinweise, 2000) } : {}), ...(mail ? { mail } : {}) };
  return out.leistungstext || Object.keys(out).length > 1 ? out : undefined;
}

/** Positionstext aus den Angebotstexten des Produkts — seit 19.10. in lib/crm/produkt-karte.ts (EINE Stelle), hier weiter exportiert. */
export { positionsText };

const EINHEIT_JE_BASIS: Record<AngebotBasis, string> = ANGEBOT_EINHEIT_JE_BASIS;
/**
 * EINE Position aus einem Produkt (Produktwahl im Angebots-Tool): die erste aus `angebotPositionenAusProdukt` (lib/crm/produkt-karte.ts) —
 * ohne Preis-Teile genau wie bisher (Menge 1, Preis in Cent, Basis, Laufzeit, Titel und Text aus dem Produkt). Alle Teile einer Karte:
 * `angebotPositionenAusProdukt`.
 */
export function positionAusProdukt(l: Leistung, id: string, opt: { kleinunternehmer?: boolean } = {}): AngebotPosition {
  return angebotPositionenAusProdukt(l, [], { idBasis: id, ...opt })[0];
}

/**
 * Der Wert des Deals in die Position (17.10., Gesamtprüfung L1 B4): vereinbart ist, was am Deal steht (Betrag, Basis, Laufzeit) — vorher belegte „Angebot
 * erstellen“ den Katalogpreis vor (3.500 €/Monat × 12 statt 4.500 € × 6). Ohne Betrag am Deal bleibt die Position, wie das Produkt sie vorgibt.
 */
export function dealWertUebernehmen(p: AngebotPosition, w: { betrag: number; basis: AngebotBasis; laufzeitMonate?: number } | undefined): AngebotPosition {
  if (!w || !(w.betrag > 0)) return p;
  const { laufzeitMonate: alt, ...ohne } = p;
  const laufzeit = w.basis === 'einmalig' ? undefined : w.laufzeitMonate ? Math.round(w.laufzeitMonate) : alt;
  return { ...ohne, basis: w.basis, einheit: EINHEIT_JE_BASIS[w.basis], einzelpreisCent: inCent(w.betrag), ...(laufzeit ? { laufzeitMonate: laufzeit } : {}) };
}

/**
 * Die Positionen, mit denen „Angebot erstellen“ aus einem Deal mit Produkt startet (24.10., Bau-Test): eine Kombination (mehrere Preis-Teile) bringt JEDEN
 * Grund-Teil als eigene Position mit seinem eigenen Betrag und seiner Basis — der Deal-Wert ersetzt nie einen Preis-Teil (vorher stand er auf der ersten
 * Position: „900 €/Monat“ mit der Kennung des Festpreises, die 1.500 € fehlten). Ein Produkt mit einem Preis wie bisher: der Deal-Wert gilt (`dealWertUebernehmen`).
 */
export function positionenAusDeal(l: Leistung, wert: { betrag: number; basis: AngebotBasis; laufzeitMonate?: number } | undefined, opt: { kleinunternehmer?: boolean } = {}): AngebotPosition[] {
  if (istKombi(l)) return angebotPositionenAusProdukt(l, [], { idBasis: 'p-1', ...opt });
  return [dealWertUebernehmen(positionAusProdukt(l, 'p-1', opt), wert)];
}
/** Beschriftung der Summe der Tages-/Stundensätze (`AngebotSummen.aufwand`): „Tagessätze je Monat (geplant)“, „Stundensätze …“ bzw. „nach Aufwand …“. */
export function aufwandLabel(positionen: readonly Pick<AngebotPosition, 'basis' | 'satz'>[]): string {
  const arten = new Set(positionen.filter(istSatzPosition).map(p => p.satz));
  return `${arten.size === 1 ? (arten.has('tag') ? 'Tagessätze' : 'Stundensätze') : 'Nach Aufwand'} je Monat (geplant)`;
}

/**
 * Laufzeit einer Position geändert (25.10., „Laufzeit wählbar“): die Artikelnummer folgt dem Preis-Teil des Produkts für diese Laufzeit
 * (`artikelnummerFuer` — eigene Nummer je Laufzeit, sonst die allgemeine). Ohne Produkt bzw. Preis-Teil bleibt die Position, wie sie ist.
 */
export function positionNachLaufzeit(p: AngebotPosition, leistungen: readonly Pick<Leistung, 'id' | 'preise'>[]): AngebotPosition {
  const t = p.leistungId && p.preisTeilId ? leistungen.find(l => l.id === p.leistungId)?.preise?.find(x => x.id === p.preisTeilId) : undefined;
  if (!t) return p;
  const nr = artikelnummerFuer(t, p.basis !== 'einmalig' ? p.laufzeitMonate : undefined);
  if (nr === p.artikelnummer) return p;
  const { artikelnummer: _a, ...ohne } = p;
  return nr ? { ...ohne, artikelnummer: nr } : ohne;
}

/**
 * Dieselbe Position? (21.10., Rundgang B5) — nur Positionen aus einem Produkt: tragen beide den Preis-Teil, entscheidet er; sonst (Altbestand,
 * Produkt ohne Preis-Teile) Titel, Basis und Einheit. Menge, Preis und Rabatt zählen nicht — die ändert man in der Zeile.
 */
export function gleichePosition(a: Pick<AngebotPosition, 'leistungId' | 'preisTeilId' | 'titel' | 'basis' | 'einheit'>, b: Pick<AngebotPosition, 'leistungId' | 'preisTeilId' | 'titel' | 'basis' | 'einheit'>): boolean {
  if (!a.leistungId || a.leistungId !== b.leistungId) return false;
  if (a.preisTeilId && b.preisTeilId) return a.preisTeilId === b.preisTeilId;
  const n = (t: string) => t.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  return n(a.titel) === n(b.titel) && a.basis === b.basis && n(a.einheit) === n(b.einheit);
}

/**
 * Ein Produkt ins Angebot (21.10., Rundgang B5): was schon drinsteht (dieselbe Position, `gleichePosition`), kommt nicht noch einmal dazu — ein zweiter
 * Klick nach dem Anhaken einer Option bringt NUR die Option. `schonDa` nennt, was übersprungen wurde (die Oberfläche sagt es).
 */
export function positionenErgaenzen(vorhanden: readonly AngebotPosition[], neu: readonly AngebotPosition[]): { neu: AngebotPosition[]; schonDa: AngebotPosition[] } {
  const dazu: AngebotPosition[] = [];
  const schonDa: AngebotPosition[] = [];
  for (const p of neu) (vorhanden.some(x => gleichePosition(x, p)) || dazu.some(x => gleichePosition(x, p)) ? schonDa : dazu).push(p);
  return { neu: dazu, schonDa };
}

/** Produkte für den Katalog im Tool: aktive der Gesellschaft (dazu die ohne Gesellschaft), „Text fehlt“ markiert. */
export function katalog(leistungen: readonly Leistung[], gesellschaft: Gesellschaftskennung | null): { l: Leistung; textFehlt: boolean; andere: boolean }[] {
  return leistungen.filter(l => l.status === 'aktiv' && !l.geloeschtAm)
    .map(l => ({ l, textFehlt: produktAngebotFehlt(l).length > 0, andere: l.gesellschaft !== gesellschaft && l.gesellschaft !== 'offen' }))
    .sort((a, b) => Number(a.andere) - Number(b.andere) || a.l.name.localeCompare(b.l.name, 'de'));
}

// ── Titel aus den Produkten, Deal folgt dem Angebot (21.10., Rundgang 19.10. A1/B9) ────────────────────────────────────────────

type ProduktName = Pick<Leistung, 'id' | 'name' | 'rolle'> & { angebot?: Pick<NonNullable<Leistung['angebot']>, 'titel'> };
const produktName = (l: Pick<ProduktName, 'name' | 'angebot'>) => l.angebot?.titel?.trim() || l.name;

/**
 * Der Titel eines Angebots aus seinen Produkten: das Hauptprodukt (`angebotHauptprodukt` — dieselbe Regel wie „Deal folgt dem Angebot“), sonst die erste
 * Position, davor die Firma: „<Firma> · <Produkt>“. Ohne Position leer. Ein von Hand geschriebener Titel (`titelVonHand`) bleibt — das entscheidet der Aufrufer.
 */
export function angebotTitelAus(a: Pick<Angebot, 'positionen'>, leistungen: readonly ProduktName[] = [], firma?: string | null): string {
  const hp = angebotHauptprodukt(a, leistungen);
  const l = hp ? leistungen.find(x => x.id === hp) : undefined;
  const produkt = l ? produktName(l) : (hp ? a.positionen.find(p => p.leistungId === hp) : a.positionen[0])?.titel ?? '';
  // 26.10. (Kevin: „der Name oben wird nicht richtig übernommen“): nennt der Produkttitel die Firma selbst ({{firma.name}}), wird sie dort eingesetzt —
  // ohne „<Firma> · “ davor (sonst stand sie doppelt bzw. der Platzhalter roh im PDF). Ohne Firma bleibt der Platzhalter stehen, bis sie gewählt ist.
  if (NENNT_FIRMA.test(produkt)) return firma?.trim() ? platzhalterFuellen(produkt, { 'firma.name': firma.trim() }).replace(/\s+/g, ' ').trim().slice(0, ANGEBOT_GRENZEN.titel) : produkt;
  return produktTitel(produkt, firma, ANGEBOT_GRENZEN.titel);
}
/** Ein Text, der die Firma als Platzhalter nennt (`{{firma.name}}`). */
const NENNT_FIRMA = /\{\{\s*firma\.name\s*(\|[^}]*)?\}\}/;

/**
 * Ist der gespeicherte Titel eines älteren Entwurfs (ohne `titelVonHand`) automatisch entstanden? Leer, gleich dem Titel des Deals (den das Tool bis
 * 21.10. still übernahm) oder er nennt nur ein Produkt (Katalog oder Position) und die Firma. Dann folgt er den Produkten; sonst bleibt er.
 */
export function angebotTitelAutomatisch(titel: string, ctx: { firma?: string | null; dealTitel?: string | null; leistungen?: readonly Pick<Leistung, 'name' | 'angebot'>[]; positionen?: readonly Pick<AngebotPosition, 'titel'>[] }): boolean {
  if (!titel.trim()) return true;
  const n = (t: string) => t.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
  if (ctx.dealTitel && n(ctx.dealTitel) === n(titel)) return true;
  // Produkttitel mit {{firma.name}} (26.10.) zählen auch gefüllt — so bleibt ein automatisch entstandener Titel automatisch.
  // Der Kern eines Titels lässt die Firma weg (`titelKern`) — darum auch die Fassung ohne Firma.
  const mitFirma = (t?: string) => (t && NENNT_FIRMA.test(t) ? [platzhalterFuellen(t, { 'firma.name': ctx.firma?.trim() ?? '' }), platzhalterFuellen(t, { 'firma.name': '' })] : []);
  const namen = [...(ctx.leistungen ?? []).flatMap(l => [l.name, l.angebot?.titel, ...mitFirma(l.angebot?.titel)]), ...(ctx.positionen ?? []).flatMap(p => [p.titel, ...mitFirma(p.titel)])];
  return titelNurProdukt(titel, { firma: ctx.firma, produkte: namen });
}

/**
 * Der Titel, den Mandat (und darüber Fall und Rechnung) aus einem angenommenen Angebot nehmen: der des Angebots — außer er nennt nur ein Produkt, das gar
 * nicht im Angebot steht (Angebote vor dem 21.10. erbten still den Titel des alten Deals). Dann der Titel aus den Produkten. Gespeichert wird nichts.
 */
export function angebotTitelFuerFolge(a: Pick<Angebot, 'titel' | 'positionen' | 'empfaenger' | 'firmaId'>, leistungen?: readonly ProduktName[], firma?: string | null): string {
  if (!leistungen?.length || !a.titel.trim()) return a.titel;
  const f = firma ?? a.empfaenger?.firma;
  const drin = new Set(a.positionen.map(p => p.leistungId).filter(Boolean));
  const imAngebot = [...leistungen.filter(l => drin.has(l.id)).flatMap(l => [l.name, l.angebot?.titel]), ...a.positionen.map(p => p.titel)];
  const fremd = leistungen.filter(l => !drin.has(l.id)).flatMap(l => [l.name, l.angebot?.titel]);
  if (titelNurProdukt(a.titel, { firma: f, produkte: imAngebot }) || !titelNurProdukt(a.titel, { firma: f, produkte: fremd })) return a.titel;
  return angebotTitelAus(a, leistungen, f) || a.titel;
}

/**
 * Deal folgt dem Angebot — auch im Titel (21.10., A1): zieht das angenommene Angebot den Deal auf ein anderes Hauptprodukt, bekommt der Deal den Titel aus
 * den Produkten, wenn sein Titel automatisch entstanden ist (nur das alte Produkt bzw. das Art-Wort, dazu die Firma — `titelNurProdukt`). Ein von Hand
 * geschriebener Titel bleibt. null = nichts ändern.
 */
export function dealTitelNachAngebot(deal: Pick<Chance, 'titel' | 'leistungId' | 'art'>, a: Pick<Angebot, 'positionen'>, leistungen: readonly ProduktName[], firma?: string | null): string | null {
  const alt = deal.leistungId ? leistungen.find(l => l.id === deal.leistungId) : undefined;
  if (!titelNurProdukt(deal.titel, { firma, produkte: alt ? [alt.name, alt.angebot?.titel] : [], art: deal.art })) return null;
  const neu = angebotTitelAus(a, leistungen, firma).slice(0, 160);
  return neu && neu !== deal.titel ? neu : null;
}

/**
 * Rückfrage statt still übernehmen (21.10., Rundgang B9): trägt der Deal ein ANDERES Produkt als das Hauptprodukt des Angebots? Ohne Produkt am Deal
 * oder ohne Produkt im Angebot gibt es nichts zu fragen.
 */
export function dealProduktAnders(deal: Pick<Chance, 'leistungId'> | undefined, hauptprodukt: string | undefined): boolean {
  return !!deal?.leistungId && !!hauptprodukt && deal.leistungId !== hauptprodukt;
}
/** Text der Rückfrage — derselbe in der Oberfläche und in der 409-Antwort beim Stellen. */
export const dealFrageText = (produkt: string) => `Zu diesem Deal (${produkt}) oder neuer Deal?`;

// ── Vorlagen (Anrede Sie/Du) ─────────────────────────────────────────────────

export interface VorlageEingabe { anrede?: 'Sie' | 'Du'; vorname?: string; nachname?: string; titel: string; absender?: string; nummer?: string; gueltigBis?: string; person?: string; /** Firma des Kunden — nur für `{{firma.name}}` (25.10.). */ firma?: string; /** Heute (JJJJ-MM-TT) — nur für `{{heute}}` (25.10.). */ heute?: string }
/** Die Texte des Produkts, die Vorlagen ersetzen (25.10.): Einleitung und Begleit-Mail — `LeistungAngebot` bzw. ein Teil davon. */
export type ProduktTexte = Pick<NonNullable<Leistung['angebot']>, 'einleitung' | 'mail'> | null | undefined;
/**
 * Die Texte des Hauptprodukts eines Angebots (25.10., kleine Bauten): EINE Regel für Editor, Vorschau, Server und Formular — das Hauptprodukt wie überall
 * (`angebotHauptprodukt`), nur ein Produkt aus dem Katalog. null ohne Produkt bzw. ohne eigene Texte (dann gelten die festen Vorlagen wie bisher).
 */
export function produktTexteFuer(a: Pick<Angebot, 'positionen'>, leistungen: readonly Pick<Leistung, 'id' | 'rolle' | 'angebot'>[] | undefined): ProduktTexte {
  const id = angebotHauptprodukt(a, leistungen);
  return produktTexteVon(id ? leistungen?.find(l => l.id === id) : undefined);
}
/** Die eigenen Texte EINES Produkts (Einleitung, Begleit-Mail) — null ohne. */
export function produktTexteVon(l: Pick<Leistung, 'angebot'> | undefined): ProduktTexte {
  const t = l?.angebot;
  return t && (t.einleitung?.trim() || t.mail?.text?.trim() || t.mail?.betreff?.trim()) ? { ...(t.einleitung ? { einleitung: t.einleitung } : {}), ...(t.mail ? { mail: t.mail } : {}) } : null;
}
const werteAus = (e: VorlageEingabe) => angebotWerte({ anrede: e.anrede, vorname: e.vorname, nachname: e.nachname, firma: e.firma, nummer: e.nummer, titel: e.titel, gueltigBis: e.gueltigBis, absender: e.absender, person: e.person, heute: e.heute });
const datumLang = (d?: string) => (d && tagOk(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '');
const gruss = (e: VorlageEingabe) => {
  const name = `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim();
  return e.anrede === 'Du' ? `Hallo ${e.vorname?.trim() || name || ''},`.replace(' ,', ',') : name ? `Guten Tag ${name},` : 'Guten Tag,';
};
/**
 * Einleitung und Schluss für das Angebot — Anrede aus dem Kontakt (Du nur, wenn dort „Du“ steht). Seit 25.10.: trägt das Hauptprodukt eine eigene Einleitung
 * (`produkt.einleitung`), ersetzt sie den festen Satz — Platzhalter gefüllt; ohne eigene Grußzeile (`{{kontakt.gruss}}`) steht der Gruß davor. Ohne: wie bisher.
 */
export function angebotVorlage(e: VorlageEingabe, produkt?: ProduktTexte): { einleitung: string; schluss: string } {
  const du = e.anrede === 'Du';
  const eigen = produkt?.einleitung?.trim();
  const eigeneEinleitung = eigen ? (() => { const t = platzhalterFuellen(eigen, werteAus(e)).trim(); return hatGruss(eigen) ? t : `${gruss(e)}\n\n${t}`; })() : null;
  return {
    einleitung: eigeneEinleitung ?? `${gruss(e)}\n\n${du ? 'vielen Dank für das gute Gespräch. Wie besprochen, bekommst du hier unser Angebot' : 'vielen Dank für das Gespräch und Ihr Interesse. Wie besprochen, erhalten Sie hier unser Angebot'} für „${e.titel || 'die besprochene Leistung'}“.`,
    schluss: du
      ? `Das Angebot gilt bis zum ${datumLang(e.gueltigBis) || '…'}. Melde dich gern, wenn du Fragen hast oder etwas anpassen möchtest — ich freue mich auf die Zusammenarbeit.\n\nViele Grüße`
      : `Das Angebot gilt bis zum ${datumLang(e.gueltigBis) || '…'}. Bei Fragen oder Änderungswünschen melden Sie sich gern — wir freuen uns auf die Zusammenarbeit.\n\nMit freundlichen Grüßen`,
  };
}
/**
 * Betreff und Text der Mail (Kevin: „Angebot {Nummer} – {Titel}“). Ohne Nummer (Entwurf): „Angebot – {Titel}“. Seit 25.10.: die Begleit-Mail des Hauptprodukts
 * (`produkt.mail`, Platzhalter gefüllt) ersetzt Betreff bzw. Text, wenn gesetzt — der Text schreibt Gruß und Unterschrift selbst ({{person.name}}, {{absender.name}}).
 */
export function mailVorlage(e: VorlageEingabe, produkt?: ProduktTexte): { betreff: string; text: string } {
  const du = e.anrede === 'Du';
  const w = produkt?.mail ? werteAus(e) : null;
  const eigenBetreff = w && produkt?.mail?.betreff?.trim() ? platzhalterFuellen(produkt.mail.betreff, w).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const eigenText = w && produkt?.mail?.text?.trim() ? platzhalterFuellen(produkt.mail.text, w).replace(/\n{3,}/g, '\n\n').trim() : '';
  const betreff = eigenBetreff || `Angebot${e.nummer ? ` ${e.nummer}` : ''} – ${e.titel || 'Angebot'}`;
  if (eigenText) return { betreff, text: eigenText };
  const text = `${gruss(e)}\n\n${du ? 'anbei, wie besprochen, unser Angebot' : 'anbei erhalten Sie, wie besprochen, unser Angebot'}${e.nummer ? ` ${e.nummer}` : ''} für „${e.titel || 'die besprochene Leistung'}“${e.gueltigBis ? ` (gültig bis ${datumLang(e.gueltigBis)})` : ''}.\n\n${du ? 'Melde dich gern bei Fragen.' : 'Bei Fragen melden Sie sich gern.'}\n\n${du ? 'Viele Grüße' : 'Mit freundlichen Grüßen'}${e.person ? `\n${e.person}` : ''}${e.absender ? `\n${e.absender}` : ''}`;
  return { betreff, text };
}
/** mailto:-Link (Adresse, Betreff, Text) — die Person hängt das PDF an und schickt ab (Versand zurückgestellt). */
export function mailtoLink(an: string | undefined, betreff: string, text: string): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '%20');
  return `mailto:${an ? encodeURIComponent(an).replace(/%40/g, '@') : ''}?subject=${enc(betreff)}&body=${enc(text)}`;
}

// ── Platzhalter im ganzen Angebot, Standardtext, offene Lücken (26.10., Kevin: „die Daten müssen da sauber reinlaufen“) ─────────────────

/** Werte der Platzhalter aus Kontakt, Firma und Angebot — leere Werte fehlen, damit ihr Platzhalter stehen bleibt (statt still leer zu werden). */
export function angebotPlatzhalterWerte(e: VorlageEingabe): Record<string, string> {
  return Object.fromEntries(Object.entries(werteAus(e)).filter(([k, v]) => !!v && !(k === 'kontakt.anrede' && !e.anrede) && !(k === 'kontakt.gruss' && !e.vorname && !e.nachname)));
}
/**
 * Platzhalter in Titel, Positionen (Titel + Text), Einleitung und Schluss füllen — EINE Stelle für Editor, Vorschau und Stellen. Produkttexte schreiben z. B.
 * „Homepage Landing für {{firma.name}}“; bis 26.10. stand das roh im PDF. Was `werte` nicht kennt, bleibt stehen. Ohne Änderung: dasselbe Objekt.
 */
export function angebotPlatzhalterFuellen<T extends Pick<Angebot, 'titel' | 'positionen' | 'einleitung' | 'schluss'>>(a: T, werte: Readonly<Record<string, string>>): T {
  const f = (t: string) => (t.includes('{{') ? platzhalterFuellen(t, werte) : t);
  const positionen = a.positionen.map(p => { const titel = f(p.titel), text = f(p.text); return titel === p.titel && text === p.text ? p : { ...p, titel, text }; });
  const t = f(a.titel), titel = t === a.titel ? t : t.replace(/\s+/g, ' ').trim(), einleitung = f(a.einleitung), schluss = f(a.schluss);
  if (titel === a.titel && einleitung === a.einleitung && schluss === a.schluss && positionen.every((p, i) => p === a.positionen[i])) return a;
  return { ...a, titel, positionen, einleitung, schluss };
}

/**
 * Der Standardtext (26.10., Kevin: „wenn wir keinen sauberen Prozess haben, einfach Standardsatz“) — immer in der Sie-Form, unabhängig vom Produkt.
 */
export function angebotStandardtext(e: Pick<VorlageEingabe, 'vorname' | 'nachname' | 'gueltigBis'>): { einleitung: string; schluss: string } {
  const sie: VorlageEingabe = { ...e, anrede: 'Sie', titel: '' };
  return {
    einleitung: `${gruss(sie)}\n\nvielen Dank für Ihr Interesse an unseren Produkten. Hiermit unterbreiten wir Ihnen ein unverbindliches Angebot.`,
    schluss: angebotVorlage(sie).schluss,
  };
}

/** Wo im Angebot noch eine Lücke steht — „[von Hand: …]“ aus den Produkttexten oder ein ungefüllter Platzhalter. Leer = alles ausgefüllt. */
export function angebotLuecken(a: Pick<Angebot, 'titel' | 'positionen' | 'einleitung' | 'schluss'>): string[] {
  const offen = (t: string) => /\[von Hand:/i.test(t) || /\{\{[^}]*\}\}/.test(t);
  return [
    ...(offen(a.titel) ? ['Titel'] : []), ...(offen(a.einleitung) ? ['Einleitung'] : []),
    ...a.positionen.flatMap((p, i) => (offen(`${p.titel}\n${p.text}`) ? [`Position ${i + 1}`] : [])), ...(offen(a.schluss) ? ['Schluss'] : []),
  ];
}

// ── Zahlungsweise: Raten, Anzahlung, eigener Satz (26.10., Kevin) ─────────────────────────────────────────────────────────────────

export const ZAHLWEISE_GRENZEN = { raten: { min: 2, max: 24 }, abstand: { min: 1, max: 12 }, prozent: { min: 1, max: 99 }, rest: 80, text: 500 } as const;
const ganzIn = (v: unknown, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

/** Säubern — unbrauchbar → undefined (dann gilt die ganze Summe wie bisher). */
export function zahlweiseSaeubern(v: unknown): Angebot['zahlweise'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const G = ZAHLWEISE_GRENZEN;
  if (o.art === 'raten') {
    const anzahl = ganzIn(o.anzahl, G.raten.min, G.raten.max), abstandMonate = ganzIn(o.abstandMonate ?? 1, G.abstand.min, G.abstand.max);
    return anzahl && abstandMonate ? { art: 'raten', anzahl, abstandMonate } : undefined;
  }
  if (o.art === 'anzahlung') {
    const prozent = ganzIn(o.prozent, G.prozent.min, G.prozent.max);
    const rest = zeile(o.rest, G.rest) || 'bei Abnahme';
    return prozent ? { art: 'anzahlung', prozent, rest } : undefined;
  }
  if (o.art === 'frei') { const text = txt(o.text, G.text); return text ? { art: 'frei', text } : undefined; }
  return undefined;
}

/** Die Raten in Cent: gleich große Raten, der Rundungsrest auf der letzten — die Summe stimmt immer auf den Cent. */
export function ratenCent(summeCent: number, anzahl: number): number[] {
  const n = Math.max(1, Math.round(anzahl));
  const rate = Math.round(summeCent / n);
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? rate : summeCent - rate * (n - 1)));
}

/**
 * Der Satz zur Zahlungsweise für das PDF (und die Vorschau) — null ohne Zahlungsweise. Beträge auf den einmaligen Betrag (brutto, beim Kleinunternehmer
 * netto = gesamt). Ohne einmaligen Betrag gilt nur der eigene Satz.
 */
export function zahlweiseText(a: Pick<Angebot, 'positionen' | 'zahlweise'>, opt: { kleinunternehmer?: boolean } = {}): string | null {
  const z = a.zahlweise;
  if (!z) return null;
  if (z.art === 'frei') return `Zahlung: ${z.text.replace(/\s+$/, '')}${/[.!?]$/.test(z.text.trim()) ? '' : '.'}`;
  const s = angebotSummen(a, opt).einmalig;
  const summe = opt.kleinunternehmer ? s.netto : s.brutto;
  if (!(summe > 0)) return null;
  const inkl = opt.kleinunternehmer || !s.ust ? '' : ' (inkl. USt)';
  if (z.art === 'anzahlung') {
    const an = Math.round(summe * z.prozent / 100);
    return `Zahlung des einmaligen Betrags${inkl}: ${z.prozent} % Anzahlung (${euroCent(an)}) bei Auftrag, Rest (${euroCent(summe - an)}) ${z.rest}.`;
  }
  const raten = ratenCent(summe, z.anzahl);
  const wann = (i: number) => (i === 0 ? 'bei Auftrag' : `nach ${i * z.abstandMonate} ${i * z.abstandMonate === 1 ? 'Monat' : 'Monaten'}`);
  const gleich = raten.every(r => r === raten[0]);
  return `Zahlung des einmaligen Betrags${inkl} in ${z.anzahl} Raten${z.abstandMonate === 1 ? ' (monatlich)' : ` (alle ${z.abstandMonate} Monate)`}: ${gleich ? `je ${euroCent(raten[0])}` : raten.map((r, i) => `${euroCent(r)} ${wann(i)}`).join(', ')}${gleich ? `, die erste bei Auftrag` : ''}.`;
}

// ── Verbindungen: Deal-Wert, Mandat-Vorbelegung ─────────────────────────────

/**
 * Deal-Wert aus dem Angebot (Euro, netto): laufend monatlich (fester Monatsbetrag + geplante Tages-/Stundensätze, Jahr/12 dazu), sonst jährlich, sonst
 * einmalig. Ein gemischtes Angebot (einmalig + laufend) trägt den Einmal-Anteil getrennt in `einmalBetrag` (24.10., Bau-Test) — vorher verteilte er sich
 * auf die Laufzeit (8.100 € ÷ 6 = „1.350 €/Monat“, eine Zahl, die nirgends vereinbart war). Gesamtwert des Deals = Gesamtwert des Angebots.
 */
export function dealWertAusAngebot(a: Pick<Angebot, 'positionen'>): Chance['wert'] {
  const s = angebotSummen(a);
  const lz = Math.max(0, ...a.positionen.filter(p => p.basis !== 'einmalig').map(p => p.laufzeitMonate ?? 0));
  const monatlich = s.monat.netto + s.aufwand.netto;
  const einmal = s.einmalig.netto > 0 ? { einmalBetrag: ausCent(s.einmalig.netto) } : {};
  // 25.10. (Kern-Bau-Test 2): die geplanten Tages-/Stundensätze stehen im Monatswert, aber getrennt benannt — sonst hieß ein Honorar von 1.100 € „4.100 € je Monat“.
  const saetze = new Set(a.positionen.filter(istSatzPosition).map(p => p.satz));
  const geplant = s.aufwand.netto > 0 ? { geplantBetrag: ausCent(s.aufwand.netto), ...(saetze.size === 1 ? { geplantSatz: [...saetze][0] as 'tag' | 'stunde' } : {}) } : {};
  if (monatlich > 0) return { betrag: ausCent(monatlich + kaufmaennisch(s.jahr.netto / 12)), basis: 'monat', ...(lz ? { laufzeitMonate: lz } : {}), ...einmal, ...geplant };
  if (s.jahr.netto > 0) return { betrag: ausCent(s.jahr.netto), basis: 'jahr', ...(lz ? { laufzeitMonate: lz } : {}), ...einmal };
  return { betrag: ausCent(s.einmalig.netto), basis: 'einmalig' };
}

// ── Kombination im Angebot → Mandat (24.10., Bau-Test „Mandat verliert Preis-Teile“) ────────────────────────────────────────────

/** Welche Basis eine Position eines Preis-Teils im Angebot trägt (wie `angebotPositionenAusProdukt` sie anlegt). */
const BASIS_DES_TEILS = (t: PreisTeil): AngebotBasis => (t.art === 'monatlich' || istSatz(t.art) ? 'monat' : t.art === 'jaehrlich' ? 'jahr' : 'einmalig');
/**
 * Wie das Mandat die Positionen eines angenommenen Angebots trägt, wenn das Hauptprodukt eine Kombination ist (mehrere Preis-Teile) und Positionen dessen
 * Teile tragen (`preisTeilId`): die Position des Hauptpreises wird das Honorar, jede weitere eigene Position ein Zusatzmodul (`zusatzAusTeil`), alles Übrige
 * (freie Positionen, andere Produkte, Positionen mit umgestellter Basis, Doppelte) bleibt „übrig“ — wie bisher. null = keine Kombination (alte Regel).
 */
export interface AngebotAufteilung { produkt: Leistung; haupt: { position: AngebotPosition; teil: PreisTeil }; zusatz: { position: AngebotPosition; teil: PreisTeil }[]; uebrig: AngebotPosition[] }
export function angebotAufteilung(a: Pick<Angebot, 'positionen'>, leistungen?: readonly Leistung[]): AngebotAufteilung | null {
  const hp = angebotHauptprodukt(a, leistungen);
  const l = hp ? leistungen?.find(x => x.id === hp) : undefined;
  if (!l || !istKombi(l)) return null;
  const gesehen = new Set<string>();
  const eigene: { position: AngebotPosition; teil: PreisTeil }[] = [];
  const uebrig: AngebotPosition[] = [];
  for (const p of a.positionen) {
    const teil = p.leistungId === l.id && p.preisTeilId ? l.preise!.find(t => t.id === p.preisTeilId) : undefined;
    if (!teil || gesehen.has(teil.id) || BASIS_DES_TEILS(teil) !== p.basis) { uebrig.push(p); continue; }
    gesehen.add(teil.id);
    eigene.push({ position: p, teil });
  }
  if (!eigene.length) return null;
  const h = hauptpreis(l);
  const haupt = eigene.find(x => x.teil === h) ?? eigene.find(x => x.teil === hauptpreisAus(eigene.map(e => e.teil)))!;
  return { produkt: l, haupt, zusatz: eigene.filter(x => x !== haupt), uebrig };
}
/** Netto einer Position je Einheit (Cent, Rabatt kaufmännisch) — der Satz eines Tages-/Stundensatzes bzw. der Preis je Einheit. */
const einzelNetto = (p: Pick<AngebotPosition, 'einzelpreisCent' | 'rabattProzent'>) => positionNettoCent({ menge: 1, einzelpreisCent: p.einzelpreisCent, rabattProzent: p.rabattProzent });
/** Das Zusatzmodul einer eigenen Position: vereinbarter Preis aus dem Angebot (Monat/Jahr/einmalig: die Position netto; Satz/je Einheit: je Einheit). */
function zusatzAusPosition(l: Leistung, x: { position: AngebotPosition; teil: PreisTeil }): MandatZusatz | null {
  const nachMenge = istSatz(x.teil.art) || x.teil.art === 'je_einheit';
  return zusatzAusTeil(l, x.teil, { honorarCent: nachMenge ? einzelNetto(x.position) : positionNettoCent(x.position), ...(istSatz(x.teil.art) ? { menge: x.position.menge } : {}) });
}
/**
 * Die Einmalposten eines angenommenen Angebots, die eine eigene Rechnung werden („Einmalbetrag als Rechnung planen“, Woche 1 · 3.6 — die laufende Leistung
 * rechnet das Mandat ab). Ohne Kombination wie bisher: alle Einmalposten. Mit Kombination (24.10.): nur die übrigen — die eigenen Teile (z. B. der
 * Festpreis 50/50) rechnet das Mandat als Zusatzmodul ab, nie doppelt; ist der Hauptpreis selbst einmalig, trägt das Honorar die übrigen mit (keine).
 */
export function angebotEinmalRest(a: Pick<Angebot, 'positionen'>, leistungen?: readonly Leistung[]): AngebotPosition[] {
  const t = angebotAufteilung(a, leistungen);
  if (!t) return a.positionen.filter(p => p.basis === 'einmalig');
  return t.haupt.position.basis === 'einmalig' ? [] : t.uebrig.filter(p => p.basis === 'einmalig');
}

/**
 * Vorbelegung eines Mandats aus einem angenommenen Angebot (bestehender Mandat-Weg, /api/crm/lead aktion „mandat“). Vereinbart ist, was im
 * Angebot steht (Honorar, Laufzeit, Gesellschaft, USt, Zahlungsziel, Leistungen); seit 19.10. ergänzt der Vertrag des Produkts (Karte,
 * `leistungen` übergeben) nur, was das Angebot nicht sagt: Kündigungsfrist, Verlängerung, Rhythmus „Quartal“, Mindestlaufzeit ohne Laufzeit.
 * Ohne Vertrag am Produkt genau wie bisher.
 */
export function mandatVorbelegung(a: Angebot, leistungen?: readonly Leistung[]): Partial<Mandat> {
  // 24.10.: eine Kombination (Hauptprodukt mit mehreren Preis-Teilen) trägt jeden Teil — Honorar = Hauptpreis, die übrigen Teile Zusatzmodule.
  const teile = angebotAufteilung(a, leistungen);
  if (teile) return mandatVorbelegungKombi(a, teile, leistungen ?? []);
  const s = angebotSummen(a, { kleinunternehmer: !!a.absender?.kleinunternehmer });
  const laufend = s.monat.netto + kaufmaennisch(s.jahr.netto / 12);
  const lz = Math.max(0, ...a.positionen.filter(p => p.basis !== 'einmalig').map(p => p.laufzeitMonate ?? 0));
  // Das Mandat trägt die laufende Leistung (Retainer), nicht den einmaligen Auftakt — sonst die erste mit Produkt (EINE Regel: `angebotHauptprodukt`).
  const leistungId = angebotHauptprodukt(a, leistungen);
  const saetze = Array.from(new Set(a.positionen.map(p => p.ustSatz)));
  // Titel: der des Angebots — nannte er nur ein fremdes Produkt (Altbestand vor 21.10., A1), der aus den Produkten (`angebotTitelFuerFolge`).
  const titel = angebotTitelFuerFolge(a, leistungen);
  const basis: Partial<Mandat> = {
    gesellschaft: a.gesellschaft, titel: titel || undefined,
    honorar: laufend > 0 ? { betrag: ausCent(laufend), basis: 'monat', netto: true } : { betrag: ausCent(s.einmalig.netto), basis: 'einmalig', netto: true },
    ...(lz ? { mindestlaufzeitMonate: Math.min(120, lz) } : {}),
    ...(leistungId ? { leistungId } : {}),
    ustSatz: a.absender?.kleinunternehmer ? 0 : saetze.length === 1 && [0, 7, 19].includes(saetze[0]) ? saetze[0] : 19,
    rechnungsrhythmus: laufend > 0 ? 'monatlich' : 'einmalig', zahlungszielTage: a.zahlungszielTage,
    leistungen: a.positionen.map(p => p.titel),
  };
  // Der Vertrag des Produkts (Karte) füllt nur, was das Angebot offen lässt — Honorar, USt und Zahlungsziel sind im Angebot vereinbart.
  const produkt = leistungId ? leistungen?.find(l => l.id === leistungId) : undefined;
  const v = produkt ? mandatVertragAusProdukt(produkt, basis.honorar!.basis) : {};
  // P3 (19.10.): inklusive Module laut Regel des Hauptprodukts (0 € — nie doppelt mit dem Angebot; bezahlte Module stehen im Angebot selbst).
  const inklusive = produkt?.regeln?.inklusive?.length ? mandatVorlageAusProdukt(produkt).zusatz?.filter(z => z.inklusive) : undefined;
  // Zahlplan (21.10., Rundgang B2): ein einmaliges Angebot über ein Produkt mit Anzahlung (z. B. 50/50) wird zwei Zahlungen — wie das Zusatzmodul.
  const zahlplan = produkt ? mandatZahlplanAusProdukt(produkt, basis.honorar!.basis) : undefined;
  return {
    ...basis,
    ...(zahlplan ? { zahlplan } : {}),
    ...(!lz && v.mindestlaufzeitMonate ? { mindestlaufzeitMonate: v.mindestlaufzeitMonate } : {}),
    ...(v.kuendigungsfristTage != null ? { kuendigungsfristTage: v.kuendigungsfristTage } : {}),
    ...(v.verlaengerung ? { verlaengerung: v.verlaengerung } : {}),
    ...(v.rechnungsrhythmus === 'quartal' ? { rechnungsrhythmus: 'quartal' as const } : {}),
    ...(inklusive?.length ? { zusatz: inklusive } : {}),
  };
}

/**
 * Mandat-Vorbelegung einer Kombination (24.10., Bau-Test): Honorar = die Position des Hauptpreises (der laufende Teil — monatlich netto, jährlich ÷ 12,
 * Tagessatz je Tag mit den geplanten Tagen, Festpreis einmalig mit Zahlplan), jede weitere eigene Position ein Zusatzmodul mit dem vereinbarten Preis
 * (`zusatzAusPosition`); übrige laufende Positionen kommen wie bisher zum Monatshonorar, übrige Einmalposten bleiben für die Einmal-Rechnung
 * (`angebotEinmalRest`). Vertrag des Produkts füllt nur Lücken (wie bisher), Leistungen = Leistungstext + Lieferumfang des Produkts.
 */
function mandatVorbelegungKombi(a: Angebot, t: AngebotAufteilung, leistungen: readonly Leistung[]): Partial<Mandat> {
  const ku = !!a.absender?.kleinunternehmer;
  const l = t.produkt;
  const hp = t.haupt.position;
  const lz = Math.max(0, ...a.positionen.filter(p => p.basis !== 'einmalig').map(p => p.laufzeitMonate ?? 0));
  const uebrigLaufend = t.uebrig.filter(p => p.basis !== 'einmalig');
  const uebrigMonat = uebrigLaufend.reduce((x, p) => x + (p.basis === 'jahr' ? kaufmaennisch(positionNettoCent(p) / 12) : positionNettoCent(p)), 0);
  const offen: string[] = [];
  let honorar: Mandat['honorar'];
  let extra: Partial<Mandat> = {};
  if (hp.basis === 'einmalig') {
    // Festpreis (bzw. je Einheit) als Hauptpreis: einmalig — übrige Einmalposten wie bisher dazu, übrige laufende werden ein offener Punkt.
    const einmal = t.uebrig.filter(p => p.basis === 'einmalig').reduce((x, p) => x + positionNettoCent(p), 0);
    honorar = { betrag: ausCent(positionNettoCent(hp) + einmal), basis: 'einmalig', netto: true };
    const zp = t.haupt.teil.art === 'fest' && t.haupt.teil.zahlplan?.anzahlungProzent ? { anzahlungProzent: t.haupt.teil.zahlplan.anzahlungProzent } : undefined;
    if (zp) extra = { zahlplan: zp };
    for (const p of uebrigLaufend) offen.push(`Position „${p.titel}“ (laufend) steht nicht im Honorar — als Zusatzmodul ergänzen.`);
  } else if (t.haupt.teil.art === 'tagessatz') {
    honorar = { betrag: ausCent(einzelNetto(hp)), basis: 'tag', netto: true };
    extra = { tageJeMonat: hp.menge };
    for (const p of uebrigLaufend) offen.push(`Position „${p.titel}“ (laufend) steht nicht im Honorar — als Zusatzmodul ergänzen.`);
  } else {
    // monatlich, jährlich (÷ 12 auf den Cent), Stundensatz (geplante Stunden × Satz wie `mandatVorlageAusProdukt`) — übrige laufende wie bisher dazu.
    const netto = hp.basis === 'jahr' ? kaufmaennisch(positionNettoCent(hp) / 12) : positionNettoCent(hp);
    honorar = { betrag: ausCent(netto + uebrigMonat), basis: 'monat', netto: true };
    if (t.haupt.teil.art === 'stundensatz') offen.push(`Stundensatz ${euroCent(einzelNetto(hp))} netto, ${mengeText(hp.menge)} Std./Monat geplant — als Monatshonorar stehen die geplanten Stunden; nach Aufwand abrechnen.`);
  }
  const zusatz = t.zusatz.map(x => zusatzAusPosition(l, x)).filter((z): z is MandatZusatz => !!z);
  const v = mandatVertragAusProdukt(l, honorar.basis);
  const inklusive = l.regeln?.inklusive?.length ? mandatVorlageAusProdukt(l).zusatz?.filter(z => z.inklusive) ?? [] : [];
  const vorlage = mandatVorlageAusProdukt(l);
  const saetze = Array.from(new Set(a.positionen.map(p => p.ustSatz)));
  const titel = angebotTitelFuerFolge(a, leistungen);
  return {
    gesellschaft: a.gesellschaft, titel: titel || undefined, honorar, ...extra,
    ...(lz ? { mindestlaufzeitMonate: Math.min(120, lz) } : v.mindestlaufzeitMonate ? { mindestlaufzeitMonate: v.mindestlaufzeitMonate } : {}),
    leistungId: l.id,
    ustSatz: ku ? 0 : saetze.length === 1 && [0, 7, 19].includes(saetze[0]) ? saetze[0] : 19,
    rechnungsrhythmus: honorar.basis === 'einmalig' ? 'einmalig' : v.rechnungsrhythmus === 'quartal' ? 'quartal' : 'monatlich', zahlungszielTage: a.zahlungszielTage,
    // Leistungen: Leistungstext + Lieferumfang des Produkts (die Teile stehen als Zusatzmodule, nicht mehr nur als Namen), dazu die übrigen Positionen.
    leistungen: [...(vorlage.leistungen.length ? vorlage.leistungen : [l.name]), ...t.uebrig.map(p => p.titel)],
    ...(v.kuendigungsfristTage != null ? { kuendigungsfristTage: v.kuendigungsfristTage } : {}),
    ...(v.verlaengerung ? { verlaengerung: v.verlaengerung } : {}),
    ...(zusatz.length || inklusive.length ? { zusatz: [...zusatz, ...inklusive] } : {}),
    ...(offen.length ? { offen } : {}),
  };
}

/**
 * Das Hauptprodukt eines Angebots — EINE Regel für Mandat-Vorbelegung, „Deal folgt dem Angebot“ und den Deal beim Stellen (19.10., P3; Rundgang A3):
 * die erste Position mit Produkt, das kein reines Zusatzmodul ist (Rolle „zusatz“, Katalog übergeben) und laufend abgerechnet wird; sonst die erste
 * solche einmalige; sonst die erste Position mit Produkt überhaupt. Ohne Katalog genau wie bisher (laufend vor einmalig).
 */
export function angebotHauptprodukt(a: Pick<Angebot, 'positionen'>, leistungen?: readonly Pick<Leistung, 'id' | 'rolle'>[]): string | undefined {
  const mit = a.positionen.filter(p => p.leistungId);
  const haupt = mit.filter(p => leistungen?.find(l => l.id === p.leistungId)?.rolle !== 'zusatz');
  return (haupt.find(p => p.basis !== 'einmalig') ?? haupt[0] ?? mit.find(p => p.basis !== 'einmalig') ?? mit[0])?.leistungId;
}

/** Das angenommene Angebot zu einem Deal (jüngstes) — für die Mandat-Vorbelegung. */
export const angenommenZuDeal = (angebote: readonly Angebot[] | undefined, dealId: string) =>
  (angebote ?? []).filter(a => a.dealId === dealId && a.status === 'angenommen').sort((x, y) => (y.angenommenAm ?? '').localeCompare(x.angenommenAm ?? ''))[0];

// ── Personenbezug (Art. 15/17, Dubletten) ────────────────────────────────────

export const GELOEST_NAME = '[Person gelöst]';
/** Art. 17: Entwürfe der Person fallen weg; gestellte Angebote verlieren den Personenbezug (Geschäftsunterlage). */
export function angebotePersonOhne(liste: readonly Angebot[], id: string, heute: string): Angebot[] {
  return liste.flatMap(a => {
    if (a.kontaktId !== id) return [a];
    if (istEntwurf(a)) return [];
    const { kontaktId: _k, ...rest } = a;
    return [{ ...rest, personGeloest: heute, ...(a.empfaenger ? { empfaenger: { ...a.empfaenger, name: GELOEST_NAME, email: undefined } } : {}) }];
  });
}
/** Dubletten: Verweise von alt auf neu. */
export const angebotePersonUm = (liste: readonly Angebot[], alt: string, neu: string): Angebot[] => liste.map(a => (a.kontaktId === alt ? { ...a, kontaktId: neu } : a));
/** Art. 15: die Angebote der Person (Nummer, Titel, Status, Summen — ohne PDF-Inhalt). */
export function angebotePersonAuskunft(liste: readonly Angebot[], id: string) {
  return liste.filter(a => a.kontaktId === id).map(a => ({ id: a.id, ...(a.nummer ? { nummer: a.nummer } : {}), titel: a.titel, status: a.status, gesellschaft: a.gesellschaft, gueltigBis: a.gueltigBis, ...(a.gestelltAm ? { gestelltAm: a.gestelltAm } : {}), nettoGesamtCent: angebotSummen(a).gesamt.netto }));
}

// ── Lesen für Oberflächen ────────────────────────────────────────────────────

/** Angebote zu einer Person bzw. ihrer Firma — neueste zuerst. */
export function angeboteZu(liste: readonly Angebot[] | undefined, p: { kontaktId?: string; firmaId?: string; dealId?: string }): Angebot[] {
  return (liste ?? []).filter(a => (p.kontaktId && a.kontaktId === p.kontaktId) || (p.firmaId && a.firmaId === p.firmaId) || (p.dealId && a.dealId === p.dealId))
    .sort((x, y) => (y.gestelltAm ?? y.geaendert).localeCompare(x.gestelltAm ?? x.geaendert));
}

/**
 * Wohin ein ANGENOMMENES Angebot weiterführt (08.10., Markttraktion Woche 2 · 3.10 — vorher hatte es im Umsatz-Reiter keinen Weg):
 *   mandat   es gibt schon ein Mandat (am Angebot vermerkt oder aus dem Deal des Angebots) → „Mandat ›“
 *   anlegen  ein gewonnener Deal ohne Mandat → „Mandat anlegen ›“ (derselbe Weg wie in der Angebots-Ansicht, `/api/crm/lead` aktion „mandat“)
 *   null     nicht angenommen bzw. ohne Deal (dann bleibt „→ Rechnung schreiben“).
 * Gelöschte Mandate (Papierkorb) zählen nicht.
 */
export function angebotMandatWeg(a: Pick<Angebot, 'status' | 'dealId' | 'mandatId'>, crm: { chancen: readonly Pick<Chance, 'id' | 'stufe'>[]; mandate: readonly Pick<Mandat, 'id' | 'chanceId' | 'geloeschtAm'>[] }): { art: 'mandat'; mandatId: string } | { art: 'anlegen'; dealId: string } | null {
  if (a.status !== 'angenommen') return null;
  const lebt = crm.mandate.filter(m => !m.geloeschtAm);
  const amAngebot = a.mandatId ? lebt.find(m => m.id === a.mandatId) : undefined;
  if (amAngebot) return { art: 'mandat', mandatId: amAngebot.id };
  if (!a.dealId) return null;
  const ausDeal = lebt.find(m => m.chanceId === a.dealId);
  if (ausDeal) return { art: 'mandat', mandatId: ausDeal.id };
  return crm.chancen.some(c => c.id === a.dealId && c.stufe === 'gewonnen') ? { art: 'anlegen', dealId: a.dealId } : null;
}

/** Der Kopf des Vermerks am Kontakt — „Angebot <Nummer> gestellt“ bzw. „… gesendet“ (an ihm erkennt der Vermerk sich selbst wieder). */
export const angebotVermerkKopf = (nummer: string, art: 'gestellt' | 'gesendet') => `Angebot ${nummer} ${art}`;
/** Steht am Kontakt schon „Angebot <Nummer> gesendet“ (Woche 2 · 3.15)? Die Oberfläche zeigt „Mail ist raus“ nur, solange nicht. */
export const angebotGesendetVermerkt = (k: { aktivitaeten?: readonly { text?: string }[] } | undefined, nummer: string | undefined): boolean =>
  !!k && !!nummer && (k.aktivitaeten ?? []).some(a => (a.text ?? '').startsWith(angebotVermerkKopf(nummer, 'gesendet')));

/** Filter der Liste „Angebote“. */
export function angeboteFiltern(liste: readonly Angebot[], f: { status?: AngebotsStatus | 'offen' | null; gesellschaft?: Gesellschaftskennung | null; suche?: string }, name: (a: Angebot) => string, passt: (felder: string[], frage: string) => boolean): Angebot[] {
  return liste.filter(a => (!f.status || (f.status === 'offen' ? a.status === 'gestellt' : a.status === f.status))
    && (!f.gesellschaft || a.gesellschaft === f.gesellschaft)
    && (!f.suche?.trim() || passt([a.nummer ?? '', a.titel, name(a)], f.suche)))
    .sort((x, y) => (y.gestelltAm ?? y.geaendert).localeCompare(x.gestelltAm ?? x.geaendert));
}

/** BEAN (lib/crm/bean.ts): offene Angebote als Hinweise (nur Bezüge). */
export const offeneAngeboteHinweise = (b: Pick<CrmBestand, 'angebote'> | Partial<Pick<CrmBestand, 'angebote'>>) =>
  (b.angebote ?? []).filter(istOffen).map(a => ({ titel: a.titel, ...(a.kontaktId ? { kontaktId: a.kontaktId } : {}), ...(a.firmaId ? { firmaId: a.firmaId } : {}), ...(a.dealId ? { dealId: a.dealId } : {}), ...(a.mandatId ? { mandatId: a.mandatId } : {}) }));
