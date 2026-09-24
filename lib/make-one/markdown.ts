// ─── MAKE OS — Markdown lesen (24.09.) ──────────────────────────────────────
// Für die Wissen-Seite: Kevins Obsidian-Notizen so zeigen, dass man sie lesen
// kann — Überschriften, Listen, Aufgaben, Tabellen, Zitate/Callouts, Code und
// [[Wikilinks]]. Bewusst klein und ohne Bibliothek: Es entsteht nie HTML aus
// dem Text, nur Bausteine, die React als Text setzt. So kann eine Notiz nichts
// ausführen, was in ihr steht.

export type Block =
  | { art: 'titel'; stufe: number; text: string }
  | { art: 'absatz'; zeilen: string[] }
  | { art: 'liste'; geordnet: boolean; punkte: { text: string; tiefe: number; haken?: boolean }[] }
  | { art: 'tabelle'; kopf: string[]; zeilen: string[][] }
  | { art: 'zitat'; callout?: string; titel?: string; zeilen: string[] }
  | { art: 'code'; sprache: string; text: string }
  | { art: 'linie' };

export type Teil =
  | { art: 'text'; text: string }
  | { art: 'fett'; text: string }
  | { art: 'kursiv'; text: string }
  | { art: 'code'; text: string }
  | { art: 'markiert'; text: string }
  | { art: 'wiki'; ziel: string; text: string; einbettung: boolean }
  | { art: 'link'; ziel: string; text: string };

const TABELLE_TRENNER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const LISTE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function zellen(zeile: string): string[] {
  const z = zeile.trim().replace(/^\|/, '').replace(/\|$/, '');
  return z.split('|').map(s => s.trim());
}

/** Zerlegt Markdown (ohne YAML-Kopf) in Blöcke. */
export function bloecke(text: string): Block[] {
  const zeilen = text.replace(/\r\n?/g, '\n').split('\n');
  const aus: Block[] = [];
  let i = 0;
  while (i < zeilen.length) {
    const z = zeilen[i];
    const roh = z.trim();
    if (!roh) { i++; continue; }

    // Code
    const zaun = roh.match(/^(```|~~~)\s*([\w+-]*)/);
    if (zaun) {
      const inhalt: string[] = [];
      i++;
      while (i < zeilen.length && !zeilen[i].trim().startsWith(zaun[1])) { inhalt.push(zeilen[i]); i++; }
      i++;
      aus.push({ art: 'code', sprache: zaun[2] || '', text: inhalt.join('\n') });
      continue;
    }

    // Überschrift
    const h = roh.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (h) { aus.push({ art: 'titel', stufe: h[1].length, text: h[2] }); i++; continue; }

    // Linie
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(roh.replace(/\s/g, ''))) { aus.push({ art: 'linie' }); i++; continue; }

    // Tabelle: Kopfzeile mit |, darunter der Trenner
    if (roh.includes('|') && i + 1 < zeilen.length && TABELLE_TRENNER.test(zeilen[i + 1])) {
      const kopf = zellen(roh);
      i += 2;
      const reihen: string[][] = [];
      while (i < zeilen.length && zeilen[i].trim().includes('|') && zeilen[i].trim()) { reihen.push(zellen(zeilen[i])); i++; }
      aus.push({ art: 'tabelle', kopf, zeilen: reihen });
      continue;
    }

    // Zitat / Obsidian-Callout („> [!note] Titel")
    if (roh.startsWith('>')) {
      const inhalt: string[] = [];
      while (i < zeilen.length && zeilen[i].trim().startsWith('>')) { inhalt.push(zeilen[i].trim().replace(/^>\s?/, '')); i++; }
      const c = inhalt[0]?.match(/^\[!(\w+)\][+-]?\s*(.*)$/);
      if (c) aus.push({ art: 'zitat', callout: c[1].toLowerCase(), titel: c[2] || undefined, zeilen: inhalt.slice(1) });
      else aus.push({ art: 'zitat', zeilen: inhalt });
      continue;
    }

    // Liste
    const l = z.match(LISTE);
    if (l) {
      const geordnet = /\d/.test(l[2]);
      const punkte: { text: string; tiefe: number; haken?: boolean }[] = [];
      while (i < zeilen.length) {
        const m = zeilen[i].match(LISTE);
        if (!m) {
          // Fortsetzungszeile eines Punkts (eingerückt, nicht leer)
          if (zeilen[i].trim() && /^\s{2,}/.test(zeilen[i]) && punkte.length) { punkte[punkte.length - 1].text += ` ${zeilen[i].trim()}`; i++; continue; }
          break;
        }
        const tiefe = Math.min(4, Math.floor(m[1].replace(/\t/g, '    ').length / 2));
        const aufgabe = m[3].match(/^\[( |x|X)\]\s*(.*)$/);
        punkte.push(aufgabe ? { text: aufgabe[2], tiefe, haken: aufgabe[1] !== ' ' } : { text: m[3], tiefe });
        i++;
      }
      aus.push({ art: 'liste', geordnet, punkte });
      continue;
    }

    // Absatz: bis zur Leerzeile oder zum nächsten Block
    const absatz: string[] = [];
    while (i < zeilen.length) {
      const t = zeilen[i].trim();
      if (!t || /^(#{1,6}\s|```|~~~|>)/.test(t) || LISTE.test(zeilen[i])) break;
      if (t.includes('|') && i + 1 < zeilen.length && TABELLE_TRENNER.test(zeilen[i + 1])) break;
      absatz.push(t);
      i++;
    }
    if (absatz.length) aus.push({ art: 'absatz', zeilen: absatz });
    else i++;
  }
  return aus;
}

const INLINE = /(!?\[\[[^\]]+\]\]|\[[^\]]+\]\([^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|==[^=]+==|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

/** Zerlegt eine Zeile in Text, Hervorhebungen und Verweise. */
export function inline(text: string): Teil[] {
  const aus: Teil[] = [];
  let pos = 0;
  for (const m of Array.from(text.matchAll(INLINE))) {
    const s = m[0];
    const at = m.index ?? 0;
    if (at > pos) aus.push({ art: 'text', text: text.slice(pos, at) });
    pos = at + s.length;
    if (s.startsWith('[[') || s.startsWith('![[')) {
      const einbettung = s.startsWith('!');
      const innen = s.slice(einbettung ? 3 : 2, -2);
      const [ziel, alias] = innen.split('|');
      const ohneAnker = ziel.split('#')[0].trim();
      aus.push({ art: 'wiki', ziel: ohneAnker || ziel.trim(), text: (alias ?? ziel).trim(), einbettung });
    } else if (s.startsWith('[')) {
      const t = s.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (t) aus.push({ art: 'link', ziel: t[2], text: t[1] });
      else aus.push({ art: 'text', text: s });
    } else if (s.startsWith('`')) aus.push({ art: 'code', text: s.slice(1, -1) });
    else if (s.startsWith('**') || s.startsWith('__')) aus.push({ art: 'fett', text: s.slice(2, -2) });
    else if (s.startsWith('==')) aus.push({ art: 'markiert', text: s.slice(2, -2) });
    else aus.push({ art: 'kursiv', text: s.slice(1, -1) });
  }
  if (pos < text.length) aus.push({ art: 'text', text: text.slice(pos) });
  return aus;
}

/** Nur Adressen, die man gefahrlos öffnen kann. */
export function sichererLink(ziel: string): string | null {
  return /^(https?:|mailto:|obsidian:)/i.test(ziel) ? ziel : null;
}
