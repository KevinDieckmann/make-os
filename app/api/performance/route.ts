// ─── Score-Agent (bis 21.10. „Performance-Index“ / Wachstums-Score) ──────────────────────────────────────────────────────────────────
// Seit 21.10. (Kevin: „nur noch zwei Scores“) gibt es keinen gemischten Wachstums-Score mehr. Diese Route ist nur noch der Score-Agent und der
// Tagespunkt des Tagesstarts — beide auf den ZWEI Scores (lib/scores): Privat-Score der Person und Business-Score (= Business-Index).
// POST {}        → Tagespunkt: Privat-Score der Person rechnen und festhalten (Systemlauf: der Inhaber) — der Business-Index hält seinen selbst fest
// POST {analyse} → zusätzlich: ZOE ordnet die zwei Scores ein und benennt den Hebel (je Score, nie eine gemischte Zahl)
// Das Ansehen der Scores läuft über GET /api/scores (nur die Person selbst). Die alten Verläufe `performance`/`performance--*` bleiben liegen.

import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { nurHaushalt, imHaushaltOderSystemlauf } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { gesundheitAnKi } from '@/lib/datenschutz/gesundheit-einwilligung';
import { scoreFuerKi } from '@/lib/datenschutz/gesundheit-ki';
import { laufPerson } from '@/lib/finanzen/haushalt/zugriff';
import { nordsternSatzFuer } from '@/lib/planung/nordstern-server';
import { vornameVon } from '@/lib/zoe/grundauftrag';
import { scoresFuer, type ScoreKurz } from '@/lib/scores/sicht';
import { scoreRechteFuer, scoresKurzFuer } from '@/lib/scores/server';
import { scoresSatz } from '@/lib/scores/text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { analyse?: boolean } = {};
  try { body = await jsonBegrenzt(req); } catch { /* ohne Body ist ok */ }

  // Für wen gerechnet wird = unter wem es im Agenten-Log steht (08.10.): benannte Person, im Systemlauf der Inhaber.
  const fuer = await laufPerson(req);
  const sichten = scoresFuer('beide', await scoreRechteFuer(fuer)) ?? [];
  // Rechnen hält den Tagespunkt des Privat-Scores fest (lib/scores/server.ts `privatScoreStand`, einmal am Tag).
  const scores = await scoresKurzFuer(fuer, sichten);
  if (!body.analyse) return NextResponse.json({ ok: true, scores });
  if (!hasAnthropicKey()) return NextResponse.json({ ok: true, scores, error: 'Kein Anthropic-Key.' });

  // ── Einordnung: nur interpretieren, nicht rechnen ──
  // Art. 9 (05.10.): ohne Einwilligung (b) gehen weder die Gesundheits-Säule noch die Zahl des Privat-Scores (die sie enthält) an die KI.
  const frei = await gesundheitAnKi(fuer).catch(() => false);
  const fuerKi: { privat?: ScoreKurz; business?: ScoreKurz } = {
    ...(scores.privat ? { privat: scoreFuerKi(scores.privat, frei) ?? undefined } : {}),
    ...(scores.business ? { business: scores.business } : {}),
  };
  if (!fuerKi.privat && !fuerKi.business) return NextResponse.json({ ok: true, scores, error: 'Für dieses Konto gibt es keinen Score.' });

  const system = [
    `Du bist ZOE, die zentrale Intelligenz und Chief of Staff von ${await vornameVon(fuer)}. Du ordnest die zwei Scores dieser Person ein: den Privat-Score (nur Privates) und den Business-Score (= Business-Index, nur Business).`,
    await nordsternSatzFuer(fuer),
    'Du bekommst FERTIG GERECHNETE Werte — rechne nichts nach, erfinde nichts. Mische die zwei Scores NIE zu einer Zahl und nenne Privates nie als Business-Hebel (oder umgekehrt).',
    'WICHTIG: Säulen ohne Wert sind KEINE schlechten Werte, sondern eine Messlücke. Sag, was die Person eintragen müsste, damit die Zahl echt wird.',
    'Sei nüchtern und konkret. Kein Startup-Sprech. Gesundheitsdaten sind privat.',
    'Antworte NUR als JSON: {"lage":"<2-3 Sätze: wo steht die Person je Score, wie belastbar sind die Zahlen>","hebel":{"score":"<Privat-Score|Business-Score>","saeule":"<Name>","warum":"<1-2 Sätze>","schritt":"<EINE konkrete Handlung diese Woche>"},"staerke":"<1 Satz: was trägt>","messluecke":"<1 Satz: was fehlt, damit die Scores ehrlich messen — leer wenn nichts fehlt>"}',
  ].join('\n');
  const user = scoresSatz(fuerKi, { mitSaeulen: true, ohneGesundheitHinweis: !frei });

  const kategorien = (frei && fuerKi.privat ? ['aufgaben', 'finanzen', 'gesundheit'] : ['aufgaben', 'finanzen']) as Parameters<typeof kiAus>[1];
  const r = await askJson<Record<string, unknown>>({ zweck: 'performance', system, user, maxTokens: 3000, ki: kiAus(req, kategorien, { person: fuer }) });
  if (!r.ok || !r.data) return NextResponse.json({ ok: true, scores, error: r.error ?? 'Analyse fehlgeschlagen.' });

  const kurz = (s?: ScoreKurz) => (s ? (s.index != null ? `${s.index}` : '—') : null);
  await logRun('performance', `Privat-Score ${kurz(fuerKi.privat) ?? '—'} · Business-Score ${kurz(fuerKi.business) ?? '—'}`, { privat: fuerKi.privat?.index ?? null, business: fuerKi.business?.index ?? null, ...r.data }, { person: fuer });
  // `fuerZoe` (09.10., KI-Etiketten): was ein Agentenlauf an ein Modell weitergeben darf — ohne Einwilligung (b) weder die Zahl des Privat-Scores
  // (sie enthält die Gesundheits-Säule) noch ein Gesundheits-Hebel (`scoreFuerKi`), dazu die Marke, ob Gesundheit im Prompt stand.
  const zoeTeil = (s?: ScoreKurz) => (s ? { index: s.index, label: s.label, abdeckung: s.abdeckung, hebel: s.hebel ? `${s.hebel.label} (${s.hebel.saeule})` : null } : null);
  const fuerZoe = { privat: zoeTeil(fuerKi.privat), business: zoeTeil(fuerKi.business), gesundheit: frei && !!fuerKi.privat };
  return NextResponse.json({ ok: true, scores, ...r.data, fuerZoe });
}
