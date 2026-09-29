// ─── MAKE OS — Arten im Freigabe-Stapel (28.09., Paket C4) ──────────────────
// Der Stapel kannte bisher nur Werkzeug-Vorschläge: Freigeben = `fuehreAus(werkzeug, eingabe, { erzwingen })`.
// Vorschläge mit `bezug` (lib/zoe/stapel.ts `StapelBezug`) gehören einer ART mit eigener Freigabe-Funktion —
// z. B. „aufgabe“ (ZOE hat eine Aufgabe vorbereitet, Paket C4). Sie laufen bewusst NICHT über ein Werkzeug:
// so kann kein Werkzeug-Aufruf aus dem Gespräch (auch kein eingeschleuster) einen solchen Vorschlag erzeugen,
// denn `bezug` setzt nur der Server-Lauf der Art selbst (`lege({ …, bezug })`).
//
// Vertrag je Art:
//   freigeben   — prüft (Person, noch offen, passt zum Bezug), übernimmt über den Schreibweg der Art und
//                 entscheidet den Eintrag SELBST als „freigegeben“ (mit Ergebnis). Schlägt es fehl, bleibt er offen.
//   nachAblehnen — optional: Folgeschritt am Bezug, nachdem die Route den Eintrag „abgelehnt“ gesetzt hat.
// Neue Art: `StapelArt` in stapel.ts ergänzen und hier einen Eintrag in `ARTEN` (per dynamischem Import, damit
// der Stapel keine Fach-Module in jedes Bündel zieht und keine Import-Kreise entstehen).

import type { StapelArt, Vorschlag } from './stapel';

export type ArtErgebnis = { ok: true; text: string } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string };

export interface StapelArtFreigabe {
  /** `sammel` = Kennung einer Sammelfreigabe (29.09., #97) — alle darin freigegebenen Einträge tragen sie. */
  freigeben: (v: Vorschlag, person: string, opt: { eingabe?: Record<string, unknown> | null; sammel?: string }) => Promise<ArtErgebnis>;
  nachAblehnen?: (v: Vorschlag, person: string) => Promise<unknown>;
}

const ARTEN: Partial<Record<StapelArt, () => Promise<StapelArtFreigabe>>> = {
  // Paket C4: ZOE hat eine Aufgabe vorbereitet — übernehmen über den Aufgaben-Schreibweg (lib/zoe/aufgaben-werkzeuge.ts).
  aufgabe: async () => (await import('./aufgaben-werkzeuge')).AUFGABE_STAPEL_ART,
  // Paket C7: ZOE hat in der Markttraktion etwas vorbereitet — übernehmen über die normalen CRM-Schreibwege (lib/zoe/crm-vorschlag.ts).
  crm: async () => (await import('./crm-vorschlag')).CRM_STAPEL_ART,
  // Paket R-Z (#K2): der Kalender-Agent hat Blöcke vorgeschlagen — anlegen über den Termin-Schreibweg (lib/zoe/kalender-vorschlag.ts).
  kalender: async () => (await import('./kalender-vorschlag')).KALENDER_STAPEL_ART,
};

/** Die Freigabe der Art dieses Vorschlags — `null` für gewöhnliche Werkzeug-Vorschläge (ohne Bezug). */
export async function stapelArtVon(v: Pick<Vorschlag, 'bezug'>): Promise<StapelArtFreigabe | null> {
  const laden = v.bezug ? ARTEN[v.bezug.art] : undefined;
  return laden ? laden() : null;
}

/** Ein Vorschlag mit Bezug, dessen Art (noch) niemand kennt, wird nie über `fuehreAus` ausgeführt. */
export const UNBEKANNTE_ART: ArtErgebnis = { ok: false, status: 409, fehler: 'Diese Art von Vorschlag kann hier nicht freigegeben werden.' };
