// ─── Schlaf-Hilfe je Person (09.10.2026) — die Regeln, rein und getestet ────────────────────────────────────────────────
// Wunsch (Sport-Fragebogen, 09.10.): beim Schlaf aktiv helfen, morgens den Schlaf zuerst zeigen, und eine Ziel-Aufstehzeit, zu der
// die Aufstehzeit SCHRITTWEISE wandert (z. B. 15 Min. alle 3 Tage), damit der Rhythmus nicht kippt; die Abend-Erinnerung folgt der
// jeweils aktuellen Stufe.
//
// Alles hier ist Rechnung ohne Speicher (Server UND Browser — darum ohne Import aus lib/whoop oder lib/vitals; die Nächte baut
// lib/gesundheit/schlaf-naechte.ts). Keine Konstante einer Person: Aufstehzeit, Ziel, Schrittweite,
// Schlafziel und Erinnerung sind Einstellungen JE PERSON (lib/gesundheit/alltag.ts). Die Werte kommen aus den EIGENEN
// Vitalwerten (`vitals--<person>`: Schlaf, WHOOP-Schlafbedarf, Wachzeit im Bett, WHOOP-Konsistenz) und — falls WHOOP verbunden
// ist — aus dem eigenen Spiegel (`whoop-stand--<person>`: Einschlaf-/Aufwachzeit, Schlafbedarf ohne den Schuld-Anteil).
//
// Die Regeln (eigene, offen gelegt — Orientierung, keine ärztliche Beratung):
//   Stufe        Start = „Aufstehzeit heute“ am Tag `ab`; alle `schrittTage` Tage `schrittMin` Minuten Richtung Ziel, nie darüber hinaus.
//   Schuld       Σ max(0, Bedarf − geschlafen) über die letzten 7 Nächte (Bedarf = WHOOP-Schlafbedarf der Nacht, sonst eigenes Ziel).
//   Ziel heute   Grundbedarf (letzter WHOOP-Bedarf OHNE seinen Schuld-Anteil, sonst eigenes Schlafziel) + Ausgleich der Schuld:
//                Schuld ÷ 4 Nächte, höchstens 1 h je Nacht, auf Viertelstunden gerundet. Liegt nur der GESAMTE WHOOP-Bedarf vor
//                (Schuld schon drin), kommt kein Ausgleich dazu — nie doppelt.
//   Schlafenszeit  Aufstehzeit der Stufe − Ziel − Einschlaf-Puffer (Ø „wach im Bett“ der 7 Nächte, 5–45 Min., sonst 15),
//                abgerundet auf 5 Minuten. Erinnerung = Schlafenszeit − Vorlauf.
//   Konsistenz   Streuung (Standardabweichung) der Einschlaf- und Aufwachzeiten der letzten 7 Nächte (ab 3 Nächten):
//                ≤ 30 Min. gleichmäßig, ≤ 60 schwankt, sonst unruhig. Dazu WHOOPs eigene Konsistenz in %, wenn vorhanden.
// WHOOP-Felder: research/whoop/FAKTEN_WHOOP.md › 5/5a (`sleep_needed`, `stage_summary`, `start`/`end`, `timezone_offset`).

import { tagePlus } from '@/lib/zeit';

/** Tage, über die die Schlafschuld zählt. */
export const SCHULD_TAGE = 7;
/** Über so viele Nächte wird eine Schuld abgebaut … */
export const AUSGLEICH_NAECHTE = 4;
/** … und höchstens so viel je Nacht (Stunden). */
export const AUSGLEICH_MAX_H = 1;
/** Einschlaf-Puffer ohne eigene Werte (Minuten) und seine Grenzen. */
export const PUFFER_VORGABE_MIN = 15;
export const PUFFER_MIN = 5;
export const PUFFER_MAX = 45;
/** Konsistenz: erst ab so vielen Nächten, Schwellen der Streuung (Minuten). */
export const KONSISTENZ_MIN_NAECHTE = 3;
export const STREUUNG_GUT = 30;
export const STREUUNG_OK = 60;
/** Ein WHOOP-Bedarf gilt für „heute Nacht“, wenn er höchstens so alt ist (Tage). */
export const BEDARF_ALTER_TAGE = 3;
/** Ab dieser Schuld (Stunden) sagt der Tipp es ausdrücklich. */
export const SCHULD_TIPP_H = 2;
/** Fenster nach der Erinnerungszeit, in dem der Takt noch erinnert (Minuten) — danach wäre es keine Erinnerung mehr. */
export const ERINNERUNG_FENSTER_MIN = 90;

/** Hinweis unter jeder Karte, die rechnet. */
export const SCHLAF_HINWEIS = 'Orientierung aus deinen eigenen Werten — keine ärztliche Beratung.';

// ── Uhrzeiten ────────────────────────────────────────────────────────────────────────────────────────────────────────

const UHR = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** „HH:MM“ → Minute des Tages (0–1439), sonst null. */
export function uhrZuMin(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = UHR.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** Minute (auch negativ oder ≥ 1440) → „HH:MM“ im 24-Stunden-Kreis. */
export function minZuUhr(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const istUhr = (s: unknown): s is string => uhrZuMin(s) !== null;

/** Ganze Kalendertage von `von` bis `bis` (UTC-Mittag, zeitzonenfest). */
export function tageZwischen(von: string, bis: string): number {
  const a = Date.parse(`${von.slice(0, 10)}T12:00:00Z`), b = Date.parse(`${bis.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
}

/** Vorzeichenbehafteter kürzester Weg von `von` nach `nach` im Uhrkreis (−719 … 720 Minuten). */
export function uhrAbstand(von: number, nach: number): number {
  let d = ((nach - von) % 1440 + 1440) % 1440;
  if (d > 720) d -= 1440;
  return d;
}

// ── Stufen: die Aufstehzeit wandert schrittweise ─────────────────────────────────────────────────────────────────────

export interface StufenEinstellung {
  /** Aufstehzeit zu Beginn der Stufen („HH:MM“). */
  aufstehen?: string;
  /** Ziel-Aufstehzeit („HH:MM“). */
  aufstehenZiel?: string;
  /** Minuten je Stufe. */
  schrittMin: number;
  /** Tage je Stufe. */
  schrittTage: number;
  /** Tag, ab dem die Stufen zählen. */
  ab?: string;
}

export interface Stufe {
  /** Aufstehzeit der heutigen Stufe. */
  aufstehen: string;
  /** Ziel (falls gesetzt). */
  ziel?: string;
  /** Wie viele Stufen schon gegangen sind / insgesamt nötig. */
  schritt: number;
  schritte: number;
  /** Nächster Tag mit einer neuen Stufe (fehlt, wenn das Ziel erreicht ist). */
  naechsteAm?: string;
  /** Tag, an dem das Ziel erreicht ist. */
  fertigAm?: string;
  fertig: boolean;
  /** Richtung der nächsten Stufe: früher (−) oder später (+) in Minuten. */
  richtung: -1 | 0 | 1;
}

/** Die Aufstehzeit der heutigen Stufe (rein). Ohne Start, aber mit Ziel: gleich das Ziel. Ohne beides: null. */
export function aufstehenStufe(e: StufenEinstellung, heute: string): Stufe | null {
  const start = uhrZuMin(e.aufstehen), ziel = uhrZuMin(e.aufstehenZiel);
  if (start === null && ziel === null) return null;
  if (start === null) return { aufstehen: minZuUhr(ziel!), ziel: minZuUhr(ziel!), schritt: 0, schritte: 0, fertig: true, richtung: 0 };
  if (ziel === null || ziel === start) return { aufstehen: minZuUhr(start), ...(ziel !== null ? { ziel: minZuUhr(ziel) } : {}), schritt: 0, schritte: 0, fertig: true, richtung: 0 };
  const schrittMin = Math.max(1, Math.round(e.schrittMin));
  const schrittTage = Math.max(1, Math.round(e.schrittTage));
  const d = uhrAbstand(start, ziel);
  const schritte = Math.ceil(Math.abs(d) / schrittMin);
  const ab = e.ab && /^\d{4}-\d{2}-\d{2}$/.test(e.ab) ? e.ab : heute;
  const tage = Math.max(0, tageZwischen(ab, heute));
  const k = Math.min(schritte, Math.floor(tage / schrittTage));
  const verschoben = Math.sign(d) * Math.min(Math.abs(d), k * schrittMin);
  const fertig = k >= schritte;
  return {
    aufstehen: minZuUhr(start + verschoben), ziel: minZuUhr(ziel), schritt: k, schritte, fertig,
    ...(fertig ? {} : { naechsteAm: tagePlus(ab, (k + 1) * schrittTage) }),
    fertigAm: tagePlus(ab, schritte * schrittTage),
    richtung: (Math.sign(d) as -1 | 1),
  };
}

// ── Nächte aus den eigenen Werten ────────────────────────────────────────────────────────────────────────────────────

/** Eine Nacht, benannt nach dem Tag des Aufwachens (wie WHOOP sie in die Vitalwerte schreibt). Stunden bzw. Minute des Tages. */
export interface SchlafNacht {
  tag: string;
  /** Geschlafen (h). */
  dauer?: number;
  /** WHOOP-Schlafbedarf gesamt (h) — Basis + Schuld + Belastung + Nickerchen. */
  bedarf?: number;
  /** WHOOP-Schlafbedarf OHNE den Schuld-Anteil (h) — nur aus dem Spiegel. */
  bedarfOhneSchuld?: number;
  /** Wach im Bett (h). */
  wach?: number;
  /** Einschlafen / Aufwachen als Minute des Tages in Ortszeit. */
  einschlaf?: number;
  aufwach?: number;
  /** WHOOPs Konsistenz (%). */
  konsistenz?: number;
}

// ── Die Lage ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SchlafEingabe extends StufenEinstellung {
  /** Eigenes Schlafziel (h), wenn WHOOP keinen Bedarf liefert. */
  schlafziel?: number;
  /** Vorlauf der Erinnerung (Minuten). */
  vorlaufMin: number;
}

export type KonsistenzBewertung = 'gleichmaessig' | 'schwankt' | 'unruhig';
export interface SchlafKonsistenz {
  naechte: number;
  /** Ø Einschlafzeit / Aufwachzeit („HH:MM“) und ihre Streuung (Minuten). */
  einschlaf?: string;
  einschlafStreuung?: number;
  aufwach?: string;
  aufwachStreuung?: number;
  bewertung?: KonsistenzBewertung;
  /** WHOOPs Konsistenz der letzten Nacht (%). */
  whoop?: number;
}

export interface SchlafLage {
  /** Letzte Nacht (höchstens 2 Tage alt). */
  letzte?: { tag: string; dauer?: number; bedarf?: number; fehlt?: number };
  /** Schlafschuld der letzten 7 Nächte (h) und wie viele Nächte zählten. */
  schuld?: { stunden: number; naechte: number };
  /** Schlafziel heute Nacht (h) = Grund + Ausgleich. */
  ziel?: { stunden: number; grund: number; ausgleich: number; quelle: 'whoop' | 'eigen' };
  /** Einschlaf-Puffer (Minuten) und woher er kommt. */
  puffer: { min: number; eigen: boolean };
  stufe?: Stufe;
  /** Schlafenszeit heute („HH:MM“) und die Erinnerung davor. */
  schlafenszeit?: string;
  erinnerungUm?: string;
  konsistenz?: SchlafKonsistenz;
  /** EIN Satz — was heute hilft. */
  tipp: string;
}

const mittel = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const streuung = (l: number[]) => { const m = mittel(l); return Math.sqrt(mittel(l.map(x => (x - m) ** 2))); };
/** Abend-Skala: Zeiten vor 12 Uhr zählen als „nach Mitternacht“ (+24 h) — 23:30 und 00:30 liegen dann eine Stunde auseinander. */
const abendSkala = (m: number) => (m < 720 ? m + 1440 : m);
const viertel = (h: number) => Math.round(h * 4) / 4;
const rund = (n: number, s = 2) => Math.round(n * 10 ** s) / 10 ** s;

/** Stunden als „7:24 h“. */
export const hm = (h: number): string => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; };
const datumKurz = (tag: string) => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

export function konsistenzAus(naechte: readonly SchlafNacht[], heute: string): SchlafKonsistenz | undefined {
  const fenster = naechte.filter(n => n.tag <= heute && tageZwischen(n.tag, heute) < SCHULD_TAGE);
  const ein = fenster.map(n => n.einschlaf).filter((x): x is number => typeof x === 'number').map(abendSkala);
  const aus = fenster.map(n => n.aufwach).filter((x): x is number => typeof x === 'number');
  const whoop = fenster.find(n => n.konsistenz !== undefined)?.konsistenz;
  const naechteZahl = Math.max(ein.length, aus.length);
  if (naechteZahl < KONSISTENZ_MIN_NAECHTE && whoop === undefined) return undefined;
  const k: SchlafKonsistenz = { naechte: naechteZahl, ...(whoop !== undefined ? { whoop } : {}) };
  if (ein.length >= KONSISTENZ_MIN_NAECHTE) { k.einschlaf = minZuUhr(mittel(ein)); k.einschlafStreuung = Math.round(streuung(ein)); }
  if (aus.length >= KONSISTENZ_MIN_NAECHTE) { k.aufwach = minZuUhr(mittel(aus)); k.aufwachStreuung = Math.round(streuung(aus)); }
  const s = Math.max(k.einschlafStreuung ?? -1, k.aufwachStreuung ?? -1);
  if (s >= 0) k.bewertung = s <= STREUUNG_GUT ? 'gleichmaessig' : s <= STREUUNG_OK ? 'schwankt' : 'unruhig';
  return k;
}

/** Die Schlaf-Lage heute (rein) — siehe Kopf. `naechte` neueste zuerst oder beliebig (wird sortiert gelesen). */
export function schlafLage(naechte: readonly SchlafNacht[], e: SchlafEingabe, heute: string): SchlafLage {
  const sortiert = [...naechte].filter(n => n.tag <= heute).sort((a, b) => (a.tag < b.tag ? 1 : -1));
  const alter = (n: SchlafNacht) => tageZwischen(n.tag, heute);
  const lage: SchlafLage = { puffer: { min: PUFFER_VORGABE_MIN, eigen: false }, tipp: '' };

  const l = sortiert.find(n => n.dauer !== undefined && alter(n) <= 1);
  if (l) lage.letzte = { tag: l.tag, dauer: l.dauer, ...(l.bedarf !== undefined ? { bedarf: l.bedarf, fehlt: rund(Math.max(0, l.bedarf - (l.dauer ?? 0))) } : {}) };

  // Schuld der letzten 7 Nächte (eigenes Ziel nur, wo WHOOP keinen Bedarf kennt).
  const eigenZiel = typeof e.schlafziel === 'number' && e.schlafziel > 0 ? e.schlafziel : undefined;
  const sieben = sortiert.filter(n => alter(n) < SCHULD_TAGE && n.dauer !== undefined && (n.bedarf !== undefined || eigenZiel !== undefined));
  if (sieben.length) lage.schuld = { stunden: rund(sieben.reduce((s, n) => s + Math.max(0, (n.bedarf ?? eigenZiel!) - n.dauer!), 0), 1), naechte: sieben.length };

  // Grundbedarf: WHOOP ohne Schuld-Anteil → WHOOP gesamt (kein Ausgleich) → eigenes Ziel.
  const frisch = sortiert.filter(n => alter(n) <= BEDARF_ALTER_TAGE);
  const ohne = frisch.find(n => n.bedarfOhneSchuld !== undefined);
  const gesamt = frisch.find(n => n.bedarf !== undefined);
  let grund: { h: number; quelle: 'whoop' | 'eigen'; ausgleich: boolean } | null = null;
  if (ohne) grund = { h: ohne.bedarfOhneSchuld!, quelle: 'whoop', ausgleich: true };
  else if (gesamt) grund = { h: gesamt.bedarf!, quelle: 'whoop', ausgleich: false };
  else if (eigenZiel !== undefined) grund = { h: eigenZiel, quelle: 'eigen', ausgleich: true };
  if (grund) {
    const ausgleich = grund.ausgleich && lage.schuld ? Math.min(AUSGLEICH_MAX_H, viertel(lage.schuld.stunden / AUSGLEICH_NAECHTE)) : 0;
    lage.ziel = { stunden: rund(Math.min(12, Math.max(4, grund.h + ausgleich))), grund: rund(grund.h), ausgleich, quelle: grund.quelle };
  }

  const wach = sortiert.filter(n => alter(n) < SCHULD_TAGE && n.wach !== undefined).map(n => n.wach! * 60);
  if (wach.length) lage.puffer = { min: Math.round(Math.min(PUFFER_MAX, Math.max(PUFFER_MIN, mittel(wach)))), eigen: true };

  const stufe = aufstehenStufe(e, heute);
  if (stufe) lage.stufe = stufe;
  if (stufe && lage.ziel) {
    const roh = uhrZuMin(stufe.aufstehen)! - Math.round(lage.ziel.stunden * 60) - lage.puffer.min;
    const auf5 = Math.floor(roh / 5) * 5;
    lage.schlafenszeit = minZuUhr(auf5);
    lage.erinnerungUm = minZuUhr(auf5 - Math.max(0, Math.round(e.vorlaufMin)));
  }
  const k = konsistenzAus(sortiert, heute);
  if (k) lage.konsistenz = k;
  lage.tipp = schlafTipp(lage);
  return lage;
}

/** EIN Satz, was heute hilft (rein) — nach Vorrang: Einstellung fehlt · Bedarf fehlt · Schuld · Unruhe · Stufe · normal. */
export function schlafTipp(l: Pick<SchlafLage, 'stufe' | 'ziel' | 'schuld' | 'konsistenz' | 'schlafenszeit'>): string {
  if (!l.stufe) return 'Trag deine Aufstehzeit ein — dann rechnet die Schlaf-Hilfe deine Schlafenszeit aus.';
  if (!l.ziel || !l.schlafenszeit) return 'Für die Schlafenszeit fehlt der Schlafbedarf — WHOOP verbinden oder ein eigenes Schlafziel eintragen.';
  if (l.schuld && l.schuld.stunden >= SCHULD_TIPP_H) return `Diese Woche fehlen dir ${hm(l.schuld.stunden)} Schlaf — heute um ${l.schlafenszeit} ins Bett. Lieber jeden Abend etwas früher als am Wochenende lange ausschlafen.`;
  const s = Math.max(l.konsistenz?.einschlafStreuung ?? 0, l.konsistenz?.aufwachStreuung ?? 0);
  if (l.konsistenz?.bewertung && l.konsistenz.bewertung !== 'gleichmaessig') return `Deine Schlafzeiten schwanken um ±${s} Min. — gleiche Zeiten helfen dem Rhythmus am meisten. Heute um ${l.schlafenszeit} ins Bett.`;
  if (!l.stufe.fertig && l.stufe.naechsteAm) {
    const schritt = Math.abs(uhrAbstand(uhrZuMin(l.stufe.aufstehen)!, uhrZuMin(l.stufe.ziel!)!));
    return `Heute um ${l.schlafenszeit} ins Bett. Ab ${datumKurz(l.stufe.naechsteAm)} geht es eine Stufe ${l.stufe.richtung < 0 ? 'früher' : 'später'} — noch ${schritt} Min. bis ${l.stufe.ziel}.`;
  }
  return `Heute um ${l.schlafenszeit} ins Bett — dann reicht es für deinen Bedarf.`;
}

// ── Erinnerung ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ist die Abend-Erinnerung jetzt dran (rein)? `jetztWand` = Berliner Wandzeit „YYYY-MM-DDTHH:MM…“. Fällig, wenn die Erinnerungszeit
 * höchstens `fenster` Minuten zurückliegt (über Mitternacht hinweg). `tag` = Kalendertag, an dem die Erinnerungszeit lag — der Riegel
 * (einmal je Tag): ist er schon gesetzt, ist nichts fällig.
 */
export function erinnerungFaellig(erinnerungUm: string | undefined, jetztWand: string, riegel?: string, fenster = ERINNERUNG_FENSTER_MIN): { faellig: boolean; tag: string } {
  const heute = jetztWand.slice(0, 10);
  const rem = uhrZuMin(erinnerungUm);
  const jetzt = uhrZuMin(jetztWand.slice(11, 16));
  if (rem === null || jetzt === null) return { faellig: false, tag: heute };
  const seit = ((jetzt - rem) % 1440 + 1440) % 1440;
  const tag = jetzt >= rem ? heute : tagePlus(heute, -1);
  return { faellig: seit <= fenster && riegel !== tag, tag };
}
