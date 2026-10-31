'use client';

// ─── Markttraktion › Website — Daten im Browser (31.10.) ─────────────────────────────────────────────────────────────────────────────
// EIN Lesen (`GET /api/website/intern`) und EIN Schreiben (`PATCH` mit Einzel-Änderungen; der Stand je Eintrag kommt aus der letzten Server-Antwort,
// nie aus dem Zustand des Browsers — 409 lädt neu und zeigt den Satz). Regeln: lib/website/regeln.ts.

import { useCallback, useEffect, useState } from 'react';
import type { WebsiteInhalt, WebOp, ProduktKurz } from '@/lib/website/regeln';

type MitStand<T> = T & { stand: string };
export interface WebsiteDaten {
  inhalt: { [K in keyof WebsiteInhalt]: WebsiteInhalt[K] extends (infer E)[] ? MitStand<E>[] : WebsiteInhalt[K] } & { einstellungenStand: string };
  bereiche: string[];
  istInhaber: boolean;
  startwerte: boolean;
  hilfen: {
    produkte: ProduktKurz[];
    bausteine: { id: string; bereich: string; seite: string; paket: boolean; datei: { titel: string; preisNetto: number }; wirksam: { titel: string; preisNetto: number; ausgeblendet: boolean } }[];
    events: { id: string; titel: string; datum: string; uhrzeit?: string; ort?: string; status: string }[];
    medien: { id: string; name?: string; breite?: number; hoehe?: number }[];
    buchungsseiten: { slug: string; titel: string }[];
    unterlagen: { id: string; titel: string; seite: string; arten: string[] }[];
  };
}

export function useWebsite() {
  const [d, setD] = useState<WebsiteDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const laden = useCallback(async () => {
    const r = await fetch('/api/website/intern', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) setD(await r.json() as WebsiteDaten);
    else setFehler('Website-Inhalte ließen sich nicht laden.');
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  /** Änderungen senden — true = gespeichert. */
  const senden = useCallback(async (ops: WebOp[]): Promise<boolean> => {
    setFehler('');
    const r = await fetch('/api/website/intern', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops }) }).catch(() => null);
    const j = await r?.json().catch(() => ({})) as { fehler?: string } & Partial<WebsiteDaten>;
    if (!r?.ok) { setFehler(String(j?.fehler ?? 'Nicht gespeichert.')); if (r?.status === 409) await laden(); return false; }
    setD(alt => (alt && j.inhalt ? { ...alt, inhalt: j.inhalt, bereiche: j.bereiche ?? alt.bereiche } : alt));
    return true;
  }, [laden]);
  return { d, fehler, setFehler, laden, senden };
}
export type WebsiteApi = ReturnType<typeof useWebsite>;

/** Netto-Cent als „1.234,50 €“. */
export const euro = (cent: number | null | undefined): string => (typeof cent === 'number' ? `${(cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 })} €` : '—');
/** Eingabe „1.234,50“ → Cent (leer = undefined, ungültig = NaN). */
export function centAus(text: string): number | undefined {
  const t = text.trim().replace(/\s|€/g, '');
  if (!t) return undefined;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
export const centText = (cent: number | undefined): string => (typeof cent === 'number' ? (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: cent % 100 ? 2 : 0, maximumFractionDigits: 2 }) : '');
