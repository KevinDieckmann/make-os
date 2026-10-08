// ─── Mistral Voxtral: Transkription in der EU (09.10.2026, Paket 6a) — Server ──────────────────────────────────────────────
// Kevin 08.10. (Antwort 25): „Voxtral nach deutschem Test“. Version 1 = NUR der Adapter + Test + Vergleichsskript
// (scripts/voxtral-vergleich.mjs); der Schalter `TRANSKRIPTION_AN` (lib/crm/netzwerken-karte.ts) bleibt aus, nichts in der App ruft ihn.
// Belegt (MODELLE.md 2.5, M3, S1–S3): Firma und Daten in der EU, EU-Endpunkt `api.eu.mistral.ai`, 0,003 $/min; Logs 30 Tage außer ZDR;
// Training erst nach eigenem Opt-out im Admin-Panel aus — Pflicht vor dem ersten Aufruf (UPDATES.md). ANNAHME: Pfad
// `/v1/audio/transcriptions` (multipart: `model`, `file`, `language`) und Antwortfeld `text` wie auf dem allgemeinen Endpunkt; ob der
// EU-Endpunkt Audio anbietet, ist in der Recherche nicht belegt (M3 nennt dort nur Function Calling) — das Vergleichsskript zeigt es.

import { transkriptionsModell } from '../konfig';
import { kiJson, KiAnbieterFehler } from './http';

export const MISTRAL_EU = 'https://api.eu.mistral.ai';
/** Grenze je Datei (Annahme, großzügig unter den üblichen Upload-Grenzen) — darüber Fehler, nie kürzen. */
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const AUDIO_MIME = new Set(['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/flac']);

export interface Transkript { text: string; sekunden?: number; modell: string }

export async function voxtralTranskribieren(e: { bytes: Uint8Array; mime: string; dateiname?: string; sprache?: string; schluessel?: string }): Promise<Transkript> {
  const key = (e.schluessel ?? process.env.MISTRAL_API_KEY ?? '').trim();
  if (!key) throw new KiAnbieterFehler('Mistral ist nicht eingerichtet', 0, 'anbieter');
  if (!AUDIO_MIME.has(e.mime)) throw new KiAnbieterFehler('Audioformat nicht unterstützt', 415, 'anbieter');
  if (e.bytes.byteLength > AUDIO_MAX_BYTES) throw new KiAnbieterFehler('Audio zu groß (über 50 MB)', 413, 'zu-gross');
  const modell = transkriptionsModell();
  const form = new FormData();
  form.set('model', modell);
  form.set('language', (e.sprache ?? 'de').slice(0, 5));
  form.set('file', new Blob([new Uint8Array(e.bytes)], { type: e.mime }), (e.dateiname ?? 'aufnahme').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80));
  const r = await kiJson<{ text?: string; usage?: { prompt_audio_seconds?: number } }>('mistral', `${MISTRAL_EU}/v1/audio/transcriptions`, {
    method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, timeoutMs: 300_000,
  });
  if (typeof r.text !== 'string') throw new KiAnbieterFehler('Kein Text in der Antwort', 200, 'antwort');
  return { text: r.text.trim(), modell, ...(typeof r.usage?.prompt_audio_seconds === 'number' ? { sekunden: r.usage.prompt_audio_seconds } : {}) };
}
