// ─── Unternehmen › Gesundheits-Verlauf des Schilds (rein, client-sicher, 11.10.) ────────────────────────────────────────────────────
// Kevin 11.10.: „denk immer 2–3 Schritte weiter.“ Wie hat sich das Schild entwickelt? Es gab keinen Verlauf — ab jetzt merkt MAKE OS sich EINEN Punkt je
// Tag (Morgenlauf): je Business-Gesellschaft der Ton (./blick.ts) und die vier Dimensionen als ganze Prozent. Nur Zahlen und Kennungen der Gesellschaften
// — keine Titel, keine Personen. Bestand `unternehmen-verlauf--<haushalt>` (Business, Speicher-Register ohne Personenbezug), rollend 400 Tage (wie der
// Verlauf der Indizes). Ein Tag wird höchstens ersetzt (idempotent), nie doppelt.

import type { LageBlick, Ton } from './blick';

export const verlaufName = (haushalt: string) => `unternehmen-verlauf--${haushalt}`;
/** So viele Tage bleiben (rollend, wie der Verlauf der Indizes). */
export const VERLAUF_TAGE = 400;

/** Dimensionen in der Reihenfolge Dokumente · Pflichten · Risiken · Schutz, ganze Prozent — null = noch nichts zu messen. */
export type Dims = [number | null, number | null, number | null, number | null];
export interface VerlaufPunkt { tag: string; je: Record<string, { t: Ton; d: Dims }> }
export interface VerlaufDatei { tage: VerlaufPunkt[] }

const TOENE: readonly Ton[] = ['rot', 'gelb', 'ruhig', 'gruen'];

/** Der Punkt eines Tages aus dem Blick (rein). */
export function verlaufPunkt(b: LageBlick, tag: string): VerlaufPunkt {
  const je: VerlaufPunkt['je'] = {};
  for (const x of b.je) je[x.id] = { t: x.ton, d: x.dimensionen.map(d => (d.anteil === null ? null : Math.round(d.anteil * 100))) as Dims };
  return { tag, je };
}

const tagMinus = (tag: string, n: number) => { const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Den Punkt anhängen bzw. den Tag ersetzen (rein); älter als 400 Tage fällt heraus. `geaendert` = muss geschrieben werden. */
export function verlaufAnhaengen(d: VerlaufDatei | null | undefined, p: VerlaufPunkt): { d: VerlaufDatei; geaendert: boolean } {
  const alt = Array.isArray(d?.tage) ? d!.tage.filter(x => x && typeof x.tag === 'string') : [];
  const grenze = tagMinus(p.tag, VERLAUF_TAGE);
  const neu = [...alt.filter(x => x.tag !== p.tag && x.tag > grenze), p].sort((a, b) => a.tag.localeCompare(b.tag));
  const geaendert = JSON.stringify(neu) !== JSON.stringify(alt);
  return { d: { ...(d ?? {}), tage: neu }, geaendert };
}

/** Nur die Gesellschaften, die die Sicht sehen darf (Business, aktuell im Schild) — Filter am Server vor der Auslieferung. */
export function verlaufFuer(d: VerlaufDatei | null | undefined, ids: readonly string[]): VerlaufPunkt[] {
  const erlaubt = new Set(ids);
  return (d?.tage ?? []).map(p => ({ tag: p.tag, je: Object.fromEntries(Object.entries(p.je ?? {}).filter(([id, x]) => erlaubt.has(id) && x && TOENE.includes(x.t))) })).filter(p => Object.keys(p.je).length > 0);
}

/** Eine Reihe für das Bild (rein): je Tag der Ton einer Gesellschaft bzw. — ohne `id` — der schlimmste über alle. */
export function verlaufReihe(tage: readonly VerlaufPunkt[], id?: string): { tag: string; ton: Ton }[] {
  const rang: Record<Ton, number> = { rot: 3, gelb: 2, ruhig: 1, gruen: 0 };
  const raus: { tag: string; ton: Ton }[] = [];
  for (const p of tage) {
    const t = id ? p.je[id]?.t : Object.values(p.je).map(x => x.t).reduce<Ton | undefined>((a, x) => (!a || rang[x] > rang[a] ? x : a), undefined);
    if (t) raus.push({ tag: p.tag, ton: t });
  }
  return raus;
}
