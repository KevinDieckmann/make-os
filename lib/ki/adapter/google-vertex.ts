// ─── Google Vertex: Bilder, Video, Tiefenbericht (09.10.2026, Paket 6a) — Server ─────────────────────────────────────────────
// Kevin 08.10. (Antworten 21–23): Bilder „Nano Banana 2.1 / Pro“, Video „Omni Flash + Veo 3.1“, Research „Gemini Deep Research als
// ‚Tiefenbericht zum Lesen‘, nur mit Klick“ — alles über Vertex mit Dienstkonto (Antwort 24). Ohne Einrichtung aus.
//
// Belege und Annahmen (research/agenten/MODELLE.md 2.2–2.4; nichts davon in Tests gegen das Netz):
//   · Bild: `generateContent` mit `responseModalities` IMAGE, Ergebnis als `inlineData` (Base64) — Feldnamen der Gemini-API (I1, I4).
//     Region `global` (I4: „Vertex nur Region global“). Die Bytes gehen UNVERÄNDERT in die Ablage: SynthID steckt in den Pixeln, C2PA in
//     den Metadaten — kein Umkodieren, kein Exif-Säubern (lib/netzwerken/bild-bereinigen.ts nie für KI-Medien; Wächter).
//   · Video: Long-Running-Operation `predictLongRunning` + Abfrage `fetchPredictOperation` (Vertex-Veo, V3); Veo nur `us-central1`,
//     Ergebnis ohne Speicher-Bucket als Base64 in der Antwort; beim Anbieter nur 2 Tage → SOFORT abholen. Omni Flash über dieselbe
//     Schnittstelle in `global` = ANNAHME (V2 beschreibt die Gemini-API, für Vertex nicht belegt).
//   · Tiefenbericht: Interactions-API (`background: true`, `store: true`, Abfrage per GET, R5) — der Pfad auf Vertex ist ANNAHME
//     (`v1beta1/…/interactions`), ebenso die Felder der Suchvorschläge (`searchEntryPoint.renderedContent`, `webSearchQueries` wie beim
//     Grounding, R2). Vor dem ersten echten Lauf prüfen (UPDATES.md 09.10. › KI-Anbieter).

import type { VertexKonfig } from '../konfig';
import { vertexToken } from './google-auth';
import { base64Bytes, kiJson, KiAnbieterFehler } from './http';
import { vertexHost } from './anthropic-vertex';

/** Grenzen (MODELLE.md 4.4): Bild ≤ 15 MB, Video ≤ 60 MB — darüber Fehler 413, nie gekürzt. */
export const BILD_MAX_BYTES = 15 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 60 * 1024 * 1024;
export const REFERENZEN_MAX = 14;

const MIME_BILD = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MIME_VIDEO = new Set(['video/mp4']);

const modellUrl = (v: VertexKonfig, ort: string, modell: string, methode: string) =>
  `https://${vertexHost(ort)}/v1/projects/${v.projekt}/locations/${ort}/publishers/google/models/${encodeURIComponent(modell)}:${methode}`;
const kopf = async (v: VertexKonfig) => ({ authorization: `Bearer ${await vertexToken('google-vertex', v.konto)}`, 'content-type': 'application/json' });

// ── Bild ──────────────────────────────────────────────────────────────────────

export interface BildAuftrag {
  modell: string;
  prompt: string;
  aufloesung?: '1k' | '2k' | '4k';
  seitenverhaeltnis?: '1:1' | '4:5' | '3:4' | '16:9' | '9:16';
  /** Referenzen aus der eigenen Ablage (Logo, Stil) — nie fremde URLs. */
  referenzen?: { mime: string; bytes: Buffer }[];
}
export interface MediumRoh { mime: string; bytes: Buffer }

interface GenerateAntwort { candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }; finishReason?: string }[] }

export async function vertexBild(v: VertexKonfig, a: BildAuftrag): Promise<{ bilder: MediumRoh[]; text: string }> {
  if ((a.referenzen?.length ?? 0) > REFERENZEN_MAX) throw new KiAnbieterFehler(`Höchstens ${REFERENZEN_MAX} Referenzen`, 413, 'zu-gross');
  const teile = [
    ...(a.referenzen ?? []).map(r => ({ inlineData: { mimeType: r.mime, data: r.bytes.toString('base64') } })),
    { text: a.prompt },
  ];
  const body = {
    contents: [{ role: 'user', parts: teile }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: (a.aufloesung ?? '1k').toUpperCase(), ...(a.seitenverhaeltnis ? { aspectRatio: a.seitenverhaeltnis } : {}) } },
  };
  const r = await kiJson<GenerateAntwort>('google-vertex', modellUrl(v, 'global', a.modell, 'generateContent'), { method: 'POST', headers: await kopf(v), body: JSON.stringify(body), timeoutMs: 180_000 });
  const parts = r.candidates?.flatMap(c => c.content?.parts ?? []) ?? [];
  const bilder = parts.filter(p => p.inlineData?.data && MIME_BILD.has(p.inlineData.mimeType ?? '')).map(p => ({ mime: p.inlineData!.mimeType!, bytes: base64Bytes(p.inlineData!.data!, BILD_MAX_BYTES) }));
  if (!bilder.length) throw new KiAnbieterFehler(`Kein Bild in der Antwort${r.candidates?.[0]?.finishReason ? ` (${r.candidates[0].finishReason})` : ''}`, 200, 'antwort');
  return { bilder, text: parts.map(p => p.text ?? '').join('\n').trim() };
}

// ── Video (asynchron) ─────────────────────────────────────────────────────────

/** Region je Videomodell — Veo nur us-central1 (V3); Omni Flash `global` = Annahme. */
export const VIDEO_ORT: Record<string, string> = { 'veo-3.1-generate-001': 'us-central1', 'gemini-omni-1.1-flash': 'global' };
export interface VideoAuftrag { modell: string; prompt: string; sekunden: number; aufloesung?: '720p' | '1080p' | '4k'; seitenverhaeltnis?: '16:9' | '9:16' }

export async function vertexVideoStarten(v: VertexKonfig, a: VideoAuftrag): Promise<{ operation: string }> {
  const ort = VIDEO_ORT[a.modell];
  if (!ort) throw new KiAnbieterFehler('Videomodell unbekannt', 400, 'anbieter');
  const body = {
    instances: [{ prompt: a.prompt }],
    // Erwachsene nur (EU-Regel des Anbieters, MODELLE.md 2.4: „EU nur allow_adult“); immer mit Ton; ein Ergebnis.
    parameters: { durationSeconds: a.sekunden, resolution: a.aufloesung ?? '1080p', aspectRatio: a.seitenverhaeltnis ?? '16:9', generateAudio: true, sampleCount: 1, personGeneration: 'allow_adult' },
  };
  const r = await kiJson<{ name?: string }>('google-vertex', modellUrl(v, ort, a.modell, 'predictLongRunning'), { method: 'POST', headers: await kopf(v), body: JSON.stringify(body), timeoutMs: 60_000 });
  if (!r.name || !/^projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\/[^/]+\/operations\/[A-Za-z0-9_-]+$/.test(r.name)) throw new KiAnbieterFehler('Keine Vorgangskennung in der Antwort', 200, 'antwort');
  return { operation: r.name };
}

interface OperationAntwort { done?: boolean; error?: { message?: string }; response?: { videos?: { bytesBase64Encoded?: string; mimeType?: string }[]; raiMediaFilteredCount?: number } }

export async function vertexVideoAbholen(v: VertexKonfig, modell: string, operation: string): Promise<{ fertig: false } | { fertig: true; videos: MediumRoh[]; gefiltert: number }> {
  const ort = VIDEO_ORT[modell];
  if (!ort) throw new KiAnbieterFehler('Videomodell unbekannt', 400, 'anbieter');
  const r = await kiJson<OperationAntwort>('google-vertex', modellUrl(v, ort, modell, 'fetchPredictOperation'), { method: 'POST', headers: await kopf(v), body: JSON.stringify({ operationName: operation }), timeoutMs: 120_000 });
  if (!r.done) return { fertig: false };
  if (r.error) throw new KiAnbieterFehler(`Video gescheitert: ${String(r.error.message ?? '').slice(0, 160)}`, 200, 'antwort');
  const videos = (r.response?.videos ?? []).filter(x => x.bytesBase64Encoded && MIME_VIDEO.has(x.mimeType ?? 'video/mp4')).map(x => ({ mime: x.mimeType ?? 'video/mp4', bytes: base64Bytes(x.bytesBase64Encoded!, VIDEO_MAX_BYTES) }));
  return { fertig: true, videos, gefiltert: r.response?.raiMediaFilteredCount ?? 0 };
}

// ── Tiefenbericht (Deep Research, asynchron) ──────────────────────────────────

const interactionsBasis = (v: VertexKonfig) => `https://${vertexHost('global')}/v1beta1/projects/${v.projekt}/locations/global/interactions`;

export async function vertexTiefenberichtStarten(v: VertexKonfig, modell: string, frage: string): Promise<{ vorgang: string }> {
  const r = await kiJson<{ id?: string; name?: string }>('google-vertex', interactionsBasis(v), { method: 'POST', headers: await kopf(v), body: JSON.stringify({ agent: modell, input: frage, background: true, store: true }), timeoutMs: 60_000 });
  const id = r.name ?? r.id ?? '';
  const kurz = id.split('/').pop() ?? '';
  if (!/^[A-Za-z0-9_-]{4,200}$/.test(kurz)) throw new KiAnbieterFehler('Keine Vorgangskennung in der Antwort', 200, 'antwort');
  return { vorgang: kurz };
}

export interface TiefenberichtRoh { text: string; quellen: { titel: string; url: string }[]; suchbegriffe: string[]; suchvorschlaegeHtml: string | null }
interface InteractionAntwort {
  status?: string; error?: { message?: string };
  outputs?: { type?: string; text?: string; annotations?: { url?: string; title?: string; source?: string }[] }[];
  groundingMetadata?: { webSearchQueries?: string[]; searchEntryPoint?: { renderedContent?: string } };
}

export async function vertexTiefenberichtAbholen(v: VertexKonfig, vorgang: string): Promise<{ fertig: false } | { fertig: true; bericht: TiefenberichtRoh }> {
  if (!/^[A-Za-z0-9_-]{4,200}$/.test(vorgang)) throw new KiAnbieterFehler('Vorgangskennung ungültig', 400, 'anbieter');
  const r = await kiJson<InteractionAntwort>('google-vertex', `${interactionsBasis(v)}/${vorgang}`, { method: 'GET', headers: await kopf(v), timeoutMs: 60_000 });
  if (r.status === 'failed' || r.status === 'cancelled') throw new KiAnbieterFehler(`Tiefenbericht gescheitert: ${String(r.error?.message ?? r.status).slice(0, 160)}`, 200, 'antwort');
  if (r.status !== 'completed') return { fertig: false };
  const texte = (r.outputs ?? []).filter(o => (o.type ?? 'text') === 'text' && o.text);
  const quellen = new Map<string, string>();
  for (const o of texte) for (const an of o.annotations ?? []) {
    const url = an.url ?? an.source ?? '';
    if (/^https:\/\//.test(url) && !quellen.has(url)) quellen.set(url, String(an.title ?? url).slice(0, 200));
  }
  return { fertig: true, bericht: {
    text: texte.map(o => o.text).join('\n\n').trim(),
    quellen: Array.from(quellen.entries()).map(([url, titel]) => ({ url, titel })).slice(0, 200),
    suchbegriffe: (r.groundingMetadata?.webSearchQueries ?? []).filter(q => typeof q === 'string').map(q => q.slice(0, 200)).slice(0, 50),
    suchvorschlaegeHtml: typeof r.groundingMetadata?.searchEntryPoint?.renderedContent === 'string' ? r.groundingMetadata.searchEntryPoint.renderedContent.slice(0, 100_000) : null,
  } };
}
