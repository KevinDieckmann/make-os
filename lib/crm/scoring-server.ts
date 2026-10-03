// ─── Scoring-Einstellungen — der eigene Bestand (Server, 03.10.) ─────────────
// Bestand `crm-scoring` (ein Bestand für das ganze CRM wie `crm` selbst — geteilt von Kevin und Malin, kein Personenbezug):
//   { einstellungen, vorherige[], verlauf[] }
// Fehlt der Bestand, gilt der Standard (nichts wird geschrieben, bis jemand etwas einstellt). Der Standard ist seit 03.10. der
// geschärfte Vorschlag (Kevin: „sofort übernehmen“); die alte Rechnung bleibt als wählbare Fassung „Bisherige Rechnung“ (art: 'bisherig').
// Wer schon etwas gespeichert hat, behält es — auch die alte Rechnung, falls sie einmal als „Standard“ gespeichert wurde (sie wird beim Lesen
// als „bisherig“ erkannt und angezeigt, die Zahlen ändern sich nicht). Jede Änderung hat einen
// Stand (Fingerabdruck der Einstellungen): passt er nicht mehr, 409 mit dem aktuellen Stand — kein stilles Überschreiben
// zu zweit. Geschrieben wird nur von einer angemeldeten Person des Haushalts (Routen: Dienstweg → 403).
// Versioniert: `version` im Bestand (Schemaversion), dazu die letzten `VORHERIGE_MAX` Fassungen — „letzte Änderung
// zurücknehmen“ legt die vorige Fassung wieder auf (und merkt die verworfene als neue vorige).
// `ladeCrm()` (lib/crm/speicher.ts) hängt die Einstellungen beim LESEN an den CRM-Bestand (`crm.scoring`), damit jede
// Stelle, die Leads rechnet, dieselben Werte sieht — gespeichert wird dort nie etwas.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { scoringPruefen, scoringSaeubern, standardScoring, bisherigeRechnung, scoringOderStandard, SCORING_VERSION, type ScoringEinstellungen, type ScoringFehler } from './scoring';

export const SCORING_BESTAND = 'crm-scoring';
/** So viele frühere Fassungen bleiben für „Zurück“ (ältere fallen weg — es ist Bedienkomfort, kein Nachweis). */
export const VORHERIGE_MAX = 10;
export const VERLAUF_MAX = 50;

export interface ScoringVermerk { am: string; von: string; quelle: NonNullable<ScoringEinstellungen['quelle']>; was: string }
export interface ScoringDatei { version: number; einstellungen: ScoringEinstellungen; vorherige: ScoringEinstellungen[]; verlauf: ScoringVermerk[] }

/** Der Inhalt ohne Vermerk (wer/wann/woher) — zum Vergleichen. */
const inhaltStand = (e: ScoringEinstellungen): string => scoringStand({ ...e, geaendert: undefined, geaendertVon: undefined, quelle: undefined } as ScoringEinstellungen);
/** Als „Standard“ gespeicherte Einstellungen, die genau die bisherige Rechnung sind, heißen „bisherig“ — nur das Etikett, nie der Inhalt. */
function etikett(e: ScoringEinstellungen): ScoringEinstellungen {
  return e.quelle === 'standard' && inhaltStand(e) === inhaltStand(bisherigeRechnung()) ? { ...e, quelle: 'bisherig' } : e;
}

const leer = (): ScoringDatei => ({ version: SCORING_VERSION, einstellungen: standardScoring(), vorherige: [], verlauf: [] });

/** Die Datei aus dem Bestand lesen — beschädigte Einstellungen fallen auf den Standard zurück (nie ein Absturz beim Rechnen). */
export function scoringDateiAus(roh: unknown): ScoringDatei {
  if (!roh || typeof roh !== 'object') return leer();
  const o = roh as Record<string, unknown>;
  const vorherige = (Array.isArray(o.vorherige) ? o.vorherige : []).map(v => scoringSaeubern(v)).filter((v): v is ScoringEinstellungen => !!v);
  const verlauf = (Array.isArray(o.verlauf) ? o.verlauf : []).filter((v): v is ScoringVermerk => !!v && typeof (v as ScoringVermerk).am === 'string' && typeof (v as ScoringVermerk).von === 'string');
  return { version: SCORING_VERSION, einstellungen: etikett(scoringOderStandard(o.einstellungen)), vorherige: vorherige.map(etikett), verlauf };
}

export async function scoringDateiLaden(): Promise<ScoringDatei> {
  return scoringDateiAus(await loadJson<unknown>(SCORING_BESTAND));
}
/** Die geltenden Einstellungen — Standard, solange nichts gespeichert ist. */
export async function ladeScoring(): Promise<ScoringEinstellungen> {
  return (await scoringDateiLaden()).einstellungen;
}

/** Der Stand der Einstellungen (Fingerabdruck) — der Browser schickt ihn zurück, sonst 409. */
export const scoringStand = (e: ScoringEinstellungen): string => fingerabdruck(e as unknown as Record<string, unknown>);

export type ScoringSchreibErgebnis =
  | { ok: true; einstellungen: ScoringEinstellungen; stand: string }
  | { ok: false; art: 'konflikt'; einstellungen: ScoringEinstellungen; stand: string }
  | { ok: false; art: 'fehler'; fehler: ScoringFehler[]; status: 400 | 413 }
  | { ok: false; art: 'nichts'; text: string };

/** Was geschrieben werden soll: eigene Eingabe, der Standard, die bisherige Rechnung (bis 03.10.) oder die vorige Fassung. */
export type ScoringAuftrag =
  | { art: 'eigen'; roh: unknown }
  | { art: 'standard' }
  | { art: 'bisherig' }
  | { art: 'zurueck' };

/**
 * Einstellungen ändern — in EINER Sperre, mit Stand (409 bei Abweichung), gesäubert (nie still gekürzt: Fehler → 400/413,
 * nichts geschrieben), mit Vermerk (wer, wann, woher) und der alten Fassung unter `vorherige`.
 */
export async function scoringSchreiben(auftrag: ScoringAuftrag, stand: unknown, person: string, wer?: Wer, jetzt = new Date().toISOString()): Promise<ScoringSchreibErgebnis> {
  let ergebnis: ScoringSchreibErgebnis = { ok: false, art: 'nichts', text: 'Nichts geändert.' };
  let vorher: ScoringDatei | null = null;
  const nachher = await updateJson<ScoringDatei>(SCORING_BESTAND, cur => {
    const d = scoringDateiAus(cur);
    vorher = d;
    const jetztStand = scoringStand(d.einstellungen);
    if (typeof stand !== 'string' || stand !== jetztStand) { ergebnis = { ok: false, art: 'konflikt', einstellungen: d.einstellungen, stand: jetztStand }; return cur ?? d; }
    let neu: ScoringEinstellungen | null = null;
    let quelle: ScoringVermerk['quelle'] = 'eigen';
    let was = 'Einstellungen geändert';
    let vorherigeNeu = d.vorherige;
    if (auftrag.art === 'eigen') {
      const f = scoringPruefen(auftrag.roh);
      if (f.length) { ergebnis = { ok: false, art: 'fehler', fehler: f, status: f.some(x => x.status === 413) ? 413 : 400 }; return cur ?? d; }
      neu = scoringSaeubern(auftrag.roh, { quelle: 'eigen', geaendert: jetzt, geaendertVon: person });
    } else if (auftrag.art === 'standard') { neu = { ...standardScoring(), quelle: 'standard', geaendert: jetzt, geaendertVon: person }; quelle = 'standard'; was = 'Auf Standard zurückgesetzt'; }
    else if (auftrag.art === 'bisherig') { neu = { ...bisherigeRechnung(), quelle: 'bisherig', geaendert: jetzt, geaendertVon: person }; quelle = 'bisherig'; was = 'Bisherige Rechnung (bis 03.10.) übernommen'; }
    else {
      const vor = d.vorherige[0];
      if (!vor) { ergebnis = { ok: false, art: 'nichts', text: 'Es gibt keine frühere Fassung.' }; return cur ?? d; }
      neu = { ...vor, geaendert: jetzt, geaendertVon: person }; quelle = vor.quelle ?? 'eigen'; was = 'Letzte Änderung zurückgenommen';
      vorherigeNeu = [d.einstellungen, ...d.vorherige.slice(1)];
    }
    if (!neu) { ergebnis = { ok: false, art: 'nichts', text: 'Die Einstellungen waren nicht lesbar.' }; return cur ?? d; }
    // Unverändert (gleiche Einstellungen, nur anderer Vermerk) → nichts schreiben.
    if (auftrag.art !== 'zurueck' && scoringStand({ ...neu, geaendert: undefined, geaendertVon: undefined, quelle: undefined } as ScoringEinstellungen) === scoringStand({ ...d.einstellungen, geaendert: undefined, geaendertVon: undefined, quelle: undefined } as ScoringEinstellungen)) {
      ergebnis = { ok: true, einstellungen: d.einstellungen, stand: jetztStand };
      return cur ?? d;
    }
    const datei: ScoringDatei = {
      version: SCORING_VERSION, einstellungen: neu,
      vorherige: auftrag.art === 'zurueck' ? vorherigeNeu : [d.einstellungen, ...d.vorherige].slice(0, VORHERIGE_MAX),
      verlauf: [{ am: jetzt, von: person, quelle, was }, ...d.verlauf].slice(0, VERLAUF_MAX),
    };
    ergebnis = { ok: true, einstellungen: neu, stand: scoringStand(neu) };
    return datei;
  });
  if (ergebnis.ok) await protokolliereBestand(SCORING_BESTAND, vorher as unknown as Record<string, unknown> | null, nachher as unknown as Record<string, unknown>, wer);
  return ergebnis;
}
