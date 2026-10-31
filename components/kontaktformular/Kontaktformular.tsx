'use client';

// ─── Kontaktformular der Website — die Seite für Gäste (31.10., Website-Anbau) ─────────────────────────────────────────────────────────
// Hell wie Check, Buchung und Newsletter (components/buchen/hell.ts), Sie-Form, eine Spalte, große Klickziele. Felder: Vorname (Pflicht), Nachname,
// Firma, E-Mail (Pflicht), Telefon, Nachricht (Pflicht); Honigtopf; Datenschutz in Kürze. KEINE Werbe-Einwilligung, kein Newsletter-Häkchen — wer
// den Newsletter möchte, meldet sich dort an. Die Antwort ist immer dieselbe (verrät nie, was die Kartei kennt). Zoe begleitet mit festen Texten.

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { C, seite, seiteKlasse, rahmen, karte, titel, leise, klein, feld, label, knopf } from '@/components/buchen/hell';
import { GRENZEN } from '@/lib/kontaktformular/regeln';
import { ZoeBegleiterin } from '@/components/oeffentlich/ZoeBegleiterin';

interface Props {
  marke: string; gastgeber: string;
  hinweis: { zeilen: string[]; link: string | null };
  erstgespraech: string | null;
  website: string | null;
  stempel: string;
}

const FALLE = { position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' } as const;
const leer = { vorname: '', nachname: '', firma: '', email: '', telefon: '', nachricht: '' };

export function Kontaktformular({ marke, gastgeber, hinweis, erstgespraech, website, stempel }: Props) {
  const [w, setW] = useState(leer);
  const [falle, setFalle] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [danke, setDanke] = useState<string | null>(null);
  const setze = (k: keyof typeof leer) => (e: { target: { value: string } }) => setW(x => ({ ...x, [k]: e.target.value }));

  const senden = async (e: FormEvent) => {
    e.preventDefault();
    if (laeuft) return;
    setFehler('');
    if (!w.vorname.trim() || !w.email.trim() || !w.nachricht.trim()) { setFehler('Bitte Vorname, E-Mail-Adresse und Ihre Nachricht angeben.'); return; }
    setLaeuft(true);
    try {
      const r = await fetch('/api/anfrage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...w, stempel, webseite: falle }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) setDanke(String(j.text ?? '')); else setFehler(String(j.fehler ?? 'Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal.'));
    } catch { setFehler('Keine Verbindung — bitte noch einmal versuchen.'); }
    setLaeuft(false);
  };

  return (
    <main className={seiteKlasse} style={seite}>
      <div style={{ ...rahmen, maxWidth: 620 }}>
        {website ? <a href={website} style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.12em', color: C.ink, fontWeight: 650, textDecoration: 'none' }}>{marke}</a>
          : <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.12em', color: C.ink, fontWeight: 650 }}>{marke}</span>}
        {danke === null ? (
          <section style={{ ...karte, display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <h1 style={titel}>Nachricht schreiben</h1>
              <p style={{ ...leise, margin: 0 }}>Erzählen Sie kurz, worum es geht — wir melden uns persönlich.</p>
              {erstgespraech && <p style={{ ...klein, margin: 0 }}>Lieber gleich einen Termin? <Link href={erstgespraech} style={{ color: C.ink, fontWeight: 600 }}>Erstgespräch buchen</Link></p>}
            </div>
            <form onSubmit={e => void senden(e)} style={{ display: 'grid', gap: 14 }} noValidate>
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <label style={label}>Vorname<input type="text" name="vorname" required autoComplete="given-name" maxLength={GRENZEN.vorname} value={w.vorname} onChange={setze('vorname')} style={feld} /></label>
                <label style={label}>Nachname (freiwillig)<input type="text" name="nachname" autoComplete="family-name" maxLength={GRENZEN.nachname} value={w.nachname} onChange={setze('nachname')} style={feld} /></label>
              </div>
              <label style={label}>E-Mail-Adresse<input type="email" name="email" required autoComplete="email" inputMode="email" maxLength={GRENZEN.email} value={w.email} onChange={setze('email')} style={feld} /></label>
              <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <label style={label}>Firma (freiwillig)<input type="text" name="firma" autoComplete="organization" maxLength={GRENZEN.firma} value={w.firma} onChange={setze('firma')} style={feld} /></label>
                <label style={label}>Telefon (freiwillig)<input type="tel" name="telefon" autoComplete="tel" inputMode="tel" maxLength={GRENZEN.telefon} value={w.telefon} onChange={setze('telefon')} style={feld} /></label>
              </div>
              <label style={label}>Ihre Nachricht<textarea name="nachricht" required rows={6} maxLength={GRENZEN.nachricht} value={w.nachricht} onChange={setze('nachricht')} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></label>
              {/* Honigtopf: für Menschen unsichtbar, ein Programm füllt ihn aus. */}
              <div aria-hidden="true" style={FALLE}>
                <label>Webseite <input type="text" name="webseite" tabIndex={-1} autoComplete="off" value={falle} onChange={e => setFalle(e.target.value)} /></label>
              </div>
              {fehler && <p role="alert" style={{ color: C.achtung, fontSize: 14, margin: 0 }}>{fehler}</p>}
              <div><button type="submit" disabled={laeuft} aria-busy={laeuft} style={knopf(!laeuft)}>{laeuft ? 'Wird gesendet …' : 'Nachricht senden'}</button></div>
            </form>
            <details open style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 10 }}>
              <summary style={{ ...klein, color: C.ink, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Datenschutz in Kürze</summary>
              <div style={{ display: 'grid', gap: 6 }}>
                {hinweis.zeilen.map((z, i) => <p key={i} style={{ ...klein, margin: 0 }}>{z}</p>)}
                {hinweis.link && <a href={hinweis.link} target="_blank" rel="noopener noreferrer" style={{ ...klein, color: C.ink, fontWeight: 600 }}>Datenschutzerklärung</a>}
              </div>
            </details>
          </section>
        ) : (
          <section style={{ ...karte, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: C.gut }} /><span style={{ fontSize: 13, color: C.gut, fontWeight: 700 }}>Gesendet</span></div>
            <h1 style={titel}>Danke!</h1>
            <p style={{ ...leise, margin: 0 }}>{danke}</p>
            {erstgespraech && <div><Link href={erstgespraech} style={{ ...knopf(true, true), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Erstgespräch buchen</Link></div>}
          </section>
        )}
      </div>
      <ZoeBegleiterin ort="kontakt" schritt={danke === null ? 'formular' : 'gesendet'} marke={marke} gastgeber={gastgeber} erstgespraech={erstgespraech} />
    </main>
  );
}
