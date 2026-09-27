'use client';

// ─── Markttraktion · Sales › Start — die Fläche des Vertriebs (27.09.) ──────
// Kevin: „Mach bitte das Widget-Thema bei Sales, Marketing und Events noch mit
// rein.“ Die Start-Ansicht des Sales-Reiters (Pille „Head of Sales“) ist eine
// Fläche: Head of Sales, Wochen-Scoreboard, Sales-Trichter und Kanal-Leistung
// als feste Karten — je Person anordnen, Breite, ausblenden, Katalog-Widgets
// dazu. Standardanordnung und Ids: lib/crm/flaechen.ts (KACHELN.sales). Die
// Pillen Power Hour · Kampagnen · Auswertung bleiben feste Ansichten.
// Daten: nur bestehende Wege (api aus useCrm, /api/crm/traktion im Scoreboard,
// /api/crm/lead in Trichter und Kanal-Leistung) — nichts wird doppelt gelesen.

import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { FLAECHE, kachel, standardVon } from '@/lib/crm/flaechen';
import type { CrmApi } from './daten';
import { HeadPanel } from './HeadPanel';
import { Scoreboard } from './Scoreboard';
import { SalesTrichter } from './Leads';
import { KanalLeistungLaden } from './Qualifizierung';

const K = (id: string) => kachel('sales', id);

export function SalesStart({ api, zuKontakt, zuBereich }: { api: CrmApi; zuKontakt: (id: string) => void; zuBereich: (s: string, a?: string) => void }) {
  return (
    <Flaeche seite={FLAECHE.sales} standard={standardVon('sales')}>
      <Kachel {...K('head')}><HeadPanel head="sales" standardModus="deal_review" zuKontakt={zuKontakt} i={0} nachEntscheid={() => void api.laden()} /></Kachel>
      <Kachel {...K('scoreboard')}><Scoreboard api={api} /></Kachel>
      <Kachel {...K('trichter')}><SalesTrichter api={api} zuBereich={zuBereich} karte i={2} /></Kachel>
      <Kachel {...K('kanal')}><KanalLeistungLaden i={3} /></Kachel>
    </Flaeche>
  );
}
