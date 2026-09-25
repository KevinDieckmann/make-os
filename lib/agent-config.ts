// ─── MAKE OS — Agenten-Konfiguration mit echter Wirkung ─────────────────────
// Bis hierher war die Verwaltung unter /os/agenten Kosmetik: Autonomie, Modell
// und Aktiv-Schalter wurden gespeichert, aber von keiner Route gelesen. Diese
// Datei ist die EINE Stelle, die Standard (agents-data) mit deinen Overrides
// (.data/agents-config.json) zusammenführt — und die Routen fragen sie.

import { loadJson } from '@/lib/store/local-db';
import { ALL_AGENTS, type Autonomy, type ModelTier } from '@/lib/make-one/agents-data';

export interface AgentConfig { autonomy?: Autonomy; enabled?: boolean; model?: ModelTier; buildNext?: boolean }
export type AgentConfigMap = Record<string, AgentConfig>;

/** Modell-Stufe → echtes Modell. Günstige Worker, das große nur wo es zählt. */
export const MODEL_BY_TIER: Record<ModelTier, string> = {
  schnell: 'claude-haiku-4-5-20251001',
  ausgewogen: 'claude-sonnet-5',
  stark: 'claude-opus-5-5',
};

export interface ResolvedAgent {
  id: string;
  name: string;
  autonomy: Autonomy;
  tier: ModelTier;
  /** Konkretes Modell für lib/anthropic — respektiert ANTHROPIC_MODEL als Override. */
  model: string;
  enabled: boolean;
}

/** Standard + gespeicherte Übersteuerung. Wirft nie — im Zweifel Standard. */
export async function resolveAgent(agentId: string): Promise<ResolvedAgent> {
  const base = ALL_AGENTS.find(a => a.id === agentId);
  const fallback: ResolvedAgent = {
    id: agentId,
    name: base?.name ?? agentId,
    autonomy: base?.autonomy ?? 'entwurf',
    tier: base?.model ?? 'ausgewogen',
    model: process.env.ANTHROPIC_MODEL ?? MODEL_BY_TIER[base?.model ?? 'ausgewogen'],
    enabled: true,
  };
  try {
    const cfg = (await loadJson<AgentConfigMap>('agents-config')) ?? {};
    const own = cfg[agentId] ?? {};
    const tier: ModelTier = own.model ?? fallback.tier;
    return {
      id: agentId,
      name: fallback.name,
      autonomy: own.autonomy ?? fallback.autonomy,
      tier,
      // Eine ausdrückliche ANTHROPIC_MODEL-Vorgabe schlägt die Stufe (Notbremse).
      model: process.env.ANTHROPIC_MODEL ?? MODEL_BY_TIER[tier],
      enabled: own.enabled !== false,
    };
  } catch {
    return fallback;
  }
}

/** Antwort für einen abgeschalteten Agenten — überall gleich. */
export function disabledResponse(a: ResolvedAgent) {
  return {
    error: `${a.name} ist gerade ausgeschaltet. Du kannst ihn unter /os/agenten wieder aktivieren.`,
    disabled: true,
    agent: a.id,
  };
}
