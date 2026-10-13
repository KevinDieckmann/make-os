'use client';

// ─── Unternehmen › Schild im Browser: laden und schreiben (10.10.) ──────────────────────────────────────────────────
// Lesen: GET /api/gesellschaften/schild (nur Business-Gesellschaften, je Eintrag mit Stand). Schreiben: EINE Kette je Gesellschaft
// (lib/crm/gesellschaft-kette.ts — nacheinander, Stand aus der letzten Antwort, 409 → neuer Stand, Meldung bleibt bis zum nächsten
// Schreiben). Unterlagen gehen über die vorhandene, verschlüsselte Ablage (POST /api/gesellschaften/unterlagen) — hier nur die Kennung.
// Gerechnet wird im Browser mit denselben reinen Regeln wie auf dem Server (lib/gesellschaften/schild/*).

import { useCallback, useEffect, useRef, useState } from 'react';
import { gesellschaftKette, type GesellschaftAntwort } from '@/lib/crm/gesellschaft-kette';
import type { SchildGesellschaft } from '@/lib/gesellschaften/schild/typen';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import type { GesellschaftId } from '@/lib/einheiten';

export type SEintrag = SchildGesellschaft & { stand: string };
export interface SchildDaten { heute: string; eintraege: SEintrag[] }
export const SCHILD_EREIGNIS = 'make-schild-geaendert';

/** `an: false` lädt nichts (z. B. ein Konto „nur Business“ — die Route antwortet ihm 403, Gesamtprüfung 12.10.). */
export function useSchild(an = true) {
  const [daten, setDaten] = useState<SchildDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/gesellschaften/schild', { cache: 'no-store' });
      const d = await r.json().catch(() => null);
      if (d?.ok) { setDaten({ heute: d.heute, eintraege: d.eintraege }); setFehler(null); } else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => {
    if (!an) return;
    void laden();
    const neu = () => void laden();
    window.addEventListener(SCHILD_EREIGNIS, neu);
    return () => window.removeEventListener(SCHILD_EREIGNIS, neu);
  }, [laden, an]);
  const ersetzen = useCallback((e: SEintrag) => setDaten(d => (d ? { ...d, eintraege: d.eintraege.some(x => x.id === e.id) ? d.eintraege.map(x => (x.id === e.id ? e : x)) : [...d.eintraege, e] } : d)), []);
  return { daten, fehler, laden, ersetzen };
}

export interface Schreiben { schreibe: (body: Record<string, unknown>) => Promise<{ ok: boolean; fehler?: string; extra?: Record<string, unknown> }>; meldung: string | null; unterwegs: number }

/** Schreiber einer Gesellschaft (Kette mit Stand). `onNeu` bekommt den neuen Serverstand. */
export function useSchildSchreiber(e: SEintrag, onNeu: (e: SEintrag) => void): Schreiben {
  const [meldung, setMeldung] = useState<string | null>(null);
  const [unterwegs, setUnterwegs] = useState(0);
  const onNeuRef = useRef(onNeu);
  onNeuRef.current = onNeu;
  const extra = useRef<Record<string, unknown> | undefined>(undefined);
  const kette = useRef(gesellschaftKette<SEintrag>(e.stand, { uebernehmen: x => onNeuRef.current(x), meldung: setMeldung, offen: setUnterwegs }));
  useEffect(() => { kette.current.standSetzen(e.stand); }, [e.stand]);
  const schreibe = async (body: Record<string, unknown>) => {
    const r = await kette.current.schreibe(async stand => {
      const res = await fetch('/api/gesellschaften/schild', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id, ...body, stand }) });
      const d = await res.json().catch(() => ({ ok: false, fehler: `Antwort ${res.status}.` })) as { ok?: boolean; eintrag?: SEintrag; aktuell?: SEintrag; fehler?: string } & Record<string, unknown>;
      const { ok, eintrag, aktuell, fehler, ...rest } = d;
      extra.current = rest;
      return { ok, ...(eintrag ? { gesellschaft: eintrag } : {}), ...(aktuell ? { aktuell } : {}), ...(fehler ? { fehler } : {}) } as GesellschaftAntwort<SEintrag>;
    });
    return { ...r, ...(r.ok ? { extra: extra.current } : {}) };
  };
  return { schreibe, meldung, unterwegs };
}

/** Eine Unterlage in die verschlüsselte Ablage der Gesellschaft (dieselbe wie Unterlagen/Verträge) — gibt den Eintrag zurück. */
export async function unterlageHochladen(id: GesellschaftId, datei: File, titel?: string): Promise<{ eintrag?: DateiEintrag; fehler?: string }> {
  const f = new FormData();
  f.set('id', id); f.set('datei', datei); f.set('art', 'sonstig'); if (titel) f.set('titel', titel);
  const r = await fetch('/api/gesellschaften/unterlagen', { method: 'POST', body: f }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nicht hochgeladen.' }));
  return r.ok ? { eintrag: r.eintrag as DateiEintrag } : { fehler: r.fehler ?? 'Nicht hochgeladen.' };
}

export const dateiLink = (id: string) => `/api/crm/dateien?id=${encodeURIComponent(id)}`;
