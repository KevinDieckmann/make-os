// ─── MAKE OS — Planung: ein Ziel säubern ────────────────────────────────────
// Der Schreibweg der Ziele-Route — hier, damit er prüfbar ist und die Route nur
// GET/PUT exportiert. Additiv: alte Einträge ohne die neuen Felder bleiben gültig.

import { istSpace } from '@/lib/make-one/space-regeln';
import { sauberEinheit } from './einheiten';
import { bezugSaeubern } from './mandat';
import type { Ziel } from './typen';
import { neueKennung } from '@/lib/kennung';
import { istPlanJahr, zielJahr } from './zeitstrahl';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
/** Länge der Notiz/Beschreibung eines Ziels (wie bisher — der alte Stand kürzt nicht anders). */
export const ZIEL_NOTIZ_MAX = 400;

/** ISO-Zeitpunkt wie `toISOString` (Archiv-Marke, 04.10.). */
const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function sauberZiel(roh: unknown): Ziel | null {
  const z = (roh ?? {}) as Partial<Ziel> & Record<string, unknown>;
  const titel = String(z.titel ?? '').trim().slice(0, 200);
  if (!titel) return null;
  const aus: Ziel = {
    id: String(z.id ?? '').slice(0, 80) || neueKennung('z'),
    titel,
    fortschritt: Math.max(0, Math.min(100, Math.round(Number(z.fortschritt) || 0))),
    erledigt: z.erledigt === true,
  };
  if (z.notiz) aus.notiz = String(z.notiz).slice(0, ZIEL_NOTIZ_MAX);
  // Messlatte (01.10., Ziel-Detail): woran „erreicht“ gemessen wird — optional, wie am Meilenstein.
  if (typeof z.messlatte === 'string' && z.messlatte.trim()) aus.messlatte = z.messlatte.trim().slice(0, 300);
  if (typeof z.erledigtAm === 'string' && ISO_TAG.test(z.erledigtAm)) aus.erledigtAm = z.erledigtAm;
  if (istSpace(z.space)) aus.space = z.space;
  const rang = Number(z.rang);
  if (Number.isInteger(rang) && rang > 0) aus.rang = rang;
  // Einheiten nur im Business — privat kennt keine (27.09.).
  const einheit = aus.space === 'business' ? sauberEinheit(z.einheit) : null;
  if (einheit) aus.einheit = einheit;
  const wert = Number(z.zielwert);
  if (isFinite(wert) && wert > 0) aus.zielwert = Math.round(wert * 10) / 10;
  if (typeof z.termin === 'string' && ISO_TAG.test(z.termin)) aus.termin = z.termin;
  // Planungsjahr (30.09.): nur ein plausibles Jahr — sonst leitet `zielJahr()` es aus Frist bzw. laufendem Jahr ab.
  if (istPlanJahr(z.jahr)) aus.jahr = z.jahr;
  if (typeof z.abgeleitetVon === 'string' && z.abgeleitetVon) aus.abgeleitetVon = z.abgeleitetVon.slice(0, 80);
  if (aus.abgeleitetVon && z.angepasst === true) aus.angepasst = true;
  // Archiv (04.10.): nur ein gültiger ISO-Zeitpunkt (Planungsliste blendet es aus, zurückholbar).
  if (typeof z.archiviertAm === 'string' && ISO_ZEIT.test(z.archiviertAm)) aus.archiviertAm = z.archiviertAm;
  // Mandat an Zielen (28.09.): nur im Business, nur die Form der Kennungen — Firma/Einheit leitet der Schreibweg ab.
  Object.assign(aus, bezugSaeubern(z, aus.space === 'business'));
  return aus;
}

/**
 * Jahresziele ohne `jahr` bekommen es beim Schreiben (30.09.): das Jahr der Frist, sonst das laufende. Läuft im
 * PATCH der Jahresziele in derselben Sperre — so bleibt ein Ziel von 2026 auch im Januar 2027 ein Ziel von 2026
 * (ohne Stempel läse `zielJahr()` es dann als 2027). Unveränderte Einträge bleiben dieselben Objekte.
 */
export function jahrStempeln(liste: readonly Ziel[], laufend: number): Ziel[] {
  return liste.map(z => (istPlanJahr(z.jahr) ? z : { ...z, jahr: zielJahr(z, laufend) }));
}
