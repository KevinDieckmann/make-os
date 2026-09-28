// ─── Deal anlegen — EIN Weg (Server, 27.09.) ────────────────────────────────
// Bis 26.09. entstanden Deals auf sechs Wegen (Leads › SQL, „+ Gespräch“, Pipeline
// „+ Deal“, „Im Gespräch“, Karteikarte, ZOE) — vier davon an der Lead-Ebene
// vorbei. Jetzt läuft alles hier durch: Firma per Kennung, Personen, Kernfragen
// aus dem Lead, Pflicht zum nächsten Schritt, kein zweiter offener Deal an
// derselben Firma ohne Absicht, und der Lead wird SQL mit Verweis auf den Deal.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import { aendereCrm } from './speicher';
import { leads, leereKriterien, type LeadZeile } from './leads';
import { OFFENE_STUFEN } from './pipeline';
import { wer, BEIDE, verantwortlich } from './team';
import { dealZuFirma } from './firmen-bezug';
import type { Chance, ChancenArt, Gesellschaft, Lead, Quelle, WertBasis } from './typen';

export interface DealEingabe {
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
const QUELLEN: Quelle[] = ['empfehlung', 'event', 'content', 'outreach', 'bestand', 'inbound', 'kampagne'];
const GES: Gesellschaft[] = ['kdv', 'kdc', 'ug', 'offen'];
const tagOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const idOk = (v: unknown) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(String(v ?? ''));
export const neueDealId = () => `ch-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type DealErgebnis = { ok: true; chance: Chance; leadId?: string; text: string } | { ok: false; fehler: string; status: number; offen?: { id: string; titel: string } };

/** Reine Prüfung und Bau des Deals — ohne Schreiben (getestet). */
export function dealBauen(e: DealEingabe, ctx: { kontakte: Kontakt[]; firmen: { id: string; name: string; lead?: Lead }[]; chancen: Chance[]; leadZeilen: LeadZeile[]; person: string; jetzt: string; id?: string }): DealErgebnis {
  const schritt = e.schritt && String(e.schritt.text ?? '').trim() && tagOk(e.schritt.datum) ? { text: String(e.schritt.text).trim().slice(0, 300), datum: tagOk(e.schritt.datum)! } : null;
  if (!schritt) return { ok: false, fehler: 'Nächster Schritt mit Datum ist Pflicht — ohne ihn verliert sich der Deal.', status: 400 };
  if (schritt.datum < ctx.jetzt.slice(0, 10) && schritt.datum < localDay(new Date(ctx.jetzt))) return { ok: false, fehler: 'Der nächste Schritt liegt in der Vergangenheit — ein Deal startet mit einem Termin vor sich.', status: 400 };
  const kontaktIds = Array.from(new Set((e.kontaktIds ?? []).filter(idOk))).slice(0, 20);
  const personen = kontaktIds.map(id => ctx.kontakte.find(k => k.id === id)).filter((k): k is Kontakt => !!k);
  const firmaId = idOk(e.firmaId) && ctx.firmen.some(f => f.id === e.firmaId) ? e.firmaId! : personen.map(k => k.firmaId).find(id => id && ctx.firmen.some(f => f.id === id));
  const firma = firmaId ? ctx.firmen.find(f => f.id === firmaId) : undefined;
  if (!personen.length && !firma) return { ok: false, fehler: 'Ein Deal braucht eine Person oder eine Firma.', status: 400 };
  // Zweiter offener Deal an derselben Firma bzw. Person: nur mit Absicht.
  const offen = ctx.chancen.find(c => OFFENE_STUFEN.includes(c.stufe) && ((firma && dealZuFirma(c, firma)) || c.kontaktIds.some(id => kontaktIds.includes(id))));
  if (offen && !e.trotzdem) return { ok: false, fehler: `Es gibt schon einen offenen Deal: „${offen.titel}“. Lieber dort weiterarbeiten — oder bewusst einen zweiten anlegen.`, status: 409, offen: { id: offen.id, titel: offen.titel } };
  // Kernfragen: vom Lead (Firma, sonst Person), sonst offen.
  const zeile = ctx.leadZeilen.find(z => (firma ? z.id === firma.id : kontaktIds.includes(z.id)));
  const kriterien = zeile?.kriterien ?? leereKriterien();
  const titel = String(e.titel ?? '').trim().slice(0, 160) || (firma ? `${firma.name} · ${e.art === 'projekt' ? 'Projekt' : e.art === 'workshop' ? 'Workshop' : 'Retainer'}` : personen[0] ? `${anzeigename(personen[0])} · Deal` : 'Neuer Deal');
  const besitzer = wer(e.besitzer) && wer(e.besitzer) !== BEIDE ? wer(e.besitzer)! : zeile && zeile.besitzer !== BEIDE ? zeile.besitzer : wer(ctx.person) && wer(ctx.person) !== BEIDE ? ctx.person : verantwortlich('sales');
  const betrag = Math.max(0, Math.round(Number(e.wert?.betrag) || 0));
  const basis: WertBasis = e.wert?.basis === 'jahr' || e.wert?.basis === 'einmalig' ? e.wert.basis : 'monat';
  const laufzeit = Number(e.wert?.laufzeitMonate) > 0 ? Math.min(120, Math.round(Number(e.wert!.laufzeitMonate))) : undefined;
  const stufe: Chance['stufe'] = e.stufe && OFFENE_STUFEN.includes(e.stufe) ? e.stufe : 'qualifiziert';
  const chance: Chance = {
    id: ctx.id ?? neueDealId(), titel, kontaktIds: kontaktIds.length ? kontaktIds : [],
    ...(firma ? { firma: firma.name, firmaId: firma.id } : personen[0]?.firma ? { firma: personen[0].firma } : {}),
    art: ARTEN.includes(e.art as ChancenArt) ? (e.art as ChancenArt) : 'retainer', ...(idOk(e.leistungId) ? { leistungId: e.leistungId } : {}),
    wert: { betrag, basis, ...(laufzeit && basis !== 'einmalig' ? { laufzeitMonate: laufzeit } : {}) },
    stufe, historie: [{ stufe, am: ctx.jetzt, von: ctx.person }],
    naechsterSchritt: schritt, qualifizierung: kriterien,
    ...(QUELLEN.includes(e.quelle as Quelle) ? { quelle: e.quelle as Quelle } : {}), ...(e.quelleBezug && idOk(e.quelleBezug) ? { quelleBezug: e.quelleBezug } : {}),
    ...(tagOk(e.erwartetAm) ? { erwartetAm: tagOk(e.erwartetAm) } : {}),
    gesellschaft: GES.includes(e.gesellschaft as Gesellschaft) ? (e.gesellschaft as Gesellschaft) : 'offen', besitzer,
    angelegt: ctx.jetzt, geaendert: ctx.jetzt, geaendertVon: ctx.person, letzteAktivitaet: ctx.jetzt.slice(0, 10),
    ...(String(e.notiz ?? '').trim() ? { notiz: String(e.notiz).trim().slice(0, 3000) } : {}),
  };
  return { ok: true, chance, ...(zeile ? { leadId: zeile.id } : {}), text: `Deal „${chance.titel}“ steht in der Pipeline (Stufe ${stufe === 'qualifiziert' ? 'SQL' : stufe}).` };
}

/**
 * Der Lead wird SQL (Ebene 1 → 2): alles Bisherige bleibt — Kernfragen, Antworten je Frage,
 * `qualifiziertAm`, Fit, Notiz (Prüfbericht 28.09., F1: vorher gingen Antworten und Datum verloren).
 * Nur der Grund für „kein Fit“/„ruht“ fällt weg — er gilt für ein SQL nicht mehr.
 */
export function leadWirdSql(alt: Lead | undefined, c: Pick<Chance, 'id' | 'qualifizierung'>, jetzt: string, person: string): Lead {
  const { grund: _g, ...bisher } = alt ?? { kriterien: c.qualifizierung };
  return { ...bisher, status: 'sql', kriterien: alt?.kriterien ?? c.qualifizierung, sqlAm: jetzt, chanceId: c.id, geaendert: jetzt, geaendertVon: person };
}

/** Deal anlegen und schreiben: Chance in den CRM-Bestand, Lead wird SQL mit Verweis. */
export async function dealAnlegen(e: DealEingabe, person: string, jetzt = new Date().toISOString()): Promise<DealErgebnis> {
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  // Prüfen (Dublette!) und Schreiben in EINER Schreibsperre — zwei gleichzeitige Anlagen (ZOE + Browser) ergeben sonst zwei offene Deals (Prüfbericht 27.09., Punkt 18).
  let r: DealErgebnis | null = null;
  await aendereCrm(x => {
    r = dealBauen(e, { kontakte, firmen: x.firmen, chancen: x.chancen, leadZeilen: leads(kontakte, x), person, jetzt });
    if (!r.ok) return x;
    const c = r.chance;
    // Ebene 1 → 2: der Lead der Firma ist jetzt SQL — mit Verweis auf den Deal, in derselben Mutation.
    return { ...x, chancen: [...x.chancen, c], firmen: c.firmaId ? x.firmen.map(f => (f.id === c.firmaId ? { ...f, lead: leadWirdSql(f.lead, c, jetzt, person), geaendert: jetzt, geaendertVon: person } : f)) : x.firmen };
  });
  const ergebnis = r as DealErgebnis | null;
  if (!ergebnis) return { ok: false, fehler: 'Deal nicht angelegt.', status: 500 };
  if (!ergebnis.ok) return ergebnis;
  const c = ergebnis.chance;
  // Person ohne Firma: der Lead hängt an ihr (anderer Bestand).
  if (!c.firmaId && c.kontaktIds[0]) {
    await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(k => (k.id === c.kontaktIds[0] && !k.firmaId ? { ...k, lead: leadWirdSql(k.lead, c, jetzt, person), geaendertAm: localDay(new Date(jetzt)) } : k)) }));
  }
  return ergebnis;
}
