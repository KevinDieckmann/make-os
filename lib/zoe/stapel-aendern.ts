// ─── MAKE OS — „Ändern & freigeben“ im Freigabe-Stapel (rein, 08.10., Phase 0) ──
// Bis 08.10. gab es das nur in der Vollansicht /os/stapel/voll; seitdem steht es in den Freigaben selbst (Reiter „Offen“),
// das Protokoll ist der Reiter „Protokoll“ (components/os/StapelProtokoll.tsx). Die Route (app/api/zoe/stapel) ersetzt bei
// „Ändern & freigeben“ die GANZE Eingabe durch die geschickte und nimmt nur einfache Werte an (verschachtelte nur, wenn sie
// unverändert aus dem Vorschlag kommen). Darum: geschickt wird immer die volle Eingabe — unveränderte Werte, wie sie waren
// (die Vollansicht machte aus jedem Wert Text, aus Objekten „[object Object]“), geänderte in ihrer alten Form (Zahl bleibt Zahl).
// Nur für gewöhnliche Werkzeug-Vorschläge: Vorschläge einer Art (`bezug`, z. B. Aufgabe mit Häkchen je Feld, CRM) übernehmen
// über ihren eigenen Weg — die CRM-Art liest eine geänderte Eingabe gar nicht.

export interface AenderbaresFeld { schluessel: string; wert: string; zahl: boolean }

/** Die Felder, die man vor dem Freigeben ändern kann: Text und Zahl, ohne interne Schlüssel (`_…`). */
export function aenderbareFelder(eingabe: Record<string, unknown> | null | undefined): AenderbaresFeld[] {
  if (!eingabe || typeof eingabe !== 'object') return [];
  return Object.entries(eingabe)
    .filter(([k, w]) => !k.startsWith('_') && (typeof w === 'string' || (typeof w === 'number' && Number.isFinite(w))))
    .map(([k, w]) => ({ schluessel: k, wert: String(w), zahl: typeof w === 'number' }));
}

/** Darf dieser Vorschlag vor dem Freigeben geändert werden? */
export function darfAendern(v: { eingabe?: Record<string, unknown> | null; bezug?: unknown }): boolean {
  return !v.bezug && aenderbareFelder(v.eingabe).length > 0;
}

/**
 * Die volle Eingabe für „Ändern & freigeben“: alles wie im Vorschlag, nur die geänderten Felder neu. Ein Zahl-Feld bleibt
 * eine Zahl, solange der neue Text eine ist (sonst Text — das Werkzeug prüft selbst und lehnt mit Grund ab).
 */
export function eingabeMitAenderung(eingabe: Record<string, unknown>, geaendert: Record<string, string>): Record<string, unknown> {
  const felder = new Map(aenderbareFelder(eingabe).map(f => [f.schluessel, f]));
  const raus: Record<string, unknown> = { ...eingabe };
  for (const [schluessel, text] of Object.entries(geaendert)) {
    const f = felder.get(schluessel);
    if (!f) continue; // nur bekannte, einfache Felder — nie neue Schlüssel
    raus[schluessel] = f.zahl && text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
  }
  return raus;
}

/** Hat sich überhaupt etwas geändert? (Sonst ist es ein gewöhnliches Freigeben.) */
export function hatAenderung(eingabe: Record<string, unknown>, geaendert: Record<string, string>): boolean {
  const eigen = (s: string) => Object.prototype.hasOwnProperty.call(geaendert, s);
  return aenderbareFelder(eingabe).some(f => eigen(f.schluessel) && geaendert[f.schluessel] !== f.wert);
}
