// ─── Werkzeug-Verträge: Laufzeitprüfung der Eingabe (10.10., Paket V3, AGENTEN_KONZEPT_V2.md C3/T3) — rein, Server UND Browser ──────────────
// Bis V3 ging das Eingabe-Schema nur an das Modell; zur Laufzeit prüfte niemand, die Werkzeuge „reparierten“ still (Uhrzeit geklemmt, Titel
// gekürzt, Unbekanntes verworfen). Jetzt prüft die Hülle (`fuehreAus`, Agenten-Kern) JEDE Eingabe gegen dasselbe Schema, das das Modell sieht —
// ungültig → Fehlerklasse `eingabe` mit einem Satz je Fund, NICHTS wird ausgeführt oder in den Stapel gelegt.
//
// Eigener kleiner Prüfer (Entscheidung im Konzept offen gelassen, hier: keine neue Abhängigkeit) für die Teilmenge, die die Werkzeuge benutzen:
// type (string · number · integer · boolean · object · array, auch als Liste) · enum · required · properties · additionalProperties · items ·
// minItems/maxItems · minimum/maximum · multipleOf · minLength/maxLength · pattern. `description` und Unbekanntes werden ignoriert.
// Regeln, die bewusst so sind:
//   • `null` bei einem freiwilligen Feld = nicht angegeben (das Modell schreibt gern `null`); bei einem Pflichtfeld = fehlt.
//   • Ein Objekt MIT `properties` nimmt keine fremden Schlüssel an (`additionalProperties: true` erlaubt sie) — außer internen `_…` des Servers
//     (z. B. `_stand` im Stapel). Ein Objekt OHNE `properties` (freie Felder, z. B. `felder`) nimmt alles.
//   • Eine leere `enum`-Liste heißt „zur Laufzeit festgelegt“ (z. B. die Mitarbeiter eines Heads) — dann prüft die Liste der Aufrufer.
//   • Zahlen nur als Zahl (kein „540“ als Text) — der Satz sagt es dem Modell, es ruft dann richtig.

export interface Schema {
  type?: string | string[];
  enum?: readonly unknown[];
  required?: readonly string[];
  properties?: Readonly<Record<string, Schema>>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
}

export type PruefErgebnis = { ok: true } | { ok: false; fehler: string[] };

/** Höchstens so viele Funde je Prüfung (mehr hilft dem Modell nicht). */
export const FUNDE_MAX = 6;

const TYP_NAME: Readonly<Record<string, string>> = {
  string: 'ein Text', number: 'eine Zahl', integer: 'eine ganze Zahl', boolean: 'wahr oder falsch (true/false)', object: 'ein Objekt', array: 'eine Liste',
};
const zeigen = (v: unknown): string => {
  const s = typeof v === 'string' ? `„${v}“` : JSON.stringify(v);
  return (s ?? String(v)).length > 40 ? `${(s ?? String(v)).slice(0, 37)}…` : (s ?? String(v));
};
const pfadText = (p: string): string => (p ? `„${p}“` : 'Die Eingabe');

function typPasst(t: string, v: unknown): boolean {
  switch (t) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'boolean': return typeof v === 'boolean';
    case 'object': return !!v && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'null': return v === null;
    default: return true;
  }
}

function pruefe(s: Schema, v: unknown, pfad: string, funde: string[]): void {
  if (funde.length >= FUNDE_MAX) return;
  const typen = s.type === undefined ? [] : Array.isArray(s.type) ? s.type : [s.type];
  if (typen.length && !typen.some(t => typPasst(t, v))) {
    funde.push(`${pfadText(pfad)} muss ${typen.map(t => TYP_NAME[t] ?? t).join(' oder ')} sein${v === undefined ? '' : ` (bekommen: ${zeigen(v)})`}.`);
    return;
  }
  if (s.enum && s.enum.length && !s.enum.some(e => e === v)) {
    const liste = s.enum.map(e => String(e));
    funde.push(`${pfadText(pfad)} muss einer dieser Werte sein: ${liste.slice(0, 12).join(', ')}${liste.length > 12 ? ' …' : ''} (bekommen: ${zeigen(v)}).`);
    return;
  }
  if (typeof v === 'string') {
    if (s.minLength !== undefined && v.length < s.minLength) funde.push(`${pfadText(pfad)} ist zu kurz (mindestens ${s.minLength} Zeichen${s.minLength === 1 ? ' — darf nicht leer sein' : ''}).`);
    if (s.maxLength !== undefined && v.length > s.maxLength) funde.push(`${pfadText(pfad)} ist länger als ${s.maxLength} Zeichen (${v.length}) — kürzer fassen; nichts wird still gekürzt.`);
    if (s.pattern !== undefined) {
      let re: RegExp | null = null;
      try { re = new RegExp(s.pattern, 'u'); } catch { re = null; }
      if (re && !re.test(v)) funde.push(`${pfadText(pfad)} hat nicht die erwartete Form (${s.description ?? s.pattern}).`);
    }
  }
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) funde.push(`${pfadText(pfad)} muss mindestens ${s.minimum} sein (bekommen: ${v}).`);
    if (s.maximum !== undefined && v > s.maximum) funde.push(`${pfadText(pfad)} darf höchstens ${s.maximum} sein (bekommen: ${v}).`);
    if (s.multipleOf !== undefined && s.multipleOf > 0 && Math.abs(v / s.multipleOf - Math.round(v / s.multipleOf)) > 1e-9) funde.push(`${pfadText(pfad)} muss ein Vielfaches von ${s.multipleOf} sein (bekommen: ${v}).`);
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) funde.push(`${pfadText(pfad)} braucht mindestens ${s.minItems} Einträge.`);
    if (s.maxItems !== undefined && v.length > s.maxItems) funde.push(`${pfadText(pfad)} hat mehr als ${s.maxItems} Einträge (${v.length}) — weniger angeben; nichts wird still gekürzt.`);
    if (s.items) for (let i = 0; i < v.length && funde.length < FUNDE_MAX; i++) pruefe(s.items, v[i], `${pfad}[${i}]`, funde);
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) objekt(s, v as Record<string, unknown>, pfad, funde);
}

function objekt(s: Schema, o: Record<string, unknown>, pfad: string, funde: string[]): void {
  const props = s.properties;
  for (const r of s.required ?? []) {
    if (o[r] === undefined || o[r] === null) funde.push(`${pfadText(pfad ? `${pfad}.${r}` : r)} fehlt (Pflichtfeld).`);
    if (funde.length >= FUNDE_MAX) return;
  }
  for (const [k, w] of Object.entries(o)) {
    if (funde.length >= FUNDE_MAX) return;
    const p = pfad ? `${pfad}.${k}` : k;
    const kind = props?.[k];
    if (kind) {
      if (w === undefined || w === null) continue; // nicht angegeben (Pflicht prüft oben)
      pruefe(kind, w, p, funde);
      continue;
    }
    if (!props || k.startsWith('_')) continue;
    if (s.additionalProperties === true) continue;
    if (s.additionalProperties && typeof s.additionalProperties === 'object') { if (w !== undefined && w !== null) pruefe(s.additionalProperties, w, p, funde); continue; }
    if (w === undefined) continue;
    funde.push(`${pfadText(p)} gibt es bei diesem Werkzeug nicht${props && Object.keys(props).length ? ` (erlaubt: ${Object.keys(props).slice(0, 12).join(', ')}${Object.keys(props).length > 12 ? ' …' : ''})` : ''}.`);
  }
}

/** Eine Eingabe gegen ein Schema prüfen (rein). Die Wurzel muss ein Objekt sein (Werkzeug-Eingaben sind immer Objekte). */
export function pruefeEingabe(schema: Schema | Record<string, unknown> | null | undefined, eingabe: unknown): PruefErgebnis {
  const s = (schema ?? {}) as Schema;
  if (!eingabe || typeof eingabe !== 'object' || Array.isArray(eingabe)) return { ok: false, fehler: ['Die Eingabe muss ein Objekt mit Feldern sein.'] };
  const funde: string[] = [];
  objekt(s, eingabe as Record<string, unknown>, '', funde);
  return funde.length ? { ok: false, fehler: funde } : { ok: true };
}

/** Der Satz für das Modell (bzw. die Person im Stapel), wenn die Eingabe nicht passt — nichts wurde ausgeführt. */
export function eingabeFehlerText(name: string, fehler: readonly string[]): string {
  return `Fehlgeschlagen: Eingabe für „${name}“ ungültig — ${fehler.join(' ')} Nichts ausgeführt; bitte mit gültigen Werten erneut aufrufen.`;
}

/**
 * Eine kleinste gültige Eingabe zu einem Schema (rein) — für die Wächter (jeder Vertrag hat eine prüfbare gültige Eingabe) und Prüffälle.
 * Pflichtfelder bekommen den ersten Enum-Wert bzw. einen typischen Wert innerhalb der Grenzen.
 */
export function beispielEingabe(schema: Schema | Record<string, unknown>): Record<string, unknown> {
  const s = schema as Schema;
  const wert = (k: Schema): unknown => {
    if (k.enum?.length) return k.enum[0];
    const t = Array.isArray(k.type) ? k.type[0] : k.type;
    if (t === 'number' || t === 'integer') {
      const min = k.minimum ?? 1, max = k.maximum ?? Math.max(min, 1);
      let n = Math.min(Math.max(min, 1), max);
      if (k.multipleOf) n = Math.ceil(min / k.multipleOf) * k.multipleOf;
      return n;
    }
    if (t === 'boolean') return true;
    if (t === 'array') return k.minItems ? Array.from({ length: k.minItems }, () => (k.items ? wert(k.items) : 'x')) : [];
    if (t === 'object') return k.properties ? beispielEingabe(k) : {};
    return 'x'.repeat(Math.max(1, k.minLength ?? 1));
  };
  return Object.fromEntries((s.required ?? []).map(r => [r, wert(s.properties?.[r] ?? {})]));
}
