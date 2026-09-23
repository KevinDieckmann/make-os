// ─── MAKE OS — Der Freigabe-Stapel ──────────────────────────────────────────
// Baustein 2 im Kern (07.09.). Alles, was laut Register eine Freigabe braucht,
// wird nicht ausgeführt, sondern hier abgelegt — mit Vorher und Nachher, so
// wie der Trockenlauf es gerechnet hat.
//
// Kevins Vorgabe vom 06.09.: gebündelt, morgens und abends. Deshalb sammelt
// der Stapel, statt zu unterbrechen. Und: einmal freigegeben darf Jarvis den
// Auftrag durcharbeiten — das ist das Feld `durcharbeiten`.
//
// Vier Antworten statt zwei (freigeben / ändern / ablehnen / selbst machen):
// die Ablehnung trägt einen Grund, damit Jarvis beim nächsten Mal weiß, warum.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Person } from './raum';

export type VorschlagStatus = 'offen' | 'freigegeben' | 'abgelehnt' | 'fehlgeschlagen';

export interface Vorschlag {
  id: string;
  zeit: string;
  tag: string;
  werkzeug: string;
  gruppe: string;
  titel: string;
  vorher?: string;
  nachher: string;
  eingabe: Record<string, unknown>;
  /** Warum Jarvis das vorschlägt — sein eigener Satz, nicht meiner. */
  anlass?: string;
  /** Wer den Vorschlag ausgelöst hat. */
  person?: Person;
  /**
   * Woher er stammt. Wichtig fürs Etikett: bei einem Vorschlag aus dem
   * Gespräch ist der Anlass Kevins eigener Satz, bei einem aus dem Morgen-
   * oder Abendlauf ist es Jarvis' Herleitung. „Weil du gesagt hast" über eine
   * Herleitung zu schreiben, wäre eine kleine Lüge — und Vertrauen bricht an
   * kleinen Lügen.
   */
  quelle?: 'gespraech' | 'lauf';
  status: VorschlagStatus;
  entschiedenAm?: string;
  grund?: string;
  /** Ergebnis der Ausführung, sobald freigegeben. */
  ergebnis?: string;
}

interface Stand { vorschlaege: Vorschlag[] }

/** Mehr als das sammelt niemand ab. Ältere Erledigte fallen hinten raus. */
const GRENZE = 200;

/**
 * Zwei Vorschläge sind derselbe, wenn sie dasselbe Werkzeug mit derselben
 * Eingabe meinen. Gebildet wie der Schlüssel der Warteschlange — aus der
 * WIRKUNG, nicht aus der Zeit.
 *
 * Aufgefallen am 07.09.: der Morgenlauf lief zweimal (einmal durch den Takt,
 * einmal von Hand) und legte dieselben fünf Vorschläge doppelt hin. Ein
 * Stapel, in dem man dieselbe Sache zweimal wegklicken muss, ist schlimmer
 * als keiner.
 */
function kennung(werkzeug: string, eingabe: Record<string, unknown>): string {
  const sortiert = Object.keys(eingabe).sort().map(k => `${k}=${JSON.stringify(eingabe[k])}`).join('&');
  return `${werkzeug}:${sortiert}`;
}

export async function lege(v: Omit<Vorschlag, 'id' | 'zeit' | 'tag' | 'status'>): Promise<Vorschlag> {
  const vorschlag: Vorschlag = {
    ...v,
    id: `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    zeit: new Date().toISOString(),
    tag: localDay(),
    status: 'offen',
  };
  let schonDa: Vorschlag | undefined;
  await updateJson<Stand>('jarvis-stapel', current => {
    const liste = current?.vorschlaege ?? [];
    const offen = liste.filter(x => x.status === 'offen');
    // Liegt dieselbe Wirkung schon offen da, kommt nichts Zweites dazu.
    schonDa = offen.find(x => kennung(x.werkzeug, x.eingabe) === kennung(vorschlag.werkzeug, vorschlag.eingabe));
    if (schonDa) return { vorschlaege: liste };
    const erledigt = liste.filter(x => x.status !== 'offen');
    return { vorschlaege: [vorschlag, ...offen, ...erledigt.slice(0, GRENZE - offen.length - 1)] };
  });
  return schonDa ?? vorschlag;
}

export async function lies(nur?: VorschlagStatus): Promise<Vorschlag[]> {
  const s = await loadJson<Stand>('jarvis-stapel');
  const liste = s?.vorschlaege ?? [];
  return nur ? liste.filter(x => x.status === nur) : liste;
}

export async function offeneAnzahl(): Promise<number> {
  return (await lies('offen')).length;
}

export async function hole(id: string): Promise<Vorschlag | null> {
  const s = await loadJson<Stand>('jarvis-stapel');
  return (s?.vorschlaege ?? []).find(x => x.id === id) ?? null;
}

/** Entscheidung festhalten. Die Ausführung selbst passiert in der Route —
 *  der Speicher trifft keine Entscheidungen, er hält sie fest. */
export async function entscheide(
  id: string,
  status: Exclude<VorschlagStatus, 'offen'>,
  extra?: { grund?: string; ergebnis?: string; eingabe?: Record<string, unknown> },
): Promise<Vorschlag | null> {
  let raus: Vorschlag | null = null;
  await updateJson<Stand>('jarvis-stapel', current => {
    const liste = current?.vorschlaege ?? [];
    return {
      vorschlaege: liste.map(x => {
        if (x.id !== id) return x;
        raus = {
          ...x,
          status,
          entschiedenAm: new Date().toISOString(),
          ...(extra?.grund ? { grund: extra.grund } : {}),
          ...(extra?.ergebnis ? { ergebnis: extra.ergebnis } : {}),
          ...(extra?.eingabe ? { eingabe: extra.eingabe } : {}),
        };
        return raus;
      }),
    };
  });
  return raus;
}
