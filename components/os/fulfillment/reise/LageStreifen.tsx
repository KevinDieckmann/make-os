'use client';

// ─── Fulfillment — die Lage in drei Antworten (11.10., Design-Überarbeitung) ────────────────────────────────────────────────────────────
// Oben auf der Fulfillment-Seite, bevor die Unternavigation kommt: Wie viele Kunden sind in Lieferung? Was hängt? Was ist als Nächstes dran?
// Liest das Mandats-Cockpit (GET /api/fulfillment/cockpit, nur lesen); Reihenfolge „braucht Aufmerksamkeit“ aus lib/fulfillment/prozesse/darstellung.ts.

import { useRouter } from 'next/navigation';
import { Ueberschrift, Karte, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { nachAufmerksamkeit, kundenAmpel } from '@/lib/fulfillment/prozesse/darstellung';
import { useCockpit } from '../prozesse/daten';
import { Antworten, AntwortKachel, AMPEL_FARBE } from './bilder';

export function LageStreifen() {
  const router = useRouter();
  const { daten } = useCockpit();
  if (!daten) return null;
  const zeilen = nachAufmerksamkeit(daten.zeilen);
  const onboarding = zeilen.filter(z => z.status === 'onboarding').length;
  const rot = daten.haengt.filter(h => h.schwere === 'rot');
  const erster = zeilen[0];
  const zuerst = daten.haengt[0];
  return (
    <Karte i={0} flach>
      <Ueberschrift erklaerung="fulfillment.lage">Lage</Ueberschrift>
      <Antworten>
        <AntwortKachel frage="Kunden in Lieferung" ampel={zeilen.length ? AMPEL_FARBE[zeilen.some(z => kundenAmpel(z) === 'rot') ? 'rot' : zeilen.some(z => kundenAmpel(z) === 'gelb') ? 'gelb' : 'gruen'] : undefined}
          antwort={zeilen.length ? `${zeilen.length} Kunde${zeilen.length === 1 ? '' : 'n'}` : 'Noch keiner'}
          unter={zeilen.length ? `${onboarding ? `${onboarding} im Onboarding · ` : ''}${zeilen.length - onboarding} in der Umsetzung` : 'Ein Fall startet mit dem Onboarding eines Mandats.'}
          onClick={() => router.push(zeilen.length ? WEG.fulfillment('visualisierung') : WEG.fulfillment('onboarding'))} />
        <AntwortKachel frage="Was hängt?" ampel={rot.length ? LEUCHT.kritisch : daten.haengt.length ? LEUCHT.achtung : LEUCHT.gut}
          antwort={daten.haengt.length ? `${daten.haengt.length} Punkt${daten.haengt.length === 1 ? '' : 'e'}${rot.length ? ` · ${rot.length} dringend` : ''}` : 'Nichts'}
          unter={zuerst ? `${zuerst.kunde}: ${zuerst.text}` : 'Alle Fälle sind im Takt.'}
          onClick={zuerst ? () => router.push(zuerst.href) : undefined} />
        <AntwortKachel frage="Als Nächstes" ampel={erster ? AMPEL_FARBE[kundenAmpel(erster)] : undefined}
          antwort={erster ? erster.kunde : '—'}
          unter={erster ? (erster.schritt ? `${erster.phase ? `${erster.phase}: ` : ''}${erster.schritt}` : erster.phase ?? 'Fall öffnen') : 'Kein laufender Fall.'}
          onClick={erster ? () => router.push(WEG.fall(erster.mandatId)) : undefined} />
      </Antworten>
    </Karte>
  );
}
