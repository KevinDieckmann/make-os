// ─── Prozesse · Kundengewinnung — die CRM-Abfragen der Vorlagen (N1, 22.10. spät; research/prozesse/VORLAGEN_KUNDENGEWINNUNG.md › 5.2) ─────────────────────
// Eine CRM-Abfrage liefert eine LISTE VON FÄLLEN — nur Kennungen, in fester Reihenfolge (das Wichtigste zuerst). Gelesen wird NUR über die vorhandenen Leser
// (lib/crm/leads.ts `leads`, lib/crm/pipeline.ts `gesundheit`, lib/crm/followup.ts `dealWiedervorlagen`, lib/crm/kunden.ts `mandatFristen`, lib/crm/netzwerk.ts
// `netzRunde`, lib/crm/heute.ts `werIstDran`, lib/crm/erfassen.ts `nachbereitung`) — keine eigene Rechnung. Die Kartei kommt schon gefiltert herein
// (`kontakteFuerVerarbeitung`: eingeschränkte Personen nach Art. 18 fehlen ganz); Personen mit Werbesperre nimmt die Abfrage ebenfalls heraus (`ausgenommen`),
// Deals und Mandate einer Privat-Gesellschaft nie (nur Business). Die Obergrenze (`hoechstens`) setzt der Server — darüber wird nie still gekürzt (Rest sichtbar).
// Rein (keine Bestände, kein Netz) — der Server (lib/prozesse/abfrage-server.ts) gibt die Daten hinein.

import type { CrmAbfrage, FallArt } from '../definition';
import type { LaufFall } from '../lauf-typen';
import type { CrmBestand, Chance } from '@/lib/crm/typen';
import type { Kontakt } from '@/lib/make-one/crm';
import type { LeadZeile } from '@/lib/crm/leads';
import { gesundheit, OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { dealWiedervorlagen } from '@/lib/crm/followup';
import { mandatFristen } from '@/lib/crm/kunden';
import { netzRunde } from '@/lib/crm/netzwerk';
import { werIstDran } from '@/lib/crm/heute';
import { nachbereitung } from '@/lib/crm/erfassen';
import { ausgenommen } from '@/lib/crm/einschraenkung';
import { RUHEND_TAGE } from '@/lib/crm/planung';
import { tagPlus } from '@/lib/kalender/zeit';
import { WEG } from '@/lib/wege';

/** Was die Abfrage braucht — alles über die vorhandenen Lesewege geladen (Server). */
export interface AbfrageDaten {
  crm: CrmBestand;
  /** Die verarbeitbare Kartei (Art. 18 schon heraus). */
  kontakte: readonly Kontakt[];
  /** `leads(kontakte, crm, heute)` — dieselbe Zeile wie überall. */
  leads: readonly LeadZeile[];
  /** Berliner Tag. */
  heute: string;
  /** Als wer der Lauf läuft (Power Hour, Vernetzen-Runde: die Karten DIESER Person). */
  person: string | null;
  /** Der Fall des Laufs (Event: seine Erfassungen; Kampagne: ihre Personen). */
  fall: LaufFall;
  /** Gehört eine Gesellschaft zum Business? (lib/einheiten.ts `bereichVonGesellschaft`) — Deals/Mandate von Privat-Einheiten fehlen. */
  business: (gesellschaft: string | undefined) => boolean;
}

const tageSeit = (tag: string | undefined, heute: string): number | null => (tag ? Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${tag.slice(0, 10)}T12:00:00Z`)) / 86_400_000) : null);
const ohneDoppelte = (l: readonly LaufFall[]): LaufFall[] => {
  const seen = new Set<string>();
  return l.filter(f => { const s = `${f.art}:${f.id ?? ''}`; if (seen.has(s)) return false; seen.add(s); return true; });
};

/** Die Filter einer Abfrage über Leads (Status, Temperatur, BEAN, Lifecycle) — leer = alle. */
function leadPasst(q: CrmAbfrage, z: LeadZeile, k: (id: string | undefined) => Kontakt | undefined): boolean {
  if (q.status?.length && !q.status.includes(z.status)) return false;
  if (q.temperatur?.length && !(q.temperatur as readonly string[]).includes(z.score.temperatur)) return false;
  if (q.bean?.length && !(q.bean as readonly string[]).includes(z.bean)) return false;
  if (q.lifecycle?.length) {
    const p = k(z.hauptKontaktId ?? (z.art === 'person' ? z.id : z.personen[0]?.id))?.phase ?? 'lead';
    if (!q.lifecycle.includes(p)) return false;
  }
  return true;
}
/** Ein Lead als Fall: Firma-Leads unter Fall „firma“-fähiger Kennung, Personen ohne Firma als Lead der Person. */
const leadFall = (z: LeadZeile): LaufFall => ({ art: 'lead', id: z.id });
/** Ein Lead ohne Person mit Werbesperre bzw. Einschränkung (die Firma selbst kennt keine Sperre — sie fällt nur, wenn ALLE ihre Personen ausgenommen sind). */
function leadVerarbeitbar(z: LeadZeile, k: (id: string | undefined) => Kontakt | undefined): boolean {
  const personen = z.personen.map(p => k(p.id)).filter((x): x is Kontakt => !!x);
  if (z.art === 'person') return !!personen[0] && !ausgenommen(personen[0]);
  return !personen.length || personen.some(p => !ausgenommen(p));
}
const dealFall = (c: Pick<Chance, 'id'>): LaufFall => ({ art: 'deal', id: c.id });
/**
 * Die Filter einer Abfrage über Deals (Feinschliff 24.10., optional — ohne sie alle wie bisher): Stufe, nur Deals der Person des Laufs (zuständig bzw. „beide“; ohne
 * Person keiner), Wert ab (Betrag des Deals in €).
 */
function dealPasst(q: CrmAbfrage, c: Chance, person: string | null): boolean {
  if (q.stufe?.length && !q.stufe.includes(c.stufe)) return false;
  if (q.nurMeine && (!person || (c.besitzer !== person && c.besitzer !== 'beide'))) return false;
  if (typeof q.wertAb === 'number' && q.wertAb > 0 && !((c.wert?.betrag ?? 0) >= q.wertAb)) return false;
  return true;
}
const reihenfolge = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Die Fälle einer Abfrage (rein) — vollständig, ohne Doppelte, in fester Reihenfolge. Kürzen auf `hoechstens` macht der Server (mit sichtbarem Rest).
 * Unbekannte Art bzw. fehlender Bezug (z. B. Erfassungen ohne Event-Fall) → leere Liste.
 */
export function abfrageFaelle(q: CrmAbfrage, d: AbfrageDaten): LaufFall[] {
  const nachId = new Map(d.kontakte.map(k => [k.id, k]));
  const k = (id: string | undefined) => (id ? nachId.get(id) : undefined);
  const leads = d.leads.filter(z => leadVerarbeitbar(z, k) && leadPasst(q, z, k));
  // Offene Deals des Business — ohne Deals, an denen eine eingeschränkte Person (fehlt in der Kartei) bzw. eine Person mit Werbesperre hängt.
  const offeneDeals = d.crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && d.business(c.gesellschaft) && !c.kontaktIds.some(id => (id.startsWith('c-') && !nachId.has(id)) || ausgenommen(k(id))) && dealPasst(q, c, d.person));
  switch (q.art) {
    case 'leads':
      return ohneDoppelte([...leads].sort((a, b) => b.score.punkte - a.score.punkte || reihenfolge(a.id, b.id)).map(leadFall));
    case 'neue-leads': {
      const ab = tagPlus(d.heute, -Math.max(0, q.tage ?? 7));
      const status = q.status?.length ? q.status : ['neu'];
      const seit = (z: LeadZeile) => z.personen.map(p => k(p.id)?.importiertAm?.slice(0, 10) ?? '').filter(Boolean).sort()[0] ?? '';
      return ohneDoppelte(leads.filter(z => status.includes(z.status) && seit(z) >= ab).sort((a, b) => reihenfolge(seit(b), seit(a)) || reihenfolge(a.id, b.id)).map(leadFall));
    }
    case 'firmen-ruhend': {
      // Ruhend = ohne Kontakt seit n Tagen (Vorgabe RUHEND_TAGE); nie Kunde/kein Fit; nie mit offenem Deal (dafür gibt es „Deal ohne nächsten Schritt“).
      const tage = Math.max(1, q.tage ?? RUHEND_TAGE);
      const z = leads.filter(x => x.art === 'firma' && x.status !== 'kunde' && x.status !== 'kein_fit' && !x.deal?.offen && (tageSeit(x.letzterKontakt, d.heute) ?? Infinity) >= tage);
      // Wer am längsten ruht, zuerst (nie kontaktiert = am längsten).
      return ohneDoppelte(z.sort((a, b) => reihenfolge(a.letzterKontakt ?? '', b.letzterKontakt ?? '') || reihenfolge(a.id, b.id)).map(x => ({ art: 'firma' as const, id: x.id })));
    }
    case 'deals-ohne-schritt':
      return offeneDeals.filter(c => !c.naechsterSchritt).sort((a, b) => reihenfolge(a.geaendert ?? '', b.geaendert ?? '') || reihenfolge(a.id, b.id)).map(dealFall);
    case 'deals-haengen': {
      // Ampel rot/gelb (lib/crm/pipeline.ts `gesundheit`) oder ohne nächsten Schritt — rot zuerst, dann gelb, dann ohne Schritt.
      const rang = (c: Chance) => { const g = gesundheit(c, d.heute, d.crm.wertelisten).ampel; return g === 'rot' ? 0 : g === 'gelb' ? 1 : !c.naechsterSchritt ? 2 : 9; };
      return offeneDeals.filter(c => rang(c) < 9).sort((a, b) => rang(a) - rang(b) || reihenfolge(a.id, b.id)).map(dealFall);
    }
    case 'deals-wiedervorlage':
      return dealWiedervorlagen(d.crm, d.heute).filter(c => d.business(c.gesellschaft) && dealPasst(q, c, d.person)).sort((a, b) => reihenfolge(a.wiedervorlage ?? '', b.wiedervorlage ?? '') || reihenfolge(a.id, b.id)).map(dealFall);
    case 'leads-wiedervorlage':
      return ohneDoppelte(leads.filter(z => z.status === 'ruht' && !!z.wiedervorlage && z.wiedervorlage.slice(0, 10) <= d.heute).sort((a, b) => reihenfolge(a.wiedervorlage ?? '', b.wiedervorlage ?? '') || reihenfolge(a.id, b.id)).map(leadFall));
    case 'angebote-ohne-antwort': {
      const bis = tagPlus(d.heute, -Math.max(0, q.tage ?? 7));
      const raus: LaufFall[] = [];
      for (const a of [...(d.crm.angebote ?? [])].sort((x, y) => reihenfolge(x.gestelltAm ?? '', y.gestelltAm ?? ''))) {
        if (a.status !== 'gestellt' || !a.gestelltAm || a.gestelltAm.slice(0, 10) > bis || !d.business(a.gesellschaft)) continue;
        if (a.kontaktId && !nachId.has(a.kontaktId)) continue;
        if (a.kontaktId && ausgenommen(k(a.kontaktId))) continue;
        if (a.dealId) raus.push({ art: 'deal', id: a.dealId });
        else if (a.firmaId) raus.push({ art: 'firma', id: a.firmaId });
      }
      return ohneDoppelte(raus);
    }
    case 'netzwerken-offen': {
      if (d.fall.art !== 'event' || !d.fall.id) return [];
      const t = d.crm.teilnahmen.filter(x => x.eventId === d.fall.id && !!x.netzwerken && !x.followUpAm && !x.nachfassenVerzichtet && !!k(x.kontaktId) && !ausgenommen(k(x.kontaktId)));
      return ohneDoppelte(t.map(x => ({ art: 'lead' as const, id: x.kontaktId })));
    }
    case 'nachbereiten':
      return ohneDoppelte(nachbereitung([...d.kontakte], d.heute, d.person ?? undefined).map(n => ({ art: 'lead' as const, id: n.kontaktId })));
    case 'vernetzen-runde': {
      if (!d.person) return [];
      const kampagne = d.fall.art === 'kampagne' ? (d.crm.kampagnen ?? []).find(c => c.id === d.fall.id) : undefined;
      return ohneDoppelte(netzRunde([...d.kontakte], d.person, d.heute, { ...(kampagne ? { kampagne } : {}), ...(q.hoechstens ? { proTag: q.hoechstens } : {}) }).karten.map(c => ({ art: 'lead' as const, id: c.kontakt.id })));
    }
    case 'powerhour-karten':
      return ohneDoppelte(werIstDran([...d.kontakte], d.crm, d.heute, d.person, Math.max(1, q.hoechstens)).karten.filter(c => !ausgenommen(c.kontakt)).map(c => ({ art: 'lead' as const, id: c.kontakt.id })));
    case 'kampagne-personen': {
      const liste = d.fall.art === 'kampagne' && d.fall.id ? (d.crm.kampagnen ?? []).filter(c => c.id === d.fall.id && !c.geloeschtAm) : (d.crm.kampagnen ?? []).filter(c => c.status === 'aktiv' && !c.geloeschtAm);
      const raus: LaufFall[] = [];
      for (const c of liste) {
        const mitErgebnis = new Set((c.ergebnisse ?? []).filter(e => e.ergebnis === 'kein_interesse' || e.ergebnis === 'chance').map(e => e.kontaktId));
        for (const id of c.kontaktIds) if (nachId.has(id) && !ausgenommen(k(id)) && !mitErgebnis.has(id)) raus.push({ art: 'lead', id });
      }
      return ohneDoppelte(raus);
    }
    case 'mandate-laufzeitende': {
      const bis = tagPlus(d.heute, Math.max(0, q.tage ?? 90));
      const z = d.crm.mandate.filter(m => m.status === 'aktiv' && !m.geloeschtAm && d.business(m.gesellschaft)).map(m => ({ m, ende: mandatFristen(m, d.heute).endeAm })).filter(x => !!x.ende && x.ende >= d.heute && x.ende <= bis);
      return z.sort((a, b) => reihenfolge(a.ende!, b.ende!) || reihenfolge(a.m.id, b.m.id)).map(x => ({ art: 'mandat' as const, id: x.m.id }));
    }
  }
  return [];
}

// ── „Schritt testen“ an einer Abfrage (Bau-Test 2, 24.10.: nur die Trefferzahl war zu sehen) ────────────────────────────────────────────────────────────

/** Ein Treffer zum Ansehen: nur Art, Kennung, Name und der Link dorthin (`WEG`) — nie weitere Felder. */
export interface AbfrageTreffer { art: LaufFall['art']; id: string; name: string; href: string }
/** So viele Treffer zeigt „Schritt testen“ mit Namen. */
export const ABFRAGE_TREFFER_MAX = 5;
const personName = (k: Pick<Kontakt, 'vorname' | 'nachname'>) => [k.vorname, k.nachname].map(x => (x ?? '').trim()).filter(Boolean).join(' ');
/**
 * Die ersten Treffer einer Abfrage mit Namen (rein): Lead (Firma bzw. Person), Firma, Deal-Titel, Mandat. Die Namen kommen NUR aus den Daten der Abfrage — die
 * Kartei ist schon ohne eingeschränkte Personen (Art. 18); wessen Name dort nicht steht, erscheint nicht. Höchstens `max`.
 */
export function abfrageTreffer(faelle: readonly LaufFall[], d: Pick<AbfrageDaten, 'crm' | 'kontakte' | 'leads'>, max = ABFRAGE_TREFFER_MAX): AbfrageTreffer[] {
  const lead = new Map(d.leads.map(z => [z.id, z]));
  const person = new Map(d.kontakte.map(k => [k.id, k]));
  const firma = new Map(d.crm.firmen.map(f => [f.id, f]));
  const deal = new Map(d.crm.chancen.map(c => [c.id, c]));
  const mandat = new Map(d.crm.mandate.map(m => [m.id, m]));
  const raus: AbfrageTreffer[] = [];
  for (const f of faelle) {
    if (raus.length >= max) break;
    if (!f.id) continue;
    let name = '', href = '';
    if (f.art === 'lead' || f.art === 'firma') {
      const p = person.get(f.id), fi = firma.get(f.id);
      name = lead.get(f.id)?.name ?? (p ? personName(p) : fi?.name ?? '');
      href = p ? WEG.kontakt(f.id) : WEG.firma(f.id);
      // Eine Person, die nicht in der verarbeitbaren Kartei steht (Art. 18), nie mit Namen.
      if (f.id.startsWith('c-') && !p) name = '';
    } else if (f.art === 'deal') { name = deal.get(f.id)?.titel ?? ''; href = WEG.deal(f.id); }
    else if (f.art === 'mandat') { const m = mandat.get(f.id); name = m ? (m.titel || m.kunde || '') : ''; href = WEG.mandat(f.id); }
    if (name.trim()) raus.push({ art: f.art, id: f.id, name: name.trim(), href });
  }
  return raus;
}

/**
 * Die vorgemerkten Gäste eines eigenen Abends (Schleife über die Liste am Fall `event.gaeste`, V18) — nur verarbeitbare Personen ohne Werbesperre.
 */
export function eventGaeste(d: Pick<AbfrageDaten, 'crm' | 'kontakte' | 'fall'>): LaufFall[] {
  if (d.fall.art !== 'event' || !d.fall.id) return [];
  const nachId = new Map(d.kontakte.map(k => [k.id, k]));
  return ohneDoppelte(d.crm.teilnahmen.filter(t => t.eventId === d.fall.id && t.status === 'vorgemerkt' && nachId.has(t.kontaktId) && !ausgenommen(nachId.get(t.kontaktId))).map(t => ({ art: 'lead' as const, id: t.kontaktId })));
}

/**
 * Ein Eintrag der Liste als Fall des Teilprozesses (rein): gleiche Art bleibt; ein Firmen-Lead (`f-…`) wird für einen Firmen-Teilprozess zur Firma, eine Firma für einen
 * Lead-Teilprozess zum Lead — sonst bleibt der Eintrag, wie er ist (V01a: „ohne Firma: Fall Lead der Person“).
 */
export function fallFuerTeil(f: LaufFall, teil: FallArt): LaufFall {
  if (!f.id || f.art === teil) return f;
  if (teil === 'firma' && f.art === 'lead' && f.id.startsWith('f-')) return { art: 'firma', id: f.id };
  if (teil === 'lead' && f.art === 'firma') return { art: 'lead', id: f.id };
  return f;
}
