// ─── MAKE OS — Das Gehirn: der Obsidian-Vault der Instanz ───────────────────
// 24.09.: „Obsidian soll Nummer eins Wissensbank sein."
//
// Nummer eins ist das kuratierte Brain im Obsidian-Vault der Instanz
// (MAKE_VAULT_DIR; am Mac ohne Variable der gewohnte Ort). Dessen eigene
// Regeln stehen in AGENTS.md und 00. Fundament/Vertraulichkeits-
// regeln.md — diese Datei setzt sie um, wie sie die Cowork-Sitzung vom 06.09.
// schon einmal gebaut hatte (lib/store/vault.ts in der alten Kopie):
//   • LESEN nur das Brain, ohne _Archiv, _Vorlagen, Kopien und Exporte —
//     und ohne das, was in Obsidian selbst ausgeblendet ist
//     (.obsidian/app.json › userIgnoreFilters) — und ohne die eigenen Ordner der
//     anderen Personen des Haushalts (`istPrivat`, Ordner-Regel aus den Konten).
//   • SEHEN nach `scope` (AGENTS.md §3), EINE Stelle `darfSehen` (09.10.: Personen aus den Konten, nie feste Namen):
//     `privat` nur für die Eigentümerin/den Eigentümer (`owner`, ohne Angabe: der Haupt-Inhaber) — seit 29.09.
//     SYMMETRISCH, auch Inhaber sehen fremde private Notizen nie (Paket D-B #92) · sonst volle Mitglieder des Haushalts
//     der Inhaber alles · andere nur familie/oeffentlich · Agenten/Systemläufe nie `privat` (ohne Person: Sicht des Haushalts).
//   • SCHREIBEN (AGENTS.md §4.2): anhängen nur an Offene_Fragen_Brain,
//     Taskmanagement_Brain, Zoe_Log; neu anlegen nur Protokolle.
//     Überschreiben oder Löschen gibt es nicht.
// Zweite Quelle, nachrangig: die MAKE-OS-Doku im iCloud-Vault (Weg, Bau, Plan).
//
// Bewusst keine Vektor-Datenbank: bei einigen hundert Notizen schlägt
// Volltextsuche mit gutem Ranking jede RAG-Maschinerie — weniger Teile,
// nichts zu indexieren, immer aktuell.

import { readdir, readFile, stat, appendFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, basename, relative, sep, dirname } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readdirSync } from 'node:fs';
import { KERN_EINHEITEN, BEREICH_JE_EINHEIT } from '@/lib/einheiten';
import { createHash } from 'node:crypto';
import { ladeKonten } from '@/lib/zugang/konten';
import { hauptInhaber, kontenImHaushaltDerInhaber, type InhaberStand } from '@/lib/zugang/inhaber';
import { kontoSichtAus } from '@/lib/zugang/konto-sicht';

const HEIM = homedir();
const ausHeim = (p: string) => p.replace(/^~(?=$|\/)/, HEIM);

/**
 * Das Brain — Nummer eins. Ohne MAKE_VAULT_DIR: am Mac zuerst der neue Ort außerhalb von iCloud (`~/Vaults/MAKE`,
 * VAULT_UMZUG_ANLEITUNG.md, 29.09.), sonst der alte auf dem Schreibtisch. Nur gelesen — schreiben darf die App dort nie
 * (lib/brain/vault-ziel.ts).
 */
const MAC_VAULT_NEU = join(HEIM, 'Vaults', 'MAKE', 'Make.Claude');
export const BRAIN = process.env.MAKE_VAULT_DIR?.trim() ? ausHeim(process.env.MAKE_VAULT_DIR.trim()) : existsSync(MAC_VAULT_NEU) ? MAC_VAULT_NEU : join(HEIM, 'Desktop', 'MAKE', 'Make.Claude');
/**
 * Die Doku der Software (Obsidian-Ordner mit Karte, Entscheidungen und den Selbstbild-Notizen von ZOE). Ort aus
 * `MAKE_OS_DOKU_WURZEL` (Pfad; „aus“ = keine Doku-Wurzel, so in Tests und Demo). Ohne Variable am Mac: der erste Ordner
 * „MAKE OS“ auf oberster Ebene eines Ordners im iCloud Drive — 09.10.: kein privater Ordnername mehr im Code. Auf dem Server
 * gibt es den Ort nicht (keine Doku-Wurzel).
 */
function dokuWurzel(): string | null {
  const v = process.env.MAKE_OS_DOKU_WURZEL?.trim();
  if (v === 'aus') return null;
  if (v) return ausHeim(v);
  const drive = join(HEIM, 'Library/Mobile Documents/com~apple~CloudDocs');
  try {
    for (const n of readdirSync(drive).sort()) { const p = join(drive, n, 'MAKE OS'); if (existsSync(p)) return p; }
  } catch { /* kein iCloud Drive (Server, Linux) */ }
  return null;
}
const DOKU = dokuWurzel();
/** Gibt es eine Doku-Wurzel (iCloud „MAKE OS“ bzw. MAKE_OS_DOKU_WURZEL)? Ohne sie hat das Selbstbild keinen Ort (Server, Demo). */
export const dokuWurzelEingerichtet = (): boolean => DOKU !== null;

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
  // Tests und Proben mit eigenem Vault (MAKE_OS_DOKU_WURZEL=aus) lesen die Doku nicht mit (27.09.).
  ...(DOKU ? [{ id: 'makeos', name: 'MAKE OS · Doku', pfad: DOKU, vault: DOKU, obsidian: basename(DOKU) }] : []),
];

/** Technischer Ballast — nichts davon ist Wissen. */
const TECHNIK = new Set(['node_modules', '.git', '.next', '_build', 'dist', '.obsidian', '.claude', 'build', 'scripts']);
/** Aus AGENTS.md §5: Archiv, Vorlagen, Kopien und Exporte sind keine Quellen. */
// _inbox (27.09.): Vorschläge von ZOE sind kein Wissen, bis jemand sie annimmt (lib/brain/inbox.ts).
// _App (29.09.): der generierte Spiegel der App (lib/brain/app-spiegel.ts) — gesucht wird er über `app_chunks`
// (lib/brain/app-index.ts, mit Haushalts-Sicht); im Vault-Index stünde er doppelt.
const AUSGESCHLOSSEN = ['_Archiv', '_Vorlagen', '_to_delete', '_inbox', '_App', 'MakeOS-Blueprint', 'OneDrive_Export', 'KEMA_Brain Kopie'];
export const istAusgeschlossen = (name: string) => TECHNIK.has(name) || AUSGESCHLOSSEN.some(a => name.startsWith(a));

// ── Personen der Instanz (09.10., Plattform-Regel „nichts Persönliches fest einbauen“) ─────────────────────────────
// Wer im Vault was sieht, hängt an den KONTEN der Instanz — nie an festen Namen. EINE Stelle für Sicht und Ordner-Regel:
//   • Eigentümer des Vaults = der Haupt-Inhaber (lib/zugang/inhaber.ts `hauptInhaber`): Rückfall für Notizen ohne `owner`.
//   • Haushalt = die vollen Mitglieder des Haushalts der Inhaber (Konten im Haushalt, ohne „nur Business“ — wie die privaten
//     Finanzen und der Nordstern); der Haupt-Inhaber gehört immer dazu.
// Altbestand bleibt gültig: `owner`, `gilt_fuer` und `privat-<x>` tragen Speichernamen (Kennungen) — nichts wird umgeschrieben.

const SPEICHERNAME = /^[a-z0-9-]{1,40}$/;
/** Ist das ein gültiger Speichername (Kennung eines Kontos)? */
export const istSpeichername = (p: unknown): p is string => typeof p === 'string' && SPEICHERNAME.test(p);

/** Was die Vault-Sicht aus den Konten braucht — rein, aus `vaultPersonenAus`. */
export interface VaultPersonen {
  /** Speichername des Haupt-Inhabers (Eigentümer des Vaults) — oder null ohne Konten. */
  eigentuemer: string | null;
  /** Speichernamen der vollen Haushaltsmitglieder (Haupt-Inhaber zuerst, dann Reihenfolge der Konten). */
  haushalt: string[];
  /** Anzeigename (Vorname aus dem Konto) je Speichername des Haushalts. */
  namen: Record<string, string>;
}

const vorname = (roh: unknown): string => String(roh ?? '').replace(/[\u0000-\u001f<>{}`]/g, ' ').trim().split(/\s+/)[0]?.slice(0, 40) ?? '';

/** Die Personen der Vault-Sicht aus einem Konten-Stand (rein). */
export function vaultPersonenAus(st: InhaberStand): VaultPersonen {
  const haupt = hauptInhaber(st);
  // „nur Business“ über die EINE Konto-Sicht (09.10., E4, lib/zugang/konto-sicht.ts).
  const voll = kontenImHaushaltDerInhaber(st).filter(k => k.speicher === haupt?.speicher || !kontoSichtAus(st, k.speicher).nurBusiness);
  const reihe = haupt ? [haupt, ...voll.filter(k => k.speicher !== haupt.speicher)] : voll;
  return {
    eigentuemer: haupt?.speicher ?? null,
    haushalt: reihe.map(k => k.speicher),
    namen: Object.fromEntries(reihe.map(k => [k.speicher, vorname(k.name) || k.speicher])),
  };
}

/** Die Personen der Vault-Sicht aus den Konten der Instanz. Unlesbare Konten werfen (fail-closed — nie „alle“). */
export async function vaultPersonen(): Promise<VaultPersonen> {
  return vaultPersonenAus(await ladeKonten());
}

/**
 * Ordner, die gar nicht erst geöffnet werden (06.09.: die eigenen Ordner der zweiten Person bleiben draußen — Ausschluss, nicht
 * Erlaubnis; nur das gemeinsame Brain kommt herein). Seit 09.10. aus den Konten: ein Ordner, der eine ANDERE Person des
 * Haushalts nennt (Speichername oder Vorname), ist ihrer — außer er nennt sie zusammen mit dem Eigentümer des Vaults in der
 * Form „<andere> & <Eigentümer>“ bzw. „<andere>_<Eigentümer>_Brain“ (dieselben zwei Muster wie bisher). Namen ab vier Zeichen
 * gelten als Wortteil (wie bisher), kürzere nur als ganzes Wort (sonst fiele „Projekte“ unter „jo“).
 */
export interface OrdnerRegel { eigentuemer: string[]; andere: string[] }

const marke = (t: string) => t.toLowerCase().normalize('NFC');
const ALS_MARKE = /^[a-z0-9äöüß][a-z0-9äöüß-]+$/;
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Die Ordner-Regel aus den Personen (rein). Ohne Eigentümer: keine Regel. */
export function ordnerRegel(p: VaultPersonen): OrdnerRegel {
  const marken = (sp: string) => Array.from(new Set([marke(sp), marke(p.namen[sp] ?? '')].filter(m => ALS_MARKE.test(m))));
  if (!p.eigentuemer) return { eigentuemer: [], andere: [] };
  const eigen = marken(p.eigentuemer);
  return { eigentuemer: eigen, andere: Array.from(new Set(p.haushalt.filter(sp => sp !== p.eigentuemer).flatMap(marken))).filter(m => !eigen.includes(m)) };
}

const nennt = (klein: string, m: string) => (m.length >= 4 ? klein.includes(m) : new RegExp(`(^|[^a-z0-9äöüß])${esc(m)}([^a-z0-9äöüß]|$)`).test(klein));

/** Gehört der Ordner (bzw. die Datei) einer anderen Person des Haushalts? Dann wird er nicht geöffnet. Rein. */
export function istPrivat(segment: string, regel: OrdnerRegel): boolean {
  const klein = marke(segment);
  return regel.andere.some(a => {
    if (!nennt(klein, a)) return false;
    const roh = segment.normalize('NFC');
    const gemeinsam = regel.eigentuemer.some(e => new RegExp(`${esc(a)}[_\\s]*(&|und)?[_\\s]*${esc(e)}[_\\s]*brain`, 'i').test(roh)
      || new RegExp(`${esc(a)}\\s*(&|und)\\s*${esc(e)}`, 'i').test(roh));
    return !gemeinsam;
  });
}

// ── Kopf einer Notiz ────────────────────────────────────────────────────────

export interface Kopf { typ?: string; scope?: string; owner?: string; stand?: string; tags: string[]; /** alle Felder roh (Regeln, Vorschläge, Provenienz — 27.09.) */ felder: Record<string, string | string[]> }

/** Warnungen des Kopf-Parsers (29.09.): was er nicht versteht, wird abgelehnt — nie still falsch gelesen. */
export interface KopfWarnung { feld: string; grund: string }

/**
 * YAML-Kopf, die Untermenge „key: value", „key: [a, b]" und (seit 29.09., Paket D-B #100) mehrzeilige Listen
 * („key:" + Zeilen „  - a") — ohne Zusatzpaket. Anderes Verschachteltes (eingerückte Schlüssel, Blocktext mit | oder >)
 * wird NICHT geraten: das Feld fällt weg und steht in `warnungen`.
 */
export function leseKopf(text: string): { kopf: Kopf; rumpf: string; warnungen?: KopfWarnung[] } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { kopf: { tags: [], felder: {} }, rumpf: text };
  const roh: Record<string, string | string[]> = {};
  const warnungen: KopfWarnung[] = [];
  const zeilen = m[1].split(/\r?\n/);
  for (let i = 0; i < zeilen.length; i++) {
    const kv = zeilen[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const wert = kv[2].trim();
    if (wert === '' || wert === '|' || wert === '>' || wert === '|-' || wert === '>-') {
      // Eingerückte Folgezeilen einsammeln.
      const folge: string[] = [];
      while (i + 1 < zeilen.length && /^\s+\S/.test(zeilen[i + 1])) folge.push(zeilen[++i]);
      if (!folge.length) { roh[kv[1]] = ''; continue; }
      if (wert === '' && folge.every(z => /^\s+-\s+/.test(z))) {
        roh[kv[1]] = folge.map(z => z.replace(/^\s+-\s+/, '').trim().replace(/^["'#]|["']$/g, '')).filter(Boolean);
        continue;
      }
      warnungen.push({ feld: kv[1], grund: wert ? 'Blocktext (| oder >) wird nicht gelesen' : 'verschachtelter Wert wird nicht gelesen' });
      continue;
    }
    roh[kv[1]] = wert.startsWith('[') && wert.endsWith(']')
      ? wert.slice(1, -1).split(',').map(s => s.trim().replace(/^["'#]|["']$/g, '')).filter(Boolean)
      : wert.replace(/^["']|["']$/g, '');
  }
  const s = (k: string) => (typeof roh[k] === 'string' ? (roh[k] as string) : undefined);
  const tags = Array.isArray(roh.tags) ? roh.tags : s('tags') ? s('tags')!.split(/[,\s]+/).filter(Boolean) : [];
  return { kopf: { typ: s('type'), scope: s('scope')?.toLowerCase(), owner: s('owner')?.toLowerCase(), stand: s('stand'), tags: tags.slice(0, 12), felder: roh }, rumpf: text.slice(m[0].length), ...(warnungen.length ? { warnungen } : {}) };
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
// EINE Stelle. Die Sicht kommt roh herein (`Sicht`: Person + ob ein Agent/Hintergrundlauf fragt) und wird VOR jeder Prüfung
// aus den Konten aufgelöst (`sichtAus`/`sichtAufloesen` → `VaultSicht`); `darfSehen` selbst ist rein und nimmt nur die
// aufgelöste Sicht — so kann kein Lesepfad die Konten „vergessen“. Gilt vor dem Ranking (Suche, Index, Kugel, Regeln, Inbox).

/** Wer fragt: Speichername der Person; `agent` = Hintergrundlauf/Agent (sieht nie `privat`). */
export interface Sicht { person: string; agent?: boolean }
/** Aus den Konten aufgelöst: gehört die Person zum Haushalt (bzw. Systemlauf ohne Person), wem gehört der Vault. */
export interface VaultSicht extends Sicht { haushalt: boolean; eigentuemer: string | null }
/** Ohne Person (Hintergrundlauf eines Agenten): Sicht des Haushalts — `intern` ja, nie Privates. */
export const AGENT: Sicht = { person: '', agent: true };

/** Schon aufgelöst? */
export const istAufgeloest = (s: Sicht | VaultSicht): s is VaultSicht => typeof (s as VaultSicht).haushalt === 'boolean' && 'eigentuemer' in s;

/**
 * Die Sicht aus den Personen der Instanz auflösen (rein). Ein Speichername → Haushalt nach den Konten; ohne Person (`''`)
 * mit `agent` = Systemlauf (`AGENT`) → Sicht des Haushalts; eine ungültige Angabe → keine Person, kein Haushalt (fail-closed).
 */
export function sichtAus(s: Sicht, p: VaultPersonen): VaultSicht {
  const gueltig = istSpeichername(s.person);
  const person = gueltig ? s.person : '';
  const haushalt = gueltig ? p.haushalt.includes(person) : !!s.agent && s.person === '';
  return { person, ...(s.agent ? { agent: true } : {}), haushalt, eigentuemer: p.eigentuemer };
}

/** Wie `sichtAus`, lädt die Konten selbst (eine schon aufgelöste Sicht bleibt, wie sie ist). */
export async function sichtAufloesen(s: Sicht | VaultSicht): Promise<VaultSicht> {
  return istAufgeloest(s) ? s : sichtAus(s, await vaultPersonen());
}

/** Darf diese (aufgelöste) Sicht die Notiz sehen? Rein. */
export function darfSehen(n: { scope?: string; owner?: string }, s: VaultSicht): boolean {
  const scope = n.scope || 'intern';           // ohne Kennzeichnung mindestens intern
  if (s.agent && scope === 'privat') return false;
  // Symmetrisch (29.09., #92): Privates sieht NUR, wem es gehört — auch kein Inhaber fremdes. Ohne owner: der Vault-Eigentümer.
  if (scope === 'privat') return !!s.person && (n.owner || s.eigentuemer) === s.person;
  if (s.haushalt) return true;
  return scope === 'familie' || scope === 'oeffentlich';
}

/** Grober Bereich aus dem Ordner — für Filter und Anzeige. */
export function bereichVon(id: string): string {
  if (id.startsWith('makeos/')) return 'MAKE OS';
  const teil = id.split('/')[2] ?? '';
  if (/^00\./.test(teil)) return 'Fundament';
  // Ordner, die eine Business-Gesellschaft der Instanz nennen (Namen aus lib/einheiten.ts — 09.10.: kein Firmenname im Code).
  if (KERN_EINHEITEN.some(e => BEREICH_JE_EINHEIT[e.id] === 'business' && teil.toLocaleLowerCase('de-DE').includes(e.label.toLocaleLowerCase('de-DE')))) return 'Business';
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
 * gelesen. Was ZOE selbst schreibt, leert den Speicher sofort; eine Notiz,
 * die gerade in Obsidian entsteht, ist bis zu fünf Minuten unsichtbar.
 */
let zwischenspeicher: { bestand: Bestand; zeit: number } | null = null;
/** Nach eigenen Schreibungen (Regeln, Inbox): Bestand beim nächsten Lesen neu einlesen. */
export function bestandVergessen(): void { zwischenspeicher = null; }
const FRISCH_MS = 5 * 60_000;

/** Was in Obsidian unter „Ausgeschlossene Dateien" eingetragen ist. */
async function obsidianFilter(vault: string): Promise<string[]> {
  try {
    const app = JSON.parse(await readFile(join(vault, '.obsidian', 'app.json'), 'utf8')) as { userIgnoreFilters?: unknown };
    return Array.isArray(app.userIgnoreFilters) ? app.userIgnoreFilters.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

async function sammle(w: Wurzel, treffer: Omit<Notiz, 'bereich' | 'stichworte' | 'ueberschriften' | 'verweise'>[], zaehler: { privat: number }, regel: OrdnerRegel): Promise<void> {
  const filter = await obsidianFilter(w.vault);
  const blendetAus = (rel: string) => filter.some(f => rel === f || rel.startsWith(f) || `${rel}/`.startsWith(f));
  async function lauf(ordner: string, tiefe: number): Promise<void> {
    if (tiefe > 8) return;
    let eintraege;
    try { eintraege = await readdir(ordner, { withFileTypes: true }); } catch { return; }
    for (const e of eintraege) {
      if (e.name.startsWith('.')) continue;
      if (istAusgeschlossen(e.name)) continue;
      if (istPrivat(e.name, regel)) { zaehler.privat++; continue; }
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
  // Ordner-Regel aus den Konten — unlesbare Konten werfen hier (fail-closed: lieber keine Notizen als fremde Ordner).
  const regel = ordnerRegel(await vaultPersonen());
  for (const w of WURZELN) await sammle(w, roh, zaehler, regel);

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
function finde(b: Bestand, id: string, sicht: VaultSicht): Notiz | undefined {
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
export async function suche(frage: string, anzahl = 6, sicht: Sicht | VaultSicht = AGENT, bereich?: string): Promise<{ treffer: Treffer[]; durchsucht: number }> {
  // Die Sicht wird EINMAL aus den Konten aufgelöst — vor dem Ranking (09.10.). Unlesbare Konten werfen (fail-closed).
  const s = await sichtAufloesen(sicht);
  // Brain-Index (27.09.): steht der FTS5-Index bereit, sucht er — über Abschnitte, mit Sicht vor dem Ranking.
  // Sonst (erster Start, Index veraltet, Fehler) die bisherige Volltextsuche über alle Dateien.
  if (process.env.MAKE_OS_BRAIN_INDEX !== 'aus') {
    try {
      const ix = await import('@/lib/brain/index');
      if (ix.indexBereit()) { const r = await ix.hybridSuche(frage, anzahl, s, bereich); return { treffer: r.treffer, durchsucht: r.durchsucht }; }
    } catch { /* Rückfall unten */ }
  }
  return sucheOhneIndex(frage, anzahl, s, bereich);
}

/** Die Suche ohne Index — liest jede sichtbare Notiz (Rückfall und Vergleichsmaßstab). */
export async function sucheOhneIndex(frage: string, anzahl = 6, sichtRoh: Sicht | VaultSicht = AGENT, bereich?: string): Promise<{ treffer: Treffer[]; durchsucht: number }> {
  const sicht = await sichtAufloesen(sichtRoh);
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
    if (n.wurzel === 'make') punkte += 8;      // Obsidian ist Nummer eins (24.09.)
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
export async function neueste(sichtRoh: Sicht | VaultSicht, anzahl = 30, bereich?: string): Promise<Omit<Notiz, 'pfad'>[]> {
  const sicht = await sichtAufloesen(sichtRoh);
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

/**
 * Zu lange Notizen kürzen, ohne das Wichtige abzuschneiden. Wissensnotizen
 * tragen den gültigen Stand oben — dort zählt der Anfang. Protokolle und Logs
 * wachsen nach unten — dort zählt das Ende (gefunden 24.09.: das Brain nannte
 * einen Eintrag vom 07.09. als neuesten, weil nur der Anfang des Logs ankam).
 */
export function gekuerzt(rumpf: string, max: number, waechstNachUnten: boolean): string {
  if (rumpf.length <= max) return rumpf;
  if (!waechstNachUnten) return `${rumpf.slice(0, max)}\n\n[… gekürzt: ${rumpf.length - max} Zeichen weiter unten nicht mitgegeben]`;
  const kopf = Math.min(1500, Math.floor(max * 0.2));
  return `${rumpf.slice(0, kopf)}\n\n[… gekürzt: ${rumpf.length - max} Zeichen ältere Einträge ausgelassen — unten stehen die neuesten …]\n\n${rumpf.slice(rumpf.length - (max - kopf))}`;
}

/** Eine Notiz ganz lesen. Der Pfad wird gegen den Bestand geprüft — von außen
 *  gereichte Pfade führen so nie an Ausschlüssen oder der Sicht vorbei. */
export async function notiz(id: string, maxZeichen = 12_000, sichtRoh: Sicht | VaultSicht = AGENT): Promise<NotizVoll> {
  const sicht = await sichtAufloesen(sichtRoh);
  const b = await bestand();
  const n = finde(b, id, sicht);
  if (!n) return { ok: false, fehler: `Keine Notiz „${id}" — oder nicht freigegeben.` };
  try {
    const text = await readFile(n.pfad, 'utf8');
    const { rumpf } = leseKopf(text);
    return {
      ok: true, id: n.id, titel: n.titel, pfad: n.id, text: gekuerzt(rumpf, maxZeichen, n.typ === 'protokoll'),
      // AGENTS.md §4.1: „Update-Block oben“ gilt für Wissensnotizen. Protokolle und
      // Logs wachsen nach unten — dort wäre der oberste Block der älteste.
      oben: n.typ === 'protokoll' ? '' : obersterBlock(rumpf),
      wurzel: n.wurzel, bereich: n.bereich, typ: n.typ, scope: n.scope, owner: n.owner, stand: n.stand, geaendert: n.geaendert, obsidian: obsidianLink(n),
    };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht lesbar' };
  }
}

// ── ZOE' Anweisung aus dem Brain ─────────────────────────────────────────
// AGENTS.md §5: „Identität aus 00_ZOE_AGENT". Dazu die Vertraulichkeits-
// regeln, weil sie für jede Antwort gelten. Eine Minute zwischengespeichert.

const anweisungSpeicher = new Map<string, { zeit: number; text: string }>();
/**
 * Identität, Vertraulichkeitsregeln — und seit 27.09. Konstitution + aktive Regeln für diese Person (lib/brain/regeln.ts).
 * Die zwei Grundnotizen gelten für jede Person der Instanz: gelesen mit der Sicht des Haushalts (`AGENT` — `intern` ja, nie
 * `privat`; 09.10., vorher als feste Person). Ohne gültige Person nur die Regeln für alle.
 */
export async function brainAnweisung(person: string): Promise<string> {
  const p = istSpeichername(person) ? person : '';
  const alt = anweisungSpeicher.get(p);
  if (alt && Date.now() - alt.zeit < 60_000) return alt.text;
  const teile: string[] = [];
  for (const [name, max] of [['00_ZOE_AGENT', 7000], ['Vertraulichkeitsregeln', 4500]] as const) {
    const d = await notiz(name, max, AGENT);
    if (d.ok && d.wurzel === 'make' && d.text) teile.push(`── ${name} (${d.pfad}${d.stand ? `, Stand ${d.stand}` : ''}) ──\n${d.text.trim()}`);
  }
  try { const { regelnFuerPrompt } = await import('@/lib/brain/regeln'); const r = await regelnFuerPrompt(p); if (r) teile.push(r); } catch { /* ohne Regeln weiter */ }
  const text = teile.length ? teile.join('\n\n') : '';
  anweisungSpeicher.set(p, { zeit: Date.now(), text });
  return text;
}

// ── Schreiben (AGENTS.md §4.2) ──────────────────────────────────────────────
// 06.09.: „er soll das Gehirn selber nutzen, bearbeiten und auch
// beschreiben." Nach den Regeln des Vaults: anhängen an drei Notizen, neue
// Notizen nur als Protokoll. Ein Agent, der eine gewachsene Notiz ersetzen
// kann, ist ein Agent, der sie verlieren kann.

export const SCHREIBBAR = ['Offene_Fragen_Brain', 'Taskmanagement_Brain', 'Zoe_Log'] as const;
const PROTOKOLL_ORDNER = join('03. Protokolle', 'Protokolle');

const zwei = (n: number) => String(n).padStart(2, '0');
const heuteISO = () => { const d = new Date(); return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`; };
const heuteDE = () => { const d = new Date(); return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`; };
const sauber = (name: string) => name.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100);

/**
 * Für wen geschrieben wird: die Person — ohne Person (Systemlauf) der Vault-Eigentümer, dann aber mit Agenten-Sicht
 * (nie an Privates anhängen). Ohne Konten (kein Eigentümer) und ohne Person: niemand → nicht schreiben.
 */
async function schreibSicht(person?: string): Promise<VaultSicht | null> {
  const p = await vaultPersonen();
  if (istSpeichername(person)) return sichtAus({ person }, p);
  return p.eigentuemer ? sichtAus({ person: p.eigentuemer, agent: true }, p) : null;
}

/**
 * Darf an ein vorhandenes Protokoll (Kopf `k`) angehängt werden? Nur wenn die Sicht es sehen darf (`darfSehen`) und — bei
 * einem privaten Nachtrag — nur an das eigene private Protokoll (08.10., Sicht-Prüfung). Rein.
 */
export function anhaengenErlaubt(k: { scope?: string; owner?: string }, s: VaultSicht, scope?: 'intern' | 'privat'): boolean {
  if (!darfSehen(k, s)) return false;
  if (scope === 'privat') return (k.scope || 'intern') === 'privat' && !!s.person && (k.owner || s.eigentuemer) === s.person;
  return true;
}

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
  let ziel = join(BRAIN, PROTOKOLL_ORDNER, `${heuteISO()} ${name}.md`);
  try {
    const sicht = await schreibSicht(opt.person);
    if (!sicht) return { ok: false, fehler: 'Keine Person — ohne Konto der Instanz wird nichts ins Brain geschrieben.' };
    const person = sicht.person;
    await access(BRAIN);
    await mkdir(dirname(ziel), { recursive: true });
    // Sicht-Prüfung 08.10.: angehängt wird nur an ein Protokoll, das die Person sehen darf — und Privates nur an das eigene
    // private. Sonst (fremdes privates Protokoll gleichen Titels, oder privater Text an ein gemeinsames) ein eigenes Protokoll
    // mit Zusatz — vorher landete der Nachtrag in der fremden Datei und der Pfad verriet, dass es sie gibt.
    let da = false;
    for (let n = 1; n <= 9; n++) {
      if (n > 1) ziel = join(BRAIN, PROTOKOLL_ORDNER, `${heuteISO()} ${name} (${n}).md`);
      let alt: string | null = null;
      try { alt = await readFile(ziel, 'utf8'); } catch { /* gibt es nicht — hier wird neu angelegt */ }
      if (alt === null) { da = false; break; }
      if (anhaengenErlaubt(leseKopf(alt).kopf, sicht, opt.scope)) { da = true; break; }
      if (n === 9) return { ok: false, fehler: 'Protokoll mit diesem Titel gibt es heute schon zu oft — bitte anderen Titel wählen.' };
    }
    if (da) await appendFile(ziel, `\n\n## Nachtrag ${heuteDE()}\n\n${text.trim()}\n`, 'utf8');
    else {
      const kopf = `---\ntype: protokoll\nscope: ${opt.scope === 'privat' ? 'privat' : 'intern'}\nowner: ${person}\nstand: ${heuteISO()}\ntags: [protokoll, zoe]\n---\n\n# ${name}\n\n*${heuteDE()} · festgehalten von ZOE für ${person}*\n\n`;
      await writeFile(ziel, `${kopf}${text.trim()}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    zwischenspeicher = null; anweisungSpeicher.clear();
    return { ok: true, pfad: `make/${relative(dirname(BRAIN), ziel).split(sep).join('/')}` };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}

/** Anhängen — nur an die drei Notizen, die der Vault dafür vorsieht, als datierter 🔴-Block. */
export async function haengeAn(id: string, text: string, opt: { titel?: string; person?: string } = {}):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  if (!text.trim()) return { ok: false, fehler: 'Kein Inhalt.' };
  const sicht = await schreibSicht(opt.person);
  if (!sicht) return { ok: false, fehler: 'Keine Person — ohne Konto der Instanz wird nichts ins Brain geschrieben.' };
  const b = await bestand();
  const n = finde(b, id, sicht);
  if (!n || n.wurzel !== 'make' || !(SCHREIBBAR as readonly string[]).includes(n.titel)) {
    return { ok: false, fehler: `Anhängen geht nur an ${SCHREIBBAR.join(', ')} (Regel aus AGENTS.md §4). Für Neues ein Protokoll anlegen.` };
  }
  const titel = sauber(opt.titel || text.trim().split('\n')[0].replace(/^[#>*\-\s]+/, '')).slice(0, 80) || 'Eintrag';
  try {
    await appendFile(n.pfad, `\n\n## 🔴 UPDATE ${heuteDE()} · ZOE für ${sicht.person} — ${titel}\n\n${text.trim()}\n`, 'utf8');
    zwischenspeicher = null;
    return { ok: true, pfad: n.id };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}

// ─── Notizen, die ZOE selbst besitzt ─────────────────────────────────────
// Die Übersichten über die Software (Selbstbild) müssen aktuell sein, nicht
// länger werden. Sie liegen in der MAKE-OS-Doku im iCloud-Vault, nicht im
// Brain — dort darf Software nichts überschreiben. Drei Bedingungen zugleich:
// fester Unterordner, Marke in Zeile 1, Ordner und Marke von außen nicht setzbar.

/** Steht in Zeile 1 jeder von ZOE erzeugten Notiz. */
export const MARKE = '<!-- von ZOE erzeugt — wird überschrieben, hier nichts von Hand eintragen -->';
const EIGENER_ORDNER = '05 Wissen/MAKE OS';

export async function schreibeEigene(name: string, text: string):
  Promise<{ ok: boolean; pfad?: string; fehler?: string }> {
  const datei = sauber(name);
  if (!datei) return { ok: false, fehler: 'Kein Name.' };
  if (!DOKU) return { ok: false, fehler: 'Keine Doku-Wurzel eingerichtet (MAKE_OS_DOKU_WURZEL).' };
  const ziel = join(DOKU, EIGENER_ORDNER, `${datei}.md`);
  try {
    let alt = '';
    try { alt = await readFile(ziel, 'utf8'); } catch { /* neu, das ist in Ordnung */ }
    if (alt && !alt.startsWith(MARKE)) return { ok: false, fehler: `„${datei}" trägt nicht ZOE' Marke — nicht angefasst.` };
    await mkdir(dirname(ziel), { recursive: true });
    const stempel = new Date().toISOString().slice(0, 16).replace('T', ' ');
    await writeFile(ziel, `${MARKE}\n<!-- Stand ${stempel} -->\n\n${text.trim()}\n`, 'utf8');
    zwischenspeicher = null;
    return { ok: true, pfad: `${EIGENER_ORDNER}/${datei}.md` };
  } catch (err) {
    return { ok: false, fehler: err instanceof Error ? err.message.slice(0, 140) : 'nicht schreibbar' };
  }
}
