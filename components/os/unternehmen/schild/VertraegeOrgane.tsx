'use client';

// ─── Unternehmen › Verträge & Organe: alle Business-Gesellschaften auf einen Blick (10.10.) ───────────────────────────
// Nur lesen — gepflegt wird wie bisher in der Gesellschaft (Reiter „Verträge“ bzw. „Organe & Beschlüsse“, eine Quelle). Laufende Verträge
// mit „kündigen bis“ (stehen im Kalender), amtierende Organe und die Zahl der Beschlüsse.

import { FileSignature } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Leer } from '../../ui';
import { WEG } from '@/lib/wege';
import { aktiveEintraege, organLabel, vertragArtLabel, vertragStatusLabel } from '@/lib/gesellschaften/modell';
import { bezugName, type GAnzeige, type RegisterDaten } from '../teile';
import { datum, klein } from './teile';

export function VertraegeOrgane({ daten, liste, heute }: { daten: RegisterDaten; liste: GAnzeige[]; heute: string }) {
  if (!liste.length) return <Karte><Leer symbol={<FileSignature size={16} />}>Keine Business-Gesellschaft im Register.</Leer></Karte>;
  return (
    <>
      {liste.map(g => {
        const vertraege = aktiveEintraege(g.vertraege).filter(v => v.status !== 'beendet').sort((a, b) => (a.kuendigenBis ?? a.ende ?? '9999').localeCompare(b.kuendigenBis ?? b.ende ?? '9999'));
        const organe = aktiveEintraege(g.organe).filter(o => !o.bis || o.bis > heute);
        const beschluesse = aktiveEintraege(g.beschluesse).filter(b => b.status !== 'aufgehoben');
        return (
          <Karte key={g.id}>
            <Ueberschrift rechts={<Knopf leise href={WEG.unternehmen(g.id, 'vertraege')}>Öffnen</Knopf>}>{g.name}</Ueberschrift>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
              <section aria-label="Verträge" style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                <strong style={{ fontSize: TYP.bedien }}>Laufende Verträge · {vertraege.length}</strong>
                {!vertraege.length ? <span style={klein}>Keine laufenden Verträge.</span> : (
                  <Liste>{vertraege.slice(0, 8).map(v => (
                    <Zeile key={v.id} umbrechen titel={v.titel} unter={[vertragArtLabel(v.art), vertragStatusLabel(v.status), v.kuendigenBis ? `kündigen bis ${datum(v.kuendigenBis)}` : v.ende ? `endet ${datum(v.ende)}` : undefined].filter(Boolean).join(' · ')}
                      rechts={v.kuendigenBis && v.kuendigenBis >= heute ? <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{datum(v.kuendigenBis)}</span> : undefined} />
                  ))}</Liste>
                )}
              </section>
              <section aria-label="Organe" style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                <strong style={{ fontSize: TYP.bedien }}>Organe · {organe.length} <span style={{ color: C.inkDim, fontWeight: 400 }}>· {beschluesse.length} Beschlüsse</span></strong>
                {!organe.length ? <span style={klein}>Keine Organe eingetragen.</span> : (
                  <Liste>{organe.map(o => <Zeile key={o.id} titel={bezugName(o.wer, daten.namen)} unter={[organLabel(o.funktion), o.seit ? `seit ${datum(o.seit)}` : undefined].filter(Boolean).join(' · ')} />)}</Liste>
                )}
                <div><Knopf leise href={WEG.unternehmen(g.id, 'organe')}>Organe & Beschlüsse</Knopf></div>
              </section>
            </div>
          </Karte>
        );
      })}
    </>
  );
}
