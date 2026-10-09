// ─── Deal anlegen — EIN Weg (Server, 27.09.) ────────────────────────────────
// Bis 26.09. entstanden Deals auf sechs Wegen (Leads › SQL, „+ Gespräch“, Pipeline
// „+ Deal“, „Im Gespräch“, Karteikarte, ZOE) — vier davon an der Lead-Ebene
// vorbei. Jetzt läuft alles hier durch: Firma per Kennung, Personen, Kernfragen
// aus dem Lead, Pflicht zum nächsten Schritt, kein zweiter offener Deal an
// derselben Firma ohne Absicht, und der Lead wird SQL mit Verweis auf den Deal.
//
// Ablaufprüfung 28.09.:
//  · W8: eine eingeschränkte Person (Art. 18) bekommt keinen Deal — 409 mit `EINGESCHRAENKT_FEHLER`.
//  · W6: eine GESETZTE Lifecycle-Phase unter „Opportunity“ wird Opportunity (`phaseHeben`); leer bleibt leer
//    (dann gilt weiter der Vorschlag aus den Daten) — wie der Mandat-Weg es für „Kunde“ tut.
//  · (e) Mehr als 20 Personen: 413 mit Grund statt stillem Kürzen.
//  · (d) Titel ohne Firma trägt keinen vollen Personennamen mehr („Deal · Retainer · M.“) — Titel wandern in
//    Mandate, Exporte und Auswertungen und überlebten sonst ein Löschen nach Art. 17.
//
// Woche 1 (08.10., MARKTTRAKTION_BEFUND 2.3/2.5):
//  · EIN Regelwerk für SQL: der Lead wird nur SQL, wenn er nach den Scoring-Einstellungen SQL-bereit ist (`salesBereit`). Sonst
//    entsteht der Deal trotzdem, der Lead bleibt aber vor dem SQL stehen und trägt den Vermerk „direkt angelegt“ (`direktAm`,
//    `direktOffen` = was bis zum SQL fehlte). Gilt für jeden Anlageweg (Pipeline, Leads, Gesprächsmodus, ZOE, Netzwerken-„Vermittlung“,
//    Angebot stellen) — SQL-Zahl und Trichter zählen nur echte SQLs.
//  · Quelle: ohne Angabe aus der Herkunft des Leads (`quelleAusLead`: Marketing-Herkunft, sonst Herkunftskanal) — nie fest vorbelegt.

import { loadJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { tagVon } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { aendereCrm } from './speicher';
import { leads, leereKriterien, salesBereit, fehltBisSqlZeile, quelleAusLead, type LeadZeile } from './leads';
import { ladeScoring } from './scoring-server';
import { OFFENE_STUFEN, DEAL_PERSONEN_MAX } from './pipeline';
import { wer, BEIDE, verantwortlich } from './team';
import { dealZuFirma } from './firmen-bezug';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';
import { phaseHeben } from './lifecycle';
import type { Chance, ChancenArt, Gesellschaft, Lead, LeadStatus, Quelle, WertBasis } from './typen';
import { istRegisterKennung } from '@/lib/einheiten';
import { neueKennung } from '@/lib/kennung';

export interface DealEingabe {
  /** Feste Kennung für wiederholbare Wege (Netzwerken, 02.10.: `ch-nw-<Erfassung>`) — fehlt sie, entsteht eine neue. */
  id?: string;
  titel?: string;
  kontaktIds?: string[];
  firmaId?: string;
  art?: ChancenArt;
  wert?: { betrag?: number; basis?: WertBasis; laufzeitMonate?: number };
  /** Pflicht: was als Nächstes passiert, mit Datum. */
  schritt?: { text?: string; datum?: string };
  quelle?: Quelle; quelleBezug?: string;
  leistungId?: string; gesellschaft?: Gesellschaft; erwartetAm?: string; notiz?: string;
  besitzer?: string;
  /** Zweiten offenen Deal an derselben Firma bewusst anlegen. */
  trotzdem?: boolean;
  /** Direkt in einer späteren Stufe anlegen (nur offene Stufen; ZOE). */
  stufe?: Chance['stufe'];
}

const ARTEN: ChancenArt[] = ['retainer', 'projekt', 'workshop', 'vermittlung', 'software'];
const ART_WORT: Record<ChancenArt, string> = { retainer: 'Retainer', projekt: 'Projekt', workshop: 'Workshop', vermittlung: 'Vermittlung', software: 'Software' };
/** Höchstens so viele Personen an einem Deal (wie `LISTEN_GRENZEN` im Bestand) — darüber 413, nie still gekürzt. */
// Grenze und Vorgabe der Personen am Deal stehen client-sicher in lib/crm/pipeline.ts (2.4, 09.10.).
export { DEAL_PERSONEN_MAX, dealPersonenVorgabe } from './pipeline';

/**
 * Titel ohne Titel-Eingabe: mit Firma „<Firma> · <Art>“, ohne Firma „Deal · <Art>“ plus Anfangsbuchstabe des
 * Nachnamens — nie der volle Name einer Person (Datensparsamkeit; der Titel wird Mandat-Name, Export, Auswertung).
 */
export function dealTitel(art: ChancenArt, firma: { name: string } | undefined, person: Pick<Kontakt, 'nachname'> | undefined): string {
  if (firma) return `${firma.name} · ${ART_WORT[art]}`;
  const initial = (person?.nachname ?? '').trim().charAt(0).toUpperCase();
  return `Deal · ${ART_WORT[art]}${initial ? ` · ${initial}.` : ''}`;
}
const QUELLEN: Quelle[] = ['empfehlung', 'event', 'content', 'outreach', 'bestand', 'inbound', 'kampagne'];
const GES: Gesellschaft[] = ['kdv', 'kdc', 'ug', 'offen'];
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
export const neueDealId = () => neueKennung('ch');

/**
 * `sql`: der Lead war SQL-bereit und wurde SQL. Sonst `direkt` mit dem, was bis zum SQL fehlte — der Lead trägt dann den Vermerk
 * „direkt angelegt“ (2.3). `vorStatus`: der Status des Leads vor dem Deal (für den Vermerk).
 */
export type DealErgebnis = { ok: true; chance: Chance; leadId?: string; text: string; sql: boolean; fehlt: string[]; vorStatus?: LeadStatus } | { ok: false; fehler: string; status: number; offen?: { id: string; titel: string } };

/** Reine Prüfung und Bau des Deals — ohne Schreiben (getestet). */
export function dealBauen(e: DealEingabe, ctx: { kontakte: Kontakt[]; firmen: { id: string; name: string; lead?: Lead }[]; chancen: Chance[]; leadZeilen: LeadZeile[]; person: string; jetzt: string; id?: string }): DealErgebnis {
  const schritt = e.schritt && String(e.schritt.text ?? '').trim() && tagOk(e.schritt.datum) ? { text: String(e.schritt.text).trim().slice(0, 300), datum: tagOk(e.schritt.datum)! } : null;
  if (!schritt) return { ok: false, fehler: 'Nächster Schritt mit Datum ist Pflicht — ohne ihn verliert sich der Deal.', status: 400 };
  if (schritt.datum < tagVon(ctx.jetzt)) return { ok: false, fehler: 'Der nächste Schritt liegt in der Vergangenheit — ein Deal startet mit einem Termin vor sich.', status: 400 };
  const kontaktIds = Array.from(new Set((e.kontaktIds ?? []).filter(idOk)));
  if (kontaktIds.length > DEAL_PERSONEN_MAX) return { ok: false, fehler: `Zu viele Personen für einen Deal (${kontaktIds.length}, höchstens ${DEAL_PERSONEN_MAX}) — nichts angelegt. Bitte die wichtigsten auswählen; alle weiteren hängen an der Firma.`, status: 413 };
  const personen = kontaktIds.map(id => ctx.kontakte.find(k => k.id === id)).filter((k): k is Kontakt => !!k);
  // Art. 18: an einer eingeschränkten Person wird nichts verarbeitet — auch kein neuer Deal.
  if (personen.some(k => k.eingeschraenkt)) return { ok: false, fehler: EINGESCHRAENKT_FEHLER, status: 409 };
  const firmaId = idOk(e.firmaId) && ctx.firmen.some(f => f.id === e.firmaId) ? e.firmaId! : personen.map(k => k.firmaId).find(id => id && ctx.firmen.some(f => f.id === id));
  const firma = firmaId ? ctx.firmen.find(f => f.id === firmaId) : undefined;
  if (!personen.length && !firma) return { ok: false, fehler: 'Ein Deal braucht eine Person oder eine Firma.', status: 400 };
  // Zweiter offener Deal an derselben Firma bzw. Person: nur mit Absicht.
  const offen = ctx.chancen.find(c => OFFENE_STUFEN.includes(c.stufe) && ((firma && dealZuFirma(c, firma)) || c.kontaktIds.some(id => kontaktIds.includes(id))));
  if (offen && !e.trotzdem) return { ok: false, fehler: `Es gibt schon einen offenen Deal: „${offen.titel}“. Lieber dort weiterarbeiten — oder bewusst einen zweiten anlegen.`, status: 409, offen: { id: offen.id, titel: offen.titel } };
  // Kernfragen: vom Lead (Firma, sonst Person), sonst offen.
  const zeile = ctx.leadZeilen.find(z => (firma ? z.id === firma.id : kontaktIds.includes(z.id)));
  const kriterien = zeile?.kriterien ?? leereKriterien();
  const art: ChancenArt = ARTEN.includes(e.art as ChancenArt) ? (e.art as ChancenArt) : 'retainer';
  const titel = String(e.titel ?? '').trim().slice(0, 160) || dealTitel(art, firma, personen[0]);
  const besitzer = wer(e.besitzer) && wer(e.besitzer) !== BEIDE ? wer(e.besitzer)! : zeile && zeile.besitzer !== BEIDE ? zeile.besitzer : wer(ctx.person) && wer(ctx.person) !== BEIDE ? ctx.person : verantwortlich('sales');
  const betrag = Math.max(0, Math.round(Number(e.wert?.betrag) || 0));
  const basis: WertBasis = e.wert?.basis === 'jahr' || e.wert?.basis === 'einmalig' ? e.wert.basis : 'monat';
  const laufzeit = Number(e.wert?.laufzeitMonate) > 0 ? Math.min(120, Math.round(Number(e.wert!.laufzeitMonate))) : undefined;
  const stufe: Chance['stufe'] = e.stufe && OFFENE_STUFEN.includes(e.stufe) ? e.stufe : 'qualifiziert';
  const chance: Chance = {
    id: ctx.id ?? neueDealId(), titel, kontaktIds: kontaktIds.length ? kontaktIds : [],
    ...(firma ? { firma: firma.name, firmaId: firma.id } : personen[0]?.firma ? { firma: personen[0].firma } : {}),
    art, ...(idOk(e.leistungId) ? { leistungId: e.leistungId } : {}),
    wert: { betrag, basis, ...(laufzeit && basis !== 'einmalig' ? { laufzeitMonate: laufzeit } : {}) },
    stufe, historie: [{ stufe, am: ctx.jetzt, von: ctx.person }],
    naechsterSchritt: schritt, qualifizierung: kriterien,
    // Quelle (2.5): ausdrücklich, sonst aus der Herkunft des Leads — nie fest vorbelegt.
    ...(QUELLEN.includes(e.quelle as Quelle) ? { quelle: e.quelle as Quelle } : zeile && quelleAusLead(zeile) ? { quelle: quelleAusLead(zeile)! } : {}), ...(e.quelleBezug && idOk(e.quelleBezug) ? { quelleBezug: e.quelleBezug } : {}),
    ...(tagOk(e.erwartetAm) ? { erwartetAm: tagOk(e.erwartetAm) } : {}),
    gesellschaft: GES.includes(e.gesellschaft as Gesellschaft) || istRegisterKennung(e.gesellschaft) ? (e.gesellschaft as Gesellschaft) : 'offen', besitzer,
    angelegt: ctx.jetzt, geaendert: ctx.jetzt, geaendertVon: ctx.person, letzteAktivitaet: tagVon(ctx.jetzt),
    ...(String(e.notiz ?? '').trim() ? { notiz: String(e.notiz).trim().slice(0, 3000) } : {}),
  };
  // EIN Regelwerk (2.3): SQL nur, wenn der Lead nach den Scoring-Einstellungen SQL-bereit ist (ohne Lead-Zeile: nicht).
  const sql = !!zeile && salesBereit(zeile);
  const fehlt = sql || !zeile ? [] : fehltBisSqlZeile(zeile);
  const stufenText = stufe === 'qualifiziert' ? 'SQL' : stufe;
  return {
    ok: true, chance, ...(zeile ? { leadId: zeile.id, vorStatus: zeile.status } : {}), sql, fehlt,
    text: sql ? `Deal „${chance.titel}“ steht in der Pipeline (Stufe ${stufenText}).` : `Deal „${chance.titel}“ steht in der Pipeline (Stufe ${stufenText}) — direkt angelegt: der Lead ist noch kein SQL${fehlt.length ? ` (es fehlt: ${fehlt.join(', ')})` : ''}.`,
  };
}

/**
 * Der Lead wird SQL (Ebene 1 → 2): alles Bisherige bleibt — Kernfragen, Antworten je Frage,
 * `qualifiziertAm`, Fit, Notiz (Prüfbericht 28.09., F1: vorher gingen Antworten und Datum verloren).
 * Nur der Grund für „kein Fit“/„ruht“ fällt weg — er gilt für ein SQL nicht mehr.
 */
export function leadWirdSql(alt: Lead | undefined, c: Pick<Chance, 'id' | 'qualifizierung'>, jetzt: string, person: string): Lead {
  // Ein früherer Vermerk „direkt angelegt“ (2.3) gilt nicht mehr — jetzt ist es ein echtes SQL.
  const { grund: _g, direktAm: _d, direktOffen: _o, ...bisher } = alt ?? { kriterien: c.qualifizierung };
  return { ...bisher, status: 'sql', kriterien: alt?.kriterien ?? c.qualifizierung, sqlAm: jetzt, chanceId: c.id, geaendert: jetzt, geaendertVon: person };
}

/**
 * Der Lead bekommt einen Deal, ist aber nicht SQL-bereit (08.10., Woche 1 · 2.3): Vermerk „direkt angelegt“ statt SQL. Der Status bleibt
 * ein SQL oder Kunde, wenn er es schon war; sonst „Qualifizierung“ (der Deal läuft, die Fragen sind noch offen). Ruhe-/Fit-Gründe fallen
 * weg (ein laufender Deal ist kein „ruht“), Antworten, Stufen und Notiz bleiben. `offen` = was bis zum SQL fehlte (höchstens zehn Punkte).
 */
export function leadDirekt(alt: Lead | undefined, c: Pick<Chance, 'id' | 'qualifizierung'>, offen: readonly string[], jetzt: string, person: string): Lead {
  const { grund: _g, wiedervorlage: _w, grundArt: _a, ...bisher } = alt ?? { status: 'qualifizierung' as LeadStatus, kriterien: c.qualifizierung };
  const status: LeadStatus = bisher.status === 'sql' || bisher.status === 'kunde' ? bisher.status : 'qualifizierung';
  return { ...bisher, status, kriterien: alt?.kriterien ?? c.qualifizierung, chanceId: c.id, direktAm: jetzt, ...(offen.length ? { direktOffen: offen.slice(0, 10).map(x => x.slice(0, 160)) } : {}), geaendert: jetzt, geaendertVon: person };
}
/** Der Lead nach einem neuen Deal: SQL (bereit) oder Vermerk „direkt angelegt“ — EINE Stelle für Firma und Person ohne Firma. */
const leadNachDeal = (alt: Lead | undefined, r: Extract<DealErgebnis, { ok: true }>, jetzt: string, person: string): Lead =>
  r.sql ? leadWirdSql(alt, r.chance, jetzt, person) : leadDirekt(alt, r.chance, r.fehlt, jetzt, person);

/**
 * Phase einer Person mit neuem offenem Deal (W6): nur eine GESETZTE Phase unter „Opportunity“ wird gehoben; leer bleibt leer.
 * Liefert die neue Phase oder `undefined` (nichts zu schreiben).
 */
export function kontaktPhaseNachDeal(phase: Kontakt['phase']): Kontakt['phase'] | undefined {
  const neu = phaseHeben(phase, 'opportunity');
  return neu && neu !== phase ? neu : undefined;
}

/** Deal anlegen und schreiben: Chance in den CRM-Bestand, Lead wird SQL mit Verweis. `wer` fürs Änderungsprotokoll (fehlt → laufende Anfrage). */
export async function dealAnlegen(e: DealEingabe, person: string, jetzt = new Date().toISOString(), wer?: Wer): Promise<DealErgebnis> {
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  // Die Scoring-Einstellungen hängt `ladeCrm` beim Lesen an — der rohe Bestand in der Sperre kennt sie nicht (2.3: SQL nach DENSELBEN Regeln).
  const scoring = await ladeScoring();
  // Prüfen (Dublette!) und Schreiben in EINER Schreibsperre — zwei gleichzeitige Anlagen (ZOE + Browser) ergeben sonst zwei offene Deals (Prüfbericht 27.09., Punkt 18).
  let r: DealErgebnis | null = null;
  await aendereCrm(x => {
    r = dealBauen(e, { kontakte, firmen: x.firmen, chancen: x.chancen, leadZeilen: leads(kontakte, { ...x, scoring }, tagVon(jetzt)), person, jetzt, ...(e.id && idOk(e.id) ? { id: e.id } : {}) });
    if (!r.ok) return x;
    const ok = r;
    const c = r.chance;
    // Ebene 1 → 2: der Lead der Firma ist jetzt SQL (bereit) bzw. trägt den Vermerk „direkt angelegt“ — mit Verweis auf den Deal, in derselben Mutation.
    return { ...x, chancen: [...x.chancen, c], firmen: c.firmaId ? x.firmen.map(f => (f.id === c.firmaId ? { ...f, lead: leadNachDeal(f.lead, ok, jetzt, person), geaendert: jetzt, geaendertVon: person } : f)) : x.firmen };
  }, wer);
  const ergebnis = r as DealErgebnis | null;
  if (!ergebnis) return { ok: false, fehler: 'Deal nicht angelegt.', status: 500 };
  if (!ergebnis.ok) return ergebnis;
  const c = ergebnis.chance;
  // Kartei (anderer Bestand), eine Sperre: Person ohne Firma → ihr Lead wird SQL bzw. „direkt angelegt“; gesetzte Phase unter Opportunity → Opportunity (W6).
  const ids = new Set(c.kontaktIds);
  if (ids.size) {
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => {
      if (!ids.has(k.id)) return k;
      const lead = !c.firmaId && k.id === c.kontaktIds[0] && !k.firmaId;
      const phase = kontaktPhaseNachDeal(k.phase);
      if (!lead && !phase) return k;
      return { ...k, ...(lead ? { lead: leadNachDeal(k.lead, ergebnis, jetzt, person) } : {}), ...(phase ? { phase } : {}), geaendertAm: tagVon(jetzt) };
    }) }), wer);
  }
  return ergebnis;
}
