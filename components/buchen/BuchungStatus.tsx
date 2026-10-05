'use client';

// ─── Öffentliche Buchungsseite — Status des Gastes (29.09., Paket K4) ────────
// Das Token steht im Fragment der Adresse (#…) und geht nur im Körper an den Server. Hier: bestätigen (vorläufig →
// angefragt), sehen (angefragt · bestätigt mit Ort · abgelehnt mit Grund · abgesagt · abgelaufen), absagen.
// R-K2 #76 (29.09.): Der Bestätigungslink aus der Mail führt hierher mit `#mail=<token>` — dann wird NUR die E-Mail-
// Adresse bestätigt (einmalig); absagen/ansehen geht weiter nur mit dem persönlichen Status-Link. #74: zweite Uhrzeit
// in der Zone des Gasts.
// F1 (Prüfer 1 #9, 29.09.): Der Bestätigungslink wird NICHT beim Seitenaufruf eingelöst — Mail-Programme und
// Virenscanner öffnen Links vorab (Link-Vorschau), das hätte die Adresse ohne den Gast „bestätigt“. Erst der Knopf
// „E-Mail-Adresse bestätigen“ schickt das Token an den Server.

import { useEffect, useRef, useState } from 'react';
import { C, AKZENT, seite, rahmen, karte, titel, leise, klein, knopf, zeitText } from './stil';
import { useGastZone } from './Buchen';
import { gastZeitText, zonenOrt } from '@/lib/kalender/gast-zeit';

type Status = 'vorlaeufig' | 'angefragt' | 'bestaetigt' | 'abgelehnt' | 'abgesagt' | 'abgelaufen';
interface Sicht { status: Status; titel: string; start: string; ende: string; reserviertBis?: string; ort?: string; grund?: string; verantwortlich?: string; datenschutzLink?: string; emailBestaetigt?: true }
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Was im Fragment (#…) steht: der Bestätigungslink (`mail=`), der persönliche Status-Link — oder nichts Brauchbares. */
export type Fragment = { art: 'mail'; token: string } | { art: 'status'; token: string } | { art: 'kaputt'; mail: boolean };
export function fragmentLesen(hash: string): Fragment {
  const roh = hash.replace(/^#/, '');
  if (roh.startsWith('mail=')) { const m = roh.slice(5); return TOKEN.test(m) ? { art: 'mail', token: m } : { art: 'kaputt', mail: true }; }
  return TOKEN.test(roh) ? { art: 'status', token: roh } : { art: 'kaputt', mail: false };
}

const TEXT: Record<Status, { kopf: string; satz: string; farbe: string }> = {
  vorlaeufig: { kopf: 'Fast fertig — bitte bestätigen', satz: 'Der Platz ist für Sie reserviert. Bestätigen Sie Ihre Anfrage, dann melden wir uns mit der Zusage.', farbe: C.achtung },
  angefragt: { kopf: 'Anfrage ist angekommen', satz: 'Wir prüfen den Termin und bestätigen ihn persönlich. Den Stand sehen Sie jederzeit auf dieser Seite.', farbe: AKZENT },
  bestaetigt: { kopf: 'Termin ist bestätigt', satz: 'Wir freuen uns auf das Gespräch.', farbe: C.gut },
  abgelehnt: { kopf: 'Termin leider nicht möglich', satz: 'Dieser Termin kann nicht stattfinden.', farbe: C.kritisch },
  abgesagt: { kopf: 'Abgesagt', satz: 'Sie haben diese Anfrage abgesagt.', farbe: C.inkDim },
  abgelaufen: { kopf: 'Reservierung abgelaufen', satz: 'Die Anfrage wurde nicht rechtzeitig bestätigt oder ist verstrichen. Bitte buchen Sie neu.', farbe: C.inkDim },
};

export function BuchungStatus({ slug }: { slug: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [sicht, setSicht] = useState<Sicht | null>(null);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [absagenFrage, setAbsagenFrage] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  /** Aufruf über den Bestätigungslink aus der Mail (#mail=…) — nur die Adresse bestätigen. */
  const [mailModus, setMailModus] = useState(false);
  /** Das Mail-Token — eingelöst erst per Knopf (F1 #9), nie beim Laden. */
  const [mailToken, setMailToken] = useState<string | null>(null);
  const zone = useGastZone();

  const senden = async (aktion: 'ansehen' | 'bestaetigen' | 'absagen' | 'mail-bestaetigen', t = token) => {
    if (!t) return;
    setLaeuft(true); setFehler('');
    try {
      const r = await fetch(`/api/buchung/${slug}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, aktion }) });
      const j = await r.json().catch(() => ({ ok: false }));
      if (r.ok && j.ok) setSicht(j.sicht); else setFehler(j.fehler ?? 'Das hat nicht geklappt.');
    } catch { setFehler('Keine Verbindung — bitte noch einmal.'); }
    setLaeuft(false);
  };

  const gestartet = useRef(false);
  useEffect(() => {
    // Nur einmal (auch im Strict-Mode der Entwicklung): ein Mail-Token gilt genau einmal.
    if (gestartet.current) return;
    gestartet.current = true;
    const f = fragmentLesen(window.location.hash);
    if (f.art === 'mail') {
      // Das Token verschwindet aus der Adresszeile (Lesezeichen, geteilter Bildschirm) — es bleibt nur im Speicher der Seite.
      try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); } catch { /* egal */ }
      setMailModus(true);
      setMailToken(f.token);
      return;
    }
    if (f.art === 'kaputt') {
      setMailModus(f.mail);
      setFehler(f.mail ? 'Dieser Bestätigungslink ist unvollständig. Bitte den vollständigen Link aus der Mail öffnen.' : 'Dieser Link ist unvollständig. Bitte den vollständigen Link Ihrer Anfrage öffnen.');
      return;
    }
    setToken(f.token);
    void senden('ansehen', f.token);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const kopieren = async () => { try { await navigator.clipboard.writeText(window.location.href); setKopiert(true); } catch { /* egal */ } };
  const t = sicht ? TEXT[sicht.status] : null;
  const bei = (wand: string) => (zone ? gastZeitText(wand, zone) : null);

  if (mailModus) return <MailBestaetigen sicht={sicht} fehler={fehler} laeuft={laeuft} bereit={!!mailToken && !sicht} onBestaetigen={() => { if (mailToken) void senden('mail-bestaetigen', mailToken); }} />;

  return (
    <main style={seite}>
      <div style={{ ...rahmen, maxWidth: 560 }}>
        <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.12em', color: AKZENT, fontWeight: 700 }}>Ihre Terminanfrage</span>
        {!sicht && !fehler && <div style={karte}><p style={leise}>Wird geladen …</p></div>}
        {fehler && !sicht && <div style={karte}><h1 style={titel}>Nicht gefunden</h1><p style={leise}>{fehler}</p></div>}
        {sicht && t && (
          <section style={{ ...karte, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: t.farbe, boxShadow: `0 0 10px ${t.farbe}66` }} /><span style={{ fontSize: 13, color: t.farbe, fontWeight: 700 }}>{t.kopf}</span></div>
            <h1 style={titel}>{sicht.titel}</h1>
            <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{zeitText(sicht.start, sicht.ende)}{zone && bei(sicht.start) ? <span style={{ ...klein, display: 'block', fontWeight: 500 }}>bei Ihnen ({zonenOrt(zone)}): {bei(sicht.start)}–{bei(sicht.ende) ?? sicht.ende.slice(11, 16)}</span> : null}</div>
            <p style={{ ...leise, margin: 0 }}>{t.satz}</p>
            {sicht.emailBestaetigt && <p style={{ ...klein, margin: 0, color: C.gut }}>E-Mail-Adresse bestätigt.</p>}
            {sicht.status === 'vorlaeufig' && sicht.reserviertBis && <p style={{ ...klein, margin: 0 }}>Reserviert bis {new Date(sicht.reserviertBis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr.</p>}
            {sicht.ort && <p style={{ ...leise, margin: 0, color: C.ink }}>Ort / Zugang: {sicht.ort}</p>}
            {sicht.grund && <p style={{ ...leise, margin: 0 }}>Hinweis: {sicht.grund}</p>}
            {fehler && <div role="alert" style={{ color: C.achtung, fontSize: 14 }}>{fehler}</div>}
            {sicht.status === 'vorlaeufig' && <button onClick={() => void senden('bestaetigen')} disabled={laeuft} aria-busy={laeuft} style={knopf(!laeuft)}>{laeuft ? 'Wird bestätigt …' : 'Anfrage jetzt bestätigen'}</button>}
            {(sicht.status === 'vorlaeufig' || sicht.status === 'angefragt' || sicht.status === 'bestaetigt') && (
              absagenFrage
                ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span style={leise}>Wirklich absagen?</span><button onClick={() => { setAbsagenFrage(false); void senden('absagen'); }} disabled={laeuft} style={knopf(!laeuft, true)}>Ja, absagen</button><button onClick={() => setAbsagenFrage(false)} style={knopf(true, true)}>Nein</button></div>
                : <button onClick={() => setAbsagenFrage(true)} style={{ ...knopf(true, true), justifySelf: 'start' }}>Termin absagen</button>
            )}
            <div style={{ ...klein, borderTop: `1px solid ${C.linie}`, paddingTop: 12, display: 'grid', gap: 8 }}>
              <span>Diese Seite ist Ihr persönlicher Zugang zur Anfrage — bitte den Link aufbewahren (z. B. als Lesezeichen). Er wird nicht per E-Mail verschickt.</span>
              <button onClick={() => void kopieren()} style={{ ...knopf(true, true), justifySelf: 'start', fontSize: 13, minHeight: 36, padding: '8px 12px' }}>{kopiert ? 'Link kopiert' : 'Link kopieren'}</button>
              {sicht.verantwortlich && <span>Verantwortlich: {sicht.verantwortlich}{sicht.datenschutzLink ? <> · <a href={sicht.datenschutzLink} target="_blank" rel="noopener noreferrer" style={{ color: AKZENT }}>Datenschutzhinweis</a></> : null}</span>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * Die Seite des Bestätigungslinks (#76, F1 #9): erst der Knopf löst die Bestätigung aus (`bereit`), danach „Danke“.
 * Eigenes Bauteil, damit der Ablauf ohne Browser prüfbar ist (tests/kalender-f1-rest.test.ts).
 */
export function MailBestaetigen({ sicht, fehler, laeuft, bereit, onBestaetigen }: { sicht: Sicht | null; fehler: string; laeuft: boolean; bereit: boolean; onBestaetigen: () => void }) {
  return (
    <main style={seite}>
      <div style={{ ...rahmen, maxWidth: 560 }}>
        <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.12em', color: AKZENT, fontWeight: 700 }}>E-Mail-Adresse bestätigen</span>
        <section style={{ ...karte, display: 'grid', gap: 12 }}>
          {bereit && !laeuft && !fehler && (
            <>
              <h1 style={titel}>Ist das Ihre E-Mail-Adresse?</h1>
              <p style={{ ...leise, margin: 0 }}>Mit einem Klick bestätigen Sie, dass die Adresse zu Ihrer Terminanfrage Ihnen gehört.</p>
            </>
          )}
          {bereit && <button onClick={onBestaetigen} disabled={laeuft} aria-busy={laeuft} style={{ ...knopf(!laeuft), justifySelf: 'start' }}>{laeuft ? 'Wird bestätigt …' : 'E-Mail-Adresse bestätigen'}</button>}
          {!laeuft && sicht && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: C.gut }} /><span style={{ fontSize: 13, color: C.gut, fontWeight: 700 }}>Danke — Ihre E-Mail-Adresse ist bestätigt.</span></div>
              <h1 style={titel}>{sicht.titel}</h1>
              <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{zeitText(sicht.start, sicht.ende)}</div>
              <p style={{ ...leise, margin: 0 }}>Den Stand Ihrer Anfrage sehen Sie weiter über Ihren persönlichen Link von der Buchung.</p>
            </>
          )}
          {!laeuft && !sicht && fehler && <><h1 style={titel}>Nicht bestätigt</h1><p role="alert" style={leise}>{fehler}</p></>}
          {sicht?.verantwortlich && <span style={klein}>Verantwortlich: {sicht.verantwortlich}</span>}
        </section>
      </div>
    </main>
  );
}
