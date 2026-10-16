// ─── Unternehmen › Schild: Struktur & Cap-Table als Bild (rein, client-sicher, 10.10.) ───────────────────────────────
// Aus dem Gesellschafts-Register (eine Quelle — `gesellschafter[]`, `beteiligungen[]`, nichts doppelt gespeichert): Anteile und
// Stimmrechte je Gesellschaft (1 € Nennbetrag = 1 Stimme, § 47 Abs. 2 GmbHG; stimmrechtslose Anteile zählen nicht), durchgerechnete
// Beteiligung über Holding-Ketten (wirtschaftlich Berechtigte > 25 %, § 3 GwG — Hinweis für das Transparenzregister), Historie der
// Ein-/Austritte und ein geschichtetes Organigramm (Gesellschafter oben, eigene Gesellschaften darunter, fremde Beteiligungen unten).
// Die Lage rechnet NUR hier; das Bild (components/os/unternehmen/schild/Struktur.tsx) zeichnet nur.

import { ORGAN_FUNKTIONEN, aktiveEintraege, anteile, anzeigeName, type Bezug, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { imPapierkorb } from '@/lib/eintraege/sicher';
import { localDay } from '@/lib/zeit';
import { ereignisDef } from './pflichten';
import type { SchildGesellschaft } from './typen';

export interface CapZeile { wer: Bezug; nennbetragCent: number; anteil: number; stimmen: number; ohneStimmrecht: boolean; einlage: string; eingetretenAm?: string }
export interface CapTable { zeilen: CapZeile[]; summeCent: number; stimmenSummeCent: number; hinweis?: string }

/** Anteile (aus `anteile`) und Stimmen je Gesellschafter. Stimmen auf zwei Nachkommastellen, Summe 100 bzw. 0. */
export function capTable(g: Pick<RegisterGesellschaft, 'gesellschafter' | 'stammkapitalCent'>): CapTable {
  const a = anteile(g);
  const stimmBasis = a.zeilen.filter(z => !z.g.ohneStimmrecht).reduce((n, z) => n + Math.max(0, z.g.nennbetragCent || 0), 0);
  const zeilen = a.zeilen.map(z => ({
    wer: z.g.wer, nennbetragCent: z.g.nennbetragCent, anteil: z.prozent, ohneStimmrecht: !!z.g.ohneStimmrecht, einlage: z.g.einlage,
    stimmen: z.g.ohneStimmrecht || !stimmBasis ? 0 : Math.round((Math.max(0, z.g.nennbetragCent) * 10_000) / stimmBasis) / 100,
    ...(z.g.eingetretenAm ? { eingetretenAm: z.g.eingetretenAm } : {}),
  }));
  return { zeilen, summeCent: a.summeCent, stimmenSummeCent: stimmBasis, ...(a.hinweis ? { hinweis: a.hinweis } : {}) };
}

export interface Durchgerechnet { wer: Bezug; prozent: number; ueber: string[]; wirtschaftlichBerechtigt: boolean }

/**
 * Wer hält eine Gesellschaft — durchgerechnet über Ketten eigener Gesellschaften (Holding): Personen, Kontakte und fremde Firmen mit dem
 * multiplizierten Anteil; „wirtschaftlich berechtigt“ ab mehr als 25 % (§ 3 Abs. 2 GwG — Kontrolle über Stimmrechte o. Ä. ist hier nicht
 * abgebildet, nur der Kapitalanteil: Hinweis, keine Rechtsberatung). Kreise laufen nicht endlos.
 */
export function durchgerechnet(id: string, alle: readonly RegisterGesellschaft[]): Durchgerechnet[] {
  const da = alle.filter(g => !imPapierkorb(g));
  const summe = new Map<string, { wer: Bezug; prozent: number; ueber: string[] }>();
  const lauf = (gid: string, faktor: number, pfad: string[]) => {
    const g = da.find(x => x.id === gid);
    if (!g || pfad.includes(gid) || pfad.length > 8) return;
    for (const z of anteile(g).zeilen) {
      const p = faktor * z.prozent / 100;
      if (z.g.wer.art === 'gesellschaft' && da.some(x => x.id === z.g.wer.id)) { lauf(z.g.wer.id, p, [...pfad, gid]); continue; }
      const k = `${z.g.wer.art}:${z.g.wer.id}`;
      const alt = summe.get(k);
      summe.set(k, { wer: z.g.wer, prozent: (alt?.prozent ?? 0) + p * 100, ueber: alt?.ueber.length ? alt.ueber : [...pfad, gid].slice(1) });
    }
  };
  lauf(id, 1, []);
  return Array.from(summe.values()).map(x => ({ ...x, prozent: Math.round(x.prozent * 100) / 100, wirtschaftlichBerechtigt: x.prozent > 25 }))
    .sort((a, b) => b.prozent - a.prozent);
}

export interface HistorieEintrag { tag: string; text: string }
/** Historie der Gesellschafter-Struktur: Ein-/Austritte (Register), Anteils- und Kapitalereignisse und Fassungen der Gesellschafterliste (Schild). */
export function strukturHistorie(g: RegisterGesellschaft, s: SchildGesellschaft | null | undefined, name: (b: Bezug) => string): HistorieEintrag[] {
  const raus: HistorieEintrag[] = [];
  for (const x of aktiveEintraege(g.gesellschafter)) {
    if (x.eingetretenAm) raus.push({ tag: x.eingetretenAm, text: `${name(x.wer)} tritt ein` });
    if (x.ausgeschiedenAm) raus.push({ tag: x.ausgeschiedenAm, text: `${name(x.wer)} scheidet aus` });
  }
  for (const e of aktiveEintraege(s?.ereignisse)) if (e.art === 'anteilsuebertragung' || e.art === 'kapitalmassnahme') raus.push({ tag: e.datum, text: ereignisDef(e.art)?.label ?? e.art });
  for (const d of aktiveEintraege(s?.dokumente)) if (d.art === 'gesellschafterliste' && d.fassungVom && d.status === 'vorhanden') raus.push({ tag: d.fassungVom, text: 'Gesellschafterliste (neue Fassung)' });
  if (g.gegruendetAm) raus.push({ tag: g.gegruendetAm, text: 'Gründung' });
  return raus.sort((a, b) => b.tag.localeCompare(a.tag) || a.text.localeCompare(b.text, 'de'));
}

// ── Organigramm ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface OrgKnoten { schluessel: string; art: Bezug['art'] | 'fremd'; id: string; label: string; ebene: number; x: number; y: number; eigen: boolean; status?: string }
/**
 * `punkte` (16.10., Abnahme 2 · C10): Zwischenpunkte einer Linie, die über mehr als eine Reihe läuft — sie führt durch einen freien Platz der
 * Reihe dazwischen, nie hinter einem Kasten durch. `inhaber`: die Linie vom Inhaber zum Einzelunternehmen (Beschriftung „Inhaber“ statt %).
 */
export interface OrgKante { von: string; zu: string; anteil: number; stimmen?: number; fremd?: true; inhaber?: true; punkte?: { x: number; y: number }[] }
export interface Organigramm { knoten: OrgKnoten[]; kanten: OrgKante[]; breite: number; hoehe: number }

/** Maße des Bilds (Pixel im SVG-Koordinatensystem) — eine Stelle. */
export const ORG_MASS = { breite: 196, hoehe: 56, abstandX: 28, abstandY: 92, rand: 16 } as const;

/**
 * Geschichtetes Organigramm (rein): Ebene 0 = wer keine eigene Gesellschaft ist und Anteile hält (Personen, Kontakte, Firmen); eigene
 * Gesellschaften eine Ebene unter ihrem tiefsten eigenen Gesellschafter; fremde Beteiligungen eine Ebene unter ihrer Halterin. Kreise brechen
 * nach wenigen Ebenen ab. `nur` = nur diese eigenen Gesellschaften (Business-Sicht).
 *
 * Reihenfolge je Reihe (16.10., Abnahme 2 · C10 — vorher nach Name, Linien kreuzten hinter Kästen): Linien über mehrere Reihen bekommen in jeder
 * Reihe dazwischen einen freien Platz (Sugiyama), dann ordnen Schwerpunkt-Durchläufe (abwärts, aufwärts, abwärts) jede Reihe nach der Lage ihrer
 * Nachbarn — so laufen die Linien möglichst ohne Kreuzung. Ein Einzelunternehmen ohne Gesellschafter hängt mit einer Inhaber-Linie an der
 * Person seiner Geschäftsführung (ohne die bleibt es frei).
 */
export function organigramm(alle: readonly RegisterGesellschaft[], name: (b: Bezug) => string, nur?: readonly string[]): Organigramm {
  const eigene = alle.filter(g => !imPapierkorb(g) && (!nur || nur.includes(g.id)));
  const istEigen = (id: string) => eigene.some(g => g.id === id);
  const ebene = new Map<string, number>();
  const ebeneVon = (id: string, tiefe = 0): number => {
    if (ebene.has(id)) return ebene.get(id)!;
    if (tiefe > 8) return 1;
    const g = eigene.find(x => x.id === id)!;
    const halter = anteile(g).zeilen.filter(z => z.g.wer.art === 'gesellschaft' && istEigen(z.g.wer.id) && z.g.wer.id !== id);
    const e = halter.length ? Math.max(...halter.map(z => ebeneVon(z.g.wer.id, tiefe + 1))) + 1 : 1;
    ebene.set(id, e);
    return e;
  };
  const knoten = new Map<string, OrgKnoten>();
  const kanten: OrgKante[] = [];
  const neu = (schluessel: string, k: Omit<OrgKnoten, 'x' | 'y' | 'schluessel'>) => { if (!knoten.has(schluessel)) knoten.set(schluessel, { ...k, schluessel, x: 0, y: 0 }); };
  for (const g of eigene) neu(`gesellschaft:${g.id}`, { art: 'gesellschaft', id: g.id, label: anzeigeName(g), ebene: ebeneVon(g.id), eigen: true, ...(g.status ? { status: g.status } : {}) });
  const heute = localDay();
  for (const g of eigene) {
    const ct = capTable(g);
    const einzel = g.rechtsform === 'einzel';
    for (const z of ct.zeilen) {
      const s = `${z.wer.art}:${z.wer.id}`;
      if (!(z.wer.art === 'gesellschaft' && istEigen(z.wer.id))) neu(s, { art: z.wer.art, id: z.wer.id, label: name(z.wer), ebene: 0, eigen: false });
      kanten.push({ von: s, zu: `gesellschaft:${g.id}`, anteil: einzel ? 100 : z.anteil, ...(z.stimmen !== z.anteil && !einzel ? { stimmen: z.stimmen } : {}), ...(einzel ? { inhaber: true as const } : {}) });
    }
    // Einzelunternehmen ohne Gesellschafter-Eintrag: die Person der laufenden Geschäftsführung ist die Inhaberin bzw. der Inhaber.
    if (einzel && !ct.zeilen.length) {
      const o = aktiveEintraege(g.organe).find(x => x.funktion === 'geschaeftsfuehrung' && (x.wer.art === 'person' || x.wer.art === 'kontakt') && !(x.bis && x.bis < heute));
      if (o) {
        const s = `${o.wer.art}:${o.wer.id}`;
        neu(s, { art: o.wer.art, id: o.wer.id, label: name(o.wer), ebene: 0, eigen: false });
        kanten.push({ von: s, zu: `gesellschaft:${g.id}`, anteil: 100, inhaber: true });
      }
    }
    for (const b of aktiveEintraege(g.beteiligungen).filter(b => !b.beendetAm)) {
      const s = `fremd:${b.firmaId}`;
      neu(s, { art: 'fremd', id: b.firmaId, label: name({ art: 'firma', id: b.firmaId }), ebene: (ebene.get(g.id) ?? 1) + 1, eigen: false });
      const k = knoten.get(s)!;
      k.ebene = Math.max(k.ebene, (ebene.get(g.id) ?? 1) + 1);
      kanten.push({ von: `gesellschaft:${g.id}`, zu: s, anteil: b.anteilProzent ?? 0, fremd: true });
    }
  }
  // Ohne Gesellschafter oben beginnt das Bild bei Ebene 1 — leere Ebenen schließen.
  const ebenen = Array.from(new Set(Array.from(knoten.values()).map(k => k.ebene))).sort((a, b) => a - b);
  const reiheVon = new Map(ebenen.map((e, i) => [e, i]));
  for (const k of knoten.values()) k.ebene = reiheVon.get(k.ebene) ?? 0;

  // Plätze je Reihe: echte Kästen und freie Plätze (je Linie über mehr als eine Reihe einer in jeder Reihe dazwischen).
  type Platz = { schluessel: string; knoten?: OrgKnoten; oben: string[]; unten: string[]; x: number };
  const reihen: Platz[][] = ebenen.map(() => []);
  const platz = new Map<string, Platz>();
  const leg = (r: number, p: Platz) => { reihen[r].push(p); platz.set(p.schluessel, p); };
  for (const k of knoten.values()) leg(k.ebene, { schluessel: k.schluessel, knoten: k, oben: [], unten: [], x: 0 });
  const wege: string[][] = kanten.map((k, i) => {
    const a = knoten.get(k.von), b = knoten.get(k.zu);
    if (!a || !b || b.ebene <= a.ebene) return [];
    const kette = [k.von];
    for (let r = a.ebene + 1; r < b.ebene; r++) { const s = `frei:${i}:${r}`; leg(r, { schluessel: s, oben: [], unten: [], x: 0 }); kette.push(s); }
    kette.push(k.zu);
    for (let j = 1; j < kette.length; j++) { platz.get(kette[j - 1])!.unten.push(kette[j]); platz.get(kette[j])!.oben.push(kette[j - 1]); }
    return kette;
  });

  const M = ORG_MASS;
  const schritt = M.breite + M.abstandX;
  const breiteMax = Math.max(1, ...reihen.map(r => r.length)) * schritt - M.abstandX + 2 * M.rand;
  const setzeX = (r: number) => { const b = reihen[r].length * schritt - M.abstandX; const start = (breiteMax - b) / 2; reihen[r].forEach((p, j) => { p.x = start + j * schritt; }); };
  const name0 = (p: Platz) => p.knoten?.label ?? '';
  const ordne = (r: number, nachbarn: (p: Platz) => string[]) => {
    const schwer = (p: Platz) => { const n = nachbarn(p).map(s => platz.get(s)!.x); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : p.x; };
    const w = new Map(reihen[r].map(p => [p.schluessel, schwer(p)]));
    reihen[r].sort((a, b) => w.get(a.schluessel)! - w.get(b.schluessel)! || Number(!!b.knoten?.eigen) - Number(!!a.knoten?.eigen) || name0(a).localeCompare(name0(b), 'de'));
    setzeX(r);
  };
  // Start: wie bisher (eigene zuerst, dann nach Name), dann die Durchläufe.
  reihen.forEach((r, i) => { r.sort((a, b) => Number(!!b.knoten?.eigen) - Number(!!a.knoten?.eigen) || name0(a).localeCompare(name0(b), 'de')); setzeX(i); });
  for (let r = 1; r < reihen.length; r++) ordne(r, p => p.oben);
  for (let r = reihen.length - 2; r >= 0; r--) ordne(r, p => p.unten);
  for (let r = 1; r < reihen.length; r++) ordne(r, p => p.oben);

  reihen.forEach((r, i) => r.forEach(p => { if (p.knoten) { p.knoten.x = p.x; p.knoten.y = M.rand + i * (M.hoehe + M.abstandY); } }));
  // Zwischenpunkte: die Mitte des freien Platzes, auf Höhe der Kastenmitte seiner Reihe.
  kanten.forEach((k, i) => {
    const z = wege[i].slice(1, -1).map(s => { const p = platz.get(s)!; const r = reihen.findIndex(x => x.includes(p)); return { x: p.x + M.breite / 2, y: M.rand + r * (M.hoehe + M.abstandY) + M.hoehe / 2 }; });
    if (z.length) k.punkte = z;
  });
  return { knoten: Array.from(knoten.values()), kanten, breite: breiteMax, hoehe: M.rand * 2 + reihen.length * (M.hoehe + M.abstandY) - M.abstandY };
}

/**
 * Der Weg einer Linie als SVG-Pfad (rein, 16.10.): von unten am Kasten oben über die Zwischenpunkte bis oben an den Kasten unten, je Abschnitt
 * eine weiche Kurve — und der Ort der Beschriftung auf dem LETZTEN Abschnitt nahe am Ziel (so steht der Anteil an der richtigen Linie).
 */
export function orgLinie(a: Pick<OrgKnoten, 'x' | 'y'>, b: Pick<OrgKnoten, 'x' | 'y'>, punkte: readonly { x: number; y: number }[] = []): { d: string; marke: { x: number; y: number } } {
  const M = ORG_MASS;
  const p = [{ x: a.x + M.breite / 2, y: a.y + M.hoehe }, ...punkte, { x: b.x + M.breite / 2, y: b.y }];
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length; i++) { const my = (p[i - 1].y + p[i].y) / 2; d += ` C ${p[i - 1].x} ${my}, ${p[i].x} ${my}, ${p[i].x} ${p[i].y}`; }
  // Punkt bei t = 0,7 des letzten Abschnitts (kubische Bézier-Kurve).
  const s = p[p.length - 2], e = p[p.length - 1], my = (s.y + e.y) / 2, t = 0.7, u = 1 - t;
  const x = u ** 3 * s.x + 3 * u * u * t * s.x + 3 * u * t * t * e.x + t ** 3 * e.x;
  const y = u ** 3 * s.y + 3 * u * u * t * my + 3 * u * t * t * my + t ** 3 * e.y;
  return { d, marke: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } };
}

// ── Organe im Bild und Anteile als Breite (11.10.) ───────────────────────────────────────────────────────────────

/** Strichstärke einer Linie im Organigramm aus dem Kapitalanteil (1,2 … 6 px) — Anteile sieht man an der Breite, die Zahl steht daneben. */
export const strichStaerke = (anteil: number): number => Math.round((1.2 + (Math.max(0, Math.min(100, anteil)) / 100) * 4.8) * 10) / 10;

/**
 * Die laufenden Organe einer Gesellschaft für das Bild (rein): „Geschäftsführung: A, B“ · „Prokura: C“ — nur, wer heute im Amt ist (seit ≤ heute, ohne
 * „bis“ oder bis ≥ heute). Namen über die übergebene Funktion (zur Laufzeit aus dem Register), nie im Code.
 */
export function organeKurz(g: Pick<RegisterGesellschaft, 'organe'>, name: (b: Bezug) => string, heute: string): string[] {
  const je = new Map<string, string[]>();
  for (const o of aktiveEintraege(g.organe)) {
    if ((o.seit && o.seit > heute) || (o.bis && o.bis < heute)) continue;
    const f = ORGAN_FUNKTIONEN.find(x => x.id === o.funktion)?.label ?? 'Organ';
    je.set(f, [...(je.get(f) ?? []), name(o.wer)]);
  }
  return Array.from(je.entries()).map(([f, l]) => `${f}: ${l.join(', ')}`);
}
