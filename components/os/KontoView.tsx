'use client';

// ─── MAKE OS — Mein Konto ───────────────────────────────────────────────────
// Name, Passwort, wem ich meine Gesundheitsdaten zeige, der Bote — und für den
// Inhaber: Einladen. Das ist die Seite, die aus „Kevin & Malin" ein Produkt
// macht. Seit 23.09. im schlanken Muster: Listen mit Haarlinien, keine Kästen.

import { karteCacheLeeren } from './netzwerken/karten-daten';
import { vorAbmelden } from '@/lib/netzwerken/abmelden';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Haken, Hinweis, Feldzeile, feld, LEUCHT, useRueckfrage } from './ui';
import { Flaeche, Kachel } from './flaeche/Flaeche';
import { HaushaltZuordnung } from './HaushaltZuordnung';
import { ZugangEinstellungen } from './ZugangEinstellungen';
import { TeamKarte } from './TeamKarte';
import { AnmeldeAdressen } from './AnmeldeAdressen';
import { MeineDaten } from './MeineDaten';

interface Ich { speicher: string; email: string; weitereEmails?: string[]; name: string; rolle: 'inhaber' | 'mitglied'; teilt: { gesundheit: string[]; ziele?: string[] }; angelegt: string; zweiterFaktorAn?: boolean }
/** Anzeige im „Zuletzt“-Protokoll; unbekannte Arten erscheinen unverändert. */
const ART_TEXT: Record<string, string> = { 'adresse-hinzu': 'Anmelde-Adresse hinzugefügt', 'adresse-haupt': 'Hauptadresse gewechselt', 'adresse-weg': 'Anmelde-Adresse entfernt', 'daten-export': 'eigene Daten abgerufen', 'instanz-export': 'Instanz exportiert', 'konto-loeschen': 'Konto löschen versucht' };
interface Andere { speicher: string; name: string; rolle: string; teiltGesundheitMitMir: boolean; teiltZieleMitMir?: boolean }
interface Telegram { konfiguriert: boolean; bot?: string; chats: number; code?: string; minuten?: number; fehler?: string }

export function KontoView() {
  const { bestaetigen, dialog } = useRueckfrage();
  const [ich, setIch] = useState<Ich | null>(null);
  const [andere, setAndere] = useState<Andere[]>([]);
  const [name, setName] = useState('');
  const [pw, setPw] = useState({ alt: '', neu: '' });
  const [meldung, setMeldung] = useState('');
  const [einladung, setEinladung] = useState<{ code: string; stunden: number; link: string } | null>(null);
  const [tg, setTg] = useState<Telegram | null>(null);

  const [anmeldungen, setAnmeldungen] = useState<{ zeit: string; art: string; ok: boolean; adresse: string; detail?: string }[]>([]);
  const laden = () => fetch('/api/konto/ich').then(r => r.json()).then(d => { if (d.ich) { setIch(d.ich); setName(d.ich.name); setAndere(d.andere ?? []); setAnmeldungen(Array.isArray(d.anmeldungen) ? d.anmeldungen : []); } }).catch(() => {});
  const ladeTg = () => fetch('/api/telegram/koppeln').then(r => r.json()).then(d => setTg(t => ({ ...d, code: t?.code, minuten: t?.minuten }))).catch(() => {});
  useEffect(() => { void laden(); void ladeTg(); }, []);

  async function speichern(body: Record<string, unknown>, ok: string) {
    setMeldung('');
    const r = await fetch('/api/konto/ich', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setMeldung(r.error ?? ok); if (!r.error) { setPw({ alt: '', neu: '' }); void laden(); }
  }
  async function teilen(speicher: string, an: boolean, was: 'gesundheit' | 'ziele' = 'gesundheit') {
    if (!ich) return;
    const bisher = (was === 'ziele' ? ich.teilt.ziele : ich.teilt.gesundheit) ?? [];
    const liste = an ? [...bisher, speicher] : bisher.filter(s => s !== speicher);
    // Nur die eine Liste schicken — der Server ändert nur, was mitkommt (08.10.).
    await fetch('/api/konto/teilen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [was]: liste }) }).catch(() => {});
    void laden();
  }
  async function tgCode() {
    const r = await fetch('/api/telegram/koppeln', { method: 'POST' }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    setTg(t => ({ ...(t ?? { konfiguriert: true, chats: 0 }), ...(r.error ? { fehler: r.error } : { code: r.code, minuten: r.minuten, bot: r.bot }) }));
  }
  async function tgWeg() { await fetch('/api/telegram/koppeln', { method: 'DELETE' }).catch(() => {}); setTg(null); void ladeTg(); }
  const [fuer, setFuer] = useState('');
  const [fuerMail, setFuerMail] = useState('');
  async function einladen() {
    const r = await fetch('/api/konto/einladen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fuer, ...(fuerMail.trim() ? { email: fuerMail.trim() } : {}) }) }).then(x => x.json()).catch(() => ({ error: 'nicht erreichbar' }));
    if (r.code) setEinladung({ code: r.code, stunden: r.stunden, link: `${r.adresse || window.location.origin}/anmelden?code=${r.code}` }); else setMeldung(r.error ?? 'Fehler');
  }
  // Zweiter Faktor (26.09.): einrichten → Code bestätigen → Wiederherstellungscodes einmal zeigen.
  const [zf, setZf] = useState<{ phase: 'aus' | 'einrichten' | 'codes'; geheimnis?: string; link?: string; codes?: string[]; code: string; passwort: string }>({ phase: 'aus', code: '', passwort: '' });
  const zfPost = (body: Record<string, unknown>) => fetch('/api/konto/zwei-faktor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ error: 'nicht erreichbar' }));
  async function zfBeginnen() { const r = await zfPost({ aktion: 'beginnen' }); if (r.error) setMeldung(r.error); else setZf({ phase: 'einrichten', geheimnis: r.geheimnis, link: r.link, code: '', passwort: '' }); }
  async function zfBestaetigen() { const r = await zfPost({ aktion: 'bestaetigen', code: zf.code }); if (r.error) setMeldung(r.error); else { setZf({ phase: 'codes', codes: r.codes ?? [], code: '', passwort: '' }); setMeldung('Zweiter Faktor ist an — alle anderen Geräte sind abgemeldet.'); void laden(); } }
  async function zfAus() { const r = await zfPost({ aktion: 'aus', passwort: zf.passwort }); if (r.error) setMeldung(r.error); else { setZf({ phase: 'aus', code: '', passwort: '' }); setMeldung('Zweiter Faktor ist aus.'); void laden(); } }
  // Das Offline-Abbild der eigenen Visitenkarten (Netzwerken) bleibt nicht auf einem abgemeldeten Gerät liegen.
  // Netzwerken (03.10.): wartet noch eine Erfassung, wird davor gewarnt („erst senden?“); danach räumt Abmelden Warteschlange und Merker weg.
  async function abmelden() { if (!(await vorAbmelden(ich?.speicher ?? null, { bestaetigen: (t, k) => bestaetigen({ titel: k?.titel ?? 'Wirklich?', text: t, ja: k?.ja ?? 'Weiter', gefahr: k?.gefahr }) }))) return; karteCacheLeeren(); await fetch('/api/konto/abmelden', { method: 'POST' }).catch(() => {}); window.location.assign('/anmelden'); }
  // Alle anderen Geräte raus — dieses bleibt drin (der Server stellt einen neuen Zettel aus).
  async function alleAbmelden() {
    const r = await fetch('/api/konto/abmelden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alle: true }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setMeldung(r.ok ? 'Alle anderen Geräte sind abgemeldet.' : 'Das hat nicht geklappt.'); void laden();
  }
  const kopieren = (t: string) => { try { void navigator.clipboard.writeText(t); setMeldung('Link kopiert — persönlich weitergeben.'); } catch { setMeldung(t); } };

  if (!ich) return <Seite titel="Konto"><Leer>lade …</Leer></Seite>;
  const meldungKritisch = meldung.includes('nicht') || meldung.includes('Fehler');
  const mono: React.CSSProperties = { fontFamily: SCHRIFT.mono, fontWeight: 700, color: C.aktiv, letterSpacing: '.08em' };

  return (
    <Seite titel={<>Konto <span style={{ color: C.inkLeise, fontWeight: 500, fontSize: 15 }}>{ich.rolle === 'inhaber' ? 'Inhaber' : 'Mitglied'}</span></>} rechts={<Knopf leise onClick={abmelden}>Abmelden</Knopf>}>
      <Karte i={0}>
        <div style={{ fontSize: TYP.body, overflowWrap: 'anywhere' }}>{ich.email}<span style={{ color: C.inkLeise }}> · Daten unter <code style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.bedien }}>{ich.speicher}</code> · seit {ich.angelegt.slice(8, 10)}.{ich.angelegt.slice(5, 7)}.{ich.angelegt.slice(0, 4)}</span></div>
        {anmeldungen.length > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6, lineHeight: 1.5 }}>Zuletzt: {anmeldungen.map(e => `${e.zeit.slice(8, 10)}.${e.zeit.slice(5, 7)}. ${e.zeit.slice(11, 16)} ${ART_TEXT[e.art] ?? e.art}${e.detail ? ` ${e.detail}` : ''}${e.ok ? '' : ' (fehlgeschlagen)'} · ${e.adresse}`).join(' · ')}</div>}
        <Liste>
          <Zeile titel="Andere Geräte abmelden" unter="Meldet alle anderen Geräte ab — dieses bleibt angemeldet." rechts={<Knopf leise onClick={alleAbmelden}>Alle anderen abmelden</Knopf>} />
        </Liste>
        {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldungKritisch ? 'kritisch' : 'gut'}>{meldung}</Hinweis></div>}
      </Karte>
      <Flaeche seite="konto">
      <Kachel id="zugang" titel="Name & Passwort" breite={3}>
      <Karte i={1}>
      <Ueberschrift>Name</Ueberschrift>
      <div className="konto-feldreihe" style={{ marginBottom: 18 }}>
        <Feldzeile label="Dein Name"><input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') speichern({ name }, 'Name gespeichert.'); }} style={feld} autoComplete="name" /></Feldzeile>
        <Knopf leise onClick={() => speichern({ name }, 'Name gespeichert.')} aus={name.trim() === ich.name}>Speichern</Knopf>
      </div>

      <Ueberschrift>Passwort ändern</Ueberschrift>
      <form className="konto-feldreihe konto-feldreihe-pw" onSubmit={e => { e.preventDefault(); if (pw.neu.length >= 10 && pw.alt) void speichern({ passwortAlt: pw.alt, passwortNeu: pw.neu }, 'Passwort geändert.'); }}>
        <Feldzeile label="Altes Passwort"><input type="password" value={pw.alt} onChange={e => setPw(p => ({ ...p, alt: e.target.value }))} style={feld} autoComplete="current-password" /></Feldzeile>
        <Feldzeile label="Neues Passwort (mindestens 10 Zeichen)"><input type="password" value={pw.neu} onChange={e => setPw(p => ({ ...p, neu: e.target.value }))} style={feld} autoComplete="new-password" /></Feldzeile>
        <Knopf leise typ="submit" aus={pw.neu.length < 10 || !pw.alt}>Ändern</Knopf>
      </form>
      </Karte>
      </Kachel>
      <Kachel id="adressen" titel="Anmelde-Adressen" breite={3}>
        <AnmeldeAdressen email={ich.email} weitere={ich.weitereEmails ?? []} i={2} geaendert={() => void laden()} />
      </Kachel>
      <Kachel id="zwei-faktor" titel="Zweiter Faktor" breite={3}>
      <Karte i={2} ton={ich.zweiterFaktorAn ? LEUCHT.gut : LEUCHT.achtung}>
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
            <form className="konto-feldreihe" onSubmit={e => { e.preventDefault(); if (zf.code.replace(/\s/g, '').length === 6) void zfBestaetigen(); }}>
              <Feldzeile label="Sechsstelliger Code aus der App"><input value={zf.code} onChange={e => setZf(z => ({ ...z, code: e.target.value }))} style={{ ...feld, fontFamily: SCHRIFT.mono, letterSpacing: '.15em' }} inputMode="numeric" autoComplete="one-time-code" /></Feldzeile>
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Knopf typ="submit" aus={zf.code.replace(/\s/g, '').length !== 6}>Bestätigen</Knopf>
                <Knopf leise onClick={() => setZf({ phase: 'aus', code: '', passwort: '' })}>Abbrechen</Knopf>
              </span>
            </form>
          </div>
        )}
        {zf.phase === 'aus' && !ich.zweiterFaktorAn && (
          <Zeile titel="Zweiten Faktor einrichten" unter="Beim Anmelden zusätzlich ein Sechssteller aus der Authenticator-App (Apple Passwörter, Google Authenticator, 1Password). Das ist der wichtigste Schutz für ein Login im offenen Netz." rechts={<Knopf farbe={LEUCHT.gut} onClick={zfBeginnen}>Einrichten</Knopf>} />
        )}
        {zf.phase === 'aus' && ich.zweiterFaktorAn && (
          <>
            <Zeile titel="Zweiter Faktor ist an" unter="Ausschalten nur mit Passwort — danach genügt beim Anmelden wieder das Passwort allein." />
            <form className="konto-feldreihe" onSubmit={e => { e.preventDefault(); if (zf.passwort) void zfAus(); }}>
              <Feldzeile label="Passwort zum Ausschalten"><input type="password" value={zf.passwort} onChange={e => setZf(z => ({ ...z, passwort: e.target.value }))} style={feld} autoComplete="current-password" /></Feldzeile>
              <Knopf leise typ="submit" aus={!zf.passwort}>Ausschalten</Knopf>
            </form>
          </>
        )}
      </Karte>
      </Kachel>
      {ich.rolle === 'inhaber' && (
        <Kachel id="einladen" titel="Einladen" breite={3}>
        <Karte i={4} akzent={LEUCHT.schlaf}>
          <Ueberschrift farbe={LEUCHT.schlaf}>Einladen</Ueberschrift>
          <Liste>
            {einladung ? (
              <div style={{ padding: '14px 2px', borderBottom: `1px solid ${C.linie}` }}>
                <div style={{ ...mono, fontSize: 24 }}>{einladung.code}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>gültig {einladung.stunden} Stunden, einmal einlösbar</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <Knopf onClick={() => kopieren(einladung.link)}>Link kopieren</Knopf>
                  <span style={{ fontSize: TYP.bedien, color: C.inkLeise, wordBreak: 'break-all' }}>{einladung.link}</span>
                </div>
              </div>
            ) : <>
              <Zeile titel="Jemanden einladen" unter={'Die Person öffnet den Link, trägt Vorname, E-Mail und Passwort ein — fertig. Soll das Konto an schon vorhandene Bestände anschließen, hier den Namen eintragen, unter dem sie liegen: dann hängen sie am neuen Konto (ohne diese Bindung bekommt niemand diesen Namen).'} />
              <form className="konto-feldreihe" onSubmit={e => { e.preventDefault(); void einladen(); }}>
                <Feldzeile label="Vorname (optional)"><input value={fuer} onChange={e => setFuer(e.target.value)} style={feld} autoComplete="off" /></Feldzeile>
                <Feldzeile label="E-Mail der Person (optional) — reserviert die Adresse für die Einladung"><input type="email" inputMode="email" autoCapitalize="none" value={fuerMail} onChange={e => setFuerMail(e.target.value)} style={feld} autoComplete="off" /></Feldzeile>
                <Knopf typ="submit">Link erzeugen</Knopf>
              </form>
            </>}
          </Liste>
        </Karte>
        </Kachel>
      )}
      {ich.rolle === 'inhaber' && <Kachel id="haushalt" titel="Haushalt" breite={3}><HaushaltZuordnung /></Kachel>}
      {ich.rolle === 'inhaber' && <Kachel id="zugang-instanz" titel="Zugang der Instanz" breite={3}><ZugangEinstellungen /></Kachel>}
      {/* Team (28.09.): lebt in den Daten (team--<haushalt>); hier gepflegt, weil die alte Säulen-Seite auf /os/familie umleitet. */}
      <Kachel id="team" titel="Team" breite={6}><TeamKarte i={3} /></Kachel>
      <Kachel id="teilen" titel="Gesundheit teilen" breite={3}>
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
      </Kachel>
      {/* Eigene Ziele (08.10., Kevin): Vorgabe „nicht geteilt“ — wer meine eigenen Ziele lesen darf, entscheide nur ich (Server: lib/planung/eigene-ziele-sicht.ts). */}
      <Kachel id="ziele-teilen" titel="Eigene Ziele teilen" breite={3}>
      <Karte i={2}>
      <Ueberschrift farbe={LEUCHT.planung}>Eigene Ziele teilen</Ueberschrift>
      <Liste>
        {andere.length === 0 && <Leer>Noch niemand sonst hier. Wer deine eigenen Ziele lesen darf, entscheidest du je Person — ohne Haken sieht niemand etwas davon.</Leer>}
        {andere.map(a => {
          const an = (ich.teilt.ziele ?? []).includes(a.speicher);
          return <Zeile key={a.speicher} links={<Haken an={an} onChange={() => teilen(a.speicher, !an, 'ziele')} />} titel={a.name}
            unter={`${an ? 'liest deine eigenen Ziele' : 'sieht deine eigenen Ziele nicht'} · ${a.teiltZieleMitMir ? 'teilt mit dir' : 'teilt nicht mit dir'}`} />;
        })}
      </Liste>
      </Karte>
      </Kachel>
      {/* Betroffenenrechte (05.10.): Auskunft, Herunterladen, Konto löschen — jede Person selbst. */}
      <Kachel id="meine-daten" titel="Meine Daten" breite={3}><MeineDaten i={2} zweiterFaktorAn={!!ich.zweiterFaktorAn} inhaber={ich.rolle === 'inhaber'} andere={andere.length} /></Kachel>
      <Kachel id="bote" titel="Der Bote · Telegram" breite={3}>
      <Karte i={3}>
      <Ueberschrift farbe={LEUCHT.puls}>Der Bote · Telegram</Ueberschrift>
      <Liste>
        {!tg ? <Leer>lade …</Leer>
          : !tg.konfiguriert ? <Leer>Noch kein Bot. In Telegram @BotFather anschreiben, /newbot, den Token als <code style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.bedien }}>TELEGRAM_BOT_TOKEN</code> in die Server-Umgebung (<code style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.bedien }}>/srv/make-os/app/.env</code>) eintragen, dann <code style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.bedien }}>docker compose up -d</code> — macht der Inhaber.</Leer>
          : tg.chats > 0 ? <Zeile titel="Gekoppelt" unter="ZOE schreibt dir morgens, mittags und abends; du antwortest mit einem Satz." rechts={<Knopf leise onClick={tgWeg}>Entkoppeln</Knopf>} />
          : tg.code ? <Zeile titel={<>Dem Bot {tg.bot ? <b>@{tg.bot}</b> : ''} senden: <span style={{ ...mono, fontSize: 17 }}>/start {tg.code}</span></>} unter={`${tg.minuten} Minuten gültig`} />
          : <Zeile titel="Noch nicht gekoppelt" unter="ZOE schreibt dir morgens, mittags und abends aufs Handy." rechts={<Knopf onClick={tgCode}>Code holen</Knopf>} />}
        {tg?.fehler && <Hinweis art="kritisch">{tg.fehler}</Hinweis>}
      </Liste>
      </Karte>
      </Kachel>
      </Flaeche>
      {dialog}
    </Seite>
  );
}
