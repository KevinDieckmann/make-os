'use client';

// ─── Verträge · Daten im Browser (01.11.) ────────────────────────────────────────────────────────────────────────────
// Lesen: GET /api/vertraege, GET /api/vertraege/vorlagen. Schreiben: POST mit `aktion` — der Stand kommt immer aus der letzten Server-Antwort.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Vertrag, VertragVorlage, AmpelStand, VorlageFeld, FeldTyp } from '@/lib/vertraege/modell';
import type { VorlageImport } from '@/lib/vertraege/import';

export type VertragMitStand = Vertrag & { stand: string };
export type VorlageMitStand = VertragVorlage & { stand: string; ampel: AmpelStand };
export interface Antwort<T> { ok: boolean; status: number; d: T & { fehler?: string; fehlt?: string[]; warnungen?: string[]; aktuell?: unknown } }

export async function senden<T = Record<string, unknown>>(url: string, body: unknown): Promise<Antwort<T>> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({ fehler: `Antwort ${r.status}.` }));
    return { ok: r.ok && d?.ok !== false, status: r.status, d };
  } catch { return { ok: false, status: 0, d: { fehler: 'Keine Verbindung.' } as T & { fehler: string } }; }
}

export function useVertraege() {
  const [vertraege, setVertraege] = useState<VertragMitStand[] | null>(null);
  const [nurEntwuerfe, setNurEntwuerfe] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  const laeuft = useRef(false);
  const laden = useCallback(async () => {
    if (laeuft.current) return;
    laeuft.current = true;
    try {
      const r = await fetch('/api/vertraege', { cache: 'no-store' });
      if (r.status === 403) { setGesperrt(true); setVertraege([]); return; }
      const d = await r.json().catch(() => null) as { ok?: boolean; vertraege?: VertragMitStand[]; nurEntwuerfe?: boolean; fehler?: string } | null;
      if (d?.ok) { setVertraege(d.vertraege ?? []); setNurEntwuerfe(d.nurEntwuerfe === true); setFehler(null); } else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); } finally { laeuft.current = false; }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const uebernehmen = useCallback((v: VertragMitStand) => setVertraege(alt => (alt ? (alt.some(x => x.id === v.id) ? alt.map(x => (x.id === v.id ? v : x)) : [...alt, v]) : [v])), []);
  const entfernen = useCallback((id: string) => setVertraege(alt => (alt ? alt.filter(x => x.id !== id) : alt)), []);
  return { vertraege, nurEntwuerfe, fehler, gesperrt, laden, uebernehmen, entfernen, setFehler };
}

export interface VorlagenStand {
  vorlagen: VorlageMitStand[];
  arten: { id: string; label: string }[];
  feste: { schluessel: string; label: string; quelle: string }[];
  standard: VorlageFeld[];
  feldTypen: { id: FeldTyp; label: string }[];
  geruest: { id: string; titel: string; art: string; paragraphen: number }[];
  hinweis: string;
  nurLesen?: boolean;
}
export function useVorlagen() {
  const [stand, setStand] = useState<VorlagenStand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/vertraege/vorlagen', { cache: 'no-store' });
      if (r.status === 403) { setGesperrt(true); return; }
      const d = await r.json().catch(() => null) as (VorlagenStand & { ok?: boolean; fehler?: string }) | null;
      if (d?.ok) { setStand(d); setFehler(null); } else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const uebernehmen = useCallback((v: VorlageMitStand) => setStand(alt => (alt ? { ...alt, vorlagen: alt.vorlagen.some(x => x.id === v.id) ? alt.vorlagen.map(x => (x.id === v.id ? v : x)) : [...alt.vorlagen, v] } : alt)), []);
  return { stand, fehler, gesperrt, laden, uebernehmen, setFehler };
}

export async function importLesen(datei: File | null, text?: string): Promise<{ ok: true; vorschau: VorlageImport } | { ok: false; fehler: string }> {
  try {
    const r = datei
      ? await fetch('/api/vertraege/import', { method: 'POST', body: (() => { const f = new FormData(); f.set('datei', datei); return f; })() })
      : await fetch('/api/vertraege/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    const d = await r.json().catch(() => null) as { ok?: boolean; vorschau?: VorlageImport; fehler?: string } | null;
    return d?.ok && d.vorschau ? { ok: true, vorschau: d.vorschau } : { ok: false, fehler: d?.fehler ?? `Antwort ${r.status}.` };
  } catch { return { ok: false, fehler: 'Keine Verbindung.' }; }
}

export async function unterschriftHochladen(v: VertragMitStand, datei: File, am?: string): Promise<{ ok: true; vertrag: VertragMitStand; hinweise: string[] } | { ok: false; fehler: string }> {
  try {
    const f = new FormData();
    f.set('id', v.id); f.set('stand', v.stand); f.set('datei', datei); if (am) f.set('am', am);
    const r = await fetch('/api/vertraege/unterschrift', { method: 'POST', body: f });
    const d = await r.json().catch(() => null) as { ok?: boolean; vertrag?: VertragMitStand; hinweise?: string[]; fehler?: string } | null;
    return d?.ok && d.vertrag ? { ok: true, vertrag: d.vertrag, hinweise: d.hinweise ?? [] } : { ok: false, fehler: d?.fehler ?? `Antwort ${r.status}.` };
  } catch { return { ok: false, fehler: 'Keine Verbindung.' }; }
}
