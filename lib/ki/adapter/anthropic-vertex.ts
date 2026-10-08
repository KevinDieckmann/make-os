// ─── Claude über Google Vertex in der EU (09.10.2026, Paket 6a) — Server ─────────────────────────────────────────────────────
// Kevin 08.10. (Antwort 19): „Vertex EU für Gesundheit, Privat-Finanzen, Familie · Gesundheit an die KI nur EU mit ZDR.“
// Belegt (MODELLE.md A9, W29; claude-api-Referenz „Google Cloud Vertex AI“): Claude auf Vertex nimmt denselben Messages-Körper wie die
// Anthropic-API — OHNE `model` im Körper (das Modell steht in der Adresse), MIT `anthropic_version: "vertex-2023-10-16"`; Endpunkt
// `…/projects/<projekt>/locations/<region>/publishers/anthropic/models/<modell>:rawPredict`; aktuelle Modelle tragen die nackte ID,
// datierte Schnappschüsse ein „@“ (lib/ki/modelle.ts `vertexModellId`). Auf Vertex verfügbar: Structured Outputs, Effort, Prompt-Caching,
// nur die EINFACHE Web-Suche (`web_search_20250305`, die askText nutzt); NICHT: Web-Fetch, Batches, Files API, `inference_geo`.
// Host der Multi-Region „eu“: `aiplatform.eu.rep.googleapis.com` — ANNAHME nach dem Verhalten der offiziellen Vertex-SDKs (regionale
// Endpunkte „<region>-aiplatform.googleapis.com“, Multi-Regionen „aiplatform.<region>.rep.googleapis.com“); vor dem ersten echten Lauf
// prüfen (UPDATES.md 09.10. › KI-Anbieter, Schritt „Probe“). Eine Region „europe-…“ geht über den regionalen Endpunkt.
// Ohne Einrichtung gibt es diesen Weg nicht — das Tor sperrt dann („ki-gesperrt:anbieter-…“), es fällt NIE still auf Anthropic direkt zurück.

import { vertexModellId } from '../modelle';
import { vertexKonfig, type VertexKonfig } from '../konfig';
import { vertexToken } from './google-auth';
import { kiFetch, KiAnbieterFehler } from './http';

export const VERTEX_ANTHROPIC_VERSION = 'vertex-2023-10-16';

export function vertexHost(region: string): string {
  return region === 'eu' || region === 'us' ? `aiplatform.${region}.rep.googleapis.com` : region === 'global' ? 'aiplatform.googleapis.com' : `${region}-aiplatform.googleapis.com`;
}
export function vertexClaudeUrl(v: Pick<VertexKonfig, 'projekt' | 'claudeRegion'>, modell: string): string {
  return `https://${vertexHost(v.claudeRegion)}/v1/projects/${v.projekt}/locations/${v.claudeRegion}/publishers/anthropic/models/${encodeURIComponent(vertexModellId(modell))}:rawPredict`;
}

/** Den Messages-Körper für Vertex umbauen (rein): `model` raus, `anthropic_version` rein. */
export function fuerVertex(body: Record<string, unknown>): Record<string, unknown> {
  const { model: _model, ...rest } = body;
  return { anthropic_version: VERTEX_ANTHROPIC_VERSION, ...rest };
}

/** Ein Ziel für askText in lib/anthropic.ts — wie der direkte Weg, nur Adresse, Kopf und Körper anders. */
export interface TextZiel {
  anbieter: 'anthropic-vertex-eu';
  region: string;
  senden(body: Record<string, unknown>, signal: AbortSignal): Promise<Response>;
}

export function vertexClaudeZiel(): TextZiel {
  const v = vertexKonfig();
  if (!v) throw new KiAnbieterFehler('Claude über Vertex EU ist nicht eingerichtet', 0, 'anbieter');
  return {
    anbieter: 'anthropic-vertex-eu',
    region: v.claudeRegion,
    async senden(body, signal) {
      const token = await vertexToken('anthropic-vertex-eu', v.konto);
      return kiFetch('anthropic-vertex-eu', vertexClaudeUrl(v, String(body.model ?? '')), {
        method: 'POST', signal,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(fuerVertex(body)),
      });
    },
  };
}
