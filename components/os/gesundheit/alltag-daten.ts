'use client';

// ─── Gesundheit im Alltag — Daten für die drei Karten (09.10.2026) ──────────────────────────────────────────────────────
// Schlaf-Hilfe, Tages-Check und „Essen & Trinken heute“ lesen EINE Antwort: GET /api/gesundheit/alltag (nur die eigene Person — die
// Route liefert nichts anderes; der Anfrage-Bündler teilt den Aufruf, wenn mehrere Karten gleichzeitig laden). Geschrieben wird nur
// über die vorhandenen Wege: Einstellungen PATCH /api/gesundheit/alltag (Stand/409), Antworten des Checks PATCH /api/state/journal,
// Abhaken PATCH /api/state/health, neue Routine PATCH /api/state/routinen. Nach jedem Schreiben lädt jede Karte neu (Ereignis).

import { useCallback, useEffect, useState } from 'react';
import type { AlltagStand } from '@/lib/gesundheit/alltag';
import type { AlltagSicht } from '@/lib/gesundheit/alltag-server';

export interface AlltagAntwort {
  ok: boolean;
  ich: string;
  einwilligung: boolean;
  einstellung: Omit<AlltagStand, 'erinnert' | 'geaendert'>;
  stand: string;
  sicht: AlltagSicht | null;
}

const EREIGNIS = 'make-alltag-geaendert';
const melden = () => { try { window.dispatchEvent(new Event(EREIGNIS)); } catch { /* ohne Fenster nichts */ } };

type Antwort = { ok: boolean; fehler?: string };
const lesen = async (r: Response): Promise<Antwort> => {
  const d = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; fehler?: string; einwilligung?: string };
  if (r.ok && d.ok !== false) return { ok: true };
  if (d.einwilligung) return { ok: false, fehler: 'Dafür fehlt deine Einwilligung in Gesundheitsdaten (Einstellungen › Datenschutz).' };
  return { ok: false, fehler: d.error ?? d.fehler ?? (r.status === 409 ? 'Inzwischen geändert — neu geladen, bitte noch einmal.' : 'Nicht gespeichert.') };
};
const senden = (pfad: string, body: unknown, methode = 'PATCH') => fetch(pfad, { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  .then(lesen).catch((): Antwort => ({ ok: false, fehler: 'Keine Verbindung zum Server — nichts gespeichert.' }));

export function useAlltag() {
  const [d, setD] = useState<AlltagAntwort | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  const laden = useCallback(async (frisch = false) => {
    const a: AlltagAntwort | null = await fetch('/api/gesundheit/alltag', frisch ? { cache: 'no-store' } : undefined).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setLadeFehler(!a);
    if (a) setD(a);
  }, []);
  useEffect(() => {
    void laden();
    const neu = () => { void laden(true); };
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, [laden]);

  /** Einstellungen ändern (Schritte aus lib/gesundheit/alltag.ts) — mit dem Stand aus der letzten Antwort. */
  const einstellen = useCallback(async (ops: unknown[]): Promise<Antwort> => {
    const r = await senden('/api/gesundheit/alltag', { stand: d?.stand ?? 'leer', ops });
    melden();
    return r;
  }, [d?.stand]);

  /** Eine Antwort des Tages-Checks (null = zurücknehmen) — ins eigene Journal. */
  const antworten = useCallback(async (tag: string, frage: string, wert: boolean | null): Promise<Antwort> => {
    const r = await senden('/api/state/journal', { datum: tag, eintrag: { check: { [frage]: wert } } });
    melden();
    return r;
  }, []);

  /** Eine eigene Routine heute abhaken bzw. lösen. */
  const abhaken = useCallback(async (routine: string, erledigt: boolean): Promise<Antwort> => {
    const r = await senden('/api/state/health', { routine, erledigt });
    melden();
    return r;
  }, []);

  /** Eine Ergänzung als eigene Routine anlegen (owner = ich) und der Vorlage zuordnen — zwei vorhandene Schreibwege. */
  const ergaenzungAnlegen = useCallback(async (vorlage: string, label: string): Promise<Antwort> => {
    if (!d) return { ok: false, fehler: 'Noch nicht geladen.' };
    const id = `r-${crypto.randomUUID()}`;
    const r1 = await senden('/api/state/routinen', { ops: [{ op: 'upsert', eintrag: { id, label, wann: 'tag', kategorie: 'gesundheit', dauerMin: 5, aktiv: true, owner: d.ich, space: 'privat' } }] });
    if (!r1.ok) return r1;
    const r2 = await senden('/api/gesundheit/alltag', { stand: d.stand, ops: [{ op: 'ergaenzung', routine: id, vorlage }] });
    melden();
    return r2.ok ? r2 : { ok: false, fehler: `Die Routine steht, die Zuordnung nicht: ${r2.fehler ?? 'Fehler'}` };
  }, [d]);

  return { d, ladeFehler, laden, einstellen, antworten, abhaken, ergaenzungAnlegen };
}

/** Stunden als „7:24 h“. */
export const hm = (h: number): string => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; };
export const datumKurz = (tag: string): string => `${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;
