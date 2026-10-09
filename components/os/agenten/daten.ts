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
// Chats (ZOE, Heads, Mitarbeiter) schicken seit 09.10. `Accept: text/event-stream` (lib/http/strom-client.ts): der Text erscheint, während
// er entsteht, Werkzeuge als „ruft … auf“; am Ende dieselbe Antwort wie ohne Strom (Rückfall auf JSON, wenn der Strom nicht geht).
// Typen: lib/agenten/typen.ts. Solange eine Route 501 antwortet (Stub), ist der Zustand `kommt` — die Seite zeigt dann einen
// ruhigen Leerzustand, nie einen Fehler. 401/403 = `gesperrt` (die Route hat entschieden, die Seite blendet nichts selbst aus).
// Schreiben geht immer mit `x-make-bau` (setzt die BauWache am Fenster) — 409 `neuLaden` kommt als Text an.

import { useEffect, useRef, useState } from 'react';
import type {
  AgentenAntwort, EinstellungAnfrage, FadenAnfrage, FadenAntwort, FadenListeAntwort, FadenSendenAntwort, LaeufeAnfrage, LaeufeAntwort,
  SkillAnfrage, SkillAntwort, SkillsAntwort,
} from '@/lib/agenten/typen';
import type { KiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { zufallsUuid } from '@/lib/kennung';
import type { StromEreignis } from '@/lib/http/sse';
export { ENTSTEHEND_LEER, entstehendNach, type Entstehend } from '@/lib/http/sse';
import { postMitStrom } from '@/lib/http/strom-client';
import type { VorschlagKurz } from './regeln';

export type { KiKennzeichen, StromEreignis };

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

/** Status + Körper einer schreibenden Antwort als Ergebnis — dieselbe Regel mit und ohne Strom. */
function ergebnisAus<T>(status: number, d: unknown): Ergebnis<T> {
  if (status === 501) return { ok: false, kommt: true, status: 501, text: textAus(d, KOMMT_TEXT) };
  const okFeld = d && typeof d === 'object' ? (d as { ok?: unknown }).ok : undefined;
  if (status < 200 || status >= 300 || okFeld === false) return { ok: false, kommt: false, status, text: textAus(d, `Nicht gespeichert (${status}).`), daten: d };
  return { ok: true, daten: d as T };
}

/** Schreibt (POST, JSON). Der Satz des Servers kommt immer mit — nie ein stilles Scheitern. */
export async function senden<T>(url: string, body: unknown): Promise<Ergebnis<T>> {
  let r: Response;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
  } catch { return { ok: false, kommt: false, status: 0, text: KEIN_NETZ }; }
  let d: unknown = null;
  try { d = await r.json(); } catch { /* leerer Körper */ }
  return ergebnisAus<T>(r.status, d);
}

/** Abgerissener Strom: der Server hat nichts Halbes gespeichert — der Thread wird neu geladen. */
export const STROM_ABGERISSEN = 'Die Verbindung ist abgerissen — der Thread wird neu geladen. Fehlt die Antwort, bitte noch einmal senden.';

/**
 * Schreibt mit Strom (09.10., „wie Claude“): Text-Stücke und Werkzeug-Stände gehen an `bei`, das Ergebnis ist dasselbe wie bei `senden`
 * (Rückfall auf JSON in lib/http/strom-client.ts). Reißt der Strom ab, lädt die Seite neu (nie eine automatische Wiederholung).
 */
export async function sendenMitStrom<T>(url: string, body: unknown, bei: (e: StromEreignis) => void, signal?: AbortSignal): Promise<Ergebnis<T>> {
  const r = await postMitStrom(url, body, bei, signal ? { signal } : {});
  if (r.netz) return { ok: false, kommt: false, status: 0, text: KEIN_NETZ };
  if (r.unterbrochen) { meldeNeu(); return { ok: false, kommt: false, status: 0, text: signal?.aborted ? '' : STROM_ABGERISSEN, daten: { unterbrochen: true } }; }
  return ergebnisAus<T>(r.status, r.body);
}

/**
 * 409 mit Rückfrage (Gegenprüfung 09.10.): die Routen antworten bei Kosten über der Schwelle mit `kostenBestaetigen` (+ Schätzung im Satz)
 * bzw. in einer Business-freien Zeit mit `businessFrei` — vorher zeigte die Seite das nur als Fehler, bestätigen ging nie. Hier: fragen,
 * dann mit `kostenBestaetigt` bzw. `trotzdem` erneut senden. Sagt die Person nein, kommt ein Ergebnis ohne Text (nichts melden).
 */
export async function mitRueckfrage<T>(
  sende: (zusatz: { kostenBestaetigt?: true; trotzdem?: true }) => Promise<Ergebnis<T>>,
  bestaetigen: (b: { titel: string; text?: string; ja: string }) => Promise<boolean>,
  titel: string,
): Promise<Ergebnis<T>> {
  let zusatz: { kostenBestaetigt?: true; trotzdem?: true } = {};
  for (let i = 0; i < 3; i++) {
    const r = await sende(zusatz);
    if (r.ok || r.status !== 409) return r;
    const d = (r.daten && typeof r.daten === 'object' ? r.daten : {}) as { kostenBestaetigen?: unknown; businessFrei?: unknown };
    if (d.kostenBestaetigen === true && !zusatz.kostenBestaetigt) {
      if (!(await bestaetigen({ titel, text: r.text, ja: 'Starten' }))) return { ...r, text: '' };
      zusatz = { ...zusatz, kostenBestaetigt: true };
      continue;
    }
    if (d.businessFrei === true && !zusatz.trotzdem) {
      if (!(await bestaetigen({ titel: 'Trotzdem starten?', text: r.text, ja: 'Trotzdem' }))) return { ...r, text: '' };
      zusatz = { ...zusatz, trotzdem: true };
      continue;
    }
    return r;
  }
  return { ok: false, kommt: false, status: 409, text: 'Nicht gestartet.' };
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

/** An einen Head bzw. Mitarbeiter senden — mit `bei` als Strom (der Text erscheint, während er entsteht), sonst JSON wie bisher. */
export async function fadenSenden(a: FadenAnfrage, bei?: (e: StromEreignis) => void): Promise<Ergebnis<FadenSendenAntwort>> {
  const r = bei ? await sendenMitStrom<FadenSendenAntwort>(WEGE.faden, a, bei) : await senden<FadenSendenAntwort>(WEGE.faden, a);
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
export async function zoeFragen(b: { message: string; space: 'privat' | 'business'; zoeFaden: string }, bei?: (e: StromEreignis) => void): Promise<Ergebnis<ZoeAntwort>> {
  const r = bei ? await sendenMitStrom<ZoeAntwort>(WEGE.zoe, b, bei) : await senden<ZoeAntwort>(WEGE.zoe, b);
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

// ── Paket 4b: Einstellungen je Head, Not-Aus, Budget, Daumen, Probelauf ─────────────────────────────────────────────────
// Eigene Wege (eigener Abschnitt, damit Paket 4a — ZOE auf Threads — oben ohne Berührung weiterbauen kann):
//   POST /api/agenten { aktion: 'einstellung' | 'not-aus' } → Einstellungen je Head, Not-Aus für alle bzw. je Head
//   PUT  /api/datenschutz/ki { ebene: 'instanz', anbieter: { budget } } → Instanz-Budget (Monat bzw. gesamt; nur der Inhaber — die Route
//        entscheidet, die Seite zeigt das Formular nur mit `budget.setzen`)
//   POST /api/agenten/faden { aktion: 'bewerten' } → Daumen an einer Antwort bzw. einem Bericht (ohne die ganze Seite neu zu laden)
//   GET  /api/medien → Bilder für den Foto-Avatar eines Heads (nur, was die Person sieht)

export const WEGE_4B = { budget: '/api/datenschutz/ki', medien: '/api/medien' } as const;

/** Einstellung eines Heads bzw. Not-Aus schreiben. Danach lädt die Seite neu (Team, Kopf, Mitte). */
export async function einstellungSenden(a: EinstellungAnfrage): Promise<Ergebnis<{ ok: true; stand?: string; angehalten?: number }>> {
  const r = await senden<{ ok: true; stand?: string; angehalten?: number }>(WEGE.agenten, a);
  if (r.ok) meldeNeu();
  return r;
}

/** Instanz-Budget setzen (Euro-Cent; null = keine Grenze, nur messen). Nur der Inhaber — sonst 403 mit Satz. */
export async function budgetSetzen(b: { monatEuroCent?: number | null; gesamtEuroCent?: number | null }): Promise<Ergebnis<unknown>> {
  let r: Response;
  try {
    r = await fetch(WEGE_4B.budget, { method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ebene: 'instanz', anbieter: { budget: b } }) });
  } catch { return { ok: false, kommt: false, status: 0, text: KEIN_NETZ }; }
  let d: unknown = null;
  try { d = await r.json(); } catch { /* leer */ }
  if (!r.ok || (d && typeof d === 'object' && (d as { ok?: unknown }).ok === false)) return { ok: false, kommt: false, status: r.status, text: textAus(d, `Nicht gespeichert (${r.status}).`), daten: d };
  meldeNeu();
  return { ok: true, daten: d };
}

/** Daumen an einer Antwort bzw. einem Bericht (eigener Thread). `null` nimmt ihn zurück. Lädt die Seite nicht neu. */
export async function bewerten(fadenId: string, nachrichtId: string, wert: 'hoch' | 'runter' | null): Promise<Ergebnis<{ ok: true }>> {
  const a: FadenAnfrage = { aktion: 'bewerten', fadenId, nachrichtId, wert };
  return senden<{ ok: true }>(WEGE.faden, a);
}

/** Bilder für den Foto-Avatar: nur Bilder (keine Videos), die die Person sieht — Kennung und Vorschau-Adresse. */
export interface FotoWahl { id: string; name: string; vorschau: string }
export async function ladeFotos(): Promise<Abruf<{ fotos: FotoWahl[] }>> {
  const a = await holen<{ medien?: { id: string; art: string; name?: string }[] }>(WEGE_4B.medien);
  if (a.zustand !== 'da') return a;
  const fotos = (a.daten.medien ?? []).filter(m => m.art === 'bild' && /^md-[0-9a-f-]{36}$/.test(m.id)).slice(0, 48)
    .map(m => ({ id: m.id, name: m.name ?? 'Bild', vorschau: `${WEGE_4B.medien}/inhalt?id=${m.id}&v=raster` }));
  return { zustand: 'da', daten: { fotos } };
}
