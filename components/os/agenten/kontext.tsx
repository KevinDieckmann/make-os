'use client';

// ─── Agenten-Seite: gemeinsamer Stand aller Spalten (09.10., Paket 2) ─────────────────────────────────────────────────
// Die Seite lädt EINMAL (Team, Threads, Läufe, Freigaben) und reicht den Stand über diesen Kontext an Team, Mitte und
// Hintergrund — so zeigen alle drei Spalten dasselbe, und die Tests rendern jede Spalte gegen das Fixture
// (tests/fixtures/agenten-api.ts), ohne zu laden.

import { createContext, useContext, type ReactNode } from 'react';
import type { AgentRef, AgentenAntwort, FadenAntwort, FadenListeAntwort, HeadKarte, LaeufeAntwort, Mitarbeiter, SkillsAntwort } from '@/lib/agenten/typen';
import type { Abruf, StapelAntwort } from './daten';
import type { Auswahl, SkillEntwurf } from './regeln';

/** Breit = drei Spalten (ab 1.180 px) · mittel = zwei · handy = eine mit Reitern unten (< 720 px). */
export type Form = 'breit' | 'mittel' | 'handy';

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

/** Ein Head nach Kennung (auch außerhalb des Bereichs-Filters — ein Link zeigt ihn trotzdem). */
export function headKarte(w: Pick<AgentenWert, 'agenten'>, id: string | undefined): HeadKarte | null {
  if (!id || w.agenten.zustand !== 'da') return null;
  return w.agenten.daten.heads.find(h => h.id === id) ?? null;
}
