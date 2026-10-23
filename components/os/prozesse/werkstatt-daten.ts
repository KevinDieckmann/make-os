'use client';

// ─── Prozesse · Werkstatt — Daten im Browser (Etappe B2, 21.10.) ──────────────────────────────────────────────────────────────────────────────────────
// Drei Abrufe, alle mit `?space=business` (serverseitig nur Business): die Liste (GET /api/prozesse/werkstatt), ein Prozess (`?id=`), der Katalog mit den
// Auswahllisten (GET /api/prozesse/katalog?auswahl=1). Geschrieben wird NUR über `werkstattSenden` (POST, eine Kette — nacheinander, der Stand kommt erst beim
// Senden aus der letzten Antwort). Rechnet nichts — Regeln stehen in lib/prozesse/*.

import { useCallback, useEffect, useState } from 'react';
import type { Befund, ProzessEintrag, ProzessVersion, ProzessVorlage } from '@/lib/prozesse/definition';
import type { BibliothekKurz } from '@/lib/prozesse/fulfillment-modus';
import type { LaufenderKunde } from '@/lib/prozesse/fulfillment-modus-server';
import type { BegleitAndock } from '@/lib/prozesse/begleitung/andocken';
import type { ProzessKurz } from '@/lib/prozesse/fulfillment-bruecke';
import type { ProzessRechte } from '@/lib/prozesse/rollen';
import type { KatalogEintrag, KatalogKategorie } from '@/lib/prozesse/baustein-katalog';
import type { AuswahlQuelle } from '@/lib/prozesse/baustein-katalog';
import type { ModellOption } from '@/lib/prozesse/modell-wahl';
import type { UeberfuehrungAnsicht } from '@/lib/prozesse/ueberfuehrung';

export const WERKSTATT_QUELLE = '/api/prozesse/werkstatt?space=business';
export const KATALOG_QUELLE = '/api/prozesse/katalog?auswahl=1&space=business';

export interface VersionKurz { nr: number; name: string; notiz?: string; am: string; von: string }
export type EintragAnsicht = Omit<ProzessEintrag, 'versionen'> & { versionen: VersionKurz[] };
export interface ProzessAntwort { ok: true; rechte: ProzessRechte; eintrag: EintragAnsicht; stand: string; entwurfGeaendert: boolean; befunde: Befund[]; webhook: unknown;
  /** Produkte, die auf diesen Prozess zeigen (22.10., Prozesse × Fulfillment) — nur Kennung und Name. */
  produkte?: { id: string; name: string }[];
  /** Überführung (22.10., Paket Ü): ersetzt dieser Prozess einen System-Ablauf — Phase, Schatten-Vergleich (Zähler, Kennungen), ob Umschalten geht. */
  ueberfuehrung?: UeberfuehrungAnsicht }
export interface ListenAntwort { ok: true; rechte: ProzessRechte; prozesse: ProzessKurz[] }
export type KatalogAufgeloest = KatalogEintrag & { klasse: string | null };
export type Auswahl = Partial<Record<AuswahlQuelle, { id: string; label: string }[]>>;
export interface KatalogAntwort { ok: true; katalog: KatalogAufgeloest[]; kategorien: readonly { id: KatalogKategorie; titel: string }[]; auswahl?: Auswahl; modelle?: ModellOption[] }

async function holen<T>(url: string): Promise<{ daten: T | null; fehler: string | null; status: number }> {
  const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
  const j = r ? await r.json().catch(() => null) as (T & { ok?: boolean; fehler?: string }) | null : null;
  if (!r || !r.ok || !j?.ok) return { daten: null, fehler: String(j?.fehler ?? 'Das ließ sich nicht laden.'), status: r?.status ?? 0 };
  return { daten: j, fehler: null, status: r.status };
}

function useAbruf<T>(url: string | null): { daten: T | null; fehler: string | null; laden: () => Promise<T | null> } {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    if (!url) return null;
    const r = await holen<T>(url);
    setFehler(r.fehler);
    if (r.daten) setDaten(r.daten);
    return r.daten;
  }, [url]);
  useEffect(() => { setDaten(null); void laden(); }, [laden]);
  return { daten, fehler, laden };
}

export const useWerkstattListe = () => useAbruf<ListenAntwort>(WERKSTATT_QUELLE);
export const useKatalog = () => useAbruf<KatalogAntwort>(KATALOG_QUELLE);
export const useProzess = (id: string) => useAbruf<ProzessAntwort>(`${WERKSTATT_QUELLE}&id=${encodeURIComponent(id)}`);

/** Ein Paket des Fulfillments für die Werkstatt (22.10., E1/E2; GET `?paket=&bibliothek=1`, lib/prozesse/fulfillment-modus-server.ts). */
export interface PaketAntwort {
  ok: true; rechte: ProzessRechte; paket: ProzessVorlage; stand: string; befunde: Befund[]; bibliothek: BibliothekKurz[]; laufende: number;
  produkte: { id: string; name: string }[]; editor: string;
  /** Darf die Person das Paket bearbeiten (volle Mitglieder, wie der Editor des Fulfillments)? */
  bearbeiten: boolean;
  /** E2: der Entwurf (die ganze Fassung) — null ohne; `arbeitsStand` = Stand der Fassung, an der die Werkstatt arbeitet. */
  entwurf: { vorlage: ProzessVorlage; basisFassung: number; am: string; von: string; paketGeaendert: boolean } | null;
  arbeitsStand: string;
  /** Die ganze Bibliothek in Kürze (Baustein hinzufügen). */
  bibliothekAlle?: BibliothekKurz[];
  /** E3: die laufenden Kunden mit ihrer Änderung (übernehmen je Kunde per Klick). */
  kunden: LaufenderKunde[];
  /** B3: die Begleit-Prozesse, die an diesem Paket andocken (über die Bedingungen ihres Auslösers). */
  begleitung?: BegleitAndock[];
}
export const usePaket = (id: string) => useAbruf<PaketAntwort>(`${WERKSTATT_QUELLE}&paket=${encodeURIComponent(id)}&bibliothek=1`);

/** Eine Version ganz (Ansehen) bzw. der Vergleich zweier Fassungen (Nummer oder „entwurf“). */
export const versionHolen = (id: string, nr: number) => holen<{ ok: true; version: ProzessVersion }>(`${WERKSTATT_QUELLE}&id=${encodeURIComponent(id)}&version=${nr}`);
export const vergleichHolen = (id: string, a: number | 'entwurf', b: number | 'entwurf') =>
  holen<{ ok: true; vergleich: import('@/lib/prozesse/versionen').Vergleich }>(`${WERKSTATT_QUELLE}&id=${encodeURIComponent(id)}&vergleich=${a},${b}`);

export interface SendeAntwort { status: number; j: (Record<string, unknown> & { ok?: boolean; fehler?: string; befunde?: Befund[]; eintrag?: EintragAnsicht; stand?: string; version?: VersionKurz }) | null }
let kette: Promise<unknown> = Promise.resolve();
/**
 * EIN Schreibweg (POST /api/prozesse/werkstatt) — nacheinander: der Körper entsteht erst, wenn die Anfrage an der Reihe ist (`koerper()`), damit der Stand aus der
 * letzten Antwort kommt. Netzfehler → Status 0 (nie geworfen).
 */
export function werkstattSenden(koerper: () => Record<string, unknown>): Promise<SendeAntwort> {
  const lauf = kette.then(async (): Promise<SendeAntwort> => {
    const r = await fetch(WERKSTATT_QUELLE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(koerper()) }).catch(() => null);
    if (!r) return { status: 0, j: null };
    return { status: r.status, j: await r.json().catch(() => null) };
  });
  kette = lauf.catch(() => undefined);
  return lauf;
}
