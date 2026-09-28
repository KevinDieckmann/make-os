// ─── Kennungen für neue Datensätze (29.09., Paket D-A #34) ─────────────────────
// Vorher: `r-` + Date.now().toString(36) & Co. an ≈ 60 Stellen. Zwei Rechnungen in derselben
// Millisekunde (ZOE-Schleife, Doppelklick, Netz-Wiederholung) bekamen dieselbe Kennung — „bezahlt“
// traf dann die falsche, die Buchung `bu-re-<id>` kollidierte. Jetzt: Präfix + zufällige UUID (v4,
// 122 Bit Zufall), z. B. `r-3f2b9c1e-…`. Präfixe bleiben, wie sie waren (Lesbarkeit, Säuberer).
//
// Läuft im Server UND im Browser: `crypto.randomUUID()` gibt es im Browser nur in sicheren
// Kontexten (HTTPS, localhost) — sonst wird die UUID aus `crypto.getRandomValues()` gebaut.
// Kennungen tragen KEINE Zeit mehr: wer nach Zeit sortieren will, nimmt das Zeitfeld des Eintrags.
// Kontakt-Kennungen (`c-<mail>`) stellt ein eigenes Paket um.

/** Eine zufällige UUID v4 (Kleinbuchstaben, mit Bindestrichen). */
export function zufallsUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('Kein sicherer Zufall verfügbar (crypto fehlt).');
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // Version 4
  b[8] = (b[8] & 0x3f) | 0x80; // Variante RFC 4122
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Neue Kennung mit Präfix: `neueKennung('r')` → `r-<uuid>` (38 Zeichen bei einem Buchstaben). */
export function neueKennung(praefix: string): string {
  return `${praefix}-${zufallsUuid()}`;
}
