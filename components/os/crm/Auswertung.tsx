'use client';

// ─── Markttraktion › Auswertung (22.10., eigener Punkt im Hub unter „Steuerung“) ──────────────────────────────────────────────────────────
// Kevin 22.10.: „Auswertung als eigener Punkt — an die Markttraktion-Kennzahlen anlegen, dann haben wir auch einen geilen Flow.“
//   1. Der Weg zum Kunden: Kontakte → Leads → MQL · SQL → Deals → Angebote → Gewonnen als EINE Zeile mit dem Lichtfaden (ReiseBild, Markenzeichen:
//      der Flow). Zahlen NUR aus den vorhandenen Rechnungen (lib/crm/auswertung-flow.ts nennt je Zahl ihre Stelle); ohne Daten grau, nie eine
//      erfundene Null. Antippen führt in die Liste dahinter (die Leads-Liste mit genau der gezählten Pille).
//   2. Der Traktions-Index mit dem Wochen-Scoreboard (vorher im Überblick).
//   3. Kanal-Leistung (mit Temperatur), Kunden kurz, die Pipeline-Auswertung (Prognose, Win/Loss, Verweildauer) — vorher Deals › Auswertung.
// Die alte Adresse `?s=deals&a=auswertung` (WEG.kunden, Kennzahlen, Widgets) zeigt dieselbe Ansicht.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, LEUCHT } from '../ui';
import { ReiseBild } from '../ui/reise/ReiseBild';
import { auswertungFlow, auswertungSpalten, flowZiel, flowLink, type FlowWelt } from '@/lib/crm/auswertung-flow';
import type { CrmApi } from './daten';
import { useLeads, leadsFilterSetzen } from './Leads';
import { TraktionsIndex, useTraktion, WELT_FARBE } from './Ueberblick';
import { KanalLeistungLaden } from './Qualifizierung';
import { KundenKurz } from './Kunden';
import { DealAuswertung } from './DealAkte';
import { nachOben } from '../Verlauf';

/** Farbe je Welt im Flow: die Kartei leise, Marketing und Sales in ihrer Weltfarbe, gewonnen grün. */
const FLOW_FARBE: Record<FlowWelt, string> = { grundlage: C.inkDim, marketing: WELT_FARBE.marketing, sales: WELT_FARBE.sales, kunde: LEUCHT.gut };

export function Auswertung({ api, zuBereich, zuDeal }: { api: CrmApi; zuBereich: (b: string, a?: string, k?: string) => void; zuDeal: (id: string) => void }) {
  const router = useRouter();
  const traktion = useTraktion();
  const { d: leads } = useLeads(api);
  const stufen = useMemo(() => auswertungFlow({
    kontakte: traktion.d?.bestand.kontakte ?? null,
    zeilen: leads?.leads ?? null,
    trichter: leads?.trichter ?? null,
    crm: api.crm?.stand ?? null,
  }), [traktion.d, leads, api.crm]);
  const spalten = useMemo(() => auswertungSpalten(stufen, w => FLOW_FARBE[w]), [stufen]);
  /** Ein Tipp auf eine Stufe bzw. eine Zahl: die Liste dahinter; die Leads-Liste öffnet mit der Pille, nach der gezählt wurde. */
  const geh = (stufeId: string, kaestchenId?: string) => {
    const z = flowZiel(stufen, stufeId, kaestchenId);
    if (!z) return;
    if (z.filter) leadsFilterSetzen(z.filter, 'alle');
    router.push(flowLink(z), { scroll: false });
    nachOben();
  };
  return (
    <>
      <Karte i={0}>
        <Ueberschrift farbe={WELT_FARBE.sales}>Der Weg zum Kunden</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '-4px 0 10px' }}>Vom Kontakt bis zum gewonnenen Deal — eine Stufe antippen, um die Liste dahinter zu öffnen.</div>
        <ReiseBild spalten={spalten} band={false} wort="Stufe" mehrWort="Angaben" label="Der Weg vom Kontakt zum gewonnenen Deal"
          onPhase={id => geh(id)} onKaestchen={(id, k) => geh(id, k)} />
      </Karte>
      {traktion.d
        ? <TraktionsIndex api={api} d={traktion.d} laden={traktion.laden} zuBereich={zuBereich} i0={1} />
        : <Karte i={1}>{traktion.fehler ? <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim }}>Traktions-Index nicht geladen: {traktion.fehler}</div> : <Leer>Lädt …</Leer>}</Karte>}
      <KanalLeistungLaden i={3} mitTemperatur />
      <KundenKurz api={api} />
      <DealAuswertung api={api} zuAkte={id => (id ? zuDeal(id) : zuBereich('deals'))} />
    </>
  );
}
