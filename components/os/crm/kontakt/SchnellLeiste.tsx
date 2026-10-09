'use client';

// ─── Kontakt öffnen · Schnellaktions-Leiste am Handy (02.10., Paket B — Deal-Ebene) ─
// Kevin: „am Handy am besten reingehen und alles machen können am Kunden.“ Oben in der Akte, beim Scrollen mitlaufend:
// eine Reihe großer Knöpfe (≥ 44 px, seitlich wischbar) — Anrufen · Anruf festhalten · Mail · Termin · Notiz (mit Diktat) ·
// Follow-up · Qualifizieren · Vermitteln · Angebot · Make.One einladen. NICHTS davon ist neu gebaut: jeder Knopf führt in den
// vorhandenen CRM-Weg —
//   Anrufen / Anruf festhalten   tel:-Link über die Kanal-Ampel · AnrufAktion (KontaktSpalten)
//   Mail                         EmailAktion (Entwurf + Mail-Programm, Ampel; MAKE OS verschickt nichts ohne Freigabe)
//   Termin                       MeetingNeu → echter Kalender-Termin mit Bezug zur Person
//   Notiz                        NotizAktion (Diktat über die Spracherkennung des Browsers)
//   Follow-up                    AufgabeAktion (Follow-up = Aufgabe mit Bezug, #99)
//   Qualifizieren                LeadBlock (Lead-Status, Score, Kernfragen) + Sprung in die Qualifizierungsrunde
//   Vermitteln                   DealAnlegen, vorbelegt mit der Art „Vermittlung“ (ein Deal, kein Zweitweg)
//   Angebot                      Angebots-Entwurf (angebotLink mit Person/Firma)
//   Ins Handy                    vCard aus den Kartei-Daten, Teilen-Blatt bzw. .vcf-Download — alles im Browser (Art. 18: gesperrt)
//   Make.One einladen            Gast für ein Event vormerken (Teilnahme „vorgemerkt“, Einladungsweg nach Ampel); die Einladung
//                                selbst geht wie bisher persönlich bzw. nur mit grüner Ampel (§ 7 UWG) — kein Versand von hier.
// Gesperrt wie überall: Art. 18 (eingeschränkt) alles, Werbesperre Mail/Anruf. Am Rechner bleibt die Spalte links wie sie war.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRightLeft, BookUser, CalendarClock, Euro, ListChecks, Mail, Mic, PenLine, Phone, Sparkles, Star, X } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../../ui';
import type { Kontakt } from '@/lib/make-one/crm';
import { kanalStatus, type KanalStatus } from '@/lib/crm/recht';
import { kanalLink } from '@/lib/crm/erfassen';
import { istNetzwerkenEvent, titelMitReihe } from '@/lib/crm/marke';
import { kontextAus } from '@/lib/crm/segmente';
import { gastVormerkenMitNachfassen } from '../events/gemeinsam';
import { WEG } from '@/lib/wege';
import { handyKarteAusKontakt, handyTeilen, handyMeldung } from '@/lib/netzwerken/handy';
import { type CrmApi, datum } from '../daten';
import { NotizAktion, EmailAktion, AnrufAktion, AufgabeAktion, MeetingAktion, Hinweis } from '../KontaktSpalten';
import { LeadBlock } from '../Leads';
import { DealAnlegen } from '../DealAnlegen';

type Aktion = 'anruf' | 'mail' | 'termin' | 'notiz' | 'followup' | 'qualifizieren' | 'vermitteln' | 'einladen';

const MIN = 44;
/** Ein Symbol je Weg — gleiche Strichstärke und Größe statt gemischter Zeichen (Schliff 03.10.). */
const SYM = { size: 18, strokeWidth: 2 } as const;
const AKTION_TITEL: Record<Aktion, string> = { anruf: 'Anruf festhalten', mail: 'Mail', termin: 'Termin', notiz: 'Notiz', followup: 'Follow-up', qualifizieren: 'Qualifizieren', vermitteln: 'Vermitteln', einladen: 'Make.One einladen' };
const pille = (an: boolean, aus: boolean, farbe?: string): CSSProperties => ({
  flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: MIN, padding: '0 14px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap', scrollSnapAlign: 'start',
  border: `1px solid ${an ? (farbe ?? C.aktiv) : 'rgba(255,255,255,.14)'}`, background: an ? `${farbe ?? C.aktiv}22` : 'rgba(255,255,255,.05)', color: aus ? C.inkLeise : an ? (farbe ?? C.aktiv) : C.ink,
  fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, cursor: aus ? 'default' : 'pointer', opacity: aus ? 0.5 : 1,
});

/** „Make.One einladen“: ein kommendes Event wählen, die Person als Gast vormerken. */
function EventEinladen({ k, api, heute, onFertig }: { k: Kontakt; api: CrmApi; heute: string; onFertig: (t: string) => void }) {
  const crm = api.crm;
  const events = useMemo(() => (crm?.stand.events ?? []).filter(e => !istNetzwerkenEvent(e) && (e.status === 'idee' || e.status === 'geplant' || e.status === 'einladung') && e.datum >= heute).sort((a, b) => a.datum.localeCompare(b.datum)), [crm, heute]);
  const schon = new Set((crm?.stand.teilnahmen ?? []).filter(t => t.kontaktId === k.id).map(t => t.eventId));
  const [laeuft, setLaeuft] = useState<string | null>(null);
  if (!crm) return <Hinweis>Die Events laden noch …</Hinweis>;
  if (!events.length) return <Hinweis>Kein kommendes Event geplant — zuerst unter Markttraktion › Events › Make.One eines anlegen.</Hinweis>;
  const ctx = kontextAus(crm.stand, heute);
  const bez = { hatMandat: ctx.mitMandat.has(k.id), hatChance: ctx.mitChance.has(k.id) };
  const einl = kanalStatus(k, 'einladung', bez);
  const weg = einl.farbe === 'gruen' ? 'mail' as const : 'persoenlich' as const;
  const vormerken = async (eventId: string, titel: string) => {
    setLaeuft(eventId);
    try {
      // EINE Vormerkung wie Gästeliste und „Netzwerken“ (`gastVormerkenMitNachfassen`, Woche 2 · 5.15) — mit einladenDurch, Herkunft und
      // dem Stempel „nachgefasst“ an den Begegnungen bei besuchten Events.
      const ok = await gastVormerkenMitNachfassen(api, { eventId, k, weg, ...(api.ich ? { einladenDurch: api.ich } : {}), heute });
      if (!ok) return;
      onFertig(`Für „${titel}“ vorgemerkt — Einladung ${weg === 'mail' ? 'per Mail möglich (Ampel grün)' : 'bitte persönlich oder telefonisch (Ampel)'}.`);
    } finally { setLaeuft(null); }
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Für welches Event vormerken?</div>
      {events.map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: MIN }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: TYP.body, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titelMitReihe(e)}</div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{datum(e.datum, heute)}{e.ort ? ` · ${e.ort}` : ''}</div>
          </div>
          {schon.has(e.id) ? <span style={{ fontSize: TYP.bedien, color: LEUCHT.gut, flex: '0 0 auto' }}>steht auf der Liste ✓</span>
            : <Knopf aus={laeuft === e.id} onClick={() => vormerken(e.id, titelMitReihe(e))}>Vormerken</Knopf>}
          <Link href={WEG.event(e.id, 'gaeste')} aria-label={`Gästeliste ${e.titel}`} style={{ color: C.inkLeise, textDecoration: 'none', minWidth: MIN, minHeight: MIN, display: 'grid', placeItems: 'center' }}>›</Link>
        </div>
      ))}
      <Hinweis>Einladung per Mail nur mit grüner Ampel (§ 7 UWG): <span style={{ color: einl.farbe === 'gruen' ? LEUCHT.gut : einl.farbe === 'gelb' ? LEUCHT.achtung : LEUCHT.kritisch }}>● {einl.farbe === 'gruen' ? 'zulässig' : 'nur persönlich'}</span> — {einl.grund}. Von hier geht nichts raus.</Hinweis>
    </div>
  );
}

export function SchnellLeiste({ k, api, heute, ampel }: { k: Kontakt; api: CrmApi; heute: string; ampel: KanalStatus[] }) {
  const [aktion, setAktion] = useState<Aktion | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const feld = useRef<HTMLDivElement>(null);
  // Der Kopf der Oberfläche (.wachstum-kopf) liegt selbst mitlaufend ganz oben — der Streifen hängt sich direkt darunter.
  const [oben, setOben] = useState(57);
  useEffect(() => {
    const kopf = document.querySelector<HTMLElement>('.wachstum-kopf');
    if (!kopf) return;
    const messen = () => setOben(kopf.offsetHeight);
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(messen);
    ro.observe(kopf);
    return () => ro.disconnect();
  }, []);
  // Ob links/rechts noch Knöpfe verborgen sind — dort blendet der Streifen weich aus (Hinweis: wischbar).
  const streifen = useRef<HTMLDivElement>(null);
  const [rand, setRand] = useState({ links: false, rechts: true });
  useEffect(() => {
    const el = streifen.current;
    if (!el) return;
    const messen = () => setRand({ links: el.scrollLeft > 4, rechts: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    messen();
    el.addEventListener('scroll', messen, { passive: true });
    window.addEventListener('resize', messen);
    return () => { el.removeEventListener('scroll', messen); window.removeEventListener('resize', messen); };
  }, []);
  const maske = `linear-gradient(to right, transparent 0, #000 ${rand.links ? 28 : 0}px, #000 calc(100% - ${rand.rechts ? 32 : 0}px), transparent 100%)`;
  useEffect(() => { setAktion(null); setMeldung(null); }, [k.id]);
  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 4500); return () => clearTimeout(t); }, [meldung]);
  // Ein Feld, das unter dem mitlaufenden Streifen aufgeht, soll im Bild sein.
  useEffect(() => { if (aktion) feld.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }, [aktion]);

  const status = (kanal: string) => ampel.find(s => s.kanal === kanal);
  const mail = status('mail'), tel = status('telefon');
  const telefon = k.telefon ?? k.sms;
  const mailHref = mail && k.email ? kanalLink(mail, { email: k.email }) : null;
  const telHref = tel && telefon ? kanalLink(tel, { telefon }) : null;
  const mailOk = !!mail && mail.farbe !== 'rot';
  const art18 = !!k.eingeschraenkt;
  const sperre = !!k.werbesperre;
  const grund = (was: Aktion | 'angebot'): string | undefined => {
    if (art18) return 'Verarbeitung eingeschränkt (Art. 18)';
    if (sperre && (was === 'mail' || was === 'anruf')) return 'Werbesperre — kein Kanal';
    return undefined;
  };
  // „Ins Handy“: die Kartei-Daten als vCard — direkt aus dem Tipp (iOS erlaubt das Teilen nur nach einer Geste), nichts geht an Dritte.
  const handy = handyKarteAusKontakt(k);
  const handyAus = !handy.ok ? handy.grund : undefined;
  const insHandy = async () => {
    if (!handy.ok) return;
    const r = await handyTeilen(handy.karte);
    const t = handyMeldung(r);
    if (t) setMeldung(t);
  };
  const fertig = (t: string) => { setMeldung(t); setAktion(null); };
  const knopf = (id: Aktion, label: string, zeichen: ReactNode, farbe?: string) => {
    const g = grund(id);
    return (
      <button key={id} type="button" role="tab" aria-selected={aktion === id} onClick={() => !g && setAktion(aktion === id ? null : id)} disabled={!!g} title={g ?? label} style={pille(aktion === id, !!g, farbe)}>
        <span aria-hidden>{zeichen}</span>{label}
      </button>
    );
  };

  return (
    // Ein Fragment, kein Umschlag: ein mitlaufender (sticky) Streifen hält nur innerhalb seines Elternelements — er muss direkt im
    // hohen Seitencontainer der Akte stehen, nicht in einem kurzen Umschlag. minWidth 0: die zehn Knöpfe in einer Zeile (wischbar)
    // dürfen den Seitenraster nicht aufweiten (sonst läuft die ganze Seite am Handy seitlich über).
    <>
      {/* Mitlaufender Streifen: nur die Knöpfe — das Feld darunter wandert mit dem Inhalt. */}
      <div role="toolbar" data-testid="schnell-leiste" aria-label="Schnellaktionen am Kontakt" style={{ position: 'sticky', top: oben, zIndex: 20, background: C.grund, margin: '0 calc(-1 * clamp(18px,4vw,48px))', padding: '8px clamp(18px,4vw,48px)', borderBottom: `1px solid ${C.linie}`, minWidth: 0 }}>
        <div ref={streifen} role="tablist" aria-label="Aktion wählen" style={{ minWidth: 0, maxWidth: '100%', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch', maskImage: maske, WebkitMaskImage: maske } as CSSProperties}>
          {telHref && !grund('anruf')
            ? <a href={telHref} title={`Anrufen · ${tel?.grund ?? ''}`} style={{ ...pille(false, false, LEUCHT.gut), border: `1px solid ${LEUCHT.gut}66`, background: `${LEUCHT.gut}18` }}><span aria-hidden><Phone {...SYM} /></span>Anrufen</a>
            : <span title={grund('anruf') ?? (telefon ? tel?.grund : 'Kein Telefon eingetragen')} aria-disabled="true" style={pille(false, true)}><span aria-hidden><Phone {...SYM} /></span>Anrufen</span>}
          {knopf('anruf', 'Anruf festhalten', <PenLine {...SYM} />)}
          {knopf('mail', 'Mail', <Mail {...SYM} />)}
          {knopf('termin', 'Termin', <CalendarClock {...SYM} />)}
          {knopf('notiz', 'Notiz', <Mic {...SYM} />)}
          {knopf('followup', 'Follow-up', <ListChecks {...SYM} />)}
          {knopf('qualifizieren', 'Qualifizieren', <Star {...SYM} />)}
          {knopf('vermitteln', 'Vermitteln', <ArrowRightLeft {...SYM} />)}
          {art18
            ? <span title={grund('angebot')} aria-disabled="true" style={pille(false, true)}><span aria-hidden><Euro {...SYM} /></span>Angebot</span>
            : <Link href={WEG.angebot({ kontaktId: k.id, firmaId: k.firmaId })} style={pille(false, false)}><span aria-hidden><Euro {...SYM} /></span>Angebot</Link>}
          <button type="button" onClick={() => void insHandy()} disabled={!!handyAus} title={handyAus ?? 'Kontakt im Handy speichern'} data-testid="ins-handy" style={pille(false, !!handyAus)}><span aria-hidden><BookUser {...SYM} /></span>Ins Handy</button>
          {knopf('einladen', 'Make.One einladen', <Sparkles {...SYM} />)}
        </div>
      </div>
      {meldung && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.gut, marginTop: 10, padding: '10px 14px', borderRadius: 12, border: `1px solid ${LEUCHT.gut}55`, background: `${LEUCHT.gut}12`, lineHeight: 1.45 }}>✓ {meldung}</div>}
      {aktion && (
        <div ref={feld} style={{ marginTop: 10, padding: '4px 12px 12px', borderRadius: 14, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'grid', gap: 8, scrollMarginTop: oben + 70 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise }}>{AKTION_TITEL[aktion]}</span>
            <button type="button" onClick={() => setAktion(null)} aria-label={`${AKTION_TITEL[aktion]} schließen`} style={{ minHeight: MIN, minWidth: MIN, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', borderRadius: 12 }}><X size={18} aria-hidden /></button>
          </div>
          {aktion === 'anruf' && <AnrufAktion k={k} api={api} heute={heute} telHref={telHref} anlassNoetig={tel?.farbe === 'gelb'} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
          {aktion === 'mail' && <EmailAktion k={k} api={api} mailOk={mailOk} mailHref={mailHref} onFertig={fertig} />}
          {aktion === 'termin' && <MeetingAktion k={k} api={api} heute={heute} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
          {aktion === 'notiz' && <NotizAktion k={k} api={api} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
          {aktion === 'followup' && <AufgabeAktion k={k} api={api} heute={heute} onFertig={fertig} onAbbruch={() => setAktion(null)} />}
          {aktion === 'qualifizieren' && (
            <>
              <LeadBlock api={api} leadId={k.firmaId ?? k.id} />
              <Link href={WEG.qualifizierung()} style={{ ...pille(false, false), justifySelf: 'start' }}>Zur Qualifizierungsrunde ›</Link>
            </>
          )}
          {aktion === 'vermitteln' && (
            <>
              <Hinweis>Vermitteln legt einen Deal der Art „Vermittlung“ an — mit nächstem Schritt, wie jeder Deal.</Hinweis>
              <DealAnlegen api={api} kontaktId={k.id} art="vermittlung" quelle="empfehlung" onFertig={() => fertig('Vermittlungs-Deal angelegt — er steht unter Deals.')} onAbbruch={() => setAktion(null)} />
            </>
          )}
          {aktion === 'einladen' && <EventEinladen k={k} api={api} heute={heute} onFertig={fertig} />}
        </div>
      )}
    </>
  );
}
