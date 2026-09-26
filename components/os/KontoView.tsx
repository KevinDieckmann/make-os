'use client';

// ─── MAKE OS — Mein Konto ───────────────────────────────────────────────────
// Name, Passwort, wem ich meine Gesundheitsdaten zeige, der Bote — und für den
// Inhaber: Einladen. Das ist die Seite, die aus „Kevin & Malin" ein Produkt
// macht. Seit 23.09. im schlanken Muster: Listen mit Haarlinien, keine Kästen.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Haken, feld, LEUCHT, Spalten, Spalte } from './schlank';
import { HaushaltZuordnung } from './HaushaltZuordnung';

interface Ich { speicher: string; email: string; name: string; rolle: 'inhaber' | 'mitglied'; teilt: { gesundheit: string[] }; angelegt: string; zweiterFaktorAn?: boolean }
interface Andere { speicher: string; name: string; rolle: string; teiltGesundheitMitMir: boolean }
interface Telegram { konfiguriert: boolean; bot?: string; chats: number; code?: string; minuten?: number; fehler?: string }

export function KontoView() {
  const [ich, setIch] = useState<Ich | null>(null);
  const [andere, setAndere] = useState<Andere[]>([]);
  const [name, setName] = useState('');
  const [pw, setPw] = useState({ alt: '', neu: '' });
  const [meldung, setMeldung] = useState('');
  const [einladung, setEinladung] = useState<{ code: string; stunden: number; link: string } | null>(null);
  const [tg, setTg] = useState<Telegram | null>(null);

  const [anmeldungen, setAnmeldungen] = useState<{ zeit: string; art: string; ok: boolean; adresse: string }[]>([]);
  const laden = () => fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) { setIch(d.ich); setName(d.ich.name); setAndere(d.andere ?? []); setAnmeldungen(Array.isArray(d.anmeldungen) ? d.anmeldungen : []); } }).catch(() => {});
  const ladeTg = () => fetch('/api/telegram/koppeln').then(r => r.json()).then(d => setTg(t => ({ ...d, code: t?.code, minuten: t?.minuten }))).catch(() => {});
  useEffect(() => { void laden(); void ladeTg(); }, []);

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
  async function tgCode() {
    const r = await fetch('/api/telegram/koppeln', { method: 'POST' }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setTg(t => ({ ...(t ?? { konfiguriert: true, chats: 0 }), ...(r.error ? { fehler: r.error } : { code: r.code, minuten: r.minuten, bot: r.bot }) }));
  }
  async function tgWeg() { await fetch('/api/telegram/koppeln', { method: 'DELETE' }).catch(() => {}); setTg(null); void ladeTg(); }
  const [fuer, setFuer] = useState('');
  async function einladen() {
    const r = await fetch('/api/konto/einladen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fuer }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.code) setEinladung({ code: r.code, stunden: r.stunden, link: `${r.adresse || window.location.origin}/anmelden?code=${r.code}` }); else setMeldung(r.error ?? 'Fehler');
  }
  // Zweiter Faktor (26.09.): einrichten → Code bestätigen → Wiederherstellungscodes einmal zeigen.
  const [zf, setZf] = useState<{ phase: 'aus' | 'einrichten' | 'codes'; geheimnis?: string; link?: string; codes?: string[]; code: string; passwort: string }>({ phase: 'aus', code: '', passwort: '' });
  const zfPost = (body: Record<string, unknown>) => fetch('/api/konto/zwei-faktor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
  async function zfBeginnen() { const r = await zfPost({ aktion: 'beginnen' }); if (r.error) setMeldung(r.error); else setZf({ phase: 'einrichten', geheimnis: r.geheimnis, link: r.link, code: '', passwort: '' }); }
  async function zfBestaetigen() { const r = await zfPost({ aktion: 'bestaetigen', code: zf.code }); if (r.error) setMeldung(r.error); else { setZf({ phase: 'codes', codes: r.codes ?? [], code: '', passwort: '' }); setMeldung('Zweiter Faktor ist an — alle anderen Geräte sind abgemeldet.'); void laden(); } }
  async function zfAus() { const r = await zfPost({ aktion: 'aus', passwort: zf.passwort }); if (r.error) setMeldung(r.error); else { setZf({ phase: 'aus', code: '', passwort: '' }); setMeldung('Zweiter Faktor ist aus.'); void laden(); } }
  async function abmelden() { await fetch('/api/konto/abmelden', { method: 'POST' }).catch(() => {}); window.location.assign('/anmelden'); }
  // Alle anderen Geräte raus — dieses bleibt drin (der Server stellt einen neuen Zettel aus).
  async function alleAbmelden() {
    const r = await fetch('/api/konto/abmelden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alle: true }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setMeldung(r.ok ? 'Alle anderen Geräte sind abgemeldet.' : 'Das hat nicht geklappt.'); void laden();
  }
  const kopieren = (t: string) => { try { void navigator.clipboard.writeText(t); setMeldung('Link kopiert — persönlich weitergeben.'); } catch { setMeldung(t); } };

  if (!ich) return <Seite titel="Konto"><Leer>lade …</Leer></Seite>;
  const mono: React.CSSProperties = { fontFamily: SCHRIFT.mono, fontWeight: 700, color: C.aktiv, letterSpacing: '.08em' };

  return (
    <Seite titel={<>Konto <span style={{ color: C.inkLeise, fontWeight: 500, fontSize: 15 }}>{ich.rolle === 'inhaber' ? 'Inhaber' : 'Mitglied'}</span></>} rechts={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Knopf leise onClick={alleAbmelden}>Alle anderen Geräte abmelden</Knopf><Knopf leise onClick={abmelden}>Abmelden</Knopf></span>}>
      <Karte i={0}><div style={{ fontSize: TYP.body }}>{ich.email}<span style={{ color: C.inkLeise }}> · Daten unter <code style={{ fontFamily: SCHRIFT.mono, fontSize: 13 }}>{ich.speicher}</code> · seit {ich.angelegt.slice(8, 10)}.{ich.angelegt.slice(5, 7)}.{ich.angelegt.slice(0, 4)}</span></div>
        {anmeldungen.length > 0 && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 6 }}>Zuletzt: {anmeldungen.map(e => `${e.zeit.slice(8, 10)}.${e.zeit.slice(5, 7)}. ${e.zeit.slice(11, 16)} ${e.art}${e.ok ? '' : ' (fehlgeschlagen)'} · ${e.adresse}`).join(' · ')}</div>}
      {meldung && <div style={{ fontSize: TYP.bedien, color: meldung.includes('nicht') || meldung.includes('Fehler') ? LEUCHT.kritisch : LEUCHT.gut, marginTop: 10 }}>{meldung}</div>}</Karte>
      <Spalten verhaeltnis="1:1">
        <Spalte>
      <Karte i={1}>
      <Ueberschrift>Name</Ueberschrift>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') speichern({ name }, 'Name gespeichert.'); }} style={feld} />
        <Knopf leise onClick={() => speichern({ name }, 'Name gespeichert.')} aus={name.trim() === ich.name}>Speichern</Knopf>
      </div>

      <Ueberschrift>Passwort ändern</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
        <input type="password" placeholder="altes Passwort" value={pw.alt} onChange={e => setPw(p => ({ ...p, alt: e.target.value }))} style={feld} autoComplete="current-password" />
        <input type="password" placeholder="neues, mindestens 10 Zeichen" value={pw.neu} onChange={e => setPw(p => ({ ...p, neu: e.target.value }))} style={feld} autoComplete="new-password" />
        <Knopf leise onClick={() => speichern({ passwortAlt: pw.alt, passwortNeu: pw.neu }, 'Passwort geändert.')} aus={pw.neu.length < 10 || !pw.alt}>Ändern</Knopf>
      </div>
      </Karte>
      <Karte i={2} akzent={ich.zweiterFaktorAn ? LEUCHT.gut : LEUCHT.achtung}>
        <Ueberschrift farbe={ich.zweiterFaktorAn ? LEUCHT.gut : LEUCHT.achtung} rechts={<span>{ich.zweiterFaktorAn ? 'an' : 'aus'}</span>}>Zweiter Faktor · Authenticator</Ueberschrift>
        {zf.phase === 'codes' && zf.codes && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Diese acht Wiederherstellungscodes gelten je einmal, falls das Handy weg ist. Jetzt in den Passwort-Manager — sie werden nie wieder angezeigt.</div>
            <div style={{ ...mono, fontSize: 15, lineHeight: 1.8, columns: 2 }}>{zf.codes.map(c => <div key={c}>{c}</div>)}</div>
            <div><Knopf onClick={() => setZf({ phase: 'aus', code: '', passwort: '' })}>Ich habe sie gesichert</Knopf></div>
          </div>
        )}
        {zf.phase === 'einrichten' && zf.geheimnis && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>In der Passwörter- oder Authenticator-App einen neuen Eintrag anlegen — am Handy über den Link, sonst den Schlüssel eintippen. Dann den Sechssteller aus der App hier bestätigen.</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ ...mono, fontSize: 15, letterSpacing: '.12em' }}>{zf.geheimnis.replace(/(.{4})/g, '$1 ').trim()}</code>
              <a href={zf.link} style={{ fontSize: TYP.bedien, color: C.aktiv }}>In der App öffnen ›</a>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input placeholder="Code aus der App" value={zf.code} onChange={e => setZf(z => ({ ...z, code: e.target.value }))} style={{ ...feld, width: 180, fontFamily: SCHRIFT.mono, letterSpacing: '.15em' }} inputMode="numeric" autoComplete="one-time-code" />
              <Knopf onClick={zfBestaetigen} aus={zf.code.replace(/\s/g, '').length !== 6}>Bestätigen</Knopf>
              <Knopf leise onClick={() => setZf({ phase: 'aus', code: '', passwort: '' })}>Abbrechen</Knopf>
            </div>
          </div>
        )}
        {zf.phase === 'aus' && !ich.zweiterFaktorAn && (
          <Zeile titel="Zweiten Faktor einrichten" unter="Beim Anmelden zusätzlich ein Sechssteller aus der Authenticator-App (Apple Passwörter, Google Authenticator, 1Password). Das ist der wichtigste Schutz für ein Login im offenen Netz." rechts={<Knopf farbe={LEUCHT.gut} onClick={zfBeginnen}>Einrichten</Knopf>} />
        )}
        {zf.phase === 'aus' && ich.zweiterFaktorAn && (
          <Zeile titel="Zweiter Faktor ist an" unter="Ausschalten nur mit Passwort — danach genügt beim Anmelden wieder das Passwort allein." rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="password" placeholder="Passwort" value={zf.passwort} onChange={e => setZf(z => ({ ...z, passwort: e.target.value }))} style={{ ...feld, width: 150, padding: '8px 10px', fontSize: TYP.bedien }} autoComplete="current-password" /><Knopf leise onClick={zfAus} aus={!zf.passwort}>Ausschalten</Knopf></span>} />
        )}
      </Karte>
      {ich.rolle === 'inhaber' && (
        <Karte i={4} akzent={LEUCHT.schlaf}>
          <Ueberschrift farbe={LEUCHT.schlaf}>Einladen</Ueberschrift>
          <Liste>
            {einladung ? (
              <div style={{ padding: '14px 2px', borderBottom: `1px solid ${C.linie}` }}>
                <div style={{ ...mono, fontSize: 24 }}>{einladung.code}</div>
                <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 4 }}>gültig {einladung.stunden} Stunden, einmal einlösbar</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <Knopf onClick={() => kopieren(einladung.link)}>Link kopieren</Knopf>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise, wordBreak: 'break-all' }}>{einladung.link}</span>
                </div>
              </div>
            ) : <Zeile titel="Jemanden einladen" unter={'Die Person öffnet den Link, trägt Vorname, E-Mail und Passwort ein — fertig. Für Malin hier „Malin“ eintragen: dann hängen ihre bisherigen Bestände am Konto (ohne diese Bindung bekommt niemand ihren Namen).'} rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input value={fuer} onChange={e => setFuer(e.target.value)} placeholder="Vorname (optional)" aria-label="Für wen" style={{ ...feld, width: 150, padding: '8px 10px', fontSize: TYP.bedien }} /><Knopf onClick={einladen}>Link erzeugen</Knopf></span>} />}
          </Liste>
        </Karte>
      )}
      {ich.rolle === 'inhaber' && <HaushaltZuordnung />}
        </Spalte>
        <Spalte>
      <Karte i={2}>
      <Ueberschrift farbe={LEUCHT.gut}>Gesundheit teilen</Ueberschrift>
      <Liste>
        {andere.length === 0 && <Leer>Noch niemand sonst hier. Wer deine Recovery, Journal, Haut und Streak sehen darf, entscheidest du je Person.</Leer>}
        {andere.map(a => {
          const an = ich.teilt.gesundheit.includes(a.speicher);
          return <Zeile key={a.speicher} links={<Haken an={an} onChange={() => teilen(a.speicher, !an)} />} titel={a.name}
            unter={`${an ? 'sieht deine Gesundheit' : 'sieht deine Gesundheit nicht'} · ${a.teiltGesundheitMitMir ? 'teilt mit dir' : 'teilt nicht mit dir'}`} />;
        })}
      </Liste>
      </Karte>
      <Karte i={3}>
      <Ueberschrift farbe={LEUCHT.puls}>Der Bote · Telegram</Ueberschrift>
      <Liste>
        {!tg ? <Leer>lade …</Leer>
          : !tg.konfiguriert ? <Leer>Noch kein Bot. In Telegram @BotFather anschreiben, /newbot, den Token als <code style={{ fontFamily: SCHRIFT.mono, fontSize: 12 }}>TELEGRAM_BOT_TOKEN</code> in <code style={{ fontFamily: SCHRIFT.mono, fontSize: 12 }}>.env.local</code>, neu starten.</Leer>
          : tg.chats > 0 ? <Zeile titel="Gekoppelt" unter="Jarvis schreibt dir morgens, mittags und abends; du antwortest mit einem Satz." rechts={<Knopf leise onClick={tgWeg}>Entkoppeln</Knopf>} />
          : tg.code ? <Zeile titel={<>Dem Bot {tg.bot ? <b>@{tg.bot}</b> : ''} senden: <span style={{ ...mono, fontSize: 17 }}>/start {tg.code}</span></>} unter={`${tg.minuten} Minuten gültig`} />
          : <Zeile titel="Noch nicht gekoppelt" unter="Jarvis schreibt dir morgens, mittags und abends aufs Handy." rechts={<Knopf onClick={tgCode}>Code holen</Knopf>} />}
        {tg?.fehler && <Leer><span style={{ color: LEUCHT.kritisch }}>{tg.fehler}</span></Leer>}
      </Liste>
      </Karte>
        </Spalte>
      </Spalten>
    </Seite>
  );
}
