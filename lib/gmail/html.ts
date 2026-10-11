// ─── Gmail — HTML säubern → reiner Text (rein, 03.10.2026) ───────────────────
// HTML aus fremden Mails wird in MAKE OS NIE gerendert — weder roh noch „gesäubert“: Aus einer Mail wird Text, fertig.
// Damit gibt es keine Skripte, keine Formulare, keine nachgeladenen Bilder (Tracking-Pixel) und kein CSS, das etwas verdeckt.
//   · weg samt Inhalt: script, style, head, title, template, noscript, svg, object, embed, iframe, frame, form-Felder, Kommentare
//   · Bilder: nie geladen, nie angezeigt — `[Bild: alt]` bei Alternativtext, sonst nichts; gezählt (`bilder`)
//   · Links: `Text (https://…)` — die ECHTE Adresse steht immer dabei (Phishing: Text sagt A, Ziel ist B); nur http(s) und
//     mailto, `javascript:`/`data:`/Relative fallen weg; Tracking-Parameter (utm_*, fbclid, gclid, mc_*) werden entfernt
//   · Blöcke (p, div, br, li, tr, h1–h6, blockquote) → Zeilenumbrüche; Entitäten (benannte, &#…;, &#x…;) → Zeichen
// Rein, ohne DOM — getestet in tests/gmail-mime.test.ts (Skripte, Pixel, Links).
// LINEAR (Prüf-Fund 11.10.): früher Regeln wie `<script…>[\s\S]*?</script>` und `<\?[\s\S]*?\?>` — bei vielen offenen Tags quadratisch
// (2 MB ≈ 45 s, über `web_lesen` von jeder fremden Seite erreichbar). Jetzt sucht jeder Schritt sein Ende EINMAL per `indexOf`; fehlt es,
// wird bis zum Ende abgeschnitten. Für wohlgeformtes HTML dasselbe Ergebnis wie vorher (Wächter tests/fulfillment-pruef-funde.test.ts).

/** Namen, die samt Inhalt wegfallen; die zweite Liste auch ohne schließendes Tag (bis zum Ende). */
const WEG_MIT_INHALT = ['script', 'style', 'head', 'title', 'template', 'noscript', 'svg', 'object', 'embed', 'iframe', 'frameset', 'frame', 'applet', 'math', 'select', 'textarea', 'button'] as const;
const WEG_OHNE_ENDE = ['script', 'style', 'template', 'noscript', 'svg', 'object', 'iframe'] as const;
const LEERZEICHEN = /\s/;
const NAME_START = /[a-zA-Z]/;
const buchstabe = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const namenZeichen = (c: number) => buchstabe(c) || (c >= 48 && c <= 58) /* 0–9 und : */ || c === 45 /* - */;
/** Nur ASCII klein — gleiche Länge wie das Original (toLowerCase kann Zeichen verlängern und Positionen verschieben). */
const asciiKlein = (s: string): string => s.replace(/[A-Z]+/g, t => t.toLowerCase());

/** Kommentare, CDATA, `<!…>` und `<?…?>` entfernen — fehlt das Ende, bis zum Ende. */
function kommentareWeg(h: string): string {
  const aus: string[] = [];
  let pos = 0, such = 0;
  for (;;) {
    const i = h.indexOf('<', such);
    if (i < 0) break;
    const c = h[i + 1];
    let ende = -1;
    if (c === '!') {
      if (h.startsWith('<!--', i)) { const e = h.indexOf('-->', i + 4); ende = e < 0 ? h.length : e + 3; }
      else if (h.startsWith('<![CDATA[', i)) { const e = h.indexOf(']]>', i + 9); ende = e < 0 ? h.length : e + 3; }
      else if (NAME_START.test(h[i + 2] ?? '')) { const e = h.indexOf('>', i + 3); ende = e < 0 ? h.length : e + 1; }
    } else if (c === '?') { const e = h.indexOf('?>', i + 2); ende = e < 0 ? h.length : e + 2; }
    if (ende < 0) { such = i + 1; continue; }
    aus.push(h.slice(pos, i));
    pos = such = ende;
  }
  aus.push(h.slice(pos));
  return aus.join('');
}

/** Öffnende Tags der Namen (auf der ASCII-klein-Kopie) — eine Regel aus festen Wörtern + Wortgrenze: linear, ohne Rückverfolgung. */
const oeffnend = (namen: readonly string[]) => new RegExp(`<(${namen.join('|')})(?![A-Za-z0-9_])`, 'g');
const OEFFNEND_MIT_INHALT = oeffnend(WEG_MIT_INHALT);
const OEFFNEND_OHNE_ENDE = oeffnend(WEG_OHNE_ENDE);
/** Nächstes öffnendes Tag ab `ab` — [Position, Name] oder null. */
function naechstesTag(re: RegExp, klein: string, ab: number): [number, string] | null {
  re.lastIndex = ab;
  const m = re.exec(klein);
  return m ? [m.index, m[1]] : null;
}

/** Nächstes `>` ab `ab` — gemerkt, weil die Suchanfänge nur wachsen (linear). */
function gtSucher(h: string): (ab: number) => number {
  let ergebnis = -2; // -2 = noch nie gesucht
  return ab => {
    if (ergebnis === -1 || (ergebnis >= ab)) return ergebnis;
    ergebnis = h.indexOf('>', ab);
    return ergebnis;
  };
}

/** Blöcke `<name …>…</name\s*>` samt Inhalt entfernen (EIN Durchgang, links nach rechts; offene bleiben stehen). */
function bloeckeWeg(h: string): string {
  const klein = asciiKlein(h);
  const gt = gtSucher(klein);
  const keinEnde = new Map<string, number>(); // Name → ab dieser Stelle gibt es kein gültiges schließendes Tag mehr
  const aus: string[] = [];
  let pos = 0, such = 0;
  for (;;) {
    const t = naechstesTag(OEFFNEND_MIT_INHALT, klein, such);
    if (!t) break;
    const [i, n] = t;
    const auf = gt(i + 1 + n.length);
    if (auf < 0) break; // kein `>` mehr: hier entsteht kein Tag mehr (ein offenes Tag am Ende fällt später weg)
    let ende = -1;
    const grenze = keinEnde.get(n);
    if (grenze === undefined || auf + 1 < grenze) {
      const muster = `</${n}`;
      for (let k = auf + 1; ;) {
        const c = klein.indexOf(muster, k);
        if (c < 0) { if (grenze === undefined) keinEnde.set(n, auf + 1); break; }
        let j = c + muster.length;
        while (j < klein.length && LEERZEICHEN.test(klein[j])) j++;
        if (klein[j] === '>') { ende = j + 1; break; }
        k = c + 1;
      }
    }
    if (ende < 0) { such = i + 1; continue; }
    aus.push(h.slice(pos, i));
    pos = such = ende;
  }
  aus.push(h.slice(pos));
  return aus.join('');
}

/** Ab dem ersten offenen `<script…>` (bzw. style, template, noscript, svg, object, iframe) bis zum Ende abschneiden. */
function offeneBloeckeWeg(h: string): string {
  const klein = asciiKlein(h);
  const gt = gtSucher(klein);
  for (let such = 0; ;) {
    const t = naechstesTag(OEFFNEND_OHNE_ENDE, klein, such);
    if (!t) return h;
    // Das erste öffnende Tag mit `>` dahinter schneidet ab; ohne `>` gibt es dahinter kein Tag mehr.
    return gt(t[0] + 1 + t[1].length) < 0 ? h : h.slice(0, t[0]);
  }
}

interface Tag { index: number; ende: number; schliessend: boolean; name: string; attribute: string }

/** Tags `<(/?)(name)(attribute)>` der Reihe nach (wie die frühere Regel `TAG`): Attribute = Text bis zum ersten `>` außerhalb von
 *  Anführungszeichen; ein offenes Anführungszeichen → kein Tag. Linear: das Ergebnis je Stelle „außerhalb von Anführungszeichen“ wird gemerkt. */
function* tagsLesen(h: string): Generator<Tag> {
  const n = h.length;
  const merk = new Int32Array(n + 1).fill(-2); // -2 unbekannt · -1 kein Ende · sonst Position des `>`
  const weg: number[] = [];
  const attributEnde = (start: number): number => {
    let q = start, ergebnis = -1;
    weg.length = 0;
    for (;;) {
      if (q >= n) { ergebnis = -1; break; }
      const m = merk[q];
      if (m !== -2) { ergebnis = m; break; }
      weg.push(q);
      const c = h.charCodeAt(q);
      if (c === 62 /* > */) { ergebnis = q; break; }
      if (c === 34 /* " */ || c === 39 /* ' */) {
        const e = h.indexOf(c === 34 ? '"' : "'", q + 1);
        if (e < 0) { ergebnis = -1; break; }
        q = e + 1;
      } else q++;
    }
    for (const p of weg) merk[p] = ergebnis;
    return ergebnis;
  };
  for (let such = 0; ;) {
    const i = h.indexOf('<', such);
    if (i < 0) return;
    let j = i + 1;
    const schliessend = h.charCodeAt(j) === 47 /* / */;
    if (schliessend) j++;
    if (!buchstabe(h.charCodeAt(j))) { such = i + 1; continue; }
    let k = j + 1;
    while (k < n && namenZeichen(h.charCodeAt(k))) k++;
    const e = attributEnde(k);
    if (e < 0) { such = i + 1; continue; }
    yield { index: i, ende: e + 1, schliessend, name: h.slice(j, k), attribute: h.slice(k, e) };
    such = e + 1;
  }
}

const ENTITAETEN: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '', zwnj: '', zwj: '', lrm: '', rlm: '',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', euro: '€', copy: '©', reg: '®', trade: '™',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bdquo: '„', sbquo: '‚',
  bull: '•', middot: '·', sect: '§', deg: '°', plusmn: '±', times: '×', eacute: 'é', egrave: 'è', agrave: 'à', aacute: 'á', ccedil: 'ç',
  iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û', pound: '£', yen: '¥', cent: '¢',
};

/** HTML-Entitäten → Zeichen. Unbekannte bleiben stehen. */
export function entitaetenLesen(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z][a-zA-Z0-9]{1,10});/g, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
      // Steuerzeichen (außer Tab/Zeilenumbruch) und unsichtbare Umschalter nie durchlassen.
      if ((n < 0x20 && n !== 9 && n !== 10) || (n >= 0x7f && n < 0xa0) || (n >= 0x202a && n <= 0x202e) || (n >= 0x2066 && n <= 0x2069)) return '';
      return String.fromCodePoint(n);
    }
    return Object.prototype.hasOwnProperty.call(ENTITAETEN, e) ? ENTITAETEN[e] : m;
  });
}

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|hsctatracking|mkt_tok|igshid|yclid|vero_id|oly_enc_id|oly_anon_id)$/i;

/** Eine Link-Adresse prüfen und säubern — null, wenn sie nicht angezeigt werden soll. */
export function linkSauber(roh: string): string | null {
  const t = entitaetenLesen(roh).replace(/[\u0000- \u007f-\u009f​-‏‪-‮⁦-⁩]+/g, '');
  if (!t || t.length > 2000) return null;
  if (/^mailto:/i.test(t)) { const m = /^mailto:([^?]{3,200})/i.exec(t); return m && !/[<>"]/.test(m[1]) ? `mailto:${m[1]}` : null; }
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (!u.hostname || u.username || u.password) return null;
    for (const k of Array.from(u.searchParams.keys())) if (TRACKING.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return null; }
}

/** Attributwert (wie früher `(?:^|\s)name\s*=\s*("…"|'…'|wert)`), linear: ein offenes Anführungszeichen wird je Art nur einmal gesucht. */
const attr = (a: string, name: string): string | undefined => {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*`, 'gi');
  const ohneEnde = { '"': false, "'": false };
  for (let m = re.exec(a); m; m = re.exec(a)) {
    const p = m.index + m[0].length;
    const c = a[p];
    if (c === '"' || c === "'") {
      if (!ohneEnde[c]) {
        const e = a.indexOf(c, p + 1);
        if (e >= 0) return a.slice(p + 1, e);
        ohneEnde[c] = true;
      }
    } else {
      let e = p;
      while (e < a.length && !/[\s"'>]/.test(a[e])) e++;
      if (e > p) return a.slice(p, e);
    }
    re.lastIndex = m.index + 1;
  }
  return undefined;
};

const BLOCK = new Set(['p', 'div', 'tr', 'table', 'ul', 'ol', 'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'dl', 'dt', 'dd', 'center', 'address', 'figure', 'figcaption', 'fieldset', 'main', 'nav', 'aside']);

export interface HtmlText { text: string; bilder: number; links: number }

/** Höchstens so viele ineinander geöffnete Links werden verfolgt (tiefer → wie Text ohne Link). */
const LINK_TIEFE = 16;

/** HTML → reiner Text (siehe Kopf). Wirft nie. */
export function htmlZuText(html: string): HtmlText {
  let h = String(html ?? '').replace(/\u0000/g, '').slice(0, 2_000_000);
  h = kommentareWeg(h);
  // Mehrfach, weil verschachtelte Muster (`<scr<script>ipt>`) sonst nach dem ersten Durchgang wieder entstehen.
  for (let i = 0; i < 3; i++) { const vor = h; h = bloeckeWeg(h); if (h === vor) break; }
  h = offeneBloeckeWeg(h);
  let bilder = 0, links = 0;
  const aus: string[] = [];
  // Offene Links: Adresse merken, Text sammeln, beim Schließen `Text (Adresse)` schreiben. Höchstens LINK_TIEFE ineinander
  // (verschachtelte `<a>` sind ungültig — ohne Deckel würde jedes Schließen den ganzen Text dahinter neu zusammensetzen).
  const stapel: { href: string | null; start: number }[] = [];
  let tiefeDrueber = 0;
  let pos = 0;
  const text = (t: string) => { if (t) aus.push(entitaetenLesen(t).replace(/[ \t\r\n\f ]+/g, ' ')); };
  for (const m of tagsLesen(h)) {
    text(h.slice(pos, m.index));
    pos = m.ende;
    const schliessend = m.schliessend;
    const name = m.name.toLowerCase();
    const a = m.attribute;
    if (name === 'br') { aus.push('\n'); continue; }
    if (name === 'hr') { aus.push('\n—\n'); continue; }
    if (name === 'img') {
      bilder++;
      const alt = entitaetenLesen(attr(a, 'alt') ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      // Winzige Bilder (Pixel) und solche ohne Alternativtext sind fast immer Tracker — nichts anzeigen.
      if (alt && !/^\d+$/.test(alt)) aus.push(` [Bild: ${alt}] `);
      continue;
    }
    if (name === 'a') {
      if (schliessend) {
        if (tiefeDrueber > 0) { tiefeDrueber--; continue; }
        const s = stapel.pop();
        if (s && s.href) {
          const sichtbar = aus.slice(s.start).join('').replace(/\s+/g, ' ').trim();
          if (s.href.replace(/^mailto:/i, '') !== sichtbar && s.href.replace(/\/$/, '') !== sichtbar.replace(/\/$/, '')) aus.push(` (${s.href}) `);
          links++;
        }
      } else if (stapel.length >= LINK_TIEFE) tiefeDrueber++;
      else {
        const href = attr(a, 'href');
        stapel.push({ href: href ? linkSauber(href) : null, start: aus.length });
      }
      continue;
    }
    if (name === 'li') { if (!schliessend) aus.push('\n• '); continue; }
    if (name === 'td' || name === 'th') { aus.push(schliessend ? ' ' : ''); continue; }
    if (name === 'blockquote') { aus.push('\n'); continue; }
    if (BLOCK.has(name)) { aus.push('\n'); continue; }
  }
  // Ein offenes Tag am Ende (`<…` ohne `>` danach) fällt weg — linear: ab dem ersten `<` hinter dem letzten `>`.
  const rest = h.slice(pos);
  const offen = rest.indexOf('<', rest.lastIndexOf('>') + 1);
  text(offen < 0 ? rest : rest.slice(0, offen));
  // Erst Läufe aus Leerzeichen/Tabs auf eins kürzen (linear), dann um Zeilenumbrüche entfernen — dasselbe Ergebnis wie früher in
  // umgekehrter Reihenfolge, aber ohne die quadratische Suche `[ \t]+\n` über lange Läufe.
  const roh = aus.join('')
    .replace(/[ \t]{2,}/g, ' ').replace(/[ \t]\n/g, '\n').replace(/\n[ \t]/g, '\n')
    .replace(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
  return { text: roh, bilder, links };
}
