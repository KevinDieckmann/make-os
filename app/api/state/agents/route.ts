// ─── MAKE OS — Agenten-Konfiguration (lokal) ────────────────────────────────
// Überschreibungen je Agent: Autonomie, aktiv/aus, Modell, Bau-Priorität.
// Map: { [agentId]: { autonomy?, enabled?, model?, buildNext? } }

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';
import { MODEL_BY_TIER } from '@/lib/agent-config';
import type { Autonomy, ModelTier } from '@/lib/make-one/agents-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Die drei Stufen des Reglers (lib/make-one/agents-data). */
const AUTONOMIEN: string[] = ['entwurf', 'freigabe', 'autonom', 'nur-vorschlag', 'vorschlag'];

export interface AgentConfig { autonomy?: string; enabled?: boolean; model?: string; buildNext?: boolean; }
export type AgentConfigMap = Record<string, AgentConfig>;

export async function GET() {
  const config = (await loadJson<AgentConfigMap>('agents-config')) ?? {};
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  // Autonomie-Regler wirken in Kevins Kalender und Aufgaben — nur der Inhaber stellt sie (26.09.).
  if (!(await nurInhaber(req))) return NextResponse.json({ ok: false, error: 'Nur für den Inhaber.' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const roh = body as Record<string, Record<string, unknown>>;
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) {
    return NextResponse.json({ ok: false, error: 'Ungültige Konfig.' }, { status: 400 });
  }
  // Nur bekannte Werte — ein unbekanntes Modell ließe jeden Lauf des Agenten scheitern (26.09.).
  const map: AgentConfigMap = {};
  for (const [id, v] of Object.entries(roh).slice(0, 80)) {
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !v || typeof v !== 'object') continue;
    const e: AgentConfig = {};
    if (typeof v.autonomy === 'string' && AUTONOMIEN.includes(v.autonomy)) e.autonomy = v.autonomy as Autonomy;
    if (typeof v.model === 'string' && v.model in MODEL_BY_TIER) e.model = v.model as ModelTier;
    if (typeof v.enabled === 'boolean') e.enabled = v.enabled;
    if (typeof v.buildNext === 'boolean') e.buildNext = v.buildNext;
    map[id] = e;
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
