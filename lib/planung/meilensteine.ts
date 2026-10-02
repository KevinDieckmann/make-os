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
import { bezugSaeubern } from './mandat';
import type { Meilenstein, MeilensteinBereich } from './typen';
import { neueKennung } from '@/lib/kennung';

/** Der Space eines Meilensteins — `space`, sonst aus dem Altfeld; ohne beides Business (wie bisher). */
export function meilensteinSpace(m: { space?: unknown; bereich?: unknown }): SpaceId {
  if (istSpace(m.space)) return m.space;
  return m.bereich === 'gesundheit' ? 'privat' : 'business';
}

/** Das Altfeld zum Space — nur zum Spiegeln für ältere Leser. */
export const bereichAusSpace = (s: SpaceId): MeilensteinBereich => (s === 'privat' ? 'gesundheit' : 'business');

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const ZIEL_KENNUNG = /^[A-Za-z0-9_~:.-]{1,80}$/;

/** Höchstzahl Vorgänger je Meilenstein (01.10., lib/planung/meilenstein-kette.ts) — darüber wird abgelehnt, nie gekürzt. */
export const KETTE_MAX = 10;

/**
 * `wartetAuf` (01.10.) säubern: nur die Form der Kennungen, ohne Doppelte, nie die eigene. Mehr als `KETTE_MAX` bleibt
 * stehen (eine mehr als erlaubt) — der Schreibweg lehnt das ab (`kettePruefen`), still gekürzt wird nie.
 * Leer → undefined (das Feld fällt weg). Ob die Vorgänger existieren und kein Kreis entsteht, prüft der Schreibweg.
 */
export function sauberWartetAuf(roh: unknown, eigeneId: string): string[] | undefined {
  if (!Array.isArray(roh)) return undefined;
  const aus: string[] = [];
  for (const x of roh) {
    if (typeof x !== 'string' || !ZIEL_KENNUNG.test(x) || x === eigeneId || aus.includes(x)) continue;
    aus.push(x);
    if (aus.length > KETTE_MAX) break;
  }
  return aus.length ? aus : undefined;
}

/** Einen Meilenstein säubern (Schreibweg der Route) — null, wenn der Titel fehlt. */
export function sauberMeilenstein(roh: unknown): Meilenstein | null {
  const m = (roh && typeof roh === 'object' ? roh : {}) as Partial<Meilenstein> & Record<string, unknown>;
  const titel = String(m.titel ?? '').slice(0, 200);
  if (!titel) return null;
  const rang = Number(m.rang);
  const space = meilensteinSpace(m);
  // Einheit nur im Business — Privat kennt keine Einheiten.
  const einheit = space === 'business' ? sauberEinheit(m.einheit) : null;
  const id = String(m.id ?? '').slice(0, 80) || neueKennung('ms');
  const wartetAuf = sauberWartetAuf(m.wartetAuf, id);
  return {
    id,
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
    // Mandat an Meilensteinen (28.09.): nur im Business, nur die Form — Firma/Einheit leitet der Schreibweg ab.
    ...bezugSaeubern(m, space === 'business'),
    // Ziel-Bezug (30.09.): nur die Form der Kennung — ob das Ziel noch lebt, entscheidet die Anzeige.
    ...(typeof m.zielId === 'string' && ZIEL_KENNUNG.test(m.zielId) ? { zielId: m.zielId } : {}),
    // Abhängigkeit (01.10.): „wartet auf“ andere Meilensteine — nur die Form; Existenz, Kreise, Grenze prüft der Schreibweg.
    ...(wartetAuf ? { wartetAuf } : {}),
  };
}

/** Eine Liste säubern — Einträge ohne Titel fallen weg (wie bisher in der Route). */
export function sauberMeilensteine(rein: unknown): Meilenstein[] {
  return (Array.isArray(rein) ? rein : []).map(sauberMeilenstein).filter((m): m is Meilenstein => !!m);
}
