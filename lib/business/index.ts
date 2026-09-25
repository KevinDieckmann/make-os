// ─── Business-Index — Punkte, Säulen, Gesamt (rein, getestet) ───────────────
// Jede Kennzahl → 0–100 über ihre eigenen Schwellen: an der roten Schwelle
// 20, an der grünen 100, dazwischen linear; jenseits von Rot fällt es bis 0
// (eine Schwellenbreite weiter), jenseits von Grün bleibt es bei 100.
// Säule = Mittel ihrer gemessenen Kennzahlen; unter 40 % Abdeckung zählt sie
// nicht (steht als „zu wenig Daten“ da). Gesamt = 50/30/20 arithmetisch über
// die zählenden Säulen, neu gewichtet — wie der KSI (Briefing A.1).

import { SAEULEN, kennzahlenFuer, type KennzahlDef, type SaeuleId, type Scope } from './register';
import { MESSEN, type Bestand, type Messung } from './messen';

export type Ampel = 'gruen' | 'gelb' | 'rot' | 'grau';

export const MIN_ABDECKUNG = 0.4;

export function punkte(wert: number, k: Pick<KennzahlDef, 'richtung' | 'gruen' | 'rot' | 'direkt'>): number {
  if (k.direkt) return Math.max(0, Math.min(100, Math.round(wert)));
  const breite = Math.abs(k.gruen - k.rot) || 1;
  // Abstand zur roten Schwelle in Schwellenbreiten, in Richtung „besser“ positiv.
  const t = k.richtung === 'hoch' ? (wert - k.rot) / breite : (k.rot - wert) / breite;
  const p = t >= 1 ? 100 : t >= 0 ? 20 + 80 * t : 20 * (1 + t);
  return Math.max(0, Math.min(100, Math.round(p)));
}

export function ampel(wert: number, k: Pick<KennzahlDef, 'richtung' | 'gruen' | 'rot'>): Ampel {
  if (k.richtung === 'hoch') return wert >= k.gruen ? 'gruen' : wert < k.rot ? 'rot' : 'gelb';
  return wert <= k.gruen ? 'gruen' : wert > k.rot ? 'rot' : 'gelb';
}

export const indexLabel = (n: number | null) => (n == null ? 'Noch keine Daten' : n >= 80 ? 'Souverän' : n >= 60 ? 'Solide' : n >= 40 ? 'Verbesserungsfähig' : 'Kritisch');

export interface KennzahlStand {
  id: string; label: string; gruppe: string; einheit: KennzahlDef['einheit']; richtung: KennzahlDef['richtung'];
  gruen: number; rot: number; formel: string; pflegen?: KennzahlDef['pflegen'];
  gemessen: boolean; wert: number | null; anzeige: string | null; quelle: string;
  punkte: number | null; ampel: Ampel;
}
export interface SaeulenStand { id: SaeuleId; label: string; gewicht: number; satz: string; score: number | null; abdeckung: number; zuDuenn: boolean; kennzahlen: KennzahlStand[] }
export interface BusinessIndex {
  scope: Scope; stand: string;
  index: number | null; label: string;
  /** Wie viel des Index auf echten Daten steht (0–1). */
  abdeckung: number;
  saeulen: SaeulenStand[];
  /** Die Kennzahl mit dem größten Hebel: wenig Punkte × schwere Säule. */
  hebel: { id: string; label: string; saeule: string } | null;
  luecken: number;
}

function messe(id: string, b: Bestand): Messung {
  try { return MESSEN[id](b); } catch (e) { return { luecke: `Rechenfehler: ${e instanceof Error ? e.message : 'unbekannt'}` }; }
}

export function berechne(b: Bestand): BusinessIndex {
  const defs = kennzahlenFuer(b.scope);
  const saeulen: SaeulenStand[] = SAEULEN.map(s => {
    const kennzahlen: KennzahlStand[] = defs.filter(k => k.saeule === s.id).map(k => {
      const m = messe(k.id, b);
      const basis = { id: k.id, label: k.label, gruppe: k.gruppe, einheit: k.einheit, richtung: k.richtung, gruen: k.gruen, rot: k.rot, formel: k.formel, ...(k.pflegen ? { pflegen: k.pflegen } : {}) };
      if ('luecke' in m || !Number.isFinite(m.wert)) return { ...basis, gemessen: false, wert: null, anzeige: null, quelle: 'luecke' in m ? m.luecke : 'kein Wert', punkte: null, ampel: 'grau' as Ampel };
      return { ...basis, gemessen: true, wert: m.wert, anzeige: m.anzeige, quelle: m.quelle, punkte: punkte(m.wert, k), ampel: ampel(m.wert, k) };
    });
    const gem = kennzahlen.filter(k => k.gemessen);
    const score = gem.length ? Math.round(gem.reduce((a, k) => a + (k.punkte as number), 0) / gem.length) : null;
    const abdeckung = kennzahlen.length ? gem.length / kennzahlen.length : 0;
    return { id: s.id, label: s.label, gewicht: s.gewicht, satz: s.satz, score, abdeckung, zuDuenn: score != null && abdeckung < MIN_ABDECKUNG, kennzahlen };
  });
  const zaehlt = saeulen.filter(s => s.score != null && !s.zuDuenn);
  const gw = zaehlt.reduce((a, s) => a + s.gewicht, 0);
  const index = gw > 0 ? Math.round(zaehlt.reduce((a, s) => a + (s.score as number) * s.gewicht, 0) / gw) : null;
  const abdeckung = saeulen.reduce((a, s) => a + (s.zuDuenn || s.score == null ? 0 : s.abdeckung) * s.gewicht, 0);
  let hebel: BusinessIndex['hebel'] = null, best = -1;
  for (const s of zaehlt) for (const k of s.kennzahlen) {
    if (!k.gemessen) continue;
    const h = (100 - (k.punkte as number)) * s.gewicht / s.kennzahlen.filter(x => x.gemessen).length;
    if (h > best && (k.punkte as number) < 100) { best = h; hebel = { id: k.id, label: k.label, saeule: s.label }; }
  }
  return {
    scope: b.scope, stand: b.heute, index, label: indexLabel(index), abdeckung: Math.round(abdeckung * 100) / 100,
    saeulen, hebel, luecken: saeulen.reduce((a, s) => a + s.kennzahlen.filter(k => !k.gemessen).length, 0),
  };
}
