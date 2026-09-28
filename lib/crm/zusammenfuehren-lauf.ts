// ─── Dubletten zusammenführen — mit „Rückgängig“ (28.09., Ablaufprüfung W4) ───
// Zusammenführen war endgültig: der zweite Eintrag verschwand, alle Verweise zeigten
// danach auf den ersten. Ein Fehlklick („Erste“ statt „Zweite behalten“, zwei
// verschiedene Menschen gleichen Namens) war nur über die Tagessicherung zu retten.
//
// Jetzt legt die Dubletten-Route VOR dem Schreiben einen Zusammenführungs-Lauf ab —
// im selben Speicher wie die Import-Läufe (`crm-import-laeufe--<haushalt>`, `art:
// 'zusammenfuehren'`, 30 Tage, Art. 17 räumt ihn mit `laufOhne`):
//   · `vorher`: beide Kontakte, wie sie waren
//   · `nachher[behalten]`: Fingerabdruck des zusammengeführten Eintrags
//   · `zusammen.verweise`: je umgebogenem Eintrag (CRM-Listen, Dateiablage, Aufgaben)
//     der Vorher-Stand und der Fingerabdruck danach (`Schnappschuss`)
// „Rückgängig“ gilt nur, solange KEINER der betroffenen Einträge seitdem geändert
// wurde — sonst 409 mit Grund, nichts wird angefasst. Abgeleitete Bestände (Import-
// Konflikte, Head-Vorschläge/Replay, Termin-Signale) bleiben beim behaltenen Eintrag;
// sie werden beim nächsten Lauf neu gerechnet.
//
// Rein bis auf `fingerabdruck` (node:crypto) — nur Server. Getestet in tests/crm-dubletten-lauf.test.ts.

import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { CRM_LISTEN, type CrmBestand, type CrmListe } from './typen';
import type { ImportLauf, Schnappschuss } from './import-lauf';
import type { Kontakt } from '@/lib/make-one/crm';

type MitId = { id: string } & Record<string, unknown>;
const abdruck = (e: MitId) => fingerabdruck(e);

/** Schnappschüsse einer Liste: jeder Eintrag, der sich zwischen `vorher` und `nachher` unterscheidet (auch neu/weg). */
export function schnappschuesse(speicher: string, vorher: readonly MitId[], nachher: readonly MitId[]): Schnappschuss[] {
  const alt = new Map(vorher.map(e => [e.id, e]));
  const neu = new Map(nachher.map(e => [e.id, e]));
  const raus: Schnappschuss[] = [];
  for (const [id, a] of Array.from(alt)) {
    const n = neu.get(id);
    if (!n) raus.push({ speicher, id, vorher: a, nachher: null });
    else if (abdruck(a) !== abdruck(n)) raus.push({ speicher, id, vorher: a, nachher: abdruck(n) });
  }
  for (const [id, n] of Array.from(neu)) if (!alt.has(id)) raus.push({ speicher, id, vorher: null, nachher: abdruck(n) });
  return raus;
}

export const crmSpeicher = (l: CrmListe) => `crm:${l}`;
/** Alle CRM-Listen vergleichen (`crm:<liste>`). */
export function crmSchnappschuesse(vorher: CrmBestand, nachher: CrmBestand): Schnappschuss[] {
  return CRM_LISTEN.flatMap(l => schnappschuesse(crmSpeicher(l), (vorher[l] ?? []) as unknown as MitId[], (nachher[l] ?? []) as unknown as MitId[]));
}

/** Welche Schnappschüsse passen nicht mehr zum aktuellen Stand (Eintrag seitdem geändert, gelöscht oder neu)? */
export function schnappschussKonflikte(s: readonly Schnappschuss[], aktuell: readonly MitId[]): Schnappschuss[] {
  const jetzt = new Map(aktuell.map(e => [e.id, e]));
  return s.filter(x => {
    const e = jetzt.get(x.id);
    return x.nachher === null ? !!e : !e || abdruck(e) !== x.nachher;
  });
}

/** Vorher-Stände zurückschreiben (nur aufrufen, wenn `schnappschussKonflikte` leer ist). Reihenfolge bleibt. */
export function schnappschuesseAnwenden<T extends MitId>(liste: readonly T[], s: readonly Schnappschuss[]): T[] {
  const nachId = new Map(s.map(x => [x.id, x]));
  const raus: T[] = [];
  for (const e of liste) {
    const x = nachId.get(e.id);
    if (!x) raus.push(e);
    else if (x.vorher) raus.push(x.vorher as T);
    // vorher null: der Eintrag entstand erst durchs Zusammenführen — fällt weg
  }
  for (const x of s) if (x.vorher && !liste.some(e => e.id === x.id)) raus.push(x.vorher as T);
  return raus;
}

/** Die Schnappschüsse nach Speicher gruppiert (`crm:chancen`, `dateien:<haushalt>`, `tasks`). */
export function nachSpeicher(s: readonly Schnappschuss[]): Map<string, Schnappschuss[]> {
  const m = new Map<string, Schnappschuss[]>();
  for (const x of s) m.set(x.speicher, [...(m.get(x.speicher) ?? []), x]);
  return m;
}

/** Den Lauf bauen (vor dem Schreiben der Kartei). */
export function zusammenLauf(p: { id: string; am: string; person: string; a: Kontakt; b: Kontakt; ergebnis: Kontakt; verweise: Schnappschuss[] }): ImportLauf {
  return {
    id: p.id, am: p.am, person: p.person, quelle: 'Dubletten', art: 'zusammenfuehren',
    neu: [], vorher: [p.a, p.b], nachher: { [p.a.id]: abdruck(p.ergebnis as unknown as MitId) },
    zusammen: { behalten: p.a.id, weg: p.b.id, verweise: p.verweise },
  };
}

/**
 * Darf der Lauf zurück? Liefert die Gründe (leer = ja): der behaltene Kontakt seitdem geändert/gelöscht, der
 * weggefallene inzwischen wieder da, ein umgebogener Eintrag seitdem geändert. Nur Anzahlen, keine Namen.
 */
export function rueckgaengigGruende(lauf: ImportLauf, kontakte: readonly Kontakt[], aktuell: (speicher: string) => readonly MitId[] | null): string[] {
  const z = lauf.zusammen;
  if (lauf.art !== 'zusammenfuehren' || !z || lauf.verfallen || !z.behalten) return ['Dieser Lauf kann nicht zurück (Person inzwischen gelöscht, Art. 17).'];
  const g: string[] = [];
  const a = kontakte.find(k => k.id === z.behalten);
  if (!a) g.push('Der behaltene Eintrag ist inzwischen gelöscht.');
  else if (abdruck(a as unknown as MitId) !== lauf.nachher[z.behalten]) g.push('Der behaltene Eintrag wurde seit dem Zusammenführen geändert.');
  if (kontakte.some(k => k.id === z.weg)) g.push('Der zweite Eintrag existiert inzwischen wieder.');
  for (const [speicher, s] of Array.from(nachSpeicher(z.verweise))) {
    const liste = aktuell(speicher);
    if (!liste) { g.push(`${speicher}: Bestand nicht lesbar.`); continue; }
    const k = schnappschussKonflikte(s, liste).length;
    if (k) g.push(`${k} ${k === 1 ? 'verknüpfter Eintrag' : 'verknüpfte Einträge'} (${speicherWort(speicher)}) seitdem geändert.`);
  }
  return g;
}

const speicherWort = (s: string) => (s.startsWith('crm:') ? s.slice(4) : s.startsWith('dateien:') ? 'Dateiablage' : s === 'tasks' ? 'Aufgaben' : s);
