'use client';

// ─── Netzwerken — Abendbericht und Danke-Mails (02.10.) ──────────────────────
// „Wen habe ich heute kennengelernt, was ist der nächste Schritt, wer ist zuständig, was ist offen?“ — für beide, je Event.
// Darunter die Danke-Mail-Entwürfe: ab dem Folgetag liegt für jede erfasste Person MIT E-Mail ein Entwurf bereit („Schön, dich/Sie
// gestern bei … kennengelernt zu haben“, Anrede Du/Sie wählbar). Verschickt wird NICHTS von MAKE OS: „In Mail öffnen“ startet das
// Mail-Programm des Geräts mit dem fertigen Text (mailto:), gesendet wird dort per Klick; danach „Ist raus“ bestätigt es
// (Teilnahme „nachgefasst“, Aktivität am Kontakt). Mails an Personen mit Werbesperre oder ohne Adresse gibt es nicht.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { anzeigename } from '@/lib/make-one/crm';
import { berichtAus, dankeZeilen, dankeOffen, dankeEntwurf, dankeMailtoLink, schrittLabel, type DankeZeile } from '@/lib/crm/netzwerken';
import { DANKE_UWG_HINWEIS, DANKE_FRIST_TAGE, werbeWoerter, datenschutzAngaben } from '@/lib/crm/netzwerken-recht';
import { fuerFirmaId } from '@/lib/crm/besuche-form';
import { tagPlus, tagVon, wandzeit } from '@/lib/zeit/kalender-kern';
import { WEG, eventLink } from '@/lib/wege';
import { istBesuch } from '@/lib/crm/besuche-form';
import type { CrmApi } from '../crm/daten';
import { Gross, Wahl, Beschriftung, Hinweis, Initialen, Leerzustand, LinkChips, type LinkChip, eingabe, kopfStil, tagText } from './bausteine';
import { AbendZaehler, abendZahlen } from './zaehler';
import type { EventWahl } from './EventModus';
import type { Person } from './useNetzwerken';
import type { Kontakt } from '@/lib/make-one/crm';

const KEINE: Kontakt[] = [];

export function Heute({ api, ich, personen, heute, wahl, eventId, setEventId, onErfassen }: { api: CrmApi; ich: string | null; personen: Person[]; heute: string; wahl: EventWahl | null; eventId: string | null; setEventId: (id: string) => void; onErfassen: () => void }) {
  const crm = api.crm?.stand;
  const kontakte = api.kontakte ?? KEINE;
  const nameVon = (id: string) => personen.find(p => p.id === id)?.name ?? (id ? id.charAt(0).toUpperCase() + id.slice(1) : '—');

  // Events mit Netzwerken-Erfassungen — die jüngsten zuerst.
  const eventsMit = useMemo(() => {
    if (!crm) return [];
    const ids = new Set(crm.teilnahmen.filter(t => t.netzwerken).map(t => t.eventId));
    return crm.events.filter(e => ids.has(e.id)).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 8);
  }, [crm]);
  const aktiv = eventId ?? (wahl && wahl.tag === heute ? wahl.eventId : null) ?? eventsMit[0]?.id ?? null;
  const event = crm?.events.find(e => e.id === aktiv);

  const bericht = useMemo(() => (crm && event ? berichtAus({ event, teilnahmen: crm.teilnahmen, kontakte, followups: crm.followups, heute }) : null), [crm, event, kontakte, heute]);
  const danke = useMemo(() => (crm && event ? dankeZeilen({ events: crm.events, teilnahmen: crm.teilnahmen, kontakte, heute, eventId: event.id }) : []), [crm, event, kontakte, heute]);
  const absender = personen.find(p => p.id === ich)?.name ?? '';
  // Kunden-Event: der Name der Firma geht in den Datenschutzhinweis der Danke-Mail (Art. 13: Empfänger nennen).
  const kundeName = event && crm ? crm.firmen.find(f => f.id === fuerFirmaId(event))?.name : undefined;

  if (!api.crm) return <Laedt />;
  if (!eventsMit.length) {
    return (
      <Leerzustand symbol={<ClipboardList size={26} />} titel="Noch niemand erfasst"
        aktion={<Gross ton="haupt" onClick={onErfassen}>Erste Karte erfassen</Gross>}>
        Sobald du die erste Karte gespeichert hast, steht hier der Bericht des Tages — und ab dem nächsten Morgen liegen die Danke-Mails als Entwurf bereit.
      </Leerzustand>
    );
  }
  const zahlen = event && crm ? abendZahlen(crm.teilnahmen, event.id) : null;

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {eventsMit.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} aria-label="Event wählen">
          {eventsMit.map(e => <Wahl key={e.id} klein an={e.id === aktiv} onClick={() => setEventId(e.id)}>{e.titel}</Wahl>)}
        </div>
      )}
      {bericht && event && (
        <section aria-label="Abendbericht" style={{ display: 'grid', gap: 14 }}>
          <div style={{ padding: '14px 16px', borderRadius: 18, border: '1px solid rgba(255,255,255,.1)', background: 'linear-gradient(150deg, rgba(255,255,255,.06), rgba(255,255,255,.02))', display: 'grid', gap: 12 }}>
            <div>
              <h2 style={{ ...kopfStil, fontSize: TYP.titel }}>{event.titel}</h2>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.5 }}>
                {tagText(event.datum)}{event.ort ? ` · ${event.ort}` : ''}
                {Object.entries(bericht.jePerson).map(([p, n]) => ` · ${nameVon(p)} ${n}`).join('')}
                {bericht.offenGesamt ? ` · ${bericht.offenGesamt} offen` : ''}
              </div>
              {/* Bericht und Danke-Mails hängen am Event — von hier geht es in seine Akte (Events) bzw. ins Make.One-Event (03.10.). */}
              <Link href={eventLink(event)} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 4, color: C.aktiv, fontSize: TYP.bedien, fontWeight: 600, textDecoration: 'none' }}>{istBesuch(event) ? 'Event-Akte öffnen ›' : 'Make.One-Event öffnen ›'}</Link>
            </div>
            {/* Ist es das Event von heute, stehen dieselben Zahlen schon oben im Kopf — nur ältere Events zeigen sie hier. */}
            {!(wahl && wahl.eventId === event.id) && <AbendZaehler zahlen={zahlen} eventTitel={event.titel} farbe={LEUCHT.beziehung} />}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {bericht.zeilen.map(z => (
              <article key={z.kontaktId} style={{ padding: '12px 14px', borderRadius: 16, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Initialen name={z.name} />
                <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 6 }}>
                  <div>
                    <Link href={WEG.akte(z.kontaktId)} style={{ color: C.ink, fontSize: 16, fontWeight: 700, textDecoration: 'none', overflowWrap: 'anywhere' }}>{z.name} ›</Link>
                    {z.firma && <div style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere' }}>{z.firma}</div>}
                  </div>
                  <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.45 }}>
                    <span style={{ color: LEUCHT.beziehung, fontWeight: 700 }}>{z.schrittText}</span>
                    {z.terminAm ? ` · ${tagText(z.terminAm.slice(0, 10))} ${z.terminAm.slice(11, 16)}` : ''}
                    <span style={{ color: C.inkDim }}> · zuständig {nameVon(z.zustaendig)}{z.erfasstVon !== z.zustaendig ? ` · kennengelernt von ${nameVon(z.erfasstVon)}` : ''}</span>
                  </div>
                  {z.info && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{z.info}</div>}
                  {z.frueher?.map(f => <div key={f.erfasstAm} style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, overflowWrap: 'anywhere' }}>Davor: {f.schrittText} ({tagText(f.erfasstAm.slice(0, 10))}){f.terminAm ? ` · Termin ${tagText(f.terminAm.slice(0, 10))} ${f.terminAm.slice(11, 16)}` : ''}{f.info ? ` — ${f.info}` : ''}</div>)}
                  {/* Platz für die Verknüpfungen der Zeile (Termin · Deal · Follow-up · Event): eine Zeile Chips, leer = unsichtbar. */}
                  <LinkChips links={z.links.filter(l => l.id !== 'kontakt') as LinkChip[]} />
                  {z.offen.length > 0 && <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 6, flexWrap: 'wrap' }}>{z.offen.map(o => <li key={o} style={{ fontSize: TYP.bedien, fontWeight: 600, color: LEUCHT.achtung, background: `${LEUCHT.achtung}1F`, borderRadius: 999, padding: '3px 10px' }}>{o}</li>)}</ul>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {event && (
        <section aria-label="Danke-Mails" style={{ display: 'grid', gap: 12 }}>
          <div>
            <h2 style={{ ...kopfStil, fontSize: TYP.titel }}>Danke-Mails</h2>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.5 }}>
              {danke.length
                ? `${dankeOffen(danke)} bereit${danke.some(d => !d.mailOk) ? ` · ${danke.filter(d => !d.mailOk).length} ohne Versand (keine Adresse oder gesperrt)` : ''}. Verschickt wird erst per Klick im Mail-Programm.`
                : event.datum >= heute ? 'Die Entwürfe liegen ab morgen bereit — für jede erfasste Person mit E-Mail-Adresse.' : 'Keine Danke-Mails für dieses Event.'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {danke.map(d => <DankeKarte key={d.teilnahme.id} d={d} heute={heute} absender={absender} meine={d.teilnahme.netzwerken?.erfasstVon === ich} vonName={nameVon(d.teilnahme.netzwerken?.erfasstVon ?? '')} api={api} kunde={kundeName} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/** Ladezustand mit festem Platz: drei graue Karten statt „Lädt …“ — nichts springt, wenn die Kartei da ist. */
function Laedt() {
  return (
    <div role="status" aria-label="Lädt" style={{ display: 'grid', gap: 10 }}>
      {[0, 1, 2].map(i => <div key={i} aria-hidden style={{ height: i ? 92 : 120, borderRadius: 16, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.05)' }} />)}
    </div>
  );
}

function DankeKarte({ d, heute, absender, meine, vonName, api, kunde }: { d: DankeZeile; heute: string; absender: string; meine: boolean; vonName: string; api: CrmApi; kunde?: string }) {
  const n = d.teilnahme.netzwerken!;
  const [anrede, setAnrede] = useState<'Du' | 'Sie'>(n.danke?.anrede ?? d.kontakt.anrede ?? 'Sie');
  const gestern = tagVon(wandzeit(new Date(n.erfasstAm))) === tagPlus(heute, -1);
  const vorlage = useMemo(() => dankeEntwurf({ vorname: d.kontakt.vorname, nachname: d.kontakt.nachname, anrede, eventTitel: d.event.titel, wann: gestern ? 'gestern' : 'neulich', schritt: n.schritt, terminAm: n.terminAm, absender, ...(kunde ? { kunde } : {}), datenschutz: datenschutzAngaben() }), [d.kontakt.vorname, d.kontakt.nachname, anrede, d.event.titel, gestern, n.schritt, n.terminAm, absender, kunde]);
  const [text, setText] = useState<string | null>(null);
  const [betreff, setBetreff] = useState<string | null>(null);
  const [geoeffnet, setGeoeffnet] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const aktuell = { betreff: betreff ?? vorlage.betreff, text: text ?? vorlage.text };
  const link = d.mailOk ? dankeMailtoLink(d.kontakt.email, aktuell) : null;
  // § 7 UWG: Wörter wie Angebot/Einladung/Newsletter/Rabatt machen aus dem Dank Werbung — vor dem Öffnen nachfragen, nie blockieren.
  const werbung = werbeWoerter(`${aktuell.betreff}\n${aktuell.text}`);

  const nichtSenden = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch('/api/netzwerken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'danke-verzicht', eventId: d.event.id, kontaktId: d.kontakt.id }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) void api.laden(true); else setFehler(typeof j?.fehler === 'string' ? j.fehler : 'Nicht vermerkt — bitte noch einmal.');
    } catch { setFehler('Ohne Netz nicht vermerkt — bitte später noch einmal.'); } finally { setLaeuft(false); }
  };
  const oeffnen = () => {
    if (!link) return;
    if (werbung.length && !window.confirm(`Im Text steht „${werbung.join('“, „')}“. Ohne Einwilligung wäre das Werbung (§ 7 UWG) — in einer Danke-Mail bitte nur Dank und Verabredetes.\n\nTrotzdem im Mail-Programm öffnen?`)) return;
    window.location.href = link;
    setGeoeffnet(true);
  };

  const raus = async () => {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch('/api/netzwerken', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'danke-raus', eventId: d.event.id, kontaktId: d.kontakt.id, anrede }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) void api.laden(true); else setFehler(typeof j?.fehler === 'string' ? j.fehler : 'Nicht vermerkt — bitte noch einmal.');
    } catch { setFehler('Ohne Netz nicht vermerkt — bitte später noch einmal „Ist raus“ tippen.'); } finally { setLaeuft(false); }
  };

  return (
    <article style={{ padding: '14px', borderRadius: 14, border: `1px solid ${d.raus ? `${LEUCHT.gut}55` : 'rgba(255,255,255,.1)'}`, background: d.raus ? `${LEUCHT.gut}0D` : 'rgba(255,255,255,.03)', display: 'grid', gap: 10 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{anzeigename(d.kontakt)}</div>
        <div style={{ fontSize: 13, color: C.inkDim, overflowWrap: 'anywhere' }}>{d.kontakt.email ?? '—'}{d.kontakt.firma ? ` · ${d.kontakt.firma}` : ''}</div>
      </div>
      {!d.mailOk ? (
        <Hinweis farbe={LEUCHT.achtung}>Keine Danke-Mail: {d.mailGrund}.</Hinweis>
      ) : d.raus ? (
        <Hinweis farbe={LEUCHT.gut} rolle="status">✓ Danke-Mail raus am {tagText(d.raus)}.</Hinweis>
      ) : d.verzichtet ? (
        <Hinweis>Bewusst nicht gesendet am {tagText(d.verzichtet)}. Der Datenschutzhinweis (Art. 13) ist damit noch nicht erteilt — beim ersten Kontakt nachholen.</Hinweis>
      ) : d.abgelaufen ? (
        <Hinweis>Älter als {DANKE_FRIST_TAGE} Tage — dafür gibt es keinen Danke-Entwurf mehr (der Anlass ist weg, eine späte Mail wäre kein Dank mehr). Den Datenschutzhinweis (Art. 13) beim ersten Kontakt geben.</Hinweis>
      ) : !meine ? (
        <Hinweis>Diese Danke-Mail schickt {vonName} — sie hat die Person kennengelernt. Du siehst nur den Stand.</Hinweis>
      ) : (
        <>
          <div>
            <Beschriftung>Anrede</Beschriftung>
            <div style={{ display: 'flex', gap: 8 }}>
              <Wahl klein an={anrede === 'Du'} onClick={() => { setAnrede('Du'); setText(null); setBetreff(null); }}>Du</Wahl>
              <Wahl klein an={anrede === 'Sie'} onClick={() => { setAnrede('Sie'); setText(null); setBetreff(null); }}>Sie</Wahl>
            </div>
          </div>
          <Hinweis>{DANKE_UWG_HINWEIS}</Hinweis>
          <input value={aktuell.betreff} onChange={x => setBetreff(x.target.value)} style={eingabe} aria-label="Betreff" />
          <textarea value={aktuell.text} onChange={x => setText(x.target.value)} rows={9} style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5, fontFamily: SCHRIFT.text }} aria-label="Text der Danke-Mail" />
          <div style={{ display: 'grid', gap: 8 }}>
            {werbung.length > 0 && <Hinweis farbe={LEUCHT.achtung} rolle="alert">Im Text steht „{werbung.join('“, „')}“ — das wäre ohne Einwilligung Werbung (§ 7 UWG). Bitte nur Dank und Verabredetes.</Hinweis>}
            {link && (werbung.length > 0
              ? <Gross ton="warn" onClick={oeffnen}>In Mail öffnen (mit Rückfrage)</Gross>
              : <Gross ton="haupt" href={link} onClick={() => setGeoeffnet(true)}>In Mail öffnen</Gross>)}
            {/* Der Link öffnet das Mail-Programm; `onClick` merkt nur, dass es geöffnet wurde. */}
            {geoeffnet && <Gross ton="gut" onClick={() => void raus()} aus={laeuft}>{laeuft ? 'Vermerkt …' : '✓ Ist raus'}</Gross>}
            {!geoeffnet && <button type="button" onClick={() => setGeoeffnet(true)} style={{ background: 'none', border: 'none', color: C.inkDim, fontSize: TYP.bedien, textDecoration: 'underline', cursor: 'pointer', minHeight: 44 }}>Habe ich schon anders verschickt</button>}
            {!geoeffnet && <button type="button" onClick={() => void nichtSenden()} disabled={laeuft} style={{ background: 'none', border: 'none', color: C.inkDim, fontSize: TYP.bedien, textDecoration: 'underline', cursor: 'pointer', minHeight: 44 }}>Nicht senden</button>}
          </div>
          {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
        </>
      )}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{schrittLabel(n.schritt)} · {tagText(tagVon(wandzeit(new Date(n.erfasstAm))))}</div>
    </article>
  );
}
