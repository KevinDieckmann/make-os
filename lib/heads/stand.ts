// ─── Freigabe-Liste und Berichte der Heads ─────────────────────────────────
// Ein Speicher je Head (head-sales, head-marketing, head-event), geteilt von
// Kevin und Malin — Geschäftsdaten, nichts Privates. Dedup wie beim Head of
// Finance: erst über den Schlüssel, dann unscharf über art + Titel; was
// abgelehnt wurde, kommt 30 Tage nicht wieder.

import type { Antwort, Pruefung, Vorschlag } from './pruefer';
import type { Merksatz } from './lernen';
import type { HeadId } from './prompt';

export type Status = 'offen' | 'angenommen' | 'abgelehnt' | 'erledigt';
export interface HeadVorschlag extends Vorschlag {
  id: string; status: Status; erstellt: string; aktualisiert: string; entschieden?: string; von?: string; berichtId: string;
  /** Ablehnungsgrund (lib/heads/lernen.ts ABLEHNGRUENDE) — daraus lernt der Head. */
  grund?: string;
  /** Der Entwurf so, wie ihr ihn übernommen habt (bearbeitet) — Muster für die nächsten. */
  entwurfFinal?: string;
  /** Aus welchem Modus (für Beispiele nach Ähnlichkeit). */
  modus?: string;
  /** Automatisch übernommen (interne Kleinigkeit, Kevins Regel 25.09.) — mit Rücknahme. */
  auto?: { am: string; wirkung: string; rueckgaengig?: { art: 'schritt' | 'aufgabe'; kontaktId?: string; vorher?: { text: string; datum: string } | null; aufgabeId?: string } };
}
export interface HeadBericht { id: string; zeit: string; modus: string; ausgeloest: 'hand' | 'takt' | 'zoe'; person?: string; frage?: string; antwort: Antwort; pruefung: Pruefung & { korrigiert: boolean }; modell: string; dauer_ms: number; /** 'ki' = Modell hat geprüft und ergänzt · 'regelwerk' = ohne Modell (kein Schlüssel, Ausfall). */ quelle?: 'ki' | 'regelwerk'; /** Warum der Grundlauf ohne Modell lief. */ ohneKiGrund?: string; /** Tokens dieses Laufs inkl. Cache, Aufrufe, request-ids. */ verbrauch?: { ein: number; aus: number; cacheLesen: number; cacheSchreiben: number; aufrufe: number; requestIds: string[] } }
export interface HeadStand { berichte: HeadBericht[]; vorschlaege: HeadVorschlag[]; letzte: Record<string, string>; versuche: Record<string, string>; ruhig?: { zeit: string; text: string }; /** Merksätze des Heads (von euch oder angenommen aus seinen Vorschlägen). */ gedaechtnis?: Merksatz[]; /** Interne Kleinigkeiten selbst erledigen (Standard: an, Kevin 25.09.). */ autonomie?: 'intern' | 'aus'; /** Freigabe-Liste voll (09.10., Takt robust): letzter Lauf, der neue Vorschläge ablehnen musste — nur Zeit und Anzahl. */ voll?: { zeit: string; abgelehnt: number } }

export const standName = (h: HeadId) => `head-${h}`;
export const leererStand = (): HeadStand => ({ berichte: [], vorschlaege: [], letzte: {}, versuche: {} });
const TAG = 864e5;
const woerter = (t: string) => new Set(t.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
export function aehnlich(a: Pick<Vorschlag, 'art' | 'titel' | 'kontakt_id'>, b: Pick<Vorschlag, 'art' | 'titel' | 'kontakt_id'>): boolean {
  if (a.art !== b.art || (a.kontakt_id ?? '') !== (b.kontakt_id ?? '')) return false;
  const x = woerter(a.titel), y = woerter(b.titel);
  const schnitt = Array.from(x).filter(w => y.has(w)).length;
  const verein = new Set([...Array.from(x), ...Array.from(y)]).size;
  return verein > 0 && schnitt / verein >= 0.5;
}

/**
 * Grenzen der Freigabe-Liste (09.10., Takt robust — „Nie abschneiden, ablehnen“): vorher schnitt `slice(-120)` die ältesten Einträge ab,
 * auch OFFENE, die noch niemand entschieden hatte. Jetzt: offene bleiben immer; entschiedene nach Frist (90 Tage, angenommene ohne Frist —
 * sie halten die Dublettenprüfung) und davon höchstens `ENTSCHIEDEN_MAX` jüngste. Liegen schon `OFFEN_MAX` offene, werden NEUE abgelehnt
 * (gezählt, Lagebild des Head of IT) statt alte wegzuschneiden.
 */
export const ENTSCHIEDEN_MAX = 120;
export const OFFEN_MAX = 200;

export function mischen(alt: HeadVorschlag[], neu: Vorschlag[], berichtId: string, jetzt: string, modus?: string): { liste: HeadVorschlag[]; neu: number; aktualisiert: number; abgelehnt: number } {
  const liste = alt.map(v => ({ ...v }));
  let n = 0, a = 0, abgelehnt = 0;
  let offene = liste.filter(x => x.status === 'offen').length;
  for (const v of neu) {
    const gleich = liste.filter(x => x.dedup_schluessel === v.dedup_schluessel || aehnlich(x, v));
    const offen = gleich.find(x => x.status === 'offen');
    if (offen) { Object.assign(offen, { ...v, id: offen.id, status: 'offen', erstellt: offen.erstellt, aktualisiert: jetzt, berichtId, ...(modus ? { modus } : {}) }); a++; continue; }
    if (gleich.some(x => x.status === 'angenommen')) continue;
    if (gleich.some(x => x.status === 'abgelehnt' && Date.parse(jetzt) - Date.parse(x.entschieden ?? x.aktualisiert) < 30 * TAG)) continue;
    if (offene >= OFFEN_MAX) { abgelehnt++; continue; }
    liste.push({ ...v, id: `hs-${Date.parse(jetzt).toString(36)}-${n}`, status: 'offen', erstellt: jetzt, aktualisiert: jetzt, berichtId, ...(modus ? { modus } : {}) });
    n++; offene++;
  }
  const zeitVon = (x: HeadVorschlag) => Date.parse(x.entschieden ?? x.aktualisiert);
  const entschieden = liste.filter(x => x.status !== 'offen' && (x.status === 'angenommen' || Date.parse(jetzt) - zeitVon(x) < 90 * TAG))
    .sort((x, y) => zeitVon(y) - zeitVon(x)).slice(0, ENTSCHIEDEN_MAX);
  const bleibt = new Set(entschieden);
  return { liste: liste.filter(x => x.status === 'offen' || bleibt.has(x)), neu: n, aktualisiert: a, abgelehnt };
}
