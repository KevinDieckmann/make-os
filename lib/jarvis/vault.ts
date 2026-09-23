// ─── MAKE OS — Das Gehirn: Kevins Notizen ───────────────────────────────────
// Baustein 4b (07.09.). Bis hierher gab es KEINE Verbindung zu den Vaults —
// der Wissens-Agent stand seit Wochen als Eintrag ohne Code im Verzeichnis.
//
// Bewusst KEINE Vektor-Datenbank. Die Recherche sagt es deutlich: unter etwa
// 300 Notizen ist Volltextsuche mit gutem Ranking besser als RAG-Maschinerie —
// weniger Teile, nichts zu indexieren, immer aktuell. Kevin hat nach dem
// Entdoppeln rund 250 bis 300 echte Notizen. Also wird gelesen und gesucht,
// nicht eingebettet.
//
// Drei Dinge sind hier wichtig:
//   • AUSSCHLUSS BEIM LESEN, nicht Filtern beim Suchen. Was privat ist, wird
//     gar nicht erst eingelesen — ein falsch gesetzter Filter kann dann nichts
//     durchreichen. Malins eigene Ordner bleiben nach Kevins Entscheidung vom
//     06.09. komplett draußen.
//   • ENTDOPPELN. Der Tauschordner enthält zwei komplette Kopien von
//     KEMA_Brain, einzelne Briefings liegen zwölffach. Ohne das bekäme Jarvis
//     dieselbe Aussage bis zu zwölfmal zurück.
//   • QUELLE MITGEBEN. Kevin wollte klickbare Herkunft. Jeder Treffer trägt
//     seinen Pfad.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const HEIM = homedir();

/** Wo Kevins Wissen liegt — geordnet nach Sauberkeit. Bei Dubletten gewinnt
 *  der erste Fund, deshalb steht der kuratierte iCloud-Vault vorn. */
export const WURZELN: { id: string; name: string; pfad: string }[] = [
  { id: 'makeos', name: 'MAKE OS (iCloud)', pfad: join(HEIM, 'Library/Mobile Documents/com~apple~CloudDocs/Make Privat ❤️/MAKE OS') },
  { id: 'kema', name: 'KEMA_Brain', pfad: join(HEIM, 'Desktop/KEMA_Brain') },
  { id: 'make', name: 'MAKE', pfad: join(HEIM, 'Desktop/MAKE') },
];

/** Technischer Ballast — nichts davon ist Wissen. */
const TECHNIK = new Set(['node_modules', '.git', '.next', '_build', 'dist', '.obsidian', '.claude', 'build']);

/**
 * Privat: wird gar nicht erst geöffnet.
 *
 * Grundsatz ist Ausschluss, nicht Erlaubnis: alles mit „Malin" bleibt draußen,
 * und nur eine kurze, ausdrücklich benannte Liste kommt herein. Der erste
 * Entwurf machte es andersherum („außer es steht auch Kevin drin") — dabei
 * wäre „Malin an Kevin" durchgerutscht, ihr Übergabeordner. Der Test hat es
 * gefunden. Bei fremden Daten ist die Standardantwort nein.
 */
const GEMEINSAM = [/malin[_\s]*(&|und)?[_\s]*kevin[_\s]*brain/i, /malin\s*(&|und)\s*kevin/i];

export function istPrivat(segment: string): boolean {
  const s = segment.toLowerCase();
  if (!/malin/.test(s)) return false;
  return !GEMEINSAM.some(r => r.test(segment));
}

export interface Notiz {
  /** Eindeutig über alle Wurzeln: „kema/Projects/Brain_Sales.md". */
  id: string;
  wurzel: string;
  pfad: string;
  titel: string;
  groesse: number;
  geaendert: string;
  /** Aus dem YAML-Kopf, falls vorhanden. */
  stichworte: string[];
  /** Die Überschriften — sie sagen, worum es geht, ohne den Text zu laden. */
  ueberschriften: string[];
  /** [[Wikilinks]] als Nachbarschaft. */
  verweise: string[];
}

export interface Bestand {
  notizen: Notiz[];
  gelesen: number;
  dubletten: number;
  privatUebersprungen: number;
  dauerMs: number;
}

/**
 * Die DATEILISTE wird zwischengespeichert, nicht der Inhalt — der wird bei
 * jeder Suche frisch gelesen. Deshalb darf sie länger halten.
 *
 * Vorher eine Minute: dadurch löste jeder Seitenaufruf einen Scan über 700
 * Dateien aus und der erste Ladevorgang blieb sichtbar hängen. Fünf Minuten
 * kosten nichts — was Jarvis selbst schreibt, leert den Speicher ohnehin
 * sofort. Nur eine Notiz, die Kevin gerade in Obsidian ANLEGT, ist bis zu
 * fünf Minuten lang noch nicht auffindbar.
 */
let zwischenspeicher: { bestand: Bestand; zeit: number } | null = null;
const FRISCH_MS = 5 * 60_000;

async function sammle(wurzel: { id: string; name: string; pfad: string }, treffer: Notiz[], zaehler: { privat: number }): Promise<void> {
  async function lauf(ordner: string, tiefe: number): Promise<void> {
    if (tiefe > 8) return;
    let eintraege;
    try { eintraege = await readdir(ordner, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (e.name.startsWith('.') && e.name !== '.md') continue;
      if (TECHNIK.has(e.name)) continue;
      if (istPrivat(e.name)) { zaehler.privat++; continue; }
      const voll = join(ordner, e.name);
      if (e.isDirectory()) { await lauf(voll, tiefe + 1); continue; }
      if (!e.name.toLowerCase().endsWith('.md')) continue;
      try {
        const s = await stat(voll);
        if (s.size > 400_000) continue;
        treffer.push({
          id: `${wurzel.id}/${relative(wurzel.pfad, voll).split(sep).join('/')}`,
          wurzel: wurzel.id,
          pfad: voll,
          titel: basename(e.name, '.md'),
          groesse: s.size,
          geaendert: s.mtime.toISOString(),
          stichworte: [], ueberschriften: [], verweise: [],
        });
      } catch { /* Datei ist weg oder gesperrt — überspringen */ }
    }
  }
  await lauf(wurzel.pfad, 0);
}

const HASH = (t: string) => createHash('sha1').update(t.replace(/\s+/g, ' ').trim()).digest('hex');

/** Kopf, Überschriften und Verweise aus dem Text ziehen. */
function zerlege(text: string): Pick<Notiz, 'stichworte' | 'ueberschriften' | 'verweise'> {
  const kopf = text.startsWith('---') ? text.slice(3, text.indexOf('\n---', 3)) : '';
  const tagZeile = /tags?\s*:\s*\[([^\]]*)\]/i.exec(kopf) ?? /tags?\s*:\s*(.+)/i.exec(kopf);
  const stichworte = tagZeile
    ? tagZeile[1].split(/[,\s]+/).map(x => x.replace(/["'#]/g, '').trim()).filter(Boolean).slice(0, 12)
    : [];
  const ueberschriften = Array.from(text.matchAll(/^#{1,3}\s+(.+)$/gm)).map(m => m[1].trim()).slice(0, 40);
  const verweise = Array.from(text.matchAll(/\[\[([^\]|#]+)/g)).map(m => m[1].trim()).slice(0, 40);
  return { stichworte, ueberschriften, verweise };
}

/** Alle Notizen, entdoppelt. */
export async function bestand(frisch = false): Promise<Bestand> {
  if (!frisch && zwischenspeicher && Date.now() - zwischenspeicher.zeit < FRISCH_MS) return zwischenspeicher.bestand;
  const start = Date.now();
  const roh: Notiz[] = [];
  const zaehler = { privat: 0 };
  for (const w of WURZELN) await sammle(w, roh, zaehler);

  const gesehen = new Set<string>();
  const notizen: Notiz[] = [];
  let dubletten = 0;
  for (const n of roh) {
    let text = '';
    try { text = await readFile(n.pfad, 'utf8'); } catch { continue; }
    const h = HASH(text);
    if (gesehen.has(h)) { dubletten++; continue; }
    gesehen.add(h);
    notizen.push({ ...n, ...zerlege(text) });
  }
  const b: Bestand = { notizen, gelesen: roh.length, dubletten, privatUebersprungen: zaehler.privat, dauerMs: Date.now() - start };
  zwischenspeicher = { bestand: b, zeit: Date.now() };
  return b;
}

export interface Treffer {
  id: string; titel: string; wurzel: string; punkte: number;
  ausschnitt: string; ueberschriften: string[]; geaendert: string;
}

/**
 * Suche über Titel, Überschriften, Stichworte und Text.
 *
 * Bewusst einfach und nachvollziehbar: Titel wiegt am schwersten, dann
 * Überschrift, dann Häufigkeit im Text. Wer wissen will, warum ein Treffer
 * oben steht, kann es an den Punkten ablesen.
 */
export async function suche(frage: string, anzahl = 6): Promise<{ treffer: Treffer[]; durchsucht: number }> {
  // Ohne Unicode-Flag (das Projekt übersetzt nach ES5): Trennzeichen sind
  // alles außer Buchstaben, Ziffern und deutschen Umlauten.
  const begriffe = frage.toLowerCase().split(/[^a-z0-9äöüß]+/).filter(w => w.length > 2).slice(0, 8);
  const b = await bestand();
  if (!begriffe.length) return { treffer: [], durchsucht: b.notizen.length };

  const roh: (Treffer & { text: string })[] = [];
  for (const n of b.notizen) {
    const titel = n.titel.toLowerCase();
    const kopf = [...n.ueberschriften, ...n.stichworte].join(' ').toLowerCase();
    // Der Text wird nur gelesen, wenn Titel oder Kopf schon etwas versprechen
    // ODER wir noch wenig haben — spart bei 300 Dateien spürbar Zeit.
    let punkte = 0;
    for (const w of begriffe) {
      if (titel.includes(w)) punkte += 6;
      if (kopf.includes(w)) punkte += 3;
    }
    let text = '';
    try { text = await readFile(n.pfad, 'utf8'); } catch { continue; }
    const klein = text.toLowerCase();
    for (const w of begriffe) {
      const n2 = klein.split(w).length - 1;
      if (n2) punkte += Math.min(6, n2);
    }
    if (!punkte) continue;

    // ── Zwei Gewichte, die am 07.09. dazugekommen sind ──────────────────────
    // Ohne sie zitierte Jarvis auf die Frage nach den Wächtern eine Notiz vom
    // 1. August statt seines eigenen, an dem Tag geschriebenen Selbstbilds.
    // Reine Worthäufigkeit belohnt lange, alte Texte.
    //
    // 1) Der kuratierte iCloud-Vault führt. Er ist die gepflegte Quelle; die
    //    Desktop-Bestände ergänzen und enthalten die Kopien.
    if (n.wurzel === 'makeos') punkte += 8;
    // 2) Frisches schlägt Altes — aber sanft, damit ein guter alter Text nicht
    //    von einem schlechten neuen verdrängt wird.
    const tage = (Date.now() - Date.parse(n.geaendert)) / 864e5;
    if (tage < 2) punkte += 6;
    else if (tage < 14) punkte += 3;
    else if (tage > 120) punkte -= 2;

    roh.push({
      id: n.id, titel: n.titel, wurzel: n.wurzel, punkte,
      ueberschriften: n.ueberschriften.slice(0, 5), geaendert: n.geaendert,
      ausschnitt: '', text,
    });
  }

  roh.sort((a, b2) => b2.punkte - a.punkte);
  const treffer = roh.slice(0, anzahl).map(t => {
    const klein = t.text.toLowerCase();
    const stelle = begriffe.map(w => klein.indexOf(w)).filter(i => i >= 0).sort((a, b2) => a - b2)[0] ?? 0;
    const von = Math.max(0, stelle - 220);
    return {
      id: t.id, titel: t.titel, wurzel: t.wurzel, punkte: t.punkte,
      ueberschriften: t.ueberschriften, geaendert: t.geaendert,
      ausschnitt: (von > 0 ? '… ' : '') + t.text.slice(von, von + 700).replace(/\s+/g, ' ').trim() + ' …',
    };
  });
  return { treffer, durchsucht: b.notizen.length };
}

/** Eine Notiz ganz lesen. Der Pfad wird gegen den Bestand geprüft — von außen
 *  gereichte Pfade führen so nie an den Ausschlüssen vorbei. */
export async function notiz(id: string, maxZeichen = 12_000): Promise<{ ok: boolean; titel?: string; text?: string; pfad?: string; fehler?: string }> {
  const b = await bestand();
  const n = b.notizen.find(x => x.id === id) ?? b.notizen.find(x => x.id.toLowerCase().endsWith(id.toLowerCase()));
  if (!n) return { ok: false, fehler: `Keine Notiz „${id}".` };
  try {
    const text = await readFile(n.pfad, 'utf8');
    return { ok: true, titel: n.titel, pfad: n.id, text: text.slice(0, maxZeichen) };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht lesbar' };
  }
}

// ─── Schreiben ──────────────────────────────────────────────────────────────
// Kevin am 06.09.: „er soll das Gehirn selber nutzen, bearbeiten und auch
// beschreiben." Nach derselben Regel wie überall: ANLEGEN und ANHÄNGEN laufen
// durch, ÜBERSCHREIBEN und LÖSCHEN gibt es hier bewusst nicht — ein Agent, der
// eine gewachsene Notiz ersetzen kann, ist ein Agent, der sie verlieren kann.

import { appendFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Wohin Neues geht: der kuratierte iCloud-Vault, nicht der Desktop-Wildwuchs. */
const SCHREIB_WURZEL = WURZELN[0].pfad;

const sauber = (name: string) =>
  name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);

export async function legeAn(titel: string, text: string, ordner = '05 Wissen'):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  const name = sauber(titel);
  if (!name) return { ok: false, fehler: 'Kein Titel.' };
  const ziel = join(SCHREIB_WURZEL, sauber(ordner), `${name}.md`);
  try {
    await mkdir(dirname(ziel), { recursive: true });
    // 'wx' — wirft, wenn es die Datei schon gibt. Nichts wird überschrieben.
    await writeFile(ziel, `${text.trim()}\n`, { encoding: 'utf8', flag: 'wx' });
    zwischenspeicher = null;
    return { ok: true, pfad: relative(SCHREIB_WURZEL, ziel) };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return { ok: false, fehler: /EEXIST/.test(m) ? `„${name}" gibt es schon — häng lieber an.` : m.slice(0, 140) };
  }
}

export async function haengeAn(id: string, text: string): Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  const b = await bestand();
  const n = b.notizen.find(x => x.id === id) ?? b.notizen.find(x => x.id.toLowerCase().endsWith(id.toLowerCase()));
  if (!n) return { ok: false, fehler: `Keine Notiz „${id}".` };
  try {
    const stempel = new Date().toISOString().slice(0, 10);
    await appendFile(n.pfad, `\n\n<!-- von Jarvis, ${stempel} -->\n${text.trim()}\n`, 'utf8');
    zwischenspeicher = null;
    return { ok: true, pfad: n.id };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}

// ─── Notizen, die Jarvis selbst besitzt ─────────────────────────────────────
// Die Regel oben lautet: nie überschreiben. Sie schützt Kevins gewachsene
// Notizen — und dafür ist sie richtig.
//
// Für Notizen, die Jarvis SELBST erzeugt, ist sie aber falsch: eine Übersicht
// über die Agenten muss aktuell sein, nicht länger werden. Deshalb hier ein
// eng gefasster zweiter Weg, der drei Bedingungen gleichzeitig erfüllen muss:
//   • Die Datei liegt in einem festen Unterordner, nirgends sonst.
//   • Sie trägt in der ersten Zeile die Marke unten — steht sie nicht da,
//     wird NICHT geschrieben, egal wie die Datei heißt.
//   • Es gibt keinen Weg, den Ordner oder die Marke von außen zu setzen.
// Damit kann dieser Weg eine handgeschriebene Notiz nicht treffen, auch nicht
// bei gleichem Namen.

/** Steht in Zeile 1 jeder von Jarvis erzeugten Notiz. */
export const MARKE = '<!-- von Jarvis erzeugt — wird überschrieben, hier nichts von Hand eintragen -->';
const EIGENER_ORDNER = '05 Wissen/MAKE OS';

export async function schreibeEigene(name: string, text: string):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  const datei = sauber(name);
  if (!datei) return { ok: false, fehler: 'Kein Name.' };
  const ziel = join(SCHREIB_WURZEL, EIGENER_ORDNER, `${datei}.md`);
  try {
    // Gibt es die Datei schon, muss sie unsere Marke tragen.
    let alt = '';
    try { alt = await readFile(ziel, 'utf8'); } catch { /* neu, das ist in Ordnung */ }
    if (alt && !alt.startsWith(MARKE)) {
      return { ok: false, fehler: `„${datei}" trägt nicht Jarvis' Marke — nicht angefasst.` };
    }
    await mkdir(dirname(ziel), { recursive: true });
    const stempel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    await writeFile(ziel, `${MARKE}\n<!-- Stand ${stempel} -->\n\n${text.trim()}\n`, 'utf8');
    zwischenspeicher = null;
    return { ok: true, pfad: `${EIGENER_ORDNER}/${datei}.md` };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}
