// ─── MAKE OS — Business-Einheiten (eine Quelle, 27.09.) ─────────────────────
// Kevin: „Aufgaben im Business immer zwischen Selbstständigkeit, KD Ventures
// und der MAKE-Gesellschaft unterscheiden — überall, wo es möglich und nötig ist.“
// Die drei Kerneinheiten entsprechen den Gesellschaften im CRM (Deals,
// Mandate, Produkte: kdc · kdv · ug). Weitere Einheiten (z. B. Kunden oder
// eigene) pflegt der Haushalt frei — lib/planung/einheiten.ts.
//
// Umbenennung 30.09. (Kevin: „Ändere bitte überall in der Software MAKE UG in
// MAKE Innovation GmbH.“): Die Gesellschaft mit der Kennung `ug` heißt jetzt
// „MAKE Innovation GmbH“, kurz „MAKE“. Die KENNUNG `ug` bleibt überall (Daten,
// Spaces, FinanzOrt, Adressen) — nur der Anzeigename ist neu. Der Name steht NUR
// hier (UG_NAME/UG_KURZ); alle Oberflächen, ZOE-Texte und Hinweise beziehen ihn
// von hier. Alte Namen („MAKE OS UG“, „MAKE UG“, „Neue UG“, „UG“) werden beim
// Lesen als `ug` erkannt (UG_ALTNAMEN) und mit dem neuen Namen angezeigt;
// gespeichert wird der neue Name beim nächsten Schreiben. NICHT gemeint: die
// KD Ventures UG (kdv) — die bleibt eine UG.

export type Gesellschaftskennung = 'kdc' | 'kdv' | 'ug';

// ─── Offene Liste (04.10., Gesellschafts-Register) ──────────────────────────
// Kevin 04.10.: „Eigene Gesellschaften als offene Liste.“ Die drei festen Kennungen oben bleiben unverändert (Finanzen,
// Steuern, Rechenkern, Business-Index und Spaces rechnen nur mit ihnen); weitere eigene Gesellschaften legt der Haushalt im
// Register an (lib/gesellschaften, Seite /os/unternehmen) — Kennung `g-<uuid>`, nie im Code. Wer eine Gesellschaft nur
// AUSWÄHLT oder ANZEIGT (Deals, Mandate, Produkte, Planung), nimmt `GesellschaftId`; wer rechnet, bleibt bei
// `Gesellschaftskennung` und zeigt für eine Register-Gesellschaft „nur Grunddaten“.

/** Kennung einer Gesellschaft aus dem Register: `g-<uuid>` (lib/kennung.ts `neueKennung('g')`). */
export type RegisterKennung = `g-${string}`;
/** Jede eigene Gesellschaft: eine der drei festen ODER eine aus dem Register. */
export type GesellschaftId = Gesellschaftskennung | RegisterKennung;
export const REGISTER_KENNUNG = /^g-[a-z0-9][a-z0-9-]{3,62}$/;
export const istRegisterKennung = (v: unknown): v is RegisterKennung => typeof v === 'string' && REGISTER_KENNUNG.test(v);

/** Anzeigename der Gesellschaft mit der Kennung `ug` — EINZIGE Stelle (seit 30.09., vorher „MAKE OS UG“). */
export const UG_NAME = 'MAKE Innovation GmbH';
/** Kurzname für enge Stellen (Pillen, Chips, Spaltenköpfe) — „MAKE“, damit er nicht mit anderen GmbHs verwechselt wird. */
export const UG_KURZ = 'MAKE';
/**
 * Frühere und abweichende Namen der Gesellschaft `ug` — werden beim Lesen erkannt, nie still verworfen.
 * Nur hier stehen die Altnamen (Wächter: tests/umbenennung-make.test.ts).
 */
export const UG_ALTNAMEN: readonly string[] = [
  'MAKE OS UG', 'MAKE OS UG (haftungsbeschränkt)', 'MAKE UG', 'MAKE UG (haftungsbeschränkt)', 'Neue UG', 'UG',
  'MAKE OS', 'MAKE Innovation',
];

export const KERN_EINHEITEN: readonly { id: Gesellschaftskennung; label: string; kurz: string }[] = [
  { id: 'kdc', label: 'Selbstständigkeit', kurz: 'Selbst.' },
  { id: 'kdv', label: 'KD Ventures', kurz: 'KDV' },
  { id: 'ug', label: UG_NAME, kurz: UG_KURZ },
];

/** Die drei Namen in fester Reihenfolge — für Wertelisten, Filter und Vorbelegungen. */
export const KERN_EINHEITEN_NAMEN: readonly string[] = KERN_EINHEITEN.map(e => e.label);

const norm = (s: string) => s.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();

/** Anzeigename der Gesellschaft (CRM) — „offen“ und Unbekanntes ergeben undefined. */
export function einheitAusGesellschaft(g: string | null | undefined): string | undefined {
  return KERN_EINHEITEN.find(e => e.id === g)?.label;
}

const UG_ALT = new Set(UG_ALTNAMEN.map(norm));

/** Gesellschaft (CRM) aus dem Einheiten-Namen — nur für die drei Kerneinheiten, sonst undefined. Alte Namen (UG_ALTNAMEN, „KDV“) werden erkannt. */
export function gesellschaftAusEinheit(name: string | null | undefined): Gesellschaftskennung | undefined {
  const n = norm(String(name ?? ''));
  if (!n) return undefined;
  const direkt = KERN_EINHEITEN.find(e => norm(e.label) === n || norm(e.kurz) === n || e.id === n);
  if (direkt) return direkt.id;
  if (UG_ALT.has(n)) return 'ug';
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

/**
 * Firmen-Konto im Finanzplan für eine Gesellschaft — OHNE stillen Rückfall für das Register (04.10.): Rechnungen und Konten
 * gibt es nur für die drei festen Gesellschaften (Rechenkern). Eine Register-Gesellschaft (`g-…`) ergibt `null` — die
 * Oberfläche sagt dann, dass die Gesellschaft im Finanzplan noch nicht geführt wird, statt die Rechnung bei der
 * Selbstständigkeit (kdc) abzulegen. „offen“/Altwerte bleiben wie bisher bei kdc.
 */
export function finanzFirmaFuer(g: string | null | undefined): Gesellschaftskennung | null {
  return istRegisterKennung(g) ? null : firmaFuerGesellschaft(g);
}
/** Satz für die Oberfläche, wenn `finanzFirmaFuer` null ergibt. */
export const NUR_GRUNDDATEN = 'Diese Gesellschaft steht im Register, wird im Finanzplan aber noch nicht geführt — Rechnungen und Zahlen gibt es heute nur für die drei festen Gesellschaften.';

/**
 * Name eines Firmen-Kontos (Finanzplan `firmen[]`, 30.09.): das Konto `ug` mit einem Altnamen der Gesellschaft
 * („MAKE OS UG“, „Neue UG“ …) heißt wie hier (UG_NAME); ein eigener Name und alle anderen Konten bleiben, wie sie sind.
 * Nur der Textwert ändert sich (keine Formänderung) — gespeichert wird er beim nächsten Schreiben.
 */
export function kontoName(id: string, name: string): string {
  return id === 'ug' && gesellschaftAusEinheit(name) === 'ug' ? UG_NAME : name;
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
// als eigene Achse, die MAKE Innovation GmbH (ug) überall vorhanden. Alte Werte werden NUR beim Lesen
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
/** Eine der drei festen ODER eine Register-Gesellschaft (`g-…`) — für Auswahl und Anzeige, nie zum Rechnen. */
export const istGesellschaftId = (v: unknown): v is GesellschaftId => istGesellschaft(v) || istRegisterKennung(v);
export const istFinanzOrt = (v: unknown): v is FinanzOrt => FINANZ_ORT_IDS.includes(v as FinanzOrt);

/** Anzeigename einer Kennung (Privat · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH). */
export const finanzOrtName = (o: FinanzOrt): string => FINANZ_ORTE.find(x => x.id === o)?.label ?? o;
/** Kurzname (Privat · Selbst. · KDV · MAKE). */
export const finanzOrtKurz = (o: FinanzOrt): string => FINANZ_ORTE.find(x => x.id === o)?.kurz ?? o;

/**
 * Finanz-Ort aus einem gespeicherten oder eingegebenen Wert — mit allen Altwerten:
 * `selbststaendigkeit`/`selbst`/„Consulting“/„Kevin Dieckmann Consulting“ → kdc,
 * „KD Management UG“ (Gründungsname der KD Ventures UG) → kdv, dazu alles, was
 * `gesellschaftAusEinheit` kennt (UG_ALTNAMEN, z. B. „Neue UG“ → ug). Unbekanntes → undefined (nie raten).
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
 * „MAKE“/„MAKE Innovation“/„UG“ → ug, sonst kdc (Selbstständigkeit) — wie bisher „bei Unklarheit kdc“.
 * „KD Ventures UG“ bleibt kdv (Ventures zuerst).
 */
export function firmaAusAngabe(roh: unknown): Gesellschaftskennung {
  const t = String(roh ?? '');
  const genau = finanzOrtAus(t);
  if (genau && genau !== 'privat') return genau;
  if (/ventures|kdv|kd management/i.test(t)) return 'kdv';
  if (/\bmake\b|\bug\b/i.test(t)) return 'ug';
  return 'kdc';
}

// ── Rechenkern v3 (lib/finanzen/rechenkern.ts) — Namen bleiben, Zuordnung hier ──
// Der Kern heißt die Selbstständigkeit `selbststaendigkeit` (Kevins v3, Namen bleiben).
// Übersetzung davor/danach nur über diese beiden Funktionen.
export type KernEinheit = 'privat' | 'selbststaendigkeit' | 'ug' | 'kdv';
export const finanzOrtAusKern = (e: KernEinheit): FinanzOrt => (e === 'selbststaendigkeit' ? 'kdc' : e);
export const kernEinheitAus = (o: FinanzOrt): KernEinheit => (o === 'kdc' ? 'selbststaendigkeit' : o);
