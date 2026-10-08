// ─── Konten-Register — EIN Ort für Konten und Kontostände (08.10., rein: Server UND Browser) ─────────────────────────────────────────────
// Kevin 08.10.: „Kontostände an fünf Stellen → EIN Konten-Register (Konto → Gesellschaft/Person/gemeinsam, Stand mit Datum); Bank, 0-Punkt,
// Liquidität, Finanzplanung und Haushalt lesen nur noch daraus.“ R4: „Haushalt führt das Ist, Finanzplanung liest daraus.“ R3: Zahlen kommen
// vorerst von Hand; die Bank-Anbindung (finAPI) schreibt später in DASSELBE Register (`quelle: 'bank'`, `externeId`) — hier nur die Andockstelle.
//
// Bestand je Haushalt `konten--<haushalt>` (Server: lib/finanzen/konten/server.ts, Route /api/finanzen/konten). Befund und Bauplan: KONTEN_REGISTER.md.
//
// Regeln (eine Stelle):
//   • Konto: Kennung `kt-<uuid>`, Name, Art (giro · tagesgeld · kredit · depot · kasse · sonstiges), Zuordnung `ort` (privat · Gesellschaft ·
//     gemeinsam; Person nur bei privat), Bank, IBAN (gespeichert in Grundform, ausgeliefert NUR maskiert — Regeln wie lib/crm/zahlung.ts).
//   • Stände: nur anhängen, nie löschen. Ein falscher Stand wird „zurückgenommen“ (bleibt in der Historie, zählt nicht) — wie beim 0-Punkt.
//     Geltend = jüngster nach Datum (gleiches Datum: zuletzt erfasst).
//   • Kasse je Ort: Summe der geltenden Stände der Konten, die zur Kasse zählen (giro, tagesgeld, kasse, sonstiges — Kredit und Depot nicht).
//   • Wer regiert einen Ort? Das Register, sobald es für diesen Ort ein Kassen-Konto MIT Stand (auch zurückgenommen) hat — dann zählt nur noch
//     das Register (eine Wahrheit, nie doppelt gezählt). Sonst gilt die bisherige Quelle (Liquidität/0-Punkt, Finanzplanung) — bit-gleich wie vorher.
//   • Sichten (Trennung serverseitig): `privat` = alles (volle Haushaltsmitglieder), `business` = nur Konten der Business-Gesellschaften
//     (`istBusinessGesellschaft`, die Selbstständigkeit gehört über `bereichVon` zu Privat — nie als Sonderfall abgefragt).

import { neueKennung } from '@/lib/kennung';
import { BUSINESS_GESELLSCHAFTEN, GESELLSCHAFTEN, finanzOrtName, istBusinessGesellschaft, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';
import { ibanGrundform, ibanGueltig, ibanMaskiert } from '@/lib/crm/zahlung';
import { istKalendertag } from '@/lib/zeit';
import { planMonat, type FinanzDaten, type KontoIstWert, type KontoStart } from '@/lib/finanzen/rechenkern';

const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Name des Bestands je Haushalt. */
export function kontenName(haushalt: string): string {
  if (!HAUSHALT.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `konten--${haushalt}`;   // ausgeschrieben, damit der Register-Wächter den Namen findet (tests/datenschutz-register.test.ts)
}

// ── Typen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const KONTO_ARTEN = ['giro', 'tagesgeld', 'kredit', 'depot', 'kasse', 'sonstiges'] as const;
export type KontoArt = typeof KONTO_ARTEN[number];
export const KONTO_ART_NAME: Readonly<Record<KontoArt, string>> = {
  giro: 'Girokonto', tagesgeld: 'Tagesgeld', kredit: 'Kredit', depot: 'Depot', kasse: 'Barkasse', sonstiges: 'Sonstiges',
};
/** Zählt der Stand zur Kasse (verfügbares Geld)? Ein Kredit ist eine Schuld, ein Depot keine Liquidität. */
export const ZUR_KASSE: Readonly<Record<KontoArt, boolean>> = { giro: true, tagesgeld: true, kasse: true, sonstiges: true, kredit: false, depot: false };

/** Zuordnung: privat (optional mit Person), eine der festen Gesellschaften (kdc · kdv · ug — die rechnen) oder gemeinsam. */
export type KontoOrt = 'privat' | 'gemeinsam' | Gesellschaftskennung;
export const KONTO_ORTE: readonly KontoOrt[] = ['privat', 'gemeinsam', ...GESELLSCHAFTEN];
export const istKontoOrt = (v: unknown): v is KontoOrt => KONTO_ORTE.includes(v as KontoOrt);
export const ortName = (o: KontoOrt): string => (o === 'gemeinsam' ? 'Gemeinsam' : finanzOrtName(o));
/** Liegt der Ort im Business-Bereich? Nur die Business-Gesellschaften — privat und gemeinsam nie. */
export const ortImBusiness = (o: unknown): boolean => istBusinessGesellschaft(o);
/** Privat-Bereich der Finanzplanung: privat + gemeinsam (der Haushalt). */
export const istPrivatOrt = (o: unknown): boolean => o === 'privat' || o === 'gemeinsam';

/** Woher ein Stand kommt: von Hand (Formular, ZOE nach Freigabe) oder später aus der Bank-Anbindung. */
export type StandQuelle = 'hand' | 'bank';
/** Über welchen Weg er kam — für Verlauf und Rückweg (z. B. den 0-Punkt zurücknehmen). */
/** `auszug` (09.10.): Saldo aus einem eingelesenen Kontoauszug (CAMT/CSV, lib/finanzen/kontoauszug) — `id` = Kennung des Laufs. */
export type StandHerkunft = 'konten' | 'liquiditaet' | 'eroeffnung' | 'finanzplanung' | 'zoe' | 'uebernahme' | 'bank' | 'auszug';

export interface KontoStand {
  /** `ks-<uuid>` */
  id: string;
  /** € auf den Cent (wie Liquidität, 0-Punkt und Finanzplanung). */
  betrag: number;
  /** JJJJ-MM-TT — der Tag, an dem der Stand galt (nie in der Zukunft). */
  datum: string;
  quelle: StandQuelle;
  /** Speichername der Person (bzw. „system“). */
  erfasstVon: string;
  /** ISO-Zeitpunkt der Erfassung. */
  erfasstAm: string;
  herkunft?: { art: StandHerkunft; id?: string };
  /** Kennung des Umsatzes/Saldos bei der Bank (finAPI) — Andockstelle, heute leer. */
  externeId?: string;
  notiz?: string;
  zurueckgenommenAm?: string;
  zurueckgenommenVon?: string;
}

export interface RegisterKonto {
  /** `kt-<uuid>` */
  id: string;
  name: string;
  art: KontoArt;
  ort: KontoOrt;
  /** Wessen Konto (Speichername) — nur bei `ort: 'privat'`. */
  person?: string;
  bank?: string;
  /** IBAN in Grundform — verlässt den Server nie (nur `ibanMaskiert`). */
  iban?: string;
  /** Kennung des Kontos bei der Bank (finAPI) — Andockstelle, heute leer. */
  externeId?: string;
  /** Verbindung zu den bisherigen Quellen (Übernahme): Liquidität-Konto der Gesellschaft, Posten der Finanzplanung, Konto im Haushalt. */
  alt?: { liquiditaet?: Gesellschaftskennung; posten?: string; haushaltKonto?: string };
  staende: KontoStand[];
  angelegtVon: string;
  angelegtAm: string;
  geaendertAm?: string;
  archiviertAm?: string;
}

export interface KontenRegister { v: 1; konten: RegisterKonto[]; uebernahme?: { am: string; von: string; anzahl: number }[] }
export const LEERES_REGISTER: KontenRegister = { v: 1, konten: [] };

export type KontenSicht = 'privat' | 'business';

/** Grenzen — darüber wird abgelehnt (413), nie gekürzt. */
export const GRENZEN = { konten: 200, staende: 5000, ops: 50, name: 120, bank: 80, notiz: 300, betrag: 1e12 } as const;

// ── Lesen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Der gespeicherte Bestand, vorsichtig gelesen (nie wegwerfen — nur Form herstellen). */
export function registerLesen(roh: unknown): KontenRegister {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<KontenRegister>;
  return {
    v: 1,
    konten: Array.isArray(r.konten) ? r.konten.filter(k => k && typeof k === 'object' && typeof k.id === 'string').map(k => ({ ...k, staende: Array.isArray(k.staende) ? k.staende : [] })) : [],
    ...(Array.isArray(r.uebernahme) && r.uebernahme.length ? { uebernahme: r.uebernahme } : {}),
  };
}

/** Der geltende Stand: jüngster nach Datum, bei gleichem Datum der zuletzt erfasste; zurückgenommene zählen nicht. */
export function geltenderStand(k: Pick<RegisterKonto, 'staende'>): KontoStand | null {
  let best: KontoStand | null = null;
  for (const s of k.staende) {
    if (s.zurueckgenommenAm) continue;
    if (!best || s.datum > best.datum || (s.datum === best.datum && s.erfasstAm >= best.erfasstAm)) best = s;
  }
  return best;
}

const aktiv = (k: RegisterKonto) => !k.archiviertAm;
const kassenKonto = (k: RegisterKonto) => aktiv(k) && ZUR_KASSE[k.art] !== false;

/** Ist dieses Konto in der Sicht zu sehen? */
export const sichtbarIn = (k: Pick<RegisterKonto, 'ort'>, sicht: KontenSicht): boolean => sicht === 'privat' || ortImBusiness(k.ort);

/** Das Register in einer Sicht — Business bekommt nur die Konten der Business-Gesellschaften. */
export function registerFuerSicht(r: KontenRegister, sicht: KontenSicht): KontenRegister {
  if (sicht === 'privat') return r;
  const { uebernahme: _u, ...rest } = r;
  return { ...rest, konten: r.konten.filter(k => sichtbarIn(k, 'business')) };
}

/** Kasse eines Ortes: Summe der geltenden Stände, ältester und jüngster Stand, Zahl der Konten mit Stand und ohne (= `KontoIstWert` der Planung). */
export type Kasse = KontoIstWert;

/** Regiert das Register diesen Ort? Ja, sobald ein Kassen-Konto dort je einen Stand hatte (auch zurückgenommen). */
export const regiert = (konten: readonly RegisterKonto[], pruefe: (o: KontoOrt) => boolean): boolean =>
  konten.some(k => kassenKonto(k) && pruefe(k.ort) && k.staende.length > 0);

const cent = (n: number) => Math.round(n * 100) / 100;

/** Kasse über die Konten, die `pruefe` zulässt — null, wenn das Register diese Orte nicht regiert (dann gilt die bisherige Quelle). */
export function kasseFuer(konten: readonly RegisterKonto[], pruefe: (o: KontoOrt) => boolean, art?: (a: KontoArt) => boolean): Kasse | null {
  const liste = konten.filter(k => kassenKonto(k) && pruefe(k.ort) && (!art || art(k.art)));
  if (!liste.some(k => k.staende.length > 0)) return null;
  let betrag = 0, mit = 0, stand = '', aeltester = '';
  for (const k of liste) {
    const g = geltenderStand(k);
    if (!g) continue;
    betrag += g.betrag; mit++;
    if (g.datum > stand) stand = g.datum;
    if (!aeltester || g.datum < aeltester) aeltester = g.datum;
  }
  return { betrag: cent(betrag), stand, aeltester, konten: mit, fehlen: liste.length - mit };
}

/** Die Kasse je Gesellschaft (kdc · kdv · ug) — nur Gesellschaften, die das Register regiert. */
export type GesellschaftsKasse = Partial<Record<Gesellschaftskennung, Kasse>>;
export function gesellschaftsKasse(konten: readonly RegisterKonto[], nur: readonly Gesellschaftskennung[] = GESELLSCHAFTEN): GesellschaftsKasse {
  const raus: GesellschaftsKasse = {};
  for (const g of nur) { const k = kasseFuer(konten, o => o === g); if (k) raus[g] = k; }
  return raus;
}
/** Die Kasse des Haushalts (privat + gemeinsam) — die Konten, mit denen die Finanzplanung „Privat“ rechnet. */
export const privatKasse = (konten: readonly RegisterKonto[]): Kasse | null => kasseFuer(konten, istPrivatOrt);
/** Rücklage (Notgroschen) des Haushalts = Tagesgeld privat + gemeinsam — für den Privat-Index; null = bisherige Eintragung gilt. */
export const ruecklageKasse = (konten: readonly RegisterKonto[]): Kasse | null => kasseFuer(konten, istPrivatOrt, a => a === 'tagesgeld');

// ── Wirkung auf die bisherigen Stellen (bit-gleich ohne Register) ─────────────────────────────────────────────────────────────────

type FirmaArt = { id: string; name?: string; kontostand?: number | null; stand?: string | null };

/**
 * Liquidität / 0-Punkt / Business-Index / Head of Finance …: die Firmen-Konten des Finanzplans mit dem Register überlagern. Je Gesellschaft, die das
 * Register regiert: Kontostand = Kasse, Datum = jüngster Stand (danach entscheidet der 0-Punkt wie bisher, `abEroeffnung`); fehlt die Firma, entsteht sie.
 * Ohne Register-Kasse: dieselbe Liste (gleiches Objekt) — bit-gleich wie vorher.
 */
export function firmenMitRegister<F extends FirmaArt>(firmen: F[] | undefined, kasse: GesellschaftsKasse | null | undefined): F[] | undefined {
  if (!firmen || !kasse || !Object.keys(kasse).length) return firmen;
  const raus = firmen.map(f => {
    const k = istGesellschaft(f.id) ? kasse[f.id] : undefined;
    return k ? { ...f, kontostand: k.konten ? k.betrag : null, stand: k.stand || null } : f;
  });
  for (const g of GESELLSCHAFTEN) {
    const k = kasse[g];
    if (k && !raus.some(f => f.id === g)) raus.push({ id: g, name: finanzOrtName(g), bank: '', kontostand: k.konten ? k.betrag : null, stand: k.stand || null } as unknown as F);
  }
  return raus;
}
/** Ein Bündel (Finanzplan-Bestand) mit überlagerten Firmen-Konten — ohne Kasse dasselbe Objekt. */
export function mitRegister<B extends { firmen?: FirmaArt[] }>(b: B, kasse: GesellschaftsKasse | null | undefined): B {
  if (!b.firmen || !kasse || !Object.keys(kasse).length) return b;
  return { ...b, firmen: firmenMitRegister(b.firmen, kasse) };
}

/**
 * Was die Finanzplanung aus dem Register liest (nie gespeichert — der Server setzt es beim Lesen, wie den 0-Punkt): `privat` (Haushalt = privat +
 * gemeinsam) ersetzt die Kontostände der Planung (Posten „Konto“, Privat) für Runway und „frei“; `selbststaendigkeit` ersetzt „Kontostand heute“.
 */
export type KontenIst = NonNullable<FinanzDaten['kontenIst']>;
export function kontenIstAus(konten: readonly RegisterKonto[]): KontenIst | undefined {
  const privat = privatKasse(konten);
  const selbst = kasseFuer(konten, o => o === 'kdc');
  return privat || selbst ? { ...(privat ? { privat } : {}), ...(selbst ? { selbststaendigkeit: selbst } : {}) } : undefined;
}

/** Die Konten der Finanzplanung mit eigener Kontoachse und Startwert (`FinanzDaten.eroeffnung`). */
const PLAN_KONTEN = ['ug', 'kdv'] as const;
/**
 * Kontostand-Start der Finanzplanung (ug, kdv): der 0-Punkt wie bisher — außer das Register hat einen jüngeren Stand (Datum NACH dem Stichtag;
 * gleiche Regel wie `kontoQuelle`). Ohne 0-Punkt: der Register-Stand. Monat = Planmonat des Datums (vor dem Plan → 1, nach dem Plan → keiner).
 * Ohne Register-Kasse: genau der 0-Punkt-Start (dasselbe Objekt).
 */
export function planStartMitRegister(start: FinanzDaten['eroeffnung'] | undefined, kasse: GesellschaftsKasse | null | undefined, planMonate: number): FinanzDaten['eroeffnung'] | undefined {
  if (!kasse || !PLAN_KONTEN.some(k => kasse[k]?.konten)) return start;
  const raus: NonNullable<FinanzDaten['eroeffnung']> = { ...(start ?? {}) };
  for (const k of PLAN_KONTEN) {
    const r = kasse[k];
    if (!r?.konten || !r.stand) continue;
    const e = start?.[k];
    if (e && !(r.stand > e.stichtag)) continue;
    const monat = Math.max(1, planMonat(r.stand));
    if (monat > planMonate) continue;
    raus[k] = { monat, betrag: r.betrag, stichtag: r.stand, quelle: 'register' } as KontoStart;
  }
  return Object.keys(raus).length ? raus : undefined;
}

/**
 * Ein Plan-Dokument mit den Ist-Werten (beim Lesen, nie gespeichert): 0-Punkt/Register-Start für ug/kdv, Ist der Privat-Konten und der
 * Selbstständigkeit („Kontostand heute“ der Selbstständigkeit = Register, solange es sie regiert). Ohne beides: dasselbe Dokument.
 */
export function planMitIst(d: FinanzDaten, start: FinanzDaten['eroeffnung'] | undefined, ist: KontenIst | undefined): FinanzDaten {
  if (!start && !ist) return d;
  const selbst = ist?.selbststaendigkeit;
  return {
    ...d,
    ...(start ? { eroeffnung: start } : {}),
    ...(ist ? { kontenIst: ist } : {}),
    ...(selbst ? { selbst: { ...d.selbst, kontoStart: selbst.konten ? selbst.betrag : 0 } } : {}),
  };
}

// ── Ausgabe an den Browser ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KontoAnzeige extends Omit<RegisterKonto, 'iban' | 'externeId'> {
  ibanMaskiert?: string;
  ibanGesetzt?: true;
  /** Hängt am Konto eine Bank-Anbindung? (Kennung selbst bleibt auf dem Server.) */
  bank_angebunden?: true;
  geltend: KontoStand | null;
  /** Fingerabdruck — mit zurückschicken (sonst 409). */
  fassung: string;
}
/** Ein Konto für den Browser: IBAN nur maskiert, Bank-Kennungen weg, Stände jüngste zuerst. */
export function kontoAnzeige(k: RegisterKonto, fassung: string): KontoAnzeige {
  const { iban, externeId, ...rest } = k;
  const staende = [...k.staende].sort((a, b) => (b.datum.localeCompare(a.datum) || b.erfasstAm.localeCompare(a.erfasstAm))).map(s => {
    const { externeId: _e, ...st } = s;
    return st as KontoStand;
  });
  return {
    ...rest, staende,
    ...(iban ? { ibanMaskiert: ibanMaskiert(iban), ibanGesetzt: true as const } : {}),
    ...(externeId ? { bank_angebunden: true as const } : {}),
    geltend: geltenderStand(k), fassung,
  };
}

// ── Schreiben (Einzelschritte mit Stand) ─────────────────────────────────────────────────────────────────────────────────────────

export type KontoOp =
  | { op: 'konto-neu'; konto: Record<string, unknown>; stand0?: Record<string, unknown> }
  | { op: 'konto-aendern'; id: string; stand?: string; felder: Record<string, unknown> }
  | { op: 'stand-neu'; id: string; stand?: string; betrag: unknown; datum: unknown; notiz?: unknown }
  | { op: 'stand-zuruecknehmen'; id: string; stand?: string; standId: string }
  | { op: 'archivieren'; id: string; stand?: string; aus?: boolean };

export interface Kontext {
  person: string;
  /** ISO-Zeitpunkt. */
  jetzt: string;
  /** Berliner Tag (JJJJ-MM-TT) — Stände dürfen nicht später liegen. */
  heute: string;
  sicht: KontenSicht;
  /** Speichernamen der Personen im Haushalt (für `person` an Privat-Konten). */
  personen: readonly string[];
  /** Fingerabdruck eines Kontos (Server: lib/store/fingerabdruck). */
  fassung: (k: RegisterKonto) => string;
}

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; konflikt?: { id: string } };
export type Ergebnis = { ok: true; register: KontenRegister; neu: string[]; geaendert: { id: string; felder: string[] }[]; orte: KontoOrt[] } | Fehler;

const nein = (status: Fehler['status'], fehler: string, konflikt?: { id: string }): Fehler => ({ ok: false, status, fehler, ...(konflikt ? { konflikt } : {}) });
const textAus = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).normalize('NFC').replace(/\s+/g, ' ').trim();
  if (t.length > max) return '\u0000';   // Marke: zu lang → 413 beim Aufrufer
  return t;
};

/** Betrag als Zahl: Zahl oder deutscher Text („12.500,50“, „-80“). */
export function betragAus(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  const t = v.trim().replace(/\s|€/g, '');
  const n = Number(/,/.test(t) || /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

/** Einen Stand prüfen (Betrag auf den Cent, echter Tag, nicht in der Zukunft). */
export function standPruefen(roh: { betrag?: unknown; datum?: unknown; notiz?: unknown }, heute: string): { ok: true; betrag: number; datum: string; notiz?: string } | Fehler {
  const b = betragAus(roh.betrag);
  if (b === null) return nein(400, 'Betrag als Zahl eintragen (auch 0 oder negativ).');
  if (Math.abs(b) > GRENZEN.betrag) return nein(400, 'Betrag ist unplausibel groß.');
  if (!istKalendertag(roh.datum)) return nein(400, 'Datum als JJJJ-MM-TT eintragen.');
  if (roh.datum > heute) return nein(400, 'Ein Kontostand liegt nie in der Zukunft — Datum heute oder früher.');
  const notiz = textAus(roh.notiz, GRENZEN.notiz);
  if (notiz === '\u0000') return nein(413, `Notiz zu lang (höchstens ${GRENZEN.notiz} Zeichen) — nicht gekürzt, nichts gespeichert.`);
  return { ok: true, betrag: cent(b), datum: roh.datum, ...(notiz ? { notiz } : {}) };
}

/** IBAN-Eingabe: leer/maskiert = unverändert, gültig = neu, ungültig = Fehler, `entfernen` = weg. */
function ibanAus(roh: unknown, entfernen: unknown): { aendern: false } | { aendern: true; iban?: string } | Fehler {
  if (entfernen === true) return { aendern: true };
  if (roh === undefined || roh === null) return { aendern: false };
  const t = String(roh).trim();
  if (!t || t.includes('•')) return { aendern: false };
  if (!ibanGueltig(t)) return nein(400, 'Die IBAN stimmt nicht (Aufbau oder Prüfziffer) — nichts gespeichert.');
  return { aendern: true, iban: ibanGrundform(t) };
}

type KontoFelder = Partial<Pick<RegisterKonto, 'name' | 'art' | 'ort' | 'person' | 'bank'>> & { iban?: string | null };

/** Stammfelder eines Kontos prüfen (neu: Name/Art/Ort Pflicht). */
function felderPruefen(roh: Record<string, unknown>, neu: boolean, ctx: Kontext): { ok: true; f: KontoFelder; ibanNeu: boolean } | Fehler {
  const f: KontoFelder = {};
  const name = textAus(roh.name, GRENZEN.name);
  if (name === '\u0000') return nein(413, `Name zu lang (höchstens ${GRENZEN.name} Zeichen) — nicht gekürzt.`);
  if (name !== undefined) { if (!name) return nein(400, 'Name des Kontos fehlt.'); f.name = name; }
  else if (neu) return nein(400, 'Name des Kontos fehlt.');
  if (roh.art !== undefined) { if (!KONTO_ARTEN.includes(roh.art as KontoArt)) return nein(400, `Art unbekannt — erlaubt: ${KONTO_ARTEN.join(', ')}.`); f.art = roh.art as KontoArt; }
  else if (neu) f.art = 'giro';
  if (roh.ort !== undefined) { if (!istKontoOrt(roh.ort)) return nein(400, 'Zuordnung unbekannt — privat, gemeinsam oder eine Gesellschaft.'); f.ort = roh.ort; }
  else if (neu) return nein(400, 'Zuordnung fehlt (privat, gemeinsam oder eine Gesellschaft).');
  if (roh.person !== undefined) {
    if (roh.person === null || roh.person === '') f.person = undefined;
    else if (typeof roh.person !== 'string' || !ctx.personen.includes(roh.person)) return nein(400, 'Diese Person gehört nicht zum Haushalt.');
    else f.person = roh.person;
  }
  const bank = textAus(roh.bank, GRENZEN.bank);
  if (bank === '\u0000') return nein(413, `Bankname zu lang (höchstens ${GRENZEN.bank} Zeichen) — nicht gekürzt.`);
  if (bank !== undefined) f.bank = bank || undefined;
  const ib = ibanAus(roh.iban, roh.ibanEntfernen);
  if ('ok' in ib) return ib;
  if (ib.aendern) f.iban = ib.iban ?? null;
  return { ok: true, f, ibanNeu: ib.aendern };
}

/** Darf diese Sicht den Ort beschreiben? Business nur die Business-Gesellschaften (fremde Konten → 403). */
const darfOrt = (ort: KontoOrt, sicht: KontenSicht) => sichtbarIn({ ort }, sicht);
const VERBOTEN = 'Nicht erlaubt: Aus dem Business-Bereich werden nur Konten der Business-Gesellschaften geändert — nichts gespeichert.';

/**
 * Einzelschritte auf das Register — alles oder nichts. Je Konto mit Stand (`stand` = Fassung, die der Browser kannte; veraltet → 409).
 * Konten fremder Sichten sind für Business unsichtbar (404 wie „gibt es nicht“ wäre ein Hinweis auf die Existenz — wir antworten 403
 * ohne Inhalt, wenn die Kennung existiert, und 404 sonst; beides nennt keine Werte).
 */
export function registerAnwenden(alt: KontenRegister, ops: readonly KontoOp[], ctx: Kontext): Ergebnis {
  if (ops.length > GRENZEN.ops) return nein(413, `Höchstens ${GRENZEN.ops} Schritte auf einmal — nichts gespeichert.`);
  const konten = alt.konten.map(k => ({ ...k, staende: [...k.staende] }));
  const neu: string[] = [];
  const geaendert = new Map<string, Set<string>>();
  const orte = new Set<KontoOrt>();
  const merke = (id: string, ...felder: string[]) => { const s = geaendert.get(id) ?? new Set<string>(); for (const f of felder) s.add(f); geaendert.set(id, s); };
  const vorher = new Map(alt.konten.map(k => [k.id, k]));
  const finde = (id: unknown, stand: unknown): RegisterKonto | Fehler => {
    const k = typeof id === 'string' ? konten.find(x => x.id === id) : undefined;
    if (!k) return nein(404, 'Das Konto gibt es nicht (mehr).');
    if (!darfOrt(k.ort, ctx.sicht)) return nein(403, VERBOTEN);
    const v = vorher.get(k.id);
    if (stand !== undefined && v && ctx.fassung(v) !== stand) return nein(409, 'Inzwischen hat jemand das Konto geändert — der aktuelle Stand ist geladen, bitte noch einmal.', { id: k.id });
    return k;
  };
  for (const o of ops) {
    if (!o || typeof o !== 'object') return nein(400, 'Unbekannter Schritt.');
    if (o.op === 'konto-neu') {
      if (konten.length >= GRENZEN.konten) return nein(413, `Höchstens ${GRENZEN.konten} Konten — erst archivierte aufräumen geht nicht (Historie bleibt); bitte melden. Nichts gespeichert.`);
      const p = felderPruefen((o.konto ?? {}) as Record<string, unknown>, true, ctx);
      if (!p.ok) return p;
      const ort = p.f.ort!;
      if (!darfOrt(ort, ctx.sicht)) return nein(403, VERBOTEN);
      const k: RegisterKonto = {
        id: neueKennung('kt'), name: p.f.name!, art: p.f.art ?? 'giro', ort,
        ...(ort === 'privat' && p.f.person ? { person: p.f.person } : {}),
        ...(p.f.bank ? { bank: p.f.bank } : {}), ...(p.f.iban ? { iban: p.f.iban } : {}),
        staende: [], angelegtVon: ctx.person, angelegtAm: ctx.jetzt,
      };
      if (o.stand0 && typeof o.stand0 === 'object') {
        const s = standPruefen(o.stand0 as Record<string, unknown>, ctx.heute);
        if (!s.ok) return s;
        k.staende.push({ id: neueKennung('ks'), betrag: s.betrag, datum: s.datum, quelle: 'hand', erfasstVon: ctx.person, erfasstAm: ctx.jetzt, herkunft: { art: 'konten' }, ...(s.notiz ? { notiz: s.notiz } : {}) });
      }
      konten.push(k); neu.push(k.id); orte.add(ort);
      continue;
    }
    // Stammdaten ändern und archivieren nur mit der Fassung, die der Browser kannte (sonst überschriebe er still eine fremde Änderung);
    // Stände anhängen/zurücknehmen geht auch ohne — die Historie wächst nur.
    if ((o.op === 'konto-aendern' || o.op === 'archivieren') && typeof o.stand !== 'string') return nein(400, 'Stand (Fassung) fehlt — bitte neu laden.');
    const k = finde((o as { id?: unknown }).id, (o as { stand?: unknown }).stand);
    if ('ok' in k) return k;
    if (o.op === 'konto-aendern') {
      const p = felderPruefen((o.felder ?? {}) as Record<string, unknown>, false, ctx);
      if (!p.ok) return p;
      if (p.f.ort && !darfOrt(p.f.ort, ctx.sicht)) return nein(403, VERBOTEN);
      orte.add(k.ort);
      for (const [feld, wert] of Object.entries(p.f) as [keyof KontoFelder, unknown][]) {
        if (feld === 'iban') { if (wert === null) delete k.iban; else k.iban = wert as string; merke(k.id, 'iban'); continue; }
        if (wert === undefined) { if (k[feld as keyof RegisterKonto] !== undefined) { delete (k as unknown as Record<string, unknown>)[feld]; merke(k.id, feld); } continue; }
        if ((k as unknown as Record<string, unknown>)[feld] !== wert) { (k as unknown as Record<string, unknown>)[feld] = wert; merke(k.id, feld); }
      }
      if (k.ort !== 'privat' && k.person) { delete k.person; merke(k.id, 'person'); }
      orte.add(k.ort);
      if (geaendert.has(k.id)) k.geaendertAm = ctx.jetzt;
      continue;
    }
    if (o.op === 'stand-neu') {
      if (k.staende.length >= GRENZEN.staende) return nein(413, `Höchstens ${GRENZEN.staende} Stände je Konto — nichts gespeichert.`);
      const s = standPruefen(o, ctx.heute);
      if (!s.ok) return s;
      k.staende.push({ id: neueKennung('ks'), betrag: s.betrag, datum: s.datum, quelle: 'hand', erfasstVon: ctx.person, erfasstAm: ctx.jetzt, herkunft: { art: 'konten' }, ...(s.notiz ? { notiz: s.notiz } : {}) });
      merke(k.id, 'staende'); orte.add(k.ort);
      continue;
    }
    if (o.op === 'stand-zuruecknehmen') {
      const s = k.staende.find(x => x.id === o.standId);
      if (!s) return nein(404, 'Den Stand gibt es nicht.');
      if (s.zurueckgenommenAm) continue;   // schon zurückgenommen — idempotent
      const i = k.staende.indexOf(s);
      k.staende[i] = { ...s, zurueckgenommenAm: ctx.jetzt, zurueckgenommenVon: ctx.person };
      merke(k.id, 'staende'); orte.add(k.ort);
      continue;
    }
    if (o.op === 'archivieren') {
      if (o.aus) { if (k.archiviertAm) { delete k.archiviertAm; merke(k.id, 'archiviertAm'); } }
      else if (!k.archiviertAm) { k.archiviertAm = ctx.jetzt; merke(k.id, 'archiviertAm'); }
      orte.add(k.ort);
      continue;
    }
    return nein(400, 'Unbekannter Schritt.');
  }
  return {
    ok: true, register: { ...alt, konten }, neu,
    geaendert: Array.from(geaendert, ([id, s]) => ({ id, felder: Array.from(s).sort() })),
    orte: Array.from(orte),
  };
}

// ── Andockstellen: bisherige Schreibwege und später die Bank ─────────────────────────────────────────────────────────────────────

/**
 * Das Konto einer Gesellschaft, in das ein bisheriger Schreibweg (Liquidität-Kontostand, 0-Punkt, ZOE) schreibt: das verknüpfte
 * (`alt.liquiditaet`), sonst das einzige aktive Kassen-Konto dieser Gesellschaft — sonst keins (mehrdeutig → der Aufrufer schreibt nicht).
 */
export function zielKontoFuer(r: KontenRegister, g: Gesellschaftskennung): RegisterKonto | null {
  const verknuepft = r.konten.find(k => aktiv(k) && k.alt?.liquiditaet === g);
  if (verknuepft) return verknuepft;
  const kasse = r.konten.filter(k => kassenKonto(k) && k.ort === g);
  return kasse.length === 1 ? kasse[0] : null;
}

/** Einen Stand an ein Konto hängen (rein). Gleicher Betrag + Datum + Herkunft schon da (nicht zurückgenommen) → unverändert (idempotent). */
export function standAnhaengen(r: KontenRegister, kontoId: string, s: Omit<KontoStand, 'id'>): { register: KontenRegister; neu: boolean } {
  const konten = r.konten.map(k => {
    if (k.id !== kontoId) return k;
    const da = k.staende.some(x => !x.zurueckgenommenAm && x.betrag === s.betrag && x.datum === s.datum && x.herkunft?.art === s.herkunft?.art && x.herkunft?.id === s.herkunft?.id);
    return da ? k : { ...k, staende: [...k.staende, { id: neueKennung('ks'), ...s }] };
  });
  const neu = konten.some((k, i) => k !== r.konten[i]);
  return { register: neu ? { ...r, konten } : r, neu };
}

/** Alle Stände mit dieser Herkunft zurücknehmen (z. B. ein zurückgenommener 0-Punkt). */
export function herkunftZuruecknehmen(r: KontenRegister, art: StandHerkunft, id: string, von: string, jetzt: string): { register: KontenRegister; anzahl: number } {
  let anzahl = 0;
  const konten = r.konten.map(k => {
    if (!k.staende.some(s => s.herkunft?.art === art && s.herkunft.id === id && !s.zurueckgenommenAm)) return k;
    return { ...k, staende: k.staende.map(s => (s.herkunft?.art === art && s.herkunft.id === id && !s.zurueckgenommenAm ? (anzahl++, { ...s, zurueckgenommenAm: jetzt, zurueckgenommenVon: von }) : s)) };
  });
  return { register: anzahl ? { ...r, konten } : r, anzahl };
}

/**
 * Ein neuer 0-Punkt löst frühere 0-Punkte derselben Gesellschaft ab (es gilt immer der zuletzt gesetzte, nicht der mit dem spätesten Stichtag):
 * deren Stände im Register werden zurückgenommen (bleiben in der Historie).
 */
export function andereEroeffnungenZuruecknehmen(r: KontenRegister, ort: Gesellschaftskennung, behalten: string, von: string, jetzt: string): { register: KontenRegister; anzahl: number } {
  let anzahl = 0;
  const konten = r.konten.map(k => {
    if (k.ort !== ort || !k.staende.some(s => s.herkunft?.art === 'eroeffnung' && s.herkunft.id !== behalten && !s.zurueckgenommenAm)) return k;
    return { ...k, staende: k.staende.map(s => (s.herkunft?.art === 'eroeffnung' && s.herkunft.id !== behalten && !s.zurueckgenommenAm ? (anzahl++, { ...s, zurueckgenommenAm: jetzt, zurueckgenommenVon: von }) : s)) };
  });
  return { register: anzahl ? { ...r, konten } : r, anzahl };
}

// ── Übernahme der bisherigen Stände (nur per Klick: Vorschau → Bestätigen) ─────────────────────────────────────────────────────────

/** Die bisherigen Quellen, so wie der Server sie liest. */
export interface Quellen {
  /** Liquidität: Firmen-Konten des Finanzplans (nur im Haushalt des Inhabers). */
  firmen: { id: string; name?: string; bank?: string; kontostand?: number | null; stand?: string | null }[];
  /** 0-Punkt: die geltende Eröffnung je Business-Gesellschaft (nur im Haushalt des Inhabers). */
  eroeffnungen: { id: string; firma: Gesellschaftskennung; stichtag: string; kontostand: number }[];
  /** Finanzplanung: Posten „Konto“ (Einheit im Kern-Vokabular). */
  posten: { id: string; einheit: string; name: string; betrag: number | null }[];
  /** Haushalt: Konten (Stammdaten, ohne Stände). */
  haushaltKonten: { id: string; name: string; inhaber: string | null; einheit: string; bank: string | null; aktiv: boolean }[];
  /** Für „Kevin“/„Malin“/… im Haushalt: Name → Speichername. */
  personNachName: (name: string) => string | null;
}

export interface UebernahmePunkt {
  /** Stabile Kennung des Punkts (für die Bestätigung). */
  schluessel: string;
  quelle: 'liquiditaet' | 'eroeffnung' | 'finanzplanung' | 'haushalt';
  ort: KontoOrt;
  person?: string;
  /** Konto im Register: vorhandenes (`kontoId`) oder neues mit `name`. */
  kontoId?: string;
  name: string;
  art: KontoArt;
  bank?: string;
  betrag?: number;
  datum?: string;
  /** Datum unbekannt (Posten der Finanzplanung tragen keins) — dann gilt heute. */
  datumUnbekannt?: true;
  alt: NonNullable<RegisterKonto['alt']>;
  herkunftId?: string;
}
export interface UebernahmePlan { punkte: UebernahmePunkt[]; nicht: { quelle: string; name: string; grund: string }[] }

const normName = (s: string) => s.normalize('NFC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').replace(/[()]/g, '').trim();
const ortAusKernEinheit = (e: string): KontoOrt | null => (e === 'selbststaendigkeit' ? 'kdc' : e === 'privat' ? 'privat' : istGesellschaft(e) ? e : null);

/**
 * Was die Übernahme anlegen würde — rein, schreibt nichts. Je Gesellschaft, die das Register noch NICHT regiert: Liquidität-Kontostand und
 * 0-Punkt als Stände EINES Kontos „Geschäftskonto“ (der jüngere gilt — wie bisher `kontoQuelle`); Posten „Konto“ der Planung nur, wenn die
 * Gesellschaft sonst keinen Stand hat (sonst doppelt gezählt). Privat (solange das Register Privat nicht regiert): jeder Posten „Konto“ ein Konto;
 * Konten des Haushalts als Konten ohne Stand (gleicher Name → dasselbe Konto). Schon Verknüpftes kommt nie zweimal.
 */
export function uebernahmePlan(r: KontenRegister, q: Quellen, sicht: KontenSicht, heute: string): UebernahmePlan {
  const punkte: UebernahmePunkt[] = [];
  const nicht: UebernahmePlan['nicht'] = [];
  const verknuepft = (pruefe: (a: NonNullable<RegisterKonto['alt']>) => boolean) => r.konten.some(k => k.alt && pruefe(k.alt));
  const regiertG = (g: Gesellschaftskennung) => regiert(r.konten, o => o === g);
  const geschaeftskonto = (g: Gesellschaftskennung) => r.konten.find(k => aktiv(k) && k.alt?.liquiditaet === g);

  for (const g of GESELLSCHAFTEN) {
    if (!darfOrt(g, sicht)) continue;
    if (regiertG(g)) {
      const f = q.firmen.find(x => x.id === g);
      if (typeof f?.kontostand === 'number') nicht.push({ quelle: 'Liquidität', name: f.name || finanzOrtName(g), grund: 'das Register führt diese Gesellschaft schon' });
      continue;
    }
    const f = q.firmen.find(x => x.id === g);
    const e = q.eroeffnungen.find(x => x.firma === g);
    const vorhanden = geschaeftskonto(g);
    const basis = { ort: g as KontoOrt, ...(vorhanden ? { kontoId: vorhanden.id } : {}), name: vorhanden?.name ?? `Geschäftskonto ${finanzOrtName(g)}`, art: 'giro' as KontoArt, ...(f?.bank ? { bank: f.bank } : {}), alt: { liquiditaet: g } };
    let mitStand = false;
    if (typeof f?.kontostand === 'number' && Number.isFinite(f.kontostand)) {
      const datum = f.stand && istKalendertag(f.stand) && f.stand <= heute ? f.stand : heute;
      punkte.push({ schluessel: `liq:${g}`, quelle: 'liquiditaet', ...basis, betrag: cent(f.kontostand), datum, ...(datum !== f.stand ? { datumUnbekannt: true as const } : {}) });
      mitStand = true;
    }
    if (e && e.stichtag > heute) nicht.push({ quelle: '0-Punkt', name: finanzOrtName(g), grund: 'der Stichtag liegt in der Zukunft — der 0-Punkt gilt weiter wie bisher' });
    else if (e) {
      punkte.push({ schluessel: `er:${e.id}`, quelle: 'eroeffnung', ...basis, betrag: cent(e.kontostand), datum: e.stichtag, herkunftId: e.id });
      mitStand = true;
    }
    // Posten „Konto“ der Planung für diese Gesellschaft.
    for (const p of q.posten.filter(x => ortAusKernEinheit(x.einheit) === g)) {
      if (verknuepft(a => a.posten === p.id)) continue;
      if (mitStand) { nicht.push({ quelle: 'Finanzplanung', name: p.name, grund: 'die Gesellschaft hat schon einen Stand aus Liquidität bzw. 0-Punkt — sonst doppelt gezählt' }); continue; }
      punkte.push({ schluessel: `po:${p.id}`, quelle: 'finanzplanung', ort: g, name: p.name, art: 'giro', alt: { posten: p.id }, ...(typeof p.betrag === 'number' ? { betrag: cent(p.betrag), datum: heute, datumUnbekannt: true as const } : {}) });
    }
  }

  if (sicht === 'privat') {
    const privatRegiert = regiert(r.konten, istPrivatOrt);
    const namen = new Map<string, UebernahmePunkt>();
    if (privatRegiert) {
      for (const p of q.posten.filter(x => ortAusKernEinheit(x.einheit) === 'privat' && !verknuepft(a => a.posten === x.id))) nicht.push({ quelle: 'Finanzplanung', name: p.name, grund: 'das Register führt die Privat-Konten schon' });
    } else {
      // Ein altes Konto „Privat“ im Finanzplan der Firmen (vor der Entflechtung) — sein Kontostand ist ein Privat-Stand.
      const fp = q.firmen.find(x => x.id === 'privat');
      if (typeof fp?.kontostand === 'number' && Number.isFinite(fp.kontostand)) {
        const datum = fp.stand && istKalendertag(fp.stand) && fp.stand <= heute ? fp.stand : heute;
        const pt: UebernahmePunkt = { schluessel: 'liq:privat', quelle: 'liquiditaet', ort: 'privat', name: fp.name || 'Privat', art: 'giro', ...(fp.bank ? { bank: fp.bank } : {}), alt: {}, betrag: cent(fp.kontostand), datum, ...(datum !== fp.stand ? { datumUnbekannt: true as const } : {}) };
        if (!r.konten.some(k => k.staende.some(st => st.herkunft?.id === 'liq:privat'))) { punkte.push(pt); namen.set(normName(pt.name), pt); }
      }
      for (const p of q.posten.filter(x => ortAusKernEinheit(x.einheit) === 'privat')) {
        if (verknuepft(a => a.posten === p.id)) continue;
        const pt: UebernahmePunkt = { schluessel: `po:${p.id}`, quelle: 'finanzplanung', ort: 'privat', name: p.name, art: 'giro', alt: { posten: p.id }, ...(typeof p.betrag === 'number' ? { betrag: cent(p.betrag), datum: heute, datumUnbekannt: true as const } : {}) };
        punkte.push(pt); namen.set(normName(p.name), pt);
      }
    }
    for (const h of q.haushaltKonten.filter(x => x.aktiv)) {
      if (verknuepft(a => a.haushaltKonto === h.id)) continue;
      const ort: KontoOrt = istGesellschaft(h.einheit) ? h.einheit : (h.inhaber ?? '').toLocaleLowerCase('de-DE') === 'gemeinsam' ? 'gemeinsam' : 'privat';
      if (istGesellschaft(ort) && regiertG(ort)) continue;
      const person = ort === 'privat' && h.inhaber ? q.personNachName(h.inhaber) ?? undefined : undefined;
      const gleich = namen.get(normName(h.name));
      if (gleich && gleich.ort === ort) { gleich.alt = { ...gleich.alt, haushaltKonto: h.id }; if (person) gleich.person = person; if (h.bank) gleich.bank = h.bank; continue; }
      punkte.push({ schluessel: `hh:${h.id}`, quelle: 'haushalt', ort, ...(person ? { person } : {}), name: h.name, art: 'giro', ...(h.bank ? { bank: h.bank } : {}), alt: { haushaltKonto: h.id } });
    }
  }
  return { punkte, nicht };
}

/** Die Übernahme anwenden (rein): Konten anlegen bzw. ergänzen, Stände anhängen (Herkunft „uebernahme“ + Quelle), nichts überschreiben. */
export function uebernahmeAnwenden(r: KontenRegister, plan: UebernahmePlan, ctx: Pick<Kontext, 'person' | 'jetzt'>): { register: KontenRegister; konten: number; staende: number } {
  const konten = r.konten.map(k => ({ ...k, staende: [...k.staende] }));
  let neuKonten = 0, neuStaende = 0;
  const neuNachSchluessel = new Map<string, RegisterKonto>();
  for (const p of plan.punkte) {
    // Liquidität und 0-Punkt derselben Gesellschaft landen auf EINEM Konto (gleiches `alt.liquiditaet`).
    const gruppe = p.alt.liquiditaet ? `g:${p.alt.liquiditaet}` : p.schluessel;
    let k = p.kontoId ? konten.find(x => x.id === p.kontoId) : neuNachSchluessel.get(gruppe);
    if (!k) {
      k = { id: neueKennung('kt'), name: p.name, art: p.art, ort: p.ort, ...(p.person ? { person: p.person } : {}), ...(p.bank ? { bank: p.bank } : {}), alt: { ...p.alt }, staende: [], angelegtVon: ctx.person, angelegtAm: ctx.jetzt };
      konten.push(k); neuNachSchluessel.set(gruppe, k); neuKonten++;
    } else {
      k.alt = { ...(k.alt ?? {}), ...p.alt };
      if (!k.bank && p.bank) k.bank = p.bank;
    }
    if (typeof p.betrag === 'number' && p.datum) {
      const herkunft: KontoStand['herkunft'] = p.quelle === 'eroeffnung' ? { art: 'eroeffnung', id: p.herkunftId } : { art: 'uebernahme', id: p.schluessel };
      if (!k.staende.some(s => s.herkunft?.art === herkunft.art && s.herkunft.id === herkunft.id)) {
        k.staende.push({ id: neueKennung('ks'), betrag: p.betrag, datum: p.datum, quelle: 'hand', erfasstVon: ctx.person, erfasstAm: ctx.jetzt, herkunft, ...(p.datumUnbekannt ? { notiz: 'übernommen — Datum unbekannt, heute angenommen' } : {}) });
        neuStaende++;
      }
    }
  }
  const eintrag = { am: ctx.jetzt, von: ctx.person, anzahl: plan.punkte.length };
  return { register: { ...r, konten, uebernahme: [...(r.uebernahme ?? []), eintrag] }, konten: neuKonten, staende: neuStaende };
}

/** Business-Gesellschaften (für Auswahlen in der Business-Sicht). */
export const orteFuerSicht = (sicht: KontenSicht): KontoOrt[] => (sicht === 'business' ? [...BUSINESS_GESELLSCHAFTEN] : [...KONTO_ORTE]);
