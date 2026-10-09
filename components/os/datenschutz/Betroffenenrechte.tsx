'use client';

// ─── System › Datenschutz · Betroffenenrechte v2 (05.10.) ────────────────────────────────────────────────────────
// Zwei Karten:
//   · Information nach Art. 14 — Vorlage für Kontakte aus Dritt-Quellen (Recherche, Liste, Empfehlung). Der Entwurf entsteht in der Akte
//     (Stammdaten › Datenschutz der Person), gesendet wird nur von Hand im Mail-Programm. Ändern darf nur der Inhaber (Server prüft).
//   · Vertragsende — Instanz-Export (alles entschlüsselt, nur Inhaber + Passwort/zweiter Faktor) und der dokumentierte Löschweg
//     (scripts/instanz-loeschen.mjs, nie aus der App).

import { useEffect, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Feldzeile, feld, Chip, LEUCHT } from '../ui';
import type { EinrichtungAntwort } from './Verantwortlicher';

export function Art14VorlageKarte({ d, onGeaendert, i = 0 }: { d: EinrichtungAntwort; onGeaendert: () => void; i?: number }) {
  const [v, setV] = useState(d.art14Wirksam ?? { betreff: '', text: '' });
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  useEffect(() => { setV(d.art14Wirksam ?? { betreff: '', text: '' }); }, [d.art14Wirksam]);
  const post = (body: Record<string, unknown>) => fetch('/api/datenschutz/einrichtung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
  async function speichern() {
    const r = await post({ aktion: 'art14-vorlage', vorlage: v });
    setMeldung(r.ok ? { text: 'Gespeichert — neue Entwürfe nutzen diese Vorlage.', gut: true } : { text: r.fehler ?? 'Nicht gespeichert.', gut: false });
    if (r.ok) onGeaendert();
  }
  async function zuruecksetzen() {
    const r = await post({ aktion: 'art14-vorlage-leeren' });
    setMeldung(r.ok ? { text: 'Zurück auf die mitgelieferte Vorlage.', gut: true } : { text: r.fehler ?? 'Nicht zurückgesetzt.', gut: false });
    if (r.ok) onGeaendert();
  }
  return (
    <Karte i={i} id="art14">
      <Ueberschrift rechts={<Chip farbe={d.art14 ? LEUCHT.gut : C.inkDim}>{d.art14 ? 'eigene Vorlage' : 'mitgeliefert'}</Chip>}>Information nach Art. 14</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 10 }}>
        Wer Daten nicht bei der Person selbst erhebt (Recherche, Liste, Empfehlung), muss sie spätestens nach einem Monat informieren. In der Akte entsteht daraus ein Entwurf mit ihren Angaben — gesendet wird nur von Ihnen, im Mail-Programm. Die Selbstprüfung meldet offene Fristen.
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <Feldzeile label="Betreff"><input value={v.betreff} onChange={e => setV({ ...v, betreff: e.target.value })} disabled={!d.darf} maxLength={160} style={feld} /></Feldzeile>
        <Feldzeile label="Text"><textarea value={v.text} onChange={e => setV({ ...v, text: e.target.value })} disabled={!d.darf} rows={10} maxLength={6000} style={{ ...feld, resize: 'vertical', lineHeight: 1.5, fontSize: TYP.bedien }} /></Feldzeile>
      </div>
      {d.platzhalter && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {Object.entries(d.platzhalter).map(([k, t]) => <span key={k} title={t} style={{ fontFamily: SCHRIFT.mono, fontSize: 12, color: C.inkDim, border: `1px solid ${C.linie}`, borderRadius: 6, padding: '2px 6px' }}>{`{{${k}}}`}</span>)}
      </div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        {d.darf ? <><Knopf onClick={speichern}>Speichern</Knopf>{d.art14 && <Knopf leise onClick={zuruecksetzen}>Mitgelieferte Vorlage</Knopf>}</> : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Ändern kann nur der Inhaber.</span>}
        {meldung && <span role="status" style={{ fontSize: TYP.bedien, color: meldung.gut ? LEUCHT.gut : LEUCHT.achtung }}>{meldung.text}</span>}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Pflicht im Text: {'{{verantwortlicher}}'} und {'{{herkunft}}'}. Hinweis, keine Rechtsberatung — einmal anwaltlich gegenlesen.</div>
    </Karte>
  );
}

export function VertragsendeKarte({ i = 0 }: { i?: number }) {
  const [umfang, setUmfang] = useState<{ bestaende: number; dateien: number; bilder: number; medien?: number } | null>(null);
  const [f, setF] = useState({ passwort: '', code: '' });
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [zweiterFaktor, setZweiterFaktor] = useState(false);
  useEffect(() => { fetch('/api/datenschutz/instanz-export', { cache: 'no-store' }).then(x => x.json()).then(r => { if (r.ok) setUmfang(r.umfang); }).catch(() => {}); }, []);
  async function exportieren() {
    setLaeuft(true); setMeldung(null);
    try {
      const r = await fetch('/api/datenschutz/instanz-export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passwort: f.passwort, ...(f.code.trim() ? { code: f.code.trim() } : {}) }) });
      if (!r.ok) {
        const j = await r.json().catch(() => ({})) as { fehler?: string; zweiterFaktor?: boolean };
        if (j.zweiterFaktor) setZweiterFaktor(true);
        setMeldung({ text: j.fehler ?? 'Export nicht möglich.', gut: false });
        return;
      }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'MAKE-OS-Instanz-Export.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setF({ passwort: '', code: '' });
      setMeldung({ text: `Export fertig (${Math.round(blob.size / 1024)} KB). Die Datei enthält alle Personendaten entschlüsselt — nur verschlüsselt übergeben und danach löschen.`, gut: true });
    } catch { setMeldung({ text: 'Keine Verbindung.', gut: false }); }
    finally { setLaeuft(false); }
  }
  if (!umfang) return null; // nur der Inhaber bekommt den Umfang — alle anderen sehen die Karte nicht (der Server sagt 403)
  return (
    <Karte i={i} id="vertragsende">
      <Ueberschrift farbe={LEUCHT.achtung}>Vertragsende: Export und Löschung der Instanz</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 10 }}>
        Rückgabe aller Daten (AVV § 11): {umfang.bestaende} Bestände, {umfang.dateien} Dateien, {umfang.bilder} Bilder — entschlüsselt in einer JSON-Datei.
        {umfang.medien ? ` Fotos & Videos (${umfang.medien}): Angaben und Liste der Dateien — die Dateien selbst vorher in der App herunterladen.` : ''} Nur für den Inhaber, mit Passwort{zweiterFaktor ? ' und Code' : ' (und Code, wenn der zweite Faktor an ist)'}; der Abruf steht im Protokoll.
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Feldzeile label="Passwort"><input type="password" autoComplete="current-password" value={f.passwort} onChange={e => setF({ ...f, passwort: e.target.value })} style={feld} /></Feldzeile>
        <Feldzeile label="Code (zweiter Faktor)"><input autoComplete="one-time-code" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} style={feld} /></Feldzeile>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <Knopf aus={!f.passwort || laeuft} onClick={() => void exportieren()}>{laeuft ? 'Wird exportiert …' : 'Alles exportieren'}</Knopf>
      </div>
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.gut ? 'gut' : 'achtung'}>{meldung.text}</Hinweis></div>}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.55, marginTop: 12 }}>
        Löschen der Instanz geht bewusst NICHT aus der App: auf dem Server <code style={{ fontFamily: SCHRIFT.mono }}>node scripts/instanz-loeschen.mjs --ordner &lt;Datenordner&gt;</code> zeigt im Trockenlauf, was gelöscht würde, nennt die Sicherungen (werden nach spätestens 12 Monaten überschrieben) und gibt einen Bestätigungs-Code aus; erst mit <code style={{ fontFamily: SCHRIFT.mono }}>--ausfuehren --code …</code> wird gelöscht. Anleitung: datenschutz/LOESCHKONZEPT.md › 6 und KUNDEN_ONBOARDING_DATENSCHUTZ.md › E.
      </div>
    </Karte>
  );
}
