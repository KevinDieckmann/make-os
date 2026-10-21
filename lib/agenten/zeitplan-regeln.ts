// ─── Reine Zeitplan-Regeln der Agenten (ohne Server-Bezug, auch im Browser nutzbar) ─────────────────────────────────────────────
// 22.10.: aus lib/agenten/zeitplan.ts herausgelöst, weil die Werkstatt der Prozesse (Client) Auslöser prüft und zeitplan.ts per
// dynamischem Import Server-Code nachlädt. zeitplan.ts reicht alles weiter — Leser ändern nichts.

import type { Rhythmus } from './typen';

/** Agenten-Läufe des Takts nur in diesem Fenster (Berliner Stunden) — dieselben Werte wie VON/BIS in lib/zoe/takt.ts (Wächter). */
export const TAKT_VON = 7;
export const TAKT_BIS = 22;
export const UHRZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** Ein Slot ab `TAKT_BIS` liefe an seinem Tag nie (Nachtruhe des Takts) — davor geplante laufen ab `TAKT_VON`. */
export const FENSTER_FEHLER = `Agenten-Läufe starten zwischen ${TAKT_VON}:00 und ${TAKT_BIS}:00 Uhr — frühere Zeiten laufen um ${TAKT_VON}:00, spätere gar nicht.`;
export const RHYTHMEN: readonly Rhythmus[] = ['taeglich', 'werktags', 'woechentlich', 'monatlich'];
export type Pruefung<T> = { ok: true; wert: T } | { ok: false; status: 400 | 413; fehler: string };

/** Rhythmus, Uhrzeit, Tage eines wiederkehrenden Zeitplans prüfen (rein). */
export function wiederkehrendPruefen(roh: { rhythmus?: unknown; uhrzeit?: unknown; tage?: unknown }): Pruefung<{ rhythmus: Rhythmus; uhrzeit: string; tage?: number[] }> {
  if (!RHYTHMEN.includes(roh.rhythmus as Rhythmus)) return { ok: false, status: 400, fehler: 'Rhythmus: täglich, werktags, wöchentlich oder monatlich.' };
  const rhythmus = roh.rhythmus as Rhythmus;
  if (typeof roh.uhrzeit !== 'string' || !UHRZEIT.test(roh.uhrzeit)) return { ok: false, status: 400, fehler: 'Uhrzeit als „HH:MM“ (Berliner Zeit).' };
  if (Number(roh.uhrzeit.slice(0, 2)) >= TAKT_BIS) return { ok: false, status: 400, fehler: FENSTER_FEHLER };
  let tage: number[] | undefined;
  if (roh.tage !== undefined && roh.tage !== null) {
    if (!Array.isArray(roh.tage)) return { ok: false, status: 400, fehler: 'Tage als Liste.' };
    const max = rhythmus === 'woechentlich' ? 7 : rhythmus === 'monatlich' ? 31 : 0;
    if (!max && roh.tage.length) return { ok: false, status: 400, fehler: 'Tage gibt es nur bei „wöchentlich“ (1 = Montag … 7 = Sonntag) und „monatlich“ (1–31).' };
    if (roh.tage.length > max) return { ok: false, status: 413, fehler: `Höchstens ${max} Tage.` };
    if (!roh.tage.every(t => Number.isInteger(t) && (t as number) >= 1 && (t as number) <= max)) return { ok: false, status: 400, fehler: rhythmus === 'woechentlich' ? 'Wochentage 1 (Montag) bis 7 (Sonntag).' : 'Monatstage 1 bis 31.' };
    tage = Array.from(new Set(roh.tage as number[])).sort((a, b) => a - b);
    if (!tage.length) tage = undefined;
  }
  return { ok: true, wert: { rhythmus, uhrzeit: roh.uhrzeit, ...(tage ? { tage } : {}) } };
}

