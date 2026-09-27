// ─── MAKE OS — Was die KI kostet ────────────────────────────────────────────
// Baustein-Nachtrag (07.09.). Seit heute laufen Agenten im Hintergrund, nachts,
// mehrere gleichzeitig. Ohne Mitschrift wüsste Kevin nach vier Wochen nicht,
// welcher davon die Rechnung treibt — und genau das ist der Moment, in dem man
// aus Unsicherheit alles wieder abschaltet.
//
// Bewusst an EINER Stelle erfasst: in lib/anthropic.ts, durch die jeder
// Modellaufruf geht. Eine Erfassung je Route wäre 21-mal dieselbe Zeile und
// beim zweiundzwanzigsten Mal vergessen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

/**
 * Preise je Million Token, Stand 07.09.2026 (Eingabe / Ausgabe in US-Dollar).
 * Seit 25.09. mit Prompt-Cache: gelesen 0,1 ×, geschrieben 1,25 × Eingabepreis
 * (5-Minuten-Cache) — so sieht man, ob der Cache greift und was er spart.
 */
const PREIS: Record<string, { ein: number; aus: number }> = {
  'claude-opus-5-5': { ein: 4, aus: 20 },
  'claude-opus-5': { ein: 5, aus: 25 },
  'claude-sonnet-5': { ein: 2, aus: 10 },
  'claude-haiku-4-5-20251001': { ein: 1, aus: 5 },
};
/** Unbekanntes Modell: mit dem teuersten rechnen, nicht mit null. */
const STANDARD = { ein: 5, aus: 25 };

export interface Posten {
  modell: string;
  zweck: string;
  ein: number;
  aus: number;
  /** Aus dem Prompt-Cache gelesen / in ihn geschrieben (Token). */
  cl?: number; cs?: number;
  /** Geschätzte Kosten in US-Cent. */
  cent: number;
  anzahl: number;
}
interface Tag { tag: string; posten: Posten[] }
interface Stand { tage: Tag[] }

/** So viele Tage bleiben stehen — reicht für „was hat der Monat gekostet". */
const TAGE = 45;

export function kosten(modell: string, ein: number, aus: number, cacheLesen = 0, cacheSchreiben = 0): number {
  const p = PREIS[modell] ?? STANDARD;
  return ((ein / 1e6) * p.ein + (aus / 1e6) * p.aus + (cacheLesen / 1e6) * p.ein * 0.1 + (cacheSchreiben / 1e6) * p.ein * 1.25) * 100;
}

/**
 * Einen Aufruf mitschreiben. Je Tag und Zweck EINE Zeile, die mitwächst —
 * sonst hätte die Datei nach einer Woche zehntausend Einträge und niemand
 * würde je hineinsehen.
 */
export async function notiere(modell: string, zweck: string, ein: number, aus: number, cacheLesen = 0, cacheSchreiben = 0): Promise<void> {
  if (!ein && !aus && !cacheLesen && !cacheSchreiben) return;
  const heute = localDay();
  await updateJson<Stand>('ki-verbrauch', current => {
    const tage = current?.tage ?? [];
    const tag = tage.find(t => t.tag === heute) ?? { tag: heute, posten: [] };
    const rest = tage.filter(t => t.tag !== heute);
    const da = tag.posten.find(p => p.modell === modell && p.zweck === zweck);
    if (da) {
      da.ein += ein; da.aus += aus; da.anzahl += 1; da.cl = (da.cl ?? 0) + cacheLesen; da.cs = (da.cs ?? 0) + cacheSchreiben;
      da.cent = kosten(modell, da.ein, da.aus, da.cl, da.cs);
    } else {
      tag.posten.push({ modell, zweck, ein, aus, anzahl: 1, ...(cacheLesen ? { cl: cacheLesen } : {}), ...(cacheSchreiben ? { cs: cacheSchreiben } : {}), cent: kosten(modell, ein, aus, cacheLesen, cacheSchreiben) });
    }
    return { tage: [tag, ...rest].slice(0, TAGE) };
  });
}

export async function uebersicht(tage = 30): Promise<{
  tage: Tag[];
  heuteCent: number;
  summeCent: number;
  jeZweck: { zweck: string; cent: number; anzahl: number }[];
}> {
  const s = await loadJson<Stand>('ki-verbrauch');
  const liste = (s?.tage ?? []).slice(0, tage);
  const heute = localDay();
  const summe = (t: Tag) => t.posten.reduce((a, p) => a + p.cent, 0);
  const jeZweck = new Map<string, { cent: number; anzahl: number }>();
  for (const t of liste) {
    for (const p of t.posten) {
      const e = jeZweck.get(p.zweck) ?? { cent: 0, anzahl: 0 };
      e.cent += p.cent; e.anzahl += p.anzahl;
      jeZweck.set(p.zweck, e);
    }
  }
  return {
    tage: liste,
    heuteCent: liste.filter(t => t.tag === heute).reduce((a, t) => a + summe(t), 0),
    summeCent: liste.reduce((a, t) => a + summe(t), 0),
    jeZweck: Array.from(jeZweck.entries())
      .map(([zweck, e]) => ({ zweck, ...e }))
      .sort((a, b) => b.cent - a.cent),
  };
}
