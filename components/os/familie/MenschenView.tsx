'use client';

// ─── MAKE OS — Kontakte · privat (26.09., Kevin: „wir haben ja auch ein privates
// Kontaktbuch — das ist dann im privaten Space“) ────────────────────────────
// Unsere Menschen (Eltern, Geschwister, Kinder, Freunde mit Kontakt-Takt) und
// die wichtigen Tage — dieselben Daten wie unter Familie → Familie, hier als
// eigene Seite im Privat-Space. Das Business-Kontaktbuch ist die Markttraktion.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Leer } from '../ui';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { useFamilie } from './daten';
import { Tage, Menschen } from './FamilieOrga';

export function MenschenView() {
  const api = useFamilie();
  return (
    <Seite titel="Kontakte · privat" unter="Eure Menschen mit Kontakt-Takt und die wichtigen Tage — wer einen Anruf verdient, steht auf Heute."
      rechts={<Link href="/os/familie" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Familie & Partnerschaft ›</Link>}>
      {!api.d ? (
        <Karte i={0}><Leer>{api.fehler ?? 'Lädt …'}</Leer></Karte>
      ) : (
        <Flaeche seite="menschen">
          <Kachel id="menschen" titel="Unsere Menschen" breite={3}><Menschen api={api} /></Kachel>
          <Kachel id="tage" titel="Wichtige Tage" breite={3}><Tage api={api} /></Kachel>
        </Flaeche>
      )}
    </Seite>
  );
}
