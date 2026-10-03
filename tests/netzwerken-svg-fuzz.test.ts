// ─── Netzwerken · SVG-Säuberer: Entities, Idempotenz, Fuzz (03.10., Prüfer-Funde) ─────────────────
// Der Säuberer prüfte Rohtext, der Browser löst aber Entities auf: `u&#114;l(http://…)` kam durch. Jetzt wird zuerst aufgelöst, dann
// geprüft, dann neu maskiert — die Ausgabe ist zudem idempotent (zweimal säubern = gleich). Keine Platte, kein Netz.
import { describe, it, expect } from 'vitest';
import { saeubereSvg, entitiesAufloesen } from '@/lib/netzwerken/svg';
import { logoPruefen } from '@/lib/netzwerken/karte';

const W = (inner: string, attr = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${attr}><path d="M0 0h1v1z"/>${inner}</svg>`;

const MUSTER: [string, string][] = [
  ['script', W('<script>alert(1)</script>')],
  ['SCRIPT upper', W('<SCRIPT>alert(1)</SCRIPT>')],
  ['onload root', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0h1v1z"/></svg>'],
  ['ONLOAD ohne Anführungszeichen', '<svg xmlns="http://www.w3.org/2000/svg" ONLOAD=alert(1)><path d="M0 0h1v1z"/></svg>'],
  ['foreignObject', W('<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>')],
  ['image extern', W('<image href="http://evil.example/x.png"/>')],
  ['a href js', W('<a xlink:href="javascript:alert(1)"><text>x</text></a>')],
  ['use extern', W('<use href="http://evil.example/x.svg#a"/>')],
  ['use data', W('<use href="data:image/svg+xml;base64,PHN2Zy8+"/>')],
  ['use entity js', W('<use href="&#106;avascript:alert(1)"/>')],
  ['animate', W('<animate attributeName="href" values="javascript:alert(1)" begin="0s"/>')],
  ['set', W('<set attributeName="onmouseover" to="alert(1)"/>')],
  ['style-Tag import', W('<style>@import url(http://evil.example/x.css); path{fill:url(http://evil.example/a)}</style>')],
  ['style-Tag danach script', W('<style>path{fill:red}</style><script>alert(1)</script>')],
  ['style-Attribut url js', W('<rect style="fill:url(javascript:alert(1))" width="1" height="1"/>')],
  ['style-Attribut Entity url', W('<rect style="fill:u&#114;l(http://evil.example/a)" width="1" height="1"/>')],
  ['Attribut Entity url (dezimal)', W('<rect fill="u&#114;l(http://evil.example/b)" width="1" height="1"/>')],
  ['Attribut Entity url (hex)', W('<rect fill="u&#x72;l(http://evil.example/b)" width="1" height="1"/>')],
  ['Attribut Entity url (ohne Semikolon)', W('<rect fill="u&#114l(http://evil.example/b)" width="1" height="1"/>')],
  ['Attribut Entity url (alle Buchstaben)', W('<rect fill="&#117;&#114;&#108;&#40;http://evil.example/c&#41;" width="1" height="1"/>')],
  ['Attribut javascript per Entity', W('<use href="&#x6A;&#x61;vascript:alert(1)"/>')],
  ['style-Tag Entity url', W('<style>path{fill:u&#114;l(http://evil.example/a)}</style>')],
  ['style-Tag Entity @import', W('<style>&#64;import url(http://evil.example/x.css);path{fill:red}</style>')],
  ['style expression', W('<rect style="width:expression(alert(1))" width="1" height="1"/>')],
  ['style expression Entity', W('<rect style="width:expr&#101;ssion(alert(1))" width="1" height="1"/>')],
  ['cdata script', W('<![CDATA[<script>alert(1)</script>]]>')],
  ['Text mit Markup-Entities', W('<text>&lt;script&gt;alert(1)&lt;/script&gt;<tspan>a</tspan></text>')],
  ['Text mit numerischem <', W('<text>&#60;script&#62;alert(1)&#60;/script&#62;</text>')],
  ['Text mit rohem <', W('<text>1 < 2 <script>alert(1)</script></text>')],
  ['Attribut mit >', W('<rect width="1" height="1" fill="a>b" id="x&quot; onload=&quot;alert(1)"/>')],
  ['Anführungszeichen-Bruch', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z" fill=\'red" onload="alert(1)\'/></svg>'],
  ['Anführungszeichen-Bruch per Entity', W('<rect width="1" height="1" id="a&#34; onload=&#34;alert(1)"/>')],
  ['verschachteltes svg', W('<svg onload="alert(1)"><path d="M0 0"/></svg>')],
  ['Kommentar-Tricks', W('<!--><script>alert(1)</script>-->')],
  ['offenes script', W('<script>alert(1)')],
  ['Namensraum-Präfix', '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/1999/xhtml"><s:script>alert(1)</s:script><path d="M0 0h1v1z"/></svg>'],
  ['html im svg', W('<iframe srcdoc="<script>alert(1)</script>"></iframe><body onload=alert(1)>')],
  ['filter', W('<filter id="f"><feImage href="http://evil.example/x"/></filter><rect filter="url(#f)" width="1" height="1"/>')],
  ['clip-path extern', W('<rect clip-path="url(http://evil.example/x#a)" width="1" height="1"/>')],
  ['doctype Entity', '<!DOCTYPE svg [<!ENTITY x "<script>alert(1)</script>">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text><path d="M0 0h1v1z"/></svg>'],
  ['xml-stylesheet', '<?xml-stylesheet href="http://evil.example/a.css"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>'],
  ['Tab im Schema', W('<a href="java\tscript:alert(1)"><path d="M0 0"/></a>')],
  ['title mit html', W('<title><img src=x onerror=alert(1)></title>')],
  ['style im text', W('<text><style>text{fill:red}</style>x</text>')],
  ['HREF groß', W('<use HREF="javascript:alert(1)"/>')],
  ['use #ok', W('<defs><path id="a" d="M0 0h1"/></defs><use xlink:href="#a"/>')],
  ['mixed-case script', W('<ScRiPt>alert(1)</ScRiPt>')],
  ['script nach style', W('<style>*{fill:red}</style ><script>alert(1)</script >')],
  ['script mit Zeilenumbruch im Tag', W('<script\n>alert(1)</script\n>')],
  ['Attributname mit Zeilenumbruch', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z" on\nload="alert(1)"/></svg>'],
  ['Schrägstrich als Trenner', '<svg xmlns="http://www.w3.org/2000/svg"><path/onload="alert(1)" d="M0 0h1v1z"/></svg>'],
  ['doppeltes Entity', W('<rect fill="&amp;#117;rl(http://evil.example/d)" width="1" height="1"/>')],
  ['Entity mit Steuerzeichen', W('<use href="&#106;&#9;avascript:alert(1)"/>')],
];

const BOESE = [/<script/i, /\son\w+\s*=/i, /javascript:/i, /<foreignobject/i, /<image/i, /<iframe/i, /<animate/i, /<set[\s>/]/i, /<a[\s>]/i, /@import/i, /expression\s*\(/i, /data:/i, /<!\[CDATA/i, /<!DOCTYPE/i, /<\?xml/i, /<filter/i, /<body/i, /<html/i];

/** Was der Browser aus der Ausgabe macht: alle Attributwerte und der <style>-Text, Entities aufgelöst. */
function aufgeloeste(out: string): string[] {
  const teile: string[] = [];
  for (const m of out.matchAll(/="([^"]*)"/g)) teile.push(entitiesAufloesen(m[1]));
  for (const m of out.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) teile.push(entitiesAufloesen(m[1]));
  return teile;
}

function pruefeAusgabe(name: string, out: string) {
  // Text zwischen den Tags ist Anzeigetext (als &lt; maskiert) und kein Markup — nur Tags und Attribute zählen.
  const rest = out.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '').replace(/>([^<]+)</g, '><');
  for (const re of BOESE) expect(re.test(rest), `${name}: ${re} in ${out}`).toBe(false);
  for (const w of aufgeloeste(out)) {
    const k = w.toLowerCase().replace(/[\s\u0000-\u001f]/g, '');
    expect(/javascript:|vbscript:|data:|expression\(|@import/.test(k), `${name}: aufgelöst gefährlich: ${w}`).toBe(false);
    for (const m of k.matchAll(/url\(([^)]*)\)/g)) expect(/^['"]?#[\w:.-]+['"]?$/.test(m[1]), `${name}: url() extern: ${w}`).toBe(true);
  }
  expect(/href="(?!#)/i.test(out), `${name}: href extern in ${out}`).toBe(false);
  expect(/<(?![/a-zA-Z])/.test(out), `${name}: loses < in ${out}`).toBe(false);
  expect(/&(?!(?:amp|lt|gt|quot);)/.test(out), `${name}: loses & in ${out}`).toBe(false);
}

describe('SVG-Säuberer: Muster des Prüfers', () => {
  for (const [name, s] of MUSTER) {
    it(name, () => {
      const out = saeubereSvg(s);
      if (out === null) return;
      pruefeAusgabe(name, out);
      expect(saeubereSvg(out), `${name}: nicht idempotent`).toBe(out);
    });
  }
  it('Entity-Verschleierung wird erkannt: die Rect-Zeile mit u&#114;l(http://…) fällt weg', () => {
    const out = saeubereSvg(W('<rect fill="u&#114;l(http://evil.example/b)" width="1" height="1"/>'))!;
    expect(out).not.toMatch(/evil\.example/);
    expect(out).not.toMatch(/fill=/);
  });
  it('harmloses Logo bleibt und ist idempotent (Entities im Text, Farbverlauf, <style>)', () => {
    const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#3b6ef6"/></linearGradient></defs><style>.a{fill:url(#g)}</style><rect class="a" width="10" height="10"/><text x="1" y="5">Müller &amp; Söhne &lt;1&gt;</text></svg>`;
    const o1 = saeubereSvg(logo)!;
    expect(o1).toContain('url(#g)');
    expect(o1).toContain('Müller &amp; Söhne &lt;1&gt;');
    expect(saeubereSvg(o1)).toBe(o1);
  });
  it('„&amp;#106;“ bleibt Text (ein Durchgang) und ändert sich beim zweiten Säubern nicht', () => {
    const out = saeubereSvg(W('<text>&amp;#106;avascript:x</text>'))!;
    expect(out).toContain('&amp;#106;avascript:x');
    expect(saeubereSvg(out)).toBe(out);
  });
});

describe('SVG-Säuberer: Fuzz mit Entity-Verschlüsselung', () => {
  /** Kleiner deterministischer Zufall (mulberry32). */
  const zufall = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const nutzlasten = ['url(http://evil.example/a)', 'javascript:alert(1)', 'expression(alert(1))', 'data:text/html,<script>alert(1)</script>', '@import url(http://evil.example/x.css)', 'url(javascript:alert(1))'];
  const verschluesseln = (s: string, r: () => number): string => Array.from(s).map(c => {
    const x = r();
    return x < 0.35 ? `&#${c.codePointAt(0)};` : x < 0.6 ? `&#x${c.codePointAt(0)!.toString(16)};` : x < 0.65 ? `&#${c.codePointAt(0)}` : c;
  }).join('');
  const ziele: ((n: string) => string)[] = [
    n => W(`<rect fill="${n}" width="1" height="1"/>`),
    n => W(`<rect style="fill:${n}" width="1" height="1"/>`),
    n => W(`<use href="${n}"/>`),
    n => W(`<style>path{fill:${n}}</style>`),
    n => W(`<style>${n}</style>`),
    n => W(`<text>${n}</text>`),
    n => W(`<g clip-path="${n}"><rect width="1" height="1"/></g>`),
    n => W(`<linearGradient id="g"><stop stop-color="${n}"/></linearGradient>`),
  ];
  it('600 verschlüsselte Nutzlasten: nichts Gefährliches in der Ausgabe, jede Ausgabe idempotent', () => {
    const r = zufall(20261003);
    let geprueft = 0;
    for (let i = 0; i < 600; i++) {
      const n = verschluesseln(nutzlasten[i % nutzlasten.length], r);
      const s = ziele[Math.floor(r() * ziele.length)](n);
      const out = saeubereSvg(s);
      if (out === null) continue;
      geprueft++;
      pruefeAusgabe(`fuzz#${i}`, out);
      expect(saeubereSvg(out), `fuzz#${i}: nicht idempotent\n${s}\n${out}`).toBe(out);
    }
    expect(geprueft).toBeGreaterThan(300);
  });
});

describe('SVG-Säuberer: Tag-Suppe', () => {
  it('800 zufällig zusammengesetzte Eingaben: sicher und idempotent', () => {
    let seed = 7;
    const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const teile = ['<svg xmlns="http://www.w3.org/2000/svg">', '</svg>', '<g>', '</g>', '<path d="M0 0h1v1z"/>', '<rect width="1" height="1" fill="#fff"/>', '<text>', '</text>', '<tspan>', '</tspan>',
      '<style>', '</style>', '.a{fill:red}', 'path{fill:u&#114;l(http://x.example/a)}', '<script>', '</script>', 'alert(1)', '&amp;', '&lt;', '&#60;', '&#x26;', '&', '<', '>', '"', "'",
      '<use href="#a"/>', '<use href="&#106;avascript:x"/>', '<![CDATA[', ']]>', '<!--', '-->', '<defs>', '</defs>', '<linearGradient id="a">', '</linearGradient>', '<stop stop-color="red"/>',
      ' onload="x" ', '<a href="x">', '</a>', '<image href="x"/>', '<foreignObject>', '</foreignObject>', 'text', ' '];
    let n = 0;
    for (let i = 0; i < 800; i++) {
      const roh = `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/>${Array.from({ length: 4 + Math.floor(r() * 14) }, () => teile[Math.floor(r() * teile.length)]).join('')}</svg>`;
      const out = saeubereSvg(roh);
      if (out === null) continue;
      n++;
      pruefeAusgabe(`suppe#${i}`, out);
      expect(saeubereSvg(out), `suppe#${i}: nicht idempotent\n${roh}\n${out}`).toBe(out);
    }
    expect(n).toBeGreaterThan(400);
  });
});

describe('Logo-Pipeline', () => {
  const b64 = (s: string) => Buffer.from(s).toString('base64');
  it('SVG-Logo mit Script und Entity-Verweis wird gesäubert gespeichert', () => {
    const r = logoPruefen(`data:image/svg+xml;base64,${b64(W('<script>alert(1)</script><rect fill="u&#114;l(http://evil.example/a)" width="1" height="1"/>'))}`);
    expect(r.ok).toBe(true);
    if (r.ok) { const s = Buffer.from(r.logo.split(',')[1], 'base64').toString(); expect(s).not.toMatch(/script|evil\.example/i); }
  });
  it('Raster mit falschem Inhalt und zu große Logos werden abgelehnt', () => {
    expect(logoPruefen(`data:image/png;base64,${b64('<svg onload=alert(1)>')}`).ok).toBe(false);
    expect(logoPruefen(`data:text/html;base64,${b64('<script>alert(1)</script>')}`).ok).toBe(false);
    expect(logoPruefen(`data:image/svg+xml;base64,${'A'.repeat(300000)}`).ok).toBe(false);
  });
});

// ── Laufzeit: nichts quadratisch (Technik-Prüfung 03.10.) ─────────────────────
// Die Regex für <style>-Regeln war quadratisch: 200 KB Stil ohne „{“ blockierten den Event-Loop rund 35 Sekunden. Jetzt: linear, `CSS_MAX`.
describe('Laufzeit — lange Eingaben bleiben schnell', () => {
  const ZEIT_MS = 1500;
  const stoppe = (f: () => unknown) => { const t0 = performance.now(); f(); return performance.now() - t0; };
  it('200 KB <style> ohne „{“, mit vielen „/*“ und „}“', async () => {
    const { CSS_MAX } = await import('@/lib/netzwerken/svg');
    for (const roh of ['a'.repeat(200_000), '/*'.repeat(100_000), '}'.repeat(200_000), 'x '.repeat(100_000) + '{', '.a{fill:red'.repeat(15_000)]) {
      const ms = stoppe(() => saeubereSvg(W(`<style>${roh}</style>`)));
      expect(ms).toBeLessThan(ZEIT_MS);
    }
    expect(CSS_MAX).toBe(20_000);
  });
  it('über der Grenze fällt das Stylesheet weg, darunter bleibt es — das SVG selbst bleibt brauchbar', () => {
    const regel = '.a{fill:#fff}';
    const klein = saeubereSvg(W(`<style>${regel}</style>`, 'class="a"'));
    expect(klein).toContain('fill:#fff');
    const gross = saeubereSvg(W(`<style>${'.b{fill:red}'.repeat(2000)}</style>`));
    expect(gross).not.toBeNull();
    expect(gross).not.toContain('<style');
  });
  it('Windows-Zeilen, @media und verschachtelte Regeln: nur einfache Regeln bleiben', () => {
    const o = saeubereSvg(W('<style>.a{fill:red}\r\n@media print{.b{fill:blue}}\r\npath{stroke:#000}</style>'))!;
    expect(o).toContain('.a{fill:red}');
    expect(o).toContain('path{stroke:#000}');
    expect(o).not.toContain('@media');
    expect(o).not.toContain('.b{');
  });
  it('viele „<!--“, „<?“, „<![CDATA[“, „<!DOCTYPE“ und „<a “ ohne Ende', () => {
    for (const teil of ['<!--', '<?x ', '<![CDATA[', '<!DOCTYPE ', '<a ', '<a "', '<g ']) {
      const ms = stoppe(() => saeubereSvg(W(teil.repeat(Math.floor(500_000 / teil.length)))));
      expect(ms, teil).toBeLessThan(ZEIT_MS);
    }
  });
  it('Kommentare, PI, CDATA und DOCTYPE mit Ende werden weiter entfernt', () => {
    const o = saeubereSvg(`<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><!-- weg --><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/><!-- <script>x</script> --><text><![CDATA[a<b]]></text></svg>`)!;
    expect(o).not.toContain('DOCTYPE');
    expect(o).not.toContain('weg');
    expect(o).not.toContain('script');
    expect(o).toContain('a&lt;b');
  });
});
