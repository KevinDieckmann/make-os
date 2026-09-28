// ─── MAKE OS — Planung: Meilensteine lesen und säubern (28.09.) ──────────────
// Meilensteine trugen statt eines Space das Feld `bereich: business | gesundheit`
// (Ersatzlösung aus der Zeit, als Privat nur „Gesundheit“ hieß). Seit 28.09. ist
// `space` (privat | business) das echte Feld, wie bei Zielen und Routinen.
// Verträglich in beide Richtungen:
//   · Lesen: `space`, sonst aus dem Altfeld (gesundheit → privat, business → business).
//   · Schreiben: die Säuberung setzt immer beide — `bereich` wird aus `space` gespiegelt,
//     damit ältere Leser (lib/brain.ts, lib/risk.ts, app/api/loop, Gesundheits- und
//     Business-Säule) ohne Umbau weiterlaufen.
// Der Bestand wird beim Lesen nicht umgeschrieben (sonst passte der `stand` je Zeile
// nicht mehr); ein alter Eintrag bekommt `space` beim nächsten Speichern.
// Client-safe, keine Server-Importe.

import { istSpace, type SpaceId } from '@/lib/make-one/space-regeln';
import { sauberEinheit } from './einheiten';
import type { Meilenstein, MeilensteinBereich } from './typen';

/** Der Space eines Meilensteins — `space`, sonst aus dem Altfeld; ohne beides Business (wie bisher). */
export function meilensteinSpace(m: { space?: unknown; bereich?: unknown }): SpaceId {
  if (istSpace(m.space)) return m.space;
  return m.bereich === 'gesundheit' ? 'privat' : 'business';
}

/** Das Altfeld zum Space — nur zum Spiegeln für ältere Leser. */
export const bereichAusSpace = (s: SpaceId): MeilensteinBereich => (s === 'privat' ? 'gesundheit' : 'business');

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Einen Meilenstein säubern (Schreibweg der Route) — null, wenn der Titel fehlt. */
export function sauberMeilenstein(roh: unknown): Meilenstein | null {
  const m = (roh && typeof roh === 'object' ? roh : {}) as Partial<Meilenstein> & Record<string, unknown>;
  const titel = String(m.titel ?? '').slice(0, 200);
  if (!titel) return null;
  const rang = Number(m.rang);
  const space = meilensteinSpace(m);
  // Einheit nur im Business — Privat kennt keine Einheiten.
  const einheit = space === 'business' ? sauberEinheit(m.einheit) : null;
  return {
    id: String(m.id ?? '').slice(0, 80) || `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    titel,
    space,
    bereich: bereichAusSpace(space),
    faellig: typeof m.faellig === 'string' && TAG.test(m.faellig) ? m.faellig : undefined,
    zeitfenster: m.zeitfenster ? String(m.zeitfenster).slice(0, 40) : undefined,
    messlatte: m.messlatte ? String(m.messlatte).slice(0, 300) : undefined,
    fortschritt: isFinite(Number(m.fortschritt)) ? Math.max(0, Math.min(100, Math.round(Number(m.fortschritt)))) : 0,
    erledigt: m.erledigt === true,
    erledigtAm: typeof m.erledigtAm === 'string' && TAG.test(m.erledigtAm) ? m.erledigtAm : undefined,
    ...(Number.isInteger(rang) && rang > 0 ? { rang } : {}),
    ...(einheit ? { einheit } : {}),
    ...(typeof m.abgeleitetVon === 'string' && m.abgeleitetVon ? { abgeleitetVon: m.abgeleitetVon.slice(0, 80), ...(m.angepasst === true ? { angepasst: true } : {}) } : {}),
  };
}

/** Eine Liste säubern — Einträge ohne Titel fallen weg (wie bisher in der Route). */
export function sauberMeilensteine(rein: unknown): Meilenstein[] {
  return (Array.isArray(rein) ? rein : []).map(sauberMeilenstein).filter((m): m is Meilenstein => !!m);
}
