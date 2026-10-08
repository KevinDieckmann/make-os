'use client';

// ─── Konto › Inhaber (09.10., R9 — mehrere gleichwertige Inhaber) ───────────────────────────────────────────────
// Ein Inhaber macht eine Person aus demselben Haushalt (mit zweitem Faktor) zum Inhaber; ein weiterer Inhaber gibt die eigene Rolle
// wieder ab. Beides erst nach Rückfrage und Passwort (+ Code). Der Haupt-Inhaber (Altbestand, Systemläufe, Haushalts-Kalender) und der
// letzte Inhaber geben nie ab. Alles prüft der Server (POST /api/konto/haushalt, Regeln in lib/zugang/inhaber.ts) — die Oberfläche
// erklärt nur und fragt nach. Keine Namen-Sonderfälle: jedes Konto gleich.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, Chip, Hinweis, Feldzeile, feld, LEUCHT, useRueckfrage } from './ui';

interface K { speicher: string; name: string; rolle: 'inhaber' | 'mitglied'; haushalt: string | null; zweiterFaktorAn?: boolean; hauptInhaber?: boolean }
interface Vorhaben { aktion: 'inhaber' | 'abgeben'; speicher: string; name: string }

export function InhaberVerwaltung({ ich, zweiterFaktorAn, i = 0 }: { ich: string; zweiterFaktorAn: boolean; i?: number }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const [konten, setKonten] = useState<K[] | null>(null);
  const [haushalt, setHaushalt] = useState<string | null>(null);
  const [vorhaben, setVorhaben] = useState<Vorhaben | null>(null);
  const [eingabe, setEingabe] = useState({ passwort: '', code: '' });
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const laden = () => fetch('/api/konto/haushalt').then(r => r.json()).then(d => { setKonten(d.ok ? d.konten : null); setHaushalt(d.haushalt ?? null); }).catch(() => setKonten(null));
  useEffect(() => { void laden(); }, []);
  if (!konten) return null;

  const inhaber = konten.filter(k => k.rolle === 'inhaber');
  const ichKonto = konten.find(k => k.speicher === ich);

  async function oeffnen(v: Vorhaben) {
    setMeldung(null);
    const ja = v.aktion === 'inhaber'
      ? await bestaetigen({ titel: `${v.name} zum Inhaber machen?`, text: 'Dann hat das Konto dieselben Inhaber-Rechte wie du: Konten einladen, Haushalt, zweiter Faktor für alle, Datenschutz, Nachweise und Agenten verwalten. Persönliches (Gesundheit, „nur ich“, private Notizen) bleibt bei jeder Person. Alle Inhaber bekommen eine Meldung.', ja: 'Weiter' })
      : await bestaetigen({ titel: 'Inhaber-Rolle abgeben?', text: 'Du bleibst Mitglied mit allen eigenen Daten, verwaltest aber Konten, Haushalt und Datenschutz nicht mehr. Ein Inhaber kann dich später wieder zum Inhaber machen. Alle Inhaber bekommen eine Meldung.', ja: 'Weiter', gefahr: true });
    if (ja) { setVorhaben(v); setEingabe({ passwort: '', code: '' }); }
  }
  async function ausfuehren() {
    if (!vorhaben) return;
    const r = await fetch('/api/konto/haushalt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: vorhaben.aktion, ...(vorhaben.aktion === 'inhaber' ? { speicher: vorhaben.speicher } : {}), passwort: eingabe.passwort, ...(eingabe.code.trim() ? { code: eingabe.code.trim() } : {}) }),
    }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' })) as { ok: boolean; fehler?: string };
    if (!r.ok) { setMeldung({ text: r.fehler ?? 'Nicht geändert.', gut: false }); return; }
    setMeldung({ text: vorhaben.aktion === 'inhaber' ? `${vorhaben.name} ist jetzt Inhaber.` : 'Du hast die Inhaber-Rolle abgegeben.', gut: true });
    setVorhaben(null);
    if (vorhaben.aktion === 'abgeben') window.setTimeout(() => window.location.reload(), 1200); else void laden();
  }

  /** Rechts in der Zeile: Rolle als Chip, dazu die eine mögliche Handlung. */
  function rechts(k: K) {
    if (k.rolle === 'inhaber') {
      return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Chip farbe={LEUCHT.puls}>{k.hauptInhaber ? 'Haupt-Inhaber' : 'Inhaber'}</Chip>
          {k.speicher === ich && !k.hauptInhaber && inhaber.length > 1 && <Knopf leise ton="warn" onClick={() => void oeffnen({ aktion: 'abgeben', speicher: k.speicher, name: k.name })}>Rolle abgeben</Knopf>}
        </div>
      );
    }
    const imHaushalt = !!haushalt && k.haushalt === haushalt;
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Chip farbe={C.inkLeise}>Mitglied</Chip>
        {imHaushalt && <Knopf leise aus={!k.zweiterFaktorAn} titel={k.zweiterFaktorAn ? undefined : 'Erst muss das Konto den zweiten Faktor einrichten.'} onClick={() => void oeffnen({ aktion: 'inhaber', speicher: k.speicher, name: k.name.split(/\s+/)[0] || k.name })}>Zum Inhaber machen</Knopf>}
      </div>
    );
  }

  const ohneFaktor = konten.filter(k => k.rolle !== 'inhaber' && !!haushalt && k.haushalt === haushalt && !k.zweiterFaktorAn).length;
  return (
    <Karte i={i} id="inhaber" akzent={LEUCHT.puls}>
      <Ueberschrift farbe={LEUCHT.puls}>Inhaber</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 6 }}>
        Inhaber verwalten die Instanz gleichwertig: Konten, Haushalt, zweiter Faktor, Datenschutz, Nachweise, Agenten. Persönliches bleibt bei jeder
        Person. Inhaber kann werden, wer im selben Haushalt ist und den zweiten Faktor eingerichtet hat.
      </div>
      <Liste>
        {konten.map(k => <Zeile key={k.speicher} titel={k.name} rechts={rechts(k)} />)}
      </Liste>
      {ohneFaktor > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>{ohneFaktor === 1 ? 'Ein Konto im Haushalt hat' : `${ohneFaktor} Konten im Haushalt haben`} noch keinen zweiten Faktor — erst danach geht „Zum Inhaber machen“.</div>}
      {ichKonto?.hauptInhaber && inhaber.length > 1 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Als Haupt-Inhaber gibst du die Rolle nicht ab: An dir hängen der Altbestand, die Systemläufe und der Haushalts-Kalender.</div>}
      {vorhaben && (
        <form onSubmit={e => { e.preventDefault(); void ausfuehren(); }} style={{ display: 'grid', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linie}` }}>
          <Hinweis art="info" titel={vorhaben.aktion === 'inhaber' ? `${vorhaben.name} zum Inhaber machen` : 'Inhaber-Rolle abgeben'}>Zur Sicherheit noch einmal dein Passwort{zweiterFaktorAn ? ' und den Code aus der Authenticator-App' : ''}.</Hinweis>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <Feldzeile label="Passwort"><input type="password" autoComplete="current-password" value={eingabe.passwort} onChange={e => setEingabe({ ...eingabe, passwort: e.target.value })} style={feld} /></Feldzeile>
            {zweiterFaktorAn && <Feldzeile label="Code (6 Ziffern) oder Wiederherstellungscode"><input inputMode="text" autoComplete="one-time-code" value={eingabe.code} onChange={e => setEingabe({ ...eingabe, code: e.target.value })} style={feld} /></Feldzeile>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf typ="submit" ton={vorhaben.aktion === 'abgeben' ? 'warn' : 'haupt'} aus={!eingabe.passwort || (zweiterFaktorAn && eingabe.code.trim().length < 6)}>{vorhaben.aktion === 'inhaber' ? 'Zum Inhaber machen' : 'Rolle abgeben'}</Knopf>
            <Knopf leise onClick={() => { setVorhaben(null); setMeldung(null); }}>Abbrechen</Knopf>
          </div>
        </form>
      )}
      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.gut ? 'gut' : 'achtung'}>{meldung.text}</Hinweis></div>}
      {dialog}
    </Karte>
  );
}
