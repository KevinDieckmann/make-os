'use client';

// ─── Umzug aus Malins Cockpit ───────────────────────────────────────────────
// Zwei Schritte. PROBELAUF: alles aus Supabase lesen, exakt zählen, in einen
// Probe-Bestand legen — der echte Haushalt bleibt unberührt. Der Bericht zeigt,
// ob Zeilenzahlen und Summen stimmen. ÜBERNEHMEN: genau das Geprüfte in den
// Haushalt. Endgültig erst, wenn Malins Cockpit eingefroren ist — sonst wird
// an zwei Orten gepflegt.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/haushalt/typen';
import { datumDe, monatKurz } from '@/lib/finanzen/haushalt/monat';
import type { Umzugsbericht } from '@/lib/finanzen/haushalt/supabase-umzug';
import type { DateiBericht } from '@/lib/finanzen/haushalt/datei-umzug';
import { Knopf, feld, LEUCHT } from '../schlank';
import { Dialog, Feld } from './gemeinsam';

const NAMEN: Record<string, string> = { konten: 'Konten', kategorien: 'Kategorien', zuordnungsregeln: 'Zuordnungen', schulden: 'Schulden', planwerte: 'Planwerte', belege: 'Rechnungen & Belege', buchungen: 'Buchungen' };

export function UmzugDialog({ onZu, laden, melde }: { onZu: () => void; laden: () => Promise<void>; melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void }) {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [bericht, setBericht] = useState<Umzugsbericht | null>(null);
  const [zeit, setZeit] = useState<string | null>(null);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [summenAuf, setSummenAuf] = useState(false);
  // 24.09.: Kevin — „nicht mit Malins Board verbinden, die Daten aus der Datei holen“.
  const [weg, setWeg] = useState<'dateien' | 'supabase'>('dateien');
  const [sicherung, setSicherung] = useState<{ name: string; daten: unknown } | null>(null);
  const [v1, setV1] = useState<{ name: string; daten: unknown } | null>(null);
  const [datei, setDatei] = useState<(DateiBericht & { regelTreffer: number; sonstiges: number; offenEin: number }) | null>(null);
  useEffect(() => { fetch('/api/haushalt/umzug').then(r => r.json()).then(d => { if (d.stand?.bericht) { setBericht(d.stand.bericht); setZeit(d.stand.zeit); setDatei(d.stand.datei ?? null); } }).catch(() => {}); }, []);

  async function lies(f: File | undefined, setze: (x: { name: string; daten: unknown } | null) => void) {
    if (!f) return;
    try { setze({ name: f.name, daten: JSON.parse(await f.text()) }); }
    catch { melde('fehler', 'Datei nicht lesbar', `${f.name} ist kein gültiges JSON.`); setze(null); }
  }
  async function ausDateien() {
    if (!sicherung) return;
    setLaeuft(true);
    const d = await fetch('/api/haushalt/umzug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schritt: 'dateien', sicherung: sicherung.daten, v1: v1?.daten ?? null }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setLaeuft(false);
    if (!d.ok) { melde('fehler', 'Probelauf fehlgeschlagen', d.fehler); return; }
    setBericht(d.bericht); setDatei(d.datei ?? null); setZeit(new Date().toISOString());
  }

  async function probe() {
    setLaeuft(true);
    const d = await fetch('/api/haushalt/umzug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schritt: 'probe', email, passwort }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setLaeuft(false); setPasswort('');
    if (!d.ok) { melde('fehler', 'Probelauf fehlgeschlagen', d.fehler); return; }
    setBericht(d.bericht); setZeit(new Date().toISOString());
  }
  async function uebernehmen() {
    setLaeuft(true);
    const d = await fetch('/api/haushalt/umzug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schritt: 'uebernehmen' }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setLaeuft(false);
    if (!d.ok) { melde('fehler', 'Übernahme fehlgeschlagen', d.fehler); return; }
    const b = d.ergebnis.buchungen;
    melde('ok', 'Übernommen', `Buchungen: ${b.neu} neu, ${b.ersetzt} aktualisiert, ${b.behalten} in MAKE OS bearbeitet und behalten.`);
    await laden(); onZu();
  }

  const stimmt = bericht ? Object.values(bericht.zaehlung).every(z => z.supabase === z.gelesen) : false;
  const abgewiesen = bericht?.abgewiesen.length ?? 0;
  return (
    <Dialog titel="Umzug aus Malins Cockpit" onZu={onZu} aktionen={bericht
      ? <Knopf farbe={LEUCHT.geld} aus={laeuft || !stimmt || !bestaetigt} onClick={() => void uebernehmen()}>In den Haushalt übernehmen</Knopf>
      : weg === 'dateien'
        ? <Knopf farbe={LEUCHT.geld} aus={laeuft || !sicherung} onClick={() => void ausDateien()}>{laeuft ? 'Setzt zusammen …' : 'Probelauf aus Dateien'}</Knopf>
        : <Knopf farbe={LEUCHT.geld} aus={laeuft || !email || !passwort} onClick={() => void probe()}>{laeuft ? 'Liest aus Supabase …' : 'Probelauf starten'}</Knopf>}>
      {!bericht && (
        <div style={{ display: 'flex', gap: 14, fontSize: TYP.bedien }}>
          {(['dateien', 'supabase'] as const).map(w => <button key={w} onClick={() => setWeg(w)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: weg === w ? C.ink : C.inkLeise, fontWeight: weg === w ? 700 : 400, textDecoration: weg === w ? 'underline' : 'none', textUnderlineOffset: 4 }}>{w === 'dateien' ? 'Aus Dateien' : 'Direkt aus Supabase'}</button>)}
        </div>
      )}
      {!bericht && weg === 'dateien' && (
        <>
          <div style={{ color: C.inkDim }}>Malins Sicherung (MAKE-ORGA-Sicherung-….json) bringt Kategorien, Regeln, Schulden und Budgets — ihre Buchungen enden aber bei 1.000 Zeilen. Der V1-Export (KD-Finanzen-….json aus dem Finanz-Cockpit-Ordner) ergänzt alle drei Konten danach. MAKE OS setzt beides an der Naht zusammen und zeigt den Abgleich. Euer Haushalt bleibt bis zum Übernehmen unberührt.</div>
          <Feld label={`Malins Sicherung${sicherung ? ` — ${sicherung.name}` : ''}`}><input type="file" accept=".json,application/json" onChange={e => void lies(e.target.files?.[0], setSicherung)} style={feld} /></Feld>
          <Feld label={`V1-Export (empfohlen)${v1 ? ` — ${v1.name}` : ''}`}><input type="file" accept=".json,application/json" onChange={e => void lies(e.target.files?.[0], setV1)} style={feld} /></Feld>
        </>
      )}
      {!bericht && weg === 'supabase' && (
        <>
          <div style={{ color: C.inkDim }}>Melde dich mit deinem Zugang zu Malins Cockpit an. MAKE OS liest dann alles — Buchungen, Zuordnungen, Schulden, Rechnungen, Budgets — und prüft es gegen die Zeilenzahlen, die Supabase selbst meldet. Das ist nur ein Probelauf: euer Haushalt in MAKE OS bleibt unberührt.</div>
          <Feld label="E-Mail (Zugang zu Malins Cockpit)"><input type="email" autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} style={feld} /></Feld>
          <Feld label="Passwort"><input type="password" autoComplete="off" value={passwort} onChange={e => setPasswort(e.target.value)} style={feld} /></Feld>
          <div style={{ fontSize: 12.5, color: C.inkLeise }}>Das Passwort geht nur an Supabase und wird nicht gespeichert.</div>
        </>
      )}
      {bericht && (
        <div style={{ display: 'grid', gap: 10, fontSize: TYP.bedien }}>
          <div style={{ color: C.inkDim }}>Probelauf vom {zeit ? `${datumDe(zeit.slice(0, 10))} ${zeit.slice(11, 16)} Uhr (UTC)` : '–'}{bericht.zeitraum ? ` · Buchungen ${datumDe(bericht.zeitraum.von)} bis ${datumDe(bericht.zeitraum.bis)}` : ''}</div>
          {datei && (
            <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)', color: C.inkDim, lineHeight: 1.55 }}>
              Aus Dateien: <b style={{ color: C.ink }}>{datei.ausSicherung}</b> Buchungen aus Malins Sicherung{datei.naht ? ` (bis vor ${datumDe(datei.naht)})` : ''}, <b style={{ color: C.ink }}>{datei.ausV1}</b> aus dem V1-Export
              {datei.belegeAusV1 ? `, ${datei.belegeAusV1} offene Belege aus V1` : ''}. Malins Regeln haben {datei.regelTreffer} V1-Buchungen eingeordnet; {datei.sonstiges} bleiben „Sonstiges“, {datei.offenEin} Eingänge „Noch einzuordnen“.
              {datei.v1Ohne.length > 0 && <> Nicht übernommen: {datei.v1Ohne.map(o => `${o.anzahl} × ${o.grund}`).join(', ')}.</>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(3, auto)', gap: '4px 14px', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: C.inkLeise }}>Tabelle</span><span style={{ color: C.inkLeise }}>Supabase</span><span style={{ color: C.inkLeise }}>gelesen</span><span style={{ color: C.inkLeise }}>übernommen</span>
            {Object.entries(bericht.zaehlung).map(([t, z]) => (
              <span key={t} style={{ display: 'contents' }}>
                <span>{NAMEN[t] ?? t}</span><span>{z.supabase}</span>
                <span style={{ color: z.gelesen === z.supabase ? LEUCHT.gut : LEUCHT.kritisch }}>{z.gelesen}</span>
                <span style={{ color: z.abgewiesen ? LEUCHT.achtung : undefined }}>{z.uebernommen}{z.abgewiesen ? ` (−${z.abgewiesen})` : ''}</span>
              </span>
            ))}
          </div>
          {stimmt ? <div style={{ color: LEUCHT.gut }}>✓ Jede Tabelle vollständig gelesen — die Zeilenzahlen stimmen mit Supabase überein.</div> : <div style={{ color: LEUCHT.kritisch }}>✕ Nicht alles gelesen. So nicht übernehmen.</div>}
          {abgewiesen > 0 && <div style={{ color: LEUCHT.achtung }}>{abgewiesen} Zeile{abgewiesen === 1 ? '' : 'n'} abgewiesen: {bericht.abgewiesen.slice(0, 5).map(a => `${NAMEN[a.tabelle]} (${a.grund})`).join(' · ')}{abgewiesen > 5 ? ' …' : ''}</div>}
          {bericht.hinweise.map(h => <div key={h} style={{ color: LEUCHT.achtung }}>{h}</div>)}
          {Object.keys(bericht.unbekannteFelder).length > 0 && <div style={{ color: C.inkLeise, fontSize: 12.5 }}>Felder, die MAKE OS nicht kennt und nicht übernimmt: {Object.entries(bericht.unbekannteFelder).map(([t, f]) => `${NAMEN[t]}: ${f!.join(', ')}`).join(' · ')}</div>}
          <button onClick={() => setSummenAuf(!summenAuf)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit' }}>{summenAuf ? '▾' : '▸'} Summen je Konto und Monat zum Gegenprüfen mit den Kontoauszügen</button>
          {summenAuf && (
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gridTemplateColumns: '60px 1fr auto auto', gap: '2px 12px', fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: C.inkDim }}>
              {bericht.summen.map(s => <span key={`${s.konto}${s.monat}`} style={{ display: 'contents' }}><span>{monatKurz(s.monat)}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.konto}</span><span>{s.anzahl}×</span><span>{eur(s.summe)}</span></span>)}
            </div>
          )}
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.ink, marginTop: 4 }}>
            <input type="checkbox" checked={bestaetigt} onChange={e => setBestaetigt(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Malins Cockpit ist eingefroren (docs/make-orga/einfrieren.sql) — ab jetzt pflegen wir nur noch in MAKE OS.</span>
          </label>
          <button onClick={() => { setBericht(null); setBestaetigt(false); }} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit', fontSize: 12.5 }}>Neuen Probelauf machen</button>
        </div>
      )}
    </Dialog>
  );
}
