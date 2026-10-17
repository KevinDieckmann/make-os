// ─── Markttraktion · gemessene Quoten — EINE Stelle (17.10., L2 B3) ───────────────────────────────────────────────────────────────
// Vorher rechneten drei Stellen „Gespräch → SQL“ und „SQL → Gewonnen“ je anders: der Trichter über den Leads (eigene Nenner, ab 3,
// über alle Zeit), der Kreislauf der Planung über `gemesseneQuoten` (Stufe „SQL“, ab 5, über alle Zeit) und die Kennzahl Win-Rate (180
// Tage, ab 10). Jetzt:
//   · Lead → Gespräch, Gespräch → SQL, SQL → Angebot, Angebot → Gewonnen: `istQuoten` (vorher in lib/crm/planung.ts, dort weiter exportiert).
//   · SQL → Gewonnen: `sqlZuGewonnen` = die Win-Rate (`winRate`, lib/crm/pipeline.ts) — jeder Deal ist ein SQL, gewonnen ÷ entschieden.
// Trichter (lib/crm/leads.ts), Kanal-Stand und Kreislauf (lib/crm/planung.ts) und die Kennzahlen lesen nur hier. Rein, Server und Browser.

import type { Chance } from './typen';
import type { LeadZeile } from './leads';
import type { PlanQuote } from './planung-daten';
import { gemesseneQuoten, MINDESTMENGE } from './deal-auswertung';
import { winRate } from './pipeline';

const imGespraech = (z: Pick<LeadZeile, 'status' | 'deal' | 'sqlAm'>) => ['im_gespraech', 'qualifizierung', 'sql', 'kunde'].includes(z.status) || !!z.deal || !!z.sqlAm;
const istSql = (z: Pick<LeadZeile, 'status' | 'deal' | 'sqlAm'>) => z.status === 'sql' || z.status === 'kunde' || !!z.deal || !!z.sqlAm;

/**
 * Gemessene Quoten (ab `MINDESTMENGE`, sonst null): Lead → Gespräch und Gespräch → SQL aus den Leads; Angebot → Gewonnen und SQL → Gewonnen
 * aus `gemesseneQuoten` (entschiedene Deals) — SQL → Angebot ist deren Verhältnis.
 */
export function istQuoten(zeilen: readonly Pick<LeadZeile, 'status' | 'deal' | 'sqlAm'>[], deals: Chance[]): { werte: Record<PlanQuote, number | null>; n: Record<PlanQuote, number> } {
  const gespraech = zeilen.filter(imGespraech), sql = gespraech.filter(istSql);
  const gq = gemesseneQuoten(deals);
  const qSql = gq.find(x => x.stufe === 'qualifiziert'), qAng = gq.find(x => x.stufe === 'angebot');
  const sqlZuAng = qSql?.quote != null && qAng?.quote ? Math.min(100, Math.round((100 * qSql.quote) / qAng.quote)) : null;
  return {
    werte: {
      leadZuGespraech: zeilen.length >= MINDESTMENGE ? Math.round((100 * gespraech.length) / zeilen.length) : null,
      gespraechZuSql: gespraech.length >= MINDESTMENGE ? Math.round((100 * sql.length) / gespraech.length) : null,
      sqlZuAngebot: sqlZuAng,
      angebotZuGewonnen: qAng?.quote ?? null,
    },
    n: { leadZuGespraech: zeilen.length, gespraechZuSql: gespraech.length, sqlZuAngebot: qSql?.n ?? 0, angebotZuGewonnen: qAng?.n ?? 0 },
  };
}

/** SQL → Gewonnen = die Win-Rate (180 Tage, ab `WIN_RATE.mindestens` Entscheidungen) — EINE Zahl für Trichter, Kreislauf und Kennzahl. */
export function sqlZuGewonnen(deals: Chance[], heute: string): { quote: number | null; gewonnen: number; verloren: number } {
  const w = winRate(deals, heute);
  return { quote: w.quote, gewonnen: w.gewonnen, verloren: w.verloren };
}
