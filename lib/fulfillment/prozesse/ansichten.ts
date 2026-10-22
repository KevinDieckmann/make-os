// ─── Fulfillment · Fall — Antworten und Bilder für die Reiter „Menschen & Entscheidungen“, „Takt“, „Kunde & Reports“, „Kreislauf“ (12.10.) ─────
// Rückmeldung 12.10.: „Kann ich das einem Kunden zeigen? … keine losen Enden, alles strukturiert sauber — auch aus der Visualisierung heraus. Denk immer einen
// Schritt weiter.“ Je Reiter zuerst EINE Antwort (Satz + Ampel), dann ein Bild statt einer Liste: Stakeholder als Raster Einfluss × Haltung,
// Entscheidungen als Zeitstrahl, Rituale als Kalender-Leiste mit dem nächsten Termin, Reports als Zeitachse im Zwei-Wochen-Takt, der Kunden-Puls als
// Verlauf neben der Health, der Kreislauf mit „hier steht dieser Kunde“, die Nachsorge als Plan nach dem Mandatsende. Dazu die Verweise, die die
// losen Enden schließen: welcher Schritt im Ablauf zu welcher Stelle gehört (Quick Wins, Befähigung, Wirkungsbericht, Diagnose, Dossier) und was nach
// dem letzten Schritt kommt (Fall abschließen → Wirkungsbericht → Mandat beenden → Nachsorge).
// Gerechnet wird NUR hier (rein, client-sicher, deterministisch) — die Komponenten zeichnen nur. Grundlage sind die vorhandenen Regeln und Bestände;
// es entsteht kein neuer Bestand und keine zweite Fortschritts-, Puls- oder Report-Rechnung (Report-Takt: `REPORT_TAGE` der Leistungstreppe).

import type { Entscheidung, Fall, FallKnoten, Puls, Rhythmus, RitualVorlage, Stakeholder } from '../typen';
import type { KreislaufId } from '@/lib/crm/planung';
import { tagPlus } from '@/lib/kalender/zeit';
import { reportNaechsterFaellig } from '@/lib/crm/treppe';
import { markeNachsorge, NACHSORGE_TEXT, type NachsorgeArt } from './wirkung';
import { naechsterFallTermin } from './rituale';
import { kickoffVermerkText } from './onboarding';
import { WEG } from '@/lib/wege';
import { anzahl, satz } from '@/lib/text/zahlwort';

/** Eine Stufe des Kreislaufs (Kennungen aus Markttraktion › Planung). */
export type KreislaufStufeId = KreislaufId;
export type Ampel3 = 'gruen' | 'gelb' | 'rot';
/** Eine Antwort über einem Reiter: ein Satz, ein Satz darunter, die Ampel. */
export interface Antwort { ampel: Ampel3; antwort: string; unter: string }

const form = (t: string) => t.normalize('NFC').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const tagNr = (t: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000 : NaN; };
const zwischen = (von: string, bis: string) => Math.round(tagNr(bis.slice(0, 10)) - tagNr(von.slice(0, 10)));
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;

// ── Verweise: welcher Schritt im Ablauf gehört zu welcher Stelle des Falls ─────────────────────────────────────────────────────────────

/** Stellen des Falls, die ein Schritt im Ablauf meint (die Vorlagen nennen sie so — Muster und Import). */
export type SchrittVerweis = 'quickwins' | 'befaehigung' | 'wirkung' | 'diagnose' | 'dossier';

/**
 * Gehört ein Schritt zu einer Stelle, die der Fall selbst führt? Erkannt am Titel (Vergleichsform) bzw. an der Kennung des Musters
 * (`…-quickwins`, `…-befaehigung`, `…-wirkung`, `…-bericht` unter der Diagnose, `…-dossier`). Sonst null — der Schritt steht für sich.
 */
export function schrittVerweis(k: Pick<FallKnoten, 'id' | 'titel'>): SchrittVerweis | null {
  const t = form(k.titel);
  const id = k.id.toLowerCase();
  if (t === 'quick wins' || t.startsWith('quick wins ') || id.endsWith('-quickwins')) return 'quickwins';
  if (t.startsWith('befaehigung') || id.endsWith('-befaehigung')) return 'befaehigung';
  if (t.startsWith('wirkungsbericht') || id.endsWith('-wirkung')) return 'wirkung';
  if (t.startsWith('diagnosebericht') || t === 'diagnose bericht' || id.endsWith('-diagnose-bericht')) return 'diagnose';
  if (t === 'dossier' || t.startsWith('dossier ') || id.endsWith('-analyse-dossier')) return 'dossier';
  return null;
}

// ── Menschen: Stakeholder-Raster und Entscheidungs-Zeitstrahl ───────────────────────────────────────────────────────────────────────

export type Haltung = 'positiv' | 'neutral' | 'kritisch' | 'offen';
export const HALTUNGEN: readonly Haltung[] = ['positiv', 'neutral', 'kritisch', 'offen'];
export const HALTUNG_TEXT: Record<Haltung, string> = { positiv: 'positiv', neutral: 'neutral', kritisch: 'kritisch', offen: 'noch offen' };
export interface RasterZelle { einfluss: 1 | 2 | 3; haltung: Haltung; ids: string[] }

/** Das Raster Einfluss (3 oben … 1 unten) × Haltung (positiv · neutral · kritisch · noch offen) — je Zelle die Stakeholder-Kennungen. */
export function stakeholderRaster(l: readonly Pick<Stakeholder, 'id' | 'einfluss' | 'haltung'>[]): RasterZelle[] {
  const raus: RasterZelle[] = [];
  for (const einfluss of [3, 2, 1] as const) for (const haltung of HALTUNGEN) raus.push({ einfluss, haltung, ids: l.filter(s => s.einfluss === einfluss && (s.haltung ?? 'offen') === haltung).map(s => s.id) });
  return raus;
}

/** Die Antwort über der Stakeholder-Karte — wer trägt das Projekt, wo liegt ein Risiko? */
export function stakeholderLage(l: readonly Pick<Stakeholder, 'rolle' | 'einfluss' | 'haltung'>[]): Antwort {
  if (!l.length) return { ampel: 'rot', antwort: 'Noch niemand auf der Karte', unter: 'Mindestens den Entscheider eintragen — er gehört zum Onboarding.' };
  const entscheider = l.filter(s => s.rolle === 'entscheider' || s.rolle === 'sponsor');
  const kritischStark = l.filter(s => s.haltung === 'kritisch' && s.einfluss >= 2);
  if (!entscheider.length) return { ampel: 'rot', antwort: 'Kein Entscheider auf der Karte', unter: 'Wer am Ende Ja sagt, gehört auf die Karte — sonst entscheidet ihr ins Leere.' };
  if (kritischStark.length) return { ampel: 'rot', antwort: `${kritischStark.length} kritische Stimme${kritischStark.length === 1 ? '' : 'n'} mit Einfluss`, unter: 'Vor der nächsten Freigabe ein Gespräch einplanen — Bedenken früh hören, nicht erst im Steuerungskreis.' };
  if (entscheider.every(s => s.haltung === 'positiv')) return { ampel: 'gruen', antwort: 'Der Entscheider trägt das Projekt', unter: `${l.length} Person${l.length === 1 ? '' : 'en'} auf der Karte · keine kritische Stimme mit Einfluss.` };
  const offen = l.filter(s => !s.haltung).length;
  return { ampel: 'gelb', antwort: offen ? `Haltung bei ${offen} noch offen` : 'Der Entscheider ist noch nicht überzeugt', unter: 'Im nächsten Wochen-Check nachfragen und die Haltung eintragen.' };
}

export interface EntscheidungPunkt { id: string; titel: string; am: string; status: Entscheidung['status']; wer: Entscheidung['wer']; frist?: string; geteilt: boolean; ueberfaellig: boolean; x: number; fristX?: number }
export interface EntscheidungsStrahl { von: string; bis: string; heuteX: number; punkte: EntscheidungPunkt[]; offen: number; ueberfaellig: number }

/** Die Entscheidungen auf einem Zeitstrahl (ältester links): Lage 0–1 je Tag, offene mit Frist als Strecke bis zur Frist. */
export function entscheidungsStrahl(l: readonly Pick<Entscheidung, 'id' | 'titel' | 'am' | 'status' | 'wer' | 'frist' | 'geteilt'>[], heute: string): EntscheidungsStrahl {
  const tage = l.flatMap(e => [e.am.slice(0, 10), ...(e.frist ? [e.frist] : [])]);
  const von = [...tage, heute].sort()[0];
  const bis = [...tage, heute].sort().at(-1)!;
  const spanne = Math.max(1, zwischen(von, bis));
  const x = (t: string) => Math.max(0, Math.min(1, zwischen(von, t) / spanne));
  const punkte = [...l].sort((a, b) => (a.am < b.am ? -1 : a.am > b.am ? 1 : a.titel.localeCompare(b.titel, 'de'))).map(e => {
    const ueberfaellig = e.status === 'offen' && !!e.frist && e.frist < heute;
    return { id: e.id, titel: e.titel, am: e.am.slice(0, 10), status: e.status, wer: e.wer, ...(e.frist ? { frist: e.frist, fristX: x(e.frist) } : {}), geteilt: e.geteilt, ueberfaellig, x: x(e.am.slice(0, 10)) };
  });
  return { von, bis, heuteX: x(heute), punkte, offen: l.filter(e => e.status === 'offen').length, ueberfaellig: punkte.filter(p => p.ueberfaellig).length };
}

/** Die Antwort über dem Entscheidungs-Log. */
export function entscheidungsLage(s: EntscheidungsStrahl): Antwort {
  if (!s.punkte.length) return { ampel: 'gelb', antwort: 'Noch keine Entscheidung festgehalten', unter: 'Die erste Entscheidung im Kick-off festhalten — sie gehört zum Onboarding.' };
  const beimKunden = s.punkte.filter(p => p.status === 'offen' && p.wer === 'kunde');
  if (s.ueberfaellig) return { ampel: 'rot', antwort: `${s.ueberfaellig} Entscheidung${s.ueberfaellig === 1 ? '' : 'en'} über der Frist`, unter: 'Im nächsten Termin klären oder die Frist neu setzen.' };
  if (beimKunden.length) return { ampel: 'gelb', antwort: `${beimKunden.length} Entscheidung${beimKunden.length === 1 ? '' : 'en'} beim Kunden`, unter: `„${beimKunden[0].titel}“${beimKunden[0].frist ? ` — Frist ${kurz(beimKunden[0].frist)}` : ''} · steht unter „wartet auf euch“ und im Report.` };
  return { ampel: 'gruen', antwort: s.offen ? `${s.offen} offen — bei uns` : 'Alles entschieden', unter: `${s.punkte.length} Entscheidung${s.punkte.length === 1 ? '' : 'en'} im Log.` };
}

// ── Takt: Rituale als Kalender-Leiste ────────────────────────────────────────────────────────────────────────────────────────────────

const RHYTHMUS_TAGE: Partial<Record<Rhythmus, number>> = { taeglich: 1, werktags: 1, woche: 7, 'zwei-wochen': 14 };
const wochentag = (t: string) => new Date(tagNr(t) * 86_400_000).getUTCDay();
const plusMonate = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
/** Montag der Woche eines Tages. */
export const montagVon = (t: string): string => tagPlus(t, -((wochentag(t) + 6) % 7));

export interface TaktZeile {
  ritualId: string; titel: string; rhythmus: Rhythmus; dauerMin: number;
  /** Am Fall angelegt (mindestens ein Termin im Kalender)? */
  angelegt: boolean; termine: number;
  /** Der nächste echte Termin (aus dem Kalender) — fehlt, wenn keiner ab heute im Kalender steht. */
  naechster?: string;
  /** Die Tage im Fenster: echte Termine (Kalender, auch schon gelaufene dieser Woche) und daraus nach dem Rhythmus erwartete (`erwartet`), nie erfundene ohne Termin. */
  tage: { tag: string; erwartet: boolean }[];
}
/** Ein Termin mit dem Kunden, der an keinem Ritual hängt (z. B. „Cockpit-Abstimmung“) — steht im Takt als eigene Zeile (15.10., Abnahme B3). */
export interface TaktTermin { tag: string; von?: string; titel?: string }
export interface TaktLeiste { wochen: string[]; bis: string; zeilen: TaktZeile[]; weitere: TaktTermin[]; naechster: { titel: string; tag: string } | null; ohneTermin: number }

/**
 * Die Rituale des Falls als Leiste über `wochen` Wochen ab dem Montag dieser Woche. Gezeigt werden alle Rituale der Bibliothek; ein Tag steht nur da,
 * wo es einen echten Termin gibt (Kalender) bzw. ab ihm im Rhythmus weitergedacht — „erwartet“, gestrichelt. Ohne Termin: leer + „Termin anlegen“.
 * Seit 15.10. (Abnahme B3) mit `kalender` = alle Termine mit Bezug zum Mandat (`fallTermine` + Ritual-Zuordnung): Termine eines Rituals stehen in seiner
 * Zeile (auch die schon gelaufenen dieser Woche), alle übrigen als „weitere Termine“; der nächste Termin ist DIE Regel `naechsterFallTermin`.
 */
export function taktLeiste(e: {
  rituale: readonly Pick<RitualVorlage, 'id' | 'titel' | 'rhythmus' | 'dauerMin' | 'pakete'>[]; fallRituale: readonly Pick<Fall['rituale'][number], 'ritualId' | 'terminUids'>[];
  termine: Readonly<Record<string, string | null | undefined>>; heute: string; wochen?: number;
  kalender?: readonly { uid: string; tag: string; von?: string; titel?: string; ritualId?: string }[];
  /** Die Paket-Vorlage des Falls — ein Ritual mit `pakete` steht nur in diesen Paketen (oder wenn der Fall es schon nutzt; 17.10., dritte Abnahme C6). */
  vorlageId?: string;
  /** Angehängte Zusatzmodule (17.10. spät) — ein Ritual ihrer Pakete steht ebenso im Takt. */
  zusatzIds?: readonly string[];
}): TaktLeiste {
  const n = e.wochen ?? 6;
  const start = montagVon(e.heute);
  const bis = tagPlus(start, n * 7 - 1);
  const genutzt = new Map(e.fallRituale.map(r => [r.ritualId, r]));
  const imFenster = (t: string) => t >= start && t <= bis;
  const passt = (r: Pick<RitualVorlage, 'id' | 'pakete'>) => !r.pakete?.length || !e.vorlageId || r.pakete.includes(e.vorlageId) || (e.zusatzIds ?? []).some(z => r.pakete!.includes(z)) || genutzt.has(r.id) || (e.kalender ?? []).some(t => t.ritualId === r.id);
  const zeilen = e.rituale.filter(passt).map(r => {
    const g = genutzt.get(r.id);
    const ausKalender = (e.kalender ?? []).filter(t => t.ritualId === r.id);
    const naechster = ausKalender.map(t => t.tag).filter(t => t >= e.heute).sort()[0] ?? e.termine[r.id] ?? undefined;
    const echt = Array.from(new Set([...ausKalender.map(t => t.tag), ...(naechster ? [naechster] : [])])).filter(imFenster).sort();
    const tage: { tag: string; erwartet: boolean }[] = echt.map(tag => ({ tag, erwartet: false }));
    let t = echt.at(-1);
    for (let i = 0; t && r.rhythmus !== 'einmal' && i < 80; i++) {
      const schritt = RHYTHMUS_TAGE[r.rhythmus];
      t = schritt ? tagPlus(t, schritt) : r.rhythmus === 'monat' ? plusMonate(t, 1) : r.rhythmus === 'quartal' ? plusMonate(t, 3) : '9999-12-31';
      if (r.rhythmus === 'werktags') while ([0, 6].includes(wochentag(t))) t = tagPlus(t, 1);
      if (t > bis) break;
      tage.push({ tag: t, erwartet: true });
    }
    return { ritualId: r.id, titel: r.titel, rhythmus: r.rhythmus, dauerMin: r.dauerMin, angelegt: !!g?.terminUids.length || ausKalender.length > 0, termine: Math.max(g?.terminUids.length ?? 0, ausKalender.length), ...(naechster ? { naechster } : {}), tage };
  });
  const weitere = (e.kalender ?? []).filter(t => !t.ritualId && imFenster(t.tag)).map(t => ({ tag: t.tag, ...(t.von ? { von: t.von } : {}), ...(t.titel ? { titel: t.titel } : {}) }));
  // Der nächste Termin — DIE Regel (`naechsterFallTermin`) über alle Termine mit dem Kunden; ohne Kalender-Liste wie bis 14.10. aus den Ritualen.
  const nt = e.kalender ? naechsterFallTermin({ fallRituale: e.fallRituale, terminTage: e.kalender, heute: e.heute, rituale: e.rituale }) : null;
  const echte = zeilen.filter(z => z.naechster).sort((a, b) => (a.naechster! < b.naechster! ? -1 : 1));
  return {
    wochen: Array.from({ length: n }, (_, i) => tagPlus(start, i * 7)), bis, zeilen, weitere,
    naechster: nt ? { titel: nt.titel ?? 'Termin mit dem Kunden', tag: nt.tag } : !e.kalender && echte[0] ? { titel: echte[0].titel, tag: echte[0].naechster! } : null,
    ohneTermin: zeilen.filter(z => z.rhythmus !== 'einmal' && !z.naechster).length,
  };
}

/**
 * Die Antwort über dem Takt. `kickoffVermerkt` = Tag des Vermerks „Kick-off, Termin steht anderswo“ (`Fall.onboarding.kickoffAm`): ohne eigenen Termin im
 * Kalender steht dann dieser Vermerk da statt „Kein Termin im Kalender“ (18.10., Nachprüfung L1b N13) — gelb, der Wochen-Check fehlt noch.
 */
export function taktLage(t: TaktLeiste, heute: string, letzteMitschrift?: string, kickoffVermerkt?: string): Antwort {
  if (!t.zeilen.length) return { ampel: 'gelb', antwort: 'Noch keine Rituale in der Bibliothek', unter: 'Unter Fulfillment › Prozesse „Aus Muster anlegen“ — dann stehen Kick-off, Wochen-Check, Steuerungskreis und Review bereit.' };
  if (!t.naechster && kickoffVermerkt) return { ampel: 'gelb', antwort: kickoffVermerkText(kickoffVermerkt), unter: 'Im eigenen Kalender steht noch kein Termin — den Wochen-Check als ersten Termin anlegen.' };
  if (!t.naechster) return { ampel: 'rot', antwort: 'Kein Termin im Kalender', unter: 'Ohne festen Takt gibt es keine Transparenz — den Wochen-Check als ersten Termin anlegen.' };
  const in_ = zwischen(heute, t.naechster.tag);
  const mitschrift = letzteMitschrift ? ` · letzte Mitschrift ${kurz(letzteMitschrift)}` : ' · noch keine Mitschrift';
  return {
    ampel: t.ohneTermin ? 'gelb' : 'gruen',
    antwort: `Nächster Termin: ${t.naechster.titel} ${in_ <= 0 ? 'heute' : in_ === 1 ? 'morgen' : `am ${kurz(t.naechster.tag)}`}`,
    // 16.10. (Abnahme 2 · C6): endet der Satz auf ein Datum („… letzte Mitschrift 12.10.“), kommt kein zweiter Punkt dazu — `satz()`.
    unter: satz(`${t.ohneTermin ? `${anzahl(t.ohneTermin, 'Ritual', 'Rituale')} ohne Termin` : 'Alle wiederkehrenden Rituale stehen im Kalender'}${mitschrift}`),
  };
}

// ── Kunde & Reports: Report-Zeitachse, Puls-Verlauf ──────────────────────────────────────────────────────────────────────────────────

/** Der Report-Takt der Leistungstreppe (lib/crm/treppe.ts `REPORT_TAGE`) — hier nur gelesen, nicht neu gerechnet. */
export const REPORT_TAKT_TAGE = 14;
export interface ReportPunkt { tag: string; x: number; gesendet: boolean }
export interface ReportAchse { von: string; bis: string; heuteX: number; reports: ReportPunkt[]; takt: { tag: string; x: number; erfuellt: boolean }[]; naechsterFaellig: string; faelligSeit: number; letzter?: string }

/**
 * Die Report-Zeitachse ab dem Start des Falls: jeder erstellte Report als Punkt (gesendet = gefüllt), dazu die Soll-Termine im Zwei-Wochen-Takt
 * (erfüllt, wenn in den 14 Tagen davor ein Report entstand) und der nächste fällige Termin (`reportNaechsterFaellig`, lib/crm/treppe.ts — dieselbe Regel wie
 * die Treppe und der Hänger im Fall-Kopf).
 */
export function reportAchse(e: { start: string; heute: string; reports: readonly { am: string }[]; gesendetAm?: string | null; takt?: number; reportTage?: number }): ReportAchse {
  // Stellschraube (22.10.): `reportTage` = der eingestellte Abstand der Reports (lib/prozesse/stellschrauben-werte.ts) — fehlt = 14 wie die Treppe.
  const takt = e.takt ?? e.reportTage ?? REPORT_TAKT_TAGE;
  const start = e.start.slice(0, 10);
  const tage = e.reports.map(r => r.am.slice(0, 10)).sort();
  const letzter = tage.at(-1);
  // EINE Regel mit der Treppe und dem Hänger im Fall-Kopf (17.10., L2 A1): letzter + 14, ohne Report der Start + REPORT_ERSTER_NACH.
  const naechsterFaellig = (e.takt === undefined ? reportNaechsterFaellig(start, letzter, e.reportTage) : null) ?? tagPlus(letzter ?? start, takt);
  const bis = [tagPlus(e.heute, 7), naechsterFaellig].sort().at(-1)!;
  const von = [start, ...tage].sort()[0];
  const spanne = Math.max(1, zwischen(von, bis));
  const x = (t: string) => Math.max(0, Math.min(1, zwischen(von, t) / spanne));
  const soll: { tag: string; x: number; erfuellt: boolean }[] = [];
  for (let t = tagPlus(start, takt); t <= bis && soll.length < 60; t = tagPlus(t, takt)) soll.push({ tag: t, x: x(t), erfuellt: tage.some(r => r > tagPlus(t, -takt) && r <= t) });
  const gesendet = e.gesendetAm?.slice(0, 10);
  return {
    von, bis, heuteX: x(e.heute), takt: soll, naechsterFaellig, faelligSeit: Math.max(0, zwischen(naechsterFaellig, e.heute)), ...(letzter ? { letzter } : {}),
    reports: tage.map(t => ({ tag: t, x: x(t), gesendet: !!gesendet && t <= gesendet })),
  };
}

/** Die Antwort zur Report-Zeitachse. */
export function reportLage(a: ReportAchse, heute: string): Antwort {
  if (!a.letzter) return a.naechsterFaellig <= heute
    ? { ampel: 'rot', antwort: 'Noch kein Report gesendet', unter: `Der erste war am ${kurz(a.naechsterFaellig)} fällig — Report erstellen, ansehen, per Klick senden.` }
    : { ampel: 'gruen', antwort: `Erster Report am ${kurz(a.naechsterFaellig)}`, unter: 'Alle zwei Wochen: erledigt · als Nächstes · wartet auf euch · Wert-Konto.' };
  const vor = zwischen(a.letzter, heute);
  if (a.naechsterFaellig <= heute) return { ampel: a.faelligSeit > 3 ? 'rot' : 'gelb', antwort: a.faelligSeit ? `Report seit ${a.faelligSeit} Tag${a.faelligSeit === 1 ? '' : 'en'} fällig` : 'Report heute fällig', unter: `Letzter vor ${vor} Tag${vor === 1 ? '' : 'en'} · ${a.reports.length} Report${a.reports.length === 1 ? '' : 's'} seit dem Start.` };
  return { ampel: 'gruen', antwort: `Nächster Report am ${kurz(a.naechsterFaellig)}`, unter: `Letzter vor ${vor} Tag${vor === 1 ? '' : 'en'} · ${a.reports.length} Report${a.reports.length === 1 ? '' : 's'} seit dem Start.` };
}

export interface PulsReihe { punkte: { tag: string; wert: number; x: number; satz?: string }[]; letzter: { wert: number; tag: string } | null; health: number | null; healthPasst: boolean; vorschlagHealth: number | null }

/**
 * Der Kunden-Puls als Verlauf (ältester links, 0–10) und der Abgleich mit der Health des Mandats (Zufriedenheit 0–100 = Puls × 10):
 * weicht die Health vom letzten Puls ab, schlägt die Ansicht „In die Health übernehmen“ vor — übernommen wird nur per Klick.
 */
export function pulsReihe(l: readonly Pick<Puls, 'am' | 'wert' | 'satz'>[], health: number | null | undefined): PulsReihe {
  const s = [...l].sort((a, b) => (a.am < b.am ? -1 : 1));
  const von = s[0]?.am.slice(0, 10), bis = s.at(-1)?.am.slice(0, 10);
  const spanne = von && bis ? Math.max(1, zwischen(von, bis)) : 1;
  const letzter = s.at(-1);
  const h = typeof health === 'number' ? health : null;
  const vorschlag = letzter ? letzter.wert * 10 : null;
  return {
    punkte: s.map(p => ({ tag: p.am.slice(0, 10), wert: p.wert, x: s.length === 1 ? 1 : zwischen(von!, p.am.slice(0, 10)) / spanne, ...(p.satz ? { satz: p.satz } : {}) })),
    letzter: letzter ? { wert: letzter.wert, tag: letzter.am.slice(0, 10) } : null,
    health: h, healthPasst: vorschlag === null || h === vorschlag, vorschlagHealth: vorschlag,
  };
}

// ── Kreislauf: wo dieser Kunde steht, was nach dem Mandat kommt ──────────────────────────────────────────────────────────────────────

/** Die Stufen des Kreislaufs (Markttraktion › Planung) in Reihenfolge — die EINE Liste der Kennungen steht dort (`KreislaufId`). */
export const KREISLAUF_REIHE: readonly KreislaufStufeId[] = ['kanaele', 'leads', 'deals', 'followup', 'fulfillment', 'nachher', 'wiederkauf'];
/**
 * Wohin eine Stufe des Kreislaufs führt — EINE Tabelle über `WEG` (15.10., Abnahme B7: „Jede Stufe öffnet ihre Ansicht“ stimmte nicht überall): Kanäle,
 * Leads (Qualifizierung), Deals, Abschluss (Follow-up), Fulfillment (der Fall bzw. die Kunden in Lieferung), Nach der Leistung (Kreislauf der
 * Markttraktion), Wiederkauf (die Firma bzw. die Deals).
 */
export function kreislaufWeg(id: KreislaufStufeId, m?: { id: string; firmaId?: string | null }): string {
  switch (id) {
    case 'kanaele': return WEG.vertriebsplanung('kanaele');
    case 'leads': return WEG.qualifizierung();
    case 'deals': return WEG.deals();
    case 'followup': return WEG.followup();
    case 'fulfillment': return m ? WEG.fall(m.id) : WEG.fulfillment();
    case 'nachher': return m ? WEG.fall(m.id, 'reise', 'stelle-abschluss') : WEG.vertriebsplanung('kreislauf');
    case 'wiederkauf': return m?.firmaId ? WEG.firma(m.firmaId) : WEG.deals();
  }
}
export const KREISLAUF_NAME: Record<KreislaufStufeId, string> = { kanaele: 'Kanäle', leads: 'Leads', deals: 'Deals', followup: 'Abschluss', fulfillment: 'Fulfillment', nachher: 'Nach der Leistung', wiederkauf: 'Wiederkauf' };

export interface NachsorgePunkt { tag: number; art: NachsorgeArt; text: string; am: string | null; zustand: 'vorgeschlagen' | 'faellig' | 'kommt' | 'wartet' }

/**
 * Die Nachsorge eines Falls als Plan: je Tag aus den Einstellungen (Vorgabe 14 · 45 · 90 nach Mandatsende) Art, Datum und Zustand —
 * „vorgeschlagen“ (Marke im Fall: der Morgenlauf hat den Vorschlag in den Stapel gelegt), „fällig“ (Tag erreicht, noch kein Vorschlag),
 * „kommt“ (Datum in der Zukunft), „wartet“ (Mandat läuft noch — ohne Ende kein Datum). Dieselben Regeln wie `nachsorgeFaellig`.
 */
export function nachsorgePlan(e: { mandatId: string; ende: string | null; tage: readonly number[]; marken: Readonly<Record<string, string>>; heute: string }): NachsorgePunkt[] {
  const tage = [...e.tage].sort((a, b) => a - b);
  const art = (i: number): NachsorgeArt => (i === 0 ? 'checkin' : i === tage.length - 1 ? 'stufe' : 'empfehlung');
  return tage.map((t, i) => {
    const am = e.ende ? tagPlus(e.ende.slice(0, 10), t) : null;
    const zustand = e.marken[markeNachsorge(e.mandatId, t)] ? 'vorgeschlagen' as const : !am ? 'wartet' as const : am <= e.heute ? 'faellig' as const : 'kommt' as const;
    return { tag: t, art: art(i), text: NACHSORGE_TEXT[art(i)], am, zustand };
  });
}

/**
 * Wo steht dieser Kunde im Kreislauf? Er ist durch Kanäle, Leads, Deals und Abschluss gegangen; solange der Fall läuft, steht er im Fulfillment.
 * Abgeschlossen: „nach der Leistung“ — bis die Nachsorge durch ist (alle Vorschläge gelegt); dann zurück in den Kreis: „Wiederkauf“.
 */
export function kreislaufStand(fall: Pick<Fall, 'status'>, nachsorge: readonly Pick<NachsorgePunkt, 'zustand'>[]): KreislaufStufeId {
  if (fall.status !== 'abgeschlossen') return 'fulfillment';
  return nachsorge.length && nachsorge.every(p => p.zustand === 'vorgeschlagen') ? 'wiederkauf' : 'nachher';
}

/** Was nach dem letzten Schritt kommt — der eine Handgriff am Ende des Falls (oder null, solange noch Phasen offen sind). */
export type AbschlussSchritt =
  | { art: 'abschliessen'; text: string; unter: string }
  | { art: 'wirkung'; text: string; unter: string }
  | { art: 'mandat-beenden'; text: string; unter: string }
  | { art: 'nachsorge'; text: string; unter: string };

export function abschlussSchritt(e: { fall: Pick<Fall, 'status' | 'wirkung'>; allePhasenFertig: boolean; mandatEnde: string | null; nachsorge: readonly NachsorgePunkt[] }): AbschlussSchritt | null {
  const f = e.fall;
  if (f.status !== 'abgeschlossen') {
    if (!e.allePhasenFertig) return null;
    return { art: 'abschliessen', text: 'Wirkungsbericht erstellen und Fall abschließen', unter: 'Alle Phasen sind erledigt — jetzt zeigt der Bericht, was vorher → jetzt erreicht ist.' };
  }
  if (!f.wirkung) return { art: 'wirkung', text: 'Wirkungsbericht erstellen', unter: 'Der Fall ist abgeschlossen — der Bericht schließt den Kreis (Kundenstimme, Empfehlung, nächste Stufe).' };
  if (!e.mandatEnde) return { art: 'mandat-beenden', text: 'Mandat beenden — dann startet die Nachsorge', unter: 'Die Nachsorge zählt ab dem Mandatsende (Produkte & Mandate › Mandat › „Mandat beenden“ — mit Ende-Datum).' };
  const naechste = e.nachsorge.find(p => p.zustand !== 'vorgeschlagen');
  return naechste
    ? { art: 'nachsorge', text: `Nachsorge: ${naechste.text}${naechste.am ? ` am ${kurz(naechste.am)}` : ''}`, unter: 'Der Vorschlag kommt am Morgen in den Freigabe-Stapel — angelegt wird erst per Klick.' }
    : { art: 'nachsorge', text: 'Nachsorge durch — der Kunde ist zurück im Kreis', unter: 'Wiederkauf, Empfehlung und Upselling führt die Markttraktion weiter.' };
}

/** Die Antwort über dem Kreislauf-Reiter. */
export function kreislaufLage(stand: KreislaufStufeId, abschluss: AbschlussSchritt | null): Antwort {
  if (stand === 'fulfillment') return abschluss
    ? { ampel: 'gelb', antwort: 'Alle Phasen erledigt', unter: abschluss.unter }
    : { ampel: 'gruen', antwort: 'In Lieferung — der Kreis schließt sich am Ende', unter: 'Befähigung wächst mit; am Ende: Wirkungsbericht → Kundenstimme, Empfehlung, nächste Stufe → Nachsorge.' };
  if (stand === 'nachher') return { ampel: abschluss?.art === 'wirkung' || abschluss?.art === 'mandat-beenden' ? 'gelb' : 'gruen', antwort: 'Nach der Leistung', unter: abschluss?.text ?? 'Nachsorge läuft.' };
  return { ampel: 'gruen', antwort: 'Zurück im Kreis', unter: 'Der Kunde ist ein Bestandskunde — Wiederkauf und Empfehlung laufen über die Markttraktion.' };
}
