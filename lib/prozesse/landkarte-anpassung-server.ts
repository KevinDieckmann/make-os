// ─── Prozesse — Landkarte anpassen: der Bestand (Server, 22.10.) ─────────────────────────────────────────────────────────────────────────────────────
// Bestand `prozesse-landkarte--<haushalt>` (Haushalt des Inhabers — dieselbe Grenze wie die Werkstatt, nur Business): NUR die Abweichungen der Landkarte von
// der Vorgabe (Namen und Töne der Bereiche, eigene Bereiche, Zuordnung/Beschriftung/Ausblenden der Kacheln, Reihenfolge) — keine Daten Dritter; Personen nur
// als Speichername (`geaendertVon`). Eigener Bestand (nicht im Werkstatt-Bestand), damit ein älterer Stand nichts davon verliert und nichts verwirft.
// Gelesen nur über `anpassungLesen` (Säuberer, schreibt nie; ohne Bestand die Vorgabe), geschrieben nur über `anpassungSchreiben`: EINE Sperre, Stand/409,
// alles oder nichts, unverändert = kein Schreiben, Änderungsprotokoll ohne Werte. Regeln rein: ./landkarte-anpassung.ts.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { anpassungAendern, anpassungAus, type AnpassungErgebnis, type LandkarteAnpassung } from './landkarte-anpassung';
import { prozesseOhnePerson } from './werkstatt-server';
import type { ProzessDef } from './typen';

/** Der Bestand der Landkarten-Anpassung je Haushalt. */
export const landkarteBestand = (h: string): string => `prozesse-landkarte--${h}`;

/** Stand der Anpassung (für 409) — Fingerabdruck ohne Verwaltungsfelder. Nie gespeichert. */
export const anpassungStand = (a: LandkarteAnpassung): string => fingerabdruck(a as unknown as Record<string, unknown>);

export async function anpassungLesen(h: string): Promise<LandkarteAnpassung> {
  return anpassungAus(await loadJson<unknown>(landkarteBestand(h)));
}

export type SchreibErgebnis = AnpassungErgebnis | { ok: false; status: 409; fehler: string; aktuell: LandkarteAnpassung };

/** Schritte anwenden (EINE Sperre): Stand prüfen (409 mit der aktuellen Fassung), Regeln anwenden, nur bei Änderung schreiben und protokollieren. */
export async function anpassungSchreiben(h: string, a: { stand: unknown; ops: unknown; prozesse: readonly ProzessDef[]; person: string; jetzt: string; wer: Wer }): Promise<SchreibErgebnis> {
  const name = landkarteBestand(h);
  let ergebnis: SchreibErgebnis = { ok: false, status: 400, fehler: 'Nichts gespeichert.' };
  let vorher: unknown = null;
  let geschrieben = false;
  const nachher = await updateJson<unknown>(name, cur => {
    const alt = anpassungAus(cur);
    vorher = alt;
    if (typeof a.stand !== 'string' || a.stand !== anpassungStand(alt)) {
      ergebnis = { ok: false, status: 409, fehler: 'Inzwischen hat jemand anders die Landkarte angepasst — die aktuelle Fassung ist geladen. Nichts gespeichert.', aktuell: alt };
      return cur;
    }
    const r = anpassungAendern(alt, a.ops, { prozesse: a.prozesse, jetzt: a.jetzt, person: a.person });
    ergebnis = r;
    if (!r.ok || !r.geaendert) return cur;
    geschrieben = true;
    return r.anpassung;
  });
  if (geschrieben) await protokolliereBestand(name, vorher, nachher, a.wer);
  return ergebnis;
}

/** Konto löschen: der Speichername in `geaendertVon` → „[gelöscht]“ (dieselbe Regel wie die Werkstatt). */
export async function landkarteKontoLoeschen(h: string, speicher: string): Promise<number> {
  const name = landkarteBestand(h);
  if ((await loadJson<unknown>(name)) === null) return 0;
  let n = 0;
  await updateJson<unknown>(name, cur => { const r = prozesseOhnePerson(cur, speicher); n = r.n; return r.wert; });
  if (n) await protokolliere(name, [{ op: 'geaendert', id: 'konto', felder: ['geaendertVon'] }], { art: 'system' });
  return n;
}
