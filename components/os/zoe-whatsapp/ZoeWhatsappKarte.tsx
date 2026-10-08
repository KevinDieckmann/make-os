'use client';

// ─── ZOE auf WhatsApp — Karte der eigenen Verbindung (Konto und Einstellungen › Verbindungen, 08.10.2026) ─────────────────
// Kevin 08.10. (R5): „Zweite Business-Nummer nur für ZOE.“ Jede Person verbindet IHRE Nummer selbst:
//   nicht verbunden → Einwilligung lesen + zustimmen, Handynummer eingeben → „Code holen“
//   wartet          → den Code von genau dieser Nummer an die ZOE-Nummer schicken (Knopf „In WhatsApp öffnen“ mit vorbereitetem Text)
//   verbunden       → Nummer (maskiert), 24-h-Fenster, Ausnahme „Inhalte senden“ (mit Rückfrage), Test-Nachricht, Sprachnachrichten
//                     anhören, Nachweise, „Trennen“ (wie „STOP“)
// Die Seite sieht nie die volle eigene Nummer, nie einen Schlüssel; den Code nur einmal (Antwort auf „Code holen“). Alles serverseitig in
// /api/zoe/whatsapp (nur die Person selbst, Dienstweg 403).

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, KUGEL } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Knopf, Hinweis, Feldzeile, Schalter, Segmente, eingabe, LEUCHT, useRueckfrage } from '../ui';
import { EINWILLIGUNG_TEXT, INHALTE_TEXT, type ZoeWhatsappStatus } from '@/lib/zoe-whatsapp/kanal';
import { WA_AUDIO_TYPEN } from '@/lib/whatsapp/typen';

type Antwort = ZoeWhatsappStatus & { fehler?: string; text?: string; verbinden?: { code: string; bis: string; nummer: string; zoeNummer?: string; link?: string } };

const uhr = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })}` : '—');
const EREIGNIS: Record<string, string> = { einwilligung: 'Eingewilligt', bestaetigt: 'Nummer bestätigt', widerruf: 'Getrennt', 'inhalte-an': 'Inhalte eingeschaltet', 'inhalte-aus': 'Inhalte ausgeschaltet' };

async function senden(body: Record<string, unknown>): Promise<Antwort | { ok: false; fehler: string }> {
  const r = await fetch('/api/zoe/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const d = r ? await r.json().catch(() => null) as Antwort | { ok: false; fehler: string } | null : null;
  return d ?? { ok: false, fehler: 'MAKE OS ist gerade nicht erreichbar.' };
}

export function ZoeWhatsappKarte({ i = 0 }: { i?: number }) {
  const [s, setS] = useState<ZoeWhatsappStatus | null>(null);
  const [code, setCode] = useState<Antwort['verbinden'] | null>(null);
  const [nummer, setNummer] = useState('');
  const [zustimmung, setZustimmung] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [fehler, setFehler] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = async () => {
    const r = await fetch('/api/zoe/whatsapp', { cache: 'no-store' }).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => null) as ZoeWhatsappStatus | null : null;
    if (d) setS(d);
  };
  useEffect(() => { void laden(); }, []);

  const aktion = async (body: Record<string, unknown>, ok?: string) => {
    setFehler(''); setMeldung('');
    const d = await senden(body);
    if (!d.ok) { setFehler(d.fehler); return null; }
    setS(d);
    if (ok || d.text) setMeldung(d.text ?? ok ?? '');
    return d;
  };

  const verbinden = async () => {
    if (!s) return;
    const d = await aktion({ aktion: 'verbinden', nummer, fassung: s.fassung.einwilligung });
    if (d && 'verbinden' in d && d.verbinden) { setCode(d.verbinden); setNummer(''); setZustimmung(false); }
  };
  const inhalte = async (an: boolean) => {
    if (!s) return;
    if (an && !(await bestaetigen({ titel: INHALTE_TEXT.titel, text: INHALTE_TEXT.text, ja: 'Inhalte senden' }))) return;
    await aktion({ aktion: 'inhalte', an, fassung: s.fassung.inhalte }, an ? 'Inhalte eingeschaltet.' : 'Nur noch Hinweise mit Link.');
  };
  const trennen = async () => {
    if (!(await bestaetigen({ titel: 'ZOE auf WhatsApp trennen?', text: 'ZOE schreibt dir dort nicht mehr. Nummer und Sprachnachrichten werden gelöscht; der Nachweis deiner Einwilligung bleibt.', ja: 'Trennen', gefahr: true }))) return;
    setCode(null);
    await aktion({ aktion: 'trennen' });
  };

  const k = s?.kanal;
  const zustand = !s ? { text: 'lädt …', farbe: C.inkLeise }
    : s.konflikt ? { text: 'gleiche Nummer wie Business', farbe: KUGEL.granat }
    : !s.eingerichtet ? { text: 'nicht eingerichtet', farbe: C.inkLeise }
    : s.verbindung === 'token' ? { text: 'Verbindung erneuern', farbe: KUGEL.granat }
    : k?.status === 'verbunden' ? { text: 'verbunden', farbe: KUGEL.smaragd }
    : k?.status === 'wartet' ? { text: 'wartet auf den Code', farbe: LEUCHT.achtung }
    : { text: 'nicht verbunden', farbe: C.inkLeise };

  return (
    <Karte i={i} akzent={k?.status === 'verbunden' ? KUGEL.smaragd : undefined} id="zoe-whatsapp">
      <Ueberschrift farbe={KUGEL.smaragd} rechts={<Chip farbe={zustand.farbe}>{zustand.text}</Chip>}>ZOE auf WhatsApp</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, marginBottom: 12 }}>
        ZOE erreicht dich über ihre eigene WhatsApp-Nummer: Briefing am Morgen, Wochenstart, Rückblick, Erinnerungen, Sicherheits-Hinweise. Du kannst ihr dort
        Fragen stellen, „Aufgabe: …“ oder „Notiz: …“ schicken (landen als Vorschlag in deinen Freigaben). Ohne Ausnahme kommen nur Hinweise mit Link.
      </div>

      {s?.konflikt && <Hinweis art="kritisch" titel="Gleiche Nummer wie die Business-Nummer">Die ZOE-Nummer muss eine eigene Nummer sein — sie bleibt aus, bis auf dem Server eine andere eingetragen ist (deploy/zoe-whatsapp-verbinden.sh).</Hinweis>}
      {s && !s.eingerichtet && !s.konflikt && (
        <div style={{ display: 'grid', gap: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
          <div>Auf dieser Instanz ist noch keine ZOE-Nummer eingerichtet.{s.inhaber ? ' Schritte bei Meta und das Skript stehen in UPDATES.md › 08.10. „ZOE auf WhatsApp“.' : ' Das richtet der Inhaber ein.'}</div>
          {s.inhaber && s.fehlend.length > 0 && <div style={{ fontFamily: SCHRIFT.mono, color: C.inkLeise, wordBreak: 'break-word' }}>Auf dem Server fehlt noch: {s.fehlend.join(' · ')}</div>}
          {s.inhaber && <div style={{ color: C.inkLeise }}>Webhook bei Meta: {s.webhookAdresse ? <code style={{ fontFamily: SCHRIFT.mono, wordBreak: 'break-all' }}>{s.webhookAdresse}</code> : 'https://<eure Adresse>/api/zoe/whatsapp/webhook'}</div>}
        </div>
      )}

      {s?.eingerichtet && k && (
        <div style={{ display: 'grid', gap: 12 }}>
          {s.verbindung === 'token' && <Hinweis art="kritisch" titel="Verbindung erneuern">Meta hat den Zugriffsschlüssel der ZOE-Nummer abgelehnt. {s.inhaber ? 'Neuen dauerhaften Schlüssel erzeugen und deploy/zoe-whatsapp-verbinden.sh erneut ausführen.' : 'Das erneuert der Inhaber.'} Bis dahin laufen Hinweise über Telegram bzw. gar nicht.</Hinweis>}

          {(k.status === 'aus' || k.status === 'getrennt') && (
            <form onSubmit={e => { e.preventDefault(); void verbinden(); }} style={{ display: 'grid', gap: 12 }}>
              <Schalter karte an={zustimmung} onChange={setZustimmung} beschreibung={EINWILLIGUNG_TEXT.text}>{EINWILLIGUNG_TEXT.titel}</Schalter>
              <Feldzeile label="Deine Handynummer (mit Vorwahl)">
                <input value={nummer} onChange={e => setNummer(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+49 170 1234567" style={{ ...eingabe, maxWidth: 320 }} />
              </Feldzeile>
              <div><Knopf haupt typ="submit" aus={!zustimmung || nummer.trim().length < 6}>Code holen</Knopf></div>
            </form>
          )}

          {k.status === 'wartet' && (
            <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, border: `1px solid ${C.linie}` }}>
              {code ? (
                <>
                  <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
                    Schick diesen Code von {code.nummer} an die ZOE-Nummer{code.zoeNummer ? <> <b style={{ color: C.ink }}>{code.zoeNummer}</b></> : ''} — gültig bis {uhr(code.bis)}:
                  </div>
                  <div style={{ fontFamily: SCHRIFT.mono, fontSize: TYP.zahl, letterSpacing: '.18em', color: C.ink }} aria-label="Code">{code.code}</div>
                  {code.link && <div><Knopf href={code.link} ton="gut">In WhatsApp öffnen</Knopf></div>}
                </>
              ) : (
                <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>Ein Code für {k.nummer} gilt bis {uhr(k.wartetBis)}. Den Code siehst du nur direkt nach „Code holen“ — sonst einfach neu verbinden.</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Knopf leise onClick={async () => { await laden(); }}>Ist es angekommen?</Knopf>
                <Knopf leise onClick={trennen}>Abbrechen</Knopf>
              </div>
            </div>
          )}

          {k.status === 'verbunden' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, fontSize: TYP.bedien }}>
                <Angabe label="Deine Nummer" wert={k.nummer ?? '—'} mono />
                <Angabe label="Verbunden seit" wert={uhr(k.verbundenSeit)} />
                <Angabe label="24-Stunden-Fenster" wert={k.fenster.offen ? `offen bis ${uhr(k.fenster.bis ?? undefined)}` : 'zu — Hinweise als Vorlage „Briefing bereit“'} />
                {s.zoeNummer && <Angabe label="ZOE-Nummer" wert={s.zoeNummer} mono />}
              </div>
              <Schalter karte an={k.inhalte.an} onChange={an => { void inhalte(an); }} beschreibung={k.inhalte.an ? `Eingeschaltet seit ${uhr(k.inhalte.seit)}. ${INHALTE_TEXT.text}` : 'Aus: nur neutrale Hinweise mit Link. Einschalten fragt noch einmal nach.'}>{INHALTE_TEXT.titel}</Schalter>
              {k.offeneVorschlaege > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{k.offeneVorschlaege} Vorschlag{k.offeneVorschlaege === 1 ? '' : 'e'} von WhatsApp warten in deinen Freigaben.</div>}
              <Sprachnachrichten liste={k.sprachnachrichten} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Knopf onClick={async () => { await aktion({ aktion: 'test' }); }}>Test-Nachricht</Knopf>
                <Knopf leise onClick={trennen}>Trennen</Knopf>
              </div>
            </>
          )}

          {k.ereignisse.length > 0 && (
            <details style={{ fontSize: TYP.bedien, color: C.inkDim }}>
              <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Nachweise ({k.ereignisse.length})</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 4 }}>
                {[...k.ereignisse].reverse().map((e, j) => <li key={j}>{uhr(e.zeit)} · {EREIGNIS[e.art] ?? e.art} · {e.quelle === 'whatsapp' ? 'über WhatsApp' : 'in MAKE OS'}</li>)}
              </ul>
            </details>
          )}
          {s.inhaber && !s.registriert && <Registrieren onFertig={async (body) => { await aktion(body); }} />}
          {s.inhaber && s.registriert && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>ZOE-Nummer aus MAKE OS registriert am {uhr(s.registriert.am)} · Speicherort {s.registriert.speicherort === 'DE' ? 'Deutschland' : 'ohne Local Storage'}.</div>}
          {s.inhaber && s.vorlage && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Vorlage „{s.vorlage.name}“ ({s.vorlage.sprache}): {s.vorlage.status === 'APPROVED' ? 'genehmigt' : s.vorlage.status}{' · '}<button type="button" onClick={async () => { await aktion({ aktion: 'pruefen' }, 'Geprüft.'); }} style={{ background: 'none', border: 0, color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, minHeight: 44, padding: 0 }}>bei Meta prüfen</button></div>}
        </div>
      )}
      {fehler && <div style={{ marginTop: 12 }}><Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis></div>}
      {meldung && <div role="status" style={{ marginTop: 12, fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}
      {dialog}
    </Karte>
  );
}

/** Die ZOE-Nummer einmalig registrieren (nur der Inhaber) — wie die Business-Nummer: PIN nie gespeichert, Speicherort Deutschland empfohlen. */
function Registrieren({ onFertig }: { onFertig: (body: Record<string, unknown>) => Promise<void> }) {
  const [auf, setAuf] = useState(false);
  const [pin, setPin] = useState('');
  const [ort, setOrt] = useState<'DE' | 'ohne'>('DE');
  const { bestaetigen, dialog } = useRueckfrage();
  if (!auf) return <div><Knopf leise onClick={() => setAuf(true)}>ZOE-Nummer registrieren …</Knopf></div>;
  const los = async () => {
    const ok = await bestaetigen({ titel: 'ZOE-Nummer jetzt bei Meta registrieren?', text: ort === 'DE' ? 'Einmaliger Schritt. Gespeicherte Daten bleiben bei Meta in Deutschland (Local Storage „DE“) — das lässt sich nur jetzt festlegen. Meta erlaubt höchstens 10 Versuche in 72 Stunden.' : 'Einmaliger Schritt OHNE Local Storage — später nicht mehr umstellbar.', ja: 'Jetzt registrieren' });
    if (!ok) return;
    await onFertig({ aktion: 'registrieren', pin, speicherort: ort });
    setPin(''); setAuf(false);
  };
  return (
    <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 12, border: `1px solid ${C.linie}` }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>Die 6-stellige PIN ist die Zwei-Schritt-PIN der ZOE-Nummer (neu, wenn noch keine gesetzt ist) — MAKE OS speichert sie nicht.</div>
      <Segmente liste={[{ id: 'DE', label: 'Speicherort Deutschland (empfohlen)' }, { id: 'ohne', label: 'ohne Local Storage' }]} aktiv={ort} onWahl={setOrt} umbrechen />
      <Feldzeile label="PIN (6 Ziffern)">
        <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="off" type="password" style={{ ...eingabe, maxWidth: 220 }} aria-label="PIN" />
      </Feldzeile>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={los} aus={pin.length !== 6} ton="gut">Registrieren</Knopf>
        <Knopf leise onClick={() => { setAuf(false); setPin(''); }}>Abbrechen</Knopf>
      </div>
      {dialog}
    </div>
  );
}

function Angabe({ label, wert, mono }: { label: string; wert: string; mono?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>{label}</span>
      <span style={{ color: C.ink, fontFamily: mono ? SCHRIFT.mono : undefined, overflowWrap: 'anywhere' }}>{wert}</span>
    </div>
  );
}

/** Eigene Sprachnachrichten anhören — erst auf Klick geladen, als Audio nur mit bekanntem Audio-Typ (nie automatisch abgespielt). */
function Sprachnachrichten({ liste }: { liste: ZoeWhatsappStatus['kanal']['sprachnachrichten'] }) {
  const [quelle, setQuelle] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);
  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);
  if (!liste.length) return null;
  const anhoeren = async (id: string, mime: string) => {
    const r = await fetch(`/api/zoe/whatsapp/sprachnachricht?id=${encodeURIComponent(id)}`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return;
    const typ = (WA_AUDIO_TYPEN as readonly string[]).includes(mime) ? mime : 'application/octet-stream';
    const u = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: typ }));
    urls.current.push(u);
    setQuelle(q => ({ ...q, [id]: u }));
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>Sprachnachrichten an ZOE (30 Tage)</span>
      {liste.map(x => (
        <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
          <span>{uhr(x.am)}</span>
          {x.zustand !== 'abgelegt' ? <span>{x.zustand === 'zu-gross' ? 'zu groß — nur in WhatsApp' : 'ließ sich nicht laden'}</span>
            : quelle[x.id] ? <audio controls preload="none" src={quelle[x.id]} style={{ maxWidth: '100%' }} />
            : <Knopf leise onClick={async () => { await anhoeren(x.id, x.mime); }}>Anhören</Knopf>}
        </div>
      ))}
    </div>
  );
}
