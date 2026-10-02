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

const maske = (v: string): string => v.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ein Wert ist unbedenklich: kein Skript, kein fremdes `url()`, keine Daten-URL, kein Sonderzeichen für Markup. */
function wertSicher(wert: string): boolean {
  const w = wert.replace(/&#x?[0-9a-f]+;?/gi, '').toLowerCase();
  if (/[<>\\]/.test(wert)) return false;
  if (/javascript:|vbscript:|data:|expression\s*\(|@import|behavior|-moz-binding/.test(w)) return false;
  for (const m of w.matchAll(/url\s*\(\s*([^)]*)\)/g)) if (!/^['"]?#[\w:.-]+['"]?$/.test(m[1].trim())) return false;
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

/** Ein <style>-Inhalt: nur einfache Regeln `.klasse, #id, element { … }` — alles andere (@-Regeln, Attributwähler, Kombinatoren) fällt weg. */
function cssRegeln(text: string): string {
  const roh = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const aus: string[] = [];
  for (const m of roh.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const waehler = m[1].split(',').map(s => s.trim());
    if (!waehler.length || !waehler.every(s => /^(?:[.#]?[A-Za-z_][\w-]*|\*)$/.test(s))) continue;
    const dekl = cssDeklarationen(m[2]);
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
  let t = eingabe.replace(/^﻿/, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')).replace(/<!DOCTYPE[^>]*(?:\[[\s\S]*?\])?[^>]*>/gi, '');
  if (!/<svg[\s>]/i.test(t)) return null;
  t = t.trim();

  let ausgabe = '';
  const offen: string[] = []; // gerade geöffnete erlaubte Elemente (Ausgabe-Namen)
  let skip: { name: string; tiefe: number } | null = null; // unerlaubtes Element samt Inhalt überspringen
  let styleInhalt: string | null = null; // sammelt den Text eines <style>
  let wurzel = false;
  let pos = 0;

  while (pos < t.length) {
    const lt = t.indexOf('<', pos);
    const text = t.slice(pos, lt === -1 ? t.length : lt);
    if (text && !skip) {
      if (styleInhalt !== null) styleInhalt += text;
      else if (offen.length && /^(text|tspan|title|desc)$/i.test(offen[offen.length - 1])) ausgabe += maske(text);
    }
    if (lt === -1) break;
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
      if (klein === 'style' && styleInhalt !== null) {
        const regeln = cssRegeln(styleInhalt);
        styleInhalt = null;
        if (regeln) ausgabe += regeln;
        else { // leere/unsichere Regeln: das ganze <style> wieder wegnehmen
          const i = ausgabe.lastIndexOf('<style');
          if (i !== -1) ausgabe = ausgabe.slice(0, i);
          offen.pop();
          continue;
        }
      }
      const name = offen.pop();
      if (name) ausgabe += `</${name}>`;
      continue;
    }

    // Öffnendes Element: Attribute prüfen und neu schreiben.
    if (klein === 'svg' && !wurzel) wurzel = true;
    else if (klein === 'svg' && offen.length === 0) continue; // zweites Wurzel-<svg>: ignorieren
    if (!wurzel) continue;
    const name = CAMEL[klein] ?? klein;
    let attr = '';
    let hatXmlns = false;
    for (const [n, w] of attributeLesen(tag.attribute)) {
      if (n === 'xmlns') { if (w === 'http://www.w3.org/2000/svg') { attr += ' xmlns="http://www.w3.org/2000/svg"'; hatXmlns = true; } continue; }
      if (n === 'href' || n === 'xlink:href') { if (klein === 'use' && /^#[\w:.-]+$/.test(w.trim())) attr += ` href="${w.trim()}"`; continue; }
      if (n === 'style') { const d = cssDeklarationen(w); if (d) attr += ` style="${maske(d)}"`; continue; }
      if (!ATTRIBUTE.has(n) || !wertSicher(w)) continue;
      const schreibweise = n === 'viewbox' ? 'viewBox' : n === 'preserveaspectratio' ? 'preserveAspectRatio' : n === 'gradienttransform' ? 'gradientTransform' : n === 'gradientunits' ? 'gradientUnits'
        : n === 'spreadmethod' ? 'spreadMethod' : n === 'clippathunits' ? 'clipPathUnits' : n === 'maskunits' ? 'maskUnits' : n === 'maskcontentunits' ? 'maskContentUnits' : n;
      attr += ` ${schreibweise}="${maske(w)}"`;
    }
    if (klein === 'svg' && !hatXmlns) attr = ` xmlns="http://www.w3.org/2000/svg"${attr}`;
    ausgabe += `<${name}${attr}${tag.selbst ? '/>' : '>'}`;
    if (!tag.selbst) { offen.push(name); if (klein === 'style') styleInhalt = ''; }
  }
  while (offen.length) ausgabe += `</${offen.pop()}>`;
  if (!/^<svg[\s>]/.test(ausgabe) || !/<(path|rect|circle|ellipse|line|polyline|polygon|text)[\s/>]/.test(ausgabe)) return null;
  return ausgabe;
}
