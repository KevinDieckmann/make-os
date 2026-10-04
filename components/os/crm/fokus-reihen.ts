'use client';

// ─── Markttraktion · Reihen für die Fokus-Signatur (04.10.) ─────────────────
// Die FadenLinien der Markttraktion zeigen echte Reihen aus der Kartei, die die Seite ohnehin geladen hat (`useCrm`): keine neue
// Abfrage, kein neuer Bestand. Fälliges kommt aus DERSELBEN Liste wie Power Hour und „Für dich“ (`faellige` + `fuerPerson`,
// echte und abgeleitete Follow-ups); qualifizierte Leads aus `qualifiziertAm` der Lead-Zeilen; die Prognose aus den offenen
// Deals mit `erwartetAm` (gewichtet wie die Prognose, `wahrscheinlichkeit`). Reine Reihen: lib/lichtfaeden/reihen.ts.

import { useMemo } from 'react';
import { faellige, fuerPerson } from '@/lib/crm/followup';
import { OFFENE_STUFEN, gesamtwert, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { jeTag, jeWoche, summeJeMonat } from '@/lib/lichtfaeden/reihen';
import type { LeadZeile } from '@/lib/crm/leads';
import type { CrmApi } from './daten';

/** Fällige Follow-ups der Person je Tag, Index 0 = heute (Überfälliges zählt auf heute). `tage` = Fensterlänge. */
export function useFaelligReihe(api: CrmApi, person: string | null | undefined, tage = 14): { reihe: number[]; heute: string } | null {
  const { kontakte, crm } = api;
  return useMemo(() => {
    if (!kontakte || !crm || !person) return null;
    const heute = crm.heute;
    const liste = fuerPerson(faellige(kontakte, crm.stand, heute, { horizont: tage - 1, wertelisten: crm.stand.wertelisten }), person);
    return { heute, reihe: jeTag(liste.map(f => f.faellig), heute, tage) };
  }, [kontakte, crm, person, tage]);
}

/** Qualifizierte Leads je Woche (die letzten `wochen` Wochen bis heute) — nur Leads der gewählten Personen der Runde. */
export function qualifiziertJeWoche(leads: readonly LeadZeile[], heute: string, passt: (z: LeadZeile) => boolean, wochen = 8): number[] {
  return jeWoche(leads.filter(passt).map(z => z.qualifiziertAm?.slice(0, 10)), heute, wochen);
}

/** Erwartete Abschlüsse je Monat (Gesamtwert × Wahrscheinlichkeit der Stufe — wie „gewichtet“ der Prognose), ab dem laufenden Monat.
 *  Überfällige Abschlusstermine zählen in den laufenden Monat; Deals ohne `erwartetAm` fehlen (die Reihe sagt nur, was terminiert ist). */
export function prognoseJeMonat(api: CrmApi, chancen: NonNullable<CrmApi['crm']>['stand']['chancen'], monate = 6): number[] | null {
  const crm = api.crm;
  if (!crm) return null;
  const eintraege = chancen.filter(c => OFFENE_STUFEN.includes(c.stufe) && c.erwartetAm).map(c => ({ tag: c.erwartetAm, wert: Math.round(gesamtwert(c) * wahrscheinlichkeit(c.stufe, crm.stand.wahrscheinlichkeiten) / 100) }));
  return summeJeMonat(eintraege, crm.heute, monate);
}
