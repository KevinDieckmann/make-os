// ─── Überblick „Für dich“ — der Fluss je Bereich (04.10.2026 abends, rein, client-sicher) ─
// Kevin (04.10., Markttraktion › Überblick „Für dich“): „finde ich mega. Lass uns so immer den Überblick gestalten und dann den
// Flow so anzeigen, wie es die letzten 3 Monate war, wie es jetzt ist und wie der Forecast ist … für jeden einzelnen Bereich.“
// (UMBAU_ABEND_0410.md › 4)
//
// EIN Modell für alle Bereiche: eine Ist-Reihe der letzten drei Monate (bis einschließlich der laufenden Woche bzw. des
// laufenden Monats), HEUTE, eine Prognose-Reihe ab der laufenden Periode und wenige priorisierte Zeilen. Gerechnet wird NUR
// auf dem Server (lib/fluss/server.ts, Route GET /api/fluss) — gefiltert nach Person, Haushalt und Sicht (Privat nie im
// Business, „nur ich“ nie bei der anderen Person). Die Prognose kommt NUR aus echten Daten (Fälligkeiten, Pipeline ×
// Wahrscheinlichkeit, Pläne/Raten, Termine); fehlt die Grundlage, ist `prognose` leer und `prognoseGrundlage` null — die Karte
// zeigt dann einen klaren Leerzustand, nie eine Schätzung. Der Baustein: components/os/ui/fluss.tsx (`FlussKarte`).

/** Die Bereiche mit Überblick (Liste aus der Navigation). Wissen/Brain hat keine sinnvolle Zeitreihe — bewusst nicht dabei. */
export const FLUSS_BEREICHE = [
  'markttraktion', 'finanzen-privat', 'finanzen-business', 'planung', 'aufgaben', 'kalender', 'gesundheit', 'familie', 'netzwerken', 'inbox',
] as const;
export type FlussBereich = (typeof FLUSS_BEREICHE)[number];
export const istFlussBereich = (v: unknown): v is FlussBereich => (FLUSS_BEREICHE as readonly unknown[]).includes(v);

/** Raster der Reihen: Woche (13 Wochen zurück, 13 voraus) oder Monat (3 zurück, 3 voraus) — je „−3 M · heute · +3 M“. */
export type FlussRaster = 'woche' | 'monat';
export const FLUSS_FENSTER = { woche: 13, monat: 4 } as const;

export type FlussEinheit = 'anzahl' | 'euro' | 'stunden';
export type FlussTon = 'gut' | 'achtung' | 'kritisch' | 'info' | 'neutral';

/** Eine priorisierte Zeile unter der Linie: Punkt · Titel · Unterzeile (Bereich und Handlung) · Zahl-Pille. */
export interface FlussZeile { id: string; titel: string; unter: string; zahl?: string; ton?: FlussTon; link?: string }

export interface FlussReihe {
  bereich: FlussBereich;
  /** Was die Linie zeigt, z. B. „Aufgaben je Woche“. */
  titel: string;
  einheit: FlussEinheit;
  raster: FlussRaster;
  /** Der Tag der Rechnung (Berliner Tag vom Server). */
  heute: string;
  /** Ist: älteste zuerst, die letzte Periode ist die laufende (bis heute). Länge FLUSS_FENSTER[raster]. */
  ist: number[];
  /** Was die Ist-Reihe zählt, z. B. „erledigt“. */
  istLabel: string;
  /** Prognose: die erste Periode ist die laufende (ab heute). Leer = keine Grundlage. */
  prognose: number[];
  /** Woraus die Prognose gerechnet ist, z. B. „aus Fälligkeiten“ — null = keine Grundlage (Leerzustand). */
  prognoseGrundlage: string | null;
  /** Was die Prognose zählt, z. B. „fällig“. */
  prognoseLabel: string;
  zeilen: FlussZeile[];
  /** Satz, wenn es im Bereich noch gar nichts gibt (Ist leer und keine Prognose). */
  leer?: string;
}

/** Höchstens so viele Zeilen (80/20: die Linie ist der Akzent, darunter wenige priorisierte Zeilen). */
export const FLUSS_ZEILEN_MAX = 4;

// ── Reihen (rein; `heute` kommt immer vom Aufrufer) ─────────────────────────

const TAG_MS = 864e5;
const ms = (t: string) => Date.parse(`${t.slice(0, 10)}T12:00:00Z`);
const tagOk = (t: unknown): t is string => typeof t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t) && Number.isFinite(ms(t));
const montag = (t: string) => { const m = ms(t); return m - ((new Date(m).getUTCDay() + 6) % 7) * TAG_MS; };
const monatIndex = (t: string) => Number(t.slice(0, 4)) * 12 + Number(t.slice(5, 7)) - 1;
const rund = (v: number) => Math.round(v * 100) / 100;

export interface FlussEintrag { tag?: string | null; wert?: number }

/**
 * Ist-Reihe: Summe je Periode der letzten `n` Perioden bis einschließlich der laufenden (älteste zuerst). Was nach heute liegt,
 * zählt nicht (Ist ist geschehen). `wert` fehlt = 1 (Anzahl).
 */
export function istReihe(eintraege: readonly FlussEintrag[], heute: string, raster: FlussRaster, n = FLUSS_FENSTER[raster]): number[] {
  const aus = new Array<number>(n).fill(0);
  for (const e of eintraege) {
    if (!tagOk(e.tag) || e.tag.slice(0, 10) > heute) continue;
    const zurueck = raster === 'woche' ? Math.round((montag(heute) - montag(e.tag)) / (7 * TAG_MS)) : monatIndex(heute) - monatIndex(e.tag);
    if (zurueck >= 0 && zurueck < n) aus[n - 1 - zurueck] += Number.isFinite(e.wert) ? (e.wert as number) : 1;
  }
  return aus.map(rund);
}

/**
 * Prognose-Reihe: Summe je Periode ab der laufenden (erste = laufende, `n` Perioden). Überfälliges (Tag vor heute) zählt in die
 * laufende Periode, wenn `ueberfaelligHeute` (Standard) — es bindet JETZT; sonst fällt es weg. Danach Liegendes zählt nicht.
 */
export function prognoseReihe(eintraege: readonly FlussEintrag[], heute: string, raster: FlussRaster, o: { n?: number; ueberfaelligHeute?: boolean } = {}): number[] {
  const n = o.n ?? FLUSS_FENSTER[raster];
  const aus = new Array<number>(n).fill(0);
  for (const e of eintraege) {
    if (!tagOk(e.tag)) continue;
    let i = raster === 'woche' ? Math.round((montag(e.tag) - montag(heute)) / (7 * TAG_MS)) : monatIndex(e.tag) - monatIndex(heute);
    if (e.tag.slice(0, 10) < heute) { if (o.ueberfaelligHeute === false) continue; i = 0; }
    if (i >= 0 && i < n) aus[i] += Number.isFinite(e.wert) ? (e.wert as number) : 1;
  }
  return aus.map(rund);
}

/** Eine Prognose mit Grundlage, oder ehrlich keine: ohne einen einzigen terminierten Eintrag → leer + null. */
export function mitGrundlage(reihe: number[], eintraege: number, grundlage: string): { prognose: number[]; prognoseGrundlage: string | null } {
  return eintraege > 0 ? { prognose: reihe, prognoseGrundlage: grundlage } : { prognose: [], prognoseGrundlage: null };
}

/** Taugt die Reihe für die Linie? Ist hat mindestens zwei Werte; die Karte zeigt sonst den Leerzustand. */
export function flussHatLinie(f: Pick<FlussReihe, 'ist' | 'prognose'>): boolean {
  return f.ist.length >= 2 && (f.ist.some(v => v !== 0) || f.prognose.some(v => v !== 0));
}

// ── Beschriftung & Text ──────────────────────────────────────────────────────

/** Die Achse: „−3 M · heute · +3 M“. */
export const flussAchse = (_raster: FlussRaster): [string, string, string] => ['−3 M', 'heute', '+3 M'];

const zahlText = (v: number, einheit: FlussEinheit) =>
  einheit === 'euro' ? `${Math.round(v).toLocaleString('de-DE')} €` : einheit === 'stunden' ? `${(Math.round(v * 10) / 10).toLocaleString('de-DE')} h` : String(Math.round(v * 10) / 10).replace('.', ',');

/**
 * Der Text für Vorleser (aria-label der Linie): „Aufgaben je Woche. Ist, erledigt, letzte 3 Monate: zusammen 24, diese Woche 3.
 * Prognose aus Fälligkeiten, fällig, nächste 3 Monate: zusammen 18, diese Woche 5.“ — bzw. „Keine Prognose: …“.
 */
export function flussText(f: FlussReihe): string {
  const summe = (r: number[]) => r.reduce((a, v) => a + v, 0);
  const jetzt = f.raster === 'woche' ? 'diese Woche' : 'dieser Monat';
  const ist = `Ist (${f.istLabel}), letzte 3 Monate: zusammen ${zahlText(summe(f.ist), f.einheit)}, ${jetzt} ${zahlText(f.ist.at(-1) ?? 0, f.einheit)}`;
  const prog = f.prognoseGrundlage
    ? `Prognose ${f.prognoseGrundlage} (${f.prognoseLabel}), nächste 3 Monate: zusammen ${zahlText(summe(f.prognose), f.einheit)}, ${jetzt} ${zahlText(f.prognose[0] ?? 0, f.einheit)}`
    : 'Keine Prognose — es liegt nichts Terminiertes vor';
  return `${f.titel}. ${ist}. ${prog}.`;
}
export const flussZahl = zahlText;
