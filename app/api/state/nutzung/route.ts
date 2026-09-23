// ─── MAKE OS — Nutzung ──────────────────────────────────────────────────────
// Kevins Ansage: „Bau einen Loop ein, der nach und nach aufnimmt, wie wir
// arbeiten, damit wir uns in der Software selbst verbessern. Schlag in
// angemessenen Abständen Optimierungen vor."
//
// Also: eine leise Mitschrift. Welche Seite wie oft und wann zuletzt — mehr
// nicht. Keine Inhalte, keine Texte, nichts, was das Haus verlässt. Daraus
// zieht der Verbesserungs-Loop später seine Vorschläge.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Seite {
  anzahl: number;
  zuletzt: string;
  person: string;
  /** Aufsummierte aktive Zeit — Grundlage fürs Wochen-Reflexionsmeeting. */
  sekunden: number;
}
interface Datei {
  seiten: Record<string, Seite>;
  /** Je Tag die Zahl der Aufrufe — zeigt, ob die Software überhaupt benutzt wird. */
  tage: Record<string, number>;
  /** Wann zuletzt ein Verbesserungs-Vorschlag lief. */
  letzteAnalyse?: string;
}

const LEER: Datei = { seiten: {}, tage: {} };
const TAGE_BEHALTEN = 60;

export async function GET() {
  const d = (await loadJson<Datei>('nutzung')) ?? LEER;
  const seiten = Object.entries(d.seiten ?? {})
    .map(([pfad, s]) => ({ pfad, ...s }))
    .sort((a, b) => b.anzahl - a.anzahl);
  return NextResponse.json({
    seiten,
    tage: d.tage ?? {},
    letzteAnalyse: d.letzteAnalyse,
    gesamt: seiten.reduce((s, x) => s + x.anzahl, 0),
  });
}

/** Einen Aufruf mitschreiben. Absichtlich schmal: Pfad, Zeit, wer. */
export async function POST(req: Request) {
  let body: { pfad?: string; person?: string; sekunden?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const pfad = String(body.pfad ?? '').slice(0, 120);
  if (!pfad.startsWith('/os')) return NextResponse.json({ ok: true, ignoriert: true });
  const person = body.person === 'malin' ? 'malin' : 'kevin';
  // Deckel auch serverseitig — ein offenes Fenster ist keine Arbeitszeit.
  const sek = Math.max(0, Math.min(2700, Math.round(Number(body.sekunden) || 0)));
  const heute = localDay();

  await updateJson<Datei>('nutzung', current => {
    const f = current ?? { seiten: {}, tage: {} };
    f.seiten = f.seiten ?? {};
    f.tage = f.tage ?? {};
    const alt = f.seiten[pfad];
    f.seiten[pfad] = {
      anzahl: (alt?.anzahl ?? 0) + 1,
      zuletzt: new Date().toISOString(),
      person,
      sekunden: (alt?.sekunden ?? 0) + sek,
    };
    f.tage[heute] = (f.tage[heute] ?? 0) + 1;
    // Nur die letzten Wochen behalten — das reicht, um Muster zu sehen.
    const tage = Object.keys(f.tage).sort();
    for (const t of tage.slice(0, Math.max(0, tage.length - TAGE_BEHALTEN))) delete f.tage[t];
    return f;
  });
  return NextResponse.json({ ok: true });
}

/** Stempelt, dass eine Analyse gelaufen ist. */
export async function PUT() {
  const next = await updateJson<Datei>('nutzung', current => ({
    ...(current ?? LEER),
    letzteAnalyse: new Date().toISOString(),
  }));
  return NextResponse.json({ ok: true, letzteAnalyse: next.letzteAnalyse });
}
