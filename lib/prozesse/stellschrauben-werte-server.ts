// ─── Prozesse — der Bestand der neuen Stellschrauben (Server; 22.10., Branch `prozesse-stellschrauben`) ──────────────────────────────────────────────────────
// Bestand `prozesse-stellschrauben--<haushalt>` (Haushalt des Inhabers — dieselbe Grenze wie Werkstatt und Landkarte, nur Business): NUR Abweichungen von der
// Vorgabe (Regeln rein: ./stellschrauben-werte.ts). Keine Daten Dritter; Person nur als Speichername (`geaendertVon`).
//   Lesen für die ausführenden Stellen: `stellschraubenWerte()` — nie werfen: ist der Bestand nicht lesbar, gilt die Vorgabe (genau das Verhalten vor dem
//   22.10.) und das Log sagt es. Lesen für Oberfläche/Route: `stellschraubenLesen(h)` (wirft wie jeder Bestand, die Route antwortet dann 500).
//   Schreiben: `stellschraubenSchreiben` — EINE Sperre, Stand/409 mit der aktuellen Fassung, alles oder nichts, unverändert = kein Schreiben,
//   Änderungsprotokoll ohne Werte (nur Kennungen).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { bestandAus, reportTage, werteAendern, type AendernErgebnis, type StellschraubenBestand, type Werte } from './stellschrauben-werte';

/** Der Bestand je Haushalt. */
export const stellschraubenBestand = (h: string): string => `prozesse-stellschrauben--${h}`;
/** Stand für 409 — Fingerabdruck der Werte (ohne Verwaltungsfelder). Nie gespeichert. */
export const stellschraubenStand = (b: StellschraubenBestand): string => fingerabdruck({ werte: b.werte });

async function haushalt(): Promise<string> {
  const { prozesseHaushalt } = await import('./werkstatt-server');
  return prozesseHaushalt();
}

export async function stellschraubenLesen(h?: string): Promise<StellschraubenBestand> {
  return bestandAus(await loadJson<unknown>(stellschraubenBestand(h ?? await haushalt())));
}

/** Für die ausführenden Stellen (Takt, Buchung, Kapazität, Treppe): die wirksamen Abweichungen — nicht lesbar = Vorgabe (wie vor dem 22.10.). */
export async function stellschraubenWerte(h?: string): Promise<Werte> {
  try { return (await stellschraubenLesen(h)).werte; } catch (e) {
    console.error('[prozesse-stellschrauben] Bestand nicht lesbar — es gelten die Vorgaben:', e instanceof Error ? e.message.slice(0, 120) : e);
    return {};
  }
}

/** Abstand der Fortschritts-Reports (Tage) für Treppe, Fulfillment-Kennzahl und Zeitachse — Kurzform über `reportTage`. */
export async function reportTageWirksam(h?: string): Promise<number> { return reportTage(await stellschraubenWerte(h)); }

export type SchreibErgebnis = AendernErgebnis | { ok: false; status: 409; fehler: string; aktuell: StellschraubenBestand };

/** Änderungen anwenden (EINE Sperre): Stand prüfen (409 mit der aktuellen Fassung), Regeln anwenden, nur bei Änderung schreiben und protokollieren. */
export async function stellschraubenSchreiben(h: string, a: { stand: unknown; ops: unknown; person: string; jetzt: string; wer: Wer }): Promise<SchreibErgebnis> {
  const name = stellschraubenBestand(h);
  let ergebnis: SchreibErgebnis = { ok: false, status: 400, fehler: 'Nichts gespeichert.' };
  await updateJson<unknown>(name, cur => {
    const alt = bestandAus(cur);
    if (typeof a.stand !== 'string' || a.stand !== stellschraubenStand(alt)) {
      ergebnis = { ok: false, status: 409, fehler: 'Inzwischen hat jemand anders die Stellschrauben geändert — die aktuelle Fassung ist geladen. Nichts gespeichert.', aktuell: alt };
      return cur;
    }
    const r = werteAendern(alt, a.ops, { person: a.person, jetzt: a.jetzt });
    ergebnis = r;
    return r.ok && r.geaendert.length ? r.bestand : cur;
  });
  const e = ergebnis as SchreibErgebnis; // in der Sperre gesetzt (TS verfolgt das nicht)
  if (e.ok && e.geaendert.length) await protokolliere(name, [{ liste: 'werte', op: 'geaendert', id: 'werte', felder: [...e.geaendert] }], a.wer).catch(() => {});
  return e;
}

/** Konto löschen: der Speichername in `geaendertVon` → „[gelöscht]“ (die Werte bleiben — Einstellungen des Haushalts). */
export async function stellschraubenKontoLoeschen(h: string, speicher: string): Promise<number> {
  const name = stellschraubenBestand(h);
  const roh = await loadJson<{ geaendertVon?: unknown }>(name);
  if (!roh || roh.geaendertVon !== speicher) return 0;
  await updateJson<unknown>(name, cur => (cur && typeof cur === 'object' ? { ...(cur as Record<string, unknown>), geaendertVon: '[gelöscht]' } : cur));
  await protokolliere(name, [{ op: 'geaendert', id: 'konto', felder: ['geaendertVon'] }], { art: 'system' });
  return 1;
}
