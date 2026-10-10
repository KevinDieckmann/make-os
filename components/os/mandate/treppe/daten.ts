'use client';

// ─── Produkte · Leistungstreppe — Daten im Browser (10.10.) ──────────────────────────────────────────────────────────
// EIN Abruf (`GET /api/crm/treppe`) liefert alles, was die Ansichten zeigen — gerechnet auf dem Server (lib/crm/treppe.ts). Geschrieben wird nur
// über Einzel-Schritte mit dem Stand des Eintrags (`PATCH { ops }`): 409 → Hinweis und frisch laden, nie still überschreiben; 400/413 → der
// Satz des Servers bleibt stehen. Mehrere Ansichten (Produkte, je Mandat) teilen sich den Abruf (Anfrage-Bündler) und das Ereignis
// `make-treppe-geaendert` (nach jedem Schreiben laden alle neu).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TreppeLage } from '@/lib/crm/treppe-server';
import type { TreppeOp } from '@/lib/crm/treppe-daten';

export type { TreppeLage };
export type TreppeDateiMitStand = TreppeLage['datei'];
export type StufeMitStand = TreppeDateiMitStand['stufen'][number];
export const TREPPE_EREIGNIS = 'make-treppe-geaendert';

export interface TreppeApi {
  lage: TreppeLage | null;
  laedt: boolean;
  fehler: string | null;
  hinweis: string | null;
  setHinweis: (t: string | null) => void;
  /** Schritte schreiben — `true`, wenn gespeichert. Danach laden alle Ansichten frisch (die Rechnung hängt an allem). */
  schreibe: (ops: TreppeOp[]) => Promise<boolean>;
  neuLaden: () => Promise<void>;
}

export function useTreppe(): TreppeApi {
  const [lage, setLage] = useState<TreppeLage | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const lauf = useRef(0);
  const neuLaden = useCallback(async () => {
    const nr = ++lauf.current;
    setLaedt(true);
    try {
      const r = await fetch('/api/crm/treppe', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (nr !== lauf.current) return;
      if (!r.ok || j.ok === false) { setFehler(String(j.fehler ?? `Die Leistungstreppe ließ sich nicht laden (${r.status}).`)); return; }
      setFehler(null);
      setLage(j as TreppeLage);
    } catch { if (nr === lauf.current) setFehler('Keine Verbindung — die Leistungstreppe ließ sich nicht laden.'); }
    finally { if (nr === lauf.current) setLaedt(false); }
  }, []);
  useEffect(() => {
    void neuLaden();
    const h = () => { void neuLaden(); };
    window.addEventListener(TREPPE_EREIGNIS, h);
    return () => window.removeEventListener(TREPPE_EREIGNIS, h);
  }, [neuLaden]);
  const schreibe = useCallback(async (ops: TreppeOp[]) => {
    try {
      const r = await fetch('/api/crm/treppe', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { setHinweis(String(j.fehler ?? 'Inzwischen geändert — neu geladen.')); window.dispatchEvent(new Event(TREPPE_EREIGNIS)); return false; }
      if (!r.ok || j.ok === false) { setHinweis(String(j.fehler ?? `Nicht gespeichert (${r.status}).`)); return false; }
      setHinweis(null);
      window.dispatchEvent(new Event(TREPPE_EREIGNIS));
      return true;
    } catch { setHinweis('Keine Verbindung — nicht gespeichert.'); return false; }
  }, []);
  return { lage, laedt, fehler, hinweis, setHinweis, schreibe, neuLaden };
}

export const euro = (n: number | null | undefined): string => (n == null ? '—' : `${Math.round(n).toLocaleString('de-DE')} €`);
export const datum = (d: string): string => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;
export const monat = (m: string): string => `${m.slice(5, 7)}/${m.slice(2, 4)}`;
