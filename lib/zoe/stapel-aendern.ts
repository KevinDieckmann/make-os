// ─── MAKE OS — „Ändern & freigeben“ im Freigabe-Stapel (rein, 08.10., Phase 0) ──
// Bis 08.10. gab es das nur in der Vollansicht /os/stapel/voll; seitdem steht es in den Freigaben selbst (Reiter „Offen“),
// das Protokoll ist der Reiter „Protokoll“ (components/os/StapelProtokoll.tsx). Die Route (app/api/zoe/stapel) ersetzt bei
// „Ändern & freigeben“ die GANZE Eingabe durch die geschickte und nimmt nur einfache Werte an (verschachtelte nur, wenn sie
// unverändert aus dem Vorschlag kommen; ein Zahl-Feld nur als Zahl). Darum: geschickt wird immer die volle Eingabe —
// unveränderte Werte, wie sie waren (die Vollansicht machte aus jedem Wert Text, aus Objekten „[object Object]“), geänderte
// in ihrer alten Form: ein Zahl-Feld bleibt eine Zahl, und zwar nur, wenn der Text EINDEUTIG eine ist (`zahlAusText`) —
// sonst wird nicht freigegeben, und das Feld sagt, warum (Gegenprüfung 08.10.: `Number("1.500")` war 1,5 und „1500,50“ ging
// als Text an das Werkzeug, das dann still falsch rechnete).
// Nur für gewöhnliche Werkzeug-Vorschläge: Vorschläge einer Art (`bezug`, z. B. Aufgabe mit Häkchen je Feld, CRM) übernehmen
// über ihren eigenen Weg — die CRM-Art liest eine geänderte Eingabe gar nicht.

export interface AenderbaresFeld { schluessel: string; wert: string; zahl: boolean }
export interface FeldFehler { schluessel: string; grund: string }
export type AenderungErgebnis = { ok: true; eingabe: Record<string, unknown> } | { ok: false; fehler: FeldFehler[] };

/** Grund, wenn ein Zahl-Feld keine eindeutige Zahl trägt — steht am Feld, das Freigeben ist solange gesperrt. */
export const ZAHL_UNKLAR = 'Keine eindeutige Zahl — z. B. 1500, 1.500 oder 1500,50.';
export const ZAHL_FEHLT = 'Hier muss eine Zahl stehen.';

/**
 * Eine Zahl so, wie man sie hier liest und tippt: Komma statt Punkt, OHNE Tausenderpunkte (sonst wäre „1.500“ als Anzeige
 * von 1,5 nicht von 1500 zu unterscheiden). Am deutschen iPhone zeigt `inputMode="decimal"` ohnehin das Komma.
 */
export function zahlAlsText(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Text → Zahl, nur wenn EINDEUTIG (sonst null — dann wird nicht freigegeben):
 *   „1500“, „-3“ · deutsch „1500,50“, „1,5“ · Tausenderpunkte „1.500“, „1.500,50“, „12.345.678“ · ein Punkt ohne genau drei
 *   Ziffern dahinter bzw. mit führender 0 ist ein Dezimalpunkt („12.5“, „0.125“) · Leerzeichen, „€“ und ein führendes „+“ fallen weg.
 * Abgelehnt: leer, „viel“, „1,2,3“, „1.50,5“, „1e5“, „0x10“, „19 %“, „Infinity“.
 * Bewusst nicht `Number(text)` (s. o.), nicht `euroAlsCent` (rundet auf Cent — die Felder sind nicht nur Euro) und nicht
 * `parseBetrag` aus der Finanzplanung (liest „0.125“ als 125 und zöge den Rechenkern in den Browser).
 */
export function zahlAusText(text: string): number | null {
  const t = String(text ?? '').replace(/[\s€]/g, '').replace(/^\+/, '');
  if (!t) return null;
  let s: string;
  if (t.includes(',')) {
    if (!/^-?(\d{1,3}(\.\d{3})+|\d+),\d+$/.test(t)) return null;
    s = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) s = t.replace(/\./g, '');
  else if (/^-?\d+(\.\d+)?$/.test(t)) s = t;
  else return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** So, wie eine gelesene Zahl neben dem Feld steht („= 1.500,5“) — damit man sieht, was ZOE bekommt. */
export function zahlAnzeige(n: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 10 }).format(n);
}

/** Die Felder, die man vor dem Freigeben ändern kann: Text und Zahl, ohne interne Schlüssel (`_…`). */
export function aenderbareFelder(eingabe: Record<string, unknown> | null | undefined): AenderbaresFeld[] {
  if (!eingabe || typeof eingabe !== 'object') return [];
  return Object.entries(eingabe)
    .filter(([k, w]) => !k.startsWith('_') && (typeof w === 'string' || (typeof w === 'number' && Number.isFinite(w))))
    .map(([k, w]) => ({ schluessel: k, wert: typeof w === 'number' ? zahlAlsText(w) : String(w), zahl: typeof w === 'number' }));
}

/** Darf dieser Vorschlag vor dem Freigeben geändert werden? */
export function darfAendern(v: { eingabe?: Record<string, unknown> | null; bezug?: unknown }): boolean {
  return !v.bezug && aenderbareFelder(v.eingabe).length > 0;
}

const eigen = (o: Record<string, string>, s: string) => Object.prototype.hasOwnProperty.call(o, s);

/**
 * Ein Feld nach der Änderung: unverändert → null (der alte Wert bleibt, wie er war), Text → der Text, Zahl → nur eine
 * eindeutige Zahl, sonst der Grund.
 */
export function feldNachAenderung(f: AenderbaresFeld, text: string): { wert: string | number } | { grund: string } | null {
  if (text === f.wert) return null;
  if (!f.zahl) return { wert: text };
  if (text.trim() === '') return { grund: ZAHL_FEHLT };
  const n = zahlAusText(text);
  return n === null ? { grund: ZAHL_UNKLAR } : { wert: n };
}

/** Felder, die so nicht freigegeben werden können (Zahl-Feld ohne eindeutige Zahl) — leer = alles in Ordnung. */
export function aenderungFehler(eingabe: Record<string, unknown>, geaendert: Record<string, string>): FeldFehler[] {
  const raus: FeldFehler[] = [];
  for (const f of aenderbareFelder(eingabe)) {
    if (!eigen(geaendert, f.schluessel)) continue;
    const n = feldNachAenderung(f, geaendert[f.schluessel]);
    if (n && 'grund' in n) raus.push({ schluessel: f.schluessel, grund: n.grund });
  }
  return raus;
}

/**
 * Die volle Eingabe für „Ändern & freigeben“: alles wie im Vorschlag, nur die geänderten Felder neu — oder die Felder, an
 * denen es scheitert (dann geht nichts an den Server). Unbekannte Schlüssel kommen nie dazu.
 */
export function eingabeMitAenderung(eingabe: Record<string, unknown>, geaendert: Record<string, string>): AenderungErgebnis {
  const raus: Record<string, unknown> = { ...eingabe };
  const fehler: FeldFehler[] = [];
  for (const f of aenderbareFelder(eingabe)) {
    if (!eigen(geaendert, f.schluessel)) continue; // nur bekannte, einfache Felder — nie neue Schlüssel
    const n = feldNachAenderung(f, geaendert[f.schluessel]);
    if (!n) continue;
    if ('grund' in n) fehler.push({ schluessel: f.schluessel, grund: n.grund });
    else raus[f.schluessel] = n.wert;
  }
  return fehler.length ? { ok: false, fehler } : { ok: true, eingabe: raus };
}

/** Hat sich überhaupt etwas geändert? (Sonst ist es ein gewöhnliches Freigeben.) */
export function hatAenderung(eingabe: Record<string, unknown>, geaendert: Record<string, string>): boolean {
  return aenderbareFelder(eingabe).some(f => eigen(geaendert, f.schluessel) && geaendert[f.schluessel] !== f.wert);
}

/**
 * Woher der Anlass eines Vorschlags kommt (aus der alten Vollansicht übernommen, Gegenprüfung 08.10.): „weil du gesagt hast:
 * „…““ NUR, wenn er wirklich ein Satz aus dem Gespräch ist — gewöhnlicher Werkzeug-Vorschlag aus dem Gespräch (`kimmi` legt die
 * Nachricht als Anlass ab). Aus einem Lauf (Morgen/Abend, Agenten, Aufgaben-Lauf, Kalender-Analyse), aus dem Takt („Takt: …“)
 * oder als Begründung einer Art (`bezug`: CRM, Aufgabe, Kalender) ist es ZOEs eigene Herleitung → „ZOE: …“. „Weil du gesagt
 * hast“ über einer Herleitung wäre schlicht falsch. null = kein Anlass.
 */
export function anlassText(v: { anlass?: string | null; quelle?: 'gespraech' | 'lauf'; bezug?: unknown }): string | null {
  const a = typeof v.anlass === 'string' ? v.anlass.trim() : '';
  if (!a) return null;
  const vonDir = v.quelle !== 'lauf' && !v.bezug && !/^Takt:/.test(a);
  return vonDir ? `weil du gesagt hast: „${a}“` : `ZOE: ${a}`;
}
