'use client';

// ─── Fulfillment · Prozesse — Daten im Browser (Paket C1, 10.10.) ──────────────────────────────────────────────────────────────────────
// Lesen nur über die Routen (GET /api/fulfillment, /api/fulfillment/fall?m=, /api/fulfillment/cockpit); Schreiben nur als Einzel-Ops mit Stand
// (PATCH), Antworten werden nie geraten — nach jedem Schreiben lädt die Ansicht neu (Ereignis `make-fulfillment-geaendert`). Fehler bleiben als
// Satz sichtbar (Hinweis-Karte), nichts wird still verworfen.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Baustein, Fall, FallKnoten, FallKurz, Freigabepunkt, KundeKurz, ProzessKnoten, ProzessVorlage, RitualVorlage, Rolle, Stakeholder, Entscheidung, Unterschrift, WartetPunkt, WertKontoZeile, FulfillmentEinstellungen, OnboardingKandidat, KnotenStatus } from '@/lib/fulfillment/typen';
import type { OnboardingStand, WillkommenUhr } from '@/lib/fulfillment/prozesse/onboarding';
import type { VorlagenDiff } from '@/lib/fulfillment/prozesse/fall';
import type { FfKennzahl } from '@/lib/fulfillment/prozesse/kennzahlen';
import type { CockpitZeile, Haenger } from '@/lib/fulfillment/prozesse/cockpit';
import type { MusterWahl } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import type { Mandat } from '@/lib/crm/typen';

export const EREIGNIS = 'make-fulfillment-geaendert';
export const geaendert = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(EREIGNIS)); };
export const neueAnfrageId = () => `ff-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)}`;

export type MitStand<T> = T & { stand: string };
export type BausteinKurz = MitStand<Omit<Baustein, 'text' | 'fragen' | 'gliederung'>> & { gliederungAnzahl: number; fragenAnzahl: number; nurIntern: boolean; rechtOffen: boolean; vorVerkaufOffen: boolean; steckt: number };
export type VorlageMitStand = MitStand<Omit<ProzessVorlage, 'knoten'>> & { knoten: MitStand<ProzessKnoten>[] };
export interface Kandidat extends OnboardingKandidat { uhr: WillkommenUhr; vorlage?: { id: string; titel: string }; vorgeschlagen: boolean }
export interface FallZeile extends FallKurz { vorlageId: string; kunde: string; titel: string }
export interface Uebersicht {
  inhaber: boolean;
  prozesse: VorlageMitStand[];
  bausteine: BausteinKurz[];
  rituale: MitStand<RitualVorlage>[];
  zuordnung: Record<string, { vorlageId: string }>;
  einstellungen: FulfillmentEinstellungen;
  importLaeufe: { id: string; am: string; von: string; datei: string; neu: number; geaendert: number }[];
  musterOffen: MusterWahl[];
  kandidaten: Kandidat[];
  faelle: Record<string, FallZeile>;
  zaehler: Record<string, Record<string, string[]>>;
  mandate: Record<string, { kunde: string; titel: string; leistungId: string | null; status: string }>;
  kennzahlen: FfKennzahl[];
  leistungen: { id: string; name: string; status: string }[];
}
export interface UebersichtKurz { kandidaten: Kandidat[]; zuordnung: Record<string, { vorlageId: string }>; faelle: Record<string, FallZeile>; prozesse: { id: string; titel: string; art: string }[] }

export interface MandatKurz { id: string; titel: string; kunde: string; firmaId: string | null; kontaktIds: string[]; leistungId: string | null; ziele: Mandat['ziele']; gesellschaft: string; status: string; start: string | null; zustaendig: string | null; business: boolean }
export interface FallAntwort {
  inhaber: boolean;
  mandat: MandatKurz;
  unterschrift: Unterschrift | null;
  fall: (Omit<Fall, 'knoten' | 'stakeholder' | 'entscheidungen'> & { knoten: MitStand<FallKnoten>[]; stakeholder: MitStand<Stakeholder>[]; entscheidungen: MitStand<Entscheidung>[] }) | null;
  staende?: { vereinbarung: string; wertKonto: Record<string, string> };
  onboarding?: OnboardingStand;
  diff?: VorlagenDiff | null;
  vorlage?: { id: string; titel: string; fassung: number; freigaben: Freigabepunkt[]; rollen: Rolle[] };
  wartet?: WartetPunkt[];
  wertKonto?: WertKontoZeile[];
  fortschritt?: number;
  aktuell?: { phase: FallKnoten | null; schritt: FallKnoten | null };
  bausteine?: { id: string; titel: string; art: string; kundeFuellt: boolean; nurIntern: boolean; rechtOffen: boolean; vorVerkaufOffen: boolean; lieferobjekt: string | null }[];
  personen?: { id: string; name: string; position: string | null; email: string | null; firmaId: string | null }[];
  rituale?: RitualVorlage[];
  termine?: Record<string, string | null>;
  kunde?: KundeKurz | null;
  report?: { erstelltAm?: string; gesendetAm?: string } | null;
}
export interface CockpitAntwort { heute: string; zeilen: CockpitZeile[]; haengt: Haenger[]; kapa: { stundenWoche: number; frei: number | null; ueber: boolean } | null }
export type { KnotenStatus };

export interface Antwort<T> { ok: boolean; status: number; j: T & { ok?: boolean; fehler?: string; error?: string; konflikte?: { id: string; stand: string }[] } }

export async function holeJson<T>(url: string, init?: RequestInit): Promise<Antwort<T>> {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init, ...(init?.body ? { headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } } : {}) });
    const j = await r.json().catch(() => ({})) as Antwort<T>['j'];
    return { ok: r.ok && j.ok !== false, status: r.status, j };
  } catch { return { ok: false, status: 0, j: { fehler: 'Keine Verbindung — bitte noch einmal.' } as Antwort<T>['j'] }; }
}
export const fehlerText = (a: Antwort<unknown>) => a.j.fehler ?? a.j.error ?? (a.status === 409 ? 'Inzwischen geändert — bitte neu laden.' : 'Nicht gespeichert.');

/** Einen Bestand lesen und bei `make-fulfillment-geaendert` neu laden. */
function useLaden<T>(url: string | null) {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const lauf = useRef(0);
  const laden = useCallback(async () => {
    if (!url) return;
    const n = ++lauf.current;
    const a = await holeJson<T>(url);
    if (n !== lauf.current) return;
    if (a.ok) { setDaten(a.j as T); setFehler(null); } else setFehler(fehlerText(a));
  }, [url]);
  useEffect(() => {
    void laden();
    const neu = () => { void laden(); };
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, [laden]);
  return { daten, fehler, laden };
}

export const useUebersicht = () => useLaden<Uebersicht>('/api/fulfillment');
export const useUebersichtKurz = () => useLaden<UebersichtKurz>('/api/fulfillment?nur=kurz');
export const useFall = (mandatId: string) => useLaden<FallAntwort>(`/api/fulfillment/fall?m=${encodeURIComponent(mandatId)}`);
export const useCockpit = () => useLaden<CockpitAntwort>('/api/fulfillment/cockpit');

/** Vorlagen-Ops (PATCH /api/fulfillment) — bei Erfolg laden alle Ansichten neu. */
export async function vorlagenOps(ops: Record<string, unknown>[]): Promise<Antwort<{ geaendert?: string[] }>> {
  const a = await holeJson<{ geaendert?: string[] }>('/api/fulfillment', { method: 'PATCH', body: JSON.stringify({ ops }) });
  if (a.ok) geaendert();
  return a;
}
/** Fall-Ops (PATCH /api/fulfillment/fall). */
export async function fallOps(mandatId: string, ops: Record<string, unknown>[]): Promise<Antwort<{ nachzug?: { phase?: string; lieferobjekte?: number; ziele?: number; fehler?: string } }>> {
  const a = await holeJson<{ nachzug?: { phase?: string; lieferobjekte?: number; ziele?: number; fehler?: string } }>('/api/fulfillment/fall', { method: 'PATCH', body: JSON.stringify({ mandatId, ops }) });
  if (a.ok) geaendert();
  return a;
}
/** Aktionen am Fall (POST /api/fulfillment/fall). */
export async function fallAktion(body: Record<string, unknown>): Promise<Antwort<Record<string, unknown>>> {
  const a = await holeJson<Record<string, unknown>>('/api/fulfillment/fall', { method: 'POST', body: JSON.stringify(body) });
  if (a.ok) geaendert();
  return a;
}

export const STATUS_TEXT: Record<KnotenStatus, string> = { offen: 'offen', in_arbeit: 'in Arbeit', wartet_kunde: 'wartet auf Kunde', erledigt: 'erledigt', entfaellt: 'entfällt' };
export const tagKurz = (t?: string | null) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.` : '—');
export const tagLang = (t?: string | null) => (t && /^\d{4}-\d{2}-\d{2}/.test(t) ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '—');
