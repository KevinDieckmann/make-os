// ─── MAKE OS — Schwellen (Server) ───────────────────────────────────────────
// EINE Quelle für alle Grenzwerte, die vorher an mehreren Stellen im Code
// standen — teils mit unterschiedlichen Zahlen für dieselbe Frage.
// Die Werte kommen aus dem Kompass; ohne Einstellung gilt die Lage.
//
// Nur auf dem Server benutzen (liest den Datei-Store).

import { loadJson } from '@/lib/store/local-db';
import { wertVon, STANDARD_MODUS, type ReglerId } from '@/lib/make-one/kompass-data';

interface KompassFile { modus: string; eigene: Record<string, number> }

export interface Schwellen {
  /** Ab wann eine Säule als „im Fokus" gilt. */
  fokusSchwelle: number;
  /** Stunden, die ein Tag höchstens tragen soll. */
  tageslast: number;
  /** Stunden pro Woche, ab denen gewarnt wird. */
  wochenlast: number;
  /** Zahl kritischer Aufgaben, ab der Alarm läuft. */
  kritischGrenze: number;
  /** Tage Vorausschau für Zeitstrahl und Fällig-Gruppen. */
  vorschauTage: number;
  /** Erholungswert, ab dem ein Tag grün ist (gelb liegt 26 Punkte darunter). */
  recoveryGruen: number;
  recoveryGelb: number;
  /** Monate Geldreichweite, unter denen rot gewarnt wird (amber = doppelt). */
  runwayRot: number;
  runwayAmber: number;
  /** Uhrzeit, ab der abends nichts mehr automatisch läuft. */
  nachtruheAb: number;
  /** Läuft der Tageslauf beim Öffnen von selbst? */
  tagesstartAuto: boolean;
  /** Dürfen Gesundheitswerte in Agenten-Aufträge? */
  koerperAnAgenten: boolean;
}

/** Fällt auf die Lage zurück, wenn nichts eingestellt ist. */
export async function schwellen(): Promise<Schwellen> {
  const f = await loadJson<KompassFile>('kompass');
  const modus = f?.modus ?? STANDARD_MODUS;
  const eigene = (f?.eigene ?? {}) as Partial<Record<ReglerId, number>>;
  const w = (id: ReglerId) => wertVon(id, modus, eigene);

  const gruen = w('recovery-gruen');
  const runway = w('runway-warnung');
  return {
    fokusSchwelle: w('fokus-schwelle'),
    tageslast: w('tageslast'),
    wochenlast: w('wochenlast'),
    kritischGrenze: w('kritisch-grenze'),
    vorschauTage: w('vorschau-tage'),
    recoveryGruen: gruen,
    // Der Abstand grün→gelb bleibt konstant, damit die Ampel drei echte
    // Stufen behält, egal wo die grüne Grenze liegt.
    recoveryGelb: Math.max(20, gruen - 26),
    runwayRot: runway,
    runwayAmber: runway * 2,
    nachtruheAb: w('nachtruhe-ab'),
    tagesstartAuto: w('tagesstart-auto') >= 50,
    koerperAnAgenten: w('koerper-an-agenten') >= 50,
  };
}
