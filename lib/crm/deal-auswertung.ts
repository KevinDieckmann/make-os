// ─── Deal-Ebene — Auswertung (rein, getestet, 27.09.) ───────────────────────
// Was die Pipeline über sich selbst weiß, ohne KI: Prognose nach Monat
// (Entscheidung bis), Verweildauer je Stufe, Umwandlung von Stufe zu Stufe,
// Win/Loss nach Grund, Ø Deal-Größe, Zykluslänge. Mindestmengen, bevor eine
// Quote gezeigt wird — sonst erzählen zwei Deals eine Geschichte, die keine ist.

import type { Chance, ChancenStufe } from './typen';
import { STUFEN, OFFENE_STUFEN, gesamtwert, wahrscheinlichkeit } from './pipeline';

const tage = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 864e5));
export const MINDESTMENGE = 5;

/** Verweildauer je Stufe eines Deals (Tage) — die aktuelle Stufe zählt bis heute. */
export function verweildauer(c: Pick<Chance, 'historie' | 'stufe' | 'angelegt'>, heute: string): { stufe: ChancenStufe; tage: number; von: string; bis?: string }[] {
  const h = c.historie.length ? [...c.historie].sort((a, b) => a.am.localeCompare(b.am)) : [{ stufe: c.stufe, am: c.angelegt, von: '' }];
  return h.map((e, i) => {
    const bis = h[i + 1]?.am;
    return { stufe: e.stufe, tage: tage(e.am, bis ?? heute), von: e.am.slice(0, 10), ...(bis ? { bis: bis.slice(0, 10) } : {}) };
  });
}

/** Ø Verweildauer je offener Stufe über alle Deals, die die Stufe durchlaufen haben. */
export function verweildauerJeStufe(chancen: Chance[], heute: string): { stufe: ChancenStufe; label: string; schnitt: number | null; n: number; laengste: number }[] {
  return STUFEN.filter(s => s.offen).map(s => {
    const l = chancen.flatMap(c => verweildauer(c, heute).filter(v => v.stufe === s.id).map(v => v.tage));
    return { stufe: s.id, label: s.label, schnitt: l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null, n: l.length, laengste: l.length ? Math.max(...l) : 0 };
  });
}

/** Umwandlung Stufe → nächste: wie viele Deals, die die Stufe erreichten, kamen weiter (gewonnen zählt als weiter). */
export function umwandlung(chancen: Chance[]): { von: ChancenStufe; nach: ChancenStufe; erreicht: number; weiter: number; quote: number | null }[] {
  const offen = STUFEN.filter(s => s.offen).map(s => s.id);
  const rang = (s: ChancenStufe) => offen.indexOf(s);
  return offen.slice(0, -1).map((s, i) => {
    const nach = offen[i + 1];
    const erreicht = chancen.filter(c => c.historie.some(h => h.stufe === s) || (rang(c.stufe) > i) || c.stufe === 'gewonnen' && c.historie.some(h => rang(h.stufe) >= i));
    const weiter = erreicht.filter(c => c.stufe === 'gewonnen' || c.historie.some(h => rang(h.stufe) > i));
    return { von: s, nach, erreicht: erreicht.length, weiter: weiter.length, quote: erreicht.length >= MINDESTMENGE ? Math.round((weiter.length / erreicht.length) * 100) : null };
  });
}

/** Win/Loss der letzten `tage` Tage: Gründe, Werte, Quote (ab MINDESTMENGE Entscheidungen). */
export function winLoss(chancen: Chance[], heute: string, tageZurueck = 180): { gewonnen: number; verloren: number; wertGewonnen: number; wertVerloren: number; quote: number | null; gruende: { grund: string; anzahl: number; wert: number }[] } {
  const entschieden = (c: Chance) => c.historie.filter(h => h.stufe === 'gewonnen' || h.stufe === 'verloren').pop()?.am.slice(0, 10);
  const inFenster = chancen.filter(c => { const d = entschieden(c); return d && tage(d, heute) <= tageZurueck; });
  const g = inFenster.filter(c => c.stufe === 'gewonnen'), v = inFenster.filter(c => c.stufe === 'verloren');
  const je = new Map<string, { anzahl: number; wert: number }>();
  for (const c of v) { const k = c.grund?.trim() || 'ohne Grund'; const alt = je.get(k) ?? { anzahl: 0, wert: 0 }; je.set(k, { anzahl: alt.anzahl + 1, wert: alt.wert + gesamtwert(c) }); }
  return {
    gewonnen: g.length, verloren: v.length, wertGewonnen: g.reduce((a, c) => a + gesamtwert(c), 0), wertVerloren: v.reduce((a, c) => a + gesamtwert(c), 0),
    quote: g.length + v.length >= MINDESTMENGE ? Math.round((g.length / (g.length + v.length)) * 100) : null,
    gruende: Array.from(je.entries()).map(([grund, x]) => ({ grund, ...x })).sort((a, b) => b.anzahl - a.anzahl),
  };
}

/** Zyklus: Tage von Anlage bis gewonnen (Median und Schnitt), Ø Deal-Größe der gewonnenen — ab MINDESTMENGE. */
export function zyklus(chancen: Chance[]): { n: number; median: number | null; schnitt: number | null; dealGroesse: number | null } {
  const g = chancen.filter(c => c.stufe === 'gewonnen');
  const laengen = g.map(c => { const bis = c.historie.filter(h => h.stufe === 'gewonnen').pop()?.am ?? c.geaendert; return tage(c.angelegt, bis); }).sort((a, b) => a - b);
  const median = laengen.length ? laengen[Math.floor(laengen.length / 2)] : null;
  const werte = g.map(gesamtwert).filter(w => w > 0);
  return {
    n: g.length,
    median: g.length >= MINDESTMENGE ? median : null,
    schnitt: g.length >= MINDESTMENGE ? Math.round(laengen.reduce((a, b) => a + b, 0) / laengen.length) : null,
    dealGroesse: werte.length >= 3 ? Math.round(werte.reduce((a, b) => a + b, 0) / werte.length) : null,
  };
}

/** Prognose nach Monat der erwarteten Entscheidung — offene Deals; ohne Datum in „offen“. */
export function prognoseNachMonat(chancen: Chance[], heute: string, eigene?: Partial<Record<ChancenStufe, number>>, monate = 6): { monat: string; label: string; anzahl: number; wert: number; gewichtet: number }[] {
  const offen = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const start = heute.slice(0, 7);
  const liste: { monat: string; label: string; anzahl: number; wert: number; gewichtet: number }[] = [];
  const d = new Date(`${start}-01T12:00:00Z`);
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  for (let i = 0; i < monate; i++) {
    const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    liste.push({ monat: m, label: `${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, anzahl: 0, wert: 0, gewichtet: 0 });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  const rest = { monat: 'offen', label: 'ohne Datum / später', anzahl: 0, wert: 0, gewichtet: 0 };
  for (const c of offen) {
    const w = gesamtwert(c), g = Math.round(w * wahrscheinlichkeit(c.stufe, eigene) / 100);
    const m = c.erwartetAm?.slice(0, 7);
    const ziel = (m && (m < start ? liste[0] : liste.find(x => x.monat === m))) || rest;
    ziel.anzahl++; ziel.wert += w; ziel.gewichtet += g;
  }
  return [...liste, rest];
}

/** Der Anteil des Pipeline-Werts, der hängt (rot) — nach Wert, nicht nach Anzahl. */
export function haengtNachWert(chancen: Chance[], ampel: Record<string, { ampel: string }>): { anteil: number | null; wert: number; gesamt: number } {
  const offen = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe));
  const gesamt = offen.reduce((a, c) => a + gesamtwert(c), 0);
  const wert = offen.filter(c => ampel[c.id]?.ampel === 'rot').reduce((a, c) => a + gesamtwert(c), 0);
  return { anteil: gesamt > 0 ? Math.round((wert / gesamt) * 100) : null, wert, gesamt };
}
