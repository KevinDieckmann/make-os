// ─── Rechnungen schreiben mit PDF — Schreibwege (nur Server, 08.10.) ──────────
// Die EINE Stelle, die Rechnungen mit Positionen anlegt, ändert, stellt, storniert und mahnt (Route /api/rechnung; der
// Storno-Weg des Finanzplans ruft für Rechnungen mit PDF hierher). Gespeichert wird im Finanzplan-Bestand (`finanzplan`),
// die Nummernkreise im eigenen Bestand `rechnungswesen` (je Gesellschaft und Jahr die zuletzt vergebene Nummer).
//
// Stellen (Vorbild `angebotStellen`, CLAUDE.md › Datenschicht: reservieren → außerhalb rechnen → mit Stand-Prüfung festschreiben):
//   1. Vorprüfung ohne Sperre: Entwurf, Stand, Sicht, Pflichtangaben (§ 14 Abs. 4 UStG) → 409 mit Liste und Weg.
//   2. In der Sperre des Nummernkreises (`rechnungswesen` — hält NUR „Stellen“/„Storno“ an, nie andere Finanz-Schreiber):
//      a) nächste Nummer = höchste vergebene (Zähler ODER Finanzplan) + 1,
//      b) PDF (pdf-lib) + SHA-256 — außerhalb der Finanzplan-Sperre,
//      c) in der Finanzplan-Sperre: Stand erneut prüfen, verwaiste PDFs eines früheren Abbruchs entfernen, PDF in die Ablage
//         (fester Bezug `rechnungsPdf`, nicht löschbar), Rechnung festschreiben,
//      d) Zähler schreiben.
//   Lückenlos: die Nummer entsteht erst im Moment des Stellens; zwei gleichzeitige Aufrufe laufen nacheinander durch die Sperre;
//   ein Abbruch vor (c) schreibt nichts (keine Nummer verbraucht), ein Abbruch zwischen (c) und (d) heilt sich selbst (der
//   Finanzplan zählt mit), ein Abbruch in (c) nach dem Ablegen hinterlässt ein PDF ohne Rechnung, das der nächste Versuch wegräumt.
// Nichts verlässt das System: der Browser lädt das PDF und öffnet auf Klick das Mail-Programm (Rechnung, Mahnung).

import { createHash } from 'crypto';
import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { localDay, tagVon } from '@/lib/zeit';
import { neueKennung } from '@/lib/kennung';
import { BUSINESS_GESELLSCHAFTEN, bereichVon, gesellschaftAusEinheit, istBusinessGesellschaft, istGesellschaft, istRegisterKennung, NUR_GRUNDDATEN, type Gesellschaftskennung } from '@/lib/einheiten';
import { SEED, sauberFile, fassung, ugFirmaNachziehen, ueberGrenze, rechnungSchutz, type FinanzplanFile, type Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { gegenbuchungAnlegen } from '@/lib/finanzen/finanzplan-buchung';
import { nettoAusBrutto } from '@/lib/finanzen/ust';
import { alleGesellschaften, gesellschaftenName, mitVorgaben, absenderFuerAnzeige, type Gesellschaft, type GesellschaftenDatei } from '@/lib/crm/gesellschaften';
import { absenderAus } from '@/lib/crm/angebot-dokument';
import { belegPdf, type PdfLogo } from '@/lib/crm/angebot-pdf';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { WEG } from '@/lib/wege';
import {
  MAHN_VORGABE_TAGE, EINLEITUNG_VORLAGE, SCHLUSS_VORLAGE, entwurfAnwenden, entwurfGrenzen, empfaengerAusCrm, kundeAus, kurzVon, mahnLabel, mahnMail,
  mahnTageSaeubern, mahnVorschlaege, mahnstufeVon, mahnAufgabeId, monatsGrenzen, naechsteNummer, neuerEntwurf, pflichtFehlt,
  positionenAusAngebot, rechnungMail, rechnungSummen, stornoEntwurf, betragFelder, kreisSchluessel, monatsName, angebotIdOk, firmaIdOk, kontaktIdOk,
  vorlageSaeubern, positionAusBrutto, leistungsmonat, mandatMonatVorgabe, ausserhalbLaufzeit, anschriftVon, anschriftGleich, anschriftFuerFirma, anschriftZerlegen,
  type MahnVorschlag, type Pflicht,
} from './regeln';
import { angenommenZuDeal } from '@/lib/crm/angebote';
import { abrechnenPositionen, abrechnenWahlAus, anrechnungPositionen, istAnrechnung, monatsPositionen, nurAbgerechnet } from '@/lib/crm/mandat-zusatz';
import type { RechnungPosition } from './typen';
import { rechnungDokument, bankZeile } from './dokument';
import type { AnschriftAnFirma, Mahnstufe } from './typen';

export class RechnungFehler extends Error {
  constructor(msg: string, readonly status: number, readonly extra: Record<string, unknown> = {}) { super(msg); }
}

export type Sicht = 'privat' | 'business';
/** Business-Sicht (Konto mit `finanzRecht: 'business'`) sieht und schreibt nur Rechnungen der Business-Gesellschaften. */
export const inSicht = (r: Pick<Rechnung, 'firmaId'>, sicht: Sicht) => sicht === 'privat' || istBusinessGesellschaft(r.firmaId);
const gesellschaftInSicht = (g: string, sicht: Sicht) => sicht === 'privat' || istBusinessGesellschaft(g);
export const mitFassung = (r: Rechnung) => ({ ...r, fassung: fassung(r) });

/** Der Bestand der Nummernkreise (+ Mahn-Einstellung) — keine Personendaten. */
export const RECHNUNGSWESEN = 'rechnungswesen';
interface Rechnungswesen { zaehler?: Record<string, number>; mahnTage?: number[] }

/** Für die Prüfung „Abbruch nach jedem Schritt“ (Tests) — im Betrieb leer. */
export const rechnungTest: { nachPdf?: () => void | Promise<void>; nachAblage?: () => void | Promise<void>; nachFestschreiben?: () => void | Promise<void> } = {};

// ── Lesen ────────────────────────────────────────────────────────────────────

const planLaden = async () => sauberFile(await loadJson<FinanzplanFile>('finanzplan'));
/** Gesäuberter Plan zum Schreiben — ein leerer Speicher bekommt erst den Startbestand (sonst überschriebe ihn GET /api/state/finanzplan). */
function planBasis(cur: FinanzplanFile | null): FinanzplanFile {
  const f = sauberFile(cur);
  return f.firmen.length ? f : { ...sauberFile(SEED), rechnungen: f.rechnungen, zahlungen: f.zahlungen, merkposten: f.merkposten };
}
async function gesellschaften(haushalt: string): Promise<Gesellschaft[]> {
  return alleGesellschaften(await loadJson<GesellschaftenDatei>(gesellschaftenName(haushalt)));
}
export async function mahnTageLaden(): Promise<[number, number, number]> {
  const t = mahnTageSaeubern((await loadJson<Rechnungswesen>(RECHNUNGSWESEN))?.mahnTage);
  return t ?? [MAHN_VORGABE_TAGE[0], MAHN_VORGABE_TAGE[1], MAHN_VORGABE_TAGE[2]];
}

/** Alles für die Oberfläche — serverseitig nach Sicht gefiltert (Rechnungen, Absender, Mahnvorschläge). */
export async function rechnungsStand(z: { haushalt: string; sicht: Sicht }, heute = localDay()) {
  const f = await planLaden();
  const liste = f.rechnungen.filter(r => inSicht(r, z.sicht));
  const tage = await mahnTageLaden();
  const { absenderVorgabe } = await import('@/lib/gesellschaften/server');
  const v = await absenderVorgabe(z.haushalt).catch(() => null);
  return {
    rechnungen: liste.map(mitFassung),
    gesellschaften: (await gesellschaften(z.haushalt)).filter(g => gesellschaftInSicht(g.id, z.sicht)).map(absenderFuerAnzeige),
    vorgabe: v && gesellschaftInSicht(v, z.sicht) ? v : null,
    mahnTage: tage,
    mahnvorschlaege: mahnVorschlaege(liste, heute, tage),
  };
}

/** Das PDF einer Rechnung (Sicht geprüft). */
export async function rechnungPdf(id: string, z: { haushalt: string; sicht: Sicht }): Promise<{ bytes: Buffer; name: string }> {
  const r = (await planLaden()).rechnungen.find(x => x.id === id);
  if (!r || !inSicht(r, z.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
  if (!r.pdfDateiId) throw new RechnungFehler('Zu dieser Rechnung gibt es kein PDF.', 404);
  const { lesen } = await import('@/lib/dateien/ablage');
  const d = await lesen(z.haushalt, r.pdfDateiId);
  if (!d) throw new RechnungFehler('Das PDF liegt nicht (mehr) in der Ablage — bitte im Head of IT prüfen.', 404);
  return { bytes: d.bytes, name: `${r.art === 'storno' ? 'Stornorechnung' : 'Rechnung'} ${r.nummer ?? r.id}.pdf`.replace(/[\\/]/g, '-') };
}

// ── Entwurf anlegen (frei, aus Angebot, aus Mandat) ─────────────────────────

export interface NeuEingabe { quelle?: unknown; firmaId?: unknown; kontaktId?: unknown; kundeFirmaId?: unknown; mandatId?: unknown; angebotId?: unknown; monat?: unknown; /** Nur bei `angebot`: `einmalig` = nur die Einmalposten (Woche 1 · 3.6). */ nur?: unknown;
  /** Nur bei `mandat` (19.10., P3): Zusatzmodule „abrechnen“ — `[{ zusatzId, menge }]` (je Einheit, Tag, Stunde; lib/crm/mandat-zusatz.ts). */ einheiten?: unknown;
  /** Nur bei `frei`: Vorbelegung aus einem abgelegten Angebot (Titel, Bruttobetrag, Angebotsnummer/-datum — Woche 2 · 3.13, `vorlageSaeubern`). */ vorlage?: unknown }

/**
 * Feste Kennung der Rechnung für die Einmalposten eines gemischten Angebots (08.10., Woche 1 · 3.6) — aus der Angebots-Kennung abgeleitet,
 * damit ein zweiter Klick (oder „Mandat anlegen“ und der Knopf danach) nie eine zweite Rechnung anlegt.
 */
export const einmalRechnungId = (angebotId: string) => `r-e${createHash('sha256').update(`einmalig|${angebotId}`).digest('hex').slice(0, 24)}`;
/** Die Einmalposten-Rechnung eines Angebots, solange sie gilt (nicht storniert). */
const einmalSchon = (l: readonly Rechnung[], fest: string) => l.find(r => r.id === fest && r.status !== 'storniert');
export const EINMAL_SCHON = 'Die Einmalposten dieses Angebots stehen schon in einer eigenen Rechnung — keine zweite Rechnung über alle Positionen (sie verrechnete sie doppelt). Die laufende Leistung rechnet das Mandat ab (Monatsrechnung); sonst die Rechnung frei schreiben.';

/**
 * Einen Rechnungsentwurf anlegen (Status „geplant“, ohne Nummer). `quelle`:
 *   angebot  aus einem ANGENOMMENEN Angebot: Positionen, Kunde, Mandat, Gesellschaft — gibt es schon einen offenen Entwurf dazu, kommt er zurück.
 *            Mit `nur: 'einmalig'` (Woche 1 · 3.6, gemischtes Angebot nach „Mandat anlegen“): nur die Einmalposten, feste Kennung
 *            (`einmalRechnungId`) — gibt es sie (in jedem Status) oder schon irgendeine Rechnung aus diesem Angebot, kommt DIE zurück;
 *            eine gestellte Rechnung wird nie angefasst. Die laufende Leistung rechnet das Mandat ab (Monatsrechnung).
 *   mandat   Monatsrechnung aus dem Honorar für `monat` (JJJJ-MM, Vorgabe: laufender Monat) — je Mandat und Leistungsmonat höchstens eine.
 *   frei     leer bzw. vorbelegt aus Kontakt/Firma/Mandat der Kartei.
 * Nie gestellt — das macht nur „Rechnung stellen“. Eingeschränkte Personen (Art. 18) fehlen in der Kartei-Sicht und belegen nichts vor.
 */
export async function entwurfNeu(p: NeuEingabe & { person: string; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<{ rechnung: Rechnung & { fassung: string }; vorhanden: boolean }> {
  const jetzt = p.jetzt ?? new Date();
  const heute = localDay(jetzt);
  const quelle = p.quelle === 'angebot' || p.quelle === 'mandat' ? p.quelle : 'frei';
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }, { absenderVorgabe }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung'), import('@/lib/gesellschaften/server')]);
  const crm = await ladeCrm();
  const kontakte = await kontakteFuerVerarbeitung();
  const gs = await gesellschaften(p.haushalt);
  const vorgabe = await absenderVorgabe(p.haushalt).catch(() => null);
  const plan = await planLaden();
  const id = neueKennung('r');
  let entwurf: Rechnung;
  /** Gibt es den Entwurf schon (aus diesem Angebot bzw. für dieses Mandat und diesen Monat)? Vor UND in der Sperre gefragt. */
  let vorhandenIn: ((l: Rechnung[]) => Rechnung | undefined) | null = null;
  /** Rechnung über alle Positionen eines Angebots: Kennung der Einmalposten-Rechnung, die es dann nicht geben darf (auch in der Sperre geprüft). */
  let sperreEinmal: string | null = null;

  const firma = (fid: unknown) => (firmaIdOk(fid) ? crm.firmen.find(f => f.id === fid && !f.geloeschtAm) : undefined);
  const kontakt = (kid: unknown) => (kontaktIdOk(kid) ? kontakte.find(k => k.id === kid) : undefined);
  const ku = (g: string) => !!gs.find(x => x.id === g)?.kleinunternehmer;
  const ziel = (g: string, z?: number) => z ?? mitVorgaben(gs.find(x => x.id === g) ?? { id: g as Gesellschaftskennung }).zahlungszielTage;
  /** Feste Gesellschaft aus Mandat/Angebot (auch Altnamen); Register-Gesellschaft → „nur Grunddaten“; „offen“ → Wahl bzw. Vorgabe. */
  const gesellschaftFuer = (g: string | undefined): Gesellschaftskennung | '' => {
    if (istRegisterKennung(g)) throw new RechnungFehler(NUR_GRUNDDATEN, 409, { grund: 'nur-grunddaten' });
    const fest = gesellschaftAusEinheit(g);
    if (fest) return fest;
    if (istGesellschaft(p.firmaId)) return p.firmaId;
    if (vorgabe && gesellschaftInSicht(vorgabe, p.sicht)) return vorgabe;
    return p.sicht === 'business' ? BUSINESS_GESELLSCHAFTEN[0] ?? '' : '';
  };

  if (quelle === 'angebot') {
    if (!angebotIdOk(p.angebotId)) throw new RechnungFehler('Angebot fehlt.', 400);
    const a = (crm.angebote ?? []).find(x => x.id === p.angebotId);
    if (!a) throw new RechnungFehler('Angebot nicht gefunden.', 404);
    if (a.status !== 'angenommen') throw new RechnungFehler('Eine Rechnung entsteht nur aus einem angenommenen Angebot — erst „angenommen“ vermerken.', 409, { grund: 'nicht-angenommen' });
    const nurEinmalig = p.nur === 'einmalig';
    if (nurEinmalig && !a.positionen.some(x => x.basis === 'einmalig')) throw new RechnungFehler('Dieses Angebot hat keine Einmalposten.', 409, { grund: 'ohne-einmalposten' });
    const fest = einmalRechnungId(a.id);
    vorhandenIn = nurEinmalig
      ? l => l.find(r => r.id === fest) ?? l.find(r => r.angebotId === a.id && r.art !== 'storno' && r.status !== 'storniert')
      : l => l.find(r => r.angebotId === a.id && r.status === 'geplant');
    const offen = vorhandenIn(plan.rechnungen);
    if (offen) {
      if (!inSicht(offen, p.sicht)) throw new RechnungFehler('Kein Zugang zu dieser Gesellschaft.', 403);
      return { rechnung: mitFassung(offen), vorhanden: true };
    }
    // Nahtstellen 09.10.: stehen die Einmalposten schon in ihrer eigenen Rechnung (feste Kennung, auch gestellt/bezahlt), entsteht keine zweite
    // Rechnung über ALLE Positionen — sie verrechnete die Einmalposten ein zweites Mal (die laufende Leistung rechnet das Mandat ab).
    if (!nurEinmalig) {
      sperreEinmal = fest;
      const einmal = einmalSchon(plan.rechnungen, fest);
      if (einmal) throw new RechnungFehler(EINMAL_SCHON, 409, { grund: 'einmalposten-schon', rechnungId: einmal.id });
    }
    const k = kontakt(a.kontaktId);
    const f = firma(a.firmaId ?? k?.firmaId);
    const empf = empfaengerAusCrm(k, f);
    const mandat = a.mandatId ? crm.mandate.find(m => m.id === a.mandatId) : a.dealId ? crm.mandate.find(m => m.chanceId === a.dealId && !m.geloeschtAm) : undefined;
    // Gesellschaft wie überall (08.10., 3.6): eine Register-Gesellschaft führt der Finanzplan nicht (409 „nur Grunddaten“), nie still kdc.
    const g = gesellschaftFuer(a.gesellschaft);
    if (!g) throw new RechnungFehler('Für dieses Angebot steht keine Gesellschaft fest — die Rechnung frei schreiben.', 409, { grund: 'gesellschaft' });
    const positionen = positionenAusAngebot(nurEinmalig ? { positionen: a.positionen.filter(x => x.basis === 'einmalig') } : a, ku(g));
    entwurf = neuerEntwurf({
      id: nurEinmalig ? fest : id, firmaId: g, kunde: kundeAus(empf, a.empfaenger?.firma ?? a.empfaenger?.name), titel: nurEinmalig ? `${a.titel || 'Leistung'} — einmalig`.slice(0, 160) : a.titel, empfaenger: empf, positionen,
      zahlungszielTage: a.zahlungszielTage, heute, ...(mandat ? { mandatId: mandat.id } : {}), ...(a.nummer ? { angebot: a.nummer } : {}), ...(a.gestelltAm ? { angebotAm: tagVon(a.gestelltAm) } : {}),
      ...(k ? { kontaktId: k.id } : {}), ...(f ? { kundeFirmaId: f.id } : {}), angebotId: a.id, einleitung: EINLEITUNG_VORLAGE, schluss: SCHLUSS_VORLAGE,
    }, { kleinunternehmer: ku(g) });
  } else if (quelle === 'mandat') {
    const m = typeof p.mandatId === 'string' ? crm.mandate.find(x => x.id === p.mandatId && !x.geloeschtAm) : undefined;
    if (!m) throw new RechnungFehler('Mandat nicht gefunden.', 404);
    // Ohne gewählten Monat (z. B. „Erste Rechnung“ am Angebot): der laufende, geklemmt in die Laufzeit des Mandats (18.10.).
    const monat = typeof p.monat === 'string' && monatsGrenzen(p.monat) ? p.monat : mandatMonatVorgabe(m, heute);
    const grenzen = monatsGrenzen(monat)!;
    // Teilmonat (Kevin 18.10.: „Anteilig“): Leistungszeitraum = Monat ∩ [Beginn, Ende]; der Betrag folgt in `positionAusMandat`.
    const lm = leistungsmonat(m, monat)!;
    // Zusatzmodule „abrechnen“ (19.10., P3): je Einheit / Tag / Stunde mit Menge — nur auf Klick, nie von selbst.
    const wahl = abrechnenWahlAus(p.einheiten);
    if (!wahl.ok) throw new RechnungFehler(wahl.fehler, wahl.status);
    const imMonat = (r: Rechnung) => r.mandatId === m.id && !r.angebotId && (r.leistungVon === grenzen.von || r.leistungVon === lm.von) && r.art !== 'storno' && r.status !== 'storniert';
    // Je Mandat und Leistungsmonat höchstens eine Monatsrechnung: erkannt am Monatsersten (bisher) oder am anteiligen Beginn (neu).
    // Rechnungen aus einem Angebot (`angebotId`, z. B. die Einmalposten) sind keine Monatsrechnung — sie halten den Monat nicht auf; ebenso eine
    // Rechnung nur aus abgerechneten Zusatzmodulen (P3, `nurAbgerechnet`).
    vorhandenIn = l => l.find(r => imMonat(r) && !nurAbgerechnet(r));
    const da = vorhandenIn(plan.rechnungen);
    if (da && !wahl.wahl.length) {
      if (!inSicht(da, p.sicht)) throw new RechnungFehler('Kein Zugang zu dieser Gesellschaft.', 403);
      return { rechnung: mitFassung(da), vorhanden: true };
    }
    if (!lm.tage) throw new RechnungFehler(ausserhalbLaufzeit(m, monat), 409, { grund: 'ausserhalb-laufzeit', monat: mandatMonatVorgabe(m, heute) });
    // 08.10. (Woche 2 · 3.13): ein Mandat mit Gesellschaft „offen“ (angelegt ohne Deal) nimmt NICHT still die Vorgabe — erst wählen.
    if (!gesellschaftAusEinheit(m.gesellschaft) && !istRegisterKennung(m.gesellschaft) && !istGesellschaft(p.firmaId)) throw new RechnungFehler('Am Mandat ist die Gesellschaft noch „offen“ — bitte erst am Mandat wählen, für welche Gesellschaft es läuft; dann die Rechnung schreiben.', 409, { grund: 'gesellschaft' });
    const g = gesellschaftFuer(m.gesellschaft);
    if (!g) throw new RechnungFehler('Für dieses Mandat steht keine Gesellschaft fest — am Mandat wählen oder die Rechnung frei schreiben.', 409, { grund: 'gesellschaft' });
    const k = m.kontaktIds.map(kontakt).find(Boolean);
    const f = firma(m.firmaId);
    const empf = empfaengerAusCrm(k, f);
    // Angebots-Nr. (18.10.): stammt das Mandat aus einem angenommenen Angebot, steht dessen Nummer und Datum auch auf der Monatsrechnung —
    // nur als Text (`angebot`/`angebotAm`), nie `angebotId` (die gehört den Rechnungen AUS dem Angebot, sonst verwechselte „aus Angebot“ sie).
    const ang = (crm.angebote ?? []).filter(a => a.mandatId === m.id && a.status === 'angenommen').sort((x, y) => (y.angenommenAm ?? '').localeCompare(x.angenommenAm ?? ''))[0]
      ?? (m.chanceId ? angenommenZuDeal(crm.angebote, m.chanceId) : undefined);
    const ab = wahl.wahl.length ? abrechnenPositionen(m, monat, wahl.wahl, { katalog: crm.leistungen, kleinunternehmer: ku(g) }) : null;
    if (ab && !ab.ok) throw new RechnungFehler(ab.fehler, ab.status);
    const abgerechnet = ab?.ok ? ab.positionen : [];
    if (abgerechnet.length) {
      // Ein offener Entwurf dieses Monats (Monatsrechnung bzw. abgerechnete Zusatzmodule) bekommt die Positionen dazu (gleiches Modul: ersetzt).
      const offen = plan.rechnungen.find(r => imMonat(r) && r.status === 'geplant');
      if (offen) return abgerechnetAnhaengen(offen.id, abgerechnet, { haushalt: p.haushalt, sicht: p.sicht, wer: p.wer, kleinunternehmer: ku(g) });
    }
    // Monatsrechnung (P3): Honorar wie bisher + Zusatzmodule (lib/crm/mandat-zusatz.ts) + Abgerechnetes + einmal die Anrechnung eines gekauften Produkts.
    // Steht die Monatsrechnung schon (gestellt), werden die abgerechneten Module eine eigene Rechnung (nur sie).
    const basisPositionen = da ? abgerechnet : [...monatsPositionen(m, monat, { katalog: crm.leistungen, kleinunternehmer: ku(g), nettoAusBrutto }), ...abgerechnet];
    const positionen = da ? basisPositionen : [...basisPositionen, ...anrechnungPositionen(m, basisPositionen, { katalog: crm.leistungen, mandate: crm.mandate, rechnungen: plan.rechnungen, nettoAusBrutto }, { kleinunternehmer: ku(g) })];
    if (da) vorhandenIn = null;
    entwurf = neuerEntwurf({
      id, firmaId: g, kunde: kundeAus(empf, m.kunde), titel: `${m.titel || 'Leistung'} — ${monatsName(monat)}${da ? ' (abgerechnete Zusatzmodule)' : ''}`, empfaenger: empf,
      positionen,
      zahlungszielTage: ziel(g, m.zahlungszielTage || undefined), heute, mandatId: m.id, leistungVon: lm.von, leistungBis: lm.bis,
      ...(ang?.nummer ? { angebot: ang.nummer } : {}), ...(ang?.nummer && ang.gestelltAm ? { angebotAm: tagVon(ang.gestelltAm) } : {}),
      ...(k ? { kontaktId: k.id } : {}), ...(f ? { kundeFirmaId: f.id } : {}), ...(m.ustSatz === 0 && !ku(g) ? { steuerHinweis: 'reverse-charge' as const } : {}),
      einleitung: EINLEITUNG_VORLAGE, schluss: SCHLUSS_VORLAGE,
    }, { kleinunternehmer: ku(g) });
  } else {
    const m = typeof p.mandatId === 'string' ? crm.mandate.find(x => x.id === p.mandatId && !x.geloeschtAm) : undefined;
    const k = kontakt(p.kontaktId) ?? (m ? m.kontaktIds.map(kontakt).find(Boolean) : undefined);
    const f = firma(p.kundeFirmaId) ?? firma(k?.firmaId) ?? firma(m?.firmaId);
    const g = istGesellschaft(p.firmaId) ? p.firmaId : gesellschaftFuer(m?.gesellschaft);
    const empf = k || f ? empfaengerAusCrm(k, f) : undefined;
    const zielFirma = f?.zahlung?.zielTage ?? k?.zahlung?.zielTage ?? m?.zahlungszielTage;
    // Vorbelegung aus einem abgelegten Angebot (3.13): EINE Position aus dem Bruttobetrag, dazu Angebotsnummer und -datum.
    const vl = vorlageSaeubern(p.vorlage);
    const kuG = g ? ku(g) : false;
    const titel = vl?.titel || m?.titel || 'Rechnung';
    entwurf = neuerEntwurf({
      id, firmaId: g as Gesellschaftskennung, kunde: kundeAus(empf, m?.kunde ?? 'Kunde'), titel, ...(empf ? { empfaenger: empf } : {}),
      zahlungszielTage: g ? ziel(g, zielFirma || undefined) : zielFirma, heute, ...(m ? { mandatId: m.id } : {}),
      ...(vl?.bruttoCent ? { positionen: [positionAusBrutto(titel, vl.bruttoCent, { kleinunternehmer: kuG, nettoAusBrutto })] } : {}),
      ...(vl?.angebot ? { angebot: vl.angebot } : {}), ...(vl?.angebotAm ? { angebotAm: vl.angebotAm } : {}),
      ...(k ? { kontaktId: k.id } : {}), ...(f ? { kundeFirmaId: f.id } : {}), einleitung: EINLEITUNG_VORLAGE, schluss: SCHLUSS_VORLAGE,
    }, { kleinunternehmer: kuG });
  }
  if (!inSicht(entwurf, p.sicht)) throw new RechnungFehler('Kein Zugang zu dieser Gesellschaft — dieses Konto sieht nur die Business-Gesellschaften.', 403);

  let gespeichert: Rechnung | null = null;
  let schonDa: Rechnung | null = null;
  const finde = vorhandenIn as ((l: Rechnung[]) => Rechnung | undefined) | null;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    // Zwei gleichzeitige „aus Angebot/Mandat“: der zweite bekommt den ersten Entwurf (kein Doppel).
    const da = finde?.(f.rechnungen);
    if (da && cur) { schonDa = da; return cur; }
    if (sperreEinmal && einmalSchon(f.rechnungen, sperreEinmal)) throw new RechnungFehler(EINMAL_SCHON, 409, { grund: 'einmalposten-schon' });
    // Anrechnung (P3): steht sie inzwischen auf einer anderen gültigen Rechnung (zwei gleichzeitige Entwürfe), kommt sie hier nicht noch einmal.
    const schonAngerechnet = new Set(f.rechnungen.filter(r => r.status !== 'storniert' && r.art !== 'storno').flatMap(r => (r.positionen ?? []).filter(istAnrechnung).map(x => x.id)));
    if (entwurf.positionen?.some(x => istAnrechnung(x) && schonAngerechnet.has(x.id))) {
      const pos = entwurf.positionen.filter(x => !(istAnrechnung(x) && schonAngerechnet.has(x.id)));
      entwurf = { ...entwurf, positionen: pos, ...betragFelder(pos, { kleinunternehmer: !!gs.find(x => x.id === entwurf.firmaId)?.kleinunternehmer }) };
    }
    const sauber = sauberFile({ rechnungen: [entwurf] }).rechnungen[0];
    const neu = ugFirmaNachziehen({ ...f, rechnungen: [...f.rechnungen, sauber] });
    const grenze = ueberGrenze(neu, f);
    if (grenze) throw new RechnungFehler(grenze, 413);
    gespeichert = sauber;
    return neu;
  });
  const da = schonDa as Rechnung | null;
  if (da) return { rechnung: mitFassung(da), vorhanden: true };
  const r = gespeichert as Rechnung | null;
  if (!r) throw new RechnungFehler('Nicht angelegt.', 500);
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'neu', id: r.id, felder: Object.keys(r).filter(k => k !== 'id') }], p.wer);
  return { rechnung: mitFassung(r), vorhanden: false };
}

/**
 * Abgerechnete Zusatzmodule (P3) an einen offenen Entwurf hängen — in der Sperre: nur, solange er „geplant“ ist; ein Modul, das schon darauf steht,
 * wird ersetzt (gleiche Kennung), sonst angehängt; die Beträge kommen wieder aus den Positionen.
 */
async function abgerechnetAnhaengen(id: string, neu: RechnungPosition[], z: { haushalt: string; sicht: Sicht; wer?: Wer; kleinunternehmer: boolean }): Promise<{ rechnung: Rechnung & { fassung: string }; vorhanden: boolean }> {
  let ergebnis: Rechnung | null = null;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const alt = f.rechnungen.find(r => r.id === id);
    if (!alt || !inSicht(alt, z.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    if (alt.status !== 'geplant') throw new RechnungFehler('Der Entwurf wurde inzwischen gestellt — bitte noch einmal „abrechnen“ (es entsteht dann eine eigene Rechnung).', 409, { aktuell: mitFassung(alt) });
    const ids = new Set(neu.map(x => x.id));
    const pos = [...(alt.positionen ?? []).filter(x => !ids.has(x.id)), ...neu];
    const r = sauberFile({ rechnungen: [{ ...alt, positionen: pos, ...betragFelder(pos, { kleinunternehmer: z.kleinunternehmer }) }] }).rechnungen[0];
    const grenze = ueberGrenze({ ...f, rechnungen: f.rechnungen.map(x => (x.id === id ? r : x)) }, f);
    if (grenze) throw new RechnungFehler(grenze, 413);
    ergebnis = r;
    return ugFirmaNachziehen({ ...f, rechnungen: f.rechnungen.map(x => (x.id === id ? r : x)) });
  });
  const r = ergebnis as Rechnung | null;
  if (!r) throw new RechnungFehler('Nicht gespeichert.', 500);
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: r.id, felder: ['positionen', 'betrag', 'netto'] }], z.wer);
  return { rechnung: mitFassung(r), vorhanden: true };
}

// ── Entwurf ändern / löschen ─────────────────────────────────────────────────

function standPruefen(r: Rechnung, stand: unknown) {
  if (typeof stand !== 'string' || !stand) throw new RechnungFehler('Stand fehlt — ohne Stand wird eine bestehende Rechnung nicht geändert.', 409, { aktuell: mitFassung(r), grund: 'ohne Stand' });
  if (fassung(r) !== stand) throw new RechnungFehler('Wurde inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.', 409, { aktuell: mitFassung(r), grund: 'inzwischen geändert' });
}

export async function entwurfSpeichern(p: { id: string; felder: Record<string, unknown>; stand: unknown; haushalt: string; sicht: Sicht; wer?: Wer; anFirma?: { basis: string | null } }): Promise<Rechnung & { fassung: string; anFirma?: AnschriftAnFirma }> {
  const zuLang = entwurfGrenzen(p.felder);
  if (zuLang.length) throw new RechnungFehler(zuLang.join(' · '), 413);
  if (istGesellschaft(p.felder.firmaId) && !gesellschaftInSicht(p.felder.firmaId, p.sicht)) throw new RechnungFehler('Kein Zugang zu dieser Gesellschaft.', 403);
  const gs = await gesellschaften(p.haushalt);
  let ergebnis: Rechnung | null = null;
  let vorher: Rechnung | null = null;
  let felder: string[] = [];
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const alt = f.rechnungen.find(r => r.id === p.id);
    if (!alt || !inSicht(alt, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    if (alt.status !== 'geplant') throw new RechnungFehler(`Die Rechnung ${alt.nummer ?? ''} ist ${alt.status} — festgeschrieben. Ändern nur über Storno und neue Rechnung.`.replace('  ', ' '), 409, { aktuell: mitFassung(alt), grund: 'gestellt' });
    standPruefen(alt, p.stand);
    const g = istGesellschaft(p.felder.firmaId) ? p.felder.firmaId : alt.firmaId;
    const neu = sauberFile({ rechnungen: [entwurfAnwenden(alt, p.felder, { kleinunternehmer: !!gs.find(x => x.id === g)?.kleinunternehmer })] }).rechnungen[0];
    const grund = rechnungSchutz(alt, neu);
    if (grund) throw new RechnungFehler(grund, 409, { aktuell: mitFassung(alt) });
    felder = Object.keys({ ...alt, ...neu }).filter(k => JSON.stringify((alt as unknown as Record<string, unknown>)[k]) !== JSON.stringify((neu as unknown as Record<string, unknown>)[k]));
    ergebnis = neu;
    vorher = alt;
    return ugFirmaNachziehen({ ...f, rechnungen: f.rechnungen.map(r => (r.id === p.id ? neu : r)) });
  });
  const r = ergebnis as Rechnung | null;
  if (!r) throw new RechnungFehler('Nicht gespeichert.', 500);
  if (felder.length) await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: r.id, felder }], p.wer);
  const v = vorher as Rechnung | null;
  const anFirma = v ? await anschriftAnFirma(v, r, p.wer, p.anFirma ? { ueberschreiben: p.anFirma } : {}) : null;
  return { ...mitFassung(r), ...(anFirma ? { anFirma } : {}) };
}

/**
 * Rechnungsanschrift an der Firma speichern (Kevin 18.10.: „An der Firma speichern“): wurde im Entwurf die Anschrift eingegeben bzw.
 * geändert, übernimmt der Server sie in die Zahlungsdaten der Kundenfirma (`Firma.zahlung.empfaenger.anschrift` — dieselbe Stelle, aus der
 * `empfaengerAusCrm` den nächsten Entwurf vorbelegt). Die Firma: `kundeFirmaId` der Rechnung, sonst die des Mandats. Nur über den
 * CRM-Schreibweg (`aendereCrm`, Änderungsprotokoll mit Kennung und Feldnamen, nie Werten), nur dieses eine Feld (der Rest der
 * Zahlungsdaten bleibt, wie er gespeichert ist — auch die IBAN); nie bei einer Firma im Papierkorb; Kontakte ohne Firma: nichts.
 * Nur eine vollständige Anschrift, die beim Zurücklesen genau so herauskommt (`anschriftFuerFirma`). Wirft nie — die Rechnung ist
 * schon gespeichert; scheitert es, bleibt die Firma, wie sie war (Log).
 * 19.10. (Rundgang B12, Regel des Auftrags): eine VORHANDENE, andere Anschrift der Firma wird nie still überschrieben — nur, wenn die Firma noch keine
 * hat, oder mit dem ausdrücklichen Haken „an der Firma speichern“ (`ueberschreiben.basis` = die Anschrift, die der Haken gesehen hat; steht inzwischen
 * eine andere an der Firma, bleibt sie — wie ein Stand). Sonst `abweichend` mit der Anschrift der Firma (die Oberfläche bietet den Haken an).
 * `alt` = null: beim Stellen — füllt nur eine Firma ohne Anschrift (ein Entwurf, dessen Anschrift nie geändert wurde, z. B. aus dem Angebot).
 */
export async function anschriftAnFirma(alt: Rechnung | null, neu: Rechnung, wer?: Wer, opt: { ueberschreiben?: { basis: string | null } } = {}): Promise<AnschriftAnFirma | null> {
  const ueber = alt ? opt.ueberschreiben : undefined;
  if (alt && (neu.status !== 'geplant' || (anschriftGleich(anschriftVon(alt.empfaenger), anschriftVon(neu.empfaenger)) && !ueber))) return null;
  const text = anschriftFuerFirma(neu.empfaenger);
  if (!text) return null;
  try {
    const { ladeCrm, aendereCrm } = await import('@/lib/crm/speicher');
    const firmaId = neu.kundeFirmaId ?? (neu.mandatId ? (await ladeCrm()).mandate.find(m => m.id === neu.mandatId)?.firmaId : undefined);
    if (!firmaIdOk(firmaId)) return null;
    const jetzt = new Date().toISOString();
    const person = wer?.person && /^[a-z0-9-]{1,40}$/.test(wer.person) ? wer.person : undefined;
    let ergebnis: AnschriftAnFirma | null = null;
    await aendereCrm(b => {
      const f = b.firmen.find(x => x.id === firmaId);
      if (!f || f.geloeschtAm) return b;
      const daStehtText = (f.zahlung?.empfaenger?.anschrift ?? '').trim();
      const daSteht = anschriftVon(anschriftZerlegen(daStehtText));
      if (anschriftGleich(daSteht, anschriftZerlegen(text))) { ergebnis = { stand: 'gleich' }; return b; }
      const leer = !daSteht.strasse && !daSteht.plz && !daSteht.ort;
      const mitHaken = !!ueber && anschriftGleich(daSteht, anschriftZerlegen(ueber.basis ?? ''));
      if (!leer && !mitHaken) { ergebnis = { stand: 'abweichend', firma: daStehtText }; return b; }
      const wann = { geaendert: jetzt, ...(person ? { geaendertVon: person } : {}) };
      const zahlung = { ...(f.zahlung ?? {}), empfaenger: { ...(f.zahlung?.empfaenger ?? {}), anschrift: text }, ...wann };
      ergebnis = { stand: 'gespeichert' };
      return { ...b, firmen: b.firmen.map(x => (x.id === f.id ? { ...x, zahlung, ...wann } : x)) };
    }, wer);
    return ergebnis;
  } catch (e) {
    console.error('[rechnung] Anschrift nicht an der Firma gespeichert:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Einen Entwurf löschen (nur „geplant“, ohne Nummer) — gestellte Rechnungen werden storniert, nie gelöscht. */
export async function entwurfLoeschen(p: { id: string; stand: unknown; sicht: Sicht; wer?: Wer }): Promise<void> {
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const alt = f.rechnungen.find(r => r.id === p.id);
    if (!alt || !inSicht(alt, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    const grund = rechnungSchutz(alt, null);
    if (grund || alt.lauf || alt.pdfDateiId) throw new RechnungFehler(grund ?? 'Die Rechnung trägt schon eine Nummer — sie wird storniert, nicht gelöscht.', 409, { aktuell: mitFassung(alt) });
    standPruefen(alt, p.stand);
    return { ...f, rechnungen: f.rechnungen.filter(r => r.id !== p.id) };
  });
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geloescht', id: p.id }], p.wer);
}

// ── Stellen ──────────────────────────────────────────────────────────────────

async function logoLaden(haushalt: string, g: Gesellschaft): Promise<PdfLogo | null> {
  if (!g.logoDateiId) return null;
  const { lesen } = await import('@/lib/dateien/ablage');
  const d = await lesen(haushalt, g.logoDateiId).catch(() => null);
  return d && (d.eintrag.datei?.typ === 'image/png' || d.eintrag.datei?.typ === 'image/jpeg') ? { bytes: new Uint8Array(d.bytes), typ: d.eintrag.datei.typ } : null;
}

/** PDFs einer NICHT gestellten Rechnung (Abbruch zwischen Ablegen und Festschreiben) aus der Ablage nehmen. In der Finanzplan-Sperre aufrufen. */
async function verwaistePdfsEntfernen(haushalt: string, rechnungId: string): Promise<number> {
  const { ablageName, inhaltEntfernen } = await import('@/lib/dateien/ablage');
  if ((await loadJson(ablageName(haushalt))) === null) return 0;
  let weg: string[] = [];
  await updateJson<{ eintraege: { id: string; rechnungsPdf?: string }[] }>(ablageName(haushalt), cur => {
    const l = cur?.eintraege ?? [];
    weg = l.filter(x => x.rechnungsPdf === rechnungId).map(x => x.id);
    return weg.length ? { ...(cur ?? {}), eintraege: l.filter(x => !weg.includes(x.id)) } : (cur ?? { eintraege: [] });
  });
  for (const id of weg) await inhaltEntfernen(haushalt, id);
  return weg.length;
}

export interface StellenErgebnis { rechnung: Rechnung & { fassung: string }; pdf: { id: string; name: string }; mail: { an?: string; betreff: string; text: string } }

/** 409 mit der Liste der fehlenden Pflichtangaben (und dem Weg, sie zu beheben). */
const pflichtFehler = (fehlt: Pflicht[]) => new RechnungFehler(`Nicht gestellt — es fehlen Pflichtangaben: ${fehlt.map(f => f.text).join(' ')}`, 409, { fehlt, grund: 'pflichtangaben' });

export async function rechnungStellen(p: { id: string; stand: unknown; person: string; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<StellenErgebnis> {
  const jetzt = p.jetzt ?? new Date();
  const jetztIso = jetzt.toISOString();
  const heute = localDay(jetzt);
  const jahr = Number(heute.slice(0, 4));

  // 1. Vorprüfung ohne Sperre.
  const r0 = (await planLaden()).rechnungen.find(r => r.id === p.id);
  if (!r0 || !inSicht(r0, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
  if (r0.status !== 'geplant') throw new RechnungFehler(`Schon gestellt (${r0.nummer ?? r0.status}).`, 409, { aktuell: mitFassung(r0), grund: 'gestellt' });
  standPruefen(r0, p.stand);
  if (!istGesellschaft(r0.firmaId)) throw pflichtFehler(pflichtFehlt(r0, null));
  const g = (await gesellschaften(p.haushalt)).find(x => x.id === r0.firmaId) ?? { id: r0.firmaId };
  const fehlt = pflichtFehlt(r0, g);
  if (fehlt.length) throw pflichtFehler(fehlt);
  const v = mitVorgaben(g);
  const ku = !!g.kleinunternehmer;
  const logo = await logoLaden(p.haushalt, g);
  const stand = fassung(r0);

  let ergebnis: { r: Rechnung; pdf: { id: string; name: string } } | null = null;
  // 2. In der Sperre des Nummernkreises — nacheinander, lückenlos.
  await updateJsonAsync<Rechnungswesen>(RECHNUNGSWESEN, async cur => {
    const plan = await planLaden();
    const a = plan.rechnungen.find(r => r.id === p.id);
    if (!a || a.status !== 'geplant' || fassung(a) !== stand) throw new RechnungFehler('Wurde inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.', 409, { ...(a ? { aktuell: mitFassung(a) } : {}), grund: 'inzwischen geändert' });
    const schluessel = kreisSchluessel(r0.firmaId as Gesellschaftskennung, jahr);
    const { lauf, nummer } = naechsteNummer(plan.rechnungen, cur?.zaehler?.[schluessel], r0.firmaId as Gesellschaftskennung, jahr, kurzVon(g));
    const positionen = (a.positionen ?? []).map(x => (ku ? { ...x, ustSatz: 0 } : { ...x }));
    const ziel = a.zahlungszielTage ?? v.zahlungszielTage;
    const bf = betragFelder(positionen, { kleinunternehmer: ku });
    const gestellt: Rechnung = {
      ...a, ...bf, positionen, status: 'gestellt', nummer, datum: heute,
      faellig: new Date(Date.parse(`${heute}T12:00:00Z`) + ziel * 864e5).toISOString().slice(0, 10), zahlungszielTage: ziel,
      lauf, absender: absenderAus(g), gestelltAm: jetztIso, gestelltVon: p.person,
      ...(ku ? { steuerHinweis: undefined, steuerfreiGrund: undefined } : {}),
    };
    // Mehrere Steuersätze: kein einzelner Satz am Eintrag — Steuern rechnen dann mit `netto` (lib/steuern/rechnen.ts).
    if (bf.ustSatz === undefined) delete gestellt.ustSatz;
    // b) Außerhalb der Finanzplan-Sperre: das PDF und seine Prüfsumme.
    const bytes = Buffer.from(await belegPdf(rechnungDokument(gestellt, absenderAus(g, { ibanVoll: true }), { datum: heute, bank: bankZeile(g.bank), kleinunternehmer: ku }), { logo, erstellt: jetzt }));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await rechnungTest.nachPdf?.();
    const name = `Rechnung ${nummer}.pdf`.replace(/[\\/]/g, '-');
    // c) Festschreiben in der Finanzplan-Sperre (Stand erneut geprüft); erst jetzt das PDF ablegen — danach ist es ein Beleg.
    await updateJsonAsync<FinanzplanFile>('finanzplan', async curPlan => {
      const f = planBasis(curPlan);
      const b = f.rechnungen.find(r => r.id === p.id);
      if (!b || b.status !== 'geplant' || fassung(b) !== stand) throw new RechnungFehler('Wurde inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.', 409, { ...(b ? { aktuell: mitFassung(b) } : {}), grund: 'inzwischen geändert' });
      await verwaistePdfsEntfernen(p.haushalt, p.id);
      const { ablegen } = await import('@/lib/dateien/ablage');
      const datei = await ablegen(p.haushalt, p.person, {
        art: 'rechnung', titel: `Rechnung ${nummer} – ${gestellt.titel}`.slice(0, 160), ...(gestellt.kontaktId ? { kontaktId: gestellt.kontaktId } : {}),
        ...(gestellt.kundeFirmaId ? { firmaId: gestellt.kundeFirmaId } : {}), ...(gestellt.mandatId ? { mandatId: gestellt.mandatId } : {}),
      }, { bytes, name, typ: 'application/pdf' }, jetztIso, { rechnungsPdf: p.id });
      await rechnungTest.nachAblage?.();
      const fertig = sauberFile({ rechnungen: [{ ...gestellt, pdfDateiId: datei.id, sha256 }] }).rechnungen[0];
      ergebnis = { r: fertig, pdf: { id: datei.id, name } };
      return ugFirmaNachziehen({ ...f, rechnungen: f.rechnungen.map(r => (r.id === p.id ? fertig : r)) });
    });
    await rechnungTest.nachFestschreiben?.();
    // d) Zähler: höchste vergebene Nummer dieses Kreises.
    return { ...(cur ?? {}), zaehler: { ...(cur?.zaehler ?? {}), [schluessel]: Math.max(cur?.zaehler?.[schluessel] ?? 0, lauf.nr) } };
  });
  const e = ergebnis as { r: Rechnung; pdf: { id: string; name: string } } | null;
  if (!e) throw new RechnungFehler('Nicht gestellt.', 500);
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: e.r.id, felder: ['status', 'nummer', 'datum', 'faellig', 'pdfDateiId', 'sha256', 'absender', 'lauf'] }], p.wer);
  // Rechnungsanschrift an der Firma (19.10., B12): beim Stellen füllt die Anschrift eine Firma, die noch keine hat — nie überschrieben.
  await anschriftAnFirma(null, e.r, p.wer);
  return { rechnung: mitFassung(e.r), pdf: e.pdf, mail: { ...(e.r.empfaenger?.email ? { an: e.r.empfaenger.email } : {}), ...rechnungMail(e.r, v.name) } };
}

// ── Storno = Stornorechnung ──────────────────────────────────────────────────

export interface StornoErgebnis { original: Rechnung & { fassung: string }; storno: Rechnung & { fassung: string }; pdf: { id: string; name: string } | null; gegenbuchung: 'neu' | 'vorhanden' | 'keine'; schonStorniert: boolean }

/**
 * Eine gestellte (oder bezahlte) Rechnung MIT PDF stornieren: Stornorechnung mit eigener Nummer aus demselben Kreis, negativ,
 * Bezug auf das Original, eigenes PDF; das Original wird „storniert“ (Datum, Grund, Verweis), ein vorhandener Zahlungseingang
 * bekommt die Gegenbuchung `bu-st-<id>`. Alles in derselben Abfolge wie „Stellen“ (Nummernkreis-Sperre → PDF → Finanzplan-Sperre).
 * Schon storniert mit Stornorechnung → dieselbe Antwort (idempotent). Rechnungen ohne PDF storniert weiter der Finanzplan-Weg.
 */
export async function rechnungStornieren(p: { id: string; grund: unknown; stand?: unknown; person: string; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<StornoErgebnis> {
  const jetzt = p.jetzt ?? new Date();
  const jetztIso = jetzt.toISOString();
  const heute = localDay(jetzt);
  const jahr = Number(heute.slice(0, 4));
  const grund = String(p.grund ?? '').replace(/\s+/g, ' ').trim();
  const o0 = (await planLaden()).rechnungen.find(r => r.id === p.id);
  if (!o0 || !inSicht(o0, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
  if (o0.art === 'storno') throw new RechnungFehler('Eine Stornorechnung wird nicht storniert.', 409);
  if (o0.status === 'storniert') {
    const s = o0.stornoRechnungId ? (await planLaden()).rechnungen.find(r => r.id === o0.stornoRechnungId) : undefined;
    if (s) return { original: mitFassung(o0), storno: mitFassung(s), pdf: s.pdfDateiId ? { id: s.pdfDateiId, name: `Stornorechnung ${s.nummer}.pdf` } : null, gegenbuchung: 'keine', schonStorniert: true };
    throw new RechnungFehler('Die Rechnung ist schon storniert.', 409, { aktuell: mitFassung(o0) });
  }
  if (o0.status === 'geplant') throw new RechnungFehler('Ein Entwurf wird gelöscht, nicht storniert.', 409, { aktuell: mitFassung(o0) });
  if (!o0.pdfDateiId) throw new RechnungFehler('Diese Rechnung hat kein PDF aus MAKE OS — sie storniert der bisherige Weg (Finanzen › Rechnungen & Zahlungen).', 409, { grund: 'ohne-pdf' });
  if (grund.length < 3) throw new RechnungFehler('Bitte einen Grund für das Storno angeben.', 400);
  if (grund.length > 300) throw new RechnungFehler('Grund ist länger als 300 Zeichen — nichts gekürzt, bitte kürzen.', 413);
  if (p.stand !== undefined) standPruefen(o0, p.stand);
  if (!istGesellschaft(o0.firmaId)) throw new RechnungFehler('Die Rechnung gehört zu keiner festen Gesellschaft.', 409);
  const g = (await gesellschaften(p.haushalt)).find(x => x.id === o0.firmaId) ?? { id: o0.firmaId };
  // Für die Stornorechnung braucht es denselben Absender wie fürs Original (Pflichtangaben im Kopf/Fuß).
  const absFehlt = pflichtFehlt({ ...o0, status: 'geplant' } as Rechnung, g).filter(x => x.weg);
  if (absFehlt.length) throw pflichtFehler(absFehlt);
  const ku = !!g.kleinunternehmer;
  const logo = await logoLaden(p.haushalt, g);
  const stand = fassung(o0);

  let ergebnis: { o: Rechnung; s: Rechnung; pdf: { id: string; name: string }; gegen: 'neu' | 'vorhanden' | 'keine' } | null = null;
  await updateJsonAsync<Rechnungswesen>(RECHNUNGSWESEN, async cur => {
    const plan = await planLaden();
    const o = plan.rechnungen.find(r => r.id === p.id);
    if (!o || fassung(o) !== stand) throw new RechnungFehler('Wurde inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.', 409, { ...(o ? { aktuell: mitFassung(o) } : {}), grund: 'inzwischen geändert' });
    const schluessel = kreisSchluessel(o.firmaId as Gesellschaftskennung, jahr);
    const { lauf, nummer } = naechsteNummer(plan.rechnungen, cur?.zaehler?.[schluessel], o.firmaId as Gesellschaftskennung, jahr, kurzVon(g));
    const s: Rechnung = { ...stornoEntwurf(o, { id: neueKennung('r'), heute, grund, kleinunternehmer: ku }), nummer, lauf, absender: absenderAus(g), gestelltAm: jetztIso, gestelltVon: p.person };
    const bytes = Buffer.from(await belegPdf(rechnungDokument(s, absenderAus(g, { ibanVoll: true }), { datum: heute, kleinunternehmer: ku, original: o }), { logo, erstellt: jetzt }));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await rechnungTest.nachPdf?.();
    const name = `Stornorechnung ${nummer}.pdf`.replace(/[\\/]/g, '-');
    await updateJsonAsync<FinanzplanFile>('finanzplan', async curPlan => {
      const f = planBasis(curPlan);
      const b = f.rechnungen.find(r => r.id === p.id);
      if (!b || fassung(b) !== stand) throw new RechnungFehler('Wurde inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.', 409, { grund: 'inzwischen geändert' });
      await verwaistePdfsEntfernen(p.haushalt, s.id);
      const { ablegen } = await import('@/lib/dateien/ablage');
      const datei = await ablegen(p.haushalt, p.person, {
        art: 'rechnung', titel: `Stornorechnung ${nummer} zu ${b.nummer ?? ''}`.slice(0, 160), ...(b.kontaktId ? { kontaktId: b.kontaktId } : {}),
        ...(b.kundeFirmaId ? { firmaId: b.kundeFirmaId } : {}), ...(b.mandatId ? { mandatId: b.mandatId } : {}),
      }, { bytes, name, typ: 'application/pdf' }, jetztIso, { rechnungsPdf: s.id });
      await rechnungTest.nachAblage?.();
      const sFertig = sauberFile({ rechnungen: [{ ...s, pdfDateiId: datei.id, sha256 }] }).rechnungen[0];
      const oFertig: Rechnung = { ...b, status: 'storniert', storniertAm: heute, stornoGrund: grund, stornoRechnungId: sFertig.id };
      // Zahlungseingang vorhanden → Gegenbuchung (derselbe Weg wie der Finanzplan-Storno, idempotent).
      const gegen = await gegenbuchungAnlegen(oFertig, heute);
      ergebnis = { o: sauberFile({ rechnungen: [oFertig] }).rechnungen[0], s: sFertig, pdf: { id: datei.id, name }, gegen };
      return ugFirmaNachziehen({ ...f, rechnungen: [...f.rechnungen.map(r => (r.id === p.id ? ergebnis!.o : r)), sFertig] });
    });
    await rechnungTest.nachFestschreiben?.();
    return { ...(cur ?? {}), zaehler: { ...(cur?.zaehler ?? {}), [schluessel]: Math.max(cur?.zaehler?.[schluessel] ?? 0, lauf.nr) } };
  });
  const e = ergebnis as { o: Rechnung; s: Rechnung; pdf: { id: string; name: string }; gegen: 'neu' | 'vorhanden' | 'keine' } | null;
  if (!e) throw new RechnungFehler('Nicht storniert.', 500);
  await protokolliere('finanzplan', [
    { liste: 'rechnungen', op: 'geaendert', id: e.o.id, felder: ['status', 'storniertAm', 'stornoGrund', 'stornoRechnungId'] },
    { liste: 'rechnungen', op: 'neu', id: e.s.id, felder: ['art', 'stornoZu', 'nummer', 'pdfDateiId', 'sha256'] },
  ], p.wer);
  return { original: mitFassung(e.o), storno: mitFassung(e.s), pdf: e.pdf, gegenbuchung: e.gegen, schonStorniert: false };
}

// ── Mahnungen (Vorschlag; vermerkt erst beim Versand per Klick) ──────────────

/**
 * Eine Mahnstufe als „verschickt“ vermerken und den Mail-Entwurf liefern — der Browser öffnet ihn im Mail-Programm (MAKE OS
 * verschickt nichts). Nur gestellte Rechnungen, Stufen nur der Reihe nach; dieselbe Stufe noch einmal = derselbe Entwurf (idempotent).
 */
export async function mahnungVermerken(p: { id: string; stufe: unknown; person: string; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<{ rechnung: Rechnung & { fassung: string }; mail: { an?: string; betreff: string; text: string } }> {
  const heute = localDay(p.jetzt ?? new Date());
  const stufe = Number(p.stufe);
  if (stufe !== 1 && stufe !== 2 && stufe !== 3) throw new RechnungFehler('Mahnstufe 1, 2 oder 3.', 400);
  const gs = await gesellschaften(p.haushalt);
  let ergebnis: Rechnung | null = null;
  let neu = false;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const r = f.rechnungen.find(x => x.id === p.id);
    if (!r || !inSicht(r, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    if (r.art === 'storno' || r.status !== 'gestellt') throw new RechnungFehler(r.status === 'bezahlt' ? 'Die Rechnung ist schon bezahlt — keine Mahnung.' : `Gemahnt wird nur eine gestellte, offene Rechnung (diese ist ${r.status}).`, 409, { aktuell: mitFassung(r) });
    const bisher = mahnstufeVon(r);
    if (stufe <= bisher) { ergebnis = r; return f; }
    if (stufe !== bisher + 1) throw new RechnungFehler(`Erst ${mahnLabel((bisher + 1) as Mahnstufe)} — Mahnstufen gehen der Reihe nach.`, 409, { aktuell: mitFassung(r) });
    const n: Rechnung = { ...r, mahnungen: [...(r.mahnungen ?? []), { stufe: stufe as Mahnstufe, am: heute, von: p.person }] };
    ergebnis = sauberFile({ rechnungen: [n] }).rechnungen[0];
    neu = true;
    return { ...f, rechnungen: f.rechnungen.map(x => (x.id === p.id ? ergebnis! : x)) };
  });
  const r = ergebnis as Rechnung | null;
  if (!r) throw new RechnungFehler('Nicht vermerkt.', 500);
  if (neu) await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: r.id, felder: ['mahnungen'] }], p.wer);
  const g = gs.find(x => x.id === r.firmaId);
  const name = g ? mitVorgaben(g).name : undefined;
  return { rechnung: mitFassung(r), mail: { ...(r.empfaenger?.email ? { an: r.empfaenger.email } : {}), ...mahnMail(stufe as Mahnstufe, r, { heute, ...(name ? { absender: name } : {}) }) } };
}

export async function mahnTageSetzen(roh: unknown): Promise<[number, number, number]> {
  const t = mahnTageSaeubern(roh);
  if (!t) throw new RechnungFehler('Mahnstufen: drei steigende Tageszahlen zwischen 1 und 365 (z. B. 7 · 14 · 21).', 400);
  await updateJson<Rechnungswesen>(RECHNUNGSWESEN, cur => ({ ...(cur ?? {}), mahnTage: t }));
  return t;
}

/**
 * Morgenlauf (08.10.): je fälligem Mahnvorschlag EINE Aufgabe (feste Kennung `mahn-<rechnung>-<stufe>`) über den Aufgaben-Schreibweg —
 * gibt es sie schon (auch erledigt oder im Papierkorb), passiert nichts. Titel ohne Betrag und ohne Namen (Glocke, Telegram).
 * Versand bleibt ein Klick in Finanzen › Rechnungen & Zahlungen. Wirft nie.
 */
export async function mahnAufgabenNachziehen(heute = localDay()): Promise<{ neu: number }> {
  try {
    const tage = await mahnTageLaden();
    const plan = await planLaden();
    const faellig: (MahnVorschlag & { r: Rechnung })[] = mahnVorschlaege(plan.rechnungen, heute, tage).map(v => ({ ...v, r: plan.rechnungen.find(r => r.id === v.rechnungId)! }));
    if (!faellig.length) return { neu: 0 };
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    const jetzt = new Date().toISOString();
    let neu = 0;
    await systemAufgabenAendern(stand => {
      const da = new Set(stand.tasks.map(t => t.id));
      const fehlen = faellig.filter(v => !da.has(mahnAufgabeId(v.rechnungId, v.stufe)));
      neu = fehlen.length;
      return {
        neu: fehlen.map(v => ({
          id: mahnAufgabeId(v.rechnungId, v.stufe), title: `${v.label} vorbereiten — Rechnung ${v.nummer ?? ''}`.trim(),
          description: `Die Rechnung ist seit ${v.tageUeberfaellig} Tagen überfällig. Entwurf ansehen und per Klick verschicken (Finanzen › Rechnungen & Zahlungen).`,
          notiz: `[Rechnung öffnen](${WEG.rechnung(v.rechnungId)})`, status: 'todo', priority: 'high', assignee: 'both', dueDate: heute,
          tags: ['rechnung', 'mahnung'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt,
          space: bereichVon(v.r.firmaId), ...(istGesellschaft(v.r.firmaId) ? { spaceId: v.r.firmaId } : {}),
        })),
      };
    }, { jetzt });
    return { neu };
  } catch (e) {
    console.error('[rechnung] Mahn-Aufgaben nicht angelegt:', e instanceof Error ? e.message : e);
    return { neu: 0 };
  }
}

/** Art. 15: die Rechnungen, die an diese Person adressiert sind (Kartei-Verweis) — Nummer, Datum, Status, Betrag. */
export async function rechnungenAuskunft(kontaktId: string) {
  return (await planLaden()).rechnungen.filter(r => r.kontaktId === kontaktId)
    .map(r => ({ id: r.id, ...(r.nummer ? { nummer: r.nummer } : {}), titel: r.titel, status: r.status, ...(r.datum ? { datum: r.datum } : {}), betrag: r.betrag, ...(r.art ? { art: r.art } : {}) }));
}

/** Für Tests und den Bericht: Summen einer Rechnung in Cent. */
export const summenVon = (r: Rechnung, ku = false) => rechnungSummen(r.positionen ?? [], { kleinunternehmer: ku, vorzeichen: r.art === 'storno' ? -1 : 1 });
