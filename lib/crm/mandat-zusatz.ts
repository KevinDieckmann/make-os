// ─── Mandat = Hauptprodukt + Zusatzmodule — Rechnung, Liquidität, Abrechnen, Anrechnung (rein, client-sicher, getestet; 19.10., Paket P3) ──────
// PRODUKTE_KONZEPT.md „Mandat übernimmt den Vertrag“ (Kevin 19.10.: „Mandat = Hauptprodukt + Zusatzmodule“, Teilmonat anteilig). EINE Stelle für:
//   · `monatsPositionen`      die Positionen der Monatsrechnung: Haupt (`positionAusMandat`, unverändert) + Zusatzmodule in fester Reihenfolge
//                             (laufende monatlich · inklusive 0 € · jährliche · einmalige). Ohne `zusatz` genau die eine Position wie bisher.
//   · `abrechnenPositionen`   je Einheit / Tag / Stunde nur auf Klick „abrechnen“ mit Menge (Stunden höchstens bis zum Deckel des Produkts)
//   · `anrechnungPositionen`  ein vorher gekauftes Produkt derselben Firma, das laut `regeln.anrechnung` auf das Hauptprodukt angerechnet wird:
//                             EINMAL eine Minusposition, höchstens bis zum Betrag der Rechnung; Merker = Kennung der Position (`anr-…`)
//   · `zusatzLiquiditaet`     die Liquiplan-Posten je Zusatzmodul — nach derselben Laufzeit-Regel (lib/crm/mandat-laufzeit.ts) und so gerechnet,
//                             dass Summe der Posten = Summe der Monatsrechnungen (die Steuer je Rechnung kaufmännisch: der Posten eines Moduls ist
//                             der Unterschied, den es auf der Rechnung des Monats macht — auf den Cent)
// Laufzeit eines Moduls = [ab, bis] ∩ Laufzeit des Mandats. Geld in Cent über lib/finanzen/ust.ts. Keine echten Produkte, Preise oder Namen hier.

import type { Leistung, Mandat, MandatZusatz, PreisTeil } from './typen';
import type { RechnungPosition } from '@/lib/finanzen/rechnung/typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { leistungsmonat, monatsHonorar, monatsName, plusMonateGekappt, zahlungsziel, type Leistungsmonat } from './mandat-laufzeit';
import { ANRECHNUNG_PRAEFIX, anteilText, positionAusMandat, positionNetto, rechnungSummen } from '@/lib/finanzen/rechnung/regeln';
import { UST_SAETZE } from './angebote';
import { hatPreisteile, hauptpreis, preisteileVon } from './produkt-karte';
import { inCent, kaufmaennisch } from '@/lib/finanzen/ust';

// ── Grundwerte ───────────────────────────────────────────────────────────────

/** Wie ein Zusatzmodul abgerechnet wird. `offen` = kein Honorar und nicht inklusive (taucht nirgends auf, bis ein Honorar eingetragen ist). */
export type ZusatzArt = 'monat' | 'jahr' | 'einmalig' | 'abrechnen' | 'inklusive' | 'offen';
export function zusatzArt(z: Pick<MandatZusatz, 'inklusive' | 'honorar'>): ZusatzArt {
  if (z.inklusive) return 'inklusive';
  const b = z.honorar?.basis;
  if (!b) return 'offen';
  return b === 'monat' ? 'monat' : b === 'jahr' ? 'jahr' : b === 'einmalig' ? 'einmalig' : 'abrechnen';
}
/** „je Quartal“ … für inklusive Mengen. */
export const JE_TEXT: Record<NonNullable<MandatZusatz['je']>, string> = { monat: 'Monat', quartal: 'Quartal', jahr: 'Jahr' };
/** Präfixe der Positions-Kennungen (die Kennung ist der Merker — nie umbenennen): laufend · inklusive · jährlich · einmalig · abgerechnet · Anrechnung. */
export const POS = { monat: 'zm-', inklusive: 'zi-', jahr: 'zj-', einmalig: 'ze-', abrechnen: 'za-', anrechnung: ANRECHNUNG_PRAEFIX } as const;
/** Positionen, die „abrechnen“ anlegt — eine Rechnung NUR aus solchen ist keine Monatsrechnung (sie hält den Monat nicht auf). */
export const nurAbgerechnet = (r: Pick<Rechnung, 'positionen'>) => !!r.positionen?.length && r.positionen.every(p => p.id.startsWith(POS.abrechnen));

const fnv = (s: string): string => { let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0; } return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'); };
/** Kennung der Position eines Moduls (kurz, fest aus der Kennung des Moduls). */
export const positionsId = (art: keyof typeof POS, zusatzId: string) => `${POS[art]}${fnv(zusatzId)}`;

const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const plusTage = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const monatPlus = (monat: string, n: number) => plusMonateGekappt(`${monat}-01`, n).slice(0, 7);
const monateZwischen = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

type Katalog = readonly Pick<Leistung, 'id' | 'name' | 'preis' | 'preise'>[];
/** Name des Produkts hinter einem Modul (ohne Katalog bzw. gelöscht: „Zusatzmodul“). */
export const zusatzName = (z: Pick<MandatZusatz, 'leistungId'>, katalog?: Katalog) => katalog?.find(l => l.id === z.leistungId)?.name ?? 'Zusatzmodul';

/**
 * Laufzeit eines Moduls: [ab, bis] ∩ [Beginn, Ende] des Mandats (beide Tage eingeschlossen). `ende` = das Ende, mit dem gerechnet wird —
 * die Rechnung kennt nur `m.ende`, der Liquiditätsplan das geplante Ende (lib/crm/mandat-laufzeit.ts `geplantesEnde`).
 */
export function zusatzZeitraum(m: Partial<Pick<Mandat, 'start'>>, z: Pick<MandatZusatz, 'ab' | 'bis'>, ende: string | null | undefined): { start?: string; ende?: string } {
  const s = [z.ab, m.start].filter(tagOk).sort().at(-1);
  const e = [z.bis, ende ?? undefined].filter(tagOk).sort()[0];
  return { ...(s ? { start: s } : {}), ...(e ? { ende: e } : {}) };
}

/** Der Monat, in dem der Rest eines einmaligen Moduls mit Zahlplan fällig wird: der Monat von „bis“, ohne „bis“ der Folgemonat des Beginns. */
function restMonat(zr: { start?: string; ende?: string }): string | null {
  if (!zr.start) return null;
  return zr.ende ? zr.ende.slice(0, 7) : monatPlus(zr.start.slice(0, 7), 1);
}

// ── Positionen der Monatsrechnung ────────────────────────────────────────────

export interface PositionKontext {
  /** Der Produkt-Katalog — für Namen, Einheit („je Event“) und Deckel. */
  katalog?: Katalog;
  kleinunternehmer?: boolean;
  nettoAusBrutto: (brutto: number, satz: number) => number;
}
const satzVon = (m: Pick<Mandat, 'ustSatz'>, ku?: boolean) => (ku ? 0 : (UST_SAETZE as readonly number[]).includes(m.ustSatz) ? m.ustSatz : 19);
/** Reihenfolge auf der Rechnung (und für die Liquidität): laufende vor inklusive vor jährlichen vor einmaligen. */
const REIHE: Record<ZusatzArt, number> = { monat: 0, inklusive: 1, jahr: 2, einmalig: 3, abrechnen: 9, offen: 9 };
export const zusatzReihe = (l: readonly MandatZusatz[]) => l.map((z, i) => ({ z, i })).sort((a, b) => REIHE[zusatzArt(a.z)] - REIHE[zusatzArt(b.z)] || a.i - b.i).map(x => x.z);

/** Netto (Cent) eines laufenden Moduls im Leistungsmonat: anteilig nach DERSELBEN Regel wie das Monatshonorar (`monatsHonorar`). */
const monatsCent = (betragCent: number, lm: Leistungsmonat) => inCent(monatsHonorar({ honorar: { betrag: betragCent / 100, basis: 'monat', netto: true } }, lm));

/**
 * Die automatischen Positionen der Zusatzmodule eines Mandats im Monat „JJJJ-MM“ (rein). `ende` wie bei `zusatzZeitraum` (Rechnung: `m.ende`).
 *   monat      jeder Monat der Laufzeit, angebrochen anteilig
 *   inklusive  0-€-Position mit Hinweis („im Honorar enthalten“, ggf. „1 je Quartal“) in jedem Monat der Laufzeit
 *   jahr       im Monat des Beginns und alle 12 Monate danach, voller Betrag
 *   einmalig   im Monat des Beginns (mit Zahlplan: Anzahlung; der Rest im Monat von „bis“ bzw. im Folgemonat)
 *   abrechnen  (je Einheit, Tag, Stunde) nie automatisch — nur über `abrechnenPositionen`
 */
export function zusatzPositionen(m: Pick<Mandat, 'start' | 'ende' | 'ustSatz' | 'zusatz'>, monat: string, ctx: PositionKontext, ende: string | null | undefined = m.ende): RechnungPosition[] {
  const raus: RechnungPosition[] = [];
  const satz = satzVon(m, ctx.kleinunternehmer);
  for (const z of zusatzReihe(m.zusatz ?? [])) {
    const art = zusatzArt(z);
    const zr = zusatzZeitraum(m, z, ende);
    const lm = leistungsmonat(zr, monat);
    if (!lm || !lm.tage) continue;
    const name = zusatzName(z, ctx.katalog);
    const basis = { leistungId: z.leistungId, ustSatz: satz };
    if (art === 'monat') {
      raus.push({ id: positionsId('monat', z.id), ...basis, titel: `${name} — ${monatsName(monat)}${lm.anteilig ? ` (${anteilText(lm)})` : ''}`.slice(0, 200), text: 'Zusatzmodul', menge: 1, einheit: lm.anteilig ? 'pauschal' : 'Monat', einzelpreisCent: monatsCent(z.honorar!.betragCent, lm) });
    } else if (art === 'inklusive') {
      const je = z.menge && z.je ? ` (${z.menge} je ${JE_TEXT[z.je]})` : '';
      raus.push({ id: positionsId('inklusive', z.id), ...basis, titel: `${name} — inklusive`.slice(0, 200), text: `Im Honorar enthalten${je}.`, menge: 1, einheit: 'pauschal', einzelpreisCent: 0 });
    } else if (art === 'jahr') {
      if (!zr.start) continue;
      const k = monateZwischen(zr.start.slice(0, 7), monat);
      if (k < 0 || k % 12) continue;
      raus.push({ id: positionsId('jahr', z.id), ...basis, titel: `${name} — Jahr ab ${monatsName(monat)}`.slice(0, 200), text: 'Zusatzmodul, jährlich', menge: 1, einheit: 'Jahr', einzelpreisCent: z.honorar!.betragCent });
    } else if (art === 'einmalig') {
      if (!zr.start) continue;
      const s = zr.start.slice(0, 7);
      const p = z.zahlplan?.anzahlungProzent;
      const r = p ? restMonat(zr) : null;
      const betrag = z.honorar!.betragCent;
      if (p && r && r !== s) {
        const anzahlung = kaufmaennisch((betrag * p) / 100);
        if (monat === s) raus.push({ id: positionsId('einmalig', z.id), ...basis, titel: `${name} — Anzahlung ${p} %`.slice(0, 200), text: `Zusatzmodul, Zahlung ${p} % bei Beginn, Rest bei Abschluss.`, menge: 1, einheit: 'pauschal', einzelpreisCent: anzahlung });
        else if (monat === r) raus.push({ id: positionsId('einmalig', z.id), ...basis, titel: `${name} — Restzahlung ${100 - p} %`.slice(0, 200), text: 'Zusatzmodul, Restzahlung bei Abschluss.', menge: 1, einheit: 'pauschal', einzelpreisCent: betrag - anzahlung });
      } else if (monat === s) {
        raus.push({ id: positionsId('einmalig', z.id), ...basis, titel: name.slice(0, 200), text: 'Zusatzmodul, einmalig', menge: 1, einheit: 'pauschal', einzelpreisCent: betrag });
      }
    }
  }
  return raus;
}

/**
 * Die Positionen der Monatsrechnung (rein, Server UND Liquidität): das Honorar des Mandats wie bisher (`positionAusMandat`, nur bei Honorar > 0)
 * und danach die Zusatzmodule (`zusatzPositionen`). Ohne `zusatz`: genau die eine Position wie bis 19.10. (bit-gleich).
 */
export function monatsPositionen(m: Pick<Mandat, 'titel' | 'honorar' | 'ustSatz' | 'leistungen' | 'start' | 'ende' | 'zusatz'>, monat: string, ctx: PositionKontext, ende: string | null | undefined = m.ende): RechnungPosition[] {
  const lm = leistungsmonat({ start: m.start, ...(ende ? { ende } : {}) }, monat);
  // Nur in Monaten, in denen das Mandat läuft (der Server prüft das vorher ohnehin — 409 „außerhalb der Laufzeit“).
  const haupt = m.honorar.betrag > 0 && (lm?.tage ?? 0) > 0 ? [positionAusMandat(m, monat, { kleinunternehmer: ctx.kleinunternehmer, nettoAusBrutto: ctx.nettoAusBrutto, anteil: lm })] : [];
  return m.zusatz?.length ? [...haupt, ...zusatzPositionen(m, monat, ctx, ende)] : haupt;
}

// ── Abrechnen (je Einheit · Tag · Stunde) ────────────────────────────────────

/** Was „abrechnen“ mitbringt: das Modul und die Menge (Einheiten, Tage bzw. Stunden). */
export interface AbrechnenWahl { zusatzId: string; menge: number }
export const ABRECHNEN_MAX = { module: 20, menge: 100000 } as const;
/** Die Auswahl „abrechnen“ aus dem Netz: Liste von `{ zusatzId, menge }` — fehlt sie, leer. Unsinn 400, zu viele 413 (nie gekürzt). */
export function abrechnenWahlAus(v: unknown): { ok: true; wahl: AbrechnenWahl[] } | { ok: false; status: 400 | 413; fehler: string } {
  if (v === undefined || v === null) return { ok: true, wahl: [] };
  if (!Array.isArray(v)) return { ok: false, status: 400, fehler: 'einheiten: Liste von { zusatzId, menge }.' };
  if (v.length > ABRECHNEN_MAX.module) return { ok: false, status: 413, fehler: `Höchstens ${ABRECHNEN_MAX.module} Module auf einmal abrechnen — nichts angelegt.` };
  const wahl: AbrechnenWahl[] = [];
  for (const x of v) {
    const o = x && typeof x === 'object' ? x as Record<string, unknown> : {};
    if (typeof o.zusatzId !== 'string' || !/^mz-[a-z0-9-]{1,60}$/.test(o.zusatzId)) return { ok: false, status: 400, fehler: 'einheiten: unbekanntes Zusatzmodul.' };
    if (typeof o.menge !== 'number' || !Number.isFinite(o.menge)) return { ok: false, status: 400, fehler: 'einheiten: Menge als Zahl.' };
    wahl.push({ zusatzId: o.zusatzId, menge: o.menge });
  }
  return { ok: true, wahl };
}

const EINHEIT_BASIS: Record<string, string> = { tag: 'Tag', stunde: 'Stunde' };
/** Der Preis-Teil des Produkts, der zur Basis des Moduls passt (Einheit, Deckel). */
function teilFuer(z: MandatZusatz, katalog?: Katalog): PreisTeil | undefined {
  const l = katalog?.find(x => x.id === z.leistungId);
  if (!l || !hatPreisteile(l)) return undefined;
  const art = z.honorar?.basis === 'einheit' ? 'je_einheit' : z.honorar?.basis === 'tag' ? 'tagessatz' : z.honorar?.basis === 'stunde' ? 'stundensatz' : null;
  return art ? preisteileVon(l).find(t => t.art === art) : undefined;
}
/** Deckel (Stunden je Monat) eines Stundensatz-Moduls: aus dem Produkt — höchstens so viele Stunden je Monat werden berechnet. */
export function zusatzDeckel(z: MandatZusatz, katalog?: Katalog): number | null {
  if (z.honorar?.basis !== 'stunde') return null;
  return teilFuer(z, katalog)?.deckel?.stundenJeMonat ?? null;
}
/** Einheit der Position: „Event“ (aus „je Event“), „Tag“, „Stunde“, sonst „Einheit“. */
export function zusatzEinheit(z: MandatZusatz, katalog?: Katalog): string {
  const b = z.honorar?.basis;
  if (b && EINHEIT_BASIS[b]) return EINHEIT_BASIS[b];
  const l = katalog?.find(x => x.id === z.leistungId);
  const e = teilFuer(z, katalog)?.einheit ?? (l ? hauptpreis(l)?.einheit : undefined) ?? '';
  return e.trim().replace(/^(je|pro)\s+/i, '').slice(0, 30) || 'Einheit';
}

/**
 * Die Positionen für „abrechnen“ im Monat (rein): je Modul `menge` × Honorar je Einheit/Tag/Stunde. Stundensatz: höchstens der Deckel des Produkts
 * (die Position sagt es). Fehler (Satz) statt Positionen, wenn ein Modul fehlt, nicht abrechenbar ist, im Monat nicht läuft oder die Menge Unsinn ist.
 */
export function abrechnenPositionen(m: Pick<Mandat, 'start' | 'ende' | 'ustSatz' | 'zusatz'>, monat: string, wahl: readonly AbrechnenWahl[], ctx: Pick<PositionKontext, 'katalog' | 'kleinunternehmer'>): { ok: true; positionen: RechnungPosition[] } | { ok: false; status: 400 | 409 | 413; fehler: string } {
  if (wahl.length > ABRECHNEN_MAX.module) return { ok: false, status: 413, fehler: `Höchstens ${ABRECHNEN_MAX.module} Module auf einmal abrechnen — nichts angelegt.` };
  const satz = satzVon(m, ctx.kleinunternehmer);
  const raus: RechnungPosition[] = [];
  const gesehen = new Set<string>();
  for (const w of wahl) {
    const z = (m.zusatz ?? []).find(x => x.id === w.zusatzId);
    if (!z) return { ok: false, status: 400, fehler: 'Dieses Zusatzmodul hängt nicht (mehr) am Mandat.' };
    if (gesehen.has(z.id)) return { ok: false, status: 400, fehler: 'Jedes Modul nur einmal je Rechnung abrechnen.' };
    gesehen.add(z.id);
    const name = zusatzName(z, ctx.katalog);
    if (zusatzArt(z) !== 'abrechnen') return { ok: false, status: 409, fehler: `„${name}“ wird nicht nach Menge abgerechnet (${z.inklusive ? 'inklusive' : 'monatlich, jährlich bzw. einmalig — das steht von selbst auf der Monatsrechnung'}).` };
    if (typeof w.menge !== 'number' || !Number.isFinite(w.menge) || w.menge <= 0) return { ok: false, status: 400, fehler: `„${name}“: Menge größer 0.` };
    if (w.menge > ABRECHNEN_MAX.menge) return { ok: false, status: 413, fehler: `„${name}“: höchstens ${ABRECHNEN_MAX.menge.toLocaleString('de-DE')} — nichts angelegt.` };
    const lm = leistungsmonat(zusatzZeitraum(m, z, m.ende), monat);
    if (!lm?.tage) return { ok: false, status: 409, fehler: `„${name}“ läuft in ${monatsName(monat)} nicht (ab/bis am Modul bzw. Laufzeit des Mandats prüfen).` };
    const menge = Math.round(w.menge * 1000) / 1000;
    const deckel = zusatzDeckel(z, ctx.katalog);
    const berechnet = deckel !== null && menge > deckel ? deckel : menge;
    const einheit = zusatzEinheit(z, ctx.katalog);
    raus.push({
      id: positionsId('abrechnen', z.id), leistungId: z.leistungId, titel: `${name} — ${monatsName(monat)}`.slice(0, 200),
      text: berechnet < menge ? `${menge.toLocaleString('de-DE')} Stunden erfasst — berechnet höchstens ${deckel} Stunden je Monat (vereinbarter Deckel).` : 'Zusatzmodul, nach Menge',
      menge: berechnet, einheit, einzelpreisCent: z.honorar!.betragCent, ustSatz: satz,
    });
  }
  return { ok: true, positionen: raus };
}

// ── Anrechnung ───────────────────────────────────────────────────────────────

/** Merker der Anrechnung: Kennung der Minusposition je (angerechnetes Produkt, Firma) — gibt es sie auf einer gültigen Rechnung, nie noch einmal. */
export const anrechnungId = (produktId: string, firmaId: string) => `${POS.anrechnung}${fnv(`${produktId}|${firmaId}`)}`;
/** Ist die Position eine Anrechnung (darf negativ sein)? */
export const istAnrechnung = (p: Pick<RechnungPosition, 'id'>) => p.id.startsWith(POS.anrechnung);
/** Zählt eine Rechnung (nicht storniert, keine Stornorechnung)? */
const gilt = (r: Pick<Rechnung, 'status' | 'art'>) => r.status !== 'storniert' && r.art !== 'storno';

export interface AnrechnungKontext {
  katalog: readonly Pick<Leistung, 'id' | 'name' | 'regeln' | 'geloeschtAm'>[];
  mandate: readonly Pick<Mandat, 'id' | 'firmaId' | 'leistungId' | 'status' | 'honorar' | 'ustSatz' | 'geloeschtAm'>[];
  rechnungen: readonly Pick<Rechnung, 'id' | 'status' | 'art' | 'mandatId' | 'kundeFirmaId' | 'positionen'>[];
  nettoAusBrutto: (brutto: number, satz: number) => number;
}
/**
 * Was ein Kunde (Firma) für ein Produkt schon bezahlt hat — netto in Cent: Positionen mit diesem Produkt auf gestellten bzw. bezahlten Rechnungen
 * der Firma (Kundenfirma oder Mandat der Firma); sonst die Rechnungen eines Mandats dieses Produkts; sonst dessen einmaliges Honorar (ein Mandat
 * ohne Rechnung). 0 = nichts gekauft.
 */
export function gekauftCent(produktId: string, firmaId: string, ctx: AnrechnungKontext, ohneMandat?: string): number {
  const mandateDerFirma = ctx.mandate.filter(x => !x.geloeschtAm && x.firmaId === firmaId && x.id !== ohneMandat);
  const derFirma = (r: Pick<Rechnung, 'kundeFirmaId' | 'mandatId'>) => r.kundeFirmaId === firmaId || (!!r.mandatId && mandateDerFirma.some(x => x.id === r.mandatId));
  const gestellt = ctx.rechnungen.filter(r => gilt(r) && (r.status === 'gestellt' || r.status === 'bezahlt'));
  const ausPositionen = gestellt.filter(derFirma).flatMap(r => (r.positionen ?? []).filter(p => p.leistungId === produktId && !istAnrechnung(p))).reduce((a, p) => a + positionNetto(p), 0);
  if (ausPositionen > 0) return ausPositionen;
  const produktMandate = mandateDerFirma.filter(x => x.leistungId === produktId && (x.status === 'aktiv' || x.status === 'pausiert' || x.status === 'beendet'));
  const ausMandatRechnungen = gestellt.filter(r => produktMandate.some(x => x.id === r.mandatId)).flatMap(r => (r.positionen ?? []).filter(p => !istAnrechnung(p))).reduce((a, p) => a + positionNetto(p), 0);
  if (ausMandatRechnungen > 0) return ausMandatRechnungen;
  return produktMandate.filter(x => x.honorar.basis === 'einmalig' && x.honorar.betrag > 0)
    .reduce((a, x) => a + inCent(x.honorar.netto ? x.honorar.betrag : ctx.nettoAusBrutto(x.honorar.betrag, x.ustSatz)), 0);
}

/**
 * Die Anrechnung auf der Monatsrechnung eines Mandats (rein): je Produkt, das laut `regeln.anrechnung` auf das Hauptprodukt dieses Mandats
 * angerechnet wird und das die Firma gekauft hat (`gekauftCent`), EINE Minusposition „Anrechnung <Produkt>“ — Anteil laut Regel, höchstens bis zum
 * Betrag der Rechnung (netto, gleicher Steuersatz). Steht die Anrechnung (Kennung `anrechnungId`) schon auf einer gültigen Rechnung (auch einem
 * Entwurf), kommt sie nicht noch einmal. `positionen` = die übrigen Positionen dieser Rechnung.
 */
export function anrechnungPositionen(m: Pick<Mandat, 'id' | 'firmaId' | 'leistungId' | 'ustSatz'>, positionen: readonly RechnungPosition[], ctx: AnrechnungKontext, opt: { kleinunternehmer?: boolean } = {}): RechnungPosition[] {
  if (!m.firmaId || !m.leistungId) return [];
  const satz = satzVon(m, opt.kleinunternehmer);
  const schon = new Set(ctx.rechnungen.filter(gilt).flatMap(r => (r.positionen ?? []).filter(istAnrechnung).map(p => p.id)));
  const raus: RechnungPosition[] = [];
  let rest = positionen.filter(p => p.ustSatz === satz).reduce((a, p) => a + positionNetto(p), 0);
  for (const l of ctx.katalog) {
    const a = l.regeln?.anrechnung;
    if (l.geloeschtAm || !a?.auf.includes(m.leistungId) || rest <= 0) continue;
    const id = anrechnungId(l.id, m.firmaId);
    if (schon.has(id)) continue;
    const gekauft = gekauftCent(l.id, m.firmaId, ctx, m.id);
    if (gekauft <= 0) continue;
    const voll = kaufmaennisch((gekauft * a.anteilProzent) / 100);
    const betrag = Math.min(voll, rest);
    rest -= betrag;
    const euro = (c: number) => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    raus.push({
      id, leistungId: l.id, titel: `Anrechnung ${l.name}`.slice(0, 200),
      text: betrag < voll ? `Angerechnet ${a.anteilProzent === 100 ? 'voll' : `zu ${a.anteilProzent} %`}: ${euro(betrag)} € von ${euro(voll)} € (höchstens bis zum Betrag dieser Rechnung, einmalig).` : `Angerechnet ${a.anteilProzent === 100 ? 'voll' : `zu ${a.anteilProzent} %`} (einmalig).`,
      menge: 1, einheit: 'pauschal', einzelpreisCent: -betrag, ustSatz: satz,
    });
  }
  return raus;
}

// ── Liquidität (Posten je Zusatzmodul) ───────────────────────────────────────

/** Ein Liquiplan-Posten eines Moduls ohne die gemeinsamen Felder (Sicherheit, Firma, Kategorie) — die setzt lib/crm/kunden.ts `mandatPosten`. */
export interface ZusatzPostenRoh {
  /** Kennung hinter `lp-mandat-<Mandat>~`: `z-<Modul>` (die vollen Monate bzw. Jahre) oder `z-<Modul>~JJJJ-MM` (ein einzelner Monat). */
  id: string;
  /** Was hinter dem Mandatsnamen im Titel steht: „<Produkt>“ bzw. „<Produkt> Oktober 2026 anteilig“, „<Produkt> Anzahlung“ … */
  titel: string;
  /** Brutto in € (auf den Cent). */
  betrag: number;
  rhythmus: 'einmalig' | 'monatlich' | 'jaehrlich';
  ab: string;
  bis?: string;
  notiz: string;
}

interface Zahlung { monat: string; cent: number; tag: string; voll: boolean; titel: string }

/**
 * Zahlungen eines Moduls zu Posten bündeln: aufeinanderfolgende volle Monate (bzw. Jahre) mit gleichem Betrag = EIN wiederkehrender Posten
 * (der erste ohne Monatskennung), alles andere einmalige Posten. `offen`: die letzte Reihe läuft ohne Ende weiter.
 */
function buendeln(zid: string, l: readonly Zahlung[], schritt: 1 | 12, offen: boolean, notiz: string, name: string): ZusatzPostenRoh[] {
  const raus: ZusatzPostenRoh[] = [];
  let hauptVergeben = false;
  for (let i = 0; i < l.length;) {
    const a = l[i];
    let j = i + 1;
    if (a.voll) while (j < l.length && l[j].voll && l[j].cent === a.cent && monateZwischen(l[j - 1].monat, l[j].monat) === schritt) j++;
    const n = j - i;
    const letzteReihe = j === l.length;
    if (a.voll && (n >= 2 || (letzteReihe && offen))) {
      const id = hauptVergeben ? `z-${zid}~${a.monat}` : `z-${zid}`;
      hauptVergeben = true;
      const lauftWeiter = letzteReihe && offen;
      raus.push({ id, titel: name, betrag: a.cent / 100, rhythmus: schritt === 1 ? 'monatlich' : 'jaehrlich', ab: a.tag, ...(lauftWeiter ? {} : { bis: plusMonateGekappt(a.tag, schritt * (n - 1)) }), notiz });
    } else {
      for (let k = i; k < j; k++) raus.push({ id: `z-${zid}~${l[k].monat}`, titel: l[k].titel, betrag: l[k].cent / 100, rhythmus: 'einmalig', ab: l[k].tag, notiz });
    }
    i = j;
  }
  return raus;
}

/**
 * Die Liquiplan-Posten der Zusatzmodule eines Mandats ab dem Monat `abMonat` bis zum letzten Tag `ende` (null = offen) — rein. Je Modul nach
 * derselben Laufzeit-Regel wie die Rechnung: laufende Monate (angebrochene einmalig, volle als Monatsposten), jährliche, einmalige (mit Zahlplan zwei
 * Zahlungen), Stundensatz mit den geplanten Stunden je Monat (`stundenJeMonat`, höchstens der Deckel). Inklusive, je Einheit/Tag und Module ohne
 * Honorar: kein Posten. Der Betrag einer Zahlung = was das Modul auf der Monatsrechnung ausmacht (brutto, Steuer kaufmännisch je Rechnung) — so ist
 * die Summe der Posten genau die Summe der Monatsrechnungen. Zahltag = Beginn der Leistung im Monat + Zahlungsziel (wie das Mandat).
 */
export function zusatzLiquiditaet(m: Mandat, abMonat: string, ende: string | null, ctx: { katalog?: Katalog; nettoAusBrutto: (b: number, s: number) => number }): ZusatzPostenRoh[] {
  const liste = m.zusatz ?? [];
  if (!liste.length) return [];
  const ziel = zahlungsziel(m);
  const pctx: PositionKontext = { katalog: ctx.katalog, nettoAusBrutto: ctx.nettoAusBrutto };
  // Horizont: hinter dem letzten Ereignis (Beginn/Ende eines Moduls oder des Mandats, Rest eines Zahlplans) ist alles gleichförmig — 13 Monate
  // danach reichen, damit jede jährliche Zahlung einmal im Gleichlauf steht; offene Reihen laufen danach ohne Ende weiter.
  const ereignisse = [abMonat, m.start, ende, ...liste.flatMap(z => [z.ab, z.bis])].filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}/.test(x)).map(x => x.slice(0, 7));
  for (const z of liste) { const r = z.zahlplan ? restMonat(zusatzZeitraum(m, z, ende)) : null; if (r) ereignisse.push(r); }
  const horizont = ende ? ende.slice(0, 7) : monatPlus(ereignisse.sort().at(-1)!, 13);
  const brutto = (l: readonly RechnungPosition[]) => rechnungSummen(l).brutto;
  const mitEnde = { ...m, ...(ende ? { ende } : {}) };
  // Je Monat die Positionen der Monatsrechnung (einmal gerechnet, für alle Module).
  const monate: string[] = [];
  const start = [abMonat, m.start?.slice(0, 7)].filter((x): x is string => !!x).sort().at(-1)!;
  for (let mo = start; mo <= horizont; mo = monatPlus(mo, 1)) monate.push(mo);
  const jeMonat = new Map(monate.map(mo => [mo, monatsPositionen(mitEnde, mo, pctx, ende)]));
  const raus: ZusatzPostenRoh[] = [];
  for (const z of liste) {
    const art = zusatzArt(z);
    const name = zusatzName(z, ctx.katalog);
    const zr = zusatzZeitraum(m, z, ende);
    const offen = !zr.ende;
    const notiz = `Aus dem Mandat (CRM): Zusatzmodul „${name}“ — wie die Monatsrechnung.`;
    const zahlungen: Zahlung[] = [];
    if (art === 'abrechnen') {
      // Stundensatz mit geplanten Stunden je Monat (höchstens der Deckel) — die echten Stunden kommen per „abrechnen“ auf die Rechnung.
      const std = z.honorar?.basis === 'stunde' ? Math.min(z.stundenJeMonat ?? 0, zusatzDeckel(z, ctx.katalog) ?? Infinity) : 0;
      if (!(std > 0)) continue;
      for (const mo of monate) {
        const lm = leistungsmonat(zr, mo);
        if (!lm?.tage) continue;
        const netto = monatsCent(kaufmaennisch(std * z.honorar!.betragCent), lm);
        const p: RechnungPosition = { id: 'x', titel: 'x', text: '', menge: 1, einheit: 'Monat', einzelpreisCent: netto, ustSatz: satzVon(m) };
        zahlungen.push({ monat: mo, cent: brutto([p]), tag: plusTage(lm.von, ziel), voll: !lm.anteilig, titel: `${name} ${monatsName(mo)}${lm.anteilig ? ' anteilig' : ''}` });
      }
      raus.push(...buendeln(z.id, zahlungen, 1, offen, `Aus dem Mandat (CRM): Zusatzmodul „${name}“ — ${z.stundenJeMonat} Std./Monat geplant (abgerechnet wird nach Stunden).`, name));
      continue;
    }
    if (art !== 'monat' && art !== 'jahr' && art !== 'einmalig') continue;
    const eigeneId = positionsId(art, z.id);
    for (const mo of monate) {
      const l = jeMonat.get(mo)!;
      const k = l.findIndex(p => p.id === eigeneId);
      if (k < 0) continue;
      const cent = brutto(l.slice(0, k + 1)) - brutto(l.slice(0, k));
      const lm = leistungsmonat(zr, mo)!;
      const titelTeil = art === 'einmalig' ? (l[k].titel.includes(' — ') ? `${name} ${l[k].titel.split(' — ').pop()}` : name) : `${name} ${monatsName(mo)}${lm.anteilig ? ' anteilig' : ''}`;
      zahlungen.push({ monat: mo, cent, tag: plusTage(lm.von, ziel), voll: art === 'jahr' || (art === 'monat' && !lm.anteilig), titel: titelTeil });
    }
    if (art === 'einmalig') raus.push(...zahlungen.map(x => ({ id: `z-${z.id}~${x.monat}`, titel: x.titel, betrag: x.cent / 100, rhythmus: 'einmalig' as const, ab: x.tag, notiz })));
    else raus.push(...buendeln(z.id, zahlungen, art === 'jahr' ? 12 : 1, offen, notiz, name));
  }
  return raus;
}

// ── Anzeige ──────────────────────────────────────────────────────────────────

const euro = (cent: number) => `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
/** Wie ein Modul abgerechnet wird, in einem Satz: „490 € netto/Monat“, „5.000 € netto einmalig · Zahlung 50/50“, „inklusive · 1 je Quartal“ … */
export function zusatzBeschreibung(z: MandatZusatz, katalog?: Katalog): string {
  const art = zusatzArt(z);
  const h = z.honorar;
  const zeit = [z.ab ? `ab ${tagDe(z.ab)}` : '', z.bis ? `bis ${tagDe(z.bis)}` : ''].filter(Boolean).join(' ');
  let kern: string;
  if (art === 'inklusive') kern = `inklusive${z.menge && z.je ? ` · ${z.menge} je ${JE_TEXT[z.je]}` : ''}`;
  else if (art === 'offen' || !h) kern = 'Honorar offen';
  else if (art === 'monat') kern = `${euro(h.betragCent)} netto/Monat`;
  else if (art === 'jahr') kern = `${euro(h.betragCent)} netto/Jahr`;
  else if (art === 'einmalig') kern = `${euro(h.betragCent)} netto einmalig${z.zahlplan ? ` · ${z.zahlplan.anzahlungProzent === 50 ? 'Zahlung 50/50' : `${z.zahlplan.anzahlungProzent} % Anzahlung`}` : ''}`;
  else if (h.basis === 'stunde') kern = `${euro(h.betragCent)} netto/Stunde${z.stundenJeMonat ? ` · ${z.stundenJeMonat.toLocaleString('de-DE')} Std./Monat geplant` : ''}${zusatzDeckel(z, katalog) ? ` · höchstens ${zusatzDeckel(z, katalog)} Std./Monat` : ''}`;
  else if (h.basis === 'tag') kern = `${euro(h.betragCent)} netto/Tag`;
  else kern = `${euro(h.betragCent)} netto je ${zusatzEinheit(z, katalog)}`;
  return [kern, zeit].filter(Boolean).join(' · ');
}
