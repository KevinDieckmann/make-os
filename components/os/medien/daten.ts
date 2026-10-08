'use client';

// ─── Fotos & Videos — Daten im Browser (09.10., Paket 5) ─────────────────────────────────────────────────────────────────
// Liest NUR /api/medien (der Server filtert, was die Person sehen darf) und schreibt NUR über dessen Aktionen. Inhalte kommen über
// /api/medien/inhalt (Vorschau privat zwischengespeichert, Original mit Range). Nichts davon hält Schlüssel oder Objekt-Namen.

import { useCallback, useEffect, useState } from 'react';
import type { MedienListeAntwort } from '@/lib/medien/typen';

export const inhaltUrl = (id: string, v: 'raster' | 'ansicht' | 'poster' | 'original', download = false) => `/api/medien/inhalt?id=${encodeURIComponent(id)}&v=${v}${download ? '&download=1' : ''}`;

export async function medienAktion(a: Record<string, unknown>): Promise<{ ok: boolean; fehler?: string; medium?: unknown; album?: { id: string }; einwilligung?: { id: string }; text?: string }> {
  try {
    const r = await fetch('/api/medien', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.ok) return { ok: false, fehler: d?.fehler ?? `Nicht gespeichert (Fehler ${r.status}).` };
    return d;
  } catch { return { ok: false, fehler: 'Kein Netz — bitte gleich noch einmal.' }; }
}

/** Liste der Medien (mit Papierkorb-Schalter), neu laden nach jeder Aktion. */
export function useMedien(papierkorb = false) {
  const [daten, setDaten] = useState<MedienListeAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/medien${papierkorb ? '?papierkorb=1' : ''}`, { cache: 'no-store' });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) { setFehler(d?.fehler ?? `Nicht geladen (Fehler ${r.status}).`); return; }
      setDaten(d as MedienListeAntwort); setFehler(null);
    } catch { setFehler('Kein Netz — die Liste lädt, sobald wieder Netz da ist.'); }
  }, [papierkorb]);
  useEffect(() => { void laden(); }, [laden]);
  return { daten, fehler, laden };
}

/** Event-Album sicherstellen (feste Kennung je Event — idempotent) und seine Kennung liefern. */
export async function eventAlbum(eventId: string, titel: string): Promise<string | null> {
  const r = await medienAktion({ aktion: 'album-anlegen', bereich: 'business', art: 'event', bezugId: eventId, titel });
  return r.ok && r.album ? r.album.id : null;
}

export const groesseText = (n: number) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${Math.round(n / 1024 ** 2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
