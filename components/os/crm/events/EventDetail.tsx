'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// ─── Event · Detail — sieben Reiter entlang des Lebenslaufs eines Events ────
// Überblick → Gäste → Ablauf → Checkliste → Budget → Abend → Nachfassen.
// Geöffnet wird, was gerade dran ist: am Tag selbst der Abend-Modus, danach
// das Nachfassen, solange jemand offen ist, sonst der Überblick.
// Im Kopf: wer zuständig ist und ob die/der andere gerade auch hier ist
// (die Adresse trägt k=<Event-ID>, siehe Events.tsx).

import { useState, useEffect } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../../schlank';
import { checklisteStand } from '@/lib/crm/eventplanung';
import { zustaendig } from '@/lib/crm/team';
import { datum } from '../daten';
import { Pillen } from '../teile';
import { Person, AuchHier } from '../team';
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
  // Der Reiter steht im Link (?r=gaeste|nachfassen|…) — Übergaben, „Für dich“ und Index-Punkte landen so direkt richtig (26.09.).
  const router = useRouter(); const params = useSearchParams(); const pfad = usePathname() ?? '';
  const REITER_IDS: Reiter[] = ['ueberblick', 'gaeste', 'ablauf', 'checkliste', 'budget', 'abend', 'nachfassen'];
  const ausLink = params.get('r') as Reiter | null;
  const [reiter, setReiterRoh] = useState<Reiter>(() => (ausLink && REITER_IDS.includes(ausLink) ? ausLink : e.datum === heute ? 'abend' : e.datum < heute && nachfassenOffen ? 'nachfassen' : 'ueberblick'));
  useEffect(() => { if (ausLink && REITER_IDS.includes(ausLink)) setReiterRoh(ausLink); }, [ausLink]); // eslint-disable-line react-hooks/exhaustive-deps
  const setReiter = (r: Reiter) => { setReiterRoh(r); const q = new URLSearchParams(params.toString()); if (r === 'ueberblick') q.delete('r'); else q.set('r', r); router.replace(`${pfad}?${q}`, { scroll: false }); };
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
  const wer = zustaendig(e.zustaendig, 'event');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{e.titel}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4 }}>
            {[datum(e.datum, heute), e.uhrzeit ? `${e.uhrzeit} Uhr` : '', e.ort, FORMATE.find(f => f.id === e.format)?.label].filter(Boolean).join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <button onClick={() => setReiter('ueberblick')} title="Zuständigkeit im Überblick ändern" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkLeise }}>
              zuständig <Person id={wer} name />
            </button>
            <AuchHier passt={pfad => new URLSearchParams(pfad.split('?')[1] ?? '').get('k') === e.id} was="bei diesem Event" />
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
