'use client';

// ─── Agenten-Seite: gemeinsamer Stand aller Spalten (09.10., Paket 2) ─────────────────────────────────────────────────
// Die Seite lädt EINMAL (Team, Threads, Läufe, Freigaben) und reicht den Stand über diesen Kontext an Team, Mitte und
// Hintergrund — so zeigen alle drei Spalten dasselbe, und die Tests rendern jede Spalte gegen das Fixture
// (tests/fixtures/agenten-api.ts), ohne zu laden.

import { createContext, useContext, type ReactNode } from 'react';
import type { AgentRef, AgentenAntwort, FadenAntwort, FadenListeAntwort, HeadKarte, LaeufeAntwort, Mitarbeiter, SkillsAntwort } from '@/lib/agenten/typen';
import type { Abruf, StapelAntwort } from './daten';
import { freigabenBeiHeads, wartendeFaeden, type Auswahl, type SkillEntwurf } from './regeln';
import type { FeldArt, Seitenfeld } from './klappen';

/**
 * Breit = Liste, Gespräch und Hintergrund nebeneinander · mittel = die Liste daneben oder als Schublade, der Hintergrund als Schublade ·
 * handy = eine Spalte mit Reitern unten (< 720 px). Breit/mittel entscheidet der gemessene Platz (klappen.ts `lageAus`).
 */
export type Form = 'breit' | 'mittel' | 'handy';

/**
 * Die zwei Seitenfelder (Aufräumen 09.10., Claude-Muster): links die Liste, rechts der Hintergrund — je offen oder zu. `art` sagt, ob ein
 * Feld neben dem Gespräch steht (Zustand je Browser gemerkt) oder als Schublade darüber (startet zu). Ohne Angabe (Tests) sind beide offen.
 */
export interface Felder {
  links: boolean;
  rechts: boolean;
  art: Readonly<Record<Seitenfeld, FeldArt>>;
  /** Ohne `offen` umschalten; mit `offen` setzen. */
  umschalten: (seite: Seitenfeld, offen?: boolean) => void;
}

/** Welche Fenster die Seite öffnen kann („+ Neu ▾“, „⋯“, Kopfleiste). */
export type DialogArt =
  | { art: 'auftrag'; agent?: AgentRef }
  | { art: 'mehrere' }
  | { art: 'hintergrund'; agent?: AgentRef }
  | { art: 'mitarbeiter'; headId?: string; vorlage?: Partial<Mitarbeiter> }
  | { art: 'skill'; headId?: string; skillId?: string; entwurf?: Partial<SkillEntwurf> }
  | { art: 'leitplanken' }
  | { art: 'geplant' }
  | { art: 'budget' }
  | { art: 'uebersicht' };

export interface AgentenWert {
  agenten: Abruf<AgentenAntwort>;
  faeden: Abruf<FadenListeAntwort>;
  laeufe: Abruf<LaeufeAntwort>;
  stapel: Abruf<StapelAntwort>;
  form: Form;
  /** Was die Mitte zeigt (aus der Adresse `h`/`f`). */
  auswahl: Auswahl;
  /** Ein neuer Thread mit einem Mitarbeiter (noch ohne Kennung — entsteht beim ersten Senden). */
  entwurf: { headId: string; mitarbeiterId: string } | null;
  starteEntwurf: (e: { headId: string; mitarbeiterId: string } | null) => void;
  /** „Jetzt“ für Zeitangaben (Tests setzen es fest). */
  jetzt: Date;
  /** Konkreter Space für den ZOE-Chat (Kopf-Schalter; bei „Alles“ der zuletzt gewählte). */
  space: 'privat' | 'business';
  /** Die Wahl im Kopf: was die Team-Liste zeigt. Gefiltert hat schon der Server — hier nur, welcher Bereich sichtbar ist. */
  bereich: 'alle' | 'privat' | 'business';
  /** Ort wechseln (Verlauf-Regel: push); `ersetzen` nur, wenn derselbe Ort einen neuen Thread bekommt. */
  oeffne: (o: { h?: string; f?: string }, ersetzen?: boolean) => void;
  dialog: (d: DialogArt) => void;
  /** Rückfrage vor Folgen (Not-Aus, Abbrechen, Ablehnen) — `useRueckfrage().bestaetigen`. */
  bestaetigen: (b: { titel: string; text?: ReactNode; ja: string; gefahr?: boolean }) => Promise<boolean>;
  /** Ruhige Rückmeldung oben auf der Seite. */
  melde: (text: string, art?: 'gut' | 'info' | 'kritisch') => void;
  /** Seitenfelder links/rechts (ohne Angabe: beide offen, neben dem Gespräch). */
  felder?: Felder;
  /**
   * „Neuer Thread“ (Kopfzeile, „Neu ▾“): dieser Ort beginnt beim nächsten Senden einen NEUEN Thread — `ziel` = 'zoe' oder die Kennung
   * eines Heads; `nr` zählt hoch, damit ein zweites „Neu“ am selben Ort wieder leer anfängt. Ort wechseln (`oeffne`) hebt es auf.
   */
  neu?: { ziel: string; nr: number } | null;
  starteNeu?: (ziel: string) => void;
  /**
   * Vorgegebene Antworten statt Laden (Tests gegen tests/fixtures/agenten-api.ts, Vorschau-Bilder): Threads je Kennung, Skills
   * je Head. Im Betrieb leer — dann lädt die Seite über daten.ts.
   */
  vorlage?: { faeden?: Readonly<Record<string, FadenAntwort>>; skills?: Readonly<Record<string, SkillsAntwort>> };
}

const Kontext = createContext<AgentenWert | null>(null);

export function AgentenKontext({ wert, children }: { wert: AgentenWert; children: ReactNode }) {
  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

export function useAgenten(): AgentenWert {
  const w = useContext(Kontext);
  if (!w) throw new Error('useAgenten außerhalb der Agenten-Seite');
  return w;
}

/** Die Heads, die die Person sieht — im gewählten Bereich (der Server hat schon gefiltert, was sie sehen DARF). */
export function sichtbareHeads(w: Pick<AgentenWert, 'agenten' | 'bereich'>): HeadKarte[] {
  if (w.agenten.zustand !== 'da') return [];
  return w.agenten.daten.heads.filter(h => w.bereich === 'alle' || h.bereich === w.bereich);
}

/** Die Seitenfelder — ohne Angabe (Tests, Vorschau) beide offen und neben dem Gespräch, mittel der Hintergrund als Schublade. */
export function felderVon(w: Pick<AgentenWert, 'felder' | 'form'>): Felder {
  return w.felder ?? { links: true, rechts: w.form !== 'mittel', art: { links: 'neben', rechts: w.form === 'mittel' ? 'schublade' : 'neben' }, umschalten: () => {} };
}

/**
 * Was auf die Person wartet — EINE Zahl für „Wartet auf dich“, den Zähler in der Kopfzeile des Gesprächs (wenn der Hintergrund zu ist) und
 * das Abzeichen am Handy-Reiter: Rückfragen der Threads + offene Freigaben im Stapel + Freigaben, die bei den Heads liegen.
 */
export function wartetAufDichZahl(w: Pick<AgentenWert, 'stapel' | 'faeden' | 'agenten'>): number {
  const vorschlaege = w.stapel.zustand === 'da' ? w.stapel.daten.vorschlaege.filter(v => !v.status || v.status === 'offen').length : 0;
  const rueckfragen = w.faeden.zustand === 'da' ? wartendeFaeden(w.faeden.daten.faeden).length : 0;
  const beiHeads = w.stapel.zustand === 'da' ? freigabenBeiHeads(w.agenten.zustand === 'da' ? w.agenten.daten.ueberblick.freigaben.anzahl : undefined, vorschlaege) : 0;
  return rueckfragen + vorschlaege + beiHeads;
}

/** Ein Head nach Kennung (auch außerhalb des Bereichs-Filters — ein Link zeigt ihn trotzdem). */
export function headKarte(w: Pick<AgentenWert, 'agenten'>, id: string | undefined): HeadKarte | null {
  if (!id || w.agenten.zustand !== 'da') return null;
  return w.agenten.daten.heads.find(h => h.id === id) ?? null;
}
