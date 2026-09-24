// ─── MAKE OS — Das Gehirn: Kevins Obsidian ──────────────────────────────────
// 24.09., Kevin: „Obsidian soll Nummer eins Wissensbank sein."
//
// Nummer eins ist das kuratierte Brain im Obsidian-Vault „MAKE":
// Desktop/MAKE/Make.Claude (auf dem Server: MAKE_VAULT_DIR). Dessen eigene
// Regeln stehen in Make.Claude/AGENTS.md und 00. Fundament/Vertraulichkeits-
// regeln.md — diese Datei setzt sie um, wie sie die Cowork-Sitzung vom 06.09.
// schon einmal gebaut hatte (lib/store/vault.ts in der alten Kopie):
//   • LESEN nur das Brain, ohne _Archiv, _Vorlagen, Kopien und Exporte —
//     und ohne das, was Kevin in Obsidian selbst ausgeblendet hat
//     (.obsidian/app.json › userIgnoreFilters).
//   • SEHEN nach `scope` (AGENTS.md §3): kevin alles · malin alles außer
//     `privat` mit `owner: kevin` · sonst nur familie/oeffentlich ·
//     Agenten ohne Person nie `privat`.
//   • SCHREIBEN (AGENTS.md §4.2): anhängen nur an Offene_Fragen_Brain,
//     Taskmanagement_Brain, Jarvis_Log; neu anlegen nur Protokolle.
//     Überschreiben oder Löschen gibt es nicht.
// Zweite Quelle, nachrangig: die MAKE-OS-Doku im iCloud-Vault (Weg, Bau, Plan).
//
// Bewusst keine Vektor-Datenbank: bei einigen hundert Notizen schlägt
// Volltextsuche mit gutem Ranking jede RAG-Maschinerie — weniger Teile,
// nichts zu indexieren, immer aktuell.

import { readdir, readFile, stat, appendFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, basename, relative, sep, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const HEIM = homedir();
const ausHeim = (p: string) => p.replace(/^~(?=$|\/)/, HEIM);

/** Das Brain — Nummer eins. */
const BRAIN = process.env.MAKE_VAULT_DIR?.trim() ? ausHeim(process.env.MAKE_VAULT_DIR.trim()) : join(HEIM, 'Desktop', 'MAKE', 'Make.Claude');
const ICLOUD = join(HEIM, 'Library/Mobile Documents/com~apple~CloudDocs/Make Privat ❤️/MAKE OS');

export interface Wurzel {
  id: string; name: string;
  /** Wo gelesen wird. */
  pfad: string;
  /** Der Obsidian-Vault (Ordner mit .obsidian) — Basis für Kennungen und „In Obsidian öffnen". */
  vault: string;
  /** Name des Vaults in Obsidian (= Ordnername). */
  obsidian: string;
}

/** Reihenfolge = Rang: bei inhaltsgleichen Notizen gewinnt die erste Wurzel. */
export const WURZELN: Wurzel[] = [
  { id: 'make', name: 'Obsidian · MAKE Brain', pfad: BRAIN, vault: dirname(BRAIN), obsidian: basename(dirname(BRAIN)) },
  { id: 'makeos', name: 'MAKE OS · Doku (iCloud)', pfad: ICLOUD, vault: ICLOUD, obsidian: basename(ICLOUD) },
];

/** Technischer Ballast — nichts davon ist Wissen. */
const TECHNIK = new Set(['node_modules', '.git', '.next', '_build', 'dist', '.obsidian', '.claude', 'build', 'scripts']);
/** Aus AGENTS.md §5: Archiv, Vorlagen, Kopien und Exporte sind keine Quellen. */
const AUSGESCHLOSSEN = ['_Archiv', '_Vorlagen', '_to_delete', 'MakeOS-Blueprint', 'OneDrive_Export', 'KEMA_Brain Kopie'];
export const istAusgeschlossen = (name: string) => TECHNIK.has(name) || AUSGESCHLOSSEN.some(a => name.startsWith(a));

/**
 * Privat im Sinne von Kevins Entscheidung vom 06.09.: Malins eigene Ordner
 * werden gar nicht erst geöffnet. Ausschluss, nicht Erlaubnis — nur das
 * gemeinsame Beziehungs-Brain kommt herein.
 */
const GEMEINSAM = [/malin[_\s]*(&|und)?[_\s]*kevin[_\s]*brain/i, /malin\s*(&|und)\s*kevin/i];
export function istPrivat(segment: string): boolean {
  const s = segment.toLowerCase();
  if (!/malin/.test(s)) return false;
  return !GEMEINSAM.some(r => r.test(segment));
}

// ── Kopf einer Notiz ────────────────────────────────────────────────────────

export interface Kopf { typ?: string; scope?: string; owner?: string; stand?: string; tags: string[] }

/** YAML-Kopf, die Untermenge „key: value" und „key: [a, b]" — ohne Zusatzpaket. */
export function leseKopf(text: string): { kopf: Kopf; rumpf: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { kopf: { tags: [] }, rumpf: text };
  const roh: Record<string, string | string[]> = {};
  for (const zeile of m[1].split(/\r?\n/)) {
    const kv = zeile.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const wert = kv[2].trim();
    roh[kv[1]] = wert.startsWith('[') && wert.endsWith(']')
      ? wert.slice(1, -1).split(',').map(s => s.trim().replace(/^["'#]|["']$/g, '')).filter(Boolean)
      : wert.replace(/^["']|["']$/g, '');
  }
  const s = (k: string) => (typeof roh[k] === 'string' ? (roh[k] as string) : undefined);
  const tags = Array.isArray(roh.tags) ? roh.tags : s('tags') ? s('tags')!.split(/[,\s]+/).filter(Boolean) : [];
  return { kopf: { typ: s('type'), scope: s('scope')?.toLowerCase(), owner: s('owner')?.toLowerCase(), stand: s('stand'), tags: tags.slice(0, 12) }, rumpf: text.slice(m[0].length) };
}

/** Der gültige Stand: erster „## 🔴 UPDATE"-Block bis zur nächsten ##-Überschrift. */
export function obersterBlock(rumpf: string): string {
  const z = rumpf.split(/\r?\n/);
  const start = z.findIndex(l => /^##\s+🔴/.test(l));
  if (start < 0) return '';
  let ende = z.length;
  for (let i = start + 1; i < z.length; i++) if (/^##\s/.test(z[i])) { ende = i; break; }
  return z.slice(start, ende).join('\n').trim();
}

// ── Wer darf was sehen (AGENTS.md §3, Vertraulichkeitsregeln §1 und §4) ─────

export interface Sicht { person: string; agent?: boolean }
/** Ohne Person (Hintergrundlauf eines Agenten): nie Privates. */
export const AGENT: Sicht = { person: 'kevin', agent: true };

export function darfSehen(n: { scope?: string; owner?: string }, s: Sicht): boolean {
  const scope = n.scope || 'intern';           // ohne Kennzeichnung mindestens intern
  if (s.agent && scope === 'privat') return false;
  if (s.person === 'kevin') return true;
  if (s.person === 'malin') return !(scope === 'privat' && n.owner === 'kevin');
  return scope === 'familie' || scope === 'oeffentlich';
}

/** Grober Bereich aus dem Ordner — für Filter und Anzeige. */
export function bereichVon(id: string): string {
  if (id.startsWith('makeos/')) return 'MAKE OS';
  const teil = id.split('/')[2] ?? '';
  if (/^00\./.test(teil)) return 'Fundament';
  if (/KD Ventures/i.test(teil)) return 'Business';
  if (/privat/i.test(teil)) return 'Privat';
  if (/Protokolle/i.test(teil)) return 'Protokolle';
  if (/Quellen/i.test(teil)) return 'Quellen';
  return 'Sonstiges';
}

// ── Bestand ─────────────────────────────────────────────────────────────────

export interface Notiz {
  /** Eindeutig über alle Wurzeln, relativ zum Obsidian-Vault: „make/Make.Claude/01. …/X.md". */
  id: string;
  wurzel: string;
  pfad: string;
  titel: string;
  groesse: number;
  geaendert: string;
  bereich: string;
  typ?: string; scope?: string; owner?: string; stand?: string;
  /** Aus dem YAML-Kopf. */
  stichworte: string[];
  /** Die Überschriften — sagen, worum es geht, ohne den Text zu laden. */
  ueberschriften: string[];
  /** [[Wikilinks]] als Nachbarschaft. */
  verweise: string[];
}

export interface Bestand { notizen: Notiz[]; gelesen: number; dubletten: number; privatUebersprungen: number; dauerMs: number }

/**
 * Die Dateiliste wird fünf Minuten gehalten, der Inhalt bei jeder Suche frisch
 * gelesen. Was Jarvis selbst schreibt, leert den Speicher sofort; eine Notiz,
 * die Kevin gerade in Obsidian anlegt, ist bis zu fünf Minuten unsichtbar.
 */
let zwischenspeicher: { bestand: Bestand; zeit: number } | null = null;
const FRISCH_MS = 5 * 60_000;

/** Was Kevin in Obsidian unter „Ausgeschlossene Dateien" eingetragen hat. */
async function obsidianFilter(vault: string): Promise<string[]> {
  try {
    const app = JSON.parse(await readFile(join(vault, '.obsidian', 'app.json'), 'utf8')) as { userIgnoreFilters?: unknown };
    return Array.isArray(app.userIgnoreFilters) ? app.userIgnoreFilters.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

async function sammle(w: Wurzel, treffer: Omit<Notiz, 'bereich' | 'stichworte' | 'ueberschriften' | 'verweise'>[], zaehler: { privat: number }): Promise<void> {
  const filter = await obsidianFilter(w.vault);
  const blendetAus = (rel: string) => filter.some(f => rel === f || rel.startsWith(f) || `${rel}/`.startsWith(f));
  async function lauf(ordner: string, tiefe: number): Promise<void> {
    if (tiefe > 8) return;
    let eintraege;
    try { eintraege = await readdir(ordner, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (e.name.startsWith('.')) continue;
      if (istAusgeschlossen(e.name)) continue;
      if (istPrivat(e.name)) { zaehler.privat++; continue; }
      const voll = join(ordner, e.name);
      const rel = relative(w.vault, voll).split(sep).join('/');
      if (blendetAus(e.isDirectory() ? `${rel}/` : rel)) continue;
      if (e.isDirectory()) { await lauf(voll, tiefe + 1); continue; }
      if (!e.name.toLowerCase().endsWith('.md')) continue;
      try {
        const s = await stat(voll);
        if (s.size > 400_000) continue;
        treffer.push({ id: `${w.id}/${rel}`, wurzel: w.id, pfad: voll, titel: basename(e.name, '.md'), groesse: s.size, geaendert: s.mtime.toISOString() });
      } catch { /* weg oder gesperrt — überspringen */ }
    }
  }
  await lauf(w.pfad, 0);
}

const HASH = (t: string) => createHash('sha1').update(t.replace(/\s+/g, ' ').trim()).digest('hex');

/** Alle Notizen beider Quellen, entdoppelt — ungefiltert; gesehen wird über `darfSehen`. */
export async function bestand(frisch = false): Promise<Bestand> {
  if (!frisch && zwischenspeicher && Date.now() - zwischenspeicher.zeit < FRISCH_MS) return zwischenspeicher.bestand;
  const start = Date.now();
  const roh: Parameters<typeof sammle>[1] = [];
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
    const { kopf, rumpf } = leseKopf(text);
    notizen.push({
      ...n, bereich: bereichVon(n.id), typ: kopf.typ, scope: kopf.scope, owner: kopf.owner, stand: kopf.stand,
      stichworte: kopf.tags,
      ueberschriften: Array.from(rumpf.matchAll(/^#{1,3}\s+(.+)$/gm)).map(m => m[1].trim()).slice(0, 40),
      verweise: Array.from(rumpf.matchAll(/\[\[([^\]|#]+)/g)).map(m => m[1].trim()).slice(0, 40),
    });
  }
  const b: Bestand = { notizen, gelesen: roh.length, dubletten, privatUebersprungen: zaehler.privat, dauerMs: Date.now() - start };
  zwischenspeicher = { bestand: b, zeit: Date.now() };
  return b;
}

/** „In Obsidian öffnen" — der Link, den die Obsidian-App auf dem Mac versteht. */
export function obsidianLink(n: Pick<Notiz, 'id' | 'wurzel'>): string | null {
  const w = WURZELN.find(x => x.id === n.wurzel);
  if (!w) return null;
  const datei = n.id.slice(w.id.length + 1).replace(/\.md$/i, '');
  return `obsidian://open?vault=${encodeURIComponent(w.obsidian)}&file=${encodeURIComponent(datei)}`;
}

/** Eine Notiz per Kennung oder Wikilink-Namen finden — nur, was die Sicht erlaubt. */
function finde(b: Bestand, id: string, sicht: Sicht): Notiz | undefined {
  const sauberId = id.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
  const klein = sauberId.toLowerCase();
  const passt = (n: Notiz) => n.id === sauberId || n.id.toLowerCase().endsWith(klein) || n.titel.toLowerCase() === klein.replace(/\.md$/, '');
  // Wikilink-Namen: wie Obsidian — die erste passende Notiz, das Brain vor der Doku.
  return b.notizen.find(n => passt(n) && darfSehen(n, sicht));
}

// ── Suchen ──────────────────────────────────────────────────────────────────

export interface Treffer {
  id: string; titel: string; wurzel: string; bereich: string; scope?: string; stand?: string; punkte: number;
  ausschnitt: string; ueberschriften: string[]; geaendert: string;
}

/**
 * Suche über Titel, Überschriften, Stichworte und Text. Nachvollziehbar:
 * Titel wiegt am schwersten, dann Überschrift, dann Häufigkeit im Text.
 * Das Brain führt (+8), Frisches schlägt Altes sanft.
 */
export async function suche(frage: string, anzahl = 6, sicht: Sicht = AGENT, bereich?: string): Promise<{ treffer: Treffer[]; durchsucht: number }> {
  // Ohne Unicode-Flag (das Projekt übersetzt nach ES5): Trennzeichen sind alles
  // außer Buchstaben, Ziffern und deutschen Umlauten.
  const begriffe = frage.toLowerCase().split(/[^a-z0-9äöüß]+/).filter(w => w.length > 2).slice(0, 8);
  const b = await bestand();
  const sichtbar = b.notizen.filter(n => darfSehen(n, sicht) && (!bereich || n.bereich === bereich));
  if (!begriffe.length) return { treffer: [], durchsucht: sichtbar.length };

  const roh: (Treffer & { text: string })[] = [];
  for (const n of sichtbar) {
    const titel = n.titel.toLowerCase();
    const kopf = [...n.ueberschriften, ...n.stichworte].join(' ').toLowerCase();
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
    if (n.wurzel === 'make') punkte += 8;      // Obsidian ist Nummer eins (Kevin, 24.09.)
    const tage = (Date.now() - Date.parse(n.geaendert)) / 864e5;
    if (tage < 2) punkte += 6; else if (tage < 14) punkte += 3; else if (tage > 120) punkte -= 2;
    roh.push({ id: n.id, titel: n.titel, wurzel: n.wurzel, bereich: n.bereich, scope: n.scope, stand: n.stand, punkte, ueberschriften: n.ueberschriften.slice(0, 5), geaendert: n.geaendert, ausschnitt: '', text });
  }
  roh.sort((a, c) => c.punkte - a.punkte);
  const treffer = roh.slice(0, anzahl).map(t => {
    const { rumpf } = leseKopf(t.text);
    const klein = rumpf.toLowerCase();
    const stelle = begriffe.map(w => klein.indexOf(w)).filter(i => i >= 0).sort((a, c) => a - c)[0] ?? 0;
    const von = Math.max(0, stelle - 220);
    const { text: _t, ...rest } = t;
    return { ...rest, ausschnitt: (von > 0 ? '… ' : '') + rumpf.slice(von, von + 700).replace(/\s+/g, ' ').trim() + ' …' };
  });
  return { treffer, durchsucht: sichtbar.length };
}

/** Die zuletzt geänderten Notizen, die die Sicht erlaubt — für die Wissen-Seite ohne Suchbegriff. */
export async function neueste(sicht: Sicht, anzahl = 30, bereich?: string): Promise<Omit<Notiz, 'pfad'>[]> {
  const b = await bestand();
  return b.notizen
    .filter(n => darfSehen(n, sicht) && (!bereich || n.bereich === bereich))
    .sort((a, c) => c.geaendert.localeCompare(a.geaendert))
    .slice(0, anzahl)
    .map(({ pfad: _p, ...rest }) => rest);
}

export interface NotizVoll {
  ok: boolean; fehler?: string;
  id?: string; titel?: string; pfad?: string; text?: string; oben?: string;
  wurzel?: string; bereich?: string; typ?: string; scope?: string; owner?: string; stand?: string; geaendert?: string; obsidian?: string | null;
}

/** Eine Notiz ganz lesen. Der Pfad wird gegen den Bestand geprüft — von außen
 *  gereichte Pfade führen so nie an Ausschlüssen oder der Sicht vorbei. */
export async function notiz(id: string, maxZeichen = 12_000, sicht: Sicht = AGENT): Promise<NotizVoll> {
  const b = await bestand();
  const n = finde(b, id, sicht);
  if (!n) return { ok: false, fehler: `Keine Notiz „${id}" — oder nicht freigegeben.` };
  try {
    const text = await readFile(n.pfad, 'utf8');
    const { rumpf } = leseKopf(text);
    return {
      ok: true, id: n.id, titel: n.titel, pfad: n.id, text: rumpf.slice(0, maxZeichen),
      // AGENTS.md §4.1: „Update-Block oben“ gilt für Wissensnotizen. Protokolle und
      // Logs wachsen nach unten — dort wäre der oberste Block der älteste.
      oben: n.typ === 'protokoll' ? '' : obersterBlock(rumpf),
      wurzel: n.wurzel, bereich: n.bereich, typ: n.typ, scope: n.scope, owner: n.owner, stand: n.stand, geaendert: n.geaendert, obsidian: obsidianLink(n),
    };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht lesbar' };
  }
}

// ── Jarvis' Anweisung aus dem Brain ─────────────────────────────────────────
// AGENTS.md §5: „Identität aus 00_JARVIS_AGENT". Dazu die Vertraulichkeits-
// regeln, weil sie für jede Antwort gelten. Eine Minute zwischengespeichert.

let anweisungSpeicher: { zeit: number; text: string } | null = null;
export async function brainAnweisung(): Promise<string> {
  if (anweisungSpeicher && Date.now() - anweisungSpeicher.zeit < 60_000) return anweisungSpeicher.text;
  const teile: string[] = [];
  for (const [name, max] of [['00_JARVIS_AGENT', 7000], ['Vertraulichkeitsregeln', 4500]] as const) {
    const d = await notiz(name, max, { person: 'kevin' });
    if (d.ok && d.wurzel === 'make' && d.text) teile.push(`── ${name} (${d.pfad}${d.stand ? `, Stand ${d.stand}` : ''}) ──\n${d.text.trim()}`);
  }
  const text = teile.length ? teile.join('\n\n') : '';
  anweisungSpeicher = { zeit: Date.now(), text };
  return text;
}

// ── Schreiben (AGENTS.md §4.2) ──────────────────────────────────────────────
// Kevin am 06.09.: „er soll das Gehirn selber nutzen, bearbeiten und auch
// beschreiben." Nach den Regeln des Vaults: anhängen an drei Notizen, neue
// Notizen nur als Protokoll. Ein Agent, der eine gewachsene Notiz ersetzen
// kann, ist ein Agent, der sie verlieren kann.

export const SCHREIBBAR = ['Offene_Fragen_Brain', 'Taskmanagement_Brain', 'Jarvis_Log'] as const;
const PROTOKOLL_ORDNER = join('03. Protokolle', 'Protokolle');

const zwei = (n: number) => String(n).padStart(2, '0');
const heuteISO = () => { const d = new Date(); return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`; };
const heuteDE = () => { const d = new Date(); return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`; };
const sauber = (name: string) => name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);
const wer = (p?: string) => (p && /^[a-z0-9-]+$/.test(p) ? p : 'kevin');

/**
 * Neue Notiz = neues Protokoll im Brain: `03. Protokolle/Protokolle/JJJJ-MM-TT Titel.md`
 * mit Kopf nach AGENTS.md §3. Gibt es das Protokoll heute schon, wird ein
 * Nachtrag angehängt — nie überschrieben.
 */
export async function legeAn(titel: string, text: string, opt: { person?: string; scope?: 'intern' | 'privat' } = {}):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  const name = sauber(titel);
  if (!name) return { ok: false, fehler: 'Kein Titel.' };
  if (!text.trim()) return { ok: false, fehler: 'Kein Inhalt.' };
  const person = wer(opt.person);
  const ziel = join(BRAIN, PROTOKOLL_ORDNER, `${heuteISO()} ${name}.md`);
  try {
    await access(BRAIN);
    await mkdir(dirname(ziel), { recursive: true });
    let da = true;
    try { await access(ziel); } catch { da = false; }
    if (da) await appendFile(ziel, `\n\n## Nachtrag ${heuteDE()}\n\n${text.trim()}\n`, 'utf8');
    else {
      const kopf = `---\ntype: protokoll\nscope: ${opt.scope === 'privat' ? 'privat' : 'intern'}\nowner: ${person}\nstand: ${heuteISO()}\ntags: [protokoll, jarvis]\n---\n\n# ${name}\n\n*${heuteDE()} · festgehalten von Jarvis für ${person}*\n\n`;
      await writeFile(ziel, `${kopf}${text.trim()}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    zwischenspeicher = null;
    return { ok: true, pfad: `make/${relative(dirname(BRAIN), ziel).split(sep).join('/')}` };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}

/** Anhängen — nur an die drei Notizen, die der Vault dafür vorsieht, als datierter 🔴-Block. */
export async function haengeAn(id: string, text: string, opt: { titel?: string; person?: string } = {}):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  if (!text.trim()) return { ok: false, fehler: 'Kein Inhalt.' };
  const b = await bestand();
  const n = finde(b, id, { person: wer(opt.person) });
  if (!n || n.wurzel !== 'make' || !(SCHREIBBAR as readonly string[]).includes(n.titel)) {
    return { ok: false, fehler: `Anhängen geht nur an ${SCHREIBBAR.join(', ')} (Regel aus AGENTS.md §4). Für Neues ein Protokoll anlegen.` };
  }
  const titel = sauber(opt.titel || text.trim().split('\n')[0].replace(/^[#>*\-\s]+/, '')).slice(0, 80) || 'Eintrag';
  try {
    await appendFile(n.pfad, `\n\n## 🔴 UPDATE ${heuteDE()} · Jarvis für ${wer(opt.person)} — ${titel}\n\n${text.trim()}\n`, 'utf8');
    zwischenspeicher = null;
    return { ok: true, pfad: n.id };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}

// ─── Notizen, die Jarvis selbst besitzt ─────────────────────────────────────
// Die Übersichten über die Software (Selbstbild) müssen aktuell sein, nicht
// länger werden. Sie liegen in der MAKE-OS-Doku im iCloud-Vault, nicht im
// Brain — dort darf Software nichts überschreiben. Drei Bedingungen zugleich:
// fester Unterordner, Marke in Zeile 1, Ordner und Marke von außen nicht setzbar.

/** Steht in Zeile 1 jeder von Jarvis erzeugten Notiz. */
export const MARKE = '<!-- von Jarvis erzeugt — wird überschrieben, hier nichts von Hand eintragen -->';
const EIGENER_ORDNER = '05 Wissen/MAKE OS';

export async function schreibeEigene(name: string, text: string):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  const datei = sauber(name);
  if (!datei) return { ok: false, fehler: 'Kein Name.' };
  const ziel = join(ICLOUD, EIGENER_ORDNER, `${datei}.md`);
  try {
    let alt = '';
    try { alt = await readFile(ziel, 'utf8'); } catch { /* neu, das ist in Ordnung */ }
    if (alt && !alt.startsWith(MARKE)) return { ok: false, fehler: `„${datei}" trägt nicht Jarvis' Marke — nicht angefasst.` };
    await mkdir(dirname(ziel), { recursive: true });
    const stempel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    await writeFile(ziel, `${MARKE}\n<!-- Stand ${stempel} -->\n\n${text.trim()}\n`, 'utf8');
    zwischenspeicher = null;
    return { ok: true, pfad: `${EIGENER_ORDNER}/${datei}.md` };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}
