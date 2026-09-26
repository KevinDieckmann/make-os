// ─── Traktions-Index (rein, getestet) — der Traktions-Score auf dem Kern ────
// Kevin (26.09.): „auf denselben Kern heben wie Business und Privat“. Die
// Kennzahlen bleiben die der drei Welten (lib/crm/kennzahlen, marketing,
// traktion), die Punkte-Logik ist die eine (lib/kennzahlen/kern), das Gesamt
// bleibt das gewichtete geometrische Mittel des KEMARIS-Konzepts:
//   Sales 50 · Marketing 40 · Event 10 — dazu „Grundlage“ (Gewicht 0, zählt nicht).
// Hinter jeder Kennzahl die Punkte: die Personen, Deals, Beiträge, Events —
// jeder mit Weg dorthin, wo man handelt.

import type { Kontakt } from '@/lib/make-one/crm';
import { anzeigename } from '@/lib/make-one/crm';
import type { CrmBestand, Chance, Mandat } from './typen';
import { kennzahlen, type Kpi } from './kennzahlen';
import { marketingKennzahlen, ausMarketing, abmeldequote } from './marketing';
import { eventKennzahlen, WELTEN, IM_SCORE, GRUNDLAGE, type Welt, type Traktion } from './traktion';
import { OFFENE_STUFEN } from './pipeline';
import { eventZahlen, followUpBis } from './events';
import { art14, ampel as kanalAmpel } from './recht';
import { berechneModell, type KennzahlDefBasis, type SaeuleDef, type Messung, type Detail, type Ampel, type Schwelle, type IndexErgebnis } from '@/lib/kennzahlen/kern';
import { WEG } from '@/lib/wege';
import { markttraktion } from './adresse';

export type TraktionsIndex = IndexErgebnis;

export const TRAKTION_SAEULEN: SaeuleDef[] = [
  ...WELTEN.map(w => ({ id: w.id as string, label: w.label, gewicht: w.gewicht / 100, satz: `${w.head} · ${w.saeulen}` })),
  { id: 'grundlage', label: 'Grundlage', gewicht: 0, satz: 'Pflicht, keine Traktion: Ansprechbarkeit, Datenreife, Art. 14 — zählt nicht in den Score' },
];

type Def = Omit<KennzahlDefBasis, 'saeule' | 'gruppe' | 'quelle' | 'luecke'> & { saeule: Welt | 'grundlage'; gruppe: string; quelle: string; luecke: string; /** Kpi-Wert × skala = Wert im Index (Quoten 0–1 → Prozent). */ skala?: number };

const D = (d: Def): KennzahlDefBasis => d;
export const TRAKTION_KENNZAHLEN: KennzahlDefBasis[] = [
  // ── Sales
  D({ id: 'power_hours', label: 'Power Hours · 7 Tage', saeule: 'sales', gruppe: 'Vertrieb', gewicht: 1.25, einheit: 'anzahl', richtung: 'hoch', gruen: 4, rot: 2, formel: 'Power-Hour-Sitzungen der letzten 7 Tage', quelle: 'Power Hour', luecke: 'Noch keine Power Hour', pflegen: { text: 'Power Hour starten', href: WEG.powerHour() } }),
  D({ id: 'gespraeche', label: 'Echte Gespräche · 7 Tage', saeule: 'sales', gruppe: 'Vertrieb', gewicht: 1.25, einheit: 'anzahl', richtung: 'hoch', gruen: 8, rot: 4, formel: 'Gespräche und Termine im Verlauf der letzten 7 Tage', quelle: 'Aktivitäten der Kartei', luecke: 'Noch kein Gespräch festgehalten', pflegen: { text: 'Gespräch festhalten', href: WEG.powerHour() } }),
  D({ id: 'erstgespraeche', label: 'Neue Erstgespräche · 30 Tage', saeule: 'sales', gruppe: 'Vertrieb', einheit: 'anzahl', richtung: 'hoch', gruen: 4, rot: 2, formel: 'Personen, deren erstes echtes Gespräch in den letzten 30 Tagen lag', quelle: 'Aktivitäten der Kartei', luecke: 'Noch kein Gespräch festgehalten', pflegen: { text: 'Leads qualifizieren', href: WEG.leads() } }),
  D({ id: 'sql_30', label: 'Neue SQL · 30 Tage', saeule: 'sales', gruppe: 'Conversions', einheit: 'anzahl', richtung: 'hoch', gruen: 2, rot: 1, formel: 'In 30 Tagen angelegte Deals (Ebene 1 → 2)', quelle: 'Deals', luecke: 'Noch kein Deal angelegt', pflegen: { text: 'Deals öffnen', href: WEG.deals() } }),
  D({ id: 'ohne_schritt', label: 'Deals ohne nächsten Schritt', saeule: 'sales', gruppe: 'Conversions', einheit: 'anzahl', richtung: 'niedrig', gruen: 0, rot: 2, formel: 'Offene Deals ohne festgehaltenen nächsten Schritt', quelle: 'Deals', luecke: 'Kein offener Deal', pflegen: { text: 'Deals öffnen', href: WEG.deals() } }),
  D({ id: 'mrr', label: 'Größter Kunde am MRR', saeule: 'sales', gruppe: 'Conversions', einheit: 'prozent', richtung: 'niedrig', gruen: 50, rot: 70, formel: 'Anteil des größten Kunden am wiederkehrenden Monatsumsatz', quelle: 'Aktive Mandate mit Monatshonorar', luecke: 'Keine aktiven Monatsmandate', pflegen: { text: 'Mandate pflegen', href: WEG.mandat() } }),
  // ── Marketing
  D({ id: 'veroeffentlichungen', label: 'Veröffentlichungen · 7 Tage', saeule: 'marketing', gruppe: 'Sichtbarkeit', gewicht: 1.25, einheit: 'anzahl', richtung: 'hoch', gruen: 2, rot: 1, formel: 'Veröffentlichte Beiträge der letzten 7 Tage', quelle: 'Redaktionsplan', luecke: 'Noch kein Beitrag im Redaktionsplan', pflegen: { text: 'Redaktionsplan', href: WEG.marketing('redaktion') } }),
  D({ id: 'content_gespraeche', label: 'Gespräche aus Content · 30 Tage', saeule: 'marketing', gruppe: 'Marketing', gewicht: 1.25, einheit: 'anzahl', richtung: 'hoch', gruen: 2, rot: 1, formel: 'Wirkung „Gespräch“ oder „Anfrage“ an Beiträgen, je Person und Beitrag einmal', quelle: 'Redaktionsplan · Wirkung', luecke: 'Noch kein veröffentlichter Beitrag', pflegen: { text: 'Wirkung festhalten', href: WEG.marketing('redaktion') } }),
  D({ id: 'marketing_anteil', label: 'Neue Deals aus Marketing · 90 Tage', saeule: 'marketing', gruppe: 'Marketing', einheit: 'prozent', richtung: 'hoch', gruen: 25, rot: 10, skala: 100, formel: 'Deals mit Quelle Content/Anfrage oder Gespräch aus einem Beitrag ÷ neue Deals', quelle: 'Deals + Redaktionsplan', luecke: 'Kein neuer Deal in 90 Tagen', pflegen: { text: 'Deals öffnen', href: WEG.deals() } }),
  D({ id: 'abmeldequote', label: 'Abmeldequote letzte Ausgabe', saeule: 'marketing', gruppe: 'Sichtbarkeit', einheit: 'prozent', richtung: 'niedrig', gruen: 0.5, rot: 1, skala: 100, formel: 'Abmeldungen ÷ Empfänger der letzten versendeten Ausgabe', quelle: 'Newsletter', luecke: 'Noch keine versendete Ausgabe mit Zahlen', pflegen: { text: 'Newsletter', href: WEG.marketing('newsletter') } }),
  D({ id: 'newsletter_netto', label: 'Newsletter netto · 30 Tage', saeule: 'marketing', gruppe: 'Sichtbarkeit', einheit: 'anzahl', richtung: 'hoch', gruen: 1, rot: 0, formel: 'Neue Double-Opt-ins minus Widerrufe und Sperren in 30 Tagen', quelle: 'Einwilligungen der Kartei', luecke: 'Noch keine Newsletter-Einwilligung', pflegen: { text: 'Kartei', href: WEG.kontakt() } }),
  // ── Event
  D({ id: 'events_90', label: 'Events · 90 Tage', saeule: 'event', gruppe: 'Events', gewicht: 1.25, einheit: 'anzahl', richtung: 'hoch', gruen: 1, rot: 0, formel: 'Stattgefundene Events der letzten 90 Tage (geplantes Event = gelb)', quelle: 'Events', luecke: 'Noch kein Event angelegt', pflegen: { text: 'Event anlegen', href: WEG.event() } }),
  D({ id: 'nachfassen_48h', label: 'Nachgefasst binnen 48 h', saeule: 'event', gruppe: 'Events', einheit: 'prozent', richtung: 'hoch', gruen: 90, rot: 60, skala: 100, formel: 'Gäste, die binnen 48 h nachgefasst wurden ÷ Gäste mit abgelaufener Frist (90 Tage)', quelle: 'Teilnahmen', luecke: 'Noch kein Gast mit abgelaufener Frist', pflegen: { text: 'Nachfassen', href: WEG.event() } }),
  D({ id: 'folgegespraeche', label: 'Folgegespräche je Event · 30 Tage', saeule: 'event', gruppe: 'Events', einheit: 'anzahl', richtung: 'hoch', gruen: 3, rot: 1, formel: 'Ø Gespräche mit Gästen in den 30 Tagen nach dem Event (120 Tage)', quelle: 'Teilnahmen + Aktivitäten', luecke: 'Noch kein vergangenes Event', pflegen: { text: 'Events', href: WEG.event() } }),
  D({ id: 'erscheinen', label: 'Erscheinensquote', saeule: 'event', gruppe: 'Events', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 50, skala: 100, formel: 'Erschienene ÷ Zusagen über 180 Tage (ab 5 Zusagen)', quelle: 'Teilnahmen', luecke: 'Weniger als 5 Zusagen in 180 Tagen', pflegen: { text: 'Gäste pflegen', href: WEG.event() } }),
  D({ id: 'mischung', label: 'Gästemischung nächstes Event', saeule: 'event', gruppe: 'Events', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 40, direkt: true, formel: 'Soll-Mischung des nächsten Events (Zielkunden, Kunden/Multiplikatoren) — Ampel des Events', quelle: 'Nächstes Event', luecke: 'Kein Event geplant', pflegen: { text: 'Event planen', href: WEG.event() } }),
  // ── Grundlage (zählt nicht)
  D({ id: 'ansprechbar', label: 'Ansprechbar', saeule: 'grundlage', gruppe: 'Grundlage', einheit: 'prozent', richtung: 'hoch', gruen: 30, rot: 15, skala: 100, formel: 'Personen mit zulässigem Kanal (Ampel grün/gelb, ohne Vernetzen) ÷ Personen ohne Sperre', quelle: 'Kanal-Ampel der Kartei', luecke: 'Noch keine Person in der Kartei', pflegen: { text: 'Kartei', href: WEG.kontakt() } }),
  D({ id: 'reife', label: 'Datenreife', saeule: 'grundlage', gruppe: 'Grundlage', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 40, formel: 'Mail oder Telefon + Firma + Position ÷ alle Personen', quelle: 'Kartei', luecke: 'Noch keine Person in der Kartei', pflegen: { text: 'Anreichern', href: markttraktion('kontakte', 'anreichern') } }),
  D({ id: 'art14', label: 'Art. 14 überfällig', saeule: 'grundlage', gruppe: 'Grundlage', einheit: 'anzahl', richtung: 'niedrig', gruen: 0, rot: 1, formel: 'Personen, deren Informationsfrist nach Art. 14 DSGVO abgelaufen ist', quelle: 'Kartei', luecke: 'Noch keine Person in der Kartei', pflegen: { text: 'Art. 14 erledigen', href: markttraktion('kontakte', 'art14') } }),
];

export interface TraktionBestand { kontakte: Kontakt[]; crm: CrmBestand; heute: string; schwellen?: Record<string, Schwelle> }

// ── Hilfen ──────────────────────────────────────────────────────────────────
const tagMinus = (heute: string, n: number) => { const d = new Date(`${heute}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const echtesGespraech = (a: { art: string; ergebnis?: string }) => a.ergebnis === 'gespraech' || a.ergebnis === 'termin' || a.art === 'gespraech' || a.art === 'termin';
const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
const grenzen = (b: TraktionBestand, id: string) => b.schwellen?.[id] ?? (() => { const k = TRAKTION_KENNZAHLEN.find(x => x.id === id)!; return { gruen: k.gruen, rot: k.rot }; })();
function ampelVon(w: number, g: Schwelle): Ampel {
  const hoch = g.gruen >= g.rot;
  return hoch ? (w >= g.gruen ? 'gruen' : w < g.rot ? 'rot' : 'gelb') : (w <= g.gruen ? 'gruen' : w > g.rot ? 'rot' : 'gelb');
}
const person = (b: TraktionBestand, id: string) => b.kontakte.find(k => k.id === id);
const personDetail = (b: TraktionBestand, id: string, wert?: string, unter?: string, ampel?: Ampel): Detail | null => {
  const k = person(b, id);
  return k ? { titel: anzeigename(k), ...(wert ? { wert } : {}), ...(unter ? { unter } : {}), href: WEG.akte(k.id), ...(ampel ? { ampel } : {}) } : null;
};
const dealDetail = (c: Chance, wert: string, unter?: string, ampel?: Ampel): Detail => ({ titel: c.titel, wert, ...(unter ? { unter } : {}), href: WEG.deal(c.id), ...(ampel ? { ampel } : {}) });
const eventDetail = (e: { id: string; titel: string; datum: string }, wert: string, unter?: string, ampel?: Ampel): Detail => ({ titel: e.titel, wert, unter: unter ?? tagKurz(e.datum), href: WEG.event(e.id), ...(ampel ? { ampel } : {}) });

// ── Die Punkte hinter den Kennzahlen ───────────────────────────────────────
const DETAILS: Record<string, (b: TraktionBestand) => Detail[]> = {
  power_hours(b) {
    return (b.crm.sitzungen ?? []).slice().sort((x, y) => y.datum.localeCompare(x.datum)).slice(0, 3)
      .map(s => ({ titel: `Power Hour ${tagKurz(s.datum)}`, wert: `${s.karten.length} Karten`, unter: `${s.person}${s.gelernt ? ` · ${s.gelernt.slice(0, 60)}` : ''}`, href: WEG.powerHour() }));
  },
  gespraeche(b) {
    const vor7 = tagMinus(b.heute, 6);
    return b.kontakte.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.am.slice(0, 10) >= vor7 && echtesGespraech(a)).map(a => ({ k, a })))
      .sort((x, y) => y.a.am.localeCompare(x.a.am)).slice(0, 4)
      .map(({ k, a }) => ({ titel: anzeigename(k), wert: tagKurz(a.am.slice(0, 10)), unter: (a.text ?? a.art).slice(0, 70), href: WEG.akte(k.id) }));
  },
  erstgespraeche(b) {
    const vor30 = tagMinus(b.heute, 29);
    return b.kontakte.map(k => ({ k, erstes: (k.aktivitaeten ?? []).filter(echtesGespraech).map(a => a.am.slice(0, 10)).sort()[0] }))
      .filter(x => x.erstes && x.erstes >= vor30).sort((x, y) => y.erstes!.localeCompare(x.erstes!)).slice(0, 4)
      .map(({ k, erstes }) => ({ titel: anzeigename(k), wert: tagKurz(erstes!), unter: k.firma ?? undefined, href: WEG.akte(k.id) }));
  },
  sql_30(b) {
    const vor30 = tagMinus(b.heute, 29);
    return b.crm.chancen.filter(c => c.angelegt.slice(0, 10) >= vor30 && c.angelegt.slice(0, 10) <= b.heute).sort((x, y) => y.angelegt.localeCompare(x.angelegt)).slice(0, 4)
      .map(c => dealDetail(c, tagKurz(c.angelegt.slice(0, 10)), c.firma ?? c.stufe));
  },
  ohne_schritt(b) {
    return b.crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && !c.naechsterSchritt).slice(0, 4)
      .map(c => dealDetail(c, c.stufe, 'nächsten Schritt festhalten', 'rot'));
  },
  mrr(b) {
    const je = new Map<string, { mrr: number; m: Mandat }>();
    for (const m of b.crm.mandate.filter(m => m.status === 'aktiv' && m.honorar.basis === 'monat' && m.honorar.betrag > 0)) je.set(m.kunde, { mrr: (je.get(m.kunde)?.mrr ?? 0) + m.honorar.betrag, m });
    const gesamt = Array.from(je.values()).reduce((a, x) => a + x.mrr, 0) || 1;
    const g = grenzen(b, 'mrr');
    return Array.from(je.entries()).sort((x, y) => y[1].mrr - x[1].mrr).slice(0, 3)
      .map(([kunde, x]) => ({ titel: kunde, wert: `${Math.round((x.mrr / gesamt) * 100)} %`, unter: `${euro(x.mrr)}/Monat`, href: WEG.mandat(x.m.id), ampel: ampelVon((x.mrr / gesamt) * 100, g) }));
  },
  veroeffentlichungen(b) {
    return (b.crm.beitraege ?? []).filter(x => x.status === 'veroeffentlicht' && x.datum).sort((x, y) => y.datum!.localeCompare(x.datum!)).slice(0, 3)
      .map(x => ({ titel: x.titel, wert: tagKurz(x.datum!), unter: `${x.kanal} · ${(x.wirkung ?? []).length} Reaktionen`, href: WEG.marketing('redaktion') }));
  },
  content_gespraeche(b) {
    const vor30 = tagMinus(b.heute, 29);
    return (b.crm.beitraege ?? []).flatMap(x => (x.wirkung ?? []).filter(w => (w.art === 'gespraech' || w.art === 'anfrage') && w.am >= vor30 && w.am <= b.heute).map(w => ({ x, w })))
      .sort((p, q) => q.w.am.localeCompare(p.w.am)).slice(0, 4)
      .map(({ x, w }) => personDetail(b, w.kontaktId, w.art === 'anfrage' ? 'Anfrage' : 'Gespräch', `aus „${x.titel.slice(0, 50)}“ · ${tagKurz(w.am)}`))
      .filter((d): d is Detail => !!d);
  },
  marketing_anteil(b) {
    const vor90 = tagMinus(b.heute, 89);
    const neu = b.crm.chancen.filter(c => c.angelegt.slice(0, 10) >= vor90 && c.angelegt.slice(0, 10) <= b.heute);
    return neu.sort((x, y) => y.angelegt.localeCompare(x.angelegt)).slice(0, 4).map(c => { const mk = ausMarketing(c, b.crm.beitraege ?? []); return dealDetail(c, mk ? 'aus Marketing' : c.quelle ?? 'ohne Quelle', tagKurz(c.angelegt.slice(0, 10)), mk ? 'gruen' : undefined); });
  },
  abmeldequote(b) {
    return (b.crm.newsletter ?? []).filter(a => abmeldequote(a) !== null).sort((x, y) => (y.datum ?? '').localeCompare(x.datum ?? '')).slice(0, 3)
      .map(a => ({ titel: a.titel, wert: `${(abmeldequote(a)! * 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`, unter: `${a.abmeldungen} von ${a.empfaenger}${a.datum ? ` · ${tagKurz(a.datum)}` : ''}`, href: WEG.marketing('newsletter') }));
  },
  newsletter_netto(b) {
    const vor30 = tagMinus(b.heute, 29);
    const l: Detail[] = [];
    for (const k of b.kontakte) for (const e of (k.einwilligungen ?? []).filter(e => e.kanal === 'newsletter')) {
      if (!k.werbesperre && !e.widerrufenAm && e.erteiltAm >= vor30) l.push({ titel: anzeigename(k), wert: 'neu', unter: `Double-Opt-in ${tagKurz(e.erteiltAm)}`, href: WEG.akte(k.id), ampel: 'gruen' });
      else if (e.widerrufenAm && e.widerrufenAm >= vor30) l.push({ titel: anzeigename(k), wert: 'weg', unter: `widerrufen ${tagKurz(e.widerrufenAm)}`, href: WEG.akte(k.id), ampel: 'rot' });
    }
    return l.slice(0, 4);
  },
  events_90(b) {
    const vor90 = tagMinus(b.heute, 89);
    const alle = b.crm.events.filter(e => e.status !== 'abgesagt');
    const vorbei = alle.filter(e => (e.status === 'durchgefuehrt' || e.datum < b.heute) && e.datum >= vor90).sort((x, y) => y.datum.localeCompare(x.datum));
    const kommend = alle.filter(e => e.datum >= b.heute && e.status !== 'durchgefuehrt').sort((x, y) => x.datum.localeCompare(y.datum));
    return [...vorbei.slice(0, 2).map(e => { const z = eventZahlen(e, b.crm.teilnahmen, b.kontakte, b.crm.chancen); return eventDetail(e, `${z.da} da`, `${tagKurz(e.datum)} · ${z.folgegespraeche} Folgegespräche`, 'gruen'); }),
      ...kommend.slice(0, 2).map(e => eventDetail(e, 'geplant', tagKurz(e.datum), 'gelb'))];
  },
  nachfassen_48h(b) {
    const vor90 = tagMinus(b.heute, 89);
    const nachEvent = new Map(b.crm.events.map(e => [e.id, e]));
    return b.crm.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm && nachEvent.has(t.eventId) && nachEvent.get(t.eventId)!.datum >= vor90 && followUpBis(nachEvent.get(t.eventId)!) < b.heute).slice(0, 4)
      .map(t => personDetail(b, t.kontaktId, 'offen', `„${nachEvent.get(t.eventId)!.titel.slice(0, 40)}“ · Frist war ${tagKurz(followUpBis(nachEvent.get(t.eventId)!))}`, 'rot')).filter((d): d is Detail => !!d);
  },
  folgegespraeche(b) {
    const g = grenzen(b, 'folgegespraeche');
    return b.crm.events.filter(e => e.status !== 'abgesagt' && (e.status === 'durchgefuehrt' || e.datum < b.heute) && e.datum >= tagMinus(b.heute, 119)).sort((x, y) => y.datum.localeCompare(x.datum)).slice(0, 3)
      .map(e => { const z = eventZahlen(e, b.crm.teilnahmen, b.kontakte, b.crm.chancen); return eventDetail(e, `${z.folgegespraeche} Gespräche`, `${tagKurz(e.datum)} · ${z.da} Gäste da`, ampelVon(z.folgegespraeche, g)); });
  },
  erscheinen(b) {
    return b.crm.events.filter(e => e.status !== 'abgesagt' && (e.status === 'durchgefuehrt' || e.datum < b.heute) && e.datum >= tagMinus(b.heute, 179)).sort((x, y) => y.datum.localeCompare(x.datum)).slice(0, 3)
      .map(e => { const z = eventZahlen(e, b.crm.teilnahmen, b.kontakte, b.crm.chancen); return eventDetail(e, z.zugesagt ? `${Math.round((z.da / z.zugesagt) * 100)} %` : '—', `${z.da} da von ${z.zugesagt} Zusagen${z.noShow ? ` · ${z.noShow} nicht gekommen` : ''}`); });
  },
  mischung(b) {
    const n = b.crm.events.filter(e => e.status !== 'abgesagt' && e.status !== 'durchgefuehrt' && e.datum >= b.heute).sort((x, y) => x.datum.localeCompare(y.datum))[0];
    return n ? [eventDetail(n, tagKurz(n.datum), 'Gäste und Mischung im Event')] : [];
  },
  ansprechbar(b) {
    const gesperrt = b.kontakte.filter(k => k.werbesperre).length;
    const ohneKanal = b.kontakte.filter(k => !k.werbesperre && !kanalAmpel(k).some(s => s.farbe !== 'rot' && s.kanal !== 'vernetzen')).length;
    return [
      { titel: 'Ohne zulässigen Kanal', wert: String(ohneKanal), unter: 'Einwilligung oder Bestandskunden-Bezug festhalten', href: WEG.kontakt(), ampel: ohneKanal ? 'gelb' : 'gruen' },
      { titel: 'Werbesperren', wert: String(gesperrt), href: markttraktion('kontakte', 'gesperrt') },
    ];
  },
  reife(b) {
    const fehlt = (f: (k: Kontakt) => unknown) => b.kontakte.filter(k => !f(k)).length;
    return [
      { titel: 'Ohne Mail und Telefon', wert: String(fehlt(k => k.email || k.telefon)), href: markttraktion('kontakte', 'anreichern') },
      { titel: 'Ohne Firma', wert: String(fehlt(k => k.firma || k.firmaId)), href: markttraktion('kontakte', 'anreichern') },
      { titel: 'Ohne Position', wert: String(fehlt(k => k.position || k.jobtitel)), href: markttraktion('kontakte', 'anreichern') },
    ];
  },
  art14(b) {
    return b.kontakte.map(k => ({ k, a: art14(k, b.heute) })).filter(x => x.a?.faellig).slice(0, 4)
      .map(({ k }) => ({ titel: anzeigename(k), wert: 'überfällig', unter: 'Information nach Art. 14 nachholen', href: WEG.akte(k.id), ampel: 'rot' as Ampel }));
  },
};

/** Aus einer Kennzahl der Welten (Kpi) die Messung für den Kern — mit den Punkten dahinter. */
function messung(b: TraktionBestand, def: KennzahlDefBasis, k: Kpi | undefined): Messung {
  const details = DETAILS[def.id]?.(b) ?? [];
  if (!k || k.wert === null || k.ampel === 'grau') return { luecke: k?.quelle ?? def.luecke, details };
  const skala = (TRAKTION_KENNZAHLEN_SKALA[def.id] ?? 1);
  // Direkte Kennzahlen (Ampel des Events): grün 100 · gelb 60 · rot 20.
  const wert = def.direkt ? (k.ampel === 'gruen' ? 100 : k.ampel === 'gelb' ? 60 : 20) : k.wert * skala;
  return { wert, anzeige: k.anzeige, quelle: `${k.quelle} · Ziel ${k.ziel}`, details };
}
const TRAKTION_KENNZAHLEN_SKALA: Record<string, number> = { marketing_anteil: 100, abmeldequote: 100, nachfassen_48h: 100, erscheinen: 100, ansprechbar: 100 };

/** Der Traktions-Index — dieselbe Zahl im Überblick, im Business-Index und bei Jarvis. */
export function traktionsIndex(b: TraktionBestand): TraktionsIndex {
  const kpis: Record<string, Kpi> = {};
  for (const k of [...kennzahlen(b.kontakte, b.crm, b.heute), ...marketingKennzahlen(b.kontakte, b.crm, b.heute), ...eventKennzahlen(b.kontakte, b.crm, b.heute)]) kpis[k.id] = k;
  // „Größter Kunde“: die Kpi mrr trägt die Konzentration nur in der Quelle — hier als Prozentwert.
  if (kpis.mrr) {
    const je = new Map<string, number>();
    for (const m of b.crm.mandate.filter(m => m.status === 'aktiv' && m.honorar.basis === 'monat' && m.honorar.betrag > 0)) je.set(m.kunde, (je.get(m.kunde) ?? 0) + m.honorar.betrag);
    const gesamt = Array.from(je.values()).reduce((a, x) => a + x, 0);
    const max = Math.max(0, ...Array.from(je.values()));
    kpis.mrr = gesamt ? { ...kpis.mrr, wert: (max / gesamt) * 100, anzeige: `${Math.round((max / gesamt) * 100)} % · ${kpis.mrr.anzeige}` } : { ...kpis.mrr, wert: null, ampel: 'grau' };
  }
  // Ansprechbar: Kpi liefert die Anzahl — hier der Anteil.
  if (kpis.ansprechbar) {
    const aktiv = b.kontakte.filter(k => !k.werbesperre).length;
    kpis.ansprechbar = aktiv ? { ...kpis.ansprechbar, wert: (kpis.ansprechbar.wert ?? 0) / aktiv } : { ...kpis.ansprechbar, wert: null, ampel: 'grau' };
  }
  const messen: Record<string, (x: TraktionBestand) => Messung> = {};
  for (const def of TRAKTION_KENNZAHLEN) messen[def.id] = x => messung(x, def, kpis[def.id]);
  return berechneModell({ saeulen: TRAKTION_SAEULEN, kennzahlen: TRAKTION_KENNZAHLEN, messen, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: 'markttraktion', geometrisch: true });
}

/** Die alte Form (Score, Welten) — für Scoreboard-Verlauf und Business-Index. */
export function alsTraktion(idx: TraktionsIndex): Traktion {
  const welten = WELTEN.map(w => {
    const s = idx.saeulen.find(x => x.id === w.id);
    return { ...w, score: s?.score != null && !s.zuDuenn ? s.score : null, gemessen: s?.kennzahlen.filter(k => k.gemessen).length ?? 0, von: s?.kennzahlen.length ?? 0, kpis: [] };
  });
  const ohne = welten.filter(w => w.score === null).map(w => w.label);
  const mit = welten.filter(w => w.score !== null);
  return {
    score: idx.index, welten, vorlaeufig: ohne.length > 0 && mit.length > 0,
    hinweis: !mit.length ? 'Noch nichts gemessen — der Score entsteht mit den ersten Power Hours, Beiträgen und Events.'
      : ohne.length ? `vorläufig — ${ohne.join(' und ')} noch ohne Messung, gerechnet über ${mit.map(w => w.label).join(' und ')}` : 'über alle drei Welten',
  };
}

export { IM_SCORE, GRUNDLAGE };
