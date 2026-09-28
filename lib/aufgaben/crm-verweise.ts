// ─── MAKE OS — Aufgaben ↔ CRM (rein, 28.09. abends) ─────────────────────────
// Eine Aufgabe zeigt auf Kontakt, Firma, Mandat, Deal (`Task.bezug`). Hier: die schlanke Form der Verweise
// (GET /api/aufgaben/crm), die Schnellsuche (eine Such-Normalisierung: `suchPasst`), Anzeigenamen und Links
// in die CRM-Akte (nur über lib/crm/adresse.ts / lib/wege.ts — nie Pfade von Hand).

import type { AufgabeBezug, Task } from '@/types/tasks';
import { suchPasst } from '@/lib/text/such-norm';
import { kontaktAkte } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';

export interface CrmVerweise {
  kontakte: { id: string; name: string; firmaId?: string; firma?: string }[];
  firmen: { id: string; name: string }[];
  mandate: { id: string; titel: string; kunde: string; status: string; firmaId?: string }[];
  deals: { id: string; titel: string; stufe: string; firmaId?: string; firma?: string }[];
}
export type BezugArt = keyof AufgabeBezug;
export const BEZUG_ARTEN: readonly BezugArt[] = ['kontaktId', 'firmaId', 'mandatId', 'dealId'];
export const BEZUG_LABEL: Record<BezugArt, string> = { kontaktId: 'Kontakt', firmaId: 'Firma', mandatId: 'Mandat', dealId: 'Deal' };

export interface Treffer { art: BezugArt; id: string; name: string; unter?: string }

/** Schnellsuche über die Kartei: je Art höchstens `max` Treffer, Reihenfolge Kontakt · Firma · Mandat · Deal. */
export function crmSuchen(v: CrmVerweise | null | undefined, frage: string, max = 5): Treffer[] {
  if (!v || !frage.trim()) return [];
  const raus: Treffer[] = [];
  const nimm = (l: Treffer[]) => raus.push(...l.slice(0, max));
  nimm(v.kontakte.filter(k => suchPasst([k.name, k.firma], frage)).map(k => ({ art: 'kontaktId', id: k.id, name: k.name, ...(k.firma ? { unter: k.firma } : {}) })));
  nimm(v.firmen.filter(f => suchPasst([f.name], frage)).map(f => ({ art: 'firmaId', id: f.id, name: f.name })));
  nimm(v.mandate.filter(m => suchPasst([m.titel, m.kunde], frage)).map(m => ({ art: 'mandatId', id: m.id, name: m.titel, unter: m.kunde })));
  nimm(v.deals.filter(d => suchPasst([d.titel, d.firma], frage)).map(d => ({ art: 'dealId', id: d.id, name: d.titel, ...(d.firma ? { unter: d.firma } : {}) })));
  return raus;
}

/** Anzeigename eines Verweises — unbekannt (gelöscht, noch nicht geladen) → undefined. */
export function bezugName(v: CrmVerweise | null | undefined, art: BezugArt, id: string): string | undefined {
  if (!v) return undefined;
  if (art === 'kontaktId') return v.kontakte.find(k => k.id === id)?.name;
  if (art === 'firmaId') return v.firmen.find(f => f.id === id)?.name;
  if (art === 'mandatId') return v.mandate.find(m => m.id === id)?.titel;
  return v.deals.find(d => d.id === id)?.titel;
}

/** Link in die Akte: Kontakt öffnen, Firma, Mandat, Deal-Akte. */
export function bezugLink(art: BezugArt, id: string): string {
  if (art === 'kontaktId') return kontaktAkte(id);
  if (art === 'firmaId') return WEG.firma(id);
  if (art === 'mandatId') return WEG.mandat(id);
  return WEG.deal(id);
}

/**
 * Einen Verweis setzen: Mandat und Deal bringen ihre Firma mit (wenn noch keine gesetzt ist) — so findet die
 * Firmenakte die Aufgabe auch über das Mandat.
 */
export function bezugSetzen(alt: AufgabeBezug | undefined, t: Pick<Treffer, 'art' | 'id'>, v?: CrmVerweise | null): AufgabeBezug {
  const b: AufgabeBezug = { ...(alt ?? {}), [t.art]: t.id };
  const firma = t.art === 'mandatId' ? v?.mandate.find(m => m.id === t.id)?.firmaId : t.art === 'dealId' ? v?.deals.find(d => d.id === t.id)?.firmaId : t.art === 'kontaktId' ? v?.kontakte.find(k => k.id === t.id)?.firmaId : undefined;
  if (firma && !b.firmaId) b.firmaId = firma;
  return b;
}

/** Einen Verweis entfernen — leer → undefined. */
export function bezugOhne(alt: AufgabeBezug | undefined, art: BezugArt): AufgabeBezug | undefined {
  if (!alt) return undefined;
  const { [art]: _weg, ...rest } = alt;
  return Object.keys(rest).length ? rest : undefined;
}

/** Aufgaben einer Akte: Kontakt direkt, Firma direkt oder über ein Mandat/einen Deal dieser Firma. */
export function aufgabenFuer(tasks: readonly Task[], wer: { kontaktId?: string; firmaId?: string; mandatIds?: readonly string[]; dealIds?: readonly string[] }): Task[] {
  const m = new Set(wer.mandatIds ?? []), d = new Set(wer.dealIds ?? []);
  return tasks.filter(t => {
    const b = t.bezug;
    if (!b) return false;
    if (wer.kontaktId && b.kontaktId === wer.kontaktId) return true;
    if (wer.firmaId && (b.firmaId === wer.firmaId || (b.mandatId && m.has(b.mandatId)) || (b.dealId && d.has(b.dealId)))) return true;
    return false;
  });
}
