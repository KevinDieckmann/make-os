// ─── Zeit & Fokus — der laufende Fokus, Regeln (rein, 29.09.) ───────────────
// Seit 29.09. hält der Server den laufenden Fokus je Person fest (`fokus-laufend--<person>`, lib/zeitmessung/
// fokus-server.ts, Route /api/state/fokus) — vorher lebte er nur im localStorage des Browsers: Gerät gewechselt, Tab-Daten
// gelöscht, anderer Browser → der Start war weg und mit ihm die Fokus-Zeit. Der Browser bleibt die Anzeige.
// Tests: tests/fokus-laufend.test.ts.

import type { LaufenderFokus } from './fokus-laufend';

const SCHLUESSEL = /^(privat|business|gemeinsam):[a-z0-9-]{1,40}$/;
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

/** Einen laufenden Fokus säubern — null, wenn Beginn/Schlüssel fehlen oder der Beginn in der Zukunft/älter als 7 Tage liegt. */
export function laufendSaeubern(v: unknown, jetztMs = Date.now()): LaufenderFokus | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const von = typeof o.von === 'string' && Number.isFinite(Date.parse(o.von)) ? new Date(o.von).toISOString() : null;
  const schluessel = typeof o.schluessel === 'string' && SCHLUESSEL.test(o.schluessel) ? o.schluessel : null;
  if (!von || !schluessel) return null;
  const t = Date.parse(von);
  if (t > jetztMs + 5 * 60_000 || t < jetztMs - 7 * 86_400_000) return null;
  const label = typeof o.label === 'string' ? o.label.replace(/\u0000/g, '').trim().slice(0, 80) : '';
  return {
    von, schluessel, label,
    ...(typeof o.aufgabeId === 'string' && KENNUNG.test(o.aufgabeId) ? { aufgabeId: o.aufgabeId } : {}),
    ...(typeof o.einheit === 'string' && o.einheit.trim() ? { einheit: o.einheit.trim().slice(0, 40) } : {}),
    ...(typeof o.mandatId === 'string' && KENNUNG.test(o.mandatId) ? { mandatId: o.mandatId } : {}),
  };
}

/**
 * Abgleich Browser ↔ Server beim Öffnen/Fokus: der Server gewinnt, sobald er einen laufenden Fokus kennt (ein anderes
 * Gerät hat ihn gestartet oder umgestellt); kennt er keinen, der Browser aber schon (Start offline) → hochladen.
 */
export function laufendAbgleich(server: LaufenderFokus | null, lokal: LaufenderFokus | null): { art: 'nichts' | 'uebernehmen' | 'hochladen'; laufend: LaufenderFokus | null } {
  if (server) return JSON.stringify(server) === JSON.stringify(lokal) ? { art: 'nichts', laufend: server } : { art: 'uebernehmen', laufend: server };
  if (lokal) return { art: 'hochladen', laufend: lokal };
  return { art: 'nichts', laufend: null };
}

/**
 * Was der Fokus-Kopf nennt (29.09., Sichtprüfung): die Aufgabe, sonst das Mandat („Firma · Titel“), sonst der Bereich.
 * Vorher stand bei zugeordnetem Mandat nur der Bereich da („Fokus „MAKE OS““).
 */
export function fokusTitel(l: Pick<LaufenderFokus, 'label' | 'mandatId'>, aufgabe?: string, mandat?: { firma: string; titel: string } | null): string {
  if (aufgabe?.trim()) return aufgabe.trim();
  if (l.mandatId && mandat) return `${mandat.firma} · ${mandat.titel}`;
  if (l.mandatId) return 'Mandat';
  return l.label || 'Fokus';
}
