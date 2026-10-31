// ─── E-Rechnung — sicherer XML-Leser (rein, 31.10.) ─────────────────────────
// Kevin 31.10.: „E-Rechnung — heute fertig.“ Fremde XML (eingehende ZUGFeRD-/XRechnung-Dateien) ist fremde Datenquelle: sie wird nur
// GELESEN, nie ausgeführt. Darum kein allgemeiner XML-Parser, sondern ein kleiner, linearer Leser mit festen Grenzen:
//   • keine DTD, keine Entitäten-Deklaration (<!DOCTYPE … / <!ENTITY …) → abgelehnt (XXE, „Billion Laughs“),
//   • nur die fünf vordefinierten Entitäten und Zeichenreferenzen — alles andere bleibt wörtlich stehen,
//   • Größe (Zeichen), Tiefe und Anzahl der Elemente begrenzt,
//   • keine Regex mit verschachtelten Wiederholungen über die Eingabe (nur indexOf-Schritte).
// Namensräume: der Leser merkt sich nur den lokalen Namen (`ram:ID` → `ID`) — für CII und UBL genügt das.

/** Höchstens so viele Zeichen XML (≈ 2 MB) — eine echte Rechnung hat selten mehr als 200 KB. */
export const XML_MAX_ZEICHEN = 2_000_000;
/** Höchstens so viele Bytes XML (Datei bzw. entpackt aus einer fremden PDF). */
export const XML_MAX_BYTES = 2_000_000;
const TIEFE_MAX = 64;
const ELEMENTE_MAX = 50_000;

export interface XmlKnoten { name: string; attr: Record<string, string>; kinder: XmlKnoten[]; text: string }

export class XmlFehler extends Error {}

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Entitäten auflösen — nur die vordefinierten und Zeichenreferenzen; unbekannte bleiben wörtlich. */
function entschluesseln(s: string): string {
  if (!s.includes('&')) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const a = s.indexOf('&', i);
    if (a < 0) { out += s.slice(i); break; }
    out += s.slice(i, a);
    const e = s.indexOf(';', a);
    if (e < 0 || e - a > 12) { out += '&'; i = a + 1; continue; }
    const k = s.slice(a + 1, e);
    let ersatz: string | null = null;
    if (ENT[k] !== undefined) ersatz = ENT[k];
    else if (/^#[0-9]{1,7}$/.test(k)) ersatz = zeichen(Number(k.slice(1)));
    else if (/^#x[0-9a-fA-F]{1,6}$/.test(k)) ersatz = zeichen(parseInt(k.slice(2), 16));
    if (ersatz === null) { out += '&'; i = a + 1; continue; }
    out += ersatz;
    i = e + 1;
  }
  return out;
}
const zeichen = (n: number): string | null => (Number.isFinite(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : null);

const lokal = (n: string) => { const i = n.indexOf(':'); return i >= 0 ? n.slice(i + 1) : n; };

/** Attribute eines Start-Tags lesen (Text nach dem Namen) — linear, ohne Regex über die ganze Eingabe. */
function attributeLesen(s: string): Record<string, string> {
  const attr: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    const gl = s.indexOf('=', i);
    if (gl < 0) break;
    const name = s.slice(i, gl).trim();
    let j = gl + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    const q = s[j];
    if (q !== '"' && q !== "'") break;
    const ende = s.indexOf(q, j + 1);
    if (ende < 0) throw new XmlFehler('Attribut nicht geschlossen.');
    if (name) attr[lokal(name)] = entschluesseln(s.slice(j + 1, ende));
    i = ende + 1;
  }
  return attr;
}

/**
 * XML in einen Baum lesen. Wirft `XmlFehler` bei DTD/Entitäten, zu groß, zu tief, zu vielen Elementen oder kaputtem Aufbau.
 * Gibt die Wurzel zurück.
 */
export function xmlLesen(roh: string): XmlKnoten {
  if (typeof roh !== 'string') throw new XmlFehler('Kein Text.');
  if (roh.length > XML_MAX_ZEICHEN) throw new XmlFehler('XML ist zu groß.');
  const s = roh.charCodeAt(0) === 0xfeff ? roh.slice(1) : roh;
  // Keine Dokumenttyp-Deklaration und keine Entitäten — eine E-Rechnung braucht beides nie.
  if (/<!DOCTYPE/i.test(s) || /<!ENTITY/i.test(s)) throw new XmlFehler('XML mit DTD/Entitäten wird nicht gelesen.');
  const wurzelHalter: XmlKnoten = { name: '#dok', attr: {}, kinder: [], text: '' };
  const stapel: XmlKnoten[] = [wurzelHalter];
  let anzahl = 0;
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    const textStueck = lt < 0 ? s.slice(i) : s.slice(i, lt);
    if (textStueck) {
      const oben = stapel[stapel.length - 1];
      if (oben !== wurzelHalter) oben.text += entschluesseln(textStueck);
      else if (textStueck.trim()) throw new XmlFehler('Text außerhalb der Wurzel.');
    }
    if (lt < 0) break;
    if (s.startsWith('<?', lt)) { const e = s.indexOf('?>', lt + 2); if (e < 0) throw new XmlFehler('Verarbeitungsanweisung offen.'); i = e + 2; continue; }
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); if (e < 0) throw new XmlFehler('Kommentar offen.'); i = e + 3; continue; }
    if (s.startsWith('<![CDATA[', lt)) {
      const e = s.indexOf(']]>', lt + 9); if (e < 0) throw new XmlFehler('CDATA offen.');
      const oben = stapel[stapel.length - 1]; if (oben !== wurzelHalter) oben.text += s.slice(lt + 9, e);
      i = e + 3; continue;
    }
    if (s.startsWith('<!', lt)) throw new XmlFehler('Deklaration nicht erlaubt.');
    // Ende des Tags: ein „>“ außerhalb von Anführungszeichen — ein Durchlauf, linear.
    let ende = -1;
    let q = '';
    for (let j = lt + 1; j < s.length; j++) {
      const c = s[j];
      if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '>') { ende = j; break; }
    }
    if (ende < 0) throw new XmlFehler('Tag offen.');
    const inhalt = s.slice(lt + 1, ende);
    i = ende + 1;
    if (inhalt.startsWith('/')) {
      const name = lokal(inhalt.slice(1).trim());
      const oben = stapel.pop();
      if (!oben || oben === wurzelHalter || oben.name !== name) throw new XmlFehler('Tags passen nicht zusammen.');
      continue;
    }
    const leer = inhalt.endsWith('/');
    const k = leer ? inhalt.slice(0, -1) : inhalt;
    const m = k.search(/\s/);
    const name = (m < 0 ? k : k.slice(0, m)).trim();
    if (!name || !/^[A-Za-z_][\w.:-]*$/.test(name)) throw new XmlFehler('Ungültiger Elementname.');
    if (++anzahl > ELEMENTE_MAX) throw new XmlFehler('Zu viele Elemente.');
    const knoten: XmlKnoten = { name: lokal(name), attr: m < 0 ? {} : attributeLesen(k.slice(m)), kinder: [], text: '' };
    const eltern = stapel[stapel.length - 1];
    if (eltern === wurzelHalter && wurzelHalter.kinder.length) throw new XmlFehler('Mehr als eine Wurzel.');
    eltern.kinder.push(knoten);
    if (!leer) { stapel.push(knoten); if (stapel.length > TIEFE_MAX + 1) throw new XmlFehler('XML ist zu tief verschachtelt.'); }
  }
  if (stapel.length !== 1) throw new XmlFehler('Nicht alle Tags geschlossen.');
  const w = wurzelHalter.kinder[0];
  if (!w) throw new XmlFehler('Leeres XML.');
  return w;
}

/** Erstes Kind über einen Pfad lokaler Namen (`kind(k, 'A', 'B')`). */
export function kind(k: XmlKnoten | undefined, ...pfad: string[]): XmlKnoten | undefined {
  let n = k;
  for (const p of pfad) { n = n?.kinder.find(x => x.name === p); if (!n) return undefined; }
  return n;
}
/** Alle direkten Kinder mit diesem Namen. */
export const kinder = (k: XmlKnoten | undefined, name: string): XmlKnoten[] => (k ? k.kinder.filter(x => x.name === name) : []);
/** Text am Pfad (getrimmt) — leer = undefined. */
export function text(k: XmlKnoten | undefined, ...pfad: string[]): string | undefined {
  const t = kind(k, ...pfad)?.text.trim();
  return t ? t : undefined;
}

/** Text für XML maskieren (Ausgabe). Steuerzeichen außer Tab/Zeilenumbruch fallen weg. */
export function xmlText(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
