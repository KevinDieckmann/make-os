// ─── MAKE OS — Prospecting: Zielliste + ideales Kundenprofil (ICP) ──────────────────────────────────────────────────────────────
// Die Zielliste (Bestand `prospects`): Firmen rein, die KI bewertet gegen das ICP (Score, Fit, Aufhänger), man priorisiert.
// Woche 2 · 1.14 (09.10.): kein festes Produkt-Profil mehr im Code (Plattform-Regel) — das ICP kommt aus Marketing › Positionierung
// (Positionierung + ICP der Einstellung, `wirksamesIcp`); nur ohne Einstellung gilt das hier gespeicherte eigene Profil. „In die Kartei
// übernehmen“ legt Firma (und Ansprechpartner) über den EINEN Weg an (POST /api/crm/person) — der Prospect merkt sich `kartei`.
// Gespeichert wird je Eintrag mit Stand (PATCH /api/state/prospects), nie mehr die ganze Liste aus dem Browser.

export type ProspectStatus = 'neu' | 'qualifiziert' | 'kontaktiert' | 'verworfen';

export const PROSPECT_STATUS_ORDER: ProspectStatus[] = ['neu', 'qualifiziert', 'kontaktiert', 'verworfen'];
export const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = {
  neu: 'Neu', qualifiziert: 'Qualifiziert', kontaktiert: 'Kontaktiert', verworfen: 'Verworfen',
};

export interface Prospect {
  id: string;
  company: string;
  domain?: string;
  industry?: string;
  size?: string;
  region?: string;
  status: ProspectStatus;
  score?: number;          // 0–100, vom KI-Scoring
  fit?: string;            // Begründung, warum es passt
  angle?: string;          // vorgeschlagener Aufhänger für die Ansprache
  source?: string;         // woher (z. B. „Recherche“, „manuell“)
  addedAt: string;         // ISO
  /** In die Kartei übernommen (1.14): Firma und ggf. Ansprechpartner — ab hier lebt der Lead in der Markttraktion. */
  kartei?: { firmaId: string; kontaktId?: string; am: string };
}

export interface ProspectsState { icp: string; prospects: Prospect[]; }

/** Ohne Einstellung und ohne eigenes Profil: der Hinweis, wo das Profil gepflegt wird (kein Produkt im Code). */
export const ICP_HINWEIS = 'Noch kein Kundenprofil: unter Markttraktion › Marketing › Positionierung „Positionierung“ und „ICP“ eintragen — daran bewertet die KI die Zielliste.';
export const ICP_MAX = 3000;

/**
 * Das Profil, gegen das bewertet wird: Marketing › Positionierung (Positionierung + ICP) — sonst das eigene der Zielliste — sonst leer.
 * EINE Stelle für Route (GET liefert es als `state.icp`, so liest es auch der Agent) und Oberfläche.
 */
export function wirksamesIcp(einstellung: { positionierung?: string; icp?: string } | null | undefined, eigenes?: string): { text: string; quelle: 'marketing' | 'eigen' | 'leer' } {
  const pos = einstellung?.positionierung?.trim(), icp = einstellung?.icp?.trim();
  const teile = [pos ? `Positionierung: ${pos}` : '', icp ? `Ideales Kundenprofil: ${icp}` : ''].filter(Boolean);
  if (teile.length) return { text: teile.join('\n'), quelle: 'marketing' };
  if (eigenes?.trim()) return { text: eigenes.trim(), quelle: 'eigen' };
  return { text: '', quelle: 'leer' };
}

const GRENZE = { name: 200, kurz: 200, lang: 2000 } as const;
const t = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim() : '').slice(0, n) || undefined;
/** Einen Eintrag säubern (Server): Kennung `p-…`, Firma Pflicht, Status aus der Liste, Score 0–100. Der Stand (`stand`) fällt weg. */
export function prospectSaeubern(roh: unknown): Prospect | null {
  const o = roh && typeof roh === 'object' ? (roh as Record<string, unknown>) : {};
  const id = typeof o.id === 'string' && /^p-[a-z0-9-]{1,80}$/.test(o.id) ? o.id : null;
  const company = t(o.company, GRENZE.name);
  if (!id || !company) return null;
  const score = typeof o.score === 'number' && Number.isFinite(o.score) ? Math.max(0, Math.min(100, Math.round(o.score))) : undefined;
  const k = o.kartei && typeof o.kartei === 'object' ? o.kartei as Record<string, unknown> : null;
  const kartei = k && typeof k.firmaId === 'string' && /^f-[a-z0-9-]{2,63}$/.test(k.firmaId)
    ? { firmaId: k.firmaId, ...(typeof k.kontaktId === 'string' && /^c-[a-z0-9-]{2,63}$/.test(k.kontaktId) ? { kontaktId: k.kontaktId } : {}), am: typeof k.am === 'string' ? k.am.slice(0, 30) : '' }
    : undefined;
  const feld = (name: 'domain' | 'industry' | 'size' | 'region' | 'source', n: number) => { const v = t(o[name], n); return v ? { [name]: v } : {}; };
  return {
    id, company, status: (PROSPECT_STATUS_ORDER as string[]).includes(String(o.status)) ? o.status as ProspectStatus : 'neu',
    ...feld('domain', GRENZE.kurz), ...feld('industry', GRENZE.kurz), ...feld('size', GRENZE.kurz), ...feld('region', GRENZE.kurz),
    ...(score !== undefined ? { score } : {}), ...(t(o.fit, GRENZE.lang) ? { fit: t(o.fit, GRENZE.lang) } : {}), ...(t(o.angle, GRENZE.lang) ? { angle: t(o.angle, GRENZE.lang) } : {}),
    ...feld('source', GRENZE.kurz), addedAt: typeof o.addedAt === 'string' ? o.addedAt.slice(0, 30) : '',
    ...(kartei ? { kartei } : {}),
  };
}

/** Neue Kennung aus dem Firmennamen — mit Zufallsteil, nie aus Zeit oder Position in der Liste. */
export const prospectKennung = (name: string, zufall: string) => `p-${name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'firma'}-${zufall.replace(/[^a-z0-9]/g, '').slice(0, 12)}`;

export const PIPELINE_HINT =
  'Neu → von der KI qualifizieren lassen (Score + Fit + Aufhänger) → die besten in die Kartei übernehmen (dort werden sie ein Lead) → Rest verwerfen.';
