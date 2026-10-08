'use client';

// ─── Fotos & Videos — Einstieg an einem Event (09.10., Paket 5) ──────────────────────────────────────────────────────────
// Kevin 09.10.: „Knopf im Netzwerken-Event-Modus · Kachel in der Event-Akte“. Das Album ist vorbelegt (feste Kennung je Event, entsteht beim
// ersten Upload — auch, wenn ohne Netz aufgenommen wurde), Bereich Business. Danach geht alles über die Warteschlange und den Sender.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { albumKennung } from '@/lib/medien/regeln';
import { geteilteMedienSchlange } from '@/lib/medien/warteschlange';
import { Karte, Ueberschrift } from '../ui';
import { AufnehmenKnoepfe } from './Aufnehmen';

/** Kompakt: zwei Knöpfe + Link „Alle Fotos & Videos des Events“. `kachel` = als eigene Karte (Event-Akte). */
export function MedienKnopf({ eventId, titel, kachel }: { eventId: string; titel: string; kachel?: boolean }) {
  const album = albumKennung('event', eventId);
  const [wartend, setWartend] = useState(0);
  useEffect(() => {
    const q = geteilteMedienSchlange();
    const zaehlen = () => { void q.alle().then(l => setWartend(l.filter(x => x.status === 'wartet').length)).catch(() => {}); };
    zaehlen();
    return q.beiAenderung(zaehlen);
  }, []);
  if (!album) return null;
  const inhalt = (
    <div style={{ display: 'grid', gap: 10 }}>
      <AufnehmenKnoepfe vorgabe={{ bereich: 'business', album, albumTitel: titel, eventNeu: { eventId, titel } }} privat={false} ich={null} farbe={LEUCHT.agenten} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
        <Link href={WEG.medien({ album })} style={{ color: C.aktiv, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Fotos & Videos des Events ›</Link>
        {wartend > 0 && <span role="status">{wartend === 1 ? '1 wartet auf das Senden' : `${wartend} warten auf das Senden`}</span>}
      </div>
    </div>
  );
  if (!kachel) return inhalt;
  return (
    <Karte>
      <Ueberschrift>Fotos & Videos</Ueberschrift>
      {inhalt}
    </Karte>
  );
}
