'use client';

// ─── Netzwerken (02.10.) — die Seite für Veranstaltungen, am Handy gedacht ───
// /os/netzwerken: oben „Heute bei: <Event>“ (Event-Modus), darunter zwei Reiter — „Erfassen“ (Karte fotografieren, Felder,
// „Kennen wir schon?“, nächster Schritt, bestätigen) und „Heute“ (Abendbericht + Danke-Mail-Entwürfe) — und der Knopf
// „Meine Karte (QR)“ (/os/netzwerken/karte). Die Warteschlange (IndexedDB) steht als Streifen über allem, solange etwas wartet.
// Konzept: Kevin/Malin 02.10.; Ablauf und Regeln: lib/crm/netzwerken.ts (rein), lib/crm/netzwerken-server.ts (Server).

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { QrCode } from 'lucide-react';
import { FARBE as C, LEUCHT, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { useCrm } from '../crm/daten';
import { Gross, Hinweis, useGemerkt } from './bausteine';
import { Seite, Knopf, Segmente } from '../ui';
import { EventModus, EventWahlFenster, type EventWahl } from './EventModus';
import { Erfassen } from './Erfassen';
import { Heute } from './Heute';
import { useKontext, useWarteschlange } from './useNetzwerken';
import { OhneTerminKnopf } from './Ergebnis';
import { NUR_RAM_HINWEIS, altHinweis, verworfenText, geteilteWarteschlange, type WarteEintrag } from '@/lib/netzwerken/warteschlange';
import { lokalAbleiten } from '@/lib/netzwerken/wahl';

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
  // `lokal` live aus dem Event-Bestand (H2): steht das Event dort, ist es nicht mehr „lokal“ — Erfassen und Event-Kopf sehen dieselbe Wahl.
  const ereignisse = api.crm?.stand.events;
  const gueltig = useMemo(() => (wahl && wahl.tag === heute ? lokalAbleiten(wahl, ereignisse) : null), [wahl, heute, ereignisse]);
  // Hat der Server die Erfassung an ein gleichnamiges Event desselben Tages gehängt (M7), zieht „Heute bei“ mit um.
  const umgehaengt = warte.umgehaengt;
  useEffect(() => { const nach = wahl ? umgehaengt[wahl.eventId] : undefined; if (wahl && nach && nach !== wahl.eventId) { const { lokal: _l, ...rest } = wahl; setWahl({ ...rest, eventId: nach }); } }, [wahl, umgehaengt, setWahl]);
  // „Jetzt erfassen“ aus der Event-Akte (?event=<Event>): „Heute bei“ steht dann schon auf diesem Event (einmal, sobald die Kartei da ist).
  const eventParam = suche.get('event');
  const [vorgewaehlt, setVorgewaehlt] = useState<string | null>(null);
  useEffect(() => {
    if (!eventParam || vorgewaehlt === eventParam || !api.crm) return;
    const e = api.crm.stand.events.find(x => x.id === eventParam);
    setVorgewaehlt(eventParam);
    if (e) { setWahl({ eventId: e.id, titel: e.titel, datum: e.datum, ...(e.ort ? { ort: e.ort } : {}), tag: heute, ...(e.fuer?.art === 'kunde' ? { fuer: e.fuer } : {}) }); setReiter('erfassen'); }
  }, [eventParam, vorgewaehlt, api.crm, heute, setWahl]);

  return (
    <Seite className="netz-seite" breit={688} titel="Netzwerken" unter="Karte fotografieren, Person erfassen, nächsten Schritt festlegen — noch auf der Veranstaltung."
      rechts={<Knopf href={WEG.netzwerkenKarte()} leise ariaLabel="Meine Karte (QR) zeigen"><QrCode size={18} aria-hidden style={{ color: C.inkDim }} />Meine Karte</Knopf>}>
      <EventModus api={api} ich={ich} heute={heute} wahl={gueltig} setWahl={setWahl} />

      <Segmente liste={[{ id: 'erfassen', label: 'Erfassen' }, { id: 'heute', label: `Heute${warte.fehler ? ' · !' : ''}` }]} aktiv={reiter} onWahl={setReiter} />

      <Warteschlange warte={warte} offline={k.offline} api={api} ich={ich} heute={heute} />

      {api.fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{api.fehler} <button type="button" onClick={() => api.setFehler(null)} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.body, textDecoration: 'underline', minHeight: 44 }}>ausblenden</button></Hinweis>}

      {reiter === 'erfassen'
        ? <Erfassen api={api} ich={ich} personen={k.personen} heute={heute} wahl={gueltig} warte={warte} offline={k.offline} onBericht={() => { setBerichtEvent(gueltig?.eventId ?? null); setReiter('heute'); }} />
        : <Heute api={api} ich={ich} personen={k.personen} heute={heute} wahl={gueltig} eventId={berichtEvent} setEventId={setBerichtEvent} onErfassen={() => setReiter('erfassen')} />}
    </Seite>
  );
}

/** Der Streifen der Warteschlange: was noch auf dem Gerät liegt, warum, und was man tun kann. */
function Warteschlange({ warte, offline, api, ich, heute }: { warte: ReturnType<typeof useWarteschlange>; offline: boolean; api: ReturnType<typeof useCrm>; ich: string | null; heute: string }) {
  const [anderes, setAnderes] = useState<WarteEintrag | null>(null);
  if (!warte.eintraege.length && !warte.neuLaden && !warte.verworfenAlt.length) return null;
  return (
    <>
    <section aria-label="Warteschlange" style={{ display: 'grid', gap: 10 }}>
      {warte.verworfenAlt.length > 0 && (
        <Hinweis farbe={LEUCHT.achtung} rolle="alert">
          {warte.verworfenAlt.map(v => <div key={v.id}>{verworfenText(v)}</div>)}
          <div style={{ marginTop: 10 }}><Gross onClick={warte.verworfenAusblenden} kleinerAbstand>Verstanden</Gross></div>
        </Hinweis>
      )}
      {warte.neuLaden && (
        <Hinweis farbe={LEUCHT.achtung} rolle="alert">
          MAKE OS wurde aktualisiert — bitte die Seite neu laden. Die Erfassungen bleiben auf dem Gerät.
          <div style={{ marginTop: 10 }}><Gross ton="haupt" onClick={() => window.location.reload()} kleinerAbstand>Seite neu laden</Gross></div>
        </Hinweis>
      )}
      {warte.eintraege.length > 0 && (
        <Hinweis farbe={warte.fehler ? LEUCHT.kritisch : LEUCHT.achtung} rolle="status">
          <b>{warte.wartend ? `${warte.wartend} ${warte.wartend === 1 ? 'Erfassung wartet' : 'Erfassungen warten'} auf dem Gerät` : 'Nicht alles ist gespeichert'}</b>
          {warte.wartend ? (warte.laeuft ? ' — wird gerade gesendet …' : offline ? ' — kein Netz, geht automatisch raus, sobald Netz da ist' : ' — wird gesendet') : ''}
          {warte.nurImRam && <div style={{ marginTop: 6 }}><b>{NUR_RAM_HINWEIS}</b></div>}
          <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {warte.eintraege.map(e => (
              <li key={e.id} style={{ display: 'grid', gap: 6, fontSize: 14, lineHeight: 1.45 }}>
                <span><b>{e.anzeige.name}</b> · {e.anzeige.schritt}{e.anzeige.termin ? ` · ${e.anzeige.termin}` : ''} · {e.anzeige.eventTitel}</span>
                <span style={{ color: e.status === 'fehler' ? LEUCHT.kritisch : C.inkDim }}>{e.hinweis}</span>
                {altHinweis(e) && <span style={{ color: LEUCHT.achtung, fontWeight: 600 }}>{altHinweis(e)}</span>}
                {altHinweis(e) && e.status === 'wartet' && <span><Gross onClick={() => void warte.verwerfen(e.id)} kleinerAbstand>Verwerfen</Gross></span>}
                {e.status === 'fehler' && <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><Gross ton="haupt" onClick={() => void warte.erneut(e.id)} kleinerAbstand>Erneut versuchen</Gross><Gross onClick={() => void warte.verwerfen(e.id)} kleinerAbstand>Verwerfen</Gross></span>}
                <OhneTerminKnopf e={e} onOhneTermin={x => void warte.ohneTermin(x)} />
                {e.eventFehler && <Gross onClick={() => setAnderes(e)} kleinerAbstand>Anderes Event wählen</Gross>}
              </li>
            ))}
          </ul>
          {warte.wartend > 0 && !warte.laeuft && !offline && <div style={{ marginTop: 10 }}><Gross onClick={() => void warte.senden()} kleinerAbstand>Jetzt senden</Gross></div>}
        </Hinweis>
      )}
    </section>
    {anderes && <EventWahlFenster api={api} ich={ich} heute={heute} onZu={() => setAnderes(null)} onWahl={w => { void geteilteWarteschlange().eventWechseln(anderes.id, { eventId: w.eventId, titel: w.titel, datum: w.datum, ...(w.ort ? { ort: w.ort } : {}), ...(w.fuer ? { fuer: w.fuer } : {}) }).then(() => { setAnderes(null); void warte.senden(); }); }} />}
    </>
  );
}
