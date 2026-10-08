// ─── MAKE OS — Update-Hinweis (08.10., Phase 0) — rein, Server UND Browser ──
// Kevin 08.10.: „Schmal oben auf jeder Seite, solange ein Update läuft.“ Ablauf beim Ausrollen (deploy/ausrollen.sh):
//   ziehen → schreibt die Marke `<daten>/system/update.json` { seit (ISO, UTC), ziel (kurzer Commit) }
//   bild   → lädt das Bild, tauscht die Container und entfernt die Marke NACH dem Tausch (auch, wenn es scheitert)
// Die App liest die Marke (lib/bau/update-server.ts → GET /api/system/update) und zeigt im Kopf eine Zeile:
//   „Update läuft — kurz nichts Wichtiges speichern“, solange die Marke gilt, und
//   „Neue Version da — neu laden“, sobald der Server einen anderen Bau meldet als die Seite (lib/bau/kennung.ts).
// Eine Marke gilt NICHT (mehr), wenn sie
//   - älter als 20 Minuten ist (ein abgebrochenes Ausrollen hinterlässt sonst einen Dauerhinweis),
//   - unlesbar ist oder deutlich in der Zukunft liegt,
//   - vom eigenen Bau-Stand schon erledigt ist: der laufende Server ist NACH der Marke gestartet — dann ist er die neue
//     Version (der Tausch ist durch, nur das Löschen der Marke fehlte). Der Bau trägt keinen Commit (das Bild wird ohne
//     .git gebaut, die Bau-Kennung ist zufällig) — darum zählt der Startzeitpunkt des Servers, nicht der Commit.

/** Dateiname der Marke im Ordner `<daten>/system` (Klartext wie lage.json — kein Bestand, keine Personendaten). */
export const UPDATE_MARKE = 'update.json';
/** Älter als das → ignorieren. */
export const UPDATE_HOECHSTENS_MS = 20 * 60_000;
/** Etwas Spiel für Uhren (Host schreibt, Container liest — dieselbe Uhr, aber Sekunden-Rundung). */
const ZUKUNFT_SPIEL_MS = 5 * 60_000;
/** Abstand der Abfragen im Browser (nur bei sichtbarer Seite). */
export const UPDATE_ABFRAGE_MS = 60_000;

export const UPDATE_LAEUFT_TEXT = 'Update läuft — kurz nichts Wichtiges speichern';
export const NEUE_VERSION_TEXT = 'Neue Version da — neu laden';

export interface UpdateMarke { seit: string; ziel?: string }
export interface UpdateLage { laeuft: boolean; seit: string | null }
/** Antwort von GET /api/system/update — nur das, keine Inhalte. */
export interface UpdateAntwort { laeuft: boolean; seit: string | null; bau: string | null }

const NICHTS: UpdateLage = { laeuft: false, seit: null };

/** Die Marke aus dem Dateiinhalt (Text) oder einem schon gelesenen Objekt — null, wenn sie nicht taugt. */
export function markeLesen(roh: unknown): UpdateMarke | null {
  let o: unknown = roh;
  if (typeof roh === 'string') { try { o = JSON.parse(roh); } catch { return null; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const { seit, ziel } = o as { seit?: unknown; ziel?: unknown };
  if (typeof seit !== 'string' || !Number.isFinite(Date.parse(seit))) return null;
  return { seit, ...(typeof ziel === 'string' && /^[0-9a-f]{4,40}$/.test(ziel) ? { ziel } : {}) };
}

/**
 * Läuft gerade ein Update? `jetzt` = Uhrzeit (ms), `start` = Startzeit des laufenden Servers (ms). `seit` wird nur
 * weitergegeben, wenn die Marke gilt.
 */
export function updateLage(roh: unknown, o: { jetzt: number; start: number }): UpdateLage {
  const m = markeLesen(roh);
  if (!m) return NICHTS;
  const seitMs = Date.parse(m.seit);
  if (o.jetzt - seitMs > UPDATE_HOECHSTENS_MS) return NICHTS;     // zu alt — Ausrollen abgebrochen
  if (seitMs - o.jetzt > ZUKUNFT_SPIEL_MS) return NICHTS;          // Unsinn aus der Zukunft
  if (o.start >= seitMs) return NICHTS;                            // eigener Bau ist schon der neue
  return { laeuft: true, seit: new Date(seitMs).toISOString() };
}

export type UpdateAnzeige = 'laeuft' | 'neu' | null;

/**
 * Was die Zeile im Kopf zeigt. „neu“ hat Vorrang: der Server läuft schon mit einem anderen Bau als diese Seite — nur
 * Neuladen hilft. Ohne eigene Bau-Kennung (Entwicklung, Tests) gibt es kein „neu“.
 */
export function updateAnzeige(a: Pick<UpdateAntwort, 'laeuft' | 'bau'> | null, eigenerBau: string | null): UpdateAnzeige {
  if (!a) return null;
  if (eigenerBau && a.bau && a.bau !== eigenerBau) return 'neu';
  return a.laeuft ? 'laeuft' : null;
}

/** Die Antwort des Servers prüfen (alles andere → null, der alte Stand bleibt stehen). */
export function antwortLesen(d: unknown): UpdateAntwort | null {
  if (!d || typeof d !== 'object') return null;
  const { laeuft, seit, bau } = d as Record<string, unknown>;
  if (typeof laeuft !== 'boolean') return null;
  return { laeuft, seit: typeof seit === 'string' ? seit : null, bau: typeof bau === 'string' && bau ? bau : null };
}

/** Darf der Browser jetzt fragen? Höchstens alle 60 s — außer `sofort` (nach einer 409 „bitte neu laden“). */
export function abfrageFaellig(letzte: number | null, jetzt: number, sofort = false): boolean {
  return sofort || letzte === null || jetzt - letzte >= UPDATE_ABFRAGE_MS;
}

/**
 * Was der Browser nach einer Antwort tut (Gegenprüfung 08.10.: vorher nur im Bauteil, jetzt rein und getestet):
 *   401/403 → `aus` — ohne Sitzung bzw. gesperrt nie wieder fragen (die Zeile verschwindet),
 *   sonst kein 2xx → `behalten` — z. B. 502 während des Tauschs: der letzte Stand bleibt stehen,
 *   2xx → `lesen`.
 */
export function abfrageFolge(status: number): 'aus' | 'behalten' | 'lesen' {
  if (status === 401 || status === 403) return 'aus';
  return status >= 200 && status < 300 ? 'lesen' : 'behalten';
}

/**
 * Was die Zeile am Ende zeigt: „neu“ nicht, solange die Bau-Wache (components/os/BauWache.tsx) nach einer 409 „bitte neu
 * laden“ schon ihren eigenen Hinweis zeigt (der sagt zusätzlich, dass die Eingabe nicht gespeichert ist) — nie doppelt.
 */
export function hinweisZeigen(anzeige: UpdateAnzeige, wacheZeigt: boolean): UpdateAnzeige {
  return anzeige === 'neu' && wacheZeigt ? null : anzeige;
}
