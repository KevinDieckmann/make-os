// ─── MAKE OS — Essensvorschläge personenneutral (08.10., Kevin) ─────────────────────────────────────────────────────────
// Kevin 08.10.: „Essensvorschläge ohne Personen-Vorlieben.“ Wochenvorschlag (/api/ernaehrung/vorschlag) und Rezept
// (/api/ernaehrung/rezept) dürfen die Profile weiter für die RECHNUNG nutzen (Gerichte passend für alle) — aber die Ausgabe lesen
// alle im Haushalt, und Profile sieht sonst nur die Person selbst. Also: kein „für <Name> ohne Feta“, keine Variante je Person,
// keine Begründung, die eine Person nennt.
//
// Zwei Schichten: die Prompt-Regel `PROFIL_DISKRET` (lib/ernaehrung/modell.ts) UND diese Absicherung auf dem Server — das Modell
// kann sich irren, die Antwort geht trotzdem nur personenneutral raus. Rein, ohne Server-Importe; Tests: tests/malin-sicht-2.test.ts.
//
// Regel je Feld (Namen = Haushaltspersonen und Gäste aus den Profilen, auch Vornamen und Genitiv „Malins“):
//   · Gerichtname, Plan-Feld, Zutat, Menge, Einkaufsposten (`ohneNamen`): Klammer mit Namen fällt ganz weg („Bowl (für X ohne
//     Feta)“ → „Bowl“), ebenso ein Teil hinter Komma/Strich/Doppelpunkt mit Namen; bleibt dann noch ein Name, fällt er samt
//     „für/bei/von/mit/ohne“ davor weg. Dieselbe Funktion für Plan und Gericht — so findet der Plan sein Rezept weiter.
//   · Schritt: „für/bei <Name>“ → „für eine Portion“ (der Küchenhinweis bleibt, ohne zu sagen, für wen); nennt der Schritt danach
//     noch einen Namen, fällt er weg.
//   · Tag mit Namen fällt weg. `fuer` = alle, für die geplant wurde (Gerichte passen für alle — nie eine Teilmenge).
//   · Begründung: Sätze mit Namen fallen weg.

/** Mindestlänge für einen Wortteil eines Namens (ganze Namen zählen ab 2 Zeichen). */
const TEIL_MIN = 3;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Die Namen, die in keiner Ausgabe stehen dürfen: Kennung, Anzeigename und dessen Wörter (ab 3 Zeichen) je Profil + weitere. */
export function namenFuer(profile: readonly { person: string; name?: string }[], weitere: readonly string[] = []): string[] {
  const raus = new Set<string>();
  const nimm = (x: unknown, min = 2) => { const t = String(x ?? '').trim(); if (t.length >= min) raus.add(t.toLowerCase()); };
  for (const p of profile) {
    nimm(p.person);
    nimm(p.name);
    for (const w of String(p.name ?? '').split(/[\s\-–,]+/)) nimm(w, TEIL_MIN);
    // Gast-Kennungen („gast-oma“): der Teil hinter dem Präfix ist ein Name.
    const g = /^gast-(.+)$/.exec(p.person);
    if (g) for (const w of g[1].split('-')) nimm(w, TEIL_MIN);
  }
  for (const w of weitere) { nimm(w); for (const t of String(w).split(/\s+/)) nimm(t, TEIL_MIN); }
  raus.delete('gast');
  return [...raus].sort((a, b) => b.length - a.length);
}

/** Ein Name als ganzes Wort (Unicode), mit Genitiv-s. */
const namensMuster = (namen: readonly string[]): RegExp | null =>
  namen.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${namen.map(esc).join('|')})(?:s|['’]s)?(?![\\p{L}\\p{N}])`, 'iu') : null;

/** Steht ein Name der Liste im Text? */
export function nenntPerson(text: string, namen: readonly string[]): boolean {
  const m = namensMuster(namen);
  return !!m && m.test(text);
}

const aufraeumen = (t: string) => t
  .replace(/\(\s*\)|\[\s*\]/g, '')
  .replace(/\s{2,}/g, ' ')
  .replace(/\s+([,;:)\]])/g, '$1')
  .replace(/^[\s,;:–—\-/]+|[\s,;:–—\-/]+$/g, '')
  .trim();

/** Kurzer Text (Gerichtname, Zutat, Menge, Posten) ohne Personennamen — Regel im Dateikopf. */
export function ohneNamen(text: string, namen: readonly string[]): string {
  const m = namensMuster(namen);
  if (!m || !m.test(text)) return text;
  let t = text;
  // 1) Klammern mit Namen ganz weg (von innen nach außen).
  for (let i = 0; i < 5; i++) {
    const neu = t.replace(/\s*[([][^()[\]]*[)\]]/g, teil => (m.test(teil) ? '' : teil));
    if (neu === t) break;
    t = neu;
  }
  // 2) Teile hinter Komma/Strich/Doppelpunkt/Schrägstrich mit Namen weg (der erste Teil bleibt — er ist das Gericht).
  if (m.test(t)) {
    const teile = t.split(/(\s*(?:[,;:–—/]|\s-\s)\s*)/);
    let aus = teile[0];
    for (let i = 1; i < teile.length; i += 2) if (!m.test(teile[i + 1] ?? '')) aus += teile[i] + (teile[i + 1] ?? '');
    t = aus;
  }
  // 3) Was dann noch steht: der Name samt Verhältniswort davor.
  const g = new RegExp(`(?:\\s*(?:für|fuer|bei|von|mit|ohne|nur)\\s+)?${m.source}`, 'giu');
  t = t.replace(g, '');
  return aufraeumen(t);
}

/** Ein Zubereitungs-Schritt ohne Personennamen — `null` = Schritt fällt weg. */
export function schrittOhneNamen(text: string, namen: readonly string[]): string | null {
  const m = namensMuster(namen);
  if (!m || !m.test(text)) return text;
  const t = text.replace(new RegExp(`\\b(für|fuer|bei)\\s+${m.source}`, 'giu'), (_x, wort: string) => `${/^[A-ZÄÖÜ]/.test(wort) ? 'Für' : 'für'} eine Portion`);
  return m.test(t) ? null : aufraeumen(t);
}

/** Begründung ohne Sätze, die eine Person nennen. */
export function begruendungNeutral(text: string, namen: readonly string[]): string {
  const m = namensMuster(namen);
  if (!m) return text;
  return text.split(/(?<=[.!?…])\s+/).filter(satz => !m.test(satz)).join(' ').trim();
}

/** Gericht-Form, die diese Stelle braucht (passt auf `Gericht` aus modell.ts). */
interface GerichtTeile { name: string; zutaten: { name: string; menge: string }[]; zubereitung: string[]; tags: string[]; fuer: string[] }

/**
 * Ein Gericht aus dem Modell personenneutral (Regel im Dateikopf). `alle` = die Namen, für die geplant wurde (→ `fuer`).
 * `ersatzName` greift, wenn vom Namen nichts übrig bleibt.
 */
export function gerichtNeutral<G extends GerichtTeile>(g: G, namen: readonly string[], alle: readonly string[], ersatzName = 'Gericht'): G {
  return {
    ...g,
    name: ohneNamen(g.name, namen) || ersatzName,
    zutaten: g.zutaten.map(z => ({ ...z, name: ohneNamen(z.name, namen), menge: ohneNamen(z.menge, namen) })).filter(z => z.name),
    zubereitung: g.zubereitung.map(x => schrittOhneNamen(x, namen)).filter((x): x is string => !!x),
    tags: g.tags.filter(t => !nenntPerson(t, namen)),
    fuer: [...alle],
  };
}
