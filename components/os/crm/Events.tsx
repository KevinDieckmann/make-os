'use client';

// ─── Markttraktion · Event — Stammtisch, Workshop, Dinner, Webinar ───────────────────
// Ein Event ist erfolgreich, wenn danach die richtigen Gespräche stattfinden.
// Deshalb: ein messbares Ziel, eine bewusste Gästeliste aus der Kartei
// (Mischung gegen das Soll), sechs Wochen Vorlauf als Checkliste, Zusage und
// Erscheinen getrennt, Nachfassen binnen 48 Stunden, Wirkung nach 30 und 90
// Tagen. Teilnahme ist keine Einwilligung — Einladungen per Mail nur mit
// Grundlage (die Ampel zeigt es je Gast).
// Zu zweit: Event verantwortet Malin, Kevin arbeitet mit. Je Event steht, wer
// zuständig ist (Plakette in der Liste, Filter „Alle · Meins · …“); je Punkt,
// wer ihn erledigt, und je Gast, wer einlädt und nachfasst.
// Aufbau: Head of Event oben, links die Events (kommend, vergangen), rechts
// das gewählte Event mit sieben Reitern (components/os/crm/events/*). Auf
// schmalen Bildschirmen klappt das Event unter seiner Zeile auf. Das gewählte
// Event steht in der Adresse (k=…) — Links aus Aufgaben führen direkt hin,
// und die/der andere sieht „ist gerade bei diesem Event“.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Spalten, Spalte, useBreit, LEUCHT } from '../schlank';
import { VORLAGEN, vorlageAnwenden, checklisteStand, einlader, type VorlageId } from '@/lib/crm/eventplanung';
import { TEAM, verantwortlich, zustaendig, anderer, nameVon } from '@/lib/crm/team';
import type { Event } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, plusTage } from './daten';
import { HeadPanel } from './HeadPanel';
import { Person, WerFilter, useWerFilter, passtWer } from './team';
import { EventDetail } from './events/EventDetail';
import { FORMATE, STATUS } from './events/gemeinsam';

export function Events({ api, zuKontakt, start, onAuswahl }: { api: CrmApi; zuKontakt: (id: string) => void; /** Event aus der Adresse (k=…) — zum Wiederfinden und für „Malin ist gerade hier“. */ start?: string; onAuswahl?: (id: string | null, wie?: 'push' | 'replace') => void }) {
  const breit = useBreit();
  const [lokal, setLokal] = useState<string | null>(start ?? null);
  // Mit onAuswahl steht die Auswahl im Link (k) — Zurück und Vor zeigen dann dasselbe Event.
  const auswahl = onAuswahl ? start ?? null : lokal;
  const [neu, setNeu] = useState(false);
  const [wahl, setWahl] = useWerFilter('event');
  const ich = api.ich;

  const crm = api.crm;
  const heute = crm?.heute ?? '';
  const events = useMemo(() => [...(crm?.stand.events ?? [])].sort((a, b) => b.datum.localeCompare(a.datum)), [crm?.stand.events]);
  const idsEvents = new Set(events.map(e => e.id));
  const kommendAlle = events.filter(e => e.datum >= heute && e.status !== 'abgesagt').reverse();
  const vorbeiAlle = events.filter(e => e.datum < heute || e.status === 'abgesagt');
  const passt = (e: Event) => passtWer(wahl, e.zustaendig, 'event', ich);
  const kommend = kommendAlle.filter(passt);
  const vorbei = vorbeiAlle.filter(passt);
  // Auf breiten Bildschirmen steht immer ein Event rechts — ohne Wahl das nächste.
  const aktivId = auswahl && idsEvents.has(auswahl) ? auswahl : breit ? kommend[0]?.id ?? kommendAlle[0]?.id ?? vorbei[0]?.id ?? vorbeiAlle[0]?.id ?? null : null;
  const aktiv = aktivId ? events.find(e => e.id === aktivId) : undefined;
  // Was rechts offen ist, steht auch in der Adresse (ersetzt, kein neuer Verlaufseintrag).
  useEffect(() => { if (aktivId && aktivId !== start) onAuswahl?.(aktivId, 'replace'); }, [aktivId, start, onAuswahl]);

  // Nachfassen über alle Events — je Person, die einlädt und nachfasst.
  const nachfassen = useMemo(() => {
    const r: Record<string, number> = {};
    if (!crm) return r;
    const nachId = new Map((api.kontakte ?? []).map(k => [k.id, k]));
    const eventVon = new Map(crm.stand.events.map(e => [e.id, e]));
    for (const t of crm.stand.teilnahmen) {
      const ev = t.status === 'da' && !t.followUpAm ? eventVon.get(t.eventId) : undefined;
      if (!ev) continue;
      const p = einlader(t, nachId.get(t.kontaktId), ev);
      r[p] = (r[p] ?? 0) + 1;
    }
    return r;
  }, [crm, api.kontakte]);

  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const waehle = (id: string | null) => { setLokal(id); onAuswahl?.(id, start && id ? 'replace' : id ? 'push' : 'replace'); };
  const andere = ich ? anderer(ich) : null;
  const zahlen: Record<string, number> = { alle: kommendAlle.length };
  if (ich) zahlen.ich = kommendAlle.filter(e => passtWer('ich', e.zustaendig, 'event', ich)).length;
  if (andere && andere !== ich) zahlen[andere] = kommendAlle.filter(e => passtWer(andere, e.zustaendig, 'event', ich)).length;
  const nachfassenText = TEAM.filter(m => nachfassen[m.id]).map(m => `${nachfassen[m.id]} bei ${m.id === ich ? 'dir' : m.name}`).join(' · ');

  const anlegen = (v: VorlageId | null) => {
    const vorlage = VORLAGEN.find(x => x.id === v);
    const basis: Event = { id: neueId('ev'), titel: vorlage?.label ?? 'Neues Event', format: 'sonstig', ziel: '', datum: plusTage(heute, 42), status: 'idee', geaendert: new Date().toISOString() };
    const e = vorlage ? vorlageAnwenden(basis, vorlage.id) : basis;
    void api.setze('events', e as unknown as { id: string } & Record<string, unknown>);
    waehle(e.id); setNeu(false);
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
    const wer = zustaendig(e.zustaendig, 'event');
    return (
      <div key={e.id}>
        <Zeile onClick={() => waehle(breit ? e.id : aktivId === e.id ? null : e.id)} aktiv={aktivId === e.id}
          links={<Punkt farbe={e.status === 'durchgefuehrt' ? LEUCHT.gut : e.status === 'abgesagt' ? C.inkLeise : warnung ? LEUCHT.achtung : LEUCHT.beziehung} />}
          titel={e.titel} unter={unter}
          rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }} title={`Zuständig: ${nameVon(wer)}`}><Person id={wer} groesse={20} /><Chip farbe={C.inkDim}>{STATUS.find(s => s.id === e.status)?.label}</Chip></span>} />
        {!breit && aktivId === e.id && <div style={{ padding: '12px 2px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><EventDetail key={e.id} e={e} api={api} zuKontakt={zuKontakt} /></div>}
      </div>
    );
  };

  const listen = (
    <>
      <Karte i={1}>
        <Ueberschrift rechts={<Knopf onClick={() => setNeu(!neu)}>{neu ? 'Abbrechen' : '+ Event'}</Knopf>}>Events</Ueberschrift>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkLeise }}>Verantwortung <Person id={verantwortlich('event')} name /></span>
          <span style={{ fontSize: 12, color: C.inkLeise }}>· beide sehen alles und arbeiten mit</span>
        </div>
        <div style={{ marginBottom: 8 }}><WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} /></div>
        {neu && (
          <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Mit Vorlage starten: Ablauf, Checkliste mit sechs Wochen Vorlauf, Budgetposten und Soll-Mischung sind vorbereitet — das Ziel setzt du. Zuständig ist erst einmal {nameVon(verantwortlich('event'))}; im Überblick des Events änderbar.</div>
            <Liste>
              {VORLAGEN.map(v => (
                <Zeile key={v.id} onClick={() => anlegen(v.id)} titel={v.label} unter={`${v.beschreibung} ${v.kapazitaet} Plätze · Soll ${v.mixZiel.zielkunden} % Zielkunden, ${v.mixZiel.kunden} % Kunden`}
                  rechts={<span style={{ fontSize: 12, color: C.aktiv, fontWeight: 600 }}>anlegen</span>} />
              ))}
              <Zeile onClick={() => anlegen(null)} titel="Ohne Vorlage" unter="Leeres Event — Format, Ablauf und Checkliste selbst aufbauen" rechts={<span style={{ fontSize: 12, color: C.aktiv, fontWeight: 600 }}>anlegen</span>} />
            </Liste>
          </div>
        )}
        {nachfassenText && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginBottom: 8 }}>Nachfassen offen: {nachfassenText} — binnen 48 Stunden, sie stehen auch in der Power Hour.</div>}
        <Liste>{kommend.map(zeile)}</Liste>
        {!kommend.length && !neu && (kommendAlle.length
          ? <Leer>Keine kommenden Events {wahl === 'ich' ? 'bei dir' : `bei ${nameVon(wahl)}`} — „Alle“ zeigt {kommendAlle.length === 1 ? 'eins' : kommendAlle.length}.</Leer>
          : <Leer>Kein Event geplant. Sechs Wochen Vorlauf: Ziel, Format, Gästemischung (mindestens 40 % Zielkunden, 20 % Kunden und Multiplikatoren).</Leer>)}
      </Karte>
      {vorbei.length > 0 && <Karte i={2}><Ueberschrift>Vergangene Events</Ueberschrift><Liste>{vorbei.map(zeile)}</Liste></Karte>}
    </>
  );

  return (
    <>
      <HeadPanel head="event" standardModus={kommendAlle.length ? 'planung' : 'wirkung'} zuKontakt={zuKontakt} i={0} />
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
