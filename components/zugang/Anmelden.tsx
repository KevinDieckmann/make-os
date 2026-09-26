'use client';

// ─── MAKE OS — Anmelden ─────────────────────────────────────────────────────
// Eine Karte, drei Zustände: anmelden · erstes Konto einrichten · mit
// Einladung beitreten. Welcher gilt, entscheidet der Server (gibt es schon
// Konten?), nicht der Browser.
//
// Gestaltung nach Kevins Ansage vom 23.09. („mehr an Whoop halten"): dunkel,
// eine Fläche, große ruhige Marke, nichts, was ablenkt.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, MIKRO } from '@/lib/make-one/design';
import { feld as feldBasis } from '@/components/os/schlank';

type Art = 'anmelden' | 'einrichten' | 'beitreten';

const feld: React.CSSProperties = { ...feldBasis, fontSize: 16, padding: '13px 15px' };

export function Anmelden() {
  const params = useSearchParams();
  // 24.09.: nach der Anmeldung direkt Heute — Jarvis ist ein Eintrag links, kein Vorspann.
  // Nur eigene Pfade — kein Open Redirect, kein javascript: (26.09.).
  const zuRoh = params.get('zu') ?? '';
  const zu = /^\/(?!\/)[^\s]*$/.test(zuRoh) ? zuRoh : '/os';
  // Einladungslink: /anmelden?code=XXXX-XXXX — der Code steht schon drin.
  const codeAusLink = (params.get('code') ?? '').toUpperCase();
  const [eingerichtet, setEingerichtet] = useState<boolean | null>(null);
  const [art, setArt] = useState<Art>('anmelden');
  const [f, setF] = useState({ email: '', passwort: '', name: '', schluessel: '', code: codeAusLink, faktor: '' });
  // Zweiter Faktor (26.09.): Passwort stimmt, der Server will noch den Code aus der App.
  const [zweiter, setZweiter] = useState(false);
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    // Schon angemeldet? Dann gleich weiter — die Maske wäre nur im Weg.
    fetch('/api/konto/ich').then(r => (r.ok ? r.json() : null)).then(d => { if (d?.ich) window.location.assign(zu); }).catch(() => {});
    fetch('/api/konto/status').then(r => r.json()).then(d => {
      setEingerichtet(!!d.eingerichtet);
      if (!d.eingerichtet) setArt('einrichten');
      else if (codeAusLink) setArt('beitreten');
    }).catch(() => setEingerichtet(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function los(e: React.FormEvent) {
    e.preventDefault();
    setFehler(''); setLaeuft(true);
    const pfad = art === 'anmelden' ? '/api/konto/anmelden' : art === 'einrichten' ? '/api/konto/einrichten' : '/api/konto/beitreten';
    try {
      const body = art === 'anmelden' ? { email: f.email, passwort: f.passwort, ...(zweiter ? { code: f.faktor } : {}) } : f;
      const r = await fetch(pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || d.error) { setFehler(d.error ?? `Fehler ${r.status}`); setLaeuft(false); return; }
      if (d.zweiterFaktor) { setZweiter(true); setLaeuft(false); return; }
      // Volles Neuladen, kein Seitenwechsel im Browser: die Datenkontexte (Aufgaben,
      // Kalender) starten sonst ohne Sitzung und zeigten den Beispiel-Zustand. (23.09.)
      window.location.assign(zu);
    } catch { setFehler('Der Server ist nicht erreichbar.'); setLaeuft(false); }
  }

  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  return (
    <div style={{ minHeight: '100dvh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text, display: 'grid', placeItems: 'center', padding: A.l }}>
      <form onSubmit={los} className="karte os-auf" style={{ width: 'min(420px, 100%)', display: 'flex', flexDirection: 'column', gap: A.m, padding: '30px 28px 26px' }}>
        <div style={{ textAlign: 'center', marginBottom: A.l }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: SCHRIFT.display, fontSize: 30, fontWeight: 700, letterSpacing: '-.025em', color: C.ink }}><span className="zeit-puls" style={{ width: 10, height: 10, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 12px ${C.aktiv}33` }} />MAKE OS</div>
          <div style={{ ...MIKRO, marginTop: 4 }}>
            {art === 'anmelden' ? 'Anmelden' : art === 'einrichten' ? 'Erstes Konto einrichten' : 'Mit Einladung beitreten'}
          </div>
        </div>

        {eingerichtet === null && <div style={{ ...MIKRO, textAlign: 'center' }}>einen Moment …</div>}

        {art === 'einrichten' && (
          <>
            <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: 0 }}>
              Es gibt noch kein Konto. Das erste ist der Inhaber — es darf später andere einladen. Zum Beweis, dass du diese Installation besitzt, einmal den Schlüssel aus <code>.env.local</code>.
            </p>
            <input type="password" placeholder="MAKE_OS_KEY" value={f.schluessel} onChange={s('schluessel')} style={feld} autoComplete="off" />
          </>
        )}
        {art === 'beitreten' && (<>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: 0 }}>
            Dein Vorname wird der Name deiner Daten — wer schon Bestände hier hat, nimmt genau den Vornamen, unter dem sie liegen.
          </p>
          <input placeholder="Einladungscode (XXXX-XXXX)" value={f.code} onChange={s('code')} style={{ ...feld, fontFamily: SCHRIFT.mono, letterSpacing: '.1em', textTransform: 'uppercase' }} autoComplete="off" />
        </>)}
        {art !== 'anmelden' && (
          <input placeholder="Dein Vorname (wird der Name deiner Daten)" value={f.name} onChange={s('name')} style={feld} autoComplete="given-name" />
        )}
        <input type="email" placeholder="E-Mail" value={f.email} onChange={s('email')} style={feld} autoComplete="email" autoFocus />
        <input type="password" placeholder={art === 'anmelden' ? 'Passwort' : 'Passwort (mindestens 10 Zeichen)'} value={f.passwort} onChange={s('passwort')} style={feld} autoComplete={art === 'anmelden' ? 'current-password' : 'new-password'} />

        {zweiter && (
          <>
            <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: 0 }}>Zweiter Faktor: den Sechssteller aus deiner Authenticator-App — oder einen Wiederherstellungscode.</p>
            <input placeholder="Code" value={f.faktor} onChange={s('faktor')} style={{ ...feld, fontFamily: SCHRIFT.mono, letterSpacing: '.15em' }} autoComplete="one-time-code" inputMode="numeric" autoFocus />
          </>
        )}
        {fehler && <div style={{ fontSize: TYP.bedien, color: C.kritisch, lineHeight: 1.4 }}>{fehler}</div>}

        <button type="submit" disabled={laeuft || eingerichtet === null} className="fassbar" style={{
          fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, padding: '13px', borderRadius: 12, border: 'none', marginTop: A.s,
          cursor: laeuft ? 'default' : 'pointer', background: laeuft ? 'rgba(255,255,255,.08)' : C.aktiv, color: laeuft ? C.inkLeise : C.grund,
          boxShadow: laeuft ? undefined : `0 8px 24px -8px ${C.aktiv}99`,
        }}>
          {laeuft ? '…' : art === 'anmelden' ? (zweiter ? 'Bestätigen' : 'Anmelden') : art === 'einrichten' ? 'Konto anlegen' : 'Beitreten'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'center', gap: A.l, marginTop: A.s, fontSize: TYP.bedien }}>
          {eingerichtet && art !== 'anmelden' && <button type="button" onClick={() => setArt('anmelden')} style={link}>Ich habe ein Konto</button>}
          {eingerichtet && art !== 'beitreten' && <button type="button" onClick={() => setArt('beitreten')} style={link}>Ich habe eine Einladung</button>}
        </div>
      </form>
    </div>
  );
}

const link: React.CSSProperties = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 };
