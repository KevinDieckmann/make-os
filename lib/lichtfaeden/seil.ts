// ─── Lichtfäden · Seil — Stränge, die auf ein Ziel zulaufen und sich dort verdrillen (07.10.2026, rein, client-sicher) ─────
// Kevin (07.10.): „Die einzelnen Strahle sind nicht wirklich sichtbar. Am Ende müssen sie irgendwo alle ineinander greifen, wie ein
// Kabel oder ein Seil. Erst dann kommt Fokus und Momentum.“ — „Die Karten und Ziele brauchen Abhängigkeiten.“ Konzept und Bild:
// LICHTFAEDEN.md › Seil. Diese Datei ist das MODELL (keine Pixel): aus neutralen Eingängen (Adapter: seil-quellen.ts) werden
//   · STRÄNGE  — je Meilenstein/Unterziel/Projekt/Liste/„lose Karten“ einer: Zeitraum, Fortschritt, Status, Grund einer Blockade,
//                Karten (Aufgaben) und Marken (Termine, Deals) am Strang, Einmündung ins Seil;
//   · SEILE    — je oberstem Ziel eines: die eingemündeten Stränge als Fasern, Anker (Ziel-Frist bzw. Jahresende/Fensterende),
//                Momentum (Mittel des Strang-Fortschritts), Schwung (Erledigtes der letzten 14 Tage), kritischer Pfad, Engpass;
//   · KANTEN   — „wartet auf“ zwischen Karten und zwischen Strängen (offen/erfüllt, kritisch).
// Die Geometrie (Spuren, Kurven, Fasern) rechnet seil-geometrie.ts; der Zeichner (seilband.ts) rechnet nichts davon selbst.
// Regeln für die Lage (Tests: tests/seil-modell.test.ts):
//   1. Seile nach Rang (dann Titel); ein Strang ohne Ziel landet im Bündel „Ohne Ziel“ (kein Seil, nur Spuren).
//   2. Spuren im Seil: wer früher einmündet, liegt näher am Seil (unten) — so kreuzt keine Einmündung eine laufende Spur.
//   3. Einmündung = Ende des Strangs, ein offener überfälliger Strang zieht sich bis HEUTE; nie hinter dem Anker.
//   4. Start = spätestes Ende der Vorgänger (wartet auf …), sonst die früheste Karte, sonst Ende − `SEIL.vorlaufTage`; mindestens
//      `SEIL.mindestTage` lang.

import type { SpaceId } from '@/lib/make-one/space-regeln';
import { OHNE_FARBE } from './modell';

/** Die Parameter des Modells — EINE Stelle (Geometrie und Zeichner haben eigene in seil-geometrie.ts). */
export const SEIL = {
  /** Ohne bekannten Start beginnt ein Strang so viele Tage vor seinem Ende. */
  vorlaufTage: 42,
  /** Ein Strang ist mindestens so lang (Tage). */
  mindestTage: 7,
  /** Schwung: Erledigtes der letzten so vielen Tage zählt. */
  schwungTage: 14,
  /** Schwung = 1 − 2^(−n / halb). */
  schwungHalb: 3,
  /** Höchstens so viele Karten je Strang (die nächsten zuerst) — der Rest steht als Zahl am Strang. */
  kartenJeStrang: 40,
  /** Höchstens so viele Glieder nennt der kritische Pfad. */
  pfadMax: 12,
} as const;

// ── Eingang (neutral, aus den Adaptern) ──────────────────────────────────────

export type StrangArt = 'meilenstein' | 'unterziel' | 'projekt' | 'liste' | 'karten';
export type KartenStatus = 'offen' | 'erledigt' | 'abgebrochen';
/** Woher der Anker eines Seils kommt: echte Frist, geschätzt (Jahresende des Planungsjahres) oder ohne (Fensterende). */
export type AnkerArt = 'frist' | 'jahresende' | 'ohne';

export interface SeilZielRoh {
  id: string; titel: string;
  /** #RRGGBB — vom Server (lib/planung/ziel-farben-server.ts). */
  farbe: string;
  rang?: number; space: SpaceId;
  /** Ziel-Frist (YYYY-MM-DD) bzw. Jahresende des Planungsjahres (dann `ankerArt: 'jahresende'`). */
  anker?: string; ankerArt?: AnkerArt;
  erledigt?: boolean; erledigtAm?: string;
  /** 0 … 100 (nur, wenn keine Stränge da sind). */
  fortschritt?: number;
  /** Eltern-Ziel (von Hand bzw. Kaskade, schon aufgelöst — lib/planung/bezuege.ts `zielEltern`). */
  elternId?: string;
  link?: string;
}
export interface SeilStrangRoh {
  id: string; art: StrangArt; titel: string;
  /** Auf welches Ziel der Strang einzahlt (direkt) — null = ohne Ziel. */
  zielId: string | null;
  /** Fälligkeit (Meilenstein, Projekt-Ende, Unterziel-Frist). */
  ende?: string;
  /** Ausdrücklicher Start (Projekt-Start). */
  start?: string;
  /** 0 … 1 von außen (Meilenstein: wirksamer Fortschritt; Unterziel); sonst aus den Karten. */
  fortschritt?: number;
  erledigt?: boolean; erledigtAm?: string;
  /** Stränge, auf die dieser wartet (Meilenstein → Meilenstein). */
  wartetAuf?: string[];
  link?: string; rang?: number;
  /** Farbe von außen (sonst die des Ziels). */
  farbe?: string;
}
export interface SeilKarteRoh {
  id: string; strang: string; titel: string;
  /** Fälligkeit (YYYY-MM-DD) — ohne Tag zählt die Karte für Fortschritt und Pfad, steht aber nicht am Strang. */
  tag?: string; start?: string;
  status: KartenStatus; erledigtAm?: string;
  /** Karten, auf die diese wartet. */
  wartetAuf?: string[];
  link?: string; dringend?: boolean;
}
export type MarkenArt = 'termin' | 'deal' | 'frist';
export interface SeilMarkeRoh { id: string; strang: string; karte?: string; tag: string; art: MarkenArt; titel: string; link?: string }
export interface SeilEingang {
  heute: string; von: string; bis: string;
  ziele: readonly SeilZielRoh[]; straenge: readonly SeilStrangRoh[]; karten: readonly SeilKarteRoh[]; marken?: readonly SeilMarkeRoh[];
}

// ── Ergebnis ─────────────────────────────────────────────────────────────────

export type StrangStatus = 'erledigt' | 'offen' | 'blockiert' | 'ueberfaellig';
export interface SeilKarte { id: string; titel: string; tag?: string; status: KartenStatus; link?: string; blockiert: boolean; grund?: string; kritisch: boolean; dringend?: boolean }
export interface SeilMarke { id: string; tag: string; art: MarkenArt; titel: string; link?: string; karte?: string }
export interface SeilStrang {
  id: string; art: StrangArt; titel: string; farbe: string; link?: string;
  /** Das Seil (oberstes Ziel), in das er einmündet — null = „Ohne Ziel“. */
  seil: string | null;
  /** Über welches Zwischenziel (Unterziel) er einzahlt — Titel, sonst nicht gesetzt. */
  ueber?: string;
  von: string; bis: string;
  /** Einmündung ins Seil (Tag) — bei „Ohne Ziel“ das Ende. */
  muendung: string;
  /** Ohne eigenes Datum (läuft bis zum Anker). */
  ohneDatum: boolean;
  fortschritt: number;
  status: StrangStatus;
  /** Warum blockiert/überfällig — ein ganzer Satz für Zeigen/Vorleser. */
  grund?: string;
  /** Bis wann er auf Vorgänger wartet (spätestes Ende der offenen Vorgänger). */
  blockiertBis?: string;
  /** Endet nach dem Anker seines Seils (Hinweis). */
  nachAnker: boolean;
  karten: SeilKarte[];
  /** Karten ohne Tag oder über der Grenze (nur gezählt). */
  kartenWeitere: number;
  marken: SeilMarke[];
  zahl: { gesamt: number; erledigt: number };
  kritisch: boolean;
}
export interface SeilKante { id: string; art: 'karte' | 'strang'; von: string; nach: string; offen: boolean; kritisch: boolean; seil: string | null }
export interface Seil {
  zielId: string; titel: string; farbe: string; link?: string; rang: number; space: SpaceId;
  anker: string; ankerArt: AnkerArt;
  erledigt: boolean; ueberfaellig: boolean;
  /** Mittel des Strang-Fortschritts 0 … 1 (ohne Stränge: der Fortschritt des Ziels). */
  momentum: number;
  /** Erledigtes der letzten Tage 0 … 1. */
  schwung: number;
  /** Stränge in Spur-Reihenfolge (oben → unten, das unterste mündet zuerst). */
  straenge: string[];
  fertig: number;
  /** Kritischer Pfad: Kennungen (Karten „k:<id>“, Stränge „s:<id>“) in Reihenfolge — leer, wenn nichts offen ist. */
  pfad: string[];
  pfadText?: string;
  engpass?: { id: string; titel: string; wartende: number };
  text: string;
}
export interface SeilAnsicht {
  heute: string; von: string; bis: string;
  seile: Seil[];
  /** Stränge ohne Ziel (Spur-Reihenfolge) — eigenes Bündel ohne Seil. */
  ohneZiel: string[];
  straenge: Record<string, SeilStrang>;
  kanten: SeilKante[];
  text: string;
}

// ── Tage ─────────────────────────────────────────────────────────────────────

const TAG = /^\d{4}-\d{2}-\d{2}$/;
export const istSeilTag = (v: unknown): v is string => typeof v === 'string' && TAG.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const ms = (t: string) => Date.parse(`${t}T12:00:00Z`);
export const seilTagPlus = (t: string, n: number): string => { const d = new Date(ms(t)); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const seilTage = (a: string, b: string): number => Math.round((ms(b) - ms(a)) / 864e5);
const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const max = (a: string, b: string) => (a > b ? a : b);
const min = (a: string, b: string) => (a < b ? a : b);
const zitat = (s: string) => `„${s.length > 60 ? `${s.slice(0, 59)}…` : s}“`;

/** Schwung aus der Zahl des zuletzt Erledigten. */
export const schwungAus = (n: number): number => (n > 0 ? 1 - 2 ** (-n / SEIL.schwungHalb) : 0);

// ── Wurzel ───────────────────────────────────────────────────────────────────

/** Ziel → oberstes Ziel (über `elternId`, nur innerhalb der Eingangsmenge, kreisfest). */
export function seilWurzelVon(ziele: readonly Pick<SeilZielRoh, 'id' | 'elternId'>[]): Map<string, string> {
  const nachId = new Map(ziele.map(z => [z.id, z]));
  const aus = new Map<string, string>();
  for (const z of ziele) {
    let w = z;
    const gesehen = new Set([z.id]);
    for (let i = 0; i < 16 && w.elternId && nachId.has(w.elternId) && !gesehen.has(w.elternId); i++) { gesehen.add(w.elternId); w = nachId.get(w.elternId)!; }
    aus.set(z.id, w.id);
  }
  return aus;
}

// ── Kritischer Pfad (rein, allgemein) ────────────────────────────────────────

export interface PfadKnoten { id: string; tag?: string; vor: readonly string[] }
/**
 * Die längste Kette offener Abhängigkeiten (Zahl der Glieder; bei Gleichstand das spätere Ende, dann die Kennung) — in
 * Reihenfolge vom ersten Vorgänger bis zum letzten Glied. Kanten zu Knoten außerhalb der Menge zählen nicht; Knoten in einem
 * (verbotenen) Kreis bleiben außen vor. Dazu je Knoten, wie viele (transitiv) auf ihn warten.
 */
export function kritischerPfad(knoten: readonly PfadKnoten[]): { pfad: string[]; wartende: Map<string, number> } {
  const nachId = new Map(knoten.map(k => [k.id, k]));
  const vor = new Map(knoten.map(k => [k.id, Array.from(new Set(k.vor.filter(v => nachId.has(v) && v !== k.id)))]));
  const nach = new Map<string, string[]>();
  for (const [id, l] of vor) for (const v of l) nach.set(v, [...(nach.get(v) ?? []), id]);
  // Kahn: topologische Reihenfolge (Kreise fallen heraus).
  const rest = new Map([...vor].map(([id, l]) => [id, l.length]));
  const ordnung: string[] = [];
  const bereit = [...rest].filter(([, n]) => n === 0).map(([id]) => id).sort();
  while (bereit.length) {
    const id = bereit.shift()!;
    ordnung.push(id);
    for (const n of nach.get(id) ?? []) { const r = rest.get(n)! - 1; rest.set(n, r); if (r === 0) bereit.push(n); }
  }
  const laenge = new Map<string, number>();
  const bester = new Map<string, string | undefined>();
  const tag = (id: string) => nachId.get(id)?.tag ?? '';
  for (const id of ordnung) {
    let l = 1, b: string | undefined;
    for (const v of vor.get(id) ?? []) {
      const lv = laenge.get(v);
      if (lv === undefined) continue;
      if (lv + 1 > l || (lv + 1 === l && b !== undefined && (tag(v) > tag(b) || (tag(v) === tag(b) && v > b)))) { l = lv + 1; b = v; }
    }
    laenge.set(id, l); bester.set(id, b);
  }
  let ende: string | undefined;
  for (const id of ordnung) {
    if (ende === undefined) { ende = id; continue; }
    const a = laenge.get(id)!, e = laenge.get(ende)!;
    if (a > e || (a === e && (tag(id) > tag(ende) || (tag(id) === tag(ende) && id > ende)))) ende = id;
  }
  const pfad: string[] = [];
  for (let id = ende, n = 0; id !== undefined && n < 400; id = bester.get(id), n++) pfad.unshift(id);
  // Wartende (transitiv): je Knoten die Nachfolger in der topologischen Ordnung rückwärts aufsammeln.
  const wartende = new Map<string, number>();
  const unter = new Map<string, Set<string>>();
  for (let i = ordnung.length - 1; i >= 0; i--) {
    const id = ordnung[i];
    const s = new Set<string>();
    for (const n of nach.get(id) ?? []) { if (!unter.has(n)) continue; s.add(n); for (const x of unter.get(n)!) s.add(x); }
    unter.set(id, s);
    wartende.set(id, s.size);
  }
  return { pfad: ordnung.length ? pfad : [], wartende };
}

// ── Das Modell ───────────────────────────────────────────────────────────────

/** Die Ansicht: Seile, Stränge, Kanten — rein und deterministisch (gleicher Eingang, gleiche Ansicht). */
export function seilRechnen(e: SeilEingang): SeilAnsicht {
  const { heute, von, bis } = e;
  const zielNach = new Map(e.ziele.map(z => [z.id, z]));
  const wurzel = seilWurzelVon(e.ziele);
  const strangNach = new Map(e.straenge.map(s => [s.id, s]));
  const kartenJe = new Map<string, SeilKarteRoh[]>();
  for (const k of e.karten) if (strangNach.has(k.strang)) kartenJe.set(k.strang, [...(kartenJe.get(k.strang) ?? []), k]);
  const karteNach = new Map(e.karten.filter(k => strangNach.has(k.strang)).map(k => [k.id, k]));
  const markenJe = new Map<string, SeilMarkeRoh[]>();
  for (const m of e.marken ?? []) if (strangNach.has(m.strang) && istSeilTag(m.tag)) markenJe.set(m.strang, [...(markenJe.get(m.strang) ?? []), m]);
  const offenK = (k: SeilKarteRoh) => k.status === 'offen';

  // Seile: oberste Ziele der Eingangsmenge, nach Rang.
  const seilIds = Array.from(new Set(e.ziele.map(z => wurzel.get(z.id)!)));
  const seilZiel = (id: string) => zielNach.get(id)!;
  seilIds.sort((a, b) => (seilZiel(a).rang ?? 1e9) - (seilZiel(b).rang ?? 1e9) || seilZiel(a).titel.localeCompare(seilZiel(b).titel, 'de') || a.localeCompare(b));
  const anker = new Map<string, { tag: string; art: AnkerArt }>();
  for (const id of seilIds) {
    const z = seilZiel(id);
    anker.set(id, z.anker && istSeilTag(z.anker) ? { tag: z.anker, art: z.ankerArt ?? 'frist' } : { tag: bis, art: 'ohne' });
  }
  const seilVon = (s: SeilStrangRoh): string | null => (s.zielId && zielNach.has(s.zielId) ? wurzel.get(s.zielId)! : null);

  // Fortschritt und Ende je Strang (Vorgänger brauchen das Ende der anderen — erst Enden, dann Starts).
  const zaehlende = (id: string) => (kartenJe.get(id) ?? []).filter(k => k.status !== 'abgebrochen');
  const fortschritt = (s: SeilStrangRoh): number => {
    if (s.erledigt) return 1;
    if (typeof s.fortschritt === 'number' && Number.isFinite(s.fortschritt)) return Math.max(0, Math.min(1, s.fortschritt));
    const l = zaehlende(s.id);
    return l.length ? l.filter(k => k.status === 'erledigt').length / l.length : 0;
  };
  const erledigt = (s: SeilStrangRoh): boolean => !!s.erledigt || (s.art !== 'meilenstein' && s.art !== 'unterziel' && zaehlende(s.id).length > 0 && fortschritt(s) >= 1);
  const ende = new Map<string, { tag: string; ohne: boolean }>();
  for (const s of e.straenge) {
    const tage = (kartenJe.get(s.id) ?? []).map(k => k.tag).filter(istSeilTag).sort();
    const a = seilVon(s);
    if (istSeilTag(s.ende)) ende.set(s.id, { tag: s.ende, ohne: false });
    else if (tage.length) ende.set(s.id, { tag: tage[tage.length - 1], ohne: false });
    else ende.set(s.id, { tag: a ? anker.get(a)!.tag : bis, ohne: true });
  }

  // Stränge.
  const straenge: Record<string, SeilStrang> = {};
  for (const s of e.straenge) {
    const a = seilVon(s);
    const en = ende.get(s.id)!;
    const f = fortschritt(s);
    const fertig = erledigt(s);
    // Vorgänger (Stränge): offene halten ihn auf.
    const vorOffen = (s.wartetAuf ?? []).map(v => strangNach.get(v)).filter((v): v is SeilStrangRoh => !!v && v.id !== s.id && !erledigt(v));
    const vorEnde = (s.wartetAuf ?? []).map(v => ende.get(v)?.tag).filter((t): t is string => !!t).sort();
    const kartenTage = (kartenJe.get(s.id) ?? []).flatMap(k => [k.start, k.tag]).filter(istSeilTag).sort();
    let start = istSeilTag(s.start) ? s.start : vorEnde.length ? vorEnde[vorEnde.length - 1] : kartenTage.length ? kartenTage[0] : seilTagPlus(en.tag, -SEIL.vorlaufTage);
    if (start > seilTagPlus(en.tag, -SEIL.mindestTage)) start = seilTagPlus(en.tag, -SEIL.mindestTage);
    const ankerTag = a ? anker.get(a)!.tag : null;
    const ueberfaellig = !fertig && !en.ohne && en.tag < heute;
    let muendung = ueberfaellig ? heute : en.tag;
    if (ankerTag && muendung > ankerTag) muendung = ankerTag;
    let status: StrangStatus = fertig ? 'erledigt' : vorOffen.length ? 'blockiert' : ueberfaellig ? 'ueberfaellig' : 'offen';
    let grund: string | undefined;
    let blockiertBis: string | undefined;
    if (status === 'blockiert') {
      const ends = vorOffen.map(v => ende.get(v.id)!.tag).sort();
      blockiertBis = ends[ends.length - 1];
      grund = `wartet auf ${zitat(vorOffen[0].titel)}${vorOffen.length > 1 ? ` und ${vorOffen.length - 1} ${vorOffen.length === 2 ? 'weiteren' : 'weitere'}` : ''} (offen, fällig ${kurz(ende.get(vorOffen[0].id)!.tag)})`;
    } else if (status === 'ueberfaellig') {
      grund = `überfällig seit ${kurz(en.tag)}`;
    }
    // Karten: offene, die alle auf Offenes warten, blockieren einen Strang ohne eigene Vorgänger auch.
    const alle = kartenJe.get(s.id) ?? [];
    const kartenWarten = (k: SeilKarteRoh) => (k.wartetAuf ?? []).map(v => karteNach.get(v)).filter((v): v is SeilKarteRoh => !!v && v.status !== 'erledigt');
    const offen = alle.filter(offenK);
    if (status === 'offen' && offen.length && offen.every(k => kartenWarten(k).length > 0)) {
      status = 'blockiert';
      const w = kartenWarten(offen[0])[0];
      grund = `alle offenen Karten warten — u. a. auf ${zitat(w.titel)}`;
      blockiertBis = w.tag;
    }
    const sichtbar = alle.filter(k => istSeilTag(k.tag)).sort((x, y) => x.tag!.localeCompare(y.tag!) || x.id.localeCompare(y.id));
    const gezeigt = sichtbar.slice(0, SEIL.kartenJeStrang);
    const z = s.zielId ? zielNach.get(s.zielId) : undefined;
    straenge[s.id] = {
      id: s.id, art: s.art, titel: s.titel, farbe: s.farbe ?? z?.farbe ?? (a ? seilZiel(a).farbe : OHNE_FARBE), ...(s.link ? { link: s.link } : {}),
      seil: a, ...(z && a && z.id !== a ? { ueber: z.titel } : {}),
      von: start, bis: en.tag, muendung, ohneDatum: en.ohne, fortschritt: Math.round(f * 1000) / 1000, status,
      ...(grund ? { grund } : {}), ...(blockiertBis ? { blockiertBis } : {}),
      nachAnker: !!ankerTag && !en.ohne && en.tag > ankerTag,
      karten: gezeigt.map(k => {
        const w = k.status === 'offen' ? kartenWarten(k) : [];
        return { id: k.id, titel: k.titel, ...(k.tag ? { tag: k.tag } : {}), status: k.status, ...(k.link ? { link: k.link } : {}), blockiert: w.length > 0, ...(w.length ? { grund: `wartet auf ${zitat(w[0].titel)}` } : {}), kritisch: false, ...(k.dringend ? { dringend: true } : {}) };
      }),
      kartenWeitere: alle.length - gezeigt.length,
      marken: (markenJe.get(s.id) ?? []).filter(m => m.tag >= von && m.tag <= bis).sort((x, y) => x.tag.localeCompare(y.tag) || x.id.localeCompare(y.id))
        .map(m => ({ id: m.id, tag: m.tag, art: m.art, titel: m.titel, ...(m.link ? { link: m.link } : {}), ...(m.karte ? { karte: m.karte } : {}) })),
      zahl: { gesamt: zaehlende(s.id).length, erledigt: zaehlende(s.id).filter(k => k.status === 'erledigt').length },
      kritisch: false,
    };
  }

  // Spuren: je Seil die früheste Einmündung unten (Regel 2) — oben die späteste.
  const ordne = (ids: string[]) => ids.sort((a, b) => {
    const x = straenge[a], y = straenge[b];
    return y.muendung.localeCompare(x.muendung) || (strangNach.get(a)!.rang ?? 1e9) - (strangNach.get(b)!.rang ?? 1e9) || x.titel.localeCompare(y.titel, 'de') || a.localeCompare(b);
  });
  const je = new Map<string | null, string[]>();
  for (const s of e.straenge) { const a = straenge[s.id].seil; je.set(a, [...(je.get(a) ?? []), s.id]); }

  // Kanten.
  const kanten: SeilKante[] = [];
  for (const k of karteNach.values()) {
    for (const v of k.wartetAuf ?? []) {
      const vk = karteNach.get(v);
      if (!vk || v === k.id) continue;
      kanten.push({ id: `k:${v}>k:${k.id}`, art: 'karte', von: v, nach: k.id, offen: vk.status !== 'erledigt', kritisch: false, seil: straenge[k.strang].seil });
    }
  }
  for (const s of e.straenge) {
    for (const v of s.wartetAuf ?? []) {
      if (!strangNach.has(v) || v === s.id) continue;
      kanten.push({ id: `s:${v}>s:${s.id}`, art: 'strang', von: v, nach: s.id, offen: straenge[v].status !== 'erledigt', kritisch: false, seil: straenge[s.id].seil });
    }
  }

  // Seile mit Momentum, Schwung, Pfad, Engpass.
  const schwungAb = seilTagPlus(heute, -SEIL.schwungTage);
  const seile: Seil[] = seilIds.map(id => {
    const z = seilZiel(id);
    const ids = ordne(je.get(id) ?? []);
    const l = ids.map(x => straenge[x]);
    const momentum = l.length ? l.reduce((n, s) => n + s.fortschritt, 0) / l.length : Math.max(0, Math.min(1, (z.erledigt ? 100 : z.fortschritt ?? 0) / 100));
    const juengst = [
      ...ids.flatMap(x => kartenJe.get(x) ?? []).filter(k => k.status === 'erledigt' && istSeilTag(k.erledigtAm?.slice(0, 10)) && k.erledigtAm!.slice(0, 10) >= schwungAb && k.erledigtAm!.slice(0, 10) <= heute),
      ...ids.map(x => strangNach.get(x)!).filter(s => s.erledigt && istSeilTag(s.erledigtAm?.slice(0, 10)) && s.erledigtAm!.slice(0, 10) >= schwungAb && s.erledigtAm!.slice(0, 10) <= heute),
    ].length;
    // Pfad über offene Karten („k:“) und offene Stränge („s:“): Karte → Karte, Strang → Strang, Karte → ihr Strang.
    const knoten: PfadKnoten[] = [];
    for (const x of ids) {
      const s = straenge[x];
      const roh = strangNach.get(x)!;
      if (s.status !== 'erledigt') {
        knoten.push({ id: `s:${x}`, tag: s.bis, vor: [...(roh.wartetAuf ?? []).map(v => `s:${v}`), ...(kartenJe.get(x) ?? []).filter(offenK).map(k => `k:${k.id}`)] });
      }
      for (const k of (kartenJe.get(x) ?? []).filter(offenK)) knoten.push({ id: `k:${k.id}`, tag: k.tag, vor: (k.wartetAuf ?? []).filter(v => karteNach.get(v)?.status === 'offen').map(v => `k:${v}`) });
    }
    const kp = kritischerPfad(knoten);
    // Ein kritischer Pfad ist erst einer, wenn eine ausdrückliche Abhängigkeit darin steckt (Karte → Karte oder Strang → Strang) —
    // „Karte → ihr eigener Strang“ allein heißt nur: hier ist noch etwas offen.
    const explizit = (a: string, b: string) => a.slice(0, 2) === b.slice(0, 2);
    const pfad = kp.pfad.some((k, i) => i > 0 && explizit(kp.pfad[i - 1], k)) ? kp.pfad.slice(-SEIL.pfadMax) : [];
    const name = (k: string) => (k.startsWith('k:') ? karteNach.get(k.slice(2))?.titel : strangNach.get(k.slice(2))?.titel) ?? k;
    // Engpass: wer hat die meisten (transitiv) Wartenden — nur über ausdrückliche Abhängigkeiten gezählt.
    const nurExplizit = knoten.map(k => ({ ...k, vor: k.vor.filter(v => explizit(v, k.id)) }));
    let engpass: Seil['engpass'];
    for (const [k, n] of kritischerPfad(nurExplizit).wartende) if (n >= 2 && (!engpass || n > engpass.wartende || (n === engpass.wartende && k < engpass.id))) engpass = { id: k, titel: name(k), wartende: n };
    const letzter = pfad.length ? (pfad[pfad.length - 1].startsWith('s:') ? straenge[pfad[pfad.length - 1].slice(2)]?.bis : karteNach.get(pfad[pfad.length - 1].slice(2))?.tag) : undefined;
    const pfadText = pfad.length > 1 ? `${pfad.map(k => zitat(name(k))).join(' → ')} (${pfad.length} offen${letzter ? `, das letzte Glied fällig ${kurz(letzter)}` : ''})` : undefined;
    const a = anker.get(id)!;
    const fertig = l.filter(s => s.status === 'erledigt').length;
    const ueberfaellig = !z.erledigt && a.art === 'frist' && a.tag < heute;
    const blockiert = l.filter(s => s.status === 'blockiert').length;
    const satz = [
      `${zitat(z.titel)}: ${l.length ? `${fertig} von ${l.length} ${l.length === 1 ? 'Strang' : 'Strängen'} fertig, Momentum ${Math.round(momentum * 100)} %` : 'noch kein Strang zahlt ein'}${blockiert ? `, ${blockiert} blockiert` : ''}${a.art === 'frist' ? `, Frist am ${kurz(a.tag)}${ueberfaellig ? ' (überschritten)' : ''}` : ''}`,
      pfadText ? `Kritischer Pfad: ${pfadText}` : '',
      engpass ? `Engpass: ${zitat(engpass.titel)} — ${engpass.wartende} warten darauf` : '',
    ].filter(Boolean);
    const text = satz.map(x => (x.endsWith('.') ? x : `${x}.`)).join(' ');
    return {
      zielId: id, titel: z.titel, farbe: z.farbe, ...(z.link ? { link: z.link } : {}), rang: z.rang ?? 1e9, space: z.space,
      anker: a.tag, ankerArt: a.art, erledigt: !!z.erledigt, ueberfaellig,
      momentum: Math.round(momentum * 1000) / 1000, schwung: Math.round(schwungAus(juengst) * 1000) / 1000,
      straenge: ids, fertig, pfad, ...(pfadText ? { pfadText } : {}), ...(engpass ? { engpass } : {}), text,
    };
  });
  // Kritisch markieren (Stränge, Karten, Kanten auf dem Pfad).
  for (const s of seile) {
    const auf = new Set(s.pfad);
    if (s.pfad.length < 2) continue;
    for (const k of s.pfad) {
      if (k.startsWith('s:') && straenge[k.slice(2)]) straenge[k.slice(2)].kritisch = true;
      if (k.startsWith('k:')) { const kk = karteNach.get(k.slice(2)); const st = kk && straenge[kk.strang]; const c = st?.karten.find(x => x.id === kk!.id); if (c) c.kritisch = true; }
    }
    for (const kante of kanten) {
      const a = `${kante.art === 'karte' ? 'k' : 's'}:${kante.von}`, b = `${kante.art === 'karte' ? 'k' : 's'}:${kante.nach}`;
      if (auf.has(a) && auf.has(b) && s.pfad.indexOf(b) === s.pfad.indexOf(a) + 1) kante.kritisch = true;
    }
  }
  const ohneZiel = ordne(je.get(null) ?? []);
  const text = seile.length || ohneZiel.length
    ? `${seile.map(s => s.text).join(' ')}${ohneZiel.length ? ` Ohne Ziel: ${ohneZiel.length} ${ohneZiel.length === 1 ? 'Strang' : 'Stränge'}.` : ''}`
    : 'Im Zeitraum zahlt noch nichts auf ein Ziel ein.';
  return { heute, von, bis, seile, ohneZiel, straenge, kanten, text };
}

/** Fokus: die Kennungen (Stränge, Karten) eines Seils — alles andere tritt zurück. */
export function fokusMenge(a: SeilAnsicht, zielId: string | null): { straenge: Set<string>; karten: Set<string> } | null {
  if (!zielId) return null;
  const s = a.seile.find(x => x.zielId === zielId);
  if (!s) return null;
  const straenge = new Set(s.straenge);
  const karten = new Set(s.straenge.flatMap(id => a.straenge[id].karten.map(k => k.id)));
  return { straenge, karten };
}

/** Für die Prüfung: Min/Max zweier Tage (rein). */
export const seilSpanne = (a: string, b: string): { von: string; bis: string } => ({ von: min(a, b), bis: max(a, b) });
