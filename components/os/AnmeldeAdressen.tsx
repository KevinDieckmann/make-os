'use client';

// ─── MAKE OS — Anmelde-Adressen (03.10.) ────────────────────────────────────
// Hauptadresse + bis zu drei weitere: alle melden im selben Konto an (selbes Passwort, selber zweiter Faktor). Jede Änderung
// braucht das aktuelle Passwort — ein Feld für alle Schritte, es wird nach jedem gelungenen Schritt geleert. Der Server
// (`/api/konto/adressen`) prüft Passwort, Eindeutigkeit und „nie die Hauptadresse entfernen“; hier steht nur die Bedienung.
// Am Handy: Eingaben 16 px, Tippziele ≥ 44 px (Regeln `.konto-adressen` in app/globals.css).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, feld, LEUCHT } from './schlank';

const MAX_WEITERE = 3;

export function AnmeldeAdressen({ email, weitere, i = 1, geaendert }: { email: string; weitere: string[]; i?: number; geaendert: () => void }) {
  const [neu, setNeu] = useState('');
  const [pw, setPw] = useState('');
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);

  async function senden(aktion: 'hinzu' | 'haupt' | 'weg', adresse: string, ok: string) {
    setMeldung(null);
    const r = await fetch('/api/konto/adressen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion, email: adresse, passwort: pw }) })
      .then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.error) { setMeldung({ text: r.error, gut: false }); return; }
    setMeldung({ text: ok, gut: true }); setPw(''); if (aktion === 'hinzu') setNeu(''); geaendert();
  }

  const voll = weitere.length >= MAX_WEITERE;
  const ohnePw = !pw;
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={<span>{1 + weitere.length} von {1 + MAX_WEITERE}</span>}>Anmelde-Adressen</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, marginBottom: 6 }}>Alle Adressen melden dich im selben Konto an — mit demselben Passwort und demselben zweiten Faktor. Jede Änderung bestätigst du mit deinem aktuellen Passwort.</div>
      <div className="konto-adressen">
        <div className="konto-adresse">
          <div className="konto-adresse-text"><span style={{ fontSize: TYP.body, fontWeight: 500 }}>{email}</span><span style={{ fontSize: 12.5, color: C.inkLeise }}>Hauptadresse · Anzeige in MAKE OS</span></div>
        </div>
        {weitere.map(a => (
          <div className="konto-adresse" key={a}>
            <div className="konto-adresse-text"><span style={{ fontSize: TYP.body, fontWeight: 500 }}>{a}</span><span style={{ fontSize: 12.5, color: C.inkLeise }}>weitere Adresse</span></div>
            <span className="konto-adresse-knoepfe">
              <Knopf leise aus={ohnePw} onClick={() => senden('haupt', a, 'Hauptadresse gewechselt.')}>Als Hauptadresse</Knopf>
              <Knopf leise aus={ohnePw} onClick={() => senden('weg', a, 'Adresse entfernt.')}>Entfernen</Knopf>
            </span>
          </div>
        ))}
      </div>
      <div className="konto-adressen-neu">
        <input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={voll ? `Höchstens ${MAX_WEITERE} weitere Adressen` : 'Adresse hinzufügen'} aria-label="Neue Anmelde-Adresse" value={neu} disabled={voll}
          onChange={e => setNeu(e.target.value)} style={feld} autoComplete="off" />
        <input type="password" placeholder="aktuelles Passwort" aria-label="Aktuelles Passwort zur Bestätigung" value={pw} onChange={e => setPw(e.target.value)} style={feld} autoComplete="current-password" />
        <Knopf onClick={() => senden('hinzu', neu, 'Adresse hinzugefügt.')} aus={voll || !neu.trim() || ohnePw}>Hinzufügen</Knopf>
      </div>
      {meldung && <div role="status" style={{ fontSize: TYP.bedien, marginTop: 10, color: meldung.gut ? LEUCHT.gut : LEUCHT.kritisch }}>{meldung.text}</div>}
    </Karte>
  );
}
