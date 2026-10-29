// ─── MAKE OS — Social: Redaktionskalender (rein, Browser UND Server) — 28.10.2026, Malin-Paket ─────────────────────────────────────────
// Kevin 28.10.: „… maximal automatisieren, planen kann und alles, was man da braucht.“ Der Kalender zeigt je Tag, was wann rausgeht: geplante
// Beiträge (Termin = Tag + Uhrzeit der Folge, sonst die des Redaktionsplans — `terminVon`), ihren Zustand (gleiche Regel wie die Automatik:
// `PostSchritt` vom Server) und die freien Plätze des Plans, die der Agent als Nächstes füllt. Umplanen ist eine normale Änderung der Folge
// (`geplantAm`/`geplantUm`, Stand) — der Termin gehört nicht zum Inhalt, die Freigabe bleibt.

import { tagPlus, montagVon } from '@/lib/zeit/kalender-kern';
import { terminVon, type PlanLuecke } from './plan';
import type { SocialFolge, SocialKanal } from './typen';
import type { PostSchritt } from './veroeffentlichen';

export type KalenderAnsicht = 'woche' | 'monat';
export interface KalenderEintrag {
  art: 'folge' | 'platz';
  /** Folge-Kennung bzw. Platz (`JJJJ-MM-TTTHH:MM`). */
  id: string;
  tag: string;
  uhrzeit: string;
  titel: string;
  status?: SocialFolge['status'];
  /** Zusammengefasster Zustand für die Farbe. */
  ton: 'online' | 'automatisch' | 'wartet' | 'problem' | 'entwurf' | 'frei';
  medien?: number;
}

/** Tage des sichtbaren Zeitraums: Woche = Mo–So, Monat = volle Wochen um den Monat (Mo–So). */
export function kalenderTage(ansicht: KalenderAnsicht, bezug: string): string[] {
  if (ansicht === 'woche') { const mo = montagVon(bezug); return Array.from({ length: 7 }, (_, i) => tagPlus(mo, i)); }
  const erster = `${bezug.slice(0, 7)}-01`;
  const j = Number(bezug.slice(0, 4)), m = Number(bezug.slice(5, 7));
  const naechster = m === 12 ? `${j + 1}-01-01` : `${j}-${String(m + 1).padStart(2, '0')}-01`;
  const ende = tagPlus(montagVon(tagPlus(naechster, -1)), 6);
  const tage: string[] = [];
  for (let t = montagVon(erster); t <= ende; t = tagPlus(t, 1)) tage.push(t);
  return tage;
}

/** Ton eines Beitrags aus seinen Post-Schritten (alle Plattformen zusammen). */
export function tonVon(f: Pick<SocialFolge, 'status'>, schritte: readonly PostSchritt[] | undefined): KalenderEintrag['ton'] {
  if (f.status === 'veroeffentlicht' && (!schritte?.length || schritte.every(s => s.zustand === 'online'))) return 'online';
  const z = new Set((schritte ?? []).map(s => s.zustand));
  if (z.has('fehler') || z.has('unklar') || z.has('verpasst')) return 'problem';
  if (z.has('geplant') || z.has('faellig') || z.has('laeuft')) return 'automatisch';
  if (f.status === 'entwurf' || f.status === 'idee') return 'entwurf';
  return 'wartet';
}

/** Einträge je Tag (rein): Beiträge mit Termin im Zeitraum und freie Plätze des Plans; sortiert nach Uhrzeit. */
export function kalenderEintraege(kanal: Pick<SocialKanal, 'id' | 'plan'>, folgen: readonly SocialFolge[], plaetze: readonly PlanLuecke[], schritte: Readonly<Record<string, PostSchritt[]>>, tage: readonly string[]): Map<string, KalenderEintrag[]> {
  const raus = new Map<string, KalenderEintrag[]>(tage.map(t => [t, []]));
  for (const f of folgen) {
    if (f.kanalId !== kanal.id || f.status === 'verworfen') continue;
    const t = terminVon(f, kanal);
    if (!t || !raus.has(t.slice(0, 10))) continue;
    raus.get(t.slice(0, 10))!.push({ art: 'folge', id: f.id, tag: t.slice(0, 10), uhrzeit: t.slice(11, 16), titel: f.titel, status: f.status, ton: tonVon(f, schritte[f.id]), ...(f.medien?.length ? { medien: f.medien.length } : {}) });
  }
  for (const p of plaetze) {
    const tag = p.platz.slice(0, 10);
    if (!raus.has(tag)) continue;
    raus.get(tag)!.push({ art: 'platz', id: p.platz, tag, uhrzeit: p.platz.slice(11, 16), titel: p.saeule ? `frei · ${p.saeule}` : 'frei', ton: 'frei' });
  }
  for (const l of raus.values()) l.sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit) || (a.art === 'folge' ? -1 : 1));
  return raus;
}

/** Beiträge ohne Termin (zum Einplanen), jüngste zuerst. */
export const ohneTermin = (kanalId: string, folgen: readonly SocialFolge[]) =>
  folgen.filter(f => f.kanalId === kanalId && !f.geplantAm && f.status !== 'veroeffentlicht' && f.status !== 'verworfen').sort((a, b) => (b.geaendert ?? '').localeCompare(a.geaendert ?? ''));
