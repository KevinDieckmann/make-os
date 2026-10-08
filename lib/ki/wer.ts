// ─── Wortfehlerrate (WER) für den deutschen Transkriptions-Vergleich (09.10.2026, Paket 6a) — rein ──────────────────────────
// Kevin 08.10. (Antwort 25): „Voxtral nach deutschem Test.“ Eine unabhängige Deutsch-Bewertung ist nicht belegt (MODELLE.md 2.5) — darum
// misst scripts/voxtral-vergleich.mjs eigene Aufnahmen gegen eigene Abschriften. WER = (Ersetzungen + Auslassungen + Einfügungen) / Wörter
// der Referenz, auf Wortebene nach Normalisierung (NFC, klein, Satzzeichen weg, Zahlen bleiben). Gleiche Regel für jeden Anbieter.

/** Text → Wörter (rein): NFC, Kleinschreibung, Satzzeichen weg (Umlaute und ß bleiben), Bindestriche trennen. */
export function woerter(text: string): string[] {
  return text.normalize('NFC').toLowerCase()
    .replace(/[„“”"'‚‘’«»()[\]{}.,;:!?…–—/\\*#_]+/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/).filter(Boolean);
}

export interface WerErgebnis { wer: number; ersetzt: number; ausgelassen: number; eingefuegt: number; woerter: number }

/** Wortfehlerrate der Hypothese gegen die Referenz (Levenshtein auf Wörtern, O(n·m) Speicher O(m)). */
export function wortfehlerrate(referenz: string, hypothese: string): WerErgebnis {
  const r = woerter(referenz), h = woerter(hypothese);
  const n = r.length, m = h.length;
  if (!n) return { wer: m ? 1 : 0, ersetzt: 0, ausgelassen: 0, eingefuegt: m, woerter: 0 };
  // Kosten + Herkunft je Zelle der letzten Zeile mitführen, um S/D/I zu zählen.
  type Z = { k: number; s: number; d: number; i: number };
  let vorher: Z[] = Array.from({ length: m + 1 }, (_, j) => ({ k: j, s: 0, d: 0, i: j }));
  for (let a = 1; a <= n; a++) {
    const jetzt: Z[] = [{ k: a, s: 0, d: a, i: 0 }];
    for (let b = 1; b <= m; b++) {
      const gleich = r[a - 1] === h[b - 1];
      const diag = vorher[b - 1], oben = vorher[b], links = jetzt[b - 1];
      const kandidaten: Z[] = [
        { ...diag, k: diag.k + (gleich ? 0 : 1), s: diag.s + (gleich ? 0 : 1) },
        { ...oben, k: oben.k + 1, d: oben.d + 1 },
        { ...links, k: links.k + 1, i: links.i + 1 },
      ];
      jetzt.push(kandidaten.reduce((x, y) => (y.k < x.k ? y : x)));
    }
    vorher = jetzt;
  }
  const z = vorher[m];
  return { wer: z.k / n, ersetzt: z.s, ausgelassen: z.d, eingefuegt: z.i, woerter: n };
}

/** Mehrere Aufnahmen zusammen (gewichtet nach Wörtern der Referenz). */
export function werGesamt(e: readonly WerErgebnis[]): number {
  const w = e.reduce((a, x) => a + x.woerter, 0);
  return w ? e.reduce((a, x) => a + x.ersetzt + x.ausgelassen + x.eingefuegt, 0) / w : 0;
}
