// ─── Kennzahlen-Index — Verlauf und Schwellen (Server, generisch) ───────────
// Jeder Index (Business, Privat, Gesundheit, Markttraktion) hält je Datei:
// eigene Schwellen und einen Schnappschuss je Tag (400 Tage). Daraus kommen
// Verlauf (90 Tage), Trend (30 Tage) und Ampel-Wechsel seit dem letzten Tag.
// Der Dateiname ist fest vorgegeben (nie aus einer Anfrage gebaut).

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Ampel, IndexErgebnis, KennzahlDefBasis, Schwelle } from './kern';

export interface IndexTag { index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null>; ampeln: Record<string, Ampel> }
export interface IndexDatei { schwellen: Record<string, Schwelle>; tage: Record<string, IndexTag> }
export interface Wechsel { id: string; von: Ampel; nach: Ampel; seit: string }
export interface VerlaufPunkt { tag: string; index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null> }
export interface IndexVerlauf { verlauf: VerlaufPunkt[]; vor30: number | null; wechsel: Wechsel[] }

const NAME_OK = /^[a-z0-9][a-z0-9-]{0,79}$/;
export function indexName(name: string): string {
  if (!NAME_OK.test(name)) throw new Error(`Ungültiger Speichername: ${name}`);
  return name;
}
const leer = (): IndexDatei => ({ schwellen: {}, tage: {} });

export async function ladeIndexDatei<E extends object = Record<never, never>>(name: string): Promise<IndexDatei & Partial<E>> {
  const d = await loadJson<IndexDatei & Partial<E>>(indexName(name));
  return { ...leer(), ...(d ?? {}) } as IndexDatei & Partial<E>;
}

export function tagVon(pi: IndexErgebnis): IndexTag {
  const werte: Record<string, number | null> = {}, ampeln: Record<string, Ampel> = {};
  for (const s of pi.saeulen) for (const k of s.kennzahlen) { werte[k.id] = k.wert; ampeln[k.id] = k.ampel; }
  return { index: pi.index, saeulen: Object.fromEntries(pi.saeulen.map(s => [s.id, s.score])), werte, ampeln };
}

const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Verlauf, Trend und Ampel-Wechsel aus der Datei — der heutige Stand kommt aus `pi`. */
export function verlaufAus(d: IndexDatei, pi: IndexErgebnis, heute: string): IndexVerlauf {
  const frueher = Object.keys(d.tage).filter(t => t < heute).sort();
  const vorher = frueher.at(-1);
  const t30 = frueher.filter(t => t <= tagPlus(heute, -30)).at(-1) ?? frueher[0];
  const wechsel: Wechsel[] = [];
  if (vorher) for (const s of pi.saeulen) for (const k of s.kennzahlen) {
    const a = d.tage[vorher].ampeln[k.id];
    if (a && a !== k.ampel && a !== 'grau' && k.ampel !== 'grau') wechsel.push({ id: k.id, von: a, nach: k.ampel, seit: vorher });
  }
  const verlauf: VerlaufPunkt[] = frueher.slice(-90).map(t => ({ tag: t, index: d.tage[t].index, saeulen: d.tage[t].saeulen, werte: d.tage[t].werte }));
  verlauf.push({ tag: heute, ...tagVon(pi) });
  return { verlauf, vor30: t30 ? d.tage[t30].index : null, wechsel };
}

/**
 * Schnappschuss des Tages festhalten (einmal je Tag; `wenn` verhindert leere
 * Schnappschüsse, z. B. ohne Buchungen) und den Verlauf liefern.
 */
export async function fortschreiben(name: string, d: IndexDatei, pi: IndexErgebnis, heute: string, wenn = true): Promise<IndexVerlauf> {
  if (wenn && !d.tage[heute]) {
    await updateJson<IndexDatei>(indexName(name), alt => {
      const neu = { ...leer(), ...(alt ?? {}) };
      neu.tage = { ...neu.tage, [heute]: tagVon(pi) };
      const tage = Object.keys(neu.tage).sort();
      for (const t of tage.slice(0, Math.max(0, tage.length - 400))) delete neu.tage[t];
      return neu;
    }).catch(() => null);
  }
  return verlaufAus(d, pi, heute);
}

const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);

/** Eigene Schwelle prüfen: bekannte Kennzahl, Zahlen, richtige Reihenfolge. */
export function schwellePruefen(kennzahlen: KennzahlDefBasis[], roh: { id?: unknown; gruen?: unknown; rot?: unknown; zuruecksetzen?: unknown }): { ok: true; id: string; schwelle: Schwelle | null } | { ok: false; fehler: string } {
  const k = kennzahlen.find(x => x.id === roh.id);
  if (!k) return { ok: false, fehler: 'Unbekannte Kennzahl.' };
  if (roh.zuruecksetzen === true) return { ok: true, id: k.id, schwelle: null };
  const gruen = zahl(roh.gruen), rot = zahl(roh.rot);
  if (!Number.isFinite(gruen) || !Number.isFinite(rot)) return { ok: false, fehler: 'Grün und Rot bitte als Zahl.' };
  if (k.richtung === 'hoch' ? gruen <= rot : gruen >= rot) return { ok: false, fehler: k.richtung === 'hoch' ? 'Mehr ist besser: Grün muss über Rot liegen.' : 'Weniger ist besser: Grün muss unter Rot liegen.' };
  return { ok: true, id: k.id, schwelle: { gruen, rot } };
}

/** Eigene Schwelle setzen oder zurücksetzen. */
export async function speichereSchwelle(name: string, kennzahlen: KennzahlDefBasis[], roh: Record<string, unknown>): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const p = schwellePruefen(kennzahlen, roh);
  if (!p.ok) return p;
  await updateJson<IndexDatei>(indexName(name), alt => {
    const neu = { ...leer(), ...(alt ?? {}) };
    const liste = { ...neu.schwellen };
    if (p.schwelle) liste[p.id] = p.schwelle; else delete liste[p.id];
    return { ...neu, schwellen: liste };
  });
  return { ok: true };
}
