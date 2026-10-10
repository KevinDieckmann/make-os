'use client';

// ─── Markttraktion · Planung — Daten im Browser (10.10.) ─────────────────────────────────────────────────────────
// EIN Abruf (`GET /api/crm/planung`) liefert alles, was die Ansichten zeigen — gerechnet auf dem Server (lib/crm/planung.ts). Geschrieben
// wird nur über Einzel-Schritte mit dem Stand des Eintrags (`PATCH { ops }`): 409 → Hinweis und frisch laden, nie still überschreiben;
// 400/413 → der Satz des Servers bleibt stehen, die Eingabe auch.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { planungLage } from '@/lib/crm/planung-server';
import type { PlanungOp } from '@/lib/crm/planung-daten';

export type PlanungLage = Awaited<ReturnType<typeof planungLage>> & { filter: string | null };
export type PlanungDateiMitStand = PlanungLage['datei'];

export interface PlanungApi {
  lage: PlanungLage | null;
  laedt: boolean;
  fehler: string | null;
  hinweis: string | null;
  setHinweis: (t: string | null) => void;
  /** Schritte schreiben — `true`, wenn gespeichert. Danach wird frisch geladen (die Rechnung hängt an allem). */
  schreibe: (ops: PlanungOp[]) => Promise<boolean>;
  neuLaden: () => Promise<void>;
}

export function usePlanung(kanal: string | null): PlanungApi {
  const [lage, setLage] = useState<PlanungLage | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const lauf = useRef(0);
  const neuLaden = useCallback(async () => {
    const nr = ++lauf.current;
    setLaedt(true);
    try {
      const r = await fetch(`/api/crm/planung${kanal ? `?kanal=${encodeURIComponent(kanal)}` : ''}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (nr !== lauf.current) return;
      if (!r.ok || j.ok === false) { setFehler(String(j.fehler ?? `Die Planung ließ sich nicht laden (${r.status}).`)); return; }
      setFehler(null);
      setLage(j as PlanungLage);
    } catch { if (nr === lauf.current) setFehler('Keine Verbindung — die Planung ließ sich nicht laden.'); }
    finally { if (nr === lauf.current) setLaedt(false); }
  }, [kanal]);
  useEffect(() => { void neuLaden(); }, [neuLaden]);
  const schreibe = useCallback(async (ops: PlanungOp[]) => {
    try {
      const r = await fetch('/api/crm/planung', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { setHinweis(String(j.fehler ?? 'Inzwischen geändert — neu geladen.')); await neuLaden(); return false; }
      if (!r.ok || j.ok === false) { setHinweis(String(j.fehler ?? `Nicht gespeichert (${r.status}).`)); return false; }
      setHinweis(null);
      await neuLaden();
      return true;
    } catch { setHinweis('Keine Verbindung — nicht gespeichert.'); return false; }
  }, [neuLaden]);
  return { lage, laedt, fehler, hinweis, setHinweis, schreibe, neuLaden };
}

/** Zahl mit höchstens einer Nachkommastelle, deutsch. */
export const zahl1 = (n: number | null | undefined): string => (n == null ? '—' : (Math.round(n * 10) / 10).toLocaleString('de-DE'));
/** Ganze Zahl aufgerundet (Aktivitäten: lieber eine mehr), deutsch. */
export const auf = (n: number | null | undefined): string => (n == null ? '—' : Math.ceil(n - 1e-9).toLocaleString('de-DE'));
export const euro = (n: number | null | undefined): string => (n == null ? '—' : `${Math.round(n).toLocaleString('de-DE')} €`);
export const datum = (d: string): string => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;
