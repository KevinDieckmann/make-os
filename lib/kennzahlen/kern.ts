// ─── Kennzahlen-Index — der gemeinsame Kern (rein, getestet) ────────────────
// Business-Index (25.09.) und Privat-Index (25.09.) rechnen gleich: jede
// Kennzahl → 0–100 über ihre Schwellen (rot 20 · grün 100 · linear), Säule =
// Mittel ihrer gemessenen Kennzahlen (zählt ab 40 % Abdeckung), Gesamt =
// gewichtetes Mittel der zählenden Säulen. Hinter jeder Kennzahl stehen
// Details: die 2–3 Punkte, aus denen sie besteht — jeder mit Weg dorthin, wo
// man handelt (Kevin: „Verbindungen, die nicht enden“).

export type Ampel = 'gruen' | 'gelb' | 'rot' | 'grau';
export type Einheit = 'eur' | 'prozent' | 'monate' | 'tage' | 'faktor' | 'stunden' | 'anzahl' | 'punkte';
export type Richtung = 'hoch' | 'niedrig';
export interface Schwelle { gruen: number; rot: number }

/** Ein Punkt hinter einer Kennzahl — z. B. eine überfällige Rechnung, ein Kunde, ein Monat. */
export interface Detail { titel: string; wert?: string; unter?: string; href?: string; ampel?: Ampel }

export type Messung = { wert: number; anzeige: string; quelle: string; details?: Detail[] } | { luecke: string; details?: Detail[] };

export interface KennzahlDefBasis {
  id: string; label: string; saeule: string; gruppe: string;
  einheit: Einheit; richtung: Richtung; gruen: number; rot: number;
  formel: string; quelle: string; luecke: string;
  pflegen?: { text: string; href: string };
  /** Wert ist schon ein Score 0–100 — Punkte = Wert. */
  direkt?: boolean;
  /** Gewicht in der Säule (Standard 1) — Kernkennzahlen wiegen mehr. */
  gewicht?: number;
}
export interface SaeuleDef { id: string; label: string; gewicht: number; satz: string }

export const MIN_ABDECKUNG = 0.4;

export function punkte(wert: number, k: Pick<KennzahlDefBasis, 'richtung' | 'gruen' | 'rot' | 'direkt'>): number {
  if (k.direkt) return Math.max(0, Math.min(100, Math.round(wert)));
  const breite = Math.abs(k.gruen - k.rot) || 1;
  const t = k.richtung === 'hoch' ? (wert - k.rot) / breite : (k.rot - wert) / breite;
  const p = t >= 1 ? 100 : t >= 0 ? 20 + 80 * t : 20 * (1 + t);
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function ampel(wert: number, k: Pick<KennzahlDefBasis, 'richtung' | 'gruen' | 'rot'>): Ampel {
  if (k.richtung === 'hoch') return wert >= k.gruen ? 'gruen' : wert < k.rot ? 'rot' : 'gelb';
  return wert <= k.gruen ? 'gruen' : wert > k.rot ? 'rot' : 'gelb';
}

export const indexLabel = (n: number | null) => (n == null ? 'Noch keine Daten' : n >= 80 ? 'Souverän' : n >= 60 ? 'Solide' : n >= 40 ? 'Verbesserungsfähig' : 'Kritisch');

export interface KennzahlStand {
  id: string; label: string; gruppe: string; einheit: Einheit; richtung: Richtung;
  gruen: number; rot: number; formel: string; pflegen?: KennzahlDefBasis['pflegen'];
  /** Die Standard-Schwellen — gruen/rot oben sind die geltenden (ggf. eigene). */
  standard: Schwelle; angepasst: boolean;
  gemessen: boolean; wert: number | null; anzeige: string | null; quelle: string;
  punkte: number | null; ampel: Ampel;
  details: Detail[];
}
export interface SaeulenStand { id: string; label: string; gewicht: number; satz: string; score: number | null; abdeckung: number; zuDuenn: boolean; kennzahlen: KennzahlStand[] }
export interface IndexErgebnis {
  scope: string; stand: string;
  index: number | null; label: string;
  abdeckung: number;
  saeulen: SaeulenStand[];
  hebel: { id: string; label: string; saeule: string } | null;
  luecken: number;
}

export function berechneModell<B>(m: {
  saeulen: SaeuleDef[]; kennzahlen: KennzahlDefBasis[]; messen: Record<string, (b: B) => Messung>;
  bestand: B; schwellen?: Record<string, Schwelle>; stand: string; scope: string;
}): IndexErgebnis {
  const messe = (id: string): Messung => {
    try { return m.messen[id](m.bestand); } catch (e) { return { luecke: `Rechenfehler: ${e instanceof Error ? e.message : 'unbekannt'}` }; }
  };
  const saeulen: SaeulenStand[] = m.saeulen.map(s => {
    const kennzahlen: KennzahlStand[] = m.kennzahlen.filter(k => k.saeule === s.id).map(def => {
      const eigen = m.schwellen?.[def.id];
      const k = eigen ? { ...def, gruen: eigen.gruen, rot: eigen.rot } : def;
      const r = messe(k.id);
      const basis = {
        id: k.id, label: k.label, gruppe: k.gruppe, einheit: k.einheit, richtung: k.richtung, gruen: k.gruen, rot: k.rot, formel: k.formel,
        ...(k.pflegen ? { pflegen: k.pflegen } : {}), standard: { gruen: def.gruen, rot: def.rot }, angepasst: !!eigen, details: (r.details ?? []).slice(0, 8),
      };
      if ('luecke' in r || !Number.isFinite(r.wert)) return { ...basis, gemessen: false, wert: null, anzeige: null, quelle: 'luecke' in r ? r.luecke : 'kein Wert', punkte: null, ampel: 'grau' as Ampel };
      return { ...basis, gemessen: true, wert: r.wert, anzeige: r.anzeige, quelle: r.quelle, punkte: punkte(r.wert, k), ampel: ampel(r.wert, k) };
    });
    const gew = (id: string) => m.kennzahlen.find(k => k.id === id)?.gewicht ?? 1;
    const gem = kennzahlen.filter(k => k.gemessen);
    const gsum = gem.reduce((a, k) => a + gew(k.id), 0);
    const score = gem.length ? Math.round(gem.reduce((a, k) => a + (k.punkte as number) * gew(k.id), 0) / gsum) : null;
    // Abdeckung nach Gewicht: fehlt eine Kernkennzahl, wiegt die Lücke mehr.
    const alleG = kennzahlen.reduce((a, k) => a + gew(k.id), 0);
    const abdeckung = alleG ? gsum / alleG : 0;
    return { id: s.id, label: s.label, gewicht: s.gewicht, satz: s.satz, score, abdeckung, zuDuenn: score != null && abdeckung < MIN_ABDECKUNG, kennzahlen };
  });
  const zaehlt = saeulen.filter(s => s.score != null && !s.zuDuenn);
  const gw = zaehlt.reduce((a, s) => a + s.gewicht, 0);
  const index = gw > 0 ? Math.round(zaehlt.reduce((a, s) => a + (s.score as number) * s.gewicht, 0) / gw) : null;
  const abdeckung = saeulen.reduce((a, s) => a + (s.zuDuenn || s.score == null ? 0 : s.abdeckung) * s.gewicht, 0);
  let hebel: IndexErgebnis['hebel'] = null, best = -1;
  for (const s of zaehlt) for (const k of s.kennzahlen) {
    if (!k.gemessen) continue;
    const h = (100 - (k.punkte as number)) * s.gewicht / s.kennzahlen.filter(x => x.gemessen).length;
    if (h > best && (k.punkte as number) < 100) { best = h; hebel = { id: k.id, label: k.label, saeule: s.label }; }
  }
  return {
    scope: m.scope, stand: m.stand, index, label: indexLabel(index), abdeckung: Math.round(abdeckung * 100) / 100,
    saeulen, hebel, luecken: saeulen.reduce((a, s) => a + s.kennzahlen.filter(k => !k.gemessen).length, 0),
  };
}
