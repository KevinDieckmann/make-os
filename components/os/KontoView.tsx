'use client';

// ─── MAKE OS — Mein Konto ───────────────────────────────────────────────────
// Name, Passwort, wem ich meine Gesundheitsdaten zeige — und für den Inhaber:
// Einladungen. Das ist die Seite, die aus „Kevin & Malin" ein Produkt macht.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS, MIKRO } from '@/lib/make-one/design';
import { Seitenkopf } from './Seitenkopf';

interface Ich { speicher: string; email: string; name: string; rolle: 'inhaber' | 'mitglied'; teilt: { gesundheit: string[] }; angelegt: string }
interface Andere { speicher: string; name: string; rolle: string; teiltGesundheitMitMir: boolean }

const feld: React.CSSProperties = { background: C.grund, border: `1px solid ${C.linie}`, borderRadius: RADIUS.bauteil, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, padding: '10px 12px', outline: 'none', width: '100%' };
const karte: React.CSSProperties = { background: C.flaeche, border: `1px solid ${C.linie}`, borderRadius: RADIUS.behaelter, padding: `${A.l}px ${A.xl}px` };
const knopf = (voll = true): React.CSSProperties => ({ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 16px', borderRadius: RADIUS.bauteil, cursor: 'pointer', border: voll ? 'none' : `1px solid ${C.linie}`, background: voll ? C.aktiv : 'transparent', color: voll ? C.grund : C.inkDim });

export function KontoView() {
  const router = useRouter();
  const [ich, setIch] = useState<Ich | null>(null);
  const [andere, setAndere] = useState<Andere[]>([]);
  const [name, setName] = useState('');
  const [pw, setPw] = useState({ alt: '', neu: '' });
  const [meldung, setMeldung] = useState('');
  const [einladung, setEinladung] = useState<{ code: string; stunden: number } | null>(null);
  const [tg, setTg] = useState<{ konfiguriert: boolean; bot?: string; chats: number; code?: string; minuten?: number; fehler?: string } | null>(null);
  const ladeTg = () => fetch('/api/telegram/koppeln').then(r => r.json()).then(d => setTg(t => ({ ...d, code: t?.code, minuten: t?.minuten }))).catch(() => {});
  useEffect(() => { void ladeTg(); }, []);
  async function tgCode() {
    const r = await fetch('/api/telegram/koppeln', { method: 'POST' }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setTg(t => ({ ...(t ?? { konfiguriert: true, chats: 0 }), ...(r.error ? { fehler: r.error } : { code: r.code, minuten: r.minuten, bot: r.bot }) }));
  }
  async function tgWeg() { await fetch('/api/telegram/koppeln', { method: 'DELETE' }).catch(() => {}); setTg(null); void ladeTg(); }

  const laden = () => fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) { setIch(d.ich); setName(d.ich.name); setAndere(d.andere ?? []); } }).catch(() => {});
  useEffect(() => { void laden(); }, []);

  async function speichern(body: Record<string, unknown>, ok: string) {
    setMeldung('');
    const r = await fetch('/api/konto/ich', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(r.error ?? ok); if (!r.error) { setPw({ alt: '', neu: '' }); void laden(); }
  }
  async function teilen(speicher: string, an: boolean) {
    if (!ich) return;
    const liste = an ? [...ich.teilt.gesundheit, speicher] : ich.teilt.gesundheit.filter(s => s !== speicher);
    await fetch('/api/konto/teilen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gesundheit: liste }) }).catch(() => {});
    void laden();
  }
  async function einladen() {
    const r = await fetch('/api/konto/einladen', { method: 'POST' }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.code) setEinladung({ code: r.code, stunden: r.stunden }); else setMeldung(r.error ?? 'Fehler');
  }
  async function abmelden() {
    await fetch('/api/konto/abmelden', { method: 'POST' }).catch(() => {});
    router.replace('/anmelden');
  }

  if (!ich) return <div style={{ padding: A.xl, ...MIKRO }}>lade …</div>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: `26px clamp(16px,3vw,36px) 56px`, color: C.ink, fontFamily: SCHRIFT.text }}>
      <Seitenkopf rubrik={<>Konto · {ich.rolle === 'inhaber' ? 'Inhaber' : 'Mitglied'}</>} titel={<>{ich.name}</>} satz={<>{ich.email} · deine Daten liegen unter <code>{ich.speicher}</code>.</>}
        rechts={<button onClick={abmelden} className="fassbar" style={knopf(false)}>Abmelden</button>} />

      <div style={{ display: 'grid', gap: A.m }}>
        <div style={karte}>
          <div style={MIKRO}>Name</div>
          <div style={{ display: 'flex', gap: A.s, marginTop: A.s }}>
            <input value={name} onChange={e => setName(e.target.value)} style={feld} />
            <button onClick={() => speichern({ name }, 'Name gespeichert.')} className="fassbar" style={knopf()}>Speichern</button>
          </div>
        </div>

        <div style={karte}>
          <div style={MIKRO}>Passwort ändern</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: A.s, marginTop: A.s }}>
            <input type="password" placeholder="altes Passwort" value={pw.alt} onChange={e => setPw(p => ({ ...p, alt: e.target.value }))} style={feld} autoComplete="current-password" />
            <input type="password" placeholder="neues (min. 10 Zeichen)" value={pw.neu} onChange={e => setPw(p => ({ ...p, neu: e.target.value }))} style={feld} autoComplete="new-password" />
            <button onClick={() => speichern({ passwortAlt: pw.alt, passwortNeu: pw.neu }, 'Passwort geändert.')} className="fassbar" style={knopf()}>Ändern</button>
          </div>
        </div>

        <div style={karte}>
          <div style={MIKRO}>Gesundheit teilen</div>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: `${A.xs}px 0 ${A.m}px`, lineHeight: 1.5 }}>
            Wer deine Recovery, dein Journal, Haut und Streak sehen darf. Jede Person entscheidet das für sich.
          </p>
          {andere.length === 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch niemand sonst hier.</div>}
          {andere.map(a => {
            const an = ich.teilt.gesundheit.includes(a.speicher);
            return (
              <div key={a.speicher} style={{ display: 'flex', alignItems: 'center', gap: A.m, padding: `${A.s}px 0`, borderTop: `1px solid ${C.linieWeich}` }}>
                <span style={{ flex: 1, fontSize: TYP.body }}>{a.name} <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>· {a.teiltGesundheitMitMir ? 'teilt mit dir' : 'teilt nicht mit dir'}</span></span>
                <button onClick={() => teilen(a.speicher, !an)} className="fassbar" style={{ ...knopf(an), minWidth: 120 }}>{an ? 'sieht meine' : 'freigeben'}</button>
              </div>
            );
          })}
        </div>

        <div style={karte}>
          <div style={MIKRO}>Der Bote · Telegram</div>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: `${A.xs}px 0 ${A.m}px`, lineHeight: 1.5 }}>
            Jarvis schreibt dir morgens, mittags und abends aufs Handy; du antwortest mit einem Satz.
          </p>
          {!tg ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lade …</span>
          : !tg.konfiguriert ? <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Noch kein Bot: in Telegram @BotFather → /newbot, den Token als <code>TELEGRAM_BOT_TOKEN</code> in <code>.env.local</code>, neu starten.</span>
          : tg.chats > 0 ? <div style={{ display: 'flex', alignItems: 'center', gap: A.m }}><span style={{ fontSize: TYP.body, color: C.gut, fontWeight: 600 }}>Gekoppelt ✓</span><button onClick={tgWeg} className="fassbar" style={knopf(false)}>Entkoppeln</button></div>
          : tg.code ? <div style={{ fontSize: TYP.body }}>Dem Bot {tg.bot ? <b>@{tg.bot}</b> : ''} senden: <span style={{ fontFamily: SCHRIFT.mono, fontSize: 18, fontWeight: 700, color: C.aktiv }}>/start {tg.code}</span> <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>· {tg.minuten} Minuten gültig</span></div>
          : <button onClick={tgCode} className="fassbar" style={knopf()}>Code holen</button>}
          {tg?.fehler && <div style={{ fontSize: TYP.bedien, color: C.kritisch, marginTop: A.s }}>{tg.fehler}</div>}
        </div>

        {ich.rolle === 'inhaber' && (
          <div style={karte}>
            <div style={MIKRO}>Einladen</div>
            <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: `${A.xs}px 0 ${A.m}px`, lineHeight: 1.5 }}>
              Ein Code, 48 Stunden gültig, einmal einlösbar. Die Person öffnet die Anmeldeseite → „Ich habe eine Einladung".
            </p>
            {einladung ? (
              <div style={{ fontFamily: SCHRIFT.mono, fontSize: 24, fontWeight: 700, color: C.aktiv, letterSpacing: '.08em' }}>{einladung.code}
                <div style={{ ...MIKRO, marginTop: 4 }}>gültig {einladung.stunden} Stunden — persönlich weitergeben, nicht per Chat</div>
              </div>
            ) : <button onClick={einladen} className="fassbar" style={knopf()}>Einladungscode erzeugen</button>}
          </div>
        )}

        {meldung && <div style={{ fontSize: TYP.bedien, color: meldung.includes('nicht') || meldung.includes('Fehler') ? C.kritisch : C.gut }}>{meldung}</div>}
      </div>
    </div>
  );
}
