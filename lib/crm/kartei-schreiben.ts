// ─── Kartei schreiben — eine Sperre, ein Protokoll (28.09., W7) ─────────────────
// Vorher schrieben ein Dutzend Wege (Aktivität, Follow-up, Lead, Kampagnen, Netzwerk, Anfrage, Dubletten, Stammdaten,
// Umzug, Verbindungen, Import, Deal anlegen, Übergabe, Lead heben, Heads, ZOE `notiere_kontakt` …) direkt über
// `updateJson('kontakte')` — ohne Eintrag im Änderungsprotokoll (Regel 10). Jetzt gehen sie über `aendereKontakte`:
//
//  · EINE Sperre über `updateJson('kontakte')` — dieselbe wie bisher, das Verhalten der Wege bleibt gleich;
//  · der Stand VOR der Änderung wird tief kopiert, weil manche Wege die Liste an Ort und Stelle ändern
//    (`f.kontakte[i] = neu`) — sonst sähe der Vergleich keinen Unterschied;
//  · danach `listenDiff` (Kennung + Feldnamen, NIE Werte; Kontakt-Kennungen als `c#…`) → `protokolliere('kontakte')`.
//    Sonstige Felder des Bestands (neben `kontakte`) stehen als eine Zeile je Feldname.
//
// Sperr-Reihenfolge (verbindlich, lib/crm/speicher.ts): IMMER crm → kontakte. `aendereCrm`/`aendereCrmAsync` sperren
// den CRM-Bestand und darin die Kartei. Deshalb darf `mut` hier NIE `aendereCrm`, `updateJson('crm')` oder erneut
// `aendereKontakte` aufrufen (Verklemmung). Wer beides braucht: `aendereCrm` außen und die Kartei darin, oder zwei
// Schritte nacheinander. Aus einer `aendereCrm`-Änderung heraus darf `aendereKontakte` aufgerufen werden.
//
// Der Haushalt des Protokolls folgt `protokolliere`: der Haushalt der schreibenden Person, ohne Person (Takt, Skript)
// der des Inhabers — die Kartei gehört ihm (Regel 10).

import { updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { protokolliere, listenDiff, type Aenderung, type Wer } from '@/lib/store/aenderungsprotokoll';
import type { Kontakt } from '@/lib/make-one/crm';

export const KARTEI_SPEICHER = 'kontakte';

/** Der Kartei-Bestand, wie er auf der Platte liegt: die Liste `kontakte` und ggf. weitere Felder. */
export type KarteiBestand = { kontakte: Kontakt[] };

type Roh = Record<string, unknown> | null | undefined;
const liste = (b: Roh): { id: string }[] => (b && Array.isArray(b.kontakte) ? (b.kontakte as { id: string }[]).filter(k => k && typeof k.id === 'string') : []);
const gleich = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Was sich an der Kartei geändert hat — je Kontakt Kennung + Feldnamen, sonstige Felder als eine Zeile. Nie Werte. */
export function karteiDiff(vorher: Roh, nachher: Roh): Aenderung[] {
  const raus = listenDiff(liste(vorher), liste(nachher));
  const a = vorher ?? {}, n = nachher ?? {};
  for (const k of Array.from(new Set([...Object.keys(a), ...Object.keys(n)])).sort()) {
    if (k === 'kontakte' || gleich(a[k], n[k])) continue;
    raus.push({ liste: k, op: 'geaendert', id: k });
  }
  return raus;
}

/** Tiefe Kopie des Stands vor der Änderung — manche Wege ändern die Liste bzw. Kontakte an Ort und Stelle. */
const schnappschuss = (cur: unknown): Roh => (cur && typeof cur === 'object' ? structuredClone(cur) as Record<string, unknown> : null);

/**
 * Die Kartei ändern — in EINER Sperre, mit Eintrag im Änderungsprotokoll (wer, wann, welche Kennungen/Felder).
 * Gleiche Form wie `updateJson('kontakte', mut)`; `wer` fehlt → aus der laufenden Anfrage (`werAusAnfrage`).
 * `mut` darf nie `aendereCrm` bzw. die CRM-Sperre nehmen (Reihenfolge crm → kontakte, s. o.).
 */
export async function aendereKontakte<T extends KarteiBestand = KarteiBestand>(mut: (cur: T | null) => T, wer?: Wer): Promise<T> {
  let aenderungen: Aenderung[] = [];
  let vorher: Roh = null;
  const next = await updateJson<T>(KARTEI_SPEICHER, cur => {
    aenderungen = [];
    vorher = schnappschuss(cur);
    const neu = mut(cur);
    aenderungen = karteiDiff(vorher, neu as unknown as Roh);
    return neu;
  });
  await protokolliere(KARTEI_SPEICHER, aenderungen, wer);
  await ereignisseNachher(aenderungen, vorher, next);
  return next;
}

/** Ereignisse (09.10., E1): Personen-Lead wird SQL → Agenten (nur Kennungen) — nach dem Speichern, nur wenn sich ein Lead änderte, wirft nie. */
async function ereignisseNachher(aenderungen: readonly Aenderung[], vorher: Roh, nachher: unknown): Promise<void> {
  if (!aenderungen.some(a => a.op === 'neu' || a.felder?.includes('lead'))) return;
  await import('@/lib/ereignisse/quellen').then(q => q.karteiEreignisse(vorher, nachher)).catch(() => 0);
}

/** Wie `aendereKontakte`, aber die Änderung darf warten (Import, Dubletten: Sperrliste/Konflikte IN der Kartei-Sperre). */
export async function aendereKontakteAsync<T extends KarteiBestand = KarteiBestand>(mut: (cur: T | null) => Promise<T>, wer?: Wer): Promise<T> {
  let aenderungen: Aenderung[] = [];
  let vorher: Roh = null;
  const next = await updateJsonAsync<T>(KARTEI_SPEICHER, async cur => {
    aenderungen = [];
    vorher = schnappschuss(cur);
    const neu = await mut(cur);
    aenderungen = karteiDiff(vorher, neu as unknown as Roh);
    return neu;
  });
  await protokolliere(KARTEI_SPEICHER, aenderungen, wer);
  await ereignisseNachher(aenderungen, vorher, next);
  return next;
}
