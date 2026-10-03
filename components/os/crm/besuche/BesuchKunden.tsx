'use client';

// ─── Events · Für Kunden — wenn wir für Kunden unterwegs sind (03.10.) ───────
// Kevin: „Dann können auch die Events sauber vernetzt werden, auch wenn wir für Kunden unterwegs sind.“ Ein besuchtes Event
// trägt „für wen“: MAKE selbst oder ein Kunde (Firma der Kartei, Mandat optional). Die Kontakte bleiben in UNSERER Kartei und
// sind dem Kunden über das Event zugeordnet. Hier: Auswertung je Kunde. „An Kunden übergeben“ (CSV) steht in der Event-Akte.
// Datenschutz: Kontakte für Kunden gehören auch uns (eigener Verantwortlicher); die Weitergabe ist eine Übermittlung an einen Dritten — sichtbar als Hinweis.

import { useMemo } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Raster, Zahl, Chip, LEUCHT } from '../../schlank';
import { besuchJeKunde, erfassteTeilnahmen, type BesuchKontext } from '@/lib/crm/besuche';
import { UEBERGABE_HINWEIS, ROLLE_HINWEIS } from '@/lib/crm/netzwerken-recht';
import { anmeldungVon, anmeldungLabel } from '@/lib/crm/besuche-form';
import { datum, euro } from '../daten';
import { AvvHinweis, type BesuchProps } from './gemeinsam';

export function BesuchKunden({ api, crm, onAkte, zuFirma }: Pick<BesuchProps, 'api' | 'crm' | 'zuFirma'> & { onAkte: (id: string) => void }) {
  const heute = crm.heute;
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const ctx: BesuchKontext = useMemo(() => ({ teilnahmen: crm.stand.teilnahmen, kontakte, chancen: crm.stand.chancen, heute }), [crm.stand.teilnahmen, kontakte, crm.stand.chancen, heute]);
  const gruppen = useMemo(() => besuchJeKunde(crm.stand.events, ctx), [crm.stand.events, ctx]);
  const nachId = useMemo(() => new Map(crm.stand.events.map(e => [e.id, e])), [crm.stand.events]);
  const firmen = useMemo(() => new Map(crm.stand.firmen.map(f => [f.id, f])), [crm.stand.firmen]);
  const nurKunden = gruppen.filter(g => g.firmaId !== null);

  return (
    <>
      <AvvHinweis text={`${UEBERGABE_HINWEIS} ${ROLLE_HINWEIS}`} />
      {!nurKunden.length && (
        <Karte i={1}><Leer>Noch kein Event für einen Kunden. In der Event-Akte unter „Für wen“ den Kunden wählen — dann steht er hier mit Kontakten, Kosten und Deals, und die Kontakte lassen sich als CSV übergeben.</Leer></Karte>
      )}
      {gruppen.map((g, i) => {
        const firma = g.firmaId ? firmen.get(g.firmaId) : undefined;
        const name = g.firmaId === null ? 'MAKE selbst' : firma?.name ?? '(Firma gelöscht)';
        return (
          <Karte key={g.firmaId ?? 'make'} i={i + 2} akzent={g.firmaId ? LEUCHT.business : undefined}>
            <Ueberschrift rechts={g.firmaId && firma ? <button type="button" onClick={() => zuFirma(firma.id)} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44 }}>Zur Firma ›</button> : undefined}>{name}</Ueberschrift>
            <Raster min={110}>
              <Zahl wert={String(g.events)} label={g.events === 1 ? 'Event' : 'Events'} />
              <Zahl wert={String(g.kontakte)} label="Kontakte" />
              <Zahl wert={g.followupQuote === null ? '—' : `${Math.round(g.followupQuote * 100)} %`} label="Follow-up-Quote" />
              <Zahl wert={String(g.deals)} label="Deals" />
              {g.pipeline + g.umsatz > 0 && <Zahl wert={euro(g.pipeline + g.umsatz)} label="Pipeline + Umsatz" />}
              {g.kosten > 0 && <Zahl wert={euro(g.kosten)} label="Kosten" />}
            </Raster>
            <div style={{ marginTop: 8 }}>
              <Liste>
                {g.eventIds.map(id => nachId.get(id)).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => b.datum.localeCompare(a.datum)).map(e => (
                  <Zeile key={e.id} onClick={() => onAkte(e.id)} titel={e.titel}
                    unter={[datum(e.datum, heute), e.ort, `${erfassteTeilnahmen(e.id, crm.stand.teilnahmen).length} Kontakte`, (e.uebergaben ?? []).length ? `${(e.uebergaben ?? []).length}× übergeben` : ''].filter(Boolean).join(' · ')}
                    rechts={<Chip farbe={C.inkDim}>{anmeldungLabel(anmeldungVon(e))}</Chip>} />
                ))}
              </Liste>
            </div>
          </Karte>
        );
      })}
    </>
  );
}
