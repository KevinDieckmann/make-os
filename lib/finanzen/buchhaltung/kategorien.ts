// ─── Buchhaltung — Kategorien der Business-Buchungen (02.11., rein: Server UND Browser) ─────────────────────────────────────────────
// Kevin 02.11.: „Morgen die komplette Buchhaltung in der App sauber machen.“ Die Liste ist neutral (keine Firma, kein Name) und gilt für
// jede Instanz; ein Haushalt kann eigene Kategorien dazunehmen (gespeichert im Bestand der Regeln, lib/finanzen/buchhaltung/server.ts).
// Eine gespeicherte Buchung darf jede Kategorie tragen (Altbestand aus dem Finanz-Dashboard, Bank-Kategorien) — gewählt wird aus dieser Liste.

export const KAT = {
  erloese: 'Erlöse',
  entnahme: 'Privatentnahme',
  einlage: 'Privateinlage',
  darlehen: 'Gesellschafterdarlehen',
  verrechnung: 'Verrechnung zwischen Gesellschaften',
  storno: 'Storno/Rückbuchung',
  bewirtung: 'Bewirtung',
  umbuchung: 'Umbuchung',
  sonstiges: 'Sonstiges',
} as const;

/** Die Standardliste (Reihenfolge = Anzeige). Neue Kategorie für alle Instanzen: hier anhängen, nie umbenennen (gespeicherte Buchungen tragen den Text). */
export const BUSINESS_KATEGORIEN: readonly string[] = [
  KAT.erloese, 'Fremdleistungen', 'Software & Abos', 'Reise', KAT.bewirtung, 'Miete & Raum', 'Versicherung', 'Bank & Gebühren',
  'Steuern & Abgaben', 'Steuerberatung', 'Rechts- & Notarkosten', 'Gebühren', 'Fortbildung & Veranstaltungen', 'Personal', 'Marketing', 'Büro',
  KAT.entnahme, KAT.einlage, KAT.darlehen, 'Darlehen erhalten', 'Darlehen gewährt', KAT.verrechnung, 'Beteiligung', 'Eigenkapital',
  KAT.storno, KAT.umbuchung, KAT.sonstiges,
];

export const KATEGORIE_MAX = 60;
export const EIGENE_KATEGORIEN_MAX = 40;

/** Steuerzeichen (unter 32 und 127) werden zu Leerzeichen. */
export const ohneSteuerzeichen = (t: string): string => Array.from(t, c => { const n = c.charCodeAt(0); return n < 32 || n === 127 ? ' ' : c; }).join('');

/** Eine Kategorie aus einer Eingabe — getrimmt, ohne Steuerzeichen; zu lang oder leer → null (die Route antwortet dann 400/413, nie gekürzt). */
export function kategorieSauber(roh: unknown): string | null {
  if (typeof roh !== 'string') return null;
  const t = ohneSteuerzeichen(roh.normalize('NFC')).replace(/\s+/g, ' ').trim();
  if (!t || t.length > KATEGORIE_MAX) return null;
  return t;
}

const gleich = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' }) === 0;

/** Die wählbaren Kategorien: Standard + eigene des Haushalts (ohne Doppelte, Groß/Klein egal). */
export function kategorienFuer(eigene: readonly string[] = []): string[] {
  const raus = [...BUSINESS_KATEGORIEN];
  for (const e of eigene) if (!raus.some(x => gleich(x, e))) raus.push(e);
  return raus;
}

/** Gilt eine Kategorie als „noch nicht zugeordnet“? (leer oder Sonstiges) */
export const istOffeneKategorie = (k: string | null | undefined): boolean => !k || !k.trim() || gleich(k.trim(), KAT.sonstiges);

/** Eingänge dieser Kategorien sind keine Umsätze — sie brauchen keine Rechnung. */
export const KEIN_UMSATZ: ReadonlySet<string> = new Set([KAT.einlage, KAT.darlehen, KAT.umbuchung, KAT.entnahme, 'Darlehen erhalten', 'Darlehen gewährt',
  KAT.verrechnung, 'Beteiligung', 'Eigenkapital', KAT.storno]);

/** Kategorien, die aus der Gegenseite (eigenes Konto) kommen — eine Regel „Empfänger → Kategorie“ überschreibt sie nie. */
export const AUS_GEGENKONTO: ReadonlySet<string> = new Set([KAT.umbuchung, KAT.entnahme, KAT.einlage, KAT.storno]);

/** Eine Kategorie der Standardliste in ihrer genauen Schreibweise (Groß/Klein egal) — sonst null. */
export const standardKategorie = (k: string): string | null => BUSINESS_KATEGORIEN.find(x => gleich(x, k)) ?? null;
