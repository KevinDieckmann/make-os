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
//   kundenVorschau     „An Kunden übergeben“, Schritt 1: wer käme mit (an diesem Event neu angelegt) und wer nur nach Haken (Bestandspersonen)
//   kundenExport        „An Kunden übergeben“, Schritt 2: CSV nur mit Feldern, ohne Fotos/Sprachnotizen/Notizen, nie gesperrte Personen
// Recht (Kevin 03.10.): Kontakte, die wir für einen Kunden auf einem Event kennenlernen, gehören auch uns — MAKE ist eigener
// Verantwortlicher (Art. 6 Abs. 1 lit. f), keine Sperre für die eigene Akquise. Die Weitergabe an den Kunden ist eine ÜBERMITTLUNG an
// einen Dritten (kein Auftrag): Transparenz in der Danke-Mail (Art. 13), Protokoll mit Empfänger und Personen (Art. 15/19),
// ungefragt nur Personen, die an DIESEM Event neu angelegt wurden — Bestandspersonen nur mit ausdrücklichem Haken je Person.
// Herkunft je Zeile steht im Export (aus den Daten, nie pauschal), dazu „keine Werbe-Einwilligung“. Rechtstexte: lib/crm/netzwerken-recht.ts.

import type { Kontakt } from '@/lib/make-one/crm';
import type { Chance, Event, Teilnahme } from './typen';
import type { Kpi, KpiAmpel } from './kennzahlen';
import { gesamtwert, OFFENE_STUFEN } from './pipeline';
import { budgetSumme } from './eventplanung';
import { ausgenommen } from './einschraenkung';
import { istBesuch, besuchAbgesagt, fuerFirmaId, anmeldungVon, anmeldungLabel, zielSchluessel, zielpersonGesperrt } from './besuche-form';
import { berlinTag } from './netzwerken';
import { NETZWERKEN_QUELLE } from './netzwerken';
import { tagVon } from '@/lib/zeit';
import { HERKUNFT } from '@/lib/make-one/crm';
import { KEINE_WERBE_EINWILLIGUNG } from './netzwerken-recht';

const plusTage = (datum: string, n: number): string => { const d = new Date(`${datum}T12:00:00Z`); if (Number.isNaN(d.getTime())) return datum; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tageZwischen = (von: string, bis: string): number => Math.round((Date.parse(`${bis}T12:00:00Z`) - Date.parse(`${von}T12:00:00Z`)) / 864e5);
const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

/** Ab so vielen Tagen nach dem Event wagt „Welche Events lohnen sich“ ein Urteil (vorher: zu früh). */
export const URTEIL_AB_TAGE = 14;
/** Wie lange nach dem Event ein neuer Deal mit einer erfassten Person noch dem Event zugerechnet wird. */
export const DEAL_FENSTER_TAGE = 180;
/** Innerhalb von so vielen Tagen nach dem Event muss nachgefasst sein, damit es für die Follow-up-Quote zählt (wie die 48-Stunden-Regel der Events, `followUpBis`). */
export const BESUCH_FOLLOWUP_TAGE = 2;
/** Die Definition der Follow-up-Quote der besuchten Events — steht als Tooltip und unter den Kennzahlen (Praxis-Prüfung M10). */
export const FOLLOWUP_QUOTE_DEFINITION = `Anteil der erfassten Personen, bei denen innerhalb von ${BESUCH_FOLLOWUP_TAGE} Tagen nach dem Event nachgefasst wurde (Follow-up, Termin, Gespräch oder Danke-Mail raus). Wer bewusst nicht nachgefasst wird („Nur Kontakt“, Verzicht), zählt nicht mit.`;

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
  /** Davon rechtzeitig nachgefasst: `followUpAm` gesetzt (Termin, Angebot, Vermittlung, Einladung, Danke-Mail zählen) und höchstens `BESUCH_FOLLOWUP_TAGE` Tage nach dem Event. */
  nachgefasst: number;
  /** Bezug der Quote: erfasste Personen ohne bewussten Verzicht („Nur Kontakt“) — wer nicht nachgefasst werden soll, drückt die Quote nicht. */
  followupBasis: number;
  /** nachgefasst / followupBasis (0–1) — null ohne Bezug. Definition: `FOLLOWUP_QUOTE_DEFINITION`. */
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
  const neu = new Set(t.filter(x => x.netzwerken && ctx.kontakte.some(k => k.id === x.kontaktId && k.id === `c-${x.netzwerken!.erfassungId}` && k.quelle === NETZWERKEN_QUELLE)).map(x => x.kontaktId));
  const bis = plusTage(e.datum, DEAL_FENSTER_TAGE);
  const deals = ctx.chancen.filter(c => (c.quelle === 'event' && c.quelleBezug === e.id)
    || (!c.quelle && c.kontaktIds.some(id => neu.has(id)) && tagVon(c.angelegt) >= e.datum && tagVon(c.angelegt) <= bis));
  const frist = plusTage(e.datum, BESUCH_FOLLOWUP_TAGE);
  const basis = t.filter(x => !x.nachfassenVerzichtet || !!x.followUpAm);
  const nachgefasst = basis.filter(x => !!x.followUpAm && x.followUpAm.slice(0, 10) <= frist).length;
  const kosten = budgetSumme(e);
  const z = zielGetroffen(e, ctx.teilnahmen, ctx.kontakte);
  return {
    kontakte: t.length, nachgefasst, followupBasis: basis.length, followupQuote: basis.length ? nachgefasst / basis.length : null,
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

/**
 * Zählt dieses besuchte Event als besucht? „Wer dort erfasst, hat es besucht“ (Praxis-Prüfung M10): ein Event mit Erfassungen zählt immer — auch wenn sein Datum
 * (noch) in der Zukunft liegt oder der Anmeldestand nicht umgesprungen ist; sonst entscheidet `besucht` (Anmeldestand/Status) und das Datum darf nicht in der Zukunft liegen.
 */
export function zaehltAlsBesucht(e: Event, teilnahmen: readonly Teilnahme[], heute: string): boolean {
  if (!istBesuch(e) || besuchAbgesagt(e)) return false;
  return erfassteTeilnahmen(e.id, teilnahmen).some(x => !!x.netzwerken || x.status === 'da') || (besucht(e) && e.datum <= heute);
}

export interface BesuchZeile { event: Event; wirkung: BesuchWirkung; urteil: Urteil }
export interface BesuchSumme { events: number; kontakte: number; kosten: number; kostenJeKontakt: number | null; deals: number; pipeline: number; umsatz: number; nachgefasst: number; followupBasis: number; followupQuote: number | null }

const REIHE: Record<UrteilArt, number> = { lohnt: 0, laeuft: 1, frueh: 2, ohne: 3 };
const wert = (z: BesuchZeile) => z.wirkung.pipeline + z.wirkung.umsatz - z.wirkung.kosten;

/** Die besuchten Events, die schon stattgefunden haben (nicht abgesagt) — mit Wirkung und Urteil, „lohnt sich“ zuerst. */
export function besuchUebersicht(events: readonly Event[], ctx: BesuchKontext): { zeilen: BesuchZeile[]; summe: BesuchSumme } {
  const zeilen = events.filter(e => zaehltAlsBesucht(e, ctx.teilnahmen, ctx.heute)).map(event => {
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
  const followupBasis = zeilen.reduce((a, z) => a + z.wirkung.followupBasis, 0);
  return {
    events: zeilen.length, kontakte, kosten, kostenJeKontakt: kosten > 0 && kontakte ? Math.round(kosten / kontakte) : null,
    deals: deals.length,
    pipeline: Math.round(deals.filter(c => OFFENE_STUFEN.includes(c.stufe)).reduce((a, c) => a + gesamtwert(c), 0)),
    umsatz: Math.round(deals.filter(c => c.stufe === 'gewonnen').reduce((a, c) => a + gesamtwert(c), 0)),
    nachgefasst, followupBasis, followupQuote: followupBasis ? nachgefasst / followupBasis : null,
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

/**
 * Begegnungen bei Events für eine Firma (M15, Firmenakte): jede Person der Firma, die bei einem Event war (Teilnahme „da“ bzw. über Netzwerken erfasst),
 * und jedes besuchte Event, das diese Firma als Ziel nennt (Zielfirma, ggf. mit Treffer). Eingeschränkte Personen (Art. 18) fehlen — ihr Name steht nirgends.
 * Neueste Events zuerst; je Event die Personen, `ziel` = die Firma stand auf der Zielliste, `getroffen` = jemand von ihr war dort.
 */
export interface FirmenBegegnung { event: Event; personen: Kontakt[]; ziel: boolean; getroffen: boolean }
export function begegnungenFuerFirma(events: readonly Event[], teilnahmen: readonly Teilnahme[], kontakte: readonly Kontakt[], firmaId: string): FirmenBegegnung[] {
  const personen = new Map(kontakte.filter(k => k.firmaId === firmaId && !k.eingeschraenkt).map(k => [k.id, k]));
  const raus: FirmenBegegnung[] = [];
  for (const e of events) {
    if (besuchAbgesagt(e)) continue;
    const dort = teilnahmen.filter(t => t.eventId === e.id && personen.has(t.kontaktId) && (t.status === 'da' || !!t.netzwerken));
    const ziel = istBesuch(e) && (e.zielpersonen ?? []).some(z => z.firmaId === firmaId || (!!z.kontaktId && personen.has(z.kontaktId)));
    if (!dort.length && !ziel) continue;
    raus.push({ event: e, personen: dort.map(t => personen.get(t.kontaktId)!), ziel, getroffen: dort.length > 0 });
  }
  return raus.sort((a, b) => b.event.datum.localeCompare(a.event.datum));
}

/**
 * Was die Firmenakte zu einem Event sagt: „besucht“ nur, wenn jemand von der Firma dort WAR (Teilnahme) bzw. das Event stattgefunden hat — ein Event in der Zukunft
 * steht als „angemeldet“/„geplant“ (Praxis-Prüfung), Make.One-Abende als „Make.One“.
 */
export function begegnungStatus(b: Pick<FirmenBegegnung, 'event' | 'getroffen'>, heute: string): string {
  if (!istBesuch(b.event)) return 'Make.One';
  if (b.getroffen || (besucht(b.event) && b.event.datum <= heute)) return 'besucht';
  const a = anmeldungVon(b.event);
  return a === 'besucht' ? 'angemeldet' : anmeldungLabel(a).toLowerCase();
}

/**
 * „Angemeldet, aber kein Termin im Kalender“ (N5, Glocke und Heute): besuchte Events mit Anmeldestand „angemeldet“, die in den nächsten `tage` Tagen
 * stattfinden und noch keinen Kalender-Termin haben (`kalenderUid` fehlt) — nur für die, die hingehen (`wer`; ohne Angabe die Zuständige bzw. alle).
 */
export function eventsOhneTermin(events: readonly Event[], heute: string, person: string, tage = 7): { id: string; titel: string; tag: string; inTagen: number }[] {
  const bis = plusTage(heute, tage);
  return events.filter(e => istBesuch(e) && anmeldungVon(e) === 'angemeldet' && !e.kalenderUid && e.datum >= heute && e.datum <= bis
    && (e.wer?.length ? e.wer.includes(person) : !e.zustaendig || e.zustaendig === person || e.zustaendig === 'beide'))
    .sort((a, b) => a.datum.localeCompare(b.datum))
    .map(e => ({ id: e.id, titel: e.titel, tag: e.datum, inTagen: tageZwischen(heute, e.datum) }));
}

// ── Kennzahlen der besuchten Events (eigene, nie im Score) ──────────────────

const prozent = (q: number) => `${Math.round(q * 100)} %`;
const euro = (n: number) => `${n.toLocaleString('de-DE')} €`;

/** Die eigenen Kennzahlen der besuchten Events, 90 Tage — getrennt von den Make.One-Kennzahlen (`eventKennzahlen`). */
export function besuchKennzahlen(events: readonly Event[], ctx: BesuchKontext): Kpi[] {
  const von = plusTage(ctx.heute, -89);
  const imFenster = events.filter(e => e.datum >= von && zaehltAlsBesucht(e, ctx.teilnahmen, ctx.heute));
  const { zeilen, summe } = besuchUebersicht(imFenster, ctx);
  const grau: KpiAmpel = 'grau';
  const quote = summe.followupQuote;
  const quoteAmpel: KpiAmpel = quote === null ? 'grau' : quote >= 0.8 ? 'gruen' : quote >= 0.5 ? 'gelb' : 'rot';
  return [
    { id: 'besuche_events', label: 'Besuchte Events · 90 Tage', wert: zeilen.length || null, anzeige: zeilen.length ? String(zeilen.length) : '—', ampel: grau, ziel: 'nach Plan',
      quelle: zeilen.length ? `${zeilen.filter(z => z.event.fuer?.art === 'kunde').length} davon für Kunden` : 'noch kein besuchtes Event' },
    { id: 'besuche_kontakte', label: 'Erfasste Kontakte', wert: summe.kontakte || null, anzeige: summe.kontakte ? String(summe.kontakte) : '—', ampel: grau, ziel: 'je Event',
      quelle: zeilen.length ? `aus ${zeilen.length} Event${zeilen.length === 1 ? '' : 's'}` : 'noch niemand erfasst' },
    { id: 'besuche_followup', label: 'Follow-up-Quote', wert: quote, anzeige: quote === null ? '—' : prozent(quote), ampel: quoteAmpel, ziel: '≥ 80 %', definition: FOLLOWUP_QUOTE_DEFINITION,
      quelle: summe.followupBasis ? `${summe.nachgefasst} von ${summe.followupBasis} Personen rechtzeitig nachgefasst` : summe.kontakte ? 'alle ohne Nachfassen vorgesehen' : 'noch niemand erfasst' },
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

export const EXPORT_SPALTEN = ['Nachname', 'Vorname', 'Firma', 'Position', 'E-Mail', 'Telefon', 'Mobil', 'LinkedIn', 'Webseite', 'Kennengelernt am', 'Veranstaltung', 'Datum der Veranstaltung', 'Herkunft', 'Datenschutzhinweis erteilt', 'Werbe-Einwilligung'] as const;
/** Der Vermerk zur Werbung — eine Visitenkarte ist keine Einwilligung (§ 7 UWG). */
export const EXPORT_KEINE_EINWILLIGUNG = KEINE_WERBE_EINWILLIGUNG;
export { UEBERGABE_HINWEIS, ROLLE_HINWEIS, DATEI_LOESCHEN_HINWEIS } from './netzwerken-recht';

/**
 * Ein CSV-Feld: in Anführungszeichen, innere verdoppelt; Zeilenumbrüche zu Leerzeichen; Formel-Anfänge (= + - @ Tab) neutralisiert.
 * Telefonnummern, die streng wie `+49 171 1234567` aussehen, bleiben unverändert (`zahl`) — ein führendes Apostroph würde die Nummer verfälschen.
 */
export function csvFeld(v: string | undefined, o: { telefon?: boolean } = {}): string {
  const t = String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
  const sicher = o.telefon && /^\+[\d ]{6,20}$/.test(t) ? t : /^[=+\-@\t]/.test(t) ? `'${t}` : t;
  return `"${sicher.replace(/"/g, '""')}"`;
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event';

/**
 * Herkunft einer Zeile aus den DATEN: neu angelegt (mit/ohne Kartenfoto) oder wiedergetroffen (mit der bisherigen Herkunft der Person) —
 * und ob persönlich gesprochen wurde (`keinGespraech`: dann steht nie „persönlich kennengelernt“; Art. 13/14: die Angabe muss stimmen).
 */
export function exportHerkunft(k: Pick<Kontakt, 'herkunft' | 'quelle'>, t: Pick<Teilnahme, 'netzwerken'>): string {
  const n = t.netzwerken;
  const gesprochen = !n?.keinGespraech;
  if (n?.neuAngelegt) {
    if (!gesprochen) return n.kartenfoto ? 'Visitenkarte auf der Veranstaltung erhalten, kein persönliches Gespräch' : 'Auf der Veranstaltung erfasst, kein persönliches Gespräch';
    return n.kartenfoto ? 'Persönlich auf der Veranstaltung kennengelernt, Visitenkarte übergeben' : 'Persönlich auf der Veranstaltung kennengelernt';
  }
  const vorher = HERKUNFT.find(h => h.id === k.herkunft)?.label ?? (k.quelle ? `Quelle: ${k.quelle}` : 'Herkunft nicht vermerkt');
  return `Bereits bekannt (${vorher}), auf der Veranstaltung ${gesprochen ? 'wiedergetroffen' : 'wiedergesehen, kein persönliches Gespräch'}`;
}

const EW_KANAL_TEXT: Record<string, string> = { mail: 'E-Mail', telefon: 'Telefon', social: 'Social', newsletter: 'Newsletter', einladung: 'Einladung' };
/**
 * Spalte „Werbe-Einwilligung“ je Zeile: „keine (Visitenkarte, § 7 UWG)“ NUR bei einer Person, die hier per Visitenkarte neu erfasst wurde;
 * sonst der echte Stand aus der Kartei (gültige Einwilligungen mit Kanal und Tag, sonst „keine vermerkt“) — nie pauschal.
 */
export function exportWerbeEinwilligung(k: Pick<Kontakt, 'einwilligungen'>, t: Pick<Teilnahme, 'netzwerken'>): string {
  if (t.netzwerken?.neuAngelegt) return KEINE_WERBE_EINWILLIGUNG;
  const gueltig = (k.einwilligungen ?? []).filter(e => e.grundlage === 'einwilligung' && !e.widerrufenAm);
  if (!gueltig.length) return 'keine vermerkt';
  return gueltig.map(e => `${EW_KANAL_TEXT[e.kanal] ?? e.kanal} seit ${tagDe(e.erteiltAm)}`).join(', ');
}

export interface UebergabeZeile {
  kontaktId: string; name: string; firma?: string;
  /** An DIESEM Event neu angelegt (geht ungefragt mit) — sonst Bestandsperson: nur mit Haken. */
  neu: boolean;
  /** Datenschutzhinweis (Art. 13) erteilt — sonst im Dialog „noch nicht informiert“. */
  informiert: boolean;
  /** Art. 18 oder Werbesperre: geht nie mit. */
  gesperrt: 'eingeschraenkt' | 'werbesperre' | null;
  herkunft: string;
}
export interface UebergabeVorschau { zeilen: UebergabeZeile[]; fehlend: number }

/** Wer wäre bei einer Übergabe dabei? Nur Teilnahmen „da“ mit Netzwerken-Angabe; Person muss in der Kartei stehen (sonst `fehlend`). */
export function kundenVorschau(o: { event: Event; teilnahmen: readonly Teilnahme[]; kontakte: readonly Kontakt[] }): UebergabeVorschau {
  const nachId = new Map(o.kontakte.map(k => [k.id, k]));
  let fehlend = 0;
  const zeilen: UebergabeZeile[] = [];
  const t = o.teilnahmen.filter(x => x.eventId === o.event.id && x.status === 'da' && !!x.netzwerken).sort((a, b) => (a.netzwerken?.erfasstAm ?? '').localeCompare(b.netzwerken?.erfasstAm ?? ''));
  for (const x of t) {
    const k = nachId.get(x.kontaktId);
    if (!k) { fehlend++; continue; }
    const nameTeile = [k.vorname, k.nachname].filter(Boolean).join(' ').trim();
    zeilen.push({ kontaktId: k.id, name: nameTeile || k.firma || '—', ...(k.firma ? { firma: k.firma } : {}), neu: !!x.netzwerken?.neuAngelegt, informiert: !!k.datenschutzInformiertAm, gesperrt: zielpersonGesperrt(k), herkunft: exportHerkunft(k, x) });
  }
  return { zeilen, fehlend };
}

export interface KundenExport {
  csv: string;
  dateiname: string;
  /** Zeilen im Export. */
  anzahl: number;
  /** Kennungen der übergebenen Personen — für das Protokoll am Event (Art. 15/19); fallen bei Art. 17 mit der Person weg. */
  kontaktIds: string[];
  /** Nicht dabei: gesperrte Personen (Art. 18 / Werbesperre), Teilnahmen ohne Person in der Kartei und Bestandspersonen ohne Haken. */
  ausgelassen: { gesperrt: number; fehlend: number; bestand: number };
}

/**
 * Die Kontakte eines Events als CSV für den Kunden — NUR Felder (Name, Firma, Position, Mail, Telefon, Mobil, LinkedIn,
 * Webseite), dazu Datum (Berliner Tag), Veranstaltung, Herkunft je Zeile, „Datenschutzhinweis erteilt“ und der Vermerk „keine
 * Werbe-Einwilligung“. Nie: Fotos, Sprachnotizen, Gesprächsnotizen, Kennungen. Nie: Personen mit Einschränkung (Art. 18) oder
 * Werbesperre. Ungefragt nur Personen, die an diesem Event NEU angelegt wurden; Bestandspersonen nur, wenn ihre Kennung in
 * `bestandIds` steht (der Haken im Dialog). Semikolon + BOM (Excel, Deutsch).
 */
export function kundenExport(o: { event: Event; teilnahmen: readonly Teilnahme[]; kontakte: readonly Kontakt[]; bestandIds?: readonly string[] }): KundenExport {
  const nachId = new Map(o.kontakte.map(k => [k.id, k]));
  const haken = new Set(o.bestandIds ?? []);
  const ausgelassen = { gesperrt: 0, fehlend: 0, bestand: 0 };
  const zeilen: string[] = [];
  const kontaktIds: string[] = [];
  const t = o.teilnahmen.filter(x => x.eventId === o.event.id && x.status === 'da' && !!x.netzwerken).sort((a, b) => (a.netzwerken?.erfasstAm ?? '').localeCompare(b.netzwerken?.erfasstAm ?? ''));
  for (const x of t) {
    const k = nachId.get(x.kontaktId);
    if (!k) { ausgelassen.fehlend++; continue; }
    if (ausgenommen(k)) { ausgelassen.gesperrt++; continue; }
    if (!x.netzwerken?.neuAngelegt && !haken.has(k.id)) { ausgelassen.bestand++; continue; }
    if (kontaktIds.includes(k.id)) continue; // eine Person nur einmal
    kontaktIds.push(k.id);
    const am = x.netzwerken?.erfasstAm ? berlinTag(x.netzwerken.erfasstAm) : o.event.datum;
    zeilen.push([
      csvFeld(k.nachname), csvFeld(k.vorname), csvFeld(k.firma), csvFeld(k.position), csvFeld(k.email), csvFeld(k.telefon, { telefon: true }), csvFeld(k.sms, { telefon: true }), csvFeld(k.linkedin), csvFeld(k.firmaWebseite),
      csvFeld(tagDe(am)), csvFeld(o.event.titel), csvFeld(tagDe(o.event.datum)), csvFeld(exportHerkunft(k, x)), csvFeld(k.datenschutzInformiertAm ? tagDe(k.datenschutzInformiertAm) : 'nein'), csvFeld(exportWerbeEinwilligung(k, x)),
    ].join(';'));
  }
  const kopf = EXPORT_SPALTEN.map(s => csvFeld(s)).join(';');
  return { csv: `﻿${[kopf, ...zeilen].join('\r\n')}\r\n`, dateiname: `kontakte-${slug(o.event.titel)}-${o.event.datum}.csv`, anzahl: zeilen.length, kontaktIds, ausgelassen };
}
