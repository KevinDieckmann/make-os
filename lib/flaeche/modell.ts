// ─── MAKE OS — Flächen: Seiten, die man sich selbst gestaltet ───────────────
// Kevin (26.09.): „Alle Widgets immer zu bearbeiten, andere hinzufügen können;
// seine eigene Seite vorne soll man sich selber gestalten — auch wenn wir am
// Anfang unsere jetzt lassen.“ Entscheidungen: alle Karten-Seiten, Stift oben +
// langer Druck, Breite ⅓/½/⅔/voll, ausblenden, Einstellungen je Widget, Katalog
// aus dem Bestand, je Person ein Layout, der heutige Aufbau bleibt Standard.
//
// Dieses Modul ist rein (kein React, kein Server): Layout säubern, Standard und
// gespeicherten Stand zusammenführen, Schritte anwenden. Tests: tests/flaeche.test.ts.

/** Breite in Sechsteln der Fläche: ⅓ · ½ · ⅔ · voll. */
export type Breite = 2 | 3 | 4 | 6;
export const BREITEN: { b: Breite; label: string; titel: string }[] = [
  { b: 2, label: '⅓', titel: 'schmal' }, { b: 3, label: '½', titel: 'halb' }, { b: 4, label: '⅔', titel: 'breit' }, { b: 6, label: '▭', titel: 'volle Breite' },
];
export type Wert = string | number | boolean;
export type Einstellungen = Record<string, Wert>;

/** Ein Platz auf der Fläche: eine feste Karte der Seite (art 'seite') oder ein Widget aus dem Katalog. */
export interface Platz { id: string; art: string; breite: Breite; titel?: string; einstellungen: Einstellungen }
export interface Layout { plaetze: Platz[]; versteckt: string[]; stand: string }
export interface FlaecheDatei { seiten: Record<string, Layout> }
/** Was die Seite von sich aus mitbringt — Reihenfolge = Standard. */
export interface StandardPlatz { id: string; art?: string; breite: Breite; einstellungen?: Einstellungen; titel?: string }

export type Op =
  | { op: 'verschieben'; id: string; vorId: string | null }
  | { op: 'breite'; id: string; breite: Breite }
  | { op: 'ausblenden'; id: string }
  | { op: 'einblenden'; id: string }
  | { op: 'hinzufuegen'; art: string; breite?: Breite; einstellungen?: Einstellungen; titel?: string; id?: string }
  | { op: 'entfernen'; id: string }
  | { op: 'einstellen'; id: string; einstellungen?: Einstellungen; titel?: string | null }
  | { op: 'zuruecksetzen' };

const SEITE_OK = /^[a-z0-9-]{1,40}$/;
const s = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
const breiteOk = (b: unknown): b is Breite => b === 2 || b === 3 || b === 4 || b === 6;
export const seiteOk = (id: string) => SEITE_OK.test(id);

export function sauberEinstellungen(e: unknown): Einstellungen {
  const aus: Einstellungen = {};
  if (!e || typeof e !== 'object') return aus;
  for (const [k, v] of Object.entries(e as Record<string, unknown>).slice(0, 20)) {
    const key = s(k, 40); if (!key) continue;
    if (typeof v === 'boolean' || (typeof v === 'number' && isFinite(v))) aus[key] = v;
    else if (typeof v === 'string') aus[key] = v.slice(0, 400);
  }
  return aus;
}

export function sauberPlatz(p: unknown): Platz | null {
  const r = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const id = s(r.id, 60), art = s(r.art, 40) || 'seite';
  if (!/^[a-z0-9-]+$/i.test(id) || !/^[a-z0-9-]+$/i.test(art)) return null;
  const titel = s(r.titel, 60);
  return { id, art, breite: breiteOk(r.breite) ? r.breite : 3, einstellungen: sauberEinstellungen(r.einstellungen), ...(titel ? { titel } : {}) };
}

export function sauberLayout(l: unknown): Layout {
  const r = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
  const gesehen = new Set<string>();
  const plaetze = (Array.isArray(r.plaetze) ? r.plaetze : []).map(sauberPlatz).filter((p): p is Platz => !!p && !gesehen.has(p.id) && !!gesehen.add(p.id)).slice(0, 60);
  const versteckt = Array.from(new Set((Array.isArray(r.versteckt) ? r.versteckt : []).map(x => s(x, 60)).filter(x => /^[a-z0-9-]+$/i.test(x)))).slice(0, 60);
  return { plaetze, versteckt, stand: s(r.stand, 30) };
}

export function sauberDatei(d: unknown): FlaecheDatei {
  const r = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const seiten: Record<string, Layout> = {};
  for (const [k, v] of Object.entries((r.seiten && typeof r.seiten === 'object' ? r.seiten : {}) as Record<string, unknown>).slice(0, 80)) if (SEITE_OK.test(k)) seiten[k] = sauberLayout(v);
  return { seiten };
}

export const alsPlatz = (st: StandardPlatz): Platz => ({ id: st.id, art: st.art ?? 'seite', breite: st.breite, einstellungen: { ...(st.einstellungen ?? {}) }, ...(st.titel ? { titel: st.titel } : {}) });

export function neueId(art: string): string {
  return `w-${art.replace(/[^a-z0-9-]/gi, '').slice(0, 20)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/**
 * Standard der Seite + gespeicherter Stand → das Layout, das gezeigt wird.
 * Ohne Speicherstand: der Standard. Sonst: gespeicherte Reihenfolge und Breiten;
 * feste Karten, die die Seite nicht mehr hat, fallen weg; neue feste Karten der
 * Seite rutschen an ihre Standardstelle (nach dem vorigen Standard-Nachbarn),
 * sofern sie nicht ausgeblendet sind. So überleben Layouts jede Weiterentwicklung der Seite.
 */
export function anwenden(standard: StandardPlatz[], gespeichert: Layout | null | undefined): Layout {
  if (!gespeichert || (!gespeichert.plaetze.length && !gespeichert.versteckt.length)) return { plaetze: standard.map(alsPlatz), versteckt: [], stand: '' };
  const stdIds = new Set(standard.map(x => x.id));
  const versteckt = gespeichert.versteckt.filter(id => stdIds.has(id));
  const bekannt = new Set(gespeichert.plaetze.map(p => p.id));
  const aus: Platz[] = gespeichert.plaetze
    .filter(p => p.art !== 'seite' || stdIds.has(p.id))
    .map(p => { const st = standard.find(x => x.id === p.id); return st ? { ...p, art: st.art ?? 'seite', ...(st.titel && !p.titel ? { titel: st.titel } : {}) } : p; });
  standard.forEach((st, i) => {
    if (bekannt.has(st.id) || versteckt.includes(st.id)) return;
    const vorher = standard.slice(0, i).reverse().find(x => aus.some(a => a.id === x.id));
    const idx = vorher ? aus.findIndex(a => a.id === vorher.id) + 1 : 0;
    aus.splice(idx, 0, alsPlatz(st));
  });
  return { plaetze: aus, versteckt, stand: gespeichert.stand };
}

/** Einen Schritt anwenden (rein). Unbekannte Ids ändern nichts. */
export function wende(layout: Layout, op: Op, standard: StandardPlatz[], jetzt = new Date().toISOString()): Layout {
  const l: Layout = { plaetze: layout.plaetze.map(p => ({ ...p, einstellungen: { ...p.einstellungen } })), versteckt: [...layout.versteckt], stand: jetzt };
  const std = (id: string) => standard.find(x => x.id === id);
  switch (op.op) {
    case 'verschieben': {
      const i = l.plaetze.findIndex(p => p.id === op.id); if (i < 0 || op.id === op.vorId) return layout;
      const [p] = l.plaetze.splice(i, 1);
      const j = op.vorId ? l.plaetze.findIndex(x => x.id === op.vorId) : -1;
      if (op.vorId && j < 0) { l.plaetze.splice(i, 0, p); return layout; }
      l.plaetze.splice(j < 0 ? l.plaetze.length : j, 0, p);
      return l;
    }
    case 'breite': { const p = l.plaetze.find(x => x.id === op.id); if (!p || !breiteOk(op.breite)) return layout; p.breite = op.breite; return l; }
    case 'ausblenden': {
      const i = l.plaetze.findIndex(p => p.id === op.id); if (i < 0) return layout;
      l.plaetze.splice(i, 1);
      // Feste Karten der Seite merken wir als ausgeblendet (kommen über „+ Widget“ zurück); Katalog-Widgets sind einfach weg.
      if (std(op.id) && !l.versteckt.includes(op.id)) l.versteckt.push(op.id);
      return l;
    }
    case 'einblenden': {
      if (!l.versteckt.includes(op.id)) return layout;
      l.versteckt = l.versteckt.filter(x => x !== op.id);
      return anwenden(standard, l);
    }
    case 'hinzufuegen': {
      const art = s(op.art, 40); if (!/^[a-z0-9-]+$/i.test(art) || l.plaetze.length >= 60) return layout;
      const id = op.id && /^[a-z0-9-]+$/i.test(op.id) && !l.plaetze.some(p => p.id === op.id) ? op.id : neueId(art);
      const titel = s(op.titel, 60);
      l.plaetze.push({ id, art, breite: breiteOk(op.breite) ? op.breite : 3, einstellungen: sauberEinstellungen(op.einstellungen), ...(titel ? { titel } : {}) });
      return l;
    }
    case 'entfernen': { const n = l.plaetze.length; l.plaetze = l.plaetze.filter(p => p.id !== op.id); return n === l.plaetze.length ? layout : l; }
    case 'einstellen': {
      const p = l.plaetze.find(x => x.id === op.id); if (!p) return layout;
      if (op.einstellungen) p.einstellungen = { ...p.einstellungen, ...sauberEinstellungen(op.einstellungen) };
      if (op.titel !== undefined) { const t = s(op.titel, 60); if (t) p.titel = t; else delete p.titel; }
      return l;
    }
    case 'zuruecksetzen': return { plaetze: standard.map(alsPlatz), versteckt: [], stand: '' };
  }
}

/** Was der Standard heute an fester Karte hat, aber im Layout ausgeblendet ist — für „+ Widget“. */
export function ausgeblendet(layout: Layout, standard: StandardPlatz[]): StandardPlatz[] {
  return standard.filter(st => layout.versteckt.includes(st.id));
}

/** Ist das Layout noch der reine Standard? Dann speichern wir nichts. */
export function istStandard(layout: Layout, standard: StandardPlatz[]): boolean {
  if (layout.versteckt.length || layout.plaetze.length !== standard.length) return false;
  return layout.plaetze.every((p, i) => {
    const st = standard[i];
    return p.id === st.id && p.breite === st.breite && !p.titel && JSON.stringify(p.einstellungen) === JSON.stringify(st.einstellungen ?? {});
  });
}
