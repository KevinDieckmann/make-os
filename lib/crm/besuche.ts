// ─── Besuchte Events — Wirkung, Übersicht, „Heute bei“, Export für Kunden (rein, getestet; 03.10.) ───
// Events = alle Veranstaltungen, die wir BESUCHEN (Kevin 03.10.): fremde Events, Messen, Kunden-Events. Dieselben Events
// wie bei „Netzwerken“ (`marke: Netzwerken`, lib/crm/marke.ts) — ein Bestand, kein zweiter Speicher. Die Make.One-
// Kennzahlen (Gäste, Zusagen, Nachfassen unserer EIGENEN Abende) bleiben getrennt: `istNetzwerkenEvent` filtert sie
// dort heraus; hier stehen die EIGENEN Kennzahlen der besuchten Events. Erfasste Kontakte, Deals und Umsatz zählen
// trotzdem normal in Sales (die Chancen sind ganz normale Chancen).
//
//   besuchWirkung       je Event: erfasste Kontakte, Follow-up-Quote, Termine, Deals (+ Pipeline/Umsatz), Kosten je Kontakt
//   besuchUebersicht    „Welche Events lohnen sich“ — Urteil je Event (ab 14 Tagen nach dem Event), Summe
//   besuchJeKunde       Auswertung je Kunde (und „MAKE selbst“)
//   besuchKennzahlen    die eigenen Kennzahlen der besuchten Events (nie im Score, nie in den Make.One-Kennzahlen)
//   heuteBeiAngebot     was „Heute bei“ in Netzwerken anbietet: heute, nahe Tage, Rest
//   kundenExport        „An Kunden übergeben“ — CSV nur mit Feldern, ohne Fotos/Sprachnotizen/Notizen, nie gesperrte Personen
// Recht: Kontakte, die wir für einen Kunden auf einem Event kennenlernen, verarbeiten wir in dessen Auftrag
// (Auftragsverarbeitung, Art. 28 DSGVO — AVV mit dem Kunden nötig). Herkunft und „keine Werbe-Einwilligung“ stehen im Export.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, Event, Teilnahme } from './typen';
import type { Kpi, KpiAmpel } from './kennzahlen';
import { gesamtwert, OFFENE_STUFEN } from './pipeline';
import { budgetSumme } from './eventplanung';
import { ausgenommen } from './einschraenkung';
import { istBesuch, besuchAbgesagt, fuerFirmaId, anmeldungVon, zielSchluessel } from './besuche-form';
import { tagVon } from '@/lib/zeit';
import { NETZWERKEN_QUELLE } from './netzwerken';

const plusTage = (datum: string, n: number): string => { const d = new Date(`${datum}T12:00:00Z`); if (Number.isNaN(d.getTime())) return datum; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tageZwischen = (von: string, bis: string): number => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);
const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** Ab so vielen Tagen nach dem Event wagt „Welche Events lohnen sich“ ein Urteil (vorher: zu früh). */
export const URTEIL_AB_TAGE = 14;
/** Wie lange nach dem Event ein neuer Deal mit einer erfassten Person noch dem Event zugerechnet wird. */
export const DEAL_FENSTER_TAGE = 180;

export interface BesuchKontext {
  teilnahmen: readonly Teilnahme[];
  kontakte: readonly Kontakt[];
  chancen: readonly Chance[];
  heute: string;
}

/** Die erfassten Personen eines Events (Teilnahmen ohne Absage/Nichterscheinen). */
export const erfassteTeilnahmen = (eventId: string, teilnahmen: readonly Teilnahme[]): Teilnahme[] =>
  teilnahmen.filter(t => t.eventId === eventId && t.status !== 'abgesagt' && t.status !== 'no_show');

export interface BesuchWirkung {
  /** Erfasste Kontakte. */
  kontakte: number;
  /** Davon mit gesetztem Nachfassen (Teilnahme.followUpAm — Termin, Angebot, Vermittlung, Einladung zählen am Erfassungstag). */
  nachgefasst: number;
  /** nachgefasst / kontakte (0–1) — null ohne Kontakte. */
  followupQuote: number | null;
  /** Noch nicht nachgefasst (ohne „Nachfassen ausgelassen“). */
  nachfassenOffen: number;
  /** Termine, die beim Erfassen vereinbart wurden. */
  termine: number;
  /** Entstandene/beeinflusste Deals (Kennungen) — für die Summe ohne Doppelzählung. */
  dealIds: string[];
  deals: number;
  /** Davon zählen fürs Urteil: nicht verloren/geparkt und keine Vermittlung ohne Wert (die ist ein Gefallen, kein Geschäft). */
  dealsUrteil: number;
  /** Gesamtwert der offenen Deals. */
  pipeline: number;
  /** Gesamtwert der gewonnenen Deals. */
  umsatz: number;
  /** Kosten (Budget bzw. Pauschale, Euro). */
  kosten: number;
  /** Euro je erfasstem Kontakt — null ohne Kosten oder Kontakte. */
  kostenJeKontakt: number | null;
  /** Zielpersonen/-firmen und wie viele davon getroffen sind (von Hand abgehakt ODER über „Netzwerken“ erfasst — `zielGetroffen`). */
  zielGesamt: number;
  zielGetroffen: number;
  /** Zielerreichungsgrad (0–1) — null ohne Ziele. */
  zielQuote: number | null;
}

/**
 * Wen wir treffen wollten und wen davon schon — EINE Regel für Akte und Wirkung (M14): getroffen ist, wer von Hand abgehakt ist, oder wer über
 * „Netzwerken“ erfasst wurde — eine Person über ihre Kennung, eine Zielfirma über jede erfasste Person, die zu dieser Firma gehört.
 * `abgeleitet` = nur über die Erfassung, nicht von Hand (die Akte zeigt „über Netzwerken erfasst“ und lässt es nicht abhaken).
 */
export function zielGetroffen(e: Pick<Event, 'id' | 'zielpersonen'>, teilnahmen: readonly Teilnahme[], kontakte: readonly Pick<Kontakt, 'id' | 'firmaId'>[]): { getroffen: Set<string>; abgeleitet: Set<string>; gesamt: number; anzahl: number; quote: number | null } {
  const erfasst = erfassteTeilnahmen(e.id, teilnahmen).filter(t => t.netzwerken || t.status === 'da');
  const personen = new Set(erfasst.map(t => t.kontaktId));
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const firmen = new Set(erfasst.map(t => nachId.get(t.kontaktId)?.firmaId).filter((f): f is string => !!f));
  const getroffen = new Set<string>(), abgeleitet = new Set<string>();
  const ziel = e.zielpersonen ?? [];
  for (const z of ziel) {
    const k = zielSchluessel(z);
    const ueber = z.kontaktId ? personen.has(z.kontaktId) : !!z.firmaId && firmen.has(z.firmaId);
    if (z.getroffen || ueber) getroffen.add(k);
    if (!z.getroffen && ueber) abgeleitet.add(k);
  }
  return { getroffen, abgeleitet, gesamt: ziel.length, anzahl: getroffen.size, quote: ziel.length ? getroffen.size / ziel.length : null };
}

/** Zählt der Deal fürs Urteil? Nicht verloren/geparkt, und keine Vermittlung ohne Wert. */
const dealZaehlt = (c: Chance): boolean => c.stufe !== 'verloren' && c.stufe !== 'geparkt' && !(c.art === 'vermittlung' && !(gesamtwert(c) > 0));

/**
 * Die Wirkung eines besuchten Events — aus Teilnahmen, Kontakten und Chancen (eine Rechnung für Akte, Übersicht und Kunden).
 * Ein Deal gehört dem Event, wenn er es als Quelle nennt — oder (bis 180 Tage danach) mit einer dort NEU über „Netzwerken“ angelegten Person entstand
 * und keine andere Quelle trägt (M12): ein Kunde, den wir längst kannten, und ein Deal aus einer Kampagne gehören nicht dem Event.
 */
export function besuchWirkung(e: Event, ctx: BesuchKontext): BesuchWirkung {
  const t = erfassteTeilnahmen(e.id, ctx.teilnahmen);
  const ids = new Set(t.map(x => x.kontaktId));
  const neu = new Set(t.filter(x => x.netzwerken && ctx.kontakte.some(k => k.id === x.kontaktId && k.id === `c-${x.netzwerken!.erfassungId}` && k.quelle === NETZWERKEN_QUELLE)).map(x => x.kontaktId));
  const bis = plusTage(e.datum, DEAL_FENSTER_TAGE);
  const deals = ctx.chancen.filter(c => (c.quelle === 'event' && c.quelleBezug === e.id)
    || (!c.quelle && c.kontaktIds.some(id => neu.has(id)) && tagVon(c.angelegt) >= e.datum && tagVon(c.angelegt) <= bis));
  const nachgefasst = t.filter(x => !!x.followUpAm).length;
  const kosten = budgetSumme(e);
  const z = zielGetroffen(e, ctx.teilnahmen, ctx.kontakte);
  return {
    kontakte: t.length, nachgefasst, followupQuote: t.length ? nachgefasst / t.length : null,
    nachfassenOffen: t.filter(x => !x.followUpAm && !x.nachfassenVerzichtet).length,
    termine: t.filter(x => !!x.netzwerken?.terminAm).length,
    dealIds: deals.map(c => c.id), deals: deals.length, dealsUrteil: deals.filter(dealZaehlt).length,
    pipeline: Math.round(deals.filter(c => OFFENE_STUFEN.includes(c.stufe)).reduce((a, c) => a + gesamtwert(c), 0)),
    umsatz: Math.round(deals.filter(c => c.stufe === 'gewonnen').reduce((a, c) => a + gesamtwert(c), 0)),
    kosten, kostenJeKontakt: kosten > 0 && t.length ? Math.round(kosten / t.length) : null,
    zielGesamt: z.gesamt, zielGetroffen: z.anzahl, zielQuote: z.quote,
  };
}

export type UrteilArt = 'lohnt' | 'laeuft' | 'frueh' | 'ohne';
export interface Urteil { art: UrteilArt; label: string; grund: string }

/**
 * Lohnt sich das Event? Einfache, offene Regel — erst ab `URTEIL_AB_TAGE` Tagen nach dem Event:
 *   lohnt   Deals da und Pipeline + Umsatz decken die Kosten (ohne Kosten: ein Deal genügt)
 *   läuft   Termine oder Deals da, aber noch nicht gedeckt — Gespräche laufen
 *   ohne    Kontakte erfasst, aber bisher weder Termin noch Deal
 *   früh    jünger als 14 Tage oder noch nicht stattgefunden
 */
export function besuchUrteil(e: Event, w: BesuchWirkung, heute: string): Urteil {
  const alter = tageZwischen(e.datum, heute);
  if (alter < URTEIL_AB_TAGE) return { art: 'frueh', label: 'zu früh', grund: alter < 0 ? 'Das Event hat noch nicht stattgefunden.' : `Ein Urteil gibt es ab ${URTEIL_AB_TAGE} Tagen nach dem Event.` };
  if (w.dealsUrteil > 0 && w.pipeline + w.umsatz >= w.kosten) return { art: 'lohnt', label: 'lohnt sich', grund: w.kosten > 0 ? 'Pipeline und Umsatz decken die Kosten.' : 'Es sind Deals entstanden.' };
  if (w.termine > 0 || w.dealsUrteil > 0) return { art: 'laeuft', label: 'läuft', grund: 'Gespräche laufen — die Kosten sind noch nicht gedeckt.' };
  return { art: 'ohne', label: 'bisher ohne Folge', grund: w.kontakte ? 'Kontakte erfasst, aber weder Termin noch Deal.' : 'Niemand erfasst.' };
}

/** Hat das besuchte Event WIRKLICH stattgefunden (für uns)? Angemeldet-und-vorbei oder geplant-und-vorbei zählt nicht — nur „besucht“ bzw. durchgeführt, nie abgesagt. */
export const besucht = (e: Event): boolean => istBesuch(e) && !besuchAbgesagt(e) && (anmeldungVon(e) === 'besucht' || e.status === 'durchgefuehrt');

export interface BesuchZeile { event: Event; wirkung: BesuchWirkung; urteil: Urteil }
export interface BesuchSumme { events: number; kontakte: number; kosten: number; kostenJeKontakt: number | null; deals: number; pipeline: number; umsatz: number; nachgefasst: number; followupQuote: number | null }

const REIHE: Record<UrteilArt, number> = { lohnt: 0, laeuft: 1, frueh: 2, ohne: 3 };
const wert = (z: BesuchZeile) => z.wirkung.pipeline + z.wirkung.umsatz - z.wirkung.kosten;

/** Die besuchten Events, die schon stattgefunden haben (nicht abgesagt) — mit Wirkung und Urteil, „lohnt sich“ zuerst. */
export function besuchUebersicht(events: readonly Event[], ctx: BesuchKontext): { zeilen: BesuchZeile[]; summe: BesuchSumme } {
  const zeilen = events.filter(e => besucht(e) && e.datum <= ctx.heute).map(event => {
    const wirkung = besuchWirkung(event, ctx);
    return { event, wirkung, urteil: besuchUrteil(event, wirkung, ctx.heute) };
  }).sort((a, b) => REIHE[a.urteil.art] - REIHE[b.urteil.art] || wert(b) - wert(a) || b.event.datum.localeCompare(a.event.datum));
  return { zeilen, summe: besuchSumme(zeilen, ctx) };
}

/** Summe über Zeilen — Deals werden über die Kennung nur einmal gezählt (ein Deal kann zu mehreren Events passen). */
export function besuchSumme(zeilen: readonly BesuchZeile[], ctx: Pick<BesuchKontext, 'chancen'>): BesuchSumme {
  const dealIds = new Set(zeilen.flatMap(z => z.wirkung.dealIds));
  const deals = ctx.chancen.filter(c => dealIds.has(c.id));
  const kontakte = zeilen.reduce((a, z) => a + z.wirkung.kontakte, 0);
  const kosten = zeilen.reduce((a, z) => a + z.wirkung.kosten, 0);
  const nachgefasst = zeilen.reduce((a, z) => a + z.wirkung.nachgefasst, 0);
  return {
    events: zeilen.length, kontakte, kosten, kostenJeKontakt: kosten > 0 && kontakte ? Math.round(kosten / kontakte) : null,
    deals: deals.length,
    pipeline: Math.round(deals.filter(c => OFFENE_STUFEN.includes(c.stufe)).reduce((a, c) => a + gesamtwert(c), 0)),
    umsatz: Math.round(deals.filter(c => c.stufe === 'gewonnen').reduce((a, c) => a + gesamtwert(c), 0)),
    nachgefasst, followupQuote: kontakte ? nachgefasst / kontakte : null,
  };
}

export interface KundeZeile extends BesuchSumme { firmaId: string | null; eventIds: string[] }

/** Auswertung je Kunde: ein Eintrag je Firma, für die wir unterwegs waren — und ein Eintrag „MAKE selbst“ (`firmaId: null`). Ohne abgesagte. */
export function besuchJeKunde(events: readonly Event[], ctx: BesuchKontext): KundeZeile[] {
  const gruppen = new Map<string | null, Event[]>();
  for (const e of events) {
    if (!istBesuch(e) || besuchAbgesagt(e)) continue;
    const k = fuerFirmaId(e);
    gruppen.set(k, [...(gruppen.get(k) ?? []), e]);
  }
  return Array.from(gruppen, ([firmaId, liste]) => {
    const zeilen = liste.map(event => { const wirkung = besuchWirkung(event, ctx); return { event, wirkung, urteil: besuchUrteil(event, wirkung, ctx.heute) }; });
    return { firmaId, eventIds: liste.map(e => e.id), ...besuchSumme(zeilen, ctx) };
  }).sort((a, b) => (a.firmaId === null ? 1 : 0) - (b.firmaId === null ? 1 : 0) || b.kontakte - a.kontakte);
}

/** Besuchte Events für einen Kunden (Firma) — für die Firmenakte; neueste zuerst. */
export const eventsFuerKunde = (events: readonly Event[], firmaId: string): Event[] =>
  events.filter(e => istBesuch(e) && fuerFirmaId(e) === firmaId).sort((a, b) => b.datum.localeCompare(a.datum));

// ── Kennzahlen der besuchten Events (eigene, nie im Score) ──────────────────

const prozent = (q: number) => `${Math.round(q * 100)} %`;
const euro = (n: number) => `${n.toLocaleString('de-DE')} €`;

/** Die eigenen Kennzahlen der besuchten Events, 90 Tage — getrennt von den Make.One-Kennzahlen (`eventKennzahlen`). */
export function besuchKennzahlen(events: readonly Event[], ctx: BesuchKontext): Kpi[] {
  const von = plusTage(ctx.heute, -89);
  const imFenster = events.filter(e => besucht(e) && e.datum >= von && e.datum <= ctx.heute);
  const { zeilen, summe } = besuchUebersicht(imFenster, ctx);
  const grau: KpiAmpel = 'grau';
  const quote = summe.followupQuote;
  const quoteAmpel: KpiAmpel = quote === null ? 'grau' : quote >= 0.8 ? 'gruen' : quote >= 0.5 ? 'gelb' : 'rot';
  return [
    { id: 'besuche_events', label: 'Besuchte Events · 90 Tage', wert: zeilen.length || null, anzeige: zeilen.length ? String(zeilen.length) : '—', ampel: grau, ziel: 'nach Plan',
      quelle: zeilen.length ? `${zeilen.filter(z => z.event.fuer?.art === 'kunde').length} davon für Kunden` : 'noch kein besuchtes Event' },
    { id: 'besuche_kontakte', label: 'Erfasste Kontakte', wert: summe.kontakte || null, anzeige: summe.kontakte ? String(summe.kontakte) : '—', ampel: grau, ziel: 'je Event',
      quelle: zeilen.length ? `aus ${zeilen.length} Event${zeilen.length === 1 ? '' : 's'}` : 'noch niemand erfasst' },
    { id: 'besuche_followup', label: 'Follow-up-Quote', wert: quote, anzeige: quote === null ? '—' : prozent(quote), ampel: quoteAmpel, ziel: '≥ 80 %',
      quelle: summe.kontakte ? `${summe.nachgefasst} von ${summe.kontakte} Kontakten mit nächstem Schritt erledigt` : 'noch niemand erfasst' },
    { id: 'besuche_deals', label: 'Termine und Deals', wert: summe.deals, anzeige: `${zeilen.reduce((a, z) => a + z.wirkung.termine, 0)} · ${summe.deals}`, ampel: grau, ziel: 'Termine · Deals',
      quelle: summe.deals ? `Pipeline ${euro(summe.pipeline)}${summe.umsatz ? ` · gewonnen ${euro(summe.umsatz)}` : ''}` : 'noch kein Deal aus diesen Events' },
    { id: 'besuche_kosten', label: 'Kosten je Kontakt', wert: summe.kostenJeKontakt, anzeige: summe.kostenJeKontakt === null ? '—' : euro(summe.kostenJeKontakt), ampel: grau, ziel: 'niedrig',
      quelle: summe.kosten ? `${euro(summe.kosten)} Kosten gesamt` : 'keine Kosten eingetragen' },
  ];
}

// ── „Heute bei“ in Netzwerken: Events aus dem Event-Kalender anbieten ──────

export interface HeuteBei { heute: Event[]; nah: Event[]; rest: Event[] }
const nachZeit = (a: Event, b: Event) => (a.uhrzeit ?? '99:99').localeCompare(b.uhrzeit ?? '99:99') || a.titel.localeCompare(b.titel, 'de');

/**
 * Was „Heute bei“ anbietet (Kevin 03.10.: aus dem Event-Kalender): `heute` = Events von heute (besuchte zuerst, dann unsere
 * Make.One-Abende), `nah` = BESUCHTE Events der nahen Tage (2 Tage zurück, 7 voraus), `rest` = alles andere nach Nähe.
 * Abgesagte nie (weder Anmeldestand noch Status).
 */
export function heuteBeiAngebot(events: readonly Event[], heute: string, o: { zurueck?: number; voraus?: number } = {}): HeuteBei {
  const zurueck = o.zurueck ?? 2, voraus = o.voraus ?? 7;
  const da = events.filter(e => !besuchAbgesagt(e));
  const abstand = (e: Event) => tageZwischen(heute, e.datum);
  const istHeute = da.filter(e => e.datum === heute).sort((a, b) => Number(istBesuch(b)) - Number(istBesuch(a)) || nachZeit(a, b));
  const nah = da.filter(e => istBesuch(e) && e.datum !== heute && abstand(e) >= -zurueck && abstand(e) <= voraus).sort((a, b) => Math.abs(abstand(a)) - Math.abs(abstand(b)) || a.datum.localeCompare(b.datum));
  const schon = new Set([...istHeute, ...nah].map(e => e.id));
  const rest = da.filter(e => !schon.has(e.id)).sort((a, b) => Math.abs(abstand(a)) - Math.abs(abstand(b)) || a.titel.localeCompare(b.titel, 'de'));
  return { heute: istHeute, nah, rest };
}

// ── An Kunden übergeben ─────────────────────────────────────────────────────

export const EXPORT_SPALTEN = ['Nachname', 'Vorname', 'Firma', 'Position', 'E-Mail', 'Telefon', 'Mobil', 'LinkedIn', 'Webseite', 'Kennengelernt am', 'Veranstaltung', 'Datum der Veranstaltung', 'Herkunft', 'Werbe-Einwilligung'] as const;
/** Die Herkunft jeder Zeile — bleibt vermerkt, damit der Kunde weiß, woher die Kontakte kommen. */
export const EXPORT_HERKUNFT = 'Visitenkarte, persönlich auf der Veranstaltung übergeben';
/** Der Vermerk zur Werbung — eine Visitenkarte ist keine Einwilligung (§ 7 UWG). */
export const EXPORT_KEINE_EINWILLIGUNG = 'keine (Visitenkarte, § 7 UWG)';
/** Der Hinweis, der überall zu lesen ist, wo Kontakte für Kunden entstehen oder übergeben werden. */
export const AVV_HINWEIS = 'Kontakte, die wir für einen Kunden kennenlernen, verarbeiten wir in dessen Auftrag (Auftragsverarbeitung, Art. 28 DSGVO) — dafür ist ein AVV mit dem Kunden nötig. Herkunft und „keine Werbe-Einwilligung“ bleiben vermerkt; gesperrte Personen (Art. 18, Werbesperre) gehen nie mit.';

/** Ein CSV-Feld: in Anführungszeichen, innere verdoppelt; Zeilenumbrüche zu Leerzeichen; Formel-Anfänge (= + - @) neutralisiert. */
export function csvFeld(v: string | undefined): string {
  const t = String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
  const sicher = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
  return `"${sicher.replace(/"/g, '""')}"`;
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event';

export interface KundenExport {
  csv: string;
  dateiname: string;
  /** Zeilen im Export. */
  anzahl: number;
  /** Nicht dabei: gesperrte Personen (Art. 18 / Werbesperre) und Teilnahmen ohne Person in der Kartei. */
  ausgelassen: { gesperrt: number; fehlend: number };
}

/**
 * Die Kontakte eines Events als CSV für den Kunden — NUR Felder (Name, Firma, Position, Mail, Telefon, Mobil, LinkedIn,
 * Webseite), dazu Datum, Veranstaltung, Herkunft und der Vermerk „keine Werbe-Einwilligung“. Nie: Fotos, Sprachnotizen,
 * Gesprächsnotizen, Kennungen. Nie: Personen mit Einschränkung (Art. 18) oder Werbesperre. Semikolon + BOM (Excel, Deutsch).
 */
export function kundenExport(o: { event: Event; teilnahmen: readonly Teilnahme[]; kontakte: readonly Kontakt[] }): KundenExport {
  const nachId = new Map(o.kontakte.map(k => [k.id, k]));
  const ausgelassen = { gesperrt: 0, fehlend: 0 };
  const zeilen: string[] = [];
  const t = [...erfassteTeilnahmen(o.event.id, o.teilnahmen)].sort((a, b) => (a.netzwerken?.erfasstAm ?? '').localeCompare(b.netzwerken?.erfasstAm ?? ''));
  for (const x of t) {
    const k = nachId.get(x.kontaktId);
    if (!k) { ausgelassen.fehlend++; continue; }
    if (ausgenommen(k)) { ausgelassen.gesperrt++; continue; }
    const am = x.netzwerken?.erfasstAm ? x.netzwerken.erfasstAm.slice(0, 10) : o.event.datum;
    zeilen.push([k.nachname, k.vorname, k.firma, k.position, k.email, k.telefon, k.sms, k.linkedin, k.firmaWebseite, tagDe(am), o.event.titel, tagDe(o.event.datum), EXPORT_HERKUNFT, EXPORT_KEINE_EINWILLIGUNG].map(csvFeld).join(';'));
  }
  const kopf = EXPORT_SPALTEN.map(csvFeld).join(';');
  return { csv: `﻿${[kopf, ...zeilen].join('\r\n')}\r\n`, dateiname: `kontakte-${slug(o.event.titel)}-${o.event.datum}.csv`, anzahl: zeilen.length, ausgelassen };
}
