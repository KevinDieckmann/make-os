// ─── Agenten-Bereich: „Aus dem Brain übernehmen“ — die reinen Regeln (09.10.; Auftrag: „Pack bitte schon die vorgefertigten Bots bei ZOE
// ein — die ganzen Head ofs und alle Mitarbeiter, die wir brauchen. Ich habe keinen Bock, die alle nochmal neu einzutragen, da hatten wir ja
// schon welche.“) ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Ein Ordner im Vault der Instanz beschreibt Agenten als Notizen (je Datei eine Abteilung bzw. ein Mitarbeiter; dazu ein Index). Diese Datei
// liest solche Notizen GENERISCH — nach Kopf (Front-Matter) und Abschnitts-Überschriften, nie nach festen Inhalten — und plant, was daraus in
// MAKE OS wird:
//   • Datei → Head des Katalogs (lib/agenten/katalog.ts) über Kennung, Kurzname, Name und Sprach-Synonyme (`ALIASE`, z. B. „finance“ →
//     Finanzen) — der Kopf `head`/`unter` (+ `type: mitarbeiter`) macht daraus einen Mitarbeiter unter diesem Head. Kein Treffer → übersprungen
//     (in der Vorschau wählbar: anderer Head oder „als Mitarbeiter unter …“). NUR Business-Heads (Kevin 09.10.: „Firma und Privat liegen
//     getrennt — auch in der Datenhaltung“): eine Datei, die zu einem Privat-Head passt, wird übersprungen — Privat-Agenten richtet jede Person
//     selbst ein, nie aus dem Firmen-Brain.
//   • Abschnitte Auftrag/Mission, Darf, Freigabe/Grenzen → EIN Auftrag (`HeadEinstellung.auftrag`, ≤ 4.000 Zeichen — darüber nicht übernommen,
//     nie gekürzt). Er ist Text aus dem Vault: gespeichert mit `auftragQuelle`, im System-Text gekapselt (lib/agenten/auftrag.ts).
//   • Abschnitt Sub-Agenten/Mitarbeiter → je Kürzel: eine Vorlage des Katalogs (vorhanden bzw. einschalten), ein früherer Fach-Agent der Software
//     als eigener Mitarbeiter (nur ausführbare, unter Business nur die ohne private Daten), sonst übersprungen mit Grund.
//   • Abschnitt Wissen → Ordner bzw. Notizen des Brains als Wissen des Heads (Business-Bestand `agenten-wissen--<haushalt>`) — nur, was die
//     Agenten-Sicht sieht (nie `privat`); der erste Absatz zählt (Erklärungen darunter nicht).
// Alles hier ist rein (Tests: tests/agenten-brain-uebernahme.test.ts); gelesen und geschrieben wird nur in lib/agenten/brain-agenten-server.ts
// über die VORHANDENEN Schreibwege (Einstellungen mit Stand/409, Werkstatt). Nichts wird ausgeführt — Text aus dem Vault ist Daten.

import { headDef, KATALOG, vorlagenFuer } from './katalog';
import { auftragHash } from './auftrag';
import { istNotizPfad, pfadName, pfadSaeubern } from './wissen';
import { GRENZEN, type HeadDef, type HeadEinstellung, type HeadWissen, type Mitarbeiter, type ModelTier } from './typen';

// ── Lesen einer Notiz ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Notiz, wie der Server sie liefert: Pfad relativ zum Brain, Kopf (lib/zoe/vault.ts `leseKopf` › felder), Rumpf. */
export interface NotizRoh { pfad: string; felder: Record<string, string | string[]>; rumpf: string }

export type AbschnittRolle = 'auftrag' | 'darf' | 'grenzen' | 'mitarbeiter' | 'wissen' | 'modell';
export interface AgentDatei {
  pfad: string;
  /** Dateiname ohne `.md`. */
  name: string;
  /** Erste Überschrift ohne „Agent ·“ (sonst der Dateiname). */
  titel: string;
  kopf: { typ?: string; abteilung?: string; head?: string; unter?: string; modell?: string; status?: string; stand?: string; scope?: string };
  /** Bereinigte Absätze je Rolle (Wikilinks als Text, ohne Tabellen, ohne Markdown-Zeichen). */
  auftrag: string[];
  darf: string[];
  grenzen: string[];
  /** Kürzel aus dem Abschnitt Sub-Agenten/Mitarbeiter (klein, [a-z0-9-]). */
  mitarbeiter: string[];
  /** Verweise aus dem ersten Absatz des Abschnitts Wissen: Wikilinks (Notiz-Namen) und Ordner („Name/“). */
  wissen: { links: string[]; ordner: string[] };
  /** Überschriften, die nicht übernommen werden (Anzeige „nicht übernommen“). */
  ignoriert: string[];
}

const ROLLEN: readonly [RegExp, AbschnittRolle][] = [
  [/(sub-?agent|unter-?agent|mitarbeiter|^team)/, 'mitarbeiter'],
  [/(freigabe|gate|grenze|verbot|tabu|nie ohne|nicht erlaubt|darf nicht)/, 'grenzen'],
  [/^(mission|auftrag|ziel|zweck|rolle|aufgabe|wofuer)/, 'auftrag'],
  [/^(darf|rechte|erlaubt|befugnis)/, 'darf'],
  [/^(wissen|quellen|kontext|scope)/, 'wissen'],
  [/^(modell)/, 'modell'],
];

/** Kleinschreibung, Umlaute gefaltet (ä → ae …), alles außer Buchstaben/Ziffern → ein Leerzeichen. Rein. */
export function normal(t: string): string {
  return t.normalize('NFC').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const rolleVon = (ueberschrift: string): AbschnittRolle | null => {
  const n = normal(ueberschrift);
  const roh = ueberschrift.toLowerCase();
  for (const [re, r] of ROLLEN) if (re.test(n) || re.test(roh)) return r;
  return null;
};

/** Markdown → schlichter Text: Wikilinks als Name, Links als Text, ohne Tabellen, Kommentare, Hervorhebungen, Zitat-Zeichen. Rein. */
export function klartext(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter(z => !/^\s*\|/.test(z))                                        // Tabellen
    .map(z => z.replace(/^\s*>\s?/, '')                                     // Zitat
      .replace(/^\s*#{1,6}\s+/, '')                                         // Überschrift im Abschnitt
      .replace(/!\[\[[^\]]*\]\]/g, '')                                      // eingebettete Dateien
      .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, '$2')          // [[Ziel|Text]]
      .replace(/\[\[([^\]|#]+)(?:#([^\]|]*))?\]\]/g, (_m, a: string, b?: string) => (b ? `${a.trim()} › ${b.trim()}` : a.trim()))
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                              // [Text](url)
      .replace(/\*\*|__/g, '')
      .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?)]|$)/g, '$1$2')
      .replace(/`/g, '')
      .trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Der erste Absatz (bis zur ersten Leerzeile). Rein. */
const ersterAbsatz = (t: string): string => t.trim().split(/\n\s*\n/)[0] ?? '';

/** Wikilink-Ziele (vor `|` und `#`). Rein. */
export const wikilinks = (t: string): string[] => Array.from(t.matchAll(/\[\[([^\]|#]+)/g)).map(m => m[1].trim()).filter(Boolean);

const KUERZEL = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Kürzel aus einer Aufzählung („a · b, c“ bzw. Listenpunkte). Rein. */
export function kuerzelAus(t: string): string[] {
  const roh = ersterAbsatz(t).replace(/\([^)]*\)/g, ' ').replace(/\[\[([^\]|#]+)[^\]]*\]\]/g, '$1').replace(/[`*]/g, '');
  const teile = roh.split(/[·•,;/\n]|\s[-–]\s|\s+und\s+/).map(x => x.replace(/^\s*[-*+]\s+/, '').trim().toLowerCase());
  return Array.from(new Set(teile.filter(x => KUERZEL.test(x))));
}

const textFeld = (f: Record<string, string | string[]>, k: string): string | undefined => {
  const v = f[k];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() ? s.trim().slice(0, 200) : undefined;
};

/** Eine Agenten-Notiz lesen (rein): Kopf, Titel, Abschnitte nach Rolle. */
export function agentDateiLesen(n: NotizRoh): AgentDatei {
  const name = pfadName(n.pfad);
  const zeilen = n.rumpf.replace(/\r\n?/g, '\n').split('\n');
  let titel = '';
  const abschnitte: { ueberschrift: string; text: string[] }[] = [];
  for (const z of zeilen) {
    const h1 = /^#\s+(.+)$/.exec(z);
    if (h1 && !titel && !abschnitte.length) { titel = h1[1].trim(); continue; }
    const h2 = /^##\s+(.+)$/.exec(z);
    if (h2) { abschnitte.push({ ueberschrift: h2[1].trim(), text: [] }); continue; }
    if (abschnitte.length) abschnitte[abschnitte.length - 1].text.push(z);
  }
  titel = (titel || name).replace(/^(agent|agentin|head|abteilung)\s*[·:—–-]\s*/i, '').trim().slice(0, 120) || name;
  const d: AgentDatei = {
    pfad: n.pfad, name, titel,
    kopf: {
      typ: textFeld(n.felder, 'type')?.toLowerCase(), abteilung: textFeld(n.felder, 'abteilung'), head: textFeld(n.felder, 'head'),
      unter: textFeld(n.felder, 'unter'), modell: textFeld(n.felder, 'modell')?.toLowerCase(), status: textFeld(n.felder, 'status')?.toLowerCase(),
      stand: textFeld(n.felder, 'stand'), scope: textFeld(n.felder, 'scope')?.toLowerCase(),
    },
    auftrag: [], darf: [], grenzen: [], mitarbeiter: [], wissen: { links: [], ordner: [] }, ignoriert: [],
  };
  for (const a of abschnitte) {
    const roh = a.text.join('\n').trim();
    const r = rolleVon(a.ueberschrift);
    if (!r) { if (roh) d.ignoriert.push(klartext(a.ueberschrift).slice(0, 80)); continue; }
    if (r === 'modell') continue; // die Stufe kommt aus dem Kopf (`modell`)
    if (r === 'mitarbeiter') { d.mitarbeiter.push(...kuerzelAus(roh).filter(k => !d.mitarbeiter.includes(k))); continue; }
    if (r === 'wissen') {
      const erster = ersterAbsatz(roh);
      for (const l of wikilinks(erster)) if (!d.wissen.links.includes(l)) d.wissen.links.push(l);
      const ohneLinks = erster.replace(/\[\[[^\]]*\]\]/g, ' ');
      for (const m of Array.from(ohneLinks.matchAll(/(?:^|[\s,(;])([^\s,()[\];]+)\/(?=[\s,).;]|$)/g))) {
        const o = m[1].trim();
        if (o && !d.wissen.ordner.includes(o)) d.wissen.ordner.push(o);
      }
      continue;
    }
    const text = klartext(roh);
    if (text) d[r].push(text);
  }
  return d;
}

/** Index-Notiz (z. B. `_Agenten_Index`): Anzeigename je verlinkter Datei — aus Tabellenzeilen bzw. Listenpunkten mit `[[Datei]]`. Rein. */
export function indexLesen(rumpf: string): Map<string, string> {
  const raus = new Map<string, string>();
  for (const z of rumpf.replace(/\r\n?/g, '\n').split('\n')) {
    const links = wikilinks(z);
    if (!links.length) continue;
    let name = '';
    if (/^\s*\|/.test(z)) {
      const zellen = z.split('|').map(x => x.trim()).filter(Boolean);
      name = zellen.find(x => !x.includes('[[')) ?? '';
    } else {
      const m = /^\s*[-*+]?\s*([^[:]+?)\s*[:—–-]\s*\[\[/.exec(z);
      name = m?.[1] ?? '';
    }
    name = klartext(name).trim();
    if (name && !/^-+$/.test(name)) for (const l of links) if (!raus.has(l.toLowerCase())) raus.set(l.toLowerCase(), name.slice(0, 80));
  }
  return raus;
}

// ── Welcher Head? ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Sprach-Synonyme je Head des Katalogs — nur Bezeichnungen für dieselbe Abteilung (englisch/deutsch, Kürzel), keine Inhalte, keine Firma.
 * Zusammen mit Kennung, Kurzname und Name (ohne „Head of“) die Schlüssel, gegen die eine Datei gelesen wird.
 */
export const ALIASE: Readonly<Record<string, readonly string[]>> = {
  sales: ['vertrieb', 'revenue', 'verkauf'],
  marketing: ['brand', 'marke', 'kommunikation'],
  event: ['events', 'veranstaltungen', 'veranstaltung'],
  finanzen: ['finance', 'finanz', 'cfo', 'buchhaltung'],
  it: ['tech', 'technik', 'cto', 'infrastruktur'],
  operations: ['ops', 'operation', 'coo'],
  kundenerfolg: ['customer success', 'kundenbetreuung', 'account management', 'mandatsbetreuung'],
  strategie: ['strategy', 'ceo', 'ceo office', 'ventures', 'geschaeftsfuehrung'],
  produkt: ['product', 'produktentwicklung', 'cpo'],
  recht: ['legal', 'datenschutz', 'compliance'],
  research: ['recherche', 'marktforschung'],
  gesundheit: ['health', 'fitness', 'sport'],
  ernaehrung: ['nutrition', 'einkauf', 'essen'],
  familie: ['family', 'partnerschaft'],
  'finanzen-privat': ['private finanzen', 'privatfinanzen', 'haushaltsfinanzen'],
  assistenz: ['assistant', 'persoenliche assistenz', 'assistent'],
};

const schluesselVon = (h: HeadDef): Set<string> => new Set([
  normal(h.id), normal(h.kurz), normal(h.name), normal(h.name.replace(/^head of\s+/i, '')), ...(ALIASE[h.id] ?? []).map(normal),
].filter(Boolean));
const SCHLUESSEL: ReadonlyMap<string, Set<string>> = new Map(KATALOG.map(h => [h.id, schluesselVon(h)]));

/** Teile eines Titels: ganz, ohne Klammern, an „/“ und „&“ geteilt. Rein. */
const titelTeile = (t: string): string[] => {
  const ohne = t.replace(/\([^)]*\)/g, ' ').trim();
  return [t, ohne, ...ohne.split(/[/&]| und /)].map(x => x.trim()).filter(Boolean);
};

export type ZielArt = 'head' | 'mitarbeiter';
export interface Zuordnung { headId: string | null; als: ZielArt; grund: string }

/**
 * Welcher Head gehört zu einer Agenten-Notiz? Reihenfolge der Kandidaten: Kopf `head`/`unter` (+ `type: mitarbeiter` → Mitarbeiter),
 * `abteilung`, Dateiname, Titel (ganz und in Teilen), Anzeigename im Index. Der erste Kandidat mit GENAU einem passenden Head gewinnt. Rein.
 */
export function zuordnen(d: AgentDatei, index: ReadonlyMap<string, string>): Zuordnung {
  const mitarbeiterArt = d.kopf.typ === 'mitarbeiter' || !!d.kopf.unter;
  const kandidaten: { text: string; woher: string }[] = [
    ...(d.kopf.unter ? [{ text: d.kopf.unter, woher: 'Kopf „unter“' }] : []),
    ...(d.kopf.head ? [{ text: d.kopf.head, woher: 'Kopf „head“' }] : []),
    ...(d.kopf.abteilung ? [{ text: d.kopf.abteilung, woher: 'Kopf „abteilung“' }] : []),
    { text: d.name, woher: 'Dateiname' },
    ...titelTeile(d.titel).map(text => ({ text, woher: 'Titel' })),
    ...(index.get(d.name.toLowerCase()) ? titelTeile(index.get(d.name.toLowerCase())!).map(text => ({ text, woher: 'Index' })) : []),
  ];
  for (const k of kandidaten) {
    const n = normal(k.text);
    if (!n) continue;
    const treffer = KATALOG.filter(h => SCHLUESSEL.get(h.id)!.has(n));
    if (treffer.length === 1) {
      const h = treffer[0];
      return { headId: h.id, als: mitarbeiterArt ? 'mitarbeiter' : 'head', grund: `${k.woher} „${k.text.slice(0, 60)}“ → ${h.name}` };
    }
  }
  return { headId: null, als: mitarbeiterArt ? 'mitarbeiter' : 'head', grund: 'Kein passender Head im Katalog — in der Vorschau einen Head wählen (auch „als Mitarbeiter unter …“) oder überspringen.' };
}

// ── Der Auftrag aus einer Datei ──────────────────────────────────────────────────────────────────────────────────────────

const MODELLE: readonly ModelTier[] = ['schnell', 'ausgewogen', 'stark'];
export const stufeAus = (d: AgentDatei): ModelTier | null => (MODELLE as readonly string[]).includes(d.kopf.modell ?? '') ? d.kopf.modell as ModelTier : null;

/** Der Auftrag (Text) aus Auftrag/Darf/Grenzen — leer, wenn die Notiz nichts davon hat. Nie gekürzt (die Grenze prüft der Plan). Rein. */
export function auftragAusDatei(d: AgentDatei): string {
  const teile = [
    d.auftrag.length ? `Auftrag: ${d.auftrag.join('\n')}` : '',
    d.darf.length ? `Darf: ${d.darf.join('\n')}` : '',
    d.grenzen.length ? `Nur mit Freigabe eines Menschen: ${d.grenzen.join('\n')}` : '',
  ].filter(Boolean);
  return teile.join('\n');
}

/** Die Rolle (ein Satz) und Anleitung eines Mitarbeiters aus einer Datei (`als: 'mitarbeiter'`). Rein. */
export function mitarbeiterAusDatei(d: AgentDatei): { name: string; rolle: string; anleitung: string } {
  const erster = (d.auftrag[0] ?? '').replace(/\s+/g, ' ').trim();
  const satz = (/^(.+?[.!?])(\s|$)/.exec(erster)?.[1] ?? erster).slice(0, 300);
  const anleitung = [d.darf.length ? `Darf: ${d.darf.join('\n')}` : '', d.grenzen.length ? `Nur mit Freigabe eines Menschen: ${d.grenzen.join('\n')}` : '', d.auftrag.length > 1 || erster.length > satz.length ? `Auftrag: ${d.auftrag.join('\n')}` : ''].filter(Boolean).join('\n');
  return { name: d.titel.replace(/\s+/g, ' ').slice(0, 80), rolle: satz || `Mitarbeiter aus dem Brain („${d.name}“).`, anleitung };
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ein früherer Fach-Agent der Software (lib/make-one/agents-data.ts `ALL_AGENTS`) — mit den Regeln des Servers zur Ausführbarkeit. */
export interface FachAgentInfo { id: string; name: string; rolle: string; stufe: ModelTier; geplant: boolean; ausfuehrbar: boolean; business: boolean }
/** Notizen und Ordner, die die Agenten-Sicht sieht (nie `privat`) — für Wissen. */
export interface BrainSicht { notizen: { pfad: string; titel: string; ordner: string }[]; ordner: { pfad: string; notizen: number }[] }

export type MitarbeiterAktion = 'vorhanden' | 'einschalten' | 'anlegen' | 'uebersprungen';
export interface PlanMitarbeiter {
  kuerzel: string;
  aktion: MitarbeiterAktion;
  grund: string;
  /** Vorlage des Katalogs (vorhanden/einschalten) bzw. vorhandener eigener Mitarbeiter. */
  mitarbeiterId?: string;
  /** Neu anzulegen (`anlegen`). */
  neu?: { name: string; rolle: string; agentId?: string; stufe: ModelTier; anleitung?: string };
}
/**
 * neu (der Head hat keinen) · aktualisieren (der bisherige kam unverändert aus dem Brain) · gleich · eigener (von Hand geschrieben — nur mit
 * „ersetzen“) · doppelt (eine andere Datei stellt den Auftrag dieses Heads schon) · zu-lang (über der Grenze, nie gekürzt) · leer.
 */
export type AuftragAktion = 'neu' | 'aktualisieren' | 'gleich' | 'eigener' | 'doppelt' | 'zu-lang' | 'leer';
export interface PlanWissen { pfad: string; art: 'ordner' | 'notiz'; aus: string; aktion: 'neu' | 'schon' }
export interface PlanEintrag {
  datei: string;
  name: string;
  titel: string;
  status?: string;
  /** Wohin die Datei geht. `als: 'mitarbeiter'` = ein eigener Mitarbeiter unter diesem Head. */
  ziel: { headId: string; headName: string; als: ZielArt } | null;
  zielGrund: string;
  auftrag: { text: string; aktion: AuftragAktion; zeichen: number; max: number } | null;
  stufe: { datei: ModelTier; heute: ModelTier } | null;
  mitarbeiter: PlanMitarbeiter[];
  wissen: PlanWissen[];
  /** Verweise aus dem Abschnitt Wissen, die die Agenten-Sicht nicht findet (gibt es nicht, oder privat — nie an Agenten). */
  wissenNichtGefunden: string[];
  ignoriert: string[];
  /** Stand der Einstellung des Ziel-Heads (409 beim Übernehmen, wenn sich etwas geändert hat). */
  stand?: string;
  /** Stand des Wissens des Ziel-Heads (Business-Bestand `agenten-wissen--<haushalt>`, eigener Stand). */
  wissenStand?: string;
}

export interface PlanEingabe {
  dateien: readonly AgentDatei[];
  index: ReadonlyMap<string, string>;
  /** Heads, die die Person sieht (lib/agenten/sicht.ts) — nur dorthin wird geplant. */
  sichtbar: ReadonlySet<string>;
  /** Einstellung je Head für diese Person (wirksam, `headEinstellungVon`) und ihr Stand. */
  einstellung: (headId: string) => HeadEinstellung;
  stand: (headId: string) => string;
  /** Mitarbeiter je Head (lib/agenten/skills-lesen.ts `mitarbeiterFuerHead`: Vorlagen, Aushilfen, eigene). */
  mitarbeiter: (headId: string) => readonly Mitarbeiter[];
  /** Wissen je Business-Head (Business-Bestand, lib/agenten/wissen-server.ts) und sein Stand. */
  wissen: (headId: string) => HeadWissen | null;
  wissenStand: (headId: string) => string;
  fachAgenten: readonly FachAgentInfo[];
  brain: BrainSicht;
  /** Vorgaben aus der Vorschau: anderer Head bzw. „als Mitarbeiter“ (null = überspringen). */
  wahl?: Readonly<Record<string, { headId: string | null; als?: ZielArt }>>;
}

const klein = (t: string) => t.normalize('NFC').toLocaleLowerCase('de-DE');

/** Notiz-Name → (Ordner bzw.) Notiz für das Wissen. Ein Ordner, wenn er nach der Notiz heißt und nicht oberste Ebene ist; sonst die Notiz. Rein. */
export function wissenFuerLink(link: string, b: BrainSicht): { pfad: string; art: 'ordner' | 'notiz' } | null {
  const ziel = klein(link.replace(/\.md$/i, ''));
  const kandidaten = b.notizen.filter(n => klein(n.titel) === ziel || klein(n.pfad.replace(/\.md$/i, '')) === ziel || klein(n.pfad.replace(/\.md$/i, '')).endsWith(`/${ziel}`));
  if (!kandidaten.length) return null;
  const n = kandidaten[0];
  const ordner = n.ordner;
  const tiefe = ordner ? ordner.split('/').length : 0;
  const ordnerName = normal(pfadName(ordner || ''));
  if (tiefe >= 2 && ordnerName && ordnerName.includes(normal(n.titel))) return { pfad: ordner, art: 'ordner' };
  return { pfad: n.pfad, art: 'notiz' };
}

/** Ordner-Erwähnung („Firmen/“) → genau ein sichtbarer Ordner mit diesem letzten Namen. Rein. */
export function wissenFuerOrdner(name: string, b: BrainSicht): { pfad: string; art: 'ordner' } | null {
  const z = klein(name.replace(/\/+$/, ''));
  const exakt = b.ordner.filter(o => klein(o.pfad) === z);
  if (exakt.length === 1) return { pfad: exakt[0].pfad, art: 'ordner' };
  const treffer = b.ordner.filter(o => klein(pfadName(o.pfad)) === z);
  return treffer.length === 1 ? { pfad: treffer[0].pfad, art: 'ordner' } : null;
}

/** Was mit einem Kürzel aus „Sub-Agenten“ unter einem Head geschieht. Rein. */
export function mitarbeiterPlanen(kuerzel: string, head: HeadDef, e: HeadEinstellung, vorhanden: readonly Mitarbeiter[], fach: readonly FachAgentInfo[], datei: string): PlanMitarbeiter {
  const k = kuerzel.toLowerCase();
  const passt = (m: { id: string; name: string; agentId?: string }) => m.agentId === k || m.id === k || m.id === `${head.id}-${k}` || normal(m.name) === normal(k);
  // 1) Vorlage dieses Heads (eigene oder Aushilfe) bzw. ein vorhandener Mitarbeiter (auch ein schon übernommener).
  const eigen = vorhanden.find(m => m.herkunft?.art === 'brain' && m.herkunft.kuerzel === k) ?? vorhanden.find(passt);
  if (eigen) {
    const aus = e.mitarbeiterAus?.includes(eigen.id);
    if (aus && eigen.headId === head.id) return { kuerzel: k, aktion: 'einschalten', mitarbeiterId: eigen.id, grund: `„${eigen.name}“ ist hier ausgeschaltet — wird eingeschaltet.` };
    return { kuerzel: k, aktion: 'vorhanden', mitarbeiterId: eigen.id, grund: `Schon da: „${eigen.name}“${eigen.headId !== head.id ? ` (hilft aus von ${headDef(eigen.headId)?.name ?? eigen.headId})` : ''}.` };
  }
  // 2) Eine Vorlage bei einem ANDEREN Head — dort gibt es ihn schon (nicht doppelt anlegen).
  for (const h of KATALOG) {
    const v = vorlagenFuer(h.id).find(x => !x.aushilfe && passt(x.vorlage));
    if (v && h.id !== head.id) return { kuerzel: k, aktion: 'vorhanden', grund: `Gibt es als „${v.vorlage.name}“ bei ${h.name} — dort nutzen (nicht doppelt angelegt).` };
  }
  // 3) Ein früherer Fach-Agent der Software → eigener Mitarbeiter mit diesem Fach-Agenten.
  const f = fach.find(x => x.id === k);
  if (!f) return { kuerzel: k, aktion: 'uebersprungen', grund: 'Unbekannt — kein Mitarbeiter und kein Fach-Agent mit diesem Namen.' };
  if (f.geplant) return { kuerzel: k, aktion: 'uebersprungen', grund: `„${f.name}“ ist in der Software nur geplant — es gibt ihn noch nicht.` };
  if (!f.ausfuehrbar) return { kuerzel: k, aktion: 'uebersprungen', grund: `„${f.name}“ ist kein eigener Fach-Agent — das übernimmt der Head mit seinen Werkzeugen.` };
  if (head.bereich === 'business' && !f.business) return { kuerzel: k, aktion: 'uebersprungen', grund: `„${f.name}“ liest auch private Bereiche — unter einem Business-Head nicht erlaubt.` };
  return { kuerzel: k, aktion: 'anlegen', grund: `Neu als eigener Mitarbeiter mit dem Fach-Agenten „${f.name}“ (Datei „${pfadName(datei)}“).`, neu: { name: f.name.slice(0, 80), rolle: f.rolle.slice(0, 300), agentId: f.id, stufe: f.stufe } };
}

/** Der Plan (rein): je Datei Ziel, Auftrag, Stufe, Mitarbeiter, Wissen — mit Aktion und Grund. */
export function planBauen(p: PlanEingabe): PlanEintrag[] {
  const vergeben = new Map<string, string>(); // headId → Datei, die den Auftrag des Heads stellt
  const raus: PlanEintrag[] = [];
  for (const d of p.dateien) {
    const auto = zuordnen(d, p.index);
    const w = p.wahl?.[d.pfad];
    const headId = w ? w.headId : auto.headId;
    const als: ZielArt = w?.als ?? auto.als;
    const head = headId ? headDef(headId) : null;
    const eintrag: PlanEintrag = {
      datei: d.pfad, name: d.name, titel: d.titel, ...(d.kopf.status ? { status: d.kopf.status } : {}),
      ziel: null, zielGrund: w ? (headId ? 'In der Vorschau gewählt.' : 'In der Vorschau übersprungen.') : auto.grund,
      auftrag: null, stufe: null, mitarbeiter: [], wissen: [], wissenNichtGefunden: [], ignoriert: d.ignoriert,
    };
    raus.push(eintrag);
    if (d.kopf.scope === 'privat') { eintrag.zielGrund = 'Die Notiz ist privat — sie geht nie an Agenten.'; continue; }
    if (!head) continue;
    // Firma und Privat liegen getrennt (Kevin 09.10.): aus dem (Firmen-)Brain nur Business-Heads — Privat-Agenten richtet jede Person selbst ein.
    if (head.bereich !== 'business') { eintrag.zielGrund = `${head.name} ist ein Privat-Agent — aus dem Brain werden nur Business-Heads übernommen (Firma und Privat getrennt).`; continue; }
    if (!p.sichtbar.has(head.id)) { eintrag.zielGrund = `${head.name} siehst du nicht (Rechte, Einwilligung oder Modul) — übersprungen.`; continue; }
    eintrag.ziel = { headId: head.id, headName: head.name, als };
    eintrag.stand = p.stand(head.id);
    eintrag.wissenStand = p.wissenStand(head.id);
    const e = p.einstellung(head.id);
    const vorhanden = p.mitarbeiter(head.id);

    if (als === 'mitarbeiter') {
      const m = mitarbeiterAusDatei(d);
      const da = vorhanden.find(x => x.herkunft?.art === 'brain' && x.herkunft.datei === d.pfad && !x.herkunft.kuerzel) ?? vorhanden.find(x => normal(x.name) === normal(m.name));
      const zuLang = m.anleitung.length > GRENZEN.mitarbeiterAnleitung;
      eintrag.mitarbeiter.push(da
        ? { kuerzel: normal(d.name).replace(/ /g, '-').slice(0, 40) || 'mitarbeiter', aktion: 'vorhanden', mitarbeiterId: da.id, grund: `Schon da: „${da.name}“.` }
        : zuLang
          ? { kuerzel: normal(d.name).replace(/ /g, '-').slice(0, 40) || 'mitarbeiter', aktion: 'uebersprungen', grund: `Die Anleitung hat mehr als ${GRENZEN.mitarbeiterAnleitung.toLocaleString('de-DE')} Zeichen — nicht übernommen (nie gekürzt); bitte in der Notiz kürzen.` }
          : { kuerzel: normal(d.name).replace(/ /g, '-').slice(0, 40) || 'mitarbeiter', aktion: 'anlegen', grund: `Neu als eigener Mitarbeiter unter ${head.name}.`, neu: { name: m.name, rolle: m.rolle, stufe: stufeAus(d) ?? 'schnell', ...(m.anleitung ? { anleitung: m.anleitung } : {}) } });
      if (d.mitarbeiter.length) eintrag.ignoriert = [...eintrag.ignoriert, 'Sub-Agenten (ein Mitarbeiter hat keine eigenen Mitarbeiter)'];
      continue;
    }

    // Auftrag
    const text = auftragAusDatei(d);
    const max = GRENZEN.headAuftragZeichen;
    let aktion: AuftragAktion;
    if (!text) aktion = 'leer';
    else if (text.length > max) aktion = 'zu-lang';
    else if (vergeben.has(head.id)) aktion = 'doppelt';
    else if (!e.auftrag) aktion = 'neu';
    else if (e.auftrag === text) aktion = 'gleich';
    else if (e.auftragQuelle && auftragHash(e.auftrag) === e.auftragQuelle.hash) aktion = 'aktualisieren';
    else aktion = 'eigener';
    if (text && aktion !== 'zu-lang' && !vergeben.has(head.id)) vergeben.set(head.id, d.pfad);
    eintrag.auftrag = { text, aktion, zeichen: text.length, max };

    // Modellstufe (nur, wenn die Datei eine andere nennt als heute gilt)
    const s = stufeAus(d);
    const heute = e.stufe ?? head.stufe;
    if (s && s !== heute) eintrag.stufe = { datei: s, heute };

    // Mitarbeiter
    for (const k of d.mitarbeiter) eintrag.mitarbeiter.push(mitarbeiterPlanen(k, head, e, vorhanden, p.fachAgenten, d.pfad));

    // Wissen
    const bisher = p.wissen(head.id);
    const schon = new Set((bisher?.pfade ?? []).map(klein));
    const gesehen = new Set<string>();
    const nimm = (x: { pfad: string; art: 'ordner' | 'notiz' } | null, aus: string) => {
      if (!x) { eintrag.wissenNichtGefunden.push(aus); return; }
      const sauber = pfadSaeubern(x.pfad);
      if (!sauber.ok || gesehen.has(klein(sauber.pfad))) return;
      gesehen.add(klein(sauber.pfad));
      const drin = schon.has(klein(sauber.pfad)) || (bisher?.pfade ?? []).some(o => !istNotizPfad(o) && klein(sauber.pfad).startsWith(`${klein(o)}/`));
      eintrag.wissen.push({ pfad: sauber.pfad, art: x.art, aus, aktion: drin ? 'schon' : 'neu' });
    };
    for (const l of d.wissen.links) nimm(wissenFuerLink(l, p.brain), l);
    for (const o of d.wissen.ordner) nimm(wissenFuerOrdner(o, p.brain), `${o}/`);
  }
  return raus;
}

// ── Auswahl beim Übernehmen ─────────────────────────────────────────────────────────────────────────────────────────────

/** Was die Person je Datei übernehmen will (aus der Vorschau; die INHALTE liest der Server neu aus dem Vault — nie aus dem Browser). */
export interface UebernahmeWahl {
  datei: string;
  /** Anderer Head bzw. überspringen (null) — fehlt: wie vorgeschlagen. */
  headId?: string | null;
  als?: ZielArt;
  auftrag?: boolean;
  /** Einen eigenen (von Hand geschriebenen) Auftrag ersetzen. */
  ersetzen?: boolean;
  stufe?: boolean;
  /** Kürzel der Mitarbeiter (einschalten/anlegen). */
  mitarbeiter?: string[];
  /** Pfade fürs Wissen. */
  wissen?: string[];
}

/** Vorauswahl der Vorschau: Auftrag neu/aktualisieren, Mitarbeiter einschalten/anlegen, alles neue Wissen; Stufe nie von selbst. Rein. */
export function vorauswahl(e: PlanEintrag): UebernahmeWahl {
  return {
    datei: e.datei,
    auftrag: !!e.auftrag && (e.auftrag.aktion === 'neu' || e.auftrag.aktion === 'aktualisieren'),
    stufe: false,
    mitarbeiter: e.mitarbeiter.filter(m => m.aktion === 'einschalten' || m.aktion === 'anlegen').map(m => m.kuerzel),
    wissen: e.wissen.filter(w => w.aktion === 'neu').map(w => w.pfad),
  };
}

/** Auswahl prüfen (Form; Grenzen → 413). Rein. */
export function wahlPruefen(v: unknown): { ok: true; wahl: UebernahmeWahl[] } | { ok: false; status: 400 | 413; fehler: string } {
  if (!Array.isArray(v)) return { ok: false, status: 400, fehler: 'Auswahl als Liste.' };
  if (v.length > 60) return { ok: false, status: 413, fehler: 'Höchstens 60 Dateien je Übernahme.' };
  const raus: UebernahmeWahl[] = [];
  const liste = (x: unknown, max: number): string[] | null => (Array.isArray(x) && x.length <= max && x.every(y => typeof y === 'string' && y.length <= GRENZEN.wissenPfadZeichen) ? Array.from(new Set(x as string[])) : null);
  for (const roh of v) {
    if (!roh || typeof roh !== 'object') return { ok: false, status: 400, fehler: 'Auswahl: je Datei ein Objekt.' };
    const r = roh as Record<string, unknown>;
    if (typeof r.datei !== 'string' || !r.datei.trim() || r.datei.length > GRENZEN.wissenPfadZeichen) return { ok: false, status: 400, fehler: 'Auswahl: Datei fehlt.' };
    if (r.headId !== undefined && r.headId !== null && (typeof r.headId !== 'string' || !headDef(r.headId))) return { ok: false, status: 400, fehler: 'Auswahl: unbekannter Head.' };
    if (r.als !== undefined && r.als !== 'head' && r.als !== 'mitarbeiter') return { ok: false, status: 400, fehler: 'Auswahl: als „head“ oder „mitarbeiter“.' };
    const mitarbeiter = r.mitarbeiter === undefined ? [] : liste(r.mitarbeiter, 40);
    const wissen = r.wissen === undefined ? [] : liste(r.wissen, GRENZEN.wissenPfade * 4);
    if (!mitarbeiter || !wissen) return { ok: false, status: 400, fehler: 'Auswahl: Mitarbeiter und Wissen als Listen von Texten.' };
    raus.push({
      datei: r.datei, ...(r.headId !== undefined ? { headId: r.headId as string | null } : {}), ...(r.als ? { als: r.als as ZielArt } : {}),
      auftrag: r.auftrag === true, ersetzen: r.ersetzen === true, stufe: r.stufe === true, mitarbeiter, wissen,
    });
  }
  return { ok: true, wahl: raus };
}
