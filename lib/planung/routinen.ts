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
import { speicherSpace, wirksamerSpace } from './bereich';

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
  // Speicherform (05.10. abends): Privat + Privat-Einheit (Selbstständigkeit) → Business + Einheit, wie der alte Stand sie kennt.
  const space = speicherSpace(istSpace(r.space) ? r.space : undefined, r.einheit);
  if (space) aus.space = space;
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
  // Arbeit für eine Privat-Einheit (Selbstständigkeit) ist ein Arbeits-Block (05.10. abends: zählt WEITER als Arbeit) — gespeichert wie bisher.
  const art: SpaceId = speicherSpace(b.art === 'business' ? 'business' : 'privat', b.einheit) ?? 'privat';
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

/** Der Bereich einer Routine: fehlt `space` → privat; eine Privat-Einheit (Selbstständigkeit) → privat (05.10. abends, abgeleitet). */
export const spaceVonRoutine = (r: Pick<Routine, 'space' | 'einheit'>): SpaceId => wirksamerSpace(r) ?? 'privat';
export const ownerVonRoutine = (r: Pick<Routine, 'owner'>): string => r.owner || OWNER_BEIDE;
export const istGemeinsam = (r: Pick<Routine, 'owner'>): boolean => ownerVonRoutine(r) === OWNER_BEIDE;

/** Welche Routinen eine Person sieht und abhakt: die eigenen und die gemeinsamen. */
export function sichtbarFuer<R extends Pick<Routine, 'owner'>>(routinen: readonly R[], person: string): R[] {
  return routinen.filter(r => { const o = ownerVonRoutine(r); return o === OWNER_BEIDE || o === person; });
}

/** Titel einer verdeckten Routine der anderen Person. */
export const ROUTINE_BELEGT = 'Belegt';

/** Gehört die Routine einer ANDEREN Person (nicht „beide“, nicht der Betrachter)? */
export const istFremdeRoutine = (r: Pick<Routine, 'owner'>, betrachter: string): boolean => {
  const o = ownerVonRoutine(r);
  return o !== OWNER_BEIDE && o !== betrachter;
};

/**
 * Die verdeckte Form einer fremden Routine (08.10., Kevin: „Routinen der anderen Person nur als Belegt“). Bleibt nur, was
 * Planung und Belegung brauchen: Kennung, Besitz, Tageszeit, Dauer, aktiv/pausiert, Rhythmus + nächstes Mal (wann sie
 * belegt — wie ein „Belegt“-Termin im Kalender seine Zeit behält) und der wirksame Bereich (Privat/Business, damit der
 * Bereichsfilter des Planers stimmt). Fällt weg, was etwas verrät: Titel, Kategorie (z. B. „Gesundheit“ — Art. 9),
 * Einheit, Rang. Die Kategorie ist Pflichtfeld des Typs und steht neutral auf „leben“; `belegt: true` sagt der
 * Oberfläche, dass sie nichts davon zeigen soll.
 */
export function routineBelegt(r: Routine): Routine {
  const space = spaceVonRoutine(r);
  return {
    id: r.id, label: ROUTINE_BELEGT, wann: r.wann, kategorie: 'leben', dauerMin: r.dauerMin, aktiv: r.aktiv,
    owner: ownerVonRoutine(r),
    ...(space === 'business' ? { space } : {}),
    ...(r.rhythmus ? { rhythmus: r.rhythmus } : {}),
    ...(r.naechstesMal ? { naechstesMal: r.naechstesMal } : {}),
    belegt: true,
  };
}

/**
 * DIE Filterstelle für Antworten an eine Person (08.10.): eigene und gemeinsame Routinen voll, fremde nur als „Belegt“
 * (`routineBelegt`). `betrachter` null = Systemlauf ohne Person (Takt, ZOE-Hintergrund) → unverändert wie bisher.
 * Rein; genutzt von GET/PATCH/PUT `/api/state/routinen`. Tests: tests/routinen-belegt.test.ts.
 */
export function routinenFuerBetrachter(routinen: readonly Routine[], betrachter: string | null): Routine[] {
  if (betrachter === null) return [...routinen];
  return routinen.map(r => (istFremdeRoutine(r, betrachter) ? routineBelegt(r) : r));
}

/** Ablehnungstext für Schreiben auf fremde Routinen (Route → 403). */
export const ROUTINE_FREMD = 'Nicht erlaubt: Routinen der anderen Person ändert nur sie selbst.';

/** Form einer Listen-Änderung (wie `ListenOp` aus lib/store/patch-liste — hier ohne Server-Import). */
interface RoutinenOp { op: 'upsert' | 'delete' | 'teil'; eintrag?: Routine; id?: string; felder?: Record<string, unknown> }

/**
 * In der Sperre (PATCH): betrifft eine Änderung eine fremde Routine — gespeichert oder neu für die andere Person angelegt
 * bzw. ihr zugeschoben (`owner`)? Dann `ROUTINE_FREMD`, die ganze Änderung wird abgelehnt (08.10.). So kann auch ein Schreiben
 * mit dem verdeckten Stand („Belegt“) die echten Werte nie überschreiben.
 */
export function routinenSchreibPruefen(liste: readonly Routine[], ops: readonly RoutinenOp[], ich: string): string | null {
  const nachId = new Map(liste.map(r => [r.id, r]));
  for (const o of ops) {
    const id = o.op === 'upsert' ? o.eintrag?.id : o.id;
    const alt = id ? nachId.get(id) : undefined;
    if (alt && istFremdeRoutine(alt, ich)) return ROUTINE_FREMD;
    if (o.op === 'upsert' && o.eintrag && istFremdeRoutine(o.eintrag, ich)) return ROUTINE_FREMD;
    if (o.op === 'teil' && o.felder && 'owner' in o.felder && istFremdeRoutine({ owner: sauberOwner(o.felder.owner) }, ich)) return ROUTINE_FREMD;
  }
  return null;
}

/**
 * Vollschreiben (Altweg PUT, 08.10.): fremde Routinen bleiben IMMER in ihrer gespeicherten Fassung stehen — auch wenn der
 * Browser sie nur verdeckt kannte oder gar nicht mitschickt. Kommt eine fremde Routine unverändert verdeckt zurück, zählt das
 * nicht als Änderung; jede andere Änderung an ihr (oder eine neue/zugeschobene Routine für die andere Person) → `fremd`.
 */
export function routinenVollSchreiben(alt: readonly Routine[], neu: readonly Routine[], ich: string): { liste: Routine[] } | { fremd: true } {
  const altNachId = new Map(alt.map(r => [r.id, r]));
  const gleich = (a: Routine, b: Routine) => JSON.stringify(sauberRoutine(a)) === JSON.stringify(sauberRoutine(b));
  const aus: Routine[] = [];
  const gesehen = new Set<string>();
  for (const r of neu) {
    const vorher = altNachId.get(r.id);
    if (vorher && istFremdeRoutine(vorher, ich)) {
      if (!gleich(r, routineBelegt(vorher)) && !gleich(r, vorher)) return { fremd: true };
      aus.push(vorher);
    } else {
      if (istFremdeRoutine(r, ich)) return { fremd: true };
      aus.push(r);
    }
    gesehen.add(r.id);
  }
  for (const r of alt) if (!gesehen.has(r.id) && istFremdeRoutine(r, ich)) aus.push(r);
  return { liste: aus };
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
