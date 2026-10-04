// ─── MAKE OS — Kapazität: Schreibweg (rein, getestet) ───────────────────────
// Säubern des Bestands `kapazitaet--<haushalt>` und Änderungen als Ops — mit der Rechte-Regel:
//   Die Kapazität einer Person (Grundwert, Ausnahmen, Zuweisungen) ändert die Person selbst oder der Inhaber.
//   Team-Personen ohne Konto pflegt nur der Inhaber. Alles andere → 403. Grenzen → 413, Unsinn → 400 (nie still gekürzt).

import { neueKennung } from '@/lib/kennung';
import {
  PERSON_ID_OK, TAG_OK, MAX_STUNDEN_WOCHE, MAX_AUSNAHMEN, MAX_ZUWEISUNGEN, istBezugKennung, LEERE_KAPA,
  type KapaDatei, type Ausnahme, type Zuweisung, type PersonEinstellung,
} from './typen';

const ID_OK = /^[A-Za-z0-9_-]{1,40}$/;
const stunden = (v: unknown): number | null => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n >= 0 && n <= MAX_STUNDEN_WOCHE ? Math.round(n * 10) / 10 : null;
};
const tag = (v: unknown): string | undefined => (typeof v === 'string' && TAG_OK.test(v) ? v : undefined);

export function sauberAusnahme(roh: unknown): Ausnahme | null {
  const a = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const art = a.art === 'urlaub' || a.art === 'block' ? a.art : null;
  const von = tag(a.von);
  if (!art || !von) return null;
  const bis = tag(a.bis);
  if (bis && bis < von) return null;
  if (art === 'urlaub' && !bis) return null;
  const sw = stunden(a.stundenWoche);
  if (art === 'block' && !(sw && sw > 0)) return null;
  const titel = typeof a.titel === 'string' ? a.titel.trim().slice(0, 80) : '';
  return { id: typeof a.id === 'string' && ID_OK.test(a.id) ? a.id : neueKennung('ka'), art, von, ...(bis ? { bis } : {}), ...(art === 'block' ? { stundenWoche: sw as number } : {}), ...(titel ? { titel } : {}) };
}

export function sauberZuweisung(roh: unknown): Zuweisung | null {
  const z = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const art = z.art === 'mandat' || z.art === 'kunde' ? z.art : null;
  const sw = stunden(z.stundenWoche);
  if (!art || typeof z.person !== 'string' || !PERSON_ID_OK.test(z.person) || !istBezugKennung(z.bezugId) || !(sw && sw > 0)) return null;
  const von = tag(z.von), bis = tag(z.bis);
  if (von && bis && bis < von) return null;
  return { id: typeof z.id === 'string' && ID_OK.test(z.id) ? z.id : neueKennung('kz'), person: z.person, art, bezugId: z.bezugId, stundenWoche: sw, ...(von ? { von } : {}), ...(bis ? { bis } : {}) };
}

/** Den Bestand beim Lesen säubern — Unlesbares fällt weg, Fehlendes ist leer. */
export function sauberKapaDatei(roh: unknown): KapaDatei {
  const d = (roh && typeof roh === 'object' ? roh : {}) as Partial<KapaDatei>;
  const personen: Record<string, PersonEinstellung> = {};
  for (const [id, e] of Object.entries(d.personen && typeof d.personen === 'object' ? d.personen : {})) {
    if (!PERSON_ID_OK.test(id) || !e || typeof e !== 'object') continue;
    const sw = stunden((e as PersonEinstellung).stundenWoche);
    const aus = (Array.isArray((e as PersonEinstellung).ausnahmen) ? (e as PersonEinstellung).ausnahmen! : []).map(sauberAusnahme).filter((a): a is Ausnahme => !!a).slice(0, MAX_AUSNAHMEN);
    if (sw == null && !aus.length) continue;
    personen[id] = { ...(sw != null ? { stundenWoche: sw } : {}), ...(aus.length ? { ausnahmen: aus } : {}) };
  }
  const zuweisungen = (Array.isArray(d.zuweisungen) ? d.zuweisungen : []).map(sauberZuweisung).filter((z): z is Zuweisung => !!z).slice(0, MAX_ZUWEISUNGEN);
  return { personen, zuweisungen };
}

/** Wer ändert: die eigene Kapa-Kennung (`konto-<speicher>`) und ob Inhaber. */
export interface Aenderer { ich: string; inhaber: boolean }
export type KapaOp =
  | { op: 'grundwert'; person: string; stundenWoche: number | null }
  | { op: 'ausnahme'; person: string; ausnahme: unknown }
  | { op: 'ausnahme-weg'; person: string; id: string }
  | { op: 'zuweisung'; zuweisung: unknown }
  | { op: 'zuweisung-weg'; id: string };

export type Ergebnis = { ok: true; datei: KapaDatei } | { ok: false; status: 400 | 403 | 404 | 413; fehler: string };

/** Darf `wer` die Kapazität von `person` ändern? Selbst oder Inhaber — und nur Personen, die es im Team gibt. */
export const darfAendern = (wer: Aenderer, person: string): boolean => wer.inhaber || wer.ich === person;

/**
 * Ops der Reihe nach anwenden — alles oder nichts. `personen` = die Kennungen im Team des Haushalts (unbekannte → 404).
 */
export function kapaAendern(alt: KapaDatei | null | undefined, ops: unknown, wer: Aenderer, personen: ReadonlySet<string>): Ergebnis {
  if (!Array.isArray(ops) || !ops.length) return { ok: false, status: 400, fehler: 'Keine Änderung.' };
  if (ops.length > 50) return { ok: false, status: 413, fehler: 'Höchstens 50 Änderungen auf einmal.' };
  const d: KapaDatei = structuredClone(sauberKapaDatei(alt ?? LEERE_KAPA));
  for (const roh of ops as Record<string, unknown>[]) {
    const op = roh?.op;
    const person = typeof roh?.person === 'string' ? roh.person : '';
    if (op === 'grundwert' || op === 'ausnahme' || op === 'ausnahme-weg') {
      if (!PERSON_ID_OK.test(person) || !personen.has(person)) return { ok: false, status: 404, fehler: 'Diese Person gibt es im Team nicht.' };
      if (!darfAendern(wer, person)) return { ok: false, status: 403, fehler: 'Die Kapazität einer anderen Person ändert nur sie selbst oder der Inhaber.' };
      const e: PersonEinstellung = { ...(d.personen[person] ?? {}) };
      if (op === 'grundwert') {
        if (roh.stundenWoche === null) delete e.stundenWoche;
        else { const sw = stunden(roh.stundenWoche); if (sw == null) return { ok: false, status: 400, fehler: `Grundwert: 0–${MAX_STUNDEN_WOCHE} Stunden je Woche.` }; e.stundenWoche = sw; }
      } else if (op === 'ausnahme') {
        const a = sauberAusnahme(roh.ausnahme);
        if (!a) return { ok: false, status: 400, fehler: 'Ausnahme: Urlaub braucht von–bis, ein Block Stunden je Woche.' };
        const liste = (e.ausnahmen ?? []).filter(x => x.id !== a.id);
        if (liste.length >= MAX_AUSNAHMEN) return { ok: false, status: 413, fehler: `Höchstens ${MAX_AUSNAHMEN} Ausnahmen je Person.` };
        e.ausnahmen = [...liste, a].sort((x, y) => x.von.localeCompare(y.von));
      } else {
        const id = String(roh.id ?? '');
        if (!(e.ausnahmen ?? []).some(x => x.id === id)) return { ok: false, status: 404, fehler: 'Diese Ausnahme gibt es nicht.' };
        e.ausnahmen = (e.ausnahmen ?? []).filter(x => x.id !== id);
      }
      if (e.stundenWoche == null && !e.ausnahmen?.length) delete d.personen[person];
      else d.personen[person] = { ...(e.stundenWoche != null ? { stundenWoche: e.stundenWoche } : {}), ...(e.ausnahmen?.length ? { ausnahmen: e.ausnahmen } : {}) };
    } else if (op === 'zuweisung') {
      const z = sauberZuweisung(roh.zuweisung);
      if (!z) return { ok: false, status: 400, fehler: 'Zuweisung: Person, Mandat/Kunde und Stunden je Woche (> 0) nötig.' };
      if (!personen.has(z.person)) return { ok: false, status: 404, fehler: 'Diese Person gibt es im Team nicht.' };
      const vorher = d.zuweisungen.find(x => x.id === z.id);
      if (!darfAendern(wer, z.person) || (vorher && !darfAendern(wer, vorher.person))) return { ok: false, status: 403, fehler: 'Zuweisungen einer anderen Person ändert nur sie selbst oder der Inhaber.' };
      const liste = d.zuweisungen.filter(x => x.id !== z.id);
      if (liste.length >= MAX_ZUWEISUNGEN) return { ok: false, status: 413, fehler: `Höchstens ${MAX_ZUWEISUNGEN} Zuweisungen.` };
      d.zuweisungen = [...liste, z];
    } else if (op === 'zuweisung-weg') {
      const vorher = d.zuweisungen.find(x => x.id === roh.id);
      if (!vorher) return { ok: false, status: 404, fehler: 'Diese Zuweisung gibt es nicht.' };
      if (!darfAendern(wer, vorher.person)) return { ok: false, status: 403, fehler: 'Zuweisungen einer anderen Person ändert nur sie selbst oder der Inhaber.' };
      d.zuweisungen = d.zuweisungen.filter(x => x.id !== vorher.id);
    } else {
      return { ok: false, status: 400, fehler: 'Unbekannte Änderung.' };
    }
  }
  return { ok: true, datei: d };
}
