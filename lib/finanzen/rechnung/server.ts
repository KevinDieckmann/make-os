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
import { BUSINESS_GESELLSCHAFTEN, bereichVon, bereichVonFirma, gesellschaftAusEinheit, istBusinessGesellschaft, istGesellschaft, istRegisterKennung, NUR_GRUNDDATEN, type Gesellschaftskennung } from '@/lib/einheiten';
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
  vorlageSaeubern, positionAusBrutto, leistungsmonat, mandatMonatVorgabe, abgerechneteMonate, rechnungsMonate, ausserhalbLaufzeit, anschriftVon, anschriftGleich, anschriftFuerFirma, anschriftZerlegen, faelligAm,
  istZugeordnet, ZUORDNUNG_FEHLT, ZUORDNUNG_NACHTRAGEN, empfaengerSaeubern, startnummerPruefen,
  type MahnVorschlag, type Pflicht, type Zuordnung,
} from './regeln';
import { angenommenZuDeal, angebotEinmalRest, angebotTitelFuerFolge } from '@/lib/crm/angebote';
import { abrechnenPositionen, abrechnenWahlAus, anrechnungPositionen, istAnrechnung, monatsPositionen, nurAbgerechnet, zahlplanMonate } from '@/lib/crm/mandat-zusatz';
import type { RechnungPosition } from './typen';
import { rechnungDokument, bankZeile } from './dokument';
import { ciiXml } from '@/lib/finanzen/erechnung/cii';
import { facturXEinbetten } from '@/lib/finanzen/erechnung/pdf';
import { en16931Luecken } from '@/lib/finanzen/erechnung/pruefen';
import type { AnschriftAnFirma, Mahnstufe } from './typen';
import { einmalTeilPositionen, einmalZahlungen, einmalZahlungText, quartalMonate, type EinmalZahlung } from './kreislauf-regeln';
import { jahresHonorarVon, naechstesVertragsjahr } from '@/lib/crm/mandat-laufzeit';

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

/** In welchem Bereich steht eine Rechnung? Der Bereich ihrer Gesellschaft (Selbstständigkeit → Privat, 05.10.) — eine Stelle für Liste und Umleitung. */
export const rechnungBereich = (r: Pick<Rechnung, 'firmaId'>): 'privat' | 'business' => (bereichVonFirma(r.firmaId) === 'privat' ? 'privat' : 'business');

/** Kennung → Name der Zuordnungen (Firma, Person, Mandat) der übergebenen Rechnungen — nur, worauf sie zeigen (30.10.). */
export async function zuordnungsNamen(liste: readonly Zuordnung[]): Promise<Record<string, string>> {
  const firmen = new Set<string>(), personen = new Set<string>(), mandate = new Set<string>();
  for (const r of liste) { if (r.kundeFirmaId) firmen.add(r.kundeFirmaId); if (r.kontaktId) personen.add(r.kontaktId); if (r.mandatId) mandate.add(r.mandatId); }
  if (!firmen.size && !personen.size && !mandate.size) return {};
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }, { anzeigename }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung'), import('@/lib/make-one/crm')]);
  const crm = await ladeCrm();
  const n: Record<string, string> = {};
  for (const f of crm.firmen) if (firmen.has(f.id)) n[f.id] = f.name;
  for (const m of crm.mandate) if (mandate.has(m.id)) n[m.id] = m.titel || m.kunde;
  if (personen.size) for (const k of await kontakteFuerVerarbeitung()) if (personen.has(k.id)) n[k.id] = anzeigename(k);
  return n;
}

/**
 * Lebt die Zuordnung noch (30.10.)? Firma bzw. Mandat im CRM (nicht im Papierkorb), Person in der Kartei (auch eingeschränkte — eine Rechnung zu
 * einem bestehenden Vertrag bleibt möglich). Ein toter Verweis zählt nicht: die Rechnung ist dann nicht zugeordnet.
 */
export async function zuordnungLebt(r: Zuordnung): Promise<boolean> {
  if (!istZugeordnet(r)) return false;
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung')]);
  const crm = await ladeCrm();
  if (r.kundeFirmaId && crm.firmen.some(f => f.id === r.kundeFirmaId && !f.geloeschtAm)) return true;
  if (r.mandatId && crm.mandate.some(m => m.id === r.mandatId && !m.geloeschtAm)) return true;
  if (r.kontaktId && (await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).some(k => k.id === r.kontaktId)) return true;
  return false;
}
/** 409 „nicht zugeordnet“ — nichts gestellt bzw. versendet, keine Nummer verbraucht. */
export const zuordnungFehler = (gestellt = false) => new RechnungFehler(gestellt ? ZUORDNUNG_NACHTRAGEN : ZUORDNUNG_FEHLT, 409, { grund: 'zuordnung' });

/**
 * Alles für die Oberfläche — serverseitig nach Sicht gefiltert (Rechnungen, Absender, Mahnvorschläge). `bereich` (27.10., Rechnungs-Kreislauf):
 * nur die Rechnungen und Absender dieses Bereichs — Business › Rechnungen zeigt keine Rechnung der Selbstständigkeit mehr (sie gehört zu Privat),
 * Privat › Konten & Buchungen › Selbstständigkeit zeigt genau sie. Ein Konto „nur Business“ bekommt immer Business. `re` = die Rechnung, die die
 * Oberfläche öffnen will: steht sie im anderen Bereich (und darf das Konto sie sehen), sagt `ort`, wohin — die Rechnung selbst kommt nicht mit.
 */
export async function rechnungsStand(z: { haushalt: string; sicht: Sicht; bereich?: 'privat' | 'business'; re?: string }, heute = localDay()) {
  const f = await planLaden();
  const bereich = z.sicht === 'business' ? 'business' : z.bereich;
  const imBereich = (id: string) => !bereich || rechnungBereich({ firmaId: id }) === bereich;
  const sichtbar = f.rechnungen.filter(r => inSicht(r, z.sicht));
  const liste = sichtbar.filter(r => imBereich(r.firmaId));
  const tage = await mahnTageLaden();
  const { absenderVorgabe } = await import('@/lib/gesellschaften/server');
  const v = await absenderVorgabe(z.haushalt).catch(() => null);
  const gs = (await gesellschaften(z.haushalt)).filter(g => gesellschaftInSicht(g.id, z.sicht) && imBereich(g.id));
  const anders = z.re && !liste.some(r => r.id === z.re) ? sichtbar.find(r => r.id === z.re) : undefined;
  return {
    rechnungen: liste.map(mitFassung),
    // 30.10. (Zuordnung zur Markttraktion): die Namen der Firmen, Personen und Mandate, an denen die Rechnungen DIESER Liste hängen — für
    // Zeile, Suche und Filter „Ohne Zuordnung“. Nur Verweise der gefilterten Liste, eingeschränkte Personen (Art. 18) ohne Namen.
    namen: await zuordnungsNamen(liste).catch(() => ({})),
    gesellschaften: gs.map(absenderFuerAnzeige),
    vorgabe: v && gesellschaftInSicht(v, z.sicht) && imBereich(v) ? v : gs[0]?.id ?? null,
    mahnTage: tage,
    mahnvorschlaege: mahnVorschlaege(liste, heute, tage),
    // 29.10. (Kreislauf Geld): Stellschraube „Rechnungen vorbereiten“ (Morgenlauf; Vorgabe an).
    vorbereiten: await import('./kreislauf').then(async k => k.vorbereitenAn(await k.kreislaufLaden())).catch(() => true),
    ...(bereich ? { bereich } : {}),
    ...(anders ? { ort: rechnungBereich(anders) } : {}),
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

/**
 * Die XRechnung (CII-Syntax, XRechnung 3.0) einer gestellten Rechnung bzw. Stornorechnung (31.10.) — für Behörden-Kunden zum Hochladen ins
 * Rechnungsportal. Nichts wird geschrieben; Grundlage ist der festgeschriebene Beleg:
 *   1. trägt die PDF die ZUGFeRD-XML, wird DIESE umgeschrieben (Spezifikation BT-24, Prozess BT-23; fehlt die Käuferreferenz, kommt die Leitweg-ID
 *      aus der Kartei dazu) — dieselben Angaben wie in der PDF;
 *   2. sonst (Rechnungen vor dem 31.10. oder „E-Rechnung aus“) entsteht sie aus dem Datensatz + Absender des Registers — nur, wenn der Absender
 *      sich seit dem Stellen nicht geändert hat (sonst trüge sie andere Angaben als die PDF → 409).
 * Danach die Pflichtfelder der XRechnung (`xrechnungLuecken`) → 409 mit Liste.
 */
export async function rechnungXRechnung(id: string, z: { haushalt: string; sicht: Sicht }): Promise<{ xml: string; name: string }> {
  const plan = await planLaden();
  const r = plan.rechnungen.find(x => x.id === id);
  if (!r || !inSicht(r, z.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
  if (r.status === 'geplant' || !r.nummer || !r.pdfDateiId) throw new RechnungFehler('Eine XRechnung gibt es nur für gestellte Rechnungen aus MAKE OS (mit Nummer und PDF).', 409, { grund: 'nicht-gestellt' });
  if (!istGesellschaft(r.firmaId)) throw new RechnungFehler(NUR_GRUNDDATEN, 409, { grund: 'nur-grunddaten' });
  const { profilWechseln, leitwegEinsetzen, ciiXml: erzeugen } = await import('@/lib/finanzen/erechnung/cii');
  const { xrechnungLuecken, leitwegIdOk } = await import('@/lib/finanzen/erechnung/pruefen');
  const leitwegAusKartei = async (): Promise<string | undefined> => {
    if (!r.kundeFirmaId && !r.kontaktId) return undefined;
    const { ladeCrm } = await import('@/lib/crm/speicher');
    const crm = await ladeCrm();
    const f = r.kundeFirmaId ? crm.firmen.find(x => x.id === r.kundeFirmaId) : undefined;
    return f?.zahlung?.leitwegId;
  };
  const leitweg = r.empfaenger?.leitwegId || await leitwegAusKartei().catch(() => undefined);
  if (leitweg && !leitwegIdOk(leitweg)) throw new RechnungFehler(`Die Leitweg-ID „${leitweg}“ hat nicht die übliche Form (z. B. 991-12345-67) — bitte an der Kundenfirma prüfen.`, 409, { grund: 'leitweg' });
  const original = r.art === 'storno' && r.stornoZu ? plan.rechnungen.find(x => x.id === r.stornoZu) : undefined;
  let xml: string | null = null;
  if (r.eRechnung === 'zugferd') {
    const { lesen } = await import('@/lib/dateien/ablage');
    const d = await lesen(z.haushalt, r.pdfDateiId).catch(() => null);
    const { eingebetteteXml } = await import('@/lib/finanzen/erechnung/pdf');
    const ein = d ? await eingebetteteXml(new Uint8Array(d.bytes)) : null;
    if (ein) xml = profilWechseln(leitweg ? leitwegEinsetzen(ein.xml, leitweg) : ein.xml, 'xrechnung');
  }
  // Fehlt der eingebetteten Datei etwas, das der Absender inzwischen nachgetragen hat (z. B. Telefon), oder gibt es keine: aus dem Datensatz —
  // nur, wenn sich die Angaben des Absenders auf der PDF (Firmierung, Anschrift, Fuß) seit dem Stellen nicht geändert haben.
  if (!xml || xrechnungLuecken(xml).length) {
    const g = (await gesellschaften(z.haushalt)).find(x => x.id === r.firmaId) ?? { id: r.firmaId };
    const jetzt = absenderAus(g);
    const damals = r.absender;
    const gleich = !damals || JSON.stringify({ f: damals.firmierung, z: damals.zeilen, u: damals.fuss }) === JSON.stringify({ f: jetzt.firmierung, z: jetzt.zeilen, u: jetzt.fuss });
    if (gleich) {
      const neu = erzeugen({ r, g, kleinunternehmer: !!g.kleinunternehmer, ...(original ? { original } : {}), ...(leitweg ? { leitwegId: leitweg } : {}) }, 'xrechnung');
      if (!xml || !xrechnungLuecken(neu).length) xml = neu;
    } else if (!xml) {
      throw new RechnungFehler('Der Absender hat sich seit dem Stellen geändert — eine XRechnung aus den heutigen Angaben trüge andere Daten als die PDF. Bitte die PDF senden oder Storno und neue Rechnung.', 409, { grund: 'absender-geaendert' });
    }
  }
  const fehlt = xrechnungLuecken(xml);
  if (fehlt.length) throw new RechnungFehler(`Keine XRechnung — es fehlen Angaben: ${fehlt.join(' ')}`, 409, { fehlt: fehlt.map(text => ({ text })), grund: 'xrechnung' });
  return { xml, name: `XRechnung ${r.nummer}.xml`.replace(/[\\/]/g, '-') };
}

// ── Entwurf anlegen (frei, aus Angebot, aus Mandat) ─────────────────────────

export interface NeuEingabe { quelle?: unknown; firmaId?: unknown; kontaktId?: unknown; kundeFirmaId?: unknown; mandatId?: unknown; angebotId?: unknown; monat?: unknown; /** Nur bei `angebot`: `einmalig` = nur die Einmalposten (Woche 1 · 3.6). */ nur?: unknown;
  /** Nur bei `mandat` (19.10., P3): Zusatzmodule „abrechnen“ — `[{ zusatzId, menge }]` (je Einheit, Tag, Stunde; lib/crm/mandat-zusatz.ts). */ einheiten?: unknown;
  /** Nur bei `frei`: Vorbelegung aus einem abgelegten Angebot (Titel, Bruttobetrag, Angebotsnummer/-datum — Woche 2 · 3.13, `vorlageSaeubern`). */ vorlage?: unknown;
  /** Nur bei `angebot` + `nur: 'einmalig'` (31.10.): die Zahlung der Einmalposten nach der Zahlungsweise des Angebots (1-basiert; `einmalZahlungen`). */ rate?: unknown;
  /** Nur bei `mandat` (31.10.): die Rechnung für das ganze Quartal ab `monat` (Monatshonorar mit Rechnung je Quartal). */ quartal?: unknown;
  /** Nur bei `mandat` mit Tagessatz (31.10.): Tage des Monats aus der erfassten Zeit (Morgenlauf) — Menge der Honorar-Position. */ tage?: unknown;
  /** Nur mit `tage`: Satz, woher die Tage kommen (steht im Text der Position, ohne Namen). */ tageHinweis?: unknown }

/**
 * Feste Kennung der Rechnung für die Einmalposten eines gemischten Angebots (08.10., Woche 1 · 3.6) — aus der Angebots-Kennung abgeleitet,
 * damit ein zweiter Klick (oder „Mandat anlegen“ und der Knopf danach) nie eine zweite Rechnung anlegt.
 */
export const einmalRechnungId = (angebotId: string) => `r-e${createHash('sha256').update(`einmalig|${angebotId}`).digest('hex').slice(0, 24)}`;
/** Feste Kennung einer Zahlung (Rate, Anzahlung, Rest) der Einmalposten (31.10.) — je Angebot und Zahlung höchstens eine Rechnung. */
export const einmalRateRechnungId = (angebotId: string, nr: number) => `r-e${createHash('sha256').update(`einmalig|${angebotId}|${nr}`).digest('hex').slice(0, 24)}`;
/** Die Einmalposten-Rechnung eines Angebots, solange sie gilt (nicht storniert). */
const einmalSchon = (l: readonly Rechnung[], fest: string) => l.find(r => r.id === fest && r.status !== 'storniert');
/** Eine gültige gestellte (oder bezahlte) Rechnung über ein Angebot — ohne die Einmalposten-Rechnung und ohne Stornos (27.10.). */
export const schonAusAngebot = (l: readonly Rechnung[], angebotId: string, einmalId: string) =>
  l.find(r => r.angebotId === angebotId && r.id !== einmalId && r.art !== 'storno' && (r.status === 'gestellt' || r.status === 'bezahlt'));
/** Das Mandat zu einem Angebot (am Angebot vermerkt, sonst über den Deal) — nie eines im Papierkorb (29.10., B1). */
export const mandatZumAngebot = <M extends { id: string; chanceId?: string; geloeschtAm?: string }>(mandate: readonly M[], a: { mandatId?: string; dealId?: string }): M | undefined =>
  (a.mandatId ? mandate.find(m => m.id === a.mandatId && !m.geloeschtAm) : undefined) ?? (a.dealId ? mandate.find(m => m.chanceId === a.dealId && !m.geloeschtAm) : undefined);
export const MANDAT_VORHANDEN = 'Zu diesem Angebot läuft schon ein Mandat — es rechnet die Leistung ab (Monatsrechnung bzw. Raten in der Mandatsakte). Eine zweite Rechnung über alle Positionen verrechnete sie doppelt; nur die Einmalposten lassen sich hier noch eigens abrechnen.';
export const MANDAT_RECHNET_EINMAL = 'Das Mandat zu diesem Angebot rechnet den Einmalbetrag selbst ab (einmaliges Honorar bzw. Raten/Anzahlung) — eine eigene Rechnung über die Einmalposten verrechnete ihn doppelt. Die Rechnung in der Mandatsakte schreiben.';
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
  /** Anrechnung (21.10.): in der Sperre gegen die dann gespeicherten Rechnungen neu gerechnet — was inzwischen angerechnet wurde, kommt nicht doppelt. */
  let anrechnungNeu: ((rechnungen: Rechnung[]) => RechnungPosition[]) | null = null;

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
    // 29.10. (Kreislauf Geld B1): hängt am Angebot schon ein Mandat, rechnet DAS die Leistung ab (Monatsrechnung bzw. Raten) — eine Rechnung über alle
    // Positionen verrechnete sie ein zweites Mal (und stünde in der Liquidität doppelt). Nur die Einmalposten (`nur: 'einmalig'`) gehen weiter.
    const mandatDa = mandatZumAngebot(crm.mandate, a);
    if (!nurEinmalig && mandatDa) throw new RechnungFehler(MANDAT_VORHANDEN, 409, { grund: 'mandat-vorhanden', mandatId: mandatDa.id });
    // 24.10.: nur die Einmalposten, die das Mandat NICHT selbst abrechnet (`angebotEinmalRest`) — die eigenen Teile einer Kombination (z. B. der Festpreis
    // 50/50) stehen als Zusatzmodul am Mandat und kämen sonst doppelt auf eine Rechnung.
    const einmalRest = angebotEinmalRest(a, crm.leistungen);
    if (nurEinmalig && !einmalRest.length) throw new RechnungFehler(a.positionen.some(x => x.basis === 'einmalig') ? 'Die Einmalposten dieses Angebots rechnet das Mandat ab (Zusatzmodul) — keine eigene Rechnung nötig.' : 'Dieses Angebot hat keine Einmalposten.', 409, { grund: 'ohne-einmalposten' });
    const fest = einmalRechnungId(a.id);
    // 31.10. (Kreislauf-Rest): eine Zahlung der Einmalposten nach der Zahlungsweise des Angebots (Rate i von n, Anzahlung/Rest) — nur mit Mandat (sein
    // Beginn zählt). Steht schon die Rechnung über ALLE Einmalposten (`fest`), kommt DIE zurück (sie deckt jede Zahlung).
    const rateNr = nurEinmalig && typeof p.rate === 'number' && Number.isInteger(p.rate) && p.rate >= 1 ? p.rate : null;
    let zahlung: EinmalZahlung | null = null;
    if (rateNr) {
      if (!mandatDa) throw new RechnungFehler('Eine Zahlung der Einmalposten gibt es nur mit Mandat (sein Beginn zählt) — erst das Mandat anlegen.', 409, { grund: 'ohne-mandat' });
      const zs = einmalZahlungen(a, mandatDa);
      const z = zs.find(x => x.nr === rateNr);
      if (!z) throw new RechnungFehler('Diese Zahlung gibt es laut Zahlungsweise des Angebots nicht.', 400);
      if (zs.length > 1) zahlung = z;
    }
    const teilId = zahlung ? einmalRateRechnungId(a.id, zahlung.nr) : null;
    vorhandenIn = teilId
      ? l => l.find(r => r.id === fest && r.status !== 'storniert') ?? l.find(r => r.id === teilId)
      : nurEinmalig
        ? l => l.find(r => r.id === fest) ?? l.find(r => r.angebotId === a.id && r.art !== 'storno' && r.status !== 'storniert')
        : l => l.find(r => r.angebotId === a.id && r.status === 'geplant');
    const offen = vorhandenIn(plan.rechnungen);
    if (offen) {
      if (!inSicht(offen, p.sicht)) throw new RechnungFehler('Kein Zugang zu dieser Gesellschaft.', 403);
      return { rechnung: mitFassung(offen), vorhanden: true };
    }
    // 29.10. (Kreislauf Geld, Kevin): rechnet das Mandat selbst einen Einmalbetrag ab (einmaliges Honorar bzw. Zahlplan/Raten), entsteht auch für die
    // Einmalposten keine eigene Rechnung — sie verrechnete denselben Betrag ein zweites Mal. Der Weg ist dann die Mandatsakte („Rechnung schreiben“).
    if (nurEinmalig && mandatDa && (mandatDa.honorar?.basis === 'einmalig' || zahlplanMonate(mandatDa))) {
      throw new RechnungFehler(MANDAT_RECHNET_EINMAL, 409, { grund: 'mandat-rechnet-einmal', mandatId: mandatDa.id });
    }
    // Nahtstellen 09.10.: stehen die Einmalposten schon in ihrer eigenen Rechnung (feste Kennung, auch gestellt/bezahlt), entsteht keine zweite
    // Rechnung über ALLE Positionen — sie verrechnete die Einmalposten ein zweites Mal (die laufende Leistung rechnet das Mandat ab).
    if (!nurEinmalig) {
      sperreEinmal = fest;
      const einmal = einmalSchon(plan.rechnungen, fest);
      if (einmal) throw new RechnungFehler(EINMAL_SCHON, 409, { grund: 'einmalposten-schon', rechnungId: einmal.id });
      // 27.10. (Rechnungs-Kreislauf): ist aus diesem Angebot schon eine Rechnung gestellt (nicht storniert), entsteht keine zweite volle Rechnung —
      // vorher suchte die Prüfung nur Entwürfe, ein zweiter Klick nach dem Stellen rechnete das Angebot doppelt ab. Weitere Beträge: frei schreiben.
      const gestellt = schonAusAngebot(plan.rechnungen, a.id, fest);
      if (gestellt) throw new RechnungFehler(`Aus diesem Angebot ist schon die Rechnung ${gestellt.nummer ?? ''} gestellt — keine zweite über dasselbe Angebot. Eine weitere Rechnung bitte frei schreiben (oder die gestellte kopieren).`.replace('  ', ' '), 409, { grund: 'angebot-schon-gestellt', rechnungId: gestellt.id });
    }
    const k = kontakt(a.kontaktId);
    const f = firma(a.firmaId ?? k?.firmaId);
    // 21.10. (Rundgang A1): der Titel aus den Produkten des Angebots — ein alter Titel, der nur ein fremdes Produkt nennt, wird nicht übernommen
    // (dieselbe Regel wie das Mandat aus dem Angebot, `angebotTitelFuerFolge`). Gespeichertes bleibt unverändert.
    const titelAusAngebot = angebotTitelFuerFolge(a, crm.leistungen);
    const empf = empfaengerAusCrm(k, f);
    const mandat = mandatDa;
    // Gesellschaft wie überall (08.10., 3.6): eine Register-Gesellschaft führt der Finanzplan nicht (409 „nur Grunddaten“), nie still kdc.
    const g = gesellschaftFuer(a.gesellschaft);
    if (!g) throw new RechnungFehler('Für dieses Angebot steht keine Gesellschaft fest — die Rechnung frei schreiben.', 409, { grund: 'gesellschaft' });
    const alle = positionenAusAngebot(nurEinmalig ? { positionen: einmalRest } : a, ku(g));
    const positionen = zahlung ? einmalTeilPositionen(alle, zahlung) : alle;
    entwurf = neuerEntwurf({
      id: nurEinmalig ? teilId ?? fest : id, firmaId: g, kunde: kundeAus(empf, a.empfaenger?.firma ?? a.empfaenger?.name), titel: nurEinmalig ? `${titelAusAngebot || 'Leistung'} — einmalig${zahlung ? `, ${einmalZahlungText(zahlung)}` : ''}`.slice(0, 160) : titelAusAngebot, empfaenger: empf, positionen,
      zahlungszielTage: a.zahlungszielTage, heute, ...(mandat ? { mandatId: mandat.id } : {}), ...(a.nummer ? { angebot: a.nummer } : {}), ...(a.gestelltAm ? { angebotAm: tagVon(a.gestelltAm) } : {}),
      ...(k ? { kontaktId: k.id } : {}), ...(f ? { kundeFirmaId: f.id } : {}), angebotId: a.id, einleitung: EINLEITUNG_VORLAGE, schluss: SCHLUSS_VORLAGE,
    }, { kleinunternehmer: ku(g) });
  } else if (quelle === 'mandat') {
    const m = typeof p.mandatId === 'string' ? crm.mandate.find(x => x.id === p.mandatId && !x.geloeschtAm) : undefined;
    if (!m) throw new RechnungFehler('Mandat nicht gefunden.', 404);
    // Ohne gewählten Monat (z. B. „Erste Rechnung“ am Angebot): der laufende, geklemmt in die Laufzeit des Mandats (18.10.).
    // Raten bzw. Zahlplan (21.10./26.10.): ohne gewählten Monat die nächste noch nicht gestellte Zahlung.
    const zpMonate = zahlplanMonate(m);
    const zpOffen = zpMonate ? zpMonate.find(mo => !abgerechneteMonate(m.id, plan.rechnungen).has(mo)) : undefined;
    const monat = typeof p.monat === 'string' && monatsGrenzen(p.monat) ? p.monat : zpOffen ?? mandatMonatVorgabe(m, heute);
    const grenzen = monatsGrenzen(monat)!;
    // Teilmonat (Kevin 18.10.: „Anteilig“): Leistungszeitraum = Monat ∩ [Beginn, Ende]; der Betrag folgt in `positionAusMandat`. Eine Rate nach dem Ende
    // des Mandats (26.10.) trägt als Zeitraum den ganzen Monat — die Rate ist eine Zahlung, kein neuer Leistungsmonat.
    const lm0 = leistungsmonat(m, monat)!;
    const ratenMonat = !!m.raten && !!zpMonate?.includes(monat);
    // Quartal (31.10., Kreislauf-Rest): Monatshonorar mit Rechnung je Quartal — EINE Rechnung über die Monate des Quartals ab `monat`, in denen das
    // Mandat läuft (Leistungszeitraum vom ersten bis zum letzten; jeder Monat seine Position wie die Monatsrechnung, angebrochene anteilig).
    const quartal = p.quartal === true && m.honorar.basis === 'monat' && m.rechnungsrhythmus === 'quartal';
    const qMonate = quartal ? quartalMonate(monat).filter(mo => (leistungsmonat(m, mo)?.tage ?? 0) > 0) : [];
    const qErst = qMonate.length ? leistungsmonat(m, qMonate[0])! : null;
    const qLetzt = qMonate.length ? leistungsmonat(m, qMonate[qMonate.length - 1])! : null;
    const lm = qErst && qLetzt ? { ...qErst, bis: qLetzt.bis } : !lm0.tage && ratenMonat ? { ...lm0, von: grenzen.von, bis: grenzen.bis, tage: lm0.monatsTage, anteilig: false } : lm0;
    // Zusatzmodule „abrechnen“ (19.10., P3): je Einheit / Tag / Stunde mit Menge — nur auf Klick, nie von selbst.
    const wahl = abrechnenWahlAus(p.einheiten);
    if (!wahl.ok) throw new RechnungFehler(wahl.fehler, wahl.status);
    if (quartal && wahl.wahl.length) throw new RechnungFehler('Abrechnen nach Menge geht nur mit der Monatsrechnung, nicht mit der Rechnung je Quartal.', 400);
    // 31.10.: eine Rechnung über mehrere Monate (Quartal) deckt jeden ihrer Monate — für die Quartalsrechnung zählt jeder Monat des Quartals.
    const deckt = (r: Rechnung) => { const mo = rechnungsMonate(r); return quartal ? mo.some(x => qMonate.includes(x)) : mo.length > 1 && mo.includes(monat); };
    const imMonat = (r: Rechnung) => r.mandatId === m.id && !r.angebotId && (r.leistungVon === grenzen.von || r.leistungVon === lm.von || deckt(r)) && r.art !== 'storno' && r.status !== 'storniert';
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
    // Raten bzw. Zahlplan (26.10.): nur in einem Monat, in dem eine Zahlung fällig ist — sonst entstünde eine leere Rechnung (abrechnen nach Menge geht immer).
    if (zpMonate && !zpMonate.includes(monat) && !wahl.wahl.length) {
      throw new RechnungFehler(`Für ${monatsName(monat)} ist laut ${m.raten ? 'Ratenplan' : 'Zahlplan'} keine Zahlung fällig${zpOffen ? ` — die nächste ist für ${monatsName(zpOffen)}` : ' — alle Zahlungen sind gestellt'}.`, 409, { grund: 'keine-zahlung', ...(zpOffen ? { monat: zpOffen } : {}) });
    }
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
    const honorarPositionen = quartal
      ? qMonate.flatMap(mo => monatsPositionen(m, mo, { katalog: crm.leistungen, kleinunternehmer: ku(g), nettoAusBrutto }))
      : monatsPositionen(m, monat, { katalog: crm.leistungen, kleinunternehmer: ku(g), nettoAusBrutto });
    // Jahreshonorar (02.11., R2-3 Fund 3): eine Rechnung je Vertragsjahr — in einem Monat ohne Beginn eines Vertragsjahrs (und ohne anderes) entstünde eine leere Rechnung.
    if (!quartal && !honorarPositionen.length && !abgerechnet.length && jahresHonorarVon(m) !== null) {
      const naechstes = naechstesVertragsjahr(m, monat);
      throw new RechnungFehler(`Jahreshonorar: für ${monatsName(monat)} ist keine Rechnung fällig${naechstes ? ` — die nächste ist für ${monatsName(naechstes)}` : ''}.`, 409, { grund: 'keine-zahlung', ...(naechstes ? { monat: naechstes } : {}) });
    }
    // Tagessatz (31.10.): die Tage aus der erfassten Zeit (Morgenlauf) sind die Menge der Honorar-Position — der Satz dazu steht im Text (prüfen!).
    const tage = m.honorar.basis === 'tag' && typeof p.tage === 'number' && p.tage > 0 && p.tage <= 31 ? Math.round(p.tage * 100) / 100 : null;
    const hinweis = tage && typeof p.tageHinweis === 'string' ? p.tageHinweis.slice(0, 300) : '';
    const mitTagen = tage ? honorarPositionen.map((x, i) => (i === 0 ? { ...x, menge: tage, ...(hinweis ? { text: [x.text, hinweis].filter(Boolean).join('\n\n').slice(0, 6000) } : {}) } : x)) : honorarPositionen;
    const basisPositionen = da ? abgerechnet : [...mitTagen, ...abgerechnet];
    // Anrechnung (Kevin 21.10.): was vom gekauften Produkt (inkl. Optionen) noch offen ist, höchstens bis zum Betrag dieser Rechnung — der Rest folgt.
    const anrechnungFuer = (rechnungen: Rechnung[]) => anrechnungPositionen(m, basisPositionen, { katalog: crm.leistungen, mandate: crm.mandate, rechnungen, nettoAusBrutto }, { kleinunternehmer: ku(g) });
    if (!da) anrechnungNeu = anrechnungFuer;
    const positionen = da ? basisPositionen : [...basisPositionen, ...anrechnungFuer(plan.rechnungen)];
    if (da) vorhandenIn = null;
    entwurf = neuerEntwurf({
      id, firmaId: g, kunde: kundeAus(empf, m.kunde), titel: `${m.titel || 'Leistung'} — ${quartal && qMonate.length > 1 ? `${monatsName(qMonate[0])} bis ${monatsName(qMonate[qMonate.length - 1])}` : monatsName(quartal ? qMonate[0] : monat)}${da ? ' (abgerechnete Zusatzmodule)' : ''}`, empfaenger: empf,
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
  const anrechnungInSperre = anrechnungNeu as ((rechnungen: Rechnung[]) => RechnungPosition[]) | null;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    // Zwei gleichzeitige „aus Angebot/Mandat“: der zweite bekommt den ersten Entwurf (kein Doppel).
    const da = finde?.(f.rechnungen);
    if (da && cur) { schonDa = da; return cur; }
    if (sperreEinmal && einmalSchon(f.rechnungen, sperreEinmal)) throw new RechnungFehler(EINMAL_SCHON, 409, { grund: 'einmalposten-schon' });
    // Anrechnung (P3; 21.10. mit Rest über mehrere Rechnungen): gegen die Rechnungen IN der Sperre neu gerechnet — wurde inzwischen (zweiter Entwurf
    // gleichzeitig) schon etwas angerechnet, steht hier nur noch, was offen ist (bzw. nichts).
    if (anrechnungInSperre && entwurf.positionen) {
      const ohne = entwurf.positionen.filter(x => !istAnrechnung(x));
      const pos = [...ohne, ...anrechnungInSperre(f.rechnungen)];
      if (JSON.stringify(pos) !== JSON.stringify(entwurf.positionen)) entwurf = { ...entwurf, positionen: pos, ...betragFelder(pos, { kleinunternehmer: !!gs.find(x => x.id === entwurf.firmaId)?.kleinunternehmer }) };
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

// ── Entwurf aus einer Baustein-Bestellung der Website (31.10., lib/bausteine/*) ──

/** Feste Kennung der Rechnung einer Baustein-Bestellung — aus der Bestell-Kennung abgeleitet: ein zweiter Lauf legt nie eine zweite an. */
export const bestellRechnungId = (bestellId: string) => `r-b${createHash('sha256').update(`baustein|${bestellId}`).digest('hex').slice(0, 24)}`;

/**
 * Den Rechnungs-ENTWURF einer Baustein-Bestellung anlegen (Kevin 31.10.: „auf Rechnung über MAKE OS“) — Status „geplant“, ohne Nummer; gestellt wird
 * nur über `rechnungStellen` (der Klick „Freigeben und senden“). Feste Kennung (`bestellRechnungId`): gibt es sie schon (in jedem Status), kommt DIE
 * zurück (idempotent, auch in der Sperre geprüft). Empfänger = die Rechnungsanschrift aus dem Formular (Momentaufnahme), Zuordnung = die Person (und ihre
 * Firma) aus dem Anfrage-Weg — ohne Zuordnung stellt `rechnungStellen` nicht (30.10.). Gesellschaft nur eine feste (Einstellungen der Bausteine).
 */
export async function entwurfAusBestellung(p: {
  bestellId: string; firmaId: Gesellschaftskennung; titel: string; empfaenger: import('./typen').RechnungEmpfaenger; positionen: RechnungPosition[];
  zahlungszielTage: number; leistungVon: string; kontaktId?: string; kundeFirmaId?: string; haushalt: string; wer?: Wer; jetzt?: Date;
}): Promise<{ rechnung: Rechnung & { fassung: string }; vorhanden: boolean }> {
  if (!istGesellschaft(p.firmaId)) throw new RechnungFehler('Für Bausteine ist keine Gesellschaft eingestellt.', 409, { grund: 'gesellschaft' });
  const id = bestellRechnungId(p.bestellId);
  const heute = localDay(p.jetzt ?? new Date());
  const ku = !!(await gesellschaften(p.haushalt)).find(x => x.id === p.firmaId)?.kleinunternehmer;
  const positionen = p.positionen.map(x => (ku ? { ...x, ustSatz: 0 } : x));
  const empf = empfaengerSaeubern(p.empfaenger);
  let gespeichert: Rechnung | null = null;
  let schonDa: Rechnung | null = null;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const da = f.rechnungen.find(r => r.id === id);
    if (da && cur) { schonDa = da; return cur; }
    const entwurf = neuerEntwurf({
      id, firmaId: p.firmaId, kunde: kundeAus(empf), titel: p.titel, ...(empf ? { empfaenger: empf } : {}), positionen, zahlungszielTage: p.zahlungszielTage, heute,
      leistungVon: p.leistungVon, ...(p.kontaktId ? { kontaktId: p.kontaktId } : {}), ...(p.kundeFirmaId ? { kundeFirmaId: p.kundeFirmaId } : {}),
      einleitung: EINLEITUNG_VORLAGE, schluss: SCHLUSS_VORLAGE,
    }, { kleinunternehmer: ku });
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

/** Eine Rechnung lesen (Kennung) — für die Bausteine (Stand, Status, Nummer, Fälligkeit). null, wenn es sie nicht gibt. */
export async function rechnungLesen(id: string): Promise<(Rechnung & { fassung: string }) | null> {
  const r = (await planLaden()).rechnungen.find(x => x.id === id);
  return r ? mitFassung(r) : null;
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

// ── Kunde aus der Kartei, Kopie, Katalog (27.10., Rechnungs-Kreislauf) ──────────

/**
 * Den Kunden eines Entwurfs aus der Kartei setzen: Empfänger (Momentaufnahme) aus Firma bzw. Person über `empfaengerAusCrm`, dazu `kundeFirmaId`/`kontaktId`
 * — so hängt auch eine frei geschriebene Rechnung an ihrer Akte (Umsatz-Reiter, „Anschrift an der Firma speichern“). Eine Firma löst die Person, eine Person
 * nimmt ihre Firma mit. Eingeschränkte Personen (Art. 18) fehlen in der Kartei-Sicht → 404. Derselbe Schreibweg wie „speichern“ (Stand/409).
 */
export async function entwurfKunde(p: { id: string; stand: unknown; kontaktId?: unknown; kundeFirmaId?: unknown; haushalt: string; sicht: Sicht; wer?: Wer; /** 30.10.: gerade neu in der Markttraktion angelegt — schon getippte Felder bleiben, wo die Kartei nichts weiß. */ anschriftBehalten?: boolean }): Promise<Rechnung & { fassung: string }> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung')]);
  const crm = await ladeCrm();
  const firma = (fid: unknown) => (firmaIdOk(fid) ? crm.firmen.find(f => f.id === fid && !f.geloeschtAm) : undefined);
  let k: Awaited<ReturnType<typeof kontakteFuerVerarbeitung>>[number] | undefined;
  let f: ReturnType<typeof firma>;
  if (kontaktIdOk(p.kontaktId)) {
    k = (await kontakteFuerVerarbeitung()).find(x => x.id === p.kontaktId);
    if (!k) throw new RechnungFehler('Diese Person gibt es in der Kartei nicht (mehr).', 404);
    f = firma(k.firmaId);
  } else {
    f = firma(p.kundeFirmaId);
    if (!f) throw new RechnungFehler('Diese Firma gibt es in der Kartei nicht (mehr).', 404);
  }
  const ausKartei = empfaengerAusCrm(k, f);
  let empf = ausKartei;
  if (p.anschriftBehalten) {
    const alt = (await planLaden()).rechnungen.find(r => r.id === p.id)?.empfaenger ?? {};
    empf = empfaengerSaeubern({ ...alt, ...Object.fromEntries(Object.entries(ausKartei).filter(([, v]) => typeof v === 'string' && v.trim())) }) ?? ausKartei;
  }
  const zielTage = f?.zahlung?.zielTage ?? k?.zahlung?.zielTage;
  const { anFirma: _a, ...r } = await entwurfSpeichern({
    id: p.id, stand: p.stand, haushalt: p.haushalt, sicht: p.sicht, wer: p.wer,
    felder: { empfaenger: empf, kunde: kundeAus(empf), kontaktId: k?.id ?? null, kundeFirmaId: f?.id ?? null, ...(zielTage ? { zahlungszielTage: zielTage } : {}) },
  });
  return r;
}

/**
 * Zuordnung NACHTRAGEN an einer schon gestellten Rechnung ohne Zuordnung (30.10., Altbestand): nur `kundeFirmaId`/`kontaktId` — Empfänger,
 * Nummer, Beträge und das PDF bleiben unverändert (die Rechnung ist ein Beleg). Nur, solange sie weder Firma, Person noch Mandat trägt (sonst 409);
 * eine Person nimmt ihre Firma mit. Eingeschränkte Personen (Art. 18) fehlen in der Kartei-Sicht → 404. Stand/409 wie jeder Schreibweg.
 */
export async function rechnungZuordnen(p: { id: string; stand: unknown; kontaktId?: unknown; kundeFirmaId?: unknown; sicht: Sicht; wer?: Wer }): Promise<Rechnung & { fassung: string }> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung')]);
  const crm = await ladeCrm();
  const firma = (fid: unknown) => (firmaIdOk(fid) ? crm.firmen.find(f => f.id === fid && !f.geloeschtAm) : undefined);
  let kontaktId: string | undefined;
  let kundeFirmaId: string | undefined;
  if (kontaktIdOk(p.kontaktId)) {
    const k = (await kontakteFuerVerarbeitung()).find(x => x.id === p.kontaktId);
    if (!k) throw new RechnungFehler('Diese Person gibt es in der Kartei nicht (mehr).', 404);
    kontaktId = k.id; kundeFirmaId = firma(k.firmaId)?.id;
  } else {
    const f = firma(p.kundeFirmaId);
    if (!f) throw new RechnungFehler('Diese Firma gibt es in der Kartei nicht (mehr).', 404);
    kundeFirmaId = f.id;
  }
  let ergebnis: Rechnung | null = null;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const alt = f.rechnungen.find(r => r.id === p.id);
    if (!alt || !inSicht(alt, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    if (alt.status === 'geplant') throw new RechnungFehler('Ein Entwurf bekommt seinen Kunden im Editor („Kunde aus der Markttraktion“).', 409, { aktuell: mitFassung(alt) });
    standPruefen(alt, p.stand);
    if (istZugeordnet(alt)) throw new RechnungFehler('Diese Rechnung ist schon zugeordnet — eine gestellte Rechnung wechselt ihren Kunden nicht (Storno und neue Rechnung).', 409, { aktuell: mitFassung(alt), grund: 'zugeordnet' });
    const neu = sauberFile({ rechnungen: [{ ...alt, ...(kontaktId ? { kontaktId } : {}), ...(kundeFirmaId ? { kundeFirmaId } : {}) }] }).rechnungen[0];
    ergebnis = neu;
    return { ...f, rechnungen: f.rechnungen.map(r => (r.id === p.id ? neu : r)) };
  });
  const r = ergebnis as Rechnung | null;
  if (!r) throw new RechnungFehler('Nicht zugeordnet.', 500);
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: r.id, felder: [...(kontaktId ? ['kontaktId'] : []), ...(kundeFirmaId ? ['kundeFirmaId'] : [])] }], p.wer);
  return mitFassung(r);
}

/**
 * Rechnungen für den Reiter „Umsatz“ einer Akte (30.10.): serverseitig nach Sicht gefiltert — die Business-Sicht (`finanzRecht: 'business'`)
 * bekommt nie eine Rechnung einer Privat-Einheit (Selbstständigkeit), ein volles Haushaltsmitglied alle. Nur die Felder, die der Reiter braucht.
 * Vorher las der Reiter `/api/state/finanzplan` (nur mit Privat-Finanzzugang) — Konten „nur Business“ sahen dort gar keine Rechnung.
 */
export async function rechnungenFuerUmsatz(z: { sicht: Sicht }) {
  const f = await planLaden();
  return f.rechnungen.filter(r => inSicht(r, z.sicht)).map(r => ({
    id: r.id, firmaId: r.firmaId, kunde: r.kunde, titel: r.titel, betrag: r.betrag, status: r.status, fassung: fassung(r),
    ...(r.mandatId ? { mandatId: r.mandatId } : {}), ...(r.kontaktId ? { kontaktId: r.kontaktId } : {}), ...(r.kundeFirmaId ? { kundeFirmaId: r.kundeFirmaId } : {}),
    ...(r.faellig ? { faellig: r.faellig } : {}), ...(r.nummer ? { nummer: r.nummer } : {}), ...(r.datum ? { datum: r.datum } : {}),
    ...(r.angebot ? { angebot: r.angebot } : {}), ...(r.angebotAm ? { angebotAm: r.angebotAm } : {}), ...(r.bezahltAm ? { bezahltAm: r.bezahltAm } : {}),
    ...(r.storniertAm ? { storniertAm: r.storniertAm } : {}), ...(r.stornoGrund ? { stornoGrund: r.stornoGrund } : {}),
    ...(r.art ? { art: r.art } : {}), ...(r.pdfDateiId ? { pdf: true } : {}),
  }));
}

/**
 * Eine Rechnung als neuen Entwurf kopieren — Vorlage („dieselbe Rechnung nächsten Monat“) oder Korrektur nach einem Storno. Übernommen: Absender,
 * Empfänger, Kunde aus der Kartei, Titel, Positionen, Steuerhinweis, Texte, Zahlungsziel. Nie: Nummer, PDF, Status, Mahnungen, Versand, Angebotsbezug
 * (eine Kopie ist keine zweite Rechnung über das Angebot). Ist das Original storniert (Korrektur), bleiben Leistungszeitraum und Mandat — die korrigierte
 * Rechnung ersetzt sie; sonst sind beide leer (der neue Zeitraum gehört eingetragen, und ein Mandat zählte den Monat sonst doppelt).
 */
export async function entwurfKopie(p: { id: string; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<Rechnung & { fassung: string }> {
  const heute = localDay(p.jetzt ?? new Date());
  const gs = await gesellschaften(p.haushalt);
  const id = neueKennung('r');
  let gespeichert: Rechnung | null = null;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const x = f.rechnungen.find(r => r.id === p.id);
    // Aus der Stornorechnung heraus: kopiert wird das Original (die korrigierte Rechnung ersetzt es).
    const o = x?.art === 'storno' && x.stornoZu ? f.rechnungen.find(r => r.id === x.stornoZu) : x;
    if (!o || !inSicht(o, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    if (o.art === 'storno') throw new RechnungFehler('Eine Stornorechnung wird nicht kopiert — bitte die ursprüngliche Rechnung kopieren.', 409);
    if (!istGesellschaft(o.firmaId)) throw new RechnungFehler(NUR_GRUNDDATEN, 409, { grund: 'nur-grunddaten' });
    const korrektur = o.status === 'storniert';
    const ku = !!gs.find(x => x.id === o.firmaId)?.kleinunternehmer;
    const positionen: RechnungPosition[] = (o.positionen?.length ? o.positionen : o.betrag > 0 ? [positionAusBrutto(o.titel || 'Leistung', Math.round(o.betrag * 100), { kleinunternehmer: ku, nettoAusBrutto })] : [])
      .filter(x => !istAnrechnung(x)).map((x, i) => ({ ...x, id: `p${i + 1}` }));
    const e = neuerEntwurf({
      id, firmaId: o.firmaId as Gesellschaftskennung, kunde: o.kunde, titel: o.titel, ...(o.empfaenger ? { empfaenger: o.empfaenger } : {}), positionen,
      zahlungszielTage: o.zahlungszielTage, heute, ...(o.kontaktId ? { kontaktId: o.kontaktId } : {}), ...(o.kundeFirmaId ? { kundeFirmaId: o.kundeFirmaId } : {}),
      ...(korrektur && o.mandatId ? { mandatId: o.mandatId } : {}), ...(korrektur && o.leistungVon ? { leistungVon: o.leistungVon } : {}), ...(korrektur && o.leistungBis ? { leistungBis: o.leistungBis } : {}),
      ...(o.steuerHinweis ? { steuerHinweis: o.steuerHinweis } : {}), ...(o.einleitung ? { einleitung: o.einleitung } : {}), ...(o.schluss ? { schluss: o.schluss } : {}),
    }, { kleinunternehmer: ku });
    const notiz = korrektur && o.nummer ? `Korrektur zu Rechnung ${o.nummer}` : o.nummer ? `Kopie von Rechnung ${o.nummer}` : undefined;
    const sauber = sauberFile({ rechnungen: [{ ...e, ...(o.steuerfreiGrund ? { steuerfreiGrund: o.steuerfreiGrund } : {}), ...(notiz ? { notiz } : {}) }] }).rechnungen[0];
    const neu = ugFirmaNachziehen({ ...f, rechnungen: [...f.rechnungen, sauber] });
    const grenze = ueberGrenze(neu, f);
    if (grenze) throw new RechnungFehler(grenze, 413);
    gespeichert = sauber;
    return neu;
  });
  const r = gespeichert as Rechnung | null;
  if (!r) throw new RechnungFehler('Nicht angelegt.', 500);
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'neu', id: r.id, felder: Object.keys(r).filter(k => k !== 'id') }], p.wer);
  return mitFassung(r);
}

/**
 * Für den Editor (27.10.): die aktiven Produkte (für „+ aus Produkt“) und die Kartei zum Wählen des Kunden — nur Kennung und Name (Firmen; Personen mit
 * ihrer Firma), eingeschränkte Personen (Art. 18) fehlen. Erst auf Klick geladen, nie mit der Liste.
 */
export async function rechnungKatalog(): Promise<{ produkte: import('@/lib/crm/typen').Leistung[]; firmen: { id: string; name: string; ort?: string }[]; personen: { id: string; name: string; firma?: string; firmaId?: string; ort?: string }[] }> {
  const [{ ladeCrm }, { kontakteFuerVerarbeitung }, { anzeigename }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/verarbeitung'), import('@/lib/make-one/crm')]);
  const crm = await ladeCrm();
  const firmenName = new Map(crm.firmen.map(f => [f.id, f.name]));
  // Ort (30.10.): zum Unterscheiden gleichnamiger Treffer in der Suche — aus der Rechnungsanschrift der Firma, sonst ihrer Stadt.
  const ortVon = (f: { stadt?: string; zahlung?: { empfaenger?: { anschrift?: string } } } | undefined) => (f ? anschriftZerlegen(f.zahlung?.empfaenger?.anschrift).ort || f.stadt : undefined);
  const firmaVon = new Map(crm.firmen.map(f => [f.id, f]));
  return {
    produkte: crm.leistungen.filter(l => l.status === 'aktiv'),
    firmen: crm.firmen.filter(f => !f.geloeschtAm).map(f => { const ort = ortVon(f); return { id: f.id, name: f.name, ...(ort ? { ort } : {}) }; }).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    personen: (await kontakteFuerVerarbeitung()).map(k => {
      const firma = (k.firmaId && firmenName.get(k.firmaId)) || k.firma;
      const ort = ortVon(k.firmaId ? firmaVon.get(k.firmaId) : undefined) || k.firmaStadt;
      return { id: k.id, name: anzeigename(k), ...(firma ? { firma } : {}), ...(k.firmaId && firmenName.has(k.firmaId) ? { firmaId: k.firmaId } : {}), ...(ort ? { ort } : {}) };
    }).sort((a, b) => a.name.localeCompare(b.name, 'de')),
  };
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

/**
 * E-Rechnung (31.10.): die ZUGFeRD-/Factur-X-XML (EN 16931) aus derselben Rechnung, eingebettet in die PDF vor dem Speichern — nur, wenn die
 * Rechnung `eRechnung: 'zugferd'` trägt (Gesellschaft ohne „E-Rechnung aus“). Ohne: die PDF wie bisher, bit-gleich.
 */
function eRechnungEinbetten(r: Rechnung, g: Gesellschaft, ku: boolean, erstellt: Date, original?: Pick<Rechnung, 'nummer' | 'datum'>, streng = true) {
  if (r.eRechnung !== 'zugferd') return undefined;
  const xml = ciiXml({ r, g, kleinunternehmer: ku, ...(original ? { original } : {}) }, 'en16931');
  // Sicherheitsnetz: was die Pflichtprüfung durchließ, aber in der XML fehlt, stellt NICHT (Abbruch vor dem Festschreiben — keine Nummer verbraucht).
  const fehlt = en16931Luecken(xml);
  if (fehlt.length && !streng) return undefined;
  if (fehlt.length) throw new RechnungFehler(`Nicht gestellt — die E-Rechnung wäre unvollständig: ${fehlt.join(' ')}`, 409, { fehlt: fehlt.map(text => ({ text })), grund: 'pflichtangaben' });
  const art = r.art === 'storno' ? 'Stornorechnung' : 'Rechnung';
  return (doc: Parameters<typeof facturXEinbetten>[0]) => facturXEinbetten(doc, xml, { erstellt, titel: `${art} ${r.nummer ?? ''}`.trim(), autor: mitVorgaben(g).name });
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
  // 30.10. (Kevin: „Es geht keine Rechnung raus, ohne dass das Ganze zugeordnet ist“): Firma, Person oder Mandat aus der Kartei — für JEDE
  // Gesellschaft, auch die Selbstständigkeit. Vor dem Nummernkreis: abgelehnt verbraucht keine Nummer.
  if (!(await zuordnungLebt(r0))) throw zuordnungFehler();
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
    // 25.10.: Format der Gesellschaft (`rechnungsformat`, Vorgabe wie bisher) — Kreis und Zähler bleiben dieselben.
    const { lauf, nummer } = naechsteNummer(plan.rechnungen, cur?.zaehler?.[schluessel], r0.firmaId as Gesellschaftskennung, jahr, kurzVon(g), v.rechnungsformat);
    const positionen = (a.positionen ?? []).map(x => (ku ? { ...x, ustSatz: 0 } : { ...x }));
    const ziel = a.zahlungszielTage ?? v.zahlungszielTage;
    const bf = betragFelder(positionen, { kleinunternehmer: ku });
    const gestellt: Rechnung = {
      ...a, ...bf, positionen, status: 'gestellt', nummer, datum: heute,
      // 24.10.: frühestens Zahlungsziel nach Beginn der Leistung — dieselbe Regel wie der Zahltag im Liquiplan (`faelligAm`).
      faellig: faelligAm(heute, ziel, a.leistungVon), zahlungszielTage: ziel,
      lauf, absender: absenderAus(g), gestelltAm: jetztIso, gestelltVon: p.person,
      ...(ku ? { steuerHinweis: undefined, steuerfreiGrund: undefined } : {}),
      // E-Rechnung (31.10.): Vorgabe an — die PDF trägt die ZUGFeRD-XML (EN 16931); „E-Rechnung aus“ an der Gesellschaft = nur die PDF wie bisher.
      ...(g.eRechnungAus ? {} : { eRechnung: 'zugferd' as const }),
    };
    // Mehrere Steuersätze: kein einzelner Satz am Eintrag — Steuern rechnen dann mit `netto` (lib/steuern/rechnen.ts).
    if (bf.ustSatz === undefined) delete gestellt.ustSatz;
    // b) Außerhalb der Finanzplan-Sperre: das PDF und seine Prüfsumme.
    const bytes = Buffer.from(await belegPdf(rechnungDokument(gestellt, absenderAus(g, { ibanVoll: true }), { datum: heute, bank: bankZeile(g.bank), kleinunternehmer: ku }), { logo, erstellt: jetzt, vorSpeichern: eRechnungEinbetten(gestellt, g, ku, jetzt) }));
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
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: e.r.id, felder: ['status', 'nummer', 'datum', 'faellig', 'pdfDateiId', 'sha256', 'absender', 'lauf', ...(e.r.eRechnung ? ['eRechnung'] : [])] }], p.wer);
  // Rechnungsanschrift an der Firma (19.10., B12): beim Stellen füllt die Anschrift eine Firma, die noch keine hat — nie überschrieben.
  await anschriftAnFirma(null, e.r, p.wer);
  // Ereignis (21.10., Prozesse C1): Rechnung gestellt → Prozesse (nur Kennungen, nie Beträge) — nach dem Speichern, wirft nie.
  await import('@/lib/ereignisse/quellen').then(q => q.rechnungGestelltEreignis(e.r)).catch(() => 0);
  return { rechnung: mitFassung(e.r), pdf: e.pdf, mail: { ...(e.r.empfaenger?.email ? { an: e.r.empfaenger.email } : {}), ...rechnungMail(e.r, v.name) } };
}

// ── Zurückziehen (03.11., Kevin: „Rechnung löschen, neu ab 0006“) ─────────────

/** Was eine gestellte Rechnung erfüllen muss, damit sie zurückgezogen (gelöscht) werden darf — leer = darf. Rein. */
export function zurueckziehenGruende(r: Rechnung, eingang: boolean): string[] {
  const g: string[] = [];
  if (r.status !== 'gestellt') g.push(r.status === 'geplant' ? 'Ein Entwurf wird gelöscht, nicht zurückgezogen.' : `Die Rechnung ist ${r.status} — zurückziehen geht nur bei „gestellt“.`);
  if (r.art === 'storno' || r.stornoRechnungId) g.push('Stornos und stornierte Rechnungen bleiben, wie sie sind.');
  if (r.versendet?.length) g.push('Die Rechnung wurde aus MAKE OS versendet — sie wird storniert, nicht zurückgezogen.');
  if (r.mahnungen?.length) g.push('Zur Rechnung gibt es schon eine Mahnung — sie wird storniert, nicht zurückgezogen.');
  if (r.bezahltAm || eingang) g.push('Zur Rechnung gibt es einen Zahlungseingang — sie wird storniert, nicht zurückgezogen.');
  return g;
}

/**
 * Eine GESTELLTE, noch nicht versendete Rechnung zurückziehen (03.11.): Kevin hat ausdrücklich gewählt, eine versehentlich mit falscher Nummer
 * gestellte Rechnung zu löschen statt zu stornieren („Rechnung löschen, neu ab 0006“). Nur per Klick eines vollen Haushaltsmitglieds, mit Grund
 * und der eingetippten Rechnungsnummer als Bestätigung. Vorher eine verschlüsselte Archivkopie (Eintrag + PDF als Base64,
 * `archiv/rechnung-zurueckgezogen-<id>-<zeit>.json`, bleibt — keine Löschfrist), dann in EINER Finanzplan-Sperre: Rechnung raus, ihr PDF
 * aus der Ablage. Der Nummernkreis bleibt, wie er ist (die Nummer gilt als verbraucht); die nächste Nummer stellt „Nächste Rechnungsnummer“ ein.
 * Hinweis, keine Steuerberatung: nur für Rechnungen, die den Kunden nie erreicht haben — sonst stornieren.
 */
export async function rechnungZurueckziehen(p: { id: string; grund: unknown; bestaetigung: unknown; stand: unknown; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<{ id: string; nummer: string; archiv: string }> {
  const grund = typeof p.grund === 'string' ? p.grund.trim() : '';
  if (grund.length < 3) throw new RechnungFehler('Bitte einen Grund angeben (warum die Rechnung zurückgezogen wird).', 400);
  if (grund.length > 300) throw new RechnungFehler('Der Grund ist zu lang (höchstens 300 Zeichen).', 413);
  const eingangDa = async (id: string) => {
    const { eingangVon } = await import('@/lib/finanzen/finanzplan-buchung');
    const b = await loadJson<{ buchungen?: { id: string; betrag: number; rechnungId?: string }[] }>('buchungen');
    return !!eingangVon(Array.isArray(b?.buchungen) ? b!.buchungen : [], id);
  };
  const pruefen = async (r: Rechnung | undefined) => {
    if (!r || !inSicht(r, p.sicht)) throw new RechnungFehler('Rechnung nicht gefunden.', 404);
    const g = zurueckziehenGruende(r, await eingangDa(r.id));
    if (g.length) throw new RechnungFehler(g.join(' '), 409, { aktuell: mitFassung(r), grund: 'nicht-zurueckziehbar' });
    standPruefen(r, p.stand);
    if (typeof p.bestaetigung !== 'string' || p.bestaetigung.trim() !== (r.nummer ?? '')) throw new RechnungFehler(`Zur Bestätigung bitte die Rechnungsnummer ${r.nummer ?? ''} eintippen.`.trim(), 400, { grund: 'bestaetigung' });
    return r;
  };
  const r0 = await pruefen((await planLaden()).rechnungen.find(r => r.id === p.id));
  const { inhaltLaden, inhaltEntfernen, ablageName } = await import('@/lib/dateien/ablage');
  const pdf = r0.pdfDateiId ? await inhaltLaden(p.haushalt, r0.pdfDateiId).catch(() => null) : null;
  const { archivSchreiben, archivZeit } = await import('@/lib/store/archiv');
  const jetztIso = (p.jetzt ?? new Date()).toISOString();
  const archiv = await archivSchreiben(`rechnung-zurueckgezogen-${r0.id}-${archivZeit(jetztIso)}.json`, {
    art: 'rechnung-zurueckgezogen', am: jetztIso, grund, rechnung: r0, ...(pdf ? { pdf: { id: r0.pdfDateiId, base64: pdf.toString('base64') } } : {}),
  });
  const stand = fassung(r0);
  let weg: string[] = [];
  await updateJsonAsync<FinanzplanFile>('finanzplan', async cur => {
    const f = planBasis(cur);
    const a = f.rechnungen.find(r => r.id === p.id);
    if (!a || fassung(a) !== stand) throw new RechnungFehler('Wurde inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.', 409, { ...(a ? { aktuell: mitFassung(a) } : {}), grund: 'inzwischen geändert' });
    if ((await loadJson(ablageName(p.haushalt))) !== null) await updateJson<{ eintraege: { id: string; rechnungsPdf?: string }[] }>(ablageName(p.haushalt), c => {
      const l = c?.eintraege ?? [];
      weg = l.filter(x => x.rechnungsPdf === p.id).map(x => x.id);
      return weg.length ? { ...(c ?? {}), eintraege: l.filter(x => !weg.includes(x.id)) } : (c ?? { eintraege: [] });
    });
    return ugFirmaNachziehen({ ...f, rechnungen: f.rechnungen.filter(r => r.id !== p.id) });
  });
  for (const d of weg) await inhaltEntfernen(p.haushalt, d).catch(() => undefined);
  await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geloescht', id: r0.id, felder: ['zurueckgezogen'] }], p.wer);
  return { id: r0.id, nummer: r0.nummer ?? '', archiv };
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
    // 25.10.: eigenes Storno-Format der Gesellschaft (Vorgabe: das Rechnungsformat — wie bisher derselbe Kreis).
    const { lauf, nummer } = naechsteNummer(plan.rechnungen, cur?.zaehler?.[schluessel], o.firmaId as Gesellschaftskennung, jahr, kurzVon(g), mitVorgaben(g).stornoformat);
    const s: Rechnung = { ...stornoEntwurf(o, { id: neueKennung('r'), heute, grund, kleinunternehmer: ku }), nummer, lauf, absender: absenderAus(g), gestelltAm: jetztIso, gestelltVon: p.person };
    // E-Rechnung (31.10.): auch die Stornorechnung trägt die XML (Art 381, Bezug auf das Original) — ist sie unvollständig (Altbestand), bleibt es bei
    // der PDF: ein Storno muss immer gehen.
    const ez = g.eRechnungAus ? undefined : eRechnungEinbetten({ ...s, eRechnung: 'zugferd' }, g, ku, jetzt, o, false);
    if (ez) s.eRechnung = 'zugferd';
    const bytes = Buffer.from(await belegPdf(rechnungDokument(s, absenderAus(g, { ibanVoll: true }), { datum: heute, kleinunternehmer: ku, original: o }), { logo, erstellt: jetzt, vorSpeichern: ez }));
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
  // Kreislauf Geld (29.10., B6/B7): Ereignis „Rechnung storniert“ + offene Mahnaufgaben abbrechen — wirft nie.
  await import('./kreislauf').then(k => k.nachRechnungStorniert(e.o)).catch(() => undefined);
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
  // 30.10.: eine Mahnung geht raus wie die Rechnung — nur mit Zuordnung zur Markttraktion (Altbestand: erst zuordnen).
  const r0 = (await planLaden()).rechnungen.find(x => x.id === p.id);
  if (r0 && inSicht(r0, p.sicht) && r0.art !== 'storno' && r0.status === 'gestellt' && !(await zuordnungLebt(r0))) throw zuordnungFehler(true);
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

/** Das PDF einer Rechnung für den Versand aus der Inbox (25.10.): Kennung der Ablage-Datei, Status, Art — null ohne Rechnung bzw. ohne PDF. */
export async function rechnungPdfKennung(id: string): Promise<{ pdfDateiId: string; status: Rechnung['status']; art?: 'storno'; nummer?: string; email?: string; zugeordnet: boolean } | null> {
  const r = (await planLaden()).rechnungen.find(x => x.id === id);
  // `zugeordnet` (30.10.): der Versand prüft es — eine Rechnung ohne Firma, Person oder Mandat aus der Kartei geht nicht raus (Stornorechnungen schon).
  return r?.pdfDateiId ? { pdfDateiId: r.pdfDateiId, status: r.status, ...(r.art ? { art: r.art } : {}), ...(r.nummer ? { nummer: r.nummer } : {}), ...(r.empfaenger?.email ? { email: r.empfaenger.email } : {}), zugeordnet: await zuordnungLebt(r) } : null;
}

/**
 * „Versendet am … über …“ (25.10.): nach einem Versand aus der Inbox („Über <Postfach> senden (mit PDF)“) — nur der Server, nur nach dem Senden
 * (lib/inbox/senden-server.ts `bezug`), nur Rechnungen mit PDF (auch Stornorechnungen). `ueber` = Postfach-Adresse maskiert. Kein Status-Wechsel.
 */
export async function rechnungVersendetVermerken(p: { id: string; ueber: string; person: string; wer?: Wer; jetzt?: Date }): Promise<boolean> {
  const { versandSaeubern, VERSAND_MAX } = await import('./regeln');
  let neu = false;
  await updateJson<FinanzplanFile>('finanzplan', cur => {
    const f = planBasis(cur);
    const r = f.rechnungen.find(x => x.id === p.id);
    if (!r || !r.pdfDateiId || (r.versendet?.length ?? 0) >= VERSAND_MAX) return f;
    const n: Rechnung = { ...r, versendet: versandSaeubern([...(r.versendet ?? []), { am: (p.jetzt ?? new Date()).toISOString(), ueber: p.ueber, von: p.person }]) };
    neu = true;
    return { ...f, rechnungen: f.rechnungen.map(x => (x.id === p.id ? sauberFile({ rechnungen: [n] }).rechnungen[0] : x)) };
  });
  if (neu) await protokolliere('finanzplan', [{ liste: 'rechnungen', op: 'geaendert', id: p.id, felder: ['versendet'] }], p.wer);
  return neu;
}

export async function mahnTageSetzen(roh: unknown): Promise<[number, number, number]> {
  const t = mahnTageSaeubern(roh);
  if (!t) throw new RechnungFehler('Mahnstufen: drei steigende Tageszahlen zwischen 1 und 365 (z. B. 7 · 14 · 21).', 400);
  await updateJson<Rechnungswesen>(RECHNUNGSWESEN, cur => ({ ...(cur ?? {}), mahnTage: t }));
  return t;
}

// ── Nächste Rechnungsnummer je Gesellschaft (02.11.) ─────────────────────────

/** Die wirklich nächste Nummer eines Kreises (Rechnung und Storno teilen ihn) — für Stammdaten › Gesellschaften. */
export interface NaechsteNummer { id: Gesellschaftskennung; jahr: number; nr: number; rechnung: string; storno: string }

/** Je Gesellschaft der Sicht die nächste Nummer im Kreis des laufenden Jahres — dieselbe Rechnung wie „Stellen“ (`naechsteNummer`), nichts geschrieben. */
export async function naechsteNummern(z: { haushalt: string; sicht: Sicht }, jetzt = new Date()): Promise<{ jahr: number; nummern: NaechsteNummer[] }> {
  const jahr = Number(localDay(jetzt).slice(0, 4));
  const [plan, wesen, gs] = await Promise.all([planLaden(), loadJson<Rechnungswesen>(RECHNUNGSWESEN), gesellschaften(z.haushalt)]);
  const nummern = gs.filter(g => istGesellschaft(g.id) && gesellschaftInSicht(g.id, z.sicht)).map(g => {
    const id = g.id as Gesellschaftskennung;
    const v = mitVorgaben(g);
    const zaehler = wesen?.zaehler?.[kreisSchluessel(id, jahr)];
    const r = naechsteNummer(plan.rechnungen, zaehler, id, jahr, kurzVon(g), v.rechnungsformat);
    const s = naechsteNummer(plan.rechnungen, zaehler, id, jahr, kurzVon(g), v.stornoformat);
    return { id, jahr, nr: r.lauf.nr, rechnung: r.nummer, storno: s.nummer };
  });
  return { jahr, nummern };
}

/**
 * „Nächste Rechnungsnummer“ setzen (02.11.): der Zähler des Kreises (Gesellschaft + laufendes Jahr) wird `nr − 1` — NUR nach oben, in der
 * Sperre des Nummernkreises (dieselbe Stelle wie Stellen/Storno). `jahr` (optional) = das Jahr, das die Oberfläche zeigte — hat es inzwischen
 * gewechselt, 409 statt still im neuen Kreis. Protokoll nur Kennung + Feldname. Rechte prüft die Route (Sicht, Dienstweg); hier die Sicht noch einmal.
 */
export async function startnummerSetzen(p: { firmaId: unknown; nr: unknown; jahr?: unknown; haushalt: string; sicht: Sicht; wer?: Wer; jetzt?: Date }): Promise<NaechsteNummer> {
  const jahr = Number(localDay(p.jetzt ?? new Date()).slice(0, 4));
  if (!istGesellschaft(p.firmaId)) throw new RechnungFehler('Unbekannte Gesellschaft — eine nächste Rechnungsnummer gibt es für die festen Gesellschaften.', 400);
  const id = p.firmaId;
  if (!gesellschaftInSicht(id, p.sicht)) throw new RechnungFehler('Diese Gesellschaft stellt ein volles Haushaltsmitglied ein.', 403);
  if (p.jahr !== undefined && p.jahr !== jahr) throw new RechnungFehler(`Das Jahr hat gewechselt — die Einstellung gilt nur für den Kreis ${jahr}. Bitte neu laden und noch einmal.`, 409, { jahr });
  const schluessel = kreisSchluessel(id, jahr);
  // Nichts zu tun (gleicher Zähler bzw. „nächste = 1“ ohne Zähler) → gar nicht schreiben, auch keine neue Datei (bitgleich).
  const NICHTS = Symbol('nichts');
  let geaendert = false;
  try {
    await updateJsonAsync<Rechnungswesen>(RECHNUNGSWESEN, async cur => {
      const plan = await planLaden();
      const alt = cur?.zaehler?.[schluessel];
      const e = startnummerPruefen(plan.rechnungen, alt, id, jahr, p.nr);
      if (!e.ok) throw new RechnungFehler(e.text, e.status, e.hoechste !== undefined ? { hoechste: e.hoechste, grund: 'vergeben' } : {});
      if ((alt ?? 0) === e.zaehler) throw NICHTS;
      geaendert = true;
      return { ...(cur ?? {}), zaehler: { ...(cur?.zaehler ?? {}), [schluessel]: e.zaehler } };
    });
  } catch (e) { if (e !== NICHTS) throw e; }
  if (geaendert) await protokolliere(RECHNUNGSWESEN, [{ liste: 'zaehler', op: 'geaendert', id: schluessel, felder: ['zaehler'] }], p.wer);
  const n = (await naechsteNummern({ haushalt: p.haushalt, sicht: p.sicht }, p.jetzt)).nummern.find(x => x.id === id);
  if (!n) throw new RechnungFehler('Nicht gesetzt.', 500);
  return n;
}

/** Ein fälliger Mahnvorschlag mit seiner Aufgabe (Kennungs-Brücke `mahnAufgabeId`) und seinem Bereich — für den Schatten-Vergleich der Überführung (Paket Ü). */
export interface MahnSoll { id: string; bereich: 'privat' | 'business' }

/**
 * Der Kern der Mahnaufgaben (Paket Ü — der Morgenlauf und der feste Schritt `mahnaufgaben` rechnen hiermit): je fälligem Mahnvorschlag EINE Aufgabe (feste
 * Kennung `mahn-<rechnung>-<stufe>`) über den Aufgaben-Schreibweg — gibt es sie schon (auch erledigt oder im Papierkorb), passiert nichts. Titel ohne Betrag und
 * ohne Namen (Glocke, Telegram). `bereich` = welche Rechnungen (nach dem Bereich ihrer Gesellschaft); `schreiben: false` = nur rechnen (Schatten). Wirft.
 */
export async function mahnAufgabenKern(heute: string, o: { bereich: 'alle' | 'privat' | 'business'; schreiben: boolean }): Promise<{ neu: number; neueIds: string[]; soll: MahnSoll[] }> {
  const tage = await mahnTageLaden();
  const plan = await planLaden();
  const faellig: (MahnVorschlag & { r: Rechnung })[] = mahnVorschlaege(plan.rechnungen, heute, tage).map(v => ({ ...v, r: plan.rechnungen.find(r => r.id === v.rechnungId)! }))
    .filter(v => o.bereich === 'alle' || bereichVon(v.r.firmaId) === o.bereich);
  const soll: MahnSoll[] = faellig.map(v => ({ id: mahnAufgabeId(v.rechnungId, v.stufe), bereich: bereichVon(v.r.firmaId) }));
  if (!faellig.length || !o.schreiben) return { neu: 0, neueIds: [], soll };
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const jetzt = new Date().toISOString();
  let neueIds: string[] = [];
  await systemAufgabenAendern(stand => {
    const da = new Set(stand.tasks.map(t => t.id));
    const fehlen = faellig.filter(v => !da.has(mahnAufgabeId(v.rechnungId, v.stufe)));
    neueIds = fehlen.map(v => mahnAufgabeId(v.rechnungId, v.stufe));
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
  return { neu: neueIds.length, neueIds, soll };
}

/**
 * Morgenlauf (08.10.): je fälligem Mahnvorschlag EINE Aufgabe (`mahnAufgabenKern`). Versand bleibt ein Klick in Finanzen › Rechnungen & Zahlungen. Wirft nie.
 * Ablöse-Weiche (22.10., Paket Ü): die Mahnaufgaben der Business-Gesellschaften kann ein überführter Prozess der Werkstatt übernehmen (`sp-rechnung`) — hier wird die
 * Weiche GENAU EINMAL gefragt; arbeitet der neue Weg, bleiben hier nur die Privat-Gesellschaften (Prozesse sind Business). Rechnet der neue Weg im Schatten mit,
 * meldet dieser Lauf sein Wirkungsbild (Business) dem Vergleich. Ohne Überführung bit-gleich wie vorher.
 */
/** `fehler` (02.11., Prüfung C): der Lauf ist gescheitert — vorher kam dann still `{ neu: 0 }` zurück, und der Morgenlauf meldete „nichts fällig“. */
export async function mahnAufgabenNachziehen(heute = localDay()): Promise<{ neu: number; fehler?: string }> {
  try {
    const ue = await import('@/lib/prozesse/ueberfuehrung-server');
    const weg = await ue.wegFuer('sp-rechnung');
    const r = await mahnAufgabenKern(heute, { bereich: weg.weg === 'neu' ? 'privat' : 'alle', schreiben: true });
    if (weg.schatten) await ue.vergleichMeldenServer('sp-rechnung', 'alt', heute, (await import('@/lib/prozesse/system-schritte-server')).mahnBild(r.soll.filter(x => x.bereich === 'business'), heute));
    return { neu: r.neu };
  } catch (e) {
    console.error('[rechnung] Mahn-Aufgaben nicht angelegt:', e instanceof Error ? e.message : e);
    return { neu: 0, fehler: 'Mahn-Aufgaben nicht angelegt — der Lauf ist gescheitert.' };
  }
}

/** Art. 15: die Rechnungen, die an diese Person adressiert sind (Kartei-Verweis) — Nummer, Datum, Status, Betrag. */
export async function rechnungenAuskunft(kontaktId: string) {
  return (await planLaden()).rechnungen.filter(r => r.kontaktId === kontaktId)
    .map(r => ({ id: r.id, ...(r.nummer ? { nummer: r.nummer } : {}), titel: r.titel, status: r.status, ...(r.datum ? { datum: r.datum } : {}), betrag: r.betrag, ...(r.art ? { art: r.art } : {}) }));
}

/** Für Tests und den Bericht: Summen einer Rechnung in Cent. */
export const summenVon = (r: Rechnung, ku = false) => rechnungSummen(r.positionen ?? [], { kleinunternehmer: ku, vorzeichen: r.art === 'storno' ? -1 : 1 });
