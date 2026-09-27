// ─── MAKE OS — Planung: der Zeitraum eines Horizonts ────────────────────────
// Tag, Woche (Mo–So), Monat, Quartal, Jahr — als Grenzen YYYY-MM-DD und mit
// Beschriftung. Rein, auf einem gegebenen „heute“ gerechnet, damit prüfbar.

import type { ZielHorizont } from './typen';

export interface Zeitraum { von: string; bis: string; label: string }

const p = (n: number) => String(n).padStart(2, '0');
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const tageImMonat = (y: number, m1: number) => new Date(y, m1, 0).getDate();

/** Montag der Woche eines Tages (YYYY-MM-DD, ohne Zeitzonen-Sprung). */
export function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function tagePlus(tag: string, n: number): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function zeitraum(h: ZielHorizont, heute: string): Zeitraum {
  const y = Number(heute.slice(0, 4)), m = Number(heute.slice(5, 7));
  if (h === 'tag') {
    const d = new Date(`${heute}T12:00:00`);
    return { von: heute, bis: heute, label: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }) };
  }
  if (h === 'woche') {
    const mo = montagVon(heute), so = tagePlus(mo, 6);
    return { von: mo, bis: so, label: `KW ${kalenderwoche(heute)} · ${mo.slice(8)}.${mo.slice(5, 7)}.–${so.slice(8)}.${so.slice(5, 7)}.` };
  }
  if (h === 'monat') return { von: `${y}-${p(m)}-01`, bis: `${y}-${p(m)}-${p(tageImMonat(y, m))}`, label: `${MONATE[m - 1]} ${y}` };
  if (h === 'quartal') {
    const q = Math.floor((m - 1) / 3);
    return { von: `${y}-${p(q * 3 + 1)}-01`, bis: `${y}-${p(q * 3 + 3)}-${p(tageImMonat(y, q * 3 + 3))}`, label: `Q${q + 1} ${y}` };
  }
  return { von: `${y}-01-01`, bis: `${y}-12-31`, label: String(y) };
}

/** ISO-Kalenderwoche. */
export function kalenderwoche(tag: string): number {
  const d = new Date(Date.UTC(Number(tag.slice(0, 4)), Number(tag.slice(5, 7)) - 1, Number(tag.slice(8, 10))));
  const wt = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - wt);
  const jahrStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - jahrStart.getTime()) / 86400000 + 1) / 7);
}

/** Liegt ein Tag im Zeitraum? */
export const imZeitraum = (tag: string | undefined, zr: Zeitraum): boolean => !!tag && tag >= zr.von && tag <= zr.bis;
