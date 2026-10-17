// ─── Controlling auf dem Server — EINE Lesestelle (17.10., L2 R1/R2/C2) ─────────────────────────────────────────────────────────────
// Vorher las jeder Server-Leser die Controlling-Monate selbst (`loadJson('finance')`, mal mit, mal ohne Monatsabschlüsse, nie mit dem
// 0-Punkt) und rechnete über `computeMetrics` eine eigene Runway. Seitdem:
//   · Monate: `ladeControlling()` = gepflegtes Controlling + Monatsabschlüsse + 0-Punkt (`mitAbschluessen` mit `controllingNullpunkt`) —
//     dieselben Monate wie der Business-Index (`ladeRoh` → `istMonate`).
//   · Runway: NUR `runwayDesIndex()` (lib/business/fuer-chef.ts) — die Zahl des Cockpits, gerechnet in lib/finanzen/runway.ts.
// Leser: /api/state/finance, Head of Finance (`ladeFinanzbild`), Brain/ZOE, Schilde, Controlling-Analyse; Board, Loop und OKR über das Brain.

import { loadJson } from '@/lib/store/local-db';
import { geltendeLaden } from '@/lib/business/eroeffnung-server';
import { controllingNullpunkt, type Geltende } from '@/lib/business/eroeffnung';
import { mitAbschluessen, type FinanceState } from '@/lib/make-one/finance-data';

type AbschlussZeile = { firma: string; monat: string; umsatz?: number; kosten?: number };

/** Controlling-Monate MIT Monatsabschlüssen und 0-Punkt (`geltende` optional, sonst frisch geladen). `null` = kein Controlling-Stand. */
export async function ladeControlling(geltende?: Geltende): Promise<FinanceState | null> {
  const [roh, ab, g] = await Promise.all([
    loadJson<FinanceState>('finance'),
    loadJson<{ eintraege?: AbschlussZeile[] }>('business-abschluesse'),
    geltende ? Promise.resolve(geltende) : geltendeLaden(),
  ]);
  return roh && Array.isArray(roh.months) ? mitAbschluessen(roh, ab?.eintraege, controllingNullpunkt(g)) : null;
}
