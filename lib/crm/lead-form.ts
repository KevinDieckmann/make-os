// ─── Lead säubern (rein) — ohne Abhängigkeiten, damit Firma- und Kontakt-Säuberer es teilen ──
import type { Lead, LeadStatus, Qual } from './typen';

const STATUS: LeadStatus[] = ['neu', 'kontaktiert', 'im_gespraech', 'qualifizierung', 'sql', 'kunde', 'kein_fit', 'ruht'];
const Q: Qual[] = ['ja', 'nein', 'unklar'];
const txt = (v: unknown, n: number) => { const t = String(v ?? '').replace(/\u0000/g, '').trim().slice(0, n); return t || undefined; };

/** Kennung eines Kriteriums der Scoring-Einstellungen (lib/crm/scoring.ts) bzw. einer Stufe. */
const KENNUNG = /^[a-z][a-z0-9_-]{0,30}$/;
/** So viele Einträge höchstens je Lead (Antworten, Stufen) — darüber lehnt der Schreibweg ab (413), das Säubern ist nur die Sicherung. */
export const LEAD_MAP_MAX = 60;
/** Freitext je Frage — nur gültige Kennungen, je höchstens 1000 Zeichen, leere fallen weg. */
function antworten(v: unknown): Lead['antworten'] | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: NonNullable<Lead['antworten']> = {};
  for (const [f, w] of Object.entries(o)) { if (!KENNUNG.test(f) || Object.keys(out).length >= LEAD_MAP_MAX) continue; const t = txt(w, 1000); if (t) out[f] = t; }
  return Object.keys(out).length ? out : undefined;
}
/** Gewählte Stufe je Kriterium (Kennung → Stufen-Kennung). */
function stufen(v: unknown): Lead['stufen'] | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out: NonNullable<Lead['stufen']> = {};
  for (const [f, w] of Object.entries(v as Record<string, unknown>)) { if (!KENNUNG.test(f) || typeof w !== 'string' || !KENNUNG.test(w) || Object.keys(out).length >= LEAD_MAP_MAX) continue; out[f] = w; }
  return Object.keys(out).length ? out : undefined;
}

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
    ...(antworten(o.antworten) ? { antworten: antworten(o.antworten) } : {}), ...(stufen(o.stufen) ? { stufen: stufen(o.stufen) } : {}), ...(tag(o.qualifiziertAm) ? { qualifiziertAm: tag(o.qualifiziertAm) } : {}),
    ...(typeof o.hauptKontaktId === 'string' && /^c-[a-z0-9-]{4,60}$/.test(o.hauptKontaktId) ? { hauptKontaktId: o.hauptKontaktId } : {}),
    ...(typeof o.wiedervorlage === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.wiedervorlage) ? { wiedervorlage: o.wiedervorlage } : {}), ...(typeof o.grundArt === 'string' && /^[a-z][a-z_]{0,29}$/.test(o.grundArt) ? { grundArt: o.grundArt } : {}),
    ...(tag(o.sqlAm) ? { sqlAm: tag(o.sqlAm) } : {}), ...(/^[a-z0-9][a-z0-9-]{1,63}$/.test(String(o.chanceId ?? '')) ? { chanceId: String(o.chanceId) } : {}),
    ...(tag(o.geaendert) ? { geaendert: tag(o.geaendert) } : {}), ...(/^[a-z0-9-]{1,40}$/.test(String(o.geaendertVon ?? '')) ? { geaendertVon: String(o.geaendertVon) } : {}),
  };
}
