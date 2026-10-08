'use client';

// ─── Netzwerken — Event-Modus „Heute bei: …“ (02.10.) ────────────────────────
// Ganz oben auf der Seite: bei welcher Veranstaltung bin ich heute? Seit 03.10. bietet die Wahl die Events aus dem Event-Kalender
// an (Reiter „Events“ in der Markttraktion): zuerst die von heute, dann die der nahen Tage, der Rest über die Suche
// (`heuteBeiAngebot`, lib/crm/besuche.ts). Ein neues Event (Name, Datum heute, Ort optional, für wen) landet im selben Kalender —
// über den vorhandenen Event-Schreibweg (PATCH /api/crm/bestand, Liste „events“). „Für wen“ (MAKE selbst oder ein Kunde) erbt jede
// Erfassung vom Event und lässt sich hier ändern. Gemerkt wird die Wahl für den Tag (localStorage — nur Komfort). Ohne Netz
// entsteht das Event lokal und wird mit der ersten Erfassung mitgeschickt (`eventNeu`, der Server legt es dann an).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, TIEF, RAND } from '@/lib/make-one/design';
import { Karte } from '../ui';
import { Fenster } from '../Fenster';
import { neueId } from '../crm/daten';
import type { CrmApi } from '../crm/daten';
import type { Event, EventFuer, Firma } from '@/lib/crm/typen';
import { heuteBeiAngebot } from '@/lib/crm/besuche';
import { gleichesBesuchEvent, eventDatumPlausibel } from '@/lib/crm/netzwerken';
import { istKalendertag } from '@/lib/zeit';
import { geteilteWarteschlange } from '@/lib/netzwerken/warteschlange';
import { lokalAbleiten } from '@/lib/netzwerken/wahl';
import { istBesuch, fuerVon } from '@/lib/crm/besuche-form';
import { WEG } from '@/lib/wege';
import { markeVon, titelMitReihe } from '@/lib/crm/marke';
import { TEAM } from '@/lib/crm/team';
import { FuerAuswahl, fuerGueltig } from './FuerAuswahl';

const KEINE_EVENTS: Event[] = [];
import { neuesEvent } from '@/lib/crm/netzwerken';
import { Gross, Hinweis, eingabe, Feldzeile, tagText, ZIEL } from './bausteine';
import { AbendZaehler, abendZahlen } from './zaehler';
import { MedienKnopf } from '../medien/MedienKnopf';

/** Die gemerkte Wahl: das Event und der Tag, für den sie gilt. */
export interface EventWahl { eventId: string; titel: string; datum: string; ort?: string; /** Noch nicht auf dem Server (ohne Netz angelegt). */ lokal?: boolean; tag: string; /** Für wen das Event läuft (03.10.) — fehlt = MAKE selbst; geht mit `eventNeu` an den Server, wenn das Event ohne Netz entstand. */ fuer?: EventFuer }

export function EventModus({ api, ich, heute, wahl, setWahl }: { api: CrmApi; ich: string | null; heute: string; wahl: EventWahl | null; setWahl: (w: EventWahl | null) => void }) {
  const [offen, setOffen] = useState(false);
  const [fuerOffen, setFuerOffen] = useState(false);
  // `lokal` wird LIVE aus dem Event-Bestand abgeleitet (H2): steht das Event dort schon, ist es nicht mehr „lokal“.
  const ereignisse = api.crm?.stand.events;
  const gueltig = useMemo(() => (wahl && wahl.tag === heute ? lokalAbleiten(wahl, ereignisse) : null), [wahl, heute, ereignisse]);
  // Highlight b: die Zahlen des Abends — aus den Teilnahmen des Events, null solange die Kartei lädt (der Platz bleibt reserviert).
  const teilnahmen = api.crm?.stand.teilnahmen;
  const zahlen = useMemo(() => (gueltig && teilnahmen ? abendZahlen(teilnahmen, gueltig.eventId) : null), [gueltig, teilnahmen]);
  const ton = LEUCHT.beziehung;
  // Ist das Event ein besuchtes (Events-Reiter)? Unsere eigenen Make.One-Abende kennen kein „für wen“. Neue, noch lokale Events sind besuchte.
  const event = gueltig ? api.crm?.stand.events.find(x => x.id === gueltig.eventId) : undefined;
  const besuch = gueltig ? (event ? istBesuch(event) : !!gueltig.lokal) : false;
  const fuer: EventFuer = event ? fuerVon(event) : gueltig?.fuer ?? { art: 'make' };
  const firmen = api.crm?.stand.firmen ?? KEINE_FIRMEN;
  const fuerText = fuer.art === 'kunde' ? `Für ${firmen.find(f => f.id === fuer.firmaId)?.name ?? 'einen Kunden'}` : 'Für MAKE selbst';
  return (
    <>
      {/* Die EINE wichtige Karte der Seite: in der Bereichsfarbe getönt (Standard: Karte `ton`); ohne Event eine ruhige gestrichelte Fläche. */}
      <Karte dicht ton={gueltig ? ton : undefined} flach={!gueltig} style={{ display: 'grid', gap: 12, borderRadius: 20, ...(gueltig ? {} : { padding: 0, border: `1px dashed ${RAND.stark}`, background: 'rgba(255,255,255,.04)' }) }}>
        <button type="button" onClick={() => setOffen(true)} className="fassbar" aria-label={gueltig ? `Heute bei ${gueltig.titel} — wechseln` : 'Event wählen oder anlegen'}
          style={{ width: '100%', minHeight: gueltig ? 56 : 68, boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', padding: gueltig ? 0 : '14px 16px', background: 'none', border: 'none', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12, fontFamily: SCHRIFT.text, color: C.ink }}>
          {!gueltig && <span aria-hidden style={{ width: 40, height: 40, borderRadius: 20, flex: '0 0 auto', display: 'grid', placeItems: 'center', color: C.aktiv, background: C.aktivSanft, border: `1px solid ${TIEF.rand(C.aktiv)}` }}><CalendarPlus size={20} /></span>}
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: gueltig ? ton : C.inkLeise }}>Heute bei</span>
            <span style={{ display: 'block', fontFamily: SCHRIFT.display, fontSize: gueltig ? 19 : 17, fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.25, marginTop: 2, overflowWrap: 'anywhere' }}>{gueltig ? gueltig.titel : 'Event wählen oder anlegen'}</span>
            <span style={{ display: 'block', fontSize: TYP.bedien, color: C.inkDim, marginTop: 3, lineHeight: 1.4 }}>
              {gueltig ? `${tagText(gueltig.datum)}${gueltig.ort ? ` · ${gueltig.ort}` : ''}${gueltig.lokal ? ' · wird beim Speichern angelegt' : ''}` : 'Jede erfasste Karte wird ihm zugeordnet.'}
            </span>
          </span>
          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: TYP.bedien, fontWeight: 600, color: gueltig ? C.inkDim : C.aktiv, whiteSpace: 'nowrap' }}><ChevronRight size={18} /></span>
        </button>
        {gueltig && besuch && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => setFuerOffen(true)} className="fassbar" aria-label={`${fuerText} — ändern`}
              style={{ minHeight: 44, padding: '8px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, border: `1px solid ${TIEF.rand(fuer.art === 'kunde' ? LEUCHT.business : C.aktiv)}`, background: TIEF.flaeche(fuer.art === 'kunde' ? LEUCHT.business : C.aktiv), color: fuer.art === 'kunde' ? LEUCHT.business : C.ink }}>{fuerText} ▾</button>
            {!gueltig.lokal && <Link href={WEG.besuch(gueltig.eventId)} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 14, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)' }}>Event-Akte ›</Link>}
          </div>
        )}
        {gueltig && <AbendZaehler zahlen={zahlen} eventTitel={gueltig.titel} farbe={ton} />}
        {/* Fotos & Videos (09.10., Paket 5): ins Album dieses Events — das Album entsteht beim ersten Upload, auch ohne Netz aufgenommen. */}
        {gueltig && <MedienKnopf eventId={gueltig.eventId} titel={gueltig.titel} />}
      </Karte>
      {offen && <EventWahlFenster api={api} ich={ich} heute={heute} onZu={() => setOffen(false)} onWahl={w => { setWahl(w); setOffen(false); }} />}
      {fuerOffen && gueltig && <FuerFenster api={api} wahl={gueltig} fuer={fuer} firmen={firmen} onZu={() => setFuerOffen(false)} onGeaendert={f => { setWahl({ ...gueltig, fuer: f }); setFuerOffen(false); }} />}
    </>
  );
}

const KEINE_FIRMEN: Firma[] = [];

/**
 * „Für wen“ am gewählten Event ändern — schreibt nur dieses Feld (api.teil), das Event erbt es an jede Erfassung. Hängen schon erfasste Personen am
 * Event, fragt das Fenster vorher nach („n Personen hängen dann an …“). Wartende Erfassungen tragen das neue „für wen“ mit (`fuerUmschreiben`, H2).
 */
function FuerFenster({ api, wahl, fuer, firmen, onZu, onGeaendert }: { api: CrmApi; wahl: EventWahl; fuer: EventFuer; firmen: readonly Firma[]; onZu: () => void; onGeaendert: (f: EventFuer) => void }) {
  const [neu, setNeu] = useState<EventFuer>(fuer);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [frage, setFrage] = useState(false);
  const erfasst = (api.crm?.stand.teilnahmen ?? []).filter(t => t.eventId === wahl.eventId && t.netzwerken).length;
  const zielName = neu.art === 'kunde' ? firmen.find(f => f.id === neu.firmaId)?.name ?? 'diesen Kunden' : 'MAKE selbst';
  const geaendert = JSON.stringify(neu) !== JSON.stringify(fuer);
  const speichern = async (bestaetigt = false) => {
    if (!fuerGueltig(neu)) return;
    // Hängen schon erfasste Personen am Event, ist das mehr als ein Etikett (Export für Kunden, Auftragsverarbeitung): erst nachfragen.
    if (geaendert && erfasst > 0 && !bestaetigt) { setFrage(true); return; }
    setLaeuft(true); setFehler(null);
    try {
      // Noch lokal (ohne Netz angelegt): nur merken — `eventNeu` trägt es mit der ersten Erfassung zum Server.
      if (!wahl.lokal) {
        const r = await api.teil('events', wahl.eventId, { fuer: neu.art === 'kunde' ? neu : '' });
        if (r === false) { setFehler('Das „Für wen“ ließ sich nicht speichern — bitte noch einmal versuchen.'); setLaeuft(false); return; }
      }
      await geteilteWarteschlange().fuerUmschreiben(wahl.eventId, neu);
    } catch { setFehler('Das „Für wen“ ließ sich nicht speichern — bitte noch einmal versuchen.'); setLaeuft(false); return; }
    setLaeuft(false);
    onGeaendert(neu);
  };
  return (
    <Fenster titel="Für wen?" onZu={onZu} breit={560}>
      <div style={{ display: 'grid', gap: 12 }}>
        <FuerAuswahl firmen={firmen} wert={neu} onWahl={x => { setNeu(x); setFrage(false); }} />
        {frage && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{erfasst === 1 ? 'Eine erfasste Person hängt' : `${erfasst} erfasste Personen hängen`} dann an <b>{zielName}</b> — auch ihr Export „An Kunden übergeben“ ändert sich. Wirklich ändern?</Hinweis>}
        {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
        <Gross ton="haupt" onClick={() => void speichern(frage)} aus={laeuft || !fuerGueltig(neu)}>{laeuft ? 'speichert …' : frage ? 'Ja, ändern' : 'Übernehmen'}</Gross>
      </div>
    </Fenster>
  );
}

export function EventWahlFenster({ api, ich, heute, onZu, onWahl }: { api: CrmApi; ich: string | null; heute: string; onZu: () => void; onWahl: (w: EventWahl) => void }) {
  const events = api.crm?.stand.events ?? KEINE_EVENTS;
  const firmen = api.crm?.stand.firmen ?? KEINE_FIRMEN;
  const [suche, setSuche] = useState('');
  const [neu, setNeu] = useState(false);
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState(heute);
  const [ort, setOrt] = useState('');
  const [fuer, setFuer] = useState<EventFuer>({ art: 'make' });
  const [mehr, setMehr] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Aus dem Event-Kalender: heute · nahe Tage · der Rest (nur auf Wunsch oder bei einer Suche).
  const angebot = useMemo(() => heuteBeiAngebot(events, heute), [events, heute]);
  const q = suche.trim().toLowerCase();
  const passt = (e: Event) => !q || `${e.titel} ${e.ort ?? ''}`.toLowerCase().includes(q);
  const heuteListe = angebot.heute.filter(passt), nahListe = angebot.nah.filter(passt);
  const restListe = angebot.rest.filter(passt).slice(0, 40);
  const restZeigen = mehr || !!q;

  const waehlen = (e: Event) => onWahl({ eventId: e.id, titel: e.titel, datum: e.datum, ...(e.ort ? { ort: e.ort } : {}), tag: heute, ...(e.fuer?.art === 'kunde' ? { fuer: e.fuer } : {}) });

  // „Gibt es schon: …“ (M7): gleicher Name am gleichen Tag — nie ein zweites Event anlegen, das Doppelte zählt später in jeder Kennzahl.
  const dublette = useMemo(() => (neu ? gleichesBesuchEvent(events, titel, datum) : undefined), [neu, events, titel, datum]);
  const anlegen = async () => {
    const t = titel.trim();
    if (t.length < 2) { setFehler('Wie heißt das Event?'); return; }
    if (t.length > 160) { setFehler('Der Name ist zu lang (höchstens 160 Zeichen).'); return; }
    if (!istKalendertag(datum)) { setFehler('Bitte ein gültiges Datum wählen.'); return; }
    if (!eventDatumPlausibel(datum, heute)) { setFehler('Das Datum liegt mehr als ein Jahr entfernt — bitte prüfen.'); return; }
    if (!fuerGueltig(fuer)) { setFehler('Für welchen Kunden? Bitte eine Firma wählen — oder „MAKE selbst“.'); return; }
    setLaeuft(true); setFehler(null);
    const kunde = fuer.art === 'kunde' ? fuer : undefined;
    const e = neuesEvent({ id: neueId('ev'), titel: t, datum, ...(ort.trim() ? { ort: ort.trim().slice(0, 200) } : {}), person: ich ?? TEAM[0].id, heute, jetztIso: new Date().toISOString(),
      ...(kunde ? { fuer: kunde } : {}), ...(ich ? { wer: [ich] } : {}), anmeldung: datum <= heute ? 'besucht' : 'geplant' });
    let lokal = false;
    try {
      const r = await fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste: 'events', op: 'upsert', eintrag: e }] }) });
      const d = await r.json().catch(() => null);
      // Ohne Netz oder Serverfehler: lokal anlegen, der Server legt es mit der ersten Erfassung an. Eine fachliche Ablehnung (4xx) zeigen wir.
      if (r.ok && d?.ok) void api.laden(true);
      else if (r.status >= 500 || r.status === 0) lokal = true;
      else { setFehler(typeof d?.fehler === 'string' ? d.fehler : Array.isArray(d?.fehler) ? d.fehler.join(' · ') : 'Das Event ließ sich nicht anlegen.'); setLaeuft(false); return; }
    } catch { lokal = true; }
    onWahl({ eventId: e.id, titel: e.titel, datum: e.datum, ...(e.ort ? { ort: e.ort } : {}), tag: heute, ...(kunde ? { fuer: kunde } : {}), ...(lokal ? { lokal: true } : {}) });
  };

  const kundeVon = (e: Event): string | null => (e.fuer?.art === 'kunde' ? firmen.find(f => f.id === (e.fuer as { firmaId: string }).firmaId)?.name ?? 'Kunde' : null);
  const knopf = (e: Event) => (
    <button key={e.id} type="button" onClick={() => waehlen(e)} className="fassbar"
      style={{ minHeight: ZIEL + 8, textAlign: 'left', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, fontFamily: SCHRIFT.text }}>
      <span style={{ display: 'block', fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{titelMitReihe(e)}</span>
      <span style={{ display: 'block', fontSize: TYP.bedien, color: e.datum === heute ? LEUCHT.gut : C.inkLeise, marginTop: 2 }}>
        {e.datum === heute ? 'heute' : tagText(e.datum)}{e.ort ? ` · ${e.ort}` : ''}{!istBesuch(e) ? ` · ${markeVon(e)}` : kundeVon(e) ? ` · für ${kundeVon(e)}` : ''}
      </span>
    </button>
  );
  const gruppe = (titelText: string, liste: Event[]) => liste.length ? (
    <section key={titelText} aria-label={titelText} style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: C.inkLeise }}>{titelText}</div>
      {liste.map(knopf)}
    </section>
  ) : null;

  return (
    <Fenster titel={neu ? 'Neues Event' : 'Heute bei …'} onZu={onZu} breit={560}>
      {neu ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Feldzeile label="Name des Events"><input value={titel} onChange={x => setTitel(x.target.value)} placeholder="z. B. Unternehmer-Stammtisch Köln" autoFocus autoCapitalize="sentences" style={eingabe} aria-label="Name des Events" /></Feldzeile>
          <Feldzeile label="Datum"><input type="date" value={datum} onChange={x => setDatum(x.target.value)} style={eingabe} aria-label="Datum" /></Feldzeile>
          <Feldzeile label="Ort (optional)"><input value={ort} onChange={x => setOrt(x.target.value)} placeholder="z. B. Köln, Messehalle 3" style={eingabe} aria-label="Ort" /></Feldzeile>
          <Feldzeile label="Für wen"><FuerAuswahl firmen={firmen} wert={fuer} onWahl={setFuer} /></Feldzeile>
          {dublette && <Hinweis farbe={LEUCHT.achtung} rolle="status"><b>Gibt es schon:</b> {dublette.titel} · {tagText(dublette.datum)}{dublette.ort ? ` · ${dublette.ort}` : ''}<div style={{ marginTop: 10 }}><Gross ton="gut" onClick={() => waehlen(dublette)} kleinerAbstand>Dieses Event nehmen</Gross></div></Hinweis>}
          {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
          {!dublette && <Gross ton="haupt" onClick={() => void anlegen()} aus={laeuft}>{laeuft ? 'legt an …' : 'Event anlegen und starten'}</Gross>}
          <Gross onClick={() => { setNeu(false); setFehler(null); }} kleinerAbstand>Zurück zur Liste</Gross>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Gross ton="haupt" onClick={() => setNeu(true)}>+ Neues Event anlegen</Gross>
          <input value={suche} onChange={x => setSuche(x.target.value)} placeholder="Event suchen …" aria-label="Event suchen" style={eingabe} />
          {!api.crm && <Hinweis>Die Events werden geladen … Ohne Netz bitte ein neues Event anlegen — es wird beim Speichern mitgeschickt.</Hinweis>}
          <div style={{ display: 'grid', gap: 14 }}>
            {gruppe('Heute', heuteListe)}
            {gruppe('In den nächsten Tagen', nahListe)}
            {restZeigen && gruppe(q ? 'Weitere Treffer' : 'Weitere Events', restListe)}
            {!restZeigen && angebot.rest.length > 0 && <Gross onClick={() => setMehr(true)} kleinerAbstand>Weitere Events zeigen ({angebot.rest.length})</Gross>}
            {api.crm && !heuteListe.length && !nahListe.length && !restListe.length && <div style={{ fontSize: 14, color: C.inkLeise, padding: '6px 2px' }}>Kein Event gefunden — oben „Neues Event anlegen“.</div>}
          </div>
        </div>
      )}
    </Fenster>
  );
}
