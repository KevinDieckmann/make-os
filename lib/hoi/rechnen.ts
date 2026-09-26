// ─── Head of IT — reine Rechenhilfen (getestet, 27.09.) ─────────────────────
// Was aus Aufträgen, Anmeldungen, Oberflächenfehlern und CSP-Meldungen zu
// Zählern wird. Keine Inhalte, keine Adressen: nur Zahlen und Kürzel.

import type { Auftrag } from '@/lib/jarvis/auftraege';
import type { Anmeldung } from '@/lib/zugang/anmeldungen';
import { adresseGekuerzt } from '@/lib/zugang/anmeldungen';

const STUNDE = 3_600_000;

/** Fehlerquote der beendeten Läufe der letzten 24 h in Prozent — null ohne Läufe. */
export function fehlerquote24h(auftraege: Auftrag[], jetzt: string): number | null {
  const ab = Date.parse(jetzt) - 24 * STUNDE;
  const beendet = auftraege.filter(a => (a.status === 'fertig' || a.status === 'fehler') && a.beendet && Date.parse(a.beendet) >= ab);
  if (!beendet.length) return null;
  return Math.round((beendet.filter(a => a.status === 'fehler').length / beendet.length) * 100);
}

/** Fehlanmeldungen der letzten 24 h. */
export function fehlanmeldungen24h(liste: Anmeldung[], jetzt: string): number {
  const ab = Date.parse(jetzt) - 24 * STUNDE;
  return liste.filter(a => a.art === 'anmelden' && !a.ok && Date.parse(a.zeit) >= ab).length;
}

/** Netze (gekürzte Adressen), von denen in den letzten 7 Tagen erfolgreich angemeldet wurde und die in den 30 Tagen davor nie vorkamen. */
export function neueNetze7d(liste: Anmeldung[], jetzt: string): number {
  const t = Date.parse(jetzt); const ab7 = t - 7 * 24 * STUNDE; const ab37 = t - 37 * 24 * STUNDE;
  const ok = liste.filter(a => a.art === 'anmelden' && a.ok && a.adresse);
  const vorher = new Set(ok.filter(a => { const z = Date.parse(a.zeit); return z >= ab37 && z < ab7; }).map(a => adresseGekuerzt(a.adresse)));
  const neu = new Set(ok.filter(a => Date.parse(a.zeit) >= ab7).map(a => adresseGekuerzt(a.adresse)).filter(n => !vorher.has(n)));
  return neu.size;
}

export interface CspMeldung { zeit: string; richtlinie: string; blockiert: string; seite: string; anzahl: number }

/** Aus einem Browser-Bericht (alter Weg `csp-report` oder neuer `reports+json`) die Zähler-Form — ohne Parameter, ohne Inhalte. */
export function cspMeldungenAus(body: unknown, jetzt: string): Omit<CspMeldung, 'anzahl'>[] {
  const roh: Record<string, unknown>[] = [];
  if (Array.isArray(body)) for (const r of body) { const b = (r as { body?: unknown })?.body; if (b && typeof b === 'object') roh.push(b as Record<string, unknown>); }
  else if (body && typeof body === 'object') {
    const alt = (body as { 'csp-report'?: unknown })['csp-report'];
    if (alt && typeof alt === 'object') roh.push(alt as Record<string, unknown>);
    else if ('effectiveDirective' in (body as object) || 'violated-directive' in (body as object)) roh.push(body as Record<string, unknown>);
  }
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u001f]/g, '').slice(0, max);
  const pfadNur = (v: unknown) => { const s = text(v, 400); if (!s) return ''; try { return new URL(s).pathname.slice(0, 120); } catch { return s.split('?')[0].slice(0, 120); } };
  const quelle = (v: unknown) => { const s = text(v, 400); if (!s) return ''; if (['inline', 'eval', 'data', 'blob', 'self'].includes(s)) return s; try { const u = new URL(s); return `${u.protocol}//${u.host}`.slice(0, 120); } catch { return s.split('?')[0].slice(0, 120); } };
  return roh.map(r => ({
    zeit: jetzt,
    richtlinie: text(r.effectiveDirective ?? r['effective-directive'] ?? r['violated-directive'], 60) || 'unbekannt',
    blockiert: quelle(r.blockedURL ?? r['blocked-uri']) || '—',
    seite: pfadNur(r.documentURL ?? r['document-uri']) || '/',
  })).slice(0, 10);
}

/** Meldungen zusammenführen: gleiche Richtlinie + Quelle + Seite zählt hoch; höchstens `max` Einträge, nichts älter als 30 Tage. */
export function cspZusammenfuehren(alt: CspMeldung[], neu: Omit<CspMeldung, 'anzahl'>[], jetzt: string, max = 200): CspMeldung[] {
  const ab = Date.parse(jetzt) - 30 * 24 * STUNDE;
  const liste = alt.filter(m => Date.parse(m.zeit) >= ab);
  for (const n of neu) {
    const i = liste.findIndex(m => m.richtlinie === n.richtlinie && m.blockiert === n.blockiert && m.seite === n.seite);
    if (i >= 0) liste[i] = { ...liste[i], zeit: n.zeit, anzahl: liste[i].anzahl + 1 };
    else liste.push({ ...n, anzahl: 1 });
  }
  return liste.sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, max);
}

/** Summe der CSP-Meldungen der letzten 7 Tage und die häufigste blockierte Quelle. */
export function cspBild(liste: CspMeldung[], jetzt: string): { meldungen7d: number; top?: string } {
  const ab = Date.parse(jetzt) - 7 * 24 * STUNDE;
  const frisch = liste.filter(m => Date.parse(m.zeit) >= ab);
  const je = new Map<string, number>();
  for (const m of frisch) je.set(`${m.richtlinie} ← ${m.blockiert}`, (je.get(`${m.richtlinie} ← ${m.blockiert}`) ?? 0) + m.anzahl);
  const top = [...je.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { meldungen7d: frisch.reduce((s, m) => s + m.anzahl, 0), ...(top ? { top } : {}) };
}

/** Außenmeldung prüfen und auf die erlaubte Form bringen — alles andere fällt weg. */
export function aussenSaeubern(roh: unknown, jetzt: string): { zeit: string; status?: number; ms?: number; tlsTage?: number; kopfzeilen?: Record<string, boolean>; laeufer?: string; observatory?: { note?: string; punkte?: number } } | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Record<string, unknown>;
  const zahl = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined);
  const zeit = typeof r.zeit === 'string' && !Number.isNaN(Date.parse(r.zeit)) && Math.abs(Date.parse(r.zeit) - Date.parse(jetzt)) < 24 * STUNDE ? new Date(r.zeit).toISOString() : jetzt;
  const kopf: Record<string, boolean> = {};
  if (r.kopfzeilen && typeof r.kopfzeilen === 'object') for (const [k, v] of Object.entries(r.kopfzeilen as Record<string, unknown>).slice(0, 12)) if (/^[a-z0-9-]{1,60}$/.test(k) && typeof v === 'boolean') kopf[k] = v;
  const obs = r.observatory && typeof r.observatory === 'object' ? r.observatory as Record<string, unknown> : null;
  const note = obs && typeof obs.note === 'string' && /^[A-F][+-]?$/.test(obs.note) ? obs.note : undefined;
  return {
    zeit, ...(zahl(r.status, 0, 999) !== undefined ? { status: zahl(r.status, 0, 999) } : {}), ...(zahl(r.ms, 0, 600_000) !== undefined ? { ms: zahl(r.ms, 0, 600_000) } : {}),
    ...(zahl(r.tlsTage, -3650, 3650) !== undefined ? { tlsTage: zahl(r.tlsTage, -3650, 3650) } : {}), ...(Object.keys(kopf).length ? { kopfzeilen: kopf } : {}),
    ...(typeof r.laeufer === 'string' && /^[a-z0-9-]{1,20}$/.test(r.laeufer) ? { laeufer: r.laeufer } : {}),
    ...(note || zahl(obs?.punkte, 0, 200) !== undefined ? { observatory: { ...(note ? { note } : {}), ...(zahl(obs?.punkte, 0, 200) !== undefined ? { punkte: zahl(obs?.punkte, 0, 200) } : {}) } } : {}),
  };
}
