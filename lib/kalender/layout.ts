// ─── Kalender: Überlappende Termine nebeneinander legen (rein, getestet) ────
// Wie Google Kalender: Termine, die sich zeitlich überschneiden, teilen sich
// die Breite der Spalte; eine zusammenhängende Gruppe bekommt so viele
// Spalten, wie sich höchstens gleichzeitig überlappen.
// Seit 10.10. (Kevin: „man sieht einfach nichts, im Vergleich zu Google“): ein Block füllt nach rechts, solange dort niemand liegt
// (`spanne`) — kein schmaler Streifen neben leerem Platz. Dazu die Ganztags-Zeile als BAHNEN: ein mehrtägiger Eintrag ist EIN
// durchgehender Balken über die Tage (`ganztagsLegen`), höchstens zwei Bahnen sichtbar, der Rest als „+n“ je Tag (`ganztagsSicht`).

import { montagVon, tagPlus } from '@/lib/zeit/kalender-kern';
import { ausWandzeit } from './zeit';

export interface Lage { id: string; von: number; bis: number }
/**
 * `gruppe` = laufende Nummer der zusammenhängenden Gruppe (für „+n“ ab MAX_SPALTEN, R-K2 #85). `spanne` (10.10.) = wie viele Spalten der
 * Block ab seiner eigenen nach rechts füllen darf, weil dort während seiner Zeit niemand liegt (mindestens 1).
 */
export interface Platz { id: string; spalte: number; spalten: number; gruppe: number; spanne: number }

/** Minuten-Intervalle → Spalte je Termin. Gleichzeitige Gruppen unabhängig voneinander. */
export function spaltenLegen(liste: Lage[]): Platz[] {
  const sortiert = [...liste].sort((a, b) => a.von - b.von || (b.bis - b.von) - (a.bis - a.von));
  const raus: Platz[] = [];
  let gruppe: { lage: Lage; spalte: number }[] = [];
  let gruppenEnde = -Infinity;
  let nr = 0;
  const schliesse = () => {
    const spalten = gruppe.reduce((m, g) => Math.max(m, g.spalte + 1), 0);
    const ueberlappt = (a: Lage, b: Lage) => a.von < b.bis && b.von < a.bis;
    for (const g of gruppe) {
      // Nach rechts füllen, bis die nächste Spalte zur selben Zeit belegt ist.
      let spanne = 1;
      for (let c = g.spalte + 1; c < spalten; c++) {
        if (gruppe.some(o => o !== g && o.spalte === c && ueberlappt(o.lage, g.lage))) break;
        spanne++;
      }
      raus.push({ id: g.lage.id, spalte: g.spalte, spalten, gruppe: nr, spanne });
    }
    gruppe = []; nr++;
  };
  for (const l of sortiert) {
    if (gruppe.length && l.von >= gruppenEnde) schliesse();
    // Erste freie Spalte in der Gruppe (frei = kein Termin dieser Spalte überlappt noch)
    const belegt = new Set(gruppe.filter(g => g.lage.bis > l.von).map(g => g.spalte));
    let spalte = 0; while (belegt.has(spalte)) spalte++;
    gruppe.push({ lage: l, spalte });
    gruppenEnde = Math.max(gruppenEnde, l.bis);
  }
  if (gruppe.length) schliesse();
  return raus;
}

/** Ab so vielen Spalten zeigt das Raster nur die ersten (MAX_SPALTEN − 1) und „+n“ (R-K2 #85, wie Google). */
export const MAX_SPALTEN = 3;

export interface Sichtbar { links: number; breite: number }
export interface Mehr { gruppe: number; von: number; n: number; ids: string[] }

/**
 * Welche Blöcke das Raster zeigt (R-K2 #85): Gruppen mit mehr als MAX_SPALTEN Spalten zeigen nur die Spalten
 * 0 … MAX_SPALTEN − 2 (je 1/MAX_SPALTEN breit), der Rest steckt hinter „+n“ in der letzten Spalte (oben beim frühesten
 * versteckten). `aufgeklappt` → alle, wie bisher (je 1/spalten breit). Breiten in Prozent. Ein Block füllt nach rechts über freie
 * Spalten (`spanne`, 10.10.) — zugeklappt nie in die Spalte von „+n“.
 */
export function rasterLage(plaetze: readonly Platz[], lagen: ReadonlyMap<string, Lage>, aufgeklappt: boolean): { sicht: Map<string, Sichtbar>; mehr: Mehr[] } {
  const sicht = new Map<string, Sichtbar>();
  const mehr = new Map<number, Mehr>();
  for (const p of plaetze) {
    const spanne = Math.max(1, p.spanne ?? 1);
    if (aufgeklappt || p.spalten <= MAX_SPALTEN) { sicht.set(p.id, { links: (p.spalte * 100) / p.spalten, breite: (Math.min(spanne, p.spalten - p.spalte) * 100) / p.spalten }); continue; }
    if (p.spalte < MAX_SPALTEN - 1) { sicht.set(p.id, { links: (p.spalte * 100) / MAX_SPALTEN, breite: (Math.min(spanne, MAX_SPALTEN - 1 - p.spalte) * 100) / MAX_SPALTEN }); continue; }
    const von = lagen.get(p.id)?.von ?? 0;
    const m = mehr.get(p.gruppe) ?? { gruppe: p.gruppe, von, n: 0, ids: [] };
    m.n++; m.ids.push(p.id); m.von = Math.min(m.von, von);
    mehr.set(p.gruppe, m);
  }
  return { sicht, mehr: [...mehr.values()] };
}

/**
 * Zeitumstellung an einem Berliner Tag (R-K2 #86): „doppelt“ = Ende Oktober (02:00–03:00 gibt es zweimal, der Tag hat
 * 25 Stunden), „entfaellt“ = Ende März (02:00–03:00 gibt es nicht, 23 Stunden), sonst null.
 */
export function zeitumstellung(tag: string): 'doppelt' | 'entfaellt' | null {
  const h = (ausWandzeit(`${tagPlus(tag, 1)}T00:00:00`).getTime() - ausWandzeit(`${tag}T00:00:00`).getTime()) / 3_600_000;
  return h > 24 ? 'doppelt' : h < 24 ? 'entfaellt' : null;
}

/**
 * Wohin das Zeitraster beim Öffnen rollt (Minute des Tages): eine Stunde vor jetzt, wenn heute sichtbar ist, sonst der Arbeitsbeginn
 * (10.10.: aus den eigenen Business-freien Zeiten, `arbeitsbeginnAus` in lib/kalender/darstellung.ts — ohne Angabe 7 Uhr).
 */
export function startMinute(tage: readonly string[], heute: string, jetztMin: number, arbeitsbeginn: number | null = null): number {
  return tage.includes(heute) ? Math.max(0, jetztMin - 60) : arbeitsbeginn ?? 7 * 60;
}

/** Kalendertage zwischen zwei Berliner Tagen (b − a). */
export const tageZwischen = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Letzter Tag, an dem ein Termin mit Uhrzeit im Raster steht (Ende 00:00 zählt zum Vortag). */
export const letzterTag = (t: { start: string; ende: string }): string => {
  const e = t.ende.slice(0, 10);
  return t.ende.slice(11, 16) === '00:00' && e > t.start.slice(0, 10) ? tagPlus(e, -1) : e;
};

/** Läuft ein Termin mit Uhrzeit an diesem Folgetag weiter? (Agenda „läuft weiter“, R-K2 #17/#88) */
export const laeuftWeiter = (t: { start: string; ende: string; ganztags: boolean }, tag: string): boolean => !t.ganztags && t.start.slice(0, 10) < tag && letzterTag(t) >= tag;

/**
 * Ziehen eines Termins mit Uhrzeit (J-Zusatz, R-K2): die Verschiebung gilt als DIFFERENZ auf Start und Ende — ein
 * mehrtägiger Termin (Fr 18:00 – So 14:00) bleibt so lang, wie er war, egal an welchem Tag man ihn anfasst.
 * Liefert Starttag + Minuten ab dessen Mitternacht (Ende darf über 24 h hinaus — `wandAus` rollt in die Folgetage).
 */
export function verschiebeDifferenz(t: { start: string; ende: string }, dTage: number, dMin: number): { tag: string; startMin: number; endeMin: number } {
  const s = t.start.slice(0, 10);
  const minuten = (w: string) => Number(w.slice(11, 13)) * 60 + Number(w.slice(14, 16));
  const startMin = minuten(t.start) + dTage * 1440 + dMin;
  const gesamt = tageZwischen(s, t.ende.slice(0, 10)) * 1440 + minuten(t.ende) - minuten(t.start);
  return { tag: s, startMin, endeMin: startMin + gesamt };
}

/** Dauer ändern am LETZTEN Segment eines mehrtägigen Termins: neues Ende = `endeMin` am Tag `tag`. */
export function endeAmTag(t: { start: string }, tag: string, endeMin: number): { tag: string; startMin: number; endeMin: number } {
  const s = t.start.slice(0, 10);
  return { tag: s, startMin: Number(t.start.slice(11, 13)) * 60 + Number(t.start.slice(14, 16)), endeMin: tageZwischen(s, tag) * 1440 + endeMin };
}

/** Wochen-/Monatsrechnung: Montag der Woche eines Tages — aus dem Kalender-Kern (29.09., K2). */
export { montagVon };

/** Die 42 Tage (6 Wochen) eines Monatsblatts, beginnend am Montag vor dem 1. */
export function monatsblatt(jahr: number, monat: number): string[] {
  const erster = `${jahr}-${String(monat).padStart(2, '0')}-01`;
  const start = montagVon(erster);
  const d = new Date(`${start}T12:00:00`);
  return Array.from({ length: 42 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; });
}

/**
 * Aufziehen im Raster (29.09., K1, wie Google): Anfang und aktuelle Position (Minuten seit Mitternacht) → Spanne im
 * 15-Minuten-Raster, in beide Richtungen, mindestens ein Rasterschritt, innerhalb des Tages.
 */
export function ziehSpanne(a: number, b: number, raster = 15): { von: number; bis: number } {
  const s = (m: number) => Math.max(0, Math.min(24 * 60, Math.round(m / raster) * raster));
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const von = Math.min(24 * 60 - raster, Math.floor(Math.max(0, lo) / raster) * raster);
  return { von, bis: Math.max(von + raster, s(hi)) };
}

/** „4–5 Uhr“, „9:30–10:15 Uhr“, „23–0 Uhr“ — die Vorschau beim Aufziehen. */
export function spanneText(von: number, bis: number): string {
  const t = (m: number) => { const h = Math.floor(m / 60) % 24, mi = m % 60; return mi ? `${h}:${String(mi).padStart(2, '0')}` : `${h}`; };
  return `${t(von)}–${t(bis)} Uhr`;
}

// ── Ganztags-Zeile als Bahnen (10.10.) ──────────────────────────────────────────────────────────────────────────────

/** Ein Eintrag der Ganztags-Zeile: erster und letzter Tag (beide einschließlich). `rang` ordnet Gleichlanges (Termin vor Frist vor Aufgabe …). */
export interface GanztagsEintrag { id: string; von: string; bis: string; rang?: number }
/** Wo er liegt: Bahn (Zeile) und Spalten `a` … `b` im sichtbaren Zeitraum; offen = läuft über den Rand hinaus. */
export interface GanztagsPlatz { id: string; bahn: number; a: number; b: number; linksOffen: boolean; rechtsOffen: boolean }
export interface GanztagsLage { plaetze: GanztagsPlatz[]; bahnen: number }

/** Höchstens so viele Bahnen zeigt die Ganztags-Zeile zugeklappt (Kevin 10.10.: „höchstens 2 Zeilen, +n klappt auf“). */
export const GANZTAGS_ZEILEN = 2;

/**
 * Legt die Einträge in Bahnen wie Google: früher Beginnendes zuerst, bei gleichem Beginn das Längere, dann `rang`, dann die Reihenfolge der
 * Liste; jeder Eintrag in die erste Bahn, in der seine Tage frei sind. Was den Zeitraum nicht berührt, fällt weg. Ein Eintrag mit `bis` vor
 * `von` gilt als eintägig.
 */
export function ganztagsLegen(eintraege: readonly GanztagsEintrag[], tage: readonly string[]): GanztagsLage {
  const n = tage.length;
  if (!n) return { plaetze: [], bahnen: 0 };
  const erster = tage[0], letzter = tage[n - 1];
  const kandidaten: (GanztagsPlatz & { rang: number; nr: number })[] = [];
  eintraege.forEach((e, nr) => {
    const von = e.von, bis = e.bis < e.von ? e.von : e.bis;
    if (bis < erster || von > letzter) return;
    let a = tage.findIndex(t => t >= von);
    let b = -1;
    for (let i = n - 1; i >= 0; i--) if (tage[i] <= bis) { b = i; break; }
    if (a < 0 || b < 0 || b < a) return;
    if (a > b) a = b;
    kandidaten.push({ id: e.id, bahn: 0, a, b, linksOffen: von < tage[a], rechtsOffen: bis > tage[b], rang: e.rang ?? 0, nr });
  });
  kandidaten.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a) || x.rang - y.rang || x.nr - y.nr);
  const belegt: boolean[][] = [];
  const plaetze: GanztagsPlatz[] = [];
  for (const k of kandidaten) {
    let bahn = 0;
    while (belegt[bahn] && belegt[bahn].slice(k.a, k.b + 1).some(Boolean)) bahn++;
    belegt[bahn] ??= Array.from({ length: n }, () => false);
    for (let i = k.a; i <= k.b; i++) belegt[bahn][i] = true;
    plaetze.push({ id: k.id, bahn, a: k.a, b: k.b, linksOffen: k.linksOffen, rechtsOffen: k.rechtsOffen });
  }
  return { plaetze, bahnen: belegt.length };
}

export interface GanztagsSicht {
  /** Was gezeichnet wird. */
  sichtbar: GanztagsPlatz[];
  /** Je Tag: wie viele Einträge hinter „+n“ stecken (zugeklappt). */
  mehr: number[];
  /** Gezeichnete Bahnen. */
  zeilen: number;
  /** Gibt es mehr, als zugeklappt Platz hat? (Dann „+n“ bzw. „weniger“.) */
  klappbar: boolean;
}

/** Zugeklappt höchstens `max` Bahnen, der Rest als „+n“ je Tag; aufgeklappt alle. */
export function ganztagsSicht(l: GanztagsLage, tageAnzahl: number, aufgeklappt: boolean, max = GANZTAGS_ZEILEN): GanztagsSicht {
  const klappbar = l.bahnen > max;
  if (aufgeklappt || !klappbar) return { sichtbar: l.plaetze, mehr: Array.from({ length: tageAnzahl }, () => 0), zeilen: l.bahnen, klappbar };
  const mehr = Array.from({ length: tageAnzahl }, () => 0);
  for (const p of l.plaetze) if (p.bahn >= max) for (let i = p.a; i <= p.b; i++) mehr[i]++;
  return { sichtbar: l.plaetze.filter(p => p.bahn < max), mehr, zeilen: max, klappbar };
}
