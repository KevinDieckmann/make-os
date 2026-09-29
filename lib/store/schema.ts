// ─── Schemaversion je Bestand und Migrationsrahmen (29.09., Paket D-A #22/#24/#26) ─
// Jeder Bestand, der als JSON-Objekt auf der Platte liegt, trägt beim Schreiben das Feld
// `_v` (Schemaversion). Beim Lesen nimmt die Datenschicht `_v` wieder heraus — Leser und
// Säuberer sehen es nie (auch Bestände, deren Schlüssel Personen oder Tage sind, bleiben
// sauber). `_v` ist deshalb ein reservierter Schlüssel: kein Bestand darf ein eigenes Feld so nennen.
//
// Eine Formänderung (z. B. Stufe 4: `firmaId` statt Firmenname, Euro → Cent) wird hier als
// Migration eingetragen: `version` hochzählen und `migrationen[neueVersion] = alt → neu`.
// Die Datenschicht wendet sie beim Lesen (Sicht) und in updateJson (dann gespeichert) an —
// von der gelesenen Version der Reihe nach bis zur aktuellen. Regeln:
//   · idempotent: eine Migration auf schon migrierte Daten ändert nichts (Test!);
//   · rein: keine E/A, kein Datum „jetzt“, keine anderen Bestände;
//   · nie kürzen: Listen nicht beschneiden, unbekannte Felder durchreichen.
// Bestände ohne Eintrag stehen auf Version 1 (fehlendes `_v` = Version 0 → 1 ohne Änderung).
// Arrays auf oberster Ebene tragen kein `_v`.
//
// Kompatibilitätsmodus (29.09. abends, MAKE_OS_FORMAT, lib/store/huelle.mjs `formatModus`): im Standard „kompatibel“
// schreibt local-db `_v` NICHT (`ohneVersion`) — der alte Online-Stand aeb4964 kennt das Feld nicht, und Bestände, deren
// Schlüssel Personen oder Tage sind, sähen dort einen Eintrag „_v“. Gelesen und migriert wird trotzdem (fehlendes `_v`
// = Version 0 → Migrationen laufen beim Lesen jedes Mal, sie sind rein und idempotent). Erst mit MAKE_OS_FORMAT=v2 landet
// `_v` auf der Platte.

export const SCHEMA_FELD = '_v';

export type Migration = (daten: Record<string, unknown>) => Record<string, unknown>;
export interface SchemaEintrag { muster: RegExp; version: number; migrationen: Record<number, Migration>; grund?: string }

/** Das Register — neue Einträge MIT Test (tests/datenschicht-kern.test.ts zeigt das Muster). */
const REGISTER: SchemaEintrag[] = [
  // Beispiel (noch keine echte Formänderung, Stand 29.09.):
  // { muster: /^crm$/, version: 2, migrationen: { 2: d => ({ ...d, chancen: … }) }, grund: 'Stufe 4: firmaId statt Name' },
];

const g = globalThis as unknown as { __makeosSchemaTest?: SchemaEintrag[] };

/** Nur für Tests: zusätzliche Einträge (werden vor dem Register geprüft). */
export function schemaFuerTestSetzen(eintraege: SchemaEintrag[] | null): void { g.__makeosSchemaTest = eintraege ?? undefined; }

export function schemaFuer(name: string): SchemaEintrag | null {
  for (const e of [...(g.__makeosSchemaTest ?? []), ...REGISTER]) if (e.muster.test(name)) return e;
  return null;
}

/** Aktuelle Version eines Bestands. */
export const aktuelleVersion = (name: string): number => schemaFuer(name)?.version ?? 1;

const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * Gelesene Daten → aktuelle Form, ohne `_v`. Liefert, von welcher Version migriert wurde.
 * Unbekannt hohe Version (neuere App schrieb, ältere liest) → Fehler: nie mit einer älteren Form überschreiben.
 */
export function migriere<T>(name: string, daten: T): { daten: T; von: number; nach: number } {
  if (!istObjekt(daten)) return { daten, von: 1, nach: 1 };
  const nach = aktuelleVersion(name);
  const { [SCHEMA_FELD]: roh, ...rest } = daten;
  const von = typeof roh === 'number' && Number.isInteger(roh) && roh >= 0 ? roh : 0;
  if (von > nach) throw new Error(`[local-db] ${name}: Schemaversion ${von} ist neuer als diese App (${nach}) — erst die App aktualisieren, nicht überschreiben.`);
  let d: Record<string, unknown> = rest;
  const e = schemaFuer(name);
  for (let v = Math.max(1, von + 1); v <= nach; v++) {
    const m = e?.migrationen[v];
    if (m) d = m(d);
    if (!istObjekt(d)) throw new Error(`[local-db] ${name}: Migration auf Version ${v} liefert kein Objekt.`);
  }
  return { daten: d as T, von, nach };
}

/** Zum Schreiben im Kompatibilitätsmodus: `_v` heraus (nie auf die Platte). Arrays und Nicht-Objekte bleiben, wie sie sind. */
export function ohneVersion<T>(daten: T): T {
  if (!istObjekt(daten) || !(SCHEMA_FELD in daten)) return daten;
  const { [SCHEMA_FELD]: _alt, ...rest } = daten;
  return rest as T;
}

/** Zum Schreiben (Format v2): `_v` = aktuelle Version (hinten angehängt). Arrays und Nicht-Objekte bleiben, wie sie sind. */
export function mitVersion<T>(name: string, daten: T): T {
  if (!istObjekt(daten)) return daten;
  const { [SCHEMA_FELD]: _alt, ...rest } = daten;
  return { ...rest, [SCHEMA_FELD]: aktuelleVersion(name) } as T;
}
