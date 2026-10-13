'use client';

// ─── Fulfillment — die Seite (Rahmen, C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10; Design-Überarbeitung 11.10.) ─────────────────────
// Produkte & Mandate › „Fulfillment“: eigene Seite `/os/mandate/fulfillment` mit demselben Kopf (Segmente Mandate · Produkte · Fulfillment) und der
// Unternavigation Prozesse · Bausteine · Onboarding · Analysen · Kreislauf · Visualisierung. Mit `?m=<Mandat>` öffnet sich der Fall mit seinen Reitern
// (Überblick · Ablauf · Wert-Konto · Menschen & Entscheidungen · Takt · Kunde & Reports · Analyse · Abschluss & Kreislauf). Adressen nur über WEG (lib/fulfillment/adresse.ts);
// Reiterwechsel sind Verlaufsschritte (Zurück führt zurück). Der Rahmen rechnet nichts — die Inhalte liefern die Pakete C1/C2/C3.
// 11.10. (Rückmeldung: „keiner versteht, was da los ist“): Antwort zuerst — über JEDEM Reiter eines Falls steht der Kopf „Wo steht der Kunde?“
// (FallKopf: Phasen-Strahl, Als Nächstes, Hängt etwas?), auf der Startseite die Lage in drei Antworten (LageStreifen). Am Handy stehen die Segmente
// unter dem Titel (sonst bricht der Titel Buchstabe für Buchstabe), die Reiter wischen seitwärts (`.ui-reiter-zeile`).
// 12.10. (kundenreif): neben „‹ Fulfillment“ der Knopf „Dem Kunden zeigen“ — die Kunden-Seite im Vollbild (reise/Praesentation.tsx).

import { useRouter, useSearchParams } from 'next/navigation';
import { Seite, Segmente, Reiter, Knopf, Hinweis, useHandy } from '../ui';
import { WEG } from '@/lib/wege';
import { mandateLink } from '@/lib/crm/adresse';
import { FULFILLMENT_BEREICHE, FALL_REITER, fulfillmentAusAdresse, type FulfillmentBereich, type FallReiter } from '@/lib/fulfillment/adresse';
import { useCrm } from '../crm/daten';
import { Prozesse, Bausteine, Onboarding, Kreislauf, Visualisierung, FallUeberblick, FallAblauf, FallWert, FallMenschen, FallTakt, FallKreislauf } from './prozesse';
import { FallKunde } from './kunde';
import { Analysen, FallAnalyse } from './analyse';
import { FallKopf } from './reise/FallKopf';
import { LageStreifen } from './reise/LageStreifen';
import { DemKundenZeigen } from './reise/Praesentation';

type Segment = 'mandate' | 'produkte' | 'fulfillment';
const SEGMENTE: { id: Segment; label: string }[] = [{ id: 'mandate', label: 'Mandate' }, { id: 'produkte', label: 'Produkte' }, { id: 'fulfillment', label: 'Fulfillment' }];

export function FulfillmentSeite() {
  const router = useRouter();
  const adresse = fulfillmentAusAdresse(useSearchParams());
  const api = useCrm();
  const handy = useHandy();
  const zu = (s: Segment) => router.push(s === 'fulfillment' ? WEG.fulfillment() : mandateLink(s), { scroll: false });
  const kopf = <Segmente liste={SEGMENTE} aktiv="fulfillment" onWahl={zu} />;

  if (adresse.m) {
    const m = adresse.m;
    const mandat = api.crm?.stand.mandate.find(x => x.id === m);
    return (
      <Seite titel={mandat ? mandat.titel : 'Fall'} unter={mandat ? `Fulfillment · ${mandat.kunde}` : 'Fulfillment · Fall'} rechts={handy ? undefined : kopf}>
        {handy && kopf}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <Knopf leise onClick={() => router.push(WEG.fulfillment())}>‹ Fulfillment</Knopf>
          {mandat && <DemKundenZeigen mandatId={m} leise />}
        </div>
        {api.crm && !mandat && <Hinweis art="achtung">Dieses Mandat gibt es nicht (mehr).</Hinweis>}
        <FallKopf mandatId={m} reiter={adresse.r} />
        <div className="ui-reiter-zeile">
          <Reiter<FallReiter> liste={FALL_REITER.map(r => ({ id: r.id, label: r.label }))} aktiv={adresse.r} onWahl={r => router.push(WEG.fall(m, r), { scroll: false })} ariaLabel="Reiter des Falls" />
        </div>
        <FallInhalt reiter={adresse.r} mandatId={m} />
      </Seite>
    );
  }

  return (
    <Seite titel="Fulfillment" unter="Wie wir liefern — jeder Kunde als Reise durch unsere Phasen." rechts={handy ? undefined : kopf}>
      {handy && kopf}
      {adresse.u !== 'visualisierung' && !adresse.k && !adresse.b && <LageStreifen />}
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
    case 'visualisierung': return <Visualisierung />;
    default: return <Prozesse k={k} />;
  }
}

function FallInhalt({ reiter, mandatId }: { reiter: FallReiter; mandatId: string }) {
  switch (reiter) {
    case 'ablauf': return <FallAblauf mandatId={mandatId} />;
    case 'wert': return <FallWert mandatId={mandatId} />;
    case 'menschen': return <FallMenschen mandatId={mandatId} />;
    case 'takt': return <FallTakt mandatId={mandatId} />;
    case 'kunde': return <FallKunde mandatId={mandatId} />;
    case 'analyse': return <FallAnalyse mandatId={mandatId} />;
    case 'kreislauf': return <FallKreislauf mandatId={mandatId} />;
    default: return <FallUeberblick mandatId={mandatId} />;
  }
}
