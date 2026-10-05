'use client';

// ─── Konto › Meine Daten (05.10., Paket „Betroffenenrechte v2“) ─────────────────────────────────────────────────
// Jede Person mit Konto übt ihre Rechte selbst aus — ohne den Inhaber zu fragen:
//   · Auskunft (Art. 15) als druckbares Dokument — mit Zwecken, Empfängern, Speicherdauer, Rechten, Herkunft, automatisierten Entscheidungen
//   · „Meine Daten herunterladen“ (Art. 20) — alle Bestände mit Bezug zur Person als JSON-Datei (laut Speicher-Register)
//   · „Mein Konto löschen“ (Art. 17) — Rückfrage, dann Passwort (+ Code, wenn der zweite Faktor an ist) und „LÖSCHEN“ eintippen.
// Alles prüft der Server (app/api/konto/daten); die Oberfläche erklärt nur und fragt nach.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Feldzeile, feld, LEUCHT, useRueckfrage } from './ui';

export function MeineDaten({ zweiterFaktorAn, inhaber, andere, i = 0 }: { zweiterFaktorAn: boolean; inhaber: boolean; andere: number; i?: number }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const [loeschen, setLoeschen] = useState<{ passwort: string; code: string; wort: string } | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const gesperrt = inhaber && andere > 0;

  async function fragenUndOeffnen() {
    setMeldung(null);
    if (gesperrt) { setMeldung({ text: `Als Inhaber können Sie Ihr Konto erst löschen, wenn es keine anderen Konten mehr gibt (noch ${andere}). Für das Ende der ganzen Instanz: System › Datenschutz › Vertragsende.`, gut: false }); return; }
    const ja = await bestaetigen({ titel: 'Mein Konto löschen?', text: 'Ihr Konto und alle Daten, die nur Ihnen gehören (z. B. Journal, Gesundheit, Zeit, Visitenkarten, Meldungen, verbundene Dienste), werden endgültig gelöscht. Protokolle behalten nur „[gelöscht]“ statt Ihrer Kennung; Aufgaben des Teams bleiben. Laden Sie Ihre Daten vorher herunter, wenn Sie sie behalten möchten. Das lässt sich nicht rückgängig machen.', ja: 'Weiter zum Löschen', gefahr: true });
    if (ja) setLoeschen({ passwort: '', code: '', wort: '' });
  }
  async function endgueltig() {
    if (!loeschen) return;
    setLaeuft(true); setMeldung(null);
    const r = await fetch('/api/konto/daten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'loeschen', passwort: loeschen.passwort, ...(loeschen.code.trim() ? { code: loeschen.code.trim() } : {}), bestaetigung: loeschen.wort }) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' })) as { ok: boolean; fehler?: string };
    setLaeuft(false);
    if (!r.ok) { setMeldung({ text: r.fehler ?? 'Nicht gelöscht.', gut: false }); return; }
    setLoeschen(null);
    setMeldung({ text: 'Ihr Konto ist gelöscht. Sie werden abgemeldet.', gut: true });
    window.setTimeout(() => window.location.assign('/anmelden'), 1800);
  }

  const bereit = !!loeschen && loeschen.passwort.length > 0 && (!zweiterFaktorAn || loeschen.code.trim().length >= 6) && loeschen.wort.trim().toUpperCase() === 'LÖSCHEN';
  return (
    <Karte i={i} id="meine-daten">
      <Ueberschrift farbe={LEUCHT.planung}>Meine Daten</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 12 }}>
        Was MAKE OS über Sie speichert, wozu, an wen es geht und wie lange — und die Daten selbst. Jeder Abruf wird im Protokoll vermerkt (ohne Inhalte).
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => window.open('/api/konto/daten?format=html', '_blank', 'noopener')}>Auskunft ansehen (Art. 15)</Knopf>
        <Knopf leise onClick={() => { window.location.href = '/api/konto/daten'; }}>Meine Daten herunterladen</Knopf>
        {!loeschen && <Knopf ton="warn" leise onClick={() => void fragenUndOeffnen()}>Mein Konto löschen</Knopf>}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Die Datei enthält Personendaten — nach der Weitergabe bitte löschen. Zugangsschlüssel (Passwort, zweiter Faktor, verbundene Dienste) stehen nie darin.</div>
      {loeschen && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linie}` }}>
          <Hinweis art="kritisch" titel="Endgültig löschen">Zur Sicherheit noch einmal Ihr Passwort{zweiterFaktorAn ? ' und den Code aus der Authenticator-App' : ''} — und „LÖSCHEN“ eintippen.</Hinweis>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Feldzeile label="Passwort"><input type="password" autoComplete="current-password" value={loeschen.passwort} onChange={e => setLoeschen({ ...loeschen, passwort: e.target.value })} style={feld} /></Feldzeile>
            {zweiterFaktorAn && <Feldzeile label="Code (6 Ziffern) oder Wiederherstellungscode"><input inputMode="text" autoComplete="one-time-code" value={loeschen.code} onChange={e => setLoeschen({ ...loeschen, code: e.target.value })} style={feld} /></Feldzeile>}
            <Feldzeile label="Zur Bestätigung „LÖSCHEN“"><input value={loeschen.wort} onChange={e => setLoeschen({ ...loeschen, wort: e.target.value })} style={feld} /></Feldzeile>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf ton="warn" aus={!bereit || laeuft} onClick={() => void endgueltig()}>{laeuft ? 'Wird gelöscht …' : 'Konto endgültig löschen'}</Knopf>
            <Knopf leise onClick={() => { setLoeschen(null); setMeldung(null); }}>Abbrechen</Knopf>
          </div>
        </div>
      )}
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.gut ? 'gut' : 'achtung'}>{meldung.text}</Hinweis></div>}
      {dialog}
    </Karte>
  );
}
