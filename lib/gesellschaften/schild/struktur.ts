// ─── Unternehmen › Schild: Struktur & Cap-Table als Bild (rein, client-sicher, 10.10.) ───────────────────────────────
// Aus dem Gesellschafts-Register (eine Quelle — `gesellschafter[]`, `beteiligungen[]`, nichts doppelt gespeichert): Anteile und
// Stimmrechte je Gesellschaft (1 € Nennbetrag = 1 Stimme, § 47 Abs. 2 GmbHG; stimmrechtslose Anteile zählen nicht), durchgerechnete
// Beteiligung über Holding-Ketten (wirtschaftlich Berechtigte > 25 %, § 3 GwG — Hinweis für das Transparenzregister), Historie der
// Ein-/Austritte und ein geschichtetes Organigramm (Gesellschafter oben, eigene Gesellschaften darunter, fremde Beteiligungen unten).
// Die Lage rechnet NUR hier; das Bild (components/os/unternehmen/schild/Struktur.tsx) zeichnet nur.

import { ORGAN_FUNKTIONEN, aktiveEintraege, anteile, anzeigeName, type Bezug, type RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import { imPapierkorb } from '@/lib/eintraege/sicher';
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
export interface OrgKante { von: string; zu: string; anteil: number; stimmen?: number; fremd?: true }
export interface Organigramm { knoten: OrgKnoten[]; kanten: OrgKante[]; breite: number; hoehe: number }

/** Maße des Bilds (Pixel im SVG-Koordinatensystem) — eine Stelle. */
export const ORG_MASS = { breite: 196, hoehe: 56, abstandX: 28, abstandY: 92, rand: 16 } as const;

/**
 * Geschichtetes Organigramm (rein): Ebene 0 = wer keine eigene Gesellschaft ist und Anteile hält (Personen, Kontakte, Firmen); eigene
 * Gesellschaften eine Ebene unter ihrem tiefsten eigenen Gesellschafter; fremde Beteiligungen eine Ebene unter ihrer Halterin. Je Ebene nach
 * Name sortiert und mittig ausgerichtet. Kreise brechen nach wenigen Ebenen ab. `nur` = nur diese eigenen Gesellschaften (Business-Sicht).
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
  for (const g of eigene) {
    const ct = capTable(g);
    for (const z of ct.zeilen) {
      const s = `${z.wer.art}:${z.wer.id}`;
      if (!(z.wer.art === 'gesellschaft' && istEigen(z.wer.id))) neu(s, { art: z.wer.art, id: z.wer.id, label: name(z.wer), ebene: 0, eigen: false });
      kanten.push({ von: s, zu: `gesellschaft:${g.id}`, anteil: z.anteil, ...(z.stimmen !== z.anteil ? { stimmen: z.stimmen } : {}) });
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
  const reihe = new Map(ebenen.map((e, i) => [e, i]));
  const proReihe = ebenen.map(e => Array.from(knoten.values()).filter(k => k.ebene === e).sort((a, b) => Number(b.eigen) - Number(a.eigen) || a.label.localeCompare(b.label, 'de')));
  const M = ORG_MASS;
  const breiteMax = Math.max(1, ...proReihe.map(r => r.length)) * (M.breite + M.abstandX) - M.abstandX + 2 * M.rand;
  proReihe.forEach((r, i) => {
    const b = r.length * (M.breite + M.abstandX) - M.abstandX;
    const start = (breiteMax - b) / 2;
    r.forEach((k, j) => { k.x = start + j * (M.breite + M.abstandX); k.y = M.rand + i * (M.hoehe + M.abstandY); k.ebene = reihe.get(k.ebene) ?? 0; });
  });
  return { knoten: Array.from(knoten.values()), kanten, breite: breiteMax, hoehe: M.rand * 2 + proReihe.length * (M.hoehe + M.abstandY) - M.abstandY };
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
