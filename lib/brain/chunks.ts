// ─── Brain-Index: Notizen in Abschnitte teilen (rein, getestet, 27.09.) ─────
// Kevins Entscheidung 27.09.: Volltext-Index (FTS5) + lokale Embeddings. Beides
// arbeitet auf ABSCHNITTEN, nicht auf ganzen Notizen: ~400–600 Tokens
// (≈ 1.600–2.400 Zeichen), geschnitten an Markdown-Überschriften, 10 %
// Überlappung, und jedem Abschnitt geht sein Kontext voran („Notiz › H1 › H2 ·
// tags“) — Anthropic Contextual Retrieval (BRAIN_RECHERCHE.md, Punkt 5).
// Frontmatter wird nicht eingebettet, sondern als Filter gespeichert.

export interface Abschnitt {
  /** Laufende Nummer in der Notiz. */
  position: number;
  /** Überschriftenpfad, z. B. „Ist-Stand › Zahlen“. */
  ueberschrift: string;
  /** Kontextzeile, die dem Text vorangeht (Notiztitel › Überschriften · tags). */
  kontext: string;
  /** Der eigentliche Text des Abschnitts. */
  text: string;
}

export const ZIEL_ZEICHEN = 2000;
export const MAX_ZEICHEN = 2600;
const UEBERLAPPUNG = 0.1;

/** Text in Absätze schneiden (Leerzeile), Codeblöcke bleiben zusammen. */
function absaetze(text: string): string[] {
  const raus: string[] = [];
  let puffer: string[] = [];
  let imCode = false;
  const spuelen = () => { const t = puffer.join('\n').trim(); if (t) raus.push(t); puffer = []; };
  for (const zeile of text.split(/\r?\n/)) {
    if (/^```/.test(zeile)) { imCode = !imCode; puffer.push(zeile); if (!imCode) spuelen(); continue; }
    if (!imCode && !zeile.trim()) { spuelen(); continue; }
    puffer.push(zeile);
  }
  spuelen();
  return raus;
}

/** Einen zu langen Block in Stücke mit Überlappung teilen. */
function stuecke(text: string): string[] {
  if (text.length <= MAX_ZEICHEN) return [text];
  const teile = absaetze(text);
  const raus: string[] = [];
  let aktuell = '';
  for (const a of teile) {
    if (a.length > MAX_ZEICHEN) {
      // Ein einzelner Riesenabsatz: hart schneiden, mit Überlappung.
      if (aktuell) { raus.push(aktuell); aktuell = ''; }
      const schritt = Math.floor(ZIEL_ZEICHEN * (1 - UEBERLAPPUNG));
      for (let i = 0; i < a.length; i += schritt) raus.push(a.slice(i, i + ZIEL_ZEICHEN));
      continue;
    }
    if ((aktuell + '\n\n' + a).length > ZIEL_ZEICHEN && aktuell) {
      raus.push(aktuell);
      // Überlappung: der letzte Absatz (gekürzt) wandert mit in den nächsten Abschnitt.
      const schwanz = aktuell.slice(-Math.floor(ZIEL_ZEICHEN * UEBERLAPPUNG));
      const ab = schwanz.indexOf('\n');
      aktuell = (ab >= 0 && ab < schwanz.length - 1 ? schwanz.slice(ab + 1) : schwanz).trim();
      aktuell = aktuell ? `${aktuell}\n\n${a}` : a;
    } else aktuell = aktuell ? `${aktuell}\n\n${a}` : a;
  }
  if (aktuell) raus.push(aktuell);
  return raus;
}

/**
 * Rumpf einer Notiz (ohne Frontmatter) → Abschnitte. Geschnitten an # / ## / ###;
 * kleine aufeinanderfolgende Abschnitte werden zusammengelegt, große geteilt.
 */
export function abschnitte(titel: string, rumpf: string, tags: string[] = []): Abschnitt[] {
  const zeilen = rumpf.split(/\r?\n/);
  const bloecke: { pfad: string[]; zeilen: string[] }[] = [];
  let pfad: string[] = [];
  let aktuell: string[] = [];
  let imCode = false;
  const schliesse = () => { if (aktuell.join('\n').trim()) bloecke.push({ pfad: [...pfad], zeilen: aktuell }); aktuell = []; };
  for (const z of zeilen) {
    if (/^```/.test(z)) imCode = !imCode;
    const m = !imCode && z.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (m) {
      schliesse();
      const tiefe = m[1].length;
      pfad = [...pfad.slice(0, tiefe - 1), m[2].trim()];
      while (pfad.length < tiefe) pfad.splice(pfad.length - 1, 0, '');
      continue;
    }
    aktuell.push(z);
  }
  schliesse();

  // Kleine Nachbarn zusammenlegen (gleicher H1-Zweig), damit nicht jede Zwei-Zeilen-Überschrift ein eigener Abschnitt wird.
  const zusammen: { pfad: string[]; text: string }[] = [];
  for (const b of bloecke) {
    const text = b.zeilen.join('\n').trim();
    const letzter = zusammen[zusammen.length - 1];
    if (letzter && letzter.text.length + text.length < ZIEL_ZEICHEN / 2 && letzter.pfad[0] === b.pfad[0]) {
      letzter.text = `${letzter.text}\n\n${b.pfad.filter(Boolean).slice(-1).map(h => `**${h}**`).join('')}\n${text}`.trim();
      continue;
    }
    zusammen.push({ pfad: b.pfad, text });
  }

  const raus: Abschnitt[] = [];
  const tagText = tags.length ? ` · ${tags.slice(0, 8).join(', ')}` : '';
  for (const b of zusammen) {
    const ueberschrift = b.pfad.filter(Boolean).join(' › ');
    const kontext = `${titel}${ueberschrift ? ` › ${ueberschrift}` : ''}${tagText}`;
    for (const s of stuecke(b.text)) raus.push({ position: raus.length, ueberschrift, kontext, text: s });
  }
  return raus;
}

/** Wikilink-Ziele einer Notiz — Nachbarschaft für den Index (1 Hop). */
export function verweise(rumpf: string): string[] {
  return Array.from(new Set(Array.from(rumpf.matchAll(/\[\[([^\]|#]+)/g)).map(m => m[1].trim()).filter(Boolean))).slice(0, 60);
}

/** Suchbegriffe für FTS5: Wörter ab 2 Zeichen, Sonderzeichen raus, als OR-Anfrage mit Präfix. */
export function ftsAnfrage(frage: string): string {
  const woerter = frage.toLowerCase().split(/[^a-z0-9äöüß]+/i).filter(w => w.length >= 2).slice(0, 10);
  return woerter.map(w => `"${w.replace(/"/g, '')}"*`).join(' OR ');
}
