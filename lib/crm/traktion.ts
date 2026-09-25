// ─── Markttraktion — Traction-Score und Übergaben (rein, getestet) ─────────
// Kevin (25.09.): „alles, was unter dem CRM läuft — Sales, Marketing, Event —
// heißt Markttraktion.“ Der Score folgt dem Markttraktion-Konzept aus KEMARIS
// („Market Traction Analyse und Score-Entwicklung“): fünf Säulen mit Gewicht —
// Sichtbarkeit 15, Marketing 25, Vertrieb 30, Events 10, Conversions 20. In
// MAKE OS arbeiten drei Welten mit je einem Head; die Säulen fallen zusammen:
//   Sales     = Vertrieb + Conversions   → 50 %
//   Marketing = Sichtbarkeit + Marketing → 40 %
//   Event     = Events                   → 10 %
// Punkte je Kennzahl aus ihrer Ampel (grün 100 · gelb 60 · rot 20), grau zählt
// nicht. Welt = Mittel ihrer gemessenen Kennzahlen. Gesamt = gewichtetes
// geometrisches Mittel (bestraft Ungleichgewicht, wie im Konzept). Fehlt einer
// Welt jede Messung, rechnet der Score über die übrigen und sagt das
// („vorläufig“) — nie eine erfundene Null.
//
// Grundlage (Ansprechbar, Datenreife, Art. 14) ist Pflicht, keine Traktion —
// sie steht daneben, zählt aber nicht in den Score.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event } from './typen';
import type { Kpi, KpiAmpel } from './kennzahlen';
import { OFFENE_STUFEN } from './pipeline';
import { eventZahlen, followUpBis } from './events';
import { mix } from './eventplanung';
import { stimmenAus } from './marketing';

export type Welt = 'sales' | 'marketing' | 'event';
export const WELTEN: { id: Welt; label: string; head: string; gewicht: number; saeulen: string }[] = [
  { id: 'sales', label: 'Sales', head: 'Head of Sales', gewicht: 50, saeulen: 'Vertrieb 30 + Conversions 20' },
  { id: 'marketing', label: 'Marketing', head: 'Head of Marketing', gewicht: 40, saeulen: 'Sichtbarkeit 15 + Marketing 25' },
  { id: 'event', label: 'Event', head: 'Head of Event', gewicht: 10, saeulen: 'Events 10' },
];

/** Welche Kennzahlen Traktion messen — der Rest ist Grundlage. */
export const IM_SCORE: Record<Welt, string[]> = {
  sales: ['power_hours', 'gespraeche', 'erstgespraeche', 'ohne_schritt', 'mrr'],
  marketing: ['veroeffentlichungen', 'content_gespraeche', 'marketing_anteil', 'abmeldequote', 'newsletter_netto'],
  event: ['events_90', 'nachfassen_48h', 'folgegespraeche', 'erscheinen', 'mischung'],
};
export const GRUNDLAGE = ['ansprechbar', 'reife', 'art14'];

const PUNKTE: Record<Exclude<KpiAmpel, 'grau'>, number> = { gruen: 100, gelb: 60, rot: 20 };

export interface WeltScore { id: Welt; label: string; head: string; gewicht: number; saeulen: string; score: number | null; gemessen: number; von: number; kpis: Kpi[] }
export interface Traktion { score: number | null; vorlaeufig: boolean; hinweis: string; welten: WeltScore[] }

export function weltScore(kpis: Kpi[]): { score: number | null; gemessen: number } {
  const p = kpis.filter(k => k.ampel !== 'grau').map(k => PUNKTE[k.ampel as Exclude<KpiAmpel, 'grau'>]);
  return { score: p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : null, gemessen: p.length };
}

export function traktion(kpis: Record<Welt, Kpi[]>): Traktion {
  const welten: WeltScore[] = WELTEN.map(w => {
    const eigene = IM_SCORE[w.id].map(id => kpis[w.id].find(k => k.id === id)).filter((k): k is Kpi => !!k);
    const s = weltScore(eigene);
    return { ...w, score: s.score, gemessen: s.gemessen, von: eigene.length, kpis: eigene };
  });
  const mit = welten.filter(w => w.score !== null);
  const summe = mit.reduce((a, w) => a + w.gewicht, 0);
  // Gewichtetes geometrisches Mittel: exp(Σ g·ln s / Σ g).
  const score = mit.length ? Math.round(Math.exp(mit.reduce((a, w) => a + w.gewicht * Math.log(w.score!), 0) / summe)) : null;
  const ohne = welten.filter(w => w.score === null).map(w => w.label);
  return {
    score, vorlaeufig: ohne.length > 0 && mit.length > 0, welten,
    hinweis: !mit.length ? 'Noch nichts gemessen — der Score entsteht mit den ersten Power Hours, Beiträgen und Events.'
      : ohne.length ? `vorläufig — ${ohne.join(' und ')} noch ohne Messung, gerechnet über ${mit.map(w => w.label).join(' und ')}`
      : 'über alle drei Welten',
  };
}

// ── Event-Kennzahlen ───────────────────────────────────────────────────────
const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const stufe = (v: number, gruen: number, gelb: number): KpiAmpel => (v >= gruen ? 'gruen' : v >= gelb ? 'gelb' : 'rot');
const prozent = (q: number) => `${Math.round(q * 100)} %`;
const stattgefunden = (e: Event, heute: string) => e.status !== 'abgesagt' && (e.status === 'durchgefuehrt' || e.datum < heute);

export function eventKennzahlen(kontakte: Kontakt[], crm: CrmBestand, heute: string): Kpi[] {
  const events = crm.events ?? [];
  const vor90 = tagPlus(heute, -89), vor180 = tagPlus(heute, -179);
  const vorbei = events.filter(e => stattgefunden(e, heute));
  const kommend = events.filter(e => e.status !== 'abgesagt' && e.datum >= heute && e.status !== 'durchgefuehrt').sort((a, b) => a.datum.localeCompare(b.datum));
  const in90 = vorbei.filter(e => e.datum >= vor90 && e.datum <= heute);

  // Nachfassen binnen 48 Stunden — nur Gäste, deren Frist schon abgelaufen ist oder die schon nachgefasst sind.
  const nachEvent = new Map(events.map(e => [e.id, e]));
  const gaeste = crm.teilnahmen.filter(t => t.status === 'da' && nachEvent.has(t.eventId) && nachEvent.get(t.eventId)!.datum >= vor90)
    .filter(t => t.followUpAm || followUpBis(nachEvent.get(t.eventId)!) < heute);
  const puenktlich = gaeste.filter(t => t.followUpAm && t.followUpAm.slice(0, 10) <= followUpBis(nachEvent.get(t.eventId)!)).length;

  // Folgegespräche: Events, deren 30-Tage-Fenster begonnen hat, in den letzten 120 Tagen.
  const mitFenster = vorbei.filter(e => e.datum >= tagPlus(heute, -119));
  const zahlen = mitFenster.map(e => eventZahlen(e, crm.teilnahmen, kontakte, crm.chancen));
  const folgeSchnitt = zahlen.length ? zahlen.reduce((a, z) => a + z.folgegespraeche, 0) / zahlen.length : null;

  // Erscheinen: Summe über 180 Tage, aussagekräftig ab fünf Zusagen.
  const z180 = vorbei.filter(e => e.datum >= vor180).map(e => eventZahlen(e, crm.teilnahmen, kontakte, crm.chancen));
  const zugesagt = z180.reduce((a, z) => a + z.zugesagt, 0), da = z180.reduce((a, z) => a + z.da, 0);

  const naechstes = kommend[0];
  const m = naechstes ? mix(naechstes, crm.teilnahmen, kontakte, crm.firmen) : null;

  return [
    { id: 'events_90', label: 'Events · 90 Tage', wert: events.length ? in90.length : null, anzeige: events.length ? String(in90.length) : '—',
      ampel: !events.length ? 'grau' : in90.length ? 'gruen' : kommend.length ? 'gelb' : 'rot', ziel: '≥ 1 je Quartal',
      quelle: events.length ? `${vorbei.length} stattgefunden · ${kommend.length} geplant` : 'noch kein Event angelegt' },
    { id: 'nachfassen_48h', label: 'Nachgefasst binnen 48 h', wert: gaeste.length ? puenktlich / gaeste.length : null, anzeige: gaeste.length ? prozent(puenktlich / gaeste.length) : '—',
      ampel: gaeste.length ? stufe(puenktlich / gaeste.length, 0.9, 0.6) : 'grau', ziel: '≥ 90 %',
      quelle: gaeste.length ? `${puenktlich} von ${gaeste.length} Gästen der letzten 90 Tage` : 'noch kein Gast mit abgelaufener Frist' },
    { id: 'folgegespraeche', label: 'Folgegespräche je Event · 30 Tage', wert: folgeSchnitt, anzeige: folgeSchnitt === null ? '—' : folgeSchnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 }),
      ampel: folgeSchnitt === null ? 'grau' : stufe(folgeSchnitt, 3, 1), ziel: '≥ 3 je Event',
      quelle: zahlen.length ? `${zahlen.reduce((a, z) => a + z.folgegespraeche, 0)} Gespräche aus ${zahlen.length} Event(s) · 120 Tage` : 'noch kein vergangenes Event' },
    { id: 'erscheinen', label: 'Erscheinensquote', wert: zugesagt >= 5 ? da / zugesagt : null, anzeige: zugesagt >= 5 ? prozent(da / zugesagt) : '—',
      ampel: zugesagt >= 5 ? stufe(da / zugesagt, 0.7, 0.5) : 'grau', ziel: '≥ 70 %',
      quelle: zugesagt ? `${da} da von ${zugesagt} Zusagen · 180 Tage${zugesagt < 5 ? ' (Quote ab 5 Zusagen)' : ''}` : 'noch keine Zusage' },
    { id: 'mischung', label: 'Gästemischung nächstes Event', wert: m?.ampel ? m.anteil.zielkunde : null, anzeige: m?.ampel ? `${m.anteil.zielkunde} % Zielk.` : '—',
      ampel: m?.ampel ?? 'grau', ziel: m ? `≥ ${m.ziel.zielkunden} % Zielkunden, ≥ ${m.ziel.kunden} % Kunden` : 'Soll je Event',
      quelle: naechstes ? `„${naechstes.titel}“ · ${m?.hinweis ?? ''}` : 'kein Event geplant' },
  ];
}

// ── Übergaben zwischen den Welten ─────────────────────────────────────────
// Das Zusammenspiel der drei Heads, sichtbar gemacht: was eine Welt der
// anderen hinlegt und dort noch liegt. Jede Übergabe führt direkt dorthin,
// wo sie erledigt wird.
export interface Uebergabe { id: string; von: Welt; an: Welt; titel: string; anzahl: number; text: string; ziel: { s: string; a?: string } }

export function uebergaben(kontakte: Kontakt[], crm: CrmBestand, heute: string): Uebergabe[] {
  const liste: Uebergabe[] = [];
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const offeneChance = new Set(crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).flatMap(c => c.kontaktIds));
  const events = new Map(crm.events.map(e => [e.id, e]));

  // Event → Sales: Gäste, die da waren und noch nicht nachgefasst sind.
  const nachfassen = crm.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm && events.has(t.eventId) && nachId.has(t.kontaktId));
  if (nachfassen.length) {
    const ueberfaellig = nachfassen.filter(t => followUpBis(events.get(t.eventId)!) < heute).length;
    liste.push({ id: 'event-nachfassen', von: 'event', an: 'sales', titel: 'Gäste nachfassen', anzahl: nachfassen.length,
      text: `stehen in der Power Hour${ueberfaellig ? ` · ${ueberfaellig} über der 48-Stunden-Frist` : ''}`, ziel: { s: 'sales', a: 'heute' } });
  }

  // Marketing → Sales: Gespräche und Anfragen aus Beiträgen (60 Tage) ohne offene Chance.
  const vor60 = tagPlus(heute, -59);
  const ausContent = new Set((crm.beitraege ?? []).flatMap(b => (b.wirkung ?? []).filter(w => (w.art === 'gespraech' || w.art === 'anfrage') && w.am.slice(0, 10) >= vor60).map(w => w.kontaktId))
    .filter(id => nachId.has(id) && !offeneChance.has(id) && !nachId.get(id)!.werbesperre));
  if (ausContent.size) liste.push({ id: 'content-ohne-chance', von: 'marketing', an: 'sales', titel: 'Anfragen aus Content ohne Chance', anzahl: ausContent.size,
    text: 'Wert und nächsten Schritt festhalten — sonst fehlen sie in der Prognose', ziel: { s: 'sales', a: 'pipeline' } });

  // Sales → Marketing: Stimmen der Kunden, die noch kein Thema im Redaktionsplan sind.
  const genutzt = new Set((crm.beitraege ?? []).flatMap(b => b.quellen ?? []));
  const stimmen = stimmenAus(kontakte, 200).filter(s => !genutzt.has(s.kontaktId));
  if (stimmen.length) liste.push({ id: 'stimmen-ohne-thema', von: 'sales', an: 'marketing', titel: 'Stimmen der Kunden ohne Thema', anzahl: stimmen.length,
    text: 'Bedarf und Schmerz aus Gesprächen — ein Klick macht daraus eine Beitragsidee', ziel: { s: 'marketing', a: 'redaktion' } });

  // Marketing → Sales: aktive Kampagnen, deren Personen noch nicht angesprochen sind.
  const kampagnenOffen = (crm.kampagnen ?? []).filter(k => k.status === 'aktiv')
    .reduce((a, k) => { const erledigt = new Set(k.ergebnisse.map(e => e.kontaktId)); return a + k.kontaktIds.filter(id => !erledigt.has(id) && nachId.has(id)).length; }, 0);
  if (kampagnenOffen) liste.push({ id: 'kampagne-offen', von: 'marketing', an: 'sales', titel: 'Kampagnen-Personen noch nicht angesprochen', anzahl: kampagnenOffen,
    text: 'kommen als „Neu“ mit Kampagnen-Bezug in die Power Hour', ziel: { s: 'sales', a: 'heute' } });

  // Sales → Event: nächstes Event mit freien Plätzen oder verfehlter Mischung.
  const naechstes = crm.events.filter(e => e.status !== 'abgesagt' && e.status !== 'durchgefuehrt' && e.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum))[0];
  if (naechstes) {
    const m = mix(naechstes, crm.teilnahmen, kontakte, crm.firmen);
    const fehlen = m.fehlen.zielkunden + m.fehlen.kunden;
    const belegt = crm.teilnahmen.filter(t => t.eventId === naechstes.id && t.status !== 'abgesagt').length;
    const frei = naechstes.kapazitaet ? Math.max(0, naechstes.kapazitaet - belegt) : 0;
    if (fehlen || frei) liste.push({ id: 'event-gaeste', von: 'sales', an: 'event', titel: `Gäste für „${naechstes.titel}“`, anzahl: fehlen || frei,
      text: fehlen ? `für die Soll-Mischung fehlen ${m.fehlen.zielkunden} Zielkunden und ${m.fehlen.kunden} Kunden/Multiplikatoren` : `${frei} Plätze frei`, ziel: { s: 'event' } });
  }
  return liste;
}
