'use client';

// ─── Öffentliche Buchungsseite — Status des Gastes (29.09., Paket K4) ────────
// Das Token steht im Fragment der Adresse (#…) und geht nur im Körper an den Server. Hier: bestätigen (vorläufig →
// angefragt), sehen (angefragt · bestätigt mit Ort · abgelehnt mit Grund · abgesagt · abgelaufen), absagen.

import { useEffect, useState } from 'react';
import { C, AKZENT, seite, rahmen, karte, titel, leise, klein, knopf, zeitText } from './stil';

type Status = 'vorlaeufig' | 'angefragt' | 'bestaetigt' | 'abgelehnt' | 'abgesagt' | 'abgelaufen';
interface Sicht { status: Status; titel: string; start: string; ende: string; reserviertBis?: string; ort?: string; grund?: string; verantwortlich?: string }

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

  const senden = async (aktion: 'ansehen' | 'bestaetigen' | 'absagen', t = token) => {
    if (!t) return;
    setLaeuft(true); setFehler('');
    try {
      const r = await fetch(`/api/buchung/${slug}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, aktion }) });
      const j = await r.json().catch(() => ({ ok: false }));
      if (r.ok && j.ok) setSicht(j.sicht); else setFehler(j.fehler ?? 'Das hat nicht geklappt.');
    } catch { setFehler('Keine Verbindung — bitte noch einmal.'); }
    setLaeuft(false);
  };

  useEffect(() => {
    const t = window.location.hash.replace(/^#/, '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(t)) { setFehler('Dieser Link ist unvollständig. Bitte den vollständigen Link Ihrer Anfrage öffnen.'); return; }
    setToken(t);
    void senden('ansehen', t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const kopieren = async () => { try { await navigator.clipboard.writeText(window.location.href); setKopiert(true); } catch { /* egal */ } };
  const t = sicht ? TEXT[sicht.status] : null;

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
            <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{zeitText(sicht.start, sicht.ende)}</div>
            <p style={{ ...leise, margin: 0 }}>{t.satz}</p>
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
              {sicht.verantwortlich && <span>Verantwortlich: {sicht.verantwortlich}</span>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
