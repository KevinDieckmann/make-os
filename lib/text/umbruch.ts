// ─── Text in eine feste Breite setzen — nie mitten im Wort (21.10., Prozesse: „Cockpit-Einführun g“ auf der Landkarte) ─────────────────────────────
// SVG kennt weder Zeilenumbruch noch Silbentrennung (`hyphens: auto` gilt nur für HTML mit `lang="de"`). EINE Regel für jede Zeichnung, die Text in eine
// feste Breite setzt (Kacheln der Prozess-Landkarte, Phasen, Geister):
//   · die Breite wird je Zeichen geschätzt — Laufweiten einer serifenlosen Textschrift, eher großzügig (lieber kleiner als ein Überstand);
//   · umbrochen wird nur an Leerzeichen und hinter einem Binde- bzw. Schrägstrich („Cockpit-“ | „Einführung“ — der Strich bleibt am Zeilenende);
//   · passt ein Wortteil nicht in die Breite, wird die Schrift kleiner (bis `min`) — nie hart getrennt; passt der Text dann nicht in die Zeilen, endet die
//     letzte Zeile an einer Wortgrenze mit „…“.
// Rein (Server und Browser), getestet in tests/prozesse-lage.test.ts. Die Lage, die eine Breite festlegt, fragt `stueckBreiteMax` — so ist eine Kachel nie
// schmaler als ihr längstes Wort.

/** Laufweite je Zeichen in Bruchteilen der Schriftgröße (em). Nicht genannte Zeichen: `UEBRIG`. */
const BREIT: Record<string, number> = {};
const setze = (zeichen: string, w: number) => { for (const c of zeichen) BREIT[c] = w; };
setze("ijl'|!.,:;", 0.25);
setze('ftrI()[]{}-/', 0.35);
setze(' ', 0.28);
setze('·', 0.32);
setze('mw', 0.85);
setze('MW', 0.95);
setze('ABCDEFGHJKLNOPQRSTUVXYZÄÖÜ', 0.7);
setze('0123456789', 0.57);
setze('&', 0.72);
setze('→←', 0.95);
setze('–', 0.56);
setze('—…', 1);
setze('ß', 0.62);
const UEBRIG = 0.57;
/** Zuschlag gegen Überstand: die Textschrift läuft etwas weiter als die Tabelle, fett noch etwas mehr. */
const ZUSCHLAG = { normal: 1.06, fett: 1.12 } as const;

/** Geschätzte Breite eines Textes (Bildpunkte) in Schriftgröße `groesse`; `gewicht` ≥ 650 gilt als fett. */
export function textBreite(text: string, groesse: number, gewicht = 400): number {
  let em = 0;
  for (const c of text) em += BREIT[c] ?? UEBRIG;
  return em * groesse * (gewicht >= 650 ? ZUSCHLAG.fett : ZUSCHLAG.normal);
}

/** Ein Stück Text, an dessen Anfang umbrochen werden darf; `leer` = davor stand ein Leerzeichen (sonst ein Binde- bzw. Schrägstrich). */
export interface Stueck { t: string; leer: boolean }

/** Die Stücke eines Textes: Wörter, lange Wörter zusätzlich hinter Binde- und Schrägstrichen geteilt (nur zwischen Buchstaben, ab zwei Zeichen davor). */
export function stueckeVon(text: string): Stueck[] {
  const raus: Stueck[] = [];
  for (const wort of text.trim().split(/\s+/).filter(Boolean)) {
    wort.split(/(?<=[\p{L}\p{N}]{2}[-/])(?=[\p{L}\p{N}])/u).forEach((t, i) => raus.push({ t, leer: i === 0 && raus.length > 0 }));
  }
  return raus;
}

/** Die Breite des breitesten Stücks (ohne Umbruch darin) — so breit muss eine Fläche mindestens sein, damit nichts mitten im Wort bricht. */
export function stueckBreiteMax(text: string, groesse: number, gewicht = 400): number {
  return Math.max(0, ...stueckeVon(text).map(s => textBreite(s.t, groesse, gewicht)));
}

/** Zeilen aus Stücken (gierig, an den erlaubten Stellen). `null`, wenn ein Stück allein schon breiter ist als `breite`. */
export function zeilenAus(stuecke: readonly Stueck[], breite: number, groesse: number, gewicht = 400): string[] | null {
  const raus: string[] = [];
  let z = '';
  for (const s of stuecke) {
    if (textBreite(s.t, groesse, gewicht) > breite) return null;
    const mit = z ? `${z}${s.leer ? ' ' : ''}${s.t}` : s.t;
    if (!z || textBreite(mit, groesse, gewicht) <= breite) { z = mit; continue; }
    raus.push(z);
    z = s.t;
  }
  if (z) raus.push(z);
  return raus;
}

export interface Eingepasst {
  zeilen: string[];
  /** Die Schriftgröße, in der der Text steht (≤ `groesse`, ≥ `min`). */
  groesse: number;
  /** Alles steht da (sonst endet die letzte Zeile mit „…“). */
  voll: boolean;
}

/**
 * Einen Text in höchstens `zeilen` Zeilen der Breite `breite` setzen (siehe Kopf): größte Schrift von `groesse` abwärts (in halben Punkten) bis `min`, bei der alles
 * passt; sonst `min` und die letzte Zeile mit „…“ an einer Wortgrenze. Leer bleibt leer.
 */
export function einpassen(o: { text: string; breite: number; groesse: number; min?: number; zeilen?: number; gewicht?: number }): Eingepasst {
  const min = Math.min(o.groesse, o.min ?? o.groesse), max = Math.max(1, o.zeilen ?? 2), g8 = o.gewicht ?? 400;
  const stuecke = stueckeVon(o.text);
  if (!stuecke.length) return { zeilen: [], groesse: o.groesse, voll: true };
  for (let g = o.groesse; g >= min - 1e-9; g -= 0.5) {
    const z = zeilenAus(stuecke, o.breite, g, g8);
    if (z && z.length <= max) return { zeilen: z, groesse: g, voll: true };
  }
  // Passt nicht: in der kleinsten Schrift, die Zeilen bis zur letzten, dort Stücke bis „…“ passt (ein zu breites Stück wird erst hier gekürzt).
  const g = min;
  const zeilen: string[] = [];
  let z = '';
  let i = 0;
  for (; i < stuecke.length && zeilen.length < max - 1; i++) {
    const s = stuecke[i];
    // Ein Stück, das allein zu breit ist, kommt in die letzte Zeile (dort gekürzt) — nie als Überstand in eine Zeile davor.
    if (textBreite(s.t, g, g8) > o.breite) break;
    const mit = z ? `${z}${s.leer ? ' ' : ''}${s.t}` : s.t;
    if (!z || textBreite(mit, g, g8) <= o.breite) { z = mit; continue; }
    zeilen.push(z);
    z = '';
    i--;
  }
  // Die letzte Zeile: so viele Stücke, wie mit „…“ hineinpassen.
  let letzte = z;
  for (; i < stuecke.length; i++) {
    const s = stuecke[i];
    const mit = letzte ? `${letzte}${s.leer ? ' ' : ''}${s.t}` : s.t;
    if (textBreite(`${mit}…`, g, g8) > o.breite) break;
    letzte = mit;
  }
  if (i >= stuecke.length) { zeilen.push(letzte); return { zeilen, groesse: g, voll: true }; }
  if (!letzte) {
    // Nicht einmal ein Stück passt: das erste Stück zeichenweise kürzen (nur, wenn die Fläche schmaler ist als ihr längstes Wort).
    let t = '';
    for (const c of stuecke[i].t) { if (textBreite(`${t}${c}…`, g, g8) > o.breite) break; t += c; }
    letzte = t;
  }
  zeilen.push(`${letzte}…`);
  return { zeilen, groesse: g, voll: false };
}

// ── Silbentrennung (nur als letzter Ausweg bei fester Schriftgröße) ─────────────────────────────────────────────────────────────────────────
// Wo die Schrift nicht kleiner werden darf (Formen der Fläche, 13 px), wird ein Wort, das allein zu breit ist, an einer Silbengrenze geteilt — eine einfache
// Regel für das Deutsche statt „stumm mitten im Wort“: getrennt wird vor einem Mitlaut, dem ein Selbstlaut folgt (Da-tum, Ent-schei-dung), „ch“, „ck“,
// „sch“, „ph“, „th“, „qu“ bleiben zusammen, Doppelselbstlaute (ei, au, eu, ie …) nie getrennt; links und rechts bleiben mindestens zwei Zeichen.

const SELBST = new Set([...'aeiouäöüyAEIOUÄÖÜY']);
const istSelbst = (c: string | undefined) => !!c && SELBST.has(c);
const istBuchstabe = (c: string | undefined) => !!c && /\p{L}/u.test(c);

/** Die erlaubten Trennstellen eines Worts (Index des ersten Zeichens hinter der Trennung), aufsteigend. */
export function trennStellen(wort: string): number[] {
  const z = [...wort];
  const raus: number[] = [];
  for (let i = 2; i <= z.length - 2; i++) {
    const vor = z[i - 1], an = z[i], dann = z[i + 1];
    if (!istBuchstabe(vor) || !istBuchstabe(an) || istSelbst(an)) continue;
    // Mehrbuchstaben-Laute nicht zerreißen.
    const paar = `${vor}${an}`.toLowerCase();
    if (['ch', 'ck', 'ph', 'th', 'qu', 'sc'].includes(paar)) continue;
    if (vor.toLowerCase() === 's' && an.toLowerCase() === 'c' && z[i + 1]?.toLowerCase() === 'h') continue;
    // Der neue Teil beginnt mit Mitlaut(en) und einem Selbstlaut dahinter: „…-da“ / „…-scha“ / „…-ckung“ (ch, sch, ck dürfen vorn stehen).
    const vorn = z.slice(i, i + 3).join('').toLowerCase();
    const cluster = vorn.startsWith('sch') ? 3 : ['ch', 'ck', 'ph', 'th', 'qu'].some(c => vorn.startsWith(c)) ? 2 : 1;
    if (!istSelbst(z[i + cluster]) && !(cluster === 1 && dann && !istSelbst(dann) && istSelbst(z[i + 2]) && ['l', 'r'].includes(dann.toLowerCase()))) continue;
    // Links muss ein Selbstlaut stehen (sonst wäre es keine Silbe).
    if (!z.slice(0, i).some(istSelbst)) continue;
    raus.push(i);
  }
  return raus;
}

/**
 * Ein Wort in Teile von höchstens `max` Zeichen (mit Trennstrich) teilen — an Silbengrenzen (`trennStellen`), nur wenn keine passt, an der letzten möglichen
 * Stelle. Rein; für Zeichnungen mit fester Schriftgröße (components/os/ui/reise/flaeche-formen.tsx `textZeilen`).
 */
export function silbenTeilen(wort: string, max: number): string[] {
  const raus: string[] = [];
  let rest = [...wort];
  while (rest.length > max) {
    const s = trennStellen(rest.join('')).filter(i => i <= max - 1);
    const i = s.length ? s[s.length - 1] : Math.max(2, max - 1);
    raus.push(`${rest.slice(0, i).join('')}-`);
    rest = rest.slice(i);
  }
  raus.push(rest.join(''));
  return raus;
}
