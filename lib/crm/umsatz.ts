// ─── Kontakt öffnen · Reiter „Umsatz“ — Zuordnung und Kennzahlen (rein, getestet, 28.09.) ──
// Kevin (HubSpot als Vorbild: „Vom Angebot bis zum Zahlungseingang“): eine Kachel
// mit dem Umsatz, den wir mit dem Kunden gemacht haben, Angebote, Rechnungen und
// Zahlungseingang je eigene Kachel.
//
// Zuordnung — was gehört zu diesem Kontakt?
//   · Mandate und Deals, in denen er steht (kontaktIds), und — hat er eine Firma —
//     die der Firma (per Kennung `firmaId`, Name nur als Rückfall für alte Einträge:
//     `dealZuFirma`/`mandatZuFirma`).
//   · Rechnungen aus dem Finanzplan über `mandatId`; ohne Mandat-Bezug über den
//     Kundennamen (Firmenname bzw. Name der Person) als Rückfall — mit Hinweis
//     „per Name zugeordnet“. Eine Rechnung, die auf ein ANDERES Mandat zeigt, wird
//     nie per Name hergeholt. Private Posten (firmaId „privat“) zählen nie.
// Client-sicher: keine Server-Importe.

import type { Angebot, AngebotsStatus, Chance, CrmBestand, Firma, Mandat } from './typen';
import { angebotSummen } from './angebote';
import type { DateiEintrag, AngebotStatus } from '@/lib/dateien/regeln';
import { dealZuFirma, mandatZuFirma } from './firmen-bezug';
import { rechnungPasst, mrr } from './kunden';
import { einheitAusGesellschaft } from '@/lib/einheiten';
import { istPrivatPosten } from '@/lib/make-one/liquiditaet';
import { firmenGruppe } from './konzern';

/** Rechnung, wie sie im Finanzplan steht (app/api/state/finanzplan) — nur, was hier zählt. */
export interface UmsatzRechnung {
  id: string;
  firmaId?: string;
  mandatId?: string;
  kunde: string;
  titel: string;
  betrag: number;
  status: string;
  faellig?: string;
  nummer?: string;
  datum?: string;
  angebot?: string;
  angebotAm?: string;
  bezahltAm?: string;
  /** Storno (28.09., K3): Status `storniert` zählt weder als Umsatz noch als offen. */
  storniertAm?: string;
  stornoGrund?: string;
  /** Fingerabdruck vom GET — geht beim Ändern als `stand` zurück (409 bei fremder Änderung). */
  fassung?: string;
}

export interface ZugeordneteRechnung {
  r: UmsatzRechnung;
  /** Über den Kundennamen gefunden, nicht über das Mandat — Hinweis „per Name zugeordnet“. */
  perName: boolean;
  /** Das Mandat, aus dem sie stammt (wenn bekannt). */
  mandat?: Mandat;
  /** Einheit (Selbstständigkeit · KD Ventures · MAKE OS UG) — aus dem Mandat, sonst aus der Firma der Rechnung. */
  einheit?: string;
  ueberfaellig: boolean;
  /** Tage zwischen Fälligkeit und Zahlung (positiv = zu spät), nur bei bezahlten mit beiden Daten. */
  verzugTage?: number;
}

export interface UmsatzBezug {
  firma?: Firma;
  /** „Ganze Gruppe“ (28.09., #7): die Firmen der Gruppe (Mutter + Töchter), deren Umsatz mitzählt — nur mit Schalter. */
  gruppe?: Firma[];
  mandate: Mandat[];
  deals: Chance[];
  rechnungen: ZugeordneteRechnung[];
}

type KontaktKurz = { id: string; firmaId?: string; firma?: string; vorname?: string; nachname?: string };

/** Gleicher Name (Groß-/Kleinschreibung, Leerzeichen egal) — fängt kurze Namen wie „SAP“, die `rechnungPasst` (Wörter ab 4 Zeichen) nicht sieht. */
const gleicherName = (a: string, b: string) => { const n = (s: string) => s.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim(); return !!n(a) && n(a) === n(b); };
const tage = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** Der Name, unter dem Rechnungen ohne Mandat-Bezug gesucht werden: Firma, sonst die Person. */
export function kundenName(k: KontaktKurz, firma?: Pick<Firma, 'name'>): string {
  return (firma?.name || k.firma || `${k.vorname ?? ''} ${k.nachname ?? ''}`).trim();
}

/**
 * `opt.gruppe` (28.09., #7): Mandate, Deals und Rechnungen ALLER Firmen der Gruppe (oberste Mutter und alle
 * Töchter) zusammenfassen — der Schalter „ganze Gruppe“ im Reiter Umsatz. Ohne Gruppe wie bisher.
 */
export function umsatzBezug(k: KontaktKurz, crm: Pick<CrmBestand, 'firmen' | 'chancen' | 'mandate'>, rechnungen: UmsatzRechnung[], heute: string, opt: { gruppe?: boolean } = {}): UmsatzBezug {
  const firma = k.firmaId ? crm.firmen.find(f => f.id === k.firmaId) : undefined;
  const gruppe = firma && opt.gruppe ? firmenGruppe(crm.firmen, firma.id).map(id => crm.firmen.find(f => f.id === id)).filter((f): f is Firma => !!f) : undefined;
  const firmen = gruppe && gruppe.length > 1 ? gruppe : firma ? [firma] : [];
  const mandate = crm.mandate.filter(m => m.kontaktIds.includes(k.id) || firmen.some(f => mandatZuFirma(m, f)));
  const deals = crm.chancen.filter(c => c.kontaktIds.includes(k.id) || firmen.some(f => dealZuFirma(c, f)));
  const nachId = new Map(mandate.map(m => [m.id, m]));
  const alleMandatIds = new Set(crm.mandate.map(m => m.id));
  const name = kundenName(k, firma);
  const weitereNamen = firmen.filter(f => f.id !== firma?.id).map(f => f.name);
  const zugeordnet: ZugeordneteRechnung[] = [];
  for (const r of rechnungen) {
    if (istPrivatPosten(r)) continue;
    const m = r.mandatId ? nachId.get(r.mandatId) : undefined;
    let perName = false;
    if (!m) {
      // Zeigt die Rechnung auf ein anderes (bekanntes) Mandat, gehört sie nicht hierher.
      if (r.mandatId && alleMandatIds.has(r.mandatId)) continue;
      if (![name, ...weitereNamen].some(n => !!n && (gleicherName(n, r.kunde) || rechnungPasst({ kunde: n }, r)))) continue;
      perName = true;
    }
    const einheit = einheitAusGesellschaft(m?.gesellschaft) ?? einheitAusGesellschaft(r.firmaId);
    const ueberfaellig = r.status === 'gestellt' && !!r.faellig && r.faellig < heute;
    const verzugTage = r.status === 'bezahlt' && r.faellig && r.bezahltAm ? tage(r.faellig, r.bezahltAm) : undefined;
    zugeordnet.push({ r, perName, ...(m ? { mandat: m } : {}), ...(einheit ? { einheit } : {}), ueberfaellig, ...(verzugTage != null ? { verzugTage } : {}) });
  }
  // Neueste zuerst: nach Zahlung, Rechnungsdatum, Fälligkeit.
  const wann = (z: ZugeordneteRechnung) => z.r.bezahltAm ?? z.r.datum ?? z.r.faellig ?? z.r.angebotAm ?? '';
  zugeordnet.sort((a, b) => wann(b).localeCompare(wann(a)));
  return { ...(firma ? { firma } : {}), ...(firmen.length > 1 ? { gruppe: firmen } : {}), mandate, deals, rechnungen: zugeordnet };
}

export interface UmsatzKennzahlen {
  /** Umsatz gesamt = bezahlte Rechnungen. */
  bezahlt: number;
  /** Gestellt, noch nicht bezahlt (inkl. überfällig). */
  offen: number;
  ueberfaellig: number;
  anzahlUeberfaellig: number;
  /** Geplant (noch nicht gestellt). */
  geplant: number;
  /** Laufender Monatswert der aktiven Mandate (Honorar je Monat). */
  monatswert: number;
  aktiveMandate: number;
  gewonneneDeals: number;
  gewonnenWert: number;
  /** Je Einheit: bezahlt und offen. „ohne Einheit“ = weder Mandat noch Firma der Rechnung verraten sie. */
  jeEinheit: { einheit: string; bezahlt: number; offen: number }[];
  /** Je Jahr: bezahlt (Jahr der Zahlung, sonst des Rechnungsdatums). Aufsteigend. */
  jeJahr: { jahr: string; bezahlt: number }[];
  /** Wie viele Rechnungen nur per Name zugeordnet sind. */
  perName: number;
  /** Mittlerer Verzug der bezahlten Rechnungen in Tagen (null ohne Daten). */
  verzugSchnitt: number | null;
}

export const OHNE_EINHEIT = 'ohne Einheit';

export function umsatzKennzahlen(b: UmsatzBezug): UmsatzKennzahlen {
  const r = b.rechnungen;
  const summe = (l: ZugeordneteRechnung[]) => l.reduce((a, z) => a + (z.r.betrag || 0), 0);
  const bezahlt = r.filter(z => z.r.status === 'bezahlt');
  const gestellt = r.filter(z => z.r.status === 'gestellt');
  const ueber = gestellt.filter(z => z.ueberfaellig);
  const einheiten = new Map<string, { bezahlt: number; offen: number }>();
  for (const z of [...bezahlt, ...gestellt]) {
    const e = z.einheit ?? OHNE_EINHEIT;
    const x = einheiten.get(e) ?? { bezahlt: 0, offen: 0 };
    if (z.r.status === 'bezahlt') x.bezahlt += z.r.betrag || 0; else x.offen += z.r.betrag || 0;
    einheiten.set(e, x);
  }
  const jahre = new Map<string, number>();
  for (const z of bezahlt) {
    const j = (z.r.bezahltAm ?? z.r.datum ?? z.r.faellig ?? '').slice(0, 4);
    if (/^\d{4}$/.test(j)) jahre.set(j, (jahre.get(j) ?? 0) + (z.r.betrag || 0));
  }
  const verzug = bezahlt.map(z => z.verzugTage).filter((v): v is number => v != null);
  const gewonnen = b.deals.filter(c => c.stufe === 'gewonnen');
  return {
    bezahlt: summe(bezahlt), offen: summe(gestellt), ueberfaellig: summe(ueber), anzahlUeberfaellig: ueber.length,
    geplant: summe(r.filter(z => z.r.status === 'geplant')),
    monatswert: mrr(b.mandate), aktiveMandate: b.mandate.filter(m => m.status === 'aktiv').length,
    gewonneneDeals: gewonnen.length, gewonnenWert: gewonnen.reduce((a, c) => a + (c.wert?.betrag || 0), 0),
    jeEinheit: Array.from(einheiten.entries()).map(([einheit, v]) => ({ einheit, ...v })).sort((a, b) => (b.bezahlt + b.offen) - (a.bezahlt + a.offen)),
    jeJahr: Array.from(jahre.entries()).map(([jahr, v]) => ({ jahr, bezahlt: v })).sort((a, b) => a.jahr.localeCompare(b.jahr)),
    perName: r.filter(z => z.perName).length,
    verzugSchnitt: verzug.length ? Math.round(verzug.reduce((a, v) => a + v, 0) / verzug.length) : null,
  };
}

// ── Angebote: drei Quellen, eine Liste ─────────────────────────────────────
// 1. Rechnungs-Vorgänge im Finanzplan mit Angebotsnummer/-datum (geplant = offen,
//    gestellt/bezahlt = angenommen), 2. Deals in Stufe Angebot/Abschluss (offen) bzw.
//    mit Angebot in der Historie und jetzt gewonnen/verloren, 3. Einträge der Ablage
//    (art „angebot“, mit oder ohne PDF). Warum nicht als Rechnung mit Status „angebot“?
//    Der Finanzplan kennt nur geplant · gestellt · bezahlt, und die Liquiditätsvorschau
//    zählt jeden anderen Status wie „gestellt“ als sicheren Eingang — ein Angebot wäre
//    dort Geld, das es nicht gibt. Deshalb leben eigene Angebote in der Ablage.

export interface AngebotZeile {
  schluessel: string;
  /** `tool` (28.09.): aus dem Angebots-Tool (crm.angebote) — die übrigen sind Altbestand und bleiben lesbar. */
  quelle: 'tool' | 'rechnung' | 'deal' | 'ablage';
  titel: string;
  nummer?: string;
  datum?: string;
  betrag?: number;
  status: AngebotStatus;
  rechnungId?: string;
  dealId?: string;
  eintrag?: DateiEintrag;
  /** Nur `tool`: das Angebot und sein Status (entwurf · gestellt · angenommen · abgelehnt · abgelaufen · ersetzt). */
  angebot?: Angebot;
  toolStatus?: AngebotsStatus;
}

/** Status eines Tool-Angebots in der alten Dreiteilung (offen · angenommen · abgelehnt). */
const statusAlt = (s: AngebotsStatus): AngebotStatus => (s === 'angenommen' ? 'angenommen' : s === 'abgelehnt' || s === 'abgelaufen' || s === 'ersetzt' ? 'abgelehnt' : 'offen');

export function angeboteListe(b: UmsatzBezug, ablage: DateiEintrag[], tool: readonly Angebot[] = []): AngebotZeile[] {
  const zeilen: AngebotZeile[] = [];
  // Angebots-Tool zuerst (28.09.): Deals und Ablage-PDFs, die schon als Tool-Angebot da sind, nicht doppelt.
  const dealMitTool = new Set(tool.filter(a => a.dealId && a.status !== 'entwurf').map(a => a.dealId!));
  for (const a of tool) {
    const s = angebotSummen(a, { kleinunternehmer: !!a.absender?.kleinunternehmer });
    zeilen.push({ schluessel: `a:${a.id}`, quelle: 'tool', titel: a.titel || 'Angebot', ...(a.nummer ? { nummer: a.nummer } : {}), datum: (a.gestelltAm ?? a.geaendert).slice(0, 10), betrag: s.gesamt.brutto / 100, status: statusAlt(a.status), ...(a.dealId ? { dealId: a.dealId } : {}), angebot: a, toolStatus: a.status });
  }
  ablage = ablage.filter(e => !e.angebotId);
  const verknuepft = new Set(ablage.filter(e => e.art === 'angebot' && e.rechnungId).map(e => e.rechnungId!));
  for (const z of b.rechnungen) {
    if (!z.r.angebot && !z.r.angebotAm) continue;
    if (verknuepft.has(z.r.id)) continue; // der Ablage-Eintrag zeigt dasselbe Angebot (mit PDF)
    zeilen.push({ schluessel: `r:${z.r.id}`, quelle: 'rechnung', titel: z.r.titel || z.r.kunde, ...(z.r.angebot ? { nummer: z.r.angebot } : {}), ...(z.r.angebotAm ? { datum: z.r.angebotAm } : {}), betrag: z.r.betrag, status: z.r.status === 'geplant' ? 'offen' : 'angenommen', rechnungId: z.r.id });
  }
  const dealMitAblage = new Set(ablage.filter(e => e.art === 'angebot' && e.dealId).map(e => e.dealId!));
  for (const c of b.deals) {
    if (dealMitAblage.has(c.id) || dealMitTool.has(c.id)) continue;
    const warAngebot = c.historie?.some(h => h.stufe === 'angebot' || h.stufe === 'abschluss');
    const status: AngebotStatus | null = c.stufe === 'angebot' || c.stufe === 'abschluss' ? 'offen'
      : warAngebot && c.stufe === 'gewonnen' ? 'angenommen' : warAngebot && c.stufe === 'verloren' ? 'abgelehnt' : null;
    if (!status) continue;
    const h = [...(c.historie ?? [])].reverse();
    const am = (h.find(x => x.stufe === 'angebot') ?? h.find(x => x.stufe === 'abschluss'))?.am?.slice(0, 10);
    zeilen.push({ schluessel: `c:${c.id}`, quelle: 'deal', titel: c.titel, ...(am ? { datum: am } : {}), betrag: c.wert?.betrag, status, dealId: c.id });
  }
  for (const e of ablage.filter(x => x.art === 'angebot')) {
    zeilen.push({
      schluessel: `d:${e.id}`, quelle: 'ablage', titel: e.titel || e.datei?.name || e.angebot?.nummer || 'Angebot',
      ...(e.angebot?.nummer ? { nummer: e.angebot.nummer } : {}), ...(e.angebot?.datum ? { datum: e.angebot.datum } : {}),
      ...(e.angebot?.betrag != null ? { betrag: e.angebot.betrag } : {}), status: e.angebot?.status ?? 'offen',
      ...(e.rechnungId ? { rechnungId: e.rechnungId } : {}), ...(e.dealId ? { dealId: e.dealId } : {}), eintrag: e,
    });
  }
  return zeilen.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''));
}

/** Die Kennungen, mit denen die Ablage für diesen Kontakt gefiltert wird. */
export function ablageFilter(k: { id: string; firmaId?: string }, b: UmsatzBezug) {
  return { kontaktId: k.id, ...(b.firma ? { firmaId: b.firma.id } : {}), mandatIds: b.mandate.map(m => m.id), dealIds: b.deals.map(c => c.id), rechnungIds: b.rechnungen.map(z => z.r.id) };
}
