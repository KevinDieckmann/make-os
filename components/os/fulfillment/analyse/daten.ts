'use client';

// ─── Fulfillment · Analyse — Daten im Browser (C3, 10.10.) ─────────────────────────────────────────────────────────────────────────────────────
// Lädt Dossier (GET /api/fulfillment/dossier) und Lage der Läufe (GET /api/fulfillment/analyse); solange ein Lauf läuft, alle 6 Sekunden neu
// (nur sichtbar). Schreiben geht über `senden` (POST mit JSON, die Bau-Kennung setzt die Fetch-Hülle) — Antworten mit `fehler` zeigt die Oberfläche.

import { useCallback, useEffect, useRef, useState } from 'react';
import { neueKennung } from '@/lib/kennung';
import type { AnalyseAgentId, AnalyseLauf } from '@/lib/fulfillment/typen';
import type { DossierAntwort } from '@/lib/fulfillment/analyse/sicht';
import type { DossierEingaben } from '@/lib/fulfillment/analyse/dossier-anwenden';
import type { LaufSchaetzung } from '@/lib/fulfillment/analyse/schaetzen';

export interface AgentLage {
  id: AnalyseAgentId; name: string; welle: number; art: 'modell' | 'regel' | 'tiefenbericht'; web: boolean; personen: string;
  zustand: 'bereit' | 'gesperrt' | 'laeuft'; letzter?: string; gruende: string[]; hinweise: string[];
  schaetzung: LaufSchaetzung; laeufe: number; grundNoetig: boolean; imMinimalset: boolean;
  funktionen?: { funktion: string; zustand: 'bereit' | 'gesperrt' | 'laeuft'; letzter?: string; laeufe: number; grundNoetig: boolean }[];
}
export interface AnalyseLage {
  agenten: AgentLage[]; laeufe: AnalyseLauf[];
  ki: { kiZugang: boolean; bereichCrm: boolean; websuche: boolean; tiefenbericht: boolean }; kiSaetze: Record<string, string>;
  minimalset: AnalyseAgentId[]; gleichzeitig: { laufend: number; max: number }; kostenCent: number;
  tiefenbericht: { frage: string; vorhanden: boolean; eigen: boolean };
}
export interface DossierLage {
  mandat: { id: string; titel: string; kunde: string; status: string; firmaId?: string };
  dossier: DossierAntwort | null; stand?: string | null; vorschlag?: DossierEingaben;
  deckblatt?: { version: number; stand: string; quellenStand: string | null; loeschAm: string | null; kartenAnzahl: number; geloescht: { am: string; anzahl: number }[] };
  belegQuote?: number | null; personenteil: boolean; liaMuster: Record<'zweck' | 'erforderlichkeit' | 'abwaegung' | 'schutz', string>; rechtHinweis: string; loeschRegelTage: number;
  tiefenberichtFrage?: string;
}
export type Antwort = { status: number; j: Record<string, unknown> };

/** Eine zufällige Kennung für `anfrageId` (Wiederholungen derselben Anfrage wirken nur einmal). */
export const anfrageId = (): string => neueKennung('ff');

export async function senden(url: string, body: unknown, methode: 'POST' | 'PATCH' = 'POST'): Promise<Antwort> {
  try {
    const r = await fetch(url, { method: methode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  } catch { return { status: 0, j: { ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' } }; }
}
export const fehlerVon = (a: Antwort): string | null => (a.status >= 200 && a.status < 300 && a.j.ok !== false ? null : String(a.j.fehler ?? `Fehler (${a.status || 'keine Verbindung'}).`));

export function useAnalyse(mandatId: string) {
  const [dossier, setDossier] = useState<DossierLage | null>(null);
  const [lage, setLage] = useState<AnalyseLage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laeuft = useRef(false);
  const laden = useCallback(async () => {
    try {
      const d = await fetch(`/api/fulfillment/dossier?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' });
      const dj = await d.json().catch(() => ({}));
      if (!d.ok || dj.ok === false) { setFehler(String(dj.fehler ?? 'Das Dossier ließ sich nicht laden.')); return; }
      setDossier(dj as DossierLage);
      setFehler(null);
      if (dj.dossier) {
        const a = await fetch(`/api/fulfillment/analyse?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' });
        const aj = await a.json().catch(() => ({}));
        if (a.ok && aj.ok !== false) { setLage(aj as AnalyseLage); laeuft.current = (aj as AnalyseLage).laeufe.some(l => l.status === 'laeuft'); }
      } else setLage(null);
    } catch { setFehler('Keine Verbindung.'); }
  }, [mandatId]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => {
    const t = setInterval(() => { if (laeuft.current && document.visibilityState === 'visible') void laden(); }, 6000);
    return () => clearInterval(t);
  }, [laden]);
  return { dossier, lage, fehler, setFehler, laden };
}
export type AnalyseApi = ReturnType<typeof useAnalyse>;
