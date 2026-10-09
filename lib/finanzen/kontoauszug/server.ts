// ─── Kontoauszug einlesen — Server: Vorschau, Übernahme, Rückgängig (09.10.) ───────────────────────────────────────────────────────────
// Kevin 08.10.: „Bank-Anbindung vorziehen“; R3: bis dahin von Hand. ONBOARDING_PLAN.md › B9 d (+ L7/L8/L32): ein Kontoauszug (CAMT.053 oder CSV)
// wird EINEM Konto des Konten-Registers zugeordnet — Saldo als Stand (`quelle: 'bank'`), Umsätze als Buchungen des Bereichs. Immer:
//   Vorschau (schreibt nichts) → Übernehmen (nur mit der `basis` genau dieser Vorschau, sonst 409) → Rückgängig (nur seitdem Unverändertes).
//
// Schreibwege (nie daneben):
//   • Saldo  → lib/finanzen/konten/server.ts `standAusAuszug` (EINE Schreibstelle des Registers, mit Rückweg-Spiegel),
//   • Haushalt → `aendereBuchungen`/`aendereStamm` (lib/finanzen/haushalt/speicher.ts, wie der bisherige Import),
//   • Business → Bestand `buchungen` in seiner Sperre (wie Rechnung „bezahlt“ `bu-re-<id>` und Beleg übernehmen), Kennungen `bu-ka-…`.
// Mehrere Bestände nacheinander → Absichtsprotokoll (Art `kontoauszug`, lib/store/absichten.ts): jeder Schritt idempotent, Wiederaufnahme beim
// Start/im Takt. Das Lauf-Protokoll `kontoauszug-laeufe--<haushalt>` hält NUR Kennungen, Fingerabdrücke und Zahlen — nie Namen, Zwecke, IBANs.
// Die Datei selbst wird nie gespeichert (Auszüge tragen Namen Dritter); sie kommt zum Übernehmen noch einmal mit.

import { randomUUID } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { absichtAbschliessen, absichtBeginnen, mitVorgang, type Absicht } from '@/lib/store/absichten';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';
import { ibanGrundform } from '@/lib/crm/zahlung';
import { finanzOrtAus, finanzOrtName, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';
import { ladeRegister, standAusAuszug, auszugStandZuruecknehmen, haushaltKontoVerknuepfen, firmaVorAuszug, firmaVorherHerstellen, type FirmaVorher } from '@/lib/finanzen/konten/server';
import { istPrivatOrt, ortName, regiert, sichtbarIn, ZUR_KASSE, type KontenSicht, type KontoOrt, type RegisterKonto } from '@/lib/finanzen/konten/register';
import { ladeHaushalt, aendereStamm, aendereBuchungen } from '@/lib/finanzen/haushalt/speicher';
import type { Buchung as HaushaltBuchung, Konto as HaushaltKonto } from '@/lib/finanzen/haushalt/typen';
import { auszugLesen } from './lesen';
import { centZuEuro, vergleichsText } from './text';
import {
  auszugZuordnen, planBauen, planHatWirkung, businessZeilen, haushaltZeilen, fpBusiness, fpHaushalt, zielSatz, BUSINESS_PRAEFIX, kontoMarke, offeneHinweise,
  type BusinessBuchung, type OffenerPostenKurz, type Plan, type PlanZeile, type Ziel,
} from './plan';
import type { Auszug, CsvInfo, Pruefsumme } from './typen';

// ── Lauf-Protokoll ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Bestand je Haushalt (ausgeschrieben, damit der Register-Wächter den Namen findet). */
export function laeufeName(haushalt: string): string {
  if (!HAUSHALT.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `kontoauszug-laeufe--${haushalt}`;
}
/** Abgeschlossene Läufe fallen nach so vielen Tagen beim nächsten Schreiben weg (danach kein Rückgängig mehr — die Buchungen bleiben). */
export const LAUF_HALTEN_TAGE = 400;

export type LaufStatus = 'laeuft' | 'uebernommen' | 'zurueckgenommen' | 'teilweise';
export interface AuszugLauf {
  /** `ka-<uuid>` */
  id: string;
  kontoId: string;
  ort: KontoOrt;
  ziel: 'haushalt' | 'business' | 'keins';
  /** Das Haushalts-Konto der Buchungen (bei `neu` vom Lauf angelegt — bleibt beim Rückgängig bestehen). */
  haushaltKonto?: { id: string; neu: boolean };
  format: 'camt' | 'csv';
  /** ISO-Zeitpunkt. */
  am: string;
  /** Speichername der Person. */
  von: string;
  zeitraum: { von: string; bis: string } | null;
  zahlen: { gelesen: number; neu: number; vorhanden: number; uebersprungen: number };
  /** Die angelegten Buchungen: Kennung + Fingerabdruck beim Anlegen (Rückgängig nur, solange er gleich ist). */
  buchungen: { id: string; fp: string }[];
  /** Der Saldo-Stand dieses Laufs im Register (Kennung). */
  standId?: string;
  /**
   * Umsätze, die schon als Rechnung bezahlt, Beleg oder von Hand gebucht waren (09.10., lib/finanzen/zahlung-abgleich.ts): Kennung der vorhandenen
   * Buchung + Fingerabdruck des Umsatz-Schlüssels — nichts angelegt; so schluckt dieselbe Buchung nie einen zweiten Umsatz. „Rückgängig“ leert die Liste.
   */
  abgeglichen?: { id: string; k: string }[];
  /**
   * Kontostand der Gesellschaft im Finanzplan vor diesem Lauf (nur Zahlen) — nur, wenn erst dieser Saldo das Register zur Quelle machte (09.10.):
   * „Rückgängig“ stellt ihn wieder her (sonst stünde der Kontostand danach auf „unbekannt“).
   */
  firmaVorher?: FirmaVorher;
  status: LaufStatus;
  zurueck?: { am: string; von: string; entfernt: number; konflikte: number; schonWeg: number; standZurueck: number };
}
interface LaeufeDatei { v: 1; laeufe: AuszugLauf[] }

const laeufeAus = (cur: Partial<LaeufeDatei> | null) => (Array.isArray(cur?.laeufe) ? cur!.laeufe : []);

async function laeufeAendern(haushalt: string, f: (l: AuszugLauf[]) => AuszugLauf[], jetzt = new Date()): Promise<void> {
  const grenze = jetzt.getTime() - LAUF_HALTEN_TAGE * 864e5;
  await updateJson<LaeufeDatei>(laeufeName(haushalt), cur => {
    const alt = laeufeAus(cur);
    const neu = f(alt.map(l => ({ ...l }))).filter(l => l.status === 'laeuft' || Date.parse(l.am) >= grenze);
    return JSON.stringify(neu) === JSON.stringify(alt) && cur ? cur : { v: 1, laeufe: neu };
  });
}

export async function laeufeLaden(haushalt: string): Promise<AuszugLauf[]> {
  return laeufeAus(await loadJson<LaeufeDatei>(laeufeName(haushalt)));
}

/** Läufe eines Kontos in der Sicht (Business sieht nur Läufe der Business-Konten) — nur Kennungen und Zahlen, jüngste zuerst. */
export async function laeufeFuerKonto(haushalt: string, kontoId: string, sicht: KontenSicht): Promise<AuszugLauf[] | null> {
  const k = (await ladeRegister(haushalt)).konten.find(x => x.id === kontoId);
  if (!k || !sichtbarIn(k, sicht)) return null;
  return (await laeufeLaden(haushalt)).filter(l => l.kontoId === kontoId).sort((a, b) => b.am.localeCompare(a.am));
}

// ── Vorschau ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Kontext { haushalt: string; person: string; sicht: KontenSicht; jetzt?: Date }

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413 | 415; fehler: string; csv?: Omit<CsvInfo, 'beispiel'>; anderesKonto?: { id: string; name: string }; pruefung?: Pruefsumme | null };

type HaushaltDaten = Awaited<ReturnType<typeof ladeHaushalt>>;
interface Vorbereitet {
  ok: true;
  plan: Plan;
  konto: RegisterKonto;
  auszug: Auszug;
  format: 'camt' | 'csv';
  csv?: CsvInfo;
  eigeneIbans: Set<string>;
  haushaltKontoNeu?: HaushaltKonto;
  /** Die bisherige Verknüpfung zeigt auf ein Haushalts-Konto, das es nicht mehr gibt — sie wird ersetzt. */
  toteVerknuepfung?: string;
  haushaltStamm?: { regeln: HaushaltDaten['stamm']['regeln']; kategorien: { id: string; name: string }[] };
}

/**
 * Was die Liquidität für diese Gesellschaft noch als offen zählt: Rechnungen (gestellt, nicht bezahlt/storniert), offene Zahlungen und die offenen
 * Posten des 0-Punkts — dieselbe Sicht wie die Liquidität (`mitEroeffnung`: vor dem 0-Punkt Archiviertes zählt nicht).
 */
async function offenePosten(ort: Gesellschaftskennung): Promise<OffenerPostenKurz[]> {
  try {
    const { mitEroeffnung } = await import('@/lib/business/eroeffnung-server');
    type R = { id: string; firmaId?: string; kunde: string; betrag: number; status: string; nummer?: string; datum?: string; art?: string; eroeffnung?: true };
    type Z = { id: string; firmaId?: string; an: string; betrag: number; status: string; eroeffnung?: true };
    const fp = await loadJson<{ rechnungen?: R[]; zahlungen?: Z[] }>('finanzplan');
    const b = await mitEroeffnung({ rechnungen: fp?.rechnungen ?? [], zahlungen: fp?.zahlungen ?? [] });
    const meine = (f?: string) => (istGesellschaft(f) ? f : finanzOrtAus(f)) === ort;
    return [
      ...(b.rechnungen ?? []).filter(r => meine(r.firmaId) && r.art !== 'storno' && !['geplant', 'bezahlt', 'storniert'].includes(r.status) && r.betrag > 0)
        .map(r => ({ art: r.eroeffnung ? 'forderung' as const : 'rechnung' as const, name: r.kunde, cent: Math.round(r.betrag * 100), ...(r.nummer ? { nummer: r.nummer } : {}), ...(r.datum ? { datum: r.datum } : {}) })),
      ...(b.zahlungen ?? []).filter(z => meine(z.firmaId) && z.status === 'offen' && z.betrag > 0)
        .map(z => ({ art: z.eroeffnung ? 'verbindlichkeit' as const : 'zahlung' as const, name: z.an, cent: -Math.round(z.betrag * 100) })),
    ];
  } catch (err) { console.error('[kontoauszug] offene Posten nicht lesbar:', err instanceof Error ? err.message : err); return []; }
}

/**
 * Übergang zum Konten-Register sichtbar machen: führt das Register die Gesellschaft noch nicht, macht dieser Saldo es zur Quelle — der bisher von
 * Hand gepflegte Kontostand gilt dann nicht mehr, und weitere Kassen-Konten dieser Gesellschaft ohne Stand zählen bis zu ihrem ersten Stand mit 0 €.
 */
function uebergangHinweise(p: Plan, konto: RegisterKonto, alle: readonly RegisterKonto[]): string[] {
  if (p.saldo?.status !== 'neu' || !istGesellschaft(konto.ort) || !ZUR_KASSE[konto.art] || regiert(alle, o => o === konto.ort)) return [];
  const ohne = alle.filter(k => k.id !== konto.id && k.ort === konto.ort && !k.archiviertAm && ZUR_KASSE[k.art] && !k.staende.length);
  const raus = [`Mit diesem Saldo führt das Konten-Register den Kontostand von ${ortName(konto.ort)} — ein bisher von Hand gepflegter Kontostand gilt dann nicht mehr („Rückgängig“ stellt ihn wieder her).`];
  if (ohne.length) raus.push(`${ohne.length} weitere${ohne.length === 1 ? 's Konto' : ' Konten'} von ${ortName(konto.ort)} ${ohne.length === 1 ? 'hat' : 'haben'} noch keinen Stand — bis dahin ${ohne.length === 1 ? 'zählt es' : 'zählen sie'} mit 0 €. Bitte dort einen Stand eintragen.`);
  return raus;
}

/**
 * Privat: führt das Register die Privat-Konten noch nicht, rechnet die Finanzplanung mit ihren eigenen Kontoständen (Posten „Konto“). Ab diesem
 * Saldo zählen nur noch die Konten im Register — was dort fehlt, fiele still aus Runway und „frei“ heraus.
 */
async function privatPlanHinweis(haushalt: string, alle: readonly RegisterKonto[]): Promise<string[]> {
  try {
    const plan = await loadJson<{ posten?: { id?: string; art?: string; einheit?: string; betrag?: number | null }[] }>(`finanzen-plan--${haushalt}`);
    const verknuepft = new Set(alle.map(k => k.alt?.posten).filter(Boolean));
    const fehlen = (plan?.posten ?? []).filter(x => x?.art === 'konto' && x.einheit === 'privat' && typeof x.betrag === 'number' && !verknuepft.has(x.id));
    if (!fehlen.length) return [];
    const summe = Math.round(fehlen.reduce((t, x) => t + (x.betrag ?? 0), 0) * 100) / 100;
    return [`Die Finanzplanung rechnet Privat bisher mit ${fehlen.length === 1 ? 'einem eigenen Kontostand' : `${fehlen.length} eigenen Kontoständen`} (zusammen ${summe.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €). Ab diesem Saldo zählen nur noch die Konten im Konten-Register — die übrigen bitte dort anlegen bzw. „Übernehmen“, sonst fehlen sie in Runway und „frei“.`];
  } catch { return []; }
}

/** Lesen + Zuordnen (rein). */
function planEingang(bytes: Uint8Array, spalten: unknown, konto: RegisterKonto, andere: RegisterKonto[]) {
  const l = auszugLesen(bytes, { spalten });
  if (!l.ok) return { ok: false as const, status: l.status, fehler: l.fehler, ...(l.csv ? { csv: l.csv } : {}) };
  const z = auszugZuordnen(l, { id: konto.id, name: konto.name, ...(konto.iban ? { iban: konto.iban } : {}) }, andere.map(k => ({ id: k.id, name: k.name, ...(k.iban ? { iban: k.iban } : {}) })));
  if (!z.ok) return { ok: false as const, status: z.status, fehler: z.fehler, ...(z.anderesKonto ? { anderesKonto: z.anderesKonto } : {}) };
  return { ok: true as const, auszug: z.auszug, hinweise: [...l.hinweise, ...z.hinweise], format: l.format, ...(l.format === 'csv' ? { csv: l.csv } : {}) };
}

const ohneBeispiel = (c?: CsvInfo) => { if (!c) return undefined; const { beispiel: _b, ...r } = c; return r; };
const vorname = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/**
 * Wohin die Umsätze gehen — und welches Haushalts-Konto (verknüpft, gleichnamig/gleiche IBAN-Endung oder neu). Die Gesellschaften gehören dem
 * Haushalt des Inhabers: ein anderer Haushalt bekommt für ein Gesellschafts-Konto nur den Saldo.
 */
async function zielBestimmen(ctx: Kontext, konto: RegisterKonto, neueId: string, hh: HaushaltDaten | null): Promise<{ ziel: Ziel; neu?: HaushaltKonto; tot?: string }> {
  if (istPrivatOrt(konto.ort) && hh) {
    const stamm = hh.stamm;
    const verknuepft = konto.alt?.haushaltKonto ? stamm.konten.find(k => k.id === konto.alt!.haushaltKonto) : undefined;
    const tot = konto.alt?.haushaltKonto && !verknuepft ? konto.alt.haushaltKonto : undefined;
    if (verknuepft) return { ziel: { art: 'haushalt', haushaltKontoId: verknuepft.id, kontoName: verknuepft.name, neu: false, einheit: verknuepft.einheit } };
    const suffix = konto.iban ? ibanGrundform(konto.iban).slice(-4) : null;
    const kandidaten = stamm.konten.filter(k => k.aktiv && (vergleichsText(k.name) === vergleichsText(konto.name) || (!!suffix && k.iban_suffix === suffix)));
    if (kandidaten.length === 1) return { ziel: { art: 'haushalt', haushaltKontoId: kandidaten[0].id, kontoName: kandidaten[0].name, neu: false, verknuepfen: true, einheit: kandidaten[0].einheit }, ...(tot ? { tot } : {}) };
    let inhaber: string | null = konto.ort === 'gemeinsam' ? 'gemeinsam' : null;
    if (konto.ort === 'privat' && konto.person) inhaber = vorname((await ladeKonten()).konten.find(k => k.speicher === konto.person)?.name ?? '') || null;
    const neu: HaushaltKonto = { id: neueId, stand: 1, name: konto.name.slice(0, 80), inhaber, einheit: 'privat', iban_suffix: suffix, bank: konto.bank ? konto.bank.slice(0, 60) : null, waehrung: 'EUR', aktiv: true };
    return { ziel: { art: 'haushalt', haushaltKontoId: neueId, kontoName: neu.name, neu: true, einheit: 'privat' }, neu, ...(tot ? { tot } : {}) };
  }
  if (istGesellschaft(konto.ort)) {
    if (ctx.haushalt !== await haushaltDesInhabers()) return { ziel: { art: 'keins', grund: 'Buchungen der Gesellschaften führt der Haushalt des Inhabers — aus diesem Haushalt wird nur der Saldo übernommen.' } };
    return { ziel: { art: 'business', ort: konto.ort as Gesellschaftskennung } };
  }
  return { ziel: { art: 'keins', grund: 'Für diese Zuordnung gibt es keine Buchungen — nur der Saldo wird übernommen.' } };
}

async function vorbereiten(ctx: Kontext, kontoId: unknown, bytes: Uint8Array, spalten: unknown): Promise<Vorbereitet | Fehler> {
  const register = await ladeRegister(ctx.haushalt);
  const konto = typeof kontoId === 'string' ? register.konten.find(k => k.id === kontoId) : undefined;
  if (!konto) return { ok: false, status: 404, fehler: 'Das Konto gibt es nicht (mehr).' };
  if (!sichtbarIn(konto, ctx.sicht)) return { ok: false, status: 403, fehler: 'Nicht erlaubt: Aus dem Business-Bereich werden nur Konten der Business-Gesellschaften eingelesen — nichts übernommen.' };
  if (konto.archiviertAm) return { ok: false, status: 409, fehler: 'Das Konto ist archiviert — erst wieder aktivieren, dann einlesen.' };
  const andere = register.konten.filter(k => k.id !== konto.id && sichtbarIn(k, ctx.sicht));
  const e = planEingang(bytes, spalten, konto, andere);
  if (!e.ok) return { ok: false, status: e.status, fehler: e.fehler, ...('csv' in e && e.csv ? { csv: ohneBeispiel(e.csv) } : {}), ...('anderesKonto' in e && e.anderesKonto ? { anderesKonto: e.anderesKonto } : {}) };
  const hh = istPrivatOrt(konto.ort) ? await ladeHaushalt(ctx.haushalt) : null;
  const { ziel, neu, tot } = await zielBestimmen(ctx, konto, randomUUID(), hh);
  const eigeneIbans = new Set(register.konten.filter(k => k.id !== konto.id && k.iban).map(k => ibanGrundform(k.iban)));
  const business = ziel.art === 'business' ? ((await loadJson<{ buchungen?: BusinessBuchung[] }>('buchungen'))?.buchungen ?? []) : undefined;
  const haushalt = ziel.art === 'haushalt' && hh ? { buchungen: hh.buchungen, regeln: hh.stamm.regeln, kategorien: hh.stamm.kategorien } : undefined;
  // Business (09.10.): festgehaltene Zuordnungen „schon gebucht“ aller Läufe und die Rechnungsnummern (Nummer im Verwendungszweck).
  const abgeglichen = new Map<string, string>();
  const rechnungNummern = new Map<string, string>();
  if (ziel.art === 'business') {
    for (const l of await laeufeLaden(ctx.haushalt)) if (l.status !== 'zurueckgenommen') for (const a of l.abgeglichen ?? []) if (!abgeglichen.has(a.id)) abgeglichen.set(a.id, a.k);
    for (const r of (await loadJson<{ rechnungen?: { id?: string; nummer?: string }[] }>('finanzplan'))?.rechnungen ?? []) if (r?.id && r.nummer) rechnungNummern.set(r.id, r.nummer);
  }
  const plan = planBauen({
    auszug: e.auszug, konto: { id: konto.id, name: konto.name, ...(konto.iban ? { iban: konto.iban } : {}), staende: konto.staende }, ziel,
    ...(business ? { business, abgeglichen, rechnungNummern } : {}), ...(haushalt ? { haushalt } : {}), eigeneIbans, heute: localDay(ctx.jetzt ?? new Date()), hinweise: e.hinweise,
  });
  // Nahtstellen 09.10.: Hinweise, wo dasselbe Geld sonst doppelt zählt bzw. still wegfällt (ändern nichts — die Vorschau-Kennung bleibt gleich).
  if (ziel.art === 'business') plan.hinweise.push(...offeneHinweise(plan, e.auszug, await offenePosten(ziel.ort)));
  plan.hinweise.push(...uebergangHinweise(plan, konto, register.konten));
  if (plan.saldo?.status === 'neu' && istPrivatOrt(konto.ort) && !regiert(register.konten, istPrivatOrt)) plan.hinweise.push(...await privatPlanHinweis(ctx.haushalt, register.konten));
  return {
    ok: true, plan, konto, auszug: e.auszug, format: e.format, ...('csv' in e && e.csv ? { csv: e.csv } : {}), eigeneIbans,
    ...(neu ? { haushaltKontoNeu: neu } : {}), ...(tot ? { toteVerknuepfung: tot } : {}), ...(hh ? { haushaltStamm: { regeln: hh.stamm.regeln, kategorien: hh.stamm.kategorien } } : {}),
  };
}

/** Was der Browser von der Vorschau sieht (eigene Daten der Person — die Datei kam von ihr; die IBAN der Datei nur maskiert). */
export interface VorschauAntwort {
  ok: true;
  format: 'camt' | 'csv';
  csv?: Omit<CsvInfo, 'beispiel'>;
  konto: { id: string; name: string };
  ziel: Ziel & { satz: string };
  zeilen: (Omit<PlanZeile, 'i' | 'schluessel'>)[];
  saldo: (Plan['saldo'] & { betrag: number }) | null;
  zahlen: Plan['zahlen'];
  einordnung?: Plan['einordnung'];
  zeitraum: Plan['zeitraum'];
  pruefung: Pruefsumme | null;
  hinweise: string[];
  ibanMaskiert?: string;
  basis: string;
  /** Neue Zuordnungen „schon gebucht“ (Rechnung bezahlt, Beleg, von Hand) — werden beim Übernehmen festgehalten. */
  abgleiche: number;
}

function antwortAus(v: Vorbereitet): VorschauAntwort {
  const p = v.plan;
  return {
    ok: true, format: v.format, ...(v.csv ? { csv: ohneBeispiel(v.csv) } : {}), konto: { id: v.konto.id, name: v.konto.name },
    ziel: { ...p.ziel, satz: zielSatz(p.ziel, g => finanzOrtName(g)) },
    zeilen: p.zeilen.map(({ i: _i, schluessel: _s, ...z }) => z),
    saldo: p.saldo ? { ...p.saldo, betrag: centZuEuro(p.saldo.cent) } : null,
    zahlen: p.zahlen, ...(p.einordnung ? { einordnung: p.einordnung } : {}), zeitraum: p.zeitraum, pruefung: p.pruefung, hinweise: p.hinweise, ...(p.ibanMaskiert ? { ibanMaskiert: p.ibanMaskiert } : {}), basis: p.basis,
    abgleiche: p.abgleiche.length,
  };
}

/** Vorschau — schreibt nichts. */
export async function auszugVorschau(ctx: Kontext, kontoId: unknown, bytes: Uint8Array, spalten: unknown): Promise<VorschauAntwort | Fehler> {
  const v = await vorbereiten(ctx, kontoId, bytes, spalten);
  return v.ok ? antwortAus(v) : v;
}

// ── Übernehmen (Absichtsprotokoll) ───────────────────────────────────────────────────────────────────────────────────────────────

const SCHRITTE_EIN = ['lauf', 'haushaltkonto', 'buchungen', 'saldo', 'abschluss'] as const;
const SCHRITTE_ZURUECK = ['buchungen', 'saldo', 'protokoll'] as const;

interface EinDaten {
  richtung: 'ein';
  laufId: string;
  kontoId: string;
  ort: KontoOrt;
  format: 'camt' | 'csv';
  zeitraum: Plan['zeitraum'];
  zahlen: Plan['zahlen'];
  ziel: Ziel;
  haushaltKontoNeu?: HaushaltKonto;
  toteVerknuepfung?: string;
  /** Die anzulegenden Buchungen (Business- bzw. Haushalts-Form). Personendaten Dritter — fällt beim Abschluss weg. */
  zeilen: (BusinessBuchung | HaushaltBuchung)[];
  /** Fingerabdrücke der neuen Zeilen mit der Zahl gleicher Zeilen im Bestand zur Zeit der Vorschau (für die erneute Prüfung in der Sperre). */
  vorherFp: Record<string, number>;
  saldo?: { betrag: number; datum: string };
  /** Neue Zuordnungen „schon gebucht“ (nur Kennungen + Fingerabdrücke). */
  abgeglichen?: { id: string; k: string }[];
  firmaVorher?: FirmaVorher;
  angelegt?: { id: string; fp: string }[];
  doppelt?: number;
  standId?: string | null;
}
interface ZurueckDaten { richtung: 'zurueck'; laufId: string; ziel: AuszugLauf['ziel']; buchungen: AuszugLauf['buchungen']; ort?: KontoOrt; firmaVorher?: FirmaVorher; entfernt?: number; konflikte?: { id: string }[]; schonWeg?: number; standZurueck?: number }

export type UebernahmeErgebnis =
  | { ok: true; lauf: AuszugLauf | null; angelegt: number; doppelt: number; saldo: 'neu' | 'vorhanden' | 'nicht' | null; nichtsNeu?: true; /** Umsätze, die schon gebucht waren (Rechnung bezahlt, Beleg, von Hand) — zugeordnet, nicht angelegt. */ zugeordnet?: number }
  | (Fehler & { vorschau?: VorschauAntwort });

/**
 * Übernehmen — nur mit der `basis` der gesehenen Vorschau (sonst 409 mit der neuen Vorschau). Geht die Saldo-Prüfung nicht auf, nur mit
 * `trotzAbweichung` (die Person hat es gesehen — kein stilles Weiter).
 */
export async function auszugUebernehmen(ctx: Kontext, kontoId: unknown, bytes: Uint8Array, spalten: unknown, basis: unknown, opt: { trotzAbweichung?: boolean } = {}): Promise<UebernahmeErgebnis> {
  const v = await vorbereiten(ctx, kontoId, bytes, spalten);
  if (!v.ok) return v;
  if (v.plan.basis !== basis) return { ok: false, status: 409, fehler: 'Inzwischen hat sich etwas geändert — die Vorschau ist neu geladen, bitte noch einmal prüfen.', vorschau: antwortAus(v) };
  if (v.plan.pruefung && !v.plan.pruefung.stimmt && opt.trotzAbweichung !== true) {
    return { ok: false, status: 409, fehler: 'Die Saldo-Prüfung geht nicht auf (Anfangssaldo + Umsätze ≠ Endsaldo). Erst prüfen — übernehmen nur ausdrücklich „trotzdem“.', pruefung: v.plan.pruefung, vorschau: antwortAus(v) };
  }
  if (!planHatWirkung(v.plan)) return { ok: true, lauf: null, angelegt: 0, doppelt: 0, saldo: v.plan.saldo?.status ?? null, nichtsNeu: true };
  const jetzt = (ctx.jetzt ?? new Date()).toISOString();
  const laufId = neueKennung('ka');
  const p = v.plan;
  const kontoKurz = { id: v.konto.id, name: v.konto.name };
  const zeilen: EinDaten['zeilen'] = p.ziel.art === 'business' ? businessZeilen(p, v.auszug, kontoKurz, laufId)
    : p.ziel.art === 'haushalt' ? haushaltZeilen(p, v.auszug, v.haushaltStamm!, laufId, ctx.person, jetzt, () => randomUUID(), v.eigeneIbans) : [];
  // Bestand zur Zeit der Vorschau: wie oft kam jeder Fingerabdruck der neuen Zeilen schon vor?
  const vorherFp: Record<string, number> = {};
  const fpZeile = (z: BusinessBuchung | HaushaltBuchung) => (p.ziel.art === 'business' ? fpBusiness(z as BusinessBuchung) : fpHaushalt(z as HaushaltBuchung));
  const neueFp = new Set(zeilen.map(fpZeile));
  for (const f of Array.from(neueFp)) vorherFp[f] = 0;
  if (neueFp.size) {
    const bestand = p.ziel.art === 'business' ? businessBestand((await loadJson<{ buchungen?: BusinessBuchung[] }>('buchungen'))?.buchungen ?? [], p.ziel.ort, v.konto.id)
      : (await ladeHaushalt(ctx.haushalt)).buchungen.filter(b => p.ziel.art === 'haushalt' && b.konto_id === p.ziel.haushaltKontoId);
    for (const b of bestand) { const f = p.ziel.art === 'business' ? fpBusiness(b as BusinessBuchung) : fpHaushalt(b as HaushaltBuchung); if (neueFp.has(f)) vorherFp[f] = (vorherFp[f] ?? 0) + 1; }
  }
  const daten: EinDaten = {
    richtung: 'ein', laufId, kontoId: v.konto.id, ort: v.konto.ort, format: v.format, zeitraum: p.zeitraum, zahlen: p.zahlen, ziel: p.ziel,
    ...(v.haushaltKontoNeu ? { haushaltKontoNeu: v.haushaltKontoNeu } : {}), ...(v.toteVerknuepfung ? { toteVerknuepfung: v.toteVerknuepfung } : {}), zeilen, vorherFp,
    ...(p.saldo?.status === 'neu' ? { saldo: { betrag: centZuEuro(p.saldo.cent), datum: p.saldo.datum } } : {}),
    ...(p.abgleiche.length ? { abgeglichen: p.abgleiche } : {}),
  };
  // Macht erst dieser Saldo das Register zur Quelle der Gesellschaft? Dann den Kontostand von vorher festhalten (für „Rückgängig“).
  const vorher = daten.saldo ? await firmaVorAuszug(ctx.haushalt, v.konto.id, daten.saldo) : null;
  if (vorher) daten.firmaVorher = vorher;
  const b = await absichtBeginnen(ctx.haushalt, { art: 'kontoauszug', schluessel: laufId, schritte: SCHRITTE_EIN, daten: daten as unknown as Record<string, unknown>, person: ctx.person });
  const r = await laufEin(ctx.haushalt, b.absicht);
  return { ok: true, lauf: r.lauf, angelegt: r.angelegt, doppelt: r.doppelt, saldo: p.saldo ? (p.saldo.status === 'neu' && !r.standId ? 'vorhanden' : p.saldo.status) : null, ...(p.abgleiche.length ? { zugeordnet: p.abgleiche.length } : {}) };
}

/** Business-Bestand, der für dieses Register-Konto als Dublette zählen kann: gleiche Gesellschaft, nicht aus dem Auszug eines anderen Kontos. */
function businessBestand(l: readonly BusinessBuchung[], ort: string, kontoId: string): BusinessBuchung[] {
  const eigenePraefix = `${BUSINESS_PRAEFIX}${kontoMarke(kontoId)}-`;
  return l.filter(b => b.ort === ort && (!b.id.startsWith(BUSINESS_PRAEFIX) || b.id.startsWith(eigenePraefix)));
}

/**
 * Neue Zeilen in der Sperre des Bestands schreiben — idempotent: Zeilen DIESES Laufs (Kennung + Lauf-Marke) zählen als angelegt (Wiederaufnahme);
 * eine Kennung/`zeilen_hash`, die inzwischen ein anderer Lauf belegt, oder ein seit der Vorschau neu hinzugekommener gleicher Fingerabdruck
 * zählen als doppelt (nie zweimal anlegen).
 */
function neueZeilenEinfuegen<T extends { id: string }>(liste: T[], zeilen: T[], d: EinDaten, art: 'business' | 'haushalt'): { liste: T[]; angelegt: { id: string; fp: string }[]; doppelt: number } {
  const nachId = new Map(liste.map(x => [x.id, x]));
  const istEigen = (x: T) => (art === 'business' ? (x as unknown as BusinessBuchung).auszug === d.laufId : (x as unknown as HaushaltBuchung).import_id === d.laufId);
  const fpVon = (x: T) => (art === 'business' ? fpBusiness(x as unknown as BusinessBuchung) : fpHaushalt(x as unknown as HaushaltBuchung));
  const fremdeBestand = art === 'business'
    ? businessBestand(liste as unknown as BusinessBuchung[], d.ziel.art === 'business' ? d.ziel.ort : '', d.kontoId).filter(b => b.auszug !== d.laufId) as unknown as T[]
    : liste.filter(x => (x as unknown as HaushaltBuchung).konto_id === (d.ziel.art === 'haushalt' ? d.ziel.haushaltKontoId : '') && !istEigen(x));
  const jetztFp = new Map<string, number>();
  for (const x of fremdeBestand) { const f = fpVon(x); if (f in d.vorherFp) jetztFp.set(f, (jetztFp.get(f) ?? 0) + 1); }
  const hashes = art === 'haushalt' ? new Set(fremdeBestand.map(x => (x as unknown as HaushaltBuchung).zeilen_hash).filter(Boolean) as string[]) : null;
  const neuDazu = new Map<string, number>(Object.entries(d.vorherFp).map(([f, n]) => [f, Math.max(0, (jetztFp.get(f) ?? 0) - n)]));
  const angelegt: { id: string; fp: string }[] = [];
  let doppelt = 0;
  const raus = [...liste];
  for (const z of zeilen) {
    const da = nachId.get(z.id);
    if (da) { if (istEigen(da)) angelegt.push({ id: da.id, fp: fingerabdruck(da as unknown as Record<string, unknown>) }); else doppelt++; continue; }
    if (hashes && hashes.has((z as unknown as HaushaltBuchung).zeilen_hash ?? '')) { doppelt++; continue; }
    const f = fpVon(z);
    const rest = neuDazu.get(f) ?? 0;
    if (rest > 0) { neuDazu.set(f, rest - 1); doppelt++; continue; }
    raus.push(z);
    nachId.set(z.id, z);
    angelegt.push({ id: z.id, fp: fingerabdruck(z as unknown as Record<string, unknown>) });
  }
  return { liste: raus, angelegt, doppelt };
}

async function buchungenSchreiben(haushalt: string, d: EinDaten, person: string): Promise<{ angelegt: { id: string; fp: string }[]; doppelt: number }> {
  let erg: { angelegt: { id: string; fp: string }[]; doppelt: number } = { angelegt: [], doppelt: 0 };
  if (!d.zeilen.length) return erg;
  if (d.ziel.art === 'business') {
    await updateJson<{ buchungen: BusinessBuchung[] }>('buchungen', cur => {
      const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
      const e = neueZeilenEinfuegen(liste, d.zeilen as BusinessBuchung[], d, 'business');
      erg = { angelegt: e.angelegt, doppelt: e.doppelt };
      if (e.liste.length === liste.length) return cur ?? { buchungen: liste };
      return { ...(cur ?? {}), buchungen: e.liste.sort((a, b) => b.datum.localeCompare(a.datum)) };
    });
    if (erg.angelegt.length) await protokolliere('buchungen', [{ liste: 'buchungen', op: 'neu', id: `auszug:${d.laufId}`, felder: [`anzahl:${erg.angelegt.length}`] }], { art: 'import', person });
  } else if (d.ziel.art === 'haushalt') {
    await aendereBuchungen(haushalt, liste => {
      const e = neueZeilenEinfuegen(liste, d.zeilen as HaushaltBuchung[], d, 'haushalt');
      erg = { angelegt: e.angelegt, doppelt: e.doppelt };
      return e.liste;
    });
  }
  return erg;
}

async function laufEin(haushalt: string, a: Absicht): Promise<{ lauf: AuszugLauf | null; angelegt: number; doppelt: number; standId: string | null }> {
  const person = a.person ?? 'system';
  return mitVorgang(haushalt, a, async v => {
    const d = { ...(a.daten as unknown as EinDaten) };
    const jetzt = new Date();
    await v.schritt('lauf', async () => laeufeAendern(haushalt, l => (l.some(x => x.id === d.laufId) ? l : [...l, {
      id: d.laufId, kontoId: d.kontoId, ort: d.ort, ziel: d.ziel.art, ...(d.ziel.art === 'haushalt' ? { haushaltKonto: { id: d.ziel.haushaltKontoId, neu: d.ziel.neu } } : {}),
      format: d.format, am: jetzt.toISOString(), von: person, zeitraum: d.zeitraum, zahlen: d.zahlen, buchungen: [], ...(d.abgeglichen?.length ? { abgeglichen: d.abgeglichen } : {}),
      ...(d.firmaVorher ? { firmaVorher: d.firmaVorher } : {}), status: 'laeuft' as const,
    }]), jetzt));
    await v.schritt('haushaltkonto', async () => {
      if (d.ziel.art !== 'haushalt') return;
      const neu = d.haushaltKontoNeu;
      if (neu) await aendereStamm(haushalt, s => (s.konten.some(k => k.id === neu.id) ? s : { ...s, konten: [...s.konten, neu] }));
      if (neu || d.ziel.verknuepfen) await haushaltKontoVerknuepfen(haushalt, d.kontoId, d.ziel.haushaltKontoId, person, { ersetzt: d.toteVerknuepfung });
    });
    const b = await v.schritt('buchungen', async () => buchungenSchreiben(haushalt, d, person), r => ({ angelegt: r.angelegt, doppelt: r.doppelt }));
    const angelegt = b?.angelegt ?? v.daten<EinDaten['angelegt']>('angelegt') ?? [];
    const doppelt = b?.doppelt ?? v.daten<number>('doppelt') ?? 0;
    const s = await v.schritt('saldo', async () => (d.saldo ? (await standAusAuszug(haushalt, d.kontoId, { betrag: d.saldo.betrag, datum: d.saldo.datum, laufId: d.laufId, person })).standId : null), r => ({ standId: r }));
    const standId = s !== undefined ? s : v.daten<string | null>('standId') ?? null;
    let lauf: AuszugLauf | null = null;
    await v.schritt('abschluss', async () => laeufeAendern(haushalt, l => l.map(x => {
      if (x.id !== d.laufId) return x;
      lauf = { ...x, buchungen: angelegt, ...(standId ? { standId } : {}), status: 'uebernommen', zahlen: { ...x.zahlen, neu: angelegt.length, vorhanden: x.zahlen.vorhanden + doppelt } };
      return lauf;
    })));
    await absichtAbschliessen(haushalt, a.id, 'fertig', ['laufId']);
    if (!lauf) lauf = (await laeufeLaden(haushalt)).find(x => x.id === d.laufId) ?? null;
    return { lauf, angelegt: angelegt.length, doppelt, standId };
  });
}

// ── Rückgängig ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type ZurueckErgebnis =
  | { ok: true; lauf: AuszugLauf; entfernt: number; konflikte: { datum: string; betrag: number; wer: string }[]; schonWeg: number; standZurueck: number; hinweis?: string }
  | Fehler;

/** Einen Lauf zurücknehmen: nur Buchungen, die seitdem unverändert sind (sonst Konflikt-Liste), und den Saldo-Stand (bleibt im Verlauf). */
export async function auszugZuruecknehmen(ctx: Kontext, laufId: unknown): Promise<ZurueckErgebnis> {
  const lauf = typeof laufId === 'string' ? (await laeufeLaden(ctx.haushalt)).find(l => l.id === laufId) : undefined;
  if (!lauf) return { ok: false, status: 404, fehler: 'Diesen Lauf gibt es nicht (mehr).' };
  const konto = (await ladeRegister(ctx.haushalt)).konten.find(k => k.id === lauf.kontoId);
  if (!sichtbarIn({ ort: konto?.ort ?? lauf.ort }, ctx.sicht)) return { ok: false, status: 403, fehler: 'Nicht erlaubt: Aus dem Business-Bereich werden nur Läufe der Business-Konten zurückgenommen.' };
  if (lauf.status === 'zurueckgenommen') return { ok: false, status: 409, fehler: 'Dieser Kontoauszug ist schon zurückgenommen.' };
  if (lauf.status === 'laeuft') return { ok: false, status: 409, fehler: 'Die Übernahme läuft noch (oder wird gerade fortgesetzt) — gleich noch einmal versuchen.' };
  const daten: ZurueckDaten = { richtung: 'zurueck', laufId: lauf.id, ziel: lauf.ziel, buchungen: lauf.buchungen, ort: lauf.ort, ...(lauf.firmaVorher ? { firmaVorher: lauf.firmaVorher } : {}) };
  const b = await absichtBeginnen(ctx.haushalt, { art: 'kontoauszug', schluessel: `zurueck:${lauf.id}`, schritte: SCHRITTE_ZURUECK, daten: daten as unknown as Record<string, unknown>, person: ctx.person });
  const r = await laufZurueck(ctx.haushalt, b.absicht);
  const haushaltKonto = lauf.haushaltKonto?.neu ? 'Das dabei angelegte Haushalts-Konto bleibt bestehen (es kann weitere Buchungen tragen).' : undefined;
  return { ok: true, ...r, ...(haushaltKonto ? { hinweis: haushaltKonto } : {}) };
}

async function laufZurueck(haushalt: string, a: Absicht): Promise<{ lauf: AuszugLauf; entfernt: number; konflikte: { datum: string; betrag: number; wer: string }[]; schonWeg: number; standZurueck: number }> {
  const person = a.person ?? 'system';
  const d = a.daten as unknown as ZurueckDaten;
  return mitVorgang(haushalt, a, async v => {
    const konfliktZeilen: { datum: string; betrag: number; wer: string }[] = [];
    const b = await v.schritt('buchungen', async () => {
      const fp = new Map(d.buchungen.map(x => [x.id, x.fp]));
      let entfernt = 0, schonWeg = 0;
      const konflikte: { id: string }[] = [];
      const pruefe = <T extends { id: string }>(liste: T[], eigen: (x: T) => boolean, anzeige: (x: T) => { datum: string; betrag: number; wer: string }): T[] => {
        const da = new Set(liste.map(x => x.id));
        schonWeg = d.buchungen.filter(x => !da.has(x.id)).length;
        return liste.filter(x => {
          if (!fp.has(x.id)) return true;
          if (eigen(x) && fingerabdruck(x as unknown as Record<string, unknown>) === fp.get(x.id)) { entfernt++; return false; }
          konflikte.push({ id: x.id }); konfliktZeilen.push(anzeige(x));
          return true;
        });
      };
      if (d.ziel === 'business') {
        await updateJson<{ buchungen: BusinessBuchung[] }>('buchungen', cur => {
          const liste = Array.isArray(cur?.buchungen) ? cur!.buchungen : [];
          const rest = pruefe(liste, x => x.auszug === d.laufId, x => ({ datum: x.datum, betrag: x.betrag, wer: x.wer }));
          return rest.length === liste.length ? (cur ?? { buchungen: liste }) : { ...(cur ?? {}), buchungen: rest };
        });
        if (entfernt) await protokolliere('buchungen', [{ liste: 'buchungen', op: 'geloescht', id: `auszug:${d.laufId}`, felder: [`anzahl:${entfernt}`] }], { art: 'person', person });
      } else if (d.ziel === 'haushalt') {
        await aendereBuchungen(haushalt, liste => pruefe(liste, x => x.import_id === d.laufId, x => ({ datum: x.datum, betrag: x.betrag / 100, wer: x.empfaenger })));
      }
      return { entfernt, konflikte, schonWeg };
    }, r => ({ entfernt: r.entfernt, konflikte: r.konflikte, schonWeg: r.schonWeg }));
    const entfernt = b?.entfernt ?? v.daten<number>('entfernt') ?? 0;
    const konflikte = b?.konflikte ?? v.daten<{ id: string }[]>('konflikte') ?? [];
    const schonWeg = b?.schonWeg ?? v.daten<number>('schonWeg') ?? 0;
    const s = await v.schritt('saldo', async () => {
      const n = await auszugStandZuruecknehmen(haushalt, d.laufId, person);
      // Führt das Register die Gesellschaft danach nicht mehr, gilt wieder der Kontostand von vorher (idempotent).
      if (d.firmaVorher && d.ort) await firmaVorherHerstellen(haushalt, d.ort, d.firmaVorher);
      return n;
    }, r => ({ standZurueck: r }));
    const standZurueck = s ?? v.daten<number>('standZurueck') ?? 0;
    let lauf: AuszugLauf | null = null;
    await v.schritt('protokoll', async () => laeufeAendern(haushalt, l => l.map(x => {
      if (x.id !== d.laufId) return x;
      const offen = new Set(konflikte.map(k => k.id));
      // Zuordnungen „schon gebucht“ fallen weg — die vorhandenen Buchungen stehen einem späteren Kontoauszug wieder zur Verfügung.
      const { abgeglichen: _ab, ...ohneAbgleich } = x;
      lauf = {
        ...ohneAbgleich, status: offen.size ? 'teilweise' : 'zurueckgenommen', buchungen: x.buchungen.filter(y => offen.has(y.id)),
        zurueck: { am: new Date().toISOString(), von: person, entfernt: (x.zurueck?.entfernt ?? 0) + entfernt, konflikte: offen.size, schonWeg, standZurueck: (x.zurueck?.standZurueck ?? 0) + standZurueck },
      };
      return lauf;
    })));
    await absichtAbschliessen(haushalt, a.id, 'fertig', ['laufId', 'entfernt', 'schonWeg', 'standZurueck']);
    const fertig = lauf ?? (await laeufeLaden(haushalt)).find(x => x.id === d.laufId)!;
    return { lauf: fertig, entfernt, konflikte: konfliktZeilen, schonWeg, standZurueck };
  });
}

/** Wiederaufnahme (lib/store/absichten-fortsetzen.ts): ab dem ersten nicht abgehakten Schritt. */
export async function kontoauszugFortsetzen(haushalt: string, a: Absicht): Promise<void> {
  if ((a.daten as { richtung?: string }).richtung === 'zurueck') await laufZurueck(haushalt, a);
  else await laufEin(haushalt, a);
}

// ── Konto löschen (Art. 17) / Export (Art. 15) ──────────────────────────────────────────────────────────────────────────────────

/** Läufe, die die Person ausgelöst hat (nur Kennungen und Zahlen). */
export async function laeufeDerPerson(haushalt: string, speicher: string): Promise<AuszugLauf[]> {
  return (await laeufeLaden(haushalt)).filter(l => l.von === speicher || l.zurueck?.von === speicher);
}
/** Konto gelöscht: Läufe bleiben (Nachweis des Haushalts), die Personen-Kennung wird „[gelöscht]“. */
export function laeufeOhnePerson(l: AuszugLauf[], speicher: string, geloescht: string): { laeufe: AuszugLauf[]; anzahl: number } {
  let anzahl = 0;
  const laeufe = l.map(x => {
    if (x.von !== speicher && x.zurueck?.von !== speicher) return x;
    anzahl++;
    return { ...x, ...(x.von === speicher ? { von: geloescht } : {}), ...(x.zurueck?.von === speicher ? { zurueck: { ...x.zurueck, von: geloescht } } : {}) };
  });
  return { laeufe, anzahl };
}

export { ortName };
