// ─── MAKE OS — Agenten-Konfiguration (lokal) ────────────────────────────────
// Überschreibungen je Agent: Autonomie, aktiv/aus, Modell, Bau-Priorität.
// Map: { [agentId]: { autonomy?, enabled?, model?, buildNext? } }

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

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
  // Schrumpf-Wächter: die Ansicht schreibt die komplette Konfiguration zurück.
  // Ohne geladenen Stand würde sie alle von Hand gesetzten Autonomie-Stufen
  // auf einmal auf Standard zurückdrehen.
  let verloren: string | null = null;
  await updateJson<AgentConfigMap>('agents-config', current => {
    const alt = Object.keys(current ?? {}).length;
    if (alt >= 4 && Object.keys(map).length < alt / 2) {
      verloren = `${alt} → ${Object.keys(map).length} Agenten`;
      return current!;
    }
    return map;
  });

  if (verloren) {
    return NextResponse.json(
      { ok: false, error: `Verweigert: die Einstellungen wären von ${verloren} geschrumpft. Der alte Stand bleibt stehen — Seite neu laden.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
