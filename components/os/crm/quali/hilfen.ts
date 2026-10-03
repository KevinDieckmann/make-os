'use client';

// ─── Qualifizierung & Scoring — gemeinsame Hilfen der Oberfläche (03.10.) ─────────────────────
// Eine Quelle für alle Stücke: die Einstellungen (aus dem CRM-Stand, `crm.scoring`), die Lead-Zeilen (EINE Rechnung, live im
// Browser aus Kartei und CRM — jede Änderung rechnet den Score sofort neu), das Schreiben an /api/crm/lead und die Dateien
// der Ablage zur Herkunft (nur Metadaten; Bilder lädt ein <img> über die geschützte Datei-Route).

import { useEffect, useMemo, useState } from 'react';
import { localDay } from '@/lib/zeit';
import { leads, type LeadZeile } from '@/lib/crm/leads';
import { standardZumRechnen, type ScoringEinstellungen } from '@/lib/crm/scoring';
import type { AblageHinweis } from '@/lib/crm/herkunft';
import type { CrmApi } from '../daten';
import { useMedien } from '../../ui/medien';

/** Die geltenden Einstellungen — vom Server mit dem CRM-Stand geliefert, sonst der Standard. */
export function useScoringEinstellungen(api: CrmApi): ScoringEinstellungen {
  return api.crm?.stand.scoring ?? standardZumRechnen();
}

/** Alle Leads, live gerechnet — dieselbe Funktion wie auf dem Server (`leads()`), nie eine zweite Rechnung. */
export function useLeadZeilen(api: CrmApi): LeadZeile[] | null {
  const heute = api.crm?.heute ?? localDay();
  return useMemo(() => (api.crm && api.kontakte ? leads(api.kontakte, api.crm.stand, heute) : null), [api.crm, api.kontakte, heute]);
}

/** Ist der Bildschirm schmal (Handy)? Dann wird aus dem Seitenfenster ein Blatt von unten. */
export function useSchmal(grenze = 1000): boolean {
  return useMedien(`(max-width: ${grenze}px)`);
}

export interface LeadAntwort { ok: boolean; fehler?: string; text?: string; lead?: unknown; plan?: unknown; vorschau?: unknown; followup?: boolean; fremd?: Record<string, number>; an?: string }
/** POST an /api/crm/lead — nie ein Wurf; Fehler kommen als `{ ok: false, fehler }`. */
export const leadPost = (body: Record<string, unknown>): Promise<LeadAntwort> =>
  fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json() as Promise<LeadAntwort>).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));

/** Einträge der Dateiablage zu diesen Personen (Visitenkarte, Sprachnotiz) — nur Metadaten, ein Abruf je Person. */
export function useAblage(kontaktIds: readonly string[]): AblageHinweis[] {
  const [liste, setListe] = useState<AblageHinweis[]>([]);
  const schluessel = kontaktIds.join(',');
  useEffect(() => {
    let lebt = true;
    const ids = schluessel ? schluessel.split(',') : [];
    Promise.all(ids.map(id => fetch(`/api/crm/dateien?kontakt=${encodeURIComponent(id)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null)))
      .then(rs => { if (lebt) setListe(rs.flatMap(r => (r?.ok ? (r.eintraege as AblageHinweis[]) : []))); });
    return () => { lebt = false; };
  }, [schluessel]);
  return liste;
}

/** Eine Zahl in Punkten: ganze Zahlen ohne Nachkommastelle, sonst höchstens zwei, deutsch. */
export const punkteText = (n: number): string => (Number.isInteger(n) ? String(n) : n.toLocaleString('de-DE', { maximumFractionDigits: 2 }));
