// ─── MAKE OS — Die Auftrags-Warteschlange ───────────────────────────────────
// Baustein 3 (07.09.). Kevins Bedingung vom 06.09.: „dass ZOE alle Agents
// mindestens gleichzeitig laufen lassen kann wenn die CPU es hergibt oder auch
// mehrmals nebeneinander, dass es schneller geht."
//
// Vorher steckte jede Ausführung in dem einen HTTP-Aufruf, auf den Kevin
// wartete: drei Runden, vier Agentenläufe, 180 Sekunden — und wenn einer hing,
// kippte alles. Jetzt legt ZOE Aufträge ab und ein eigener Arbeiter holt
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
import { neueKennung } from '@/lib/kennung';

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
  /**
   * Pacht-Token (29.09., Paket D-A #20): je Übernahme neu. Nur wer den passenden Token hat, darf den Auftrag
   * ausführen und das Ergebnis melden — läuft ein Lauf länger als die Pacht und der Auftrag wird neu vergeben,
   * wirkt der alte Läufer nicht mehr (kein doppeltes Ergebnis, kein Überschreiben).
   */
  pachtToken?: string;
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
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const laufend = new Set(liste.filter(a => a.status === 'offen' || a.status === 'laeuft').map(a => a.schluessel));
    for (const n of neue) {
      const eingabe = n.eingabe ?? {};
      const schluessel = schluesselFuer(n.art, n.name, eingabe, n.auftrag);
      if (laufend.has(schluessel)) { schonDa++; continue; }
      laufend.add(schluessel);
      angelegt.push({
        id: neueKennung('a'),
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
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const naechste = liste.map(a => {
      // Abgelaufene Pacht: der Arbeiter ist weg, der Auftrag ist wieder frei.
      if (a.status === 'laeuft' && a.pachtBis && Date.parse(a.pachtBis) < jetzt) {
        return { ...a, status: 'offen' as AuftragStatus, pachtBis: undefined, pachtToken: undefined };
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
      a.pachtToken = neueKennung('pacht');
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
export async function melde(id: string, pachtToken: string, status: 'fertig' | 'fehler', text: string, endgueltig = false): Promise<boolean> {
  let angenommen = false;
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    return {
      auftraege: liste.map(a => {
        // Nur der Halter der AKTUELLEN Pacht meldet (Paket D-A #20) — ein abgelaufener Läufer ändert nichts mehr.
        if (a.id !== id || a.status !== 'laeuft' || !a.pachtToken || a.pachtToken !== pachtToken) return a;
        angenommen = true;
        return {
          ...a, status,
          beendet: new Date().toISOString(),
          pachtBis: undefined, pachtToken: undefined,
          ...(status === 'fertig' ? { ergebnis: text.slice(0, 1200) } : { fehler: text.slice(0, 600) }),
          // Ein Fehlschlag darf es nochmal versuchen — außer das Budget ist weg.
          ...(status === 'fehler' && !endgueltig && a.versuche < MAX_VERSUCHE ? { status: 'offen' as AuftragStatus } : {}),
        };
      }),
    };
  });
  if (!angenommen) console.warn(`[Aufträge] Meldung zu ${id} verworfen — Pacht abgelaufen oder neu vergeben.`);
  return angenommen;
}

/**
 * Einen Auftrag von Hand abbrechen (09.10., Agenten-Bereich Paket 4b — vorher schrieb lib/agenten/laeufe.ts selbst in die Warteschlange):
 * nur offene bzw. — mit `auchLaufend` — laufende; die Pacht fällt weg (ein laufender Läufer meldet danach ins Leere), `versuche` auf das
 * Maximum (kein neuer Versuch). `pruefe` sieht den Auftrag in der Sperre (Person, Art) und liefert einen Grund zum Ablehnen.
 */
export async function abbrechen(id: string, o: { text: string; pruefe?: (a: Auftrag) => string | null }): Promise<{ ok: true; auftrag: Auftrag } | { ok: false; grund: 'fehlt' | 'beendet' | 'abgelehnt'; text?: string }> {
  let raus: { ok: true; auftrag: Auftrag } | { ok: false; grund: 'fehlt' | 'beendet' | 'abgelehnt'; text?: string } = { ok: false, grund: 'fehlt' };
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const i = liste.findIndex(a => a.id === id);
    if (i < 0) { raus = { ok: false, grund: 'fehlt' }; return current as Stand; }
    const a = liste[i];
    const nein = o.pruefe?.(a);
    if (nein) { raus = { ok: false, grund: 'abgelehnt', text: nein }; return current as Stand; }
    if (a.status !== 'offen' && a.status !== 'laeuft') { raus = { ok: false, grund: 'beendet' }; return current as Stand; }
    const { pachtBis: _p, pachtToken: _t, ...rest } = a;
    const neu: Auftrag = { ...rest, status: 'fehler', fehler: o.text.slice(0, 600), beendet: new Date().toISOString(), versuche: MAX_VERSUCHE };
    raus = { ok: true, auftrag: neu };
    return { auftraege: liste.map((x, j) => (j === i ? neu : x)) };
  });
  return raus;
}

/** Alle Aufträge, auf die `passt` zutrifft (nur offene bzw. laufende), abbrechen — z. B. beim Not-Aus. Liefert die Kennungen. */
export async function abbrechenWo(passt: (a: Auftrag) => boolean, text: string): Promise<string[]> {
  const ids: string[] = [];
  if ((await loadJson<Stand>('zoe-auftraege')) === null) return ids;
  await updateJson<Stand>('zoe-auftraege', current => {
    const liste = current?.auftraege ?? [];
    const jetzt = new Date().toISOString();
    let n = 0;
    const neu = liste.map(a => {
      if ((a.status !== 'offen' && a.status !== 'laeuft') || !passt(a)) return a;
      n++; ids.push(a.id);
      const { pachtBis: _p, pachtToken: _t, ...rest } = a;
      return { ...rest, status: 'fehler' as AuftragStatus, fehler: text.slice(0, 600), beendet: jetzt, versuche: MAX_VERSUCHE };
    });
    return n ? { auftraege: neu } : (current as Stand);
  });
  return ids;
}

/** Hält der Aufrufer die aktuelle Pacht dieses Auftrags? (vor dem Ausführen prüfen) */
export async function pachtGueltig(id: string, pachtToken: unknown): Promise<Auftrag | null> {
  if (typeof pachtToken !== 'string' || !pachtToken) return null;
  const a = (await lies()).find(x => x.id === id);
  return a && a.status === 'laeuft' && a.pachtToken === pachtToken && (!a.pachtBis || Date.parse(a.pachtBis) >= Date.now()) ? a : null;
}

export async function lies(): Promise<Auftrag[]> {
  const s = await loadJson<Stand>('zoe-auftraege');
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
