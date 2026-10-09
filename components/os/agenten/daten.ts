'use client';

// ─── Agenten-Seite: der EINE Client (09.10., Paket 2 „Oberfläche“; AGENTEN_KONZEPT.md C11) ─────────────────────────────
// Jede Anfrage der Seite läuft hier durch — keine Komponente ruft `fetch` selbst. Gesprochen wird mit den echten Routen:
//   GET  /api/agenten                     → AgentenAntwort (Heads, Überblick — Paket 1)
//   GET/POST /api/agenten/faden           → Threads lesen, an Head/Mitarbeiter senden (Paket 1)
//   GET/POST /api/agenten/skills          → Skills, Mitarbeiter, Gedächtnis (Paket 3)
//   GET/POST /api/agenten/laeufe          → Hintergrundaufgaben, Als Nächstes, Geplant (Paket 3)
//   GET/POST /api/zoe/stapel              → „Wartet auf dich“: die offenen Freigaben (vorhanden, unverändert)
//   POST     /api/kimmi                   → der ZOE-Chat in der Mitte — auf dem ZOE-Thread der Person (`zoeFaden`, Paket 4a): der Server
//                                          liest den Verlauf aus dem Thread; ZoePanel, Empfang und diese Seite zeigen denselben Thread
// Typen: lib/agenten/typen.ts. Solange eine Route 501 antwortet (Stub), ist der Zustand `kommt` — die Seite zeigt dann einen
// ruhigen Leerzustand, nie einen Fehler. 401/403 = `gesperrt` (die Route hat entschieden, die Seite blendet nichts selbst aus).
// Schreiben geht immer mit `x-make-bau` (setzt die BauWache am Fenster) — 409 `neuLaden` kommt als Text an.

import { useEffect, useRef, useState } from 'react';
import type {
  AgentenAntwort, FadenAnfrage, FadenAntwort, FadenListeAntwort, FadenSendenAntwort, LaeufeAnfrage, LaeufeAntwort,
  SkillAnfrage, SkillAntwort, SkillsAntwort,
} from '@/lib/agenten/typen';
import type { KiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { zufallsUuid } from '@/lib/kennung';
import type { VorschlagKurz } from './regeln';

export type { KiKennzeichen };

/** Was ein Bereich der Seite gerade hat. */
export type Abruf<T> =
  | { zustand: 'laedt' }
  | { zustand: 'kommt'; text: string }
  | { zustand: 'gesperrt'; text: string }
  | { zustand: 'fehler'; text: string }
  | { zustand: 'da'; daten: T };

/** Ergebnis einer schreibenden Anfrage. `kommt` = die Route ist noch ein Stub (501). */
export type Ergebnis<T> = { ok: true; daten: T } | { ok: false; kommt: boolean; status: number; text: string; daten?: unknown };

export const WEGE = {
  agenten: '/api/agenten',
  faden: '/api/agenten/faden',
  skills: '/api/agenten/skills',
  laeufe: '/api/agenten/laeufe',
  stapel: '/api/zoe/stapel',
  zoe: '/api/kimmi',
} as const;

/** Nach jeder Änderung: alle Bereiche der Seite laden neu (Thread, Läufe, Freigaben, Team). */
export const AGENTEN_NEU = 'make-agenten-neu';
export function meldeNeu() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AGENTEN_NEU));
}

const KEIN_NETZ = 'Keine Verbindung — versuch es gleich noch einmal.';
const KOMMT_TEXT = 'Dieser Teil kommt mit dem nächsten Paket.';

function textAus(d: unknown, rueckfall: string): string {
  if (d && typeof d === 'object') {
    const o = d as { fehler?: unknown; error?: unknown };
    if (typeof o.fehler === 'string' && o.fehler) return o.fehler;
    if (typeof o.error === 'string' && o.error) return o.error;
  }
  return rueckfall;
}

/** Liest eine Antwort als Abruf — 501 → `kommt`, 401/403 → `gesperrt`, sonst Fehler mit dem Satz des Servers. */
export async function holen<T>(url: string): Promise<Abruf<T>> {
  let r: Response;
  try { r = await fetch(url, { headers: { Accept: 'application/json' } }); } catch { return { zustand: 'fehler', text: KEIN_NETZ }; }
  let d: unknown = null;
  try { d = await r.json(); } catch { /* leerer Körper */ }
  if (r.status === 501) return { zustand: 'kommt', text: textAus(d, KOMMT_TEXT) };
  if (r.status === 401 || r.status === 403) return { zustand: 'gesperrt', text: textAus(d, 'Diesen Bereich sieht nur die angemeldete Person selbst.') };
  if (!r.ok || !d) return { zustand: 'fehler', text: textAus(d, `Konnte nicht laden (${r.status}).`) };
  return { zustand: 'da', daten: d as T };
}

/** Schreibt (POST, JSON). Der Satz des Servers kommt immer mit — nie ein stilles Scheitern. */
export async function senden<T>(url: string, body: unknown): Promise<Ergebnis<T>> {
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  } catch { return { ok: false, kommt: false, status: 0, text: KEIN_NETZ }; }
  let d: unknown = null;
  try { d = await r.json(); } catch { /* leerer Körper */ }
  if (r.status === 501) return { ok: false, kommt: true, status: 501, text: textAus(d, KOMMT_TEXT) };
  const okFeld = d && typeof d === 'object' ? (d as { ok?: unknown }).ok : undefined;
  if (!r.ok || okFeld === false) return { ok: false, kommt: false, status: r.status, text: textAus(d, `Nicht gespeichert (${r.status}).`), daten: d };
  return { ok: true, daten: d as T };
}

// ── Lesen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die offenen Freigaben der Person (Antwort von GET /api/zoe/stapel). */
export interface StapelAntwort { ok: true; vorschlaege: VorschlagKurz[]; offen: number }
/** Antwort des ZOE-Chats (POST /api/kimmi). `fadenId` = der ZOE-Thread, in dem der Zug steht (Paket 4a). */
export interface ZoeAntwort { reply?: string; stapelOffen?: number; ran?: { agent: string; ok: boolean }[]; ki?: KiKennzeichen; needsKey?: boolean; error?: string; fadenId?: string; titel?: string }

const q = (basis: string, p: Record<string, string | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const t = s.toString();
  return t ? `${basis}?${t}` : basis;
};

export const ladeAgenten = () => holen<AgentenAntwort>(WEGE.agenten);
export const ladeFaeden = (agent?: string) => holen<FadenListeAntwort>(q(WEGE.faden, { agent }));
export const ladeFaden = (id: string) => holen<FadenAntwort>(q(WEGE.faden, { id }));
export const ladeSkills = (head?: string) => holen<SkillsAntwort>(q(WEGE.skills, { head }));
export const ladeSkill = (id: string) => holen<SkillAntwort>(q(WEGE.skills, { id }));
export const ladeLaeufe = () => holen<LaeufeAntwort>(WEGE.laeufe);
export const ladeStapel = () => holen<StapelAntwort>(WEGE.stapel);

// ── Schreiben ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Kennung je Absicht — wiederholt der Browser die Anfrage, legt der Server nichts doppelt an (`einmalig`). */
export const anfrageId = (): string => zufallsUuid();

export async function fadenSenden(a: FadenAnfrage): Promise<Ergebnis<FadenSendenAntwort>> {
  const r = await senden<FadenSendenAntwort>(WEGE.faden, a);
  if (r.ok) meldeNeu();
  return r;
}
export async function skillSenden(a: SkillAnfrage): Promise<Ergebnis<Partial<SkillAntwort> & { ok: true }>> {
  const r = await senden<Partial<SkillAntwort> & { ok: true }>(WEGE.skills, a);
  if (r.ok) meldeNeu();
  return r;
}
export async function laeufeSenden(a: LaeufeAnfrage): Promise<Ergebnis<{ ok: true }>> {
  const r = await senden<{ ok: true }>(WEGE.laeufe, a);
  if (r.ok) meldeNeu();
  return r;
}
/** Freigabe aus „Wartet auf dich“: eine Entscheidung je Vorschlag oder „alle risikoarmen“ (der Server nimmt nur risikoarme). */
export async function stapelEntscheiden(b: { id: string; entscheidung: 'freigeben' | 'ablehnen'; grund?: string } | { alle: true }): Promise<Ergebnis<{ ok: true; erledigt?: number; einzeln?: number }>> {
  const r = await senden<{ ok: true; erledigt?: number; einzeln?: number }>(WEGE.stapel, b);
  if (r.ok) meldeNeu();
  return r;
}
/**
 * Der ZOE-Chat der Mitte (Paket 4a): die Nachricht geht in den ZOE-Thread der Person (`zoeFaden` = Kennung oder 'neu') — der Server
 * liest den Verlauf aus dem Thread (nie vom Browser), „fremd gelesen“ steht am Thread. Kein `context` mehr: der wäre Text Dritter, und
 * ZOE dürfte ab dem zweiten Zug nur noch vorschlagen.
 */
export async function zoeFragen(b: { message: string; space: 'privat' | 'business'; zoeFaden: string }): Promise<Ergebnis<ZoeAntwort>> {
  const r = await senden<ZoeAntwort>(WEGE.zoe, b);
  if (r.ok) meldeNeu();
  return r;
}

// ── Hook: ein Bereich lädt, lädt nach Änderungen neu und — wenn sichtbar — in Abständen ≥ 30 s (Tempo-Regel) ───────────

/**
 * `schluessel` = was geladen wird (null = nichts). Wechselt er, steht der Bereich kurz auf „lädt“ (kein alter Thread unter
 * neuer Adresse). `alleMs` nur ≥ 30 000 und nur, solange der Tab sichtbar ist.
 */
export function useAbruf<T>(schluessel: string | null, laden: () => Promise<Abruf<T>>, alleMs?: number): { stand: Abruf<T>; neu: () => void } {
  const [stand, setStand] = useState<{ fuer: string | null; abruf: Abruf<T> }>({ fuer: null, abruf: { zustand: 'laedt' } });
  const ladenRef = useRef(laden);
  ladenRef.current = laden;
  const [runde, setRunde] = useState(0);
  useEffect(() => {
    if (!schluessel) return;
    let lebt = true;
    const los = () => { void ladenRef.current().then(a => { if (lebt) setStand({ fuer: schluessel, abruf: a }); }); };
    los();
    window.addEventListener(AGENTEN_NEU, los);
    const takt = alleMs && alleMs >= 30_000 ? setInterval(() => { if (document.visibilityState === 'visible') los(); }, alleMs) : undefined;
    return () => { lebt = false; window.removeEventListener(AGENTEN_NEU, los); if (takt) clearInterval(takt); };
  }, [schluessel, runde, alleMs]);
  const abruf: Abruf<T> = !schluessel ? { zustand: 'laedt' } : stand.fuer === schluessel ? stand.abruf : { zustand: 'laedt' };
  return { stand: abruf, neu: () => setRunde(n => n + 1) };
}

/** Die Daten eines Abrufs oder null. */
export const daten = <T,>(a: Abruf<T>): T | null => (a.zustand === 'da' ? a.daten : null);
