// ─── Die zwei Scores (21.10.) ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Kevin 21.10.: nur noch zwei Scores — Business-Score (= Business-Index, Gesamtsicht) und Privat-Score je Person; oben auf Heute, antippen öffnet alles.
// GET  ?sicht=privat|business|beide (Vorgabe beide; `?space=` des Kopf-Schalters schränkt zusätzlich ein — lib/zugang/sicht-bereich.ts) → Kurzform je erlaubtem Score (Index, Status, Säulen, größter Hebel, Reihe der letzten Tage)
//      ?sicht=privat&voll=1 → der ganze Privat-Score (Säulen, Kennzahlen mit den Punkten dahinter, Verlauf, Trend, Wechsel) für /os/score
// POST { schwelle: { id, gruen, rot } | { id, zuruecksetzen: true } } → eigene Schwelle einer Kennzahl des EIGENEN Privat-Scores
// Nur die Person selbst (Sitzung, im Haushalt des Inhabers; Dienstweg 403) — es gibt keinen Parameter für eine andere Person. Wer welchen Score
// bekommt, entscheidet EINE reine Stelle (lib/scores/sicht.ts): Privat nie für „nur Business“, Business nur mit Zugang zum Business-Index.

import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { sichtDerAnfrage } from '@/lib/zugang/sicht-bereich';
import { speichereSchwelle } from '@/lib/kennzahlen/speicher';
import { istScoreAnfrage, scoresAusliefern, scoresFuer, type ScoreAnfrage } from '@/lib/scores/sicht';
import { privatScoreName, privatScoreStand, scoreRechteFuer, scoresKurzFuer } from '@/lib/scores/server';
import { PRIVAT_SCORE_KENNZAHLEN, privatScoreGewichteText } from '@/lib/scores/privat-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUR_SELBST_SCORE = { ok: false, fehler: 'Die Scores zeigt MAKE OS nur der Person selbst — angemeldet, nie über den Dienstweg.' } as const;
const KEIN_SCORE = { ok: false, fehler: 'Diesen Score gibt es für dein Konto nicht.' };
const KOPF = { 'Cache-Control': 'no-store' };

export async function GET(req: Request) {
  const wer = await eigenePerson(req, false, NUR_SELBST_SCORE);
  if (wer instanceof NextResponse) return wer;
  const q = new URL(req.url).searchParams;
  const roh = q.get('sicht') ?? 'beide';
  if (!istScoreAnfrage(roh)) return NextResponse.json({ ok: false, fehler: 'sicht privat|business|beide.' }, { status: 400 });
  // `?space=` (Kopf-Schalter): nur dieser Bereich — eine andere `sicht` dazu ist ein Widerspruch (403), nie still der andere Score.
  const space = sichtDerAnfrage(req);
  if (space && roh !== 'beide' && roh !== space) return NextResponse.json(KEIN_SCORE, { status: 403 });
  const anfrage: ScoreAnfrage = space ?? roh;
  const sichten = scoresFuer(anfrage, await scoreRechteFuer(wer.person));
  if (!sichten) return NextResponse.json(KEIN_SCORE, { status: 403 });
  // Der Privat-Score trägt den eigenen Gesundheits-Index (Art. 9) — Lese-Protokoll, nur die Person selbst ist betroffen.
  if (sichten.includes('privat')) leseZugriff(req, 'gesundheit', { betroffen: wer.person });
  if (q.get('voll') === '1') {
    if (anfrage !== 'privat') return NextResponse.json({ ok: false, fehler: 'Ganz gibt es hier nur den Privat-Score — den Business-Score zeigt das Business-Cockpit.' }, { status: 400 });
    const st = await privatScoreStand(wer.person);
    return NextResponse.json({ ok: true, sicht: 'privat', gewichte: privatScoreGewichteText(), pi: st.pi, verlauf: st.verlauf, vor30: st.vor30, wechsel: st.wechsel }, { headers: KOPF });
  }
  const kurz = await scoresKurzFuer(wer.person, sichten);
  return NextResponse.json({ ok: true, ...scoresAusliefern(kurz, sichten) }, { headers: KOPF });
}

export async function POST(req: Request) {
  const wer = await eigenePerson(req, true, NUR_SELBST_SCORE);
  if (wer instanceof NextResponse) return wer;
  const sichten = scoresFuer('privat', await scoreRechteFuer(wer.person));
  if (!sichten) return NextResponse.json(KEIN_SCORE, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!b.schwelle || typeof b.schwelle !== 'object') return NextResponse.json({ ok: false, fehler: 'Schwelle fehlt.' }, { status: 400 });
  const r = await speichereSchwelle(privatScoreName(wer.person), PRIVAT_SCORE_KENNZAHLEN, b.schwelle as Record<string, unknown>);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
