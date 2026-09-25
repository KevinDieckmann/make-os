// ─── Lead säubern (rein) — ohne Abhängigkeiten, damit Firma- und Kontakt-Säuberer es teilen ──
import type { Lead, LeadStatus, Qual } from './typen';

const STATUS: LeadStatus[] = ['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung', 'sql', 'kunde', 'kein_fit', 'ruht'];
const Q: Qual[] = ['ja', 'nein', 'unklar'];
const txt = (v: unknown, n: number) => { const t = String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n); return t || undefined; };

/** Nur, was das Modell kennt — sonst undefined (dann gilt der abgeleitete Status). */
export function leadSaeubern(v: unknown): Lead | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (!STATUS.includes(o.status as LeadStatus)) return undefined;
  const k = (o.kriterien ?? {}) as Record<string, unknown>;
  const q = (x: unknown): Qual => (Q.includes(x as Qual) ? (x as Qual) : 'unklar');
  const tag = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 25) : undefined);
  return {
    status: o.status as LeadStatus,
    kriterien: { schmerz: q(k.schmerz), entscheider: q(k.entscheider), budget: q(k.budget), zeitpunkt: q(k.zeitpunkt), wirkung: q(k.wirkung), alternative: q(k.alternative) },
    ...(Q.includes(o.fit as Qual) ? { fit: o.fit as Qual } : {}),
    ...(txt(o.notiz, 2000) ? { notiz: txt(o.notiz, 2000) } : {}), ...(txt(o.grund, 300) ? { grund: txt(o.grund, 300) } : {}),
    ...(tag(o.sqlAm) ? { sqlAm: tag(o.sqlAm) } : {}), ...(/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(o.chanceId ?? '')) ? { chanceId: String(o.chanceId) } : {}),
    ...(tag(o.geaendert) ? { geaendert: tag(o.geaendert) } : {}), ...(/^[a-z0-9-]{1,40}$/.test(String(o.geaendertVon ?? '')) ? { geaendertVon: String(o.geaendertVon) } : {}),
  };
}
