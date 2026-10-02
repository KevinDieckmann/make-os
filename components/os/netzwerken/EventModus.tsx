'use client';

// ─── Netzwerken — Event-Modus „Heute bei: …“ (02.10.) ────────────────────────
// Ganz oben auf der Seite: bei welcher Veranstaltung bin ich heute? Ein vorhandenes CRM-Event wählen oder in drei Feldern
// ein neues anlegen (Name, Datum heute, Ort optional) — über den vorhandenen Event-Schreibweg (PATCH /api/crm/bestand,
// Liste „events“). Gemerkt wird die Wahl für den Tag (localStorage — nur Komfort). Ohne Netz entsteht das Event lokal und
// wird mit der ersten Erfassung mitgeschickt (`eventNeu`, der Server legt es dann an).

import { useMemo, useState } from 'react';
import { CalendarPlus, ChevronRight } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, TIEF } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { neueId } from '../crm/daten';
import type { CrmApi } from '../crm/daten';
import type { Event } from '@/lib/crm/typen';

const KEINE_EVENTS: Event[] = [];
import { neuesEvent } from '@/lib/crm/netzwerken';
import { Gross, Hinweis, eingabe, Feldzeile, tagText, ZIEL } from './bausteine';
import { AbendZaehler, abendZahlen } from './zaehler';

/** Die gemerkte Wahl: das Event und der Tag, für den sie gilt. */
export interface EventWahl { eventId: string; titel: string; datum: string; ort?: string; /** Noch nicht auf dem Server (ohne Netz angelegt). */ lokal?: boolean; tag: string }

/** Wie weit ein Event vom Tag entfernt ist — heutige zuerst, dann nah dran, dann der Rest. */
function abstandTage(datum: string, heute: string): number { return Math.abs(Math.round((Date.parse(`${datum}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5)); }

export function EventModus({ api, ich, heute, wahl, setWahl }: { api: CrmApi; ich: string | null; heute: string; wahl: EventWahl | null; setWahl: (w: EventWahl | null) => void }) {
  const [offen, setOffen] = useState(false);
  const gueltig = wahl && wahl.tag === heute ? wahl : null;
  // Highlight b: die Zahlen des Abends — aus den Teilnahmen des Events, null solange die Kartei lädt (der Platz bleibt reserviert).
  const teilnahmen = api.crm?.stand.teilnahmen;
  const zahlen = useMemo(() => (gueltig && teilnahmen ? abendZahlen(teilnahmen, gueltig.eventId) : null), [gueltig, teilnahmen]);
  const ton = LEUCHT.beziehung;
  return (
    <>
      <div style={{ borderRadius: 20, padding: gueltig ? '14px 16px 14px' : 0, display: 'grid', gap: 12, boxSizing: 'border-box',
        border: `1px solid ${gueltig ? TIEF.rand(ton) : 'rgba(255,255,255,.14)'}`,
        background: gueltig ? `linear-gradient(150deg, ${ton}26 0%, ${ton}0D 46%, rgba(255,255,255,.02) 100%)` : 'rgba(255,255,255,.04)',
        boxShadow: gueltig ? `inset 0 1px 0 rgba(255,255,255,.07), 0 16px 36px -22px ${ton}` : 'none' }}>
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
        {gueltig && <AbendZaehler zahlen={zahlen} eventTitel={gueltig.titel} farbe={ton} />}
      </div>
      {offen && <EventWahlFenster api={api} ich={ich} heute={heute} onZu={() => setOffen(false)} onWahl={w => { setWahl(w); setOffen(false); }} />}
    </>
  );
}

function EventWahlFenster({ api, ich, heute, onZu, onWahl }: { api: CrmApi; ich: string | null; heute: string; onZu: () => void; onWahl: (w: EventWahl) => void }) {
  const events = api.crm?.stand.events ?? KEINE_EVENTS;
  const [suche, setSuche] = useState('');
  const [neu, setNeu] = useState(false);
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState(heute);
  const [ort, setOrt] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return events.filter(e => e.status !== 'abgesagt' && (!q || `${e.titel} ${e.ort ?? ''}`.toLowerCase().includes(q)))
      .sort((a, b) => abstandTage(a.datum, heute) - abstandTage(b.datum, heute) || a.titel.localeCompare(b.titel, 'de')).slice(0, 40);
  }, [events, suche, heute]);

  const waehlen = (e: Event) => onWahl({ eventId: e.id, titel: e.titel, datum: e.datum, ...(e.ort ? { ort: e.ort } : {}), tag: heute });

  const anlegen = async () => {
    const t = titel.trim();
    if (t.length < 2) { setFehler('Wie heißt das Event?'); return; }
    if (t.length > 160) { setFehler('Der Name ist zu lang (höchstens 160 Zeichen).'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) { setFehler('Bitte ein Datum wählen.'); return; }
    setLaeuft(true); setFehler(null);
    const e = neuesEvent({ id: neueId('ev'), titel: t, datum, ...(ort.trim() ? { ort: ort.trim().slice(0, 200) } : {}), person: ich ?? 'kevin', heute, jetztIso: new Date().toISOString() });
    let lokal = false;
    try {
      const r = await fetch('/api/crm/bestand', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste: 'events', op: 'upsert', eintrag: e }] }) });
      const d = await r.json().catch(() => null);
      // Ohne Netz oder Serverfehler: lokal anlegen, der Server legt es mit der ersten Erfassung an. Eine fachliche Ablehnung (4xx) zeigen wir.
      if (r.ok && d?.ok) void api.laden(true);
      else if (r.status >= 500 || r.status === 0) lokal = true;
      else { setFehler(typeof d?.fehler === 'string' ? d.fehler : Array.isArray(d?.fehler) ? d.fehler.join(' · ') : 'Das Event ließ sich nicht anlegen.'); setLaeuft(false); return; }
    } catch { lokal = true; }
    onWahl({ eventId: e.id, titel: e.titel, datum: e.datum, ...(e.ort ? { ort: e.ort } : {}), tag: heute, ...(lokal ? { lokal: true } : {}) });
  };

  return (
    <Fenster titel={neu ? 'Neues Event' : 'Heute bei …'} onZu={onZu} breit={560}>
      {neu ? (
        <div style={{ display: 'grid', gap: 12 }}>
          <Feldzeile label="Name des Events"><input value={titel} onChange={x => setTitel(x.target.value)} placeholder="z. B. Unternehmer-Stammtisch Köln" autoFocus autoCapitalize="sentences" style={eingabe} aria-label="Name des Events" /></Feldzeile>
          <Feldzeile label="Datum"><input type="date" value={datum} onChange={x => setDatum(x.target.value)} style={eingabe} aria-label="Datum" /></Feldzeile>
          <Feldzeile label="Ort (optional)"><input value={ort} onChange={x => setOrt(x.target.value)} placeholder="z. B. Köln, Messehalle 3" style={eingabe} aria-label="Ort" /></Feldzeile>
          {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
          <Gross ton="haupt" onClick={() => void anlegen()} aus={laeuft}>{laeuft ? 'legt an …' : 'Event anlegen und starten'}</Gross>
          <Gross onClick={() => { setNeu(false); setFehler(null); }} kleinerAbstand>Zurück zur Liste</Gross>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <Gross ton="haupt" onClick={() => setNeu(true)}>+ Neues Event anlegen</Gross>
          <input value={suche} onChange={x => setSuche(x.target.value)} placeholder="Vorhandenes Event suchen …" aria-label="Event suchen" style={eingabe} />
          {!api.crm && <Hinweis>Die Events werden geladen … Ohne Netz bitte ein neues Event anlegen — es wird beim Speichern mitgeschickt.</Hinweis>}
          <div style={{ display: 'grid', gap: 8 }}>
            {liste.map(e => (
              <button key={e.id} type="button" onClick={() => waehlen(e)} className="fassbar"
                style={{ minHeight: ZIEL + 8, textAlign: 'left', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, fontFamily: SCHRIFT.text }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{e.titel}</span>
                <span style={{ display: 'block', fontSize: TYP.bedien, color: e.datum === heute ? LEUCHT.gut : C.inkLeise, marginTop: 2 }}>{e.datum === heute ? 'heute' : tagText(e.datum)}{e.ort ? ` · ${e.ort}` : ''}</span>
              </button>
            ))}
            {api.crm && !liste.length && <div style={{ fontSize: 14, color: C.inkLeise, padding: '6px 2px' }}>Kein Event gefunden — oben „Neues Event anlegen“.</div>}
          </div>
        </div>
      )}
    </Fenster>
  );
}
