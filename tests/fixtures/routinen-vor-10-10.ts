// ─── Wächter-Fixture: Routinen-Rechnung und -Säuberung VOR Routinen 2 (Stand 7c9e1335, 10.10.) — WÖRTLICH übernommen ──────────────
// Auf der Live-Instanz stehen echte Routinen in dieser Form. tests/routinen-2-rhythmus.test.ts rechnet den Altbestand mit diesem Code und mit
// dem neuen und verlangt dasselbe Ergebnis (Fälligkeit) bzw. dieselben Bytes (Säuberung). Nie anpassen — nur löschen, wenn der Altbestand
// nachweislich umgezogen ist.

import { istSpace } from '@/lib/make-one/space-regeln';
import { istRhythmus, type Rhythmus, type Routine } from '@/lib/planung/typen';
import { sauberEinheit } from '@/lib/planung/einheiten';
import { neueKennung } from '@/lib/kennung';
import { speicherSpace } from '@/lib/planung/bereich';
import { montagVon, tagePlus } from '@/lib/planung/zeitraum';
import { sauberOwner } from '@/lib/planung/routinen';

const p = (n: number) => String(n).padStart(2, '0');
const tageImMonat = (y: number, m1: number) => new Date(y, m1, 0).getDate();

export function monatePlusAlt(tag: string, n: number): string {
  const y = Number(tag.slice(0, 4)), m = Number(tag.slice(5, 7)), d = Number(tag.slice(8, 10));
  const gesamt = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(gesamt / 12), nm = (gesamt % 12) + 1;
  return `${ny}-${p(nm)}-${p(Math.min(d, tageImMonat(ny, nm)))}`;
}

export function naechstesMalNachAlt(r: Rhythmus, ab: string): string | null {
  switch (r) {
    case 'taeglich': return tagePlus(ab, 1);
    case '3x-woche': return null;
    case 'woechentlich': return tagePlus(ab, 7);
    case 'monatlich': return monatePlusAlt(ab, 1);
    case 'quartal': return monatePlusAlt(ab, 3);
    case 'halbjahr': return monatePlusAlt(ab, 6);
    case 'jaehrlich': return monatePlusAlt(ab, 12);
  }
}

export interface FaelligkeitAlt { faellig: boolean; naechstes: string; ueberfaellig: boolean; dieseWoche?: number }

export function faelligkeitAlt(r: Pick<Routine, 'rhythmus' | 'naechstesMal'>, erledigtTage: readonly string[], heute: string): FaelligkeitAlt {
  const rh: Rhythmus = r.rhythmus ?? 'taeglich';
  const heuteErledigt = erledigtTage.includes(heute);
  if (rh === 'taeglich') return { faellig: !heuteErledigt, naechstes: heuteErledigt ? tagePlus(heute, 1) : heute, ueberfaellig: false };
  if (rh === '3x-woche') {
    const mo = montagVon(heute), so = tagePlus(mo, 6);
    const dieseWoche = erledigtTage.filter(d => d >= mo && d <= so).length;
    const faellig = !heuteErledigt && dieseWoche < 3;
    return { faellig, naechstes: faellig ? heute : dieseWoche >= 3 ? tagePlus(mo, 7) : tagePlus(heute, 1), ueberfaellig: false, dieseWoche };
  }
  const letzte = erledigtTage.reduce<string | null>((m, d) => (m == null || d > m ? d : m), null);
  const anker = r.naechstesMal && /^\d{4}-\d{2}-\d{2}$/.test(r.naechstesMal) ? r.naechstesMal : undefined;
  const naechstes = letzte && (!anker || letzte >= anker) ? (naechstesMalNachAlt(rh, letzte) ?? heute) : (anker ?? heute);
  return { faellig: naechstes <= heute, naechstes, ueberfaellig: naechstes < heute };
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;

export function sauberRoutineAlt(roh: unknown): Routine | null {
  const r = (roh ?? {}) as Partial<Routine> & Record<string, unknown>;
  const label = String(r.label ?? '').trim().slice(0, 120);
  if (!label) return null;
  const rang = Number(r.rang);
  const aus: Routine = {
    id: String(r.id ?? '').slice(0, 60) || neueKennung('r'),
    label,
    wann: (['morgen', 'tag', 'abend'] as const).includes(r.wann as Routine['wann']) ? r.wann as Routine['wann'] : 'morgen',
    kategorie: (['gesundheit', 'erholung', 'leben', 'business'] as const).includes(r.kategorie as Routine['kategorie']) ? r.kategorie as Routine['kategorie'] : 'leben',
    dauerMin: Math.max(5, Math.min(120, Math.round(Number(r.dauerMin)) || 15)),
    aktiv: r.aktiv !== false,
  };
  const space = speicherSpace(istSpace(r.space) ? r.space : undefined, r.einheit);
  if (space) aus.space = space;
  if (r.owner !== undefined && r.owner !== null && r.owner !== '') aus.owner = sauberOwner(r.owner);
  if (istRhythmus(r.rhythmus) && r.rhythmus !== 'taeglich') aus.rhythmus = r.rhythmus;
  if (aus.rhythmus && aus.rhythmus !== '3x-woche' && typeof r.naechstesMal === 'string' && ISO_TAG.test(r.naechstesMal)) aus.naechstesMal = r.naechstesMal;
  if (Number.isInteger(rang) && rang > 0) aus.rang = rang;
  const einheit = aus.space === 'business' ? sauberEinheit(r.einheit) : null;
  if (einheit) aus.einheit = einheit;
  return aus;
}
