// ─── KI-Modelle: Katalog mit Stand, Quelle und Preisen; Modellstufen je Instanz (09.10.2026, Paket 6a) — rein ───────────────
// Kevin 08.10. spät (Antwort 20): „Haiku 5.5 / Sonnet 5.5 / Opus 5.5 nach Test · Preise in die Kostenmessung · Mitarbeiter Haiku,
// Heads Sonnet, Reviews Opus.“ Recherche: research/agenten/MODELLE.md Teil 2.1–2.5 (Preise in US-Dollar, abgerufen 08.10.2026).
//
// R2 der Recherche: IDs, Preise und Regionen sind DATEN, kein Code — jede Zeile trägt `stand` und `quelle`; ein abgeschaltetes Modell
// trägt `abgeschaltetAm` (das Tor nimmt es dann nicht mehr). Unbekanntes Modell → höchster Preis seiner Fähigkeit (nie null).
// Die Modellstufen (schnell/ausgewogen/stark) kommen aus EINEM Satz je Instanz: Vorgabe „bisher“ (Haiku 4.5, Sonnet 5, Opus 5.5) bis
// Kevin nach dem Vergleich (scripts/ki-stufen-vergleich.mjs) auf „neu“ (Haiku 5.5, Sonnet 5.5, Opus 5.5) umstellt — über die Umgebung
// `MAKE_OS_KI_STUFEN` oder die Inhaber-Einstellung (System › Datenschutz › KI, `modellStufen`).

import type { Faehigkeit } from './anbieter';

export type ModellStufe = 'schnell' | 'ausgewogen' | 'stark';
export const MODELL_STUFEN: readonly ModellStufe[] = ['schnell', 'ausgewogen', 'stark'];

/** Abrechnungseinheiten. Token-Preise je MILLION Token, alle anderen je Einheit (US-Dollar). */
export type Einheit =
  | 'token-ein' | 'token-aus' | 'cache-lesen' | 'cache-schreiben'
  | 'bild@1k' | 'bild@2k' | 'bild@4k'
  | 'sekunde@720p' | 'sekunde@1080p' | 'sekunde@4k'
  | 'minute' | 'aufgabe' | 'suche';
export const TOKEN_EINHEITEN: readonly Einheit[] = ['token-ein', 'token-aus', 'cache-lesen', 'cache-schreiben'];

export interface ModellEintrag {
  id: string;
  name: string;
  faehigkeit: Faehigkeit;
  preise: Partial<Record<Einheit, number>>;
  /** Andere Preise ab einer Prompt-Länge (Haiku 5.5: über 100k Eingabe-Token). */
  staffel?: { abEin: number; preise: Partial<Record<Einheit, number>> };
  /** Tag der Abfrage (JJJJ-MM-TT) und Beleg (URL bzw. Verweis auf die Recherche). */
  stand: string;
  quelle: string;
  /** Preis nur geschätzt/aus Drittquelle — die Oberfläche schreibt „ca.“. */
  geschaetzt?: boolean;
  vorschau?: boolean;
  abgeschaltetAm?: string;
}

const A1 = 'https://platform.claude.com/docs/en/about-claude/pricing (MODELLE.md A1, abgerufen 08.10.2026)';
const G1 = 'https://ai.google.dev/gemini-api/docs/pricing bzw. Vertex-Preisliste (MODELLE.md G1/G7/I3, abgerufen 08.10.2026)';
const V = 'https://ai.google.dev/gemini-api/docs/veo und …/omni (MODELLE.md V1–V3, V14, abgerufen 08.10.2026)';
const M2 = 'https://docs.mistral.ai/inference/pricing (MODELLE.md M2/S1, abgerufen 08.10.2026)';

/**
 * Der Katalog. Cache-Schreiben = 1,25 × Eingabe (5-Minuten-Cache, wie bisher in lib/zoe/verbrauch.ts); Cache-Lesen laut Preisseite
 * (Opus/Sonnet 5.5: 0,20 $), sonst 0,1 × Eingabe wie bisher. Die alten Zeilen (Stand 07.09.) bleiben, damit vorhandene Posten gleich rechnen.
 */
export const MODELLE: readonly ModellEintrag[] = [
  // ── Claude (Text) ──
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', faehigkeit: 'text', preise: { 'token-ein': 4, 'token-aus': 20, 'cache-lesen': 0.2, 'cache-schreiben': 5 }, stand: '2026-10-08', quelle: A1 },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', faehigkeit: 'text', preise: { 'token-ein': 2, 'token-aus': 10, 'cache-lesen': 0.2, 'cache-schreiben': 2.5 }, stand: '2026-10-08', quelle: A1 },
  {
    id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', faehigkeit: 'text',
    preise: { 'token-ein': 0.1, 'token-aus': 0.5, 'cache-lesen': 0.01, 'cache-schreiben': 0.125 },
    staffel: { abEin: 100_000, preise: { 'token-ein': 0.5, 'token-aus': 2.5, 'cache-lesen': 0.05, 'cache-schreiben': 0.625 } },
    stand: '2026-10-08', quelle: `${A1}; Cache-Preise als 0,1×/1,25× Eingabe angenommen (nicht einzeln belegt)`,
  },
  { id: 'claude-opus-5', name: 'Claude Opus 5', faehigkeit: 'text', preise: { 'token-ein': 5, 'token-aus': 25, 'cache-lesen': 0.5, 'cache-schreiben': 6.25 }, stand: '2026-09-07', quelle: A1 },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', faehigkeit: 'text', preise: { 'token-ein': 2, 'token-aus': 10, 'cache-lesen': 0.2, 'cache-schreiben': 2.5 }, stand: '2026-09-07', quelle: A1 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', faehigkeit: 'text', preise: { 'token-ein': 1, 'token-aus': 5, 'cache-lesen': 0.1, 'cache-schreiben': 1.25 }, stand: '2026-09-07', quelle: A1 },
  // ── Google Vertex: Bilder ──
  { id: 'gemini-nano-banana-2.1', name: 'Nano Banana 2.1', faehigkeit: 'bild', preise: { 'bild@1k': 0.034, 'bild@2k': 0.05, 'bild@4k': 0.113 }, stand: '2026-10-08', quelle: G1 },
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro', faehigkeit: 'bild', preise: { 'bild@1k': 0.134, 'bild@2k': 0.134, 'bild@4k': 0.24 }, stand: '2026-10-08', quelle: G1 },
  // ── Google Vertex: Video (je Sekunde, mit Ton) ──
  { id: 'gemini-omni-1.1-flash', name: 'Gemini Omni Flash 1.1', faehigkeit: 'video', preise: { 'sekunde@720p': 0.1, 'sekunde@1080p': 0.15, 'sekunde@4k': 0.15 }, geschaetzt: true, stand: '2026-10-08', quelle: `${V}; Preise „ca.“ laut Drittquelle [S], 4K = Annahme wie 1080p` },
  { id: 'veo-3.1-generate-001', name: 'Veo 3.1', faehigkeit: 'video', preise: { 'sekunde@720p': 0.4, 'sekunde@1080p': 0.4, 'sekunde@4k': 0.6 }, stand: '2026-10-08', quelle: V },
  // ── Google Vertex: Tiefenbericht (je Aufgabe, obere Spanne für die Schätzung) ──
  { id: 'deep-research-preview-04-2026', name: 'Gemini Deep Research', faehigkeit: 'tiefenbericht', preise: { aufgabe: 3 }, geschaetzt: true, vorschau: true, stand: '2026-10-08', quelle: `${G1}; Spanne 1–3 $ je Aufgabe (MODELLE.md 2.2, R5)` },
  { id: 'deep-research-max-preview-04-2026', name: 'Gemini Deep Research Max', faehigkeit: 'tiefenbericht', preise: { aufgabe: 7 }, geschaetzt: true, vorschau: true, stand: '2026-10-08', quelle: `${G1}; Spanne 3–7 $ je Aufgabe (MODELLE.md 2.2, R5)` },
  // ── Mistral: Transkription ──
  { id: 'voxtral-mini-latest', name: 'Voxtral Mini Transcribe', faehigkeit: 'transkript', preise: { minute: 0.003 }, stand: '2026-10-08', quelle: `${M2}; Modell-ID „voxtral-mini-latest“ = Annahme für „Voxtral Mini Transcribe V2“ (MISTRAL_TRANSKRIPTION_MODELL überschreibt)` },
];

export const modellVon = (id: string): ModellEintrag | undefined => MODELLE.find(m => m.id === id);
export const istAktiv = (m: ModellEintrag, heute: string): boolean => !m.abgeschaltetAm || m.abgeschaltetAm > heute;

/** Preise eines Modells für einen Aufruf — unbekannt: die teuerste Zeile seiner Fähigkeit (Text: wie bisher Opus 5). */
export function preiseFuer(modell: string, faehigkeit: Faehigkeit = 'text', ein = 0): Partial<Record<Einheit, number>> {
  const m = modellVon(modell);
  if (m) return m.staffel && ein > m.staffel.abEin ? { ...m.preise, ...m.staffel.preise } : m.preise;
  const gleiche = MODELLE.filter(x => x.faehigkeit === faehigkeit);
  const teuerster: Partial<Record<Einheit, number>> = {};
  for (const x of gleiche) for (const [k, v] of Object.entries(x.preise) as [Einheit, number][]) teuerster[k] = Math.max(teuerster[k] ?? 0, v);
  return teuerster;
}

// ── Modellstufen ──────────────────────────────────────────────────────────────

export type StufenSatz = 'bisher' | 'neu';
export const STUFEN_SAETZE: Record<StufenSatz, Record<ModellStufe, string>> = {
  /** Stand bis zum Vergleich (lib/agent-config.ts bis 08.10.). */
  bisher: { schnell: 'claude-haiku-4-5-20251001', ausgewogen: 'claude-sonnet-5', stark: 'claude-opus-5-5' },
  /** Kevin 08.10.: nach dem Vergleich. */
  neu: { schnell: 'claude-haiku-5-5', ausgewogen: 'claude-sonnet-5-5', stark: 'claude-opus-5-5' },
};
/** Vorgabe bis Kevins Umstellung — „ohne Konfiguration Verhalten wie heute“. */
export const STUFEN_VORGABE: StufenSatz = 'bisher';
export const istStufenSatz = (x: unknown): x is StufenSatz => x === 'bisher' || x === 'neu';

/** Zuordnung je Rolle (Kevin 08.10., vorbereitet für den Agenten-Bereich): Mitarbeiter schnell, Heads ausgewogen, Reviews stark. */
export const STUFE_JE_ROLLE = { mitarbeiter: 'schnell', head: 'ausgewogen', review: 'stark' } as const satisfies Record<string, ModellStufe>;
export type AgentenRolle = keyof typeof STUFE_JE_ROLLE;

const UMGEBUNG_JE_STUFE: Record<ModellStufe, string> = { schnell: 'MAKE_OS_KI_MODELL_SCHNELL', ausgewogen: 'MAKE_OS_KI_MODELL_AUSGEWOGEN', stark: 'MAKE_OS_KI_MODELL_STARK' };

/**
 * Die wirksamen Modelle je Stufe (rein): Umgebung `MAKE_OS_KI_STUFEN` (bisher|neu) schlägt die Inhaber-Einstellung, die die Vorgabe;
 * einzelne Stufen lassen sich über `MAKE_OS_KI_MODELL_<STUFE>` setzen — nur Claude-Modelle aus dem Katalog (sonst bleibt der Satz).
 */
export function stufenModelle(env: Record<string, string | undefined>, einstellung?: StufenSatz | null): Record<ModellStufe, string> {
  const u = (env.MAKE_OS_KI_STUFEN ?? '').trim();
  const satz: StufenSatz = istStufenSatz(u) ? u : einstellung && istStufenSatz(einstellung) ? einstellung : STUFEN_VORGABE;
  const raus = { ...STUFEN_SAETZE[satz] };
  for (const s of MODELL_STUFEN) {
    const v = (env[UMGEBUNG_JE_STUFE[s]] ?? '').trim();
    if (v && modellVon(v)?.faehigkeit === 'text') raus[s] = v;
  }
  return raus;
}
/** Welcher Satz gilt (für die Anzeige) — Umgebung vor Einstellung vor Vorgabe. */
export function stufenSatzWirksam(env: Record<string, string | undefined>, einstellung?: StufenSatz | null): { satz: StufenSatz; quelle: 'umgebung' | 'einstellung' | 'vorgabe' } {
  const u = (env.MAKE_OS_KI_STUFEN ?? '').trim();
  if (istStufenSatz(u)) return { satz: u, quelle: 'umgebung' };
  if (einstellung && istStufenSatz(einstellung)) return { satz: einstellung, quelle: 'einstellung' };
  return { satz: STUFEN_VORGABE, quelle: 'vorgabe' };
}

/** Claude-Modell-ID auf Vertex: aktuelle Modelle ohne Präfix, datierte Schnappschüsse mit „@“ (claude-haiku-4-5@20251001). */
export const vertexModellId = (id: string): string => id.replace(/-(\d{8})$/, '@$1');
