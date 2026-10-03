'use client';

// ─── Events · Kalender — anstehende und vergangene besuchte Events (03.10.) ──
// Eine Liste, Listen zuerst (Handy): was kommt, wann, wo, für wen, wer von uns hingeht, Anmeldestand, Kosten. Unsere eigenen
// Make.One-Abende stehen dazwischen — nur lesend, ein Tipp führt in Make.One (Kevin: „Einmal Make.One, daneben Events, dann
// verbinden wir die beiden“). Im MAKE-OS-Kalender erscheint ein Event über den bestehenden Spiegel (Termin im Kalender
// „Gemeinsam“, `events/Kalender.tsx`) — den Knopf gibt es in der Event-Akte, nichts wird still angelegt.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { CalendarCheck, CalendarPlus } from 'lucide-react';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Leerzustand, Chip, Punkt, LEUCHT } from '../../ui';
import { anmeldungVon, anmeldungLabel, besuchAbgesagt, istBesuch } from '@/lib/crm/besuche-form';
import { budgetSumme } from '@/lib/crm/eventplanung';
import { eventName } from '@/lib/crm/marke';
import type { Event, EventAnmeldung } from '@/lib/crm/typen';
import { WEG } from '@/lib/wege';
import { datum, euro } from '../daten';
import { Person } from '../team';
import { FuerChip, type BesuchProps } from './gemeinsam';

const ANMELDE_FARBE: Record<EventAnmeldung, string> = { geplant: LEUCHT.puls, angemeldet: LEUCHT.beziehung, abgesagt: C.inkLeise, besucht: LEUCHT.gut };
const VERGANGEN_START = 12;

type Eintrag = { art: 'besuch' | 'makeone'; e: Event };

export function BesuchKalender({ crm, onAkte }: Pick<BesuchProps, 'crm'> & { onAkte: (id: string) => void }) {
  const router = useRouter();
  const heute = crm.heute;
  const firmen = crm.stand.firmen;
  const [alle, setAlle] = useState(false);

  const alleEvents = crm.stand.events;
  const eintraege: Eintrag[] = alleEvents.map(e => ({ art: istBesuch(e) ? 'besuch' as const : 'makeone' as const, e }));
  // Unsere abgesagten Abende bleiben weg; abgesagte besuchte Events stehen unter „Vergangen“ (grau) — nichts verschwindet still.
  const abgesagt = (x: Eintrag) => besuchAbgesagt(x.e);
  const anstehend = eintraege.filter(x => x.e.datum >= heute && !abgesagt(x)).sort((a, b) => a.e.datum.localeCompare(b.e.datum) || (a.e.uhrzeit ?? '').localeCompare(b.e.uhrzeit ?? ''));
  const vergangenAlle = eintraege.filter(x => (x.e.datum < heute || abgesagt(x)) && !(x.art === 'makeone' && abgesagt(x))).sort((a, b) => b.e.datum.localeCompare(a.e.datum));
  const vergangen = alle ? vergangenAlle : vergangenAlle.slice(0, VERGANGEN_START);
  const besuche = alleEvents.filter(istBesuch);

  const zeile = ({ art, e }: Eintrag) => {
    const a = anmeldungVon(e);
    const kosten = budgetSumme(e);
    const unter = [datum(e.datum, heute), e.uhrzeit, e.ort].filter(Boolean).join(' · ');
    if (art === 'makeone') {
      return (
        <Zeile key={e.id} onClick={() => router.push(WEG.event(e.id))} links={<Punkt farbe={LEUCHT.beziehung} />}
          titel={eventName(e)} unter={`${unter} · eigener Abend — nur lesen, öffnet Make.One`}
          rechts={<Chip farbe={C.inkDim}>Make.One</Chip>} />
      );
    }
    return (
      <Zeile key={e.id} onClick={() => onAkte(e.id)} links={<Punkt farbe={ANMELDE_FARBE[a]} />}
        titel={e.titel} unter={[unter, kosten > 0 ? euro(kosten) : ''].filter(Boolean).join(' · ')}
        rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <FuerChip e={e} firmen={firmen} />
          {(e.wer ?? []).length > 0 && <span style={{ display: 'inline-flex' }} title={`Hin gehen: ${(e.wer ?? []).join(', ')}`}>{(e.wer ?? []).map(w => <Person key={w} id={w} groesse={20} />)}</span>}
          <Chip farbe={ANMELDE_FARBE[a]}>{anmeldungLabel(a)}</Chip>
        </span>} />
    );
  };

  return (
    <>
      <Karte i={1}>
        <Ueberschrift rechts={anstehend.length ? <span>{anstehend.length}</span> : undefined}>Anstehend</Ueberschrift>
        {anstehend.length ? <Liste>{anstehend.map(zeile)}</Liste>
          : besuche.length ? <Leer symbol={<CalendarCheck size={18} />}>Nichts mehr geplant.</Leer>
            : <Leerzustand symbol={<CalendarPlus size={26} />} ton={LEUCHT.beziehung} titel="Noch kein Event">Messe, Kongress, Kunden-Event — mit „+ Event“ anlegen: Dann steht es hier, lässt sich bei Netzwerken wählen und auf Wunsch in den Kalender legen.</Leerzustand>}
      </Karte>
      {vergangenAlle.length > 0 && (
        <Karte i={2}>
          <Ueberschrift rechts={<span>{vergangenAlle.length}</span>}>Vergangen</Ueberschrift>
          <Liste>{vergangen.map(zeile)}</Liste>
          {vergangenAlle.length > VERGANGEN_START && (
            <button type="button" onClick={() => setAlle(!alle)} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', minHeight: 44, fontSize: 13, fontWeight: 600, padding: '0 2px' }}>
              {alle ? 'Weniger zeigen' : `Alle ${vergangenAlle.length} zeigen`}
            </button>
          )}
        </Karte>
      )}
    </>
  );
}
