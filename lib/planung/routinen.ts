// ─── MAKE OS — Planung: Routinen säubern, sehen, fällig ─────────────────────
// Der Schreibweg (Route) und die Ansichten teilen sich hier eine Regel:
// fehlendes `space` = privat, fehlender Rhythmus = täglich, fehlender Owner =
// beide (Altbestand bleibt gültig). Blöcke (Wochenvorlage) genauso.
// Tests: tests/planung-routinen.test.ts.

import { istSpace } from '@/lib/make-one/space-regeln';
import { OWNER_BEIDE, istRhythmus, type Block, type Routine, type SpaceId, type Wochentag } from './typen';
import { faelligkeit, type Faelligkeit } from './rhythmus';
import { sauberEinheit } from './einheiten';
import { neueKennung } from '@/lib/kennung';

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

export function sauberOwner(roh: unknown): string {
  const s = String(roh ?? '').trim();
  return s === OWNER_BEIDE || PERSON.test(s) ? s : OWNER_BEIDE;
}

/** Eine Routine, geprüft — additiv: alte Einträge bleiben gültig. */
export function sauberRoutine(roh: unknown): Routine | null {
  const r = (roh ?? {}) as Partial<Routine> & Record<string, unknown>;
  const label = String(r.label ?? '').trim().slice(0, 120);
  if (!label) return null;
  const rang = Number(r.rang);
  const aus: Routine = {
    id: String(r.id ?? '').slice(0, 60) || neueKennung('r'),
    label,
    wann: (['morgen', 'tag', 'abend'] as const).includes(r.wann as Routine['wann']) ? r.wann as Routine['wann'] : 'morgen',
    kategorie: (['gesundheit', 'leben', 'business'] as const).includes(r.kategorie as Routine['kategorie']) ? r.kategorie as Routine['kategorie'] : 'leben',
    dauerMin: Math.max(5, Math.min(120, Math.round(Number(r.dauerMin)) || 15)),
    aktiv: r.aktiv !== false,
  };
  if (istSpace(r.space)) aus.space = r.space;
  if (r.owner !== undefined && r.owner !== null && r.owner !== '') aus.owner = sauberOwner(r.owner);
  if (istRhythmus(r.rhythmus) && r.rhythmus !== 'taeglich') aus.rhythmus = r.rhythmus;
  if (aus.rhythmus && aus.rhythmus !== '3x-woche' && typeof r.naechstesMal === 'string' && ISO_TAG.test(r.naechstesMal)) aus.naechstesMal = r.naechstesMal;
  if (Number.isInteger(rang) && rang > 0) aus.rang = rang;
  // Einheit (27.09.): nur im Business, Namen aus der einen Quelle — Privat verwirft sie.
  const einheit = aus.space === 'business' ? sauberEinheit(r.einheit) : null;
  if (einheit) aus.einheit = einheit;
  return aus;
}

export function sauberBlock(roh: unknown): Block | null {
  const b = (roh ?? {}) as Partial<Block> & Record<string, unknown>;
  const owner = String(b.owner ?? '').trim();
  if (!PERSON.test(owner)) return null;
  const wt = Number(b.wochentag);
  if (!Number.isInteger(wt) || wt < 1 || wt > 7) return null;
  const von = String(b.von ?? ''), bis = String(b.bis ?? '');
  if (!UHR.test(von) || !UHR.test(bis) || bis <= von) return null;
  const rang = Number(b.rang);
  const titel = String(b.titel ?? '').trim().slice(0, 60);
  const art: SpaceId = b.art === 'business' ? 'business' : 'privat';
  // Einheit (28.09.): wie bei Routinen nur im Business, Namen aus der einen Quelle — Privat verwirft sie.
  const einheit = art === 'business' ? sauberEinheit(b.einheit) : null;
  return {
    id: String(b.id ?? '').slice(0, 60) || neueKennung('bl'),
    owner, wochentag: wt as Wochentag, von, bis,
    art,
    ...(titel ? { titel } : {}),
    ...(Number.isInteger(rang) && rang > 0 ? { rang } : {}),
    ...(einheit ? { einheit } : {}),
  };
}

export const spaceVonRoutine = (r: Pick<Routine, 'space'>): SpaceId => r.space ?? 'privat';
export const ownerVonRoutine = (r: Pick<Routine, 'owner'>): string => r.owner || OWNER_BEIDE;
export const istGemeinsam = (r: Pick<Routine, 'owner'>): boolean => ownerVonRoutine(r) === OWNER_BEIDE;

/** Welche Routinen eine Person sieht und abhakt: die eigenen und die gemeinsamen. */
export function sichtbarFuer<R extends Pick<Routine, 'owner'>>(routinen: readonly R[], person: string): R[] {
  return routinen.filter(r => { const o = ownerVonRoutine(r); return o === OWNER_BEIDE || o === person; });
}

/** Die Tage, an denen eine Routine im Log dieser Person abgehakt ist. */
export function erledigtTage(log: Record<string, string[]> | null | undefined, id: string): string[] {
  return Object.entries(log ?? {}).filter(([, ids]) => Array.isArray(ids) && ids.includes(id)).map(([tag]) => tag).sort();
}

export interface FaelligeRoutine { routine: Routine; f: Faelligkeit; heuteErledigt: boolean }

/**
 * Was heute für eine Person dran ist: aktiv, sichtbar (eigen oder gemeinsam),
 * im gewünschten Space, nach Rhythmus fällig — heute schon Abgehaktes bleibt
 * in der Liste (als erledigt), damit der Haken nicht verschwindet.
 */
export function heuteFaellig(routinen: readonly Routine[], person: string, log: Record<string, string[]> | null | undefined, heute: string, space: SpaceId | 'alle' = 'alle'): FaelligeRoutine[] {
  return sichtbarFuer(routinen.filter(r => r.aktiv && (space === 'alle' || spaceVonRoutine(r) === space)), person)
    .map(routine => {
      const tage = erledigtTage(log, routine.id);
      const heuteErledigt = tage.includes(heute);
      return { routine, f: faelligkeit(routine, tage, heute), heuteErledigt };
    })
    .filter(x => x.f.faellig || x.heuteErledigt);
}

/** Blöcke einer Person, nach Wochentag, Beginn und Rang. */
export function bloeckeFuer(bloecke: readonly Block[] | undefined, person: string, wochentag?: Wochentag): Block[] {
  return (bloecke ?? [])
    .filter(b => b.owner === person && (wochentag == null || b.wochentag === wochentag))
    .sort((a, b) => a.wochentag - b.wochentag || (a.rang ?? 999) - (b.rang ?? 999) || a.von.localeCompare(b.von));
}

/** Schnellstart: Mo–Fr ein Business-Block — der Rest der Woche ist privat. */
export function standardBloecke(person: string, von = '09:00', bis = '18:00'): Block[] {
  return ([1, 2, 3, 4, 5] as Wochentag[]).map(wt => ({ id: `bl-${person}-${wt}-std`, owner: person, wochentag: wt, von, bis, art: 'business' as const, titel: 'Arbeit', rang: 1 }));
}
