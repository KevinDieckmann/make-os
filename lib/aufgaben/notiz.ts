// ─── MAKE OS — Notizen an Projekt und Aufgabe (rein, 28.09. spät) ───────────
// Kevin: „Notizen — formatierbar, Checklisten, Links.“ Gespeichert wird Text in einer kleinen, sicheren
// Markdown-Teilmenge; gerendert wird aus diesen Blöcken mit React-Elementen (components/os/aufgaben/Notiz.tsx) —
// nie mit dangerouslySetInnerHTML, kein HTML aus dem Text. Links nur http(s) und interne /os/-Pfade.
//
//   # / ## / ###     Überschriften
//   - / *            Liste         1.   nummerierte Liste
//   - [ ] / - [x]    Checkliste (abhakbar in der Vorschau → `checkUmschalten`)
//   **fett**  *kursiv* / _kursiv_  `code`  [Text](https://…)  nackte https://… und /os/…-Links

export type Inline =
  | { art: 'text'; text: string }
  | { art: 'fett'; kinder: Inline[] }
  | { art: 'kursiv'; kinder: Inline[] }
  | { art: 'code'; text: string }
  | { art: 'link'; text: string; href: string; intern: boolean };

export type Block =
  | { art: 'ueberschrift'; stufe: 1 | 2 | 3; inhalt: Inline[] }
  | { art: 'absatz'; inhalt: Inline[] }
  | { art: 'liste'; nummeriert: boolean; punkte: { inhalt: Inline[]; check: boolean | null; zeile: number }[] }
  | { art: 'trenner' };

/** Erlaubte Link-Ziele: http(s) und interne /os/-Pfade — alles andere (javascript:, data: …) wird Text. */
export function sichererLink(href: string): { href: string; intern: boolean } | null {
  const h = href.trim();
  if (/^\/os(\/|$|\?)/.test(h) && !h.startsWith('//')) return { href: h, intern: true };
  if (/^https?:\/\/[^\s<>"']+$/i.test(h)) return { href: h, intern: false };
  return null;
}

const MUSTER = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*\s][^*]*)\*)|(\b_([^_\s][^_]*)_\b)|((?:https?:\/\/|\/os\/)[^\s<>"')\]]+)/;

/** Inline-Formatierung (eine Ebene tief verschachtelt: fett/kursiv dürfen Links enthalten). */
export function inline(text: string, tiefe = 0): Inline[] {
  const raus: Inline[] = [];
  let rest = text;
  while (rest) {
    const m = MUSTER.exec(rest);
    if (!m) { raus.push({ art: 'text', text: rest }); break; }
    if (m.index > 0) raus.push({ art: 'text', text: rest.slice(0, m.index) });
    if (m[1]) raus.push(tiefe ? { art: 'text', text: m[2] } : { art: 'fett', kinder: inline(m[2], tiefe + 1) });
    else if (m[3]) raus.push({ art: 'code', text: m[4] });
    else if (m[5]) { const l = sichererLink(m[7]); raus.push(l ? { art: 'link', text: m[6], ...l } : { art: 'text', text: m[0] }); }
    else if (m[8]) raus.push(tiefe ? { art: 'text', text: m[9] } : { art: 'kursiv', kinder: inline(m[9], tiefe + 1) });
    else if (m[10]) raus.push(tiefe ? { art: 'text', text: m[11] } : { art: 'kursiv', kinder: inline(m[11], tiefe + 1) });
    else if (m[12]) { const url = m[12].replace(/[.,;:!?]+$/, ''); const l = sichererLink(url); raus.push(l ? { art: 'link', text: url, ...l } : { art: 'text', text: url }); rest = rest.slice(m.index + url.length); continue; }
    rest = rest.slice(m.index + m[0].length);
  }
  // Benachbarte Texte zusammenlegen.
  return raus.reduce<Inline[]>((l, x) => { const v = l[l.length - 1]; if (x.art === 'text' && v?.art === 'text') v.text += x.text; else l.push(x); return l; }, []);
}

const LISTE = /^\s*(?:([-*])|(\d{1,3})[.)])\s+(?:\[( |x|X)\]\s+)?(.*)$/;

/** Text → Blöcke. Jede Zeile gehört zu höchstens einem Block; `zeile` = Zeilennummer (für das Abhaken). */
export function notizBloecke(text: string | undefined | null): Block[] {
  const zeilen = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const raus: Block[] = [];
  let absatz: string[] = [];
  const absatzZu = () => { if (absatz.length) { raus.push({ art: 'absatz', inhalt: inline(absatz.join('\n')) }); absatz = []; } };
  zeilen.forEach((z, i) => {
    const h = /^(#{1,3})\s+(.*)$/.exec(z);
    if (h) { absatzZu(); raus.push({ art: 'ueberschrift', stufe: h[1].length as 1 | 2 | 3, inhalt: inline(h[2].trim()) }); return; }
    if (/^\s*(---|\*\*\*)\s*$/.test(z)) { absatzZu(); raus.push({ art: 'trenner' }); return; }
    const l = LISTE.exec(z);
    if (l) {
      absatzZu();
      const nummeriert = !!l[2];
      const check = l[3] === undefined ? null : l[3].toLowerCase() === 'x';
      const letzter = raus[raus.length - 1];
      const punkt = { inhalt: inline(l[4]), check, zeile: i };
      if (letzter?.art === 'liste' && letzter.nummeriert === nummeriert) letzter.punkte.push(punkt);
      else raus.push({ art: 'liste', nummeriert, punkte: [punkt] });
      return;
    }
    if (!z.trim()) { absatzZu(); return; }
    absatz.push(z);
  });
  absatzZu();
  return raus;
}

/** Eine Checkliste in Zeile `zeile` ab-/anhaken — der übrige Text bleibt Zeichen für Zeichen gleich. */
export function checkUmschalten(text: string, zeile: number): string {
  const zeilen = text.split('\n');
  const z = zeilen[zeile];
  if (z === undefined) return text;
  const m = /^(\s*(?:[-*]|\d{1,3}[.)])\s+\[)( |x|X)(\].*)$/.exec(z);
  if (!m) return text;
  zeilen[zeile] = `${m[1]}${m[2] === ' ' ? 'x' : ' '}${m[3]}`;
  return zeilen.join('\n');
}

/** Checklisten-Stand einer Notiz (erledigt/gesamt) — für Zähler an Projekt und Aufgabe. */
export function checkStand(text: string | undefined | null): { fertig: number; gesamt: number } {
  let fertig = 0, gesamt = 0;
  for (const b of notizBloecke(text)) if (b.art === 'liste') for (const p of b.punkte) if (p.check !== null) { gesamt++; if (p.check) fertig++; }
  return { fertig, gesamt };
}
