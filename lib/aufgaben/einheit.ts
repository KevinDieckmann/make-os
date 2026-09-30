// ─── MAKE OS — Aufgaben: Business-Einheit (27.09.) ──────────────────────────
// Kevin: „Aufgaben im Business immer zwischen Selbstständigkeit, KD Ventures
// und MAKE Innovation GmbH unterscheiden können — überall, wo es möglich und nötig ist.“
// Namen kommen NUR aus lib/einheiten.ts (Kerneinheiten) und der Werteliste des
// Haushalts (lib/planung/einheiten.ts, eigene). Privat trägt nie eine Einheit.
// Hier: Säuberung im Schreibweg, Ableitung für System-Aufgaben (Deal/Mandat/
// Produkt → Gesellschaft → Einheit), Filter, Vorgabe, Farben. Rein, client-sicher.

import { KERN_EINHEITEN, einheitAusGesellschaft, gesellschaftAusEinheit, einheitName, type Gesellschaftskennung } from '@/lib/einheiten';
import { sauberEinheit } from '@/lib/planung/einheiten';
import { spaceVonAufgabe, type SpaceId } from '@/lib/make-one/space-regeln';

/** Dezente Farbe je Kerneinheit (wie die Orte im Board), eigene Einheiten grau. */
export const EINHEIT_FARBE: Record<Gesellschaftskennung, string> = { kdc: '#58D9CD', kdv: '#DE9E63', ug: '#A99BF5' };
export const EINHEIT_GRAU = '#A2ADB0';

export function einheitFarbe(name: string | null | undefined): string {
  const g = gesellschaftAusEinheit(name);
  return g ? EINHEIT_FARBE[g] : EINHEIT_GRAU;
}

/** Kurzform für enge Stellen (Planer-Pillen): Kerneinheit → „Selbst.“/„KDV“/„MAKE“, eigene gekürzt. */
export function einheitKurz(name: string | null | undefined): string | undefined {
  const g = gesellschaftAusEinheit(name);
  if (g) return KERN_EINHEITEN.find(e => e.id === g)?.kurz;
  const s = einheitName(name);
  return s ? (s.length > 14 ? `${s.slice(0, 13)}…` : s) : undefined;
}

type AufgabeMitOrt = { id: string; title: string; description?: string; projectId: string; space?: SpaceId; einheit?: unknown };

/**
 * Die Einheit einer Aufgabe, wie sie gespeichert wird: nur im Business, Namen
 * über `einheitName` vereinheitlicht (Altnamen wie „Neue UG“ → „MAKE Innovation GmbH“), 2–40 Zeichen.
 * Alles andere → undefined (das Feld fällt weg).
 */
export function aufgabeEinheit(t: AufgabeMitOrt, orgZuordnung: Record<string, string> = {}): string | undefined {
  if (t.einheit == null || t.einheit === '') return undefined;
  if (spaceVonAufgabe(t, orgZuordnung) !== 'business') return undefined;
  return sauberEinheit(t.einheit) ?? undefined;
}

/** Die Einheit hinter einem Deal, Mandat oder Produkt — über seine Gesellschaft; „offen“ und Unbekanntes → undefined. */
export function einheitAusBezug(
  crm: { chancen?: readonly { id: string; gesellschaft?: string; leistungId?: string }[]; mandate?: readonly { id: string; gesellschaft?: string; leistungId?: string; chanceId?: string }[]; leistungen?: readonly { id: string; gesellschaft?: string }[] } | null | undefined,
  bezug: { chanceId?: string | null; mandatId?: string | null; leistungId?: string | null },
): string | undefined {
  if (!crm) return undefined;
  const mandat = bezug.mandatId ? crm.mandate?.find(m => m.id === bezug.mandatId) : undefined;
  const chance = bezug.chanceId ? crm.chancen?.find(c => c.id === bezug.chanceId) : mandat?.chanceId ? crm.chancen?.find(c => c.id === mandat.chanceId) : undefined;
  const leistungId = bezug.leistungId ?? mandat?.leistungId ?? chance?.leistungId;
  const leistung = leistungId ? crm.leistungen?.find(l => l.id === leistungId) : undefined;
  // Das Konkrete zuerst: Mandat, dann Deal, dann das Produkt dahinter.
  for (const g of [mandat?.gesellschaft, chance?.gesellschaft, leistung?.gesellschaft]) {
    const e = einheitAusGesellschaft(g);
    if (e) return e;
  }
  return undefined;
}

// ── Filter ──────────────────────────────────────────────────────────────────
/** Filterwert: „alle“, „ohne Einheit“ oder ein Einheiten-Name. Die Marker können mit keinem Namen kollidieren. */
export const EINHEIT_ALLE = '__alle__';
export const EINHEIT_OHNE = '__ohne__';
export type EinheitFilter = string;

const norm = (s: string) => s.toLocaleLowerCase('de-DE');

export function passtEinheitFilter(einheit: string | null | undefined, filter: EinheitFilter): boolean {
  if (filter === EINHEIT_ALLE || !filter) return true;
  const e = einheitName(einheit);
  if (filter === EINHEIT_OHNE) return !e;
  return !!e && norm(e) === norm(einheitName(filter) ?? filter);
}

export interface EinheitOption { id: EinheitFilter; label: string; farbe: string; anzahl: number }

/**
 * Die Filter-Pillen im Business: Alle · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH
 * · (eigene, sobald eine Aufgabe sie trägt) · ohne Einheit. `anzahl` zählt die übergebenen Aufgaben.
 */
export function einheitFilterOptionen(genutzt: readonly (string | null | undefined)[], liste: readonly string[] = []): EinheitOption[] {
  const namen = genutzt.map(e => einheitName(e));
  const zaehle = (f: EinheitFilter) => namen.filter(e => passtEinheitFilter(e, f)).length;
  const kern = KERN_EINHEITEN.map(k => k.label);
  const eigene: string[] = [];
  const gesehen = new Set(kern.map(norm));
  // Reihenfolge der Werteliste zuerst, dann was nur an Aufgaben hängt (z. B. aus einem alten Stand).
  for (const e of [...liste.map(x => einheitName(x)), ...namen]) {
    if (!e || gesehen.has(norm(e))) continue;
    if (!namen.some(n => n && norm(n) === norm(e))) continue;
    gesehen.add(norm(e)); eigene.push(e);
  }
  return [
    { id: EINHEIT_ALLE, label: 'Alle', farbe: EINHEIT_GRAU, anzahl: namen.length },
    ...[...kern, ...eigene].map(e => ({ id: e, label: e, farbe: einheitFarbe(e), anzahl: zaehle(e) })),
    { id: EINHEIT_OHNE, label: 'ohne Einheit', farbe: EINHEIT_GRAU, anzahl: zaehle(EINHEIT_OHNE) },
  ];
}

/** Vorgabe für eine neue Business-Aufgabe: der gesetzte Filter, sonst die zuletzt gewählte Einheit; „ohne Einheit“ → keine. */
export function vorgabeEinheit(filter: EinheitFilter, zuletzt: string | null | undefined): string | undefined {
  if (filter === EINHEIT_OHNE) return undefined;
  if (filter && filter !== EINHEIT_ALLE) return einheitName(filter);
  return einheitName(zuletzt);
}

/** Merker im Browser für „zuletzt gewählt/gefiltert“ (Liste und Board teilen ihn). */
export const EINHEIT_MERKER = 'make-aufgaben-einheit';
