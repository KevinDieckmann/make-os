// ─── Mandant überall klickbar — Auflösen (28.09., rein, getestet) ───────────
// Kevin: „Mach das ganze Thema mit Mandanten auch klickbar.“ Der Link selbst
// entsteht in lib/crm/adresse.ts (`mandantZiel`, Mandat vor Firma). Hier steht,
// wie eine Stelle OHNE Kennung trotzdem zu ihrem Mandanten findet:
//   · `mandantAusName`       — nur Text-Kunde (z. B. eine alte Rechnung): nur bei
//                              EINDEUTIGEM Namenstreffer, sonst bleibt es Text
//   · `mandatAusPlanposten`  — Liquiplan-Posten, die aus einem Mandat kommen
//   · `mandantPruefung`      — was der Mandat-Bestand über „gibt es das noch?“ weiß
// Grundlage ist die Kurzform der Mandate (lib/planung/mandat.ts `MandatKurz`,
// im Browser über `useMandate`), nie der ganze CRM-Bestand.

import type { MandatKurz } from '@/lib/planung/mandat';
import type { MandantEingabe } from './adresse';

type MandatName = Pick<MandatKurz, 'id' | 'firma' | 'firmaId' | 'aktiv'>;

/** Wie firmen-bezug.ts: Groß-/Kleinschreibung und doppelte Leerzeichen egal. */
const norm = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Ein Kundenname ohne Kennung → Mandat oder Firma, nur wenn eindeutig:
 * - genau ein Mandat mit diesem Firmennamen → das Mandat;
 * - mehrere, aber genau ein aktives → das aktive;
 * - sonst alle mit derselben Firma → die Firma;
 * - sonst (kein Treffer, mehrdeutig) → null (die Stelle bleibt Text).
 */
export function mandantAusName(name: string | null | undefined, mandate: readonly MandatName[]): { mandatId?: string; firmaId?: string } | null {
  const n = norm(name);
  if (!n) return null;
  const treffer = mandate.filter(m => norm(m.firma) === n);
  if (!treffer.length) return null;
  if (treffer.length === 1) return { mandatId: treffer[0].id, ...(treffer[0].firmaId ? { firmaId: treffer[0].firmaId } : {}) };
  const aktiv = treffer.filter(m => m.aktiv);
  if (aktiv.length === 1) return { mandatId: aktiv[0].id, ...(aktiv[0].firmaId ? { firmaId: aktiv[0].firmaId } : {}) };
  const firmen = new Set(treffer.map(m => m.firmaId ?? ''));
  const [f] = [...firmen];
  return firmen.size === 1 && f ? { firmaId: f } : null;
}

/** Vorsilbe der Liquiplan-Posten, die aus einem Mandat entstehen (lib/crm/kunden.ts `planpostenAus`). */
export const PLANPOSTEN_MANDAT = 'lp-mandat-';

/** Das Mandat hinter einem Liquiplan-Posten: von Hand verknüpft (`planpostenId`) oder `lp-mandat-<id>`. */
export function mandatAusPlanposten(postenId: string | null | undefined, mandate: readonly Pick<MandatKurz, 'id' | 'planpostenId'>[]): string | null {
  if (!postenId) return null;
  const verknuepft = mandate.find(m => m.planpostenId === postenId);
  if (verknuepft) return verknuepft.id;
  return postenId.startsWith(PLANPOSTEN_MANDAT) && postenId.length > PLANPOSTEN_MANDAT.length ? postenId.slice(PLANPOSTEN_MANDAT.length) : null;
}

/**
 * Was der geladene Mandat-Bestand über die Kennungen weiß (für `mandantZiel`):
 * - nicht geladen → nichts (der Link steht vorläufig, kein Flackern);
 * - geladen ohne Zugang → `zugang: false` (nur Text);
 * - Mandat: da oder weg; Firma: da, wenn ein Mandat auf sie zeigt — sonst unbekannt
 *   (eine Firma ohne Mandat kennt die Kurzform nicht, dann entscheidet die Stelle selbst).
 */
export function mandantPruefung(
  ids: { mandatId?: string | null; firmaId?: string | null },
  stand: { geladen: boolean; zugang: boolean; karte: ReadonlyMap<string, Pick<MandatKurz, 'id' | 'firmaId'>> },
): Pick<MandantEingabe, 'mandatDa' | 'firmaDa' | 'zugang'> {
  if (!stand.geladen) return {};
  if (!stand.zugang) return { zugang: false };
  const aus: Pick<MandantEingabe, 'mandatDa' | 'firmaDa' | 'zugang'> = { zugang: true };
  if (ids.mandatId) aus.mandatDa = stand.karte.has(ids.mandatId);
  if (ids.firmaId && [...stand.karte.values()].some(m => m.firmaId === ids.firmaId)) aus.firmaDa = true;
  return aus;
}

/** Anzeigename aus dem Bestand, wenn die Stelle keinen hat: „Firma · Mandatstitel“ bzw. der Firmenname. */
export function mandantName(ids: { mandatId?: string | null; firmaId?: string | null }, karte: ReadonlyMap<string, Pick<MandatKurz, 'firma' | 'titel' | 'firmaId'>>): string | undefined {
  const m = ids.mandatId ? karte.get(ids.mandatId) : undefined;
  if (m) return `${m.firma} · ${m.titel}`;
  if (!ids.firmaId) return undefined;
  for (const x of karte.values()) if (x.firmaId === ids.firmaId && x.firma) return x.firma;
  return undefined;
}
