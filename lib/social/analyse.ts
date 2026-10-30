// ─── MAKE OS — Social: Lernschleife (rein) — 26.10.2026 ─────────────────────────────────────────────────────────────────────────────
// Kevin 26.10.: „Mach Analysen, dass wir viral gehen und Aufrufe generieren.“ Ehrlich: Viralität lässt sich nicht garantieren — diese Stelle
// misst, vergleicht jede Folge mit dem TYPISCHEN Wert des eigenen Kanals (Median) und leitet daraus den nächsten Schritt ab (mehr davon ·
// Hook umbauen · kürzen · streichen). Alles nur aus echten Messungen; ohne genug Folgen sagt sie „zu wenig Daten“ statt etwas zu erfinden.
// Die Schwellen sind STARTANNAHMEN (`START_SCHWELLEN`), keine Plattform-Angaben — sie werden mit den eigenen Zahlen nachgeschärft.

import type { SocialFolge, SocialPlattform, Messung } from './typen';

export const START_SCHWELLEN = {
  /** Unter diesem Anteil nach 3 s ist der Hook das Problem. */
  halte3s: 50,
  /** Unter diesem Anteil bis zum Ende ist die Folge zu lang oder verliert in der Mitte. */
  durchsehen: 25,
  /** Ab diesem Vielfachen des Kanal-Typs: mehr davon. */
  stark: 1.5,
  /** Unter diesem Vielfachen (bei genug Daten): streichen bzw. neu denken. */
  schwach: 0.5,
  /** So viele Folgen mit Zahlen braucht ein Kanal, bevor relative Urteile etwas sagen. */
  mindestFolgen: 5,
} as const;

export interface FolgeZahlen {
  views: number;
  likes: number; kommentare: number; shares: number; saves: number; follows: number;
  /** Nach Aufrufen gewichteter Mittelwert über die Plattformen (nur, wo gemessen). */
  halte3s?: number; durchsehen?: number;
  /** Je 1.000 Aufrufe. */
  sharesJeTsd: number; savesJeTsd: number; followsJeTsd: number; kommentareJeTsd: number;
  plattformen: SocialPlattform[];
}

/** Jüngste Messung je Plattform (Messungen sind kumulativ — die neueste zählt). */
export function letzteMessungen(f: SocialFolge): Messung[] {
  const je = new Map<SocialPlattform, Messung>();
  for (const m of f.messungen) { const a = je.get(m.plattform); if (!a || m.am >= a.am) je.set(m.plattform, m); }
  return [...je.values()];
}

const jeTsd = (n: number, views: number) => (views > 0 ? Math.round((n / views) * 1000 * 10) / 10 : 0);
function gewichtet(ms: Messung[], feld: 'halte3s' | 'durchsehen'): number | undefined {
  const mit = ms.filter(m => typeof m[feld] === 'number' && m.views > 0);
  const summe = mit.reduce((s, m) => s + m.views, 0);
  return summe ? Math.round((mit.reduce((s, m) => s + (m[feld] as number) * m.views, 0) / summe) * 10) / 10 : undefined;
}

export function folgeZahlen(f: SocialFolge): FolgeZahlen | null {
  const ms = letzteMessungen(f);
  if (!ms.length) return null;
  const s = (k: 'likes' | 'kommentare' | 'shares' | 'saves' | 'follows') => ms.reduce((a, m) => a + (m[k] ?? 0), 0);
  const views = ms.reduce((a, m) => a + m.views, 0);
  return {
    views, likes: s('likes'), kommentare: s('kommentare'), shares: s('shares'), saves: s('saves'), follows: s('follows'),
    halte3s: gewichtet(ms, 'halte3s'), durchsehen: gewichtet(ms, 'durchsehen'),
    sharesJeTsd: jeTsd(s('shares'), views), savesJeTsd: jeTsd(s('saves'), views), followsJeTsd: jeTsd(s('follows'), views), kommentareJeTsd: jeTsd(s('kommentare'), views),
    plattformen: ms.map(m => m.plattform),
  };
}

export const median = (l: number[]): number => {
  const s = l.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export type Urteil = 'mehr-davon' | 'hook' | 'kuerzen' | 'streichen' | 'beobachten' | 'zu-wenig-daten';
export const URTEIL_TEXT: Record<Urteil, string> = {
  'mehr-davon': 'Mehr davon — deutlich über dem Typischen des Kanals.',
  hook: 'Hook umbauen — zu viele gehen in den ersten 3 Sekunden.',
  kuerzen: 'Kürzen oder die Mitte straffen — kaum jemand schaut bis zum Ende.',
  streichen: 'Dieses Muster nicht wiederholen — klar unter dem Typischen.',
  beobachten: 'Im üblichen Bereich — weiter messen.',
  'zu-wenig-daten': 'Zu wenig Folgen mit Zahlen für einen Vergleich.',
};

export interface FolgeAuswertung {
  id: string; titel: string; formatId?: string; saeule?: string; hookId?: string;
  zahlen: FolgeZahlen;
  /** Geometrisches Mittel der Verhältnisse zum Kanal-Median (Aufrufe doppelt gewichtet — Reichweite ist das Ziel; dazu Shares/Saves/Follows
   *  je 1.000 und Haltequote) — 1,0 = typisch. Geometrisch, damit wenige Aufrufe nicht von einer zufällig hohen Rate verdeckt werden. */
  wirkung: number | null;
  urteil: Urteil;
}

export interface Gruppenwert { id: string; folgen: number; wirkung: number | null; views: number }

export interface HookVergleich {
  /** Ein Hook-Test gilt nur innerhalb EINER Folge — Hooks verschiedener Folgen werden nie miteinander verglichen. */
  folgeId: string;
  titel: string;
  /** Je Variante die jüngste Messung je Plattform (Messungen sind Zwischenstände, nicht Einzelfälle). */
  varianten: { hookId: string; text: string; messungen: number; halte3s?: number; views: number }[];
  /** Nur eine Tendenz: beste Haltequote, wenn jede Variante auf mindestens 2 Plattformen gemessen ist. */
  vorn: string | null;
}

export interface KanalAnalyse {
  folgenMitZahlen: number;
  genugDaten: boolean;
  typisch: { views: number; halte3s?: number; durchsehen?: number; sharesJeTsd: number; savesJeTsd: number; followsJeTsd: number };
  folgen: FolgeAuswertung[];
  top: FolgeAuswertung[];
  flop: FolgeAuswertung[];
  formate: Gruppenwert[];
  saeulen: Gruppenwert[];
  hooks: HookVergleich[];
  empfehlungen: string[];
}

const rund2 = (n: number) => Math.round(n * 100) / 100;
function wirkungVon(z: FolgeZahlen, t: KanalAnalyse['typisch']): number | null {
  const v: number[] = [];
  // Ein Verhältnis von 0 (z. B. keine Shares) würde alles auf 0 ziehen — deshalb nach unten bei 0,05 begrenzt.
  const teil = (ist: number | undefined, typ: number | undefined, gewicht = 1) => { if (ist !== undefined && typ && typ > 0) for (let i = 0; i < gewicht; i++) v.push(Math.max(0.05, ist / typ)); };
  teil(z.views, t.views, 2); teil(z.sharesJeTsd, t.sharesJeTsd); teil(z.savesJeTsd, t.savesJeTsd); teil(z.followsJeTsd, t.followsJeTsd); teil(z.halte3s, t.halte3s);
  return v.length ? rund2(Math.exp(v.reduce((a, b) => a + Math.log(b), 0) / v.length)) : null;
}

function gruppen(l: FolgeAuswertung[], schluessel: (x: FolgeAuswertung) => string | undefined): Gruppenwert[] {
  const m = new Map<string, FolgeAuswertung[]>();
  for (const x of l) { const s = schluessel(x); if (s) m.set(s, [...(m.get(s) ?? []), x]); }
  return [...m.entries()].map(([id, xs]) => {
    const w = xs.map(x => x.wirkung).filter((n): n is number => n !== null);
    return { id, folgen: xs.length, wirkung: w.length ? rund2(w.reduce((a, b) => a + b, 0) / w.length) : null, views: xs.reduce((a, x) => a + x.zahlen.views, 0) };
  }).sort((a, b) => (b.wirkung ?? 0) - (a.wirkung ?? 0));
}

function hookVergleich(folgen: SocialFolge[]): HookVergleich[] {
  const aus: HookVergleich[] = [];
  for (const f of folgen) {
    const je = new Map<string, Map<SocialPlattform, Messung>>();
    for (const m of f.messungen) {
      const hid = m.hookId ?? f.hookId; if (!hid) continue;
      const proPlattform = je.get(hid) ?? new Map<SocialPlattform, Messung>();
      const alt = proPlattform.get(m.plattform);
      if (!alt || m.am >= alt.am) proPlattform.set(m.plattform, m);
      je.set(hid, proPlattform);
    }
    if (je.size < 2) continue;
    const varianten = [...je.entries()].map(([hookId, pp]) => {
      const ms = [...pp.values()];
      return { hookId, text: f.hooks.find(h => h.id === hookId)?.text ?? hookId, messungen: ms.length, halte3s: gewichtet(ms, 'halte3s'), views: ms.reduce((a, m) => a + m.views, 0) };
    }).sort((a, b) => (b.halte3s ?? -1) - (a.halte3s ?? -1));
    const vorn = varianten.every(v => v.messungen >= 2 && v.halte3s !== undefined) ? varianten[0].hookId : null;
    aus.push({ folgeId: f.id, titel: f.titel, varianten, vorn });
  }
  return aus;
}

/** Die Analyse eines Kanals aus seinen Folgen (nur veröffentlichte mit Messungen zählen). */
export function kanalAnalyse(folgenAlle: SocialFolge[], kanalId: string, opt: { schwellen?: typeof START_SCHWELLEN; formatName?: (id: string) => string } = {}): KanalAnalyse {
  const s = opt.schwellen ?? START_SCHWELLEN;
  const fName = (id: string | null) => (id ? opt.formatName?.(id) ?? id : 'ohne Format');
  const folgen = folgenAlle.filter(f => f.kanalId === kanalId && f.status !== 'verworfen');
  const mit = folgen.map(f => ({ f, z: folgeZahlen(f) })).filter((x): x is { f: SocialFolge; z: FolgeZahlen } => !!x.z);
  const typisch = {
    views: median(mit.map(x => x.z.views)),
    halte3s: mit.some(x => x.z.halte3s !== undefined) ? median(mit.map(x => x.z.halte3s).filter((n): n is number => n !== undefined)) : undefined,
    durchsehen: mit.some(x => x.z.durchsehen !== undefined) ? median(mit.map(x => x.z.durchsehen).filter((n): n is number => n !== undefined)) : undefined,
    sharesJeTsd: median(mit.map(x => x.z.sharesJeTsd)), savesJeTsd: median(mit.map(x => x.z.savesJeTsd)), followsJeTsd: median(mit.map(x => x.z.followsJeTsd)),
  };
  const genugDaten = mit.length >= s.mindestFolgen;
  const auswertungen: FolgeAuswertung[] = mit.map(({ f, z }) => {
    const wirkung = genugDaten ? wirkungVon(z, typisch) : null;
    let urteil: Urteil = genugDaten ? 'beobachten' : 'zu-wenig-daten';
    // Absolute Signale gelten schon ab der ersten Folge, relative erst mit genug Daten.
    if (z.halte3s !== undefined && z.halte3s < s.halte3s) urteil = 'hook';
    else if (z.durchsehen !== undefined && z.durchsehen < s.durchsehen) urteil = 'kuerzen';
    if (genugDaten && wirkung !== null) {
      if (wirkung >= s.stark) urteil = 'mehr-davon';
      else if (wirkung < s.schwach && urteil === 'beobachten') urteil = 'streichen';
    }
    return { id: f.id, titel: f.titel, formatId: f.formatId, saeule: f.saeule, hookId: f.hookId, zahlen: z, wirkung, urteil };
  });
  const sortiert = [...auswertungen].sort((a, b) => (b.wirkung ?? b.zahlen.views) - (a.wirkung ?? a.zahlen.views));
  const formate = gruppen(auswertungen, x => x.formatId);
  const saeulen = gruppen(auswertungen, x => x.saeule);
  const hooks = hookVergleich(folgen);

  const empfehlungen: string[] = [];
  if (!mit.length) empfehlungen.push('Noch keine Zahlen — nach den ersten Veröffentlichungen die Insights eintragen oder als CSV importieren.');
  else if (!genugDaten) empfehlungen.push(`Erst ${mit.length} von ${s.mindestFolgen} Folgen mit Zahlen — bis dahin nur absolute Signale (Haltequote, Durchsehquote).`);
  const hookProbleme = auswertungen.filter(x => x.urteil === 'hook').length;
  if (hookProbleme && hookProbleme >= Math.ceil(auswertungen.length / 2)) empfehlungen.push(`Bei ${hookProbleme} von ${auswertungen.length} Folgen gehen zu viele in den ersten 3 Sekunden — stärkster Hebel: Hooks (überraschender erster Satz, sofort Bewegung im Bild).`);
  const kurz = auswertungen.filter(x => x.urteil === 'kuerzen').length;
  if (kurz >= 2) empfehlungen.push(`${kurz} Folgen verlieren die Leute vor dem Ende — kürzer schneiden, die Pointe früher.`);
  if (genugDaten && formate.length >= 2 && formate[0].wirkung !== null) empfehlungen.push(`Stärkstes Format bisher: „${fName(formate[0].id)}“ (Wirkung ${formate[0].wirkung}) — davon mehr einplanen.`);
  if (genugDaten && saeulen.length >= 2 && saeulen[0].wirkung !== null && saeulen[saeulen.length - 1].wirkung !== null) empfehlungen.push(`Säule „${saeulen[0].id}“ trägt am meisten, „${saeulen[saeulen.length - 1].id}“ am wenigsten.`);
  for (const h of hooks) if (h.vorn) empfehlungen.push(`Hook-Test bei „${h.titel}“: „${h.varianten[0].text}“ hält am besten (${String(h.varianten[0].halte3s).replace('.', ',')} % nach 3 s) — Tendenz, kein Beweis.`);
  return {
    folgenMitZahlen: mit.length, genugDaten, typisch, folgen: auswertungen,
    top: sortiert.slice(0, 3), flop: genugDaten ? sortiert.slice(-3).reverse() : [], formate, saeulen, hooks, empfehlungen,
  };
}

export interface Wochenbericht { von: string; bis: string; veroeffentlicht: number; views: number; follows: number; beste: string | null }
/** Die letzten 7 Tage bis `heute` (inkl.): was rausging und was es brachte. */
export function wochenbericht(folgen: SocialFolge[], kanalId: string, heute: string, tagMinus: (tag: string, n: number) => string): Wochenbericht {
  const von = tagMinus(heute, 6);
  const drin = folgen.filter(f => f.kanalId === kanalId && f.veroeffentlicht.some(v => v.am >= von && v.am <= heute));
  const mitZ = drin.map(f => ({ f, z: folgeZahlen(f) }));
  const beste = mitZ.filter(x => x.z).sort((a, b) => b.z!.views - a.z!.views)[0];
  return {
    von, bis: heute, veroeffentlicht: drin.length,
    views: mitZ.reduce((a, x) => a + (x.z?.views ?? 0), 0), follows: mitZ.reduce((a, x) => a + (x.z?.follows ?? 0), 0),
    beste: beste ? beste.f.titel : null,
  };
}
