'use client';

// ─── Angebots-Tool · Daten im Browser (28.09.) ──────────────────────────────
// Angebote (mit Stand) und die Gesellschaften (Absender, IBAN maskiert) kommen aus
// /api/crm/angebot; geschrieben wird nur dort (Entwurf speichern, stellen, annehmen,
// ablehnen, neue Version, löschen). Speichern läuft nacheinander (Kette) und schickt
// immer den Stand der letzten Server-Antwort — 409 heißt: jemand anders war schneller.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Angebot } from '@/lib/crm/typen';
import type { Gesellschaft } from '@/lib/crm/gesellschaften';

export type AngebotMitStand = Angebot & { stand: string };
export type GesellschaftAnzeige = Gesellschaft & { stand: string; luecken: string[] };
export interface AngebotAntwort { ok: boolean; fehler?: string; angebot?: AngebotMitStand; aktuell?: AngebotMitStand; [k: string]: unknown }

export async function angebotPost(body: Record<string, unknown>, opt: { keepalive?: boolean } = {}): Promise<AngebotAntwort & { status: number }> {
  try {
    const text = JSON.stringify(body);
    // keepalive (29.09., A5): beim Verlassen der Seite überlebt die Anfrage das Schließen des Tabs (bis 60 KB).
    const r = await fetch('/api/crm/angebot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, ...(opt.keepalive && text.length < 60_000 ? { keepalive: true } : {}) });
    const d = (await r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}` }))) as AngebotAntwort;
    return { ...d, status: r.status };
  } catch { return { ok: false, fehler: 'Keine Verbindung — nichts geändert.', status: 0 }; }
}

export function useAngebote() {
  const [angebote, setAngebote] = useState<AngebotMitStand[] | null>(null);
  /** Entwürfe im Papierkorb (04.10.) — die Liste `angebote` enthält sie nicht. */
  const [papierkorb, setPapierkorb] = useState<AngebotMitStand[]>([]);
  const [gesellschaften, setGesellschaften] = useState<GesellschaftAnzeige[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  const laeuft = useRef(false);
  const laden = useCallback(async () => {
    if (laeuft.current) return;
    laeuft.current = true;
    try {
      const r = await fetch('/api/crm/angebot', { cache: 'no-store' });
      if (r.status === 403) { setGesperrt(true); setAngebote([]); return; }
      const d = await r.json().catch(() => null) as { ok?: boolean; angebote?: AngebotMitStand[]; papierkorb?: AngebotMitStand[]; gesellschaften?: GesellschaftAnzeige[]; fehler?: string } | null;
      if (d?.ok) { setAngebote(d.angebote ?? []); setPapierkorb(d.papierkorb ?? []); setGesellschaften(d.gesellschaften ?? []); setFehler(null); }
      else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
    finally { laeuft.current = false; }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  /** Ein Angebot aus einer Server-Antwort in die Liste übernehmen. */
  const uebernehmen = useCallback((a: AngebotMitStand) => setAngebote(alt => (alt ? (alt.some(x => x.id === a.id) ? alt.map(x => (x.id === a.id ? a : x)) : [...alt, a]) : [a])), []);
  const entfernen = useCallback((id: string) => setAngebote(alt => (alt ? alt.filter(x => x.id !== id) : alt)), []);
  return { angebote, papierkorb, gesellschaften, fehler, gesperrt, laden, uebernehmen, entfernen, setFehler };
}
export type AngebotDaten = ReturnType<typeof useAngebote>;

/** Zuletzt genutzte Gesellschaft (Vorbelegung, nur dieser Browser). */
const MERKER = 'mt-angebot-gesellschaft';
export function letzteGesellschaft(): string | null { try { return localStorage.getItem(MERKER); } catch { return null; } }
export function merkeGesellschaft(g: string) { try { localStorage.setItem(MERKER, g); } catch { /* ohne Merker */ } }

/** PDF aus der Ablage herunterladen (attachment) — ohne die Seite zu verlassen. */
export function pdfLaden(dateiId: string, name?: string) {
  const a = document.createElement('a');
  a.href = `/api/crm/dateien?id=${encodeURIComponent(dateiId)}`;
  if (name) a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
