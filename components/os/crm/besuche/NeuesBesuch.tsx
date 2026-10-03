'use client';

// ─── Events · neues Event anlegen (03.10.) ──────────────────────────────────
// Vier Angaben reichen: Name, Datum, Ort — und für wen (MAKE oder ein Kunde) und wer hingeht. Alles Weitere (Kosten, Link,
// Ziel, Zielpersonen, Anmeldung) steht danach in der Event-Akte. Das Event ist ein ganz normales Event der Kartei
// (`marke: Netzwerken`, lib/crm/netzwerken.ts `neuesEvent`) — bei „Netzwerken“ steht es sofort zur Wahl.

import { useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, LEUCHT, feld } from '../../schlank';
import { neuesEvent } from '@/lib/crm/netzwerken';
import { TEAM } from '@/lib/crm/team';
import { neueId, plusTage } from '../daten';
import { Wahl, WahlMehrfach } from '../Wahl';
import { fuerEintraege, BFeld, type BesuchProps } from './gemeinsam';

export function NeuesBesuch({ api, crm, onFertig, onZu }: Pick<BesuchProps, 'api' | 'crm'> & { onFertig: (id: string) => void; onZu: () => void }) {
  const heute = crm.heute;
  const [titel, setTitel] = useState('');
  const [datumWert, setDatumWert] = useState(plusTage(heute, 14));
  const [ort, setOrt] = useState('');
  const [fuerId, setFuerId] = useState('make');
  const [wer, setWer] = useState<string[]>(api.ich ? [api.ich] : []);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const anlegen = async () => {
    const t = titel.trim();
    if (t.length < 2) { setFehler('Wie heißt das Event?'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datumWert)) { setFehler('Bitte ein Datum wählen.'); return; }
    setLaeuft(true); setFehler(null);
    const e = neuesEvent({
      id: neueId('ev'), titel: t.slice(0, 160), datum: datumWert, ...(ort.trim() ? { ort: ort.trim().slice(0, 200) } : {}), person: api.ich ?? TEAM[0].id, heute, jetztIso: new Date().toISOString(),
      ...(fuerId !== 'make' ? { fuer: { art: 'kunde' as const, firmaId: fuerId } } : {}), ...(wer.length ? { wer } : {}), anmeldung: datumWert <= heute ? 'besucht' : 'geplant',
    });
    await api.setze('events', e as unknown as { id: string } & Record<string, unknown>);
    setLaeuft(false);
    onFertig(e.id);
  };

  return (
    <Karte i={1} akzent={LEUCHT.beziehung}>
      <Ueberschrift rechts={<Knopf leise onClick={onZu}>Abbrechen</Knopf>}>Neues Event</Ueberschrift>
      <div className="bes-neu" style={{ display: 'grid', gap: 4 }}>
        <BFeld label="Name">
          <input value={titel} onChange={x => setTitel(x.target.value)} placeholder="z. B. Mittelstandstag Köln" aria-label="Name des Events" autoCapitalize="sentences" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
        </BFeld>
        <BFeld label="Datum">
          <input type="date" value={datumWert} onChange={x => setDatumWert(x.target.value)} aria-label="Datum" style={{ ...feld, fontSize: 16, padding: '10px 12px', maxWidth: 200 }} />
        </BFeld>
        <BFeld label="Ort">
          <input value={ort} onChange={x => setOrt(x.target.value)} placeholder="optional" aria-label="Ort" style={{ ...feld, fontSize: 16, padding: '10px 12px' }} />
        </BFeld>
        <BFeld label="Für wen">
          <Wahl label="Für wen" liste={fuerEintraege(crm.stand.firmen)} wert={fuerId} onWahl={setFuerId} farbe={fuerId === 'make' ? C.aktiv : LEUCHT.business} />
        </BFeld>
        <BFeld label="Wer geht hin">
          <WahlMehrfach label="Wer geht hin" leer="+ wer geht hin" liste={TEAM.map(m => ({ id: m.id, label: m.name }))} wert={wer} onWahl={setWer} />
        </BFeld>
      </div>
      {fehler && <div role="alert" style={{ fontSize: 13, color: LEUCHT.achtung, margin: '8px 0' }}>{fehler}</div>}
      <div style={{ marginTop: 10 }}><Knopf onClick={anlegen} aus={laeuft}>{laeuft ? 'legt an …' : 'Event anlegen'}</Knopf></div>
    </Karte>
  );
}
