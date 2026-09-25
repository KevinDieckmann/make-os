// ─── Kalender — Fristen und Erinnerungen (rein, getestet) ───────────────────
// Kevin 25.09.: „Dann können wir darin auch alles sehen, was wir machen
// müssen.“ Neben den Terminen gehören in den Kalender die Stichtage aus dem
// ganzen System: Meilensteine, Bauplan-Etappen, Mandate (Ende, Kündigungs-
// frist, Review), offene Zahlungen und erwartete Zahlungseingänge — dazu die
// Apple-Erinnerungen, wenn der Mac sie zuliefert (iCloud gibt Erinnerungen
// seit iOS 13 nicht mehr über CalDAV heraus). Aufgaben mit Datum kommen im
// Browser aus dem Aufgaben-Bestand (abhakbar), nicht von hier.

import { tagPlus } from './zeit';

export type FristArt = 'meilenstein' | 'etappe' | 'mandat' | 'zahlung' | 'eingang';
export interface Frist { id: string; art: FristArt; tag: string; titel: string; unter?: string; href: string; erledigt?: boolean }
export interface Erinnerung { id: string; tag: string; zeit?: string; titel: string; liste?: string }

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const imZeitraum = (tag: string | undefined, von: string, bis: string): tag is string => !!tag && TAG.test(tag.slice(0, 10)) && tag.slice(0, 10) >= von && tag.slice(0, 10) < bis;
const eur = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n) : undefined);

export interface Quellen {
  meilensteine?: { id: string; titel: string; faellig?: string; erledigt?: boolean; bereich?: string }[];
  etappen?: { id: string; name: string; ziel?: string }[];
  mandate?: { id: string; kunde: string; titel?: string; status?: string; ende?: string; kuendigungsfristTage?: number; naechstesReview?: string }[];
  zahlungen?: { id: string; an?: string; titel?: string; betrag?: number; status?: string; faellig?: string }[];
  rechnungen?: { id: string; kunde?: string; titel?: string; betrag?: number; status?: string; faellig?: string }[];
}

/** Alle Stichtage im Zeitraum [von, bis) — Berliner Tage. */
export function fristen(q: Quellen, von: string, bis: string): Frist[] {
  const raus: Frist[] = [];
  for (const m of q.meilensteine ?? []) {
    if (imZeitraum(m.faellig, von, bis)) raus.push({ id: `ms-${m.id}`, art: 'meilenstein', tag: m.faellig.slice(0, 10), titel: m.titel, unter: m.bereich, href: '/os/planung/jahr', erledigt: !!m.erledigt });
  }
  for (const e of q.etappen ?? []) {
    if (imZeitraum(e.ziel, von, bis)) raus.push({ id: `et-${e.id}`, art: 'etappe', tag: e.ziel, titel: e.name, unter: 'Bauplan-Etappe', href: '/os/bauplan?s=plan' });
  }
  for (const m of q.mandate ?? []) {
    if (m.status && !['aktiv', 'pausiert'].includes(m.status)) continue;
    const name = m.kunde || m.titel || 'Mandat';
    if (imZeitraum(m.ende, von, bis)) raus.push({ id: `md-ende-${m.id}`, art: 'mandat', tag: m.ende.slice(0, 10), titel: `Mandat endet: ${name}`, href: '/os/mandate' });
    if (m.ende && TAG.test(m.ende.slice(0, 10)) && m.kuendigungsfristTage && m.kuendigungsfristTage > 0) {
      const frist = tagPlus(m.ende.slice(0, 10), -m.kuendigungsfristTage);
      if (imZeitraum(frist, von, bis)) raus.push({ id: `md-frist-${m.id}`, art: 'mandat', tag: frist, titel: `Kündigungsfrist: ${name}`, unter: `${m.kuendigungsfristTage} Tage vor Ende`, href: '/os/mandate' });
    }
    if (imZeitraum(m.naechstesReview, von, bis)) raus.push({ id: `md-review-${m.id}`, art: 'mandat', tag: m.naechstesReview.slice(0, 10), titel: `Review: ${name}`, href: '/os/mandate' });
  }
  for (const z of q.zahlungen ?? []) {
    if (z.status === 'bezahlt' || z.status === 'erledigt') continue;
    if (imZeitraum(z.faellig, von, bis)) raus.push({ id: `za-${z.id}`, art: 'zahlung', tag: z.faellig.slice(0, 10), titel: `Zahlung: ${z.an || z.titel || '—'}`, unter: [z.titel && z.an ? z.titel : undefined, eur(z.betrag)].filter(Boolean).join(' · ') || undefined, href: '/os/finanzen' });
  }
  for (const r of q.rechnungen ?? []) {
    // Nur gestellte Rechnungen: da wartet Geld. Geplante sind noch keine Frist.
    if (r.status && r.status !== 'gestellt' && r.status !== 'offen') continue;
    if (imZeitraum(r.faellig, von, bis)) raus.push({ id: `re-${r.id}`, art: 'eingang', tag: r.faellig.slice(0, 10), titel: `Zahlungseingang: ${r.kunde || r.titel || '—'}`, unter: [r.titel && r.kunde ? r.titel : undefined, eur(r.betrag)].filter(Boolean).join(' · ') || undefined, href: '/os/finanzen' });
  }
  return raus.sort((a, b) => a.tag.localeCompare(b.tag) || a.titel.localeCompare(b.titel));
}

/** Apple-Erinnerungen (vom Mac zugeliefert) mit Datum im Zeitraum. */
export function erinnerungen(roh: unknown, von: string, bis: string, wand: (d: Date) => string): Erinnerung[] {
  if (!Array.isArray(roh)) return [];
  const raus: Erinnerung[] = [];
  for (const r of roh as { id?: string; title?: string; due?: string; list?: string }[]) {
    if (!r?.title || !r.due) continue;
    const d = new Date(r.due);
    if (Number.isNaN(d.getTime())) continue;
    const w = wand(d);
    const tag = w.slice(0, 10);
    if (tag < von || tag >= bis) continue;
    raus.push({ id: `er-${r.id ?? `${tag}-${r.title}`}`, tag, ...(w.slice(11, 16) !== '00:00' ? { zeit: w.slice(11, 16) } : {}), titel: String(r.title).slice(0, 200), ...(r.list ? { liste: String(r.list).slice(0, 80) } : {}) });
  }
  return raus;
}
