'use client';

// ─── MAKE OS — Verbindungen ─────────────────────────────────────────────────
// Der eine Ort für externe Anbindungen (Whoop, Microsoft 365). Drei ehrliche
// Zustände je Anbieter: nicht konfiguriert (mit Anleitung, was Kevin anlegen
// muss) → bereit (Verbinden-Knopf) → verbunden (Metadaten + Trennen).
// Tokens sieht diese Seite nie — nur Status.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { THEME as T } from '@/lib/make-one/os-data';

interface Verbindung {
  id: string; name: string; konfiguriert: boolean; verbunden: boolean;
  seit: string | null; laeuftAb: number | null; scope: string | null;
  anleitung: string; envId: string; envSecret: string;
}

const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };

export function VerbindungenView() {
  const [liste, setListe] = useState<Verbindung[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [syncMeld, setSyncMeld] = useState('');
  const params = useSearchParams();
  const status = params.get('status');

  const laden = () => fetch('/api/oauth/status').then(r => r.json()).then(d => { setListe(d.verbindungen ?? []); setGeladen(true); }).catch(() => setGeladen(true));
  useEffect(() => { laden(); }, []);

  async function trennen(id: string) {
    await fetch('/api/oauth/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: id, aktion: 'trennen' }) }).catch(() => {});
    laden();
  }

  async function whoopSync() {
    setSyncMeld('hole Werte …');
    try {
      const r = await fetch('/api/whoop/sync', { method: 'POST' });
      const d = await r.json();
      setSyncMeld(d.ok ? `✓ Übernommen: Recovery ${d.vitals.rec ?? '—'}% · Schlaf ${d.vitals.sleep ?? '—'} h` : (d.error ?? 'Fehler.'));
    } catch { setSyncMeld('Sync fehlgeschlagen.'); }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>Verbindungen</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Externe Quellen anschließen.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 640, lineHeight: 1.5 }}>
          App beim Anbieter registrieren, Schlüssel in <span style={{ fontFamily: T.mono, fontSize: 12 }}>.env.local</span>, einmal verbinden — danach fließen die Daten von selbst. Zugangs-Tokens bleiben lokal auf diesem Mac.
        </p>

        {status?.startsWith('verbunden') && <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '10px 16px', margin: '14px 0', fontSize: 13, color: T.accent }}>✓ Verbindung hergestellt.</div>}
        {status && !status.startsWith('verbunden') && <div style={{ ...panel, borderLeft: `3px solid ${T.crit}`, padding: '10px 16px', margin: '14px 0', fontSize: 13, color: T.crit }}>Verbindung nicht zustande gekommen ({status}) — nochmal versuchen.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {!geladen && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade …</div>}
          {liste.map(v => (
            <div key={v.id} style={{ ...panel, borderLeft: `3px solid ${v.verbunden ? T.accent : v.konfiguriert ? T.amber : T.line}`, padding: '15px 19px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{v.name}</span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: v.verbunden ? T.accent : v.konfiguriert ? T.amber : T.muted, border: `1px solid ${v.verbunden ? T.accent : v.konfiguriert ? T.amber : T.line}55`, borderRadius: 5, padding: '2px 8px' }}>
                  {v.verbunden ? 'verbunden' : v.konfiguriert ? 'bereit — noch nicht verbunden' : 'nicht konfiguriert'}
                </span>
                {v.verbunden && v.seit && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>seit {v.seit.slice(0, 10)}</span>}
              </div>

              {!v.konfiguriert && (
                <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 8, lineHeight: 1.55 }}>
                  <b style={{ color: T.ink }}>Was du brauchst:</b> {v.anleitung}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {v.konfiguriert && !v.verbunden && (
                  <a href={`/api/oauth/start?provider=${v.id}`}
                    style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 9, background: T.accent, color: '#04110F', textDecoration: 'none' }}>Verbinden →</a>
                )}
                {v.verbunden && (
                  <>
                    {v.id === 'whoop' && (
                      <button onClick={whoopSync} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '7px 14px', borderRadius: 9, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>Werte jetzt holen</button>
                    )}
                    <button onClick={() => trennen(v.id)} style={{ fontFamily: T.sans, fontSize: 12.5, padding: '7px 14px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.muted, cursor: 'pointer' }}>Trennen</button>
                  </>
                )}
                {v.id === 'whoop' && syncMeld && <span style={{ fontSize: 12, color: syncMeld.startsWith('✓') ? T.accent : T.amber }}>{syncMeld}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 16, lineHeight: 1.55 }}>
          Whoop verbunden heißt: der Morgen-Check füllt sich selbst (Recovery, Schlaf, HRV, Puls) — im <Link href="/os/ritual" style={{ color: T.accentInk, textDecoration: 'none' }}>Tagesstart</Link> und überall, wo der Score rechnet.
          Microsoft 365 verbunden heißt: Postfach + Firmenkalender live statt Snapshot (Umbau der Routen folgt nach dem Verbinden).
        </div>
      </div>
    </div>
  );
}
