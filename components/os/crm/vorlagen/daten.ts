'use client';

// ─── Markttraktion · Vorlagen des Haushalts im Browser (Restpunkte 24.10.) ──────────────────────────────────────────────────────────────────────────────────
// Die Playbooks und Event-Vorlagen kommen NUR vom Server (GET /api/crm/vorlagen — dort `playbooksFuer`/`eventVorlagenFuer`): Vorgaben mit den Abweichungen des
// Haushalts und eigene Kopien. Bis die Antwort da ist, gelten die Vorgaben im Code (ohne Anpassung sind sie genau das). Ein Abruf je Art für alle Ansichten
// (Zwischenspeicher hier), nach jeder Änderung neu (Ereignis `make-vorlagen-geaendert`). Schreiben nur über `vorlageAendern` (Stand/409 vom Server).

import { useCallback, useEffect, useState } from 'react';
import { VORLAGEN, type Vorlage } from '@/lib/crm/eventplanung';
import type { Playbook } from '@/lib/crm/kampagnen';
import type { VorlagenArt } from '@/lib/crm/vorlagen-regeln';

export interface VorlagenAntwort<T> { art: VorlagenArt; vorlagen: T[]; standard: T[]; stand: string; hinweise?: Record<string, string[]>; recht?: string; /** Darf diese Person ändern? (Server: volle Mitglieder; „nur Business“ liest.) */ aendern?: boolean }
const EREIGNIS = 'make-vorlagen-geaendert';
const zwischen: Partial<Record<VorlagenArt, VorlagenAntwort<unknown>>> = {};
const laufend: Partial<Record<VorlagenArt, Promise<VorlagenAntwort<unknown> | null>>> = {};

async function holen(art: VorlagenArt, frisch = false): Promise<VorlagenAntwort<unknown> | null> {
  if (!frisch && zwischen[art]) return zwischen[art]!;
  if (!frisch && laufend[art]) return laufend[art]!;
  const p = fetch(`/api/crm/vorlagen?art=${art}`, { cache: 'no-store' }).then(r => r.json()).then(j => {
    if (!j?.ok) return null;
    const a = { art, vorlagen: j.vorlagen, standard: j.standard, stand: j.stand, hinweise: j.hinweise, recht: j.recht, aendern: j.aendern === true } as VorlagenAntwort<unknown>;
    zwischen[art] = a;
    return a;
  }).catch(() => null).finally(() => { delete laufend[art]; });
  laufend[art] = p;
  return p;
}

/** Die Vorlagen einer Art (`null` solange nichts geladen ist und kein Rückfall gilt) und ein Neu-Laden. */
export function useVorlagen<T>(art: VorlagenArt): { daten: VorlagenAntwort<T> | null; neu: () => Promise<void>; fehler: string | null } {
  const [daten, setDaten] = useState<VorlagenAntwort<T> | null>((zwischen[art] as VorlagenAntwort<T> | undefined) ?? null);
  const [fehler, setFehler] = useState<string | null>(null);
  const neu = useCallback(async () => {
    const a = await holen(art, true);
    if (a) { setDaten(a as VorlagenAntwort<T>); setFehler(null); } else setFehler('Vorlagen nicht erreichbar.');
  }, [art]);
  useEffect(() => {
    let lebt = true;
    void holen(art).then(a => { if (!lebt) return; if (a) setDaten(a as VorlagenAntwort<T>); else setFehler('Vorlagen nicht erreichbar.'); });
    const hoeren = () => { const a = zwischen[art]; if (a && lebt) setDaten(a as VorlagenAntwort<T>); };
    window.addEventListener(EREIGNIS, hoeren);
    return () => { lebt = false; window.removeEventListener(EREIGNIS, hoeren); };
  }, [art]);
  return { daten, neu, fehler };
}

/** Die Event-Vorlagen des Haushalts — bis zur Antwort die Vorgaben im Code. */
export function useEventVorlagen(): Vorlage[] {
  return useVorlagen<Vorlage>('event').daten?.vorlagen ?? VORLAGEN;
}

export type VorlagenAenderung = { op: 'speichern'; id: string; vorlage: Record<string, unknown> } | { op: 'kopieren'; id: string; name?: string } | { op: 'standard'; id: string } | { op: 'loeschen'; id: string };

/** Eine Änderung schicken (Stand aus der letzten Antwort). Liefert die neue Antwort oder den Satz des Servers; 409 lädt den aktuellen Stand. */
export async function vorlageAendern<T>(art: VorlagenArt, stand: string, a: VorlagenAenderung): Promise<{ ok: true; id: string; daten: VorlagenAntwort<T> } | { ok: false; fehler: string; konflikt?: boolean }> {
  const r = await fetch('/api/crm/vorlagen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ art, stand, ...a }) }).catch(() => null);
  if (!r) return { ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' };
  const j = await r.json().catch(() => null) as ({ ok?: boolean; fehler?: string; id?: string } & Partial<VorlagenAntwort<T>>) | null;
  if (r.status === 409) { await holen(art, true); window.dispatchEvent(new Event(EREIGNIS)); return { ok: false, konflikt: true, fehler: j?.fehler ?? 'Inzwischen geändert — neu geladen. Nichts gespeichert.' }; }
  if (!r.ok || !j?.ok) return { ok: false, fehler: j?.fehler ?? `Nicht gespeichert (${r.status}).` };
  const daten = { art, vorlagen: j.vorlagen!, standard: j.standard!, stand: j.stand!, hinweise: j.hinweise, recht: j.recht, aendern: j.aendern === true } as VorlagenAntwort<T>;
  zwischen[art] = daten as VorlagenAntwort<unknown>;
  window.dispatchEvent(new Event(EREIGNIS));
  return { ok: true, id: j.id ?? a.id, daten };
}

/** Für Playbooks die Typen (die Kampagnen-Seite lädt ihre Playbooks weiter über GET /api/crm/kampagnen — mit Zielgruppe von heute). */
export type { Playbook };
