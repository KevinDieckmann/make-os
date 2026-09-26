// ─── Gesundheits-Index (rein, getestet) ─────────────────────────────────────
// Kevin (25.09.): „Gesundheit wie Business und Privat — ein Index.“ Dieselbe
// Logik (lib/kennzahlen/kern): jede Kennzahl mit Schwellen, Ampel, Formel und
// Quelle, fehlende als Messlücke, hinter jeder die Punkte mit Link dorthin,
// wo man handelt (Morgen-Check, Journal, Routinen, Kalender, Ernährung).
//
//   Erholung & Schlaf   40 % — was Whoop und das Journal über die Nacht sagen
//   Bewegung & Aufbau   30 % — Routinen, Reha, Sport-Blöcke, Termine, Etappen
//   Ernährung & Körper  30 % — Essen, Plan, Haut, Streak
//
// Persönlich: je Person ihre Bestände (vitals, health-log, journal, haut,
// streak). Struktur und Tracking, keine ärztliche Beratung — die Ärzte führen.

import { berechneModell, type KennzahlDefBasis, type SaeuleDef, type Messung, type Detail, type Ampel, type Schwelle, type IndexErgebnis } from '@/lib/kennzahlen/kern';
import type { VitalsLog } from '@/lib/vitals';
import { hautTrend, streakStand, routineQuote, tageZurueck, type HautLog, type StreakLog, type RoutinenLog } from './eintraege';
import type { ErnaehrungFile } from '@/lib/make-one/ernaehrung-data';
import { TAGE } from '@/lib/make-one/ernaehrung-data';
import { WEG } from '@/lib/wege';

export type GesundheitsIndex = IndexErgebnis;

export const GESUNDHEIT_SAEULEN: SaeuleDef[] = [
  { id: 'er', label: 'Erholung & Schlaf', gewicht: 0.4, satz: 'Was Whoop und das Journal über Nacht und Stress sagen' },
  { id: 'ba', label: 'Bewegung & Aufbau', gewicht: 0.3, satz: 'Routinen, Reha, Sport-Blöcke, Termine und Etappen' },
  { id: 'ek', label: 'Ernährung & Körper', gewicht: 0.3, satz: 'Regelmäßig essen, Plan, Haut und Streak' },
];

const MORGEN = { text: 'Morgen-Check', href: WEG.gesundheit('morgen') };
const JOURNAL = { text: 'Journal schreiben', href: WEG.journal() };
const ROUTINEN = { text: 'Routinen abhaken', href: WEG.gesundheit('routinen') };

export const GESUNDHEIT_KENNZAHLEN: KennzahlDefBasis[] = [
  // ── Erholung & Schlaf
  { id: 'recovery', label: 'Recovery', saeule: 'er', gruppe: 'Whoop', gewicht: 1.5, einheit: 'prozent', richtung: 'hoch', gruen: 66, rot: 40,
    formel: 'Ø Recovery der letzten 7 Tage (mind. 3 Werte)', quelle: 'Morgen-Check / Whoop', luecke: 'Weniger als 3 Whoop-Werte in 7 Tagen', pflegen: MORGEN },
  { id: 'schlaf', label: 'Schlaf', saeule: 'er', gruppe: 'Whoop', gewicht: 1.25, einheit: 'stunden', richtung: 'hoch', gruen: 7.5, rot: 6.5,
    formel: 'Ø Schlaf der letzten 7 Tage (mind. 3 Werte)', quelle: 'Morgen-Check / Whoop', luecke: 'Weniger als 3 Schlafwerte in 7 Tagen', pflegen: MORGEN },
  { id: 'hrv', label: 'HRV gegen Basis', saeule: 'er', gruppe: 'Whoop', einheit: 'prozent', richtung: 'hoch', gruen: 100, rot: 85,
    formel: 'Ø HRV 7 Tage ÷ Ø HRV 30 Tage', quelle: 'Morgen-Check / Whoop', luecke: '30-Tage-Basis fehlt (mind. 10 Werte)', pflegen: MORGEN },
  { id: 'ruhepuls', label: 'Ruhepuls gegen Basis', saeule: 'er', gruppe: 'Whoop', einheit: 'anzahl', richtung: 'niedrig', gruen: 0, rot: 4,
    formel: 'Ø Ruhepuls 7 Tage − Ø 30 Tage (Schläge)', quelle: 'Morgen-Check / Whoop', luecke: '30-Tage-Basis fehlt (mind. 10 Werte)', pflegen: MORGEN },
  { id: 'stress', label: 'Stress (Journal)', saeule: 'er', gruppe: 'Journal', einheit: 'punkte', richtung: 'niedrig', gruen: 2.5, rot: 3.5,
    formel: 'Ø Stress 1–5 der letzten 7 Journal-Tage', quelle: 'Journal', luecke: 'Kein Journal-Eintrag mit Stress in 7 Tagen', pflegen: JOURNAL },
  { id: 'datenstand', label: 'Datenstand Whoop', saeule: 'er', gruppe: 'Whoop', einheit: 'tage', richtung: 'niedrig', gruen: 1, rot: 3,
    formel: 'Tage seit dem letzten Whoop-Wert', quelle: 'Morgen-Check / Whoop-Sync', luecke: 'Noch kein Whoop-Wert eingetragen', pflegen: { text: 'Whoop verbinden', href: WEG.verbindungen() } },
  // ── Bewegung & Aufbau
  { id: 'routinen', label: 'Routinen', saeule: 'ba', gruppe: 'Routinen', gewicht: 1.25, einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 40,
    formel: 'Tage mit allen Gesundheits-Routinen ÷ 7', quelle: 'Routinen-Häkchen', luecke: 'In 7 Tagen keine Routine abgehakt', pflegen: ROUTINEN },
  { id: 'reha', label: 'Reha & Mobilität', saeule: 'ba', gruppe: 'Routinen', einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 50,
    formel: 'Tage mit Reha-Routine ÷ 7', quelle: 'Routinen-Häkchen', luecke: 'Keine Reha-Routine angelegt oder abgehakt', pflegen: ROUTINEN },
  { id: 'bewegung', label: 'Bewegung geplant', saeule: 'ba', gruppe: 'Kalender', einheit: 'stunden', richtung: 'hoch', gruen: 3, rot: 1,
    formel: 'Ø Stunden Sport-/Reha-Blöcke je Woche (letzte 4 Wochen)', quelle: 'Wochenplan', luecke: 'In 4 Wochen kein Block im Wochenplan', pflegen: { text: 'Woche planen', href: WEG.woche() } },
  { id: 'termine', label: 'Gesundheitstermine', saeule: 'ba', gruppe: 'Kalender', einheit: 'anzahl', richtung: 'hoch', gruen: 2, rot: 0,
    formel: 'Arzt-, Physio-, Trainingstermine in den nächsten 4 Wochen', quelle: 'Kalender', luecke: 'Kalender-Stand fehlt', pflegen: { text: 'Kalender öffnen', href: WEG.woche() } },
  { id: 'energie', label: 'Energie (Journal)', saeule: 'ba', gruppe: 'Journal', einheit: 'punkte', richtung: 'hoch', gruen: 3.5, rot: 2.5,
    formel: 'Ø Energie 1–5 der letzten 7 Journal-Tage', quelle: 'Journal', luecke: 'Kein Journal-Eintrag mit Energie in 7 Tagen', pflegen: JOURNAL },
  { id: 'meilensteine', label: 'Gesundheits-Etappen', saeule: 'ba', gruppe: 'Aufbau', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 40,
    formel: 'Ø Fortschritt offener Gesundheits-Meilensteine (überfällig = 0)', quelle: 'Meilensteine', luecke: 'Keine Gesundheits-Meilensteine', pflegen: { text: 'Meilensteine pflegen', href: WEG.jahr() } },
  // ── Ernährung & Körper
  { id: 'essen', label: 'Regelmäßig gegessen', saeule: 'ek', gruppe: 'Ernährung', gewicht: 1.25, einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 50,
    formel: 'Tage mit Essens-Routine ÷ 7', quelle: 'Routinen-Häkchen', luecke: 'Keine Essens-Routine angelegt oder abgehakt', pflegen: ROUTINEN },
  { id: 'plan', label: 'Essensplan gefüllt', saeule: 'ek', gruppe: 'Ernährung', einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 40,
    formel: 'Mahlzeiten mit Eintrag ÷ 21', quelle: 'Ernährung', luecke: 'Noch kein Essensplan', pflegen: { text: 'Woche planen', href: WEG.ernaehrung() } },
  { id: 'antiinflamm', label: 'Anti-entzündlich', saeule: 'ek', gruppe: 'Ernährung', einheit: 'anzahl', richtung: 'hoch', gruen: 5, rot: 2,
    formel: 'Journal-Tage mit „Anti-entzündlich gegessen“ in 7 Tagen', quelle: 'Journal', luecke: 'Kein Journal-Eintrag in 7 Tagen', pflegen: JOURNAL },
  { id: 'haut', label: 'Haut (Juckreiz)', saeule: 'ek', gruppe: 'Körper', gewicht: 1.25, einheit: 'punkte', richtung: 'niedrig', gruen: 3, rot: 6,
    formel: 'Ø Juckreiz 0–10 der letzten 7 Tage', quelle: 'Haut-Tagebuch', luecke: 'Kein Haut-Eintrag in 7 Tagen', pflegen: { text: 'Haut eintragen', href: WEG.gesundheit('haut') } },
  { id: 'schuebe', label: 'Schub-Tage · 30 Tage', saeule: 'ek', gruppe: 'Körper', einheit: 'anzahl', richtung: 'niedrig', gruen: 0, rot: 4,
    formel: 'Tage mit Schub in 30 Tagen', quelle: 'Haut-Tagebuch', luecke: 'Kein Haut-Eintrag in 30 Tagen', pflegen: { text: 'Haut eintragen', href: WEG.gesundheit('haut') } },
  { id: 'streak', label: 'Sauber (Streak)', saeule: 'ek', gruppe: 'Körper', einheit: 'tage', richtung: 'hoch', gruen: 30, rot: 7,
    formel: 'Tage seit dem letzten Rückfall (Eintrag in den letzten 3 Tagen nötig)', quelle: 'Streak', luecke: 'Seit über 3 Tagen kein Streak-Eintrag', pflegen: { text: 'Streak eintragen', href: WEG.gesundheit('streak') } },
];

export interface GesundheitBestand {
  heute: string;
  person: string;
  vitals: VitalsLog;
  /** Aktive Gesundheits-Routinen (id, label, wann). */
  routinen: { id: string; label: string; wann?: string; kategorie?: string }[];
  log: RoutinenLog;
  journal: Record<string, { energy?: number; stress?: number; mood?: number; flags?: string[] }>;
  haut: HautLog;
  streak: StreakLog;
  /** Planer-Blöcke der letzten 4 Wochen (und der nächsten). */
  bloecke: { date: string; dauerMin: number; art: string; titel?: string }[];
  /** Termine mit Uhrzeit (Wandzeit), owner kevin|malin|beide. */
  termine: { start: string; ende?: string; title?: string; owner?: string }[];
  kalenderFrisch: boolean;
  meilensteine: { titel?: string; bereich: string; faellig?: string; fortschritt: number; erledigt: boolean }[];
  ernaehrung: ErnaehrungFile | null;
  schwellen?: Record<string, Schwelle>;
}

// ── Hilfen ──────────────────────────────────────────────────────────────────

const zahl = (n: number, s = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: s, minimumFractionDigits: 0 });
const pz = (n: number) => `${zahl(n, 0)} %`;
const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const mittel = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const grenzen = (b: GesundheitBestand, id: string) => b.schwellen?.[id] ?? (() => { const k = GESUNDHEIT_KENNZAHLEN.find(x => x.id === id)!; return { gruen: k.gruen, rot: k.rot }; })();
function ampelVon(w: number, g: Schwelle): Ampel {
  const hoch = g.gruen >= g.rot;
  return hoch ? (w >= g.gruen ? 'gruen' : w < g.rot ? 'rot' : 'gelb') : (w <= g.gruen ? 'gruen' : w > g.rot ? 'rot' : 'gelb');
}
const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const GES_TERMIN = /arzt|dr\.|physio|reha|spritze|infiltration|neurolog|orthop|dermat|hautarzt|training|sport|gym|fitness|schwimm|massage|therapie/i;
export const GES_BLOCK = /sport|train|gym|lauf|schwimm|spazier|bewegung|yoga|dehn|reha|physio/i;

/** Whoop-Werte eines Feldes über n Tage (heute zuerst), nur echte Zahlen. */
function werte(b: GesundheitBestand, feld: 'rec' | 'sleep' | 'hrv' | 'rhr', n: number): { tag: string; wert: number }[] {
  return tageZurueck(b.heute, n).map(t => ({ tag: t, wert: b.vitals[t]?.[feld] })).filter((x): x is { tag: string; wert: number } => typeof x.wert === 'number');
}
const whoopDetails = (l: { tag: string; wert: number }[], einheit: string, g: Schwelle, fuer: string, n = 3): Detail[] =>
  l.slice(0, n).map(x => ({ titel: tagKurz(x.tag), wert: `${zahl(x.wert, einheit === 'h' ? 1 : 0)} ${einheit}`.trim(), href: WEG.gesundheit('morgen', fuer), ampel: ampelVon(x.wert, g) }));

/** Journal-Werte eines Feldes über 7 Tage. */
function journal(b: GesundheitBestand, feld: 'energy' | 'stress'): { tag: string; wert: number }[] {
  return tageZurueck(b.heute, 7).map(t => ({ tag: t, wert: b.journal[t]?.[feld] })).filter((x): x is { tag: string; wert: number } => typeof x.wert === 'number');
}
const routine = (b: GesundheitBestand, muster: RegExp) => b.routinen.find(r => muster.test(r.id) || muster.test(r.label));

function quoteDetails(b: GesundheitBestand, ids: string[], fuer: string): Detail[] {
  return tageZurueck(b.heute, 7).slice(0, 3).map(t => {
    const drin = ids.filter(id => (b.log[t] ?? []).includes(id)).length;
    return { titel: tagKurz(t), wert: `${drin}/${ids.length}`, unter: drin === ids.length ? 'alle abgehakt' : drin ? 'teilweise' : 'nichts abgehakt', href: WEG.gesundheit('routinen', fuer), ampel: drin === ids.length ? 'gruen' as Ampel : drin ? 'gelb' as Ampel : 'rot' as Ampel };
  });
}

// ── Die Kennzahlen ──────────────────────────────────────────────────────────

export const GESUNDHEIT_MESSEN: Record<string, (b: GesundheitBestand) => Messung> = {
  recovery(b) {
    const l = werte(b, 'rec', 7);
    if (l.length < 3) return { luecke: `${l.length} Whoop-Wert${l.length === 1 ? '' : 'e'} in 7 Tagen — mindestens 3 nötig`, details: [{ titel: 'Morgen-Check oder Whoop-Sync', href: WEG.gesundheit('morgen', b.person) }] };
    const w = mittel(l.map(x => x.wert))!;
    return { wert: w, anzeige: pz(w), quelle: `Ø über ${l.length} Tage (${tagKurz(l[l.length - 1].tag)} – ${tagKurz(l[0].tag)})`, details: whoopDetails(l, '%', grenzen(b, 'recovery'), b.person) };
  },
  schlaf(b) {
    const l = werte(b, 'sleep', 7);
    if (l.length < 3) return { luecke: `${l.length} Schlafwert${l.length === 1 ? '' : 'e'} in 7 Tagen — mindestens 3 nötig`, details: [{ titel: 'Morgen-Check oder Whoop-Sync', href: WEG.gesundheit('morgen', b.person) }] };
    const w = mittel(l.map(x => x.wert))!;
    return { wert: w, anzeige: `${zahl(w)} h`, quelle: `Ø über ${l.length} Nächte`, details: whoopDetails(l, 'h', grenzen(b, 'schlaf'), b.person) };
  },
  hrv(b) {
    const l7 = werte(b, 'hrv', 7), l30 = werte(b, 'hrv', 30);
    if (l7.length < 3) return { luecke: `${l7.length} HRV-Wert${l7.length === 1 ? '' : 'e'} in 7 Tagen — mindestens 3 nötig` };
    if (l30.length < 10) return { luecke: `30-Tage-Basis fehlt (${l30.length} von mindestens 10 Werten)` };
    const a = mittel(l7.map(x => x.wert))!, basis = mittel(l30.map(x => x.wert))!;
    const w = (a / basis) * 100;
    return { wert: w, anzeige: pz(w), quelle: `Ø ${zahl(a, 0)} ms (7 Tage) ÷ Ø ${zahl(basis, 0)} ms (30 Tage)`, details: [{ titel: 'Ø 7 Tage', wert: `${zahl(a, 0)} ms`, href: WEG.gesundheit('morgen', b.person) }, { titel: 'Basis 30 Tage', wert: `${zahl(basis, 0)} ms`, unter: `${l30.length} Werte`, href: WEG.gesundheit('morgen', b.person) }] };
  },
  ruhepuls(b) {
    const l7 = werte(b, 'rhr', 7), l30 = werte(b, 'rhr', 30);
    if (l7.length < 3) return { luecke: `${l7.length} Ruhepuls-Wert${l7.length === 1 ? '' : 'e'} in 7 Tagen — mindestens 3 nötig` };
    if (l30.length < 10) return { luecke: `30-Tage-Basis fehlt (${l30.length} von mindestens 10 Werten)` };
    const a = mittel(l7.map(x => x.wert))!, basis = mittel(l30.map(x => x.wert))!;
    const w = a - basis;
    return { wert: w, anzeige: `${w > 0 ? '+' : ''}${zahl(w)} bpm`, quelle: `Ø ${zahl(a, 0)} bpm (7 Tage) gegen Ø ${zahl(basis, 0)} bpm (30 Tage)`, details: [{ titel: 'Ø 7 Tage', wert: `${zahl(a, 0)} bpm`, href: WEG.gesundheit('morgen', b.person) }, { titel: 'Basis 30 Tage', wert: `${zahl(basis, 0)} bpm`, unter: `${l30.length} Werte`, href: WEG.gesundheit('morgen', b.person) }] };
  },
  stress(b) {
    const l = journal(b, 'stress');
    if (!l.length) return { luecke: 'Kein Journal-Eintrag mit Stress in 7 Tagen', details: [{ titel: 'Journal schreiben', href: WEG.journal() }] };
    const w = mittel(l.map(x => x.wert))!;
    return { wert: w, anzeige: `${zahl(w)} / 5`, quelle: `Ø aus ${l.length} Einträgen — niedriger ist besser`, details: l.slice(0, 3).map(x => ({ titel: tagKurz(x.tag), wert: `${x.wert} / 5`, href: WEG.journal(), ampel: ampelVon(x.wert, grenzen(b, 'stress')) })) };
  },
  datenstand(b) {
    const tage = Object.keys(b.vitals).filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t) && t <= b.heute).sort();
    const letzter = tage.at(-1);
    if (!letzter) return { luecke: 'Noch kein Whoop-Wert eingetragen', details: [{ titel: 'Whoop verbinden', unter: 'dann füllt sich der Morgen-Check von selbst', href: WEG.verbindungen() }, { titel: 'Morgen-Check von Hand', href: WEG.gesundheit('morgen', b.person) }] };
    const w = Math.round((Date.parse(`${b.heute}T12:00:00Z`) - Date.parse(`${letzter}T12:00:00Z`)) / 86_400_000);
    return { wert: w, anzeige: w === 0 ? 'heute' : `${w} Tag${w === 1 ? '' : 'e'}`, quelle: `letzter Wert vom ${tagKurz(letzter)} · ${tage.filter(t => t >= tagPlus(b.heute, -29)).length} Werte in 30 Tagen`, details: [{ titel: 'Letzter Wert', wert: tagKurz(letzter), href: WEG.gesundheit('morgen', b.person) }, { titel: 'Whoop-Sync', unter: 'nachts automatisch, wenn verbunden', href: WEG.verbindungen() }] };
  },
  routinen(b) {
    const ids = b.routinen.map(r => r.id);
    if (!ids.length) return { luecke: 'Keine Gesundheits-Routine angelegt', details: [{ titel: 'Routinen anlegen', href: WEG.routinen() }] };
    const q = routineQuote(b.log, ids, b.heute, 7);
    if (!q.tage) return { luecke: 'In 7 Tagen keine Routine abgehakt', details: [{ titel: 'Heute abhaken', href: WEG.gesundheit('routinen', b.person) }] };
    const w = q.quote * 100;
    const je = b.routinen.map(r => ({ r, q: routineQuote(b.log, [r.id], b.heute, 7).quote })).sort((x, y) => x.q - y.q);
    return { wert: w, anzeige: pz(w), quelle: `${Math.round(q.quote * 7)} von 7 Tagen alle ${ids.length} Routinen · ${q.tage} Tage mit Häkchen`,
      details: je.slice(0, 3).map(x => ({ titel: x.r.label, wert: `${Math.round(x.q * 7)}/7`, unter: x.r.wann ? `${x.r.wann}s` : undefined, href: WEG.gesundheit('routinen', b.person), ampel: x.q >= 0.7 ? 'gruen' as Ampel : x.q >= 0.4 ? 'gelb' as Ampel : 'rot' as Ampel })) };
  },
  reha(b) {
    const r = routine(b, /reha|mobil|dehn|physio/i);
    if (!r) return { luecke: 'Keine Reha-Routine angelegt', details: [{ titel: 'Routine „Reha & Mobilität“ anlegen', href: WEG.routinen() }] };
    const q = routineQuote(b.log, [r.id], b.heute, 7);
    if (!q.tage) return { luecke: 'In 7 Tagen nichts abgehakt', details: [{ titel: 'Heute abhaken', href: WEG.gesundheit('routinen', b.person) }] };
    const w = q.quote * 100;
    return { wert: w, anzeige: pz(w), quelle: `${Math.round(q.quote * 7)} von 7 Tagen „${r.label}“`, details: quoteDetails(b, [r.id], b.person) };
  },
  bewegung(b) {
    const ab = tagPlus(b.heute, -27);
    const l = b.bloecke.filter(x => x.date >= ab && x.date <= b.heute && (x.art === 'reha' || GES_BLOCK.test(x.titel ?? '')));
    if (!b.bloecke.some(x => x.date >= ab && x.date <= b.heute)) return { luecke: 'In 4 Wochen kein Block im Wochenplan', details: [{ titel: 'Woche planen', href: WEG.woche() }] };
    const h = l.reduce((s, x) => s + x.dauerMin, 0) / 60;
    const w = h / 4;
    const wochen = [0, 1, 2, 3].map(i => ({ von: tagPlus(b.heute, -27 + 7 * i), bis: tagPlus(b.heute, -21 + 7 * i) })).reverse();
    return { wert: w, anzeige: `${zahl(w)} h/Woche`, quelle: `${l.length} Blöcke, ${zahl(h)} h in 4 Wochen`,
      details: wochen.map(x => { const hh = l.filter(y => y.date >= x.von && y.date <= x.bis).reduce((s, y) => s + y.dauerMin, 0) / 60; return { titel: `Woche ab ${tagKurz(x.von)}`, wert: `${zahl(hh)} h`, href: WEG.woche(x.von), ampel: ampelVon(hh, grenzen(b, 'bewegung')) }; }) };
  },
  termine(b) {
    if (!b.kalenderFrisch) return { luecke: 'Kalender-Stand fehlt', details: [{ titel: 'Kalender öffnen', href: WEG.woche() }] };
    const bis = tagPlus(b.heute, 28);
    const l = b.termine.filter(t => { const tag = t.start.slice(0, 10); return tag >= b.heute && tag <= bis && GES_TERMIN.test(t.title ?? '') && (!t.owner || t.owner === b.person || t.owner === 'beide' || t.owner === 'both'); }).sort((x, y) => x.start.localeCompare(y.start));
    return { wert: l.length, anzeige: String(l.length), quelle: l.length ? `nächster: ${l[0].title} am ${tagKurz(l[0].start)}` : 'kein Arzt-, Physio- oder Trainingstermin in 4 Wochen',
      details: l.length ? l.slice(0, 3).map(t => ({ titel: t.title ?? 'Termin', wert: tagKurz(t.start), href: WEG.woche(t.start.slice(0, 10)) })) : [{ titel: 'Termin anlegen', unter: 'im Kalender, z. B. Physio oder Training', href: WEG.woche() }] };
  },
  energie(b) {
    const l = journal(b, 'energy');
    if (!l.length) return { luecke: 'Kein Journal-Eintrag mit Energie in 7 Tagen', details: [{ titel: 'Journal schreiben', href: WEG.journal() }] };
    const w = mittel(l.map(x => x.wert))!;
    return { wert: w, anzeige: `${zahl(w)} / 5`, quelle: `Ø aus ${l.length} Einträgen`, details: l.slice(0, 3).map(x => ({ titel: tagKurz(x.tag), wert: `${x.wert} / 5`, href: WEG.journal(), ampel: ampelVon(x.wert, grenzen(b, 'energie')) })) };
  },
  meilensteine(b) {
    const alle = b.meilensteine.filter(m => m.bereich === 'gesundheit');
    if (!alle.length) return { luecke: 'Keine Gesundheits-Meilensteine', details: [{ titel: 'Meilenstein anlegen', href: WEG.jahr() }] };
    const offen = alle.filter(m => !m.erledigt);
    if (!offen.length) return { wert: 100, anzeige: '100 %', quelle: 'alle Gesundheits-Meilensteine erledigt', details: [{ titel: 'Nächste Etappe setzen', href: WEG.jahr(), ampel: 'gruen' }] };
    const ueber = (m: { faellig?: string }) => !!m.faellig && m.faellig < b.heute;
    const w = offen.reduce((s, m) => s + (ueber(m) ? 0 : m.fortschritt), 0) / offen.length;
    return { wert: w, anzeige: pz(w), quelle: `Ø Fortschritt ${offen.length} offener Etappen${offen.filter(ueber).length ? `, ${offen.filter(ueber).length} überfällig (zählt 0)` : ''}`,
      details: offen.slice().sort((x, y) => Number(ueber(y)) - Number(ueber(x)) || x.fortschritt - y.fortschritt).slice(0, 3).map(m => ({ titel: m.titel ?? 'Etappe', wert: `${Math.round(m.fortschritt)} %`, unter: ueber(m) ? `überfällig seit ${tagKurz(m.faellig!)}` : m.faellig ? `fällig ${tagKurz(m.faellig)}` : 'ohne Termin', href: WEG.jahr(), ampel: ueber(m) ? 'rot' as Ampel : m.fortschritt >= 70 ? 'gruen' as Ampel : m.fortschritt >= 40 ? 'gelb' as Ampel : 'rot' as Ampel })) };
  },
  essen(b) {
    const r = routine(b, /ess|mahlzeit|frühst|fruehst/i);
    if (!r) return { luecke: 'Keine Essens-Routine angelegt', details: [{ titel: 'Routine „Regelmäßig essen“ anlegen', href: WEG.routinen() }] };
    const q = routineQuote(b.log, [r.id], b.heute, 7);
    if (!q.tage) return { luecke: 'In 7 Tagen nichts abgehakt', details: [{ titel: 'Heute abhaken', href: WEG.gesundheit('routinen', b.person) }] };
    const w = q.quote * 100;
    return { wert: w, anzeige: pz(w), quelle: `${Math.round(q.quote * 7)} von 7 Tagen „${r.label}“`, details: quoteDetails(b, [r.id], b.person) };
  },
  plan(b) {
    const e = b.ernaehrung;
    if (!e?.plan) return { luecke: 'Noch kein Essensplan', details: [{ titel: 'Jarvis plant die Woche', href: WEG.ernaehrung() }] };
    const felder = TAGE.flatMap(t => [e.plan[t]?.fruehstueck, e.plan[t]?.mittag, e.plan[t]?.abend]);
    const voll = felder.filter(x => (x ?? '').trim()).length;
    const w = (voll / 21) * 100;
    const leer = TAGE.filter(t => !(e.plan[t]?.fruehstueck ?? '').trim() || !(e.plan[t]?.mittag ?? '').trim() || !(e.plan[t]?.abend ?? '').trim());
    return { wert: w, anzeige: pz(w), quelle: `${voll} von 21 Mahlzeiten geplant · ${e.einkauf.filter(x => !x.erledigt).length} offen auf der Einkaufsliste`,
      details: [{ titel: 'Essensplan', wert: `${voll}/21`, unter: leer.length ? `Lücken: ${leer.join(', ')}` : 'vollständig', href: WEG.ernaehrung(), ampel: ampelVon(w, grenzen(b, 'plan')) }, { titel: 'Einkaufsliste', wert: `${e.einkauf.filter(x => !x.erledigt).length} offen`, href: WEG.ernaehrung() }] };
  },
  antiinflamm(b) {
    const t7 = tageZurueck(b.heute, 7);
    if (!t7.some(t => b.journal[t])) return { luecke: 'Kein Journal-Eintrag in 7 Tagen', details: [{ titel: 'Journal schreiben', href: WEG.journal() }] };
    const tage = t7.filter(t => (b.journal[t]?.flags ?? []).includes('antiinflamm'));
    return { wert: tage.length, anzeige: `${tage.length} / 7`, quelle: `${tage.length} Tage mit „Anti-entzündlich gegessen“`, details: t7.slice(0, 3).map(t => ({ titel: tagKurz(t), wert: (b.journal[t]?.flags ?? []).includes('antiinflamm') ? 'ja' : b.journal[t] ? 'nein' : 'kein Eintrag', href: WEG.journal(), ampel: (b.journal[t]?.flags ?? []).includes('antiinflamm') ? 'gruen' as Ampel : b.journal[t] ? 'rot' as Ampel : 'grau' as Ampel })) };
  },
  haut(b) {
    const ht = hautTrend(b.haut, b.heute);
    if (typeof ht.juckreiz7 !== 'number') return { luecke: 'Kein Haut-Eintrag in 7 Tagen', details: [{ titel: 'Haut eintragen', href: WEG.gesundheit('haut', b.person) }] };
    const t7 = tageZurueck(b.heute, 7).filter(t => b.haut[t]);
    return { wert: ht.juckreiz7, anzeige: `${zahl(ht.juckreiz7)} / 10`, quelle: `Ø über ${t7.length} Tage${ht.richtung !== 'unbekannt' ? `, ${ht.richtung} als die Woche davor` : ''}${ht.ausloeser[0] ? ` · häufigster Auslöser: ${ht.ausloeser[0].was}` : ''}`,
      details: t7.slice(0, 3).map(t => ({ titel: tagKurz(t), wert: `${b.haut[t].juckreiz} / 10`, unter: [b.haut[t].schub ? 'Schub' : '', b.haut[t].ausloeser].filter(Boolean).join(' · ') || undefined, href: WEG.gesundheit('haut', b.person), ampel: ampelVon(b.haut[t].juckreiz, grenzen(b, 'haut')) })) };
  },
  schuebe(b) {
    const ht = hautTrend(b.haut, b.heute);
    if (!ht.tage) return { luecke: 'Kein Haut-Eintrag in 30 Tagen', details: [{ titel: 'Haut eintragen', href: WEG.gesundheit('haut', b.person) }] };
    const schub = tageZurueck(b.heute, 30).filter(t => b.haut[t]?.schub);
    return { wert: ht.schuebe30, anzeige: String(ht.schuebe30), quelle: `${ht.tage} Einträge in 30 Tagen`, details: [...schub.slice(0, 3).map((t): Detail => ({ titel: tagKurz(t), wert: `${b.haut[t].juckreiz} / 10`, unter: b.haut[t].ausloeser ?? 'ohne Auslöser', href: WEG.gesundheit('haut', b.person), ampel: 'rot' })), ...ht.ausloeser.slice(0, 1).map((a): Detail => ({ titel: `Auslöser: ${a.was}`, wert: `${a.mal}×`, href: WEG.gesundheit('haut', b.person) }))] };
  },
  streak(b) {
    const st = streakStand(b.streak, b.heute);
    if (!st.aktuell) return { luecke: st.eintraege30 ? 'Seit über 3 Tagen kein Streak-Eintrag' : 'Streak nicht geführt', details: [{ titel: 'Heute eintragen', href: WEG.gesundheit('streak', b.person) }] };
    return { wert: st.sauberTage, anzeige: `${st.sauberTage} Tage`, quelle: st.letzterRueckfall ? `seit dem ${tagKurz(st.letzterRueckfall)}${st.craving7 != null ? ` · Verlangen Ø ${zahl(st.craving7)}/10` : ''}` : 'kein Rückfall seit Beginn',
      details: [{ titel: 'Streak', wert: `${st.sauberTage} Tage`, href: WEG.gesundheit('streak', b.person), ampel: ampelVon(st.sauberTage, grenzen(b, 'streak')) }, ...(st.craving7 != null ? [{ titel: 'Verlangen · 7 Tage', wert: `${zahl(st.craving7)} / 10`, href: WEG.gesundheit('streak', b.person), ampel: st.craving7 >= 6 ? 'rot' as Ampel : st.craving7 >= 3 ? 'gelb' as Ampel : 'gruen' as Ampel }] : [])] };
  },
};

/** Tagebücher (Haut, Streak) zählen nur, wenn die Person sie führt — sonst sind sie keine Messlücke. */
export function kennzahlenFuer(b: Pick<GesundheitBestand, 'haut' | 'streak' | 'heute'>): KennzahlDefBasis[] {
  const t60 = tageZurueck(b.heute, 60);
  const fuehrtHaut = t60.some(t => b.haut[t]);
  const fuehrtStreak = t60.some(t => b.streak[t]);
  return GESUNDHEIT_KENNZAHLEN.filter(k => (k.id !== 'haut' && k.id !== 'schuebe' || fuehrtHaut) && (k.id !== 'streak' || fuehrtStreak));
}

export function berechneGesundheit(b: GesundheitBestand): GesundheitsIndex {
  return berechneModell({ saeulen: GESUNDHEIT_SAEULEN, kennzahlen: kennzahlenFuer(b), messen: GESUNDHEIT_MESSEN, bestand: b, schwellen: b.schwellen, stand: b.heute, scope: b.person });
}
