'use client';

// ─── Unternehmen › Überblick „in einem Blick“ (11.10.) ───────────────────────────────────────────────────────────────────────────────
// Kevin 11.10.: „So ist es sehr unübersichtlich und keiner versteht, was da los ist.“ Antwort zuerst: oben ein Satz und das Schild gesamt, darunter je
// Gesellschaft EINE Karte — Schild-Zeichen (Ton), vier Dimensionen als Balken, „Das Wichtigste jetzt“ (höchstens drei Handgriffe), die übrigen nur
// gezählt. Alles Weitere einen Klick tiefer: mit gewählter Gesellschaft (`?w=`) dieselbe Karte groß, dazu Firmen-Akte (Ring), „Bereit für Kanzlei und
// Steuerbüro“, Jahres-Zeitstrahl, Risiko-Matrix, Lebenslauf und Verlauf. Gerechnet in lib/gesellschaften/schild/blick.ts — hier nur gezeichnet.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Leerzustand, Raster, Klappbar } from '../../ui';
import { WEG } from '@/lib/wege';
import { lageBlick, TON_SATZ, type Blick } from '@/lib/gesellschaften/schild/blick';
import type { Lage } from '@/lib/gesellschaften/schild/ampel';
import type { VerlaufPunkt } from '@/lib/gesellschaften/schild/verlauf';
import type { RegisterDaten } from '../teile';
import type { SchildDaten } from '../schild/daten';
import { SchildZeichen, TonChip, DimBalken, HandgriffZeile, TonLegende, WasSeheIch, beschriftung, klein } from './teile';
import { JahresstrahlKarte } from './Jahresstrahl';
import { RisikoMatrixKarte } from './RisikoMatrix';
import { DokumenteRing } from './DokumenteRing';
import { KanzleiBereitKarte } from './KanzleiBereit';
import { LebenslaufKarte } from './Lebenslauf';
import { VerlaufStreifen, useVerlauf } from './Verlauf';

/** Die Karte einer Gesellschaft — klein (im Überblick aller) oder groß (gewählt: alle Punkte aufklappbar, Verlauf). */
export function GesellschaftKarte({ b, gross, verlauf, heute }: { b: Blick; gross?: boolean; verlauf?: VerlaufPunkt[] | null; heute: string }) {
  const [alle, setAlle] = useState(false);
  const rest = b.handgriffe.length - b.wichtigste.length;
  const ruhig = b.handgriffe.filter(h => h.ton === 'ruhig' && !b.wichtigste.includes(h)).length;
  return (
    <Karte>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <SchildZeichen ton={b.ton} groesse={gross ? 60 : 48} titel={`${b.name}: ${TON_SATZ[b.ton]}`} />
        <div style={{ display: 'grid', gap: 4, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: gross ? TYP.titel : TYP.body, overflowWrap: 'anywhere' }}>{b.name}</strong>
            <TonChip ton={b.ton} />
          </div>
          <span style={klein}>{b.satz}</span>
        </div>
      </div>
      <div style={{ display: 'grid', marginTop: 8 }}>
        {b.dimensionen.map(d => <DimBalken key={d.id} d={d} href={WEG.schild(d.reiter, b.id)} />)}
      </div>
      <div style={{ ...beschriftung, marginTop: 10 }}>Das Wichtigste jetzt</div>
      {b.wichtigste.length ? <div style={{ display: 'grid' }}>{b.wichtigste.map(h => <HandgriffZeile key={h.id} h={h} />)}</div> : <span style={{ ...klein, display: 'block', padding: '8px 0' }}>Nichts zu tun — alles im Lot.</span>}
      {rest > 0 && (gross
        ? <Klappbar id={`blick-alle-${b.id}`} titel="Alle offenen Punkte" zaehler={rest} offen={alle} umschalten={() => setAlle(x => !x)}>
            <div style={{ display: 'grid' }}>{b.handgriffe.filter(h => !b.wichtigste.includes(h)).map(h => <HandgriffZeile key={h.id} h={h} />)}</div>
          </Klappbar>
        : <span style={{ ...klein, display: 'block', marginTop: 4 }}>Dazu {rest} weitere Punkt{rest === 1 ? '' : 'e'}{ruhig ? `, davon ${ruhig === rest ? 'alle' : ruhig} ohne Eile` : ''}.</span>)}
      {gross && verlauf !== undefined && <div style={{ marginTop: 12 }}><div style={{ ...beschriftung, marginBottom: 6 }}>Verlauf</div><VerlaufStreifen tage={verlauf} id={b.id} jetzt={b.ton} heute={heute} /></div>}
      {!gross && <div style={{ marginTop: 10 }}><Knopf leise href={WEG.schild('ueberblick', b.id)}>Alles zu {b.name} ›</Knopf></div>}
    </Karte>
  );
}

export function BlickUeberblick({ lage, schild, daten, gewaehlt, heute }: { lage: Lage; schild: SchildDaten; daten: RegisterDaten; gewaehlt?: string; heute: string }) {
  const lb = useMemo(() => lageBlick(lage, schild.eintraege), [lage, schild.eintraege]);
  const verlauf = useVerlauf();
  if (!lage.gesellschaften.length) {
    return <Karte><Leerzustand symbol={<ShieldCheck size={22} />} titel="Noch keine Business-Gesellschaft" aktion={<Knopf leise href={WEG.schild('gesellschaften')}>Zu den Gesellschaften</Knopf>}>Das Schild führt die Gesellschaften im Bereich Business — legt eine an oder setzt ihren Steckbrief.</Leerzustand></Karte>;
  }
  const b = gewaehlt ? lb.je.find(x => x.id === gewaehlt) : undefined;
  if (b) {
    const gl = lage.gesellschaften.find(x => x.id === b.id)!;
    const reg = daten.gesellschaften.find(x => x.id === b.id);
    const eintrag = schild.eintraege.find(x => x.id === b.id);
    return (
      <>
        <GesellschaftKarte b={b} gross verlauf={verlauf} heute={heute} />
        <Raster min={340}>
          <DokumenteRing lage={gl} />
          <KanzleiBereitKarte lage={gl} reg={reg} heute={heute} />
        </Raster>
        <JahresstrahlKarte lage={{ heute: lage.heute, gesellschaften: [gl] }} nur={gl.id} titel={`Pflichten im Jahr — ${gl.name}`} kompakt />
        <RisikoMatrixKarte je={[{ gesellschaftId: gl.id, gesellschaft: gl.name, risiken: gl.risiken }]} />
        {reg && <LebenslaufKarte g={reg} schild={eintrag} namen={daten.namen} heute={heute} max={8} />}
      </>
    );
  }
  return (
    <>
      <Karte>
        <Ueberschrift erklaerung="unternehmen.blick.schild">Das Schild in einem Blick</Ueberschrift>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <SchildZeichen ton={lb.ton} groesse={64} titel={`Alle Gesellschaften: ${TON_SATZ[lb.ton]}`} />
          <div style={{ display: 'grid', gap: 6, flex: 1, minWidth: 220 }}>
            <span style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.45 }}>{lb.satz}</span>
            <span style={klein}>{TON_SATZ[lb.ton]}</span>
          </div>
        </div>
        <div style={{ marginTop: 12 }}><VerlaufStreifen tage={verlauf} jetzt={lb.ton} heute={heute} /></div>
        <div style={{ marginTop: 10 }}><TonLegende /></div>
        <WasSeheIch>Das Schild-Zeichen zeigt je Gesellschaft, wie es steht: rot nur, wenn eine Folge droht (Frist verstrichen, Schutz abgelaufen), gelb bei bald Fälligem, grau bei Lücken ohne Eile. Je Karte stehen höchstens drei Handgriffe — der Rest ist gezählt, einen Klick tiefer.</WasSeheIch>
      </Karte>
      <Raster min={320}>
        {lb.je.map(x => <GesellschaftKarte key={x.id} b={x} heute={heute} />)}
      </Raster>
      <JahresstrahlKarte lage={lage} kompakt titel="Jahresplan der Pflichten" />
      <div style={{ ...klein }}>Kanzlei und Steuerbüro: unter „<Link href={WEG.schild('ueberblick', lb.je[0].id)} style={{ color: C.ink }}>Alles zu …</Link>“ steht je Gesellschaft, was für den Abschluss schon vorliegt.</div>
    </>
  );
}
