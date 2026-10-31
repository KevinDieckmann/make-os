// ─── CRM — Segmente: gespeicherte Filter über die Kartei (rein, getestet) ──
// Ein Segment beantwortet „wen meinen wir?“ — für Kampagnen, Einladungen,
// Newsletter. Gesperrte Personen sind NIE Mitglied (Art. 21). Mit einem
// Kanal-Kriterium zählen nur die, die über diesen Kanal zulässig erreichbar
// sind (Ampel grün); ohne Kanal zeigt die Auswertung die Aufteilung.

import { leadScore, scoringKontext } from './score';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, SegmentKriterien } from './typen';
import { kanalStatus, firmaKanalStatus } from './recht';
import { erreichbarkeitVon } from './betrieb';
import { OFFENE_STUFEN } from './pipeline';
import { lifecycleVon, type LifecycleBestand } from './vorschlaege';
import { beanVon, beanFirma } from './bean';
import { firmenDerPerson } from './stationen';
import { typenVon, kategorienVon, labelsVon, enthaeltEinenVon } from './mehrfach';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export interface SegmentKontext {
  firmen: Map<string, Firma>; mitChance: Set<string>; mitMandat: Set<string>; heute: string;
  /** Mandate, Deals, Firmen, Teilnahmen — für die BEAN-Ableitung (28.09.). */
  bestand?: LifecycleBestand;
  /** Kampagnen je Ziel (01.11., Welle A): `c:<kontakt>` bzw. `f:<firma>` → Kennungen der Kampagnen. */
  kampagnen?: Map<string, Set<string>>;
  /** Firmen mit offener Chance bzw. aktivem Mandat (01.11.) — für die Firmen-Ampel. */
  firmaMitChance?: Set<string>; firmaMitMandat?: Set<string>;
}

export function kontextAus(crm: CrmBestand, heute: string): SegmentKontext {
  return {
    firmen: new Map(crm.firmen.map(f => [f.id, f])),
    mitChance: new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds)),
    mitMandat: new Set(crm.mandate.filter(m => m.status === 'aktiv').flatMap(m => m.kontaktIds)),
    heute,
    bestand: { mandate: crm.mandate, chancen: crm.chancen, firmen: crm.firmen, teilnahmen: crm.teilnahmen, events: crm.events, ...(crm.scoring ? { scoring: crm.scoring } : {}) },
    kampagnen: kampagnenJeZiel(crm),
    firmaMitChance: new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && c.firmaId).map(c => c.firmaId!)),
    firmaMitMandat: new Set(crm.mandate.filter(m => m.status === 'aktiv' && m.firmaId).map(m => m.firmaId!)),
  };
}

/** Kampagnen je Ziel: Personen (`kontaktIds`) und Betriebe (`firmaIds`) — Papierkorb zählt nicht. */
export function kampagnenJeZiel(crm: Pick<CrmBestand, 'kampagnen'>): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const dazu = (k: string, id: string) => { const s = m.get(k) ?? new Set<string>(); s.add(id); m.set(k, s); };
  for (const k of crm.kampagnen ?? []) {
    if (k.geloeschtAm) continue;
    for (const c of k.kontaktIds) dazu(`c:${c}`, k.id);
    for (const f of k.firmaIds ?? []) dazu(`f:${f}`, k.id);
  }
  return m;
}

// ── Betriebs-Kriterien (01.11., Welle A): wirken auf Firmen direkt, auf Personen über ihre Firma(en) ──
const BETRIEB_KRITERIEN = ['bezirk', 'plz', 'websiteScore', 'hatWebsite', 'erreichbarkeit', 'kampagne', 'quelle'] as const;
export const hatBetriebKriterien = (kr: SegmentKriterien) => BETRIEB_KRITERIEN.some(f => kr[f] !== undefined && !(Array.isArray(kr[f]) && !(kr[f] as unknown[]).length));
const gleich = (a: string | undefined, l: string[]) => !!a && l.some(x => x.trim().toLocaleLowerCase('de-DE') === a.trim().toLocaleLowerCase('de-DE'));
/** Firmenseitige Prüfung der Betriebs-Kriterien (`kampagne` und `erreichbarkeit` prüft der Aufrufer zusätzlich an der Person). */
function betriebPasst(f: Firma | undefined, kr: SegmentKriterien): boolean {
  if (kr.bezirk?.length && !gleich(f?.bezirk, kr.bezirk)) return false;
  if (kr.plz?.length && !kr.plz.some(p => (f?.adresse?.plz ?? '').startsWith(p))) return false;
  if (kr.websiteScore) {
    const p = f?.bewertung?.punkte;
    if (p === undefined || (kr.websiteScore.von !== undefined && p < kr.websiteScore.von) || (kr.websiteScore.bis !== undefined && p > kr.websiteScore.bis)) return false;
  }
  if (kr.hatWebsite !== undefined && !!(f?.webseite ?? '').trim() !== kr.hatWebsite) return false;
  if (kr.quelle?.length && !kr.quelle.includes(f?.anreicherung?.quelle as never)) return false;
  return true;
}

const OHNE_BESTAND: LifecycleBestand = { mandate: [], chancen: [] };
const enthaelt = (feld: string | undefined, such?: string) => !such || (feld ?? '').toLowerCase().includes(such.toLowerCase());
const tage = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5);

export function imSegment(k: Kontakt, kr: SegmentKriterien, ctx: SegmentKontext): boolean {
  // Werbesperre (Art. 21) und Einschränkung (Art. 18, U2): nie in einem Segment.
  if (ausgenommen(k)) return false;
  const f = k.firmaId ? ctx.firmen.get(k.firmaId) : undefined;
  // Firmen-Kriterien (Rolle, Branche, Stadt) treffen über JEDE laufende Station (28.09.), die Hauptstation zuerst.
  const firmen = firmenDerPerson(k).map(id => ctx.firmen.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const eineFirma = (p: (x: typeof f) => boolean) => (firmen.length ? firmen.some(x => p(x)) : p(undefined));
  if (kr.lebensphase?.length && !kr.lebensphase.includes(k.lebensphase ?? 'kontakt')) return false;
  if (kr.kreis?.length && !kr.kreis.includes(k.kreis ?? '')) return false;
  if (kr.prio?.length && !kr.prio.includes(k.prio)) return false;
  if (kr.herkunft?.length && !kr.herkunft.includes(k.herkunft ?? '')) return false;
  if (kr.firmaRolle?.length && !eineFirma(x => kr.firmaRolle!.includes(x?.rolle ?? 'offen'))) return false;
  if (!eineFirma(x => enthaelt(x?.branche ?? k.firmaBranche, kr.branche))) return false;
  if (!eineFirma(x => enthaelt(x?.stadt ?? k.firmaStadt, kr.stadt))) return false;
  if (kr.stichwort && ![k.vorname, k.nachname, k.firma, k.position, k.aufhaenger, k.notiz, ...kategorienVon(k), ...labelsVon(k)].some(x => enthaelt(x, kr.stichwort))) return false;
  if (kr.typ?.length && !enthaeltEinenVon(typenVon(k), kr.typ)) return false;
  if (kr.kategorie?.length && !enthaeltEinenVon(kategorienVon(k), kr.kategorie)) return false;
  if (kr.label?.length && !enthaeltEinenVon(labelsVon(k), kr.label)) return false;
  if (kr.mitChance !== undefined && ctx.mitChance.has(k.id) !== kr.mitChance) return false;
  if (kr.ohneKontaktSeitTagen && k.letzterKontakt && tage(k.letzterKontakt, ctx.heute) < kr.ohneKontaktSeitTagen) return false;
  if (kr.temperatur?.length && !kr.temperatur.includes(leadScore([k], f?.lead ?? k.lead, ctx.heute, undefined, scoringKontext(ctx.bestand)).temperatur)) return false;
  // Lifecycle (28.09., H4): die gesetzte Phase, sonst „Lead“ — ein Vorschlag zählt nicht.
  if (kr.lifecycle?.length && !kr.lifecycle.includes(lifecycleVon(k, null, ctx.heute).phase)) return false;
  // BEAN (28.09., H4): von Hand, sonst abgeleitet aus Mandaten und Deals. Segmente rechnen überall gleich
  // (Oberfläche, Heads, Kampagnen) — deshalb ohne die Dateiablage, die nur die Oberfläche lesen darf.
  if (kr.bean?.length && !kr.bean.includes(beanVon(k, ctx.bestand ?? OHNE_BESTAND).bean)) return false;
  // Betriebe (01.11.): Bezirk, PLZ, Score, Website, Quelle über JEDE laufende Firma der Person; Erreichbarkeit an der Person (sonst ihrer Firma),
  // Kampagne: die Person selbst oder ihre Firma ist Ziel. Eine Firma mit Werbesperre sperrt ihre Personen in Segmenten mit (Ampel rot).
  if (firmen.some(x => x.werbesperre)) return false;
  if (hatBetriebKriterien(kr)) {
    if (!eineFirma(x => betriebPasst(x, kr))) return false;
    if (kr.erreichbarkeit?.length) {
      const wege = new Set([...erreichbarkeitVon(k), ...firmen.flatMap(x => erreichbarkeitVon(x))]);
      if (!kr.erreichbarkeit.some(e => wege.has(e))) return false;
    }
    if (kr.kampagne?.length) {
      const in_ = new Set([...(ctx.kampagnen?.get(`c:${k.id}`) ?? []), ...firmen.flatMap(x => [...(ctx.kampagnen?.get(`f:${x.id}`) ?? [])])]);
      if (!kr.kampagne.some(x => in_.has(x))) return false;
    }
  }
  if (kr.kanal) {
    const st = kanalStatus(k, kr.kanal, { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) });
    if (st.farbe !== 'gruen') return false;
  }
  return true;
}

/** Personen-Kriterien, die eine Firma ohne Person nie erfüllt (sie kennt keinen Kreis, keine Lebensphase …). */
const NUR_PERSON = ['lebensphase', 'kreis', 'prio', 'typ', 'kategorie', 'mitChance', 'ohneKontaktSeitTagen', 'temperatur', 'lifecycle'] as const;

/**
 * Ein Betrieb OHNE Person im Segment (01.11., Welle A): Werbesperre, Papierkorb, Archiv nie. Es zählen Firmen, an denen KEINE Person hängt
 * (auch keine gesperrte — sonst käme ein Betrieb, dessen Inhaber „Nein“ sagte, über die Firma wieder hinein). Firmen mit Personen vertreten ihre Personen.
 */
export function imSegmentFirma(f: Firma, kr: SegmentKriterien, ctx: SegmentKontext): boolean {
  if (f.werbesperre || f.geloeschtAm || f.archiviertAm) return false;
  if (NUR_PERSON.some(x => kr[x] !== undefined && !(Array.isArray(kr[x]) && !(kr[x] as unknown[]).length))) return false;
  if (kr.herkunft?.length && !kr.herkunft.includes(f.herkunft ?? '')) return false;
  if (kr.firmaRolle?.length && !kr.firmaRolle.includes(f.rolle ?? 'offen')) return false;
  if (!enthaelt(f.branche, kr.branche) || !enthaelt(f.stadt ?? f.adresse?.ort, kr.stadt)) return false;
  if (kr.stichwort && ![f.name, f.notiz, f.bezirk, ...(f.labels ?? [])].some(x => enthaelt(x, kr.stichwort))) return false;
  if (kr.label?.length && !enthaeltEinenVon(f.labels ?? [], kr.label)) return false;
  if (kr.bean?.length && !kr.bean.includes(beanFirma(f, ctx.bestand ?? OHNE_BESTAND).bean)) return false;
  if (!betriebPasst(f, kr)) return false;
  if (kr.erreichbarkeit?.length && !kr.erreichbarkeit.some(e => erreichbarkeitVon(f).includes(e))) return false;
  if (kr.kampagne?.length && !kr.kampagne.some(x => ctx.kampagnen?.get(`f:${f.id}`)?.has(x))) return false;
  if (kr.kanal) {
    if (kr.kanal === 'linkedin') return false;
    if (firmaKanalStatus(f, kr.kanal, { hatMandat: !!ctx.firmaMitMandat?.has(f.id), hatChance: !!ctx.firmaMitChance?.has(f.id) }).farbe !== 'gruen') return false;
  }
  return true;
}

/** Die Firmen ohne Person, die im Segment sind. */
export function segmentFirmen(firmen: readonly Firma[], kontakte: readonly Kontakt[], kr: SegmentKriterien, ctx: SegmentKontext): Firma[] {
  const mitPerson = new Set(kontakte.flatMap(k => firmenDerPerson(k)));
  return firmen.filter(f => !mitPerson.has(f.id) && imSegmentFirma(f, kr, ctx));
}

/** Ein Ziel der Kundengewinnung — eine Person oder ein Betrieb ohne Person (dieselbe Form wie im Kampagnen-Motor). */
export interface SegmentZiel { art: 'kontakt' | 'firma'; id: string }
export interface SegmentZiele { ziele: SegmentZiel[]; personen: Kontakt[]; firmen: Firma[]; anzahl: number }
/** Alle Ziele eines Segments: Personen zuerst, dann Betriebe ohne Person. */
export function segmentZiele(kontakte: Kontakt[], firmen: readonly Firma[], kr: SegmentKriterien, ctx: SegmentKontext): SegmentZiele {
  const personen = kontakte.filter(k => imSegment(k, kr, ctx));
  const betriebe = segmentFirmen(firmen, kontakte, kr, ctx);
  const ziele: SegmentZiel[] = [...personen.map(k => ({ art: 'kontakt' as const, id: k.id })), ...betriebe.map(f => ({ art: 'firma' as const, id: f.id }))];
  return { ziele, personen, firmen: betriebe, anzahl: ziele.length };
}

export interface SegmentAuswertung { mitglieder: Kontakt[]; anzahl: number; kanaele: { mail: number; telefon: number; linkedin: number; newsletter: number; einladung: number; nurPersoenlich: number } }

export function segmentAuswerten(kontakte: Kontakt[], kr: SegmentKriterien, ctx: SegmentKontext): SegmentAuswertung {
  const mitglieder = kontakte.filter(k => imSegment(k, kr, ctx));
  const gruen = (k: Kontakt, kanal: 'mail' | 'telefon' | 'linkedin' | 'newsletter' | 'einladung') => kanalStatus(k, kanal, { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) }).farbe === 'gruen';
  const z = { mail: 0, telefon: 0, linkedin: 0, newsletter: 0, einladung: 0, nurPersoenlich: 0 };
  for (const k of mitglieder) {
    const g = { mail: gruen(k, 'mail'), telefon: gruen(k, 'telefon'), linkedin: gruen(k, 'linkedin'), newsletter: gruen(k, 'newsletter'), einladung: gruen(k, 'einladung') };
    for (const x of Object.keys(g) as (keyof typeof g)[]) if (g[x]) z[x]++;
    if (!Object.values(g).some(Boolean)) z.nurPersoenlich++;
  }
  return { mitglieder, anzahl: mitglieder.length, kanaele: z };
}
