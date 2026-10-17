'use client';

// ─── Fulfillment — die Seite (Rahmen, C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10; Design 11.10.; seit 17.10. nach dem Miro-Standard) ────────────────
// Produkte & Mandate › „Fulfillment“: eigene Seite `/os/mandate/fulfillment` mit demselben Kopf (Segmente Mandate · Produkte · Fulfillment).
// Rückmeldung 17.10.: „Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar … es dupliziert sich.“ Seitdem:
//   · Start: die Lage als EINE schlanke Zeile, dann fünf Unter-Reiter Landkarte (mit den Kunden in Lieferung) · Onboarding · Bausteine · Analysen · Kreislauf.
//   · Ein Fall (`?m=<Mandat>`): ein knapper Kopf (zurück, Ampel mit einem Satz, „Dem Kunden zeigen“) und VIER Reiter — Reise (die Kundenjourney-Zeile, der
//     Fluss je Phase, Analyse und Abschluss an ihrer Phase) · Ziele & Wirkung · Menschen & Termine · Kunde.
// Frühere Adressen (`r=ueberblick|ablauf|wert|takt|analyse|kreislauf`, `u=visualisierung`) werden durch die neue ersetzt (lib/fulfillment/adresse.ts,
// `neueAdresse`) — kein toter Link, kein zusätzlicher Verlaufsschritt. Reiterwechsel sind Verlaufsschritte (Zurück führt zurück). Der Rahmen rechnet nichts.
// Am Handy stehen die Segmente unter dem Titel, die Reiter wischen seitwärts (`.ui-reiter-zeile`).

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Seite, Segmente, Reiter, Hinweis, useHandy } from '../ui';
import { WEG } from '@/lib/wege';
import { mandateLink } from '@/lib/crm/adresse';
import { FULFILLMENT_BEREICHE, FALL_REITER, fulfillmentAusAdresse, neueAdresse, type FulfillmentBereich, type FallReiter } from '@/lib/fulfillment/adresse';
import { useCrm } from '../crm/daten';
import { Prozesse, Bausteine, Onboarding, Kreislauf, FallZiele, FallMenschen } from './prozesse';
import { FallKunde } from './kunde';
import { Analysen } from './analyse';
import { FallKopf } from './reise/FallKopf';
import { FallReise } from './reise/FallReise';
import { LageStreifen } from './reise/LageStreifen';

type Segment = 'mandate' | 'produkte' | 'fulfillment';
const SEGMENTE: { id: Segment; label: string }[] = [{ id: 'mandate', label: 'Mandate' }, { id: 'produkte', label: 'Produkte' }, { id: 'fulfillment', label: 'Fulfillment' }];

export function FulfillmentSeite() {
  const router = useRouter();
  const adresse = fulfillmentAusAdresse(useSearchParams());
  const api = useCrm();
  const handy = useHandy();
  const zu = (s: Segment) => router.push(s === 'fulfillment' ? WEG.fulfillment() : mandateLink(s), { scroll: false });
  const kopf = <Segmente liste={SEGMENTE} aktiv="fulfillment" onWahl={zu} />;
  // Frühere Adresse → die neue (ersetzt, ohne Verlaufsschritt; ein Sprung `#…` bleibt).
  const ersatz = neueAdresse(adresse, typeof window !== 'undefined' ? window.location.hash : '');
  useEffect(() => { if (ersatz) router.replace(ersatz, { scroll: false }); }, [ersatz, router]);

  if (adresse.m) {
    const m = adresse.m;
    const mandat = api.crm?.stand.mandate.find(x => x.id === m);
    return (
      <Seite titel={mandat ? mandat.titel : 'Fall'} unter={mandat ? `Fulfillment · ${mandat.kunde}` : 'Fulfillment · Fall'} rechts={handy ? undefined : kopf}>
        {handy && kopf}
        <FallKopf mandatId={m} mitKunde={!!mandat} />
        {api.crm && !mandat && <Hinweis art="achtung">Dieses Mandat gibt es nicht (mehr).</Hinweis>}
        <div className="ui-reiter-zeile">
          <Reiter<FallReiter> liste={FALL_REITER.map(r => ({ id: r.id, label: r.label }))} aktiv={adresse.r} onWahl={r => router.push(WEG.fall(m, r), { scroll: false })} ariaLabel="Reiter des Falls" />
        </div>
        <FallInhalt reiter={adresse.r} mandatId={m} anker={adresse.anker} />
      </Seite>
    );
  }

  return (
    <Seite titel="Fulfillment" unter="Wie wir liefern — jeder Kunde als Reise durch unsere Phasen." rechts={handy ? undefined : kopf}>
      {handy && kopf}
      {!adresse.k && !adresse.b && <LageStreifen />}
      <div className="ui-reiter-zeile">
        <Reiter<FulfillmentBereich> liste={FULFILLMENT_BEREICHE.map(b => ({ id: b.id, label: b.label }))} aktiv={adresse.u} onWahl={u => router.push(WEG.fulfillment(u), { scroll: false })} ariaLabel="Bereiche von Fulfillment" />
      </div>
      <BereichInhalt u={adresse.u} k={adresse.k} b={adresse.b} />
    </Seite>
  );
}

function BereichInhalt({ u, k, b }: { u: FulfillmentBereich; k?: string; b?: string }) {
  switch (u) {
    case 'bausteine': return <Bausteine b={b} />;
    case 'onboarding': return <Onboarding />;
    case 'analysen': return <Analysen />;
    case 'kreislauf': return <Kreislauf />;
    default: return <Prozesse k={k} />;
  }
}

function FallInhalt({ reiter, mandatId, anker }: { reiter: FallReiter; mandatId: string; anker?: string }) {
  switch (reiter) {
    case 'ziele': return <FallZiele mandatId={mandatId} />;
    case 'menschen': return <FallMenschen mandatId={mandatId} />;
    case 'kunde': return <FallKunde mandatId={mandatId} />;
    default: return <FallReise mandatId={mandatId} {...(anker ? { anker } : {})} />;
  }
}
