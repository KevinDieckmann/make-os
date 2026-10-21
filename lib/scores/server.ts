// ─── Die zwei Scores — Laden und Rechnen (Server, 21.10.) ────────────────────────────────────────────────────────────────────────────
// Privat-Score je Person (lib/scores/privat-score.ts) aus den vorhandenen Lesewegen — nichts wird neu gerechnet, was ein Index schon rechnet:
//   Gesundheits-Index der Person (nur mit Einwilligung (a), sonst nichts gelesen), Privat-Index des Haushalts, Pflege-Rhythmus, die eigenen
//   privaten Aufgaben (Sicht der Person, „nur ich“ der anderen nie).
// Business-Score = der Business-Index der Gesamtsicht, gerechnet wie GET /api/business?kompakt=1 (dieselbe Funktion `berechne`).
// Verlauf und eigene Schwellen des Privat-Scores im Bestand `privat-score--<person>` (lib/kennzahlen/speicher, ein Schnappschuss am Tag).

import { merken } from '@/lib/store/memo';
import { localDay } from '@/lib/zeit';
import { kontoFuerSpeicher } from '@/lib/zugang/konten';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { gesundheitVerarbeitungErlaubt } from '@/lib/datenschutz/gesundheit-einwilligung';
import { gesundheitStand } from '@/lib/gesundheit/speicher';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { privatStand } from '@/lib/privat/speicher';
import { ladeFamilie } from '@/lib/familie/speicher';
import { pflegeRhythmus } from '@/lib/familie/logik';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { zeitBildFuer } from '@/lib/zeitmessung/speicher';
import { ladeRoh, bestandFuer } from '@/lib/business/speicher';
import { berechne } from '@/lib/business/index';
import { SAEULEN as BUSINESS_SAEULEN } from '@/lib/business/register';
import { ladeIndexDatei, fortschreiben, indexName, type IndexVerlauf } from '@/lib/kennzahlen/speicher';
import {
  berechnePrivatScore, privatScoreSaeulen, quelleAus, PRIVAT_SCORE_BASIS,
  type PrivatScore, type PrivatScoreBestand,
} from './privat-score';
import { scoreKurz, scoreRechte, type ScoreKurz, type ScoreRechte, type ScoreSicht } from './sicht';
import { planungsLage } from './planung';
export { planungsLage } from './planung';
import type { Task } from '@/types/tasks';

/** Bestandsname je Person — immer mit Suffix (auch das Erstkonto), damit nie ein Altbestand ohne Person entsteht. */
export const privatScoreName = (person: string) => indexName(`${PRIVAT_SCORE_BASIS}--${person.replace(/[^a-z0-9-]/g, '')}`);

/** Wer darf welchen Score — aus dem Konto (eine Stelle: lib/scores/sicht.ts `scoreRechte`). */
export async function scoreRechteFuer(person: string | null | undefined): Promise<ScoreRechte> {
  if (!person) return { privat: false, business: false };
  const [konto, imHaushalt] = await Promise.all([kontoFuerSpeicher(person).catch(() => undefined), personImHaushaltDesInhabers(person).catch(() => false)]);
  return scoreRechte(konto ? { imHaushaltDesInhabers: imHaushalt, haushalt: konto.haushalt ?? null, finanzRecht: konto.finanzRecht ?? null } : null);
}

/** Alles, was der Privat-Score der Person braucht — nur ihre eigenen bzw. die ihres Haushalts. Wirft nie (Unlesbares = Lücke). */
export async function ladePrivatScoreBestand(person: string, heute = localDay()): Promise<PrivatScoreBestand> {
  const [erlaubt, zugang, datei] = await Promise.all([
    gesundheitVerarbeitungErlaubt(person).catch(() => false),
    haushaltFuer(person).catch(() => null),
    ladeIndexDatei(privatScoreName(person)).catch(() => null),
  ]);
  // Ohne Einwilligung (a) wird von der Gesundheit NICHTS gelesen (16.10., C12: auch keine Teilwerte).
  const [gi, pIdx, fam, tasks] = await Promise.all([
    erlaubt ? gesundheitStand(person, heute).then(s => s.pi).catch(() => null) : Promise.resolve(null),
    zugang ? zeitBildFuer(person, heute).catch(() => null).then(zeit => privatStand(zugang.haushalt, heute, zeit, person)).catch(() => null) : Promise.resolve(null),
    zugang ? ladeFamilie(zugang.haushalt).catch(() => null) : Promise.resolve(null),
    ladeAufgabenSicht(person).then(s => s.tasks).catch(() => [] as Task[]),
  ]);
  const rhythmus = fam ? pflegeRhythmus(fam, heute) : null;
  return {
    heute,
    gesundheit: { erlaubt, quelle: gi ? quelleAus(gi) : null },
    finanzen: { haushalt: !!zugang, quelle: pIdx ? quelleAus(pIdx.pi) : null, frisch: pIdx?.frisch ?? false },
    familie: { haushalt: !!zugang, rhythmus: rhythmus ? { score: rhythmus.score, stufe: rhythmus.stufe, hinweis: rhythmus.hinweis, bausteine: rhythmus.bausteine } : null },
    planung: planungsLage(tasks, person, heute),
    schwellen: datei?.schwellen ?? {},
  };
}

export interface PrivatScoreStand extends IndexVerlauf { pi: PrivatScore; person: string; nurMitMessung: string[] }

/** Rechnen, Schnappschuss des Tages festhalten (nur wenn etwas gemessen ist), Verlauf liefern — je Person, zwei Minuten gemerkt. */
export async function privatScoreStand(person: string, heute = localDay()): Promise<PrivatScoreStand> {
  return merken(`privat-score:${person}:${heute}`, 2 * 60_000, async () => {
    const b = await ladePrivatScoreBestand(person, heute);
    const pi = berechnePrivatScore(b);
    const d = await ladeIndexDatei(privatScoreName(person)).catch(() => ({ schwellen: {}, tage: {} }));
    const gemessen = pi.saeulen.some(s => s.score != null);
    const v = await fortschreiben(privatScoreName(person), d, pi, heute, gemessen);
    return { pi, person, nurMitMessung: privatScoreSaeulen(b).filter(s => s.nurMitMessung).map(s => s.id), ...v };
  });
}

/** Business-Score der Person (= Business-Index, Gesamtsicht, mit ihrer Fokus-Zeit) als Kurzform — wie GET /api/business?kompakt=1. */
export async function businessScoreKurz(person: string, heute = localDay()): Promise<ScoreKurz> {
  return merken(`business-score:${person}:${heute}`, 2 * 60_000, async () => {
    const zeit = await zeitBildFuer(person, heute).catch(() => null);
    const roh = await ladeRoh(heute);
    const bi = berechne(bestandFuer(roh, 'gesamt', zeit));
    const verlauf = Object.entries(roh.verlauf.tage ?? {}).filter(([t]) => t < heute).sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, je]) => ({ tag, index: je.gesamt?.index ?? null }));
    verlauf.push({ tag: heute, index: bi.index });
    return scoreKurz('business', bi, verlauf, BUSINESS_SAEULEN.filter(s => s.nurMitMessung).map(s => s.id));
  });
}

/** Privat-Score als Kurzform. */
export async function privatScoreKurz(person: string, heute = localDay()): Promise<ScoreKurz> {
  const st = await privatScoreStand(person, heute);
  return scoreKurz('privat', st.pi, st.verlauf);
}

/** Die Kurzformen der erlaubten Sichten (die Erlaubnis entscheidet der Aufrufer über `scoresFuer`). Wirft nie — ein Fehler lässt die Sicht weg. */
export async function scoresKurzFuer(person: string, sichten: readonly ScoreSicht[], heute = localDay()): Promise<Partial<Record<ScoreSicht, ScoreKurz>>> {
  const [privat, business] = await Promise.all([
    sichten.includes('privat') ? privatScoreKurz(person, heute).catch(() => undefined) : Promise.resolve(undefined),
    sichten.includes('business') ? businessScoreKurz(person, heute).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  return { ...(privat ? { privat } : {}), ...(business ? { business } : {}) };
}
