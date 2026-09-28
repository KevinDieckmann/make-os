// ─── MAKE OS — CSV lesen, richtig ───────────────────────────────────────────
// Kevins Masterliste ist Semikolon-getrennt (Excel auf Deutsch), und Felder
// wie STECKBRIEF oder MARKTINFO stehen in Anführungszeichen — mit Semikolons
// und Zeilenumbrüchen darin. Ein `zeile.split(';')` würde jeden zweiten
// Kontakt zerreißen. Deshalb ein kleiner Zustandsautomat nach RFC 4180:
// Anführungszeichen öffnen ein Feld, doppelte Anführungszeichen darin sind
// ein literales Zeichen, und ein Zeilenumbruch zählt nur außerhalb.
//
// Kein Paket dafür: die Regel ist 30 Zeilen lang, und ein Paket wäre die
// eine Stelle, an der niemand mehr weiß, was mit einem Feld passiert.

/** Was beim Lesen auffiel — für die Import-Vorschau (K2 #21). */
export interface CsvBefund {
  kopf: string[];
  zeilen: Record<string, string>[];
  /** Je Datenzeile (gleiche Reihenfolge wie `zeilen`): Zahl der Felder und Zeilennummer in der Datei (Kopf = 1). */
  spalten: number[];
  zeileNr: number[];
}

export function csvLesen(text: string, trenner = ';'): Record<string, string>[] {
  return csvLesenMitBefund(text, trenner).zeilen;
}

/**
 * Wie `csvLesen`, dazu je Zeile die Feldzahl und die Zeilennummer — eine Zeile mit anderer Spaltenzahl als der
 * Kopf ist verrutscht (Semikolon im Text ohne Anführungszeichen) und wird in der Vorschau gemeldet.
 * Alles wird NFC-normalisiert (K2 #13: macOS/Excel liefern Umlaute auch zerlegt).
 */
export function csvLesenMitBefund(text: string, trenner = ';'): CsvBefund {
  const zeilen: string[][] = [];
  const start: number[] = [];
  let zeile: string[] = [];
  let feld = '';
  let inAnfuehrung = false;
  let nr = 1, beginn = 1;
  // BOM von Excel wegnehmen, sonst heißt die erste Spalte "\uFEFFSTECKBRIEF".
  const roh = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const t = roh.normalize('NFC');

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\n') nr++;
    if (inAnfuehrung) {
      if (c === '"') {
        if (t[i + 1] === '"') { feld += '"'; i++; }
        else inAnfuehrung = false;
      } else feld += c;
      continue;
    }
    if (c === '"') { inAnfuehrung = true; continue; }
    if (c === trenner) { zeile.push(feld); feld = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { zeile.push(feld); zeilen.push(zeile); start.push(beginn); beginn = nr; zeile = []; feld = ''; continue; }
    feld += c;
  }
  if (feld.length || zeile.length) { zeile.push(feld); zeilen.push(zeile); start.push(beginn); }

  const kopf = (zeilen.shift() ?? []).map(k => k.trim());
  start.shift();
  const befund: CsvBefund = { kopf, zeilen: [], spalten: [], zeileNr: [] };
  zeilen.forEach((z, i) => {
    if (!z.some(v => v.trim().length)) return;
    befund.zeilen.push(Object.fromEntries(kopf.map((k, j) => [k, (z[j] ?? '').trim()])));
    befund.spalten.push(z.length);
    befund.zeileNr.push(start[i]);
  });
  return befund;
}

/** Trennzeichen erraten: was in der Kopfzeile häufiger vorkommt. */
export function trennerVon(text: string): string {
  const kopf = text.split('\n', 1)[0] ?? '';
  return (kopf.match(/;/g)?.length ?? 0) >= (kopf.match(/,/g)?.length ?? 0) ? ';' : ',';
}
