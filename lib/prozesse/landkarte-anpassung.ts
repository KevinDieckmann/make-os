// ─── Prozesse — die Landkarte selbst anpassen (22.10.; nach dem Demo-Rundgang: „alles muss anpassbar sein und immer wieder zu bearbeiten“) ───────
// Die Landkarte (Fliege mit Bändern) hat eine Vorgabe im Code: sieben Bereiche (Marketing · Sales · Übergabe · Fulfillment · Ausbau im Kern, Führung und
// Unterstützung als Bänder), jede Kachel in dem Bereich ihres Prozesses, Reihenfolge wie der Bestand. Der Haushalt kann davon abweichen:
//   · Bereiche umbenennen (Name, beim Band auch der Satz), Ton aus der festen Palette (`LANDKARTE_TOENE` — nur Token, geprüft), eigene Bereiche anlegen
//     (höchstens `LANDKARTE_GRENZEN.eigeneBereiche`, als Band oben oder unten);
//   · Kacheln einem anderen Bereich zuordnen, ihre Beschriftung kürzen/ändern (der Titel des Prozesses bleibt), aus- und einblenden;
//   · die Reihenfolge der Kacheln je Bereich.
// Gespeichert werden NUR Abweichungen (`ohneVorgabe` räumt alles weg, was der Vorgabe gleicht) — so kommen spätere Änderungen an der Vorgabe im Code an.
// EINE Stelle in beide Richtungen: `anpassungAendern` (Schreibweg: Schritte, alles oder nichts, Grenzen 413, nie gekürzt) und `landkarteAnsicht` (Anzeige:
// die Prozesse so, wie die Landkarte sie zeigt — Bild, Liste, Vollbild, Präsentieren). Ohne Anpassung liefert `landkarteAnsicht` dieselben Objekte
// (bit-gleich, Wächter tests/prozesse-landkarte-anpassen.test.ts). Rein und client-sicher; Server: ./landkarte-anpassung-server.ts.

import { BAENDER, KERN_STUFEN, type Band, type KernStufe, type ProzessDef } from './typen';
import { PROZESS_BEREICHE, type ProzessBereich } from './definition';
import { stufeVon } from './modell';
import { BAND_FARBE, STUFE_FARBE, istLandkarteTon, landkarteTonVon, landkarteTonWert, type LandkarteTon } from './farben';

/** Grenzen (darüber 413 mit Satz — nie gekürzt). */
export const LANDKARTE_GRENZEN = { eigeneBereiche: 4, titel: 40, satz: 140, beschriftung: 60, kacheln: 400, ops: 60 } as const;
/** Ein eigener Bereich: `lb-<uuid>` (neueKennung('lb')). */
export const EIGENER_BEREICH = /^lb-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Kennung einer Kachel (Register, Fulfillment-Vorlage, Werkstatt) — nur Form. */
const KACHEL = /^[A-Za-z0-9][A-Za-z0-9_:.~-]{0,119}$/;

export type BereichLage = 'oben' | 'unten';
export interface BereichAnpassung { titel?: string; satz?: string; ton?: LandkarteTon }
export interface EigenerBereich { id: string; titel: string; satz?: string; ton?: LandkarteTon; lage: BereichLage }
export interface KachelAnpassung { bereich?: string; beschriftung?: string; aus?: true }
/** Die gespeicherten Abweichungen (Bestand `prozesse-landkarte--<haushalt>`). */
export interface LandkarteAnpassung {
  v: 1;
  bereiche?: Partial<Record<ProzessBereich, BereichAnpassung>>;
  eigene?: EigenerBereich[];
  kacheln?: Record<string, KachelAnpassung>;
  /** Je Bereich die Reihenfolge der Kacheln (Kennungen) — nur, wenn sie von der Vorgabe abweicht. */
  reihe?: Record<string, string[]>;
  geaendertAm?: string; geaendertVon?: string;
}
export const leereAnpassung = (): LandkarteAnpassung => ({ v: 1 });

const FESTE: readonly ProzessBereich[] = PROZESS_BEREICHE.map(b => b.id);
const istFest = (v: unknown): v is ProzessBereich => typeof v === 'string' && (FESTE as readonly string[]).includes(v);
const KERN_IDS: readonly string[] = KERN_STUFEN.map(s => s.id);

/** Die Vorgabe eines festen Bereichs: Name, Satz (nur Bänder), Ton. */
export function bereichVorgabe(id: ProzessBereich): { titel: string; satz?: string; ton: LandkarteTon } {
  const s = KERN_STUFEN.find(x => x.id === id);
  if (s) return { titel: s.titel, ton: landkarteTonVon(STUFE_FARBE[s.id]) ?? 'grau' };
  const b = BAENDER.find(x => x.id === id)!;
  return { titel: b.titel, satz: b.satz, ton: landkarteTonVon(BAND_FARBE[id as Exclude<Band, 'kern'>]) ?? 'grau' };
}
/** Der Bereich eines Prozesses nach der Vorgabe (Stufe im Kern, sonst das Band). */
export const bereichVonProzess = (p: Pick<ProzessDef, 'band' | 'stufe'>): ProzessBereich => (p.band === 'kern' ? stufeVon(p) : p.band as ProzessBereich);

// ── Säubern (Lesen: robust, nie ein Absturz, Unlesbares fällt weg) ─────────────────────────────────────────────────────────────────────────────────

type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);
const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : undefined);
const sauber = <T>(o: O): T => Object.fromEntries(Object.entries(o).filter(([, w]) => w !== undefined)) as T;

function bereichAnpassungAus(v: unknown): BereichAnpassung | undefined {
  const o = obj(v);
  if (!o) return undefined;
  const a = sauber<BereichAnpassung>({ titel: text(o.titel, LANDKARTE_GRENZEN.titel), satz: text(o.satz, LANDKARTE_GRENZEN.satz), ton: istLandkarteTon(o.ton) ? o.ton : undefined });
  return Object.keys(a).length ? a : undefined;
}

/** Den Bestand säubern (rein, schreibt nie). Doppelte eigene Bereiche: der erste gilt. Listen werden nie gekürzt. */
export function anpassungAus(roh: unknown): LandkarteAnpassung {
  const o = obj(roh);
  if (!o) return leereAnpassung();
  const raus: LandkarteAnpassung = { v: 1 };
  const b = obj(o.bereiche);
  if (b) {
    const m: Partial<Record<ProzessBereich, BereichAnpassung>> = {};
    for (const [k, w] of Object.entries(b)) { const a = istFest(k) ? bereichAnpassungAus(w) : undefined; if (a) m[k as ProzessBereich] = a; }
    if (Object.keys(m).length) raus.bereiche = m;
  }
  if (Array.isArray(o.eigene)) {
    const l: EigenerBereich[] = [];
    for (const x of o.eigene) {
      const e = obj(x);
      const id = typeof e?.id === 'string' && EIGENER_BEREICH.test(e.id) ? e.id : undefined;
      const titel = text(e?.titel, LANDKARTE_GRENZEN.titel);
      if (!e || !id || !titel || l.some(y => y.id === id)) continue;
      l.push(sauber<EigenerBereich>({ id, titel, satz: text(e.satz, LANDKARTE_GRENZEN.satz), ton: istLandkarteTon(e.ton) ? e.ton : undefined, lage: e.lage === 'oben' ? 'oben' : 'unten' }));
    }
    if (l.length) raus.eigene = l;
  }
  const k = obj(o.kacheln);
  if (k) {
    const m: Record<string, KachelAnpassung> = {};
    for (const [id, w] of Object.entries(k)) {
      const x = obj(w);
      if (!x || !KACHEL.test(id)) continue;
      const bereich = istFest(x.bereich) || (typeof x.bereich === 'string' && EIGENER_BEREICH.test(x.bereich)) ? x.bereich as string : undefined;
      const a = sauber<KachelAnpassung>({ bereich, beschriftung: text(x.beschriftung, LANDKARTE_GRENZEN.beschriftung), aus: x.aus === true ? true : undefined });
      if (Object.keys(a).length) m[id] = a;
    }
    if (Object.keys(m).length) raus.kacheln = m;
  }
  const r = obj(o.reihe);
  if (r) {
    const m: Record<string, string[]> = {};
    for (const [id, w] of Object.entries(r)) {
      if (!(istFest(id) || EIGENER_BEREICH.test(id)) || !Array.isArray(w)) continue;
      const l = w.filter((x, i): x is string => typeof x === 'string' && KACHEL.test(x) && w.indexOf(x) === i);
      if (l.length) m[id] = l;
    }
    if (Object.keys(m).length) raus.reihe = m;
  }
  if (typeof o.geaendertAm === 'string') raus.geaendertAm = o.geaendertAm.slice(0, 40);
  if (typeof o.geaendertVon === 'string') raus.geaendertVon = o.geaendertVon.slice(0, 40);
  return raus;
}

// ── Anzeige: die Prozesse so, wie die Landkarte sie zeigt ─────────────────────────────────────────────────────────────────────────────────────────

/** Ein Bereich, wie die Landkarte ihn zeigt (Vorgabe + Abweichung). */
export interface LandkarteBereich {
  id: string; art: 'stufe' | 'band' | 'eigen'; titel: string; satz?: string; tonId: LandkarteTon; ton: string; lage?: BereichLage;
  /** Weicht Name, Satz oder Ton von der Vorgabe ab (bzw. ein eigener Bereich)? */
  angepasst: boolean;
}
export interface LandkarteAnsicht {
  /** Alle Prozesse (auch ausgeblendete, mit `aus`) — in der angepassten Reihenfolge, mit Bereich, Ton und Beschriftung der Anzeige. */
  alle: ProzessDef[];
  /** Was das Bild zeigt (ohne ausgeblendete). */
  sichtbar: ProzessDef[];
  bereiche: LandkarteBereich[];
  /** Je Bereich seine Kacheln in Reihenfolge (auch ausgeblendete) — für „Anpassen“. */
  jeBereich: Record<string, ProzessDef[]>;
}

/** Die Bereiche der Landkarte (feste sieben + eigene) mit Namen und Ton. */
export function landkarteBereiche(a: LandkarteAnpassung = leereAnpassung()): LandkarteBereich[] {
  const fest = PROZESS_BEREICHE.map((b): LandkarteBereich => {
    const v = bereichVorgabe(b.id), x = a.bereiche?.[b.id];
    const tonId = x?.ton ?? v.ton;
    return {
      id: b.id, art: KERN_IDS.includes(b.id) ? 'stufe' : 'band', titel: x?.titel ?? v.titel, ...(v.satz !== undefined || x?.satz ? { satz: x?.satz ?? v.satz } : {}),
      tonId, ton: landkarteTonWert(tonId)!, ...(b.band !== 'kern' ? { lage: b.band === 'fuehrung' ? 'oben' as const : 'unten' as const } : {}), angepasst: !!x,
    };
  });
  const eigen = (a.eigene ?? []).map((e): LandkarteBereich => ({ id: e.id, art: 'eigen', titel: e.titel, ...(e.satz ? { satz: e.satz } : {}), tonId: e.ton ?? 'grau', ton: landkarteTonWert(e.ton ?? 'grau')!, lage: e.lage, angepasst: true }));
  return [...fest, ...eigen];
}

/** In welchem Bereich eine Kachel steht: angepasst (sofern es den Bereich gibt), sonst die Vorgabe. */
const wirksamerBereich = (p: ProzessDef, a: LandkarteAnpassung): string => {
  const z = a.kacheln?.[p.id]?.bereich;
  if (z && (istFest(z) || (a.eigene ?? []).some(e => e.id === z))) return z;
  return bereichVonProzess(p);
};

/** Eine Reihe ordnen: zuerst die genannten (sofern im Bereich), dann der Rest in der Reihenfolge der Vorgabe. */
export function reiheOrdnen<T extends { id: string }>(l: readonly T[], reihe: readonly string[] | undefined): T[] {
  if (!reihe?.length) return [...l];
  const nach = new Map(l.map(x => [x.id, x]));
  const vorne = reihe.map(id => nach.get(id)).filter((x): x is T => !!x);
  const gesehen = new Set(vorne.map(x => x.id));
  return [...vorne, ...l.filter(x => !gesehen.has(x.id))];
}

/**
 * Die Prozesse, wie die Landkarte sie zeigt (rein). Ohne Abweichung für eine Kachel bleibt das Objekt dasselbe; ohne jede Anpassung ist die Liste gleich
 * (gleiche Objekte, gleiche Reihenfolge). Ausgeblendete tragen `aus` und fehlen in `sichtbar` — der Ort im Modell (Adresse, Suche) bleibt erreichbar.
 */
export function landkarteAnsicht(prozesse: readonly ProzessDef[], a: LandkarteAnpassung | null | undefined): LandkarteAnsicht {
  const anp = a ?? leereAnpassung();
  const bereiche = landkarteBereiche(anp);
  const nachId = new Map(bereiche.map(b => [b.id, b]));
  const umgebaut = prozesse.map((p): { p: ProzessDef; bereich: string } => {
    const bereich = wirksamerBereich(p, anp);
    const k = anp.kacheln?.[p.id];
    const b = nachId.get(bereich)!;
    const vorgabe = bereichVonProzess(p);
    const tonAnders = b.art === 'eigen' ? !!(anp.eigene ?? []).find(e => e.id === bereich)?.ton : !!anp.bereiche?.[bereich as ProzessBereich]?.ton;
    if (bereich === vorgabe && !k?.beschriftung && !k?.aus && !tonAnders) return { p, bereich };
    const n: ProzessDef = { ...p };
    if (bereich !== vorgabe) {
      delete n.stufe; delete n.bereichEigen;
      if (b.art === 'stufe') { n.band = 'kern'; n.stufe = bereich as KernStufe; }
      else if (b.art === 'band') n.band = bereich as Band;
      else { n.band = b.lage === 'oben' ? 'fuehrung' : 'unterstuetzung'; n.bereichEigen = bereich; }
    }
    if (tonAnders) n.ton = b.ton;
    if (k?.beschriftung) n.beschriftung = k.beschriftung;
    if (k?.aus) n.aus = true;
    return { p: n, bereich };
  });
  const jeBereich: Record<string, ProzessDef[]> = Object.fromEntries(bereiche.map(b => [b.id, [] as ProzessDef[]]));
  for (const x of umgebaut) jeBereich[x.bereich].push(x.p);
  for (const b of bereiche) jeBereich[b.id] = reiheOrdnen(jeBereich[b.id], anp.reihe?.[b.id]);
  // Die Reihenfolge innerhalb eines Bereichs ändert sich, die Verzahnung der Bereiche in der Liste bleibt (ohne Reihe: dieselbe Liste).
  let alle: ProzessDef[];
  if (!anp.reihe || !Object.keys(anp.reihe).length) alle = umgebaut.map(x => x.p);
  else {
    const zeiger: Record<string, number> = {};
    alle = umgebaut.map(x => { const i = zeiger[x.bereich] ?? 0; zeiger[x.bereich] = i + 1; return jeBereich[x.bereich][i]; });
  }
  return { alle, sichtbar: alle.filter(p => !p.aus), bereiche, jeBereich };
}

// ── Schreiben: Schritte (rein, alles oder nichts) ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ein Schritt „Landkarte anpassen“:
 *   bereich { bereich, titel?, satz?, ton?, lage? }   Name/Satz/Ton eines Bereichs (null bzw. leer = zurück auf die Vorgabe); `lage` nur bei eigenen
 *   bereich-neu { id: lb-<uuid>, titel, lage?, ton? } eigener Bereich (höchstens LANDKARTE_GRENZEN.eigeneBereiche — sonst 413)
 *   bereich-weg { bereich }                           nur eigene; seine Kacheln stehen danach wieder in ihrem Bereich der Vorgabe
 *   kachel { id, bereich?, beschriftung?, aus? }      zuordnen (null = Vorgabe), Beschriftung (leer = Titel), aus-/einblenden
 *   reihe { bereich, ids }                            Reihenfolge der Kacheln eines Bereichs
 *   zuruecksetzen {}                                  alles auf die Vorgabe
 */
export type LandkarteOp =
  | { art: 'bereich'; bereich: string; titel?: string | null; satz?: string | null; ton?: string | null; lage?: BereichLage }
  | { art: 'bereich-neu'; id: string; titel: string; lage?: BereichLage; ton?: string | null }
  | { art: 'bereich-weg'; bereich: string }
  | { art: 'kachel'; id: string; bereich?: string | null; beschriftung?: string | null; aus?: boolean }
  | { art: 'reihe'; bereich: string; ids: string[] }
  | { art: 'zuruecksetzen' };

export type AnpassungErgebnis = { ok: true; anpassung: LandkarteAnpassung; geaendert: boolean } | { ok: false; status: 400 | 404 | 413; fehler: string };
const nein = (status: 400 | 404 | 413, fehler: string): AnpassungErgebnis => ({ ok: false, status, fehler });

/** Ein Textfeld eines Schritts: undefined = unverändert, null/leer = zurück, zu lang = 413 (nie gekürzt). */
function feldText(v: unknown, max: number, name: string): { ok: true; wert: string | null | undefined } | { ok: false; e: AnpassungErgebnis } {
  if (v === undefined) return { ok: true, wert: undefined };
  if (v === null || (typeof v === 'string' && !v.trim())) return { ok: true, wert: null };
  if (typeof v !== 'string') return { ok: false, e: nein(400, `${name}: Text erwartet.`) };
  if (v.trim().length > max) return { ok: false, e: nein(413, `${name}: höchstens ${max} Zeichen — nichts gespeichert.`) };
  return { ok: true, wert: v.trim() };
}

/** Alles weg, was der Vorgabe gleicht (rein) — gespeichert wird nur, was abweicht. `prozesse` = die Kacheln der Vorgabe (ohne Anpassung). */
export function ohneVorgabe(a: LandkarteAnpassung, prozesse: readonly ProzessDef[]): LandkarteAnpassung {
  const raus: LandkarteAnpassung = { v: 1 };
  const bereiche: Partial<Record<ProzessBereich, BereichAnpassung>> = {};
  for (const [id, x] of Object.entries(a.bereiche ?? {}) as [ProzessBereich, BereichAnpassung][]) {
    const v = bereichVorgabe(id);
    const y = sauber<BereichAnpassung>({ titel: x.titel && x.titel !== v.titel ? x.titel : undefined, satz: x.satz && x.satz !== v.satz && v.satz !== undefined ? x.satz : undefined, ton: x.ton && x.ton !== v.ton ? x.ton : undefined });
    if (Object.keys(y).length) bereiche[id] = y;
  }
  if (Object.keys(bereiche).length) raus.bereiche = bereiche;
  if (a.eigene?.length) raus.eigene = a.eigene.map(e => sauber<EigenerBereich>({ ...e, ton: e.ton && e.ton !== 'grau' ? e.ton : undefined }));
  const eigeneIds = new Set((raus.eigene ?? []).map(e => e.id));
  const nach = new Map(prozesse.map(p => [p.id, p]));
  const kacheln: Record<string, KachelAnpassung> = {};
  for (const [id, x] of Object.entries(a.kacheln ?? {})) {
    const p = nach.get(id);
    // Unbekannte Kacheln (gerade nicht gelesen, z. B. ein Teil der Landkarte fehlt) behalten ihre Angaben — nie still verworfen.
    const bereich = x.bereich && (istFest(x.bereich) || eigeneIds.has(x.bereich)) && (!p || x.bereich !== bereichVonProzess(p)) ? x.bereich : undefined;
    const beschriftung = x.beschriftung && (!p || x.beschriftung !== p.titel) ? x.beschriftung : undefined;
    const y = sauber<KachelAnpassung>({ bereich, beschriftung, aus: x.aus ? true : undefined });
    if (Object.keys(y).length) kacheln[id] = y;
  }
  if (Object.keys(kacheln).length) raus.kacheln = kacheln;
  // Reihen: nur, wenn sie die Reihenfolge der Vorgabe (dieselben Kacheln, ohne Reihe) wirklich ändern.
  const ohneReihe = landkarteAnsicht(prozesse, { ...raus });
  const reihe: Record<string, string[]> = {};
  for (const [id, l] of Object.entries(a.reihe ?? {})) {
    if (!(istFest(id) || eigeneIds.has(id))) continue;
    const vorgabe = (ohneReihe.jeBereich[id] ?? []).map(p => p.id);
    const neu = reiheOrdnen((ohneReihe.jeBereich[id] ?? []), l).map(p => p.id);
    const unbekannt = l.filter(x => !nach.has(x));
    if (neu.join('|') !== vorgabe.join('|')) reihe[id] = [...neu, ...unbekannt.filter(x => !neu.includes(x))];
  }
  if (Object.keys(reihe).length) raus.reihe = reihe;
  if (a.geaendertAm) raus.geaendertAm = a.geaendertAm;
  if (a.geaendertVon) raus.geaendertVon = a.geaendertVon;
  return raus;
}

/** Ist die Anpassung leer (alles Vorgabe)? */
export const istVorgabe = (a: LandkarteAnpassung): boolean => !a.bereiche && !a.eigene && !a.kacheln && !a.reihe;

/**
 * Die Schritte anwenden (rein, alles oder nichts). `prozesse` = die Kacheln der Vorgabe (Server: die Landkarte ohne Anpassung). Unbekannte Kachel bzw. Bereich
 * → 404, Unsinn → 400, Grenzen → 413 — nie gekürzt, nichts gespeichert.
 */
export function anpassungAendern(alt: LandkarteAnpassung, ops: unknown, kx: { prozesse: readonly ProzessDef[]; jetzt: string; person: string }): AnpassungErgebnis {
  if (!Array.isArray(ops) || !ops.length) return nein(400, 'ops: die Schritte als Liste.');
  if (ops.length > LANDKARTE_GRENZEN.ops) return nein(413, `Höchstens ${LANDKARTE_GRENZEN.ops} Schritte je Anfrage — nichts gespeichert.`);
  const bekannt = new Set(kx.prozesse.map(p => p.id));
  let a: LandkarteAnpassung = JSON.parse(JSON.stringify(alt));
  const eigen = (id: string) => (a.eigene ?? []).find(e => e.id === id);
  for (const [i, roh] of ops.entries()) {
    const o = obj(roh);
    const wo = `Schritt ${i + 1}`;
    if (!o) return nein(400, `${wo}: unlesbar.`);
    switch (o.art) {
      case 'bereich': {
        const id = o.bereich;
        if (typeof id !== 'string' || !(istFest(id) || eigen(id))) return nein(404, `${wo}: diesen Bereich gibt es nicht.`);
        const t = feldText(o.titel, LANDKARTE_GRENZEN.titel, 'Name des Bereichs'); if (!t.ok) return t.e;
        const sa = feldText(o.satz, LANDKARTE_GRENZEN.satz, 'Satz des Bereichs'); if (!sa.ok) return sa.e;
        if (o.ton !== undefined && o.ton !== null && !istLandkarteTon(o.ton)) return nein(400, `${wo}: Ton nur aus der Palette.`);
        if (istFest(id)) {
          const x: BereichAnpassung = { ...(a.bereiche?.[id] ?? {}) };
          if (t.wert === null) delete x.titel; else if (t.wert !== undefined) x.titel = t.wert;
          if (sa.wert === null) delete x.satz; else if (sa.wert !== undefined) x.satz = sa.wert;
          if (o.ton === null) delete x.ton; else if (o.ton !== undefined) x.ton = o.ton as LandkarteTon;
          a.bereiche = { ...(a.bereiche ?? {}), [id]: x };
        } else {
          if (t.wert === null) return nein(400, `${wo}: ein eigener Bereich braucht einen Namen.`);
          a.eigene = (a.eigene ?? []).map(e => (e.id !== id ? e : sauber<EigenerBereich>({
            ...e, ...(t.wert ? { titel: t.wert } : {}), satz: sa.wert === null ? undefined : sa.wert ?? e.satz,
            ton: o.ton === null ? undefined : (o.ton as LandkarteTon | undefined) ?? e.ton, lage: o.lage === 'oben' || o.lage === 'unten' ? o.lage : e.lage,
          })));
        }
        break;
      }
      case 'bereich-neu': {
        if (typeof o.id !== 'string' || !EIGENER_BEREICH.test(o.id)) return nein(400, `${wo}: ein eigener Bereich trägt eine Kennung lb-<uuid>.`);
        if (eigen(o.id)) return nein(400, `${wo}: diesen Bereich gibt es schon.`);
        if ((a.eigene ?? []).length >= LANDKARTE_GRENZEN.eigeneBereiche) return nein(413, `Höchstens ${LANDKARTE_GRENZEN.eigeneBereiche} eigene Bereiche — nichts gespeichert.`);
        const t = feldText(o.titel, LANDKARTE_GRENZEN.titel, 'Name des Bereichs'); if (!t.ok) return t.e;
        if (!t.wert) return nein(400, `${wo}: ein eigener Bereich braucht einen Namen.`);
        if (o.ton !== undefined && o.ton !== null && !istLandkarteTon(o.ton)) return nein(400, `${wo}: Ton nur aus der Palette.`);
        a.eigene = [...(a.eigene ?? []), sauber<EigenerBereich>({ id: o.id, titel: t.wert, lage: o.lage === 'oben' ? 'oben' : 'unten', ton: istLandkarteTon(o.ton) ? o.ton : undefined })];
        break;
      }
      case 'bereich-weg': {
        const id = o.bereich;
        if (typeof id !== 'string' || !eigen(id)) return nein(404, `${wo}: nur eigene Bereiche lassen sich entfernen.`);
        a.eigene = (a.eigene ?? []).filter(e => e.id !== id);
        if (a.kacheln) for (const [k, x] of Object.entries(a.kacheln)) if (x.bereich === id) { const { bereich: _b, ...rest } = x; a.kacheln[k] = rest; }
        if (a.reihe) delete a.reihe[id];
        break;
      }
      case 'kachel': {
        const id = o.id;
        if (typeof id !== 'string' || !bekannt.has(id)) return nein(404, `${wo}: diese Kachel gibt es nicht (mehr).`);
        const x: KachelAnpassung = { ...(a.kacheln?.[id] ?? {}) };
        if (o.bereich !== undefined) {
          if (o.bereich === null) delete x.bereich;
          else if (typeof o.bereich === 'string' && (istFest(o.bereich) || eigen(o.bereich))) {
            x.bereich = o.bereich;
            // Aus der alten Reihe heraus (sie kommt im neuen Bereich ans Ende).
            if (a.reihe) for (const r of Object.keys(a.reihe)) a.reihe[r] = a.reihe[r].filter(k => k !== id);
          } else return nein(404, `${wo}: diesen Bereich gibt es nicht.`);
        }
        const b = feldText(o.beschriftung, LANDKARTE_GRENZEN.beschriftung, 'Beschriftung'); if (!b.ok) return b.e;
        if (b.wert === null) delete x.beschriftung; else if (b.wert !== undefined) x.beschriftung = b.wert;
        if (o.aus !== undefined) { if (typeof o.aus !== 'boolean') return nein(400, `${wo}: aus = ja oder nein.`); if (o.aus) x.aus = true; else delete x.aus; }
        a.kacheln = { ...(a.kacheln ?? {}), [id]: x };
        break;
      }
      case 'reihe': {
        const id = o.bereich;
        if (typeof id !== 'string' || !(istFest(id) || eigen(id))) return nein(404, `${wo}: diesen Bereich gibt es nicht.`);
        if (!Array.isArray(o.ids) || o.ids.some(x => typeof x !== 'string')) return nein(400, `${wo}: ids als Liste von Kennungen.`);
        if (o.ids.length > LANDKARTE_GRENZEN.kacheln) return nein(413, `Höchstens ${LANDKARTE_GRENZEN.kacheln} Kacheln je Bereich — nichts gespeichert.`);
        const fremd = (o.ids as string[]).find(x => !bekannt.has(x));
        if (fremd) return nein(404, `${wo}: eine Kachel der Reihe gibt es nicht (mehr).`);
        a.reihe = { ...(a.reihe ?? {}), [id]: (o.ids as string[]).filter((x, j, l) => l.indexOf(x) === j) };
        break;
      }
      case 'zuruecksetzen': a = leereAnpassung(); break;
      default: return nein(400, `${wo}: unbekannte Art.`);
    }
  }
  const neu = ohneVorgabe(a, kx.prozesse);
  if (Object.keys(neu.kacheln ?? {}).length > LANDKARTE_GRENZEN.kacheln) return nein(413, `Höchstens ${LANDKARTE_GRENZEN.kacheln} angepasste Kacheln — nichts gespeichert.`);
  const vergleich = (x: LandkarteAnpassung) => { const { geaendertAm: _a, geaendertVon: _v, ...r } = x; return JSON.stringify(r); };
  const geaendert = vergleich(neu) !== vergleich(ohneVorgabe(alt, kx.prozesse));
  if (!geaendert) return { ok: true, anpassung: alt, geaendert: false };
  const fertig: LandkarteAnpassung = istVorgabe(neu) ? leereAnpassung() : { ...neu, geaendertAm: kx.jetzt, geaendertVon: kx.person };
  return { ok: true, anpassung: fertig, geaendert: true };
}

/** Eine Kachel in ihrem Bereich um eins nach vorn bzw. hinten (rein) — die neue Reihe für den Schritt `reihe`. Am Rand: null. */
export function reiheVerschieben(ids: readonly string[], id: string, richtung: -1 | 1): string[] | null {
  const i = ids.indexOf(id), j = i + richtung;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const l = [...ids];
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}
/** Eine Kachel vor eine andere legen (Ziehen, rein) — die neue Reihe. */
export function reiheVor(ids: readonly string[], id: string, vor: string | null): string[] {
  const l = ids.filter(x => x !== id);
  const j = vor ? l.indexOf(vor) : -1;
  if (j < 0) return [...l, id];
  return [...l.slice(0, j), id, ...l.slice(j)];
}
