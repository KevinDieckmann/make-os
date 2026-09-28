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

// ─── Finanzen: EINE Einheitenliste (28.09.) ──────────────────────────────────
// Kevin: „Finanzen: eine Einheitenliste.“ Vorher hatte jeder Finanz-Bereich seine
// eigene Liste (Cockpit kdc/kdv, Steuern kdc/kdv/privat, Finanzplanung ug/privat/kdv,
// Privat-Finanzen privat/selbststaendigkeit/ug, Buchungen privat/kdv/kdc, ZOE kdv/kdc).
// Seitdem gilt überall: Privat + die drei Gesellschaften oben — die Selbstständigkeit
// als eigene Achse, die MAKE OS UG überall vorhanden. Alte Werte werden NUR beim Lesen
// übersetzt (finanzOrtAus), nie still verworfen; gespeichert wird beim nächsten Schreiben.

/** Wo Geld hingehört: Privat oder eine der drei Gesellschaften. */
export type FinanzOrt = 'privat' | Gesellschaftskennung;

/** Die Liste in fester Reihenfolge — Filter, Auswahl, Summen je Einheit. */
export const FINANZ_ORTE: readonly { id: FinanzOrt; label: string; kurz: string }[] = [
  { id: 'privat', label: 'Privat', kurz: 'Privat' },
  ...KERN_EINHEITEN,
];
/** Nur die Kennungen, gleiche Reihenfolge. */
export const FINANZ_ORT_IDS: readonly FinanzOrt[] = FINANZ_ORTE.map(o => o.id);
/** Die drei Gesellschaften (ohne Privat) als Kennungen. */
export const GESELLSCHAFTEN: readonly Gesellschaftskennung[] = KERN_EINHEITEN.map(e => e.id);

export const istGesellschaft = (v: unknown): v is Gesellschaftskennung => GESELLSCHAFTEN.includes(v as Gesellschaftskennung);
export const istFinanzOrt = (v: unknown): v is FinanzOrt => FINANZ_ORT_IDS.includes(v as FinanzOrt);

/** Anzeigename einer Kennung (Privat · Selbstständigkeit · KD Ventures · MAKE OS UG). */
export const finanzOrtName = (o: FinanzOrt): string => FINANZ_ORTE.find(x => x.id === o)?.label ?? o;
/** Kurzname (Privat · Selbst. · KDV · UG). */
export const finanzOrtKurz = (o: FinanzOrt): string => FINANZ_ORTE.find(x => x.id === o)?.kurz ?? o;

/**
 * Finanz-Ort aus einem gespeicherten oder eingegebenen Wert — mit allen Altwerten:
 * `selbststaendigkeit`/`selbst`/„Consulting“/„Kevin Dieckmann Consulting“ → kdc,
 * „KD Management UG“ (Gründungsname der KD Ventures UG) → kdv, dazu alles, was
 * `gesellschaftAusEinheit` kennt („Neue UG“ → ug). Unbekanntes → undefined (nie raten).
 *
 * ACHTUNG Privat-Finanzen: dort hieß die KD Ventures früher schlicht `ug` —
 * dafür gibt es `haushaltEinheitAusAlt` in lib/finanzen/haushalt/typen.ts.
 */
export function finanzOrtAus(roh: unknown): FinanzOrt | undefined {
  const n = norm(String(roh ?? ''));
  if (!n) return undefined;
  if (n === 'privat') return 'privat';
  if (n === 'selbst' || n === 'consulting' || n === 'kevin dieckmann consulting' || n === 'kdc consulting') return 'kdc';
  if (n === 'kd management ug' || n === 'kd management' || n === 'kdm' || n === 'kd ventures ug' || n === 'kd ventures ug (haftungsbeschränkt)') return 'kdv';
  return gesellschaftAusEinheit(n);
}

/**
 * Die Firma aus einer freien Angabe (ZOE, Zuruf): „Ventures“/„KDV“ → kdv,
 * „MAKE OS“/„UG“ → ug, sonst kdc (Selbstständigkeit) — wie bisher „bei Unklarheit kdc“.
 * „KD Ventures UG“ bleibt kdv (Ventures zuerst).
 */
export function firmaAusAngabe(roh: unknown): Gesellschaftskennung {
  const t = String(roh ?? '');
  const genau = finanzOrtAus(t);
  if (genau && genau !== 'privat') return genau;
  if (/ventures|kdv|kd management/i.test(t)) return 'kdv';
  if (/make\s*os|\bug\b/i.test(t)) return 'ug';
  return 'kdc';
}

// ── Rechenkern v3 (lib/finanzen/rechenkern.ts) — Namen bleiben, Zuordnung hier ──
// Der Kern heißt die Selbstständigkeit `selbststaendigkeit` (Kevins v3, Namen bleiben).
// Übersetzung davor/danach nur über diese beiden Funktionen.
export type KernEinheit = 'privat' | 'selbststaendigkeit' | 'ug' | 'kdv';
export const finanzOrtAusKern = (e: KernEinheit): FinanzOrt => (e === 'selbststaendigkeit' ? 'kdc' : e);
export const kernEinheitAus = (o: FinanzOrt): KernEinheit => (o === 'kdc' ? 'selbststaendigkeit' : o);
