'use client';

// ─── Inbox 2 — Postfächer verbinden, einstellen, erneuern, trennen + Absender (06.10.2026) ─────────────────────────
// Ablauf „Postfach hinzufügen“: Anbieter wählen → Anleitung (iCloud: App-spezifisches Passwort mit Link zu appleid.apple.com; IONOS:
// Passwort des Postfachs) → Adresse → Passwort → Bereich → „Verbinden“. Der Server meldet sich ZUERST beim Anbieter an; nur wenn das
// klappt, wird gespeichert (sonst eine klare Fehlerkarte, nichts gespeichert). Passwörter gehen nie zurück an den Browser.
// Je Postfach: Bereich, Name, Absendername, Signatur · „Verbindung erneuern“ (Apple macht App-Passwörter bei jedem Passwortwechsel
// ungültig) · „Trennen“ (Rückfrage; löscht die Kopie in MAKE OS, beim Anbieter bleibt alles). Gmail: über die Google-Verbindung (eigener
// Knopf), hier nur der Bereich. WhatsApp: vorbereitet (eigene Business-Nummer über die Cloud API — Adapter folgt).

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Pillen, Feldzeile, eingabe, auswahl, Leer, Punkt, LEUCHT, useRueckfrage } from '../ui';
import { KUGEL } from '@/lib/make-one/design';
import { GmailVerbinden, type GmailMeta } from './GmailVerbinden';
import type { PostfachOeffentlich } from '@/lib/postfach/typen';
import { holen, senden, vorText, type PostfaecherAntwort } from './daten';

export const STUFE_FARBE: Record<PostfachOeffentlich['zustand']['stufe'], string> = {
  aktuell: KUGEL.smaragd, verzoegert: LEUCHT.achtung, anmeldung: KUGEL.granat, fehler: LEUCHT.achtung, neu: C.inkLeise, aus: C.inkLeise, vorbereitet: C.inkLeise,
};
export const STUFE_TEXT: Record<PostfachOeffentlich['zustand']['stufe'], string> = {
  aktuell: 'aktuell', verzoegert: 'verzögert', anmeldung: 'Anmeldung abgelehnt', fehler: 'gerade nicht erreichbar', neu: 'wird eingerichtet', aus: 'aus', vorbereitet: 'vorbereitet',
};

function Hinzufuegen({ d, onFertig }: { d: PostfaecherAntwort; onFertig: (t: string) => void }) {
  const [anbieter, setAnbieter] = useState(d.anbieter[0]?.id ?? 'icloud');
  const [adresse, setAdresse] = useState('');
  const [passwort, setPasswort] = useState('');
  const [bereich, setBereich] = useState('');
  const [name, setName] = useState('');
  const [absenderName, setAbsenderName] = useState('');
  const [imap, setImap] = useState({ host: '', port: '993' });
  const [smtp, setSmtp] = useState({ host: '', port: '465', sicherheit: 'ssl' });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const a = d.anbieter.find(x => x.id === anbieter);
  const los = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setLaeuft(true); setFehler('');
    const r = await senden('/api/inbox/postfaecher', {
      aktion: 'hinzufuegen', anbieter, adresse, passwort, bereich, ...(name.trim() ? { anzeigename: name.trim() } : {}), ...(absenderName.trim() ? { absenderName: absenderName.trim() } : {}),
      ...(a?.eigeneServer ? { imap: { host: imap.host.trim(), port: Number(imap.port) }, smtp: { host: smtp.host.trim(), port: Number(smtp.port), sicherheit: smtp.sicherheit } } : {}),
    });
    setLaeuft(false);
    if (r.d.ok) { setPasswort(''); onFertig(String(r.d.text ?? 'Verbunden.')); return; }
    setFehler(String(r.d.fehler ?? 'Das Postfach ließ sich nicht verbinden.'));
  };
  return (
    <form onSubmit={los} style={{ display: 'grid', gap: 12 }} data-inbox="postfach-neu">
      <Ueberschrift>Postfach hinzufügen</Ueberschrift>
      <Pillen liste={d.anbieter.map(x => ({ id: x.id, label: x.name }))} aktiv={anbieter} onWahl={setAnbieter} />
      {a && (
        <div style={{ display: 'grid', gap: 6, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>{a.anleitung.map(t => <li key={t}>{t}</li>)}</ol>
          {a.link && <a href={a.link.url} target="_blank" rel="noopener noreferrer" style={{ color: C.aktiv, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>{a.link.text} ↗</a>}
        </div>
      )}
      {fehler && <Hinweis art="kritisch" rolle="alert" titel="Nicht verbunden — nichts gespeichert">{fehler}</Hinweis>}
      <Feldzeile label="E-Mail-Adresse"><input value={adresse} onChange={e => setAdresse(e.target.value)} type="email" inputMode="email" autoComplete="off" required style={eingabe} /></Feldzeile>
      <Feldzeile label={a?.passwortWort ?? 'Passwort'}><input value={passwort} onChange={e => setPasswort(e.target.value)} type="password" autoComplete="new-password" required style={eingabe} /></Feldzeile>
      <Feldzeile label="Bereich">
        <select value={bereich} onChange={e => setBereich(e.target.value)} required style={{ ...auswahl, minHeight: 48, fontSize: 16, width: '100%' }} aria-label="Bereich">
          <option value="">— bitte wählen —</option>
          {d.bereiche.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Feldzeile>
      <Feldzeile label="Name in der Inbox (optional)"><input value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Privat · iCloud" style={eingabe} /></Feldzeile>
      <Feldzeile label="Absendername (optional)"><input value={absenderName} onChange={e => setAbsenderName(e.target.value)} placeholder="So steht dein Name beim Empfänger" style={eingabe} /></Feldzeile>
      {a?.eigeneServer && (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
          <Feldzeile label="IMAP-Server"><input value={imap.host} onChange={e => setImap({ ...imap, host: e.target.value })} placeholder="imap.anbieter.de" style={eingabe} /></Feldzeile>
          <Feldzeile label="Port"><input value={imap.port} onChange={e => setImap({ ...imap, port: e.target.value })} inputMode="numeric" style={eingabe} /></Feldzeile>
          <Feldzeile label="SMTP-Server"><input value={smtp.host} onChange={e => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.anbieter.de" style={eingabe} /></Feldzeile>
          <Feldzeile label="Port"><input value={smtp.port} onChange={e => setSmtp({ ...smtp, port: e.target.value, sicherheit: e.target.value === '587' ? 'starttls' : 'ssl' })} inputMode="numeric" style={eingabe} /></Feldzeile>
        </div>
      )}
      {a?.sendeHinweis && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{a.sendeHinweis}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf haupt typ="submit" aus={laeuft || !adresse || !passwort || !bereich}>{laeuft ? 'prüft die Anmeldung …' : 'Verbinden'}</Knopf>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gespeichert wird erst, wenn die Anmeldung klappt. Das Passwort liegt verschlüsselt auf dem Server und wird nie angezeigt.</span>
      </div>
    </form>
  );
}

function PostfachZeile({ p, bereiche, onGeaendert, meldung }: { p: PostfachOeffentlich; bereiche: { id: string; name: string }[]; onGeaendert: () => void; meldung: (t: string) => void }) {
  const [auf, setAuf] = useState(p.zustand.stufe === 'anmeldung');
  const [neu, setNeu] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const [f, setF] = useState({ bereich: p.bereich ?? '', anzeigename: p.anzeigename, absenderName: p.absenderName ?? '', signatur: p.signatur ?? '' });
  const { bestaetigen, dialog } = useRueckfrage();
  const post = async (body: Record<string, unknown>) => {
    setLaeuft(true); setFehler('');
    const r = await senden('/api/inbox/postfaecher', { id: p.id, ...body });
    setLaeuft(false);
    if (r.d.ok) { meldung(String(r.d.text ?? 'Gespeichert.')); onGeaendert(); return true; }
    setFehler(String(r.d.fehler ?? 'Das ging nicht.')); return false;
  };
  const z = p.zustand;
  return (
    <div style={{ borderTop: `1px solid ${C.linie}`, paddingTop: 10, display: 'grid', gap: 8 }} data-postfach={p.id}>
      <button type="button" onClick={() => setAuf(x => !x)} aria-expanded={auf} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'none', border: 'none', padding: 0, minHeight: 48, cursor: 'pointer', color: C.ink, textAlign: 'left', width: '100%' }}>
        <Punkt farbe={STUFE_FARBE[z.stufe]} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: TYP.body, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.anzeigename}</span>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{p.bereichName} · {p.quelle === 'gmail' ? 'Gmail' : p.quelle === 'whatsapp' ? 'WhatsApp' : 'IMAP'} · {STUFE_TEXT[z.stufe]}{z.vorMin != null && z.stufe !== 'anmeldung' ? ` · ${vorText(z.vorMin)}` : ''}{z.idle ? ' · sofort (IDLE)' : ''}</span>
        </span>
        <span style={{ color: C.inkLeise }}>{auf ? '▴' : '▾'}</span>
      </button>
      {auf && (
        <div style={{ display: 'grid', gap: 10, paddingBottom: 6 }}>
          {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
          {z.stufe === 'anmeldung' && p.quelle === 'imap' && (
            <form onSubmit={e => { e.preventDefault(); void post({ aktion: 'erneuern', passwort: neu }).then(ok => { if (ok) setNeu(''); }); }} style={{ display: 'grid', gap: 8 }}>
              <Hinweis art="kritisch" titel="Verbindung erneuern">Der Anbieter hat die Anmeldung abgelehnt — meist ein neues Passwort (iCloud: nach einem Wechsel des Apple-Passworts ist jedes App-Passwort ungültig). MAKE OS fragt nicht weiter an, bis ein neues Passwort eingetragen ist.</Hinweis>
              <Feldzeile label="Neues Passwort"><input value={neu} onChange={e => setNeu(e.target.value)} type="password" autoComplete="new-password" style={eingabe} /></Feldzeile>
              <div><Knopf typ="submit" aus={laeuft || !neu}>{laeuft ? 'prüft …' : 'Verbindung erneuern'}</Knopf></div>
            </form>
          )}
          {z.stufe === 'fehler' && z.fehler && <Hinweis art="achtung">{z.fehler}</Hinweis>}
          {p.quelle === 'whatsapp' ? <Leer>WhatsApp ist vorbereitet — der Adapter für die eigene Business-Nummer (Cloud API) folgt.</Leer> : (
            <>
              <Feldzeile label="Bereich">
                <select value={f.bereich} onChange={e => setF({ ...f, bereich: e.target.value })} style={{ ...auswahl, minHeight: 44, width: '100%' }} aria-label="Bereich">
                  <option value="">— bitte wählen —</option>
                  {bereiche.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Feldzeile>
              <Feldzeile label="Name in der Inbox"><input value={f.anzeigename} onChange={e => setF({ ...f, anzeigename: e.target.value })} style={eingabe} /></Feldzeile>
              {p.quelle === 'imap' && <Feldzeile label="Absendername"><input value={f.absenderName} onChange={e => setF({ ...f, absenderName: e.target.value })} style={eingabe} /></Feldzeile>}
              <Feldzeile label="Signatur (steht beim Antworten unten im Text)"><textarea value={f.signatur} onChange={e => setF({ ...f, signatur: e.target.value })} rows={3} style={{ ...eingabe, minHeight: 88, resize: 'vertical' }} /></Feldzeile>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Knopf onClick={() => post({ aktion: 'einstellen', bereich: f.bereich, anzeigename: f.anzeigename, ...(p.quelle === 'imap' ? { absenderName: f.absenderName } : {}), signatur: f.signatur })} aus={laeuft || !f.bereich}>Speichern</Knopf>
                <Knopf leise onClick={async () => { if (await bestaetigen({ titel: `${p.anzeigename} trennen?`, text: 'Die Kopie in MAKE OS (Nachrichten, Wiedervorlagen, Zuordnungen) wird gelöscht, das Passwort auch. Beim Anbieter bleibt alles, wie es ist.', ja: 'Trennen', gefahr: true })) await post({ aktion: 'trennen' }); }} aus={laeuft}>Trennen</Knopf>
              </div>
            </>
          )}
        </div>
      )}
      {dialog}
    </div>
  );
}

export function Postfaecher({ onGeaendert, meldung }: { onGeaendert: () => void; meldung: (t: string) => void }) {
  const [d, setD] = useState<PostfaecherAntwort | null>(null);
  const [fehler, setFehler] = useState('');
  const [neu, setNeu] = useState(false);
  const laden = useCallback(async () => {
    const r = await holen<PostfaecherAntwort>('/api/inbox/postfaecher');
    if (r.d.ok) { setD(r.d as PostfaecherAntwort); setFehler(''); } else setFehler(String(r.d.fehler ?? 'Die Postfächer ließen sich nicht laden.'));
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const geaendert = () => { void laden(); onGeaendert(); };
  if (fehler) return <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => void laden()}>Noch einmal</Knopf>}>{fehler}</Hinweis>;
  if (!d) return <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lädt …</div>;
  const gmailMeta: GmailMeta = { konfiguriert: d.google.konfiguriert, verbunden: d.google.verbunden, bereit: d.google.bereit, ...(d.google.konto ? { konto: d.google.konto } : {}), ...(d.google.getrennt ? { getrennt: { grund: 'getrennt' } } : {}) };
  return (
    <div style={{ display: 'grid', gap: 14 }} data-inbox="postfaecher">
      <Karte i={0}>
        <Ueberschrift rechts={!neu ? <Knopf leise onClick={() => setNeu(true)}>+ Postfach</Knopf> : <Knopf leise onClick={() => setNeu(false)}>Schließen</Knopf>}>Deine Postfächer</Ueberschrift>
        {!d.postfaecher.length && !neu && <Leer>Noch kein Postfach verbunden.</Leer>}
        {d.postfaecher.map(p => <PostfachZeile key={p.id} p={p} bereiche={d.bereiche} onGeaendert={geaendert} meldung={meldung} />)}
        {neu && <div style={{ marginTop: 14 }}><Hinzufuegen d={d} onFertig={t => { setNeu(false); meldung(t); geaendert(); }} /></div>}
      </Karte>
      {(d.google.konfiguriert || d.google.verbunden) && <GmailVerbinden meta={gmailMeta} onGeaendert={geaendert} meldung={meldung} />}
      <Karte i={1} flach>
        <Ueberschrift>WhatsApp Business</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Vorbereitet: eine eigene Business-Nummer über die WhatsApp Cloud API (Meta). Sobald das Meta-Konto und die Nummer eingerichtet sind, kommen Chats hier als Gespräche an — Antworten innerhalb von 24 Stunden frei, danach nur mit genehmigter Vorlage. Private WhatsApp-Konten lassen sich nicht anbinden.</div>
      </Karte>
      <Karte i={2} flach>
        <Ueberschrift rechts={`${d.absender.length}`}>Absender-Entscheidungen</Ueberschrift>
        {!d.absender.length ? <Leer>Noch keine — neue Absender entscheidest du im Fach „Neue Absender“.</Leer> : (
          <div style={{ display: 'grid', gap: 4 }}>
            {d.absender.slice(0, 50).map(x => (
              <div key={x.adresse} style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, flexWrap: 'wrap' }}>
                <Punkt farbe={x.status === 'geblockt' ? KUGEL.granat : KUGEL.smaragd} />
                <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, overflowWrap: 'anywhere' }}>{x.adresse} · {x.status === 'geblockt' ? 'geblockt' : 'zugelassen'}</span>
                <Knopf leise onClick={async () => { await senden('/api/inbox/postfaecher', { aktion: 'absender', adresse: x.adresse, status: x.status === 'geblockt' ? 'zugelassen' : 'geblockt' }); geaendert(); }}>{x.status === 'geblockt' ? 'Zulassen' : 'Blocken'}</Knopf>
                <Knopf leise onClick={async () => { await senden('/api/inbox/postfaecher', { aktion: 'absender', adresse: x.adresse, status: null }); geaendert(); }}>Vergessen</Knopf>
              </div>
            ))}
          </div>
        )}
      </Karte>
    </div>
  );
}
