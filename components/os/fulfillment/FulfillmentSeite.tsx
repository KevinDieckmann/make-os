'use client';

// ─── Fulfillment — die Seite (Rahmen, C0, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 10; Design 11.10.; seit 17.10. nach dem Miro-Standard) ────────────────
// Produkte & Mandate › „Fulfillment“: eigene Seite `/os/mandate/fulfillment`. Seit 22.10. abends ist Produkte & Mandate ein Werkzeug
// (lib/make-one/werkzeuge.ts `PRODUKTE_WERKZEUG`): die Bereiche Übersicht · Onboarding · Bausteine · Analysen · Kreislauf stehen im Menü der linken Leiste (am
// Handy oben im Blatt „Menü“) — die frühere Segment-Zeile Mandate · Produkte · Fulfillment und die Unter-Reiter der Seite sind weg (keine doppelte Navigation).
// Rückmeldung 17.10.: „Es soll nicht überladen sein, sondern sehr klar. Lieber wenig und klar … es dupliziert sich.“ Seitdem:
//   · Start: die Lage als EINE schlanke Zeile, dann der Bereich (Übersicht mit den Kunden in Lieferung · Onboarding · Bausteine · Analysen · Kreislauf).
//   · Ein Fall (`?m=<Mandat>`): ein knapper Kopf (zurück, Ampel mit einem Satz, „Dem Kunden zeigen“) und VIER Reiter — Reise (die Kundenjourney-Zeile, der
//     Fluss je Phase, Analyse und Abschluss an ihrer Phase) · Ziele & Wirkung · Menschen & Termine · Kunde.
// Frühere Adressen (`r=ueberblick|ablauf|wert|takt|analyse|kreislauf`, `u=visualisierung`) werden durch die neue ersetzt (lib/fulfillment/adresse.ts,
// `neueAdresse`) — kein toter Link, kein zusätzlicher Verlaufsschritt. Reiterwechsel sind Verlaufsschritte (Zurück führt zurück). Der Rahmen rechnet nichts.
// Am Handy wischen die Reiter des Falls seitwärts (`.ui-reiter-zeile`).

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Seite, Reiter, Hinweis } from '../ui';
import { WEG } from '@/lib/wege';
import { FALL_REITER, fulfillmentAusAdresse, neueAdresse, type FulfillmentBereich, type FallReiter } from '@/lib/fulfillment/adresse';
import { useCrm } from '../crm/daten';
import { Prozesse, Bausteine, Onboarding, Kreislauf, FallZiele, FallMenschen } from './prozesse';
import { FallKunde } from './kunde';
import { Analysen } from './analyse';
import { FallKopf } from './reise/FallKopf';
import { FallReise } from './reise/FallReise';
import { LageStreifen } from './reise/LageStreifen';
import { ProzessEditor } from './editor/ProzessEditor';

/** Ein Satz je Bereich unter dem Titel (der Bereich selbst steht im Menü der Leiste). */
const UNTER: Record<FulfillmentBereich, string> = {
  prozesse: 'Wie wir liefern — jeder Kunde als Reise durch unsere Phasen.',
  onboarding: 'Onboarding — unterschriebene Mandate ins Fulfillment holen.',
  bausteine: 'Bausteine — woraus die Abläufe bestehen.',
  analysen: 'Analysen — was wir beim Kunden messen und berichten.',
  kreislauf: 'Kreislauf — nach der Leistung: Wirkung, Folgeangebot, Empfehlung.',
};

export function FulfillmentSeite() {
  const router = useRouter();
  const adresse = fulfillmentAusAdresse(useSearchParams());
  const api = useCrm();
  // Frühere Adresse → die neue (ersetzt, ohne Verlaufsschritt; ein Sprung `#…` bleibt).
  const ersatz = neueAdresse(adresse, typeof window !== 'undefined' ? window.location.hash : '');
  useEffect(() => { if (ersatz) router.replace(ersatz, { scroll: false }); }, [ersatz, router]);

  if (adresse.m) {
    const m = adresse.m;
    const mandat = api.crm?.stand.mandate.find(x => x.id === m);
    return (
      <Seite titel={mandat ? mandat.titel : 'Fall'} unter={mandat ? `Fulfillment · ${mandat.kunde}` : 'Fulfillment · Fall'}>
        <FallKopf mandatId={m} mitKunde={!!mandat} />
        {api.crm && !mandat && <Hinweis art="achtung">Dieses Mandat gibt es nicht (mehr).</Hinweis>}
        <div className="ui-reiter-zeile">
          <Reiter<FallReiter> liste={FALL_REITER.map(r => ({ id: r.id, label: r.label }))} aktiv={adresse.r} onWahl={r => router.push(WEG.fall(m, r), { scroll: false })} ariaLabel="Reiter des Falls" />
        </div>
        <FallInhalt reiter={adresse.r} mandatId={m} anker={adresse.anker} />
      </Seite>
    );
  }

  // Prozess-Editor (17.10.): ein Ablauf zum Bearbeiten — eigene Ansicht (zurück führt zur Landkarte), ohne Lage-Zeile und Unter-Reiter.
  if (adresse.e) {
    return (
      <Seite titel="Ablauf bearbeiten" unter="Phasen, Schritte, Nachrichten, Entscheidungen und Erinnerungen — per Ziehen oder Tastatur.">
        <ProzessEditor vorlageId={adresse.e} />
      </Seite>
    );
  }

  return (
    <Seite titel="Fulfillment" unter={UNTER[adresse.u]}>
      {/* Auf der Übersicht sagen die Karten dasselbe („Kunden in Lieferung“, „Heute im Fulfillment · n zu tun“) — die Lage-Zeile nur auf den anderen
          Reitern (17.10., Gesamtprüfung L4 B2: „nur einfach dupliziert sich“). */}
      {!adresse.k && !adresse.b && adresse.u !== 'prozesse' && <LageStreifen />}
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
