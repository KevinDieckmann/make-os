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

export function csvLesen(text: string, trenner = ';'): Record<string, string>[] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let inAnfuehrung = false;
  // BOM von Excel wegnehmen, sonst heißt die erste Spalte "﻿STECKBRIEF".
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
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
    if (c === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; continue; }
    feld += c;
  }
  if (feld.length || zeile.length) { zeile.push(feld); zeilen.push(zeile); }

  const kopf = (zeilen.shift() ?? []).map(k => k.trim());
  return zeilen
    .filter(z => z.some(v => v.trim().length))
    .map(z => Object.fromEntries(kopf.map((k, i) => [k, (z[i] ?? '').trim()])));
}

/** Trennzeichen erraten: was in der Kopfzeile häufiger vorkommt. */
export function trennerVon(text: string): string {
  const kopf = text.split('\n', 1)[0] ?? '';
  return (kopf.match(/;/g)?.length ?? 0) >= (kopf.match(/,/g)?.length ?? 0) ? ';' : ',';
}
