// ─── Tiefenbericht zum Lesen (Gemini Deep Research über Vertex) — nur für die fragende Person (09.10.2026, Paket 6a) — Server ─────
// Kevin 08.10. (Antwort 23): „Claude-Websuche + Web-Fetch Standard · Gemini Deep Research als ‚Tiefenbericht zum Lesen‘, nur mit Klick.“
// Googles Bedingungen für Grounding/Deep Research (research/agenten/MODELLE.md 2.2, R2/R3): Suchvorschläge („Search Suggestions“) MÜSSEN
// mit angezeigt werden; Ergebnisse nur der fragenden Person zeigen; nicht „cache, … analyze, train on“; speichern nur eng. Daraus — technisch:
//   · Bestand je Person `ki-tiefenbericht--<person>` — keine andere Person, kein Haushalt, kein Dienstweg liest ihn (`tiefenberichtFuer`
//     prüft die Person der Sitzung; der Takt schreibt nur das Ergebnis hinein).
//   · NIE ins Brain, NIE an ZOE/Agenten, NIE in `fremd()`-Pakete, keine Suche darüber (der Bestand steht in keinem Index; Wächter
//     tests/ki-anbieter-tor.test.ts: kein Modul außerhalb von lib/ki liest ihn).
//   · Anzeige nur mit den Suchvorschlägen (`suchvorschlaegeHtml` — die Oberfläche zeigt es in einem abgeschotteten iframe ohne Skripte,
//     `sandbox=""`) und den Quellen.
//   · Frist 30 Tage nach Fertigstellung (enger „Chatverlauf“), danach gelöscht (`tiefenberichteAufraeumen`, Morgenlauf/Takt).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import type { TiefenberichtRoh } from './adapter/google-vertex';

export const tiefenberichtSpeicher = (person: string): string => `ki-tiefenbericht--${person}`;
export const TIEFENBERICHT_TAGE = 30;
export const FRAGE_MAX = 2000;
const PERSON = /^[a-z0-9-]{1,40}$/;

export interface Tiefenbericht {
  id: string;
  frage: string;
  modell: string;
  status: 'laeuft' | 'fertig' | 'fehler';
  gestartet: string;
  fertigAm?: string;
  /** Kennung des Vorgangs beim Anbieter (bis abgeholt). */
  vorgang?: string;
  versuche?: number;
  bericht?: TiefenberichtRoh;
  fehler?: string;
  kosten: { euroCent: number; geschaetzt: boolean };
}
interface Datei { berichte: Tiefenbericht[] }

export async function tiefenberichtAnlegen(person: string, t: Omit<Tiefenbericht, 'id' | 'gestartet' | 'status'>): Promise<Tiefenbericht> {
  if (!PERSON.test(person)) throw new Error('Person ungültig.');
  const neu: Tiefenbericht = { ...t, id: neueKennung('tb'), gestartet: new Date().toISOString(), status: 'laeuft' };
  await updateJson<Datei>(tiefenberichtSpeicher(person), cur => ({ berichte: [neu, ...(cur?.berichte ?? [])] }));
  return neu;
}

export async function tiefenberichtAbschliessen(person: string, id: string, e: { bericht?: TiefenberichtRoh; fehler?: string; versuch?: boolean }): Promise<void> {
  if (!PERSON.test(person)) return;
  await updateJson<Datei>(tiefenberichtSpeicher(person), cur => ({
    berichte: (cur?.berichte ?? []).map(b => {
      if (b.id !== id) return b;
      const { vorgang: _v, ...rest } = b;
      if (e.bericht) return { ...rest, status: 'fertig', bericht: e.bericht, fertigAm: new Date().toISOString() };
      if (e.fehler) return { ...rest, status: 'fehler', fehler: e.fehler.slice(0, 200), fertigAm: new Date().toISOString() };
      return e.versuch ? { ...b, versuche: (b.versuche ?? 0) + 1 } : b;
    }),
  }));
}

/** Die eigenen Tiefenberichte — `person` ist IMMER die Person der Sitzung (nie ein Parameter der Anfrage, nie der Dienstweg). */
export async function tiefenberichtFuer(person: string): Promise<Tiefenbericht[]> {
  if (!PERSON.test(person)) return [];
  return (await loadJson<Datei>(tiefenberichtSpeicher(person)))?.berichte ?? [];
}

/** Laufende Berichte einer Person (für den Takt). */
export async function laufendeTiefenberichte(person: string): Promise<Tiefenbericht[]> {
  return (await tiefenberichtFuer(person)).filter(b => b.status === 'laeuft' && !!b.vorgang);
}

/** Älter als die Frist → weg (rein über die Liste). */
export function nachFrist(liste: readonly Tiefenbericht[], jetzt: Date): Tiefenbericht[] {
  const grenze = jetzt.getTime() - TIEFENBERICHT_TAGE * 86_400_000;
  return liste.filter(b => b.status === 'laeuft' || Date.parse(b.fertigAm ?? b.gestartet) >= grenze);
}

export async function tiefenberichteAufraeumen(person: string, jetzt = new Date()): Promise<number> {
  if (!PERSON.test(person)) return 0;
  const vorher = (await loadJson<Datei>(tiefenberichtSpeicher(person)))?.berichte ?? [];
  const nachher = nachFrist(vorher, jetzt);
  if (nachher.length !== vorher.length) await updateJson<Datei>(tiefenberichtSpeicher(person), cur => ({ berichte: nachFrist(cur?.berichte ?? [], jetzt) }));
  return vorher.length - nachher.length;
}
