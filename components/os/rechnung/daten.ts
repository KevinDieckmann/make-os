'use client';

// ─── Rechnungen schreiben · Daten im Browser (08.10.) ───────────────────────
// Lesen und Schreiben NUR über /api/rechnung (serverseitig nach Sicht gefiltert). Speichern läuft nacheinander mit dem Stand der
// letzten Server-Antwort (`fassung`) — 409 heißt: jemand anders war schneller. Stellen, Storno und Mahnung tragen eine `anfrageId`
// (ein Netz-Retry wirkt nie doppelt). MAKE OS verschickt nichts: PDF herunterladen, Mail-Programm öffnet der Browser.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import type { Gesellschaft } from '@/lib/crm/gesellschaften';
import type { MahnVorschlag, Pflicht } from '@/lib/finanzen/rechnung/regeln';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { neueKennung } from '@/lib/kennung';

export type RechnungMitFassung = Rechnung & { fassung: string };
export type AbsenderAnzeige = Gesellschaft & { luecken: string[] };
export interface RechnungStand {
  sicht: 'privat' | 'business';
  rechnungen: RechnungMitFassung[];
  gesellschaften: AbsenderAnzeige[];
  vorgabe: Gesellschaftskennung | null;
  mahnTage: [number, number, number];
  mahnvorschlaege: MahnVorschlag[];
}
export interface RechnungAntwort {
  ok: boolean; status: number; fehler?: string;
  rechnung?: RechnungMitFassung; aktuell?: RechnungMitFassung; vorhanden?: boolean; fehlt?: Pflicht[];
  pdf?: { id: string; name: string }; mail?: { an?: string; betreff: string; text: string };
  original?: RechnungMitFassung; storno?: RechnungMitFassung; gegenbuchung?: string; mahnTage?: [number, number, number];
}

/** Eine Anfrage-Kennung je Handlung (Idempotenz, lib/store/anfragen.ts). */
export const neueAnfrage = () => neueKennung('anf');

export async function rechnungPost(body: Record<string, unknown>, opt: { keepalive?: boolean } = {}): Promise<RechnungAntwort> {
  try {
    const text = JSON.stringify(body);
    const r = await fetch('/api/rechnung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text, ...(opt.keepalive && text.length < 60_000 ? { keepalive: true } : {}) });
    const d = (await r.json().catch(() => ({ ok: false, fehler: `Antwort ${r.status}` }))) as Omit<RechnungAntwort, 'status'>;
    return { ...d, status: r.status };
  } catch { return { ok: false, fehler: 'Keine Verbindung — nichts geändert.', status: 0 }; }
}

export function useRechnungen() {
  const [stand, setStand] = useState<RechnungStand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesperrt, setGesperrt] = useState(false);
  const laeuft = useRef(false);
  const laden = useCallback(async () => {
    if (laeuft.current) return;
    laeuft.current = true;
    try {
      const r = await fetch('/api/rechnung', { cache: 'no-store' });
      if (r.status === 403) { setGesperrt(true); return; }
      const d = await r.json().catch(() => null) as (RechnungStand & { ok?: boolean; fehler?: string }) | null;
      if (d?.ok) { setStand({ sicht: d.sicht, rechnungen: d.rechnungen ?? [], gesellschaften: d.gesellschaften ?? [], vorgabe: d.vorgabe ?? null, mahnTage: d.mahnTage, mahnvorschlaege: d.mahnvorschlaege ?? [] }); setFehler(null); }
      else setFehler(d?.fehler ?? `Antwort ${r.status}.`);
    } catch { setFehler('Keine Verbindung.'); }
    finally { laeuft.current = false; }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  /** Eine Rechnung aus einer Server-Antwort übernehmen (ohne die ganze Liste neu zu laden). */
  const uebernehmen = useCallback((r: RechnungMitFassung) => setStand(s => (s ? { ...s, rechnungen: s.rechnungen.some(x => x.id === r.id) ? s.rechnungen.map(x => (x.id === r.id ? r : x)) : [...s.rechnungen, r] } : s)), []);
  const entfernen = useCallback((id: string) => setStand(s => (s ? { ...s, rechnungen: s.rechnungen.filter(x => x.id !== id) } : s)), []);
  return { stand, fehler, gesperrt, laden, uebernehmen, entfernen, setFehler };
}
export type RechnungDaten = ReturnType<typeof useRechnungen>;

/** Adresse des PDF einer Rechnung (attachment). */
export const pdfAdresse = (rechnungId: string) => `/api/rechnung?pdf=${encodeURIComponent(rechnungId)}`;

/** PDF herunterladen, ohne die Seite zu verlassen. */
export function pdfLaden(rechnungId: string, name?: string) {
  const a = document.createElement('a');
  a.href = pdfAdresse(rechnungId);
  if (name) a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Einen Entwurf anlegen (frei · aus Angebot · aus Mandat) — für die Einstiege außerhalb der Finanzen (Kontakt › Umsatz, Mandatsakte,
 * Angebot). Liefert die Kennung (danach `WEG.rechnungSchreiben(id)`) oder den Fehlertext.
 */
export async function entwurfAnlegen(body: { quelle: 'frei' | 'angebot' | 'mandat'; firmaId?: string; kontaktId?: string; kundeFirmaId?: string; mandatId?: string; angebotId?: string; monat?: string; /** Nur die Einmalposten eines gemischten Angebots (Woche 1 · 3.6). */ nur?: 'einmalig' }): Promise<{ id?: string; fehler?: string; vorhanden?: boolean }> {
  const r = await rechnungPost({ aktion: 'neu', ...body, anfrageId: neueAnfrage() });
  if (r.ok && r.rechnung) return { id: r.rechnung.id, vorhanden: !!r.vorhanden };
  return { fehler: r.fehler ?? 'Nicht angelegt.' };
}
