// ─── Die zwei Scores — wer bekommt welchen? (21.10.) — rein, die EINE Filterstelle ────────────────────────────────────────────────────────
// Kevin 21.10.: nur noch zwei Scores — Business-Score (= Business-Index, Gesamtsicht) und Privat-Score je Person. Trennung serverseitig, nie nur
// versteckt (Plattform-Regel):
//   · Privat-Score: NUR die Person selbst (es gibt keinen Parameter für eine andere Person — auch „Teilen“ öffnet ihn nicht, er trägt den
//     eigenen Gesundheits-Index). Nie für Konten mit Finanzrecht „nur Business“, nie ohne Haushalt.
//   · Business-Score: wer den Business-Index sehen darf (Haushalt des Inhabers, auch „nur Business“).
// Die Route (app/api/scores) fragt `scoreRechte` aus dem Konto, rechnet nur, was `scoresFuer` erlaubt, und liefert nur über `scoresAusliefern`
// aus — beides hier, getestet (tests/zwei-scores.test.ts, Wächter „Sicht X bekommt nichts aus Y“).

import { indexStatus, type IndexErgebnis, type IndexStatus } from '@/lib/kennzahlen/kern';
import type { VerlaufPunkt } from '@/lib/kennzahlen/speicher';

export type ScoreSicht = 'privat' | 'business';
export type ScoreAnfrage = ScoreSicht | 'beide';
export const SCORE_SICHTEN: readonly ScoreSicht[] = ['privat', 'business'];
export const istScoreAnfrage = (v: unknown): v is ScoreAnfrage => v === 'privat' || v === 'business' || v === 'beide';

export const SCORE_NAME: Readonly<Record<ScoreSicht, string>> = { privat: 'Privat-Score', business: 'Business-Score' };
/** Kennung der Gesundheits-Säule im Privat-Score — die KI bekommt sie nur mit Einwilligung (b) (lib/datenschutz/gesundheit-ki.ts). */
export const PRIVAT_SCORE_GESUNDHEIT = 'ge';

export interface ScoreRechte { privat: boolean; business: boolean }

/** Wer darf welchen Score sehen — nur aus dem Konto (nie aus der Adresse). Rein. */
export function scoreRechte(k: { imHaushaltDesInhabers: boolean; haushalt?: string | null; finanzRecht?: string | null } | null): ScoreRechte {
  if (!k) return { privat: false, business: false };
  return {
    privat: k.imHaushaltDesInhabers && !!k.haushalt && k.finanzRecht !== 'business',
    business: k.imHaushaltDesInhabers,
  };
}

/**
 * Welche Scores gerechnet und ausgeliefert werden: die angefragten, soweit erlaubt. `null` = die angefragte Sicht ist nicht erlaubt
 * (bzw. bei „beide“ gar keine) → 403. Rein.
 */
export function scoresFuer(anfrage: ScoreAnfrage, r: ScoreRechte): ScoreSicht[] | null {
  if (anfrage === 'beide') { const l = SCORE_SICHTEN.filter(s => r[s]); return l.length ? l : null; }
  return r[anfrage] ? [anfrage] : null;
}

/** Kurzform eines Scores für Heute, Fokus › Wirkung und ZOE — nur Zahlen und Namen, nie die Punkte hinter den Kennzahlen. */
export interface ScoreKurz {
  sicht: ScoreSicht;
  name: string;
  stand: string;
  index: number | null;
  label: string;
  abdeckung: number;
  luecken: number;
  status: IndexStatus;
  saeulen: { id: string; label: string; gewicht: number; score: number | null; zuDuenn: boolean }[];
  /** Größter Hebel (Kennzahl), mit der Kennung ihrer Säule. */
  hebel: { id: string; label: string; saeule: string; saeuleId: string } | null;
  /** Letzte Tage mit Wert (höchstens 30) — für die FadenLinie und den Trend. */
  reihe: { tag: string; wert: number }[];
}

/** Die Kurzform aus einem Index-Ergebnis und seinem Verlauf (rein). Säulen „nur mit Messung“ ohne Messung bleiben weg (sie zählen nicht). */
export function scoreKurz(sicht: ScoreSicht, pi: IndexErgebnis, verlauf: readonly Pick<VerlaufPunkt, 'tag' | 'index'>[] = [], nurMitMessung: readonly string[] = []): ScoreKurz {
  const saeule = pi.hebel ? pi.saeulen.find(s => s.label === pi.hebel!.saeule && s.kennzahlen.some(k => k.id === pi.hebel!.id)) : undefined;
  return {
    sicht, name: SCORE_NAME[sicht], stand: pi.stand, index: pi.index, label: pi.label, abdeckung: pi.abdeckung, luecken: pi.luecken,
    status: indexStatus(pi),
    saeulen: pi.saeulen.filter(s => s.gewicht > 0 && !(nurMitMessung.includes(s.id) && (s.score == null || s.zuDuenn)))
      .map(s => ({ id: s.id, label: s.label, gewicht: s.gewicht, score: s.score, zuDuenn: s.zuDuenn })),
    hebel: pi.hebel ? { ...pi.hebel, saeuleId: saeule?.id ?? '' } : null,
    reihe: verlauf.filter((v): v is { tag: string; index: number } => typeof v.index === 'number' && Number.isFinite(v.index)).slice(-30).map(v => ({ tag: v.tag, wert: v.index })),
  };
}

/** Die Antwort an den Browser: nur die erlaubten Scores — was nicht in `erlaubt` steht, fehlt ganz (nie `null` mit Inhalt). Rein. */
export function scoresAusliefern<T>(roh: Partial<Record<ScoreSicht, T>>, erlaubt: readonly ScoreSicht[]): Partial<Record<ScoreSicht, T>> {
  const aus: Partial<Record<ScoreSicht, T>> = {};
  for (const s of erlaubt) if (roh[s] !== undefined) aus[s] = roh[s];
  return aus;
}
