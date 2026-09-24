// ─── Freigabe-Liste und Berichte der Heads ─────────────────────────────────
// Ein Speicher je Head (head-sales, head-marketing, head-event), geteilt von
// Kevin und Malin — Geschäftsdaten, nichts Privates. Dedup wie beim Head of
// Finance: erst über den Schlüssel, dann unscharf über art + Titel; was
// abgelehnt wurde, kommt 30 Tage nicht wieder.

import type { Antwort, Pruefung, Vorschlag } from './pruefer';
import type { HeadId } from './prompt';

export type Status = 'offen' | 'angenommen' | 'abgelehnt' | 'erledigt';
export interface HeadVorschlag extends Vorschlag { id: string; status: Status; erstellt: string; aktualisiert: string; entschieden?: string; von?: string; berichtId: string }
export interface HeadBericht { id: string; zeit: string; modus: string; ausgeloest: 'hand' | 'takt' | 'jarvis'; person?: string; frage?: string; antwort: Antwort; pruefung: Pruefung & { korrigiert: boolean }; modell: string; dauer_ms: number }
export interface HeadStand { berichte: HeadBericht[]; vorschlaege: HeadVorschlag[]; letzte: Record<string, string>; versuche: Record<string, string>; ruhig?: { zeit: string; text: string } }

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

export function mischen(alt: HeadVorschlag[], neu: Vorschlag[], berichtId: string, jetzt: string): { liste: HeadVorschlag[]; neu: number; aktualisiert: number } {
  const liste = alt.map(v => ({ ...v }));
  let n = 0, a = 0;
  for (const v of neu) {
    const gleich = liste.filter(x => x.dedup_schluessel === v.dedup_schluessel || aehnlich(x, v));
    const offen = gleich.find(x => x.status === 'offen');
    if (offen) { Object.assign(offen, { ...v, id: offen.id, status: 'offen', erstellt: offen.erstellt, aktualisiert: jetzt, berichtId }); a++; continue; }
    if (gleich.some(x => x.status === 'angenommen')) continue;
    if (gleich.some(x => x.status === 'abgelehnt' && Date.parse(jetzt) - Date.parse(x.entschieden ?? x.aktualisiert) < 30 * TAG)) continue;
    liste.push({ ...v, id: `hs-${Date.parse(jetzt).toString(36)}-${n}`, status: 'offen', erstellt: jetzt, aktualisiert: jetzt, berichtId });
    n++;
  }
  const frisch = liste.filter(x => x.status === 'offen' || x.status === 'angenommen' || Date.parse(jetzt) - Date.parse(x.entschieden ?? x.aktualisiert) < 90 * TAG);
  return { liste: frisch.slice(-120), neu: n, aktualisiert: a };
}
