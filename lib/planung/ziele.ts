// ─── MAKE OS — Planung: ein Ziel säubern ────────────────────────────────────
// Der Schreibweg der Ziele-Route — hier, damit er prüfbar ist und die Route nur
// GET/PUT exportiert. Additiv: alte Einträge ohne die neuen Felder bleiben gültig.

import { istSpace } from '@/lib/make-one/space-regeln';
import { sauberEinheit } from './einheiten';
import { bezugSaeubern } from './mandat';
import type { Ziel } from './typen';
import { neueKennung } from '@/lib/kennung';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

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
  if (z.notiz) aus.notiz = String(z.notiz).slice(0, 400);
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
  if (typeof z.abgeleitetVon === 'string' && z.abgeleitetVon) aus.abgeleitetVon = z.abgeleitetVon.slice(0, 80);
  if (aus.abgeleitetVon && z.angepasst === true) aus.angepasst = true;
  // Mandat an Zielen (28.09.): nur im Business, nur die Form der Kennungen — Firma/Einheit leitet der Schreibweg ab.
  Object.assign(aus, bezugSaeubern(z, aus.space === 'business'));
  return aus;
}
