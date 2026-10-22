// ─── Fulfillment — „Wird in der Werkstatt bearbeitet“ (22.10., Fulfillment in die Werkstatt E4, Entscheidung F4; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──
// Ein Paket, das einmal in der Werkstatt bearbeitet wurde (erster Entwurf, Veröffentlichen) bzw. dort angelegt wurde, trägt die Marke `werkstatt:<paket>` im Bestand
// `fulfillment--<h>` (Feld `marken` — kein neues Feld). Ab dann gilt: der alte Editor zeigt es nur noch an (PATCH /api/fulfillment/editor und die Baum-Ops 409),
// Links führen in die Werkstatt, ein Import legt nur einen Entwurf an. EINE Stelle für Marke, Prüfung und Link. Rein und client-sicher.

import type { VorlagenDatei } from '../typen';
import { WEG } from '@/lib/wege';

const PRAEFIX = 'werkstatt:';
/** Die Marke eines Pakets. */
export const werkstattMarke = (paketId: string): string => `${PRAEFIX}${paketId}`;
/** Wird das Paket in der Werkstatt bearbeitet? */
export const inWerkstatt = (d: Pick<VorlagenDatei, 'marken'>, paketId: unknown): boolean => typeof paketId === 'string' && !!d.marken?.[werkstattMarke(paketId)];
/** Die Pakete mit Marke (Kennungen) — für die Ansichten, die Links bauen. */
export const paketeInWerkstatt = (d: Pick<VorlagenDatei, 'marken'>): string[] => Object.keys(d.marken ?? {}).filter(k => k.startsWith(PRAEFIX)).map(k => k.slice(PRAEFIX.length));
/** Marken mit der Marke dieses Pakets (rein; vorhandene bleibt — der erste Tag zählt). */
export const mitWerkstattMarke = (marken: VorlagenDatei['marken'], paketId: string, tag: string): VorlagenDatei['marken'] =>
  (marken?.[werkstattMarke(paketId)] ? marken : { ...marken, [werkstattMarke(paketId)]: tag });

/** Der Satz für den alten Editor (Antwort 409 und Hinweis). */
export const IN_WERKSTATT_TEXT = 'Dieser Ablauf wird in der Werkstatt bearbeitet — hier nur ansehen.';
/** Wo man das Paket bearbeitet: die Werkstatt (mit Marke) bzw. der Editor des Fulfillments. */
export const paketBearbeitenLink = (paketId: string, werkstatt?: readonly string[] | null): string =>
  (werkstatt?.includes(paketId) ? WEG.prozesse({ p: paketId, ansicht: 'werkstatt' }) : WEG.fulfillment('prozesse', { e: paketId }));
export const paketInWerkstattLink = (paketId: string): string => WEG.prozesse({ p: paketId, ansicht: 'werkstatt' });
