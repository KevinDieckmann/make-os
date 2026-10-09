// ─── KI-Schalter je Instanz und je Person (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ───────────────────────────
// Welche Daten dürfen überhaupt an das Modell (Anthropic, USA) — und wann? Drei Schalter, zwei Ebenen:
//
//   hintergrund  automatische Läufe ohne aktuellen Anlass (Takt: Morgen-/Abend-/Tageslauf, Heads, Head of Finance,
//                ZOE-Aufgaben, Verbesserungs-Loop, Brain-Konsolidierung mit KI)
//   websuche     das Web-Suche-Werkzeug des Modells (Research, Tageslauf) — Suchbegriffe gehen an einen Suchdienst
//   bereiche     je Bereich (CRM, Kalender, Aufgaben, Finanzen, Brain/Vault): darf ZOE ihn lesen/an das Modell geben
//
// Ebene Instanz (setzt nur der Inhaber) UND Ebene Person (setzt nur die Person selbst): wirksam ist „an“ nur, wenn
// BEIDE an sind — eine Person kann für sich nur einschränken, nie über die Instanz hinaus öffnen.
//
// Vorgabe (datensparsam, Plattform-Regel): eine NEUE Instanz startet „sparsam“ — Hintergrund-KI und Web-Suche aus,
// Bereiche an (ZOE antwortet nur, wenn jemand fragt). Eine Instanz, die vor diesem Paket schon lief (Kevins Instanz:
// es gibt den Verbrauchs-Bestand `ki-verbrauch` oder Konten von vor der Einführung), bekommt „kompatibel“ — alles an
// wie bisher. Die Entscheidung wird beim ersten Lesen EINMAL festgeschrieben (`vorgabe`, `festgelegtAm`) und kippt
// danach nie von selbst. `MAKE_OS_KI_VORGABE=sparsam|kompatibel` erzwingt die Vorgabe beim ersten Lesen (Tests, Einrichtung).
//
// Erzwungen wird serverseitig an EINER Stelle: `askText` in lib/anthropic.ts (über lib/datenschutz/ki-tor.ts) und für
// ZOEs Werkzeuge in `fuehreAus` (lib/zoe/ausfuehren.ts). Die Oberfläche (System › Datenschutz) stellt nur ein.

import { loadJson, updateJson } from '@/lib/store/local-db';

export type KiBereich = 'crm' | 'kalender' | 'aufgaben' | 'finanzen' | 'brain' | 'familie';
/**
 * Bereiche mit eigenem Schalter (Instanz und Person). `familie` seit 09.10. (Agenten-Bereich Paket 4b): der Head „Familie & Partnerschaft“
 * gibt Familien-Daten an das Modell — jede Person kann das für sich ausschalten wie die anderen Bereiche (Vorgabe an, wie alle Bereiche).
 */
export const KI_BEREICHE: readonly KiBereich[] = ['crm', 'kalender', 'aufgaben', 'finanzen', 'brain', 'familie'];
export const KI_BEREICH_LABEL: Record<KiBereich, string> = {
  crm: 'Markttraktion (CRM)', kalender: 'Kalender', aufgaben: 'Aufgaben & Ziele', finanzen: 'Finanzen', brain: 'Brain & Vault', familie: 'Familie & Partnerschaft',
};
/**
 * Datenkategorien für das KI-Protokoll und das Tor — Bereiche plus Gesundheit (Art. 9) und weitere.
 * Seit 09.10. (Paket 6a, Kevin 08.10.: „Vertex EU für Gesundheit, Privat-Finanzen, Familie“) zusätzlich `familie` und `finanzen-privat`:
 * eine Mindeststufe im Anbieter-Tor (lib/ki/anbieter.ts `MINDESTSTUFE`). `familie` hat seit Paket 4b einen eigenen Bereichs-Schalter;
 * `finanzen-privat` zählt zusätzlich als `finanzen` (Schalter Finanzen) und geht nur mit privatem Finanzzugang der Person an das Modell
 * (KI-Tor, lib/datenschutz/ki-tor.ts). Aufrufer geben sie an, sobald solche Daten im Prompt stehen.
 */
export type KiKategorie = KiBereich | 'gesundheit' | 'finanzen-privat' | 'postfach' | 'web' | 'konto' | 'allgemein';
export const KI_KATEGORIEN: readonly KiKategorie[] = [...KI_BEREICHE, 'gesundheit', 'finanzen-privat', 'postfach', 'web', 'konto', 'allgemein'];
export const istBereich = (k: string): k is KiBereich => (KI_BEREICHE as readonly string[]).includes(k);

export interface KiSchalter { hintergrund: boolean; websuche: boolean; bereiche: Record<KiBereich, boolean> }
export interface KiPersonSchalter {
  hintergrund?: boolean;
  websuche?: boolean;
  bereiche?: Partial<Record<KiBereich, boolean>>;
  /** Ausnahme „ZOE-Antworten vollständig über Telegram“ (unverschlüsselt, Drittland) — Zeitpunkt + Fassung des Hinweises. */
  telegramVoll?: { seit: string; fassung: string };
}
export type KiVorgabe = 'kompatibel' | 'sparsam';
/** Neue KI-Fähigkeiten (09.10., Paket 6a, lib/ki/tor.ts) — je Instanz vom Inhaber eingeschaltet; fehlt = aus (auch „kompatibel“). */
export type KiMedienFaehigkeit = 'bild' | 'video' | 'tiefenbericht' | 'transkript';
export const KI_MEDIEN_FAEHIGKEITEN: readonly KiMedienFaehigkeit[] = ['bild', 'video', 'tiefenbericht', 'transkript'];
export interface KiEinstellungenDatei {
  vorgabe: KiVorgabe;
  festgelegtAm: string;
  instanz?: Partial<Omit<KiSchalter, 'bereiche'>> & {
    bereiche?: Partial<Record<KiBereich, boolean>>;
    /** Anbieter-Tor (09.10.): welche neuen Fähigkeiten an sind — nur der Inhaber. */
    medien?: Partial<Record<KiMedienFaehigkeit, boolean>>;
    /**
     * Budget in Euro-Cent (09.10.): Monat (fehlt = nur messen) und Grenze je Auftrag (fehlt = Vorgabe/Umgebung). Seit Paket 4b zusätzlich
     * eine Gesamt-Grenze (z. B. ein Test-Budget) ab `gesamtAb`: gezählt wird der Verbrauch seit dem Setzen (`gesamtBasisUsdCent` = Stand
     * des fortlaufenden Zählers in lib/zoe/verbrauch.ts beim Setzen). Beides setzbar, Vorgabe in der Oberfläche: Monat.
     */
    budget?: { monatEuroCent?: number; auftragEuroCent?: number; gesamtEuroCent?: number; gesamtAb?: string; gesamtBasisUsdCent?: number };
    /** Modellstufen (09.10., lib/ki/modelle.ts): „bisher“ oder „neu“ — die Umgebung MAKE_OS_KI_STUFEN schlägt diese Einstellung. */
    modellStufen?: 'bisher' | 'neu';
  };
  personen?: Record<string, KiPersonSchalter>;
  geaendert?: string;
}

export const KI_EINSTELLUNGEN = 'ki-einstellungen';
/** Tag der Einführung — Konten von davor zählen als Bestand (Kompatibilität). */
export const KI_EINFUEHRUNG = '2026-10-06T00:00:00.000Z';
const PERSON = /^[a-z0-9-]{1,40}$/;

const alleBereiche = (an: boolean): Record<KiBereich, boolean> => Object.fromEntries(KI_BEREICHE.map(b => [b, an])) as Record<KiBereich, boolean>;

/** Die Vorgabe je Instanztyp. */
export function vorgabeSchalter(v: KiVorgabe): KiSchalter {
  return v === 'kompatibel'
    ? { hintergrund: true, websuche: true, bereiche: alleBereiche(true) }
    : { hintergrund: false, websuche: false, bereiche: alleBereiche(true) };
}

const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

/** Instanz-Schalter: Vorgabe + was der Inhaber eingestellt hat. */
export function instanzSchalter(d: KiEinstellungenDatei): KiSchalter {
  const v = vorgabeSchalter(d.vorgabe);
  const i = d.instanz ?? {};
  return {
    hintergrund: bool(i.hintergrund) ?? v.hintergrund,
    websuche: bool(i.websuche) ?? v.websuche,
    bereiche: Object.fromEntries(KI_BEREICHE.map(b => [b, bool(i.bereiche?.[b]) ?? v.bereiche[b]])) as Record<KiBereich, boolean>,
  };
}

/** Wirksam für eine Person (oder den Systemlauf ohne Person): Instanz UND Person. */
export function wirksameSchalter(d: KiEinstellungenDatei, person: string | null | undefined): KiSchalter {
  const i = instanzSchalter(d);
  const p = person ? d.personen?.[person] : undefined;
  if (!p) return i;
  return {
    hintergrund: i.hintergrund && (p.hintergrund ?? true),
    websuche: i.websuche && (p.websuche ?? true),
    bereiche: Object.fromEntries(KI_BEREICHE.map(b => [b, i.bereiche[b] && (p.bereiche?.[b] ?? true)])) as Record<KiBereich, boolean>,
  };
}

/** Eine Änderung aus dem Netz säubern — nur bekannte Schlüssel, nur Wahrheitswerte. */
export function schalterSaeubern(roh: unknown): { hintergrund?: boolean; websuche?: boolean; bereiche?: Partial<Record<KiBereich, boolean>> } {
  if (!roh || typeof roh !== 'object') return {};
  const r = roh as Record<string, unknown>;
  const raus: { hintergrund?: boolean; websuche?: boolean; bereiche?: Partial<Record<KiBereich, boolean>> } = {};
  if (typeof r.hintergrund === 'boolean') raus.hintergrund = r.hintergrund;
  if (typeof r.websuche === 'boolean') raus.websuche = r.websuche;
  if (r.bereiche && typeof r.bereiche === 'object') {
    const b: Partial<Record<KiBereich, boolean>> = {};
    for (const k of KI_BEREICHE) { const x = (r.bereiche as Record<string, unknown>)[k]; if (typeof x === 'boolean') b[k] = x; }
    if (Object.keys(b).length) raus.bereiche = b;
  }
  return raus;
}

/**
 * Anbieter-Einstellungen der Instanz (09.10., nur der Inhaber) säubern: Fähigkeiten an/aus, Budget in Euro-Cent (Monat; `null` = nur messen;
 * Grenze je Auftrag), Modellstufen „bisher“/„neu“. Unbekanntes fällt weg; Beträge 0 … 100.000 € (darüber 400 in der Route).
 */
export type BudgetAenderung = { monatEuroCent?: number | null; auftragEuroCent?: number | null; gesamtEuroCent?: number | null };
export function anbieterEinstellungSaeubern(roh: unknown): { medien?: Partial<Record<KiMedienFaehigkeit, boolean>>; budget?: BudgetAenderung; modellStufen?: 'bisher' | 'neu' | null } | { fehler: string } {
  if (!roh || typeof roh !== 'object') return {};
  const r = roh as Record<string, unknown>;
  const raus: { medien?: Partial<Record<KiMedienFaehigkeit, boolean>>; budget?: BudgetAenderung; modellStufen?: 'bisher' | 'neu' | null } = {};
  if (r.medien && typeof r.medien === 'object') {
    const m: Partial<Record<KiMedienFaehigkeit, boolean>> = {};
    for (const f of KI_MEDIEN_FAEHIGKEITEN) { const x = (r.medien as Record<string, unknown>)[f]; if (typeof x === 'boolean') m[f] = x; }
    if (Object.keys(m).length) raus.medien = m;
  }
  if (r.budget && typeof r.budget === 'object') {
    const b = r.budget as Record<string, unknown>;
    const betrag = (x: unknown): number | null | undefined | 'falsch' => (x === null ? null : x === undefined ? undefined : typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 10_000_000 ? x : 'falsch');
    const monat = betrag(b.monatEuroCent), auftrag = betrag(b.auftragEuroCent), gesamt = betrag(b.gesamtEuroCent);
    if (monat === 'falsch' || auftrag === 'falsch' || gesamt === 'falsch') return { fehler: 'Budget: ganze Euro-Cent zwischen 0 und 10.000.000 (oder null = keine Grenze).' };
    raus.budget = { ...(monat !== undefined ? { monatEuroCent: monat } : {}), ...(auftrag !== undefined ? { auftragEuroCent: auftrag } : {}), ...(gesamt !== undefined ? { gesamtEuroCent: gesamt } : {}) };
  }
  if (r.modellStufen === 'bisher' || r.modellStufen === 'neu' || r.modellStufen === null) raus.modellStufen = r.modellStufen;
  return raus;
}

/**
 * Eine gesäuberte Budget-Änderung anwenden (rein, EINE Stelle für die Route System › Datenschutz und die Agenten-Seite): `null` entfernt die
 * Grenze. Eine NEUE Gesamt-Grenze (vorher keine) beginnt jetzt — `gesamtAb` und der Zählerstand `basisUsdCent` werden gestempelt; eine
 * geänderte Höhe behält Beginn und Basis (es zählt weiter, was seit dem Beginn verbraucht ist).
 */
export function budgetAnwenden(alt: NonNullable<NonNullable<KiEinstellungenDatei['instanz']>['budget']>, neu: BudgetAenderung, o: { jetzt: string; basisUsdCent: number }): NonNullable<NonNullable<KiEinstellungenDatei['instanz']>['budget']> {
  const b = { ...alt };
  for (const k of ['monatEuroCent', 'auftragEuroCent'] as const) { const v = neu[k]; if (v === null) delete b[k]; else if (typeof v === 'number') b[k] = v; }
  if (neu.gesamtEuroCent === null) { delete b.gesamtEuroCent; delete b.gesamtAb; delete b.gesamtBasisUsdCent; }
  else if (typeof neu.gesamtEuroCent === 'number') {
    const neuBeginn = typeof alt.gesamtEuroCent !== 'number' || !alt.gesamtAb;
    b.gesamtEuroCent = neu.gesamtEuroCent;
    if (neuBeginn) { b.gesamtAb = o.jetzt; b.gesamtBasisUsdCent = Math.max(0, o.basisUsdCent); }
  }
  return b;
}

/** Läuft diese Instanz schon länger (Kompatibilität)? Verbrauchs-Bestand vorhanden oder Konten von vor der Einführung. */
async function bestandsInstanz(): Promise<boolean> {
  try { if (await loadJson<unknown>('ki-verbrauch')) return true; } catch { /* weiter */ }
  try {
    const { ladeKonten } = await import('@/lib/zugang/konten');
    return (await ladeKonten()).konten.some(k => typeof k.angelegt === 'string' && k.angelegt < KI_EINFUEHRUNG);
  } catch { return false; }
}

function umgebungsVorgabe(): KiVorgabe | null {
  const v = (process.env.MAKE_OS_KI_VORGABE ?? '').trim();
  return v === 'sparsam' || v === 'kompatibel' ? v : null;
}

let merk: { d: KiEinstellungenDatei; bis: number } | null = null;
/** Für Tests: den Merker leeren. */
export function kiEinstellungenVergessen(): void { merk = null; }

/** Die Einstellungen der Instanz — beim ersten Lesen wird die Vorgabe festgeschrieben. */
export async function ladeKiEinstellungen(): Promise<KiEinstellungenDatei> {
  if (merk && merk.bis > Date.now()) return merk.d;
  let d = await loadJson<KiEinstellungenDatei>(KI_EINSTELLUNGEN);
  if (!d || (d.vorgabe !== 'kompatibel' && d.vorgabe !== 'sparsam')) {
    const vorgabe: KiVorgabe = umgebungsVorgabe() ?? ((await bestandsInstanz()) ? 'kompatibel' : 'sparsam');
    d = await updateJson<KiEinstellungenDatei>(KI_EINSTELLUNGEN, cur =>
      cur && (cur.vorgabe === 'kompatibel' || cur.vorgabe === 'sparsam') ? cur : { ...(cur ?? {}), vorgabe, festgelegtAm: new Date().toISOString() });
  }
  merk = { d, bis: Date.now() + 5_000 };
  return d;
}

export async function aendereKiEinstellungen(mut: (d: KiEinstellungenDatei) => KiEinstellungenDatei): Promise<KiEinstellungenDatei> {
  const vorher = await ladeKiEinstellungen();
  const d = await updateJson<KiEinstellungenDatei>(KI_EINSTELLUNGEN, cur => ({ ...mut(cur ?? vorher), geaendert: new Date().toISOString() }));
  merk = null;
  return d;
}

/** Wirksame Schalter für eine Person bzw. den Systemlauf (null). */
export async function kiSchalterFuer(person: string | null | undefined): Promise<KiSchalter> {
  return wirksameSchalter(await ladeKiEinstellungen(), person && PERSON.test(person) ? person : null);
}

/** War die Person schon vor der Einführung da (Bestand einer kompatiblen Instanz)? Für die Gesundheits-Einwilligung (a). */
export function istBestandsKonto(d: KiEinstellungenDatei, angelegt: string | undefined): boolean {
  return d.vorgabe === 'kompatibel' && typeof angelegt === 'string' && angelegt < d.festgelegtAm;
}

/** Hat die Person die Telegram-Ausnahme eingeschaltet? */
export async function telegramVollFuer(person: string): Promise<boolean> {
  const d = await ladeKiEinstellungen();
  return !!d.personen?.[person]?.telegramVoll?.seit;
}
