// ─── Markttraktion · BEAN-Kundengruppe (rein, getestet, 28.09., Paket H4) ────
// Kevin (28.09., aus seinem Sales-Brain): Jeder Kontakt und jede Firma gehört zu
// genau einer von vier Gruppen — daraus folgt, wie wir sie ansprechen:
//   B  Bestandskunde  aktives Mandat (die Person selbst oder ihre Firma)
//   E  Ehemalig       früher Kunde ohne aktives Mandat: beendetes oder pausiertes
//                     Mandat, gewonnener Deal ohne aktives Mandat, Lebensphase
//                     „Ex-Kunde“ bzw. Firmen-Rolle „Ex-Kunde“
//   A  Angebotskunde  offenes Angebot: Deal in Stufe Angebot/Abschluss, Mandat im
//                     Status Angebot/Verhandlung oder ein offenes Angebot in der
//                     Umsatz-Dateiablage (nur, wo die Ablage gelesen werden darf)
//   N  Neu            alle anderen — die Leads, die wir qualifizieren
// Vorrang B > A > E > N: Wer ein aktives Mandat hat, bleibt Bestandskunde, auch
// mit einem neuen Angebot; ein offenes Angebot an einen Ehemaligen zählt als A.
//
// Abgeleitet aus den Daten, von Hand überschreibbar (`Kontakt.bean`/`Firma.bean`,
// Handfeld wie der Lifecycle — der Import rührt es nie an). Reihenfolge beim
// Lesen: von Hand an der Person → von Hand an der Firma → abgeleitet.
//
// Die Dateiablage (crm-dateien) ist optional (`opts.angebote`): die Oberfläche
// lädt sie über /api/crm/dateien; Export, Segmente auf dem Server und die Heads
// rechnen ohne sie — die Ablage geht nie an Agenten (CLAUDE.md, Dateiablage).
// Diese Datei importiert zur Laufzeit nichts aus lib/make-one/crm.ts, damit das
// Modell sie für die Säuberung laden kann.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Mandat, Chance } from './typen';
import { dealZuFirma, mandatZuFirma } from './firmen-bezug';

export type BeanId = 'B' | 'E' | 'A' | 'N';
/** Reihenfolge der Anzeige (Kevins Wort: B-E-A-N). */
export const BEAN_IDS: readonly BeanId[] = ['B', 'E', 'A', 'N'];
/** Vorrang beim Ableiten: B vor A vor E vor N. */
export const BEAN_VORRANG: readonly BeanId[] = ['B', 'A', 'E', 'N'];

export const BEAN_LABEL: Record<BeanId, string> = { B: 'Bestandskunde', E: 'Ehemalig', A: 'Angebotskunde', N: 'Neu' };
export const BEAN_HINWEIS: Record<BeanId, string> = {
  B: 'aktives Mandat',
  E: 'früher Kunde, kein aktives Mandat',
  A: 'offenes Angebot',
  N: 'Lead zum Qualifizieren',
};

export const istBean = (v: unknown): v is BeanId => typeof v === 'string' && (BEAN_IDS as readonly string[]).includes(v);

/** Einträge für den Wahl-Chip: „B · Bestandskunde“, Erklärung als Hinweis. */
export const BEAN_WAHL: { id: BeanId; label: string; hinweis: string }[] = BEAN_IDS.map(id => ({ id, label: `${id} · ${BEAN_LABEL[id]}`, hinweis: BEAN_HINWEIS[id] }));

/** Leere Verteilung in der Reihenfolge B, E, A, N. */
export const leereBeanVerteilung = (): Record<BeanId, number> => ({ B: 0, E: 0, A: 0, N: 0 });

/** Ein offenes Angebot aus der Dateiablage — nur die Bezüge, nie Inhalt oder Beträge. */
export interface AngebotHinweis { titel?: string; kontaktId?: string; firmaId?: string; dealId?: string; mandatId?: string }

/** Aus Einträgen der Dateiablage die offenen Angebote (art „angebot“, Status „offen“). */
export function offeneAngebote(eintraege: readonly { art?: string; titel?: string; angebot?: { status?: string }; kontaktId?: string; firmaId?: string; dealId?: string; mandatId?: string }[]): AngebotHinweis[] {
  return eintraege.filter(e => e.art === 'angebot' && (e.angebot?.status ?? 'offen') === 'offen').map(e => ({
    ...(e.titel ? { titel: e.titel } : {}), ...(e.kontaktId ? { kontaktId: e.kontaktId } : {}), ...(e.firmaId ? { firmaId: e.firmaId } : {}),
    ...(e.dealId ? { dealId: e.dealId } : {}), ...(e.mandatId ? { mandatId: e.mandatId } : {}),
  }));
}

export interface BeanOpts { angebote?: readonly AngebotHinweis[] }
export type BeanBestand = Pick<CrmBestand, 'mandate' | 'chancen'> & Partial<Pick<CrmBestand, 'firmen'>>;

export interface BeanErgebnis {
  bean: BeanId;
  /** Von Hand gesetzt (an der Person bzw. — für eine Person — an ihrer Firma). */
  vonHand: boolean;
  /** Klartext: warum diese Gruppe. */
  grund: string;
  /** Was die Daten sagen — auch, wenn von Hand etwas anderes steht (für „zurück auf automatisch“). */
  abgeleitet: { bean: BeanId; grund: string };
}

const stufeLabel = (s: Chance['stufe']) => (s === 'abschluss' ? 'Abschluss' : s === 'angebot' ? 'Angebot' : s);

/** Kern der Ableitung über die Mandate, Deals und Angebote, die zu einer Person bzw. Firma gehören. */
function ableiten(t: { mandate: Mandat[]; chancen: Chance[]; angebote: AngebotHinweis[]; exKunde?: string }): { bean: BeanId; grund: string } {
  const aktiv = t.mandate.find(m => m.status === 'aktiv');
  if (aktiv) return { bean: 'B', grund: `aktives Mandat „${aktiv.titel || aktiv.kunde}“` };
  const angebotDeal = t.chancen.find(c => c.stufe === 'angebot' || c.stufe === 'abschluss');
  if (angebotDeal) return { bean: 'A', grund: `Deal „${angebotDeal.titel}“ in Stufe ${stufeLabel(angebotDeal.stufe)}` };
  const angebotMandat = t.mandate.find(m => m.status === 'angebot' || m.status === 'verhandlung');
  if (angebotMandat) return { bean: 'A', grund: `Mandat „${angebotMandat.titel || angebotMandat.kunde}“ im ${angebotMandat.status === 'angebot' ? 'Angebot' : 'Verhandlung'}` };
  const ablage = t.angebote[0];
  if (ablage) return { bean: 'A', grund: `offenes Angebot${ablage.titel ? ` „${ablage.titel}“` : ''} in der Ablage` };
  const frueher = t.mandate.find(m => m.status === 'beendet' || m.status === 'pausiert');
  if (frueher) return { bean: 'E', grund: `Mandat „${frueher.titel || frueher.kunde}“ ${frueher.status === 'pausiert' ? 'pausiert' : 'beendet'} — kein aktives Mandat` };
  const gewonnen = t.chancen.find(c => c.stufe === 'gewonnen');
  if (gewonnen) return { bean: 'E', grund: `Deal „${gewonnen.titel}“ gewonnen, kein aktives Mandat` };
  if (t.exKunde) return { bean: 'E', grund: t.exKunde };
  return { bean: 'N', grund: 'kein Mandat, kein offenes Angebot — Lead zum Qualifizieren' };
}

const angebotePasst = (a: readonly AngebotHinweis[] | undefined, p: { kontaktIds: Set<string>; firmaId?: string; dealIds: Set<string>; mandatIds: Set<string> }) =>
  (a ?? []).filter(x => (x.kontaktId && p.kontaktIds.has(x.kontaktId)) || (x.firmaId && x.firmaId === p.firmaId) || (x.dealId && p.dealIds.has(x.dealId)) || (x.mandatId && p.mandatIds.has(x.mandatId)));

/**
 * Die BEAN-Gruppe einer Person: von Hand an der Person, sonst von Hand an ihrer
 * Firma, sonst abgeleitet aus ihren Mandaten/Deals UND denen ihrer Firma.
 */
export function beanVon(k: Pick<Kontakt, 'id' | 'firmaId' | 'bean' | 'lebensphase'>, crm: BeanBestand | null | undefined, opts: BeanOpts = {}): BeanErgebnis {
  const firma = k.firmaId ? (crm?.firmen ?? []).find(f => f.id === k.firmaId) : undefined;
  const mandate = (crm?.mandate ?? []).filter(m => (m.kontaktIds ?? []).includes(k.id) || (!!firma && mandatZuFirma(m, firma)));
  const chancen = (crm?.chancen ?? []).filter(c => (c.kontaktIds ?? []).includes(k.id) || (!!firma && dealZuFirma(c, firma)));
  const angebote = angebotePasst(opts.angebote, { kontaktIds: new Set([k.id]), firmaId: firma?.id ?? k.firmaId, dealIds: new Set(chancen.map(c => c.id)), mandatIds: new Set(mandate.map(m => m.id)) });
  const exKunde = k.lebensphase === 'ex_kunde' ? 'Lebensphase Ex-Kunde' : firma?.rolle === 'ex_kunde' ? 'Firma als Ex-Kunde geführt' : undefined;
  const abgeleitet = ableiten({ mandate, chancen, angebote, exKunde });
  if (k.bean) return { bean: k.bean, vonHand: true, grund: `von Hand: ${BEAN_LABEL[k.bean]}`, abgeleitet };
  if (firma?.bean) return { bean: firma.bean, vonHand: true, grund: `von Hand an der Firma: ${BEAN_LABEL[firma.bean]}`, abgeleitet };
  return { bean: abgeleitet.bean, vonHand: false, grund: abgeleitet.grund, abgeleitet };
}

/** Die BEAN-Gruppe einer Firma: von Hand, sonst aus den Mandaten/Deals der Firma und ihrer Personen. */
export function beanFirma(f: Pick<Firma, 'id' | 'name' | 'rolle' | 'bean'>, crm: BeanBestand | null | undefined, personen: readonly Pick<Kontakt, 'id' | 'firmaId' | 'lebensphase'>[] = [], opts: BeanOpts = {}): BeanErgebnis {
  const ids = new Set(personen.filter(p => p.firmaId === f.id).map(p => p.id));
  const mandate = (crm?.mandate ?? []).filter(m => mandatZuFirma(m, f) || (m.kontaktIds ?? []).some(id => ids.has(id)));
  const chancen = (crm?.chancen ?? []).filter(c => dealZuFirma(c, f) || (c.kontaktIds ?? []).some(id => ids.has(id)));
  const angebote = angebotePasst(opts.angebote, { kontaktIds: ids, firmaId: f.id, dealIds: new Set(chancen.map(c => c.id)), mandatIds: new Set(mandate.map(m => m.id)) });
  const exKunde = f.rolle === 'ex_kunde' ? 'Firma als Ex-Kunde geführt' : personen.some(p => p.firmaId === f.id && p.lebensphase === 'ex_kunde') ? 'eine Person ist als Ex-Kunde geführt' : undefined;
  const abgeleitet = ableiten({ mandate, chancen, angebote, exKunde });
  if (f.bean) return { bean: f.bean, vonHand: true, grund: `von Hand: ${BEAN_LABEL[f.bean]}`, abgeleitet };
  return { bean: abgeleitet.bean, vonHand: false, grund: abgeleitet.grund, abgeleitet };
}

/** Die BEAN-Gruppe eines Leads (Firmen › Leads, Qualifizierungsrunde): bei einer Firma die der Firma, sonst die der Person. */
export function beanFuerLead(z: { id: string; art: 'firma' | 'person' }, crm: BeanBestand | null | undefined, kontakte: readonly Pick<Kontakt, 'id' | 'firmaId' | 'bean' | 'lebensphase'>[], opts: BeanOpts = {}): BeanErgebnis | null {
  if (z.art === 'firma') { const f = (crm?.firmen ?? []).find(x => x.id === z.id); return f ? beanFirma(f, crm, kontakte, opts) : null; }
  const k = kontakte.find(x => x.id === z.id);
  return k ? beanVon(k, crm, opts) : null;
}

/** Verteilung über viele Personen; `vonHand` zählt, wie viele von Hand stehen. */
export function beanVerteilung(kontakte: readonly Pick<Kontakt, 'id' | 'firmaId' | 'bean' | 'lebensphase'>[], crm: BeanBestand | null | undefined, opts: BeanOpts = {}): { je: Record<BeanId, number>; vonHand: number } {
  const je = leereBeanVerteilung();
  let vonHand = 0;
  for (const k of kontakte) { const b = beanVon(k, crm, opts); je[b.bean]++; if (b.vonHand) vonHand++; }
  return { je, vonHand };
}
