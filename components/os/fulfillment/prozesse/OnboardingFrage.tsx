'use client';

// ─── „Kundenonboarding jetzt starten?“ nach einem neuen Mandat (21.10., Rundgang 19.10. B6) ───────────────────────────────────────────────────────
// Die Produkt-Karte verspricht: „Ein neuer Kunde dieses Produkts bekommt den Ablauf … als Fall.“ Nach „Mandat aus diesem Produkt anlegen“ (bzw. jedem neuen
// Mandat mit einem Produkt, dem ein Ablauf zugeordnet ist) fragt die Oberfläche deshalb einmal — „Onboarding starten“ öffnet den VORHANDENEN Start-Dialog
// (`StartDialog`, Ablauf vorgewählt), „Später“ schließt; der Kandidat bleibt unter Fulfillment › Onboarding. Nichts geschieht automatisch, kein zweiter Weg.
// Ohne Ablauf, ohne Fulfillment-Zugang, bei Privat-Mandaten oder wenn der Fall schon läuft: keine Frage.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf } from '../../ui';
import { Fenster } from '../../Fenster';
import { istBusinessMandat } from '@/lib/fulfillment/regeln';
import type { Mandat } from '@/lib/crm/typen';
import { useUebersichtKurz, startMandat } from './daten';
import { StartDialog } from './Onboarding';

export function OnboardingFrage({ m, produktName, onZu }: { m: Pick<Mandat, 'id' | 'kunde' | 'leistungId' | 'gesellschaft'> & Partial<Pick<Mandat, 'start'>>; produktName?: string; onZu: () => void }) {
  const kurz = useUebersichtKurz(istBusinessMandat(m.gesellschaft));
  const [start, setStart] = useState(false);
  const d = kurz.daten;
  // EINE Vorbelegung (24.10., `startMandat` → `startVorbelegung`): der Prozess des Produkts, sonst sein Paket (kein Zusatzmodul).
  const sm = d ? startMandat(d, { mandatId: m.id, kunde: m.kunde, leistungId: m.leistungId, start: m.start }) : null;
  const ablauf = sm?.prozess ?? (sm?.vorlage && d?.prozesse.some(p => p.id === sm.vorlage!.id && p.art === 'paket' && !p.zusatz) ? sm.vorlage : undefined);
  if (!d || !sm || !ablauf || d.faelle[m.id]) return null;
  const pakete = d.prozesse.filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, ...(p.zusatz ? { zusatz: true as const } : {}) }));
  if (start) return <StartDialog k={sm} pakete={pakete} onZu={onZu} />;
  return (
    <Fenster titel="Kundenonboarding jetzt starten?" onZu={onZu} breit={480}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
          {produktName ? `„${produktName}“ hat` : 'Das Produkt hat'} den Ablauf „{ablauf.titel}“. Der Fall für „{m.kunde}“ legt die Schritte des Ablaufs und das Onboarding an —
          die Willkommensmail geht erst mit deinem Klick raus. Später geht es unter Fulfillment › Onboarding.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Später</Knopf>
          <Knopf haupt onClick={() => setStart(true)}>Onboarding starten</Knopf>
        </div>
      </div>
    </Fenster>
  );
}
