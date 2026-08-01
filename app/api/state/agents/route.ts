// ─── MAKE OS — Agenten-Konfiguration (lokal) ────────────────────────────────
// Überschreibungen je Agent: Autonomie, aktiv/aus, Modell, Bau-Priorität.
// Map: { [agentId]: { autonomy?, enabled?, model?, buildNext? } }

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AgentConfig { autonomy?: string; enabled?: boolean; model?: string; buildNext?: boolean; }
export type AgentConfigMap = Record<string, AgentConfig>;

export async function GET() {
  const config = (await loadJson<AgentConfigMap>('agents-config')) ?? {};
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const map = body as AgentConfigMap;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return NextResponse.json({ ok: false, error: 'Ungültige Konfig.' }, { status: 400 });
  }
  await saveJson('agents-config', map);
  return NextResponse.json({ ok: true });
}
