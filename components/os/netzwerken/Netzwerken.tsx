'use client';

// ─── Netzwerken (02.10.) — die Seite für Veranstaltungen, am Handy gedacht ───
// /os/netzwerken: oben „Heute bei: <Event>“ (Event-Modus), darunter zwei Reiter — „Erfassen“ (Karte fotografieren, Felder,
// „Kennen wir schon?“, nächster Schritt, bestätigen) und „Heute“ (Abendbericht + Danke-Mail-Entwürfe) — und der Knopf
// „Meine Karte (QR)“ (/os/netzwerken/karte). Die Warteschlange (IndexedDB) steht als Streifen über allem, solange etwas wartet.
// Konzept: Kevin/Malin 02.10.; Ablauf und Regeln: lib/crm/netzwerken.ts (rein), lib/crm/netzwerken-server.ts (Server).

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { useCrm } from '../crm/daten';
import { Gross, Hinweis, Wahl, ZIEL, kopfStil, useGemerkt } from './bausteine';
import { EventModus, type EventWahl } from './EventModus';
import { Erfassen } from './Erfassen';
import { Heute } from './Heute';
import { useKontext, useWarteschlange } from './useNetzwerken';

type Reiter = 'erfassen' | 'heute';

export function NetzwerkenSeite() {
  const suche = useSearchParams();
  const bericht = suche.get('bericht');
  const api = useCrm();
  const k = useKontext();
  const warte = useWarteschlange(() => { void api.laden(true); });
  const [wahl, setWahl] = useGemerkt<EventWahl | null>('make-os-netzwerken-event', null);
  const [reiter, setReiter] = useState<Reiter>(bericht ? 'heute' : 'erfassen');
  const [berichtEvent, setBerichtEvent] = useState<string | null>(bericht);
  useEffect(() => { if (bericht) { setReiter('heute'); setBerichtEvent(bericht); } }, [bericht]);
  const heute = api.crm?.heute ?? k.heute;
  const ich = k.ich ?? api.ich;
  const gueltig = wahl && wahl.tag === heute ? wahl : null;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '16px 14px 40px', color: C.ink, fontFamily: SCHRIFT.text, display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 style={{ ...kopfStil, fontSize: 'clamp(24px, 6vw, 30px)' }}>Netzwerken</h1>
          <Link href={WEG.netzwerkenKarte()} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: ZIEL, padding: '8px 14px', borderRadius: 14, textDecoration: 'none', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 600, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', color: C.ink }}>Meine Karte (QR) ›</Link>
        </div>
        <div style={{ fontSize: 14, color: C.inkDim, lineHeight: 1.45 }}>Karte fotografieren, Person erfassen, nächsten Schritt festlegen — noch auf der Veranstaltung.</div>
      </header>

      <EventModus api={api} ich={ich} heute={heute} wahl={wahl} setWahl={setWahl} />

      <nav aria-label="Netzwerken" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Wahl an={reiter === 'erfassen'} onClick={() => setReiter('erfassen')}>Erfassen</Wahl>
        <Wahl an={reiter === 'heute'} onClick={() => setReiter('heute')}>Heute{warte.fehler ? ' · !' : ''}</Wahl>
      </nav>

      <Warteschlange warte={warte} />

      {api.fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{api.fehler} <button type="button" onClick={() => api.setFehler(null)} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 14, textDecoration: 'underline', minHeight: 44 }}>ausblenden</button></Hinweis>}

      {reiter === 'erfassen'
        ? <Erfassen api={api} ich={ich} personen={k.personen} heute={heute} wahl={gueltig} warte={warte} offline={k.offline} onBericht={() => { setBerichtEvent(gueltig?.eventId ?? null); setReiter('heute'); }} />
        : <Heute api={api} ich={ich} personen={k.personen} heute={heute} wahl={gueltig} eventId={berichtEvent} setEventId={setBerichtEvent} />}
    </div>
  );
}

/** Der Streifen der Warteschlange: was noch auf dem Gerät liegt, warum, und was man tun kann. */
function Warteschlange({ warte }: { warte: ReturnType<typeof useWarteschlange> }) {
  if (!warte.eintraege.length && !warte.neuLaden) return null;
  return (
    <section aria-label="Warteschlange" style={{ display: 'grid', gap: 10 }}>
      {warte.neuLaden && (
        <Hinweis farbe={LEUCHT.achtung} rolle="alert">
          MAKE OS wurde aktualisiert — bitte die Seite neu laden. Die Erfassungen bleiben auf dem Gerät.
          <div style={{ marginTop: 10 }}><Gross ton="haupt" onClick={() => window.location.reload()} kleinerAbstand>Seite neu laden</Gross></div>
        </Hinweis>
      )}
      {warte.eintraege.length > 0 && (
        <Hinweis farbe={warte.fehler ? LEUCHT.kritisch : LEUCHT.achtung} rolle="status">
          <b>{warte.wartend ? `${warte.wartend} ${warte.wartend === 1 ? 'Erfassung wird' : 'Erfassungen werden'} gesendet, sobald Netz da ist` : 'Nicht alles ist gespeichert'}</b>
          {warte.laeuft ? ' — sendet gerade …' : ''}
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {warte.eintraege.map(e => (
              <li key={e.id} style={{ display: 'grid', gap: 6, fontSize: 14, lineHeight: 1.45 }}>
                <span><b>{e.anzeige.name}</b> · {e.anzeige.schritt}{e.anzeige.termin ? ` · ${e.anzeige.termin}` : ''} · {e.anzeige.eventTitel}</span>
                <span style={{ color: e.status === 'fehler' ? LEUCHT.kritisch : C.inkDim }}>{e.hinweis}</span>
                {e.status === 'fehler' && <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Gross ton="haupt" onClick={() => void warte.erneut(e.id)} kleinerAbstand>Erneut versuchen</Gross><Gross onClick={() => void warte.verwerfen(e.id)} kleinerAbstand>Verwerfen</Gross></span>}
              </li>
            ))}
          </ul>
          {warte.wartend > 0 && !warte.laeuft && <div style={{ marginTop: 10 }}><Gross onClick={() => void warte.senden()} kleinerAbstand>Jetzt senden</Gross></div>}
        </Hinweis>
      )}
    </section>
  );
}
