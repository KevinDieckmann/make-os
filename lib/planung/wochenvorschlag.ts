// ─── Planung mit ZOE — der Wochenvorschlag als Regelwerk (rein, getestet, 31.10.) ─────────────────────────────────────────────────
// Kevin 31.10.: „Planung mit ZOE — heute fertig.“ ZOE schlägt je Person für eine Woche Fokus-Blöcke für die wichtigsten Aufgaben und Meilensteine
// vor — in FREIE Zeit, nie über Termine, Abwesenheit oder Business-frei, mit Puffer — dazu die Top 3 der Woche und den Hinweis „nicht machbar“, wenn der
// Bedarf die freie Zeit übersteigt. Übernommen wird erst per Klick (Server: ./wochenvorschlag-server.ts → `blockAnlegen`, Regel 3).
//
// Grundlage ist DIESES Regelwerk ohne Modell (deterministisch: dieselbe Eingabe → derselbe Vorschlag). Eine KI darf danach höchstens die Sätze
// umformulieren (Server, optional) — nie Zeiten, Blöcke oder Reihenfolge.
//
// Eingaben (alle vom Server gelesen und schon für die Person gefiltert):
//   · `tage` = die Verfügbarkeit der Person (K1 `verfuegbarkeitFuer`): Arbeitszeit aus der Wochenvorlage (schon ohne Business-frei), beschäftigte Termine
//     (auch Blöcke), Abwesenheiten, Feiertage, ganz abwesende Tage — ohne Titel. Fremde private Termine sind dort nur Zeit („Belegt“).
//   · `kandidaten` = die gereihten Aufgaben (Eisenhower/Top-3-Regeln, lib/heute/top3.ts) und Meilensteine (Kapazität) — nur der Person sichtbare.
//   · `machbarkeit` = Hinweise der Kapazität (nicht machbar / eng / überfällig) — nur Titel, die die Person sehen darf.
//
// Wo geplant wird: Business = in der Soll-Arbeitszeit (ohne Vorlage Mo–Fr 09–18, wie die freie-Zeit-Suche), Privat = im Privat-Fenster
// (`PRIVAT_FENSTER`, außerhalb der Arbeitszeit). Feiertage und „freie Tage“ sind im Business tabu.

import { wandAus, minutenVon, tagPlus } from '@/lib/kalender/zeit';
import { fnv } from '@/lib/kalender/bezug';
import { wochentag, ARBEITSZEIT_STANDARD } from '@/lib/kalender/verfuegbar';

export type WvBereich = 'privat' | 'business';
export const istWvBereich = (v: unknown): v is WvBereich => v === 'privat' || v === 'business';

/** Stellschrauben (Vorgaben, kein Persönliches): Länge eines Fokus-Blocks, kürzester sinnvoller Block, Puffer um Termine, Blöcke je Tag. */
export const WV = {
  FOKUS_MIN: 90,
  MIN_BLOCK_MIN: 45,
  PUFFER_MIN: 15,
  MAX_JE_TAG: 2,
  MAX_KANDIDATEN: 8,
  MAX_BLOECKE: 12,
  /** Ein Meilenstein bekommt höchstens so viele Blöcke in einer Woche. */
  MAX_JE_MEILENSTEIN: 3,
  RASTER_MIN: 15,
  /** Früheste/späteste Uhrzeit eines Blocks (auch beim Verschieben). */
  TAG_VON_MIN: 6 * 60,
  TAG_BIS_MIN: 22 * 60,
} as const;

/** Privat-Fenster (Vorgabe): werktags 18–21 Uhr, am Wochenende 10–18 Uhr — immer ohne die Arbeitszeit. */
export const PRIVAT_FENSTER: readonly { tage: number[]; von: number; bis: number }[] = [
  { tage: [1, 2, 3, 4, 5], von: 18 * 60, bis: 21 * 60 },
  { tage: [6, 7], von: 10 * 60, bis: 18 * 60 },
];

// ── Typen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Zeitraum { start: string; ende: string }
/** Ein Tag der Verfügbarkeit — die Form aus K1 (lib/kalender/verfuegbarkeit-regeln.ts `TagVerfuegbarkeit`), nur was das Regelwerk braucht. */
export interface WvTag {
  tag: string;
  feiertag?: string;
  /** „frei, aber nicht gesetzlich“ (24.12. …) — im Business wie ein Feiertag. */
  frei?: string;
  ganzAbwesend: boolean;
  arbeitszeit: Zeitraum[];
  /** Hatte die Person überhaupt eine Wochenvorlage? (sonst gilt der Standard) — für alle Tage gleich. */
  hatVorlage?: boolean;
  beschaeftigt: (Zeitraum & { art?: string; ganztags?: boolean })[];
  abwesend: (Zeitraum & { ganztags?: boolean })[];
  businessFrei?: Zeitraum[];
}

export interface WvKandidat {
  /** `a:<aufgabe>` oder `m:<meilenstein>` — fest, Grundlage der Block-Kennungen. */
  id: string;
  art: 'aufgabe' | 'meilenstein';
  titel: string;
  taskId?: string;
  /** Frist (YYYY-MM-DD). */
  frist?: string;
  /** Warum (kurz, „ · “ getrennt), z. B. „fällig Mi · kritisch“. */
  grund: string;
  /** Gewünschte Fokuszeit in der Woche (Minuten). */
  minuten: number;
}

export type WvHinweisArt = 'nicht-machbar' | 'eng' | 'ueberfaellig' | 'kein-platz' | 'woche';
export interface WvHinweis { art: WvHinweisArt; text: string }

export interface WvBlock {
  /** Feste Kennung je Kandidat und laufender Nummer. */
  id: string;
  /** Feste Termin-UID (idempotent: ein zweites Übernehmen findet den Block). */
  uid: string;
  date: string;
  startMin: number;
  dauerMin: number;
  titel: string;
  art: 'fokus';
  taskId?: string;
  kandidat: string;
  /** Ein Satz: warum dieser Block hier steht. */
  grund: string;
}

export interface Wochenvorschlag {
  v: 1;
  person: string;
  montag: string;
  bereich: WvBereich;
  erstellt: string;
  bloecke: WvBlock[];
  top3: { id: string; titel: string; grund: string }[];
  hinweise: WvHinweis[];
  /** Freie Minuten der Woche (ab jetzt), Bedarf der Kandidaten, davon eingeplant. */
  freiMin: number;
  bedarfMin: number;
  geplantMin: number;
  begruendung: string;
  /** Woher die Sätze stammen: Regelwerk oder von der KI umformuliert. */
  formuliert: 'regel' | 'ki';
  /** Fingerabdruck der Blöcke — die Freigabe nennt ihn (veraltet → 409). */
  stand: string;
}

// ── Spannen (Minuten seit 00:00 eines Tags) ───────────────────────────────────────────────────────────────────────────────────────

type Spanne = [number, number];
const vereinigen = (l: Spanne[]): Spanne[] => {
  const s = l.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const raus: Spanne[] = [];
  for (const [a, b] of s) { const z = raus[raus.length - 1]; if (z && a <= z[1]) z[1] = Math.max(z[1], b); else raus.push([a, b]); }
  return raus;
};
const abziehen = (a: Spanne[], b: Spanne[]): Spanne[] => {
  let rest = a;
  for (const [x, y] of b) {
    const neu: Spanne[] = [];
    for (const [p, q] of rest) {
      if (y <= p || x >= q) { neu.push([p, q]); continue; }
      if (x > p) neu.push([p, x]);
      if (y < q) neu.push([y, q]);
    }
    rest = neu;
  }
  return rest;
};
/** Eine Wandzeit-Spanne als Minuten dieses Tags (über Mitternacht abgeschnitten). */
const amTag = (z: Zeitraum, tag: string, puffer = 0): Spanne | null => {
  const s = z.start.slice(0, 10) < tag ? 0 : z.start.slice(0, 10) > tag ? 1440 : minutenVon(z.start);
  const e = z.ende.slice(0, 10) > tag ? 1440 : z.ende.slice(0, 10) < tag ? 0 : minutenVon(z.ende);
  const sp: Spanne = [Math.max(0, s - puffer), Math.min(1440, e + puffer)];
  return sp[1] > sp[0] ? sp : null;
};
const spannen = (l: readonly Zeitraum[], tag: string, puffer = 0) => vereinigen(l.map(z => amTag(z, tag, puffer)).filter((x): x is Spanne => !!x));
const aufRaster = (m: number) => Math.ceil(m / WV.RASTER_MIN) * WV.RASTER_MIN;

/** Wo an diesem Tag überhaupt geplant werden darf (vor dem Abzug der Termine). */
function rahmen(t: WvTag, bereich: WvBereich): Spanne[] {
  if (t.ganzAbwesend) return [];
  const wt = wochentag(t.tag);
  const arbeit = t.hatVorlage === false
    ? (t.feiertag || t.frei ? [] : vereinigen(ARBEITSZEIT_STANDARD.filter(f => f.tage.includes(wt)).map(f => [Number(f.von.slice(0, 2)) * 60 + Number(f.von.slice(3)), Number(f.bis.slice(0, 2)) * 60 + Number(f.bis.slice(3))] as Spanne)))
    : spannen(t.arbeitszeit, t.tag);
  if (bereich === 'business') return t.feiertag || t.frei ? [] : abziehen(arbeit, spannen(t.businessFrei ?? [], t.tag));
  // Privat: das Privat-Fenster ohne die Arbeitszeit (Business-frei IST Privatzeit — sie zieht hier nichts ab).
  const fenster = vereinigen(PRIVAT_FENSTER.filter(f => f.tage.includes(wt)).map(f => [f.von, f.bis] as Spanne));
  return abziehen(fenster, arbeit);
}

/** Belegt an diesem Tag: beschäftigte Termine mit Puffer, Abwesenheiten ohne (ganztägige Abwesenheit = ganzer Tag). */
function belegt(t: WvTag, puffer: number): Spanne[] {
  const l: Spanne[] = [];
  for (const b of t.beschaeftigt) {
    if (b.ganztags) { if (b.art === 'abwesend') l.push([0, 1440]); continue; }
    const s = amTag(b, t.tag, b.art === 'abwesend' ? 0 : puffer); if (s) l.push(s);
  }
  for (const a of t.abwesend) { if (a.ganztags) { l.push([0, 1440]); continue; } const s = amTag(a, t.tag); if (s) l.push(s); }
  return vereinigen(l);
}

/**
 * Freie Spannen eines Tags für den Bereich: Rahmen − Belegtes (mit Puffer) − Vergangenes (heute: ab jetzt + Puffer, im Raster) − vor 06:00/nach 22:00.
 * `jetzt` = Berliner Wandzeit „YYYY-MM-DDTHH:mm…“.
 */
export function freieSpannen(t: WvTag, bereich: WvBereich, jetzt: string, puffer: number = WV.PUFFER_MIN): Spanne[] {
  const heute = jetzt.split('T')[0]; // `jetzt` ist schon Berliner Wandzeit — der Tag davor ist der Berliner Tag
  if (t.tag < heute) return [];
  let frei = abziehen(rahmen(t, bereich), belegt(t, puffer));
  frei = abziehen(frei, [[0, WV.TAG_VON_MIN], [WV.TAG_BIS_MIN, 1440]]);
  if (t.tag === heute) frei = abziehen(frei, [[0, aufRaster(minutenVon(jetzt) + puffer)]]);
  // Auf das Raster legen: Anfang aufrunden, Ende abrunden.
  return frei.map(([a, b]) => [aufRaster(a), Math.floor(b / WV.RASTER_MIN) * WV.RASTER_MIN] as Spanne).filter(([a, b]) => b - a >= WV.RASTER_MIN);
}

// ── Kennungen ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Feste Termin-UID eines vorgeschlagenen Blocks (passt zu `UID_FEST`): je Person, Woche, Bereich, Kandidat und Nummer. */
export const wvUid = (person: string, montag: string, bereich: WvBereich, kandidat: string, n: number): string =>
  `makeos-wv-${fnv(`${person}|${montag}|${bereich}|${kandidat}|${n}`)}-${montag.replace(/-/g, '')}`;
export const WV_UID_PRAEFIX = 'makeos-wv-';

/** Fingerabdruck der Blöcke (Freigabe prüft, ob sie den gesehenen Stand übernimmt). */
export const vorschlagStand = (bloecke: readonly Pick<WvBlock, 'id' | 'date' | 'startMin' | 'dauerMin' | 'taskId'>[]): string =>
  fnv(bloecke.map(b => `${b.id}@${b.date}T${b.startMin}+${b.dauerMin}:${b.taskId ?? ''}`).join('|'));

// ── Texte ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const WT = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const tagKurzWv = (tag: string) => `${WT[wochentag(tag)]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
export const uhrWv = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const std = (min: number) => (Math.round(min / 6) / 10).toLocaleString('de-DE');
const gross = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function blockGrund(k: WvKandidat, tag: string, montag: string): string {
  const teile = [k.grund || (k.art === 'meilenstein' ? 'Meilenstein' : 'wichtige Aufgabe')];
  if (k.frist && k.frist >= montag && k.frist <= tagPlus(montag, 6)) teile.push(tag < k.frist ? `eingeplant vor der Frist (${WT[wochentag(k.frist)]})` : 'am Tag der Frist');
  else if (k.frist && k.frist < montag) teile.push('so früh wie möglich');
  return `${gross(teile.join(' — '))}.`;
}

// ── Kandidaten: Aufgaben (Top-3-Regeln) + Meilensteine (Kapazität) in EINE Reihenfolge ───────────────────────────────────────────

/** Eine Aufgabe, wie sie die Top-3-Regeln liefern (lib/heute/top3.ts `top3Kandidaten`), plus ihr Meilenstein (falls sie in dessen Liste liegt). */
export interface WvAufgabeEin { id: string; titel: string; faellig?: string; quadrant: 'q1' | 'q2' | 'q3' | 'q4'; kritisch: boolean; punkte: number; gruende: string[]; msId?: string }
/** Ein Meilenstein aus der Kapazität (nur der Person sichtbare, mit Restaufwand). */
export interface WvMeilensteinEin { id: string; titel: string; termin?: string; restStunden: number; status: string }

/** Ab so vielen Punkten zählt eine Aufgabe (wie die Top 3); in der Woche fällige zählen immer. */
export const WV_PUNKTE_AB = 10;
/** Zuschlag für eine Aufgabe, deren Frist in dieser Woche liegt. */
export const WV_WOCHE_BONUS = 12;
const Q_RANG: Record<WvAufgabeEin['quadrant'], number> = { q1: 0, q2: 1, q3: 2, q4: 3 };

/**
 * Die Kandidaten der Woche, die wichtigste zuerst: Eisenhower-Feld, dann Punkte (Frist in der Woche +12). Meilensteine mit Termin bis zwei Wochen
 * nach dieser Woche und Restaufwand kommen dazu — außer, eine ihrer Aufgaben steht schon in der Liste (die Kette Ziel → Meilenstein → Aufgabe wird
 * dann über die Aufgabe bedient). Aufgaben, die diese Woche schon einen Block haben (`schonGeplant`), fallen weg. Nichts „zur Auffüllung“.
 */
export function kandidatenBauen(a: { aufgaben: readonly WvAufgabeEin[]; meilensteine: readonly WvMeilensteinEin[]; montag: string; schonGeplant?: ReadonlySet<string> }): WvKandidat[] {
  const sonntag = tagPlus(a.montag, 6), grenze = tagPlus(a.montag, 20);
  type Zeile = WvKandidat & { q: number; p: number };
  const zeilen: Zeile[] = [];
  const msMitAufgabe = new Set<string>();
  for (const t of a.aufgaben) {
    if (a.schonGeplant?.has(t.id)) continue;
    const inWoche = !!t.faellig && t.faellig >= a.montag && t.faellig <= sonntag;
    const p = t.punkte + (inWoche ? WV_WOCHE_BONUS : 0);
    if (p < WV_PUNKTE_AB && !inWoche) continue;
    if (t.msId) msMitAufgabe.add(t.msId);
    const gruende = [...t.gruende];
    if (inWoche && !gruende.some(g => /fällig|überfällig/.test(g))) gruende.unshift(`fällig ${WT[wochentag(t.faellig!)]}`);
    zeilen.push({ id: `a:${t.id}`, art: 'aufgabe', titel: t.titel, taskId: t.id, ...(t.faellig ? { frist: t.faellig } : {}), grund: gruende.slice(0, 2).join(' · '), minuten: WV.FOKUS_MIN, q: Q_RANG[t.quadrant], p });
  }
  for (const m of a.meilensteine) {
    if (msMitAufgabe.has(m.id) || !(m.restStunden > 0) || !m.termin || m.termin > grenze || m.status === 'erledigt') continue;
    const inWoche = m.termin <= sonntag;
    const eng = m.status === 'nicht-machbar' || m.status === 'eng' || m.status === 'ueberfaellig';
    const grund = [`Meilenstein bis ${tagKurzWv(m.termin)}`, `noch ${std(m.restStunden * 60)} h`, eng ? (m.status === 'eng' ? 'Zeit wird eng' : m.status === 'ueberfaellig' ? 'überfällig' : 'nicht machbar ohne mehr Zeit') : ''].filter(Boolean);
    zeilen.push({ id: `m:${m.id}`, art: 'meilenstein', titel: m.titel, frist: m.termin, grund: grund.slice(0, 2).concat(eng ? [grund[2]] : []).join(' · '), minuten: Math.round(m.restStunden * 60), q: inWoche ? 0 : 1, p: (inWoche ? 30 : 20) + (eng ? 6 : 0) });
  }
  return zeilen
    .sort((x, y) => x.q - y.q || y.p - x.p || (x.frist ?? '9').localeCompare(y.frist ?? '9') || x.id.localeCompare(y.id))
    .map(({ q: _q, p: _p, ...k }) => k);
}

// ── Das Regelwerk ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WvEingabe {
  person: string;
  /** Montag der Woche (YYYY-MM-DD). */
  montag: string;
  bereich: WvBereich;
  tage: readonly WvTag[];
  /** In der Reihenfolge, in der sie zählen (die wichtigste zuerst). */
  kandidaten: readonly WvKandidat[];
  machbarkeit?: readonly { titel: string; status: 'nicht-machbar' | 'eng' | 'ueberfaellig'; text: string }[];
  /** Berliner Wandzeit jetzt. */
  jetzt: string;
  erstellt: string;
  /** Schon übernommene Blöcke dieser Woche (aus dem gespeicherten Vorschlag): bleiben stehen, ihre Kandidaten gelten als eingeplant. */
  uebernommen?: readonly WvBlock[];
}

/** Den Vorschlag rechnen — rein. */
export function wochenvorschlagRechnen(e: WvEingabe): Wochenvorschlag {
  const tage = Array.from({ length: 7 }, (_, i) => tagPlus(e.montag, i));
  const nachTag = new Map(e.tage.map(t => [t.tag, t]));
  const frei = new Map<string, Spanne[]>(tage.map(tag => [tag, nachTag.has(tag) ? freieSpannen(nachTag.get(tag)!, e.bereich, e.jetzt) : []]));
  const freiMin = [...frei.values()].flat().reduce((s, [a, b]) => s + (b - a), 0);
  const jeTag = new Map<string, number>(tage.map(t => [t, 0]));
  const bloecke: WvBlock[] = [];
  const hinweise: WvHinweis[] = [];

  // Übernommene Blöcke stehen schon im Kalender (also in `beschaeftigt`) — sie zählen nur für „je Tag“ und „schon eingeplant“.
  const fest = (e.uebernommen ?? []).filter(b => tage.includes(b.date));
  for (const b of fest) { bloecke.push(b); jeTag.set(b.date, (jeTag.get(b.date) ?? 0) + 1); }
  const festMin = new Map<string, number>();
  for (const b of fest) festMin.set(b.kandidat, (festMin.get(b.kandidat) ?? 0) + b.dauerMin);

  const kandidaten = e.kandidaten.slice(0, WV.MAX_KANDIDATEN);
  let bedarfMin = 0;
  const ohnePlatz: string[] = [];
  for (const k of kandidaten) {
    const wunsch = Math.max(WV.MIN_BLOCK_MIN, Math.min(k.minuten, k.art === 'meilenstein' ? WV.FOKUS_MIN * WV.MAX_JE_MEILENSTEIN : WV.FOKUS_MIN));
    bedarfMin += wunsch;
    let rest = wunsch - (festMin.get(k.id) ?? 0);
    let n = fest.filter(b => b.kandidat === k.id).length;
    const benutzt = new Set(fest.filter(b => b.kandidat === k.id).map(b => b.date));
    // Tage bis zur Frist (liegt sie in der Woche), sonst alle — die frühesten zuerst.
    const bisFrist = k.frist && k.frist >= e.montag && k.frist <= tage[6] ? tage.filter(t => t <= k.frist!) : tage;
    while (rest >= WV.MIN_BLOCK_MIN && bloecke.length < WV.MAX_BLOECKE) {
      let gesetzt = false;
      for (const tag of bisFrist) {
        if (benutzt.has(tag) || (jeTag.get(tag) ?? 0) >= WV.MAX_JE_TAG) continue;
        const l = frei.get(tag) ?? [];
        // Zuerst die früheste Lücke, in die der ganze Block passt; sonst die längste, die wenigstens den kürzesten Block trägt.
        const ziel = Math.min(WV.FOKUS_MIN, rest);
        let i = l.findIndex(([a, b]) => b - a >= ziel);
        if (i < 0) i = l.reduce((best, [a, b], n) => (b - a >= WV.MIN_BLOCK_MIN && (best < 0 || b - a > l[best][1] - l[best][0]) ? n : best), -1);
        if (i < 0) continue;
        const [a, b] = l[i];
        const dauer = Math.floor(Math.min(WV.FOKUS_MIN, rest, b - a) / WV.RASTER_MIN) * WV.RASTER_MIN;
        if (dauer < WV.MIN_BLOCK_MIN) continue;
        n++;
        bloecke.push({
          id: `${k.id}#${n}`, uid: wvUid(e.person, e.montag, e.bereich, k.id, n), date: tag, startMin: a, dauerMin: dauer,
          titel: k.titel.slice(0, 120) || 'Fokus', art: 'fokus', ...(k.taskId ? { taskId: k.taskId } : {}), kandidat: k.id, grund: blockGrund(k, tag, e.montag),
        });
        // Den Block samt Puffer aus der freien Zeit nehmen.
        frei.set(tag, abziehen(l, [[a, a + dauer + WV.PUFFER_MIN]]).filter(([x, y]) => y - x >= WV.RASTER_MIN));
        jeTag.set(tag, (jeTag.get(tag) ?? 0) + 1);
        benutzt.add(tag);
        rest -= dauer;
        gesetzt = true;
        break;
      }
      if (!gesetzt) break;
    }
    if (rest >= WV.MIN_BLOCK_MIN && rest === wunsch - (festMin.get(k.id) ?? 0)) ohnePlatz.push(k.titel);
  }
  bloecke.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  const geplantMin = bloecke.reduce((s, b) => s + b.dauerMin, 0);

  // Hinweise: zuerst die Woche selbst (Bedarf > frei), dann was keinen Platz fand, dann die Kapazität.
  const offenMin = bedarfMin - [...festMin.values()].reduce((s, m) => s + m, 0);
  if (kandidaten.length && offenMin > freiMin) {
    hinweise.push({ art: 'nicht-machbar', text: `Nicht machbar in dieser Woche: die wichtigsten Punkte bräuchten ${std(offenMin)} h Fokuszeit, frei ${freiMin ? `sind nur ${std(freiMin)} h` : 'ist keine Zeit'}.` });
  }
  if (ohnePlatz.length) hinweise.push({ art: 'kein-platz', text: `Kein Platz mehr diese Woche für: ${ohnePlatz.slice(0, 4).map(t => `„${t}“`).join(', ')}${ohnePlatz.length > 4 ? ` und ${ohnePlatz.length - 4} weitere` : ''}.` });
  for (const m of (e.machbarkeit ?? []).slice(0, 4)) hinweise.push({ art: m.status, text: `„${m.titel}“: ${m.text}` });
  if (!kandidaten.length) hinweise.push({ art: 'woche', text: 'Nichts Dringendes oder Wichtiges offen — ZOE schlägt keine Blöcke „zur Auffüllung“ vor.' });

  const neu = bloecke.length - fest.length;
  const begruendung = !bloecke.length
    ? (kandidaten.length ? `Für diese Woche ist keine freie Zeit mehr da (${e.bereich === 'business' ? 'Arbeitszeit' : 'Privat-Fenster'} voll mit Terminen, Abwesenheit oder Business-frei).` : 'Diese Woche gibt es nichts, wofür ZOE Zeit freihalten müsste.')
    : `${neu ? `${neu} Fokus-Block${neu === 1 ? '' : 'e'}` : 'Keine neuen Blöcke'} für die wichtigsten Punkte der Woche — in ${e.bereich === 'business' ? 'deiner freien Arbeitszeit' : 'deinem Privat-Fenster'}, um alle Termine herum, mit ${WV.PUFFER_MIN} Minuten Puffer, höchstens ${WV.MAX_JE_TAG} am Tag. Frei: ${std(freiMin)} h · eingeplant: ${std(geplantMin)} h.`;

  return {
    v: 1, person: e.person, montag: e.montag, bereich: e.bereich, erstellt: e.erstellt, bloecke,
    top3: kandidaten.slice(0, 3).map(k => ({ id: k.id, titel: k.titel, grund: k.grund })),
    hinweise, freiMin, bedarfMin, geplantMin, begruendung, formuliert: 'regel', stand: vorschlagStand(bloecke),
  };
}

// ── Freigabe: Auswahl und Verschieben prüfen ────────────────────────────────────────────────────────────────────────────────────

export interface WvVerschoben { id: string; date: string; startMin: number; dauerMin?: number }

/**
 * Die zu übernehmenden Blöcke: `ids` (fehlt = alle), `verschoben` ändert Tag/Beginn/Dauer — nur innerhalb der Woche, im Raster, 06–22 Uhr,
 * 15 Minuten bis 4 Stunden. Unbekannte Kennungen oder ungültige Zeiten → Fehler (nichts übernommen).
 */
export function bloeckeWaehlen(v: Pick<Wochenvorschlag, 'bloecke' | 'montag'>, ids?: unknown, verschoben?: unknown): { ok: true; bloecke: WvBlock[] } | { ok: false; fehler: string } {
  const nachId = new Map(v.bloecke.map(b => [b.id, b]));
  let gewaehlt = v.bloecke;
  if (ids !== undefined) {
    if (!Array.isArray(ids) || ids.length > 60 || ids.some(x => typeof x !== 'string' || !nachId.has(x))) return { ok: false, fehler: 'Unbekannter Block in der Auswahl — Vorschlag neu laden. Nichts übernommen.' };
    const set = new Set(ids as string[]);
    gewaehlt = v.bloecke.filter(b => set.has(b.id));
  }
  if (verschoben === undefined) return { ok: true, bloecke: gewaehlt };
  if (!Array.isArray(verschoben) || verschoben.length > 60) return { ok: false, fehler: 'Verschieben: ungültige Liste. Nichts übernommen.' };
  const tage = new Set(Array.from({ length: 7 }, (_, i) => tagPlus(v.montag, i)));
  const neu = new Map<string, WvVerschoben>();
  for (const x of verschoben as WvVerschoben[]) {
    if (!x || typeof x.id !== 'string' || !nachId.has(x.id)) return { ok: false, fehler: 'Verschieben: unbekannter Block. Nichts übernommen.' };
    const dauer = x.dauerMin ?? nachId.get(x.id)!.dauerMin;
    if (typeof x.date !== 'string' || !tage.has(x.date) || !Number.isInteger(x.startMin) || x.startMin % WV.RASTER_MIN || !Number.isInteger(dauer) || dauer % WV.RASTER_MIN
      || dauer < 15 || dauer > 240 || x.startMin < WV.TAG_VON_MIN || x.startMin + dauer > WV.TAG_BIS_MIN) {
      return { ok: false, fehler: 'Verschieben: nur innerhalb dieser Woche, im 15-Minuten-Raster, zwischen 06:00 und 22:00. Nichts übernommen.' };
    }
    neu.set(x.id, { id: x.id, date: x.date, startMin: x.startMin, dauerMin: dauer });
  }
  return { ok: true, bloecke: gewaehlt.map(b => { const n = neu.get(b.id); return n ? { ...b, date: n.date, startMin: n.startMin, dauerMin: n.dauerMin! } : b; }) };
}

/**
 * Ist ein (ggf. verschobener) Block noch frei? Gegen die frische Verfügbarkeit: nie über beschäftigte Termine oder Abwesenheit; im Business nie in
 * Business-frei, an Feiertagen oder freien Tagen. Außerhalb der Arbeitszeit darf man von Hand verschieben (die eigene Entscheidung). Ohne Puffer
 * (den Puffer legt nur der Vorschlag selbst an).
 */
export function blockFrei(t: WvTag | undefined, bereich: WvBereich, b: Pick<WvBlock, 'date' | 'startMin' | 'dauerMin'>): boolean {
  if (!t || t.ganzAbwesend) return false;
  const s: Spanne = [b.startMin, b.startMin + b.dauerMin];
  const ueber = (l: Spanne[]) => l.some(([x, y]) => s[0] < y && x < s[1]);
  if (ueber(belegt(t, 0))) return false;
  if (bereich === 'business' && (t.feiertag || t.frei || ueber(spannen(t.businessFrei ?? [], t.tag)))) return false;
  return true;
}

/** Wandzeit-Anfang/-Ende eines Blocks (für die Kollisionsprüfung gegen Termine). */
export const blockZeit = (b: Pick<WvBlock, 'date' | 'startMin' | 'dauerMin'>) => ({ start: wandAus(b.date, b.startMin), ende: wandAus(b.date, b.startMin + b.dauerMin) });
