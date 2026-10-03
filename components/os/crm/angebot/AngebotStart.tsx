'use client';

// ─── Markttraktion · Angebot (28.09.) ────────────────────────────────────────
// Kevin: „Das Angebots-Tool, direkt verbunden mit Kunden, Mandaten, Produktinhalten
// und Preisen. Im Call muss es extrem schnell gehen.“
// Schnittstelle fest (A2 rendert aus der Adresse `?s=angebot&k=<angebot>&kontakt=&firma=&deal=`):
//   · ohne Kennung und ohne Vorbelegung → Liste „Angebote“ (Filter Status, Gesellschaft, Suche)
//   · mit Vorbelegung (Kontakt öffnen, Deal-Akte, Umsatz-Reiter) → neuer Entwurf, vorbelegt
//   · mit Kennung → Entwurf (Editor) bzw. gestelltes Angebot (Ansicht)
// Ein neuer Entwurf bekommt seine Kennung sofort; nach dem ersten Speichern steht sie in
// der Adresse (replace — derselbe Ort). Öffnen/Liste = push (Ort wechseln).

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CrmApi } from '../daten';
import { neueId } from '../daten';
import { Karte, Leer, Knopf } from '../../ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { angebotLink } from '@/lib/crm/adresse';
import { useAngebote } from './angebot-daten';
import { Editor, type Gestellt, type Vorbelegung } from './Editor';
import { Ansicht } from './Ansicht';
import { AngebotListe } from './Liste';

export interface AngebotStartProps {
  api: CrmApi;
  /** Vorbelegung aus der Adresse bzw. dem Aufrufer (Kontakt öffnen, Deal-Akte). */
  kontaktId?: string | null;
  firmaId?: string | null;
  dealId?: string | null;
  /** Ein bestehendes Angebot öffnen (Kennung aus der Adresse `k`). */
  angebotId?: string | null;
  zuKontakt?: (id: string) => void;
  zuDeal?: (id: string) => void;
}

export function AngebotStart({ api, kontaktId, firmaId, dealId, angebotId, zuKontakt, zuDeal }: AngebotStartProps) {
  const router = useRouter();
  const daten = useAngebote();
  const [neu, setNeu] = useState<{ id: string; vorbelegung: Vorbelegung } | null>(null);
  const [gestellt, setGestellt] = useState<Gestellt | null>(null);

  // Vorbelegung in der Adresse (ohne Kennung) → neuer Entwurf für genau diese Vorbelegung.
  const schluessel = !angebotId && (kontaktId || firmaId || dealId) ? `${kontaktId ?? ''}|${firmaId ?? ''}|${dealId ?? ''}` : null;
  useEffect(() => {
    if (!schluessel) return;
    setNeu(alt => (alt && alt.id && `${alt.vorbelegung.kontaktId ?? ''}|${alt.vorbelegung.firmaId ?? ''}|${alt.vorbelegung.dealId ?? ''}` === schluessel ? alt : { id: neueId('ang'), vorbelegung: { kontaktId, firmaId, dealId } }));
  }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps

  const oeffnen = useCallback((id: string) => { setNeu(null); setGestellt(null); router.push(angebotLink({ angebotId: id })); }, [router]);
  const zurListe = useCallback(() => { setNeu(null); setGestellt(null); router.push(angebotLink({})); }, [router]);
  const gespeichert = useCallback((id: string) => { router.replace(angebotLink({ angebotId: id })); }, [router]);

  if (daten.gesperrt) return <Karte i={0}><Leer>Angebote gehören zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.</Leer></Karte>;
  if (!api.crm || !api.kontakte || daten.angebote === null) {
    return <Karte i={0}><Leer>{daten.fehler ?? api.fehler ?? 'Angebote laden …'}</Leer>{(daten.fehler || api.fehler) && <div style={{ marginTop: 8 }}><Knopf leise onClick={async () => { await Promise.all([daten.laden(), api.laden(true)]); }}>Noch einmal</Knopf></div>}</Karte>;
  }

  const offenId = angebotId ?? neu?.id ?? null;
  if (!offenId) return <AngebotListe api={api} daten={daten} onOeffnen={oeffnen} onNeu={() => setNeu({ id: neueId('ang'), vorbelegung: {} })} />;

  const a = daten.angebote.find(x => x.id === offenId) ?? null;
  if (a && a.status !== 'entwurf') {
    const start = gestellt && gestellt.angebot.id === a.id
      ? { text: `Angebot ${a.nummer} gestellt.${gestellt.hinweise.length ? ` Hinweis: ${gestellt.hinweise.join(' ')}` : ''}`, mailto: gestellt.mailto, pdf: gestellt.pdf } : null;
    return <Ansicht key={a.id} a={a} api={api} daten={daten} meldungStart={start} onOeffnen={oeffnen} onListe={zurListe} zuKontakt={zuKontakt} zuDeal={zuDeal} />;
  }
  if (!a && neu?.id !== offenId) {
    return (
      <Karte i={0}>
        <Leer>Dieses Angebot gibt es nicht (mehr).</Leer>
        <div style={{ marginTop: 8, fontSize: TYP.bedien, color: C.inkDim }}><Knopf leise onClick={zurListe}>Zu allen Angeboten</Knopf></div>
      </Karte>
    );
  }
  return (
    <Editor key={offenId} api={api} daten={daten} id={offenId} start={a} vorbelegung={neu?.id === offenId ? neu.vorbelegung : {}}
      onGespeichert={gespeichert} onListe={zurListe}
      onGestellt={g => { setGestellt(g); router.replace(angebotLink({ angebotId: g.angebot.id })); }} />
  );
}
