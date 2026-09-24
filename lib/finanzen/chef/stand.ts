// ─── Stand des Head of Finance: Berichte, Freigabe-Liste, letzte Läufe ─────
// Zwei Speicher, streng getrennt:
//   finanzchef                 — nur Business (jedes Konto darf lesen)
//   haushalt-chef--<haushalt>  — Business + Haushalt (nur Haushaltsmitglieder)
// Die Freigabe-Liste folgt der Recherche: jeder Vorschlag hat einen
// dedup_schluessel; ein offener wird aktualisiert statt verdoppelt, ein
// abgelehnter kommt 30 Tage nicht wieder, ein angenommener läuft als Aufgabe.

import type { Modus } from './prompt';
import type { Antwort, Pruefung, VorschlagRoh } from './pruefer';
import type { SteuerEinstellung } from './steuertermine';
import { STANDARD_EINSTELLUNG } from './steuertermine';

export type VorschlagStatus = 'offen' | 'angenommen' | 'abgelehnt' | 'erledigt';
export interface ChefVorschlag extends VorschlagRoh {
  id: string; status: VorschlagStatus; erstellt: string; aktualisiert: string; berichtId: string;
  entschieden?: string; von?: string; grund?: string; aufgabeId?: string;
}
export interface Bericht {
  id: string; zeit: string; modus: Modus; umfang: 'business' | 'business+haushalt';
  ausgeloest: 'takt' | 'person' | 'jarvis'; person?: string; frage?: string; monat?: string;
  antwort: Antwort; pruefung: Pruefung & { korrigiert: boolean }; modell: string; dauer_ms: number;
  /** Ohne Modellaufruf entschieden (Tagescheck ohne Neues). */
  ohneKi?: boolean;
  werkzeuge?: string[];
}
export interface ChefStand {
  berichte: Bericht[]; vorschlaege: ChefVorschlag[];
  /** Letzter erfolgreicher Lauf je Modus (ISO). */
  letzte: Partial<Record<Modus, string>>;
  /** Letzter Versuch je Modus — damit ein Fehler nicht jede Minute neu startet. */
  versuche: Partial<Record<Modus, string>>;
  /** Fingerabdruck der Lage beim letzten Tagescheck — gleich = nichts Neues. */
  tagesSchluessel?: string;
  /** Letzter Tagescheck ohne Modellaufruf. */
  ruhig?: { zeit: string; text: string };
}
export interface ChefEinstellung { steuer: SteuerEinstellung; ruecklageQuote: number | null; rechtsform: { kdv: string | null; kdc: string | null }; geaendert?: string }

export const STANDARD_CHEF_EINSTELLUNG: ChefEinstellung = { steuer: STANDARD_EINSTELLUNG, ruecklageQuote: null, rechtsform: { kdv: null, kdc: null } };
export const leererStand = (): ChefStand => ({ berichte: [], vorschlaege: [], letzte: {}, versuche: {} });
export const standName = (haushalt: string | null) => (haushalt ? `haushalt-chef--${haushalt}` : 'finanzchef');
export const EINSTELLUNG_NAME = 'finanzchef-einstellung';

const TAG = 864e5;

/** Wörter eines Titels (ab 4 Buchstaben) — für den unscharfen Abgleich. */
const woerter = (t: string) => new Set(t.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w => w.length >= 4));
/** Gleiche Art und mindestens halb dieselben Wörter → derselbe Vorschlag, anders formuliert. */
export function aehnlich(a: Pick<VorschlagRoh, 'art' | 'titel'>, b: Pick<VorschlagRoh, 'art' | 'titel'>): boolean {
  if (a.art !== b.art) return false;
  const x = woerter(a.titel), y = woerter(b.titel);
  const schnitt = Array.from(x).filter(w => y.has(w)).length;
  const verein = new Set([...Array.from(x), ...Array.from(y)]).size;
  return verein > 0 && schnitt / verein >= 0.5;
}

/** Neue Vorschläge in die Freigabe-Liste einsortieren. Rein, getestet. */
export function vorschlaegeMischen(alt: ChefVorschlag[], neu: VorschlagRoh[], berichtId: string, jetzt: string): { liste: ChefVorschlag[]; neu: number; aktualisiert: number } {
  const liste = alt.map(v => ({ ...v }));
  let n = 0, a = 0;
  for (const v of neu) {
    // Erst über den Schlüssel, dann unscharf — das Modell formuliert nicht jedes Mal gleich.
    const gleich = liste.filter(x => x.dedup_schluessel === v.dedup_schluessel || aehnlich(x, v));
    const offen = gleich.find(x => x.status === 'offen');
    if (offen) {
      Object.assign(offen, { titel: v.titel, begruendung: v.begruendung, betrag_eur: v.betrag_eur, frist: v.frist, prioritaet: v.prioritaet, quelle: v.quelle, aktualisiert: jetzt, berichtId });
      a++; continue;
    }
    if (gleich.some(x => x.status === 'angenommen')) continue; // läuft schon
    if (gleich.some(x => x.status === 'abgelehnt' && Date.parse(jetzt) - Date.parse(x.entschieden ?? x.aktualisiert) < 30 * TAG)) continue;
    liste.push({ ...v, id: `hv-${Date.parse(jetzt).toString(36)}-${n}`, status: 'offen', erstellt: jetzt, aktualisiert: jetzt, berichtId });
    n++;
  }
  // Aufräumen: Entschiedenes nach 90 Tagen raus, höchstens 120 Einträge.
  const frisch = liste.filter(x => x.status === 'offen' || x.status === 'angenommen' || Date.parse(jetzt) - Date.parse(x.entschieden ?? x.aktualisiert) < 90 * TAG);
  return { liste: frisch.slice(-120), neu: n, aktualisiert: a };
}

/** Frühere Vorschläge fürs Datenpaket — knapp, mit Status. */
export function vorschlaegeFuerDaten(l: ChefVorschlag[]) {
  return l.filter(v => v.status !== 'erledigt').slice(-20).map(v => ({
    dedup_schluessel: v.dedup_schluessel, titel: v.titel, status: v.status, frist: v.frist, betrag_eur: v.betrag_eur,
    erstellt: v.erstellt.slice(0, 10), ...(v.grund ? { grund: v.grund } : {}),
  }));
}
