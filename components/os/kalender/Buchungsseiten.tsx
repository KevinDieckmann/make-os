'use client';

// ─── Kalender — Buchungsseiten in der Leiste (29.09., Paket K4) ──────────────
// Wie Google: „30 min mit Kevin · Link kopieren“. Dazu die Anfragen: freigeben (fester Termin im Zielkalender +
// Aktivität „Termin gebucht“ + Follow-up „Termin vorbereiten“ im CRM) oder ablehnen. Offene Buchungen liegen im
// Raster als eigene Einträge (vorläufig/angefragt). Nach der Freigabe erscheint ein nächster Schritt NUR als Vorschlag
// (Qualifizierung starten / Deal anlegen) mit Link auf den Kontakt — angelegt wird dort, von Hand.
// Daten: /api/kalender/buchung (Haushalt). Versendet wird nichts von selbst.
// R-K2 (29.09.):
//   · #76 E-Mail des Gasts: „unbestätigt“, bis er den Bestätigungslink anklickt. „Bestätigungslink senden“ erzeugt einen
//     Mail-ENTWURF (mailto → eure Mail-App, dort ein Klick auf Senden) mit einem einmaligen Link, 7 Tage gültig.
//     „Freigeben + einladen …“ an eine unbestätigte Adresse nur nach dem Warnhinweis.
//   · #73 Ist der Platz inzwischen belegt (Termin am iPhone, Abwesend), fragt die Freigabe zurück: trotzdem · ablehnen.
//   · #79 Verantwortlich ist Pflicht (Datenschutz-Hinweis der Seite).
// F1 (Prüfer 1): Während eine Freigabe läuft, sind alle Freigabe-Knöpfe dieser Buchung gesperrt (#1). „Termin entfernen“
// fragt bei Gästen zurück („Absage senden?“) und löst danach den Verweis an der Buchung (#12) — auch für Termine, deren
// Freigabe zu spät kam (Buchung abgelehnt/abgelaufen).

import { EinladungFrage } from './verknuepfen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, feld, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import { WEG } from '@/lib/wege';
import { usePersonen } from '../aufgaben/hilfe';
import type { KTermin, Wer } from './teile';
import { bestaetigungsMail, type Buchung, type BuchungsSeite } from '@/lib/kalender/buchung';
import { mailtoLink } from '@/lib/crm/angebote';

type SeiteSicht = BuchungsSeite & { pfad: string };
type BuchungSicht = Omit<Buchung, 'tokenHash' | 'mailLink'> & { mailLinkBis?: string };
/** Antwort der Verwaltung (Fehler tragen `konflikt`/`unbestaetigt` für die Rückfragen). */
type Antwort = { ok: boolean; fehler?: string; konflikt?: boolean; unbestaetigt?: boolean; token?: string; pfad?: string; bis?: string };
/** Ein fertiger Mail-Entwurf zum Bestätigungslink. */
interface Entwurf { id: string; an: string; betreff: string; text: string; mailto: string }
interface Stand { seiten: SeiteSicht[]; buchungen: BuchungSicht[]; vorschlaege: Record<string, { art: 'qualifizierung' | 'deal'; text: string; kontaktId: string }> }

const STATUS_TEXT: Record<Buchung['status'], string> = { vorlaeufig: 'vorläufig', angefragt: 'angefragt', bestaetigt: 'bestätigt', abgelehnt: 'abgelehnt', abgesagt: 'abgesagt', abgelaufen: 'abgelaufen' };
const zeit = (b: Pick<Buchung, 'start' | 'ende'>) => `${b.start.slice(8, 10)}.${b.start.slice(5, 7)}. ${b.start.slice(11, 16)}–${b.ende.slice(11, 16)}`;

/** Buchungen laden (Leiste + Raster). `zeigen` öffnet die Karte (Klick auf eine Buchung im Raster, Glocke). */
export function useBuchungen() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [offen, setOffen] = useState(false);
  const laden = useCallback(async () => {
    try { const j = await fetch('/api/kalender/buchung', { cache: 'no-store' }).then(r => r.json()); if (j.ok) setStand(j); } catch { /* nächste Runde */ }
  }, []);
  useEffect(() => {
    void laden();
    try { if (new URLSearchParams(window.location.search).get('buchungen') === '1') setOffen(true); } catch { /* egal */ }
    const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, 60_000);
    return () => clearInterval(t);
  }, [laden]);
  /** Offene Buchungen als Einträge im Raster (vorläufig/angefragt) — nur zum Sehen, Klick öffnet die Karte. */
  const alsTermine = useMemo<KTermin[]>(() => {
    if (!stand) return [];
    const seiten = new Map(stand.seiten.map(s => [s.id, s]));
    return stand.buchungen.filter(b => b.status === 'vorlaeufig' || b.status === 'angefragt').map(b => {
      const s = seiten.get(b.seiteId);
      // K3 (30.09.): vorläufig über das Feld `vorlaeufig`, die Buchung über `buchungId` — kein Kennungs-Präfix mehr.
      return { id: `buchung-${b.id}`, uid: `buchung-${b.id}`, titel: `${b.status === 'vorlaeufig' ? '◌ vorläufig' : '◌ Anfrage'} · ${b.name}`, start: b.start, ende: b.ende, ganztags: false, kalender: s?.zielKalender ?? 'Buchung', wer: ((s?.person === 'kevin' || s?.person === 'malin') ? s.person : 'beide') as Wer, serie: false, mitTeilnehmern: false, bearbeitbar: false, vorlaeufig: true as const, buchungId: b.id };
    });
  }, [stand]);
  return { stand, laden, alsTermine, offen, setOffen, zeigen: () => setOffen(true) };
}
export type Buchungen = ReturnType<typeof useBuchungen>;

export function Buchungsseiten({ b }: { b: Buchungen }) {
  const { stand, laden, offen, setOffen } = b;
  const [bearbeiten, setBearbeiten] = useState<Partial<SeiteSicht> | null>(null);
  const [meldung, setMeldung] = useState('');
  const [kopiert, setKopiert] = useState('');
  const [einladen, setEinladen] = useState<string | null>(null);
  /** Rückfrage nach 409 „Platz belegt“ (#73): Buchung + Text. */
  const [konflikt, setKonflikt] = useState<{ id: string; text: string; einladen: boolean; unbestaetigt: boolean } | null>(null);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  /** Buchung, deren Freigabe gerade läuft (F1 #1) — alle Freigabe-Knöpfe dieser Buchung sind so lange aus. */
  const [freigabeLaeuft, setFreigabeLaeuft] = useState<string | null>(null);
  /** Rückfrage „Absage an die Gäste senden?“ vor dem Entfernen eines Termins mit Gästen (F1 #12). */
  const [absageFrage, setAbsageFrage] = useState<{ id: string; adressen: string[] } | null>(null);
  const [textKopiert, setTextKopiert] = useState(false);
  const senden = async (body: Record<string, unknown>): Promise<Antwort> => {
    const r: Antwort = await fetch('/api/kalender/buchung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setMeldung(r.ok ? '' : r.fehler ?? 'Nicht geklappt.');
    await laden();
    return r;
  };
  const aktion = async (body: Record<string, unknown>) => (await senden(body)).ok;
  /** Freigeben (optional mit Einladung) — belegt → Rückfrage statt still einen zweiten Termin daneben. */
  const freigeben = async (x: BuchungSicht, opt: { einladen?: boolean; trotzKonflikt?: boolean } = {}) => {
    if (freigabeLaeuft) return;
    const unbestaetigt = !x.emailBestaetigtAm;
    setFreigabeLaeuft(x.id);
    const r = await senden({ aktion: 'freigeben', id: x.id, ...(opt.einladen ? { einladen: true, einladungBestaetigt: true, ...(unbestaetigt ? { adresseUnbestaetigt: true } : {}) } : {}), ...(opt.trotzKonflikt ? { trotzKonflikt: true } : {}) });
    setFreigabeLaeuft(null);
    if (!r.ok && r.konflikt) { setMeldung(''); setKonflikt({ id: x.id, text: r.fehler ?? 'Der Platz ist inzwischen belegt.', einladen: !!opt.einladen, unbestaetigt }); }
    else setKonflikt(null);
  };
  /** Bestätigungslink (#76): der Server merkt sich nur den Hash; hier wird daraus der Mail-Entwurf. */
  const mailLink = async (x: BuchungSicht) => {
    const r = await senden({ aktion: 'mail-link', id: x.id });
    if (!r.ok || !r.pfad || !r.bis) return;
    const s = stand?.seiten.find(y => y.id === x.seiteId);
    const m = bestaetigungsMail({ name: x.name, titel: s?.titel ?? 'Termin', start: x.start, ende: x.ende, link: `${window.location.origin}${r.pfad}`, verantwortlich: s?.verantwortlich ?? '', bis: r.bis });
    setTextKopiert(false);
    setEntwurf({ id: x.id, an: x.email, ...m, mailto: mailtoLink(x.email, m.betreff, m.text) });
  };
  const textKopieren = async (e: Entwurf) => { try { await navigator.clipboard.writeText(`${e.betreff}\n\n${e.text}`); setTextKopiert(true); } catch { setMeldung('Kopieren nicht möglich — Text bitte markieren.'); } };
  const kopieren = async (s: SeiteSicht) => { try { await navigator.clipboard.writeText(`${window.location.origin}${s.pfad}`); setKopiert(s.id); setTimeout(() => setKopiert(''), 1800); } catch { setMeldung('Kopieren nicht möglich — Link: ' + s.pfad); } };
  /** Buchung, deren Termin gerade entfernt wird (Restpunkte 29.09.) — „Termin entfernen“ ist so lange gesperrt (kein Doppelklick). */
  const [entferntLaeuft, setEntferntLaeuft] = useState<string | null>(null);
  /** Termin einer abgesagten Buchung entfernen — mit Gästen erst nach „Absage senden?“; danach Verweis lösen (#12). */
  const terminEntfernen = async (x: BuchungSicht, einladungBestaetigt = false) => {
    if (!x.terminUid || entferntLaeuft) return;
    setEntferntLaeuft(x.id);
    try {
      const r: { ok: boolean; fehler?: string; einladung?: string; adressen?: string[] } = await fetch(`/api/kalender/termin?uid=${encodeURIComponent(x.terminUid)}${einladungBestaetigt ? '&einladungBestaetigt=1' : ''}`, { method: 'DELETE' }).then(y => y.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
      if (!r.ok && r.einladung) { setMeldung(''); setAbsageFrage({ id: x.id, adressen: r.adressen ?? [] }); return; }
      setAbsageFrage(null);
      if (!r.ok) { setMeldung(r.fehler ?? 'Nicht entfernt.'); return; }
      const l = await senden({ aktion: 'termin-geloest', id: x.id });
      if (l.ok) setMeldung('Termin im Kalender entfernt.');
    } finally { setEntferntLaeuft(null); }
  };

  const anfragen = (stand?.buchungen ?? []).filter(x => x.status === 'angefragt');
  const vorlaeufig = (stand?.buchungen ?? []).filter(x => x.status === 'vorlaeufig');
  const kommend = (stand?.buchungen ?? []).filter(x => x.status === 'bestaetigt');
  // Abgesagt — oder abgelehnt/abgelaufen, während die Freigabe lief (F1 #2): der Termin blieb stehen, entfernt wird von Hand.
  const abgesagtMitTermin = (stand?.buchungen ?? []).filter(x => (x.status === 'abgesagt' || x.status === 'abgelehnt' || x.status === 'abgelaufen') && x.terminUid);
  const seiteVon = (id: string) => stand?.seiten.find(s => s.id === id);
  // Schlussprüfung (29.09.): Das Fenster zeigt `meldung` als Fehler — eine alte Meldung der Leiste („Termin im Kalender
  // entfernt.“) stand sonst beim Öffnen einer neuen Seite rot darin. Beim Öffnen leeren.
  const oeffnen = (s: Partial<SeiteSicht>) => { setMeldung(''); setBearbeiten(s); };

  return (
    <Karte i={5} akzent={anfragen.length ? LEUCHT.achtung : undefined} id="buchungsseiten">
      <Ueberschrift rechts={<Knopf leise onClick={() => oeffnen({ titel: '', dauerMin: 30, aktiv: true })}>+ Seite</Knopf>}>Buchungsseiten</Ueberschrift>
      <div style={{ display: 'grid', gap: 6 }}>
        {(stand?.seiten ?? []).map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.aktiv ? LEUCHT.gut : C.inkLeise, flex: '0 0 auto' }} />
            <button onClick={() => oeffnen(s)} style={{ background: 'none', border: 'none', color: s.aktiv ? C.ink : C.inkLeise, cursor: 'pointer', padding: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: SCHRIFT.text, fontSize: 12.5, flex: 1, minWidth: 0 }}>{s.titel}</button>
            {(!s.verantwortlich || s.verantwortlich.trim().length < 5) && <button onClick={() => oeffnen(s)} title="Ohne Verantwortlichen zeigt die Seite keine Termine (Datenschutz-Hinweis)" style={{ background: 'none', border: 'none', padding: 0, color: LEUCHT.achtung, fontSize: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, flex: '0 0 auto' }}>Verantwortlich fehlt</button>}
            <button onClick={() => void kopieren(s)} disabled={!s.aktiv} style={{ background: 'none', border: 'none', color: s.aktiv ? LEUCHT.puls : C.inkLeise, cursor: s.aktiv ? 'pointer' : 'default', fontSize: 11.5, fontFamily: SCHRIFT.text, flex: '0 0 auto' }}>{kopiert === s.id ? 'kopiert ✓' : 'Link kopieren'}</button>
          </div>
        ))}
        {stand && !stand.seiten.length && <span style={{ fontSize: 12, color: C.inkLeise }}>Noch keine Buchungsseite — z. B. „30 min mit Kevin“.</span>}
      </div>
      {(anfragen.length > 0 || vorlaeufig.length > 0 || kommend.length > 0 || abgesagtMitTermin.length > 0) && (
        <button onClick={() => setOffen(!offen)} style={{ background: 'none', border: 'none', color: anfragen.length ? LEUCHT.achtung : C.inkDim, fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 10, fontFamily: SCHRIFT.text, fontWeight: 600 }}>
          {anfragen.length ? `${anfragen.length} ${anfragen.length === 1 ? 'Anfrage' : 'Anfragen'} zum Freigeben` : 'Buchungen'}{offen ? ' ▴' : ' ▾'}
        </button>
      )}
      {offen && (
        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
          {anfragen.map(x => (
            <div key={x.id} style={{ display: 'grid', gap: 4, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: `1px dashed ${LEUCHT.achtung}66` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{x.name}{x.firma ? ` · ${x.firma}` : ''}</div>
              <div style={{ fontSize: 11.5, color: C.inkDim }}>{seiteVon(x.seiteId)?.titel ?? 'Seite'} · {zeit(x)}</div>
              {x.anliegen && <div style={{ fontSize: 11.5, color: C.inkLeise }}>{x.anliegen}</div>}
              <MailStand x={x} onLink={() => void mailLink(x)} />
              {entwurf?.id === x.id && <MailEntwurf e={entwurf} kopiert={textKopiert} onKopieren={() => void textKopieren(entwurf)} onZu={() => setEntwurf(null)} />}
              {einladen === x.id && <EinladungFrage was="einladung" adressen={[x.email]} laeuft={freigabeLaeuft === x.id} onNein={() => setEinladen(null)}
                warnung={x.emailBestaetigtAm ? undefined : 'Die Adresse hat der Buchende selbst eingetragen — sie ist nicht per Mail bestätigt. Nur einladen, wenn du sicher bist, dass sie ihm gehört (sonst schreibt iCloud eine fremde Person an). Sicherer: erst „Bestätigungslink senden“.'}
                onJa={async () => { setEinladen(null); await freigeben(x, { einladen: true }); }} />}
              {konflikt?.id === x.id && (
                <div role="alertdialog" aria-label="Platz belegt" style={{ display: 'grid', gap: 8, background: `${LEUCHT.kritisch}14`, border: `1px solid ${LEUCHT.kritisch}55`, borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ fontSize: 12, color: C.ink, lineHeight: 1.45 }}>{konflikt.text} Trotzdem freigeben? Dann liegen zwei Termine übereinander.</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Knopf farbe={LEUCHT.achtung} aus={!!freigabeLaeuft} onClick={async () => { await freigeben(x, { einladen: konflikt.einladen, trotzKonflikt: true }); }}>Trotzdem freigeben</Knopf>
                    <Knopf leise onClick={async () => { setKonflikt(null); await aktion({ aktion: 'ablehnen', id: x.id, grund: 'Der Termin ist leider nicht mehr frei — bitte einen anderen wählen.' }); }}>Ablehnen</Knopf>
                    <Knopf leise onClick={() => setKonflikt(null)}>Abbrechen</Knopf>
                  </div>
                </div>
              )}
              {x.crmHinweis && <div style={{ fontSize: 11.5, color: LEUCHT.achtung }}>{x.crmHinweis}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <Knopf farbe={LEUCHT.gut} aus={!!freigabeLaeuft} onClick={async () => { await freigeben(x); }}>{freigabeLaeuft === x.id ? 'gibt frei …' : 'Freigeben'}</Knopf>
                {/* K3: den Gast als echte Einladung — erst nach der Rückfrage mit der Adresse (unbestätigt: mit Warnhinweis). */}
                <Knopf leise aus={!!freigabeLaeuft} onClick={() => setEinladen(x.id)}>Freigeben + einladen …</Knopf>
                <Knopf leise onClick={async () => { await aktion({ aktion: 'ablehnen', id: x.id }); }}>Ablehnen</Knopf>
                {x.kontaktId && <Link href={WEG.kontakt(x.kontaktId)} style={{ fontSize: 11.5, color: C.inkDim }}>Kontakt ›</Link>}
              </div>
              <span style={{ fontSize: 11, color: C.inkLeise }}>Ins CRM kommt die Person erst mit der Freigabe.</span>
            </div>
          ))}
          {vorlaeufig.length > 0 && <div style={{ fontSize: 11.5, color: C.inkLeise }}>{vorlaeufig.length} vorläufig reserviert — wartet auf die Bestätigung des Gastes (höchstens 30 Min.).</div>}
          {kommend.map(x => { const v = stand?.vorschlaege[x.id]; return (
            <div key={x.id} style={{ fontSize: 12, color: C.inkDim, display: 'grid', gap: 3 }}>
              <span><span style={{ color: LEUCHT.gut }}>✓</span> {x.name} · {zeit(x)}</span>
              <MailStand x={x} onLink={() => void mailLink(x)} />
              {entwurf?.id === x.id && <MailEntwurf e={entwurf} kopiert={textKopiert} onKopieren={() => void textKopieren(entwurf)} onZu={() => setEntwurf(null)} />}
              {v && <Link href={WEG.kontakt(v.kontaktId)} style={{ fontSize: 11.5, color: LEUCHT.puls }}>Vorschlag: {v.text} ›</Link>}
            </div>
          ); })}
          {abgesagtMitTermin.map(x => (
            <div key={x.id} style={{ fontSize: 12, color: C.inkDim, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{STATUS_TEXT[x.status]}: {x.name} · {zeit(x)}</span>
                <Knopf leise aus={!!entferntLaeuft} onClick={async () => { await terminEntfernen(x); }}>{entferntLaeuft === x.id ? 'entfernt …' : 'Termin entfernen'}</Knopf>
              </div>
              {absageFrage?.id === x.id && <EinladungFrage was="absage" adressen={absageFrage.adressen} laeuft={entferntLaeuft === x.id} onNein={() => setAbsageFrage(null)} onJa={async () => { await terminEntfernen(x, true); }} />}
            </div>
          ))}
        </div>
      )}
      {meldung && <div style={{ fontSize: 11.5, color: LEUCHT.achtung, marginTop: 8 }}>{meldung}</div>}
      {bearbeiten && <SeiteBearbeiten start={bearbeiten} onZu={() => setBearbeiten(null)} onSpeichern={async s => { if (await aktion({ aktion: 'seite', seite: s })) setBearbeiten(null); }} onLoeschen={bearbeiten.id ? async () => { if (await aktion({ aktion: 'seite-loeschen', id: bearbeiten.id })) setBearbeiten(null); } : undefined} fehler={meldung} />}
    </Karte>
  );
}

/** E-Mail-Stand einer Buchung (#76): bestätigt ✓ — oder unbestätigt + „Bestätigungslink senden“. */
function MailStand({ x, onLink }: { x: BuchungSicht; onLink: () => void }) {
  if (x.emailBestaetigtAm) return <span style={{ fontSize: 11.5, color: LEUCHT.gut }}>✓ E-Mail bestätigt</span>;
  const offen = x.mailLinkBis && x.mailLinkBis > new Date().toISOString();
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
      <span style={{ color: LEUCHT.achtung }}>E-Mail unbestätigt{offen ? ` · Link offen bis ${x.mailLinkBis!.slice(8, 10)}.${x.mailLinkBis!.slice(5, 7)}.` : ''}</span>
      <button type="button" onClick={onLink} style={{ background: 'none', border: 'none', padding: 0, color: LEUCHT.puls, cursor: 'pointer', fontSize: 11.5, fontFamily: SCHRIFT.text }}>{offen ? 'Neuen Bestätigungslink …' : 'Bestätigungslink senden …'}</button>
    </div>
  );
}

/** Der Mail-Entwurf zum Bestätigungslink — verschickt wird er nur mit dem Klick in der Mail-App. */
function MailEntwurf({ e, kopiert, onKopieren, onZu }: { e: Entwurf; kopiert: boolean; onKopieren: () => void; onZu: () => void }) {
  return (
    <div role="region" aria-label="Mail-Entwurf" style={{ display: 'grid', gap: 6, background: 'rgba(255,255,255,.04)', border: `1px solid ${LEUCHT.puls}44`, borderRadius: 10, padding: '8px 10px' }}>
      <span style={{ fontSize: 11.5, color: C.inkDim }}>Entwurf an <b style={{ color: C.ink }}>{e.an}</b> — „{e.betreff}“</span>
      <textarea readOnly value={e.text} rows={6} style={{ ...feld, fontSize: 11.5, padding: '6px 8px', resize: 'vertical', fontFamily: SCHRIFT.text }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <a href={e.mailto} style={{ fontSize: 12, fontWeight: 700, color: '#061312', background: LEUCHT.puls, borderRadius: 8, padding: '6px 10px', textDecoration: 'none' }}>In Mail öffnen</a>
        <Knopf leise onClick={onKopieren}>{kopiert ? 'kopiert ✓' : 'Text kopieren'}</Knopf>
        <Knopf leise onClick={onZu}>Schließen</Knopf>
      </div>
      <span style={{ fontSize: 11, color: C.inkLeise }}>MAKE OS verschickt nichts selbst: Die Mail geht erst mit deinem Klick auf „Senden“ in der Mail-App raus. Der Link gilt 7 Tage und nur einmal; ein neuer Link ersetzt diesen.</span>
    </div>
  );
}

const WT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function SeiteBearbeiten({ start, onZu, onSpeichern, onLoeschen, fehler }: { start: Partial<SeiteSicht>; onZu: () => void; onSpeichern: (s: Record<string, unknown>) => Promise<void>; onLoeschen?: () => Promise<void>; fehler: string }) {
  const personen = usePersonen();
  const f0 = start.fenster?.[0] ?? { tage: [1, 2, 3, 4, 5], von: '09:00', bis: '17:00' };
  const [s, setS] = useState({
    titel: start.titel ?? '', person: start.person ?? personen[0]?.speicher ?? 'kevin', dauerMin: start.dauerMin ?? 30, tage: f0.tage, von: f0.von, bis: f0.bis,
    tageVoraus: start.tageVoraus ?? 14, vorlaufMin: start.vorlaufMin ?? 1440, maxJeTag: start.maxJeTag ?? 4, pufferMin: start.pufferMin ?? 15, rasterMin: start.rasterMin ?? 30,
    zielKalender: start.zielKalender ?? '', ort: start.ort ?? '', verantwortlich: start.verantwortlich ?? '', firma: start.fragen?.firma ?? true, anliegen: start.fragen?.anliegen ?? true, aktiv: start.aktiv ?? true,
  });
  const zahl = (k: keyof typeof s, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) => setS(x => ({ ...x, [k]: Math.max(min, Math.min(max, Number(e.target.value) || min)) }));
  const zeile = (label: string, kind: React.ReactNode) => <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12, color: C.inkLeise }}>{label}</span>{kind}</label>;
  const klein = { ...feld, fontSize: 13, padding: '8px 10px' };
  // Nachtrag F1: Pflichtfelder sagen schon vor dem Speichern, was fehlt — keine Platzhalter, die wie Werte aussehen.
  const fehlt = { titel: !s.titel.trim(), kalender: !s.zielKalender.trim(), verantwortlich: s.verantwortlich.trim().length < 5 };
  const hinweis = (text: string) => <span role="note" style={{ fontSize: 11.5, color: LEUCHT.achtung }}>{text}</span>;
  const beispiel = (text: string) => <span style={{ fontSize: 11.5, color: C.inkLeise }}>{text}</span>;
  return (
    <Fenster titel={start.id ? 'Buchungsseite bearbeiten' : 'Neue Buchungsseite'} onZu={onZu} breit={620}>
      <div style={{ display: 'grid', gap: 12 }}>
        {zeile('Titel * (steht öffentlich auf der Seite)', <><input value={s.titel} maxLength={80} required aria-required="true" aria-invalid={fehlt.titel || undefined} onChange={e => setS({ ...s, titel: e.target.value })} style={klein} />{fehlt.titel ? hinweis('Titel fehlt — z. B. „30 min mit Kevin“.') : null}</>)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {zeile('Für wen', <select value={s.person} onChange={e => setS({ ...s, person: e.target.value })} style={klein}>{personen.map(p => <option key={p.speicher} value={p.speicher}>{p.name}</option>)}</select>)}
          {zeile('Dauer (Min.)', <input type="number" min={10} max={240} step={5} value={s.dauerMin} onChange={zahl('dauerMin', 10, 240)} style={klein} />)}
          {zeile('Vorlauf (Std.)', <input type="number" min={0} max={336} value={Math.round(s.vorlaufMin / 60)} onChange={e => setS({ ...s, vorlaufMin: Math.max(0, Math.min(336, Number(e.target.value) || 0)) * 60 })} style={klein} />)}
          {zeile('Tage im Voraus', <input type="number" min={1} max={60} value={s.tageVoraus} onChange={zahl('tageVoraus', 1, 60)} style={klein} />)}
          {zeile('Max. je Tag', <input type="number" min={1} max={20} value={s.maxJeTag} onChange={zahl('maxJeTag', 1, 20)} style={klein} />)}
          {zeile('Puffer (Min.)', <input type="number" min={0} max={120} step={5} value={s.pufferMin} onChange={zahl('pufferMin', 0, 120)} style={klein} />)}
        </div>
        {zeile('Buchbare Zeiten', (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {WT.map((w, i) => { const an = s.tage.includes(i + 1); return <button key={w} type="button" aria-pressed={an} onClick={() => setS({ ...s, tage: an ? s.tage.filter(t => t !== i + 1) : [...s.tage, i + 1].sort() })} style={{ border: 'none', borderRadius: 7, padding: '5px 8px', fontSize: 12, cursor: 'pointer', background: an ? `${LEUCHT.puls}33` : 'rgba(255,255,255,.05)', color: an ? C.ink : C.inkLeise }}>{w}</button>; })}
            <input type="time" value={s.von} onChange={e => setS({ ...s, von: e.target.value })} style={{ ...klein, width: 110 }} />–<input type="time" value={s.bis} onChange={e => setS({ ...s, bis: e.target.value })} style={{ ...klein, width: 110 }} />
          </div>
        ))}
        {zeile('Zielkalender * (Name wie in der Kalender-App)', <><input value={s.zielKalender} maxLength={100} required aria-required="true" aria-invalid={fehlt.kalender || undefined} onChange={e => setS({ ...s, zielKalender: e.target.value })} style={klein} />{fehlt.kalender ? hinweis('Zielkalender fehlt — genau so geschrieben wie in der Kalender-App.') : beispiel('Hier legt die Freigabe den festen Termin an.')}</>)}
        {zeile('Ort oder Videolink (sieht der Gast erst nach der Freigabe)', <input value={s.ort} maxLength={300} onChange={e => setS({ ...s, ort: e.target.value })} style={klein} />)}
        {zeile('Verantwortlich * (Pflicht — steht im Datenschutz-Hinweis: Name/Firma und Kontakt)', <input value={s.verantwortlich} maxLength={300} required aria-required="true" onChange={e => setS({ ...s, verantwortlich: e.target.value })} style={klein} />)}
        {fehlt.verantwortlich && hinweis('Verantwortlich fehlt — Name/Firma, Anschrift und eine Kontakt-Adresse für den Datenschutz.')}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim }}>
          <label><input type="checkbox" checked={s.firma} onChange={e => setS({ ...s, firma: e.target.checked })} /> nach Firma fragen</label>
          <label><input type="checkbox" checked={s.anliegen} onChange={e => setS({ ...s, anliegen: e.target.checked })} /> nach Anliegen fragen</label>
          <label><input type="checkbox" checked={s.aktiv} onChange={e => setS({ ...s, aktiv: e.target.checked })} /> aktiv (Link erreichbar)</label>
        </div>
        <div style={{ fontSize: 11.5, color: C.inkLeise }}>Name und E-Mail sind immer Pflicht, ebenso das Häkchen zur Einwilligung (Wortlaut und Fassung werden an jeder Buchung gespeichert). Buchungen sind erst fest, wenn ihr sie freigebt.</div>
        {fehler && <div style={{ fontSize: 12, color: LEUCHT.achtung }}>{fehler}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onLoeschen && <Knopf leise onClick={onLoeschen}>Löschen</Knopf>}
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf aus={fehlt.titel || fehlt.kalender || fehlt.verantwortlich} onClick={async () => { await onSpeichern({ ...(start.id ? { id: start.id } : {}), titel: s.titel, person: s.person, dauerMin: s.dauerMin, fenster: [{ tage: s.tage, von: s.von, bis: s.bis }], tageVoraus: s.tageVoraus, vorlaufMin: s.vorlaufMin, maxJeTag: s.maxJeTag, pufferMin: s.pufferMin, rasterMin: s.rasterMin, zielKalender: s.zielKalender, ort: s.ort, verantwortlich: s.verantwortlich, fragen: { firma: s.firma, anliegen: s.anliegen }, aktiv: s.aktiv }); }}>Speichern</Knopf>
        </div>
      </div>
    </Fenster>
  );
}
