// ─── MAKE OS — Social: Wann wirkt es? Beste Zeiten aus den EIGENEN Zahlen (rein) — 28.10.2026, Malin-Paket ────────────────────────────────
// Der Redaktionsplan startet mit einer Annahme (Vorgabe 18:00). Sobald genug eigene Beiträge mit Zahlen da sind, zeigt diese Rechnung, welcher
// Wochentag und welche Stunde bei DIESEM Kanal am meisten Aufrufe bringen — nie aus fremden Studien, nie geschätzt. Maß: Median der Aufrufe
// (jüngste Messung je Beitrag und Plattform zusammen) je Wochentag bzw. Stunde des Veröffentlichungs-Termins. Zu wenig Daten → keine Aussage.

import { wochentag } from '@/lib/zeit/kalender-kern';
import { terminVon } from './plan';
import type { SocialFolge, SocialKanal } from './typen';

export const ZEIT_MIN_BEITRAEGE = 8;
export const ZEIT_MIN_JE_FELD = 2;
const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export interface ZeitFeld { schluessel: string; name: string; median: number; beitraege: number }
export interface BesteZeiten { genug: boolean; beitraege: number; tage: ZeitFeld[]; stunden: ZeitFeld[]; satz: string; empfehlung?: { tag?: number; stunde?: number } }

const median = (l: number[]) => { const s = [...l].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

/** Aufrufe eines Beitrags: je Plattform die jüngste Messung, zusammengezählt. */
export function aufrufeVon(f: Pick<SocialFolge, 'messungen'>): number | null {
  const je = new Map<string, { am: string; views: number }>();
  for (const m of f.messungen) { const a = je.get(m.plattform); if (!a || m.am > a.am) je.set(m.plattform, { am: m.am, views: m.views }); }
  return je.size ? [...je.values()].reduce((s, x) => s + x.views, 0) : null;
}

export function besteZeiten(k: Pick<SocialKanal, 'id' | 'plan'>, folgen: readonly SocialFolge[]): BesteZeiten {
  const daten: { tag: number; stunde: number; views: number }[] = [];
  for (const f of folgen) {
    if (f.kanalId !== k.id || !f.veroeffentlicht.length) continue;
    const t = terminVon(f, k);
    const v = aufrufeVon(f);
    if (!t || v === null) continue;
    daten.push({ tag: wochentag(t.slice(0, 10)), stunde: Number(t.slice(11, 13)), views: v });
  }
  const gruppe = (key: (d: typeof daten[number]) => number, name: (n: number) => string): ZeitFeld[] => {
    const je = new Map<number, number[]>();
    for (const d of daten) (je.get(key(d)) ?? je.set(key(d), []).get(key(d))!).push(d.views);
    return [...je].filter(([, l]) => l.length >= ZEIT_MIN_JE_FELD).map(([n, l]) => ({ schluessel: String(n), name: name(n), median: median(l), beitraege: l.length })).sort((a, b) => b.median - a.median);
  };
  const tage = gruppe(d => d.tag, n => WT[n - 1]);
  const stunden = gruppe(d => d.stunde, n => `${String(n).padStart(2, '0')}:00`);
  if (daten.length < ZEIT_MIN_BEITRAEGE || (!tage.length && !stunden.length)) {
    return { genug: false, beitraege: daten.length, tage, stunden, satz: `Noch zu wenig eigene Zahlen (${daten.length} von ${ZEIT_MIN_BEITRAEGE} Beiträgen mit Aufrufen) — bis dahin gilt eure Startannahme.` };
  }
  const tb = tage[0], sb = stunden[0];
  const teile = [tb && `${tb.name} (Median ${tb.median.toLocaleString('de-DE')} Aufrufe, ${tb.beitraege} Beiträge)`, sb && `${sb.name} Uhr (Median ${sb.median.toLocaleString('de-DE')}, ${sb.beitraege} Beiträge)`].filter(Boolean);
  return {
    genug: true, beitraege: daten.length, tage, stunden,
    satz: `Bei euch wirkt bisher am besten: ${teile.join(' · ')}. Eine Tendenz aus ${daten.length} Beiträgen, keine Gewissheit.`,
    empfehlung: { ...(tb ? { tag: Number(tb.schluessel) } : {}), ...(sb ? { stunde: Number(sb.schluessel) } : {}) },
  };
}
