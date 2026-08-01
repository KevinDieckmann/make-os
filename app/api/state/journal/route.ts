// ─── MAKE OS — Journal (lokal, dein Datenweg) ───────────────────────────────
// Ein Eintrag pro Tag: Text + Tages-Check (Stimmung/Energie/Stress/Symptome).
// So entstehen über Zeit echte Daten, um den Weg immer wieder anzupassen.

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface JournalEntry {
  text?: string;
  mood?: number;   // 1–5
  energy?: number; // 1–5
  stress?: number; // 1–5
  haut?: string;   // 'ruhig' | 'schub'
  ruecken?: string;// 'ok' | 'schmerz'
  flags?: string[];// z.B. antiinflamm, bewegt, cannabis, gutgeschlafen
  at?: string;
}
export type Journal = Record<string, JournalEntry>;

export async function GET() {
  const journal = (await loadJson<Journal>('journal')) ?? {};
  return NextResponse.json({ journal });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const j = body as Journal;
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    return NextResponse.json({ ok: false, error: 'Ungültiges Journal.' }, { status: 400 });
  }
  // Schrumpf-Wächter: verliert der neue Bestand mehr als die Hälfte der Tage,
  // ist das fast immer ein Client-Fehler — nicht still überschreiben.
  const bisher = (await loadJson<Record<string, unknown>>('journal')) ?? {};
  const alt = Object.keys(bisher).length;
  const neu = Object.keys(j).length;
  if (alt >= 6 && neu < alt / 2) {
    return NextResponse.json({ ok: false, error: `Verweigert: der neue Stand hätte ${neu} statt ${alt} Tagen — sieht nach Datenverlust aus. Sicherung liegt unter .data/backup/.` }, { status: 409 });
  }
  await saveJson('journal', j);
  return NextResponse.json({ ok: true });
}
