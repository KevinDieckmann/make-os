'use client';

// ─── MAKE OS — Verbindungen ─────────────────────────────────────────────────
// Der eine Ort für externe Anbindungen (Microsoft 365, seit 07.10. WhatsApp Business, seit 08.10. WHOOP je Person und das Abschalten
// des Mac-Zulieferers — nur der Inhaber, components/os/ZuliefererKarte.tsx). Drei ehrliche
// Zustände je Anbieter: nicht konfiguriert (mit Anleitung) → bereit
// (Verbinden) → verbunden (seit wann, Trennen). Tokens sieht diese Seite nie.
// Seit 24.09. im lebendigen Muster; der Bote (Telegram) wohnt unter Konto.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { WhoopImport } from './WhoopImport';
import { WhoopKarte } from './gesundheit/WhoopKarte';
import { WhatsappKarte } from './whatsapp/WhatsappKarte';
import { ZuliefererKarte } from './ZuliefererKarte';
import { Seite, Karte, Ueberschrift, Leer, Chip, Knopf, Zeile, Liste, Hinweis, LEUCHT, Raster } from './ui';

interface Verbindung { id: string; name: string; konfiguriert: boolean; verbunden: boolean; seit: string | null; laeuftAb: number | null; scope: string | null; anleitung: string; envId: string; envSecret: string }

const FARBE_JE: Record<string, string> = { microsoft: LEUCHT.puls };

export function VerbindungenView() {
  const [liste, setListe] = useState<Verbindung[]>([]);
  const [geladen, setGeladen] = useState(false);
  const status = useSearchParams().get('status');

  const laden = () => fetch('/api/oauth/status').then(r => r.json()).then(d => { setListe(d.verbindungen ?? []); setGeladen(true); }).catch(() => setGeladen(true));
  useEffect(() => { laden(); }, []);
  async function trennen(id: string) { await fetch('/api/oauth/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: id, aktion: 'trennen' }) }).catch(() => {}); laden(); }
  const zustand = (v: Verbindung) => (v.verbunden ? { label: 'verbunden', farbe: LEUCHT.gut } : v.konfiguriert ? { label: 'bereit', farbe: LEUCHT.achtung } : { label: 'nicht konfiguriert', farbe: C.inkLeise });

  return (
    <Seite titel="Verbindungen" unter="Einmal verbinden — danach fließen die Daten von selbst; Schlüssel und Tokens bleiben in MAKE OS.">
      {status && (
        <Hinweis art={status.startsWith('verbunden') ? 'gut' : 'kritisch'}>{status.startsWith('verbunden') ? 'Verbindung hergestellt.' : `Verbindung nicht zustande gekommen (${status}) — nochmal versuchen.`}</Hinweis>
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
                <div style={{ marginTop: 6, fontFamily: SCHRIFT.mono, fontSize: TYP.bedien, color: C.inkLeise }}>{v.envId} · {v.envSecret} in .env.local, dann neu starten.</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {v.konfiguriert && !v.verbunden && <a href={`/api/oauth/start?provider=${v.id}`} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, background: f, color: C.grund, textDecoration: 'none', boxShadow: `0 6px 18px -6px ${f}99` }}>Verbinden ›</a>}
              {v.verbunden && <Knopf leise onClick={() => trennen(v.id)}>Trennen</Knopf>}
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12, lineHeight: 1.5 }}>
              Verbunden heißt: Postfach und Firmenkalender live statt als Momentaufnahme.
            </div>
          </Karte>
        );
      })}
      {/* WHOOP je Person (08.10.): nur die EIGENE Verbindung (components/os/gesundheit/WhoopKarte.tsx) — darunter der Export als Rückfall. */}
      <div style={{ display: 'grid', gap: 12 }}>
        <WhoopKarte i={liste.length + 1} />
        <Karte i={liste.length + 1} flach>
          <Ueberschrift farbe={LEUCHT.gut}>WHOOP-Export einlesen</Ueberschrift>
          <WhoopImport />
        </Karte>
      </div>
      {/* WhatsApp Business (07.10.): Business-Nummer der Instanz — eigene Karte (components/os/whatsapp/WhatsappKarte.tsx). */}
      <WhatsappKarte i={liste.length + 2} />
      {/* Mac-Zulieferer abschalten (08.10., Lücke 10): nur der Inhaber sieht die Karte (sonst bleibt sie leer). */}
      <ZuliefererKarte i={liste.length + 3} />
      <Karte i={liste.length + 3}>
        <Ueberschrift farbe={LEUCHT.puls}>Der Bote · Telegram</Ueberschrift>
        <Liste>
          <Link href="/os/konto" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Zeile onClick={() => {}} titel="Telegram koppeln" unter="ZOE schreibt dir morgens, mittags und abends aufs Handy — einrichten unter Konto." rechts={<span style={{ color: C.inkLeise }}>›</span>} />
          </Link>
        </Liste>
      </Karte>
      </Raster>
    </Seite>
  );
}
