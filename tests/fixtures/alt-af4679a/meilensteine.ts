// ─── Test-Fixture: WÖRTLICH aus dem alten Online-Stand af4679a (`git show af4679a:lib/planung/meilensteine.ts` und `…/ziele.ts`) ─
// Nicht ändern — tests/ziel-kette-0110.test.ts prüft damit den Rückweg (Kompatibilitätsmodus): die Säuberer des alten Stands
// verwerfen die neuen Felder `wartetAuf` (Meilenstein) und `messlatte` (Ziel) beim nächsten Speichern und sonst nichts.
// Nur die Import-Zeilen zeigen auf die heutigen Hilfen (Space, Einheit, Mandat-Bezug, Kennung — dort hat sich für diese Funktionen
// nichts geändert), die Funktionen selbst sind die alten.

import { istSpace, type SpaceId } from '@/lib/make-one/space-regeln';
import { sauberEinheit } from '@/lib/planung/einheiten';
import { bezugSaeubern } from '@/lib/planung/mandat';
import type { Meilenstein, MeilensteinBereich } from '@/lib/planung/typen';
import { neueKennung } from '@/lib/kennung';

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
    id: String(m.id ?? '').slice(0, 80) || neueKennung('ms'),
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
  };
}

/** Eine Liste säubern — Einträge ohne Titel fallen weg (wie bisher in der Route). */
export function sauberMeilensteine(rein: unknown): Meilenstein[] {
  return (Array.isArray(rein) ? rein : []).map(sauberMeilenstein).filter((m): m is Meilenstein => !!m);
}
