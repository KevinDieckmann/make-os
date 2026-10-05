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
import { eingabe as feldBasis } from '@/components/os/ui/felder';
import { personLesen, werVergessen } from '@/lib/make-one/arbeitsplatz-browser';

type Art = 'anmelden' | 'einrichten' | 'beitreten';

const feld: React.CSSProperties = { ...feldBasis, fontSize: 16, padding: '13px 15px' };

export function Anmelden() {
  const params = useSearchParams();
  // 24.09.: nach der Anmeldung direkt Heute — ZOE ist ein Eintrag links, kein Vorspann.
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
  // 2FA-Pflicht der Instanz (05.10.): Sitzung steht, aber bis zum zweiten Faktor geht nichts anderes (middleware.ts).
  const [zf, setZf] = useState<{ phase: 'code' | 'codes'; geheimnis?: string; link?: string; code: string; codes?: string[] } | null>(null);

  async function zfBeginnen() {
    setFehler('');
    const r = await fetch('/api/konto/zwei-faktor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'beginnen' }) }).then(x => x.json()).catch(() => ({ error: 'Der Server ist nicht erreichbar.' }));
    if (r.error) { setFehler(r.error); setZf({ phase: 'code', code: '' }); return; }
    setZf({ phase: 'code', geheimnis: r.geheimnis, link: r.link, code: '' });
  }
  async function zfBestaetigen(e: React.FormEvent) {
    e.preventDefault();
    if (!zf) return;
    setFehler(''); setLaeuft(true);
    const r = await fetch('/api/konto/zwei-faktor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'bestaetigen', code: zf.code }) }).then(x => x.json()).catch(() => ({ error: 'Der Server ist nicht erreichbar.' }));
    setLaeuft(false);
    if (r.error) { setFehler(r.error); return; }
    setZf({ phase: 'codes', code: '', codes: r.codes ?? [] });
  }

  useEffect(() => {
    // Schon angemeldet? Dann gleich weiter — die Maske wäre nur im Weg. Nur nachfragen, wenn der Namens-Zettel es nahelegt
    // (ohne Sitzung gäbe es nur ein 401 in der Konsole, 29.09.); antwortet der Server nein, den alten Zettel vergessen.
    if (personLesen()) {
      fetch('/api/konto/ich').then(r => { if (!r.ok) { werVergessen(); return null; } return r.json(); }).then(d => { if (d?.zweiterFaktorEinrichten) void zfBeginnen(); else if (d?.ich) window.location.assign(zu); }).catch(() => {});
    }
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
      const body = art === 'anmelden' ? { email: f.email, passwort: f.passwort, ...(zweiter ? { code: f.faktor } : {}) }
        : art === 'einrichten' ? { code: f.schluessel, email: f.email, name: f.name, passwort: f.passwort } : f;
      const r = await fetch(pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || d.error) { setFehler(d.error ?? `Fehler ${r.status}`); setLaeuft(false); return; }
      if (d.zweiterFaktor) { setZweiter(true); setLaeuft(false); return; }
      if (d.zweiterFaktorEinrichten) { setLaeuft(false); await zfBeginnen(); return; }
      // Volles Neuladen, kein Seitenwechsel im Browser: die Datenkontexte (Aufgaben,
      // Kalender) starten sonst ohne Sitzung und zeigten den Beispiel-Zustand. (23.09.)
      window.location.assign(zu);
    } catch { setFehler('Der Server ist nicht erreichbar.'); setLaeuft(false); }
  }

  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  const text: React.CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, margin: 0 };
  const knopf = (aus: boolean): React.CSSProperties => ({
    fontFamily: SCHRIFT.text, fontSize: TYP.body, fontWeight: 700, padding: '13px', borderRadius: 12, border: 'none', marginTop: A.s,
    cursor: aus ? 'default' : 'pointer', background: aus ? 'rgba(255,255,255,.08)' : C.aktiv, color: aus ? C.inkLeise : C.grund,
    boxShadow: aus ? undefined : `0 8px 24px -8px ${C.aktiv}99`,
  });

  if (zf) {
    const mono: React.CSSProperties = { fontFamily: SCHRIFT.mono, fontWeight: 700, color: C.aktiv, letterSpacing: '.1em' };
    return (
      <div style={{ minHeight: '100dvh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text, display: 'grid', placeItems: 'center', padding: A.l }}>
        <form onSubmit={zf.phase === 'code' ? zfBestaetigen : e => { e.preventDefault(); window.location.assign(zu); }} className="karte os-auf" style={{ width: 'min(440px, 100%)', display: 'flex', flexDirection: 'column', gap: A.m, padding: '30px 28px 26px' }}>
          <div style={{ textAlign: 'center', marginBottom: A.m }}>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em' }}>Zweiter Faktor</div>
            <div style={{ ...MIKRO, marginTop: 4 }}>Diese Instanz verlangt ihn für jedes Konto</div>
          </div>
          {zf.phase === 'code' && (<>
            <p style={text}>In der Passwörter- oder Authenticator-App (Apple Passwörter, Google Authenticator, 1Password) einen neuen Eintrag anlegen — am Handy über den Link, sonst den Schlüssel eintippen. Dann den Sechssteller hier bestätigen.</p>
            {zf.geheimnis && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ ...mono, fontSize: 15 }}>{zf.geheimnis.replace(/(.{4})/g, '$1 ').trim()}</code>
              {zf.link && <a href={zf.link} style={{ fontSize: TYP.bedien, color: C.aktiv }}>In der App öffnen ›</a>}
            </div>}
            <input placeholder="Sechsstelliger Code" value={zf.code} onChange={e => setZf(z => z && ({ ...z, code: e.target.value }))} style={{ ...feld, fontFamily: SCHRIFT.mono, letterSpacing: '.15em' }} autoComplete="one-time-code" inputMode="numeric" autoFocus />
          </>)}
          {zf.phase === 'codes' && (<>
            <p style={text}>Der zweite Faktor ist an. Diese acht Wiederherstellungscodes gelten je einmal, falls das Handy weg ist — jetzt in den Passwort-Manager, sie werden nie wieder angezeigt.</p>
            <div style={{ ...mono, fontSize: 15, lineHeight: 1.8, columns: 2 }}>{(zf.codes ?? []).map(c => <div key={c}>{c}</div>)}</div>
          </>)}
          {fehler && <div style={{ fontSize: TYP.bedien, color: C.kritisch, lineHeight: 1.4 }}>{fehler}</div>}
          <button type="submit" disabled={laeuft || (zf.phase === 'code' && (!zf.geheimnis || zf.code.replace(/\s/g, '').length !== 6))} className="fassbar" style={knopf(laeuft)}>
            {laeuft ? '…' : zf.phase === 'code' ? 'Bestätigen' : 'Ich habe sie gesichert — weiter'}
          </button>
          {zf.phase === 'code' && <div style={{ display: 'flex', justifyContent: 'center', gap: A.l, marginTop: A.s }}>
            {!zf.geheimnis && <button type="button" onClick={() => void zfBeginnen()} style={link}>Noch einmal versuchen</button>}
            <button type="button" onClick={() => { void fetch('/api/konto/abmelden', { method: 'POST' }).finally(() => { werVergessen(); window.location.assign('/anmelden'); }); }} style={link}>Abmelden</button>
          </div>}
        </form>
      </div>
    );
  }

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
              Es gibt noch kein Konto. Das erste ist der Inhaber — es darf später andere einladen. Zum Beweis, dass du diese Installation besitzt, den Einrichtungs-Code aus dem Terminal: <code>node scripts/einrichtung-token.mjs</code> (am Server mit <code>docker compose exec app</code> davor). Er gilt einmal.
            </p>
            <input placeholder="Einrichtungs-Code (XXXX-XXXX-XXXX-XXXX-XXXX)" value={f.schluessel} onChange={s('schluessel')} style={{ ...feld, fontFamily: SCHRIFT.mono, letterSpacing: '.08em', textTransform: 'uppercase' }} autoComplete="off" spellCheck={false} />
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

        <button type="submit" disabled={laeuft || eingerichtet === null} className="fassbar" style={knopf(laeuft)}>
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
