'use client';

// ─── Newsletter-Anmeldung über die Website — die Seite für Gäste (30.10., Branch `newsletter-anmeldung`) ──────────────────────────────
// Hell wie Check und Buchung (components/buchen/hell.ts: Papier und Tinte, eine Schrift, große Klickziele, eine Spalte), Sie-Form.
// Zwei Zustände: das Formular (E-Mail Pflicht, Vorname freiwillig, Häkchen mit dem Wortlaut der Einwilligung — NICHT vorausgewählt, Honigtopf,
// Datenschutz in Kürze) und die Bestätigung über `#t=<token>`: das Token verschwindet sofort aus der Adresszeile und geht erst mit dem Klick
// auf „Anmeldung bestätigen“ an den Server (F1 #9 der Buchung: Mail-Programme und Virenscanner öffnen Links vorab). Alle Antworten sind neutral
// (lib/newsletter/regeln.ts) — die Seite verrät nie, ob eine Adresse schon bekannt ist.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { C, AKZENT, seite, seiteKlasse, rahmen, karte, titel, leise, klein, feld, label, knopf } from '@/components/buchen/hell';
import { LINK_UNGUELTIG, TOKEN_OK, TOKEN_TAGE } from '@/lib/newsletter/regeln';

interface Props { marke: string; wortlaut: string; fassung: string; hinweis: { zeilen: string[]; link: string | null }; stempel: string }

type Modus = { art: 'formular' } | { art: 'gesendet'; text: string } | { art: 'bestaetigen'; token: string } | { art: 'bestaetigt'; text: string } | { art: 'link-kaputt' };

/** Was im Fragment steht: `#t=<token>` (Bestätigung) — oder nichts Brauchbares. Rein (für Tests ohne Browser). */
export function fragmentLesen(hash: string): { art: 'token'; token: string } | { art: 'kaputt' } | { art: 'leer' } {
  const roh = hash.replace(/^#/, '');
  if (!roh) return { art: 'leer' };
  if (!roh.startsWith('t=')) return { art: 'leer' };
  const t = roh.slice(2);
  return TOKEN_OK.test(t) ? { art: 'token', token: t } : { art: 'kaputt' };
}

async function senden(body: Record<string, unknown>): Promise<{ ok: boolean; text?: string; fehler?: string }> {
  try {
    const r = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? { ok: true, text: String(j.text ?? '') } : { ok: false, fehler: String(j.fehler ?? 'Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal.') };
  } catch { return { ok: false, fehler: 'Keine Verbindung — bitte noch einmal versuchen.' }; }
}

const FALLE = { position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' } as const;

export function NewsletterAnmeldung({ marke, wortlaut, fassung, hinweis, stempel }: Props) {
  const [modus, setModus] = useState<Modus>({ art: 'formular' });
  const [email, setEmail] = useState('');
  const [vorname, setVorname] = useState('');
  const [haken, setHaken] = useState(false);
  const [falle, setFalle] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  const gestartet = useRef(false);
  useEffect(() => {
    // Nur einmal (auch im Strict-Mode der Entwicklung): ein Token gilt genau einmal.
    if (gestartet.current) return;
    gestartet.current = true;
    const f = fragmentLesen(window.location.hash);
    if (f.art === 'leer') return;
    // Das Token verschwindet aus der Adresszeile (Lesezeichen, geteilter Bildschirm) — es bleibt nur im Speicher der Seite.
    try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); } catch { /* egal */ }
    setModus(f.art === 'token' ? { art: 'bestaetigen', token: f.token } : { art: 'link-kaputt' });
  }, []);

  const anmelden = async (e: FormEvent) => {
    e.preventDefault();
    if (laeuft) return;
    setFehler('');
    if (!haken) { setFehler('Bitte setzen Sie das Häkchen — ohne Ihre Einwilligung können wir Ihnen den Newsletter nicht schicken.'); return; }
    setLaeuft(true);
    const r = await senden({ aktion: 'anmelden', email, vorname, einwilligung: true, fassung, stempel, webseite: falle });
    setLaeuft(false);
    if (r.ok) setModus({ art: 'gesendet', text: r.text ?? '' }); else setFehler(r.fehler ?? '');
  };

  const bestaetigen = async (e: FormEvent) => {
    e.preventDefault();
    if (modus.art !== 'bestaetigen' || laeuft) return;
    setFehler('');
    setLaeuft(true);
    const r = await senden({ aktion: 'bestaetigen', token: modus.token });
    setLaeuft(false);
    if (r.ok) setModus({ art: 'bestaetigt', text: r.text ?? '' }); else setFehler(r.fehler ?? LINK_UNGUELTIG);
  };

  const kopf = <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.12em', color: C.ink, fontWeight: 650 }}>{marke}</span>;

  return (
    <main className={seiteKlasse} style={seite}>
      <div style={{ ...rahmen, maxWidth: 560 }}>
        {kopf}
        {modus.art === 'formular' && (
          <section style={{ ...karte, display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <h1 style={titel}>Newsletter</h1>
              <p style={{ ...leise, margin: 0 }}>Tragen Sie Ihre E-Mail-Adresse ein. Sie bekommen danach eine Mail mit einem Link — erst mit Ihrer Bestätigung sind Sie angemeldet.</p>
            </div>
            <form onSubmit={e => void anmelden(e)} style={{ display: 'grid', gap: 14 }} noValidate>
              <label style={label}>
                E-Mail-Adresse
                <input type="email" name="email" required autoComplete="email" inputMode="email" maxLength={160} value={email} onChange={e => setEmail(e.target.value)} style={feld} />
              </label>
              <label style={label}>
                Vorname (freiwillig)
                <input type="text" name="vorname" autoComplete="given-name" maxLength={60} value={vorname} onChange={e => setVorname(e.target.value)} style={feld} />
              </label>
              {/* Honigtopf: für Menschen unsichtbar, ein Programm füllt ihn aus. */}
              <div aria-hidden="true" style={FALLE}>
                <label>Webseite <input type="text" name="webseite" tabIndex={-1} autoComplete="off" value={falle} onChange={e => setFalle(e.target.value)} /></label>
              </div>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, lineHeight: 1.55, color: C.ink, cursor: 'pointer' }}>
                <input type="checkbox" checked={haken} onChange={e => setHaken(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, flex: '0 0 22px', accentColor: AKZENT }} />
                <span style={{ whiteSpace: 'pre-line' }}>{wortlaut}</span>
              </label>
              {fehler && <p role="alert" style={{ color: C.achtung, fontSize: 14, margin: 0 }}>{fehler}</p>}
              <div><button type="submit" disabled={laeuft} aria-busy={laeuft} style={knopf(!laeuft)}>{laeuft ? 'Wird gesendet …' : 'Anmelden'}</button></div>
            </form>
            <Datenschutz hinweis={hinweis} />
          </section>
        )}
        {modus.art === 'gesendet' && (
          <section style={{ ...karte, display: 'grid', gap: 10 }}>
            <h1 style={titel}>Bitte bestätigen</h1>
            <p style={{ ...leise, margin: 0 }}>{modus.text}</p>
            <p style={{ ...klein, margin: 0 }}>Keine Mail da? Schauen Sie bitte auch im Spam-Ordner nach. Der Link gilt {TOKEN_TAGE} Tage.</p>
          </section>
        )}
        {modus.art === 'bestaetigen' && (
          <section style={{ ...karte, display: 'grid', gap: 12 }}>
            <h1 style={titel}>Anmeldung bestätigen</h1>
            <p style={{ ...leise, margin: 0 }}>Mit einem Klick bestätigen Sie, dass Sie den Newsletter von {marke} an diese Adresse bekommen möchten.</p>
            <form onSubmit={e => void bestaetigen(e)}>
              <button type="submit" disabled={laeuft} aria-busy={laeuft} style={knopf(!laeuft)}>{laeuft ? 'Wird bestätigt …' : 'Anmeldung bestätigen'}</button>
            </form>
            {fehler && <p role="alert" style={{ ...leise, margin: 0, color: C.achtung }}>{fehler}</p>}
          </section>
        )}
        {modus.art === 'bestaetigt' && (
          <section style={{ ...karte, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: C.gut }} /><span style={{ fontSize: 13, color: C.gut, fontWeight: 700 }}>Angemeldet</span></div>
            <h1 style={titel}>Danke!</h1>
            <p style={{ ...leise, margin: 0 }}>{modus.text}</p>
          </section>
        )}
        {modus.art === 'link-kaputt' && (
          <section style={{ ...karte, display: 'grid', gap: 10 }}>
            <h1 style={titel}>Nicht bestätigt</h1>
            <p role="alert" style={{ ...leise, margin: 0 }}>{LINK_UNGUELTIG}</p>
            <div><button type="button" onClick={() => { setFehler(''); setModus({ art: 'formular' }); }} style={knopf(true, true)}>Zur Anmeldung</button></div>
          </section>
        )}
      </div>
    </main>
  );
}

function Datenschutz({ hinweis }: { hinweis: Props['hinweis'] }) {
  return (
    <details open style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 10 }}>
      <summary style={{ ...klein, color: C.ink, cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Datenschutz in Kürze</summary>
      <div style={{ display: 'grid', gap: 6 }}>
        {hinweis.zeilen.map((z, i) => <p key={i} style={{ ...klein, margin: 0 }}>{z}</p>)}
        {hinweis.link && <a href={hinweis.link} target="_blank" rel="noopener noreferrer" style={{ ...klein, color: C.ink, fontWeight: 600 }}>Datenschutzerklärung</a>}
      </div>
    </details>
  );
}
