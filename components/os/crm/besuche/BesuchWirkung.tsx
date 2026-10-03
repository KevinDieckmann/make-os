'use client';

// ─── Events · Wirkung — welche besuchten Events lohnen sich (03.10.) ─────────
// Die EIGENEN Kennzahlen der besuchten Events (lib/crm/besuche.ts `besuchKennzahlen`, 90 Tage) und die Übersicht „Welche Events
// lohnen sich“: je Event erfasste Kontakte, Follow-up-Quote, Termine, Deals (+ Umsatz), Kosten je Kontakt — mit einem offenen
// Urteil ab 14 Tagen nach dem Event. Getrennt von den Make.One-Kennzahlen (Gäste, Zusagen, Nachfassen unserer Abende); erfasste
// Kontakte, Deals und Umsatz zählen trotzdem normal in Sales.

import { useMemo } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Raster, Zahl, LEUCHT } from '../../ui';
import { besuchKennzahlen, besuchUebersicht, URTEIL_AB_TAGE, FOLLOWUP_QUOTE_DEFINITION, type BesuchKontext, type UrteilArt } from '@/lib/crm/besuche';
import { datum, euro } from '../daten';
import { FuerChip, type BesuchProps } from './gemeinsam';

const URTEIL_FARBE: Record<UrteilArt, string> = { lohnt: LEUCHT.gut, laeuft: LEUCHT.achtung, frueh: C.inkDim, ohne: LEUCHT.kritisch };
const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: undefined } as const;

export function BesuchWirkung({ api, crm, onAkte }: Pick<BesuchProps, 'api' | 'crm'> & { onAkte: (id: string) => void }) {
  const heute = crm.heute;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const ctx: BesuchKontext = useMemo(() => ({ teilnahmen: crm.stand.teilnahmen, kontakte, chancen: crm.stand.chancen, heute }), [crm.stand.teilnahmen, kontakte, crm.stand.chancen, heute]);
  const kpis = useMemo(() => besuchKennzahlen(crm.stand.events, ctx), [crm.stand.events, ctx]);
  const { zeilen, summe } = useMemo(() => besuchUebersicht(crm.stand.events, ctx), [crm.stand.events, ctx]);

  return (
    <>
      <Karte i={1}>
        <Ueberschrift>Kennzahlen der besuchten Events · 90 Tage</Ueberschrift>
        <Raster min={130}>
          {kpis.map(k => <div key={k.id} title={k.definition ?? k.quelle}><Zahl wert={k.anzeige} label={<>{k.label}{k.definition ? <span aria-hidden> ⓘ</span> : null}</>} farbe={AMPEL[k.ampel]} />{k.id === 'besuche_followup' && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 2 }}>{k.quelle}</div>}</div>)}
        </Raster>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>
          <b style={{ color: C.inkDim }}>Follow-up-Quote:</b> {FOLLOWUP_QUOTE_DEFINITION}<br />
          Eigene Zahlen — getrennt von Make.One (Gäste, Zusagen und Nachfassen unserer Abende). Erfasste Kontakte, Deals und Umsatz zählen trotzdem normal in Sales.
        </div>
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={zeilen.length ? <span>{zeilen.length} {zeilen.length === 1 ? 'Event' : 'Events'}</span> : undefined}>Welche Events lohnen sich</Ueberschrift>
        {zeilen.length === 0 ? <Leer>Noch kein besuchtes Event hinter uns. Sobald eins stattgefunden hat und Kontakte erfasst sind, steht hier, ob es sich lohnt.</Leer> : (
          <>
            <Liste>
              {zeilen.map(({ event: e, wirkung: w, urteil }) => (
                <Zeile key={e.id} onClick={() => onAkte(e.id)} titel={e.titel}
                  unter={[datum(e.datum, heute), `${w.kontakte} ${w.kontakte === 1 ? 'Kontakt' : 'Kontakte'}`, w.followupQuote === null ? '' : `Follow-up ${Math.round(w.followupQuote * 100)} %`, w.termine ? `${w.termine} ${w.termine === 1 ? 'Termin' : 'Termine'}` : '', w.deals ? `${w.deals} ${w.deals === 1 ? 'Deal' : 'Deals'}${w.pipeline + w.umsatz ? ` (${euro(w.pipeline + w.umsatz)})` : ''}` : '', w.kostenJeKontakt !== null ? `${euro(w.kostenJeKontakt)} je Kontakt` : ''].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FuerChip e={e} firmen={crm.stand.firmen} /><Chip farbe={URTEIL_FARBE[urteil.art]}>{urteil.label}</Chip></span>} />
              ))}
            </Liste>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 10, lineHeight: 1.55 }}>
              Zusammen: {summe.kontakte} Kontakte · {summe.deals} Deals{summe.pipeline + summe.umsatz ? ` (${euro(summe.pipeline + summe.umsatz)})` : ''}{summe.kosten ? ` · ${euro(summe.kosten)} Kosten` : ''}.
              <br />So lesen wir „lohnt sich“ — erst ab {URTEIL_AB_TAGE} Tagen nach dem Event: Deals sind entstanden und Pipeline plus Umsatz decken die Kosten. „Läuft“ = Termine oder Deals, aber noch nicht gedeckt; „bisher ohne Folge“ = Kontakte, aber weder Termin noch Deal.
            </div>
          </>
        )}
      </Karte>
    </>
  );
}
