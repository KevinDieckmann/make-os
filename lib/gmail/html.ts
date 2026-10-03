// ─── Gmail — HTML säubern → reiner Text (rein, 03.10.2026) ───────────────────
// HTML aus fremden Mails wird in MAKE OS NIE gerendert — weder roh noch „gesäubert“: Aus einer Mail wird Text, fertig.
// Damit gibt es keine Skripte, keine Formulare, keine nachgeladenen Bilder (Tracking-Pixel) und kein CSS, das etwas verdeckt.
//   · weg samt Inhalt: script, style, head, title, template, noscript, svg, object, embed, iframe, frame, form-Felder, Kommentare
//   · Bilder: nie geladen, nie angezeigt — `[Bild: alt]` bei Alternativtext, sonst nichts; gezählt (`bilder`)
//   · Links: `Text (https://…)` — die ECHTE Adresse steht immer dabei (Phishing: Text sagt A, Ziel ist B); nur http(s) und
//     mailto, `javascript:`/`data:`/Relative fallen weg; Tracking-Parameter (utm_*, fbclid, gclid, mc_*) werden entfernt
//   · Blöcke (p, div, br, li, tr, h1–h6, blockquote) → Zeilenumbrüche; Entitäten (benannte, &#…;, &#x…;) → Zeichen
// Rein, ohne DOM — getestet in tests/gmail-mime.test.ts (Skripte, Pixel, Links).

const WEG_MIT_INHALT = /<(script|style|head|title|template|noscript|svg|object|embed|iframe|frameset|frame|applet|math|select|textarea|button)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const WEG_OHNE_ENDE = /<(script|style|template|noscript|svg|object|iframe)\b[^>]*>[\s\S]*$/i;
const KOMMENTAR = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![a-zA-Z][^>]*>|<\?[\s\S]*?\?>/g;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

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

const attr = (a: string, name: string): string | undefined => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(a);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
};

const BLOCK = new Set(['p', 'div', 'tr', 'table', 'ul', 'ol', 'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'dl', 'dt', 'dd', 'center', 'address', 'figure', 'figcaption', 'fieldset', 'main', 'nav', 'aside']);

export interface HtmlText { text: string; bilder: number; links: number }

/** HTML → reiner Text (siehe Kopf). Wirft nie. */
export function htmlZuText(html: string): HtmlText {
  let h = String(html ?? '').replace(/\u0000/g, '').slice(0, 2_000_000);
  h = h.replace(KOMMENTAR, '');
  // Mehrfach, weil verschachtelte Muster (`<scr<script>ipt>`) sonst nach dem ersten Durchgang wieder entstehen.
  for (let i = 0; i < 3; i++) { const vor = h; h = h.replace(WEG_MIT_INHALT, ''); if (h === vor) break; }
  h = h.replace(WEG_OHNE_ENDE, '');
  let bilder = 0, links = 0;
  const aus: string[] = [];
  // Offene Links: Adresse merken, Text sammeln, beim Schließen `Text (Adresse)` schreiben.
  const stapel: { href: string | null; start: number }[] = [];
  let pos = 0;
  const text = (t: string) => { if (t) aus.push(entitaetenLesen(t).replace(/[ \t\r\n\f ]+/g, ' ')); };
  for (const m of h.matchAll(TAG)) {
    text(h.slice(pos, m.index));
    pos = (m.index ?? 0) + m[0].length;
    const schliessend = m[1] === '/';
    const name = m[2].toLowerCase();
    const a = m[3] ?? '';
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
        const s = stapel.pop();
        if (s) {
          const sichtbar = aus.slice(s.start).join('').replace(/\s+/g, ' ').trim();
          if (s.href && s.href.replace(/^mailto:/i, '') !== sichtbar && s.href.replace(/\/$/, '') !== sichtbar.replace(/\/$/, '')) { aus.push(` (${s.href}) `); links++; }
          else if (s.href) links++;
        }
      } else {
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
  text(h.slice(pos).replace(/<[^>]*$/, ''));
  const roh = aus.join('')
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ')
    .replace(/[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g, '')
    .replace(/\n{3,}/g, '\n\n').trim();
  return { text: roh, bilder, links };
}
