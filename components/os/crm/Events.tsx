'use client';

// ─── CRM · Events — Stammtisch, Workshop, Dinner ────────────────────────────
// Ein Event ist erfolgreich, wenn danach die richtigen Gespräche stattfinden.
// Deshalb: ein messbares Ziel, eine bewusste Gästeliste aus der Kartei,
// Zusage und Erscheinen getrennt, Nachfassen binnen 48 Stunden, Wirkung nach
// 30 und 90 Tagen. Teilnahme ist keine Einwilligung — Einladungen per Mail
// nur mit Grundlage (die Ampel zeigt es je Gast).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, LEUCHT } from '../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import { kanalStatus } from '@/lib/crm/recht';
import { followUpBis } from '@/lib/crm/events';
import type { Event, Teilnahme, TeilnahmeStatus } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, euro, plusTage } from './daten';
import { Feldzeile, Pillen, Feld, AMPEL_FARBE } from './teile';
import { HeadPanel } from './HeadPanel';

const FORMATE = [{ id: 'stammtisch', label: 'Stammtisch' }, { id: 'workshop', label: 'Workshop' }, { id: 'dinner', label: 'Dinner' }, { id: 'webinar', label: 'Webinar' }, { id: 'messe', label: 'Messe' }, { id: 'sonstig', label: 'Sonstiges' }] as const;
const STATUS = [{ id: 'idee', label: 'Idee' }, { id: 'geplant', label: 'Geplant' }, { id: 'einladung', label: 'Einladung läuft' }, { id: 'durchgefuehrt', label: 'Durchgeführt' }, { id: 'abgesagt', label: 'Abgesagt' }] as const;
const GAST: { id: TeilnahmeStatus; label: string }[] = [{ id: 'vorgemerkt', label: 'vorgemerkt' }, { id: 'eingeladen', label: 'eingeladen' }, { id: 'zugesagt', label: 'zugesagt' }, { id: 'abgesagt', label: 'abgesagt' }, { id: 'da', label: 'war da' }, { id: 'no_show', label: 'nicht gekommen' }];

export function Events({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const events = [...crm.stand.events].sort((a, b) => b.datum.localeCompare(a.datum));
  const kommend = events.filter(e => e.datum >= crm.heute && e.status !== 'abgesagt').reverse();
  const vorbei = events.filter(e => e.datum < crm.heute || e.status === 'abgesagt');
  const nachfassen = crm.stand.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm);

  const zeile = (e: Event) => {
    const z = crm.events[e.id];
    return (
      <div key={e.id}>
        <Zeile onClick={() => setAuswahl(auswahl === e.id ? null : e.id)} aktiv={auswahl === e.id}
          links={<Punkt farbe={e.status === 'durchgefuehrt' ? LEUCHT.gut : e.status === 'abgesagt' ? C.inkLeise : LEUCHT.beziehung} />}
          titel={e.titel} unter={[datum(e.datum, crm.heute), FORMATE.find(f => f.id === e.format)?.label, z ? `${z.zugesagt} zugesagt · ${z.da} da` : '', z?.nachfassenOffen ? `${z.nachfassenOffen} nachfassen` : ''].filter(Boolean).join(' · ')}
          rechts={<Chip farbe={C.inkDim}>{STATUS.find(s => s.id === e.status)?.label}</Chip>} />
        {auswahl === e.id && <EventDetail e={e} api={api} zuKontakt={zuKontakt} />}
      </div>
    );
  };

  return (
    <>
      <HeadPanel head="event" standardModus={kommend.length ? 'planung' : 'wirkung'} zuKontakt={zuKontakt} i={0} />
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={() => { const id = neueId('ev'); void api.setze('events', { id, titel: 'Neues Event', format: 'stammtisch', ziel: '', datum: plusTage(crm.heute, 42), status: 'idee' }); setAuswahl(id); }}>+ Event</Knopf>}>Events</Ueberschrift>
        {nachfassen.length > 0 && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginBottom: 8 }}>{nachfassen.length} Gäste warten auf dein Nachfassen — sie stehen auch in der Power Hour.</div>}
        <Liste>{kommend.map(zeile)}</Liste>
        {!kommend.length && <Leer>Kein Event geplant. Sechs Wochen Vorlauf: Ziel, Format, Gästemischung (mindestens 40 % Zielkunden, 20 % Kunden und Multiplikatoren).</Leer>}
      </Karte>
      {vorbei.length > 0 && <Karte i={1}><Ueberschrift>Vergangene Events</Ueberschrift><Liste>{vorbei.map(zeile)}</Liste></Karte>}
    </>
  );
}

function EventDetail({ e, api, zuKontakt }: { e: Event; api: CrmApi; zuKontakt: (id: string) => void }) {
  const crm = api.crm!;
  const [suche, setSuche] = useState('');
  const z = crm.events[e.id];
  const gaeste = crm.stand.teilnahmen.filter(t => t.eventId === e.id);
  const kontakte = api.kontakte ?? [];
  const setze = (teil: Partial<Event>) => api.setze('events', { ...e, ...teil } as unknown as { id: string } & Record<string, unknown>);
  const gast = (t: Teilnahme, teil: Partial<Teilnahme>) => api.setze('teilnahmen', { ...t, ...teil } as unknown as { id: string } & Record<string, unknown>);
  const treffer = suche.trim().length >= 2 ? kontakte.filter(k => !gaeste.some(g => g.kontaktId === k.id) && !k.werbesperre && `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];
  const vorbei = e.datum < crm.heute;
  const bis = followUpBis(e);
  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      {z && (
        <Raster min={120}>
          <Zahl wert={String(z.eingeladen)} label="eingeladen" /><Zahl wert={String(z.zugesagt)} label="zugesagt" /><Zahl wert={String(z.da)} label="da" farbe={LEUCHT.gut} />
          <Zahl wert={z.erscheinquote !== null ? `${z.erscheinquote} %` : `${z.da}/${z.zugesagt}`} label="erschienen" />
          <Zahl wert={String(z.folgegespraeche)} label="Folgegespräche (30 T)" farbe={z.folgegespraeche >= 3 ? LEUCHT.gut : undefined} />
          <Zahl wert={euro(z.beeinflusst)} label="beeinflusste Pipeline" />
          {z.kostenJeFolgegespraech !== null && <Zahl wert={euro(z.kostenJeFolgegespraech)} label="Kosten je Folgegespräch" />}
        </Raster>
      )}
      <Feldzeile label="Titel"><Feld wert={e.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
      <Feldzeile label="Ziel"><Feld wert={e.ziel} platzhalter="Messbar: „drei Folgegespräche mit Inhabern aus …“" onFertig={ziel => setze({ ziel })} /></Feldzeile>
      <Feldzeile label="Format"><Pillen liste={[...FORMATE]} aktiv={e.format} onWahl={format => setze({ format })} /></Feldzeile>
      <Feldzeile label="Status"><Pillen liste={[...STATUS]} aktiv={e.status} onWahl={status => setze({ status })} /></Feldzeile>
      <Feldzeile label="Wann & wo">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Feld typ="date" wert={e.datum} breite={150} platzhalter="Datum" onFertig={d2 => d2 && setze({ datum: d2 })} />
          <Feld typ="time" wert={e.uhrzeit} breite={110} platzhalter="Uhrzeit" onFertig={uhrzeit => setze({ uhrzeit: uhrzeit || undefined })} />
          <div style={{ flex: 1, minWidth: 160 }}><Feld wert={e.ort} platzhalter="Ort" onFertig={ort => setze({ ort: ort || undefined })} /></div>
        </div>
      </Feldzeile>
      <Feldzeile label="Rahmen">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Feld typ="number" wert={e.kapazitaet ? String(e.kapazitaet) : ''} breite={110} platzhalter="Plätze" onFertig={k => setze({ kapazitaet: Number(k) || undefined })} />
          <Feld typ="number" wert={e.kostenEuro ? String(e.kostenEuro) : ''} breite={130} platzhalter="Kosten €" onFertig={k => setze({ kostenEuro: Number(k) || undefined })} />
          <div style={{ flex: 1, minWidth: 160 }}><Feld wert={e.coHost} platzhalter="Co-Host" onFertig={coHost => setze({ coHost: coHost || undefined })} /></div>
        </div>
      </Feldzeile>
      <div>
        <Ueberschrift rechts={vorbei ? `nachfassen bis ${datum(bis)}` : `${gaeste.length}${e.kapazitaet ? ` / ${e.kapazitaet}` : ''} Gäste`}>Gäste</Ueberschrift>
        <Liste>
          {gaeste.map(t => {
            const k = kontakte.find(x => x.id === t.kontaktId);
            if (!k) return null;
            const einl = kanalStatus(k, 'einladung');
            return (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => zuKontakt(k.id)} style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.body, fontWeight: 500, padding: 0 }}>{anzeigename(k)}</button>
                  <span style={{ fontSize: 12.5, color: C.inkLeise }}>{k.firma}</span>
                  <span title={einl.grund} style={{ fontSize: 11.5, color: AMPEL_FARBE[einl.farbe] }}>● Einladung per Mail: {einl.farbe === 'gruen' ? 'ok' : einl.farbe === 'gelb' ? 'nur persönlich' : 'persönlich einladen'}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {t.status === 'da' && !t.followUpAm && <Knopf leise onClick={() => { void gast(t, { followUpAm: crm.heute }); void api.aktivitaet({ id: k.id, art: 'event', text: `Nachgefasst nach „${e.titel}“`, bezug: e.id }); }}>Nachgefasst</Knopf>}
                    {t.followUpAm && <Chip farbe={LEUCHT.gut}>nachgefasst {datum(t.followUpAm)}</Chip>}
                    <button onClick={() => api.weg('teilnahmen', t.id)} aria-label="Gast entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button>
                  </span>
                </div>
                <Pillen liste={GAST} aktiv={t.status} onWahl={status => gast(t, { status })} farbe={LEUCHT.beziehung} />
                <Feld wert={t.notiz} platzhalter="Notiz vom Abend (für das Nachfassen)" onFertig={notiz => gast(t, { notiz: notiz || undefined })} />
              </div>
            );
          })}
        </Liste>
        <input value={suche} onChange={x => setSuche(x.target.value)} placeholder="Gast aus der Kartei hinzufügen …" aria-label="Gast hinzufügen" style={{ marginTop: 8, width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 11px', color: C.ink, fontSize: TYP.bedien }} />
        {treffer.map(k => <button key={k.id} onClick={() => { void api.setze('teilnahmen', { id: neueId('t'), eventId: e.id, kontaktId: k.id, status: 'vorgemerkt' }); setSuche(''); }} style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 12.5, padding: '4px 0' }}>+ {anzeigename(k)}{k.firma ? ` · ${k.firma}` : ''}{k.kreis ? ` · Kreis ${k.kreis}` : ''}</button>)}
      </div>
      <Feldzeile label="Notiz"><Feld wert={e.notiz} onFertig={notiz => setze({ notiz: notiz || undefined })} /></Feldzeile>
      <div><button onClick={() => { if (window.confirm('Event löschen?')) void api.weg('events', e.id); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Löschen</button></div>
    </div>
  );
}
