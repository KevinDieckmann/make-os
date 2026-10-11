// ─── MAKE OS — Eigene Meilensteine: Server (10.10., Kevin: „Ja, eigene Meilensteine“) ─────────────────────────────────────────────
// Die Regeln stehen rein in ./eigene-meilensteine.ts (Form, Bezug, Fortschritt) und ./eigene-ziele-sicht.ts (wer was sieht). Hier nur Laden,
// der Schreibweg (Einzeländerungen mit Stand über `listePatchen`) und das Nachziehen des Ziel-Fortschritts. EINE Lese- und EINE Schreibstelle
// für den Bestand `meilensteine-eigen--<person>` — Route: app/api/state/meilensteine-eigen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { listePatchen, type ListenOp, type Konflikt } from '@/lib/store/patch-liste';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { ladeKonten } from '@/lib/zugang/konten';
import { kontoSichtAus } from '@/lib/zugang/konto-sicht';
import { speicherFuer } from '@/lib/zoe/raum';
import type { ZieleDatei } from './typen';
import { eigeneMeilensteineFuerBetrachter, eigeneMeilensteineSicht, type EigeneZieleSicht } from './eigene-ziele-sicht';
import {
  EIGENE_MS_GRENZE, EIGENER_MS_UNGUELTIG, eigeneMeilensteineName, eigeneZieleFortschrittAnwenden, eigeneZieleNachId, eigenerZielBezugPruefen, sauberEigenerMeilenstein,
  type EigeneMeilensteineDatei, type EigenerMeilenstein,
} from './eigene-meilensteine';

/** Der eigene Ziel-Bestand einer Person — derselbe Name wie in /api/state/ziele (`fuer: 'ich'`). */
const zieleName = (person: string) => speicherFuer('ziele-eigen', person);

const liste = (d: EigeneMeilensteineDatei | null | undefined): EigenerMeilenstein[] => (Array.isArray(d?.meilensteine) ? d!.meilensteine : []);

/** Alle eigenen Meilensteine einer Person — ungefiltert, nur für ihre eigenen Wege (Schreibweg, Nachziehen). */
export async function eigeneMeilensteineRoh(person: string): Promise<EigenerMeilenstein[]> {
  return liste(await loadJson<EigeneMeilensteineDatei>(eigeneMeilensteineName(person)));
}

/**
 * Was `betrachter` von den eigenen Meilensteinen von `eigentuemer` bekommt — gefiltert über die EINE Regel (`eigeneMeilensteineSicht` +
 * `eigeneMeilensteineFuerBetrachter`). `geteilte` ohne ein einziges geteiltes Ziel = dieselbe Antwort wie `nichts` (verrät nichts).
 */
export async function eigeneMeilensteineFuer(eigentuemer: string, betrachter: string | null | undefined): Promise<{ sicht: Exclude<EigeneZieleSicht, 'nichts'>; meilensteine: EigenerMeilenstein[] } | { sicht: 'nichts' }> {
  const st = await ladeKonten();
  // Eigene: es genügt die Konto-Sicht Privat (Prüf-Fund 11.10. — der Haupt-Inhaber ohne Haushalt am Konto bekam sonst 403 für die eigenen).
  const eigenPrivat = !!betrachter && betrachter === eigentuemer && kontoSichtAus(st, betrachter).privat;
  const sicht = eigeneMeilensteineSicht(st.konten, eigentuemer, betrachter, { eigenPrivat });
  if (sicht === 'nichts') return { sicht };
  const [ms, ziele] = await Promise.all([eigeneMeilensteineRoh(eigentuemer), sicht === 'geteilte' ? loadJson<ZieleDatei>(zieleName(eigentuemer)) : Promise.resolve(null)]);
  if (sicht === 'geteilte' && ![...eigeneZieleNachId(ziele).values()].some(z => z.geteilt === true)) return { sicht: 'nichts' };
  return { sicht, meilensteine: eigeneMeilensteineFuerBetrachter(ms, ziele, sicht) };
}

/**
 * Fortschritt der eigenen Ziele aus ihren Meilensteinen nachziehen (wie `zieleNachziehen` beim gemeinsamen Bestand) — schreibt nur, wenn sich
 * etwas ändert. Liefert die Zahl der geänderten Ziele.
 */
export async function eigeneZieleNachziehen(person: string, ms?: readonly EigenerMeilenstein[]): Promise<number> {
  const l = ms ?? await eigeneMeilensteineRoh(person);
  const name = zieleName(person);
  const f = await loadJson<ZieleDatei>(name);
  if (!f || !eigeneZieleFortschrittAnwenden(f, l).geaendert) return 0;
  let n = 0;
  await updateJson<ZieleDatei>(name, cur => {
    if (!cur) return cur as unknown as ZieleDatei;
    const r = eigeneZieleFortschrittAnwenden(cur, l);
    n = r.geaendert;
    return r.datei;
  });
  return n;
}

export type EigeneMsErgebnis =
  | { ok: true; angewandt: number; meilensteine: EigenerMeilenstein[]; zieleGeaendert: number }
  | { ok: false; status: 400 | 409 | 413; fehler: string; konflikte: Konflikt[]; meilensteine: EigenerMeilenstein[] };

/**
 * Einzeländerungen auf den EIGENEN Bestand (nur die Person selbst — die Route prüft das vorher). In EINER Sperre: Grenze (413), neu gesetzte
 * Ziel-Bezüge (Ziel der Person vorhanden, nicht Business → 400), Stand je Zeile (409, nichts überschrieben). Danach zieht der Fortschritt der
 * eigenen Ziele nach (eigener Bestand der Person).
 */
export async function eigeneMeilensteinePatchen(person: string, ops: ListenOp<EigenerMeilenstein>[], wer?: Wer): Promise<EigeneMsErgebnis> {
  const name = eigeneMeilensteineName(person);
  // Die eigenen Ziele werden nur gelesen (anderer Bestand) — gebraucht nur, wenn eine Änderung einen Ziel-Bezug setzt.
  const setztZiel = ops.some(o => (o.op === 'upsert' && !!o.eintrag) || (o.op === 'teil' && o.felder && 'zielId' in o.felder));
  const ziele = setztZiel ? eigeneZieleNachId(await loadJson<ZieleDatei>(zieleName(person))) : new Map();
  const r = await listePatchen<EigenerMeilenstein, EigeneMeilensteineDatei & Record<string, unknown>>(name, 'meilensteine', ops, 6, undefined, {
    pruefen: (alt, o) => {
      const ids = new Map(alt.map(m => [m.id, m]));
      const neu = new Set(o.filter(x => x.op === 'upsert' && !ids.has(x.eintrag!.id)).map(x => x.eintrag!.id)).size;
      if (neu && alt.length + neu > EIGENE_MS_GRENZE) return `Abgelehnt: höchstens ${EIGENE_MS_GRENZE} eigene Meilensteine. Nichts gespeichert.`;
      // Nur NEU gesetzte Bezüge prüfen (ein gespeicherter Meilenstein, dessen Ziel gerade gelöscht ist, bleibt änderbar — „Rückgängig“).
      for (const x of o) {
        // Ein `teil`, der den Eintrag ungültig machte (Titel/Ziel geleert), ist eine Ablehnung (400) — kein „inzwischen geändert“.
        if (x.op === 'teil' && ids.has(x.id ?? '') && !sauberEigenerMeilenstein({ ...ids.get(x.id!)!, ...(x.felder ?? {}) })) return EIGENER_MS_UNGUELTIG;
        const vorher = ids.get(x.op === 'upsert' ? x.eintrag!.id : x.id ?? '')?.zielId;
        const ziel = x.op === 'upsert' ? x.eintrag!.zielId : x.op === 'teil' && typeof x.felder?.zielId === 'string' ? x.felder.zielId : undefined;
        if (ziel && ziel !== vorher) { const f = eigenerZielBezugPruefen(ziel, ziele); if (f) return f; }
      }
      return null;
    },
    // `teil` läuft durch dieselbe Säuberung wie ganze Einträge (Feld leeren mit null → fällt weg; ohne Ziel/Titel → abgelehnt).
    teil: (alt, felder) => sauberEigenerMeilenstein({ ...alt, ...felder }),
    ...(wer ? { wer } : {}),
  });
  if (!r.ok) {
    const aktuell = await eigeneMeilensteineRoh(person);
    const f = r.fehler ?? 'Nicht gespeichert.';
    const status = r.konflikte?.length ? 409 : f.startsWith('Abgelehnt: höchstens') ? 413 : 400;
    return { ok: false, status, fehler: f, konflikte: r.konflikte ?? [], meilensteine: aktuell };
  }
  const ms = liste(r.next as EigeneMeilensteineDatei);
  const zieleGeaendert = await eigeneZieleNachziehen(person, ms);
  return { ok: true, angewandt: r.angewandt, meilensteine: ms, zieleGeaendert };
}
