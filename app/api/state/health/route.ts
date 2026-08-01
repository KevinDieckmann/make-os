// ─── MAKE OS — Gesundheits-Tracking (lokal) ─────────────────────────────────
// Log: { "YYYY-MM-DD": ["journal","supps",...] } — welche Routinen an dem Tag
// erledigt wurden. So entstehen Streaks & Verlauf, lokal auf dem Mac.

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type HealthLog = Record<string, string[]>;

export async function GET() {
  const log = (await loadJson<HealthLog>('health-log')) ?? {};
  return NextResponse.json({ log });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const log = body as HealthLog;
  if (!log || typeof log !== 'object' || Array.isArray(log)) {
    return NextResponse.json({ ok: false, error: 'Ungültiges Log.' }, { status: 400 });
  }
  // Schrumpf-Wächter: verliert der neue Bestand mehr als die Hälfte der Tage,
  // ist das fast immer ein Client-Fehler — nicht still überschreiben.
  const bisher = (await loadJson<Record<string, unknown>>('health-log')) ?? {};
  const alt = Object.keys(bisher).length;
  const neu = Object.keys(log).length;
  if (alt >= 6 && neu < alt / 2) {
    return NextResponse.json({ ok: false, error: `Verweigert: der neue Stand hätte ${neu} statt ${alt} Tagen — sieht nach Datenverlust aus. Sicherung liegt unter .data/backup/.` }, { status: 409 });
  }
  await saveJson('health-log', log);
  return NextResponse.json({ ok: true });
}
