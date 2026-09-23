// ─── MAKE OS — Die Auftrags-Warteschlange ───────────────────────────────────
// Baustein 3 (07.09.). Kevins Bedingung vom 06.09.: „dass Jarvis alle Agents
// mindestens gleichzeitig laufen lassen kann wenn die CPU es hergibt oder auch
// mehrmals nebeneinander, dass es schneller geht."
//
// Vorher steckte jede Ausführung in dem einen HTTP-Aufruf, auf den Kevin
// wartete: drei Runden, vier Agentenläufe, 180 Sekunden — und wenn einer hing,
// kippte alles. Jetzt legt Jarvis Aufträge ab und ein eigener Arbeiter holt
// sie sich, so viele nebeneinander wie die Maschine trägt.
//
// Drei Dinge machen das verlässlich:
//   • Der Idempotenz-Schlüssel — dieselbe Wirkung zweimal einzureihen ergibt
//     einen Auftrag, nicht zwei. Sonst stünde nach einem Wiederholungslauf die
//     Rechnung doppelt im Buch.
//   • Die Pacht — wer einen Auftrag nimmt, hält ihn befristet. Stirbt der
//     Arbeiter mitten im Lauf, fällt der Auftrag von selbst zurück.
//   • Der Versuchszähler — was dreimal scheitert, bleibt liegen, statt ewig
//     zu kreisen.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import type { Person } from './raum';

export type AuftragStatus = 'offen' | 'laeuft' | 'fertig' | 'fehler';
export type AuftragArt = 'werkzeug' | 'agent';

export interface Auftrag {
  id: string;
  zeit: string;
  tag: string;
  art: AuftragArt;
  /** Werkzeugname oder Agenten-Id. */
  name: string;
  eingabe: Record<string, unknown>;
  /** Bei Agenten: der Auftragstext. */
  auftrag?: string;
  schluessel: string;
  status: AuftragStatus;
  versuche: number;
  pachtBis?: string;
  begonnen?: string;
  beendet?: string;
  ergebnis?: string;
  fehler?: string;
  /** Kevins Satz, aus dem der Auftrag entstand. */
  anlass?: string;
  /**
   * Für wen der Auftrag läuft. Wichtig, weil der Arbeiter ihn später ausführt:
   * ohne das liefe alles unter einer Dienst-Identität, und der Hintergrund
   * würde preisgeben, was die Oberfläche korrekt verbirgt.
   */
  person?: Person;
}

interface Stand { auftraege: Auftrag[] }

const GRENZE = 400;
const MAX_VERSUCHE = 3;

/** Gleiche Wirkung, gleicher Schlüssel. Bewusst über die Eingabe gebildet und
 *  nicht über die Zeit — sonst wäre jeder Auftrag für sich einzigartig und der
 *  Schutz liefe ins Leere. */
export function schluesselFuer(art: AuftragArt, name: string, eingabe: Record<string, unknown>, auftrag?: string): string {
  const sortiert = Object.keys(eingabe).sort().map(k => `${k}=${JSON.stringify(eingabe[k])}`).join('&');
  return `${art}:${name}:${sortiert}:${(auftrag ?? '').slice(0, 120)}`;
}

export interface NeuerAuftrag {
  art: AuftragArt;
  name: string;
  eingabe?: Record<string, unknown>;
  auftrag?: string;
  anlass?: string;
  person?: Person;
}

/** Mehrere auf einmal einreihen. Gibt zurück, was neu ist und was schon lief. */
export async function reihe(neue: NeuerAuftrag[]): Promise<{ angelegt: Auftrag[]; schonDa: number }> {
  const angelegt: Auftrag[] = [];
  let schonDa = 0;
  await updateJson<Stand>('jarvis-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const laufend = new Set(liste.filter(a => a.status === 'offen' || a.status === 'laeuft').map(a => a.schluessel));
    for (const n of neue) {
      const eingabe = n.eingabe ?? {};
      const schluessel = schluesselFuer(n.art, n.name, eingabe, n.auftrag);
      if (laufend.has(schluessel)) { schonDa++; continue; }
      laufend.add(schluessel);
      angelegt.push({
        id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        zeit: new Date().toISOString(), tag: localDay(),
        art: n.art, name: n.name, eingabe,
        ...(n.auftrag ? { auftrag: n.auftrag } : {}),
        ...(n.anlass ? { anlass: n.anlass } : {}),
        ...(n.person ? { person: n.person } : {}),
        schluessel, status: 'offen', versuche: 0,
      });
    }
    const fertige = liste.filter(a => a.status === 'fertig' || a.status === 'fehler');
    const aktive = liste.filter(a => a.status === 'offen' || a.status === 'laeuft');
    return { auftraege: [...angelegt, ...aktive, ...fertige].slice(0, GRENZE) };
  });
  return { angelegt, schonDa };
}

/**
 * Bis zu `anzahl` offene Aufträge übernehmen. Läuft in EINEM updateJson —
 * der Store schreibt je Datei serialisiert, damit kann kein zweiter Arbeiter
 * denselben Auftrag danebengreifen.
 */
export async function nimm(anzahl: number, pachtSekunden = 300): Promise<Auftrag[]> {
  const genommen: Auftrag[] = [];
  const jetzt = Date.now();
  await updateJson<Stand>('jarvis-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const naechste = liste.map(a => {
      // Abgelaufene Pacht: der Arbeiter ist weg, der Auftrag ist wieder frei.
      if (a.status === 'laeuft' && a.pachtBis && Date.parse(a.pachtBis) < jetzt) {
        return { ...a, status: 'offen' as AuftragStatus, pachtBis: undefined };
      }
      return a;
    });
    for (const a of naechste) {
      if (genommen.length >= anzahl) break;
      if (a.status !== 'offen') continue;
      if (a.versuche >= MAX_VERSUCHE) { a.status = 'fehler'; a.fehler = `Nach ${MAX_VERSUCHE} Versuchen aufgegeben.`; continue; }
      a.status = 'laeuft';
      a.versuche += 1;
      a.begonnen = new Date().toISOString();
      a.pachtBis = new Date(jetzt + pachtSekunden * 1000).toISOString();
      genommen.push({ ...a });
    }
    return { auftraege: naechste };
  });
  return genommen;
}

/**
 * Ergebnis eintragen.
 *
 * `endgueltig` unterscheidet zwei Arten von Fehlschlag: „gerade nicht
 * erreichbar" darf es noch einmal versuchen, „ist ausgeschaltet" nicht — das
 * ist eine Entscheidung und kein Aussetzer. Ohne die Unterscheidung hat der
 * Arbeiter einen abgeschalteten Agenten am 07.09. dreimal hintereinander
 * angestoßen.
 */
export async function melde(id: string, status: 'fertig' | 'fehler', text: string, endgueltig = false): Promise<void> {
  await updateJson<Stand>('jarvis-auftraege', current => {
    const liste = current?.auftraege ?? [];
    return {
      auftraege: liste.map(a => a.id === id
        ? {
            ...a, status,
            beendet: new Date().toISOString(),
            pachtBis: undefined,
            ...(status === 'fertig' ? { ergebnis: text.slice(0, 1200) } : { fehler: text.slice(0, 600) }),
            // Ein Fehlschlag darf es nochmal versuchen — außer das Budget ist weg.
            ...(status === 'fehler' && !endgueltig && a.versuche < MAX_VERSUCHE ? { status: 'offen' as AuftragStatus } : {}),
          }
        : a),
    };
  });
}

export async function lies(): Promise<Auftrag[]> {
  const s = await loadJson<Stand>('jarvis-auftraege');
  return s?.auftraege ?? [];
}

export async function stand(): Promise<{ offen: number; laeuft: number; fertig: number; fehler: number }> {
  const liste = await lies();
  return {
    offen: liste.filter(a => a.status === 'offen').length,
    laeuft: liste.filter(a => a.status === 'laeuft').length,
    fertig: liste.filter(a => a.status === 'fertig').length,
    fehler: liste.filter(a => a.status === 'fehler').length,
  };
}
