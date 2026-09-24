// ─── Zu zweit arbeiten: nur schicken, was sich geändert hat (24.09.) ────────
// Kevin: „Wenn wir beide in der Software arbeiten, müssen wir alles perfekt
// zusammen ausarbeiten können.“ Seiten, die bisher ihren GANZEN Stand
// geschrieben haben, überschrieben still, was der andere inzwischen geändert
// hatte. Jetzt vergleicht die Seite mit dem zuletzt bekannten Serverstand und
// schickt nur Einzeländerungen: neue/geänderte Einträge, gelöschte Einträge,
// geänderte Einzelfelder. Der Server wendet sie auf SEINEN aktuellen Stand an —
// Änderungen an verschiedenen Einträgen kommen so beide an.

/** Die Listen des Finanzplans (Firmen/Konten, Rechnungen, Zahlungen, Merkposten, Produkte). */
export const FINANZPLAN_LISTEN = ['firmen', 'rechnungen', 'zahlungen', 'merkposten', 'produkte'];

export interface ListenOp { liste: string; op: 'upsert' | 'delete'; eintrag?: Record<string, unknown>; id?: string }
export interface Aenderung { ops: ListenOp[]; felder: Record<string, unknown> }

/** Listen und ihr Schlüsselfeld: ['rechnungen'] (Schlüssel „id“) oder { months: 'm' }. */
export type ListenSchluessel = string[] | Record<string, string>;
export const schluesselVon = (l: ListenSchluessel): Record<string, string> => (Array.isArray(l) ? Object.fromEntries(l.map(n => [n, 'id'])) : l);

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function aenderungen(alt: Record<string, unknown>, neu: Record<string, unknown>, listen: ListenSchluessel): Aenderung {
  const schluessel = schluesselVon(listen);
  const ops: ListenOp[] = [];
  for (const [name, feld] of Object.entries(schluessel)) {
    const vorher = new Map(((alt[name] as Record<string, unknown>[] | undefined) ?? []).map(x => [String(x[feld]), x]));
    for (const x of ((neu[name] as Record<string, unknown>[] | undefined) ?? [])) {
      const k = String(x[feld]);
      if (!gleich(vorher.get(k), x)) ops.push({ liste: name, op: 'upsert', eintrag: x });
      vorher.delete(k);
    }
    for (const k of Array.from(vorher.keys())) ops.push({ liste: name, op: 'delete', id: k });
  }
  const felder: Record<string, unknown> = {};
  for (const k of Object.keys(neu)) if (!(k in schluessel) && !gleich(alt[k], neu[k])) felder[k] = neu[k];
  return { ops, felder };
}

export const leer = (a: Aenderung) => !a.ops.length && !Object.keys(a.felder).length;

/** Serverseitig: Einzeländerungen auf eine Liste anwenden (Schlüssel „id“ o. a.). */
export function wendeAn<T extends Record<string, unknown>>(liste: T[], ops: ListenOp[], feld = 'id', saeubern: (roh: Record<string, unknown>) => T | null = x => x as T): { liste: T[]; angewandt: number } {
  const nach = new Map(liste.map(x => [String(x[feld]), x]));
  let angewandt = 0;
  for (const o of ops) {
    if (o.op === 'delete') { if (o.id != null && nach.delete(String(o.id))) angewandt++; continue; }
    const s = o.eintrag ? saeubern(o.eintrag) : null;
    if (s && s[feld] != null) { nach.set(String(s[feld]), s); angewandt++; }
  }
  return { liste: Array.from(nach.values()), angewandt };
}
