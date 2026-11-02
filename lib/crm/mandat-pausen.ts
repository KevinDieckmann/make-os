// ─── Mandat — Pausen (02.11., Kreislauf Runde 3, Fund 2; rein, client-sicher, getestet in tests/kreislauf-runde3.test.ts) ─────────────
// Vorher kannte das Mandat nur seinen Status: nach „pausiert → aktiv“ legte der Morgenlauf die Monate der Pause als Entwürfe nach (es gab keine
// Geschichte). Jetzt hält der SERVER jeden Wechsel aktiv ↔ pausiert als Zeitraum fest — der Browser kann die Pausen weder setzen noch ändern.
//   · `pausenSaeubern`  Form (Tage gültig, bis ≥ von, höchstens eine offene, sortiert) — der Säuberer kürzt nie, die Grenze prüft `pausenStempeln`
//   · `pausenStempeln`  aus Alt- und Neu-Status die Pausen fortschreiben (immer vom GESPEICHERTEN Stand aus)
//   · `offenePause`     läuft gerade eine Pause (ohne `bis`)?
//   · `pausiertAm`      ist ein Tag pausiert?

import type { Mandat, MandatPause, MandatStatus } from './typen';

/** Höchstens so viele Pausen je Mandat — darüber lehnt der Schreibweg ab (413), nie gekürzt. */
export const PAUSEN_MAX = 500;

const tagOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const tagMinus1 = (d: string) => new Date(Date.parse(`${d}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);

/** Form der Pausen-Liste: gültige Tage, `bis` ≥ `von`, nur die letzte darf offen sein, sortiert nach Beginn. Fehlt etwas, fällt der Eintrag weg. */
export function pausenSaeubern(roh: unknown, max = PAUSEN_MAX): MandatPause[] | undefined {
  if (!Array.isArray(roh)) return undefined;
  const l: MandatPause[] = [];
  for (const x of roh as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || !tagOk(x.von)) continue;
    if (x.bis !== undefined && !(tagOk(x.bis) && x.bis >= x.von)) continue;
    l.push(tagOk(x.bis) ? { von: x.von, bis: x.bis } : { von: x.von });
  }
  l.sort((a, b) => a.von.localeCompare(b.von));
  // Nur die jüngste darf offen sein — eine ältere offene endet am Tag vor der nächsten.
  const raus = l.map((p, i) => (!p.bis && i < l.length - 1 ? { von: p.von, bis: tagMinus1(l[i + 1].von) } : p)).filter(p => !p.bis || p.bis >= p.von);
  return raus.length ? raus.slice(0, max) : undefined;
}

/** Läuft gerade eine Pause (ein Eintrag ohne `bis`)? */
export const offenePause = (m: Pick<Mandat, 'pausen'> | Partial<Pick<Mandat, 'pausen'>>): MandatPause | undefined => (m.pausen ?? []).find(p => !p.bis);

/** Ist dieser Tag pausiert (in einer Pause, beide Tage eingeschlossen; eine offene Pause gilt ab ihrem Beginn)? */
export const pausiertAm = (pausen: readonly MandatPause[] | undefined, tag: string): boolean => !!pausen?.some(p => tagOk(p.von) && p.von <= tag && (!p.bis || tag <= p.bis));

export type PausenStempel = { pausen: MandatPause[] | undefined; grenze?: string };

/**
 * Die Pausen nach einer Änderung (rein) — immer vom GESPEICHERTEN Stand `alt` aus (was der Browser schickt, zählt nicht):
 *   · neu „pausiert“ (vorher nicht bzw. neu angelegt) → `{ von: heute }` dazu (läuft schon eine, bleibt sie);
 *   · von „pausiert“ zurück (nicht „beendet“) → die offene Pause endet gestern (`bis = heute − 1`; am selben Tag zurück → der Eintrag fällt weg);
 *   · „pausiert → beendet“ → die Pause bleibt offen (die Zeit bis zum Ende war pausiert);
 *   · Altbestand ohne offenen Eintrag (pausiert, bevor es das Feld gab) → zurück auf aktiv legt NICHTS an (der Morgenlauf hat die Monate der
 *     Pause in seinem Merker übersprungen, lib/finanzen/rechnung/kreislauf.ts);
 *   · eine neue Pause über `PAUSEN_MAX` → `grenze` (die ganze Änderung wird abgelehnt, nichts gekürzt).
 */
export function pausenStempeln(alt: Pick<Mandat, 'status' | 'pausen'> | undefined, neuStatus: MandatStatus, heute: string): PausenStempel {
  const vorher = pausenSaeubern(alt?.pausen) ?? [];
  const warPausiert = alt?.status === 'pausiert';
  const offen = vorher.find(p => !p.bis);
  const fertig = (l: MandatPause[]): PausenStempel => ({ pausen: l.length ? l : undefined });
  if (neuStatus === 'pausiert') {
    if (warPausiert || offen) return fertig(vorher);
    if (vorher.length >= PAUSEN_MAX) return { pausen: vorher.length ? vorher : undefined, grenze: `höchstens ${PAUSEN_MAX} Pausen je Mandat` };
    return fertig([...vorher, { von: heute }]);
  }
  if (neuStatus === 'beendet' || !offen) return fertig(vorher);
  const bis = tagMinus1(heute);
  return fertig(vorher.flatMap(p => (p !== offen ? [p] : bis >= p.von ? [{ von: p.von, bis }] : [])));
}
