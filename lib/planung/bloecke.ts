// ─── Planen — Blöcke sind Kalender-Termine (rein, getestet, 29.09., Paket K5) ─
// Kevin 29.09.: „Ein Kalender, Planen als Modus.“ Ein Block (Fokus, Reha, Routine, Pause, eingeplante Aufgabe,
// Blockzeit) ist EIN iCloud-Termin — eine Quelle, kein zweiter Bestand daneben:
//
//   Fokus            X-MAKE-ART:fokus                       (startet auf Klick die Fokus-Zeitmessung, K1)
//   Block            X-MAKE-ART:block                       (Blockzeit ohne Unterart)
//   Reha/Routine/…   X-MAKE-ART:block + X-MAKE-BLOCK:<art>  (Unterart; geht sie in Apple verloren → „Block“)
//   eingeplante      X-MAKE-ART:block + X-MAKE-BLOCK:aufgabe + `kalender-bezug.aufgabeId` (die Aufgabe selbst bleibt,
//   Aufgabe          wie sie ist — ihre Deadline ändert sich nicht; „Aufgabe als Termin“ mit Uhrzeit ist K1/K3)
//
// Frei/beschäftigt: Blöcke sind beschäftigt (TRANSP:OPAQUE) — sie reservieren Zeit, freie Zeit/Buchung (K4) sehen sie.
// Wer einen Block nur für sich planen will, ohne dass er Zeit sperrt, stellt ihn im Termin-Fenster auf „frei“
// (TRANSP:TRANSPARENT). Einen eigenen Kalender „Planung“ gibt es bewusst NICHT: MAKE OS kann in iCloud keinen
// Kalender anlegen, und ein zweiter Kalender je Person wäre eine zweite Wahrheit für „wem gehört das“.
// Blöcke liegen im Kalender der Person (Einstellungen `kalender[wer]`).
//
// Verschieben, Dauer ändern, Löschen = Termin ändern (PATCH/DELETE /api/kalender/termin, mit ETag) — der Block IST
// der Termin (Befund 5 der Verbindungskarte ist damit weg). Der alte Bestand `wochenplan`/`wochenplan--<person>`
// wird nur noch von der Übernahme gelesen (lib/planung/wochenplan-uebernahme*.ts).

import { PLAN_ARTEN, type PlanArt, type PlanBlock } from '@/types/planer';
import { istBlockArt, type BlockArt } from '@/lib/kalender/arten';
import { wandAus, minutenVon, tagPlus } from '@/lib/kalender/zeit';

/** Was ein Leser über einen Termin wissen muss, um ihn als Block zu erkennen. */
export interface BlockQuelle {
  id: string; uid: string; titel: string; start: string; ende: string; ganztags: boolean;
  art?: string; blockArt?: string; beschaeftigt?: boolean; maskiert?: true;
  bezug?: { aufgabeId?: string }; wer?: string; von?: string;
}

/** Ein Block, wie ihn Leser brauchen (Gesundheit, Business, Risiko, Loop, Ritual, Energie, Tagesplan). */
export interface PlanBlockSicht extends PlanBlock {
  /** kalender = iCloud-Termin (uid = Termin), archiv = vergangener Block aus dem alten Wochenplan (nur lesen). */
  quelle: 'kalender' | 'archiv';
  uid?: string;
  /** Wessen Block (kevin/malin/beide). */
  wer?: string;
}

/** Plan-Art eines Termins — null, wenn er kein Block ist (ganztägig oder andere Art). */
export function planArtVon(t: Pick<BlockQuelle, 'art' | 'blockArt' | 'ganztags'>): PlanArt | null {
  if (t.ganztags) return null;
  if (t.art === 'fokus') return 'fokus';
  if (t.art !== 'block') return null;
  return istBlockArt(t.blockArt) ? t.blockArt : 'block';
}

/** Plan-Art → Art + Unterart im Termin. */
export function icsVonPlanArt(a: PlanArt): { art: 'fokus' | 'block'; blockArt?: BlockArt } {
  if (a === 'fokus') return { art: 'fokus' };
  return a === 'block' ? { art: 'block' } : { art: 'block', blockArt: a };
}

export const istPlanArt = (v: unknown): v is PlanArt => typeof v === 'string' && (PLAN_ARTEN as readonly string[]).includes(v);

/** Minuten eines Termins an seinem Starttag (über Mitternacht: bis 24:00). Nie über new Date(wandzeit). */
function dauerAmTag(start: string, ende: string): number {
  const s = minutenVon(start);
  const e = ende.slice(0, 10) > start.slice(0, 10) ? 24 * 60 : minutenVon(ende);
  return Math.max(0, e - s);
}

/** Ein Termin als Block — null, wenn er keiner ist. Maskierte (privat der anderen Person) bleiben Blöcke, aber ohne Titel. */
export function blockAusTermin(t: BlockQuelle): PlanBlockSicht | null {
  const art = planArtVon(t);
  if (!art) return null;
  const dauerMin = dauerAmTag(t.start, t.ende);
  if (dauerMin <= 0) return null;
  return {
    id: t.id, uid: t.uid, quelle: 'kalender', date: t.start.slice(0, 10), startMin: minutenVon(t.start), dauerMin,
    titel: t.titel, art, ...(t.bezug?.aufgabeId ? { taskId: t.bezug.aufgabeId } : {}), ...(t.wer ? { wer: t.wer } : {}),
  };
}

/** Alle Blöcke aus einer Terminliste. */
export const bloeckeAus = (termine: readonly BlockQuelle[]): PlanBlockSicht[] => termine.map(blockAusTermin).filter((b): b is PlanBlockSicht => !!b);

/** Wem gehört ein Block (Leser je Person): wer ihn angelegt hat, sonst der Kalender; im gemeinsamen Kalender ohne `von` beiden. */
export function gehoertZu(t: Pick<BlockQuelle, 'wer' | 'von'>, person: string): boolean {
  if (t.von) return t.von === person;
  return t.wer === person || t.wer === 'beide';
}

/** Art eines vorgeschlagenen Schutz-Blocks aus seinem Titel (Kalender-Agent): Reha/Rücken → reha, Fokus/Deep → fokus, Pause → pause, sonst block. */
export function planArtAusTitel(titel: string): PlanArt {
  const t = titel.toLowerCase();
  if (/reha|rücken|ruecken|physio|mobility/.test(t)) return 'reha';
  if (/fokus|deep|konzentr/.test(t)) return 'fokus';
  if (/pause/.test(t)) return 'pause';
  return 'block';
}

/** Was POST /api/kalender/termin für einen neuen Block bekommt (Browser und Server gleich). */
export interface BlockNeu { date: string; startMin: number; dauerMin: number; titel: string; art: PlanArt; taskId?: string }
export function blockAnfrage(b: BlockNeu, wer?: string): Record<string, unknown> {
  const { art, blockArt } = icsVonPlanArt(b.art);
  const start = Math.max(0, Math.min(24 * 60 - 15, Math.round(b.startMin / 15) * 15));
  const dauer = Math.max(15, Math.min(8 * 60, Math.round(b.dauerMin / 15) * 15 || 60));
  return {
    titel: b.titel.trim().slice(0, 120) || (art === 'fokus' ? 'Fokus' : 'Block'),
    start: wandAus(b.date, start), ende: wandAus(b.date, start + dauer), ganztags: false,
    art, ...(blockArt ? { blockArt } : {}), beschaeftigt: true,
    ...(wer ? { wer } : {}),
    ...(b.taskId ? { bezug: { aufgabeId: b.taskId } } : {}),
  };
}

// ── Stunden-Übersicht der Woche („h belegt · h Termine · h Blöcke“) ─────────

export interface StundenTermin { start: string; ende: string; ganztags: boolean; art?: string; blockArt?: string; beschaeftigt?: boolean }
export interface WochenStunden { terminMin: number; blockMin: number; gesamtMin: number; jeTag: Record<string, number> }

/**
 * Stunden einer Woche (Tage [von, bis)): Termine = mit Uhrzeit, beschäftigt, kein Arbeitsort, kein Block;
 * Blöcke = Fokus/Block. Frei gestellte Termine (TRANSP) zählen nicht — sie belegen nichts. Mehrtägige Termine
 * zählen je Tag bis Mitternacht.
 */
export function wochenStunden(termine: readonly StundenTermin[], tage: readonly string[]): WochenStunden {
  const r: WochenStunden = { terminMin: 0, blockMin: 0, gesamtMin: 0, jeTag: Object.fromEntries(tage.map(t => [t, 0])) };
  for (const t of termine) {
    if (t.ganztags || t.art === 'arbeitsort' || t.beschaeftigt === false) continue;
    const block = !!planArtVon(t);
    for (const tag of tage) {
      if (t.start.slice(0, 10) > tag || t.ende.slice(0, 10) < tag) continue;
      const von = t.start.slice(0, 10) < tag ? 0 : minutenVon(t.start);
      const bis = t.ende.slice(0, 10) > tag ? 24 * 60 : minutenVon(t.ende);
      const min = Math.max(0, bis - von);
      if (!min) continue;
      if (block) r.blockMin += min; else r.terminMin += min;
      r.jeTag[tag] = (r.jeTag[tag] ?? 0) + min;
    }
  }
  r.gesamtMin = r.terminMin + r.blockMin;
  return r;
}

/** Die Tage einer Woche ab Montag. */
export const wochenTage = (montag: string): string[] => Array.from({ length: 7 }, (_, i) => tagPlus(montag, i));

/**
 * Kollidiert ein geplanter Block [startMin, endeMin) am Tag `date` mit einem festen Termin der Person? — rein (F2 M5, für
 * ZOE `plan_block`; geprüft bei der Freigabe). Zählt:
 *   · beschäftigte Termine der Person oder gemeinsame (`wer`/`von`), auch über Tagesgrenzen (Beginn gestern, Ende heute)
 *   · ganztägige Abwesenheit der Person = der ganze Tag ist belegt; andere ganztägige Termine (Feiertag, Erinnerung) nicht
 * Zählt nicht: abgesagte/abgelehnte, freie (TRANSP), Arbeitsort. Liefert den ersten Treffer (Titel kann „Belegt“ sein).
 */
export function blockKollision(
  termine: readonly { titel: string; start: string; ende: string; ganztags: boolean; art?: string; beschaeftigt?: boolean; abgesagt?: true; wer?: string; von?: string }[],
  person: string, date: string, startMin: number, endeMin: number,
): { titel: string; s: number; e: number } | null {
  const tagesbeginn = `${date}T00:00`, folgetag = `${tagPlus(date, 1)}T00:00`;
  for (const t of termine) {
    if (t.abgesagt || t.beschaeftigt === false || t.art === 'arbeitsort') continue;
    if (!(t.wer === person || t.wer === 'beide' || t.von === person)) continue;
    if (t.ganztags) {
      // Ganztags: `ende` ist der Folgetag (exklusiv; ein Tag mit Ende = Beginn zählt wie in `verfuegbarkeit-regeln`).
      const s0 = t.start.slice(0, 10), e0 = t.ende.slice(0, 10);
      const drin = s0 <= date && (e0 > date || (e0 === date && s0 === date));
      if (t.art === 'abwesend' && (!t.von || t.von === person) && drin) return { titel: t.titel, s: 0, e: 24 * 60 };
      continue;
    }
    if (!(t.start.slice(0, 16) < folgetag && t.ende.slice(0, 16) > tagesbeginn)) continue;
    const s = t.start.slice(0, 10) < date ? 0 : minutenVon(t.start);
    const e = t.ende.slice(0, 10) > date ? 24 * 60 : Math.max(minutenVon(t.ende), s + 15);
    if (startMin < e && s < endeMin) return { titel: t.titel, s, e };
  }
  return null;
}
