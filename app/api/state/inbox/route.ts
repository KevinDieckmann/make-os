// ─── MAKE OS — Inbox-Status persistieren (lokal) ────────────────────────────
// Map messageId → Status ("offen" | "erledigt" | "aufgabe" | "delegiert" | "snoozed").
// snoozed trägt ein bis-Datum: bis dahin unsichtbar, danach taucht die Mail
// als ⏰ Wiedervorlage wieder oben auf. So bleibt die Triage über Reloads.

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type InboxStatusMap = Record<string, { status: string; at: string; bis?: string }>;

export async function GET() {
  const status = (await loadJson<InboxStatusMap>('inbox-status')) ?? {};
  return NextResponse.json({ status });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const map = body as InboxStatusMap;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return NextResponse.json({ ok: false, error: 'Ungültige Status-Map.' }, { status: 400 });
  }
  await saveJson('inbox-status', map);
  return NextResponse.json({ ok: true });
}
