'use client';

// ─── Markttraktion · Event — Stammtisch, Workshop, Dinner, Webinar ───────────────────
// Ein Event ist erfolgreich, wenn danach die richtigen Gespräche stattfinden.
// Deshalb: ein messbares Ziel, eine bewusste Gästeliste aus der Kartei
// (Mischung gegen das Soll), sechs Wochen Vorlauf als Checkliste, Zusage und
// Erscheinen getrennt, Nachfassen binnen 48 Stunden, Wirkung nach 30 und 90
// Tagen. Teilnahme ist keine Einwilligung — Einladungen per Mail nur mit
// Grundlage (die Ampel zeigt es je Gast).
// Aufbau: Head of Event oben, links die Events (kommend, vergangen), rechts
// das gewählte Event mit sieben Reitern (components/os/crm/events/*). Auf
// schmalen Bildschirmen klappt das Event unter seiner Zeile auf.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Spalten, Spalte, useBreit, LEUCHT } from '../schlank';
import { VORLAGEN, vorlageAnwenden, checklisteStand, type VorlageId } from '@/lib/crm/eventplanung';
import type { Event } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, plusTage } from './daten';
import { HeadPanel } from './HeadPanel';
import { EventDetail } from './events/EventDetail';
import { FORMATE, STATUS } from './events/gemeinsam';

export function Events({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  const breit = useBreit();
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const heute = crm.heute;
  const events = [...crm.stand.events].sort((a, b) => b.datum.localeCompare(a.datum));
  const kommend = events.filter(e => e.datum >= heute && e.status !== 'abgesagt').reverse();
  const vorbei = events.filter(e => e.datum < heute || e.status === 'abgesagt');
  const idsEvents = new Set(events.map(e => e.id));
  const nachfassen = crm.stand.teilnahmen.filter(t => t.status === 'da' && !t.followUpAm && idsEvents.has(t.eventId));
  // Auf breiten Bildschirmen steht immer ein Event rechts — ohne Wahl das nächste.
  const aktivId = auswahl && idsEvents.has(auswahl) ? auswahl : breit ? kommend[0]?.id ?? vorbei[0]?.id ?? null : null;
  const aktiv = aktivId ? events.find(e => e.id === aktivId) : undefined;

  const anlegen = (v: VorlageId | null) => {
    const vorlage = VORLAGEN.find(x => x.id === v);
    const basis: Event = { id: neueId('ev'), titel: vorlage?.label ?? 'Neues Event', format: 'sonstig', ziel: '', datum: plusTage(heute, 42), status: 'idee', geaendert: new Date().toISOString() };
    const e = vorlage ? vorlageAnwenden(basis, vorlage.id) : basis;
    void api.setze('events', e as unknown as { id: string } & Record<string, unknown>);
    setAuswahl(e.id); setNeu(false);
  };

  const zeile = (e: Event) => {
    const z = crm.events[e.id];
    const cl = checklisteStand(e, heute);
    const unter = [
      datum(e.datum, heute), e.uhrzeit, FORMATE.find(f => f.id === e.format)?.label,
      z && (z.zugesagt || z.da) ? (e.datum > heute ? `${z.zugesagt} zugesagt` : `${z.zugesagt} zugesagt · ${z.da} da`) : '',
      z?.nachfassenOffen ? `${z.nachfassenOffen} nachfassen` : '',
      e.datum >= heute && cl.ueberfaellig ? `${cl.ueberfaellig} ${cl.ueberfaellig === 1 ? 'Punkt' : 'Punkte'} überfällig` : '',
    ].filter(Boolean).join(' · ');
    const warnung = !!z?.nachfassenOffen || (e.datum >= heute && cl.ueberfaellig > 0);
    return (
      <div key={e.id}>
        <Zeile onClick={() => setAuswahl(breit ? e.id : aktivId === e.id ? null : e.id)} aktiv={aktivId === e.id}
          links={<Punkt farbe={e.status === 'durchgefuehrt' ? LEUCHT.gut : e.status === 'abgesagt' ? C.inkLeise : warnung ? LEUCHT.achtung : LEUCHT.beziehung} />}
          titel={e.titel} unter={unter}
          rechts={<Chip farbe={C.inkDim}>{STATUS.find(s => s.id === e.status)?.label}</Chip>} />
        {!breit && aktivId === e.id && <div style={{ padding: '12px 2px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><EventDetail key={e.id} e={e} api={api} zuKontakt={zuKontakt} /></div>}
      </div>
    );
  };

  const listen = (
    <>
      <Karte i={1}>
        <Ueberschrift rechts={<Knopf onClick={() => setNeu(!neu)}>{neu ? 'Abbrechen' : '+ Event'}</Knopf>}>Events</Ueberschrift>
        {neu && (
          <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Mit Vorlage starten: Ablauf, Checkliste mit sechs Wochen Vorlauf, Budgetposten und Soll-Mischung sind vorbereitet — das Ziel setzt du.</div>
            <Liste>
              {VORLAGEN.map(v => (
                <Zeile key={v.id} onClick={() => anlegen(v.id)} titel={v.label} unter={`${v.beschreibung} ${v.kapazitaet} Plätze · Soll ${v.mixZiel.zielkunden} % Zielkunden, ${v.mixZiel.kunden} % Kunden`}
                  rechts={<span style={{ fontSize: 12, color: C.aktiv, fontWeight: 600 }}>anlegen</span>} />
              ))}
              <Zeile onClick={() => anlegen(null)} titel="Ohne Vorlage" unter="Leeres Event — Format, Ablauf und Checkliste selbst aufbauen" rechts={<span style={{ fontSize: 12, color: C.aktiv, fontWeight: 600 }}>anlegen</span>} />
            </Liste>
          </div>
        )}
        {nachfassen.length > 0 && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginBottom: 8 }}>{nachfassen.length === 1 ? 'Ein Gast wartet' : `${nachfassen.length} Gäste warten`} auf dein Nachfassen — sie stehen auch in der Power Hour.</div>}
        <Liste>{kommend.map(zeile)}</Liste>
        {!kommend.length && !neu && <Leer>Kein Event geplant. Sechs Wochen Vorlauf: Ziel, Format, Gästemischung (mindestens 40 % Zielkunden, 20 % Kunden und Multiplikatoren).</Leer>}
      </Karte>
      {vorbei.length > 0 && <Karte i={2}><Ueberschrift>Vergangene Events</Ueberschrift><Liste>{vorbei.map(zeile)}</Liste></Karte>}
    </>
  );

  return (
    <>
      <HeadPanel head="event" standardModus={kommend.length ? 'planung' : 'wirkung'} zuKontakt={zuKontakt} i={0} />
      {breit ? (
        <Spalten verhaeltnis="1:2">
          <Spalte>{listen}</Spalte>
          <Spalte>
            <Karte i={2} akzent={aktiv ? LEUCHT.beziehung : undefined}>
              {aktiv ? <EventDetail key={aktiv.id} e={aktiv} api={api} zuKontakt={zuKontakt} /> : <Leer>Noch kein Event. „+ Event“ legt eins mit Vorlage an.</Leer>}
            </Karte>
          </Spalte>
        </Spalten>
      ) : listen}
    </>
  );
}
