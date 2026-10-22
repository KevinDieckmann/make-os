'use client';

// ─── Markttraktion · Events — Veranstaltungen, die wir BESUCHEN (03.10.) ─────
// Kevin: „Einmal wirklich Make.One und daneben das ganze Thema Events. Dann verbinden wir die beiden Sachen.“ Make.One ist das
// Netzwerk und unsere EIGENEN Abende (components/os/crm/Events.tsx); Events hier sind alle Veranstaltungen, die wir besuchen —
// fremde Events, Messen, Kunden-Events — samt „Netzwerken“ (Erfassen vor Ort).
//   Kalender        anstehende/vergangene Events (Anmeldung, Kosten, wer geht, für wen) — unsere Make.One-Abende nur lesend dazwischen
//   Event-Akte      (k=<Event>) Kopf, Ziel + Zielpersonen, erfasste Personen, Wirkung, Übergabe an Kunden
//   Wirkung         eigene Kennzahlen, „Welche Events lohnen sich“
//   Im Kundenauftrag  Auswertung je Kunde, Datenschutz-Hinweis (AVV)
// Ein Datenbestand: besuchte Events sind Events mit `marke: Netzwerken` (lib/crm/besuche-form.ts). Die Ansicht und die Akte stehen
// in der Adresse (a, k) — Zurück, Vor und alle Links zeigen dieselbe Ansicht. Die Reiterzeile kommt seit 22.10. von der Seite (`reiter`):
// EINE Zeile Kalender · Wirkung · Im Kundenauftrag · Make.One (lib/crm/adresse.ts `EVENTS_REITER`) — keine vierte Ebene.
// 04.10. (Kevin: „alles anpassbar“): Archiv & Papierkorb wie bei Make.One (components/os/crm/ablage.tsx) — EINE Ablage für Kalender
// und Akte, damit „Rückgängig“ stehen bleibt, wenn die Akte nach dem Löschen zurück in den Kalender springt.

import { useState, type ReactNode } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Leer, Knopf } from '../../ui';
import { istBesuch } from '@/lib/crm/besuche-form';
import { BESUCHE_ANSICHTEN, type BesucheAnsicht } from '@/lib/crm/adresse';
import { BesuchKalender } from './BesuchKalender';
import { BesuchAkte } from './BesuchAkte';
import { BesuchWirkung } from './BesuchWirkung';
import { BesuchKunden } from './BesuchKunden';
import { NeuesBesuch } from './NeuesBesuch';
import type { CrmApi } from '../daten';
import { useCrmAblage } from '../ablage';

export function Besuche({ api, zuKontakt, zuFirma, ansicht, k, reiter, onAkte }: {
  api: CrmApi; zuKontakt: (id: string) => void; zuFirma: (id: string) => void;
  /** Ansicht aus der Adresse (a) — Kalender ist der Start. */
  ansicht?: string; /** Event aus der Adresse (k) — öffnet die Event-Akte. */ k?: string | null;
  /** Die Reiterzeile der Events (von der Seite) — steht links neben „+ Event“, nicht in der Akte. */ reiter?: ReactNode;
  onAkte: (id: string | null, wie?: 'push' | 'replace') => void;
}) {
  const [neu, setNeu] = useState(false);
  const ablage = useCrmAblage(api, 'events');
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const aktiv: BesucheAnsicht = (BESUCHE_ANSICHTEN as string[]).includes(ansicht ?? '') ? (ansicht as BesucheAnsicht) : 'kalender';
  const akteEvent = k ? crm.stand.events.find(e => e.id === k && istBesuch(e)) : undefined;
  const props = { api, crm, zuKontakt, zuFirma };

  if (akteEvent) return <><BesuchAkte key={akteEvent.id} {...props} e={akteEvent} ablage={ablage} onZurueck={() => onAkte(null)} />{ablage.dialog}{ablage.hinweis}</>;

  return (
    <>
      <div className="bes-akte" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {reiter}
        {aktiv === 'kalender' && <Knopf haupt onClick={() => setNeu(!neu)}>{neu ? 'Abbrechen' : '+ Event'}</Knopf>}
      </div>
      {k && !akteEvent && <div role="status" style={{ fontSize: 13, color: C.inkLeise }}>Dieses Event gibt es unter „Events“ nicht (mehr).</div>}
      {aktiv === 'kalender' && neu && <NeuesBesuch api={api} crm={crm} onFertig={id => { setNeu(false); onAkte(id); }} />}
      {aktiv === 'kalender' && <BesuchKalender api={api} crm={crm} ablage={ablage} onAkte={id => onAkte(id)} />}
      {aktiv === 'wirkung' && <BesuchWirkung api={api} crm={crm} onAkte={id => onAkte(id)} />}
      {aktiv === 'kunden' && <BesuchKunden api={api} crm={crm} zuFirma={zuFirma} onAkte={id => onAkte(id)} />}
      {ablage.dialog}
      {ablage.hinweis}
    </>
  );
}
