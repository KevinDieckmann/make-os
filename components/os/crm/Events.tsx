'use client';

// ─── Markttraktion · Make.One — unsere EIGENEN Abende: Stammtisch, Workshop, Dinner, Webinar ──────
// Seit 03.10. (Kevin: „Einmal wirklich Make.One und daneben das ganze Thema Events“) steht hier nur noch, was wir selbst
// veranstalten. Veranstaltungen, die wir BESUCHEN (fremde Events, Messen, Kunden-Events; `marke: Netzwerken`), liegen im
// Reiter „Events“ (components/os/crm/besuche) — `istNetzwerkenEvent` filtert sie hier heraus (Liste, Nachfassen, Wirkung).
// Ein Event ist erfolgreich, wenn danach die richtigen Gespräche stattfinden.
// Deshalb: ein messbares Ziel, eine bewusste Gästeliste aus der Kartei
// (Mischung gegen das Soll), sechs Wochen Vorlauf als Checkliste, Zusage und
// Erscheinen getrennt, Nachfassen binnen 48 Stunden, Wirkung nach 30 und 90
// Tagen. Teilnahme ist keine Einwilligung — Einladungen per Mail nur mit
// Grundlage (die Ampel zeigt es je Gast).
// Zu zweit: Event verantwortet Malin, Kevin arbeitet mit. Je Event steht, wer
// zuständig ist (Plakette in der Liste, Filter „Alle · Meins · …“); je Punkt,
// wer ihn erledigt, und je Gast, wer einlädt und nachfasst.
// Marke (Kevin 27.09.): unter den Events heißt unsere Marke Make.One — der
// Kopf sagt es, neue Events tragen sie als Vorgabe (änderbar), alte gelten
// abgeleitet als Make.One (lib/crm/marke.ts). Kein Logo, keine Homepage.
// Aufbau (Fläche, 27.09.): Head of Event, links die Events (kommend), rechts
// das gewählte Event mit sieben Reitern (components/os/crm/events/*), dazu
// „Nachfassen offen“ über alle Events, die Wirkung der vergangenen Events und
// die vergangenen Events — je Person anordnen, ausblenden, Widgets dazulegen
// (Standard in lib/crm/flaechen.ts KACHELN.event). Auf schmalen Bildschirmen
// klappt das Event unter seiner Zeile auf. Das gewählte Event steht in der
// Adresse (k=…) — Links aus Aufgaben führen direkt hin, und die/der andere
// sieht „ist gerade bei diesem Event“.
// Reihen (03.10., Kevin: „Fokus Innovation = Event-Reihe unter Make.One“): ein Event kann in einer Reihe laufen
// (`Event.reihe`, Werteliste in lib/crm/marke.ts). Liste und Akte tragen dann ein ruhiges Abzeichen, über der Liste steht
// ein Filter je Reihe, die Kachel „Reihen“ zeigt Events, Gäste, Zusagen, Nachgefasst, Leads und Deals je Reihe
// (lib/crm/reihen.ts — summiert dieselben Zahlen je Event wie die Wirkung, keine zweite Rechnung).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, Pillen, useBreit, LEUCHT } from '../ui';
import { VORLAGEN, vorlageAnwenden, checklisteStand, einlader, type VorlageId } from '@/lib/crm/eventplanung';
import { MARKE_EVENTS, nachfassenRest } from '@/lib/crm/events';
import { istNetzwerkenEvent, OHNE_REIHE, reiheName, eventTitelVorschlag } from '@/lib/crm/marke';
import { reihenFilter, passtReihe, reihenUebersicht, zahlenSumme } from '@/lib/crm/reihen';
import { TEAM, verantwortlich, zustaendig, anderer, nameVon } from '@/lib/crm/team';
import { anzeigename } from '@/lib/make-one/crm';
import { WEG } from '@/lib/wege';
import type { Event } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, euro, plusTage } from './daten';
import { HeadPanel } from './HeadPanel';
import { Person, WerFilter, useWerFilter, passtWer } from './team';
import { EventDetail } from './events/EventDetail';
import { Start } from './events/Start';
import { FORMATE, STATUS, ReiheAbzeichen, ReiheWahl } from './events/gemeinsam';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { FLAECHE, kachel, standardVon } from '@/lib/crm/flaechen';

const K = (id: string) => kachel('event', id);
const stunden = (h: number) => (h >= 48 ? `noch ${Math.floor(h / 24)} Tage` : h >= 0 ? `noch ${h} Std.` : h > -48 ? `seit ${-h} Std. vorbei` : `seit ${Math.floor(-h / 24)} Tagen vorbei`);
const fristFarbe = (h: number) => (h > 24 ? LEUCHT.gut : h >= 0 ? LEUCHT.achtung : LEUCHT.kritisch);

/** Kopf des Reiters: die Marke und ein Weg zu den Events, die wir besuchen. */
function Kopf() {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{MARKE_EVENTS}</span>
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Unsere Veranstaltungsmarke — hier laufen unsere eigenen Abende.</span>
      <Link href={WEG.besuch()} style={{ fontSize: TYP.bedien, color: C.aktiv, textDecoration: 'none', fontWeight: 600 }}>Veranstaltungen, die wir besuchen: Events ›</Link>
    </div>
  );
}

export function Events({ api, zuKontakt, start, onAuswahl }: { api: CrmApi; zuKontakt: (id: string) => void; /** Event aus der Adresse (k=…) — zum Wiederfinden und für „Malin ist gerade hier“. */ start?: string; onAuswahl?: (id: string | null, wie?: 'push' | 'replace') => void }) {
  const breit = useBreit();
  const router = useRouter();
  const [lokal, setLokal] = useState<string | null>(start ?? null);
  // Mit onAuswahl steht die Auswahl im Link (k) — Zurück und Vor zeigen dann dasselbe Event.
  const auswahl = onAuswahl ? start ?? null : lokal;
  const [neu, setNeu] = useState(false);
  const [wahl, setWahl] = useWerFilter('event');
  // Filter je Reihe (null = alle) und die Reihe, mit der „+ Event“ anlegt (Vorgabe: die gefilterte).
  const [reiheWahl, setReiheWahl] = useState<string | null>(null);
  const [neuReihe, setNeuReihe] = useState<string | undefined>(undefined);
  const [jetzt] = useState(() => Date.now());
  const ich = api.ich;

  const crm = api.crm;
  const heute = crm?.heute ?? '';
  // Nur unsere eigenen Abende — besuchte Events (Netzwerken) stehen im Reiter „Events“.
  const events = useMemo(() => (crm?.stand.events ?? []).filter(e => !istNetzwerkenEvent(e)).sort((a, b) => b.datum.localeCompare(a.datum)), [crm?.stand.events]);
  const idsEvents = new Set(events.map(e => e.id));
  const reihenPillen = useMemo(() => reihenFilter(events), [events]);
  // Eine Reihe, die es (nach Löschen/Umstellen) nicht mehr gibt, filtert nicht weiter — sonst stünde die Liste grundlos leer.
  const reiheAktiv = reiheWahl !== null && reihenPillen.some(r => r.id === reiheWahl) ? reiheWahl : null;
  const imFilter = events.filter(e => passtReihe(e, reiheAktiv));
  const kommendAlle = imFilter.filter(e => e.datum >= heute && e.status !== 'abgesagt').reverse();
  const vorbeiAlle = imFilter.filter(e => e.datum < heute || e.status === 'abgesagt');
  const passt = (e: Event) => passtWer(wahl, e.zustaendig, 'event', ich);
  const kommend = kommendAlle.filter(passt);
  const vorbei = vorbeiAlle.filter(passt);
  // Auf breiten Bildschirmen steht immer ein Event rechts — ohne Wahl das nächste.
  const aktivId = auswahl && idsEvents.has(auswahl) ? auswahl : breit ? kommend[0]?.id ?? kommendAlle[0]?.id ?? vorbei[0]?.id ?? vorbeiAlle[0]?.id ?? null : null;
  const aktiv = aktivId ? events.find(e => e.id === aktivId) : undefined;
  // Was rechts offen ist, steht auch in der Adresse (ersetzt, kein neuer Verlaufseintrag).
  useEffect(() => { if (aktivId && aktivId !== start) onAuswahl?.(aktivId, 'replace'); }, [aktivId, start, onAuswahl]);

  // Nachfassen über alle Events — je Person, die einlädt und nachfasst, und als Liste für die Kachel (Event vorbei, war da, noch offen).
  const { nachfassen, offenListe } = useMemo(() => {
    const r: Record<string, number> = {};
    const liste: { t: { id: string; kontaktId: string }; e: Event; name: string; firma?: string }[] = [];
    if (!crm) return { nachfassen: r, offenListe: liste };
    const nachId = new Map((api.kontakte ?? []).map(k => [k.id, k]));
    const eventVon = new Map(events.map(e => [e.id, e]));
    for (const t of crm.stand.teilnahmen) {
      const ev = t.status === 'da' && !t.followUpAm ? eventVon.get(t.eventId) : undefined;
      if (!ev) continue;
      const k = nachId.get(t.kontaktId);
      const p = einlader(t, k, ev);
      r[p] = (r[p] ?? 0) + 1;
      if (k && !t.nachfassenVerzichtet && ev.datum <= heute) liste.push({ t, e: ev, name: anzeigename(k), firma: k.firma });
    }
    liste.sort((a, b) => b.e.datum.localeCompare(a.e.datum));
    return { nachfassen: r, offenListe: liste };
  }, [crm, events, api.kontakte, heute]);

  // Wirkung der vergangenen Events (nicht abgesagt) — aus den Zahlen des Servers (crm.events), keine zweite Rechnung.
  const wirkung = useMemo(() => {
    if (!crm) return null;
    const gewesen = events.filter(e => e.datum < heute && e.status !== 'abgesagt');
    const s = zahlenSumme(gewesen.map(e => crm.events[e.id]));
    return { events: gewesen.length, da: s.da, folge: s.folgegespraeche, beeinflusst: s.beeinflusst, verursacht: s.verursacht, kosten: s.kosten, jeGespraech: s.kosten && s.folgegespraeche ? Math.round(s.kosten / s.folgegespraeche) : null, nachfassenOffen: s.nachfassenOffen };
  }, [crm, events, heute]);
  // Je Reihe (Fokus Innovation …): dieselben Zahlen je Event, nur anders gruppiert.
  const reihen = useMemo(() => (crm ? reihenUebersicht(events, crm.events, crm.stand.teilnahmen, heute) : []), [crm, events, heute]);

  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const waehle = (id: string | null) => { setLokal(id); onAuswahl?.(id, start && id ? 'replace' : id ? 'push' : 'replace'); };

  // Start ohne Daten (E8): kein Event → statt der leeren Liste der geführte Start; der Head of Event bleibt oben.
  if (!events.length) {
    return (
      <>
        <Kopf />
        <HeadPanel head="event" standardModus="wirkung" zuKontakt={zuKontakt} i={0} />
        <Karte i={1} akzent={LEUCHT.beziehung}><Start api={api} onFertig={id => waehle(id)} /></Karte>
      </>
    );
  }
  const andere = ich ? anderer(ich) : null;
  const zahlen: Record<string, number> = { alle: kommendAlle.length };
  if (ich) zahlen.ich = kommendAlle.filter(e => passtWer('ich', e.zustaendig, 'event', ich)).length;
  if (andere && andere !== ich) zahlen[andere] = kommendAlle.filter(e => passtWer(andere, e.zustaendig, 'event', ich)).length;
  const nachfassenText = TEAM.filter(m => nachfassen[m.id]).map(m => `${nachfassen[m.id]} bei ${m.id === ich ? 'dir' : m.name}`).join(' · ');

  const anlegen = (v: VorlageId | null) => {
    const vorlage = VORLAGEN.find(x => x.id === v);
    // Neue Events tragen die Marke als Vorgabe (27.09.) — im Überblick des Events änderbar.
    // Reihe (03.10.): gewählt im Anlegen, sonst die gefilterte — nie still eine Reihe, die niemand gesehen hat.
    const reihe = neuReihe ?? (reiheAktiv && reiheAktiv !== OHNE_REIHE ? reiheAktiv : undefined);
    const basis: Event = { id: neueId('ev'), titel: eventTitelVorschlag(reihe, vorlage?.label), format: 'sonstig', ziel: '', datum: plusTage(heute, 42), status: 'idee', marke: MARKE_EVENTS, ...(reihe ? { reihe } : {}), geaendert: new Date().toISOString() };
    const e = vorlage ? vorlageAnwenden(basis, vorlage.id) : basis;
    void api.setze('events', e as unknown as { id: string } & Record<string, unknown>);
    waehle(e.id); setNeu(false); setNeuReihe(undefined);
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
          titel={reiheAktiv && reiheAktiv !== OHNE_REIHE ? e.titel : <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}><span>{e.titel}</span><ReiheAbzeichen e={e} /></span>} unter={unter}
          rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }} title={`Zuständig: ${nameVon(wer)}`}><Person id={wer} groesse={20} /><Chip farbe={C.inkDim}>{STATUS.find(s => s.id === e.status)?.label}</Chip></span>} />
        {!breit && aktivId === e.id && <div style={{ padding: '12px 2px 20px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><EventDetail key={e.id} e={e} api={api} zuKontakt={zuKontakt} /></div>}
      </div>
    );
  };

  return (
    <>
      <Kopf />
      <Flaeche seite={FLAECHE.event} standard={standardVon('event')}>
        <Kachel {...K('head')}>
          <HeadPanel head="event" standardModus={kommendAlle.length ? 'planung' : 'wirkung'} zuKontakt={zuKontakt} i={0} />
        </Kachel>

        <Kachel {...K('events')}>
          <Karte i={1}>
            <Ueberschrift rechts={<Knopf haupt onClick={() => setNeu(!neu)}>{neu ? 'Abbrechen' : '+ Event'}</Knopf>}>Events</Ueberschrift>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.inkLeise }}>Verantwortung <Person id={verantwortlich('event')} name /></span>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>beide sehen alles und arbeiten mit</span>
            </div>
            <div style={{ marginBottom: 8 }}><WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} /></div>
            {reihenPillen.length > 0 && (
              <div style={{ marginBottom: 8 }} role="group" aria-label="Reihe">
                <Pillen einzeilig liste={[{ id: 'alle', label: `Alle ${events.length}` }, ...reihenPillen.map(r => ({ id: r.id, label: `${r.label} ${r.anzahl}` }))]}
                  aktiv={reiheAktiv ?? 'alle'} onWahl={id => setReiheWahl(id === 'alle' || id === reiheAktiv ? null : id)} farbe={LEUCHT.beziehung} />
              </div>
            )}
            {neu && (
              <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)', marginBottom: 12 }}>
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 6 }}>Mit Vorlage starten: Ablauf, Checkliste mit sechs Wochen Vorlauf, Budgetposten und Soll-Mischung sind vorbereitet — das Ziel setzt du. Läuft unter {MARKE_EVENTS}; zuständig ist erst einmal {nameVon(verantwortlich('event'))}; im Überblick des Events änderbar.</div>
                <div style={{ marginBottom: 8 }}><ReiheWahl wert={neuReihe ?? (reiheAktiv && reiheAktiv !== OHNE_REIHE ? reiheAktiv : undefined)} onWahl={setNeuReihe} /></div>
                <Liste>
                  {VORLAGEN.map(v => (
                    <Zeile key={v.id} onClick={() => anlegen(v.id)} titel={v.label} unter={`${v.beschreibung} ${v.kapazitaet} Plätze · Soll ${v.mixZiel.zielkunden} % Zielkunden, ${v.mixZiel.kunden} % Kunden`}
                      rechts={<span style={{ fontSize: TYP.bedien, color: C.aktiv, fontWeight: 600 }}>anlegen</span>} />
                  ))}
                  <Zeile onClick={() => anlegen(null)} titel="Ohne Vorlage" unter="Leeres Event — Format, Ablauf und Checkliste selbst aufbauen" rechts={<span style={{ fontSize: TYP.bedien, color: C.aktiv, fontWeight: 600 }}>anlegen</span>} />
                </Liste>
              </div>
            )}
            {nachfassenText && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginBottom: 8 }}>Nachfassen offen: {nachfassenText} — binnen 48 Stunden, sie stehen auch in der Power Hour.</div>}
            <Liste>{kommend.map(zeile)}</Liste>
            {!kommend.length && !neu && (kommendAlle.length
              ? <Leer>Keine kommenden Events {wahl === 'ich' ? 'bei dir' : `bei ${nameVon(wahl)}`} — „Alle“ zeigt {kommendAlle.length === 1 ? 'eins' : kommendAlle.length}.</Leer>
              : reiheAktiv ? <Leer>Kein kommendes Event {reiheAktiv === OHNE_REIHE ? 'ohne Reihe' : `in „${reiheName(reiheAktiv)}“`} — „+ Event“ legt eins {reiheAktiv === OHNE_REIHE ? 'an' : 'in dieser Reihe an'}.</Leer>
              : <Leer>Kein Event geplant. Sechs Wochen Vorlauf: Ziel, Format, Gästemischung (mindestens 40 % Zielkunden, 20 % Kunden und Multiplikatoren).</Leer>)}
          </Karte>
        </Kachel>

        {/* Auf schmalen Bildschirmen klappt das Event unter seiner Zeile auf — die Kachel bleibt dann leer und verschwindet. */}
        <Kachel {...K('detail')}>
          {breit ? (
            <Karte i={2} akzent={aktiv ? LEUCHT.beziehung : undefined}>
              {aktiv ? <EventDetail key={aktiv.id} e={aktiv} api={api} zuKontakt={zuKontakt} /> : <Leer>Noch kein Event. „+ Event“ legt eins mit Vorlage an.</Leer>}
            </Karte>
          ) : null}
        </Kachel>

        <Kachel {...K('nachfassen')}>
          <Karte i={3} akzent={offenListe.length ? LEUCHT.achtung : undefined}>
            <Ueberschrift farbe={offenListe.length ? LEUCHT.achtung : undefined} rechts={offenListe.length ? <span>{offenListe.length}</span> : undefined}>Nachfassen offen</Ueberschrift>
            {offenListe.length ? (
              <Liste>
                {offenListe.slice(0, 6).map(({ t, e, name, firma }) => {
                  const rest = nachfassenRest(e, jetzt);
                  return <Zeile key={t.id} onClick={() => router.push(WEG.event(e.id, 'nachfassen'))} links={<Punkt farbe={fristFarbe(rest)} />}
                    titel={<>{name}{firma && <span style={{ color: C.inkLeise }}> · {firma}</span>}</>} unter={`${e.titel} · ${stunden(rest)}`} />;
                })}
                {offenListe.length > 6 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '4px 2px' }}>und {offenListe.length - 6} weitere — je Event unter „Nachfassen“.</div>}
              </Liste>
            ) : <Leer>Niemand offen — binnen 48 Stunden nach dem Event stehen hier alle, die da waren und noch nicht nachgefasst sind.</Leer>}
          </Karte>
        </Kachel>

        <Kachel {...K('wirkung')}>
          <Karte i={4} akzent={wirkung?.folge ? LEUCHT.gut : undefined}>
            <Ueberschrift rechts={wirkung?.events ? <span>{wirkung.events} {wirkung.events === 1 ? 'Event' : 'Events'}</span> : undefined}>Wirkung</Ueberschrift>
            {wirkung?.events ? (
              <>
                <Raster min={100}>
                  <Zahl wert={String(wirkung.da)} label="Gäste da" />
                  <Zahl wert={String(wirkung.folge)} label="Folgegespräche (30 T)" farbe={wirkung.folge ? LEUCHT.gut : undefined} />
                  <Zahl wert={euro(wirkung.beeinflusst)} label="beeinflusste Pipeline" />
                  {wirkung.verursacht > 0 && <Zahl wert={euro(wirkung.verursacht)} label="daraus entstanden" farbe={LEUCHT.business} />}
                  {wirkung.jeGespraech !== null && <Zahl wert={euro(wirkung.jeGespraech)} label="Kosten je Folgegespräch" />}
                </Raster>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>Über alle vergangenen Events unter {MARKE_EVENTS}. Ein Event zählt, wenn danach die richtigen Gespräche stattfinden — Ziel sind drei je Event binnen 30 Tagen.</div>
              </>
            ) : <Leer>Noch kein Event durchgeführt. Die Wirkung zeigt sich 30 Tage danach: Folgegespräche, beeinflusste Pipeline, Kosten je Gespräch.</Leer>}
          </Karte>
        </Kachel>

        <Kachel {...K('reihen')}>
          <Karte i={5}>
            <Ueberschrift>Reihen</Ueberschrift>
            <div style={{ display: 'grid', gap: 14 }}>
              {reihen.map(r => (
                <div key={r.id} style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: TYP.body, fontWeight: 700, color: r.id === OHNE_REIHE ? C.inkDim : C.ink }}>{r.name}</span>
                    <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{r.events ? `${r.events} ${r.events === 1 ? 'Event' : 'Events'} · ${r.vorbei} gewesen · ${r.kommend} geplant` : 'noch kein Event in dieser Reihe'}</span>
                  </div>
                  {r.events > 0 ? (
                    <Raster min={96}>
                      <Zahl wert={String(r.summe.da)} label="Gäste da" />
                      <Zahl wert={String(r.summe.zugesagt)} label="Zusagen" />
                      <Zahl wert={r.nachgefasstQuote === null ? undefined : `${Math.round(r.nachgefasstQuote * 100)} %`} label={`nachgefasst${r.summe.da ? ` (${r.summe.nachgefasst} von ${r.summe.da})` : ''}`} farbe={r.nachgefasstQuote !== null && r.nachgefasstQuote >= 0.9 ? LEUCHT.gut : undefined} />
                      <Zahl wert={String(r.leads)} label="Leads (Anmeldungen)" />
                      <Zahl wert={String(r.summe.dealsVerursacht)} label={r.summe.verursacht ? `Deals · ${euro(r.summe.verursacht)}` : 'Deals daraus'} farbe={r.summe.dealsVerursacht ? LEUCHT.business : undefined} />
                    </Raster>
                  ) : (
                    <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Im Überblick eines Events „Reihe“ wählen — oder „+ Event“ mit Reihe anlegen.</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>Leads = Personen, die sich zu einem Abend der Reihe angemeldet haben (zugesagt oder da, nicht persönlich eingeladen) — wie die Marketing-Herkunft in der Qualifizierung. Deals = aus dem Event entstanden.</div>
          </Karte>
        </Kachel>

        <Kachel {...K('vergangen')}>
          {vorbei.length > 0 ? <Karte i={6}><Ueberschrift>Vergangene Events</Ueberschrift><Liste>{vorbei.map(zeile)}</Liste></Karte> : null}
        </Kachel>
      </Flaeche>
    </>
  );
}
