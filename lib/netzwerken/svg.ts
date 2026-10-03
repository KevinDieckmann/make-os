// ─── Netzwerken · SVG säubern (02.10., Paket B) — rein, ohne DOM, client- UND serverfähig ───────────────────
// Ein Firmenlogo darf als SVG hochgeladen werden. Ein SVG ist aber ausführbarer Inhalt: Skripte, Ereignis-Attribute,
// fremde Verweise, eingebettete HTML-Seiten. Darum wird NIE das Original gespeichert, sondern eine nachgebaute Fassung
// nur aus erlaubten Elementen und Attributen (Positivliste). Der Browser zeigt das Logo außerdem nur als <img> (dort
// laufen SVG-Skripte ohnehin nicht) — das hier ist die zweite Schicht. Läuft im Browser (vor dem Speichern) und im
// Server (jede Karte wird beim Speichern erneut gesäubert; dem Browser wird nie vertraut).
//
// Erlaubt: Formen, Gruppen, Farbverläufe, Masken/Clip, Text, <style> mit einfachen Klassenregeln (Logos aus Illustrator
// und Figma bringen sie mit). Entfernt samt Inhalt: script, foreignObject, image, a, animate*, set, iframe, object, embed,
// audio/video, filter (zieht Fremdes nach), alles Unbekannte. Verweise (href) nur auf `#…` im selben Dokument; `url(…)` nur
// `url(#…)`. Kein @import, kein expression(), kein javascript:, keine Daten-URLs im Inneren.

const ELEMENTE = new Set([
  'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'use', 'symbol', 'style',
]);
/** Elemente, die ihren ganzen Inhalt mitnehmen, wenn sie fallen (alles Unerlaubte tut das — hier nur zur Dokumentation). */
const CAMEL: Record<string, string> = { lineargradient: 'linearGradient', radialgradient: 'radialGradient', clippath: 'clipPath' };

/** Erlaubte Attribute (klein geschrieben). `style` und `href` werden gesondert geprüft. */
const ATTRIBUTE = new Set([
  'id', 'class', 'd', 'points', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'width', 'height', 'viewbox', 'preserveaspectratio',
  'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'transform', 'gradienttransform', 'gradientunits', 'spreadmethod', 'offset', 'stop-color', 'stop-opacity',
  'fx', 'fy', 'clip-path', 'mask', 'clippathunits', 'maskunits', 'maskcontentunits', 'xmlns', 'version', 'font-family', 'font-size', 'font-weight', 'font-style',
  'text-anchor', 'letter-spacing', 'dominant-baseline', 'xml:space', 'display', 'visibility', 'role', 'aria-label', 'aria-hidden',
]);
const CSS_EIGENSCHAFTEN = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
  'opacity', 'stop-color', 'stop-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'display', 'visibility', 'mix-blend-mode',
]);

/**
 * Entities EINMAL auflösen (numerisch, hexadezimal, die fünf benannten + nbsp) — vor jeder Prüfung. Der Browser löst sie in Attributen
 * und Text ohnehin auf; wer erst prüft und dann den Rohtext ausgibt, lässt `u&#114;l(http://…)` oder `&#106;avascript:` durch. Ein
 * einziger Durchgang: `&amp;#106;` wird zu `&#106;` (Text), nicht weiter zu `j`. Unbekannte Namen bleiben stehen (und werden beim Ausgeben
 * als `&amp;name;` zu reinem Text). Steuerzeichen fallen weg, ungültige Codepunkte auch.
 */
const BENANNT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function entitiesAufloesen(v: string): string {
  return v.replace(/&(?:#(\d{1,8})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));?/g, (_m, dez: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (name) return BENANNT[name];
    const cp = dez !== undefined ? parseInt(dez, 10) : parseInt(hex as string, 16);
    if (!Number.isFinite(cp) || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) || cp === 0 || cp < 0x20 && cp !== 9 && cp !== 10 && cp !== 13 || cp === 0x7f) return '';
    return String.fromCodePoint(cp);
  }).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}
/** Für die Ausgabe: genau EIN Entity-Satz (& < > "), nie ein vorhandenes Entity stehen lassen — die Eingabe ist vorher aufgelöst. */
const maske = (v: string): string => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ein Wert ist unbedenklich: kein Skript, kein fremdes `url()`, keine Daten-URL, kein Sonderzeichen für Markup. */
function wertSicher(wert: string): boolean {
  // `wert` ist schon aufgelöst (entitiesAufloesen). Leerraum und Steuerzeichen zählen für die Muster nicht („java\tscript:“).
  const w = wert.toLowerCase().replace(/[\s\u0000-\u001f\u007f-\u009f]/g, '');
  if (/[<>\\"]/.test(wert)) return false;   // auch kein Anführungszeichen: ein Wert soll nie wie ein weiteres Attribut aussehen
  if (/javascript:|vbscript:|data:|expression\s*\(|@import|behavior|-moz-binding/.test(w)) return false;
  for (const m of w.matchAll(/url\(([^)]*)\)/g)) if (!/^['"]?#[\w:.-]+['"]?$/.test(m[1])) return false;
  if (/url\(/.test(w) && !/url\([^)]*\)/.test(w)) return false;   // „url(“ ohne Ende
  return true;
}

/** Eine Deklarationsliste („fill:#fff; stroke:none“) auf erlaubte Eigenschaften und sichere Werte kürzen. */
function cssDeklarationen(text: string): string {
  const aus: string[] = [];
  for (const teil of text.split(';')) {
    const i = teil.indexOf(':');
    if (i < 1) continue;
    const name = teil.slice(0, i).trim().toLowerCase();
    const wert = teil.slice(i + 1).trim();
    if (CSS_EIGENSCHAFTEN.has(name) && wert && wertSicher(wert)) aus.push(`${name}:${wert}`);
  }
  return aus.join(';');
}

/** Größter <style>-Inhalt, den das Säubern auswertet — darüber fällt das Stylesheet weg (nicht gekürzt: halbe Regeln wären falsch). */
export const CSS_MAX = 20_000;

/** Alles von `auf` bis `zu` entfernen — linear (indexOf); ein nie geschlossener Anfang bleibt, wie er ist (wie bei der Regex vorher). */
function ohneBereiche(t: string, auf: string, zu: string, ersatz?: (inhalt: string) => string): string {
  let aus = '', pos = 0;
  for (;;) {
    const i = t.indexOf(auf, pos);
    if (i < 0) break;
    const j = t.indexOf(zu, i + auf.length);
    if (j < 0) break;
    aus += t.slice(pos, i) + (ersatz ? ersatz(t.slice(i + auf.length, j)) : '');
    pos = j + zu.length;
  }
  return aus + t.slice(pos);
}

/** <!DOCTYPE …> (auch mit [Teilmenge]) entfernen — linear, ohne Regex mit verschachtelten Wiederholungen. */
function ohneDoctype(t: string): string {
  const klein = t.toLowerCase();
  let aus = '', pos = 0;
  for (;;) {
    const i = klein.indexOf('<!doctype', pos);
    if (i < 0) break;
    let j = klein.indexOf('>', i);
    const auf = klein.indexOf('[', i);
    if (auf >= 0 && (j < 0 || auf < j)) { const zu = klein.indexOf(']', auf); j = zu < 0 ? -1 : klein.indexOf('>', zu); }
    if (j < 0) break;
    aus += t.slice(pos, i);
    pos = j + 1;
  }
  return aus + t.slice(pos);
}

/**
 * Ein <style>-Inhalt: nur einfache Regeln `.klasse, #id, element { … }` — alles andere (@-Regeln, Attributwähler, Kombinatoren) fällt weg.
 * Linear (am `}` zerlegt, am `{` getrennt) und auf `CSS_MAX` begrenzt: die Regex vorher war quadratisch — 200 KB ohne „{“ blockierten die Schleife rund 35 Sekunden.
 */
function cssRegeln(text: string): string {
  if (text.length > CSS_MAX) return '';
  const roh = ohneBereiche(text, '/*', '*/');
  const aus: string[] = [];
  for (const stueck of roh.split('}')) {
    const i = stueck.indexOf('{');
    if (i < 1 || stueck.indexOf('{', i + 1) >= 0) continue;   // ohne Wähler oder verschachtelt (@media …): fällt weg
    const waehlerRoh = stueck.slice(0, i);
    if (waehlerRoh.includes('@')) continue;
    const waehler = waehlerRoh.split(',').map(x => x.trim());
    if (!waehler.length || !waehler.every(x => /^(?:[.#]?[A-Za-z_][\w-]*|\*)$/.test(x))) continue;
    const dekl = cssDeklarationen(stueck.slice(i + 1));
    if (dekl) aus.push(`${waehler.join(',')}{${dekl}}`);
  }
  return aus.join('\n');
}

interface Tag { schliessend: boolean; name: string; attribute: string; selbst: boolean }
const TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/y;

/** Attribute eines Tags als [Name, Wert]-Paare (Namen klein geschrieben). */
function attributeLesen(roh: string): [string, string][] {
  const liste: [string, string][] = [];
  for (const m of roh.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) liste.push([m[1].toLowerCase(), m[2] ?? m[3] ?? '']);
  return liste;
}

/**
 * Das gesäuberte SVG oder `null`, wenn es keines ist / nichts Brauchbares übrig bleibt. Die Ausgabe ist eine Neuerzeugung
 * (nie das Original), beginnt mit `<svg` und trägt `xmlns`.
 */
export function saeubereSvg(eingabe: string): string | null {
  if (typeof eingabe !== 'string' || eingabe.length > 600_000) return null;
  // Alles linear (indexOf statt Regex mit [\s\S]*?): viele ungeschlossene „<!--“ oder „<?“ machten die Regex quadratisch (Minuten bei 600 KB).
  let t = ohneDoctype(ohneBereiche(ohneBereiche(ohneBereiche(eingabe.replace(/^﻿/, ''), '<?', '?>'), '<!--', '-->'), '<![CDATA[', ']]>', s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')));
  if (!/<svg[\s>]/i.test(t)) return null;
  t = t.trim();

  let ausgabe = '';
  const offen: string[] = []; // gerade geöffnete erlaubte Elemente (Ausgabe-Namen)
  let skip: { name: string; tiefe: number } | null = null; // unerlaubtes Element samt Inhalt überspringen
  let styleInhalt: string | null = null; // sammelt den Text eines <style>
  let wurzel = false;
  let pos = 0;
  const letztesGroesser = t.lastIndexOf('>');   // einmal gesucht: ein „<“ dahinter kann kein Tag mehr eröffnen

  /** Das oberste offene Element schließen; ein <style> nur mit sicheren Regeln — sonst fällt es ganz weg. */
  const schliesseEins = (): void => {
    const name = offen.pop() as string;
    if (name === 'style' && styleInhalt !== null) {
      const regeln = cssRegeln(entitiesAufloesen(styleInhalt)).replace(/&/g, '&amp;');
      styleInhalt = null;
      if (regeln) ausgabe += `${regeln}</style>`;
      else { const i = ausgabe.lastIndexOf('<style'); if (i !== -1) ausgabe = ausgabe.slice(0, i); }
      return;
    }
    ausgabe += `</${name}>`;
  };

  while (pos < t.length) {
    const lt = t.indexOf('<', pos);
    const text = t.slice(pos, lt === -1 ? t.length : lt);
    if (text && !skip) {
      if (styleInhalt !== null) styleInhalt += text;
      else if (offen.length && /^(text|tspan|title|desc)$/i.test(offen[offen.length - 1])) ausgabe += maske(entitiesAufloesen(text));
    }
    if (lt === -1) break;
    // Jedes Tag endet auf „>“: gibt es keins mehr, kann nichts mehr passen (sonst scannt jedes ungeschlossene „<a “ bis zum Ende — quadratisch).
    if (lt > letztesGroesser) break;
    TAG.lastIndex = lt;
    const m = TAG.exec(t);
    if (!m) { pos = lt + 1; continue; } // ein einzelnes „<“ im Text: überspringen
    pos = lt + m[0].length;
    const tag: Tag = { schliessend: m[1] === '/', name: m[2], attribute: m[3], selbst: m[4] === '/' };
    const klein = tag.name.toLowerCase();

    if (skip) {
      if (klein === skip.name) { if (tag.schliessend) skip.tiefe--; else if (!tag.selbst) skip.tiefe++; if (skip.tiefe <= 0) skip = null; }
      continue;
    }
    if (!ELEMENTE.has(klein)) { if (!tag.schliessend && !tag.selbst) skip = { name: klein, tiefe: 1 }; continue; }

    if (tag.schliessend) {
      // Schließt, was zum Namen passt — und vorher alles, was darüber noch offen steht (sonst entstünden falsch verschachtelte Ausgaben).
      const idx = offen.lastIndexOf(CAMEL[klein] ?? klein);
      if (idx < 0) continue;   // ohne passendes Öffnen: ignorieren
      while (offen.length > idx) schliesseEins();
      if (!offen.length) break;   // Wurzel geschlossen: alles danach ist nicht mehr Teil des Dokuments
      continue;
    }
    if (styleInhalt !== null) continue;   // Tags im <style>-Text sind kein Markup, das wir übernehmen

    // Öffnendes Element: Attribute prüfen und neu schreiben.
    if (klein === 'svg' && !wurzel) wurzel = true;
    else if (klein === 'svg' && offen.length === 0) continue; // zweites Wurzel-<svg>: ignorieren
    if (!wurzel) continue;
    const name = CAMEL[klein] ?? klein;
    let attr = '';
    let hatXmlns = false;
    for (const [n, wRoh] of attributeLesen(tag.attribute)) {
      const w = entitiesAufloesen(wRoh);
      if (n === 'xmlns') { if (w === 'http://www.w3.org/2000/svg') { attr += ' xmlns="http://www.w3.org/2000/svg"'; hatXmlns = true; } continue; }
      if (n === 'href' || n === 'xlink:href') { if (klein === 'use' && /^#[\w:.-]+$/.test(w.trim())) attr += ` href="${w.trim()}"`; continue; }
      if (n === 'style') { const d = cssDeklarationen(w); if (d) attr += ` style="${maske(d)}"`; continue; }
      if (!ATTRIBUTE.has(n) || !wertSicher(w)) continue;
      const schreibweise = n === 'viewbox' ? 'viewBox' : n === 'preserveaspectratio' ? 'preserveAspectRatio' : n === 'gradienttransform' ? 'gradientTransform' : n === 'gradientunits' ? 'gradientUnits'
        : n === 'spreadmethod' ? 'spreadMethod' : n === 'clippathunits' ? 'clipPathUnits' : n === 'maskunits' ? 'maskUnits' : n === 'maskcontentunits' ? 'maskContentUnits' : n;
      attr += ` ${schreibweise}="${maske(w)}"`;
    }
    if (klein === 'svg' && !hatXmlns) attr = ` xmlns="http://www.w3.org/2000/svg"${attr}`;
    if (klein === 'style' && tag.selbst) continue;   // ein leeres <style/> bringt nichts
    ausgabe += `<${name}${attr}${tag.selbst ? '/>' : '>'}`;
    if (!tag.selbst) { offen.push(name); if (klein === 'style') styleInhalt = ''; }
  }
  while (offen.length) schliesseEins();   // offene Elemente schließen (ein offenes <style> wird dabei ausgewertet oder verworfen)
  if (!/^<svg[\s>]/.test(ausgabe) || !/<(path|rect|circle|ellipse|line|polyline|polygon|text)[\s/>]/.test(ausgabe)) return null;
  return ausgabe;
}
