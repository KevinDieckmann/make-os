'use client';

// ─── Event · Detail — sieben Reiter entlang des Lebenslaufs eines Events ────
// Überblick → Gäste → Ablauf → Checkliste → Budget → Abend → Nachfassen.
// Geöffnet wird, was gerade dran ist: am Tag selbst der Abend-Modus, danach
// das Nachfassen, solange jemand offen ist, sonst der Überblick.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../../schlank';
import { checklisteStand } from '@/lib/crm/eventplanung';
import { datum } from '../daten';
import { Pillen } from '../teile';
import { FORMATE, type ReiterProps, type Reiter } from './gemeinsam';
import { Ueberblick } from './Ueberblick';
import { Gaeste } from './Gaeste';
import { Ablauf } from './Ablauf';
import { Checkliste } from './Checkliste';
import { Budget } from './Budget';
import { Abend } from './Abend';
import { Nachfassen } from './Nachfassen';

export function EventDetail({ e, api, zuKontakt }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
  const gaeste = crm.stand.teilnahmen.filter(t => t.eventId === e.id);
  const nachfassenOffen = gaeste.filter(t => t.status === 'da' && !t.followUpAm).length;
  const cl = checklisteStand(e, heute);
  const [reiter, setReiter] = useState<Reiter>(() => (e.datum === heute ? 'abend' : e.datum < heute && nachfassenOffen ? 'nachfassen' : 'ueberblick'));
  const faellig = cl.ueberfaellig + cl.bald;
  const REITER: { id: Reiter; label: string }[] = [
    { id: 'ueberblick', label: 'Überblick' },
    { id: 'gaeste', label: gaeste.length ? `Gäste ${gaeste.length}` : 'Gäste' },
    { id: 'ablauf', label: 'Ablauf' },
    { id: 'checkliste', label: faellig ? `Checkliste ${faellig}` : 'Checkliste' },
    { id: 'budget', label: 'Budget' },
    { id: 'abend', label: 'Abend' },
    { id: 'nachfassen', label: nachfassenOffen ? `Nachfassen ${nachfassenOffen}` : 'Nachfassen' },
  ];
  const props = { e, api, zuKontakt };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{e.titel}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>
            {[datum(e.datum, heute), e.uhrzeit ? `${e.uhrzeit} Uhr` : '', e.ort, FORMATE.find(f => f.id === e.format)?.label].filter(Boolean).join(' · ')}
          </div>
        </div>
        <Knopf leise onClick={() => { window.location.href = `/api/crm/events?ics=${encodeURIComponent(e.id)}`; }}>Kalender-Datei</Knopf>
      </div>
      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={REITER} aktiv={reiter} onWahl={setReiter} farbe={LEUCHT.beziehung} /></div>
      {reiter === 'ueberblick' && <Ueberblick {...props} zuReiter={setReiter} />}
      {reiter === 'gaeste' && <Gaeste {...props} />}
      {reiter === 'ablauf' && <Ablauf {...props} />}
      {reiter === 'checkliste' && <Checkliste {...props} />}
      {reiter === 'budget' && <Budget {...props} />}
      {reiter === 'abend' && <Abend {...props} />}
      {reiter === 'nachfassen' && <Nachfassen {...props} />}
    </div>
  );
}
