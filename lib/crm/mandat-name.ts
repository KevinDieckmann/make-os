// ─── Mandat — der Name in Listen und Posten (rein, client-sicher, getestet; 18.10., Nachprüfung N18) ─────────────────────────────
// Ein Mandat aus einem Deal trägt oft den Deal-Titel „Brückenwerk GmbH · Retainer“ — die Anzeige „Firma · Titel“ setzte die Firma dann
// noch einmal davor („Brückenwerk GmbH · Brückenwerk GmbH · Retainer“, Mandatsliste und Liquidität). EINE Regel: steht die Firma am
// Anfang des Titels, fällt sie dort weg; ist der Titel nur die Firma, bleibt die Firma allein. Gespeichert wird nichts anders.

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
/** Trennzeichen zwischen Firma und Rest im Titel („·“, „-“, „–“, „—“, „:“, „|“, „/“, „,“). */
const TRENNER = /^[\s·\-–—:|/,]+/;

/** Der Titel ohne die Firma am Anfang — leer, wenn der Titel nur die Firma ist. */
export function titelOhneFirma(kunde: string | null | undefined, titel: string | null | undefined): string {
  const k = (kunde ?? '').trim(), t = (titel ?? '').trim();
  if (!k || !t) return t;
  if (norm(t) === norm(k)) return '';
  // Nur ein echtes Präfix (danach ein Trenner oder das Ende) — „Acme“ in „Acmeplus Retainer“ bleibt stehen.
  if (norm(t.slice(0, k.length)) === norm(k)) {
    const rest = t.slice(k.length);
    if (TRENNER.test(rest)) return rest.replace(TRENNER, '').trim();
  }
  return t;
}

/** „Firma · Titel“ ohne doppelte Firma; ohne Titel die Firma, ohne Firma der Titel. */
export function mandatName(kunde: string | null | undefined, titel: string | null | undefined): string {
  const k = (kunde ?? '').trim();
  const rest = titelOhneFirma(k, titel);
  return k && rest ? `${k} · ${rest}` : k || rest;
}
