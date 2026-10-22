'use client';

// ─── Prozesse · Werkstatt — Daten der Reiter Läufe und Tests, Scharfschalten (22.10.) ───────────────────────────────────────────────────────────────
// Alle Abrufe mit `?space=business` (serverseitig nur Business): Läufe eines Prozesses (GET /api/prozesse/laeufe?prozess=), ein Lauf (`?lauf=`), seine Inhalte
// LIVE mit den Rechten der Person (`?lauf=…&inhalte=1`), die schlanken CRM-Verweise für Fall-Namen und die Fall-Suche (GET /api/aufgaben/crm — Art. 18 fehlt dort
// schon). Geschrieben wird nur über `laeufeSenden` (POST /api/prozesse/laeufe, nacheinander). Rechnet nichts — Regeln: lib/prozesse/laeufe-ansicht.ts.

import { useCallback, useEffect, useState } from 'react';
import type { CrmVerweise } from '@/lib/aufgaben/crm-verweise';
import type { LaufKurz, ProbeZeile } from '@/lib/prozesse/lauf-regeln';
import type { LaufInhalte, ScharfVorschau, TestErgebnisServer } from '@/lib/prozesse/lauf-server';
import type { LaufSchritt, ProzessLaufStand, Testfall } from '@/lib/prozesse/lauf-typen';

export const LAEUFE_QUELLE = '/api/prozesse/laeufe';
const mitSpace = (q: string) => `${LAEUFE_QUELLE}?${q}${q ? '&' : ''}space=business`;

export interface LaeufeAntwort {
  ok: true; laeufe: LaufKurz[]; zurueckgehalten: number; stand: ProzessLaufStand | null; tests: Testfall[];
  kennzahlen: { laeufe: number; ziel: number | null; reaktionMedianMin: number | null; inDerUhr: number | null };
  webhookEingaenge: { am: string; lauf?: { id: string; status: LaufKurz['status'] } }[];
  zurueck: { id: string; am: string; ausloeser: string }[];
}
export interface LaufAntwort { ok: true; lauf: LaufKurz; schritte: LaufSchritt[]; daten: Record<string, string> }
export type InhalteAntwort = { ok: true } & LaufInhalte;

async function holen<T>(url: string): Promise<{ daten: T | null; fehler: string | null }> {
  const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
  const j = r ? await r.json().catch(() => null) as (T & { ok?: boolean; fehler?: string }) | null : null;
  if (!r || !r.ok || !j?.ok) return { daten: null, fehler: String(j?.fehler ?? 'Das ließ sich nicht laden.') };
  return { daten: j, fehler: null };
}

/** Läufe, Testfälle, Einstellungen und Webhook-Eingänge eines Prozesses — `laden()` frischt auf (nach jeder Änderung). */
export function useLaeufe(prozessId: string): { daten: LaeufeAntwort | null; fehler: string | null; laden: () => Promise<LaeufeAntwort | null> } {
  const [daten, setDaten] = useState<LaeufeAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await holen<LaeufeAntwort>(mitSpace(`prozess=${encodeURIComponent(prozessId)}`));
    setFehler(r.fehler);
    if (r.daten) setDaten(r.daten);
    return r.daten;
  }, [prozessId]);
  useEffect(() => { void laden(); }, [laden]);
  return { daten, fehler, laden };
}

export const laufHolen = (id: string) => holen<LaufAntwort>(mitSpace(`lauf=${encodeURIComponent(id)}`));

/** B3 (22.10.): die Läufe zu EINEM Fall (Karte „Begleitung läuft“ in der Akte) — offene + letzte 30 Tage, mit dem Titel des Prozesses. */
export interface FallLaeufeAntwort { ok: true; laeufe: (LaufKurz & { titel: string })[]; weitere: number }
export function useFallLaeufe(art: string, id: string): FallLaeufeAntwort | null {
  const [daten, setDaten] = useState<FallLaeufeAntwort | null>(null);
  useEffect(() => {
    let an = true;
    void holen<FallLaeufeAntwort>(mitSpace(`fall=${encodeURIComponent(`${art}:${id}`)}`)).then(r => { if (an) setDaten(r.daten); });
    return () => { an = false; };
  }, [art, id]);
  return daten;
}
export const inhalteHolen = (id: string) => holen<InhalteAntwort>(mitSpace(`lauf=${encodeURIComponent(id)}&inhalte=1`));

let verweise: { am: number; v: Promise<CrmVerweise | null> } | null = null;
/** Die schlanken CRM-Verweise (Kennung + Name) — eine Minute gemerkt, damit Liste und Suche nicht mehrfach laden. */
export function verweiseHolen(): Promise<CrmVerweise | null> {
  if (verweise && Date.now() - verweise.am < 60_000) return verweise.v;
  const v = fetch('/api/aufgaben/crm', { cache: 'no-store' }).then(r => (r.ok ? r.json() as Promise<CrmVerweise> : null)).catch(() => null);
  verweise = { am: Date.now(), v };
  return v;
}
export function useVerweise(): CrmVerweise | null {
  const [v, setV] = useState<CrmVerweise | null>(null);
  useEffect(() => { let an = true; void verweiseHolen().then(x => { if (an) setV(x); }); return () => { an = false; }; }, []);
  return v;
}

export interface LaeufeSendeAntwort {
  status: number;
  j: (Record<string, unknown> & {
    ok?: boolean; fehler?: string; befunde?: { stufe: string; text: string; knotenId?: string }[]; vorschau?: ScharfVorschau; frage?: string | null;
    lauf?: string; test?: Testfall; ergebnisse?: TestErgebnisServer[]; gestartet?: number; zurueckgehalten?: number;
  }) | null;
}
let kette: Promise<unknown> = Promise.resolve();
/** EIN Schreibweg der Läufe (POST, nacheinander). Netzfehler → Status 0 (nie geworfen). */
export function laeufeSenden(koerper: Record<string, unknown>): Promise<LaeufeSendeAntwort> {
  const lauf = kette.then(async (): Promise<LaeufeSendeAntwort> => {
    const r = await fetch(mitSpace(''), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(koerper) }).catch(() => null);
    if (!r) return { status: 0, j: null };
    return { status: r.status, j: await r.json().catch(() => null) };
  });
  kette = lauf.catch(() => undefined);
  return lauf;
}

export type { ProbeZeile, ScharfVorschau, TestErgebnisServer };
