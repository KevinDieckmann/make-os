// ─── Lichtfäden v2 — Baum, Dichte und Ansicht (03.10.2026, rein, client-sicher) ─
// Aus Knoten und Strängen (modell.ts) wird EIN Baum: gesamt → space → thema → ziel → meilenstein. Jeder Strang hängt am
// letzten Knoten seines Pfads; die Last eines Knotens ist die Summe aller Stränge darunter („alles läuft auf das größte
// Ziel zusammen“). Eine ANSICHT ist ein Ausschnitt: Wurzelknoten + Zeitraum + Person. Gezeichnet werden die KINDER der
// Wurzel als Bündel — oben wenige dicke Bündel (Spaces), unten viele feine Fäden (an einem Meilenstein: jeder Strang ein
// eigener Faden). Das ist das LOD-Prinzip.
//
// Dichte je Bündel und Woche (deterministisch, wie v1):
//   1. roh  = Summe der Gewichte je Woche (Montag); ein überfälliger offener Strang zählt in der Woche von HEUTE (er bindet
//      JETZT Aufmerksamkeit), eine Spanne in jeder berührten Woche (höchstens SPANNE_MAX_WOCHEN).
//   2. Gauß-geglättet (σ = DICHTE_SIGMA Wochen, mit Rand gerechnet, damit die Fensterränder stimmen).
//   3. weich gesättigt mit `halb` = max(DICHTE_HALB, Mittel der geglätteten Werte > 0 in dieser Ansicht): eine
//      durchschnittliche Woche fächert halb auf, Spitzen gehen gegen 1 — auf jeder Ebene, ob 3 oder 300 Stränge.
// Tests: tests/lichtfaeden-baum.test.ts.

import { gauss, saettigen } from './band';
import { STRAHL } from './strahl';
import { abweichungenAusStraengen, abweichungText, ausschlagJeWoche, type Abweichung } from './abweichung';
import {
  BEIDE, BELEGT_FARBE, GESAMT, OHNE_FARBE, QUELLEN, SPACE_FADEN, SPACE_NAME, THEMEN, istGueltig, knotenId, passtZuPerson,
  type Knoten, type KnotenArt, type PersonSicht, type Strang, type StrangQuelle,
} from './modell';
import type { SpaceId } from '@/lib/make-one/space-regeln';

export const DICHTE_SIGMA = 2;
export const DICHTE_HALB = 0.6;
/** Eine Spanne (Abwesenheit, mehrtägiges Event) zählt in höchstens so vielen Wochen. */
export const SPANNE_MAX_WOCHEN = 12;
/** Höchstens so viele Bündel je Ansicht — der Rest fließt in „Weitere“. Auf Strang-Ebene (Blätter) mehr, aber feiner. */
export const MAX_BUENDEL = 7;
/** Blatt-Ebene: jeder Strang eine eigene Spur — höchstens so viele (Strahl ruhig, 04.10. abends: vorher 24). */
export const MAX_STRANG_BUENDEL = 12;
/** Fäden je Bündel ∝ √Last, gedeckelt je Leinwand — die Werte stehen in `STRAHL.faeden` (lib/lichtfaeden/strahl.ts, eine Stelle). */
export const FAEDEN = STRAHL.faeden;
/** Höchstens so viele Abweichungen nennt eine Ansicht im Text (die schwersten). */
export const MAX_ABWEICHUNGEN_TEXT = 8;
/** Höchstens so viele Markierungen (Knöpfe über dem Band) je Ansicht — nach Gewicht, dann Datum. */
export const MAX_MARKEN = 40;

/** Glättungsrand in Wochen vor und nach dem Fenster (Gauß reicht 3 σ weit). */
export const RASTER_RAND = Math.ceil(DICHTE_SIGMA * 3) + 1;
const RAND = RASTER_RAND;
const TAG_MS = 864e5;
const tagMs = (t: string) => Date.parse(`${t}T00:00:00Z`);
const tagAus = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Montag der Woche eines Tages. */
export function montag(tag: string): string {
  const ms = tagMs(tag);
  return tagAus(ms - ((new Date(ms).getUTCDay() + 6) % 7) * TAG_MS);
}
/** ISO-Kalenderwoche eines Tages. */
export function kalenderwoche(tag: string): number {
  const d = new Date(tagMs(tag));
  const wt = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wt + 3); // Donnerstag derselben Woche
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / TAG_MS - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}

// ── Baum ─────────────────────────────────────────────────────────────────────

export interface Baum {
  knoten: ReadonlyMap<string, Knoten>;
  /** Kinder je Knoten, sortiert nach Rang, dann Name. */
  kinder: ReadonlyMap<string, readonly string[]>;
  /** Alle gültigen Stränge, Pfad auf bekannte Knoten gekürzt. */
  straenge: readonly Strang[];
}

/** Die festen oberen Ebenen: gesamt, die zwei Spaces und ihre Themen. */
export function grundKnoten(): Knoten[] {
  const aus: Knoten[] = [{ id: GESAMT, art: 'gesamt', name: 'Gesamt', farbe: OHNE_FARBE, rang: 0 }];
  (['business', 'privat'] as SpaceId[]).forEach((s, i) => {
    aus.push({ id: knotenId.space(s), art: 'space', name: SPACE_NAME[s], farbe: SPACE_FADEN[s], eltern: GESAMT, rang: i });
    THEMEN[s].forEach((t, j) => aus.push({ id: knotenId.thema(s, t.id), art: 'thema', name: t.name, farbe: t.farbe, eltern: knotenId.space(s), rang: j }));
  });
  return aus;
}

/** Baum aus zusätzlichen Knoten (Ziele, Meilensteine der Adapter) und Strängen. Unbekannte Knoten im Pfad kürzen ihn. */
export function baueBaum(zusatz: readonly Knoten[], straenge: readonly Strang[]): Baum {
  const knoten = new Map<string, Knoten>();
  for (const k of grundKnoten()) knoten.set(k.id, k);
  for (const k of zusatz) if (!knoten.has(k.id) && k.eltern) knoten.set(k.id, k);
  // Knoten, deren Eltern fehlen, hängen nicht in der Luft: sie fallen weg (und mit ihnen die Pfad-Enden).
  let geaendert = true;
  while (geaendert) {
    geaendert = false;
    for (const [id, k] of knoten) if (k.eltern && !knoten.has(k.eltern)) { knoten.delete(id); geaendert = true; }
  }
  const kinder = new Map<string, string[]>();
  for (const k of knoten.values()) {
    if (!k.eltern) continue;
    const l = kinder.get(k.eltern);
    if (l) l.push(k.id); else kinder.set(k.eltern, [k.id]);
  }
  for (const [id, l] of kinder) kinder.set(id, l.sort((a, b) => vergleiche(knoten.get(a)!, knoten.get(b)!)));
  const gueltig: Strang[] = [];
  const gesehen = new Set<string>();
  for (const s of straenge) {
    if (!istGueltig(s) || gesehen.has(s.id)) continue;
    gesehen.add(s.id);
    // Pfad bis zum letzten bekannten, zusammenhängenden Knoten (jedes Glied Kind des vorigen).
    const pfad: string[] = [GESAMT];
    for (let i = 1; i < s.pfad.length; i++) {
      const k = knoten.get(s.pfad[i]);
      if (!k || k.eltern !== pfad[pfad.length - 1]) break;
      pfad.push(k.id);
    }
    if (pfad.length < 2) continue;
    gueltig.push(pfad.length === s.pfad.length ? s : { ...s, pfad });
  }
  return { knoten, kinder, straenge: gueltig };
}

const vergleiche = (a: Knoten, b: Knoten) => a.rang - b.rang || a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id);

/** Brotkrumen: von „gesamt“ bis zum Knoten. */
export function pfadZu(baum: Baum, id: string): Knoten[] {
  const aus: Knoten[] = [];
  let k = baum.knoten.get(id);
  for (let i = 0; k && i < 12; i++) { aus.unshift(k); k = k.eltern ? baum.knoten.get(k.eltern) : undefined; }
  return aus;
}

// ── Raster & Dichte ──────────────────────────────────────────────────────────

export interface Raster {
  von: string;
  bis: string;
  /** Montag jeder Woche, die das Fenster berührt. */
  wochen: string[];
}
export function raster(von: string, bis: string): Raster {
  const wochen: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(von) || !/^\d{4}-\d{2}-\d{2}$/.test(bis) || bis < von) return { von, bis, wochen };
  for (let ms = tagMs(montag(von)), i = 0; tagAus(ms) <= bis && i < 600; ms += 7 * TAG_MS, i++) wochen.push(tagAus(ms));
  return { von, bis, wochen };
}

/** In welche Wochen (Index im Raster, mit Rand) fällt ein Strang? Überfällig → Woche von heute. Leer = außerhalb. */
export function wochenVon(s: Pick<Strang, 'zeit' | 'status'>, r: Raster, heute: string): number[] {
  if (!r.wochen.length) return [];
  const basis = tagMs(r.wochen[0]) - RAND * 7 * TAG_MS;
  const laenge = r.wochen.length + 2 * RAND;
  const idx = (tag: string) => Math.floor((tagMs(tag) - basis) / (7 * TAG_MS));
  const start = s.status === 'ueberfaellig' && heute > s.zeit.tag ? heute : s.zeit.tag;
  const ende = s.zeit.bis && s.zeit.bis > start ? s.zeit.bis : start;
  const a = idx(start), b = Math.min(idx(ende), a + SPANNE_MAX_WOCHEN - 1);
  const aus: number[] = [];
  for (let i = Math.max(0, a); i <= b && i < laenge; i++) aus.push(i);
  return aus;
}

/** Ungeglättete Gewichte je Woche (mit Rand) für eine Menge Stränge. */
function rohMitRand(straenge: readonly Strang[], r: Raster, heute: string): number[] {
  const w = new Array<number>(r.wochen.length + 2 * RAND).fill(0);
  for (const s of straenge) for (const i of wochenVon(s, r, heute)) w[i] += s.gewicht;
  return w;
}
const schneiden = (w: readonly number[], n: number) => w.slice(RAND, RAND + n);
const rund = (v: number) => Math.round(v * 1000) / 1000;

// ── Ansicht ──────────────────────────────────────────────────────────────────

export type BuendelArt = KnotenArt | 'direkt' | 'rest' | 'strang';
export interface Buendel {
  /** Knoten-Kennung, „direkt:<wurzel>“, „rest“ oder „strang:<id>“. */
  id: string;
  art: BuendelArt;
  name: string;
  farbe: string;
  /** Wohin „eine Ebene tiefer“ führt (Knoten-Kennung) — fehlt, wenn es darunter nichts mehr aufzufächern gibt. */
  tiefer?: string;
  /** Detailseite (Ziel, Meilenstein, Strang). */
  link?: string;
  /** Gewicht je Woche (ungeglättet) — für Text und Nachvollzug. */
  roh: number[];
  /** Dichte je Woche 0 … 1 (geglättet, gesättigt) — treibt Spreizung und Leuchten. */
  dichte: number[];
  /** Ausschlag je Woche 0 … 1 — NUR aus echten Abweichungen (lib/lichtfaeden/abweichung.ts); ohne Abweichung überall 0. */
  ausschlag: number[];
  summe: number;
  /** Stränge im Bündel (im Fenster). */
  anzahl: number;
  /** Fäden für die Leinwand (Rechner; `faedenDeckeln` passt fürs Handy an). */
  faeden: number;
}
export interface Marke {
  id: string;
  tag: string;
  titel: string;
  quelle: StrangQuelle;
  symbol: string;
  buendel: string;
  farbe: string;
  link?: string;
  erledigt: boolean;
}
/** Eine Abweichung, wie die Ansicht sie nennt (Text unter dem Band, Vorleser) — private der anderen Person nur „Belegt“. */
export interface AbweichungKurz { id: string; art: Abweichung['art']; titel: string; von: string; staerke: number; buendel: string; text: string; /** Ort zum Handeln (fehlt bei „Belegt“). */ link?: string }
export interface Ansicht {
  wurzel: Knoten;
  /** Brotkrumen von „gesamt“ bis zur Wurzel. */
  pfad: Knoten[];
  von: string;
  bis: string;
  wochen: string[];
  buendel: Buendel[];
  marken: Marke[];
  /** Summe aller Bündel je Woche (ungeglättet). */
  gesamt: number[];
  summe: number;
  anzahl: number;
  /** Die Abweichungen dieser Ansicht (schwerste zuerst, höchstens MAX_ABWEICHUNGEN_TEXT) — der Grund jedes Ausschlags. */
  abweichungen: AbweichungKurz[];
}
export interface AnsichtOptionen {
  wurzel: string; von: string; bis: string; heute: string; person: PersonSicht;
  /** Abweichungen (Route: `abweichungenSammeln` samt angedockter Quellen); fehlt = nur die aus den Strängen des Baums. */
  abweichungen?: readonly Abweichung[];
}

/** Die Stränge einer Ansicht (im Unterbaum der Wurzel, passend zur Person, im Fenster samt Glättungsrand). */
export function straengeImBlick(baum: Baum, o: AnsichtOptionen): Strang[] {
  const r = raster(o.von, o.bis);
  return baum.straenge.filter(s => s.pfad.includes(o.wurzel) && passtZuPerson(s, o.person) && wochenVon(s, r, o.heute).length > 0);
}

/** Welches Kind der Wurzel trägt einen Strang? (Knoten-Kennung oder „direkt:<wurzel>“) */
function kindVon(s: Strang, wurzel: string): string {
  const i = s.pfad.indexOf(wurzel);
  return i >= 0 && i + 1 < s.pfad.length ? s.pfad[i + 1] : `direkt:${wurzel}`;
}

/** Name des Bündels direkt an der Wurzel (Stränge ohne tiefere Zuordnung). */
function direktName(art: KnotenArt, nurBelegt: boolean): string {
  if (nurBelegt) return 'Belegt';
  return art === 'thema' ? 'Ohne Ziel' : art === 'ziel' ? 'Ohne Meilenstein' : art === 'space' ? 'Ohne Thema' : art === 'meilenstein' ? 'Am Meilenstein' : 'Übergreifend';
}

/**
 * Die Ansicht: Kinder der Wurzel als Bündel (mit Dichte, Fäden, Tiefer-Ziel), Markierungen, Summen. Hat die Wurzel keine
 * Kind-Knoten mit Strängen (Meilenstein, leeres Ziel), werden die Stränge selbst zu feinen Fäden (Blatt-Ebene).
 */
export interface AnsichtErgebnis {
  ansicht: Ansicht;
  /** Die Stränge der Ansicht (für Engstellen) und welches Bündel jeden trägt. */
  straenge: Strang[];
  buendelVon: (s: Strang) => string;
}
export function rechneAnsicht(baum: Baum, o: AnsichtOptionen): AnsichtErgebnis | null {
  const wurzel = baum.knoten.get(o.wurzel);
  if (!wurzel) return null;
  const r = raster(o.von, o.bis);
  const n = r.wochen.length;
  const im = straengeImBlick(baum, o);
  const imFenster = (s: Strang) => wochenVon(s, r, o.heute).some(i => i >= RAND && i < RAND + n);

  // Gruppen: Kind-Knoten bzw. „direkt“.
  const gruppen = new Map<string, Strang[]>();
  for (const s of im) {
    const k = kindVon(s, wurzel.id);
    const l = gruppen.get(k);
    if (l) l.push(s); else gruppen.set(k, [s]);
  }
  const nurDirekt = [...gruppen.keys()].every(k => k.startsWith('direkt:'));
  const blatt = nurDirekt && (gruppen.get(`direkt:${wurzel.id}`)?.length ?? 0) > 0 && (wurzel.art === 'meilenstein' || wurzel.art === 'ziel' || wurzel.art === 'thema');

  type Roh = { id: string; art: BuendelArt; name: string; farbe: string; tiefer?: string; link?: string; straenge: Strang[]; rang: number };
  let roh: Roh[] = [];
  if (blatt) {
    // Blatt-Ebene: jeder Strang ein feiner Faden (in der Farbe der Wurzel, leicht abgestuft).
    const liste = [...gruppen.values()].flat().sort((a, b) => a.zeit.tag.localeCompare(b.zeit.tag) || a.id.localeCompare(b.id));
    roh = liste.map((s, i) => ({ id: `strang:${s.id}`, art: 'strang', name: s.titel, farbe: s.quelle === 'belegt' ? BELEGT_FARBE : abstufen(wurzel.farbe, i), link: s.link, straenge: [s], rang: i }));
  } else {
    for (const [k, l] of gruppen) {
      if (k.startsWith('direkt:')) {
        const nurBelegt = l.every(s => s.quelle === 'belegt');
        roh.push({ id: k, art: 'direkt', name: direktName(wurzel.art, nurBelegt), farbe: nurBelegt ? BELEGT_FARBE : OHNE_FARBE, straenge: l, rang: 1e6 });
      } else {
        const kn = baum.knoten.get(k)!;
        roh.push({ id: k, art: kn.art, name: kn.name, farbe: themaFarbe(baum, kn), tiefer: k, link: kn.link, straenge: l, rang: kn.rang });
      }
    }
    roh.sort((a, b) => a.rang - b.rang || a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id));
  }
  // Deckel: die schwersten bleiben (Reihenfolge danach wie vorher), der Rest fließt in „Weitere“.
  const max = blatt ? MAX_STRANG_BUENDEL : MAX_BUENDEL;
  if (roh.length > max) {
    const last = (x: Roh) => x.straenge.reduce((s, y) => s + y.gewicht, 0);
    const behalten = new Set([...roh].sort((a, b) => last(b) - last(a) || a.rang - b.rang || a.id.localeCompare(b.id)).slice(0, max - 1).map(x => x.id));
    const rest = roh.filter(x => !behalten.has(x.id));
    roh = [...roh.filter(x => behalten.has(x.id)), { id: 'rest', art: 'rest', name: `Weitere (${rest.length})`, farbe: OHNE_FARBE, straenge: rest.flatMap(x => x.straenge), rang: 2e6 }];
  }

  // Dichte: geglättet mit Rand, Sättigung je Ansicht. Die Wochengewichte je Bündel werden EINMAL gerechnet.
  const ungeglaettet = roh.map(x => rohMitRand(x.straenge, r, o.heute));
  const geglaettet = ungeglaettet.map(w => gauss(w, DICHTE_SIGMA));
  const werte = geglaettet.flatMap(g => schneiden(g, n)).filter(v => v > 0.05);
  const halb = Math.max(DICHTE_HALB, werte.length ? werte.reduce((s, v) => s + v, 0) / werte.length : 0);
  // Ausschlag: NUR aus Abweichungen — jede am Bündel ihres Kind-Knotens (Blatt-Ebene: an ihrem Strang), Personen-Sicht wie die Stränge.
  const alleAbw = (o.abweichungen ?? abweichungenAusStraengen(baum.straenge, o.heute))
    .filter(a => a.pfad.includes(wurzel.id) && passtZuPerson(a, o.person));
  const abwBuendel = (a: Abweichung): string | null => {
    if (blatt) return a.strang && roh.some(x => x.id === `strang:${a.strang}`) ? `strang:${a.strang}` : null;
    const i = a.pfad.indexOf(wurzel.id);
    const k = i >= 0 && i + 1 < a.pfad.length ? a.pfad[i + 1] : `direkt:${wurzel.id}`;
    return roh.some(x => x.id === k) ? k : roh.some(x => x.id === 'rest') ? 'rest' : null;
  };
  const abwJe = new Map<string, Abweichung[]>();
  for (const a of alleAbw) { const b = abwBuendel(a); if (b) abwJe.set(b, [...(abwJe.get(b) ?? []), a]); }
  const summen = roh.map(x => x.straenge.filter(imFenster).reduce((s, y) => s + y.gewicht, 0));
  const maxSumme = Math.max(1e-9, ...summen);
  let buendel: Buendel[] = roh.map((x, i) => {
    const rohW = schneiden(ungeglaettet[i], n).map(rund);
    const faeden = blatt
      ? Math.round(FAEDEN.strangMin + (FAEDEN.strangMax - FAEDEN.strangMin) * Math.min(1, x.straenge[0].gewicht / 3))
      : Math.round(FAEDEN.min + (FAEDEN.max - FAEDEN.min) * Math.sqrt(summen[i] / maxSumme));
    const darunter = x.tiefer ? hatDarunter(baum, x.tiefer) : false;
    return {
      id: x.id, art: x.art, name: x.name, farbe: x.farbe, ...(x.tiefer && (darunter || x.straenge.length > 1) ? { tiefer: x.tiefer } : {}), ...(x.link ? { link: x.link } : {}),
      roh: rohW, dichte: schneiden(geglaettet[i], n).map(v => rund(saettigen(v, halb))), ausschlag: ausschlagJeWoche(abwJe.get(x.id) ?? [], r.wochen), summe: rund(summen[i]), anzahl: x.straenge.filter(imFenster).length, faeden,
    };
  });
  buendel = faedenDeckeln(buendel, FAEDEN.deckel.rechner);

  // Markierungen: Stränge mit „marke“ (Meilensteine, Ziel-Fristen, Events, Fristen …), im Fenster, nach Gewicht gedeckelt.
  const farbeVon = new Map(buendel.map(b => [b.id, b.farbe]));
  const zuBuendel = new Map<string, string>();
  for (const x of roh) { const id = farbeVon.has(x.id) ? x.id : 'rest'; for (const s of x.straenge) zuBuendel.set(s.id, id); }
  const marken: Marke[] = im
    .filter(s => QUELLEN[s.quelle].marke && s.zeit.tag >= o.von && s.zeit.tag <= o.bis)
    .sort((a, b) => b.gewicht - a.gewicht || a.zeit.tag.localeCompare(b.zeit.tag) || a.id.localeCompare(b.id))
    .slice(0, MAX_MARKEN)
    .sort((a, b) => a.zeit.tag.localeCompare(b.zeit.tag) || a.id.localeCompare(b.id))
    .map(s => {
      const b = zuBuendel.get(s.id) ?? 'rest';
      return { id: s.id, tag: s.zeit.tag, titel: s.titel, quelle: s.quelle, symbol: QUELLEN[s.quelle].symbol, buendel: b, farbe: farbeVon.get(b) ?? OHNE_FARBE, ...(s.link ? { link: s.link } : {}), erledigt: s.status === 'erledigt' };
    });

  const gesamt = r.wochen.map((_, i) => rund(buendel.reduce((s, b) => s + b.roh[i], 0)));
  const abweichungen: AbweichungKurz[] = [...abwJe.entries()]
    .flatMap(([b, l]) => l.map(a => ({ id: a.id, art: a.art, titel: a.titel, von: a.von, staerke: a.staerke, buendel: b, text: abweichungText(a), ...(a.link ? { link: a.link } : {}) })))
    .filter(a => (a.von <= o.bis))
    .sort((a, b) => b.staerke - a.staerke || a.von.localeCompare(b.von) || a.id.localeCompare(b.id))
    .slice(0, MAX_ABWEICHUNGEN_TEXT);
  return {
    ansicht: {
      wurzel, pfad: pfadZu(baum, wurzel.id), von: o.von, bis: o.bis, wochen: r.wochen, buendel, marken, gesamt,
      summe: rund(buendel.reduce((s, b) => s + b.summe, 0)), anzahl: buendel.reduce((s, b) => s + b.anzahl, 0), abweichungen,
    },
    straenge: im,
    buendelVon: s => zuBuendel.get(s.id) ?? 'rest',
  };
}

/** Nur die Ansicht (ohne Stränge). */
export const ansicht = (baum: Baum, o: AnsichtOptionen): Ansicht | null => rechneAnsicht(baum, o)?.ansicht ?? null;

/**
 * Farbe eines Bündels (Kevin 04.10. abends: „Farben nur je Ziel“): Ein Thema trägt die Farbe seines ersten Ziels (Rang — die
 * Farbe rechnet der Server, `zielFarben`); ein Thema ohne Ziel bleibt in seiner Themenfarbe. Alle anderen Knoten wie gehabt.
 */
function themaFarbe(baum: Baum, kn: Knoten): string {
  if (kn.art !== 'thema') return kn.farbe;
  const erstes = (baum.kinder.get(kn.id) ?? []).map(id => baum.knoten.get(id)).find(k => k?.art === 'ziel');
  return erstes?.farbe ?? kn.farbe;
}

/** Gibt es unter einem Knoten noch etwas aufzufächern (Kind-Knoten oder mehrere Stränge)? */
function hatDarunter(baum: Baum, id: string): boolean {
  return (baum.kinder.get(id)?.length ?? 0) > 0;
}

/** Fäden auf einen Deckel je Leinwand bringen (anteilig, mindestens 1 je Bündel). Handy: `FAEDEN.deckel.handy`. */
export function faedenDeckeln<T extends { faeden: number }>(buendel: readonly T[], deckel: number): T[] {
  const summe = buendel.reduce((s, b) => s + b.faeden, 0);
  if (summe <= deckel) return buendel.slice();
  const f = deckel / summe;
  return buendel.map(b => ({ ...b, faeden: Math.max(1, Math.floor(b.faeden * f)) }));
}

/** Eine Farbe leicht abstufen (Blatt-Ebene: viele Fäden einer Wurzel): Farbton in kleinen Schritten drehen, deterministisch. */
export function abstufen(hex: string, i: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || i === 0) return hex;
  const n = parseInt(m[1], 16);
  let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360 + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 14)) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m0 = l - c / 2;
  [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (v: number) => Math.round(Math.max(0, Math.min(1, v + m0)) * 255).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/** Das Textäquivalent einer Ansicht (Vorleser): je Bündel Last und dichteste Woche. */
export function ansichtText(a: Ansicht): string {
  const kurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
  const ebene = a.pfad.map(k => k.name).join(' › ');
  if (!a.buendel.length) return `Lichtfäden ${ebene}: nichts Terminiertes im Zeitraum.`;
  const teile = a.buendel.map(b => {
    if (!(b.summe > 0)) return `${b.name}: ruhig`;
    let best = 0;
    b.dichte.forEach((v, i) => { if (v > b.dichte[best]) best = i; });
    return `${b.name}: ${b.anzahl} ${b.anzahl === 1 ? 'Strang' : 'Stränge'}, am dichtesten in der Woche ab ${kurz(a.wochen[best])}`;
  });
  const abw = a.abweichungen.length ? ` Abweichungen vom Plan: ${a.abweichungen.map(x => x.text).join('; ')}.` : ' Alles im Plan — keine Abweichung.';
  return `Lichtfäden ${ebene}, ${a.anzahl} ${a.anzahl === 1 ? 'Strang' : 'Stränge'} im Zeitraum. ${teile.join('. ')}.${abw}`;
}

/** Wer steckt in einem Bündel? (für Prüfungen und die Route) — die Personen-Sicht „alle“ inklusive BEIDE. */
export const personenSicht = (person: string | null): PersonSicht => (person && person !== BEIDE ? { art: 'person', person } : { art: 'alle' });
