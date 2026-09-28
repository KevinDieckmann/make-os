// ─── MAKE OS — Business-Einheiten (eine Quelle, 27.09.) ─────────────────────
// Kevin: „Aufgaben im Business immer zwischen Selbstständigkeit, KD Ventures
// und MAKE OS UG unterscheiden — überall, wo es möglich und nötig ist.“
// Die drei Kerneinheiten entsprechen den Gesellschaften im CRM (Deals,
// Mandate, Produkte: kdc · kdv · ug). Weitere Einheiten (z. B. Kunden oder
// eigene) pflegt der Haushalt frei — lib/planung/einheiten.ts.

export type Gesellschaftskennung = 'kdc' | 'kdv' | 'ug';

export const KERN_EINHEITEN: readonly { id: Gesellschaftskennung; label: string; kurz: string }[] = [
  { id: 'kdc', label: 'Selbstständigkeit', kurz: 'Selbst.' },
  { id: 'kdv', label: 'KD Ventures', kurz: 'KDV' },
  { id: 'ug', label: 'MAKE OS UG', kurz: 'UG' },
];

/** Die drei Namen in fester Reihenfolge — für Wertelisten, Filter und Vorbelegungen. */
export const KERN_EINHEITEN_NAMEN: readonly string[] = KERN_EINHEITEN.map(e => e.label);

const norm = (s: string) => s.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();

/** Anzeigename der Gesellschaft (CRM) — „offen“ und Unbekanntes ergeben undefined. */
export function einheitAusGesellschaft(g: string | null | undefined): string | undefined {
  return KERN_EINHEITEN.find(e => e.id === g)?.label;
}

/** Gesellschaft (CRM) aus dem Einheiten-Namen — nur für die drei Kerneinheiten, sonst undefined. Alte Namen („Neue UG“, „UG“, „KDV“) werden erkannt. */
export function gesellschaftAusEinheit(name: string | null | undefined): Gesellschaftskennung | undefined {
  const n = norm(String(name ?? ''));
  if (!n) return undefined;
  const direkt = KERN_EINHEITEN.find(e => norm(e.label) === n || norm(e.kurz) === n || e.id === n);
  if (direkt) return direkt.id;
  if (n === 'neue ug' || n === 'make os ug (haftungsbeschränkt)' || n === 'make os') return 'ug';
  if (n === 'selbstständig' || n === 'selbststaendigkeit' || n === 'kd consulting') return 'kdc';
  return undefined;
}

/**
 * Die Firma (das Konto, `firmaId`) im Finanzplan für die Gesellschaft eines Mandats oder Deals (28.09.):
 * kdc · kdv · ug wie im CRM; „offen“ und Unbekanntes landen bei kdc (Selbstständigkeit).
 * Vorher wurde nur kdv abgefragt — Rechnungen aus UG-Mandaten standen bei kdc.
 */
export function firmaFuerGesellschaft(g: string | null | undefined): Gesellschaftskennung {
  return gesellschaftAusEinheit(g) ?? 'kdc';
}

/** Einheitlicher Anzeigename: Kerneinheiten in der festen Schreibweise, alles andere unverändert. */
export function einheitName(name: string | null | undefined): string | undefined {
  const g = gesellschaftAusEinheit(name);
  if (g) return einheitAusGesellschaft(g);
  const s = String(name ?? '').trim();
  return s || undefined;
}
