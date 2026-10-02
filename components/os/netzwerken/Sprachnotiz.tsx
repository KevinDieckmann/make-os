'use client';

// ─── Netzwerken — Sprachnotiz aufnehmen (02.10.) ─────────────────────────────
// Direkt auf der Veranstaltung: Knopf drücken, sprechen, fertig. Aufgenommen wird mit `MediaRecorder` (iPhone-Safari: mp4/AAC,
// Chrome: webm/Opus); fehlt er oder ist das Mikrofon gesperrt (z. B. keine sichere Verbindung), öffnet derselbe Knopf die
// Aufnahme-Auswahl des Geräts (`<input type="file" accept="audio/*" capture>`). Die Aufnahme geht verschlüsselt an den Kontakt,
// die Abschrift folgt später (KI) — bis dahin steht am Kontakt „Abschrift folgt (KI)“.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, LEUCHT } from '@/lib/make-one/design';
import { Gross, Hinweis, ZIEL } from './bausteine';
import { MAX_AUDIO_BYTES } from '@/lib/crm/netzwerken';

export interface Aufnahme { blob: Blob; typ: string; dauerSek: number; url: string }

const MAX_SEKUNDEN = 300;
/** Das erste Format, das dieser Browser aufnehmen kann (Safari: mp4, sonst webm). */
function format(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Sprachnotiz({ wert, onWert }: { wert: Aufnahme | null; onWert: (a: Aufnahme | null) => void }) {
  const [nimmtAuf, setNimmtAuf] = useState(false);
  const [sek, setSek] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const strom = useRef<MediaStream | null>(null);
  const stuecke = useRef<Blob[]>([]);
  const start = useRef(0);
  const takt = useRef<ReturnType<typeof setInterval> | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  // Aufräumen: Mikrofon frei, URL freigeben.
  useEffect(() => () => { if (takt.current) clearInterval(takt.current); strom.current?.getTracks().forEach(t => t.stop()); }, []);
  useEffect(() => { const u = wert?.url; return () => { if (u) URL.revokeObjectURL(u); }; }, [wert?.url]);

  const fertig = (blob: Blob, typ: string, dauer: number) => {
    if (blob.size > MAX_AUDIO_BYTES) { setFehler(`Die Aufnahme ist zu groß (höchstens ${MAX_AUDIO_BYTES / 1024 / 1024} MB) — bitte kürzer sprechen.`); return; }
    onWert({ blob, typ: typ.split(';')[0] || 'audio/mp4', dauerSek: dauer, url: URL.createObjectURL(blob) });
  };

  const stoppen = () => {
    if (takt.current) { clearInterval(takt.current); takt.current = null; }
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  };

  const beginnen = async () => {
    setFehler(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { datei.current?.click(); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      strom.current = s;
      const typ = format();
      const r = new MediaRecorder(s, typ ? { mimeType: typ } : undefined);
      stuecke.current = [];
      r.ondataavailable = e => { if (e.data.size) stuecke.current.push(e.data); };
      r.onstop = () => {
        s.getTracks().forEach(t => t.stop()); strom.current = null;
        setNimmtAuf(false);
        const dauer = Math.max(1, Math.round((Date.now() - start.current) / 1000));
        const blob = new Blob(stuecke.current, { type: r.mimeType || typ || 'audio/mp4' });
        if (blob.size) fertig(blob, blob.type, dauer); else setFehler('Es kam nichts an — bitte noch einmal aufnehmen.');
      };
      rec.current = r;
      start.current = Date.now();
      setSek(0); setNimmtAuf(true);
      r.start();
      takt.current = setInterval(() => { const s2 = Math.round((Date.now() - start.current) / 1000); setSek(s2); if (s2 >= MAX_SEKUNDEN) stoppen(); }, 500);
    } catch {
      // Mikrofon gesperrt oder nicht erreichbar → die Aufnahme-Auswahl des Geräts.
      setNimmtAuf(false);
      datei.current?.click();
    }
  };

  const ausDatei = (f: File | undefined) => { if (f) fertig(f, f.type || 'audio/mp4', 0); };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input ref={datei} type="file" accept="audio/*" capture tabIndex={-1} aria-hidden style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={x => { const f = x.target.files?.[0]; x.target.value = ''; ausDatei(f); }} />
      {!wert && !nimmtAuf && <Gross onClick={() => void beginnen()}><span aria-hidden>🎙</span> Sprachnotiz aufnehmen</Gross>}
      {nimmtAuf && (
        <div role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, color: LEUCHT.kritisch, fontWeight: 700 }}>
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: LEUCHT.kritisch, boxShadow: `0 0 10px ${LEUCHT.kritisch}` }} />Nimmt auf · {mmss(sek)}
          </div>
          <Gross ton="warn" onClick={stoppen}>■ Aufnahme beenden</Gross>
        </div>
      )}
      {wert && (
        <div style={{ display: 'grid', gap: 8 }}>
          <audio controls src={wert.url} style={{ width: '100%', minHeight: ZIEL }} aria-label="Sprachnotiz anhören" />
          <div style={{ fontSize: 13, color: C.inkDim }}>{wert.dauerSek ? `${mmss(wert.dauerSek)} · ` : ''}Abschrift folgt (KI) — die Aufnahme geht verschlüsselt an den Kontakt.</div>
          <Gross onClick={() => onWert(null)} kleinerAbstand>Aufnahme löschen</Gross>
        </div>
      )}
      {fehler && <Hinweis farbe={LEUCHT.achtung} rolle="alert">{fehler}</Hinweis>}
    </div>
  );
}
