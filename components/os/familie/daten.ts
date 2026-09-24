'use client';

// ─── Familie & Partnerschaft — Daten auf der Seite ──────────────────────────
// Jede Handlung schickt genau eine Einzeländerung (PATCH). Zu zweit bleibt so
// erhalten, was der andere gerade an anderen Einträgen ändert; der Abgleich
// holt alle 20 Sekunden den gemeinsamen Stand.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { Familie, Liste } from '@/lib/familie/typen';
import type { Rhythmus } from '@/lib/familie/logik';

export interface TagFaellig { id: string; titel: string; art: string; am: string; faelligAb: string; inTagen: number; erledigt: boolean; wer: string; aktion: string; vorlaufTage: number; datum: string }
export interface Antwort {
  ok: boolean; fehler?: string; person: string; heute: string;
  familie: Familie; rhythmus: Rhythmus;
  gespraech: { datum: string; laufend: Familie['gespraeche'][number] | null };
  tage: TagFaellig[];
  kontakte: (Familie['menschen'][number] & { seit: number | null })[];
  frage: { id: string; text: string; tiefe: number };
  agenda: { offeneThemen: Familie['themen']; offeneVereinbarungen: Familie['vereinbarungen']; businessThemen: Familie['themen']; faelligeKarten: Familie['karten'] };
  mitglieder: { person: string; name: string }[];
}

export const neueId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useFamilie() {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const unterwegs = useRef(0);

  const laden = useCallback(async () => {
    if (unterwegs.current) return;
    try {
      const r = await fetch('/api/familie', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Nicht erreichbar.'); return; }
      setD(j); setFehler(null);
    } catch { setFehler('Nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useAbgleich(laden, { alle: 20_000, pausiert: () => unterwegs.current > 0 });

  const schicke = useCallback(async (body: Record<string, unknown>) => {
    unterwegs.current++;
    try {
      const r = await fetch('/api/familie', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (r.ok && j.ok) setD(j); else setFehler(j.fehler ?? 'Nicht gespeichert.');
      return j as Antwort & { abgelehnt?: number };
    } catch { setFehler('Nicht gespeichert — keine Verbindung.'); return null; }
    finally { unterwegs.current--; }
  }, []);

  /** Einen Eintrag anlegen oder ändern — sofort sichtbar, dann bestätigt. */
  const setze = useCallback(<T extends { id: string }>(liste: Liste, eintrag: T) => {
    setD(alt => {
      if (!alt) return alt;
      const l = (alt.familie[liste] as unknown as { id: string }[]);
      const neu = l.some(x => x.id === eintrag.id) ? l.map(x => (x.id === eintrag.id ? { ...x, ...eintrag } : x)) : [...l, eintrag];
      return { ...alt, familie: { ...alt.familie, [liste]: neu } };
    });
    const alt = d?.familie[liste] as unknown as { id: string }[] | undefined;
    const voll = { ...(alt?.find(x => x.id === eintrag.id) ?? {}), ...eintrag };
    return schicke({ ops: [{ liste, op: 'upsert', eintrag: voll }] });
  }, [d, schicke]);

  const weg = useCallback((liste: Liste, id: string) => {
    setD(alt => (alt ? { ...alt, familie: { ...alt.familie, [liste]: (alt.familie[liste] as unknown as { id: string }[]).filter(x => x.id !== id) } } : alt));
    return schicke({ ops: [{ liste, op: 'delete', id }] });
  }, [schicke]);

  const felder = useCallback((f: Record<string, unknown>) => schicke({ felder: f }), [schicke]);

  const name = useCallback((person: string | null | undefined) => {
    if (!person) return '—';
    return d?.mitglieder.find(m => m.person === person)?.name ?? (person.charAt(0).toUpperCase() + person.slice(1));
  }, [d]);

  return { d, fehler, laden, setze, weg, felder, name };
}
export type FamilieApi = ReturnType<typeof useFamilie>;

const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export function datumLang(iso: string, heute?: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const kurz = `${WT[d.getUTCDay()]}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  if (!heute) return kurz;
  const n = Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${heute}T12:00:00Z`)) / 864e5);
  return n === 0 ? `heute · ${kurz}` : n === 1 ? `morgen · ${kurz}` : n > 1 && n < 7 ? `in ${n} Tagen · ${kurz}` : kurz;
}
