'use client';

// ─── Markttraktion · Events — Veranstaltungen, die wir BESUCHEN (03.10.) ─────
// Kevin: „Einmal wirklich Make.One und daneben das ganze Thema Events. Dann verbinden wir die beiden Sachen.“ Make.One ist das
// Netzwerk und unsere EIGENEN Abende (components/os/crm/Events.tsx); Events hier sind alle Veranstaltungen, die wir besuchen —
// fremde Events, Messen, Kunden-Events — samt „Netzwerken“ (Erfassen vor Ort).
//   Kalender        anstehende/vergangene Events (Anmeldung, Kosten, wer geht, für wen) — unsere Make.One-Abende nur lesend dazwischen
//   Event-Akte      (k=<Event>) Kopf, Ziel + Zielpersonen, erfasste Personen, Wirkung, Übergabe an Kunden
//   Wirkung         eigene Kennzahlen, „Welche Events lohnen sich“
//   Für Kunden      Auswertung je Kunde, Datenschutz-Hinweis (AVV)
// Ein Datenbestand: besuchte Events sind Events mit `marke: Netzwerken` (lib/crm/besuche-form.ts). Die Pillen und die Akte stehen
// in der Adresse (a, k) — Zurück, Vor und alle Links zeigen dieselbe Ansicht.

import { useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Leer, Knopf } from '../../ui';
import { istBesuch } from '@/lib/crm/besuche-form';
import type { BesucheAnsicht } from '@/lib/crm/adresse';
import { WELT_FARBE } from '../Ueberblick';
import { Pillen } from '../teile';
import { BesuchKalender } from './BesuchKalender';
import { BesuchAkte } from './BesuchAkte';
import { BesuchWirkung } from './BesuchWirkung';
import { BesuchKunden } from './BesuchKunden';
import { NeuesBesuch } from './NeuesBesuch';
import type { CrmApi } from '../daten';

const ANSICHTEN: { id: BesucheAnsicht; label: string }[] = [{ id: 'kalender', label: 'Kalender' }, { id: 'wirkung', label: 'Wirkung' }, { id: 'kunden', label: 'Für Kunden' }];

export function Besuche({ api, zuKontakt, zuFirma, ansicht, k, onAnsicht, onAkte }: {
  api: CrmApi; zuKontakt: (id: string) => void; zuFirma: (id: string) => void;
  /** Ansicht aus der Adresse (a) — Kalender ist der Start. */
  ansicht?: string; /** Event aus der Adresse (k) — öffnet die Event-Akte. */ k?: string | null;
  onAnsicht: (a: BesucheAnsicht) => void; onAkte: (id: string | null, wie?: 'push' | 'replace') => void;
}) {
  const [neu, setNeu] = useState(false);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const aktiv: BesucheAnsicht = ANSICHTEN.some(a => a.id === ansicht) ? (ansicht as BesucheAnsicht) : 'kalender';
  const akteEvent = k ? crm.stand.events.find(e => e.id === k && istBesuch(e)) : undefined;
  const props = { api, crm, zuKontakt, zuFirma };

  if (akteEvent) return <BesuchAkte key={akteEvent.id} {...props} e={akteEvent} onZurueck={() => onAkte(null)} />;

  return (
    <>
      <div className="bes-akte" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ overflowX: 'auto', scrollbarWidth: 'none', flex: '1 1 auto' }}>
          <Pillen einzeilig farbe={WELT_FARBE.event} liste={ANSICHTEN} aktiv={aktiv} onWahl={onAnsicht} />
        </div>
        {aktiv === 'kalender' && <Knopf haupt onClick={() => setNeu(!neu)}>{neu ? 'Abbrechen' : '+ Event'}</Knopf>}
      </div>
      {k && !akteEvent && <div role="status" style={{ fontSize: 13, color: C.inkLeise }}>Dieses Event gibt es unter „Events“ nicht (mehr).</div>}
      {aktiv === 'kalender' && neu && <NeuesBesuch api={api} crm={crm} onFertig={id => { setNeu(false); onAkte(id); }} />}
      {aktiv === 'kalender' && <BesuchKalender crm={crm} onAkte={id => onAkte(id)} />}
      {aktiv === 'wirkung' && <BesuchWirkung api={api} crm={crm} onAkte={id => onAkte(id)} />}
      {aktiv === 'kunden' && <BesuchKunden api={api} crm={crm} zuFirma={zuFirma} onAkte={id => onAkte(id)} />}
    </>
  );
}
