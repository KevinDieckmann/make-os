'use client';

// ─── MAKE OS — Anmelde-Adressen (03.10.) ────────────────────────────────────
// Hauptadresse + bis zu drei weitere: alle melden im selben Konto an (selbes Passwort, selber zweiter Faktor). Jede Änderung
// braucht das aktuelle Passwort und — ist der zweite Faktor an — den Code (18.10., L3 B4) — je ein Feld für alle Schritte, beide werden nach
// jedem gelungenen Schritt geleert. Der Server
// (`/api/konto/adressen`) prüft Passwort, Eindeutigkeit und „nie die Hauptadresse entfernen“; hier steht nur die Bedienung.
// Am Handy: Eingaben 16 px, Tippziele ≥ 44 px (Regeln `.konto-adressen` in app/globals.css).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Feldzeile, feld, LEUCHT } from './ui';

const MAX_WEITERE = 3;

export function AnmeldeAdressen({ email, weitere, zweiterFaktor = false, i = 1, geaendert }: { email: string; weitere: string[]; zweiterFaktor?: boolean; i?: number; geaendert: () => void }) {
  const [neu, setNeu] = useState('');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);

  async function senden(aktion: 'hinzu' | 'haupt' | 'weg', adresse: string, ok: string) {
    setMeldung(null);
    const r = await fetch('/api/konto/adressen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion, email: adresse, passwort: pw, ...(zweiterFaktor ? { code } : {}) }) })
      .then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { setMeldung({ text: r.error, gut: false }); return; }
    setMeldung({ text: ok, gut: true }); setPw(''); setCode(''); if (aktion === 'hinzu') setNeu(''); geaendert();
  }

  const voll = weitere.length >= MAX_WEITERE;
  const ohnePw = !pw || (zweiterFaktor && !code.trim());
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.puls} erklaerung="konto.adressen" rechts={<span>{1 + weitere.length} von {1 + MAX_WEITERE}</span>}>Anmelde-Adressen</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}>Alle Adressen melden dich im selben Konto an — mit demselben Passwort und demselben zweiten Faktor. Jede Änderung bestätigst du mit deinem aktuellen Passwort{zweiterFaktor ? ' und dem Code aus der App' : ''}.</div>
      <div className="konto-adressen">
        <div className="konto-adresse">
          <div className="konto-adresse-text"><span style={{ fontSize: TYP.body, fontWeight: 500 }}>{email}</span><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Hauptadresse · Anzeige in MAKE OS</span></div>
        </div>
        {weitere.map(a => (
          <div className="konto-adresse" key={a}>
            <div className="konto-adresse-text"><span style={{ fontSize: TYP.body, fontWeight: 500 }}>{a}</span><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>weitere Adresse</span></div>
            <span className="konto-adresse-knoepfe">
              <Knopf leise aus={ohnePw} onClick={() => senden('haupt', a, 'Hauptadresse gewechselt.')}>Als Hauptadresse</Knopf>
              <Knopf leise aus={ohnePw} onClick={() => senden('weg', a, 'Adresse entfernt.')}>Entfernen</Knopf>
            </span>
          </div>
        ))}
      </div>
      <form className="konto-feldreihe" style={{ marginTop: 14 }} onSubmit={e => { e.preventDefault(); if (!(voll || !neu.trim() || ohnePw)) void senden('hinzu', neu, 'Adresse hinzugefügt.'); }}>
        <Feldzeile label={voll ? `Höchstens ${MAX_WEITERE} weitere Adressen` : 'Neue Anmelde-Adresse'}>
          <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={neu} disabled={voll} onChange={e => setNeu(e.target.value)} style={feld} autoComplete="off" />
        </Feldzeile>
        <Feldzeile label="Aktuelles Passwort zur Bestätigung">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={feld} autoComplete="current-password" />
        </Feldzeile>
        {zweiterFaktor && (
          <Feldzeile label="Code aus der App (oder Wiederherstellungscode)">
            <input value={code} onChange={e => setCode(e.target.value)} style={feld} autoComplete="one-time-code" />
          </Feldzeile>
        )}
        <Knopf typ="submit" aus={voll || !neu.trim() || ohnePw}>Hinzufügen</Knopf>
      </form>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.gut ? 'gut' : 'kritisch'}>{meldung.text}</Hinweis></div>}
    </Karte>
  );
}
