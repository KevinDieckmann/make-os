'use client';

// ─── MAKE OS — Verbindungen ─────────────────────────────────────────────────
// Der eine Ort für externe Anbindungen (Whoop, Microsoft 365). Drei ehrliche
// Zustände je Anbieter: nicht konfiguriert (mit Anleitung) → bereit
// (Verbinden) → verbunden (seit wann, Trennen). Tokens sieht diese Seite nie.
// Seit 24.09. im lebendigen Muster; der Bote (Telegram) wohnt unter Konto.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { WhoopImport } from './WhoopImport';
import { Seite, Karte, Ueberschrift, Leer, Chip, Knopf, Zeile, Liste, LEUCHT, Raster } from './schlank';

interface Verbindung { id: string; name: string; konfiguriert: boolean; verbunden: boolean; seit: string | null; laeuftAb: number | null; scope: string | null; anleitung: string; envId: string; envSecret: string }

const FARBE_JE: Record<string, string> = { whoop: LEUCHT.gut, microsoft: LEUCHT.puls };

export function VerbindungenView() {
  const [liste, setListe] = useState<Verbindung[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [syncMeld, setSyncMeld] = useState('');
  const status = useSearchParams().get('status');

  const laden = () => fetch('/api/oauth/status').then(r => r.json()).then(d => { setListe(d.verbindungen ?? []); setGeladen(true); }).catch(() => setGeladen(true));
  useEffect(() => { laden(); }, []);
  async function trennen(id: string) { await fetch('/api/oauth/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: id, aktion: 'trennen' }) }).catch(() => {}); laden(); }
  async function whoopSync() {
    setSyncMeld('hole Werte …');
    const d = await fetch('/api/whoop/sync', { method: 'POST' }).then(r => r.json()).catch(() => ({ error: 'Sync fehlgeschlagen.' }));
    setSyncMeld(d.ok ? `Übernommen: Recovery ${d.vitals.rec ?? '—'} % · Schlaf ${d.vitals.sleep ?? '—'} h` : (d.error ?? 'Fehler.'));
  }
  const zustand = (v: Verbindung) => (v.verbunden ? { label: 'verbunden', farbe: LEUCHT.gut } : v.konfiguriert ? { label: 'bereit', farbe: LEUCHT.achtung } : { label: 'nicht konfiguriert', farbe: C.inkLeise });

  return (
    <Seite titel="Verbindungen" unter="App beim Anbieter registrieren, Schlüssel in .env.local, einmal verbinden. Danach fließen die Daten von selbst, die Tokens bleiben auf diesem Mac.">
      {status && (
        <Karte i={0} akzent={status.startsWith('verbunden') ? LEUCHT.gut : LEUCHT.kritisch}>
          <div style={{ fontSize: TYP.body, color: status.startsWith('verbunden') ? LEUCHT.gut : LEUCHT.kritisch }}>{status.startsWith('verbunden') ? 'Verbindung hergestellt.' : `Verbindung nicht zustande gekommen (${status}) — nochmal versuchen.`}</div>
        </Karte>
      )}
      {!geladen && <Karte i={0}><Leer>lade …</Leer></Karte>}
      <Raster min={420}>
      {liste.map((v, i) => {
        const z = zustand(v); const f = FARBE_JE[v.id] ?? LEUCHT.puls;
        return (
          <Karte key={v.id} i={i + 1} akzent={v.verbunden ? f : undefined}>
            <Ueberschrift farbe={f} rechts={<Chip farbe={z.farbe}>{z.label}</Chip>}>{v.name}</Ueberschrift>
            {v.verbunden && v.seit && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>verbunden seit {v.seit.slice(8, 10)}.{v.seit.slice(5, 7)}.{v.seit.slice(0, 4)}{v.scope ? ` · ${v.scope}` : ''}</div>}
            {!v.konfiguriert && (
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
                <b style={{ color: C.ink, fontWeight: 600 }}>Was du brauchst:</b> {v.anleitung}
                <div style={{ marginTop: 6, fontFamily: SCHRIFT.mono, fontSize: 12, color: C.inkLeise }}>{v.envId} · {v.envSecret} in .env.local, dann neu starten.</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {v.konfiguriert && !v.verbunden && <a href={`/api/oauth/start?provider=${v.id}`} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, background: f, color: C.grund, textDecoration: 'none', boxShadow: `0 6px 18px -6px ${f}99` }}>Verbinden ›</a>}
              {v.verbunden && v.id === 'whoop' && <Knopf farbe={f} onClick={whoopSync}>Werte jetzt holen</Knopf>}
              {v.verbunden && <Knopf leise onClick={() => trennen(v.id)}>Trennen</Knopf>}
              {v.id === 'whoop' && syncMeld && <span style={{ fontSize: TYP.bedien, color: syncMeld.startsWith('Übernommen') ? LEUCHT.gut : LEUCHT.achtung }}>{syncMeld}</span>}
            </div>
            {v.id === 'whoop' && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Export einlesen · ohne Entwickler-Zugang</div>
                <WhoopImport />
              </div>
            )}
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 12, lineHeight: 1.5 }}>
              {v.id === 'whoop' ? 'Verbunden heißt: Recovery, Schlaf, HRV und Puls kommen jeden Morgen von selbst — in die Gesundheit und in den Wachstums-Score.' : 'Verbunden heißt: Postfach und Firmenkalender live statt als Momentaufnahme.'}
            </div>
          </Karte>
        );
      })}
      <Karte i={liste.length + 1}>
        <Ueberschrift farbe={LEUCHT.puls}>Der Bote · Telegram</Ueberschrift>
        <Liste>
          <Link href="/os/konto" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Zeile onClick={() => {}} titel="Telegram koppeln" unter="Jarvis schreibt dir morgens, mittags und abends aufs Handy — einrichten unter Konto." rechts={<span style={{ color: C.inkLeise }}>›</span>} />
          </Link>
        </Liste>
      </Karte>
      </Raster>
    </Seite>
  );
}
